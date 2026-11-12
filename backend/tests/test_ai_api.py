import json
from typing import Any

from fastapi.testclient import TestClient

from conftest import FIXTURE_SYMBOL, FakeMarketData, make_bars, strategy
from blockstrat.ai import AiMessage, RateLimiter
from blockstrat.api import create_app


class FakeBuilder:
    def __init__(self, raw_reply: str) -> None:
        self.raw_reply = raw_reply
        self.received: list[AiMessage] = []
        self.system_prompt = ""

    def reply(self, system_prompt: str, messages: list[AiMessage], response_schema: dict[str, object]) -> str:
        self.received = messages
        self.system_prompt = system_prompt
        return self.raw_reply


class FakeClock:
    def __init__(self) -> None:
        self.now = 1_000_000.0

    def __call__(self) -> float:
        return self.now


def make_client(builder: FakeBuilder | None, limiter: RateLimiter | None = None) -> TestClient:
    market_data = FakeMarketData()
    market_data.frames[FIXTURE_SYMBOL] = make_bars([100.0] * 10)
    return TestClient(create_app(market_data, builder, limiter))


def ask(client: TestClient, text: str = "Buy BTC when RSI is below 30", **extra: Any) -> dict[str, Any]:
    response = client.post("/api/ai/build-strategy", json={"messages": [{"role": "user", "text": text}], **extra})
    assert response.status_code == 200, response.text
    return response.json()


def test_valid_reply_returns_a_strategy() -> None:
    reply = {"message": "Done.", "strategy": strategy(), "unsupported": []}
    client = make_client(FakeBuilder(json.dumps(reply)))

    response = ask(client)

    assert response["status"] == "ok"
    assert response["strategy"]["instrument"] == FIXTURE_SYMBOL
    assert response["unsupported"] == []


def test_reports_what_could_not_be_expressed() -> None:
    reply = {"message": "Close enough.", "strategy": strategy(), "unsupported": ["Ichimoku cloud"]}
    client = make_client(FakeBuilder(json.dumps(reply)))

    assert ask(client)["unsupported"] == ["Ichimoku cloud"]


def test_reply_that_breaks_the_schema_is_rejected() -> None:
    broken = {"message": "Here", "strategy": strategy(timeframe="7m"), "unsupported": []}
    client = make_client(FakeBuilder(json.dumps(broken)))

    response = ask(client)

    assert response["status"] == "invalid"
    assert "strategy" not in response


def test_reply_that_is_not_json_is_rejected() -> None:
    client = make_client(FakeBuilder("import os; os.system('rm -rf /')"))

    assert ask(client)["status"] == "invalid"


def test_current_strategy_is_sent_to_the_model() -> None:
    builder = FakeBuilder(json.dumps({"message": "ok", "strategy": None, "unsupported": []}))
    client = make_client(builder)

    ask(client, "Make it short", current_strategy=strategy())

    assert FIXTURE_SYMBOL in builder.received[-1].text


def test_without_api_key_the_ai_is_unavailable() -> None:
    client = make_client(None)

    response = ask(client)

    assert response["status"] == "unavailable"
    assert response["message"] == "AI is resting, build the blocks by hand."


def test_per_ip_hourly_limit() -> None:
    clock = FakeClock()
    builder = FakeBuilder(json.dumps({"message": "ok", "strategy": None, "unsupported": []}))
    client = make_client(builder, RateLimiter(per_ip_per_hour=2, global_per_day=100, clock=clock))

    statuses = [ask(client)["status"] for _ in range(3)]
    clock.now += 3601
    after_an_hour = ask(client)["status"]

    assert statuses == ["ok", "ok", "rate_limited"]
    assert after_an_hour == "ok"


def test_global_daily_cap() -> None:
    limiter = RateLimiter(per_ip_per_hour=100, global_per_day=2, clock=FakeClock())

    assert [limiter.allow(ip) for ip in ("a", "b", "c")] == [True, True, False]


