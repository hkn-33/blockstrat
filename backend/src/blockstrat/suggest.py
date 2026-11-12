"""Strategies that match trades a user marked on a chart.

The user marks the candles where they would have bought and sold. Every ready condition the builder offers,
with its numbers varied over a small grid, is checked for how closely its signals land on those marks; the
best of each idea come back as ordinary strategies. It finds a starting point, not a winner: the result of
each proposal on the whole history comes back with it, so a rule that only fits the marks is easy to spot.
"""

from dataclasses import dataclass
from typing import Literal

import numpy as np
import pandas as pd
from pydantic import BaseModel, Field

from blockstrat.backtest import run_backtest
from blockstrat.schema import (
    Bar,
    BollingerOperand,
    ChangeOperand,
    Comparison,
    ComparisonOperator,
    ConstantOperand,
    EmaOperand,
    Exit,
    HighestOperand,
    LowestOperand,
    MacdOperand,
    Operand,
    PriceOperand,
    RsiOperand,
    Side,
    SideDraft,
    SmaOperand,
    StochasticOperand,
    Strategy,
    StrategyDraft,
    Timeframe,
)
from blockstrat.signals import condition_series

CHART_BAR_COUNT = 1500
MINIMUM_MARKS_PER_KIND = 2
PROPOSAL_COUNT = 3
# A signal this many candles from a mark still counts as hitting it: nobody clicks the exact candle.
TOLERANCE_BARS = 2
# What a signal with no mark near it costs, in marks hit. Without it a rule that fires all the time wins.
EXTRA_SIGNAL_PENALTY = 0.25

CLOSE = PriceOperand(field="close")


class Mark(BaseModel):
    time: int = Field(description="The marked candle's open time, UNIX seconds")
    side: Literal["buy", "sell"]


class SuggestRequest(BaseModel):
    instrument: str
    timeframe: Timeframe
    marks: list[Mark] = Field(max_length=400)


class Proposal(BaseModel):
    name: str
    strategy: StrategyDraft
    buys_hit: int
    buys_marked: int
    extra_buys: int = Field(description="Buy signals between the first and last mark with no buy mark near them")
    sells_hit: int
    sells_marked: int
    extra_sells: int
    entry_times: list[int] = Field(description="When the entry rule signals, within the candles /api/bars returns")
    exit_times: list[int]
    total_return_pct: float = Field(description="On the whole history, not only the marked stretch")
    buy_and_hold_return_pct: float
    trade_count: int


class SuggestResponse(BaseModel):
    proposals: list[Proposal]


class BarsResponse(BaseModel):
    bars: list[Bar]


class TooFewMarksError(ValueError):
    pass


@dataclass(frozen=True)
class Candidate:
    family: str
    condition: Comparison


def _compare(left: Operand, operator: ComparisonOperator, right: Operand) -> Comparison:
    return Comparison(operator=operator, left=left, right=right)


def _number(value: float) -> ConstantOperand:
    return ConstantOperand(value=value)


def _macd(line: Literal["macd", "signal"]) -> MacdOperand:
    return MacdOperand(line=line)


def _candidates(is_entry: bool) -> list[Candidate]:
    """The grid for one end of a trade. Entries look for a turn up or a dip; exits are their mirror."""
    crosses: ComparisonOperator = "crosses_above" if is_entry else "crosses_below"
    beyond: ComparisonOperator = "lt" if is_entry else "gt"
    candidates: list[Candidate] = []

    rsi_levels = (25, 30, 35, 40) if is_entry else (60, 65, 70, 75)
    for period in (7, 14, 21):
        for level in rsi_levels:
            candidates.append(Candidate("RSI dip" if is_entry else "RSI peak", _compare(RsiOperand(period=period), beyond, _number(level))))

    for period in (20, 50, 100, 200):
        family = "Price back above its average" if is_entry else "Price back below its average"
        candidates.append(Candidate(family, _compare(CLOSE, crosses, SmaOperand(period=period))))

    for fast, slow in ((9, 21), (12, 26), (20, 50), (50, 200)):
        family = "Fast average crossing up" if is_entry else "Fast average crossing down"
        candidates.append(Candidate(family, _compare(EmaOperand(period=fast), crosses, SmaOperand(period=slow))))

    family = "Momentum turning up" if is_entry else "Momentum turning down"
    candidates.append(Candidate(family, _compare(_macd("macd"), crosses, _macd("signal"))))

    for period, width in ((20, 2.0), (20, 2.5), (10, 2.0)):
        band = BollingerOperand(period=period, std_dev=width, band="lower" if is_entry else "upper")
        candidates.append(Candidate("Unusually low price" if is_entry else "Unusually high price", _compare(CLOSE, beyond, band)))

    for period in (10, 20, 55):
        if is_entry:
            candidates.append(Candidate("Breakout to a new high", _compare(CLOSE, crosses, HighestOperand(period=period))))
        else:
            candidates.append(Candidate("Break below a recent low", _compare(CLOSE, crosses, LowestOperand(period=period))))

    for level in (20, 30) if is_entry else (70, 80):
        family = "Stochastic low" if is_entry else "Stochastic high"
        candidates.append(Candidate(family, _compare(StochasticOperand(), beyond, _number(level))))

    for period in (3, 7, 14):
        for size in (5, 10, 15):
            family = "Sharp drop" if is_entry else "Sharp rise"
            candidates.append(Candidate(family, _compare(ChangeOperand(period=period), beyond, _number(-size if is_entry else size))))
    return candidates


