"""Adapter from a Strategy to a backtesting.py run (ADR 0002). The only module that imports backtesting."""

import math
import warnings

import numpy as np
import pandas as pd
from backtesting import Strategy as EngineStrategy
from backtesting.backtesting import Trade as EngineTrade
from backtesting.lib import FractionalBacktest

from blockstrat.schema import (
    BacktestMode,
    BacktestPeriod,
    BacktestResult,
    Bar,
    Direction,
    Metrics,
    Side,
    SideResult,
    Strategy,
    TimePoint,
    Trade,
)
from blockstrat.signals import condition_operands, condition_series, warmed_up

STARTING_CASH = 10_000
PREVIEW_BAR_COUNT = 3000
# Charts are sent at most this many points; longer histories are merged into fewer, longer candles. A year of
# hourly candles fits unmerged, so a trade's entry and exit never share a candle on the chart when they did
# not share one in the test. Metrics always use every bar.
MAX_CHART_POINTS = 10_000
# backtesting.py rejects size == 1 (it means "one unit"); just under 1 means "all equity".
MAX_EQUITY_FRACTION = 0.9999


class NotEnoughDataError(ValueError):
    pass


class SideSignals:
    """One side's entry and exit signals, one value per bar, plus its stop-loss and take-profit."""

    def __init__(self, side: Side | None, entry: np.ndarray, exit_: np.ndarray) -> None:
        self.side = side
        self.entry = entry
        self.exit = exit_


PERIOD_LENGTHS: dict[BacktestPeriod, pd.DateOffset] = {
    "3m": pd.DateOffset(months=3),
    "6m": pd.DateOffset(months=6),
    "1y": pd.DateOffset(years=1),
    "3y": pd.DateOffset(years=3),
}


def run_backtest(strategy: Strategy, bars: pd.DataFrame, mode: BacktestMode, period: BacktestPeriod = "all") -> BacktestResult:
    # The signals see the whole history, so the indicators are warmed up on the first candle of a period too.
    signals = _signals(strategy, bars)
    kept = PREVIEW_BAR_COUNT if mode == "preview" else len(bars)
    if period != "all":
        kept = min(kept, int((bars.index > bars.index[-1] - PERIOD_LENGTHS[period]).sum()))
    if kept < len(bars):
        bars = bars.iloc[-kept:]
        signals = {
            direction: SideSignals(side.side, side.entry[-kept:], side.exit[-kept:])
            for direction, side in signals.items()
        }
    if len(bars) < 2:
        raise NotEnoughDataError("At least two bars are needed for a backtest")

    both_signalled = [0]
    # Fractional units: a 10 000 account must be able to buy part of a 90 000 BTC.
    engine = FractionalBacktest(
        bars,
        _engine_strategy(strategy, signals, both_signalled),
        cash=STARTING_CASH,
        commission=strategy.execution.commission_pct / 100,
        spread=strategy.execution.slippage_bps / 10_000,
        margin=1 / strategy.execution.leverage,
        trade_on_close=False,
        exclusive_orders=False,
        finalize_trades=True,
        fractional_unit=1e-8,
    )
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        stats = engine.run()
    return _to_result(mode, bars, stats, strategy, both_signalled[0])


def _signals(strategy: Strategy, bars: pd.DataFrame) -> dict[Direction, SideSignals]:
    """Entry and exit signals for both directions; a direction the strategy lacks never fires."""
    operands = []
    for side in strategy.sides:
        operands += condition_operands(side.entry)
        if side.exit.rule is not None:
            operands += condition_operands(side.exit.rule)
    # Every side waits until the indicators of both sides are warmed up, so neither gets a head start.
    ready = warmed_up(bars, operands)
    never = np.zeros(len(bars), dtype=bool)
    signals: dict[Direction, SideSignals] = {}
    for direction in ("long", "short"):
        side = strategy.side(direction)
        if side is None:
            signals[direction] = SideSignals(None, never, never)
            continue
        entry = (condition_series(bars, side.entry) & ready).to_numpy()
        exit_ = never if side.exit.rule is None else _turns_true((condition_series(bars, side.exit.rule) & ready).to_numpy())
        signals[direction] = SideSignals(side, entry, exit_)
    return signals


