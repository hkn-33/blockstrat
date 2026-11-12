// The builder's block library: every indicator explained in plain words for someone who has only heard the
// names, with the condition it adds and how its hover chart draws it.
import { newCondition, type Item, type Operand } from './strategyDocument'

export type IndicatorKind = Exclude<Operand['kind'], 'constant'>

export interface IndicatorBlock {
  kind: IndicatorKind
  name: string
  short: string
  help: string
  /** "overlay" draws on the candles; "pane" draws underneath them on its own scale. */
  preview: 'overlay' | 'pane'
  build: () => Item
}

const CLOSE = { kind: 'price', field: 'close' } as const
const MACD = { kind: 'macd', fast: 12, slow: 26, signal: 9, line: 'macd' } as const
const MACD_SIGNAL = { ...MACD, line: 'signal' } as const
const HIGHEST_20 = { kind: 'highest', period: 20 } as const
const LOWEST_10 = { kind: 'lowest', period: 10 } as const
const CHANGE_7 = { kind: 'change', period: 7 } as const
const RELATIVE_VOLUME = { kind: 'relative_volume', period: 20 } as const
const STOCHASTIC = { kind: 'stochastic', period: 14, smooth: 3, line: 'k' } as const

export const INDICATOR_BLOCKS: IndicatorBlock[] = [
  {
    kind: 'price',
    name: 'Price',
    short: 'The candle\'s close, open, high or low',
    help: 'The simplest block: the price itself. Compare it with an average or a band to ask "is the price above its usual level right now?"',
    preview: 'overlay',
    build: () => newCondition('gt', CLOSE, { kind: 'sma', period: 50 }),
  },
  {
    kind: 'sma',
    name: 'SMA, simple moving average',
    short: 'The average price of the last N candles',
    help: 'It smooths out the noise into one calm line. When the price stays above it, the market is usually rising; below it, falling.',
    preview: 'overlay',
    build: () => newCondition('gt', CLOSE, { kind: 'sma', period: 50 }),
  },
  {
    kind: 'ema',
    name: 'EMA, exponential moving average',
    short: 'An average that cares more about recent candles',
    help: 'Like the SMA, but newer prices count more, so it turns sooner. A fast EMA crossing above a slower average is a classic "trend is starting" signal.',
    preview: 'overlay',
    build: () => newCondition('crosses_above', { kind: 'ema', period: 20 }, { kind: 'sma', period: 50 }),
  },
  {
    kind: 'rsi',
    name: 'RSI, relative strength index',
    short: 'A 0 to 100 gauge of how hard the price moved lately',
    help: 'Under 30 the price fell fast and is often called oversold; over 70 it rose fast and is called overbought. Many dip-buying ideas start here.',
    preview: 'pane',
    build: () => newCondition('lt', { kind: 'rsi', period: 14 }, { kind: 'constant', value: 30 }),
  },
  {
    kind: 'macd',
    name: 'MACD',
    short: 'The gap between a fast and a slow average',
    help: 'When the gap grows, momentum is building. The MACD line crossing above its slower signal line is read as momentum turning up.',
    preview: 'pane',
    build: () => newCondition('crosses_above', { kind: 'macd', fast: 12, slow: 26, signal: 9, line: 'macd' }, { kind: 'macd', fast: 12, slow: 26, signal: 9, line: 'signal' }),
  },
  {
    kind: 'bollinger',
    name: 'Bollinger Bands',
    short: 'A band around the average that widens when prices swing',
    help: 'Most candles stay inside the bands. A close below the lower band means the price is unusually low for now, which some strategies buy.',
    preview: 'overlay',
    build: () => newCondition('lt', CLOSE, { kind: 'bollinger', period: 20, std_dev: 2, band: 'lower' }),
  },
  {
    kind: 'highest',
    name: 'Highest high',
    short: 'The top price of the last N candles',
    help: 'The highest price reached over the previous N candles, not counting the current one. A close above it is a breakout: the price has gone where it has not been for a while, and breakout traders buy there.',
    preview: 'overlay',
    build: () => newCondition('crosses_above', CLOSE, HIGHEST_20),
  },
  {
    kind: 'lowest',
    name: 'Lowest low',
    short: 'The bottom price of the last N candles',
    help: 'The lowest price reached over the previous N candles, not counting the current one. A close below it is a breakdown, a common sign that a trade has stopped working and it is time to get out.',
    preview: 'overlay',
    build: () => newCondition('crosses_below', CLOSE, LOWEST_10),
  },
  {
    kind: 'change',
    name: 'Price change',
    short: 'How far the price moved over the last N candles, in %',
    help: 'The close compared with the close N candles ago: 10 means the price rose 10%, −10 that it fell 10%. Dip buyers look for a sharp fall; others take their profit after a sharp rise.',
    preview: 'pane',
    build: () => newCondition('lt', CHANGE_7, { kind: 'constant', value: -10 }),
  },
  {
    kind: 'relative_volume',
    name: 'Relative volume',
    short: 'How busy trading is compared with usual',
    help: 'The candle\'s volume divided by its average: 1 is an ordinary candle, 2 is twice the usual trading. Many traders trust a move more when lots of people take part, so they pair it with a breakout.',
    preview: 'pane',
    build: () => newCondition('gt', RELATIVE_VOLUME, { kind: 'constant', value: 1.5 }),
  },
  {
    kind: 'stochastic',
    name: 'Stochastic oscillator',
    short: 'Where the close sits in its recent range, 0 to 100',
    help: 'Near 100 the price closed at the top of its last N candles; near 0, at the bottom. Under 20 is often called oversold and over 80 overbought, read much like the RSI. %D is a smoothed, slower copy of the %K line.',
    preview: 'pane',
    build: () => newCondition('lt', STOCHASTIC, { kind: 'constant', value: 20 }),
  },
]

