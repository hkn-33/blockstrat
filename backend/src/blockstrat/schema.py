"""The strategy JSON contract shared by the block editor, the AI and the backtest engine (ADR 0001)."""

from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator

SCHEMA_VERSION = 2

Timeframe = Literal["1d", "4h", "1h"]
TIMEFRAMES: tuple[Timeframe, ...] = ("1d", "4h", "1h")

RequiredPart = Literal["instrument", "timeframe", "entry", "exit"]


class FrozenModel(BaseModel):
    # Frozen so operands are hashable and can key the indicator cache.
    model_config = ConfigDict(frozen=True, extra="forbid", json_schema_serialization_defaults_required=True)


# ---------- Operands ----------

PriceField = Literal["open", "high", "low", "close", "volume"]


class PriceOperand(FrozenModel):
    kind: Literal["price"] = "price"
    field: PriceField = "close"


class SmaOperand(FrozenModel):
    kind: Literal["sma"] = "sma"
    period: int = Field(ge=1, le=1000)


class EmaOperand(FrozenModel):
    kind: Literal["ema"] = "ema"
    period: int = Field(ge=1, le=1000)


class RsiOperand(FrozenModel):
    kind: Literal["rsi"] = "rsi"
    period: int = Field(ge=2, le=1000)


class MacdOperand(FrozenModel):
    kind: Literal["macd"] = "macd"
    fast: int = Field(default=12, ge=1, le=1000)
    slow: int = Field(default=26, ge=2, le=1000)
    signal: int = Field(default=9, ge=1, le=1000)
    line: Literal["macd", "signal", "histogram"] = "macd"

    @model_validator(mode="after")
    def fast_below_slow(self) -> "MacdOperand":
        if self.fast >= self.slow:
            raise ValueError("MACD fast period must be shorter than slow period")
        return self


class BollingerOperand(FrozenModel):
    kind: Literal["bollinger"] = "bollinger"
    period: int = Field(default=20, ge=2, le=1000)
    std_dev: float = Field(default=2.0, gt=0, le=10)
    band: Literal["upper", "middle", "lower"] = "middle"


class HighestOperand(FrozenModel):
    """The highest High of the previous bars, not counting the current one, so a close can break above it."""

    kind: Literal["highest"] = "highest"
    period: int = Field(ge=1, le=1000)


class LowestOperand(FrozenModel):
    """The lowest Low of the previous bars, not counting the current one, so a close can break below it."""

    kind: Literal["lowest"] = "lowest"
    period: int = Field(ge=1, le=1000)


class ChangeOperand(FrozenModel):
    """Percent change of the close against the close `period` bars ago."""

    kind: Literal["change"] = "change"
    period: int = Field(ge=1, le=1000)


class RelativeVolumeOperand(FrozenModel):
    """Volume divided by its simple average over `period` bars: 1.0 is an average bar."""

    kind: Literal["relative_volume"] = "relative_volume"
    period: int = Field(ge=2, le=1000)


class StochasticOperand(FrozenModel):
    kind: Literal["stochastic"] = "stochastic"
    period: int = Field(default=14, ge=2, le=1000)
    smooth: int = Field(default=3, ge=1, le=1000)
    line: Literal["k", "d"] = "k"


class ConstantOperand(FrozenModel):
    kind: Literal["constant"] = "constant"
    value: float


Operand = Annotated[
    Union[
        PriceOperand,
        SmaOperand,
        EmaOperand,
        RsiOperand,
        MacdOperand,
        BollingerOperand,
        HighestOperand,
        LowestOperand,
        ChangeOperand,
        RelativeVolumeOperand,
        StochasticOperand,
        ConstantOperand,
    ],
    Field(discriminator="kind"),
]


# ---------- Conditions ----------

ComparisonOperator = Literal["gt", "lt", "crosses_above", "crosses_below"]


class Comparison(FrozenModel):
    kind: Literal["compare"] = "compare"
    operator: ComparisonOperator
    left: Operand
    right: Operand


class AllOf(FrozenModel):
    kind: Literal["and"] = "and"
    conditions: tuple["Condition", ...] = Field(min_length=2)


class AnyOf(FrozenModel):
    kind: Literal["or"] = "or"
    conditions: tuple["Condition", ...] = Field(min_length=2)


class Negation(FrozenModel):
    kind: Literal["not"] = "not"
    condition: "Condition"


MAX_SCORE_PARTS = 20
MAX_EXTRA_INSTRUMENTS = 9


class ScorePart(FrozenModel):
    weight: float = Field(default=1, gt=0, le=100)
    condition: "Condition"


