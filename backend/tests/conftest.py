from typing import Any

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from blockstrat.api import create_app
from blockstrat.market_data import Instrument, UnknownInstrumentError
from blockstrat.schema import Timeframe

FIXTURE_SYMBOL = "TESTUSDT"


def make_bars(closes: list[float], lows: dict[int, float] | None = None, highs: dict[int, float] | None = None) -> pd.DataFrame:
    """Daily bars where each bar opens 1 below its close, so fills at the open are easy to spot."""
    opens = [close - 1 for close in closes]
    frame = pd.DataFrame(
        {
            "Open": opens,
            "High": [max(o, c) + 1 for o, c in zip(opens, closes)],
            "Low": [min(o, c) - 1 for o, c in zip(opens, closes)],
            "Close": closes,
            "Volume": [1000.0] * len(closes),
        },
        index=pd.date_range("2020-01-01", periods=len(closes), freq="D", tz="UTC"),
    )
    for bar, low in (lows or {}).items():
        frame.iloc[bar, frame.columns.get_loc("Low")] = low
    for bar, high in (highs or {}).items():
        frame.iloc[bar, frame.columns.get_loc("High")] = high
    return frame


class FakeMarketData:
    def __init__(self) -> None:
        self.frames: dict[str, pd.DataFrame] = {}

    def instruments(self) -> tuple[Instrument, ...]:
        return tuple(Instrument(symbol=symbol, label=symbol) for symbol in self.frames)

    def bars(self, symbol: str, timeframe: Timeframe) -> pd.DataFrame:
        if symbol not in self.frames:
            raise UnknownInstrumentError(symbol)
        return self.frames[symbol]


@pytest.fixture
def market_data() -> FakeMarketData:
    return FakeMarketData()


@pytest.fixture
def client(market_data: FakeMarketData) -> TestClient:
    return TestClient(create_app(market_data))


def close_crosses(operator: str, level: float) -> dict[str, Any]:
    return {
        "kind": "compare",
        "operator": operator,
        "left": {"kind": "price", "field": "close"},
        "right": {"kind": "constant", "value": level},
    }


NO_COSTS = {"commission_pct": 0, "slippage_bps": 0}


def strategy(**overrides: Any) -> dict[str, Any]:
    """A complete long strategy: enter when close crosses above 100, exit when it crosses back below."""
    base: dict[str, Any] = {
        "instrument": FIXTURE_SYMBOL,
        "timeframe": "1d",
        "entry": {"direction": "long", "condition": close_crosses("crosses_above", 100)},
        "exit": {"rule": close_crosses("crosses_below", 100)},
        "execution": NO_COSTS,
    }
    base.update(overrides)
    return base
