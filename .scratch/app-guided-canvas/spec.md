Status: done

# Guided canvas for the builder

Follows `.scratch/app-rebuild/spec.md` (done): the strategy document, the tiles, the live chart and tester, saving, sharing and the assistant stay. This spec changes how the builder is laid out and how a first-time user is led through it.

## Problem Statement

The new builder works, but it opens as a dense tool: a full strategy, a long palette, cost fields, a toolbar of controls and a chart, all at once. The audience is someone who has seen "buy when RSI is under 30" in a video and does not know what RSI or EMA mean. Faced with that screen they do not know where to start, what a block means, or what is still missing. The browser's default scrollbars and the two-column layout also make it look unfinished next to the landing page.

## Solution

A three-column builder that starts nearly empty and leads the user one step at a time, in the spirit of a language-learning app: one obvious next action, a friendly picture and arrow pointing at it, a checklist that ticks itself.

- **Left: the block library.** Searchable. Every block (markets, indicators, ready conditions, ways out) has a plain-English description; hovering or focusing it shows a card with two sentences and a small chart of real candles with that indicator drawn on them, so the user sees what the line does.
- **Middle: the canvas.** The strategy as connected cards on a canvas the user can drag to move around (with zoom and a minimap in the bottom-right corner): Strategy (its name) → Market → Buy when → Sell when. With nothing built yet, the middle shows a name field, then a cartoon arrow and a highlighted outline on the first card to fill ("Pick a market"), with a short checklist (Market, When to buy, When to sell) that ticks as each part is done.
- **Right: the result.** A checklist of what is still missing until the strategy is complete; then the chart, the tester's numbers and the trade list. The assistant chat lives in this column too, as a tab beside the result.

## User Stories

1. As a first-time user, I want the builder to open with a clear first step in the middle of the screen, so that I know exactly where to start.
2. As a first-time user, I want to give my strategy a name first and have it saved under that name, so that it feels like mine from the start.
3. As a first-time user, I want a friendly drawing and an arrow pointing at the next card to fill, with that card outlined, so that I never wonder what to do next.
4. As a first-time user, I want a short checklist (market, when to buy, when to sell) that ticks itself as I go, so that I see my progress.
5. As a first-time user, I want a one-click "Start from an example" option, so that I can see a finished strategy before building my own.
6. As a user, I want the result column to say plainly what is still missing until the strategy is complete, and to show the chart only once it is, so that an empty chart never confuses me.
7. As a user, I want a library of blocks on the left, grouped (Markets, Indicators, Ready conditions, Ways out) and searchable, so that I find what I need without knowing its name.
8. As a user who does not know what RSI or EMA is, I want to hover over a block and read in two plain sentences what it measures and how people use it, so that I can choose with understanding.
9. As that user, I want the hover card to show a small chart of real candles with the indicator drawn on them, so that I see what the line looks like and how it moves.
10. As a user, I want to drag a block from the library onto a card on the canvas, or click it to add it to the card that is waiting for it, so that both ways of building work.
11. As a user, I want my strategy drawn as cards connected in order (Strategy, Market, Buy when, Sell when), so that I read it top to bottom like a recipe.
12. As a user, I want to move around the canvas by dragging its background, and zoom with the wheel or buttons, so that a large strategy stays manageable.
13. As a user, I want a minimap in the bottom-right corner of the canvas, so that I always know where I am on it.
14. As a user, I want a "fit to screen" control, so that I can get back to the whole strategy in one click.
15. As a user, I want to rename the strategy from its card, and save it, so that I can keep several ideas.
16. As a user, I want the assistant as a tab in the right column, next to the result, so that I can chat and still see the canvas.
17. As a user, I want scrollbars that are thin and match the page in both themes, so that the builder looks finished.
18. As a user, I want the rest of the builder's behaviour (editing tiles, all/any, not, stop-loss and take-profit, costs, undo, share links, files, the JSON view, light and dark themes) to work as before, so that nothing I relied on is lost.
19. As a user on a phone, I want the three columns as three tabs (Library, Strategy, Result), so that the builder still works on a small screen.
20. As a keyboard user, I want to add blocks from the library with Enter and move between cards with Tab, so that I do not need a mouse.

## Implementation Decisions

- **Canvas: Vue Flow** (chosen in review): `@vue-flow/core`, `@vue-flow/minimap` and `@vue-flow/background`. Maintained, widely used, and gives pan, zoom, minimap, fit view and edges. The strategy document is not changed: the canvas is a view of it. One node per part (Strategy, Market and pace, Buy when, Sell when, Costs), placed in a fixed vertical layout and joined by edges; the user moves the view, not the cards. Interactive parts inside nodes are marked so dragging them does not pan the canvas.
- **Blocks dropped from the library**: the existing SortableJS lists stay inside the Buy when and Sell when nodes, so dragging between groups keeps working. Market blocks dropped on the Market node set the instrument. Clicking a block adds it to the card the guide is pointing at.
- **Guide state** is derived from the document, not stored: no name yet, then no market, then no entry condition, then no way to sell. The highlighted card and the arrow follow that order. The strategy name joins the document (and the saved files) as an optional field the builder keeps in the browser; the API strategy is unchanged.
- **Indicator help**: one table of plain-English descriptions per block kind; the hover card draws a small chart from the landing demo's real daily candles (no API call), computing SMA, EMA, RSI, MACD and Bollinger Bands in the browser with small, tested pure functions.
- **Right column**: tabs Result and Assistant. Result shows the missing-parts checklist until the strategy is complete, then chart, tester and trades. The JSON view moves into the Strategy card's menu.
- **Start**: a first visit (nothing saved, no share link) opens the empty guided canvas; a share link or a saved strategy opens as before.
- **Scrollbars**: one thin themed style for every scrolling area in the builder.
- **Layout**: left about 18rem, right about 30rem, the canvas takes the rest. Below 1100px the library collapses to a drawer; below 900px the three columns become tabs.

## Testing Decisions

- The guide's next step, derived from a document, is a pure function with tests (empty, named, with market, with entry, complete).
- The indicator calculations for the hover charts are pure functions tested against hand-computed values for a short series.
- The strategy document tests stay; a test covers the strategy name surviving save and load.
- No tests of Vue Flow internals. A manual pass in a real browser at 1440, 1024 and 390 wide in both themes, including dragging the canvas, the minimap and drag-and-drop into cards.

## Out of Scope

- Free placement of cards by the user, or branching strategies; the layout stays fixed.
- Changes to the API, the schema or the backtest.
- Sound, streaks, badges or other game mechanics beyond the guide and checklist.

## Further Notes

- New dependencies: @vue-flow/core, @vue-flow/minimap, @vue-flow/background.
- The hover charts reuse the landing demo's precomputed candles, so they work offline and cost nothing.
