import { describe, expect, it } from 'vitest'
import type { StrategyDraft } from '~/types/api'
import { documentFromDraft, documentToDraft } from '~/utils/strategyDocument'
import { replayStart, replaySteps } from '~/utils/strategyReplay'

const RSI_BELOW_30 = { kind: 'compare', operator: 'lt', left: { kind: 'rsi', period: 14 }, right: { kind: 'constant', value: 30 } } as const
const CLOSE_ABOVE_SMA = { kind: 'compare', operator: 'gt', left: { kind: 'price', field: 'close' }, right: { kind: 'sma', period: 200 } } as const
const RSI_ABOVE_70 = { ...RSI_BELOW_30, operator: 'gt', right: { kind: 'constant', value: 70 } } as const

const STRATEGY: StrategyDraft = {
  schema_version: 2,
  instrument: 'BTCUSDT',
  extra_instruments: ['ETHUSDT'],
  timeframe: '1d',
  sides: [{
    direction: 'long',
    entry: { kind: 'and', conditions: [RSI_BELOW_30, CLOSE_ABOVE_SMA] },
    exit: { rule: RSI_ABOVE_70, stop_loss_pct: 5, take_profit_pct: null, trailing_stop_pct: null },
  }],
  position_size_pct: 50,
  execution: { commission_pct: 0.1, slippage_bps: 5 },
}

describe('replaying a strategy', () => {
  it('starts with the settings kept and nothing chosen', () => {
    const start = replayStart(documentFromDraft(STRATEGY))

    expect(start.instruments).toEqual([])
    expect(start.timeframe).toBeNull()
    expect(start.positionSizePct).toBe(50)
    expect(start.sides[0]!.entry.items).toEqual([])
    expect(start.sides[0]!.stopLossPct).toBeNull()
  })

  it('adds the markets, then the conditions, then the limits, one at a time', () => {
    const steps = replaySteps(documentFromDraft(STRATEGY))

    expect(steps.map(step => step.label)).toEqual([
      'BTC/USDT',
      'ETH/USDT',
      'RSI 14 is below 30',
      'Close is above SMA 200',
      'RSI 14 is above 70',
      'Stop-loss at −5%',
    ])
    expect(steps.map(step => step.kind)).toEqual(['market', 'market', 'entry', 'entry', 'exit', 'exit'])
    expect(steps[0]!.source).toBe('market:BTCUSDT')
  })

  it('sets the pace with the first market, as picking one by hand does', () => {
    const [first] = replaySteps(documentFromDraft(STRATEGY))

    expect(first!.document.instruments).toEqual(['BTCUSDT'])
    expect(first!.document.timeframe).toBe('1d')
  })

  it('ends on the strategy it was given', () => {
    const target = documentFromDraft(STRATEGY)

    expect(documentToDraft(replaySteps(target).at(-1)!.document)).toEqual(documentToDraft(target))
  })

  it('words a score and replays a trailing stop', () => {
    const scored: StrategyDraft = {
      ...STRATEGY,
      extra_instruments: [],
      sides: [{
        direction: 'long',
        entry: { kind: 'and', conditions: [RSI_BELOW_30, { kind: 'score', threshold: 2, parts: [{ weight: 1, condition: RSI_BELOW_30 }, { weight: 1, condition: CLOSE_ABOVE_SMA }, { weight: 1, condition: RSI_ABOVE_70 }] }] },
        exit: { rule: null, stop_loss_pct: null, take_profit_pct: null, trailing_stop_pct: 10 },
      }],
    }
    const target = documentFromDraft(scored)
    const steps = replaySteps(target)

    expect(steps.map(step => step.label).slice(1)).toEqual(['RSI 14 is below 30', 'At least 2 of 3 conditions', 'Trailing stop 10% behind'])
    expect(documentToDraft(steps.at(-1)!.document)).toEqual(documentToDraft(target))
    expect(replayStart(target).sides[0]!.trailingStopPct).toBeNull()
  })

  it('drops each condition into the group it belongs to', () => {
    const target = documentFromDraft(STRATEGY)
    const steps = replaySteps(target)

    expect(steps[2]!.target).toBe(target.sides[0]!.entry.id)
    expect(steps[4]!.target).toBe(target.sides[0]!.exit.id)
  })
})
