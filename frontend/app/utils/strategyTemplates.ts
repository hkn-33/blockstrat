// Strategies people most often start from, ready to load and change. Each is a well-known idea in its
// plainest form, worded for someone who has only heard its name; none is a recommendation.
import type { Comparison, StrategyDraft } from '~/types/api'

export interface StrategyTemplate {
  name: string
  /** The family of ideas it belongs to, shown as a small tag. */
  style: 'Trend' | 'Dip buying' | 'Momentum' | 'Breakout' | 'Several signals' | 'Both directions'
  summary: string
  icon: string
  strategy: StrategyDraft
}

type Operand = Comparison['left']

const CLOSE: Operand = { kind: 'price', field: 'close' }
const MACD_LINE: Operand = { kind: 'macd', fast: 12, slow: 26, signal: 9, line: 'macd' }
const MACD_SIGNAL: Operand = { kind: 'macd', fast: 12, slow: 26, signal: 9, line: 'signal' }
const MACD_HISTOGRAM: Operand = { kind: 'macd', fast: 12, slow: 26, signal: 9, line: 'histogram' }
const EXECUTION = { commission_pct: 0.1, slippage_bps: 5, leverage: 1 }

function compare(left: Operand, operator: Comparison['operator'], right: Operand): Comparison {
  return { kind: 'compare', operator, left, right }
}

function number(value: number): Operand {
  return { kind: 'constant', value }
}

function sma(period: number): Operand {
  return { kind: 'sma', period }
}

function ema(period: number): Operand {
  return { kind: 'ema', period }
}

function rsi(period = 14): Operand {
  return { kind: 'rsi', period }
}

type Side = StrategyDraft['sides'][number]

function strategy(instrument: string, timeframe: StrategyDraft['timeframe'], ...sides: [Side, ...Side[]]): StrategyDraft {
  return { schema_version: 2, instrument, extra_instruments: [], timeframe, sides: sides as StrategyDraft['sides'], position_size_pct: 100, execution: EXECUTION }
}

function exit(rule: Comparison | null, limits: { stopLoss?: number, takeProfit?: number, trailingStop?: number } = {}): Side['exit'] {
  return { rule, stop_loss_pct: limits.stopLoss ?? null, take_profit_pct: limits.takeProfit ?? null, trailing_stop_pct: limits.trailingStop ?? null }
}

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  // The landing page's featured strategy comes first: it is the example the builder offers.
  {
    name: 'Trend with an RSI filter',
    style: 'Trend',
    summary: 'Buy when a fast average crosses above a slow one, unless the price has already run too hot',
    icon: 'play',
    strategy: strategy('SOLUSDT', '4h', {
      direction: 'long',
      entry: { kind: 'and', conditions: [compare(ema(20), 'crosses_above', sma(50)), compare(rsi(), 'lt', number(70))] },
      exit: exit(compare(ema(20), 'crosses_below', sma(50)), { stopLoss: 5, takeProfit: 15 }),
    }),
  },
  {
    name: 'Golden cross',
    style: 'Trend',
    summary: 'Buy when the 50-day average rises above the 200-day one, sell when it falls back under',
    icon: 'trending-up',
    strategy: strategy('BTCUSDT', '1d', {
      direction: 'long',
      entry: compare(sma(50), 'crosses_above', sma(200)),
      exit: exit(compare(sma(50), 'crosses_below', sma(200)), { stopLoss: 15 }),
    }),
  },
  {
    name: 'RSI dip in an uptrend',
    style: 'Dip buying',
    summary: 'Buy a sharp drop, but only while the price is above its 200-candle average',
    icon: 'trending-down',
    strategy: strategy('ETHUSDT', '4h', {
      direction: 'long',
      entry: { kind: 'and', conditions: [compare(rsi(), 'lt', number(30)), compare(CLOSE, 'gt', sma(200))] },
      exit: exit(compare(rsi(), 'gt', number(65)), { stopLoss: 6 }),
    }),
  },
  {
    name: 'MACD momentum',
    style: 'Momentum',
    summary: 'Get in when momentum turns up in a rising market, out when it turns down',
    icon: 'zap',
    strategy: strategy('SOLUSDT', '4h', {
      direction: 'long',
      entry: { kind: 'and', conditions: [compare(MACD_LINE, 'crosses_above', MACD_SIGNAL), compare(CLOSE, 'gt', ema(100))] },
      exit: exit(compare(MACD_LINE, 'crosses_below', MACD_SIGNAL), { stopLoss: 5 }),
    }),
  },
  {
    name: 'Bollinger bounce',
    style: 'Dip buying',
    summary: 'Buy when the price closes unusually low for now, sell when it is back at its average',
    icon: 'gauge',
    strategy: strategy('BTCUSDT', '4h', {
      direction: 'long',
      entry: compare(CLOSE, 'lt', { kind: 'bollinger', period: 20, std_dev: 2, band: 'lower' }),
      exit: exit(compare(CLOSE, 'gt', { kind: 'bollinger', period: 20, std_dev: 2, band: 'middle' }), { stopLoss: 4 }),
    }),
  },
  {
    name: 'Breakout with volume',
    style: 'Breakout',
    summary: 'Buy a new 20-day high on busy trading, then let a trailing stop follow the price up',
    icon: 'chart-candlestick',
    strategy: strategy('BTCUSDT', '1d', {
      direction: 'long',
      entry: { kind: 'and', conditions: [compare(CLOSE, 'crosses_above', { kind: 'highest', period: 20 }), compare({ kind: 'relative_volume', period: 20 }, 'gt', number(1.5))] },
      exit: exit(compare(CLOSE, 'crosses_below', { kind: 'lowest', period: 10 }), { trailingStop: 10 }),
    }),
  },
  {
    name: 'Two of three agree',
    style: 'Several signals',
    summary: 'Buy when any two of three signs point up, so no single indicator decides alone',
    icon: 'scale',
    strategy: strategy('ETHUSDT', '4h', {
      direction: 'long',
      entry: {
        kind: 'score',
        threshold: 2,
        parts: [
          { weight: 1, condition: compare(rsi(), 'lt', number(40)) },
          { weight: 1, condition: compare(CLOSE, 'gt', sma(50)) },
          { weight: 1, condition: compare(MACD_HISTOGRAM, 'gt', number(0)) },
        ],
      },
      exit: exit(null, { stopLoss: 6, takeProfit: 12 }),
    }),
  },
  {
    name: 'Trend both ways',
    style: 'Both directions',
    summary: 'Go long when a fast average crosses above a slow one, and short when it crosses below',
    icon: 'layers',
    strategy: strategy(
      'SOLUSDT',
      '4h',
      { direction: 'long', entry: compare(ema(20), 'crosses_above', sma(50)), exit: exit(compare(ema(20), 'crosses_below', sma(50)), { stopLoss: 6 }) },
      { direction: 'short', entry: compare(ema(20), 'crosses_below', sma(50)), exit: exit(compare(ema(20), 'crosses_above', sma(50)), { stopLoss: 6 }) },
    ),
  },
]
