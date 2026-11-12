// The numbers a strategy tester shows, and how they are worded, shared by the landing demo and the builder.
import type { BacktestResult } from '~/types/api'

/** Every backtest starts with this much, in the backend and in the landing demo. */
export const STARTING_CASH = 10_000

export interface ResultSummary {
  total_return_pct: number
  buy_and_hold_return_pct: number
  max_drawdown_pct: number
  trade_count: number
  win_rate_pct: number
  best_trade_pct: number | null
  worst_trade_pct: number | null
  fees_paid: number
}

export function formatSignedPercent(value: number, digits = 1): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${Math.abs(value).toFixed(digits)}%`
}

export function formatDollars(value: number): string {
  const sign = value < 0 ? '−' : ''
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString('en-US')}`
}

/** The account balance after a return on the starting cash, e.g. 25.4 -> 12,540. */
export function balanceAfter(returnPct: number): number {
  return STARTING_CASH * (1 + returnPct / 100)
}

/** The gap to simply holding the coin, in dollars on the starting cash, in words a non-trader reads:
 * "$6,820 more than holding SOL" or "$790 less than holding BTC". */
export function holdingGap(summary: Pick<ResultSummary, 'total_return_pct' | 'buy_and_hold_return_pct'>, coin: string): { dollars: string, words: string, isAhead: boolean } {
  const gap = balanceAfter(summary.total_return_pct) - balanceAfter(summary.buy_and_hold_return_pct)
  const isAhead = gap >= 0
  return { dollars: formatDollars(Math.abs(gap)), words: `${isAhead ? 'more' : 'less'} than holding ${coin}`, isAhead }
}

export interface MarketOutcome {
  /** The total return, null when the market could not be calculated. */
  returnPct: number | null
  isPending: boolean
}

function marketCount(count: number): string {
  return `${count} ${count === 1 ? 'market' : 'markets'}`
}

/** How the same rules did across several markets, in one sentence a non-trader reads:
 * "Profitable on 3 of 4 markets, +12.4% on average". No number until every market is in. */
export function marketsVerdict(outcomes: MarketOutcome[]): string {
  const pendingCount = outcomes.filter(outcome => outcome.isPending).length
  if (pendingCount) return `Still calculating ${pendingCount} of ${marketCount(outcomes.length)}`
  const returns = outcomes.flatMap(outcome => (outcome.returnPct === null ? [] : [outcome.returnPct]))
  if (!returns.length) return `None of the ${marketCount(outcomes.length)} could be calculated`
  const profitableCount = returns.filter(value => value > 0).length
  const average = returns.reduce((total, value) => total + value, 0) / returns.length
  let lead = `Profitable on ${profitableCount} of ${marketCount(returns.length)}`
  if (profitableCount === returns.length && returns.length > 1) lead = `Profitable on all ${marketCount(returns.length)}`
  if (profitableCount === 0) lead = `Not profitable on any of the ${marketCount(returns.length)}`
  const verdict = `${lead}, ${formatSignedPercent(average)} on average`
  const failedCount = outcomes.length - returns.length
  return failedCount ? `${verdict}. ${marketCount(failedCount)} could not be calculated` : verdict
}

/** A live backtest's summary; fees are the commission on both fills of every trade. */
export function summaryFromResult(result: BacktestResult, commissionPct: number): ResultSummary {
  const returns = result.trades.map(trade => trade.return_pct)
  const winners = returns.filter(value => value > 0).length
  const commission = commissionPct / 100
  return {
    total_return_pct: result.metrics.total_return_pct,
    buy_and_hold_return_pct: result.metrics.buy_and_hold_return_pct,
    max_drawdown_pct: -Math.abs(result.metrics.max_drawdown_pct),
    trade_count: result.metrics.trade_count,
    win_rate_pct: returns.length ? (winners / returns.length) * 100 : 0,
    best_trade_pct: returns.length ? Math.max(...returns) : null,
    worst_trade_pct: returns.length ? Math.min(...returns) : null,
    fees_paid: result.trades.reduce((total, trade) => total + commission * trade.size * (trade.entry_price + trade.exit_price), 0),
  }
}
