import demo from '~/data/landing-demo.json'
import type { ChartData } from '~/utils/chartData'
import type { ResultSummary } from '~/utils/resultSummary'

// Real backtests on the builder's preview window (the latest 3000 four-hour candles), precomputed by
// backend/scripts/landing_demo.py so the prerendered landing page works without the API.

export type DemoStrategy = 'dip' | 'trend' | 'combo'
export type DemoMarket = 'BTCUSDT' | 'ETHUSDT' | 'SOLUSDT' | 'LINKUSDT' | 'ADAUSDT'
export type DemoStopLoss = 5 | 10

/** One day: time (UNIX seconds), open, high, low, close, volume. */
export type DemoCandle = [number, number, number, number, number, number]

export interface DemoTrade {
  entry_time: number
  entry_price: number
  exit_time: number
  exit_price: number
  return_pct: number
}

export interface DemoRun {
  metrics: {
    total_return_pct: number
    buy_and_hold_return_pct: number
    max_drawdown_pct: number
    sharpe_ratio: number | null
    win_rate_pct: number | null
    trade_count: number
    exposure_time_pct: number
  }
  fees_paid: number
  /** The balance at each candle's close, one per entry of the market's candles. */
  equity: number[]
  trades: DemoTrade[]
}

export interface RuleCondition {
  subject: string
  operator: string
  value: string
  kind?: 'indicator' | 'risk'
}

export interface RuleGroup {
  match: 'all' | 'any'
  conditions: RuleCondition[]
}

export const DEMO_STARTING_CASH = STARTING_CASH
export const DEMO_TAKE_PROFIT_PCT = demo.take_profit_pct

export const DEMO_MARKETS: { value: DemoMarket, label: string, icon: string, name: string }[] = [
  { value: 'BTCUSDT', label: 'BTC/USDT', icon: 'bitcoin', name: 'Bitcoin' },
  { value: 'ETHUSDT', label: 'ETH/USDT', icon: 'ethereum', name: 'Ethereum' },
  { value: 'SOLUSDT', label: 'SOL/USDT', icon: 'solana', name: 'Solana' },
]

/** The coins the "same rules, different coins" section compares, at the 5% stop only. */
export const COMPARISON_MARKETS: { value: DemoMarket, label: string, icon: string, name: string }[] = [
  DEMO_MARKETS[2]!,
  { value: 'LINKUSDT', label: 'LINK/USDT', icon: 'chainlink', name: 'Chainlink' },
  { value: 'ADAUSDT', label: 'ADA/USDT', icon: 'cardano', name: 'Cardano' },
]

export const DEMO_STOP_LOSSES: DemoStopLoss[] = [5, 10]

/** What each demo strategy is called on its builder card. */
export const DEMO_STRATEGY_NAMES: Record<DemoStrategy, string> = {
  combo: 'Trend with an RSI filter',
  trend: 'Trend',
  dip: 'Buy the dip',
}

const RUNS = demo.runs as unknown as Record<string, DemoRun>
const MARKETS = demo.markets as unknown as Record<DemoMarket, { candles: DemoCandle[] }>

export function demoRun(strategy: DemoStrategy, market: DemoMarket, stopLoss: DemoStopLoss): DemoRun {
  const run = RUNS[`${strategy}:${market}:${stopLoss}`]
  if (!run) throw new Error(`No precomputed demo run for ${strategy}:${market}:${stopLoss}`)
  return run
}

export function demoCandles(market: DemoMarket): DemoCandle[] {
  return MARKETS[market].candles
}

export function demoMarket(market: DemoMarket): { value: DemoMarket, label: string, icon: string, name: string } {
  return [...DEMO_MARKETS, ...COMPARISON_MARKETS].find(option => option.value === market)!
}

/** The entry and exit groups of each demo strategy, as the builder would show them. */
export function demoRules(strategy: DemoStrategy, stopLoss: DemoStopLoss): { entry: RuleGroup, exit: RuleGroup } {
  const stop: RuleCondition = { subject: 'Stop-loss', operator: 'at', value: `−${stopLoss}%`, kind: 'risk' }
  if (strategy === 'dip') {
    return {
      entry: { match: 'all', conditions: [{ subject: 'RSI 14', operator: 'drops below', value: '30' }] },
      exit: { match: 'any', conditions: [{ subject: 'RSI 14', operator: 'rises above', value: '70' }, stop] },
    }
  }
  const crossDown: RuleCondition = { subject: 'EMA 20', operator: 'crosses below', value: 'SMA 50' }
  if (strategy === 'trend') {
    return {
      entry: { match: 'all', conditions: [{ subject: 'EMA 20', operator: 'crosses above', value: 'SMA 50' }] },
      exit: { match: 'any', conditions: [crossDown, stop] },
    }
  }
  return {
    entry: {
      match: 'all',
      conditions: [
        { subject: 'EMA 20', operator: 'crosses above', value: 'SMA 50' },
        { subject: 'RSI 14', operator: 'is below', value: '70' },
      ],
    },
    exit: {
      match: 'any',
      conditions: [crossDown, stop, { subject: 'Take-profit', operator: 'at', value: `+${DEMO_TAKE_PROFIT_PCT}%`, kind: 'risk' }],
    },
  }
}

