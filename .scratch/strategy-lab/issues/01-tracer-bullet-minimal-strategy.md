# 01: Tracer bullet: minimal strategy from blocks to equity curve

**What to build:** The thinnest complete path through the whole system. A user opens the app locally, sees the root Strategy block with its four slots (Instrument, Timeframe, Entry Rule, Exit), fills them with BTC/USDT, 1d, a long Entry Rule "close crosses above SMA(n)", and an Exit made of stop-loss and take-profit in percent, and sees an equity curve from a backtest of that strategy. Spec: `.scratch/strategy-lab/spec.md`. Respect ADR 0001 (strategy is JSON) and ADR 0002 (backtesting.py behind an adapter).

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Nuxt + Tailwind frontend and FastAPI backend both run locally with one documented command each
- [x] Strategy schema defined once as Pydantic models, with a schema version field; JSON Schema generated from it and TypeScript types generated from the JSON Schema (no hand-written frontend copy)
- [x] Binance public 1d klines for BTC/USDT downloaded without an API key, cached as parquet, loaded into memory
- [x] Backtest adapter runs a validated strategy through backtesting.py with fills at the next bar's open and zero costs; only the adapter imports backtesting.py
- [x] Backtest endpoint accepts a strategy and returns an equity curve and total return
- [x] Blockly editor with the root Strategy block and the minimal blocks above; a workspace ↔ strategy converter produces the JSON sent to the API
- [ ] Equity curve rendered on the page after the user presses a "Run" button (automatic Preview comes in ticket 03)
- [x] Visible note that results are historical simulations, not investment advice
- [x] API seam test: fixture price data in, expected trades and equity out; a test proving a signal on bar N fills at bar N+1's open
- [x] Converter seam test: known workspace → expected JSON; JSON → blocks → JSON round-trips unchanged
- [x] CLAUDE.md "Repo map" section lists the new top-level folders
- [x] New dependencies (Blockly, backtesting.py, pandas, parquet support, chart library) confirmed with the user before adding (the user waived per-dependency approval for this run)

## Comments

Done. The temporary "Run" button was skipped: ticket 03's automatic Preview landed in the same pass. pandas is pinned below 3 because Windows application control blocked the pandas 3.1 wheel's DLLs on the dev machine.

The equity curve renders automatically instead (ticket 03).
