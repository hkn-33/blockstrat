# 06: Directions, exits and position size

**What to build:** Users can test short strategies and close positions the way they trade. The Entry Rule specifies long or short. Exit is an Exit Rule, a stop-loss/take-profit in percent, or both. Position Size is a percentage of equity with a sensible default. A strategy holds at most one position at a time.

**Blocked by:** 01

**Status:** done

- [x] Entry Rule block has a long/short choice
- [x] Exit slot accepts an Exit Rule, stop-loss and take-profit, or both; at least one is required
- [x] Position Size block, optional, with a default
- [x] Adapter supports short positions, Exit Rules and Position Size; never opens a second position while one is open
- [x] API seam tests: short trade results; stop-loss and take-profit close the position at the expected bar; Exit Rule closes the position; at most one open position; Position Size scales the result

## Comments

Stop-loss and take-profit become active from the bar after the entry fill (marked with a ponytail comment in the adapter).
