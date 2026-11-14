import { describe, expect, it } from 'vitest'
import { bollinger, change, ema, highest, lowest, macd, relativeVolume, rsi, sma, stochastic } from '~/utils/indicators'

const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function rounded(series: (number | null)[], digits = 4): (number | null)[] {
  return series.map(value => (value === null ? null : Number(value.toFixed(digits))))
}

describe('indicators for the hover charts', () => {
  it('averages the last n values for a simple moving average', () => {
    expect(sma([2, 4, 6, 8], 2)).toEqual([null, 3, 5, 7])
  })

  it('starts the exponential average from the simple one and weights recent values more', () => {
    // k = 2 / (3 + 1) = 0.5: 2, then 4 * 0.5 + 2 * 0.5 = 3, then 5 * 0.5 + 3 * 0.5 = 4
    expect(ema([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4])
  })

  it('gives an RSI of 100 when the price only rises and 0 when it only falls', () => {
    expect(rsi(VALUES, 3).at(-1)).toBe(100)
    expect(rsi([...VALUES].reverse(), 3).at(-1)).toBe(0)
    expect(rsi(VALUES, 3).slice(0, 3)).toEqual([null, null, null])
  })

  it('computes an RSI of 50 when gains and losses balance', () => {
    expect(rsi([10, 11, 10, 11, 10], 4).at(-1)).toBe(50)
  })

  it('builds MACD as the gap between a fast and a slow average, with its signal and histogram', () => {
    const { line, signal, histogram } = macd(VALUES, 2, 4, 2)
    const lastLine = line.at(-1)!
    expect(lastLine).toBeCloseTo(ema(VALUES, 2).at(-1)! - ema(VALUES, 4).at(-1)!, 10)
    expect(histogram.at(-1)).toBeCloseTo(lastLine - signal.at(-1)!, 10)
    expect(line[2]).toBeNull()
  })

  it('draws Bollinger Bands at k standard deviations around the simple average', () => {
    const { upper, middle, lower } = bollinger([2, 4, 6], 3, 2)
    // mean 4, population standard deviation sqrt(8 / 3)
    expect(middle.at(-1)).toBe(4)
    expect(rounded([upper.at(-1)!])[0]).toBeCloseTo(4 + 2 * Math.sqrt(8 / 3), 4)
    expect(rounded([lower.at(-1)!])[0]).toBeCloseTo(4 - 2 * Math.sqrt(8 / 3), 4)
    expect(upper[0]).toBeNull()
  })

  it('takes the highest high and the lowest low of the previous candles, not the current one', () => {
    expect(highest([3, 5, 4, 9, 1], 2)).toEqual([null, null, 5, 5, 9])
    expect(lowest([3, 5, 4, 1, 9], 2)).toEqual([null, null, 3, 4, 1])
  })

  it('measures the percent change of the close against n candles ago', () => {
    expect(rounded(change([100, 110, 99, 121], 2))).toEqual([null, null, -1, 10])
  })

  it('divides volume by its average, so an average candle is 1', () => {
    expect(relativeVolume([10, 30, 20, 60], 2)).toEqual([null, 1.5, 0.8, 1.5])
    expect(relativeVolume([0, 0, 5], 2)).toEqual([null, null, 2])
  })

  it('places the close within the recent range for the stochastic, and smooths it for %D', () => {
    const highs = [10, 12, 14, 13, 15]
    const lows = [8, 9, 10, 9, 11]
    const closes = [9, 11, 13, 10, 15]
    const { k, d } = stochastic(highs, lows, closes, 3, 2)
    // Each window of three: (close - lowest low) / (highest high - lowest low), on a 0 to 100 scale.
    expect(rounded(k)).toEqual([null, null, 83.3333, 20, 100])
    expect(d.slice(0, 3)).toEqual([null, null, null])
    expect(d.at(-1)).toBeCloseTo(60, 10)
  })
})
