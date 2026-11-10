# 02: Missing required parts feedback

**What to build:** While a strategy is incomplete, the user sees exactly what is missing instead of a chart. The chart area shows "Missing: …" listing the empty required slots (Instrument, Timeframe, Entry Rule, Exit). Each validly filled slot turns green. Blocks not connected to the Strategy block are greyed out and ignored. The backend reports missing parts as a distinct response rather than a generic validation error.

**Blocked by:** 01

**Status:** done

- [x] Backtest endpoint returns a "missing" response naming every absent required part, for any combination of empty slots
- [x] Malformed strategies (not just incomplete) still return a schema validation error
- [x] Chart area shows "Missing: X, Y, …" in the order of the slots while anything is missing
- [x] Each slot shows a filled/green state once validly filled
- [x] Loose blocks outside the Strategy block are greyed out and do not affect the strategy JSON
- [x] API seam tests for each missing combination and for a malformed strategy
- [x] Converter seam tests: drafts report the correct missing parts; loose blocks are excluded
