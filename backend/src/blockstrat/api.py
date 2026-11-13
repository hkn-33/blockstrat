"""HTTP API used by the frontend."""

import logging
import os
import threading
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, ValidationError

from blockstrat.ai import (
    DEFAULT_GROQ_MODEL,
    GroqStrategyBuilder,
    RESTING_MESSAGE,
    AiBuildFailed,
    AiBuildRequest,
    AiBuildResponse,
    RateLimiter,
    StrategyBuilder,
    build_strategy,
)
from blockstrat.backtest import NotEnoughDataError, run_backtest
from blockstrat.market_data import BinanceMarketData, MarketData, UnknownInstrumentError
from blockstrat.schema import (
    TIMEFRAMES,
    BacktestRequest,
    BacktestResponse,
    ExecutionModel,
    MissingResponse,
    ResultResponse,
    Strategy,
    Timeframe,
)
from blockstrat.suggest import (
    BarsResponse,
    SuggestRequest,
    SuggestResponse,
    TooFewMarksError,
    latest_bars,
    suggest_strategies,
)


logger = logging.getLogger(__name__)

# The largest request accepted: an AI conversation at its longest (20 messages of 6000 characters) fits.
MAX_REQUEST_BYTES = 256_000
# Strategy searches run a few hundred backtests each; this many at once is what the server can take.
MAX_SEARCHES_AT_ONCE = 2


@dataclass(frozen=True)
class EndpointLimits:
    """How often one address may call the endpoints that cost the server work, and all addresses together."""

    backtest: RateLimiter
    suggest: RateLimiter
    bars: RateLimiter


def default_endpoint_limits() -> EndpointLimits:
    # The builder reruns a backtest on each edit, for each market shown, so that limit is generous; a search is
    # seconds of work and a person runs a few an hour.
    return EndpointLimits(
        backtest=RateLimiter(per_ip_per_hour=int(os.environ.get("BACKTESTS_PER_IP_PER_HOUR", "1500")), global_per_day=200_000),
        suggest=RateLimiter(per_ip_per_hour=int(os.environ.get("SEARCHES_PER_IP_PER_HOUR", "30")), global_per_day=3_000),
        bars=RateLimiter(per_ip_per_hour=int(os.environ.get("CHARTS_PER_IP_PER_HOUR", "300")), global_per_day=50_000),
    )


def _client_ip(request: Request) -> str:
    # Behind the proxy, uvicorn has already put the real client address here (see the Dockerfile).
    return request.client.host if request.client else "unknown"


def _enforce(limiter: RateLimiter, request: Request) -> None:
    wait = limiter.retry_after(_client_ip(request))
    if wait:
        raise HTTPException(status_code=429, detail="Too many requests. Try again later.", headers={"Retry-After": str(wait)})


SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Resource-Policy": "cross-origin",
}


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
    endpoint_limits: EndpointLimits | None = None,
    show_docs: bool = False,
) -> FastAPI:
    ai_rate_limiter = rate_limiter or RateLimiter(per_ip_per_hour=10, global_per_day=200)
    limits = endpoint_limits or default_endpoint_limits()
    searches = threading.BoundedSemaphore(MAX_SEARCHES_AT_ONCE)
    # The schema and the interactive docs are for development; in production they would only map the API for others.
    app = FastAPI(
        title="BlockStrat",
        docs_url="/docs" if show_docs else None,
        redoc_url=None,
        openapi_url="/openapi.json" if show_docs else None,
    )

    # Starlette answers an unhandled error outside every middleware, so the 500 would lose its CORS headers
    # and the browser would report the server as unreachable. Answering it here keeps it inside CORS.
    @app.middleware("http")
    async def unexpected_error_as_500(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        # An oversized body is refused from its declared length, before any of it is read into memory.
        declared = request.headers.get("content-length")
        if declared is not None and (not declared.isdigit() or int(declared) > MAX_REQUEST_BYTES):
            return PlainTextResponse("Request too large", status_code=413)
        try:
            response = await call_next(request)
        except Exception as error:
            # The path and the kind of error only: never the body, which can hold what users typed.
            logger.error("Unhandled %s in %s %s", type(error).__name__, request.method, request.url.path)
            response = PlainTextResponse("Internal Server Error", status_code=500)
        response.headers.update(SECURITY_HEADERS)
        return response

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
    def backtest(request: BacktestRequest, http_request: Request) -> BacktestResponse:
        _enforce(limits.backtest, http_request)
        missing = request.strategy.missing_parts()
        if missing:
            return MissingResponse(missing=missing)
        try:
            # An unfinished second side is left out rather than blocking the side that is ready.
            draft = request.strategy.model_dump()
            draft["sides"] = [side.model_dump() for side in request.strategy.complete_sides()]
            strategy = Strategy.model_validate(draft)
        except ValidationError as error:
            raise HTTPException(status_code=422, detail=error.errors(include_url=False)) from error
        known_symbols = {instrument.symbol for instrument in market_data.instruments()}
        unknown_extras = [symbol for symbol in strategy.extra_instruments if symbol not in known_symbols]
        if unknown_extras:
            raise HTTPException(status_code=422, detail=f"Unknown instrument: {', '.join(unknown_extras)}")
        try:
            # Only the main instrument is tested; the frontend sends one request per extra instrument (ADR 0004).
            bars = market_data.bars(strategy.instrument, strategy.timeframe)
            return ResultResponse(result=run_backtest(strategy, bars, request.mode, request.period))
        except UnknownInstrumentError as error:
            raise HTTPException(status_code=422, detail=f"Unknown instrument: {error}") from error
        except NotEnoughDataError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error

    @app.get("/api/bars")
    def bars(instrument: str, timeframe: Timeframe, http_request: Request) -> BarsResponse:
        _enforce(limits.bars, http_request)
        try:
            return BarsResponse(bars=latest_bars(market_data.bars(instrument, timeframe)))
        except UnknownInstrumentError as error:
            raise HTTPException(status_code=422, detail=f"Unknown instrument: {error}") from error

    @app.post("/api/suggest-strategies")
    def suggest(request: SuggestRequest, http_request: Request) -> SuggestResponse:
        _enforce(limits.suggest, http_request)
        # A search keeps a core busy for seconds; beyond a few at once the rest are asked to come back shortly.
        if not searches.acquire(blocking=False):
            raise HTTPException(status_code=503, detail="Other searches are running. Try again in a moment.", headers={"Retry-After": "5"})
        try:
            history = market_data.bars(request.instrument, request.timeframe)
            return SuggestResponse(proposals=suggest_strategies(request, history))
        except UnknownInstrumentError as error:
            raise HTTPException(status_code=422, detail=f"Unknown instrument: {error}") from error
        except (TooFewMarksError, NotEnoughDataError) as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        finally:
            searches.release()

    @app.post("/api/ai/build-strategy")
    def ai_build_strategy(request: AiBuildRequest, http_request: Request) -> AiBuildResponse:
        if not ai_rate_limiter.allow(_client_ip(http_request)):
            return AiBuildFailed(status="rate_limited", message=RESTING_MESSAGE)
        return build_strategy(request, strategy_builder, market_data.instruments())

    return app


def create_default_app() -> FastAPI:
    # Local development keeps its settings (the AI key) in backend/.env; a deployment sets real variables, which win.
    load_dotenv(".env", override=False)
    cache_dir = Path(os.environ.get("MARKET_DATA_DIR", "data"))
    groq_key = os.environ.get("GROQ_API_KEY")
    builder = GroqStrategyBuilder(groq_key, os.environ.get("GROQ_MODEL", DEFAULT_GROQ_MODEL)) if groq_key else None
    rate_limiter = RateLimiter(
        per_ip_per_hour=int(os.environ.get("AI_REQUESTS_PER_IP_PER_HOUR", "10")),
        global_per_day=int(os.environ.get("AI_REQUESTS_PER_DAY", "200")),
    )
    market_data = BinanceMarketData(cache_dir)
    threading.Thread(target=market_data.warm_up, args=(TIMEFRAMES,), daemon=True).start()
    return create_app(market_data, builder, rate_limiter, show_docs=os.environ.get("API_DOCS") == "1")
