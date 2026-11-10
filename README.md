# Strategy Lab

Build a trading strategy from Scratch-style blocks and see immediately how it would have performed on historical crypto data. Describe a strategy in plain words and an AI assistant builds the blocks for you.

- **Blocks, not code.** A root Strategy block with four required slots: Instrument, Timeframe, Entry Rule, Exit. Until they are filled, the app lists what is missing.
- **Instant Preview.** Every change reruns a real backtest (last ~3000 bars, typically under 100 ms on the server); **Full Backtest** runs the whole history.
- **Honest by default.** Orders fill at the next bar's open (no look-ahead). Commission and slippage come from an editable Execution Preset.
- **AI assistant.** Gemini turns a description into strategy JSON, never code (ADR 0001), validated against the same schema as the blocks.
- **Save and share.** Strategies are saved in the browser, exported as JSON, or shared as a link that opens with the result.

Results are simulations on past data, not investment advice.

## Architecture

```
Nuxt SPA (Vercel)  ──HTTPS──▶  FastAPI (VPS, Docker + Caddy)
  Blockly editor                 Strategy schema (Pydantic) ──▶ JSON Schema ──▶ TS types
  blocks ↔ strategy JSON         Binance klines → parquet cache
  lightweight-charts             backtesting.py adapter (ADR 0002)
                                 Gemini structured output + rate limits
```

Domain terms: [GLOSSARY.md](GLOSSARY.md). Decisions: [docs/adr](docs/adr). Spec and tickets: [.scratch/strategy-lab](.scratch/strategy-lab).

## Run locally

Requirements: [uv](https://docs.astral.sh/uv/), Node.js 22+.

```bash
cd backend && uv run uvicorn strategy_lab.api:create_default_app --factory --port 8000
```

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:3000. The backend downloads Binance price history on first start (about a minute for all instruments) and caches it in `backend/data/`. For the AI chat, set `GEMINI_API_KEY` before starting the backend.

## Tests

```bash
cd backend && uv run pytest
```

```bash
cd frontend && npm test && npm run typecheck
```

After changing the backend schema, regenerate the frontend types:

```bash
cd frontend && npm run gen:types
```

## Deploy

See [docs/deployment.md](docs/deployment.md).

## License

The backtest engine, backtesting.py, is AGPL-3.0, so this repository is public.
