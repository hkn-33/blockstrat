"""Adapter from a Strategy to a backtesting.py run (ADR 0002). The only module that imports backtesting."""

import math
import warnings

import numpy as np
import pandas as pd
from backtesting import Strategy as EngineStrategy
from backtesting.lib import FractionalBacktest

from strategy_lab.schema import (
    BacktestMode,
    BacktestResult,
    Bar,
    Metrics,
    Strategy,
    TimePoint,
    Trade,
)
from strategy_lab.signals import condition_operands, condition_series, warmed_up

STARTING_CASH = 10_000
PREVIEW_BAR_COUNT = 3000
# Charts never need more points than a screen has pixels; metrics still use every bar.
MAX_CHART_POINTS = 5000
# backtesting.py rejects size == 1 (it means "one unit"); just under 1 means "all equity".
MAX_EQUITY_FRACTION = 0.9999


class NotEnoughDataError(ValueError):
    pass


def run_backtest(strategy: Strategy, bars: pd.DataFrame, mode: BacktestMode) -> BacktestResult:
    entry_signal, exit_signal = _signals(strategy, bars)
    if mode == "preview":
        bars = bars.iloc[-PREVIEW_BAR_COUNT:]
        entry_signal = entry_signal.iloc[-PREVIEW_BAR_COUNT:]
        exit_signal = exit_signal.iloc[-PREVIEW_BAR_COUNT:]
    if len(bars) < 2:
        raise NotEnoughDataError("At least two bars are needed for a backtest")

    # Fractional units: a 10 000 account must be able to buy part of a 90 000 BTC.
    engine = FractionalBacktest(
        bars,
        _engine_strategy(strategy, entry_signal.to_numpy(), exit_signal.to_numpy()),
        cash=STARTING_CASH,
        commission=strategy.execution.commission_pct / 100,
        spread=strategy.execution.slippage_bps / 10_000,
        trade_on_close=False,
        exclusive_orders=False,
        finalize_trades=True,
        fractional_unit=1e-8,
    )
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        stats = engine.run()
    return _to_result(mode, bars, stats)


def _signals(strategy: Strategy, bars: pd.DataFrame) -> tuple[pd.Series, pd.Series]:
    operands = condition_operands(strategy.entry.condition)
    if strategy.exit.rule is not None:
        operands += condition_operands(strategy.exit.rule)
    ready = warmed_up(bars, operands)
    entry_signal = condition_series(bars, strategy.entry.condition) & ready
    if strategy.exit.rule is None:
        exit_signal = pd.Series(False, index=bars.index)
    else:
        exit_signal = condition_series(bars, strategy.exit.rule) & ready
    return entry_signal, exit_signal


def _engine_strategy(
    strategy: Strategy, entry_signal: np.ndarray, exit_signal: np.ndarray
) -> type[EngineStrategy]:
    size = min(strategy.position_size_pct / 100, MAX_EQUITY_FRACTION)
    is_long = strategy.entry.direction == "long"
    stop_loss = strategy.exit.stop_loss_pct
    take_profit = strategy.exit.take_profit_pct

    class SignalStrategy(EngineStrategy):
        def init(self) -> None:
            pass

        def next(self) -> None:
            bar = len(self.data) - 1
            # Orders placed here fill at the next bar's open (trade_on_close=False): no look-ahead.
            if self.position:
                self._protect_open_trade()
                if exit_signal[bar]:
                    self.position.close()
                return
            if entry_signal[bar] and not self.orders:
                if is_long:
                    self.buy(size=size)
                else:
                    self.sell(size=size)

        def _protect_open_trade(self) -> None:
            # Stop-loss and take-profit are relative to the actual fill price, known only after the fill.
            # ponytail: they become active from the bar after the entry bar; an intrabar hit on the
            # entry bar itself is missed. Pass sl/tp to buy()/sell() from the signal close if that matters.
            for trade in self.trades:
                direction = 1 if trade.is_long else -1
                if stop_loss is not None and trade.sl is None:
                    trade.sl = trade.entry_price * (1 - direction * stop_loss / 100)
                if take_profit is not None and trade.tp is None:
                    trade.tp = trade.entry_price * (1 + direction * take_profit / 100)

    return SignalStrategy


def _unix_seconds(timestamp: pd.Timestamp) -> int:
    return int(timestamp.timestamp())


def _optional_number(value: float) -> float | None:
    return None if value is None or math.isnan(value) else float(value)


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


def _to_result(mode: BacktestMode, bars: pd.DataFrame, stats: pd.Series) -> BacktestResult:
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
        ),
    )
