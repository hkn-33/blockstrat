# Extra instruments are tested one at a time, not as a portfolio

A strategy can name up to nine extra instruments next to its main instrument, so the user can see whether an idea works beyond the one chart it was built on. The extra instruments are part of the strategy JSON (`extra_instruments`), but the backtest endpoint still runs one instrument per request, the one in `instrument`, and ignores the list. The builder sends one request per instrument, swapping `instrument`, and shows the results side by side. Each run starts with the same cash and the same execution model, as if the strategy had been tested on that instrument alone.

## Considered options

- **A portfolio backtest** (one account shared by all instruments, positions open on several at once): closer to how the strategy would be traded, but the results stop being comparable per instrument, position sizing across instruments becomes a new design problem, and backtesting.py (ADR 0002) only runs one instrument; we would need a different engine or our own.
- **One request that runs every instrument**: saves round trips, but one slow or failing instrument would hold back every result, and the results arrive all at once instead of as each finishes.

## Consequences

- The engine stays single-asset; nothing in `backtest.py` knows about extra instruments.
- The API checks each extra instrument against the known instruments, so a strategy that names an unknown one is rejected up front.
- A portfolio result (combined equity, correlation between instruments) is not available; it would need its own ADR.