export function indicatorBlock(kind: IndicatorKind): IndicatorBlock {
  return INDICATOR_BLOCKS.find(block => block.kind === kind)!
}

/** The ideas ready conditions belong to, in the order a beginner usually meets them. */
export const IDEAS = ['Trend', 'Dips and peaks', 'Momentum', 'Breakouts', 'Volume'] as const
export type Idea = typeof IDEAS[number]

export interface ReadyCondition {
  label: string
  kind: IndicatorKind
  idea: Idea
  side: 'buy' | 'sell'
  build: () => Item
}

/** Ready conditions, each explained by the indicator it measures, sorted by the side they usually serve. */
export const READY_CONDITIONS: ReadyCondition[] = [
  { label: 'Close is above SMA 200', kind: 'sma', idea: 'Trend', side: 'buy', build: () => newCondition('gt', CLOSE, { kind: 'sma', period: 200 }) },
  { label: 'EMA 20 crosses above SMA 50', kind: 'ema', idea: 'Trend', side: 'buy', build: () => newCondition('crosses_above', { kind: 'ema', period: 20 }, { kind: 'sma', period: 50 }) },
  { label: 'RSI is below 30', kind: 'rsi', idea: 'Dips and peaks', side: 'buy', build: () => newCondition('lt', { kind: 'rsi', period: 14 }, { kind: 'constant', value: 30 }) },
  { label: 'Close is below the lower band', kind: 'bollinger', idea: 'Dips and peaks', side: 'buy', build: () => newCondition('lt', CLOSE, { kind: 'bollinger', period: 20, std_dev: 2, band: 'lower' }) },
  { label: 'Price fell 10% in 7 candles', kind: 'change', idea: 'Dips and peaks', side: 'buy', build: () => newCondition('lt', CHANGE_7, { kind: 'constant', value: -10 }) },
  { label: 'Stochastic is below 20', kind: 'stochastic', idea: 'Dips and peaks', side: 'buy', build: () => newCondition('lt', STOCHASTIC, { kind: 'constant', value: 20 }) },
  { label: 'MACD crosses above its signal', kind: 'macd', idea: 'Momentum', side: 'buy', build: () => newCondition('crosses_above', MACD, MACD_SIGNAL) },
  { label: 'Close breaks above the 20-candle high', kind: 'highest', idea: 'Breakouts', side: 'buy', build: () => newCondition('crosses_above', CLOSE, HIGHEST_20) },
  { label: 'Volume is 1.5x its average', kind: 'relative_volume', idea: 'Volume', side: 'buy', build: () => newCondition('gt', RELATIVE_VOLUME, { kind: 'constant', value: 1.5 }) },
  { label: 'Close is below SMA 200', kind: 'sma', idea: 'Trend', side: 'sell', build: () => newCondition('lt', CLOSE, { kind: 'sma', period: 200 }) },
  { label: 'EMA 20 crosses below SMA 50', kind: 'ema', idea: 'Trend', side: 'sell', build: () => newCondition('crosses_below', { kind: 'ema', period: 20 }, { kind: 'sma', period: 50 }) },
  { label: 'RSI is above 70', kind: 'rsi', idea: 'Dips and peaks', side: 'sell', build: () => newCondition('gt', { kind: 'rsi', period: 14 }, { kind: 'constant', value: 70 }) },
  { label: 'Close is above the upper band', kind: 'bollinger', idea: 'Dips and peaks', side: 'sell', build: () => newCondition('gt', CLOSE, { kind: 'bollinger', period: 20, std_dev: 2, band: 'upper' }) },
  { label: 'Price rose 10% in 7 candles', kind: 'change', idea: 'Dips and peaks', side: 'sell', build: () => newCondition('gt', CHANGE_7, { kind: 'constant', value: 10 }) },
  { label: 'Stochastic is above 80', kind: 'stochastic', idea: 'Dips and peaks', side: 'sell', build: () => newCondition('gt', STOCHASTIC, { kind: 'constant', value: 80 }) },
  { label: 'MACD crosses below its signal', kind: 'macd', idea: 'Momentum', side: 'sell', build: () => newCondition('crosses_below', MACD, MACD_SIGNAL) },
  { label: 'Close breaks below the 10-candle low', kind: 'lowest', idea: 'Breakouts', side: 'sell', build: () => newCondition('crosses_below', CLOSE, LOWEST_10) },
]

/** Ready conditions under their idea, ideas in the order of IDEAS, empty ideas left out. */
export function byIdea(conditions: ReadyCondition[]): { idea: Idea, conditions: ReadyCondition[] }[] {
  return IDEAS
    .map(idea => ({ idea, conditions: conditions.filter(condition => condition.idea === idea) }))
    .filter(section => section.conditions.length > 0)
}
