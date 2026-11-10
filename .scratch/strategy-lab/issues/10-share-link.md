# 10: Share link

**What to build:** Users can send a strategy to anyone as a link. Opening the link shows the strategy in the editor with its result already computed, no setup needed.

**Blocked by:** 01

**Status:** done

- [x] "Copy link" button encodes the strategy, compressed, into the URL fragment (compression library confirmed with the user before adding)
- [x] Opening a link loads the strategy into the editor and runs a backtest immediately
- [x] A broken or tampered link shows a clear error and opens an empty editor
- [x] Opening a link does not overwrite the recipient's saved strategies without asking
- [x] Test: strategy → link → strategy round-trips unchanged
