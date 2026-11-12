import math
from typing import Any

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from conftest import FIXTURE_SYMBOL, FakeMarketData, close_crosses, make_bars, strategy

# A slow wave with a gentle uptrend: every indicator crosses its levels several times.
WAVE_CLOSES = [100 + 20 * math.sin(bar / 8) + bar * 0.05 for bar in range(400)]


@pytest.fixture(autouse=True)
def wave_market(market_data: FakeMarketData) -> None:
    market_data.frames[FIXTURE_SYMBOL] = make_bars(WAVE_CLOSES)


def run(client: TestClient, body: dict[str, Any]) -> dict[str, Any]:
    response = client.post("/api/backtest", json={"strategy": body, "mode": "full"})
    assert response.status_code == 200, response.text
    return response.json()["result"]


def compare(operator: str, left: dict[str, Any], right: dict[str, Any]) -> dict[str, Any]:
    return {"kind": "compare", "operator": operator, "left": left, "right": right}


CLOSE = {"kind": "price", "field": "close"}


def crossing_strategy(indicator: dict[str, Any], against: dict[str, Any] = CLOSE) -> dict[str, Any]:
    return strategy(
        entry={"direction": "long", "condition": compare("crosses_above", against, indicator)},
        exit={"rule": compare("crosses_below", against, indicator)},
    )


