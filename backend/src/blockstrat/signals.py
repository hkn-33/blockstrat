"""Turns operands and conditions into per-bar series, computed on the whole history at once."""

import pandas as pd
from ta.momentum import RSIIndicator, StochasticOscillator
from ta.trend import MACD, EMAIndicator, SMAIndicator
from ta.volatility import BollingerBands

from blockstrat.schema import (
    AllOf,
    AnyOf,
    BollingerOperand,
    ChangeOperand,
    Comparison,
    Condition,
    ConstantOperand,
    EmaOperand,
    HighestOperand,
    LowestOperand,
    MacdOperand,
    Negation,
    Operand,
    PriceOperand,
    RelativeVolumeOperand,
    RsiOperand,
    Score,
    SmaOperand,
    StochasticOperand,
)

PRICE_COLUMNS = {"open": "Open", "high": "High", "low": "Low", "close": "Close", "volume": "Volume"}


def operand_series(bars: pd.DataFrame, operand: Operand) -> pd.Series:
    close = bars["Close"]
    match operand:
        case PriceOperand(field=field):
            return bars[PRICE_COLUMNS[field]]
        case SmaOperand(period=period):
            return SMAIndicator(close, window=period).sma_indicator()
        case EmaOperand(period=period):
            return EMAIndicator(close, window=period).ema_indicator()
        case RsiOperand(period=period):
            return RSIIndicator(close, window=period).rsi()
        case MacdOperand(fast=fast, slow=slow, signal=signal, line=line):
            macd = MACD(close, window_fast=fast, window_slow=slow, window_sign=signal)
            if line == "signal":
                return macd.macd_signal()
            if line == "histogram":
                return macd.macd_diff()
            return macd.macd()
        case BollingerOperand(period=period, std_dev=std_dev, band=band):
            bollinger = BollingerBands(close, window=period, window_dev=std_dev)
            if band == "upper":
                return bollinger.bollinger_hband()
            if band == "lower":
                return bollinger.bollinger_lband()
            return bollinger.bollinger_mavg()
        case HighestOperand(period=period):
            return bars["High"].shift(1).rolling(period).max()
        case LowestOperand(period=period):
            return bars["Low"].shift(1).rolling(period).min()
        case ChangeOperand(period=period):
            return (close / close.shift(period) - 1) * 100
        case RelativeVolumeOperand(period=period):
            volume = bars["Volume"]
            return volume / volume.rolling(period).mean()
        case StochasticOperand(period=period, smooth=smooth, line=line):
            stochastic = StochasticOscillator(bars["High"], bars["Low"], close, window=period, smooth_window=smooth)
            if line == "d":
                return stochastic.stoch_signal()
            return stochastic.stoch()
        case ConstantOperand(value=value):
            return pd.Series(value, index=bars.index, dtype="float64")


def condition_series(bars: pd.DataFrame, condition: Condition) -> pd.Series:
    """True on bars where the condition holds at the bar's close. Warm-up bars (NaN inputs) are False."""
    match condition:
        case Comparison(operator=operator, left=left, right=right):
            return _compare(operator, operand_series(bars, left), operand_series(bars, right))
        case AllOf(conditions=conditions):
            result = condition_series(bars, conditions[0])
            for other in conditions[1:]:
                result = result & condition_series(bars, other)
            return result
        case AnyOf(conditions=conditions):
            result = condition_series(bars, conditions[0])
            for other in conditions[1:]:
                result = result | condition_series(bars, other)
            return result
        case Negation(condition=inner):
            return ~condition_series(bars, inner)
        case Score(threshold=threshold, parts=parts):
            total = pd.Series(0.0, index=bars.index)
            for part in parts:
                total += condition_series(bars, part.condition) * part.weight
            return total >= threshold


def condition_operands(condition: Condition) -> list[Operand]:
    match condition:
        case Comparison(left=left, right=right):
            return [left, right]
        case AllOf(conditions=conditions) | AnyOf(conditions=conditions):
            return [operand for inner in conditions for operand in condition_operands(inner)]
        case Negation(condition=inner):
            return condition_operands(inner)
        case Score(parts=parts):
            return [operand for part in parts for operand in condition_operands(part.condition)]


def warmed_up(bars: pd.DataFrame, operands: list[Operand]) -> pd.Series:
    """True from the first bar on which every operand has a value; signals before it are ignored."""
    ready = pd.Series(True, index=bars.index)
    for operand in operands:
        ready &= operand_series(bars, operand).notna()
    return ready.cummax() if ready.any() else ready


def _compare(operator: str, left: pd.Series, right: pd.Series) -> pd.Series:
    if operator == "gt":
        return (left > right).fillna(False)
    if operator == "lt":
        return (left < right).fillna(False)
    previous_left = left.shift(1)
    previous_right = right.shift(1)
    if operator == "crosses_above":
        return ((left > right) & (previous_left <= previous_right)).fillna(False)
    return ((left < right) & (previous_left >= previous_right)).fillna(False)
