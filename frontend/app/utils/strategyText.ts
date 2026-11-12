// How the builder words each part of a condition, in plain English: "EMA 20 | crosses above | SMA 50".
import type { Operand, Operator } from './strategyDocument'

const PRICE_FIELDS: Record<string, string> = { open: 'Open', high: 'High', low: 'Low', close: 'Close', volume: 'Volume' }
const MACD_LINES: Record<string, string> = { macd: 'MACD', signal: 'MACD signal', histogram: 'MACD histogram' }
const BANDS: Record<string, string> = { upper: 'Upper band', middle: 'Middle band', lower: 'Lower band' }

export function operandLabel(operand: Operand): string {
  switch (operand.kind) {
    case 'price':
      return PRICE_FIELDS[operand.field] ?? operand.field
    case 'sma':
      return `SMA ${operand.period}`
    case 'ema':
      return `EMA ${operand.period}`
    case 'rsi':
      return `RSI ${operand.period}`
    case 'macd':
      return MACD_LINES[operand.line] ?? 'MACD'
    case 'bollinger':
      return `${BANDS[operand.band] ?? 'Band'} ${operand.period}`
    case 'highest':
      return `Highest high ${operand.period}`
    case 'lowest':
      return `Lowest low ${operand.period}`
    case 'change':
      return `Change over ${operand.period} (%)`
    case 'relative_volume':
      return `Volume vs average ${operand.period}`
    case 'stochastic':
      return `Stochastic ${operand.line === 'd' ? '%D' : '%K'} ${operand.period}`
    case 'constant':
      return operand.value.toLocaleString('en-US', { maximumFractionDigits: 4 })
  }
}

/** The label with every setting spelled out, for advanced mode: "MACD 12, 26, 9", "Lower band 20, 2σ". */
export function operandDetail(operand: Operand): string {
  switch (operand.kind) {
    case 'macd':
      return `${operandLabel(operand)} ${operand.fast}, ${operand.slow}, ${operand.signal}`
    case 'bollinger':
      return `${operandLabel(operand)}, ${operand.std_dev}σ`
    case 'stochastic':
      return `${operandLabel(operand)}, smooth ${operand.smooth}`
    default:
      return operandLabel(operand)
  }
}

const OPERATORS: Record<Operator, { plain: string, negated: string }> = {
  gt: { plain: 'is above', negated: 'is not above' },
  lt: { plain: 'is below', negated: 'is not below' },
  crosses_above: { plain: 'crosses above', negated: 'does not cross above' },
  crosses_below: { plain: 'crosses below', negated: 'does not cross below' },
}

export const OPERATOR_CHOICES: Operator[] = ['gt', 'lt', 'crosses_above', 'crosses_below']

export function operatorLabel(operator: Operator, negated = false): string {
  return negated ? OPERATORS[operator].negated : OPERATORS[operator].plain
}

/** A condition's weight inside a score as its tile shows it after the multiplication sign: "2", "1.5". */
export function weightLabel(weight: number): string {
  return weight.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

/** The same weight in words, for a tooltip or a screen reader: "Counts as 2 conditions". */
export function timesLabel(weight: number): string {
  return weight === 1 ? 'Counts as one condition' : `Counts as ${weightLabel(weight)} conditions`
}
