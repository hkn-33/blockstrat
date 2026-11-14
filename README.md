<p align="center">
  <img src="docs/images/logo.svg" alt="BlockStrat logo" width="96" height="96">
</p>

<h1 align="center">BlockStrat</h1>

<p align="center">
  <strong>Test a trading idea before you risk money on it.</strong>
  <br>
  Build a crypto strategy from blocks, or just describe it, and see how it would have done on real Binance prices.
  <br><br>
  <a href="https://blockstrat.vercel.app"><strong>Open BlockStrat →</strong></a>
  <br>
  Beta · Free for personal use · No sign-up · Open source (AGPL-3.0)
</p>

![The BlockStrat landing page](docs/images/landing.png)

## Why

"Buy when RSI drops below 30" sounds good in a video. BlockStrat replays an idea like that on years of real prices, fees included, and tells you plainly what would have happened: the profit or loss, the worst drop on the way, and whether simply holding the coin would have done better. No code, no spreadsheet, a few seconds.

BlockStrat never trades and never touches your money. It is a simulator, not investment advice.

## How it works

**1. Start from an idea.** Build it from scratch, describe it to the assistant, or pick one of eight well-known strategies.

![Starting a new strategy](docs/images/templates.png)

**2. Snap the rules together.** Pick the markets, then when to buy and when to sell, from readable blocks like *SMA 20 crosses above SMA 50*. Add a stop-loss or take-profit if you want.

![A strategy being built block by block](docs/images/build-demo.gif)

**3. Read the verdict.** Every change replays the test in under a second, on each market you picked, side by side.

![The result of a strategy tested on Solana, Bitcoin and Ethereum](docs/images/builder.png)

## Describe it instead

Write the idea the way you would text a friend. The assistant turns it into the same editable blocks, never hidden code. During the beta it answers up to **10 messages an hour**.

![The assistant turning a sentence into blocks](docs/images/assistant-demo.gif)

## Mark trades, get the rules

Draw the trades you would have taken on a chart, and BlockStrat finds rules that would have taken similar ones, tested on years of candles.

![Marking trades on a chart and finding the strategy behind them](docs/images/mark-trades-demo.gif)

## License

Free for personal use; business use needs an agreement (hakendev@gmail.com). The code is open source under the [AGPL-3.0](LICENSE). See the site's [Terms](https://blockstrat.vercel.app/terms) and [Privacy Policy](https://blockstrat.vercel.app/privacy).