ENTRY_CANDIDATES = _candidates(is_entry=True)
EXIT_CANDIDATES = _candidates(is_entry=False)


@dataclass(frozen=True)
class Match:
    candidate: Candidate
    hits: int
    extras: int
    signals: np.ndarray

    @property
    def score(self) -> float:
        return self.hits - EXTRA_SIGNAL_PENALTY * self.extras


def _signal_bars(bars: pd.DataFrame, condition: Comparison) -> np.ndarray:
    """The bars on which the condition turns true: "RSI below 30" is one signal, not one per candle it lasts."""
    series = condition_series(bars, condition).to_numpy()
    turned_true = series & ~np.concatenate(([False], series[:-1]))
    return np.flatnonzero(turned_true)


def _match(candidate: Candidate, bars: pd.DataFrame, marks: np.ndarray, span: tuple[int, int]) -> Match:
    signals = _signal_bars(bars, candidate.condition)
    in_span = signals[(signals >= span[0]) & (signals <= span[1])]
    if not len(marks) or not len(in_span):
        return Match(candidate, 0, len(in_span), signals)
    distances = np.abs(in_span[:, None] - marks[None, :])
    hits = int((distances.min(axis=0) <= TOLERANCE_BARS).sum())
    extras = int((distances.min(axis=1) > TOLERANCE_BARS).sum())
    return Match(candidate, hits, extras, signals)


def _best_per_family(candidates: list[Candidate], bars: pd.DataFrame, marks: np.ndarray, span: tuple[int, int]) -> list[Match]:
    """The best match of each idea, best idea first, so the proposals differ in more than a number."""
    best: dict[str, Match] = {}
    for candidate in candidates:
        match = _match(candidate, bars, marks, span)
        current = best.get(candidate.family)
        if current is None or match.score > current.score:
            best[candidate.family] = match
    return sorted(best.values(), key=lambda match: match.score, reverse=True)


def _mark_bars(bars: pd.DataFrame, marks: list[Mark], side: str) -> np.ndarray:
    times = pd.to_datetime([mark.time for mark in marks if mark.side == side], unit="s", utc=True)
    positions = bars.index.get_indexer(times, method="nearest")
    return np.unique(positions[positions >= 0])


def _times(bars: pd.DataFrame, positions: np.ndarray) -> list[int]:
    first_charted = len(bars) - CHART_BAR_COUNT
    return [int(bars.index[position].timestamp()) for position in positions if position >= first_charted]


def latest_bars(bars: pd.DataFrame) -> list[Bar]:
    """The candles a user marks on: the most recent ones, few enough to draw and to click."""
    return [
        Bar(time=int(timestamp.timestamp()), open=row.Open, high=row.High, low=row.Low, close=row.Close)
        for timestamp, row in zip(bars.index[-CHART_BAR_COUNT:], bars.iloc[-CHART_BAR_COUNT:].itertuples())
    ]


def suggest_strategies(request: SuggestRequest, bars: pd.DataFrame) -> list[Proposal]:
    buys = _mark_bars(bars, request.marks, "buy")
    sells = _mark_bars(bars, request.marks, "sell")
    if len(buys) < MINIMUM_MARKS_PER_KIND or len(sells) < MINIMUM_MARKS_PER_KIND:
        raise TooFewMarksError(f"Mark at least {MINIMUM_MARKS_PER_KIND} buys and {MINIMUM_MARKS_PER_KIND} sells")

    every_mark = np.concatenate((buys, sells))
    span = (int(every_mark.min()) - TOLERANCE_BARS, int(every_mark.max()) + TOLERANCE_BARS)
    entries = _best_per_family(ENTRY_CANDIDATES, bars, buys, span)[:PROPOSAL_COUNT]
    exit_ = _best_per_family(EXIT_CANDIDATES, bars, sells, span)[0]

    proposals = []
    for entry in entries:
        exit_rule = Exit(rule=exit_.candidate.condition)
        draft = StrategyDraft(
            instrument=request.instrument,
            timeframe=request.timeframe,
            sides=(SideDraft(direction="long", entry=entry.candidate.condition, exit=exit_rule),),
        )
        complete = Strategy(
            instrument=request.instrument,
            timeframe=request.timeframe,
            sides=(Side(direction="long", entry=entry.candidate.condition, exit=exit_rule),),
        )
        result = run_backtest(complete, bars, "full")
        proposals.append(Proposal(
            name=entry.candidate.family,
            strategy=draft,
            buys_hit=entry.hits,
            buys_marked=len(buys),
            extra_buys=entry.extras,
            sells_hit=exit_.hits,
            sells_marked=len(sells),
            extra_sells=exit_.extras,
            entry_times=_times(bars, entry.signals),
            exit_times=_times(bars, exit_.signals),
            total_return_pct=result.metrics.total_return_pct,
            buy_and_hold_return_pct=result.metrics.buy_and_hold_return_pct,
            trade_count=result.metrics.trade_count,
        ))
    return proposals
