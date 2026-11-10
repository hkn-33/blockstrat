"""HTTP API used by the frontend."""

import os
import threading
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, ValidationError

from strategy_lab.ai import (
    RESTING_MESSAGE,
    AiBuildFailed,
    AiBuildRequest,
    AiBuildResponse,
    GeminiStrategyBuilder,
    RateLimiter,
    StrategyBuilder,
    build_strategy,
)
from strategy_lab.backtest import NotEnoughDataError, run_backtest
from strategy_lab.market_data import BinanceMarketData, MarketData, UnknownInstrumentError
from strategy_lab.schema import (
    TIMEFRAMES,
    BacktestRequest,
    BacktestResponse,
    ExecutionModel,
    MissingResponse,
    ResultResponse,
    Strategy,
    Timeframe,
)


class InstrumentInfo(BaseModel):
    symbol: str
    label: str


class InstrumentsResponse(BaseModel):
    instruments: list[InstrumentInfo]
    timeframes: list[Timeframe]


class ExecutionPreset(BaseModel):
    id: str
    label: str
    execution: ExecutionModel


EXECUTION_PRESETS: list[ExecutionPreset] = [
    ExecutionPreset(
        id="binance-spot",
        label="Binance spot",
        execution=ExecutionModel(commission_pct=0.1, slippage_bps=5),
    ),
    ExecutionPreset(
        id="pessimistic",
        label="Pessimistic",
        execution=ExecutionModel(commission_pct=0.2, slippage_bps=25),
    ),
    ExecutionPreset(
        id="no-costs",
        label="No costs (unrealistic)",
        execution=ExecutionModel(commission_pct=0, slippage_bps=0),
    ),
]


def create_app(
    market_data: MarketData,
    strategy_builder: StrategyBuilder | None = None,
    rate_limiter: RateLimiter | None = None,
) -> FastAPI:
    ai_rate_limiter = rate_limiter or RateLimiter(per_ip_per_hour=10, global_per_day=200)
    app = FastAPI(title="Strategy Lab")
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=os.environ.get("FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(","),
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @app.get("/api/instruments")
    def instruments() -> InstrumentsResponse:
        return InstrumentsResponse(
            instruments=[
                InstrumentInfo(symbol=instrument.symbol, label=instrument.label)
                for instrument in market_data.instruments()
            ],
            timeframes=list(TIMEFRAMES),
        )

    @app.get("/api/execution-presets")
    def execution_presets() -> list[ExecutionPreset]:
        return EXECUTION_PRESETS

    @app.post("/api/backtest")
    def backtest(request: BacktestRequest) -> BacktestResponse:
        missing = request.strategy.missing_parts()
        if missing:
            return MissingResponse(missing=missing)
        try:
            strategy = Strategy.model_validate(request.strategy.model_dump())
        except ValidationError as error:
            raise HTTPException(status_code=422, detail=error.errors(include_url=False)) from error
        try:
            bars = market_data.bars(strategy.instrument, strategy.timeframe)
            return ResultResponse(result=run_backtest(strategy, bars, request.mode))
        except UnknownInstrumentError as error:
            raise HTTPException(status_code=422, detail=f"Unknown instrument: {error}") from error
        except NotEnoughDataError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error

    @app.post("/api/ai/build-strategy")
    def ai_build_strategy(request: AiBuildRequest, http_request: Request) -> AiBuildResponse:
        client_ip = http_request.client.host if http_request.client else "unknown"
        if not ai_rate_limiter.allow(client_ip):
            return AiBuildFailed(status="rate_limited", message=RESTING_MESSAGE)
        return build_strategy(request, strategy_builder, market_data.instruments())

    return app


def create_default_app() -> FastAPI:
    cache_dir = Path(os.environ.get("MARKET_DATA_DIR", "data"))
    gemini_key = os.environ.get("GEMINI_API_KEY")
    builder = (
        GeminiStrategyBuilder(gemini_key, os.environ.get("GEMINI_MODEL", "gemini-flash-latest"))
        if gemini_key
        else None
    )
    rate_limiter = RateLimiter(
        per_ip_per_hour=int(os.environ.get("AI_REQUESTS_PER_IP_PER_HOUR", "10")),
        global_per_day=int(os.environ.get("AI_REQUESTS_PER_DAY", "200")),
    )
    market_data = BinanceMarketData(cache_dir)
    threading.Thread(target=market_data.warm_up, args=(TIMEFRAMES,), daemon=True).start()
    return create_app(market_data, builder, rate_limiter)
