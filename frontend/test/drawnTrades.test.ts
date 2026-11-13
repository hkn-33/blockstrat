import { describe, expect, it } from 'vitest'
import type { BacktestResult, Proposal } from '~/types/api'
import { combinedProposal, newDrawnTrade, restoredTrades, savedTrades, sizeFromPointer, tradeLevels, tradeOutcome, tradesToRequest, type CandleLike, type DrawnTrade } from '~/utils/drawnTrades'

function candle(index: number, low: number, high: number, close: number): CandleLike {
  return { time: 1_700_000_000 + index * 3600, open: close, high, low, close }
}

// Flat at 100 for ten candles, so every test chooses where the price goes.
function flat(count = 10): CandleLike[] {
  return Array.from({ length: count }, (_, index) => candle(index, 99.5, 100.5, 100))
}

function trade(overrides: Partial<DrawnTrade> = {}): DrawnTrade {
  return { id: 1, direction: 'long', entryIndex: 2, entryPrice: 100, endIndex: 8, stopLossPct: 5, takeProfitPct: 10, ...overrides }
}

describe('a trade drawn on the chart', () => {
  it('puts a long take-profit above the entry and its stop-loss below', () => {
    const levels = tradeLevels(trade())

    expect(levels.stop).toBeCloseTo(95)
    expect(levels.target).toBeCloseTo(110)
  })

  it('puts a short take-profit below the entry and its stop-loss above', () => {
    const levels = tradeLevels(trade({ direction: 'short' }))

    expect(levels.stop).toBeCloseTo(105)
    expect(levels.target).toBeCloseTo(90)
  })

  it('enters at the price that was clicked, not at the candle close', () => {
    expect(tradeLevels(trade({ entryPrice: 102 })).target).toBeCloseTo(112.2)
  })

  it('ends a long at the take-profit on the first candle that reaches it', () => {
    const bars = flat()
    bars[5] = candle(5, 101, 111, 109)

    expect(tradeOutcome(bars, trade())).toEqual({ exitIndex: 5, reason: 'target', returnPct: 10 })
  })

  it('ends a short at the take-profit when the price falls to it', () => {
    const bars = flat()
    bars[6] = candle(6, 89, 99, 90)

    expect(tradeOutcome(bars, trade({ direction: 'short' }))).toEqual({ exitIndex: 6, reason: 'target', returnPct: 10 })
  })

  it('stops a short out when the price rises to its stop-loss', () => {
    const bars = flat()
    bars[4] = candle(4, 100, 106, 105)

    expect(tradeOutcome(bars, trade({ direction: 'short' }))).toEqual({ exitIndex: 4, reason: 'stop', returnPct: -5 })
  })

  it('counts a candle that reaches both as stopped, the cautious reading', () => {
    const bars = flat()
    bars[3] = candle(3, 94, 111, 100)

    expect(tradeOutcome(bars, trade()).reason).toBe('stop')
  })

  it('closes at the end of the box when neither level is reached, gaining for a short when the price fell', () => {
    const bars = flat()
    bars[8] = candle(8, 97, 99, 98)

    expect(tradeOutcome(bars, trade({ direction: 'short' }))).toEqual({ exitIndex: 8, reason: 'time', returnPct: 2 })
  })

  it('starts with levels that suit the candle size and a box that fits the chart', () => {
    expect(newDrawnTrade(1, 'long', 40, 100, 100, '1h')).toMatchObject({ entryIndex: 40, entryPrice: 100, endIndex: 64, stopLossPct: 1.5, takeProfitPct: 3 })
    expect(newDrawnTrade(2, 'short', 90, 50, 100, '1d')).toMatchObject({ direction: 'short', endIndex: 99, stopLossPct: 5, takeProfitPct: 10 })
  })

  it('takes its size from the second click: the take-profit as far as the pointer, the stop-loss half that', () => {
    expect(sizeFromPointer(trade(), 7, 106)).toEqual({ endIndex: 7, takeProfitPct: 6, stopLossPct: 3 })
    expect(sizeFromPointer(trade({ direction: 'short' }), 6, 92)).toEqual({ endIndex: 6, takeProfitPct: 8, stopLossPct: 4 })
  })

  it('keeps a box at least one candle wide and its levels apart from the entry', () => {
    expect(sizeFromPointer(trade(), 1, 100)).toEqual({ endIndex: 3, takeProfitPct: 0.2, stopLossPct: 0.1 })
  })

  it('sets the stop-loss from the reward to risk the user prefers', () => {
    expect(sizeFromPointer(trade(), 7, 106, 3)).toMatchObject({ takeProfitPct: 6, stopLossPct: 2 })
    expect(sizeFromPointer(trade(), 7, 106, 1)).toMatchObject({ takeProfitPct: 6, stopLossPct: 6 })
  })

  it('becomes a long search: a buy at each entry, a sell where it ended, with the typical stop and target', () => {
    const bars = flat()
    bars[5] = candle(5, 101, 111, 109)
    const trades = [
      trade({ id: 1, entryIndex: 1, endIndex: 3, stopLossPct: 4, takeProfitPct: 8 }),
      trade({ id: 2, entryIndex: 4, endIndex: 9, stopLossPct: 6, takeProfitPct: 10 }),
    ]

    expect(tradesToRequest(bars, trades, 'long')).toEqual({
      direction: 'long',
      marks: [
        { time: bars[1]!.time, side: 'buy' },
        { time: bars[3]!.time, side: 'sell' },
        { time: bars[4]!.time, side: 'buy' },
        { time: bars[5]!.time, side: 'sell' },
      ],
      stop_loss_pct: 5,
      take_profit_pct: 9,
    })
  })

  it('becomes a short search from the short trades only: a sell at each entry and a buy where it ended', () => {
    const bars = flat()
    const trades = [
      trade({ id: 1, direction: 'short', entryIndex: 1, endIndex: 3 }),
      trade({ id: 2, direction: 'long', entryIndex: 4, endIndex: 6 }),
    ]

    expect(tradesToRequest(bars, trades, 'short').marks).toEqual([
      { time: bars[1]!.time, side: 'sell' },
      { time: bars[3]!.time, side: 'buy' },
    ])
  })
})

