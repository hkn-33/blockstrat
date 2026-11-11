"""Precomputes the landing page's interactive demo from real backtests.

The landing page is prerendered and must not depend on the API being up, so every combination the
demo offers is run once here and stored as JSON. Each run uses the builder's own preview window
(the most recent 3000 four-hour candles), so the numbers are the ones a visitor would see first.
Rerun after changing the demo's options:

    uv run python scripts/landing_demo.py
"""

import json
from itertools import product
from pathlib import Path

import pandas as pd

from blockstrat.backtest import run_backtest
from blockstrat.market_data import BinanceMarketData
from blockstrat.schema import BacktestResult, Strategy

BACKEND_DIR = Path(__file__).resolve().parent.parent
OUTPUT_PATH = BACKEND_DIR.parent / "frontend" / "app" / "data" / "landing-demo.json"

MARKETS = ("BTCUSDT", "ETHUSDT", "SOLUSDT")
# The "same rules, different coins" section shows Solana beside these two, at the 5% stop only. They were
# picked from a survey of all ten pairs because the real results there run from clear wins to clear losses.
COMPARISON_MARKETS = ("LINKUSDT", "ADAUSDT")
STRATEGIES = ("dip", "trend", "combo")
STOP_LOSS_LEVELS = (5, 10)
COMPARISON_STOP_LOSS = 5
TIMEFRAME = "4h"
TAKE_PROFIT_PCT = 15

RSI = {"kind": "rsi", "period": 14}
EMA_FAST = {"kind": "ema", "period": 20}
SMA_SLOW = {"kind": "sma", "period": 50}


def constant(value: float) -> dict[str, object]:
    return {"kind": "constant", "value": value}


def compare(operator: str, left: dict[str, object], right: dict[str, object]) -> dict[str, object]:
    return {"kind": "compare", "operator": operator, "left": left, "right": right}


def demo_strategy(name: str, market: str, stop_loss: int) -> Strategy:
    if name == "dip":
        entry = compare("lt", RSI, constant(30))
        exit_rule: dict[str, object] = {"rule": compare("gt", RSI, constant(70)), "stop_loss_pct": stop_loss}
    elif name == "trend":
        entry = compare("crosses_above", EMA_FAST, SMA_SLOW)
        exit_rule = {"rule": compare("crosses_below", EMA_FAST, SMA_SLOW), "stop_loss_pct": stop_loss}
    else:
        # Two entry conditions and three ways out: the hero's example of a fuller strategy.
        entry = {"kind": "and", "conditions": [compare("crosses_above", EMA_FAST, SMA_SLOW), compare("lt", RSI, constant(70))]}
        exit_rule = {
            "rule": compare("crosses_below", EMA_FAST, SMA_SLOW),
            "stop_loss_pct": stop_loss,
            "take_profit_pct": TAKE_PROFIT_PCT,
        }
    return Strategy.model_validate({
        "instrument": market,
        "timeframe": TIMEFRAME,
        "entry": {"direction": "long", "condition": entry},
        "exit": exit_rule,
    })


def daily(result: BacktestResult) -> pd.DataFrame:
    """The run's four-hour bars and balance, merged into one row per day for the chart."""
    frame = pd.DataFrame(
        {
            "open": [bar.open for bar in result.bars],
            "high": [bar.high for bar in result.bars],
            "low": [bar.low for bar in result.bars],
            "close": [bar.close for bar in result.bars],
            "equity": [point.value for point in result.equity],
        },
        index=pd.to_datetime([bar.time for bar in result.bars], unit="s", utc=True),
    )
    return frame.resample("1D").agg({"open": "first", "high": "max", "low": "min", "close": "last", "equity": "last"}).dropna()


def unix_day(timestamp: pd.Timestamp) -> int:
    return int(timestamp.normalize().timestamp())


def summarize(strategy: Strategy, result: BacktestResult) -> dict[str, object]:
    commission = strategy.execution.commission_pct / 100
    fees_paid = sum(commission * trade.size * (trade.entry_price + trade.exit_price) for trade in result.trades)
    days = daily(result)
    return {
        "metrics": result.metrics.model_dump(),
        "fees_paid": round(fees_paid, 2),
        # One balance per day, on the same days as the market's candles.
        "equity": [round(value) for value in days["equity"]],
        "trades": [
            {
                "entry_time": unix_day(pd.Timestamp(trade.entry_time, unit="s")),
                "entry_price": float(f"{trade.entry_price:.5g}"),
                "exit_time": unix_day(pd.Timestamp(trade.exit_time, unit="s")),
                "exit_price": float(f"{trade.exit_price:.5g}"),
                "return_pct": round(trade.return_pct, 2),
            }
            for trade in result.trades
        ],
    }


def candles(result: BacktestResult, volumes: pd.Series) -> list[list[float]]:
    days = daily(result)
    volume_by_day = volumes.resample("1D").sum()
    return [
        [unix_day(time), *(float(f"{value:.5g}") for value in (row.open, row.high, row.low, row.close)), round(float(volume_by_day.get(time, 0.0)))]
        for time, row in days.iterrows()
    ]


def main() -> None:
    market_data = BinanceMarketData(BACKEND_DIR / "data")
    runs: dict[str, object] = {}
    markets: dict[str, object] = {}
    for market in (*MARKETS, *COMPARISON_MARKETS):
        bars = market_data.bars(market, TIMEFRAME)
        stop_losses = STOP_LOSS_LEVELS if market in MARKETS else (COMPARISON_STOP_LOSS,)
        for name, stop_loss in product(STRATEGIES, stop_losses):
            strategy = demo_strategy(name, market, stop_loss)
            result = run_backtest(strategy, bars, "preview")
            runs[f"{name}:{market}:{stop_loss}"] = summarize(strategy, result)
            markets[market] = {"candles": candles(result, bars["Volume"])}

    demo = {"timeframe": TIMEFRAME, "take_profit_pct": TAKE_PROFIT_PCT, "markets": markets, "runs": runs}
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(demo, separators=(",", ":")))
    print(f"Wrote {len(runs)} runs to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
