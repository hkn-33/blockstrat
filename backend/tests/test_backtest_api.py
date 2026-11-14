from datetime import datetime, timezone
from itertools import combinations
from typing import Any

import pytest
from fastapi.testclient import TestClient

from conftest import FIXTURE_SYMBOL, FakeMarketData, close_crosses, make_bars, strategy
from blockstrat.api import create_app

REQUIRED_PARTS = ["instrument", "timeframe", "entry", "exit"]
# Bar 2 closes above 100, bar 4 closes back below it.
CROSSING_CLOSES = [90.0, 95, 105, 110, 95, 90, 92]


def day(bar: int) -> int:
    return int(datetime(2020, 1, 1 + bar, tzinfo=timezone.utc).timestamp())


def post_backtest(client: TestClient, body: dict[str, Any], mode: str = "full") -> dict[str, Any]:
    response = client.post("/api/backtest", json={"strategy": body, "mode": mode})
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture(autouse=True)
def crossing_market(market_data: FakeMarketData) -> None:
    market_data.frames[FIXTURE_SYMBOL] = make_bars(CROSSING_CLOSES)


# ---------- Missing parts and validation ----------


@pytest.mark.parametrize(
    "missing",
    [list(combo) for size in range(1, 5) for combo in combinations(REQUIRED_PARTS, size)],
)
def test_reports_every_missing_required_part(client: TestClient, missing: list[str]) -> None:
    body = {key: value for key, value in strategy().items() if key not in missing}

    response = post_backtest(client, body)

    assert response == {"status": "missing", "missing": missing}


def test_exit_without_rule_stop_loss_or_take_profit_counts_as_missing(client: TestClient) -> None:
    response = post_backtest(client, strategy(exit={}))

    assert response == {"status": "missing", "missing": ["exit"]}


@pytest.mark.parametrize(
    "malformed",
    [
        strategy(timeframe="7m"),
        strategy(entry={"direction": "sideways", "condition": close_crosses("gt", 1)}),
        strategy(exit={"stop_loss_pct": -5}),
        strategy(entry={"condition": {"kind": "compare", "operator": "gt", "left": {"kind": "sma", "period": 0}, "right": {"kind": "constant", "value": 1}}}),
        strategy(position_size_pct=150),
    ],
)
def test_rejects_malformed_strategy(client: TestClient, malformed: dict[str, Any]) -> None:
    response = client.post("/api/backtest", json={"strategy": malformed})

    assert response.status_code == 422


def test_rejects_unknown_instrument(client: TestClient) -> None:
    response = client.post("/api/backtest", json={"strategy": strategy(instrument="NOPEUSDT")})

    assert response.status_code == 422


# ---------- Fills ----------


def test_signal_on_a_bar_fills_at_the_next_bars_open(client: TestClient) -> None:
    result = post_backtest(client, strategy())["result"]

    [trade] = result["trades"]
    assert trade["entry_time"] == day(3)
    assert trade["entry_price"] == pytest.approx(110 - 1)
    assert trade["exit_time"] == day(5)
    assert trade["exit_price"] == pytest.approx(90 - 1)


def test_an_exit_rule_already_true_at_the_entry_waits_until_it_turns_true_again(market_data: FakeMarketData, client: TestClient) -> None:
    # "Close above 103" already holds when the entry signals on bar 2; it lets go on bar 4 and holds again on bar 5.
    market_data.frames[FIXTURE_SYMBOL] = make_bars([90, 95, 105, 110, 101, 108, 109, 107])

    result = post_backtest(client, strategy(exit={"rule": close_crosses("gt", 103)}))["result"]

    [trade] = result["trades"]
    assert trade["entry_time"] == day(3)
    # Closed on the open after bar 5, not on the open after the entry bar.
    assert trade["exit_time"] == day(6)


