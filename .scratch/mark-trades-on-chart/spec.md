Status: first version built

Built: marking on the latest 1500 candles of one market, a search over single entry and exit conditions (long side only), three proposals of different ideas with their fit and whole-history result, applied through the build replay. Not built: two conditions joined by "all", a stop-loss in proposals, results on other markets, advanced control over the search, the open questions below.

# Mark where to buy and sell on the chart, get strategies that match

## Problem Statement

A newcomer often knows what a good trade looks like on a chart ("I would have bought here and sold there") but not which indicator, with which numbers, says so. Today the builder asks for the rule first and shows the trades after. Someone who cannot name the rule has no way in except the assistant, which needs the idea in words.

## Solution

The user opens a market's chart, clicks the candles where they would have bought and where they would have sold, and asks for strategies. BlockStrat searches the conditions the builder already offers, with their numbers varied, for the combinations whose signals land closest to the marks. It returns a few proposals (three by default), each shown as ordinary tiles with how well it matches the marks and how it would have done on the whole history and on other markets. Picking one builds it on the canvas with the existing build replay, where it can be edited like any other strategy.

The feature finds a starting point, not a winning strategy: a rule fitted to a handful of marks on one chart usually looks excellent there and ordinary elsewhere, and the proposals must show that plainly.

## User Stories

1. As a newcomer, I want to mark buys and sells on a chart, so that I can describe an idea without knowing any indicator.
2. As a user, I want to pick the market and the candle size before marking, so that the marks mean what I see.
3. As a user, I want to add, move and remove marks, and to clear them all, so that fixing a mistake is one click.
4. As a user, I want to be told how many marks are needed before the search can run, so that I do not wait for nothing.
5. As a user, I want a few different proposals rather than one, so that I can choose the idea I understand best.
6. As a user, I want each proposal shown as the builder's tiles in plain words, so that I can read what it does.
7. As a user, I want to see each proposal's signals drawn next to my marks, so that I can judge the match with my own eyes.
8. As a user, I want a match figure in plain words ("hits 7 of your 9 marks, plus 14 trades you did not mark"), so that I am not misled by a single percentage.
9. As a user, I want each proposal's result on the whole history and on other markets beside the match, so that I see whether it works beyond the stretch I marked.
10. As a user, I want a clear warning when a proposal matches my marks but loses money elsewhere, so that I do not trust a coincidence.
11. As a user, I want to pick a proposal and watch it being built on the canvas, so that I can change it afterwards.
12. As a user, I want to be told when nothing matches well, with a suggestion (mark more trades, try another candle size), so that I am not handed a poor rule as if it were good.
13. As an advanced user, I want to choose which indicators the search may use and whether it may combine two conditions, so that I can steer it.
14. As a user on a phone, I want marking to work by tap, so that the feature is not desktop only.

## Implementation Decisions

- **Where the search runs.** In the backend, as a new endpoint that takes the instrument, timeframe, the marks (candle open times, each a buy or a sell) and the allowed building blocks, and returns ranked proposals as ordinary strategy drafts plus their match figures. The browser has neither the full history nor the indicator library.
- **What is searched.** The ready conditions the block library already defines, as templates with their numbers varied over a fixed grid (for example RSI period 7, 14, 21 against thresholds 20 to 40 in steps of 5). An entry is one condition or two joined by "all"; an exit is one condition, optionally with a stop-loss. This keeps every proposal buildable and readable in the existing canvas. No new condition kinds.
- **How a candidate is scored.** A signal counts as hitting a mark when it falls within a tolerance of it (a few candles, scaled to the candle size). The score rewards marks hit and penalises signals with no mark nearby inside the marked stretch, so a rule that fires constantly does not win by covering everything. Buys are scored against entry signals and sells against exit signals.
- **Search size and time.** Indicator series are computed once per distinct parameter set and reused across candidates; the search is exhaustive over the grid, not an optimiser. A budget (candidates and seconds) is fixed up front and the endpoint returns the best found within it.
- **Variety.** The proposals returned must differ in their main indicator, so the user is not shown three RSI thresholds one point apart.
- **Honesty about overfitting.** Every proposal is back-tested on the full history of the marked market and on the other markets with the existing engine, and the response carries those results. The UI shows them beside the match and words the risk when they disagree.
- **The marking surface.** The existing chart component in an interactive mode: a click on a candle places a mark, a toggle chooses buy or sell, marks are draggable along the time axis and removable. It lives in the result column or a dialog; it is entered from the welcome screen ("Mark it on a chart") and from the library.
- **Applying a proposal.** Through the existing build replay, as one undo step, like a template or an assistant answer.
- **Limits.** A minimum number of marks (to be set, probably three buys and three sells), one market and one candle size per search, long side only in the first version.

## Open Questions

1. Is the long side enough for a first version, or must marking shorts be in it?
2. Should marks be whole trades (a buy paired with its sell) or independent points? Pairs give a cleaner score; points are quicker to place.
3. How many proposals, and may the user ask for more?
4. Is a wait of a few seconds acceptable, with the same "replaying every candle" animation, or must it feel instant?
5. Should the assistant be able to start from marks too ("explain why these points"), or is that a later feature?
6. Does the free tier need a cap on searches a day, since each one is far heavier than a backtest?

## Testing Decisions

- API-level tests with fixture market data, as the existing backend tests do: marks placed exactly on a known rule's signals must bring that rule back as the top proposal; marks placed at random must return the "nothing matches well" answer; a rule that fires on every candle must not outrank a selective one.
- Frontend tests for the pure parts only (turning marks into a request, wording the match figure).

## Out of Scope

- Machine-learned or free-form rules that the builder cannot show as tiles.
- Optimising a strategy for profit. The search matches marks; profit is reported, not chased.
- Several markets or candle sizes in one search, portfolios, and marking on the landing page.
