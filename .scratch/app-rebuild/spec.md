Status: needs-review

# Builder rebuild in the landing page's design

## Problem Statement

The landing page now promises a builder that looks and behaves like its hero window: rules drawn as clear condition tiles (`[what | how | value]`) in "Buy when / Sell when" groups, a TradingView-style chart with every trade marked and the balance underneath, a strategy tester overview, light and dark themes, and an assistant whose answers are those same tiles. The builder at `/app` delivers none of that. It is a Blockly canvas whose blocks look nothing like the landing page, whose nesting is fiddly for a non-technical user, and whose charts, panels and colours come from an older design. A visitor who clicks "Open the builder" lands in a different product.

## Solution

Replace the builder with a new one built from the landing page's own pieces, and remove the Blockly editor completely.

The screen is the hero's product window, full height: a toolbar on top; the Strategy on the left as condition tiles in an Entry group and an Exit group; on the right the TradingView-style chart (candles, volume, trade markers, balance pane against holding) and the strategy tester overview with the trade list under it. The user builds by dragging tiles from a palette into a group, or by pressing "Add condition" in a group, and changes any part of a tile by clicking it and picking from a small popover. Every change reruns the Preview within a fraction of a second, with the previous result dimmed, never blank. The assistant opens as a side panel; its answer is a set of tiles the user applies to the editor with one click. The whole screen follows the landing page's light and dark themes and works on a phone.

The Strategy stays a JSON document validated by the one backend schema (ADR 0001); nothing about the API or the backtest changes.

## User Stories

### First visit

1. As a first-time user, I want the builder to open with a complete example strategy and its result already on screen, so that I see what the tool does before I change anything.
2. As a first-time user, I want the builder to look like the window I just saw on the landing page, so that I trust I am in the same product.
3. As a user who arrives from a share link, I want the shared strategy and its result shown at once, so that I see it working without setup.
4. As a returning user, I want the strategy I was last editing restored, so that a reload never loses my work.

### Market and pace

5. As a user, I want to pick the Instrument from the ten pairs in a toolbar control with coin logos, so that I choose a market in one click.
6. As a user, I want to pick the Timeframe (1h, 4h, 1d) as a segmented control beside it, so that I can change the pace without opening a menu.
7. As a user, I want to choose long or short for the Entry Rule in the Entry group's header, so that the direction sits next to the rule it applies to.

### Building rules with tiles

8. As a user, I want my strategy shown as an Entry group ("Buy when …") and an Exit group ("Sell when …"), each with any number of conditions, so that I can read it like a sentence.
9. As a user, I want each condition drawn as one tile split in three: what is measured, how it compares, and against what, so that every rule is readable at a glance.
10. As a user, I want to switch a group between "all of these" and "any of these" with one click on its header, so that I can choose AND or OR without building logic blocks.
11. As a user, I want to add a group inside a group (for example "any of these" inside an "all of these"), so that I can still express nested logic when I need it.
12. As a user, I want to turn a condition into its opposite ("is not"), so that negation is available without a separate NOT block.
13. As a user, I want a palette of ready conditions (RSI below 30, EMA 20 crosses above SMA 50, price above the 200 SMA, MACD crosses its signal, price below the lower Bollinger Band, and similar) that I can drag into a group, so that I start from sensible rules instead of empty tiles.
14. As a user, I want the place where a dragged tile will land to open up to the tile's exact size and nothing else to move, so that dropping feels calm and predictable.
15. As a user, I want the dragged tile to lift with a shadow while it is in my hand, so that I know what I am moving.
16. As a user, I want to reorder conditions and move them between the Entry and Exit groups by dragging, so that I can rearrange without retyping.
17. As a user, I want an "Add condition" button at the end of every group, so that I can build without dragging (keyboard, touch, or by preference).
18. As a user, I want to click any part of a tile to change it in a small popover (the indicator and its parameters, the comparison, the value or the second indicator), so that editing never needs a separate form.
19. As a user, I want indicators for price (open, high, low, close), volume, SMA, EMA, RSI, MACD (line, signal, histogram) and Bollinger Bands (upper, middle, lower) with editable periods, so that I can express the strategies I find online.
20. As a user, I want comparisons "is above", "is below", "crosses above" and "crosses below", so that conditions read as plain English.
21. As a user, I want to compare an indicator with a number or with another indicator, so that both "RSI is below 30" and "EMA 20 crosses above SMA 50" are possible.
22. As a user, I want to remove a condition with a delete control on the tile or by dragging it out of the editor, so that cleanup is quick.
23. As a user, I want an invalid value (a period of 0, an empty number) marked on the tile itself with a short reason, so that I fix it where it is.
24. As a user, I want undo and redo for my edits (buttons and the usual shortcuts), so that experimenting is safe.