def test_leverage_multiplies_a_trades_gain_or_loss(client: TestClient) -> None:
    plain = post_backtest(client, strategy())["result"]["metrics"]["total_return_pct"]
    doubled = post_backtest(client, strategy(execution={"commission_pct": 0, "slippage_bps": 0, "leverage": 2}))["result"]["metrics"]["total_return_pct"]

    # The one trade buys at 109 and sells at 89: about -18% on the cash, about -37% with twice the position.
    assert plain == pytest.approx((89 / 109 - 1) * 100, abs=0.1)
    assert doubled == pytest.approx(2 * plain, abs=0.5)


def test_a_loss_larger_than_the_account_wipes_it_out(client: TestClient) -> None:
    result = post_backtest(client, strategy(execution={"commission_pct": 0, "slippage_bps": 0, "leverage": 10}))["result"]

    assert result["metrics"]["total_return_pct"] == pytest.approx(-100)


@pytest.mark.parametrize("leverage", [0.5, 11])
def test_rejects_leverage_out_of_range(client: TestClient, leverage: float) -> None:
    response = client.post("/api/backtest", json={"strategy": strategy(execution={"leverage": leverage}), "mode": "full"})

    assert response.status_code == 422


def test_commission_and_slippage_lower_the_result(client: TestClient) -> None:
    free = post_backtest(client, strategy())["result"]["metrics"]["total_return_pct"]
    costly = post_backtest(
        client, strategy(execution={"commission_pct": 0.5, "slippage_bps": 50})
    )["result"]["metrics"]["total_return_pct"]

    assert costly < free


def test_slippage_worsens_the_entry_price(client: TestClient) -> None:
    result = post_backtest(client, strategy(execution={"commission_pct": 0, "slippage_bps": 100}))["result"]

    assert result["trades"][0]["entry_price"] == pytest.approx(109 * 1.01)


def test_default_execution_model_has_costs(client: TestClient) -> None:
    body = strategy()
    del body["execution"]

    default = post_backtest(client, body)["result"]["metrics"]["total_return_pct"]
    free = post_backtest(client, strategy())["result"]["metrics"]["total_return_pct"]

    assert default < free


# ---------- Exits, directions, position size ----------


def test_stop_loss_closes_the_position(market_data: FakeMarketData, client: TestClient) -> None:
    # Entry fills at bar 3's open (109); a 5% stop sits at 103.55 and bar 4 dips to 100.
    market_data.frames[FIXTURE_SYMBOL] = make_bars([90, 95, 105, 110, 108, 112, 115], lows={4: 100})

    result = post_backtest(client, strategy(exit={"stop_loss_pct": 5}))["result"]

    [trade] = result["trades"]
    assert trade["exit_time"] == day(4)
    assert trade["exit_price"] == pytest.approx(109 * 0.95)


def test_take_profit_closes_the_position(market_data: FakeMarketData, client: TestClient) -> None:
    market_data.frames[FIXTURE_SYMBOL] = make_bars([90, 95, 105, 110, 111, 112, 113], highs={5: 130})

    result = post_backtest(client, strategy(exit={"take_profit_pct": 10}))["result"]

    [trade] = result["trades"]
    assert trade["exit_time"] == day(5)
    assert trade["exit_price"] == pytest.approx(109 * 1.10)


def test_position_without_exit_hit_closes_at_the_end(market_data: FakeMarketData, client: TestClient) -> None:
    market_data.frames[FIXTURE_SYMBOL] = make_bars([90, 95, 105, 110, 111, 112, 113])

    result = post_backtest(client, strategy(exit={"stop_loss_pct": 50}))["result"]

    assert len(result["trades"]) == 1
    assert result["trades"][0]["exit_time"] == day(6)


