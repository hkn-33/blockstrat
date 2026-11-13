import math

import pandas as pd
from fastapi.testclient import TestClient

from blockstrat.schema import AllOf, Comparison, PriceOperand, SmaOperand
from blockstrat.signals import condition_series
from blockstrat.suggest import ENTRY_CANDIDATES, EXIT_CANDIDATES, PROPOSAL_COUNT, SuggestRequest, suggest_choices
from conftest import FIXTURE_SYMBOL, FakeMarketData, make_bars

# A slow wave on a gentle rise: enough turns for averages to cross and momentum to swing many times.
WAVY_CLOSES = [100 + index * 0.05 + 12 * math.sin(index / 9) + 4 * math.sin(index / 2.3) for index in range(600)]


def signal_times(bars: pd.DataFrame, condition: object) -> list[int]:
    """The bars on which the condition turns true, as the API reports bar times."""
    series = condition_series(bars, condition)  # type: ignore[arg-type]
    turned_true = series & ~series.shift(1, fill_value=False)
    return [int(timestamp.timestamp()) for timestamp in bars.index[turned_true.to_numpy()]]


def _parts(condition: dict[str, object]) -> list[object]:
    return list(condition["conditions"]) if condition["kind"] == "and" else [condition]  # type: ignore[arg-type]


def marks_on(bars: pd.DataFrame, entry: object, exit_: object) -> list[dict[str, object]]:
    buys = [{"time": time, "side": "buy"} for time in signal_times(bars, entry)[2:8]]
    first, last = buys[0]["time"], buys[-1]["time"]
    sells = [{"time": time, "side": "sell"} for time in signal_times(bars, exit_) if first <= time <= last + 20 * 86_400]
    return buys + sells


def test_marks_placed_on_a_rules_signals_bring_that_rule_back_first(client: TestClient, market_data: FakeMarketData) -> None:
    bars = make_bars(WAVY_CLOSES)
    market_data.frames[FIXTURE_SYMBOL] = bars
    entry = next(candidate for candidate in ENTRY_CANDIDATES if candidate.family == "Momentum turning up")
    exit_ = next(candidate for candidate in EXIT_CANDIDATES if candidate.family == "Momentum turning down")

    response = client.post(
        "/api/suggest-strategies",
        json={"instrument": FIXTURE_SYMBOL, "timeframe": "1d", "marks": marks_on(bars, entry.condition, exit_.condition)},
    )

    assert response.status_code == 200
    proposals = response.json()["proposals"]
    best = proposals[0]
    # The rule may come back alone or with a trend filter, whichever did better on the history.
    assert entry.condition.model_dump() in _parts(best["strategy"]["sides"][0]["entry"])
    exit_part = best["strategy"]["sides"][0]["exit"]
    # It gets out on the matching rule, or by a trailing stop when that did better.
    assert exit_part["rule"] == exit_.condition.model_dump() or exit_part["trailing_stop_pct"] is not None
    assert best["entries_hit"] == best["entries_marked"] == 6
    assert best["extra_entries"] == 0


def test_proposals_differ_in_their_idea_and_carry_a_full_history_result(client: TestClient, market_data: FakeMarketData) -> None:
    bars = make_bars(WAVY_CLOSES)
    market_data.frames[FIXTURE_SYMBOL] = bars
    entry = next(candidate for candidate in ENTRY_CANDIDATES if candidate.family == "Momentum turning up")
    exit_ = next(candidate for candidate in EXIT_CANDIDATES if candidate.family == "Momentum turning down")

    proposals = client.post(
        "/api/suggest-strategies",
        json={"instrument": FIXTURE_SYMBOL, "timeframe": "1d", "marks": marks_on(bars, entry.condition, exit_.condition)},
    ).json()["proposals"]

    assert len(proposals) == PROPOSAL_COUNT
    assert len({proposal["name"] for proposal in proposals}) == PROPOSAL_COUNT
    assert all("total_return_pct" in proposal and proposal["trade_count"] >= 0 for proposal in proposals)
    # The deepest fall from a high on the way, so proposals can be compared by risk too.
    assert all(proposal["max_drawdown_pct"] <= 0 for proposal in proposals)
    assert all(proposal["strategy"]["instrument"] == FIXTURE_SYMBOL for proposal in proposals)


