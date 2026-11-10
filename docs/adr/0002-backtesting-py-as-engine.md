# Use backtesting.py as the backtest engine

We run backtests with the backtesting.py library instead of writing our own engine, because a maintained library already covers our strategy model (one instrument, one position, long/short, stop-loss/take-profit, commission, fills at the next bar's open). The engine sits behind an adapter that translates the JSON strategy definition (ADR 0001) into a backtesting.py run, so no other part of the system depends on the library directly.

## Considered Options

- Hand-rolled event-driven engine: rejected, a library already does it.
- vectorbt: faster vectorized engine, but its license (Apache 2.0 with Commons Clause) is more restrictive than we want.

## Consequences

- backtesting.py is AGPL-3.0; the repository is public.
