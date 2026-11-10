# Strategy Lab

A visual tool for building trading strategies from blocks and testing them on historical market data.

## Language

### Building strategies

**Strategy**:
A set of rules that decides when to open and close a position on one instrument.
_Avoid_: Algorithm, bot, system, script

**Block**:
One visual piece of a strategy (an indicator, a condition, a logical operator or an action) that the user drags into the editor.
_Avoid_: Node, brick, component

**Entry Rule**:
The condition that, when true, opens a long or short position.
_Avoid_: Signal, trigger

**Exit Rule**:
The condition that, when true, closes the open position.
_Avoid_: Close signal

**Stop-loss**:
A loss threshold, as a percentage of the entry price, at which the open position is closed.

**Take-profit**:
A profit threshold, as a percentage of the entry price, at which the open position is closed.

**Position Size**:
The share of current equity committed when a position is opened.
_Avoid_: Lot, stake

### Markets

**Market**:
A source of tradable instruments with its own price data, such as a crypto exchange or a stock exchange.
_Avoid_: Exchange (when meaning the data source), venue

**Instrument**:
A single tradable asset on a market, such as BTC/USDT.
_Avoid_: Symbol, ticker, asset, pair

**Timeframe**:
The duration of one price bar the strategy runs on, such as 1h, 4h or 1d.
_Avoid_: Interval, resolution, period

**Position**:
An open long or short exposure to one instrument. A strategy holds at most one position at a time.
_Avoid_: Trade (a trade is a closed position)

**Trade**:
A position that was opened and then closed, with its entry, exit and result.

### Testing

**Backtest**:
A simulation of a strategy on historical price data of one instrument, producing trades and an equity curve.
_Avoid_: Simulation, test run

**Preview**:
A backtest on the most recent bars only, rerun automatically after every change to a complete strategy.
_Avoid_: Approximation, live backtest

**Full Backtest**:
A backtest on the whole available history, run on the user's request.

**Execution Model**:
The assumptions about how orders fill in a backtest: fill at the next bar's open, commission and slippage.
_Avoid_: Realism, costs, fees

**Execution Preset**:
A named, ready-made execution model, such as "Binance spot" or "pessimistic".
