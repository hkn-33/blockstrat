// Trades the user draws on a chart as boxes, the way TradingView's long and short position tools do: an
// entry at any price on a candle, a take-profit on the winning side of it, a stop-loss on the other, and a
// width in candles. Each box is replayed on the candles after it, so it says how it would have ended, and
// the boxes of one direction become the marks the strategy search looks for.
import type { BacktestResult, Proposal, StrategyDraft } from '~/types/api'
import type { Direction, Timeframe } from './strategyDocument'

export interface CandleLike {
  time: number
  open: number
  high: number
  low: number
  close: number
}

export interface DrawnTrade {
  id: number
  direction: Direction
  /** The candle the trade is entered on. */
  entryIndex: number
  /** The price clicked, anywhere on or beside that candle. */
  entryPrice: number
  /** The last candle the trade may stay open: the box's right edge. */
  endIndex: number
  stopLossPct: number
  takeProfitPct: number
}

export interface TradeOutcome {
  exitIndex: number
  reason: 'target' | 'stop' | 'time'
  returnPct: number
}

/** Usual first levels per candle size: wide enough not to be hit by one ordinary candle. */
const STARTING_LEVELS: Record<Timeframe, { stopLossPct: number, takeProfitPct: number }> = {
  '1h': { stopLossPct: 1.5, takeProfitPct: 3 },
  '4h': { stopLossPct: 3, takeProfitPct: 6 },
  '1d': { stopLossPct: 5, takeProfitPct: 10 },
}
const STARTING_WIDTH = 24
const SMALLEST_TARGET_PCT = 0.2

export function newDrawnTrade(id: number, direction: Direction, entryIndex: number, entryPrice: number, candleCount: number, timeframe: Timeframe): DrawnTrade {
  return { id, direction, entryIndex, entryPrice, endIndex: Math.min(entryIndex + STARTING_WIDTH, candleCount - 1), ...STARTING_LEVELS[timeframe] }
}

export function tradeLevels(trade: DrawnTrade): { entry: number, stop: number, target: number } {
  const side = trade.direction === 'long' ? 1 : -1
  return {
    entry: trade.entryPrice,
    stop: trade.entryPrice * (1 - side * trade.stopLossPct / 100),
    target: trade.entryPrice * (1 + side * trade.takeProfitPct / 100),
  }
}

/** The second click sizes the box: it reaches the pointer's candle, its take-profit is as far from the entry
 * as the pointer, and its stop-loss that divided by the reward to risk chosen, 2 to 1 unless set otherwise. */
export function sizeFromPointer(trade: DrawnTrade, pointerIndex: number, pointerPrice: number, rewardToRisk = 2): Pick<DrawnTrade, 'endIndex' | 'takeProfitPct' | 'stopLossPct'> {
  const distancePct = Math.max(Math.abs(pointerPrice / trade.entryPrice - 1) * 100, SMALLEST_TARGET_PCT)
  const takeProfitPct = round(distancePct)
  return { endIndex: Math.max(pointerIndex, trade.entryIndex + 1), takeProfitPct, stopLossPct: round(takeProfitPct / rewardToRisk) }
}

/** How the box would have ended. A candle that reaches both levels counts as stopped: inside one candle the
 * order of its high and low is unknown, and assuming the worse keeps the drawing honest. */