class Score(FrozenModel):
    """True when the weights of the parts that are true add up to at least the threshold."""

    kind: Literal["score"] = "score"
    threshold: float = Field(gt=0)
    parts: tuple[ScorePart, ...] = Field(min_length=2)

    @model_validator(mode="after")
    def threshold_reachable(self) -> "Score":
        # Checked here, not as a field maximum: a maximum would turn the generated TypeScript type
        # into a union of twenty tuples the editor could not assign a list to.
        if len(self.parts) > MAX_SCORE_PARTS:
            raise ValueError(f"A score has at most {MAX_SCORE_PARTS} parts")
        if self.threshold > sum(part.weight for part in self.parts):
            raise ValueError("Score threshold is above the sum of the weights, so it could never be reached")
        return self


Condition = Annotated[
    Union[Comparison, AllOf, AnyOf, Negation, Score],
    Field(discriminator="kind"),
]


# ---------- Strategy ----------

Direction = Literal["long", "short"]


class Exit(FrozenModel):
    rule: Condition | None = None
    stop_loss_pct: float | None = Field(default=None, gt=0, lt=100)
    take_profit_pct: float | None = Field(default=None, gt=0, le=1000)
    trailing_stop_pct: float | None = Field(default=None, gt=0, lt=100)

    def is_empty(self) -> bool:
        return (
            self.rule is None
            and self.stop_loss_pct is None
            and self.take_profit_pct is None
            and self.trailing_stop_pct is None
        )


class ExecutionModel(FrozenModel):
    commission_pct: float = Field(default=0.1, ge=0, le=5)
    slippage_bps: float = Field(default=5, ge=0, le=500)
    # The position is this many times what the account holds; a loss as large as the account wipes it out.
    leverage: float = Field(default=1, ge=1, le=10)


class SideDraft(FrozenModel):
    """One side of a strategy as the editor sends it: its entry or exit may still be missing."""

    direction: Direction = "long"
    entry: Condition | None = None
    exit: Exit | None = None

    def is_complete(self) -> bool:
        return self.entry is not None and self.exit is not None and not self.exit.is_empty()


class Side(FrozenModel):
    """The long or the short half of a strategy: when to open that position and how it closes."""

    direction: Direction
    entry: Condition
    exit: Exit

    @model_validator(mode="after")
    def exit_not_empty(self) -> "Side":
        if self.exit.is_empty():
            raise ValueError("Exit needs an exit rule, a stop-loss, a take-profit or a trailing stop")
        return self


def _upgrade_version_1(data: Any) -> Any:
    """Version 1 had one entry rule with a direction and one exit; it becomes a strategy with one side."""
    if not isinstance(data, dict) or "sides" in data or data.get("schema_version", 1) != 1:
        return data
    upgraded = {key: value for key, value in data.items() if key not in ("entry", "exit")}
    entry = data.get("entry")
    side: dict[str, Any] = {"direction": "long"}
    if isinstance(entry, dict):
        side["direction"] = entry.get("direction", "long")
        # An entry without a condition stays invalid instead of quietly becoming "no entry yet".
        side["entry"] = entry.get("condition", {})
    if data.get("exit") is not None:
        side["exit"] = data["exit"]
    upgraded["schema_version"] = SCHEMA_VERSION
    upgraded["sides"] = [side]
    return upgraded


def _check_directions(sides: tuple[SideDraft | Side, ...]) -> None:
    directions = [side.direction for side in sides]
    if len(set(directions)) != len(directions):
        raise ValueError("A strategy has at most one long side and one short side")


def _check_extra_instruments(instrument: str | None, extra_instruments: tuple[str, ...]) -> None:
    # The maximum is checked here for the same reason as a score's parts: to keep the generated type a list.
    if len(extra_instruments) > MAX_EXTRA_INSTRUMENTS:
        raise ValueError(f"A strategy has at most {MAX_EXTRA_INSTRUMENTS} extra instruments")
    if len(set(extra_instruments)) != len(extra_instruments):
        raise ValueError("Extra instruments must not repeat")
    if instrument is not None and instrument in extra_instruments:
        raise ValueError("Extra instruments must not repeat the strategy's instrument")


