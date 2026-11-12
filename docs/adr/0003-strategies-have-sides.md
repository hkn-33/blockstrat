# A strategy has one or two sides; version 1 strategies are upgraded on reading

A strategy used to have one entry rule with a direction and one exit (schema version 1). To let one strategy trade both ways, schema version 2 holds a list of one or two sides, a long side and a short side, each with its own entry condition and its own exit (rule, stop-loss, take-profit); instrument, timeframe, position size and execution model stay shared. The backtest runs both sides on one account with at most one position at a time: while flat, the side whose entry fires opens; when both fire on the same candle nothing opens and the result counts it; an open position closes only by its own side's exit, and the other side's entry never reverses it.

Version 1 strategies are not migrated in storage. The API and the builder's file, link and browser-storage readers accept both versions and upgrade version 1 to version 2 with one side on reading; the builder always writes version 2.

## Considered options

- **A second, optional "short" block next to the existing entry and exit**: no version change, but every reader would special-case it and the two sides would not be symmetric.
- **Reversal on the opposite signal** (close long and open short in one go): common in trading platforms, but it makes the order of rules matter and is hard for a newcomer to read; left out for now and can be added as an option per strategy.
- **Hedging** (a long and a short open at once): not supported by the engine's one-position model and rarely what a beginner means.

## Consequences

- Share links and saved strategies from before keep opening; nothing has to be rewritten.
- A one-sided strategy is still the common case and costs nothing extra.
- Any future schema change follows the same pattern: bump the version, upgrade older versions on reading.
