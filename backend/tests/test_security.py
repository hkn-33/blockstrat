from fastapi.testclient import TestClient

from conftest import FIXTURE_SYMBOL, FakeMarketData, make_bars, strategy
from blockstrat.ai import RateLimiter
from blockstrat.api import EndpointLimits, create_app


def limited_client(**limits: RateLimiter) -> TestClient:
    market_data = FakeMarketData()
    market_data.frames[FIXTURE_SYMBOL] = make_bars([100.0 + index for index in range(300)])
    roomy = RateLimiter(per_ip_per_hour=1000, global_per_day=1000)
    endpoint_limits = EndpointLimits(**{"backtest": roomy, "suggest": roomy, "bars": roomy, **limits})
    return TestClient(create_app(market_data, endpoint_limits=endpoint_limits))


def test_backtests_are_limited_per_address() -> None:
    client = limited_client(backtest=RateLimiter(per_ip_per_hour=2, global_per_day=100))

    statuses = [client.post("/api/backtest", json={"strategy": strategy(), "mode": "full"}).status_code for _ in range(3)]

    assert statuses == [200, 200, 429]


def test_a_limited_answer_says_when_to_come_back() -> None:
    client = limited_client(bars=RateLimiter(per_ip_per_hour=1, global_per_day=100))
    client.get("/api/bars", params={"instrument": FIXTURE_SYMBOL, "timeframe": "1d"})

    response = client.get("/api/bars", params={"instrument": FIXTURE_SYMBOL, "timeframe": "1d"})

    assert response.status_code == 429
    assert int(response.headers["retry-after"]) > 0


def test_strategy_searches_are_limited_per_address() -> None:
    client = limited_client(suggest=RateLimiter(per_ip_per_hour=1, global_per_day=100))
    request = {"instrument": FIXTURE_SYMBOL, "timeframe": "1d", "marks": [{"time": 0, "side": "buy"}]}

    client.post("/api/suggest-strategies", json=request)
    response = client.post("/api/suggest-strategies", json=request)

    assert response.status_code == 429


def test_an_oversized_request_is_refused_before_it_is_read() -> None:
    client = limited_client()

    response = client.post("/api/backtest", content=b"{" + b" " * 400_000 + b"}", headers={"Content-Type": "application/json"})

    assert response.status_code == 413


def test_the_api_documentation_is_not_public() -> None:
    client = limited_client()

    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404


def test_answers_carry_safe_headers() -> None:
    response = limited_client().get("/api/instruments")

    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert response.headers["x-frame-options"] == "DENY"
