from pathlib import Path

import pandas as pd
import pytest

from blockstrat import market_data
from blockstrat.market_data import BinanceMarketData
from conftest import make_bars


def test_cached_bars_are_read_back_without_downloading_again(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    downloads: list[str] = []

    def fake_fetch(symbol: str, timeframe: str, start_ms: int) -> pd.DataFrame:
        downloads.append(symbol)
        return make_bars([100.0, 101.0, 102.0])

    monkeypatch.setattr(market_data, "_fetch_klines", fake_fetch)

    first = BinanceMarketData(tmp_path).bars("BTCUSDT", "1d")
    # A new instance has nothing in memory: it can only get the bars from the cache file.
    second = BinanceMarketData(tmp_path).bars("BTCUSDT", "1d")

    assert downloads == ["BTCUSDT"]
    pd.testing.assert_frame_equal(first, second)
