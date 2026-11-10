# 03: Live Preview and Full Backtest

**What to build:** The result updates by itself. As soon as a strategy is complete, a Preview runs, and it reruns after every change, without flicker and without stale results. A "Full Backtest" button runs the whole history.

**Blocked by:** 01

**Status:** done

- [x] Every change to a complete strategy triggers a Preview after ~250 ms without further changes
- [x] A newer change aborts the in-flight request; a stale response never replaces a newer one
- [x] While recalculating, the previous result stays visible but dimmed
- [x] Backtest endpoint accepts a mode: preview runs on the last ~3000 bars, full on all available bars; the response states the bar range used
- [x] "Full Backtest" button runs full mode and shows the bar range
- [x] The "Run" button from ticket 01 is removed
- [x] Preview duration measured on 1d data and recorded in the ticket's comments; if well over ~300 ms, note it for ticket 08
- [x] API seam tests: preview limited to the last ~3000 bars of a longer fixture, full uses all bars

## Comments

Measured on real BTC data: Preview (3000 bars) 45-100 ms on 1d/4h/1h; Full Backtest 100 ms (1d), 140 ms (4h), 460 ms (1h, 80k bars). Charts merge bars into at most 5000 points; metrics use every bar. Responses are gzipped.
