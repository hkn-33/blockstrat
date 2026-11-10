# 07: Full results view

**What to build:** Users can judge a strategy at a glance: a price chart with entry and exit markers, the equity curve next to a buy-and-hold curve of the same instrument, metric tiles, and a trades table. An empty result explains that the strategy made no trades.

**Blocked by:** 01

**Status:** done

- [x] Backtest response includes trades (entry, exit, direction, size, result), equity curve, buy-and-hold curve and metrics: total return, buy-and-hold return, max drawdown, Sharpe ratio, win rate, number of trades, exposure time
- [x] Price chart with entry/exit markers and an equity vs buy-and-hold chart (TradingView lightweight-charts, confirmed with the user before adding)
- [x] Metric tiles and a trades table
- [x] Clear message when the strategy made no trades
- [x] Layout works on a laptop screen without horizontal scrolling
- [x] API seam tests: buy-and-hold curve and each metric match hand-computed values on a small fixture

## Comments

The example strategy's result (+5025.0% full history) matches an independent pandas re-implementation exactly.
