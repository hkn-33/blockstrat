"""Strategies that match trades a user marked on a chart.

The user marks the candles where they would have got in and out, long or short. Every ready condition the
builder offers, with its numbers varied over a small grid, is checked for how closely its signals land on
those marks. The best ideas, alone and in pairs, are then narrowed one condition at a time: a trend, momentum,
RSI or volume condition is added when it drops signals far from the marks and keeps those on them. Each rule
gets whichever way out did best on the recent history: the drawn stop-loss and take-profit, a trailing stop
that lets winners run, or its own sell rules. Of the rules that fit the marks at least half as well as the
best one, those that made money lead: a rule that fits but loses the account to fees is no starting point,
and one that lands on none of the trades drawn is not what was asked for. The result of each proposal on the
whole history comes with it.
"""

import math
from dataclasses import dataclass
from itertools import combinations
from typing import Literal

import numpy as np
import pandas as pd
from pydantic import BaseModel, Field

from blockstrat.backtest import run_backtest
from blockstrat.schema import (
    AllOf,
    AnyOf,
    Bar,
    BollingerOperand,
    ChangeOperand,
    Comparison,
    ComparisonOperator,
    Condition,
    ConstantOperand,
    Direction,
    EmaOperand,
    Exit,
    HighestOperand,
    LowestOperand,
    MacdOperand,
    Operand,
    PriceOperand,
    RelativeVolumeOperand,
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

# Enough to mark on: over two years of hourly candles, the whole history of 4-hour and daily ones.
CHART_BAR_COUNT = 20_000
MINIMUM_MARKS_PER_KIND = 2
PROPOSAL_COUNT = 4
# A signal this many candles from a mark still counts as hitting it: nobody clicks the exact candle.
TOLERANCE_BARS = 2
# What a signal with no mark near it costs, in marks hit. Without it a rule that fires all the time wins.
EXTRA_SIGNAL_PENALTY = 0.25
# How many ideas, and how many rules of each, are tried on the history before the proposals are chosen.
IDEAS_TRIED = 5
# The best ideas are also tried two at a time, both required: a dip that only counts when momentum turns too.
IDEAS_COMBINED = 4
RULES_TRIED_PER_IDEA = 2
# At most this many conditions are added to narrow a rule down to the marks.
NARROWING_STEPS = 2
# Without a drawn stop-loss to size it from, a trailing stop this far behind the best price.
DEFAULT_TRAILING_STOP_PCT = 6

CLOSE = PriceOperand(field="close")


class Mark(BaseModel):
    time: int = Field(description="The marked candle's open time, UNIX seconds")
    side: Literal["buy", "sell"]


class SuggestRequest(BaseModel):
    instrument: str
    timeframe: Timeframe
    # A long trade is marked as a buy then a sell; a short trade as a sell then a buy.
    direction: Direction = "long"
    marks: list[Mark] = Field(max_length=400)
    # Trades drawn as boxes on the chart carry their own limits; the proposals keep them.
    stop_loss_pct: float | None = Field(default=None, gt=0, lt=100)
    take_profit_pct: float | None = Field(default=None, gt=0, le=1000)


class Proposal(BaseModel):
    name: str
    strategy: StrategyDraft
    exit_note: str = Field(description="How the strategy gets out, in words, and why when it is not as drawn")
    entries_hit: int
    entries_marked: int
    extra_entries: int = Field(description="Entry signals between the first and last mark with no entry mark near them")
    exits_hit: int
    exits_marked: int
    extra_exits: int
    entry_times: list[int] = Field(description="When the strategy's trades got in, within the candles /api/bars returns")
    exit_times: list[int] = Field(description="When they got out, within the same candles")
    total_return_pct: float = Field(description="On the whole history, not only the marked stretch")
    max_drawdown_pct: float = Field(description="The deepest fall from a high on the whole history, zero or below")
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
    condition: Condition


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
class Narrowing:
    """A condition that holds for a while, added to a rule to keep only some of its signals."""

    phrase: str
    condition: Condition


NARROWINGS = (
    Narrowing("above its 200-candle average", _compare(CLOSE, "gt", SmaOperand(period=200))),
    Narrowing("below its 200-candle average", _compare(CLOSE, "lt", SmaOperand(period=200))),
    Narrowing("above its 50-candle average", _compare(CLOSE, "gt", SmaOperand(period=50))),
    Narrowing("below its 50-candle average", _compare(CLOSE, "lt", SmaOperand(period=50))),
    Narrowing("while RSI is under 50", _compare(RsiOperand(period=14), "lt", _number(50))),
    Narrowing("while RSI is over 50", _compare(RsiOperand(period=14), "gt", _number(50))),
    Narrowing("with momentum rising", _compare(_macd("macd"), "gt", _macd("signal"))),
    Narrowing("with momentum falling", _compare(_macd("macd"), "lt", _macd("signal"))),
    Narrowing("on heavy volume", _compare(RelativeVolumeOperand(period=20), "gt", _number(1.5))),
    Narrowing("with the stochastic low", _compare(StochasticOperand(), "lt", _number(30))),
    Narrowing("with the stochastic high", _compare(StochasticOperand(), "gt", _number(70))),
)


@dataclass(frozen=True)
class Match:
    candidate: Candidate
    hits: int
    extras: int
    signals: np.ndarray

    @property
    def score(self) -> float:
        return self.hits - EXTRA_SIGNAL_PENALTY * self.extras


def _turns_true(series: np.ndarray) -> np.ndarray:
    """The bars on which a condition turns true: "RSI below 30" is one signal, not one per candle it lasts."""
    return np.flatnonzero(series & ~np.concatenate(([False], series[:-1])))


def _fit(candidate: Candidate, series: np.ndarray, marks: np.ndarray, span: tuple[int, int]) -> Match:
    signals = _turns_true(series)
    in_span = signals[(signals >= span[0]) & (signals <= span[1])]
    if not len(marks) or not len(in_span):
        return Match(candidate, 0, len(in_span), signals)
    distances = np.abs(in_span[:, None] - marks[None, :])
    hits = int((distances.min(axis=0) <= TOLERANCE_BARS).sum())
    extras = int((distances.min(axis=1) > TOLERANCE_BARS).sum())
    return Match(candidate, hits, extras, signals)


def _match(candidate: Candidate, bars: pd.DataFrame, marks: np.ndarray, span: tuple[int, int]) -> Match:
    return _fit(candidate, condition_series(bars, candidate.condition).to_numpy(), marks, span)


def _matches_by_family(candidates: list[Candidate], bars: pd.DataFrame, marks: np.ndarray, span: tuple[int, int]) -> list[list[Match]]:
    """Every idea's rules, best fitting first, and the ideas in the order of their best rule."""
    by_family: dict[str, list[Match]] = {}
    for candidate in candidates:
        by_family.setdefault(candidate.family, []).append(_match(candidate, bars, marks, span))
    ranked = [sorted(matches, key=lambda match: match.score, reverse=True) for matches in by_family.values()]
    return sorted(ranked, key=lambda matches: matches[0].score, reverse=True)


def _strategy(request: SuggestRequest, entry: Condition, exit_rule: Exit) -> Strategy:
    return Strategy(
        instrument=request.instrument,
        timeframe=request.timeframe,
        sides=(Side(direction=request.direction, entry=entry, exit=exit_rule),),
    )


@dataclass(frozen=True)
class ExitOption:
    exit: Exit
    note: str


def _exit_options(request: SuggestRequest, rules: list[Condition]) -> list[ExitOption]:
    """The ways out worth trying: as drawn, a trailing stop in place of the fixed take-profit, the best sell rule
    alone, or either of the two best sell rules behind a trailing stop."""
    rule = rules[0]
    stop = request.stop_loss_pct
    target = request.take_profit_pct
    closing = "sell" if request.direction == "long" else "buy-back"
    trailing = 2 * stop if stop else DEFAULT_TRAILING_STOP_PCT
    with_stop = f", with your {stop:g}% stop-loss" if stop else ""
    options = [
        ExitOption(
            Exit(rule=rule, stop_loss_pct=stop, take_profit_pct=target),
            f"Gets out on its {closing} rule or your {stop:g}% stop-loss and {target:g}% take-profit" if stop and target else f"Gets out on its {closing} rule",
        ),
        ExitOption(
            Exit(stop_loss_pct=stop, trailing_stop_pct=trailing),
            f"Lets winners run with a {trailing:g}% trailing stop instead of a fixed take-profit{with_stop}: it did better over the history",
        ),
    ]
    if target:
        options.append(ExitOption(Exit(rule=rule, stop_loss_pct=stop), f"Gets out on its {closing} rule{with_stop}, with no fixed take-profit: it did better over the history"))
    if len(rules) > 1:
        options.append(ExitOption(
            Exit(rule=AnyOf(conditions=tuple(rules)), stop_loss_pct=stop, trailing_stop_pct=trailing),
            f"Gets out on either of its {closing} rules or a {trailing:g}% trailing stop{with_stop}: it did better over the history",
        ))
    return options


@dataclass(frozen=True)
class Choice:
    match: Match
    exit: ExitOption
    return_pct: float


def _choose(match: Match, request: SuggestRequest, exits: list[ExitOption], bars: pd.DataFrame) -> Choice:
    """The rule with the way out that did best on the recent history."""
    tried = [
        Choice(match, option, run_backtest(_strategy(request, match.candidate.condition, option.exit), bars, "preview").metrics.total_return_pct)
        for option in exits
    ]
    return max(tried, key=lambda choice: choice.return_pct)


def _parts(condition: Condition) -> tuple[Condition, ...]:
    return condition.conditions if isinstance(condition, AllOf) else (condition,)


@dataclass(frozen=True)
class Narrowed:
    match: Match
    series: np.ndarray


def _narrow(start: Narrowed, narrowings: list[tuple[Narrowing, np.ndarray]], marks: np.ndarray, span: tuple[int, int]) -> Narrowed:
    """Adds, one at a time, the condition that raises the fit most: it drops signals far from the marks and
    keeps those on them. Stops when no condition helps."""
    current = start
    phrases: list[str] = []
    for _ in range(NARROWING_STEPS):
        best: Narrowed | None = None
        best_phrase = ""
        for narrowing, narrowing_series in narrowings:
            if narrowing.phrase in phrases:
                continue
            series = current.series & narrowing_series
            candidate = Candidate(
                ", ".join((start.match.candidate.family, *phrases, narrowing.phrase)),
                AllOf(conditions=(*_parts(current.match.candidate.condition), narrowing.condition)),
            )
            match = _fit(candidate, series, marks, span)
            if match.hits and match.score > (best or current).match.score:
                best, best_phrase = Narrowed(match, series), narrowing.phrase
        if best is None:
            break
        phrases.append(best_phrase)
        current = best
    return current


def _trade_bars(bars: pd.DataFrame, times: list[int]) -> np.ndarray:
    positions = bars.index.get_indexer(pd.to_datetime(times, unit="s", utc=True))
    return positions[positions >= 0]


def _hits_and_extras(fills: np.ndarray, marks: np.ndarray, span: tuple[int, int]) -> tuple[int, int]:
    """Marks a trade filled near, and trades in the marked stretch with no mark near. A fill comes one candle
    after its signal, so it may sit one candle further from the mark than the signal does."""
    in_span = fills[(fills >= span[0]) & (fills <= span[1] + 1)]
    if not len(marks) or not len(in_span):
        return 0, len(in_span)
    distances = np.abs(in_span[:, None] - marks[None, :])
    reach = TOLERANCE_BARS + 1
    return int((distances.min(axis=0) <= reach).sum()), int((distances.min(axis=1) > reach).sum())


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


@dataclass(frozen=True)
class Marked:
    """The marked candles a search fits: where the trades got in, where they got out, and the stretch they span."""

    entries: np.ndarray
    exits: np.ndarray
    span: tuple[int, int]


def _marked(request: SuggestRequest, bars: pd.DataFrame) -> Marked:
    opening_side, closing_side = ("buy", "sell") if request.direction == "long" else ("sell", "buy")
    entries = _mark_bars(bars, request.marks, opening_side)
    exits = _mark_bars(bars, request.marks, closing_side)
    if len(entries) < MINIMUM_MARKS_PER_KIND or len(exits) < MINIMUM_MARKS_PER_KIND:
        raise TooFewMarksError(f"Mark at least {MINIMUM_MARKS_PER_KIND} trades")
    every_mark = np.concatenate((entries, exits))
    return Marked(entries, exits, (int(every_mark.min()) - TOLERANCE_BARS, int(every_mark.max()) + TOLERANCE_BARS))


def _fits_well(hits: int, top_hits: int) -> bool:
    return hits >= max(1, math.ceil(top_hits / 2))


def suggest_choices(request: SuggestRequest, bars: pd.DataFrame) -> list[Choice]:
    """Every idea tried, alone, in pairs and narrowed down, each with its best way out; best first."""
    marked = _marked(request, bars)
    # A short opens on the signals a long closes on, and the other way round.
    entry_pool, exit_pool = (ENTRY_CANDIDATES, EXIT_CANDIDATES) if request.direction == "long" else (EXIT_CANDIDATES, ENTRY_CANDIDATES)
    exit_families = _matches_by_family(exit_pool, bars, marked.exits, marked.span)
    exits = _exit_options(request, [matches[0].candidate.condition for matches in exit_families[:2]])

    narrowings = [(narrowing, condition_series(bars, narrowing.condition).to_numpy()) for narrowing in NARROWINGS]

    def narrowed(match: Match) -> Match:
        series = condition_series(bars, match.candidate.condition).to_numpy()
        return _narrow(Narrowed(match, series), narrowings, marked.entries, marked.span).match

    families = _matches_by_family(entry_pool, bars, marked.entries, marked.span)
    entries: list[Match] = []
    for matches in families[:IDEAS_TRIED]:
        entries.append(matches[0])
        best_narrowed = max((narrowed(match) for match in matches[:RULES_TRIED_PER_IDEA]), key=lambda match: match.score)
        if best_narrowed.candidate != matches[0].candidate:
            entries.append(best_narrowed)
    for first, second in combinations([matches[0].candidate for matches in families[:IDEAS_COMBINED]], 2):
        pair = Candidate(f"{first.family} + {second.family}", AllOf(conditions=(*_parts(first.condition), *_parts(second.condition))))
        pair_match = _match(pair, bars, marked.entries, marked.span)
        if pair_match.hits:
            entries.append(narrowed(pair_match))

    choices = [_choose(match, request, exits, bars) for match in entries]
    # Of the rules that fit the marks at least half as well as the best, those that made most lead; the rest follow,
    # best fitting first: a proposal that lands on no mark helps nobody, however much it made.
    top_hits = max(choice.match.hits for choice in choices)

    def rank(choice: Choice) -> tuple[bool, float]:
        fits = _fits_well(choice.match.hits, top_hits)
        return fits, choice.return_pct if fits else choice.match.hits

    choices.sort(key=rank, reverse=True)
    return choices


def suggest_strategies(request: SuggestRequest, bars: pd.DataFrame) -> list[Proposal]:
    marked = _marked(request, bars)
    entries_marked, exits_marked, span = marked.entries, marked.exits, marked.span
    choices = suggest_choices(request, bars)
    top_hits = max(choice.match.hits for choice in choices)

    proposals = []
    for choice in [choice for choice in choices if _fits_well(choice.match.hits, top_hits)][:PROPOSAL_COUNT]:
        entry = choice.match
        result = run_backtest(_strategy(request, entry.candidate.condition, choice.exit.exit), bars, "full")
        entry_fills = _trade_bars(bars, [trade.entry_time for trade in result.trades])
        exit_fills = _trade_bars(bars, [trade.exit_time for trade in result.trades])
        exits_hit, extra_exits = _hits_and_extras(exit_fills, exits_marked, span)
        proposals.append(Proposal(
            name=entry.candidate.family,
            strategy=StrategyDraft(
                instrument=request.instrument,
                timeframe=request.timeframe,
                sides=(SideDraft(direction=request.direction, entry=entry.candidate.condition, exit=choice.exit.exit),),
            ),
            exit_note=choice.exit.note,
            entries_hit=entry.hits,
            entries_marked=len(entries_marked),
            extra_entries=entry.extras,
            exits_hit=exits_hit,
            exits_marked=len(exits_marked),
            extra_exits=extra_exits,
            entry_times=_times(bars, entry_fills),
            exit_times=_times(bars, exit_fills),
            total_return_pct=result.metrics.total_return_pct,
            max_drawdown_pct=result.metrics.max_drawdown_pct,
            trade_count=result.metrics.trade_count,
        ))
    # Ordered by the whole history now, so the list reads best first.
    proposals.sort(key=lambda proposal: proposal.total_return_pct, reverse=True)
    return proposals