def test_short_position_profits_from_a_fall(market_data: FakeMarketData, client: TestClient) -> None:
    # Short at bar 3's open (89), cover at bar 6's open (69) after the close crosses back above 70.
    market_data.frames[FIXTURE_SYMBOL] = make_bars([110.0, 105, 95, 90, 60, 75, 70])
    short = strategy(
        entry={"direction": "short", "condition": close_crosses("crosses_below", 100)},
        exit={"rule": close_crosses("crosses_above", 70)},
    )

    result = post_backtest(client, short)["result"]

    [trade] = result["trades"]
    assert trade["direction"] == "short"
    assert trade["entry_price"] == pytest.approx(89)
    assert trade["exit_price"] == pytest.approx(69)
    assert trade["profit"] > 0


def test_short_position_loses_on_a_rise(market_data: FakeMarketData, client: TestClient) -> None:
    market_data.frames[FIXTURE_SYMBOL] = make_bars([110.0, 105, 95, 90, 80, 105, 110])
    short = strategy(
        entry={"direction": "short", "condition": close_crosses("crosses_below", 100)},
        exit={"rule": close_crosses("crosses_above", 100)},
    )

    result = post_backtest(client, short)["result"]

    [trade] = result["trades"]
    assert trade["direction"] == "short"
    assert trade["entry_price"] == pytest.approx(89)
    assert trade["exit_price"] == pytest.approx(109)
    assert trade["profit"] < 0


def test_at_most_one_position_is_open(market_data: FakeMarketData, client: TestClient) -> None:
    # Close stays above 100 every bar: the entry condition is true all the time.
    market_data.frames[FIXTURE_SYMBOL] = make_bars([101.0, 102, 103, 104, 105, 106])
    always_in = strategy(
        entry={"direction": "long", "condition": close_crosses("gt", 100)},
        exit={"stop_loss_pct": 50},
    )

    result = post_backtest(client, always_in)["result"]

    assert len(result["trades"]) == 1


def test_position_size_scales_the_result(client: TestClient) -> None:
    full = post_backtest(client, strategy())["result"]["metrics"]["total_return_pct"]
    half = post_backtest(client, strategy(position_size_pct=50))["result"]["metrics"]["total_return_pct"]

    assert half == pytest.approx(full / 2, rel=0.05)


# ---------- Preview and full ----------


def test_preview_uses_only_the_most_recent_bars(market_data: FakeMarketData, client: TestClient) -> None:
    closes = [100.0 + (bar % 20) for bar in range(3500)]
    market_data.frames[FIXTURE_SYMBOL] = make_bars(closes)

    preview = post_backtest(client, strategy(), mode="preview")["result"]
    full = post_backtest(client, strategy(), mode="full")["result"]

    assert preview["bar_count"] == 3000
    assert preview["end_time"] == full["end_time"]
    assert full["bar_count"] == 3500


# ---------- Results ----------


def test_buy_and_hold_and_metrics_match_hand_computed_values(client: TestClient) -> None:
    result = post_backtest(client, strategy())["result"]

    # Buy and hold: 10 000 * last close / first close.
    assert result["buy_and_hold"][-1]["value"] == pytest.approx(10_000 * 92 / 90)
    metrics = result["metrics"]
    # One losing trade: in at 109, out at 89, almost the whole equity.
    assert metrics["trade_count"] == 1
    assert metrics["win_rate_pct"] == 0
    assert metrics["total_return_pct"] == pytest.approx((89 / 109 - 1) * 100, rel=0.01)
    assert len(result["equity"]) == len(CROSSING_CLOSES)
    assert len(result["bars"]) == len(CROSSING_CLOSES)


def test_reports_the_statistics_advanced_mode_shows(client: TestClient) -> None:
    metrics = post_backtest(client, strategy())["result"]["metrics"]

    # The one trade: in on day 3, out on day 5, about -18%.
    assert metrics["avg_trade_pct"] == pytest.approx((89 / 109 - 1) * 100, abs=0.1)
    assert metrics["avg_trade_hours"] == pytest.approx(48)
    assert metrics["profit_factor"] in (0, None)
    for key in ("annual_return_pct", "sortino_ratio", "calmar_ratio", "max_drawdown_days"):
        assert key in metrics


