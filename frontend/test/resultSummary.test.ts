import { describe, expect, it } from 'vitest'
import { marketsVerdict } from '~/utils/resultSummary'

const done = (returnPct: number) => ({ returnPct, isPending: false })
const failed = { returnPct: null, isPending: false }
const pending = { returnPct: null, isPending: true }

describe('the verdict over several markets', () => {
  it('counts the profitable markets and averages the returns', () => {
    expect(marketsVerdict([done(20), done(10), done(-4), done(23.6)])).toBe('Profitable on 3 of 4 markets, +12.4% on average')
  })

  it('says so when every market made money, or none did', () => {
    expect(marketsVerdict([done(5), done(7)])).toBe('Profitable on all 2 markets, +6.0% on average')
    expect(marketsVerdict([done(-5), done(-7)])).toBe('Not profitable on any of the 2 markets, −6.0% on average')
  })

  it('gives no number while some markets are still calculating', () => {
    expect(marketsVerdict([done(5), pending, pending])).toBe('Still calculating 2 of 3 markets')
  })

  it('leaves failed markets out of the average and says how many failed', () => {
    expect(marketsVerdict([done(5), done(-1), failed])).toBe('Profitable on 1 of 2 markets, +2.0% on average. 1 market could not be calculated')
    expect(marketsVerdict([failed, failed])).toBe('None of the 2 markets could be calculated')
  })
})
