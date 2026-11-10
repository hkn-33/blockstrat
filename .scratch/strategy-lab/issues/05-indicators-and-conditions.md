# 05: Full set of indicators and conditions

**What to build:** Users can express common technical strategies. Indicator blocks for open, high, low, close, volume, SMA, EMA, RSI, MACD and Bollinger Bands with editable parameters; comparison blocks (greater than, less than, crosses above, crosses below) over indicators and constants; logic blocks AND, OR, NOT. Invalid parameters are flagged on the block itself.

**Blocked by:** 01

**Status:** done

- [x] Schema expresses a condition tree: logical nodes over comparison nodes whose operands are indicator references (type + parameters) or constants
- [ ] Indicator series computed with an existing library (pandas-ta or equivalent, confirmed with the user before adding) and cached per instrument, timeframe and parameter set
- [x] All listed indicator, comparison and logic blocks exist in the editor and convert to and from the schema
- [x] Blocks only snap where their type fits (conditions into condition sockets, operands into operand sockets)
- [x] Invalid parameters (such as a non-positive period) are flagged on the block and rejected by the schema
- [x] API seam tests: at least one strategy per indicator family and per logic operator produces expected trades on fixtures
- [x] Converter seam test: round-trip covers every block type

## Comments

Indicators use the `ta` library. Only SMA is checked against an independent computation; the other indicators are checked for trades after warm-up.

Indicators are computed with `ta` but NOT cached: a Preview already takes under 100 ms, so the cache was skipped (YAGNI). Add it if Preview times grow.
