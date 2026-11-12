import math

import pandas as pd
from fastapi.testclient import TestClient

from blockstrat.signals import condition_series
from blockstrat.suggest import ENTRY_CANDIDATES, EXIT_CANDIDATES
from conftest import FIXTURE_SYMBOL, FakeMarketData, make_bars

# A slow wave on a gentle rise: enough turns for averages to cross and momentum to swing many times.
WAVY_CLOSES = [100 + index * 0.05 + 12 * math.sin(index / 9) + 4 * math.sin(index / 2.3) for index in range(600)]


def signal_times(bars: pd.DataFrame, condition: object) -> list[int]:
    """The bars on which the condition turns true, as the API reports bar times."""
    series = condition_series(bars, condition)  # type: ignore[arg-type]
    turned_true = series & ~series.shift(1, fill_value=False)
    return [int(timestamp.timestamp()) for timestamp in bars.index[turned_true.to_numpy()]]


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
    assert best["strategy"]["sides"][0]["entry"] == entry.condition.model_dump()
    assert best["strategy"]["sides"][0]["exit"]["rule"] == exit_.condition.model_dump()
    assert best["buys_hit"] == best["buys_marked"] == 6
    assert best["extra_buys"] == 0


def test_proposals_differ_in_their_idea_and_carry_a_full_history_result(client: TestClient, market_data: FakeMarketData) -> None:
    bars = make_bars(WAVY_CLOSES)
    market_data.frames[FIXTURE_SYMBOL] = bars
    entry = next(candidate for candidate in ENTRY_CANDIDATES if candidate.family == "Momentum turning up")
    exit_ = next(candidate for candidate in EXIT_CANDIDATES if candidate.family == "Momentum turning down")

    proposals = client.post(
        "/api/suggest-strategies",
        json={"instrument": FIXTURE_SYMBOL, "timeframe": "1d", "marks": marks_on(bars, entry.condition, exit_.condition)},
    ).json()["proposals"]

    assert len(proposals) == 3
    assert len({proposal["name"] for proposal in proposals}) == 3
    assert all("total_return_pct" in proposal and proposal["trade_count"] >= 0 for proposal in proposals)
    assert all(proposal["strategy"]["instrument"] == FIXTURE_SYMBOL for proposal in proposals)


def test_too_few_marks_are_refused_with_a_reason(client: TestClient, market_data: FakeMarketData) -> None:
    bars = make_bars(WAVY_CLOSES)
    market_data.frames[FIXTURE_SYMBOL] = bars
    one_buy = [{"time": int(bars.index[100].timestamp()), "side": "buy"}]

    response = client.post("/api/suggest-strategies", json={"instrument": FIXTURE_SYMBOL, "timeframe": "1d", "marks": one_buy})

    assert response.status_code == 422
    assert "at least" in response.json()["detail"]


def test_bars_are_the_latest_candles_for_marking(client: TestClient, market_data: FakeMarketData) -> None:
    bars = make_bars([100.0 + index for index in range(2000)])
    market_data.frames[FIXTURE_SYMBOL] = bars

    response = client.get("/api/bars", params={"instrument": FIXTURE_SYMBOL, "timeframe": "1d"})

    assert response.status_code == 200
    returned = response.json()["bars"]
    assert len(returned) == 1500
    assert returned[-1]["time"] == int(bars.index[-1].timestamp())
    assert returned[-1]["close"] == 2099.0
