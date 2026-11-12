// What the TradingView-style chart draws, whatever it comes from: the landing page's precomputed demo or
// a live backtest from the API.
import type { BacktestResult } from '~/types/api'

export interface ChartCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export interface ChartPoint {
  time: number
  value: number
}

export interface ChartTrade {
  entry_time: number
  exit_time: number
  return_pct: number
  direction?: 'long' | 'short'
}

export interface ChartData {
  candles: ChartCandle[]
  /** The strategy's balance at each candle. */
  equity: ChartPoint[]
  /** The balance of simply holding the instrument from the same start. */
  holding: ChartPoint[]
  trades: ChartTrade[]
}

export function chartDataFromResult(result: BacktestResult): ChartData {
  return {
    candles: result.bars,
    equity: result.equity,
    holding: result.buy_and_hold,
    trades: result.trades,
  }
}
