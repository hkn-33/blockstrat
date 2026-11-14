"""Strategies with a long side, a short side or both (schema version 2), and version 1 strategies upgraded."""

from datetime import datetime, timezone
from typing import Any

import pytest
from fastapi.testclient import TestClient

from conftest import FIXTURE_SYMBOL, NO_COSTS, FakeMarketData, close_crosses, make_bars, strategy

# Up through 100 at bar 2, back down through it at bar 4, down through 93 at bar 5, back up through 91 at bar 6.
TWO_WAY_CLOSES = [90.0, 95, 105, 110, 95, 90, 92, 85]


def day(bar: int) -> int:
    return int(datetime(2020, 1, 1 + bar, tzinfo=timezone.utc).timestamp())


def side(direction: str, entry: dict[str, Any], **exit_rule: Any) -> dict[str, Any]:
    return {"direction": direction, "entry": entry, "exit": exit_rule}


def two_sided(*sides: dict[str, Any], **overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "schema_version": 2,
        "instrument": FIXTURE_SYMBOL,
        "timeframe": "1d",
        "sides": list(sides),
        "execution": NO_COSTS,
    }
    body.update(overrides)
    return body


LONG = side("long", close_crosses("crosses_above", 100), rule=close_crosses("crosses_below", 100))
SHORT = side("short", close_crosses("crosses_below", 93), rule=close_crosses("crosses_above", 91))


def run(client: TestClient, body: dict[str, Any]) -> dict[str, Any]:
    response = client.post("/api/backtest", json={"strategy": body, "mode": "full"})
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture(autouse=True)
def two_way_market(market_data: FakeMarketData) -> None:
    market_data.frames[FIXTURE_SYMBOL] = make_bars(TWO_WAY_CLOSES)


def test_short_only_strategy_trades_short(client: TestClient) -> None:
    result = run(client, two_sided(SHORT))["result"]

    [trade] = result["trades"]
    assert trade["direction"] == "short"
    assert trade["entry_time"] == day(6)


def test_both_sides_trade_one_position_at_a_time(client: TestClient) -> None:
    result = run(client, two_sided(LONG, SHORT))["result"]

    long_trade, short_trade = result["trades"]
    assert (long_trade["direction"], short_trade["direction"]) == ("long", "short")
    assert long_trade["exit_time"] == day(5)
    assert short_trade["entry_time"] >= long_trade["exit_time"]
    assert short_trade["exit_time"] == day(7)


def test_both_sides_signalling_together_opens_nothing_and_is_counted(client: TestClient) -> None:
    above_100 = close_crosses("gt", 100)
    body = two_sided(side("long", above_100, stop_loss_pct=50), side("short", above_100, stop_loss_pct=50))

    result = run(client, body)["result"]

    assert result["trades"] == []
    assert result["both_signalled"] == 2


def test_each_side_uses_its_own_stop_loss(market_data: FakeMarketData, client: TestClient) -> None:
    # Short from bar 5's open (89) with a 5% stop at 93.45; bar 6 reaches 100. The long side's wide stop must not apply.
    market_data.frames[FIXTURE_SYMBOL] = make_bars([90, 95, 105, 110, 95, 90, 92, 85], highs={6: 100})
    body = two_sided(
        side("long", close_crosses("crosses_above", 200), stop_loss_pct=50),
        side("short", close_crosses("crosses_below", 100), stop_loss_pct=5),
    )

    [trade] = run(client, body)["result"]["trades"]

    assert trade["direction"] == "short"
    assert trade["exit_time"] == day(6)
    assert trade["exit_price"] == pytest.approx(89 * 1.05)


def test_result_reports_each_side(client: TestClient) -> None:
    result = run(client, two_sided(LONG, SHORT))["result"]

    by_direction = {summary["direction"]: summary for summary in result["sides"]}
    assert by_direction["long"]["trade_count"] == 1
    assert by_direction["short"]["trade_count"] == 1
    long_profit = result["trades"][0]["profit"]
    assert by_direction["long"]["return_pct"] == pytest.approx(long_profit / 10_000 * 100)


def test_an_incomplete_second_side_is_left_out(client: TestClient) -> None:
    unfinished = {"direction": "short", "entry": close_crosses("crosses_below", 93)}

    result = run(client, two_sided(LONG, unfinished))

    assert result["status"] == "ok"
    assert [trade["direction"] for trade in result["result"]["trades"]] == ["long"]


def test_no_complete_side_reports_what_is_missing(client: TestClient) -> None:
    response = run(client, two_sided({"direction": "long", "entry": close_crosses("crosses_above", 100)}))

    assert response == {"status": "missing", "missing": ["exit"]}


def test_two_sides_must_face_different_ways(client: TestClient) -> None:
    response = client.post("/api/backtest", json={"strategy": two_sided(LONG, LONG)})

    assert response.status_code == 422


def test_version_1_strategy_gives_the_same_result_as_one_side(client: TestClient) -> None:
    old = run(client, strategy())["result"]
    new = run(client, two_sided(LONG))["result"]

    assert old["trades"] == new["trades"]
    assert old["metrics"] == new["metrics"]
