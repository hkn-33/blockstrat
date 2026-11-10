import json
from typing import Any

from fastapi.testclient import TestClient

from conftest import FIXTURE_SYMBOL, FakeMarketData, make_bars, strategy
from strategy_lab.ai import AiMessage, RateLimiter
from strategy_lab.api import create_app


class FakeBuilder:
    def __init__(self, raw_reply: str) -> None:
        self.raw_reply = raw_reply
        self.received: list[AiMessage] = []

    def reply(self, system_prompt: str, messages: list[AiMessage], response_schema: dict[str, object]) -> str:
        self.received = messages
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

    response = client.post("/api/ai/build-strategy", json={"messages": [{"role": "user", "text": "x" * 5000}]})

    assert response.status_code == 422