def test_proposals_keep_the_drawn_stop_loss_and_say_how_they_get_out(client: TestClient, market_data: FakeMarketData) -> None:
    bars = make_bars(WAVY_CLOSES)
    market_data.frames[FIXTURE_SYMBOL] = bars
    entry = next(candidate for candidate in ENTRY_CANDIDATES if candidate.family == "Momentum turning up")
    exit_ = next(candidate for candidate in EXIT_CANDIDATES if candidate.family == "Momentum turning down")

    proposals = client.post(
        "/api/suggest-strategies",
        json={
            "instrument": FIXTURE_SYMBOL,
            "timeframe": "1d",
            "marks": marks_on(bars, entry.condition, exit_.condition),
            "stop_loss_pct": 4,
            "take_profit_pct": 9,
        },
    ).json()["proposals"]

    for proposal in proposals:
        exit_part = proposal["strategy"]["sides"][0]["exit"]
        assert exit_part["stop_loss_pct"] == 4
        # The drawn take-profit, or a way out that lets a winner run past it, and the note says which.
        if exit_part["take_profit_pct"] is not None:
            assert exit_part["take_profit_pct"] == 9
            assert "9% take-profit" in proposal["exit_note"]
        elif exit_part["trailing_stop_pct"] is not None:
            assert exit_part["trailing_stop_pct"] == 8
            assert "8% trailing stop" in proposal["exit_note"]
        else:
            assert "no fixed take-profit" in proposal["exit_note"]


def test_exits_are_counted_from_the_trades_the_strategy_makes(client: TestClient, market_data: FakeMarketData) -> None:
    bars = make_bars(WAVY_CLOSES)
    market_data.frames[FIXTURE_SYMBOL] = bars
    entry = next(candidate for candidate in ENTRY_CANDIDATES if candidate.family == "Momentum turning up")
    exit_ = next(candidate for candidate in EXIT_CANDIDATES if candidate.family == "Momentum turning down")

    proposals = client.post(
        "/api/suggest-strategies",
        json={"instrument": FIXTURE_SYMBOL, "timeframe": "1d", "marks": marks_on(bars, entry.condition, exit_.condition)},
    ).json()["proposals"]

    for proposal in proposals:
        assert 0 <= proposal["exits_hit"] <= proposal["exits_marked"]
        # The dots on the chart are where the strategy actually got in and out, one pair per trade.
        assert len(proposal["entry_times"]) >= len(proposal["exit_times"]) - 1


def test_short_trades_bring_back_short_strategies(client: TestClient, market_data: FakeMarketData) -> None:
    bars = make_bars(WAVY_CLOSES)
    market_data.frames[FIXTURE_SYMBOL] = bars
    # A short opens on a sell and closes on a buy: the mirror of the long marks.
    entry = next(candidate for candidate in EXIT_CANDIDATES if candidate.family == "Momentum turning down")
    exit_ = next(candidate for candidate in ENTRY_CANDIDATES if candidate.family == "Momentum turning up")
    mirrored = [{"time": mark["time"], "side": "sell" if mark["side"] == "buy" else "buy"} for mark in marks_on(bars, entry.condition, exit_.condition)]

    proposals = client.post(
        "/api/suggest-strategies",
        json={"instrument": FIXTURE_SYMBOL, "timeframe": "1d", "direction": "short", "marks": mirrored},
    ).json()["proposals"]

    sides = [proposal["strategy"]["sides"][0] for proposal in proposals]
    assert all(side["direction"] == "short" for side in sides)
    # Among rules that fit about as well, the one that made most may lead; the marked rule is still proposed.
    assert any(entry.condition.model_dump() in _parts(side["entry"]) for side in sides)


def test_proposals_that_made_money_come_first(client: TestClient, market_data: FakeMarketData) -> None:
    bars = make_bars(WAVY_CLOSES)
    market_data.frames[FIXTURE_SYMBOL] = bars
    entry = next(candidate for candidate in ENTRY_CANDIDATES if candidate.family == "Momentum turning up")
    exit_ = next(candidate for candidate in EXIT_CANDIDATES if candidate.family == "Momentum turning down")

    proposals = client.post(
        "/api/suggest-strategies",
        json={"instrument": FIXTURE_SYMBOL, "timeframe": "1d", "marks": marks_on(bars, entry.condition, exit_.condition)},
    ).json()["proposals"]

    # Among the proposals that fit the marks well, money-making ones lead.
    best_fit = max(proposal["entries_hit"] for proposal in proposals)
    fitting = [proposal for proposal in proposals if proposal["entries_hit"] >= math.ceil(best_fit / 2)]
    profitable = [proposal["total_return_pct"] > 0 for proposal in fitting]
    assert profitable == sorted(profitable, reverse=True)


