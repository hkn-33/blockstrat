import { describe, expect, it } from 'vitest'
import type { Comparison, SideDraft, StrategyDraft } from '~/types/api'
import { pineScript } from '~/utils/pineScript'

const CLOSE = { kind: 'price', field: 'close' } as const
const MACD = { kind: 'macd', fast: 12, slow: 26, signal: 9, line: 'macd' } as const
const MACD_SIGNAL = { ...MACD, line: 'signal' } as const

function compare(left: Comparison['left'], operator: Comparison['operator'], right: Comparison['right']): Comparison {
  return { kind: 'compare', operator, left, right }
}

function strategy(sides: SideDraft[], overrides: Partial<StrategyDraft> = {}): StrategyDraft {
  return {
    schema_version: 2,
    instrument: 'BTCUSDT',
    extra_instruments: [],
    timeframe: '4h',
    sides: sides as StrategyDraft['sides'],
    position_size_pct: 100,
    execution: { commission_pct: 0.1, slippage_bps: 0, leverage: 1 },
    ...overrides,
  }
}

const rsiDip: SideDraft = {
  direction: 'long',
  entry: compare({ kind: 'rsi', period: 14 }, 'lt', { kind: 'constant', value: 30 }),
  exit: { rule: compare({ kind: 'rsi', period: 14 }, 'gt', { kind: 'constant', value: 70 }), stop_loss_pct: 3, take_profit_pct: 9, trailing_stop_pct: null },
}

describe('a strategy as Pine Script', () => {
  it('is a version 6 strategy with the same money and costs', () => {
    const script = pineScript(strategy([rsiDip], { position_size_pct: 50 }), 'RSI dip')

    expect(script).toContain('//@version=6')
    expect(script).toContain('strategy("RSI dip", overlay = true, initial_capital = 10000')
    expect(script).toContain('default_qty_type = strategy.percent_of_equity, default_qty_value = 50')
    expect(script).toContain('commission_type = strategy.commission.percent, commission_value = 0.1')
  })

  it('computes each indicator once and compares the variables', () => {
    const script = pineScript(strategy([rsiDip]), 'RSI dip')

    expect(script.match(/ta\.rsi\(close, 14\)/g)).toHaveLength(1)
    expect(script).toMatch(/rsi_14 < 30/)
    expect(script).toMatch(/rsi_14 > 70/)
  })

  it('enters only when flat and closes on the candle the exit rule becomes true', () => {
    const script = pineScript(strategy([rsiDip]), 'RSI dip')

    expect(script).toContain('if strategy.position_size == 0 and longEntry')
    expect(script).toContain('strategy.entry("Long", strategy.long)')
    expect(script).toContain('longExit = longExitRule and not longExitRule[1]')
    expect(script).toContain('strategy.close("Long")')
  })

  it('places the stop-loss and take-profit from the fill price', () => {
    const script = pineScript(strategy([rsiDip]), 'RSI dip')

    expect(script).toContain('strategy.position_avg_price * (1 - 3 / 100)')
    expect(script).toContain('strategy.position_avg_price * (1 + 9 / 100)')
    expect(script).toContain('strategy.exit("Long limits", "Long"')
  })

  it('follows the best price for a trailing stop', () => {
    const trailing: SideDraft = { ...rsiDip, exit: { rule: null, stop_loss_pct: null, take_profit_pct: null, trailing_stop_pct: 6 } }

    const script = pineScript(strategy([trailing]), 'Trail')

    expect(script).toContain('longBest := strategy.position_size[1] <= 0 ? high : math.max(longBest, high)')
    expect(script).toContain('longBest * (1 - 6 / 100)')
  })

  it('reads the previous candles for a highest high, as the backtest does', () => {
    const breakout: SideDraft = { ...rsiDip, entry: compare(CLOSE, 'crosses_above', { kind: 'highest', period: 20 }) }

    const script = pineScript(strategy([breakout]), 'Breakout')

    expect(script).toContain('highest_20 = ta.highest(high, 20)[1]')
    expect(script).toContain('ta.crossover(close, highest_20)')
  })

  it('declares MACD once for both of its lines', () => {
    const momentum: SideDraft = { ...rsiDip, entry: compare(MACD, 'crosses_above', MACD_SIGNAL) }

    const script = pineScript(strategy([momentum]), 'Momentum')

    expect(script.match(/ta\.macd\(close, 12, 26, 9\)/g)).toHaveLength(1)
    expect(script).toContain('ta.crossover(macd_12_26_9, macdSignal_12_26_9)')
  })

  it('writes groups, "not" and weighted scores', () => {
    const grouped: SideDraft = {
      ...rsiDip,
      entry: {
        kind: 'and',
        conditions: [
          { kind: 'not', condition: compare(CLOSE, 'lt', { kind: 'sma', period: 200 }) },
          { kind: 'score', threshold: 2, parts: [
            { weight: 1, condition: compare({ kind: 'rsi', period: 14 }, 'lt', { kind: 'constant', value: 30 }) },
            { weight: 1.5, condition: compare({ kind: 'relative_volume', period: 20 }, 'gt', { kind: 'constant', value: 1.5 }) },
          ] },
        ],
      },
    }

    const script = pineScript(strategy([grouped]), 'Grouped')

    expect(script).toContain('not (close < sma_200)')
    expect(script).toContain('((rsi_14 < 30 ? 1 : 0) + (relativeVolume_20 > 1.5 ? 1.5 : 0)) >= 2')
    expect(script).toContain('relativeVolume_20 = volume / ta.sma(volume, 20)')
  })

  it('trades both ways, neither when both want in on the same candle', () => {
    const short: SideDraft = { direction: 'short', entry: compare({ kind: 'rsi', period: 14 }, 'gt', { kind: 'constant', value: 70 }), exit: { rule: null, stop_loss_pct: 4, take_profit_pct: null, trailing_stop_pct: null } }

    const script = pineScript(strategy([rsiDip, short]), 'Both')

    expect(script).toContain('if strategy.position_size == 0 and longEntry and not shortEntry')
    expect(script).toContain('if strategy.position_size == 0 and shortEntry and not longEntry')
    expect(script).toContain('strategy.entry("Short", strategy.short)')
    expect(script).toContain('strategy.position_avg_price * (1 + 4 / 100)')
  })

  it('carries leverage as a margin and a larger position', () => {
    const script = pineScript(strategy([rsiDip], { execution: { commission_pct: 0.1, slippage_bps: 0, leverage: 4 } }), 'Levered')

    expect(script).toContain('default_qty_value = 400')
    expect(script).toContain('margin_long = 25, margin_short = 25')
  })

  it('leaves out a side that is not finished', () => {
    const unfinished: SideDraft = { direction: 'short', entry: null, exit: null }

    expect(pineScript(strategy([rsiDip, unfinished]), 'Half')).not.toContain('Short')
  })
})