def _turns_true(holds: np.ndarray) -> np.ndarray:
    """An exit rule closes a trade on the bar it becomes true, not on every bar it stays true: "RSI above 75"
    that already held when the trade was entered would otherwise close it on the very next candle."""
    return holds & ~np.concatenate(([False], holds[:-1]))


def _engine_strategy(
    strategy: Strategy, signals: dict[Direction, SideSignals], both_signalled: list[int]
) -> type[EngineStrategy]:
    size = min(strategy.position_size_pct / 100, MAX_EQUITY_FRACTION)
    long_side = signals["long"]
    short_side = signals["short"]

    class SignalStrategy(EngineStrategy):
        def init(self) -> None:
            pass

        def next(self) -> None:
            bar = len(self.data) - 1
            # Orders placed here fill at the next bar's open (trade_on_close=False): no look-ahead.
            if self.position:
                # An open position closes only by its own side's rules; the other side's entry is ignored.
                own = long_side if self.position.is_long else short_side
                self._protect_open_trade()
                if own.exit[bar]:
                    self.position.close()
                return
            if self.orders:
                return
            wants_long = bool(long_side.entry[bar])
            wants_short = bool(short_side.entry[bar])
            if wants_long and wants_short:
                both_signalled[0] += 1
            elif wants_long:
                self.buy(size=size)
            elif wants_short:
                self.sell(size=size)

        def _protect_open_trade(self) -> None:
            # Stop-loss and take-profit are relative to the actual fill price, known only after the fill.
            # ponytail: they and the trailing stop become active from the bar after the entry bar; an intrabar
            # hit on the entry bar itself is missed. Pass sl/tp to buy()/sell() from the signal close if that matters.
            for trade in self.trades:
                side = (long_side if trade.is_long else short_side).side
                if side is None:
                    continue
                direction = 1 if trade.is_long else -1
                if side.exit.stop_loss_pct is not None and trade.sl is None:
                    trade.sl = trade.entry_price * (1 - direction * side.exit.stop_loss_pct / 100)
                if side.exit.take_profit_pct is not None and trade.tp is None:
                    trade.tp = trade.entry_price * (1 + direction * side.exit.take_profit_pct / 100)
                if side.exit.trailing_stop_pct is not None:
                    self._trail_stop(trade, side.exit.trailing_stop_pct)

        def _trail_stop(self, trade: EngineTrade, trailing_stop_pct: float) -> None:
            # Runs once per bar from the entry bar on, so the latest bar's extreme is enough to follow the
            # extreme since the entry. Keeping the tighter of the old and new stop never moves it back and
            # also keeps a fixed stop-loss whenever that one is tighter.
            if trade.is_long:
                trailing = self.data.High[-1] * (1 - trailing_stop_pct / 100)
                trade.sl = trailing if trade.sl is None else max(trade.sl, trailing)
            else:
                trailing = self.data.Low[-1] * (1 + trailing_stop_pct / 100)
                trade.sl = trailing if trade.sl is None else min(trade.sl, trailing)

    return SignalStrategy


def _unix_seconds(timestamp: pd.Timestamp) -> int:
    return int(timestamp.timestamp())


def _optional_number(value: float) -> float | None:
    return None if value is None or math.isnan(value) else float(value)


def _optional_hours(duration: pd.Timedelta) -> float | None:
    return None if pd.isna(duration) else duration.total_seconds() / 3600


def _optional_days(duration: pd.Timedelta) -> float | None:
    return None if pd.isna(duration) else duration.total_seconds() / 86_400


