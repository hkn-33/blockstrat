import { describe, expect, it } from 'vitest'
import type { Comparison, StrategyDraft } from '~/types/api'
import { strategyIndicatorLines, type ChartCandle } from '~/utils/chartData'

const CLOSE = { kind: 'price', field: 'close' } as const

function compare(left: Comparison['left'], right: Comparison['right']): Comparison {
  return { kind: 'compare', operator: 'gt', left, right }
}

function strategy(entry: StrategyDraft['sides'][0]['entry'], rule: Comparison | null = null): StrategyDraft {
  return {
    schema_version: 2,
    instrument: 'BTCUSDT',
    extra_instruments: [],
    timeframe: '1d',
    sides: [{ direction: 'long', entry, exit: { rule, stop_loss_pct: 5, take_profit_pct: null, trailing_stop_pct: null } }],
    position_size_pct: 100,
    execution: { commission_pct: 0.1, slippage_bps: 5, leverage: 1 },
  }
}

const candles: ChartCandle[] = [1, 2, 3, 4, 5, 6].map(close => ({ time: close * 86_400, open: close, high: close + 1, low: close - 1, close }))

describe('the indicators a strategy uses, as lines on its chart', () => {
  it('draws an average over the candles, from the first candle it has a value for', () => {
    const [line] = strategyIndicatorLines(strategy(compare(CLOSE, { kind: 'sma', period: 3 })), candles)

    expect(line).toMatchObject({ label: 'SMA 3', pane: 'price' })
    expect(line!.points).toEqual([
      { time: 3 * 86_400, value: 2 },
      { time: 4 * 86_400, value: 3 },
      { time: 5 * 86_400, value: 4 },
      { time: 6 * 86_400, value: 5 },
    ])
  })

  it('draws each indicator once, wherever the rules use it, and leaves prices and numbers out', () => {
    const sma = { kind: 'sma', period: 3 } as const
    const lines = strategyIndicatorLines(strategy(compare(CLOSE, sma), compare(sma, { kind: 'constant', value: 4 })), candles)

    expect(lines.map(({ label }) => label)).toEqual(['SMA 3'])
  })

  it('puts an oscillator under the candles, in a pane of its own kind', () => {
    const lines = strategyIndicatorLines(strategy(compare({ kind: 'rsi', period: 2 }, { kind: 'constant', value: 30 })), candles)

    expect(lines).toMatchObject([{ label: 'RSI 2', pane: 'range' }])
  })
})