def test_sma_crossover_enters_the_bar_after_close_crosses_the_average(client: TestClient) -> None:
    closes = pd.Series(WAVE_CLOSES)
    sma = closes.rolling(20).mean()
    crossed_above = (closes > sma) & (closes.shift(1) <= sma.shift(1))
    expected_entry_bars = [bar + 1 for bar in crossed_above[crossed_above].index if bar + 1 < len(closes)]

    result = run(client, crossing_strategy({"kind": "sma", "period": 20}))

    first_time = result["bars"][0]["time"]
    entry_bars = [(trade["entry_time"] - first_time) // 86_400 for trade in result["trades"]]
    assert entry_bars == expected_entry_bars[: len(entry_bars)]
    assert len(entry_bars) >= 3


@pytest.mark.parametrize(
    "indicator, against, warm_up",
    [
        ({"kind": "ema", "period": 20}, CLOSE, 20),
        ({"kind": "bollinger", "period": 20, "std_dev": 2, "band": "middle"}, CLOSE, 20),
        ({"kind": "constant", "value": 50}, {"kind": "rsi", "period": 14}, 14),
        ({"kind": "constant", "value": 0}, {"kind": "macd", "fast": 12, "slow": 26, "signal": 9, "line": "histogram"}, 26),
        ({"kind": "macd", "line": "signal"}, {"kind": "macd", "line": "macd"}, 26),
        ({"kind": "sma", "period": 5}, {"kind": "price", "field": "high"}, 5),
        ({"kind": "constant", "value": 0}, {"kind": "change", "period": 7}, 7),
        ({"kind": "constant", "value": 50}, {"kind": "stochastic", "period": 14, "smooth": 3, "line": "d"}, 16),
        ({"kind": "highest", "period": 30}, CLOSE, 30),
        ({"kind": "lowest", "period": 30}, CLOSE, 30),
    ],
)
def test_indicator_strategies_trade_only_after_warm_up(
    client: TestClient, indicator: dict[str, Any], against: dict[str, Any], warm_up: int
) -> None:
    result = run(client, crossing_strategy(indicator, against))

    first_time = result["bars"][0]["time"]
    assert len(result["trades"]) >= 2
    assert all((trade["entry_time"] - first_time) // 86_400 > warm_up for trade in result["trades"])


def test_bollinger_lower_band_touch(client: TestClient) -> None:
    lower = {"kind": "bollinger", "period": 20, "std_dev": 1, "band": "lower"}
    body = strategy(
        entry={"direction": "long", "condition": compare("lt", CLOSE, lower)},
        exit={"take_profit_pct": 5},
    )

    assert len(run(client, body)["trades"]) >= 1


def test_and_requires_both_conditions(client: TestClient) -> None:
    either_alone = run(client, strategy(entry={"condition": close_crosses("gt", 110)}, exit={"rule": close_crosses("lt", 110)}))
    impossible = run(
        client,
        strategy(
            entry={"condition": {"kind": "and", "conditions": [close_crosses("gt", 110), close_crosses("lt", 90)]}},
            exit={"rule": close_crosses("lt", 110)},
        ),
    )

    assert len(either_alone["trades"]) >= 1
    assert impossible["trades"] == []


def test_or_accepts_either_condition(client: TestClient) -> None:
    result = run(
        client,
        strategy(
            entry={"condition": {"kind": "or", "conditions": [close_crosses("gt", 1000), close_crosses("gt", 110)]}},
            exit={"rule": close_crosses("lt", 110)},
        ),
    )

    assert len(result["trades"]) >= 1


def test_not_inverts_a_condition(client: TestClient) -> None:
    above = run(client, strategy(entry={"condition": close_crosses("gt", 110)}, exit={"rule": close_crosses("lt", 110)}))
    not_below = run(
        client,
        strategy(
            entry={"condition": {"kind": "not", "condition": close_crosses("lt", 110)}},
            exit={"rule": close_crosses("lt", 110)},
        ),
    )

    assert [trade["entry_time"] for trade in not_below["trades"]][:3] == [trade["entry_time"] for trade in above["trades"]][:3]


@pytest.mark.parametrize(
    "operand",
    [
        {"kind": "sma", "period": 0},
        {"kind": "rsi", "period": 1},
        {"kind": "macd", "fast": 30, "slow": 26},
        {"kind": "bollinger", "std_dev": 0},
        {"kind": "highest", "period": 0},
        {"kind": "lowest", "period": 1001},
        {"kind": "change", "period": 0},
        {"kind": "relative_volume", "period": 1},
        {"kind": "stochastic", "period": 1},
        {"kind": "stochastic", "smooth": 0},
        {"kind": "stochastic", "line": "j"},
        {"kind": "unknown"},
    ],
)
def test_rejects_invalid_indicator_parameters(client: TestClient, operand: dict[str, Any]) -> None:
    body = strategy(entry={"condition": compare("gt", CLOSE, operand)})

    response = client.post("/api/backtest", json={"strategy": body})

    assert response.status_code == 422


def test_logic_needs_at_least_two_conditions(client: TestClient) -> None:
    body = strategy(entry={"condition": {"kind": "and", "conditions": [close_crosses("gt", 1)]}})

    response = client.post("/api/backtest", json={"strategy": body})

    assert response.status_code == 422


# ---------- Breakout, momentum and volume operands ----------

WAVE = pd.Series(WAVE_CLOSES)
# make_bars puts each High 1 above the close and each Low 2 below it.
WAVE_HIGHS = WAVE + 1
WAVE_LOWS = WAVE - 2


def first_entry_bar(result: dict[str, Any]) -> int:
    first_time = result["bars"][0]["time"]
    return (result["trades"][0]["entry_time"] - first_time) // 86_400


def first_signal_bar(signal: pd.Series) -> int:
    return int(signal[signal.fillna(False)].index[0])


def stochastic_k(period: int) -> pd.Series:
    lowest_low = WAVE_LOWS.rolling(period).min()
    highest_high = WAVE_HIGHS.rolling(period).max()
    return 100 * (WAVE - lowest_low) / (highest_high - lowest_low)


@pytest.mark.parametrize(
    "operator, left, right, expected_signal",
    [
        ("gt", CLOSE, {"kind": "highest", "period": 20}, WAVE > WAVE_HIGHS.shift(1).rolling(20).max()),
        ("lt", CLOSE, {"kind": "lowest", "period": 20}, WAVE < WAVE_LOWS.shift(1).rolling(20).min()),
        ("gt", {"kind": "change", "period": 7}, {"kind": "constant", "value": 5}, (WAVE / WAVE.shift(7) - 1) * 100 > 5),
        ("lt", {"kind": "stochastic"}, {"kind": "constant", "value": 20}, stochastic_k(14) < 20),
        (
            "gt",
            {"kind": "stochastic", "period": 10, "smooth": 5, "line": "d"},
            {"kind": "constant", "value": 80},
            stochastic_k(10).rolling(5).mean() > 80,
        ),
    ],
)
def test_new_operands_signal_on_the_hand_computed_bar(
    client: TestClient, operator: str, left: dict[str, Any], right: dict[str, Any], expected_signal: pd.Series
) -> None:
    body = strategy(entry={"direction": "long", "condition": compare(operator, left, right)}, exit={"stop_loss_pct": 50})

    result = run(client, body)

    assert first_entry_bar(result) == first_signal_bar(expected_signal) + 1


def test_close_can_break_out_above_the_highest_high(client: TestClient) -> None:
    body = crossing_strategy({"kind": "highest", "period": 20})

    assert len(run(client, body)["trades"]) >= 2


def test_relative_volume_compares_volume_with_its_average(market_data: FakeMarketData, client: TestClient) -> None:
    bars = make_bars(WAVE_CLOSES)
    volume = pd.Series([1000 + 600 * math.sin(bar / 5) for bar in range(len(WAVE_CLOSES))])
    bars["Volume"] = volume.to_numpy()
    market_data.frames[FIXTURE_SYMBOL] = bars
    relative_volume = {"kind": "relative_volume", "period": 20}
    body = strategy(
        entry={"direction": "long", "condition": compare("gt", relative_volume, {"kind": "constant", "value": 1.5})},
        exit={"stop_loss_pct": 50},
    )

    result = run(client, body)

    assert first_entry_bar(result) == first_signal_bar(volume / volume.rolling(20).mean() > 1.5) + 1


# ---------- Score ----------


def score(threshold: float, *parts: tuple[float, dict[str, Any]]) -> dict[str, Any]:
    return {
        "kind": "score",
        "threshold": threshold,
        "parts": [{"weight": weight, "condition": condition} for weight, condition in parts],
    }


def entry_times(result: dict[str, Any]) -> list[int]:
    return [trade["entry_time"] for trade in result["trades"]]


def test_score_is_true_when_enough_parts_are_true(client: TestClient) -> None:
    above_110 = run(client, strategy(entry={"condition": close_crosses("gt", 110)}, exit={"rule": close_crosses("lt", 110)}))
    two_of_three = run(
        client,
        strategy(
            entry={"condition": score(2, (1, close_crosses("gt", 1000)), (1, close_crosses("gt", 110)), (1, close_crosses("lt", 1000)))},
            exit={"rule": close_crosses("lt", 110)},
        ),
    )

    assert len(above_110["trades"]) >= 1
    assert entry_times(two_of_three) == entry_times(above_110)


def test_score_weights_count_a_part_more_than_once(client: TestClient) -> None:
    above_110 = run(client, strategy(entry={"condition": close_crosses("gt", 110)}, exit={"rule": close_crosses("lt", 110)}))
    double_weight = run(
        client,
        strategy(
            entry={"condition": score(2, (2, close_crosses("gt", 110)), (1, close_crosses("gt", 1000)))},
            exit={"rule": close_crosses("lt", 110)},
        ),
    )
    needs_both = run(
        client,
        strategy(
            entry={"condition": score(3, (2, close_crosses("gt", 110)), (1, close_crosses("gt", 1000)))},
            exit={"rule": close_crosses("lt", 110)},
        ),
    )

    assert entry_times(double_weight) == entry_times(above_110)
    assert needs_both["trades"] == []


def test_score_parts_wait_for_their_indicators_to_warm_up(client: TestClient) -> None:
    not_below_sma = {"kind": "not", "condition": compare("lt", CLOSE, {"kind": "sma", "period": 50})}
    body = strategy(
        entry={"condition": score(1, (1, not_below_sma), (1, close_crosses("gt", 1000)))},
        exit={"take_profit_pct": 5},
    )

    result = run(client, body)

    assert len(result["trades"]) >= 1
    assert first_entry_bar(result) > 49


def test_score_nests_inside_and_and_holds_and(client: TestClient) -> None:
    inner_and = {"kind": "and", "conditions": [close_crosses("gt", 110), close_crosses("lt", 1000)]}
    body = strategy(
        entry={"condition": {"kind": "and", "conditions": [score(1, (1, inner_and), (1, close_crosses("gt", 1000))), close_crosses("gt", 0)]}},
        exit={"rule": close_crosses("lt", 110)},
    )

    assert len(run(client, body)["trades"]) >= 1


@pytest.mark.parametrize(
    "malformed_score",
    [
        score(3, (1, close_crosses("gt", 1)), (1, close_crosses("lt", 1))),
        score(1, (1, close_crosses("gt", 1))),
        score(0, (1, close_crosses("gt", 1)), (1, close_crosses("lt", 1))),
        score(1, (0, close_crosses("gt", 1)), (1, close_crosses("lt", 1))),
        score(1, (101, close_crosses("gt", 1)), (1, close_crosses("lt", 1))),
        score(1, *[(1, close_crosses("gt", level)) for level in range(21)]),
    ],
)
def test_rejects_invalid_scores(client: TestClient, malformed_score: dict[str, Any]) -> None:
    response = client.post("/api/backtest", json={"strategy": strategy(entry={"condition": malformed_score})})

    assert response.status_code == 422


def test_score_part_weight_defaults_to_one(client: TestClient) -> None:
    unweighted = {"kind": "score", "threshold": 2, "parts": [{"condition": close_crosses("gt", 110)}, {"condition": close_crosses("lt", 1000)}]}

    result = run(client, strategy(entry={"condition": unweighted}, exit={"rule": close_crosses("lt", 110)}))

    assert len(result["trades"]) >= 1
