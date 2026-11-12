import { describe, expect, it } from 'vitest'
import type { StrategyDraft } from '~/types/api'
import { InvalidStrategyError, parseStrategy, serializeStrategy, shareHash, strategyFromHash } from '~/utils/strategyFiles'

const rsiBelow30 = { kind: 'compare', operator: 'lt', left: { kind: 'rsi', period: 14 }, right: { kind: 'constant', value: 30 } } as const
const closeAboveSma200 = { kind: 'compare', operator: 'gt', left: { kind: 'price', field: 'close' }, right: { kind: 'sma', period: 200 } } as const

const strategy: StrategyDraft = {
  schema_version: 2,
  instrument: 'ETHUSDT',
  extra_instruments: ['BTCUSDT', 'SOLUSDT'],
  timeframe: '4h',
  sides: [
    { direction: 'long', entry: { kind: 'and', conditions: [rsiBelow30, closeAboveSma200] }, exit: { rule: null, stop_loss_pct: 3, take_profit_pct: 9, trailing_stop_pct: null } },
    { direction: 'short', entry: { ...closeAboveSma200, operator: 'lt' }, exit: { rule: null, stop_loss_pct: 4, take_profit_pct: null, trailing_stop_pct: 8 } },
  ],
  position_size_pct: 50,
  execution: { commission_pct: 0.1, slippage_bps: 5 },
}

// The same long side as saved by the first version of the builder.
const version1 = {
  schema_version: 1,
  instrument: 'ETHUSDT',
  timeframe: '4h',
  entry: { direction: 'long', condition: { kind: 'and', conditions: [rsiBelow30, closeAboveSma200] } },
  exit: { rule: null, stop_loss_pct: 3, take_profit_pct: 9 },
  position_size_pct: 50,
  execution: { commission_pct: 0.1, slippage_bps: 5 },
}

describe('JSON files', () => {
  it('exported strategy imports back unchanged', () => {
    expect(parseStrategy(serializeStrategy(strategy))).toEqual(strategy)
  })

  it('opens a version 1 file as a strategy with one side and one market', () => {
    expect(parseStrategy(JSON.stringify(version1))).toEqual({ ...strategy, extra_instruments: [], sides: [strategy.sides[0]] })
  })

  it('opens a file saved before extra markets as one market', () => {
    const { extra_instruments: _extra, ...older } = strategy
    expect(parseStrategy(JSON.stringify(older))).toEqual({ ...strategy, extra_instruments: [] })
  })

  it.each([
    ['not JSON', 'hello'],
    ['not a strategy', '{"name": "my cat"}'],
    ['wrong version', JSON.stringify({ ...strategy, schema_version: 3 })],
    ['unknown block', JSON.stringify({ ...strategy, sides: [{ direction: 'long', entry: { kind: 'ichimoku' }, exit: null }] })],
    ['unknown timeframe', JSON.stringify({ ...strategy, timeframe: '7m' })],
    ['extra markets that are not a list of names', JSON.stringify({ ...strategy, extra_instruments: 'BTCUSDT' })],
  ])('rejects %s', (_, text) => {
    expect(() => parseStrategy(text)).toThrow(InvalidStrategyError)
  })
})

describe('share links', () => {
  it('strategy → link → strategy round-trips unchanged', () => {
    expect(strategyFromHash(shareHash(strategy))).toEqual(strategy)
  })

  it('opens a link made by the first version as one side', () => {
    expect(strategyFromHash(shareHash(version1 as unknown as StrategyDraft))).toEqual({ ...strategy, extra_instruments: [], sides: [strategy.sides[0]] })
  })

  it('ignores hashes that are not share links', () => {
    expect(strategyFromHash('')).toBeNull()
    expect(strategyFromHash('#about')).toBeNull()
  })

  it('rejects a broken link', () => {
    expect(() => strategyFromHash('#s=%%%garbage')).toThrow(InvalidStrategyError)
  })
})