### Exits and risk

25. As a user, I want stop-loss and take-profit shown as tiles in the Exit group ("Stop-loss at −5%", "Take-profit at +15%"), so that every way out reads the same way as an exit condition.
26. As a user, I want a strategy to be complete with an exit condition, a stop-loss, a take-profit, or any mix of them, so that I can close positions the way I trade.
27. As a user, I want Position Size as a percentage of the account, with 100% by default, so that I do not have to set it to see a first result.

### Execution Model

28. As a user, I want the execution assumptions (commission, slippage, next-bar fill) listed under the rules as in the hero window, so that I always see how the result is counted.
29. As a user, I want to pick an Execution Preset or edit commission and slippage myself from that list, so that I can model my own exchange.

### Results

30. As a user, I want a TradingView-style chart of the Instrument with every entry and exit marked, volume underneath and my balance against simply holding in a pane below, so that I see where and how the strategy traded.
31. As a user, I want the crosshair to show open, high, low and close of the bar under it, so that I can read prices like in a trading app.
32. As a user, I want to zoom and pan the chart, so that I can inspect individual trades on long histories.
33. As a user, I want the strategy tester overview under the chart (the gap to holding first, then net profit, holding, closed trades, profitable share, best and worst trade, max drawdown, fees paid), so that I judge the result in the order that matters.
34. As a user, I want the gap to holding written in dollars on the starting amount ("$6,828 more than holding SOL"), so that I understand it without trading vocabulary.
35. As a user, I want a list of trades (entry, exit, direction, result) that scrolls inside its panel, and clicking a trade to move the chart to it, so that I can inspect any trade.
36. As a user, I want the Preview to rerun automatically after every change and keep the previous result visible but dimmed while it runs, so that nothing flickers or jumps.
37. As a user, I want quick successive edits to show only the latest result, so that what I see always matches my strategy.
38. As a user, I want a "Run the full history" action, with a clear label of which period the result covers, so that I can test over years when I want.
39. As a user, I want a plain message instead of a chart when the strategy is incomplete ("Add a way to sell") or made no trades, with the next step to take, so that an empty state always tells me what to do.
40. As a user, I want a clear message with a retry when the backend cannot be reached, so that I know the problem is not my strategy.

### Assistant

41. As a user, I want to open the assistant from the toolbar as a side panel over the results, so that the editor stays in view while I chat.
42. As a user, I want to describe a strategy in a sentence and get an answer drawn as the same tiles, with what was not possible said in words, so that I can check what it understood.
43. As a user, I want to apply the assistant's answer to my strategy with one button, and undo it, so that I never lose my work by accident.
44. As a user, I want follow-up suggestions under each answer, so that I know what to ask next.
45. As a user, I want a friendly message when the assistant's limit is reached, so that I know to build by hand for now.

### Saving and sharing

46. As a user, I want to save several named strategies in the browser and switch between them from the toolbar, so that I can compare ideas.
47. As a user, I want to download and open a strategy as a JSON file, so that I can keep it or move it to another device.
48. As a user, I want a clear error when an opened file is not a valid strategy, so that I know why it did not load.
49. As a user, I want to copy a share link from the toolbar and see a short confirmation, so that I know it worked.
50. As a user, I want to see the strategy's JSON in a side tab, so that the technical visitor can see exactly what the engine runs.

### Look, feel and access

51. As a user, I want the builder to follow my browser's light or dark setting, with the same toggle as the landing page, so that the two feel like one product.
52. As a user, I want every control to answer hover, press and focus the way the landing page's controls do, so that the app feels finished.
53. As a user on a phone, I want the rules and the results as two tabs, and conditions added by button and popover, so that I can build without dragging on a small screen.
54. As a keyboard user, I want to reach and edit every tile, group and toolbar control with the keyboard, with visible focus, so that I can build without a mouse.
55. As a user, I want a visible note that results are simulations on historical data and not investment advice, so that expectations are clear.
56. As a user with reduced motion turned on, I want tiles and panels to change without animation, so that the builder is comfortable to use.

