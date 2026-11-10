"""Precomputes the landing page's interactive demo from real backtests.

The landing page is prerendered and must not depend on the API being up, so every combination the
demo offers is run once here and stored as JSON. Rerun after changing the demo's options:

    uv run python scripts/landing_demo.py
"""

import json
from itertools import product
from pathlib import Path

from blockstrat.backtest import run_backtest
from blockstrat.market_data import BinanceMarketData
from blockstrat.schema import BacktestResult, Strategy

BACKEND_DIR = Path(__file__).resolve().parent.parent
OUTPUT_PATH = BACKEND_DIR.parent / "frontend" / "app" / "data" / "landing-demo.json"

MARKETS = ("BTCUSDT", "ETHUSDT", "SOLUSDT")
RSI_ENTRY_LEVELS = (25, 30, 35)
STOP_LOSS_LEVELS = (5, 10)
TIMEFRAME = "4h"
RSI_EXIT_LEVEL = 70
CHART_POINTS = 120
RECENT_TRADES = 6


def rsi_strategy(market: str, rsi_entry: int, stop_loss: int) -> Strategy:
    rsi = {"kind": "rsi", "period": 14}
    return Strategy.model_validate({
        "instrument": market,
        "timeframe": TIMEFRAME,
        "entry": {
            "direction": "long",
            "condition": {"kind": "compare", "operator": "lt", "left": rsi, "right": {"kind": "constant", "value": rsi_entry}},
        },
        "exit": {
            "rule": {"kind": "compare", "operator": "gt", "left": rsi, "right": {"kind": "constant", "value": RSI_EXIT_LEVEL}},
            "stop_loss_pct": stop_loss,
        },
    })


def trend_strategy(market: str, stop_loss: int) -> Strategy:
    fast = {"kind": "ema", "period": 20}
    slow = {"kind": "sma", "period": 50}
    return Strategy.model_validate({
        "instrument": market,
        "timeframe": TIMEFRAME,
        "entry": {"direction": "long", "condition": {"kind": "compare", "operator": "crosses_above", "left": fast, "right": slow}},
        "exit": {
            "rule": {"kind": "compare", "operator": "crosses_below", "left": fast, "right": slow},
            "stop_loss_pct": stop_loss,
        },
    })


def thin(points: list[float], count: int) -> list[float]:
    if len(points) <= count:
        return points
    step = (len(points) - 1) / (count - 1)
    return [round(points[round(index * step)], 2) for index in range(count)]


def summarize(strategy: Strategy, result: BacktestResult) -> dict[str, object]:
    commission = strategy.execution.commission_pct / 100
    fees_paid = sum(commission * trade.size * (trade.entry_price + trade.exit_price) for trade in result.trades)
    return {
        "start_time": result.start_time,
        "end_time": result.end_time,
        "bar_count": result.bar_count,
        "metrics": result.metrics.model_dump(),
        "fees_paid": round(fees_paid, 2),
        "equity": thin([point.value for point in result.equity], CHART_POINTS),
        "buy_and_hold": thin([point.value for point in result.buy_and_hold], CHART_POINTS),
        "recent_trades": [
            {"entry_time": trade.entry_time, "exit_time": trade.exit_time, "return_pct": round(trade.return_pct, 2)}
            for trade in result.trades[-RECENT_TRADES:]
        ],
    }


def main() -> None:
    market_data = BinanceMarketData(BACKEND_DIR / "data")
    runs: dict[str, object] = {}
    for market, rsi_entry, stop_loss in product(MARKETS, RSI_ENTRY_LEVELS, STOP_LOSS_LEVELS):
        strategy = rsi_strategy(market, rsi_entry, stop_loss)
        result = run_backtest(strategy, market_data.bars(market, TIMEFRAME), "full")
        runs[f"rsi{rsi_entry}:{market}:{stop_loss}"] = summarize(strategy, result)
    for market, stop_loss in product(MARKETS, STOP_LOSS_LEVELS):
        strategy = trend_strategy(market, stop_loss)
        result = run_backtest(strategy, market_data.bars(market, TIMEFRAME), "full")
        runs[f"trend:{market}:{stop_loss}"] = summarize(strategy, result)

    demo = {
        "timeframe": TIMEFRAME,
        "rsi_exit_level": RSI_EXIT_LEVEL,
        "markets": MARKETS,
        "rsi_entry_levels": RSI_ENTRY_LEVELS,
        "stop_loss_levels": STOP_LOSS_LEVELS,
        "runs": runs,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(demo, indent=1))
    print(f"Wrote {len(runs)} runs to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
