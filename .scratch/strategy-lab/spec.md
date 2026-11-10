Status: done

# Strategy Lab MVP

## Problem Statement

People who want to try a trading idea ("buy when RSI drops below 30 and price is above the 200-day average") have two bad options: learn to code a backtest in Python or Pine Script, or trust the idea blindly. Existing no-code tools are either paid, complex, or hide how orders fill, so results look better than reality. Users have no quick, honest, visual way to assemble a strategy and immediately see how it would have performed.

## Solution

A web app where the user builds a strategy from Scratch-style blocks. The editor starts with one root Strategy block that has four labelled required slots: Instrument, Timeframe, Entry Rule and Exit. While a slot is empty, the chart area lists what is missing. As soon as all four are filled, a Preview backtest appears and reruns automatically after every change, so the user sees the effect of each block within a fraction of a second. A Full Backtest runs the whole history on request.

Results are honest by default: orders fill at the next bar's open, and commission and slippage come from an Execution Preset the user can edit. Users can describe a strategy in plain language to an AI chat, which builds the blocks for them in the editor. Strategies are saved in the browser, exported and imported as JSON, and shared as a link that opens the strategy with its result.

## User Stories

### Building a strategy

1. As a user, I want the editor to start with a root Strategy block, so that I know where to begin.
2. As a user, I want the Strategy block to show four labelled slots (Instrument, Timeframe, Entry Rule, Exit), so that I know exactly what a complete strategy needs.
3. As a user, I want to drag blocks from a categorised toolbox (Market, Indicators, Conditions, Logic, Actions, Risk), so that I can find the block I need quickly.
4. As a user, I want dragging and snapping blocks to feel smooth and immediate, so that building a strategy is pleasant rather than fiddly.
5. As a user, I want a block to only snap into a slot it fits, so that I cannot build a nonsensical strategy.
6. As a user, I want to choose an Instrument from a fixed list of about ten USDT pairs, so that I can test on liquid crypto markets.
7. As a user, I want to choose a Timeframe of 1d, 4h or 1h, so that I can test strategies at different speeds.
8. As a user, I want indicator blocks for price (open, high, low, close), volume, SMA, EMA, RSI, MACD and Bollinger Bands, with editable parameters, so that I can express common technical strategies.
9. As a user, I want comparison blocks (greater than, less than, crosses above, crosses below), so that I can turn indicators into conditions.
10. As a user, I want AND, OR and NOT blocks, so that I can combine conditions.
11. As a user, I want the Entry Rule to specify long or short together with its condition, so that I can test both directions.
12. As a user, I want to define Exit either with an Exit Rule, with a stop-loss and take-profit in percent, or with both, so that I can close positions the way I trade.
13. As a user, I want to set Position Size as a percentage of equity, with a sensible default, so that I do not have to configure it to see a first result.
14. As a user, I want each slot to turn green once it is validly filled, so that I can see my progress.
15. As a user, I want blocks that are not connected to the Strategy block to be greyed out and ignored, so that leftovers on the canvas do not change my result.
16. As a user, I want invalid parameters (such as a negative period) to be flagged on the block itself, so that I can fix them where they are.

### Seeing results

17. As a user, I want the chart area to say "Missing: …" with the names of the empty required slots, so that I know what to add before a result can appear.
18. As a user, I want a Preview to appear the moment the last required slot is filled, so that I get instant feedback.
19. As a user, I want the Preview to rerun automatically after each change, so that I can see how every block affects performance.
20. As a user, I want the previous result to stay visible, dimmed, while the Preview recalculates, so that the screen does not flicker or jump.
21. As a user, I want quick successive edits not to queue up stale results, so that what I see always matches my latest strategy.
22. As a user, I want the Preview to run on the most recent bars only (about 3000), so that it stays fast on 1h and 4h timeframes.
23. As a user, I want a "Full Backtest" button that runs the whole available history, so that I can check the strategy over a long period.
24. As a user, I want to see a price chart with entry and exit markers, so that I can see where the strategy traded.
25. As a user, I want to see an equity curve next to a buy-and-hold curve of the same instrument, so that I can tell whether the strategy beats simply holding.
26. As a user, I want key metrics (total return, buy-and-hold return, max drawdown, Sharpe ratio, win rate, number of trades, exposure time), so that I can judge the strategy quickly.
27. As a user, I want a list of trades with entry, exit, direction, size and result, so that I can inspect individual trades.
28. As a user, I want a clear message when the strategy made no trades, so that I understand an empty chart.