def test_strategy_without_trades_has_empty_trade_list(client: TestClient) -> None:
    result = post_backtest(client, strategy(entry={"condition": close_crosses("gt", 1000)}))["result"]

    assert result["trades"] == []
    assert result["metrics"]["trade_count"] == 0
    assert result["metrics"]["total_return_pct"] == 0


def test_lists_instruments_timeframes_and_presets(client: TestClient) -> None:
    instruments = client.get("/api/instruments").json()
    presets = client.get("/api/execution-presets").json()

    assert instruments["instruments"] == [{"symbol": FIXTURE_SYMBOL, "label": FIXTURE_SYMBOL}]
    assert instruments["timeframes"] == ["1d", "4h", "1h"]
    assert {preset["id"] for preset in presets} >= {"binance-spot", "pessimistic"}


def test_long_history_is_merged_for_charts_but_not_for_metrics(market_data: FakeMarketData, client: TestClient) -> None:
    # Triangle wave 90 -> 110 -> 90 every 40 bars: one profitable trade per wave.
    closes = [110.0 - abs((bar % 40) - 20) for bar in range(24_000)]
    market_data.frames[FIXTURE_SYMBOL] = make_bars(closes)
    wave_strategy = strategy(exit={"rule": close_crosses("crosses_below", 105)})

    result = post_backtest(client, wave_strategy, mode="full")["result"]

    assert result["bar_count"] == 24_000
    assert len(result["bars"]) <= 10_000
    assert len(result["equity"]) == len(result["bars"]) == len(result["buy_and_hold"])
    assert result["bars"][0]["time"] == result["start_time"]
    assert result["metrics"]["trade_count"] == 600


def test_buys_fractions_of_an_expensive_instrument(market_data: FakeMarketData, client: TestClient) -> None:
    # Prices far above the 10 000 starting cash.
    market_data.frames[FIXTURE_SYMBOL] = make_bars([close * 1000 for close in CROSSING_CLOSES])
    expensive = strategy(
        entry={"direction": "long", "condition": close_crosses("crosses_above", 100_000)},
        exit={"rule": close_crosses("crosses_below", 100_000)},
    )

    result = post_backtest(client, expensive)["result"]

    [trade] = result["trades"]
    assert 0 < trade["size"] < 1
    assert trade["entry_price"] == pytest.approx(110_000 - 1)


# ---------- Trailing stop ----------

# Rises to a high of 131 at bar 5, then falls back far below the 109 entry.
RISE_AND_FALL_CLOSES = [90.0, 95, 105, 110, 120, 130, 128, 125, 100, 95, 90]


def test_trailing_stop_keeps_profit_a_fixed_stop_gives_back(market_data: FakeMarketData, client: TestClient) -> None:
    # Entry fills at bar 3's open (109). The highest high is 131 (bar 5), so a 10% trailing stop sits at 117.9
    # and bar 7 dips to 110. A fixed 10% stop sits at 98.1 and is only hit on the way down at bar 8.
    market_data.frames[FIXTURE_SYMBOL] = make_bars(RISE_AND_FALL_CLOSES, lows={7: 110})

    [trailing] = post_backtest(client, strategy(exit={"trailing_stop_pct": 10}))["result"]["trades"]
    [fixed] = post_backtest(client, strategy(exit={"stop_loss_pct": 10}))["result"]["trades"]

    assert trailing["exit_time"] == day(7)
    assert trailing["exit_price"] == pytest.approx(131 * 0.9)
    assert trailing["profit"] > 0
    assert fixed["profit"] < 0


def test_trailing_stop_follows_a_short_trade_down(market_data: FakeMarketData, client: TestClient) -> None:
    # Short at bar 3's open (89). The lowest low is 68 (bar 5), so a 10% trailing stop sits at 74.8 and bar 7 reaches 90.
    market_data.frames[FIXTURE_SYMBOL] = make_bars([110.0, 105, 95, 90, 80, 70, 72, 75, 100, 105, 110], highs={7: 90})
    short = strategy(
        entry={"direction": "short", "condition": close_crosses("crosses_below", 100)},
        exit={"trailing_stop_pct": 10},
    )

    [trade] = post_backtest(client, short)["result"]["trades"]

    assert trade["exit_time"] == day(7)
    assert trade["exit_price"] == pytest.approx(68 * 1.1)
    assert trade["profit"] > 0