class StrategyDraft(FrozenModel):
    """A strategy as the editor sends it: the required parts may still be missing."""

    schema_version: Literal[2] = SCHEMA_VERSION
    instrument: str | None = None
    # Other markets to test the same strategy on, one backtest per market (ADR 0004); a backtest ignores them.
    extra_instruments: tuple[str, ...] = ()
    timeframe: Timeframe | None = None
    sides: tuple[SideDraft, ...] = Field(default=(SideDraft(),), min_length=1, max_length=2)
    position_size_pct: float = Field(default=100, gt=0, le=100)
    execution: ExecutionModel = ExecutionModel()

    upgrade_version_1 = model_validator(mode="before")(_upgrade_version_1)

    @model_validator(mode="after")
    def directions_differ(self) -> "StrategyDraft":
        _check_directions(self.sides)
        return self

    @model_validator(mode="after")
    def extra_instruments_distinct(self) -> "StrategyDraft":
        _check_extra_instruments(self.instrument, self.extra_instruments)
        return self

    def complete_sides(self) -> list[SideDraft]:
        return [side for side in self.sides if side.is_complete()]

    def missing_parts(self) -> list[RequiredPart]:
        """What stops a backtest. One complete side is enough; an unfinished second side is left out."""
        missing: list[RequiredPart] = []
        if self.instrument is None:
            missing.append("instrument")
        if self.timeframe is None:
            missing.append("timeframe")
        if self.complete_sides():
            return missing
        with_entry = [side for side in self.sides if side.entry is not None]
        if not with_entry:
            missing.append("entry")
        if not any(side.exit is not None and not side.exit.is_empty() for side in with_entry or self.sides):
            missing.append("exit")
        return missing


class Strategy(FrozenModel):
    """A complete strategy, ready to backtest."""

    schema_version: Literal[2] = SCHEMA_VERSION
    instrument: str
    extra_instruments: tuple[str, ...] = ()
    timeframe: Timeframe
    sides: tuple[Side, ...] = Field(min_length=1, max_length=2)
    position_size_pct: float = Field(default=100, gt=0, le=100)
    execution: ExecutionModel = ExecutionModel()

    upgrade_version_1 = model_validator(mode="before")(_upgrade_version_1)

    @model_validator(mode="after")
    def directions_differ(self) -> "Strategy":
        _check_directions(self.sides)
        return self

    @model_validator(mode="after")
    def extra_instruments_distinct(self) -> "Strategy":
        _check_extra_instruments(self.instrument, self.extra_instruments)
        return self

    def side(self, direction: Direction) -> Side | None:
        return next((side for side in self.sides if side.direction == direction), None)


# ---------- Backtest API ----------

BacktestMode = Literal["preview", "full"]
# How much of the latest history a full backtest covers: three or six months, one or three years, or all of it.
BacktestPeriod = Literal["3m", "6m", "1y", "3y", "all"]


class BacktestRequest(BaseModel):
    strategy: StrategyDraft
    mode: BacktestMode = "preview"
    period: BacktestPeriod = "all"


class TimePoint(BaseModel):
    time: int = Field(description="Bar open time, UNIX seconds")
    value: float


class Bar(BaseModel):
    time: int
    open: float
    high: float
    low: float
    close: float


class Trade(BaseModel):
    direction: Direction
    entry_time: int
    entry_price: float
    exit_time: int
    exit_price: float
    size: float
    return_pct: float
    profit: float


class Metrics(BaseModel):
    total_return_pct: float
    buy_and_hold_return_pct: float
    max_drawdown_pct: float
    sharpe_ratio: float | None
    win_rate_pct: float | None
    trade_count: int
    exposure_time_pct: float
    # Advanced mode's further statistics; None where they cannot be computed, e.g. without a closed trade.
    annual_return_pct: float | None = None
    sortino_ratio: float | None = None
    calmar_ratio: float | None = None
    profit_factor: float | None = None
    avg_trade_pct: float | None = None
    avg_trade_hours: float | None = None
    max_drawdown_days: float | None = None


class SideResult(BaseModel):
    direction: Direction
    trade_count: int
    win_rate_pct: float | None
    return_pct: float = Field(description="This side's closed trades' profit, as % of the starting cash")


class BacktestResult(BaseModel):
    mode: BacktestMode
    bar_count: int
    start_time: int
    end_time: int
    bars: list[Bar]
    equity: list[TimePoint]
    buy_and_hold: list[TimePoint]
    trades: list[Trade]
    metrics: Metrics
    sides: list[SideResult]
    both_signalled: int = Field(description="Candles where both sides signalled while flat, so no trade opened")


class MissingResponse(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    status: Literal["missing"] = "missing"
    missing: list[RequiredPart]


class ResultResponse(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    status: Literal["ok"] = "ok"
    result: BacktestResult


BacktestResponse = Annotated[Union[MissingResponse, ResultResponse], Field(discriminator="status")]
