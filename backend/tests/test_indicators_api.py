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