def test_tighter_fixed_stop_wins_over_a_wide_trailing_stop(market_data: FakeMarketData, client: TestClient) -> None:
    market_data.frames[FIXTURE_SYMBOL] = make_bars([90, 95, 105, 110, 108, 112, 115], lows={4: 100})

    [trade] = post_backtest(client, strategy(exit={"stop_loss_pct": 5, "trailing_stop_pct": 20}))["result"]["trades"]

    assert trade["exit_time"] == day(4)
    assert trade["exit_price"] == pytest.approx(109 * 0.95)


def test_trailing_stop_alone_is_a_complete_exit(client: TestClient) -> None:
    assert post_backtest(client, strategy(exit={"trailing_stop_pct": 5}))["status"] == "ok"


@pytest.mark.parametrize("percent", [0, 100, -1])
def test_rejects_trailing_stop_out_of_range(client: TestClient, percent: float) -> None:
    response = client.post("/api/backtest", json={"strategy": strategy(exit={"trailing_stop_pct": percent})})

    assert response.status_code == 422


# ---------- Extra markets ----------


def test_extra_instruments_do_not_change_the_backtest(market_data: FakeMarketData, client: TestClient) -> None:
    market_data.frames["OTHERUSDT"] = make_bars([1.0] * len(CROSSING_CLOSES))

    plain = post_backtest(client, strategy())["result"]
    with_extras = post_backtest(client, strategy(extra_instruments=["OTHERUSDT"]))["result"]

    assert with_extras == plain


@pytest.mark.parametrize(
    "extra_instruments",
    [
        ["NOPEUSDT"],
        [FIXTURE_SYMBOL],
        ["OTHERUSDT", "OTHERUSDT"],
        [f"COIN{number}USDT" for number in range(10)],
    ],
)
def test_rejects_invalid_extra_instruments(
    market_data: FakeMarketData, client: TestClient, extra_instruments: list[str]
) -> None:
    for symbol in ["OTHERUSDT", *extra_instruments]:
        if symbol != "NOPEUSDT":
            market_data.frames.setdefault(symbol, make_bars(CROSSING_CLOSES))

    response = client.post("/api/backtest", json={"strategy": strategy(extra_instruments=extra_instruments)})

    assert response.status_code == 422


# ---------- Server errors ----------


class BrokenMarketData(FakeMarketData):
    def bars(self, symbol: str, timeframe: str) -> Any:
        raise ImportError("parquet engine missing")


def test_unexpected_error_still_carries_cors_headers() -> None:
    client = TestClient(create_app(BrokenMarketData()), raise_server_exceptions=False)

    response = client.post(
        "/api/backtest",
        json={"strategy": strategy(instrument="ANYUSDT")},
        headers={"Origin": "http://localhost:3000"},
    )

    assert response.status_code == 500
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


# ---------- Periods ----------


def test_a_period_tests_only_its_last_stretch_of_history(client: TestClient, market_data: FakeMarketData) -> None:
    closes = [90.0, 110.0] * 200
    market_data.frames[FIXTURE_SYMBOL] = make_bars(closes)

    whole = client.post("/api/backtest", json={"strategy": strategy(), "mode": "full"}).json()["result"]
    recent = client.post("/api/backtest", json={"strategy": strategy(), "mode": "full", "period": "3m"}).json()["result"]

    # Daily candles: three months is about 91 of them, all at the end of the history.
    assert 89 <= recent["bar_count"] <= 93
    assert recent["end_time"] == whole["end_time"]
    assert recent["metrics"]["trade_count"] < whole["metrics"]["trade_count"]
