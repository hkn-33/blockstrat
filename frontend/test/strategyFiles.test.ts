import { describe, expect, it } from 'vitest'
import type { StrategyDraft } from '~/types/api'
import { InvalidStrategyError, parseStrategy, serializeStrategy, shareHash, strategyFromHash } from '~/utils/strategyFiles'

const strategy: StrategyDraft = {
  schema_version: 1,
  instrument: 'ETHUSDT',
  timeframe: '4h',
  entry: {
    direction: 'long',
    condition: {
      kind: 'and',
      conditions: [
        { kind: 'compare', operator: 'lt', left: { kind: 'rsi', period: 14 }, right: { kind: 'constant', value: 30 } },
        { kind: 'compare', operator: 'gt', left: { kind: 'price', field: 'close' }, right: { kind: 'sma', period: 200 } },
      ],
    },
  },
  exit: { rule: null, stop_loss_pct: 3, take_profit_pct: 9 },
  position_size_pct: 50,
  execution: { commission_pct: 0.1, slippage_bps: 5 },
}

describe('JSON files', () => {
  it('exported strategy imports back unchanged', () => {
    expect(parseStrategy(serializeStrategy(strategy))).toEqual(strategy)
  })

  it.each([
    ['not JSON', 'hello'],
    ['not a strategy', '{"name": "my cat"}'],
    ['wrong version', JSON.stringify({ ...strategy, schema_version: 2 })],
    ['unknown block', JSON.stringify({ ...strategy, entry: { direction: 'long', condition: { kind: 'ichimoku' } } })],
    ['unknown timeframe', JSON.stringify({ ...strategy, timeframe: '7m' })],
  ])('rejects %s', (_, text) => {
    expect(() => parseStrategy(text)).toThrow(InvalidStrategyError)
  })
})

describe('share links', () => {
  it('strategy → link → strategy round-trips unchanged', () => {
    expect(strategyFromHash(shareHash(strategy))).toEqual(strategy)
  })

  it('ignores hashes that are not share links', () => {
    expect(strategyFromHash('')).toBeNull()
    expect(strategyFromHash('#about')).toBeNull()
  })

  it('rejects a broken link', () => {
    expect(() => strategyFromHash('#s=%%%garbage')).toThrow(InvalidStrategyError)
  })
})