const key = (name: string) => `<span class="k">"${name}"</span>`
const text = (value: string) => `<span class="s">"${value}"</span>`
const number = (value: number) => `<span class="n">${value}</span>`
const brace = (mark: string) => `<span class="p">${mark}</span>`

function compareLine(indent: string, operator: string, left: string, right: string, trailing: string): string[] {
  return [
    `${indent}${brace('{')} ${key('op')}: ${text(operator)},`,
    `${indent}  ${key('left')}: ${text(left)}, ${key('right')}: ${right} ${brace('}')}${trailing}`,
  ]
}

/** A demo strategy as the short, highlighted JSON the assistant hands to the engine. */
export function strategyJsonLines(strategy: DemoStrategy, market: DemoMarket, stopLoss: DemoStopLoss): string[] {
  const head = [brace('{'), `  ${key('instrument')}: ${text(market)}, ${key('timeframe')}: ${text('4h')},`]
  let entry: string[]
  let exitRule: string[]
  if (strategy === 'dip') {
    entry = [`  ${key('entry')}:`, ...compareLine('    ', 'lt', 'rsi 14', number(30), ',')]
    exitRule = compareLine('      ', 'gt', 'rsi 14', number(70), ',')
  }
  else if (strategy === 'trend') {
    entry = [`  ${key('entry')}:`, ...compareLine('    ', 'crosses_above', 'ema 20', text('sma 50'), ',')]
    exitRule = compareLine('      ', 'crosses_below', 'ema 20', text('sma 50'), ',')
  }
  else {
    entry = [
      `  ${key('entry')}: ${brace('{')} ${key('kind')}: ${text('and')}, ${key('conditions')}: [`,
      ...compareLine('    ', 'crosses_above', 'ema 20', text('sma 50'), ','),
      ...compareLine('    ', 'lt', 'rsi 14', number(70), ''),
      `  ] ${brace('}')},`,
    ]
    exitRule = compareLine('      ', 'crosses_below', 'ema 20', text('sma 50'), ',')
  }
  const exitTail = strategy === 'combo'
    ? [`    ${key('stop_loss_pct')}: ${number(stopLoss)}, ${key('take_profit_pct')}: ${number(DEMO_TAKE_PROFIT_PCT)}`]
    : [`    ${key('stop_loss_pct')}: ${number(stopLoss)}`]
  return [...head, ...entry, `  ${key('exit')}: ${brace('{')}`, `    ${key('rule')}:`, ...exitRule, ...exitTail, `  ${brace('}')}`, brace('}')]
}

/** A demo run's numbers as they stood part of the way through the period, for a chart drawn by the scroll. */
export function runSnapshot(market: DemoMarket, run: DemoRun, fraction = 1): ResultSummary {
  const candles = demoCandles(market)
  const lastIndex = Math.max(1, Math.min(candles.length, Math.ceil(fraction * candles.length))) - 1
  const lastTime = candles[lastIndex]![0]
  const closed = fraction >= 1 ? run.trades : run.trades.filter(trade => trade.exit_time <= lastTime)
  const returns = closed.map(trade => trade.return_pct)
  const winners = returns.filter(value => value > 0).length

  let peak = 0
  let deepest = 0
  for (const balance of run.equity.slice(0, lastIndex + 1)) {
    peak = Math.max(peak, balance)
    deepest = Math.min(deepest, (balance / peak - 1) * 100)
  }

  // The finished period quotes the backtest's own metrics; part way, the numbers come from the daily series.
  const isFinished = fraction >= 1
  return {
    total_return_pct: isFinished ? run.metrics.total_return_pct : (run.equity[lastIndex]! / DEMO_STARTING_CASH - 1) * 100,
    buy_and_hold_return_pct: isFinished ? run.metrics.buy_and_hold_return_pct : (candles[lastIndex]![4] / candles[0]![4] - 1) * 100,
    max_drawdown_pct: isFinished ? -Math.abs(run.metrics.max_drawdown_pct) : deepest,
    trade_count: closed.length,
    win_rate_pct: closed.length ? (winners / closed.length) * 100 : 0,
    best_trade_pct: returns.length ? Math.max(...returns) : null,
    worst_trade_pct: returns.length ? Math.min(...returns) : null,
    fees_paid: run.trades.length ? (run.fees_paid * closed.length) / run.trades.length : 0,
  }
}

/** A demo run in the chart's terms: daily candles with volume, the balance, holding and the trades. */
export function demoChartData(market: DemoMarket, run: DemoRun): ChartData {
  const candles = demoCandles(market)
  const firstClose = candles[0]![4]
  return {
    candles: candles.map(([time, open, high, low, close, volume]) => ({ time, open, high, low, close, volume })),
    equity: candles.map(([time], index) => ({ time, value: run.equity[index] ?? DEMO_STARTING_CASH })),
    holding: candles.map(([time, , , , close]) => ({ time, value: (DEMO_STARTING_CASH * close) / firstClose })),
    trades: run.trades,
  }
}
