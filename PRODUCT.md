# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary:** someone who wants to start making money from trading, has found strategies online (videos, forums, "buy when RSI < 30"), and wants to know whether they would actually have worked before risking money. Not technical, does not code.
- **Secondary:** recruiters and developers looking at this as a portfolio piece. They should find it interesting how it was built: fast backtests, real market data, and AI that turns natural language into a strategy.

## Product Purpose

BlockStrat lets a person build a trading strategy from Scratch-like blocks, or describe it in plain words to an AI that builds the blocks, and instantly see how it would have done on years of real crypto prices. Success: a non-technical visitor feels this is a breakthrough ("I can test my idea myself, in seconds"); a technical visitor wants to look under the hood. It has to impress. It is not being sold.

## Positioning

- Strategies are blocks you can see and change, never hidden generated code.
- Every change reruns a backtest in well under a second.
- The AI produces those same blocks, so you can check what it understood.
- Results are honest by default: next-bar fills, trading costs, always compared with buy-and-hold.

## Operating Context

- Landing page at `/` (prerendered). The builder lives at `/app` and runs only in the browser.
- Market data: Binance public klines for 10 USDT pairs; 1h, 4h and 1d timeframes; history back to 2017 where available.
- Strategies can be saved in the browser, downloaded as a file, or shared as a link.

## Capabilities and Constraints

- Indicators: price, SMA, EMA, RSI, MACD, Bollinger Bands.
- Conditions: comparisons, crosses, and all/any/not combinations.
- Exits: an exit condition, stop-loss and take-profit. Position size is configurable.
- Two backtest modes: Preview (about the last 3000 bars, fast) and Full history.
- AI builder: Gemini, rate-limited per IP.
- It never trades, never asks for exchange keys, and is not investment advice.
- Free, no account.

## Brand Commitments

- Name: BlockStrat.
- Copy is in English, plain and non-technical.

## Evidence on Hand

- **Real:** the working engine, Binance data, and real backtest results (for example, the EMA20/SMA50 BTC example in the builder).
- **Not real yet:** no users, testimonials, usage numbers or press. The user explicitly allowed invented placeholder proof (testimonials, counts) for the redesign previews so the page looks finished. Every invented item must be listed so it can be replaced before launch.

## Product Principles

1. Show, don't claim: the page demonstrates blocks turning into a result.
2. Honest numbers beat impressive numbers.
3. A non-technical visitor understands every sentence; the technical depth is there for whoever looks for it.
4. Speed is part of the product: it should feel instant.
