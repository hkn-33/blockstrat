"""Historical price bars per instrument and timeframe."""

import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import httpx
import pandas as pd

from blockstrat.schema import Timeframe

BINANCE_KLINES_URL = "https://data-api.binance.vision/api/v3/klines"
BINANCE_PAGE_LIMIT = 1000
REFRESH_AFTER_SECONDS = 24 * 60 * 60
TIMEFRAME_MILLISECONDS: dict[Timeframe, int] = {
    "1d": 86_400_000,
    "4h": 14_400_000,
    "1h": 3_600_000,
}


@dataclass(frozen=True)
class Instrument:
    symbol: str
    label: str


BINANCE_INSTRUMENTS: tuple[Instrument, ...] = tuple(
    Instrument(symbol=f"{base}USDT", label=f"{base}/USDT")
    for base in ("BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "DOGE", "AVAX", "LINK", "LTC")
)


class UnknownInstrumentError(ValueError):
    pass


class MarketData(Protocol):
    """A market: its instruments and their bars. Future markets (GPW, US stocks) implement this too."""

    def instruments(self) -> tuple[Instrument, ...]: ...

    def bars(self, symbol: str, timeframe: Timeframe) -> pd.DataFrame:
        """OHLCV bars indexed by UTC open time, oldest first, columns Open/High/Low/Close/Volume."""
        ...


class BinanceMarketData:
    """Binance spot klines from the public market-data API (no key), cached as pickled frames.

    Pickle, not parquet: it needs no extra engine (Windows application control can block pyarrow's DLL),
    and the files are only ever written and read by this class.
    """

    def __init__(self, cache_dir: Path) -> None:
        self._cache_dir = cache_dir
        self._cache_dir.mkdir(parents=True, exist_ok=True)
        self._memory: dict[tuple[str, Timeframe], tuple[float, pd.DataFrame]] = {}
        # One lock per instrument and timeframe: requests and the warm-up never download the same file twice.
        self._locks: dict[tuple[str, Timeframe], threading.Lock] = {}
        self._locks_guard = threading.Lock()

    def instruments(self) -> tuple[Instrument, ...]:
        return BINANCE_INSTRUMENTS

    def bars(self, symbol: str, timeframe: Timeframe) -> pd.DataFrame:
        if symbol not in {instrument.symbol for instrument in BINANCE_INSTRUMENTS}:
            raise UnknownInstrumentError(symbol)
        key = (symbol, timeframe)
        with self._lock_for(key):
            cached = self._memory.get(key)
            if cached is not None and time.time() - cached[0] < REFRESH_AFTER_SECONDS:
                return cached[1]
            frame = self._load_or_refresh(symbol, timeframe)
            # pandas builds an index's lookup table on first use, and two threads doing that at once (the long
            # and the short search) can see it as not unique. Built here, under the lock, it is shared read-only.
            _ = frame.index.is_unique
            self._memory[key] = (time.time(), frame)
            return frame

    def warm_up(self, timeframes: tuple[Timeframe, ...]) -> None:
        """Downloads every instrument and timeframe so the first user request does not wait for Binance."""
        for timeframe in timeframes:
            for instrument in BINANCE_INSTRUMENTS:
                try:
                    self.bars(instrument.symbol, timeframe)
                except httpx.HTTPError:
                    pass  # Retried lazily on the first request for it.

    def _lock_for(self, key: tuple[str, Timeframe]) -> threading.Lock:
        with self._locks_guard:
            return self._locks.setdefault(key, threading.Lock())

    def _cache_path(self, symbol: str, timeframe: Timeframe) -> Path:
        return self._cache_dir / f"binance_{symbol}_{timeframe}.pkl"

    def _load_or_refresh(self, symbol: str, timeframe: Timeframe) -> pd.DataFrame:
        path = self._cache_path(symbol, timeframe)
        existing: pd.DataFrame | None = pd.read_pickle(path) if path.exists() else None
        is_fresh = path.exists() and time.time() - path.stat().st_mtime < REFRESH_AFTER_SECONDS
        if existing is not None and is_fresh:
            return existing

        start_ms = 0 if existing is None else int(existing.index[-1].timestamp() * 1000) + 1
        fetched = _fetch_klines(symbol, timeframe, start_ms)
        combined = fetched if existing is None else pd.concat([existing, fetched])
        combined = _drop_unfinished_bar(combined[~combined.index.duplicated(keep="last")], timeframe)
        combined.to_pickle(path)
        return combined


def _fetch_klines(symbol: str, timeframe: Timeframe, start_ms: int) -> pd.DataFrame:
    rows: list[list[object]] = []
    with httpx.Client(timeout=30) as client:
        while True:
            response = client.get(
                BINANCE_KLINES_URL,
                params={
                    "symbol": symbol,
                    "interval": timeframe,
                    "startTime": start_ms,
                    "limit": BINANCE_PAGE_LIMIT,
                },
            )
            response.raise_for_status()
            page: list[list[object]] = response.json()
            rows.extend(page)
            if len(page) < BINANCE_PAGE_LIMIT:
                break
            start_ms = int(page[-1][0]) + 1  # type: ignore[call-overload]
    return _klines_to_frame(rows)


def _klines_to_frame(rows: list[list[object]]) -> pd.DataFrame:
    frame = pd.DataFrame(
        [row[:6] for row in rows],
        columns=["OpenTime", "Open", "High", "Low", "Close", "Volume"],
    )
    frame.index = pd.to_datetime(frame.pop("OpenTime").astype("int64"), unit="ms", utc=True)
    return frame.astype("float64")


def _drop_unfinished_bar(frame: pd.DataFrame, timeframe: Timeframe) -> pd.DataFrame:
    if frame.empty:
        return frame
    last_close_ms = frame.index[-1].timestamp() * 1000 + TIMEFRAME_MILLISECONDS[timeframe]
    if last_close_ms > time.time() * 1000:
        return frame.iloc[:-1]
    return frame