### Execution Model

29. As a user, I want orders to fill at the next bar's open, so that the backtest never uses information it could not have had.
30. As a user, I want to pick an Execution Preset (for example "Binance spot" or "pessimistic"), so that I get realistic costs without research.
31. As a user, I want to edit commission (%) and slippage (bps) manually, so that I can model my own broker.
32. As a user, I want the result to update when I change the Execution Model, so that I can see how much costs eat into returns.

### AI chat

33. As a user, I want to describe a strategy in plain language in a chat, so that I can start without knowing the blocks.
34. As a user, I want the AI's strategy to appear as real blocks in the editor, so that I can see and edit exactly what it built.
35. As a user, I want the AI to tell me when my description used something the blocks cannot express, so that I am not misled about what was built.
36. As a user, I want to refine the strategy by sending follow-up messages, so that I can iterate in conversation.
37. As a user, I want the AI's result to replace the current strategy only after I confirm, so that I do not lose my work by accident.
38. As a user, I want a friendly "AI is resting, build the blocks by hand" message when the AI limit is reached, so that I know why it stopped answering.

### Saving and sharing

39. As a user, I want my current strategy to be kept in the browser, so that a page reload does not lose my work.
40. As a user, I want to save several named strategies in the browser and switch between them, so that I can compare ideas.
41. As a user, I want to export a strategy as a JSON file, so that I can keep it or move it to another device.
42. As a user, I want to import a strategy from a JSON file, so that I can restore or reuse it.
43. As a user, I want a clear error when an imported file is not a valid strategy, so that I know why it did not load.
44. As a user, I want to copy a share link that encodes the strategy, so that I can send it to someone.
45. As a recipient of a share link, I want it to open with the strategy in the editor and its result already shown, so that I see it working without any setup.

### General

46. As a user, I want a visible note that results are historical simulations and not investment advice, so that expectations are clear.
47. As a user, I want the app to work on a laptop screen without horizontal scrolling, so that I can use it comfortably.
48. As a recruiter, I want to open a share link and understand the app within a minute, so that I can judge the author's skills quickly.

## Implementation Decisions

### Architecture

- Two deployables: a Nuxt + Tailwind frontend on Vercel, and a Python FastAPI backend on the user's VPS (Docker Compose with Caddy for automatic HTTPS).
- A strategy is a JSON document, never generated code (ADR 0001). The block editor and the AI produce the same document; the backend validates it before running anything.
- The backtest engine is backtesting.py behind an adapter (ADR 0002). Only the adapter imports the library.

### Strategy schema (the contract)

- Defined once in the backend as Pydantic models. JSON Schema is generated from them, and TypeScript types for the frontend are generated from the JSON Schema; there is no hand-written copy on the frontend.
- A schema version field so that saved and shared strategies can be migrated later.
- Top level: instrument, timeframe, entry rule (direction + condition), exit (optional exit rule, optional stop-loss %, optional take-profit %, at least one present), position size %, execution model (commission %, slippage bps).
- Conditions form a tree: logical nodes (and, or, not) over comparison nodes (greater than, less than, crosses above, crosses below) whose operands are indicator references (type + parameters) or constants.
- The schema distinguishes a complete strategy from a draft: the backend reports which of the four required parts (Instrument, Timeframe, Entry Rule, Exit) are missing instead of returning a generic validation error.

### Backend modules

- **Market data**: loads daily, 4h and 1h klines for a fixed list of about ten USDT pairs from Binance's public endpoints (no API key), stores them as parquet files, refreshes daily, and keeps them in memory. Exposed through a small interface so further markets can be added later as separate sources.
- **Indicators**: computes indicator series via an existing library (pandas-ta or equivalent; to be confirmed with the user before adding the dependency), cached per instrument, timeframe and parameter set.
- **Backtest adapter**: translates a validated strategy into a backtesting.py run, with fills at the next bar's open, commission and slippage from the execution model, stop-loss/take-profit, long and short, one position at a time. Returns trades, an equity curve, a buy-and-hold curve and metrics.
- **AI strategy builder**: sends the user's conversation plus the strategy JSON Schema to Gemini (via the google-genai SDK with structured output), validates the reply against the schema, and returns either a strategy or a message saying what could not be expressed. The Gemini key exists only on the backend.
- **Rate limiting**: AI requests limited to 10 per hour per IP plus a global daily cap below the Gemini free-tier limit.

