// Indicator lines for the library's hover charts, computed in the browser from the candles. A value is
// null until enough candles exist for it. The backtest computes its own; these only illustrate.
export type Series = (number | null)[]

export function sma(values: number[], period: number): Series {
  return values.map((_, index) => {
    if (index < period - 1) return null
    const window = values.slice(index - period + 1, index + 1)
    return window.reduce((total, value) => total + value, 0) / period
  })
}

/** Starts from the simple average of the first `period` values, then weights each new value by 2 / (period + 1). */
export function ema(values: number[], period: number): Series {
  const weight = 2 / (period + 1)
  const result: Series = []
  let previous: number | null = null
  values.forEach((value, index) => {
    if (index < period - 1) {
      result.push(null)
      return
    }
    previous = previous === null
      ? values.slice(0, period).reduce((total, item) => total + item, 0) / period
      : value * weight + previous * (1 - weight)
    result.push(previous)
  })
  return result
}

/** Wilder's RSI: average gain against average loss over `period` changes, on a 0 to 100 scale. */
export function rsi(values: number[], period: number): Series {
  const result: Series = values.map(() => null)
  if (values.length <= period) return result
  let gain = 0
  let loss = 0
  for (let index = 1; index <= period; index++) {
    const change = values[index]! - values[index - 1]!
    gain += Math.max(change, 0)
    loss += Math.max(-change, 0)
  }
  gain /= period
  loss /= period
  const toRsi = () => (loss === 0 ? 100 : 100 - 100 / (1 + gain / loss))
  result[period] = toRsi()
  for (let index = period + 1; index < values.length; index++) {
    const change = values[index]! - values[index - 1]!
    gain = (gain * (period - 1) + Math.max(change, 0)) / period
    loss = (loss * (period - 1) + Math.max(-change, 0)) / period
    result[index] = toRsi()
  }
  return result
}

export function macd(values: number[], fast: number, slow: number, signalPeriod: number): { line: Series, signal: Series, histogram: Series } {
  const fastLine = ema(values, fast)
  const slowLine = ema(values, slow)
  const line: Series = values.map((_, index) => {
    const fastValue = fastLine[index]
    const slowValue = slowLine[index]
    return fastValue === null || fastValue === undefined || slowValue === null || slowValue === undefined ? null : fastValue - slowValue
  })
  const firstIndex = line.findIndex(value => value !== null)
  const signalTail = firstIndex < 0 ? [] : ema(line.slice(firstIndex) as number[], signalPeriod)
  const signal: Series = [...values.slice(0, Math.max(firstIndex, 0)).map(() => null), ...signalTail]
  const histogram: Series = line.map((value, index) => {
    const signalValue = signal[index]
    return value === null || signalValue === null || signalValue === undefined ? null : value - signalValue
  })
  return { line, signal, histogram }
}

/** The highest of the previous `period` values, not counting the current one, so a close can break above it. */
export function highest(highs: number[], period: number): Series {
  return highs.map((_, index) => (index < period ? null : Math.max(...highs.slice(index - period, index))))
}

/** The lowest of the previous `period` values, not counting the current one, so a close can break below it. */
export function lowest(lows: number[], period: number): Series {
  return lows.map((_, index) => (index < period ? null : Math.min(...lows.slice(index - period, index))))
}

/** The percent change of each value against the one `period` candles before it. */
export function change(values: number[], period: number): Series {
  return values.map((value, index) => (index < period ? null : (value / values[index - period]! - 1) * 100))
}

/** Each volume divided by its simple average over `period` candles: 1 is an average candle. */
export function relativeVolume(volumes: number[], period: number): Series {
  const average = sma(volumes, period)
  return volumes.map((volume, index) => {
    const mean = average[index]
    return mean === null || mean === undefined || mean === 0 ? null : volume / mean
  })
}

/** %K: where the close sits in the range of the last `period` candles, 0 to 100; %D: %K averaged over `smooth` candles. */
export function stochastic(highs: number[], lows: number[], closes: number[], period: number, smooth: number): { k: Series, d: Series } {
  const k: Series = closes.map((close, index) => {
    if (index < period - 1) return null
    const high = Math.max(...highs.slice(index - period + 1, index + 1))
    const low = Math.min(...lows.slice(index - period + 1, index + 1))
    return high === low ? null : ((close - low) / (high - low)) * 100
  })
  const d: Series = k.map((_, index) => {
    if (index < period - 1 + smooth - 1) return null
    const window = k.slice(index - smooth + 1, index + 1)
    if (window.some(value => value === null)) return null
    return (window as number[]).reduce((total, value) => total + value, 0) / smooth
  })
  return { k, d }
}

/** The simple average with bands `deviations` population standard deviations above and below it. */
export function bollinger(values: number[], period: number, deviations: number): { upper: Series, middle: Series, lower: Series } {
  const middle = sma(values, period)
  const spread = values.map((_, index) => {
    const mean = middle[index]
    if (mean === null || mean === undefined) return null
    const window = values.slice(index - period + 1, index + 1)
    const variance = window.reduce((total, value) => total + (value - mean) ** 2, 0) / period
    return deviations * Math.sqrt(variance)
  })
  return {
    upper: middle.map((mean, index) => (mean === null ? null : mean + spread[index]!)),
    middle,
    lower: middle.map((mean, index) => (mean === null ? null : mean - spread[index]!)),
  }
}
