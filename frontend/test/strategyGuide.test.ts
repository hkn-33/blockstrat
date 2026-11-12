import { describe, expect, it } from 'vitest'
import { addItem, emptyDocument, newCondition, setSideLimit } from '~/utils/strategyDocument'
import { guideSteps, nextGuideStep } from '~/utils/strategyGuide'

const EXECUTION = { commission_pct: 0.1, slippage_bps: 5 }
const RSI = { kind: 'rsi', period: 14 } as const

describe('the guide', () => {
  it('asks for a name first', () => {
    expect(nextGuideStep(emptyDocument(EXECUTION), '')).toBe('name')
  })

  it('then for a market', () => {
    expect(nextGuideStep(emptyDocument(EXECUTION), 'My idea')).toBe('market')
  })

  it('then for when to buy, then for when to sell', () => {
    const withMarket = { ...emptyDocument(EXECUTION), instruments: ['BTCUSDT'], timeframe: '4h' as const }
    expect(nextGuideStep(withMarket, 'My idea')).toBe('entry')

    const withEntry = addItem(withMarket, withMarket.sides[0]!.entry.id, newCondition('lt', RSI, { kind: 'constant', value: 30 }))
    expect(nextGuideStep(withEntry, 'My idea')).toBe('exit')

    const complete = setSideLimit(withEntry, withEntry.sides[0]!.id, 'stopLossPct', 5)
    expect(nextGuideStep(complete, 'My idea')).toBe('done')
  })

  it('ticks off every finished step in the checklist', () => {
    const withMarket = { ...emptyDocument(EXECUTION), instruments: ['BTCUSDT'], timeframe: '4h' as const }
    expect(guideSteps(withMarket, 'My idea').map(step => [step.key, step.isDone])).toEqual([
      ['name', true],
      ['market', true],
      ['entry', false],
      ['exit', false],
    ])
  })
})
