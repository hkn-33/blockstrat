# 04: Execution Model

**What to build:** Backtests account for trading costs. The user picks an Execution Preset (for example "Binance spot" or "pessimistic") or edits commission (%) and slippage (bps) by hand, and the result updates.

**Blocked by:** 01

**Status:** done

- [x] Strategy schema carries the execution model (commission %, slippage bps) with defaults
- [x] Adapter applies commission and slippage to every fill
- [x] Endpoint lists Execution Presets with their values
- [x] Preset picker in the UI; choosing a preset fills the values; manual edits are possible and switch the label to "custom"
- [x] Changing the execution model reruns the result
- [x] API seam tests: non-zero commission and slippage lower the result versus a zero-cost run by the expected amount on a hand-checkable fixture
