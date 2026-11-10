# A strategy is a JSON document, never generated code

Both the block editor and the AI assistant produce the same JSON strategy definition, and the Python backend validates it against one schema before running a backtest. We do not generate or execute Python (or any other code) from blocks or from LLM output: that keeps LLM output safe to run, lets the AI's result appear as editable blocks, and keeps the backtest engine swappable behind the schema.

## Consequences

- Anything a strategy can express must first exist in the schema; the AI cannot invent new indicators or operators on the fly.