describe('drawn trades kept across visits', () => {
  it('come back on the same candles after newer candles arrive', () => {
    const saved = savedTrades(flat(), [trade({ entryIndex: 2, endIndex: 6 })])
    // Two newer candles: the oldest two dropped off the start, every index moved down by two.
    const later = [...flat(12)].slice(2)

    const [restored] = restoredTrades(later, saved)

    expect(restored).toMatchObject({ direction: 'long', entryIndex: 0, endIndex: 4, entryPrice: 100, stopLossPct: 5, takeProfitPct: 10 })
  })

  it('are dropped once their entry candle is no longer on the chart', () => {
    const saved = savedTrades(flat(), [trade({ entryIndex: 1, endIndex: 6 })])

    expect(restoredTrades(flat(12).slice(2), saved)).toEqual([])
  })

  it('get ids of their own, in order', () => {
    const saved = savedTrades(flat(), [trade({ id: 7 }), trade({ id: 9, direction: 'short' })])

    expect(restoredTrades(flat(), saved).map(({ id }) => id)).toEqual([1, 2])
  })
})

describe('a long and a short proposal put together', () => {
  const side = (direction: 'long' | 'short') => ({ direction, entry: null, exit: null })
  const proposal = (direction: 'long' | 'short', overrides: Partial<Proposal> = {}): Proposal => ({
    name: direction === 'long' ? 'RSI dip' : 'RSI peak',
    strategy: { schema_version: 2, instrument: 'BTCUSDT', extra_instruments: [], timeframe: '4h', sides: [side(direction)], position_size_pct: 100, execution: { commission_pct: 0.1, slippage_bps: 5, leverage: 1 } },
    exit_note: 'Gets out on its rule',
    entries_hit: 2,
    entries_marked: 3,
    extra_entries: 1,
    exits_hit: 1,
    exits_marked: 3,
    extra_exits: 0,
    entry_times: [],
    exit_times: [],
    total_return_pct: 5,
    max_drawdown_pct: -10,
    trade_count: 4,
    ...overrides,
  })
  const trade = (entry: number, exit: number) => ({ direction: 'long' as const, entry_time: entry, entry_price: 1, exit_time: exit, exit_price: 1, size: 1, return_pct: 0, profit: 0 })
  const result = {
    trades: [trade(100, 200), trade(300, 400)],
    metrics: { total_return_pct: 12, max_drawdown_pct: -7, trade_count: 9 },
  } as unknown as BacktestResult

  it('trades both ways with each side as it was proposed', () => {
    const combined = combinedProposal(proposal('long'), proposal('short'), result, new Set([100, 200, 300, 400]))

    expect(combined.strategy.sides.map(({ direction }) => direction)).toEqual(['long', 'short'])
    expect(combined.name).toBe('RSI dip / RSI peak')
  })

  it('fits the marks of both and reports the result of the two together', () => {
    const combined = combinedProposal(proposal('long'), proposal('short', { entries_hit: 3 }), result, new Set([100, 200, 300, 400]))

    expect(combined).toMatchObject({ entries_hit: 5, entries_marked: 6, extra_entries: 2, exits_hit: 2, exits_marked: 6, total_return_pct: 12, max_drawdown_pct: -7, trade_count: 9 })
  })

  it('shows only the trades on the candles of the chart', () => {
    const combined = combinedProposal(proposal('long'), proposal('short'), result, new Set([300, 400]))

    expect(combined.entry_times).toEqual([300])
    expect(combined.exit_times).toEqual([400])
  })
})
