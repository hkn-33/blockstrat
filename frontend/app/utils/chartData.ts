// What the TradingView-style chart draws, whatever it comes from: the landing page's precomputed demo or
// a live backtest from the API.
import type { BacktestResult, Comparison, SideDraft, StrategyDraft } from '~/types/api'
import { bollinger, change, ema, highest, lowest, macd, relativeVolume, rsi, sma, stochastic, type Series } from './indicators'
import { operandDetail } from './strategyText'

export interface ChartCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export interface ChartPoint {
  time: number
  value: number
}

export interface ChartTrade {
  entry_time: number
  exit_time: number
  return_pct: number
  direction?: 'long' | 'short'
}

export interface ChartData {
  candles: ChartCandle[]
  /** The strategy's balance at each candle. */
  equity: ChartPoint[]
  /** The balance of simply holding the instrument from the same start. */
  holding: ChartPoint[]
  trades: ChartTrade[]
}

export function chartDataFromResult(result: BacktestResult): ChartData {
  return {
    candles: result.bars,
    equity: result.equity,
    holding: result.buy_and_hold,
    trades: result.trades,
  }
}

type Operand = Comparison['left']
type Condition = NonNullable<SideDraft['entry']>

/** Where a line is drawn: over the candles, or under them in a pane shared by indicators of one scale. */
export type IndicatorPane = 'price' | 'range' | 'macd' | 'change' | 'volume'

export interface IndicatorLine {
  key: string
  label: string
  pane: IndicatorPane
  points: ChartPoint[]
}

function conditionOperands(condition: Condition): Operand[] {
  switch (condition.kind) {
    case 'compare':
      return [condition.left, condition.right]
    case 'and':
    case 'or':
      return condition.conditions.flatMap(conditionOperands)
    case 'not':
      return conditionOperands(condition.condition)
    case 'score':
      return condition.parts.flatMap(part => conditionOperands(part.condition))
  }
}

function seriesOf(operand: Operand, candles: ChartCandle[]): { pane: IndicatorPane, values: Series } | null {
  const closes = candles.map(candle => candle.close)
  const highs = candles.map(candle => candle.high)
  const lows = candles.map(candle => candle.low)
  switch (operand.kind) {
    case 'sma':
      return { pane: 'price', values: sma(closes, operand.period) }
    case 'ema':
      return { pane: 'price', values: ema(closes, operand.period) }
    case 'bollinger':
      return { pane: 'price', values: bollinger(closes, operand.period, operand.std_dev)[operand.band] }
    case 'highest':
      // The previous candles only, as the rule reads it.
      return { pane: 'price', values: [null, ...highest(highs, operand.period).slice(0, -1)] }
    case 'lowest':
      return { pane: 'price', values: [null, ...lowest(lows, operand.period).slice(0, -1)] }
    case 'rsi':
      return { pane: 'range', values: rsi(closes, operand.period) }
    case 'stochastic': {
      const lines = stochastic(highs, lows, closes, operand.period, operand.smooth)
      return { pane: 'range', values: operand.line === 'd' ? lines.d : lines.k }
    }
    case 'macd': {
      const lines = macd(closes, operand.fast, operand.slow, operand.signal)
      return { pane: 'macd', values: operand.line === 'signal' ? lines.signal : operand.line === 'histogram' ? lines.histogram : lines.line }
    }
    case 'change':
      return { pane: 'change', values: change(closes, operand.period) }
    case 'relative_volume':
      if (candles.some(candle => candle.volume === undefined)) return null
      return { pane: 'volume', values: relativeVolume(candles.map(candle => candle.volume!), operand.period) }
    case 'price':
    case 'constant':
      return null
  }
}

/** Every indicator the strategy's rules read, once each, as a line over the candles or in a pane under them. */
export function strategyIndicatorLines(strategy: StrategyDraft, candles: ChartCandle[]): IndicatorLine[] {
  const conditions = strategy.sides.flatMap(side => [side.entry, side.exit?.rule ?? null]).filter(condition => condition !== null)
  const lines = new Map<string, IndicatorLine>()
  for (const operand of conditions.flatMap(conditionOperands)) {
    const key = JSON.stringify(operand)
    if (lines.has(key)) continue
    const series = seriesOf(operand, candles)
    if (!series) continue
    const points = series.values.flatMap((value, index) => (value === null ? [] : [{ time: candles[index]!.time, value }]))
    lines.set(key, { key, label: operandDetail(operand), pane: series.pane, points })
  }
  return [...lines.values()]
}