### API contract

- `POST` backtest: body is a strategy plus a mode (preview or full). Response is either a "missing" list naming the required parts still absent, or the result (trades, equity curve, buy-and-hold curve, metrics, bar range used). Preview uses the last ~3000 bars; full uses all history.
- `POST` AI build: body is the chat messages plus the current strategy (optional). Response is a strategy, an explanation of anything not expressible, or a rate-limit status.
- `GET` instruments and execution presets: lists for the toolbox and the preset picker.
- CORS restricted to the frontend's origin.

### Frontend modules

- **Block editor**: Blockly workspace with a fixed root Strategy block holding four required slots, typed connections so only fitting blocks snap in, a custom theme matching the app, and green/filled state per slot.
- **Workspace ↔ strategy converter**: pure functions turning the workspace into a strategy JSON (or a draft with missing parts) and a strategy JSON back into blocks.
- **Preview runner**: on every workspace change, debounces ~250 ms, aborts the in-flight request, calls the backtest API in preview mode, and keeps the last result visible but dimmed while loading.
- **Results view**: price chart with trade markers, equity vs buy-and-hold chart (TradingView lightweight-charts), metric tiles, trades table.
- **AI chat panel**: conversation UI; a returned strategy is shown as a pending replacement that the user confirms.
- **Persistence**: current and named strategies in localStorage; JSON export/import; share link with the strategy compressed into the URL fragment.

## Testing Decisions

- Good tests exercise external behaviour through the highest seam, not internals: send a strategy in, assert on what the user would see come out. No tests of private helpers or of how backtesting.py is called.
- **Seam 1: backend HTTP API.** Tests use FastAPI's test client against the real app, with market data served from small fixture files instead of Binance, and Gemini replaced by a fake client returning canned replies. Covers:
  - the "missing" response for each combination of empty required parts;
  - schema validation errors for malformed strategies;
  - no look-ahead: a signal on bar N fills at bar N+1's open;
  - commission and slippage lowering the result versus a zero-cost run;
  - stop-loss and take-profit closing positions at the expected bar;
  - long and short positions, and at most one open position;
  - preview limited to the last ~3000 bars, full using all bars;
  - buy-and-hold curve and metrics on a hand-checkable fixture;
  - AI replies that are invalid against the schema being rejected, and the per-IP and daily rate limits.
- **Seam 2: workspace ↔ strategy converter.** Vitest tests on the pure conversion functions: a known workspace produces the expected strategy JSON; JSON → blocks → JSON round-trips unchanged for representative strategies (including every block type); drafts report the correct missing parts.
- Not automated in the MVP: browser end-to-end tests and the feel of the editor (smoothness, snapping). These are checked by hand.
- Prior art: none; this is a new repository. These tests set the pattern.

## Out of Scope

- Markets other than Binance crypto (GPW, US stocks). Important next step; the market data module is kept pluggable for it.
- Timeframes other than 1d, 4h and 1h. More are wanted later.
- Accounts, server-side saving, a database.
- Publishing strategies, community features, editing others' strategies with consent, a marketplace of strategies.
- Exporting strategies as code for other platforms (Pine Script, MQL5).
- AI explaining a backtest result, an AI overfitting critic, AI variant suggestions.
- Multi-instrument portfolios, pyramiding, several open positions at once.
- Live or paper trading, order placement of any kind, trading signals or alerts sent to users.
- Walk-forward testing and parameter optimisation.

## Further Notes

- Domain vocabulary follows GLOSSARY.md (Strategy, Block, Entry Rule, Exit Rule, Instrument, Timeframe, Preview, Full Backtest, Execution Model, Execution Preset).
- Preview speed has not been measured. If a preview takes well over ~300 ms on 1h data, reduce the preview bar count before considering any other approach.
- backtesting.py is AGPL-3.0, so the repository is public (ADR 0002).
- The Gemini free tier may use prompts to improve Google's models; the chat UI should say not to enter personal data.
- Adding new dependencies (Blockly, lightweight-charts, pandas-ta, google-genai, URL compression) needs the user's approval per CLAUDE.md; each is expected but should be confirmed at implementation time.
