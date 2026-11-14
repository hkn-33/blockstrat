Status: done

# Strategies that trade both long and short

## Problem Statement

A strategy in BlockStrat has one entry rule with one direction: it either buys (long) or sells short, never both. Many of the ideas users bring trade both ways ("buy when the 20 EMA crosses above the 50, go short when it crosses below"), and in a falling market, like the last 16 months of most coins, the short side is where such a strategy would earn. Today the user has to build two separate strategies and compare them by hand. The builder's canvas also cannot show that a long trade and a short trade end in different ways.

## Solution

A strategy can have a long side, a short side, or both. Each side has its own entry rule and its own way out (an exit condition, a stop-loss, a take-profit, or a mix). On the canvas the flow splits after the market card into two lanes, Long (Buy when → Sell when) and Short (Sell short when → Buy back when), each ending in its own end card, so the two paths and their different endings are visible at a glance. The backtest runs both sides on one account, holding at most one position at a time, and the result shows how each side did as well as the total.

Existing strategies (saved, downloaded or shared as links) keep opening: a one-sided strategy is simply a strategy with one side.

## User Stories

1. As a user, I want to add a short side to my long strategy, so that it can also earn when the price falls.
2. As a user, I want to build a strategy that only goes short, so that I can test a bearish idea.
3. As a user, I want each side to have its own entry rule, so that buying and selling short can follow different signals.
4. As a user, I want each side to have its own way out (exit condition, stop-loss, take-profit), so that a long trade and a short trade can end differently.
5. As a user, I want the canvas to split into a Long lane and a Short lane after the market card, each ending in its own end card, so that I see the two paths and their different endings.
6. As a user, I want the short lane's cards to be worded for shorting ("Sell short when", "Buy back when"), so that I never confuse the two sides.
7. As a user, I want to add or remove a side with one button, so that switching between one-sided and two-sided is easy.
8. As a user, I want blocks from the library to drop into either lane, and a click to add to the lane the guide points at, so that building stays as quick as now.
9. As a user, I want the guide's checklist to be complete once at least one side has both an entry and a way out, so that a one-sided strategy is still finished.
10. As a user, I want an incomplete second side flagged on its lane rather than blocking the whole result, so that I can keep testing the side that is ready.
11. As a user, I want the backtest to hold at most one position at a time, so that the result is easy to follow and matches a single account.
12. As a user, I want a position to close only by its own side's way out, so that the rules I set for each side are the ones that apply.
13. As a user, I want to be told when both sides signalled on the same candle and no trade was opened, so that I understand a missing trade.
14. As a user, I want the result to show the total and each side's share: trades, profitable share and return for long and for short, so that I see which side carries the strategy.
15. As a user, I want long and short trades marked differently on the chart and in the trade list, so that I can tell them apart.
16. As a user, I want to describe a two-sided strategy to the assistant and get both lanes built, so that I do not have to build the short side by hand.
17. As a user with saved strategies, share links or downloaded files from before, I want them to open unchanged as one-sided strategies, so that nothing I made is lost.
18. As a user, I want the strategy's JSON to show both sides clearly, so that the technical visitor can read what the engine runs.

## Implementation Decisions

- **Schema version 2.** A strategy holds the shared parts (instrument, timeframe, position size, execution model) and a list of one or two sides; a side has a direction, an entry condition and an exit (rule, stop-loss, take-profit, at least one of them). The two sides must have different directions. Version 1 (one entry with a direction, one exit) stays accepted by the API and by the builder's file, link and storage readers, and is upgraded to a version 2 strategy with one side on reading. The builder always writes version 2. This decision is worth an ADR: it is the first schema version change and it fixes how old strategies are kept working.
- **The draft** (an incomplete strategy) reports missing parts per side, and a strategy is complete when at least one side is complete; an incomplete second side is left out of the backtest and reported as such rather than blocking it.
- **The engine** keeps one position at a time on one account. While flat, it checks both entry signals: if exactly one fires, that side opens at the next candle's open; if both fire on the same candle, no trade opens and the result counts it. While a position is open, only that side's exit rule, stop-loss and take-profit apply; the other side's entry signal is ignored (no reversal). Signals warm up over the indicators of both sides.
- **The result** gains a per-side summary (trade count, profitable share, return contribution) and the count of candles where both sides signalled together. Trades already carry their direction.
- **The builder's strategy document** changes from one Entry group and one Exit group to a list of sides, each with its entry group, exit group, stop-loss and take-profit; conversions, edits, problems and the guide move to sides. The canvas lays the cards out in two lanes below the market card, joined by edges, each lane ending in an end card; "Add a short side" / "Add a long side" and "Remove this side" live on the lanes. The direction switch on the entry card goes away: a lane's direction is fixed.
- **The assistant** is told about sides in its prompt and returns version 2 strategies; a request for both directions builds both lanes instead of being listed as not possible.
- **The landing page** is unchanged; its demo strategies are one-sided.

## Testing Decisions

- Backend tests go through the API, as the existing ones do, with the fixture market data: a short-only strategy produces short trades; a two-sided strategy produces trades in both directions and never two positions at once; both sides signalling on one candle opens nothing and is counted; each side's stop-loss and take-profit apply only to its own trades; a version 1 strategy is accepted and gives the same result as before.
- Builder tests go through the strategy document module: two sides convert to version 2 and back unchanged; a version 1 strategy converts to one side; missing parts and problems are reported per side; the guide is done with one complete side; a share link and a saved strategy from version 1 still open.
- The assistant's tests (fake Gemini client) cover a two-sided answer being accepted.
- A manual pass in the browser: building both lanes, the end cards, the per-side result.

## Out of Scope

- Holding a long and a short position at the same time (hedging), or more than one position per side.
- Reversing a position when the other side's entry fires.
- Different position sizes or execution models per side.
- Changes to the landing page's demo.

## Further Notes

- Prior art: the engine already sells short for one-sided short strategies, and trades already carry a direction, so the chart and the trade list need little change.
- The glossary's "Entry Rule" and "Position" stay as defined; "Side" (the long or short half of a strategy, with its own entry rule and exit) is a new term to add.
- Depends on the current builder rebuild (`.scratch/app-guided-canvas/`) being committed first.
