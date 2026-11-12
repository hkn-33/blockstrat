# CLAUDE.md

Chat replies: Polish unless I write in English. Be terse and direct. Point out flaws and risks; don't praise by default.
Everything written to the repo is in English: code, identifiers, comments, commit messages, docs, specs, ADRs.

## Process
- Large features and new projects: I run the process skills myself (/grill-with-docs, /to-spec, /to-tickets). Don't start building a large feature without a spec.
- When interviewing me (grilling), ask at most 15 questions, most important first. Batch related questions. Stop earlier if the design is clear.
- Small changes: just do them. Don't interview me about a typo.
- Use the tdd skill for logic and bugs. Run the full test suite and review only when I say the work is done.
- If something is ambiguous and a wrong guess is costly, ask. Otherwise state your assumption in one line and proceed.

## Libraries and docs
- Before writing an integration, client or utility, check whether a maintained library or Nuxt module already does it. Don't hand-roll what exists.
- Use Context7 for current library/framework docs instead of relying on memory. Use web search to check what is currently recommended.
- Suggest a library with one line of reasoning (maintenance, popularity, fit) and ask before adding a dependency.
- Web scraping: use Scrapling. Don't write raw requests/BeautifulSoup scrapers.

## Reuse before writing
- Before adding code, search for existing similar code. Extend it instead of creating a near-copy.
- Extract a shared helper/component when a second use appears, not before. No abstractions for a single use.

## Scope and cleanup
- Touch only what the task requires. Don't refactor or reformat adjacent code. Match the repo's existing style.
- Remove everything your change made obsolete: unused imports, variables, functions, files, old code paths you replaced.
- Unrelated dead code: mention it, don't delete it.

## Code style
- Readability over brevity. No clever one-liners, no dense chaining, no cryptic abbreviations. Descriptive names, early returns, small functions.
- Self-documenting: types everywhere (type hints in Python, strict TypeScript).
- Comments only for non-obvious "why". Never comment what the code says.
- No speculative features, config options, or error handling for impossible cases.

## Repo map
- Keep the "Repo map" section of the repo's CLAUDE.md current. When you add, move, rename or delete a folder or a key module, update it in the same change.
- Folder-level only, one line per entry. Don't list individual files.

### Folders
- `backend/`: Python FastAPI service (uv): strategy schema, Binance market data, backtests (backtesting.py), AI strategy builder (Gemini).
- `backend/src/blockstrat/`: the backend package.
- `backend/scripts/`: one-off data scripts (the landing page's precomputed demo backtests, candles and trades).
- `backend/tests/`: API-level tests (pytest) with fixture market data and a fake Gemini client.
- `frontend/`: Nuxt + Tailwind app: prerendered landing page (`/`) and the client-only builder panel (`/app`).
- `frontend/app/pages/`: the landing page and the builder panel.
- `frontend/app/components/`: pieces shared by the landing page and the builder (TradingView-style chart, strategy tester, rule tile, logo, icons).
- `frontend/app/components/builder/`: the builder at `/app`: block library with indicator help and the large indicator chart, the Vue Flow canvas of strategy cards with its guide, rule groups with drag and drop, popovers, per-market results with the test settings, assistant and JSON panels, and the hand that builds a finished strategy on screen.
- `frontend/app/components/landing/`: landing-page sections and pieces (read-only builder canvas that builds itself, TradingView-style chart and strategy tester, product window, pinned steps, AI demo).
- `frontend/app/assets/icons/`: Lucide interface glyphs, inlined by `UiIcon`.
- `frontend/app/data/`: precomputed real backtests for the landing demo (from `backend/scripts/`).
- `frontend/app/utils/`: the strategy document (editable model ↔ strategy JSON), the guide, the block library and indicator maths, the popular-strategy templates, the build replay's steps, result summaries, strategy files/share links.
- `frontend/app/composables/`: the strategy editor with undo, backtests per market, the build replay, the simple/advanced mode, the API client, chart themes and the landing demo.
- `frontend/app/types/`: TypeScript types generated from the backend schema (`npm run gen:types`); never edit by hand.
- `frontend/public/fx/`: the taste kit's grain-gradient shader (copied as plain files), the hero's moving ground.
- `frontend/public/brand-icons/`: real brand and coin logos (fetched with the taste skill's icons.mjs, credits in its JSON).
- `frontend/test/`: Vitest tests of the pure converters.
- `deploy/`: Docker Compose + Caddy for the backend on a VPS.
- `docs/`: ADRs, deployment guide, agent docs.
- `.scratch/`: local issue tracker (specs and tickets).

## Defaults (a repo's own CLAUDE.md overrides these)
- Language: TypeScript, never plain JavaScript. Python for scripts, data, AI/RAG and agents.
- In Node.js/TypeScript use async/await, never .then().
- Apps with a UI: Nuxt + Tailwind CSS, always.

## Agent skills

### Issue tracker

Local markdown: issues live as files under `.scratch/<feature-slug>/` in this repo. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.