def test_no_proposal_fits_less_than_half_as_many_marks_as_the_best(client: TestClient, market_data: FakeMarketData) -> None:
    bars = make_bars(WAVY_CLOSES)
    market_data.frames[FIXTURE_SYMBOL] = bars
    entry = next(candidate for candidate in ENTRY_CANDIDATES if candidate.family == "Momentum turning up")
    exit_ = next(candidate for candidate in EXIT_CANDIDATES if candidate.family == "Momentum turning down")

    proposals = client.post(
        "/api/suggest-strategies",
        json={"instrument": FIXTURE_SYMBOL, "timeframe": "1d", "marks": marks_on(bars, entry.condition, exit_.condition)},
    ).json()["proposals"]

    # A rule that made money but lands on none of the trades drawn is not what the user asked for.
    best_fit = max(proposal["entries_hit"] for proposal in proposals)
    assert all(proposal["entries_hit"] >= math.ceil(best_fit / 2) for proposal in proposals)


def test_too_few_marks_are_refused_with_a_reason(client: TestClient, market_data: FakeMarketData) -> None:
    bars = make_bars(WAVY_CLOSES)
    market_data.frames[FIXTURE_SYMBOL] = bars
    one_buy = [{"time": int(bars.index[100].timestamp()), "side": "buy"}]

    response = client.post("/api/suggest-strategies", json={"instrument": FIXTURE_SYMBOL, "timeframe": "1d", "marks": one_buy})

    assert response.status_code == 422
    assert "at least" in response.json()["detail"]


def test_bars_are_the_latest_candles_for_marking(client: TestClient, market_data: FakeMarketData) -> None:
    bars = make_bars([100.0 + index for index in range(21000)])
    market_data.frames[FIXTURE_SYMBOL] = bars

    response = client.get("/api/bars", params={"instrument": FIXTURE_SYMBOL, "timeframe": "1d"})

    assert response.status_code == 200
    returned = response.json()["bars"]
    assert len(returned) == 20_000
    assert returned[-1]["time"] == int(bars.index[-1].timestamp())
    assert returned[-1]["close"] == 21099.0


def test_rules_that_combine_two_ideas_are_tried_too(market_data: FakeMarketData) -> None:
    bars = make_bars(WAVY_CLOSES)
    entry = next(candidate for candidate in ENTRY_CANDIDATES if candidate.family == "Momentum turning up")
    exit_ = next(candidate for candidate in EXIT_CANDIDATES if candidate.family == "Momentum turning down")
    request = SuggestRequest(instrument=FIXTURE_SYMBOL, timeframe="1d", marks=marks_on(bars, entry.condition, exit_.condition))

    tried = suggest_choices(request, bars)

    combined = [choice for choice in tried if " + " in choice.match.candidate.family]
    assert combined
    assert all(choice.match.candidate.condition.kind == "and" for choice in combined)


def test_rules_are_narrowed_by_conditions_that_drop_signals_away_from_the_marks(market_data: FakeMarketData) -> None:
    bars = make_bars(WAVY_CLOSES)
    entry = next(candidate for candidate in ENTRY_CANDIDATES if candidate.family == "Momentum turning up")
    exit_ = next(candidate for candidate in EXIT_CANDIDATES if candidate.family == "Momentum turning down")
    below_average = Comparison(operator="lt", left=PriceOperand(field="close"), right=SmaOperand(period=50))
    # The user only took the momentum turns that came while the price was below its 50-candle average.
    buys = signal_times(bars, AllOf(conditions=(entry.condition, below_average)))
    sells = [time for time in signal_times(bars, exit_.condition) if buys[0] <= time <= buys[-1] + 20 * 86_400]
    marks = [{"time": time, "side": "buy"} for time in buys] + [{"time": time, "side": "sell"} for time in sells]
    request = SuggestRequest(instrument=FIXTURE_SYMBOL, timeframe="1d", marks=marks)

    tried = suggest_choices(request, bars)

    plain = next(choice for choice in tried if choice.match.candidate.condition == entry.condition)
    narrowed = [
        choice for choice in tried
        if choice.match.candidate.condition.kind == "and" and entry.condition in choice.match.candidate.condition.conditions
    ]
    assert narrowed
    best = max(narrowed, key=lambda choice: choice.match.score)
    assert best.match.hits == plain.match.hits
    assert best.match.extras < plain.match.extras
    assert "," in best.match.candidate.family