def _chart_frame(bars: pd.DataFrame, equity: pd.Series, buy_and_hold: pd.Series) -> pd.DataFrame:
    """Bars and curves for charts, merged into buckets of consecutive bars when there are too many."""
    frame = bars[["Open", "High", "Low", "Close"]].assign(
        Equity=equity.to_numpy(), BuyAndHold=buy_and_hold.to_numpy()
    )
    bucket_size = math.ceil(len(frame) / MAX_CHART_POINTS)
    if bucket_size == 1:
        return frame
    buckets = np.arange(len(frame)) // bucket_size
    merged = frame.groupby(buckets).agg(
        Open=("Open", "first"),
        High=("High", "max"),
        Low=("Low", "min"),
        Close=("Close", "last"),
        Equity=("Equity", "last"),
        BuyAndHold=("BuyAndHold", "last"),
    )
    merged.index = frame.index[::bucket_size]
    return merged


def _side_results(strategy: Strategy, trades: list[Trade]) -> list[SideResult]:
    results = []
    for side in strategy.sides:
        own = [trade for trade in trades if trade.direction == side.direction]
        winners = sum(1 for trade in own if trade.profit > 0)
        results.append(SideResult(
            direction=side.direction,
            trade_count=len(own),
            win_rate_pct=winners / len(own) * 100 if own else None,
            return_pct=sum(trade.profit for trade in own) / STARTING_CASH * 100,
        ))
    return results


def _to_result(mode: BacktestMode, bars: pd.DataFrame, stats: pd.Series, strategy: Strategy, both_signalled: int) -> BacktestResult:
    first_close = bars["Close"].iloc[0]
    chart = _chart_frame(
        bars,
        equity=stats["_equity_curve"]["Equity"],
        buy_and_hold=STARTING_CASH * bars["Close"] / first_close,
    )
    times = [_unix_seconds(timestamp) for timestamp in chart.index]

    trades = [
        Trade(
            direction="long" if row.Size > 0 else "short",
            entry_time=_unix_seconds(row.EntryTime),
            entry_price=float(row.EntryPrice),
            exit_time=_unix_seconds(row.ExitTime),
            exit_price=float(row.ExitPrice),
            size=float(abs(row.Size)),
            return_pct=float(row.ReturnPct * 100),
            profit=float(row.PnL),
        )
        for row in stats["_trades"].itertuples()
    ]

    return BacktestResult(
        mode=mode,
        bar_count=len(bars),
        start_time=_unix_seconds(bars.index[0]),
        end_time=_unix_seconds(bars.index[-1]),
        bars=[
            Bar(time=time, open=row.Open, high=row.High, low=row.Low, close=row.Close)
            for time, row in zip(times, chart.itertuples())
        ],
        equity=[TimePoint(time=time, value=float(value)) for time, value in zip(times, chart["Equity"])],
        buy_and_hold=[TimePoint(time=time, value=float(value)) for time, value in zip(times, chart["BuyAndHold"])],
        trades=trades,
        metrics=Metrics(
            total_return_pct=float(stats["Return [%]"]),
            buy_and_hold_return_pct=float(stats["Buy & Hold Return [%]"]),
            max_drawdown_pct=float(stats["Max. Drawdown [%]"]),
            sharpe_ratio=_optional_number(stats["Sharpe Ratio"]),
            win_rate_pct=_optional_number(stats["Win Rate [%]"]),
            trade_count=int(stats["# Trades"]),
            exposure_time_pct=float(stats["Exposure Time [%]"]),
            annual_return_pct=_optional_number(stats["Return (Ann.) [%]"]),
            sortino_ratio=_optional_number(stats["Sortino Ratio"]),
            calmar_ratio=_optional_number(stats["Calmar Ratio"]),
            profit_factor=_optional_number(stats["Profit Factor"]),
            avg_trade_pct=_optional_number(stats["Avg. Trade [%]"]),
            avg_trade_hours=_optional_hours(stats["Avg. Trade Duration"]),
            max_drawdown_days=_optional_days(stats["Max. Drawdown Duration"]),
        ),
        sides=_side_results(strategy, trades),
        both_signalled=both_signalled,
    )