def test_rejects_too_long_messages() -> None:
    client = make_client(FakeBuilder("{}"))

    response = client.post("/api/ai/build-strategy", json={"messages": [{"role": "user", "text": "x" * 7000}]})

    assert response.status_code == 422


def test_a_two_sided_reply_comes_back_as_version_2() -> None:
    above = {"kind": "compare", "operator": "crosses_above", "left": {"kind": "price", "field": "close"}, "right": {"kind": "sma", "period": 50}}
    below = {**above, "operator": "crosses_below"}
    two_sided = {
        "schema_version": 2,
        "instrument": FIXTURE_SYMBOL,
        "timeframe": "1d",
        "sides": [
            {"direction": "long", "entry": above, "exit": {"rule": below}},
            {"direction": "short", "entry": below, "exit": {"rule": above, "stop_loss_pct": 3}},
        ],
    }
    client = make_client(FakeBuilder(json.dumps({"message": "Both ways.", "strategy": two_sided, "unsupported": []})))

    response = ask(client, "Go long above the 50 SMA and short below it")

    assert response["strategy"]["schema_version"] == 2
    assert [side["direction"] for side in response["strategy"]["sides"]] == ["long", "short"]


def test_a_version_1_reply_is_upgraded_to_one_side() -> None:
    client = make_client(FakeBuilder(json.dumps({"message": "Done.", "strategy": strategy(), "unsupported": []})))

    sides = ask(client)["strategy"]["sides"]

    assert [side["direction"] for side in sides] == ["long"]


def test_a_reply_with_breakouts_scores_trailing_stops_and_extra_markets_passes_through() -> None:
    close = {"kind": "price", "field": "close"}
    breakout = {"kind": "compare", "operator": "crosses_above", "left": close, "right": {"kind": "highest", "period": 20}}
    busy = {"kind": "compare", "operator": "gt", "left": {"kind": "relative_volume", "period": 20}, "right": {"kind": "constant", "value": 2}}
    oversold = {"kind": "compare", "operator": "lt", "left": {"kind": "stochastic", "period": 14, "smooth": 3, "line": "k"}, "right": {"kind": "constant", "value": 20}}
    rising = {"kind": "compare", "operator": "gt", "left": {"kind": "change", "period": 7}, "right": {"kind": "constant", "value": 0}}
    breakdown = {"kind": "compare", "operator": "crosses_below", "left": close, "right": {"kind": "lowest", "period": 10}}
    built = {
        "schema_version": 2,
        "instrument": FIXTURE_SYMBOL,
        "extra_instruments": ["ETHUSDT"],
        "timeframe": "1d",
        "sides": [
            {
                "direction": "long",
                "entry": {
                    "kind": "score",
                    "threshold": 2,
                    "parts": [{"weight": 1, "condition": breakout}, {"weight": 1, "condition": busy}, {"weight": 1, "condition": oversold}, {"weight": 1, "condition": rising}],
                },
                "exit": {"rule": breakdown, "trailing_stop_pct": 8},
            }
        ],
    }
    client = make_client(FakeBuilder(json.dumps({"message": "Done.", "strategy": built, "unsupported": []})))

    response = ask(client, "Buy when at least two of these fire, let profits run, test it on ETH too")

    assert response["status"] == "ok"
    returned = response["strategy"]
    assert returned["extra_instruments"] == ["ETHUSDT"]
    assert returned["sides"][0]["entry"]["kind"] == "score"
    assert returned["sides"][0]["exit"]["trailing_stop_pct"] == 8


def test_the_assistant_is_told_about_the_new_blocks() -> None:
    builder = FakeBuilder(json.dumps({"message": "ok", "strategy": None, "unsupported": []}))
    client = make_client(builder)

    ask(client)

    for term in ("highest", "lowest", "change", "relative_volume", "stochastic", "score", "trailing_stop_pct", "extra_instruments"):
        assert term in builder.system_prompt
