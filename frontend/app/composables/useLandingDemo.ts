import demo from '~/data/landing-demo.json'

// Real full-history backtests, precomputed by backend/scripts/landing_demo.py so the prerendered
// landing page works without the API.

export type DemoRule = 'rsi25' | 'rsi30' | 'rsi35' | 'trend'
export type DemoMarket = 'BTCUSDT' | 'ETHUSDT' | 'SOLUSDT'
export type DemoStopLoss = 5 | 10

export interface DemoTrade {
  entry_time: number
  exit_time: number
  return_pct: number
}

export interface DemoRun {
  start_time: number
  end_time: number
  bar_count: number
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
  equity: number[]
  buy_and_hold: number[]
  recent_trades: DemoTrade[]
}

export const DEMO_STARTING_CASH = 10_000
export const DEMO_RSI_EXIT_LEVEL = demo.rsi_exit_level

export const DEMO_MARKETS: { value: DemoMarket, label: string }[] = [
  { value: 'BTCUSDT', label: 'BTC/USDT' },
  { value: 'ETHUSDT', label: 'ETH/USDT' },
  { value: 'SOLUSDT', label: 'SOL/USDT' },
]

export const DEMO_STOP_LOSSES: DemoStopLoss[] = [5, 10]

const RUNS: Record<string, DemoRun> = demo.runs

export function demoRun(rule: DemoRule, market: DemoMarket, stopLoss: DemoStopLoss): DemoRun {
  const run = RUNS[`${rule}:${market}:${stopLoss}`]
  if (!run) throw new Error(`No precomputed demo run for ${rule}:${market}:${stopLoss}`)
  return run
}