export function tradeOutcome(bars: CandleLike[], trade: DrawnTrade): TradeOutcome {
  const { stop, target } = tradeLevels(trade)
  const isLong = trade.direction === 'long'
  for (let index = trade.entryIndex + 1; index <= trade.endIndex; index++) {
    const bar = bars[index]!
    const isStopped = isLong ? bar.low <= stop : bar.high >= stop
    const isTargetReached = isLong ? bar.high >= target : bar.low <= target
    if (isStopped) return { exitIndex: index, reason: 'stop', returnPct: -trade.stopLossPct }
    if (isTargetReached) return { exitIndex: index, reason: 'target', returnPct: trade.takeProfitPct }
  }
  const change = bars[trade.endIndex]!.close / trade.entryPrice - 1
  return { exitIndex: trade.endIndex, reason: 'time', returnPct: round((isLong ? change : -change) * 100) }
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function median(values: number[]): number {
  const sorted = [...values].sort((first, second) => first - second)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

/** What the strategy search is sent for one direction: a mark where each box of that direction starts and
 * one where it ended (a buy then a sell for a long, a sell then a buy for a short), and the stop-loss and
 * take-profit those boxes typically use, so the proposals keep them. */
export function tradesToRequest(bars: CandleLike[], trades: DrawnTrade[], direction: Direction) {
  const own = trades.filter(trade => trade.direction === direction).sort((first, second) => first.entryIndex - second.entryIndex)
  const [opening, closing] = direction === 'long' ? (['buy', 'sell'] as const) : (['sell', 'buy'] as const)
  const marks = own.flatMap(trade => [
    { time: bars[trade.entryIndex]!.time, side: opening },
    { time: bars[tradeOutcome(bars, trade).exitIndex]!.time, side: closing },
  ])
  return {
    direction,
    marks,
    stop_loss_pct: round(median(own.map(trade => trade.stopLossPct))),
    take_profit_pct: round(median(own.map(trade => trade.takeProfitPct))),
  }
}

/** A drawn trade as it is kept between visits: by candle times, since the chart's first candle moves on as
 * new ones arrive and every index with it. */
export interface SavedTrade {
  direction: Direction
  entryTime: number
  entryPrice: number
  endTime: number
  stopLossPct: number
  takeProfitPct: number
}

export function savedTrades(bars: CandleLike[], trades: DrawnTrade[]): SavedTrade[] {
  return trades.map(({ direction, entryIndex, entryPrice, endIndex, stopLossPct, takeProfitPct }) => ({
    direction,
    entryTime: bars[entryIndex]!.time,
    entryPrice,
    endTime: bars[endIndex]!.time,
    stopLossPct,
    takeProfitPct,
  }))
}

/** The saved trades whose entry candle is still on the chart, numbered from 1. */
export function restoredTrades(bars: CandleLike[], saved: SavedTrade[]): DrawnTrade[] {
  const indexByTime = new Map(bars.map((bar, index) => [bar.time, index]))
  const lastIndex = bars.length - 1
  const restored: DrawnTrade[] = []
  for (const { direction, entryTime, entryPrice, endTime, stopLossPct, takeProfitPct } of saved) {
    const entryIndex = indexByTime.get(entryTime)
    if (entryIndex === undefined || entryIndex >= lastIndex) continue
    const endIndex = Math.max(indexByTime.get(endTime) ?? lastIndex, entryIndex + 1)
    restored.push({ id: restored.length + 1, direction, entryIndex, entryPrice, endIndex, stopLossPct, takeProfitPct })
  }
  return restored
}

/** A long proposal's side and a short proposal's side as one strategy. */
export function bothWays(long: Proposal, short: Proposal): StrategyDraft {
  return { ...long.strategy, sides: [long.strategy.sides[0]!, short.strategy.sides[0]!] }
}

/** One strategy that trades both ways, fitted to the marks of both, with the result the two made together,
 * which is not the sum of their own: it holds one position at a time. */
export function combinedProposal(long: Proposal, short: Proposal, result: BacktestResult, chartTimes: Set<number>): Proposal {
  return {
    name: `${long.name} / ${short.name}`,
    strategy: bothWays(long, short),
    exit_note: `Long: ${long.exit_note}. Short: ${short.exit_note}`,
    entries_hit: long.entries_hit + short.entries_hit,
    entries_marked: long.entries_marked + short.entries_marked,
    extra_entries: long.extra_entries + short.extra_entries,
    exits_hit: long.exits_hit + short.exits_hit,
    exits_marked: long.exits_marked + short.exits_marked,
    extra_exits: long.extra_exits + short.extra_exits,
    entry_times: result.trades.map(trade => trade.entry_time).filter(time => chartTimes.has(time)),
    exit_times: result.trades.map(trade => trade.exit_time).filter(time => chartTimes.has(time)),
    total_return_pct: result.metrics.total_return_pct,
    max_drawdown_pct: result.metrics.max_drawdown_pct,
    trade_count: result.metrics.trade_count,
  }
}
