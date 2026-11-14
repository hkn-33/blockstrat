# Exit rules close a trade when they turn true, not while they stay true

An exit rule is checked on every bar of an open position, and until now it closed the position on any bar it held. A rule such as "RSI 7 above 75" usually already holds when a breakout entry fires, so the trade was entered and closed on the next candle: one-candle trades that nobody trading by hand would take, and results that said more about the order of the checks than about the idea. The engine now closes a position only on a bar where the exit rule becomes true. A rule that holds at the entry has to let go and hold again before it closes the trade. Crossing rules are unchanged, since they are true for one bar anyway; stop-loss, take-profit and the trailing stop are unaffected.

## Considered options

- **Keep the state reading**: simplest, and what a literal reading of "sell when RSI is above 75" says, but it produces the one-candle trades above.
- **Ignore the exit rule for a minimum number of bars**: hides the symptom, adds a number to tune and to explain, and still exits at once after the wait.

## Consequences

- A strategy whose exit rule never lets go after the entry is closed only by its stop-loss, take-profit, trailing stop or the end of the data.
- Results of existing strategies with level-style exit rules change; the landing page's precomputed demos are not recomputed by this change.