## Implementation Decisions

- **Blockly is removed entirely**: its editor, block definitions, toolbox and theme, the workspace converters and their tests, and the two Blockly packages. The builder's folders in the repo map change accordingly.
- **One editable model of the strategy in the browser**, shaped like the landing's rule groups: an Entry group and an Exit group, each a group with a match mode (all / any) holding an ordered list of items; an item is a condition (left operand, comparison, right operand or number, optional negation) or a nested group. Stop-loss and take-profit live in the Exit group as risk items. This model converts both ways to the schema's strategy draft: groups map to and / or, negation to not, risk items to the exit's percentages. Every item carries a stable id for drag and drop and for undo.
- **A deep "strategy document" module** owns that model and every edit as pure functions (add, remove, move, change part, toggle match, wrap in group, negate), plus conversion to and from the strategy draft, validation messages per item, and the list of missing required parts. The page and the components only call it. Undo and redo keep a short history of documents.
- **The tile components are shared with the landing page**: the landing's read-only rule display becomes the editable builder's view in a display mode, so the two can never drift apart again.
- **Drag and drop uses vue-draggable-plus** (Vue 3 wrapper of SortableJS, maintained, small; chosen in the review of this spec). Palette to group is a clone; group to group is a move. A tile dropped outside the editor is removed. Touch dragging is off on phones, where "Add condition" and the popovers do the job.
- **Editing parts uses one popover component**, anchored to the clicked part, opening from it (scale from 0.95), closing toward it, keyboard navigable.
- **Results reuse the landing's chart pieces**: the TradingView-style chart gains zoom and pan, live data from the API instead of the precomputed demo, trade markers from the API's trades and a "go to trade" action. The strategy tester overview reads the API's metrics. The trade list is new.
- **The API stays as it is**: instruments, execution presets, backtest (preview and full) and the AI builder. The existing backtest composable (latest result wins, previous result kept while loading) is kept.
- **Theme and tokens**: the landing's light and dark tokens move to a shared stylesheet so the builder uses the same surfaces, panel colours and focus styles; the builder stays client-only.
- **Saving, files and share links keep their current formats**, so saved strategies and existing links still open.
- **Layout**: desktop is the hero window at full height (toolbar; rules column about 24rem; chart and tester filling the rest; trades under the tester). The assistant and the JSON view are a right-hand side panel. Below about 900px, rules and results become two tabs.

## Testing Decisions

- Tests check behaviour through the strategy document module's public functions only: an edit produces the expected document, a document converts to the expected strategy draft and back, invalid items get the expected messages, missing parts are listed. No component tests of drag and drop internals.
- Prior art: the current converter tests (blocks to strategy JSON, files and share links). The strategy files tests stay as they are; the block converter tests are replaced by document tests covering the same strategies (the example strategy, nested and / or / not, short entries, exits with only stop-loss or only take-profit, every indicator kind).
- Round-trip tests: every strategy the old editor could express, and every assistant answer shape, converts to the document and back to an identical draft, so share links and saved strategies keep working.
- The backend tests are untouched; the API does not change.
- A manual pass in a real browser at 1440, 1024 and 390 wide, in both themes, before the work is called done.

## Out of Scope

- New indicators, comparisons or schema changes; new markets or timeframes.
- Accounts, server-side saving, or comparing two strategies side by side.
- Changes to the landing page beyond extracting the shared tiles, chart pieces and theme tokens.
- Live trading, alerts or any connection to an exchange.
- Changes to the assistant's backend prompt or its rate limit.

## Further Notes

- New dependency: vue-draggable-plus (with SortableJS). Two dependencies leave: blockly and @blockly/continuous-toolbox.
- GLOSSARY.md defines a Block as something the user drags into the editor; the tiles are the new Blocks, so the term stays and its definition gets a light edit when this lands.
- ADR 0001 (a strategy is a JSON document, never generated code) holds unchanged.
- Suggested order of work: the strategy document module with its tests first, then the editable tiles on it, then the results side with live data, then toolbar, saving and sharing, then the assistant panel, then phone layout and the final pass.
