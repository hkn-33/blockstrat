"""The strategy JSON contract shared by the block editor, the AI and the backtest engine (ADR 0001)."""

from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator

SCHEMA_VERSION = 1

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


Condition = Annotated[
    Union[Comparison, AllOf, AnyOf, Negation],
    Field(discriminator="kind"),
]


# ---------- Strategy ----------

Direction = Literal["long", "short"]


class EntryRule(FrozenModel):
    direction: Direction = "long"
    condition: Condition


class Exit(FrozenModel):
    rule: Condition | None = None
    stop_loss_pct: float | None = Field(default=None, gt=0, lt=100)
    take_profit_pct: float | None = Field(default=None, gt=0, le=1000)

    def is_empty(self) -> bool:
        return self.rule is None and self.stop_loss_pct is None and self.take_profit_pct is None


class ExecutionModel(FrozenModel):
    commission_pct: float = Field(default=0.1, ge=0, le=5)
    slippage_bps: float = Field(default=5, ge=0, le=500)


class StrategyDraft(FrozenModel):
    """A strategy as the editor sends it: the four required parts may still be missing."""

    schema_version: Literal[1] = SCHEMA_VERSION
    instrument: str | None = None
    timeframe: Timeframe | None = None
    entry: EntryRule | None = None
    exit: Exit | None = None
    position_size_pct: float = Field(default=100, gt=0, le=100)
    execution: ExecutionModel = ExecutionModel()

    def missing_parts(self) -> list[RequiredPart]:
        missing: list[RequiredPart] = []
        if self.instrument is None:
            missing.append("instrument")
        if self.timeframe is None:
            missing.append("timeframe")
        if self.entry is None:
            missing.append("entry")
        if self.exit is None or self.exit.is_empty():
            missing.append("exit")
        return missing


class Strategy(FrozenModel):
    """A complete strategy, ready to backtest."""

    schema_version: Literal[1] = SCHEMA_VERSION
    instrument: str
    timeframe: Timeframe
    entry: EntryRule
    exit: Exit
    position_size_pct: float = Field(default=100, gt=0, le=100)
    execution: ExecutionModel = ExecutionModel()

    @model_validator(mode="after")
    def exit_not_empty(self) -> "Strategy":
        if self.exit.is_empty():
            raise ValueError("Exit needs an exit rule, a stop-loss or a take-profit")
        return self


# ---------- Backtest API ----------

BacktestMode = Literal["preview", "full"]


class BacktestRequest(BaseModel):
    strategy: StrategyDraft
    mode: BacktestMode = "preview"


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


class MissingResponse(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    status: Literal["missing"] = "missing"
    missing: list[RequiredPart]


class ResultResponse(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    status: Literal["ok"] = "ok"
    result: BacktestResult


BacktestResponse = Annotated[Union[MissingResponse, ResultResponse], Field(discriminator="status")]
