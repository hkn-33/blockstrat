<script setup lang="ts">
import type { StrategyBlock } from '~/components/landing/BlockStack.vue'

useSeoMeta({
  title: 'BlockStrat: test a trading idea before you risk money',
  ogTitle: 'BlockStrat: test a trading idea before you risk money',
  description: 'Snap a trading strategy together from blocks, or describe it in a sentence, and see how it would have done on real crypto prices since 2017. No code.',
  ogDescription: 'Build a trading strategy from blocks or a sentence and backtest it on real crypto prices since 2017.',
})

const HERO_BLOCKS: StrategyBlock[] = [
  { tone: 'entry', label: 'Buy when', parts: ['EMA', { value: '20' }, 'crosses above SMA', { value: '50' }] },
  { tone: 'exit', label: 'Sell when', parts: ['EMA', { value: '20' }, 'crosses below SMA', { value: '50' }] },
  { tone: 'risk', label: 'Stop-loss', parts: [{ value: '5%' }, 'below entry'] },
]

const heroRun = demoRun('trend', 'ETHUSDT', 5)

const STACK = [
  { icon: 'python', name: 'Python' },
  { icon: 'fastapi', name: 'FastAPI' },
  { icon: 'pandas-icon', name: 'pandas' },
  { icon: 'nuxt', name: 'Nuxt' },
  { icon: 'vue', name: 'Vue' },
  { icon: 'typescript', name: 'TypeScript' },
  { icon: 'gemini', name: 'Gemini' },
  { icon: 'docker', name: 'Docker' },
]

const COINS = ['bitcoin', 'ethereum', 'solana']

// Placeholder proof: invented for the preview, replace before launch.
const QUOTES = [
  { text: 'I copied an RSI strategy from a video and was about to put $2,000 on it. The test said minus 97%. I kept my money.', name: 'Marta K.', detail: 'Tested 14 strategies', result: 'Kept $2,000' },
  { text: 'I typed one sentence and got blocks I could read. Changing one number and watching the chart redraw is addictive.', name: 'Tomasz W.', detail: 'First strategy in 4 minutes', result: 'Found +212%' },
  { text: 'Fees were eating more than half my profit and I had no idea. Seeing them per trade changed how often I trade.', name: 'Ola P.', detail: 'Trades on weekends', result: '$1,840 in fees spotted' },
]

const FAQ = [
  { question: 'Do I need to know how to code?', answer: 'No. Describe the idea in a sentence or snap the blocks together. You never see code.' },
  { question: 'Does BlockStrat trade for me?', answer: 'No. It never places orders, never asks for exchange keys and never touches your money.' },
  { question: 'Is this investment advice?', answer: 'No. A strategy that worked on past prices can still lose money in the future.' },
  { question: 'Where do the prices come from?', answer: 'Binance public market data: hourly, four-hourly and daily candles for ten large crypto pairs.' },
  { question: 'Can I share a strategy?', answer: 'Yes. Copy the link and anyone who opens it sees your blocks and the result.' },
  { question: 'Does it cost anything?', answer: 'No. It is free and needs no sign-up.' },
]
</script>

<template>
  <div class="lp">
    <section class="hero">
      <div class="glow" aria-hidden="true" />
      <div class="grain" aria-hidden="true" />

      <header class="wrap relative z-10 flex items-center justify-between gap-6 py-5">
        <NuxtLink to="/" class="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4">
          <BrandLogo inverted />
        </NuxtLink>
        <nav class="hidden items-center gap-8 text-[15px] font-medium text-white/75 md:flex" aria-label="Main">
          <a href="#how" class="nav-link">How it works</a>
          <a href="#try" class="nav-link">Try it</a>
          <a href="#ai" class="nav-link">Assistant</a>
          <a href="#faq" class="nav-link">Questions</a>
        </nav>
        <NuxtLink to="/app" class="btn btn-lime btn-small">
          Open the builder
        </NuxtLink>
      </header>

      <div class="wrap relative z-10 grid gap-14 pb-28 pt-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16 lg:pb-36 lg:pt-20">
        <div class="hero-copy min-w-0">
          <h1 class="headline">
            Test it before you trade it.
          </h1>
          <p class="mt-7 max-w-[31rem] text-[19px] leading-[1.6] text-white/75">
            Snap a strategy together from blocks, or just describe it. BlockStrat replays it on real crypto prices since
            2017, fees included, and tells you if it beat simply holding.
          </p>
          <div class="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
            <NuxtLink to="/app" class="btn btn-lime">
              Start testing for free
              <UiIcon name="arrow-right" class="arrow" />
            </NuxtLink>
            <a href="#try" class="text-link">See a live example</a>
          </div>
          <div class="mt-12 flex flex-wrap items-center gap-x-5 gap-y-3 text-[14px] text-white/65">
            <span class="flex -space-x-2">
              <img v-for="coin in COINS" :key="coin" :src="`/brand-icons/${coin}.svg`" alt="" class="coin">
            </span>
            <span>10 crypto pairs</span>
            <span class="flex items-center gap-2">
              <img src="/brand-icons/binance.svg" alt="" class="h-5 w-5">
              Binance price data
            </span>
          </div>
        </div>

        <div class="glass min-w-0">
          <LandingBlockStack market="ETH/USDT" timeframe="4 hours" :blocks="HERO_BLOCKS" theme="dark" entrance />
          <div class="hero-result">
            <LandingResultCard :run="heroRun" holding-label="Holding ETH" :entrance-delay-ms="1800" :chart-height="150" />
          </div>
        </div>
      </div>
    </section>

    <section class="wrap py-12" aria-label="What BlockStrat is built with">
      <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <p class="text-[15px] font-medium text-[var(--muted)]">
          Built on the tools trading desks and data teams use
        </p>
        <ul class="flex flex-wrap items-center gap-x-8 gap-y-4">
          <li v-for="tool in STACK" :key="tool.name" class="flex items-center gap-2 text-[15px] font-semibold text-[var(--ink-soft)]">
            <img :src="`/brand-icons/${tool.icon}.svg`" alt="" class="h-6 w-6">
            {{ tool.name }}
          </li>
        </ul>
      </div>
    </section>

    <div id="how" class="canvas scroll-mt-4">
      <LandingPinnedSteps />
    </div>

    <section id="try" class="wrap scroll-mt-4 py-24 lg:py-32">
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
        <h2 class="section-title">
          Change a block. Nine years replay in a blink.
        </h2>
        <p class="max-w-[30rem] text-[18px] leading-[1.6] text-[var(--ink-soft)]">
          Real tests on four-hour Binance candles. Try the famous RSI dip-buy on Ethereum and watch it lose to just holding.
        </p>
      </div>
      <div class="try-stage mt-12">
        <LandingTryIt />
      </div>
    </section>

    <section id="ai" class="dark scroll-mt-4">
      <div class="glow glow--dark" aria-hidden="true" />
      <div class="grain" aria-hidden="true" />
      <div class="wrap relative z-10 py-24 lg:py-32">
        <div class="max-w-[44rem]">
          <h2 class="section-title text-white">
            Say it in a sentence. Get blocks you can read.
          </h2>
          <p class="mt-5 text-[18px] leading-[1.6] text-white/70">
            The assistant builds the same blocks you would, so you see exactly what it understood. If part of your idea
            can't be built, it tells you.
          </p>
        </div>
        <div class="mt-14">
          <LandingAiDemo />
        </div>
      </div>
    </section>

    <section class="wrap grid gap-12 py-24 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:py-32">
      <div>
        <h2 class="section-title">
          Ten markets, one honest engine.
        </h2>
        <p class="mt-5 max-w-[28rem] text-[18px] leading-[1.6] text-[var(--ink-soft)]">
          Binance candles for ten USDT pairs, cached and refreshed daily, feed the same engine the builder uses.
        </p>
        <dl class="mt-8 grid grid-cols-3 gap-6">
          <div>
            <dt class="text-[14px] text-[var(--muted)]">
              Pairs
            </dt>
            <dd class="text-[30px] font-bold tabular-nums tracking-[-0.03em]">
              10
            </dd>
          </div>
          <div>
            <dt class="text-[14px] text-[var(--muted)]">
              Since
            </dt>
            <dd class="text-[30px] font-bold tabular-nums tracking-[-0.03em]">
              2017
            </dd>
          </div>
          <div>
            <dt class="text-[14px] text-[var(--muted)]">
              Per test
            </dt>
            <dd class="text-[30px] font-bold tabular-nums tracking-[-0.03em]">
              &lt;0.1 s
            </dd>
          </div>
        </dl>
      </div>
      <div class="flow-stage">
        <ClientOnly>
          <LandingDataFlow />
        </ClientOnly>
      </div>
    </section>

    <section id="honest" class="canvas scroll-mt-4">
      <div class="wrap py-24 lg:py-32">
        <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
          <h2 class="section-title">
            Results that don't flatter you.
          </h2>
          <p class="max-w-[30rem] text-[18px] leading-[1.6] text-[var(--ink-soft)]">
            Most backtests look great because they quietly cheat. BlockStrat counts the way a real exchange would.
          </p>
        </div>

        <div class="bento mt-14">
          <article class="tile tile-wide">
            <h3 class="tile-title">
              <span class="tile-icon"><UiIcon name="candlestick-chart" /></span>Orders fill at the next candle
            </h3>
            <p class="tile-text">
              A signal on a candle's close buys at the next candle's open, the price you could really have got.
            </p>
            <div class="mt-5 h-[230px]">
              <ClientOnly>
                <LandingSignalCandles />
              </ClientOnly>
            </div>
          </article>

          <article class="tile">
            <h3 class="tile-title">
              <span class="tile-icon"><UiIcon name="calculator" /></span>Every fee on the bill
            </h3>
            <p class="tile-text">
              0.1% a side and 0.05% slippage by default, or your exchange's own numbers.
            </p>
            <dl class="fees mt-6">
              <div><dt><img src="/brand-icons/ethereum.svg" alt="" class="h-5 w-5"> Buy ETH</dt><dd>$10.00</dd></div>
              <div><dt><img src="/brand-icons/ethereum.svg" alt="" class="h-5 w-5"> Sell ETH</dt><dd>$10.41</dd></div>
              <div><dt><UiIcon name="zap" /> Slippage</dt><dd>$5.10</dd></div>
              <div class="fees-total">
                <dt>This trade cost</dt><dd>$25.51</dd>
              </div>
            </dl>
          </article>

          <article class="tile">
            <h3 class="tile-title">
              <span class="tile-icon"><UiIcon name="trending-up" /></span>Always next to holding
            </h3>
            <p class="tile-text">
              If simply holding the coin did better, the result says so.
            </p>
            <div class="mt-6 grid gap-4 text-[15px]">
              <div>
                <div class="flex justify-between">
                  <span>Trend strategy</span><span class="font-bold tabular-nums text-[var(--gain)]">+1,924%</span>
                </div>
                <div class="bar mt-2">
                  <span style="width: 100%" class="bg-[var(--gain)]" />
                </div>
              </div>
              <div>
                <div class="flex justify-between">
                  <span>Holding ETH</span><span class="font-bold tabular-nums">+580%</span>
                </div>
                <div class="bar mt-2">
                  <span style="width: 30%" class="bg-[#a3b1b9]" />
                </div>
              </div>
            </div>
          </article>

          <article class="tile tile-wide">
            <h3 class="tile-title">
              <span class="tile-icon"><UiIcon name="gauge" /></span>The worst drop, in plain sight
            </h3>
            <p class="tile-text">
              Even the winner above spent months 49% under its high. You see that before you see the return.
            </p>
            <div class="mt-5 h-[200px]">
              <ClientOnly>
                <LandingEquityChart :run="heroRun" variant="drawdown" />
              </ClientOnly>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section class="wrap py-24 lg:py-28" aria-labelledby="quotes-title">
      <h2 id="quotes-title" class="section-title max-w-[36rem]">
        What early testers found.
      </h2>
      <div class="mt-12 grid gap-5 lg:grid-cols-3">
        <figure v-for="quote in QUOTES" :key="quote.name" class="quote">
          <p class="quote-result">
            {{ quote.result }}
          </p>
          <blockquote class="mt-3 text-[17px] leading-[1.6] text-[var(--ink)]">
            “{{ quote.text }}”
          </blockquote>
          <figcaption class="mt-6 text-[14px] text-[var(--muted)]">
            <span class="font-bold text-[var(--ink)]">{{ quote.name }}</span>, {{ quote.detail }}
          </figcaption>
        </figure>
      </div>
    </section>

    <section id="faq" class="wrap grid scroll-mt-4 gap-10 pb-28 pt-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <h2 class="section-title">
        Questions
      </h2>
      <dl class="grid gap-x-10 gap-y-9 sm:grid-cols-2">
        <div v-for="item in FAQ" :key="item.question">
          <dt class="text-[17px] font-bold text-[var(--ink)]">
            {{ item.question }}
          </dt>
          <dd class="mt-2 text-[15px] leading-[1.6] text-[var(--ink-soft)]">
            {{ item.answer }}
          </dd>
        </div>
      </dl>
    </section>

    <footer class="closing">
      <div class="glow glow--closing" aria-hidden="true" />
      <div class="grain" aria-hidden="true" />
      <div class="wrap relative z-10 pt-24 lg:pt-28">
        <div class="flex flex-col items-start gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 class="section-title max-w-[32rem] text-white">
              Your first test takes about a minute.
            </h2>
            <p class="mt-4 text-[18px] text-white/70">
              Free, no sign-up. An example strategy is already loaded.
            </p>
          </div>
          <NuxtLink to="/app" class="btn btn-lime">
            Start testing for free
            <UiIcon name="arrow-right" class="arrow" />
          </NuxtLink>
        </div>
        <p class="wordmark" aria-hidden="true">
          BlockStrat
        </p>
        <div class="flex flex-col gap-3 border-t border-white/15 py-8 text-[14px] text-white/60 md:flex-row md:items-center md:justify-between">
          <span>© 2026 BlockStrat. Simulations on historical Binance data, not investment advice.</span>
          <span>Quotes on this preview are placeholders. Product names and logos are trademarks of their owners.</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<style>
.lp {
  --ink: #0d1b24;
  --ink-soft: #394c57;
  --muted: #5a6c77;
  --line: #dde6e9;
  --ice: #eef5f6;
  --petrol: #0e3f47;
  --petrol-deep: #082a30;
  --lime: #c8f25a;
  --blue: #2f6bff;
  --gain: #0e9963;
  --loss: #e5483e;
  --logo-accent: #c8f25a;
  font-family: "Satoshi", ui-sans-serif, system-ui, sans-serif;
}

.lp ::selection {
  background: var(--lime);
  color: var(--ink);
}

/* Shared by the page and its section components. */
.lp .wrap {
  width: min(100% - 2.5rem, 1320px);
  margin-inline: auto;
}

@media (min-width: 640px) {
  .lp .wrap {
    width: min(100% - 4rem, 1320px);
  }
}

.lp .section-title {
  font-size: clamp(2.1rem, 3.8vw, 3.25rem);
  font-weight: 700;
  line-height: 1.04;
  letter-spacing: -0.03em;
  text-wrap: balance;
}

.lp p {
  text-wrap: pretty;
}
</style>

<style scoped>
.lp {
  overflow-x: clip;
  background: #ffffff;
  color: var(--ink);
}

.headline {
  font-size: clamp(3rem, 6.4vw, 5.75rem);
  font-weight: 700;
  line-height: 0.98;
  letter-spacing: -0.04em;
  color: #ffffff;
  text-wrap: balance;
}

/* Hero: petrol ground, slowly drifting light, film grain over it. */
.hero {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: var(--petrol-deep);
}

.glow {
  position: absolute;
  inset: -20%;
  z-index: 0;
  background:
    radial-gradient(30% 35% at 72% 38%, rgb(200 242 90 / 0.5), transparent 70%),
    radial-gradient(32% 40% at 88% 72%, rgb(47 107 255 / 0.65), transparent 70%),
    radial-gradient(35% 40% at 56% 80%, rgb(16 163 160 / 0.6), transparent 70%),
    radial-gradient(40% 45% at 18% 12%, rgb(16 120 130 / 0.45), transparent 70%);
  filter: blur(24px);
  animation: drift 24s ease-in-out infinite alternate;
}

.glow--dark {
  background:
    radial-gradient(30% 40% at 85% 20%, rgb(47 107 255 / 0.45), transparent 70%),
    radial-gradient(30% 40% at 10% 90%, rgb(16 163 160 / 0.4), transparent 70%);
}

.glow--closing {
  background:
    radial-gradient(35% 45% at 80% 10%, rgb(200 242 90 / 0.35), transparent 70%),
    radial-gradient(35% 45% at 20% 30%, rgb(47 107 255 / 0.45), transparent 70%);
}

@keyframes drift {
  to {
    transform: translate(3%, -2%) scale(1.05);
  }
}

/* Film grain over the coloured light, the texture of a printed photograph. */
.grain {
  position: absolute;
  inset: 0;
  z-index: 0;
  opacity: 0.22;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  pointer-events: none;
}

/* Frosted glass in the Apple and HyperOS manner: heavy blur, a bright rim on top, soft depth. */
.glass {
  position: relative;
  display: grid;
  gap: 1rem;
  border-radius: 34px;
  background: linear-gradient(160deg, rgb(255 255 255 / 0.16), rgb(255 255 255 / 0.05));
  padding: clamp(1rem, 2.5vw, 1.75rem);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.35),
    inset 0 0 0 1px rgb(255 255 255 / 0.12),
    0 50px 100px -40px rgb(0 0 0 / 0.65);
  backdrop-filter: blur(40px) saturate(1.8);
}

@media (min-width: 1024px) {
  .hero-result {
    margin-right: -2.5rem;
    margin-left: 2.5rem;
  }
}

.hero-result {
  animation: rise 650ms cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: 1700ms;
}

.hero-copy > * {
  animation: rise 800ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.hero-copy > :nth-child(2) { animation-delay: 90ms; }
.hero-copy > :nth-child(3) { animation-delay: 180ms; }
.hero-copy > :nth-child(4) { animation-delay: 270ms; }

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
}

.coin {
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  background: #ffffff;
  padding: 3px;
  box-shadow: 0 0 0 2px var(--petrol-deep);
}

.nav-link:hover {
  color: #ffffff;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  border-radius: 14px;
  padding: 0.95rem 1.5rem;
  font-size: 16px;
  font-weight: 700;
  transition: background-color 160ms, transform 120ms;
}

.btn:hover .arrow {
  transform: translateX(4px);
}

.btn:active {
  transform: scale(0.97);
}

.btn-small {
  padding: 0.6rem 1.1rem;
  font-size: 15px;
}

.btn-lime {
  background: var(--lime);
  color: var(--ink);
}

.btn-lime:hover {
  background: #d6f87c;
}

.arrow {
  width: 1.1em;
  height: 1.1em;
  transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.text-link {
  font-weight: 700;
  color: #ffffff;
  text-decoration: underline;
  text-decoration-color: rgb(255 255 255 / 0.35);
  text-decoration-thickness: 1.5px;
  text-underline-offset: 0.35em;
}

.text-link:hover {
  text-decoration-color: #ffffff;
}

.btn:focus-visible,
.text-link:focus-visible,
.nav-link:focus-visible {
  outline: 2px solid var(--lime);
  outline-offset: 3px;
}

/* The editor's dotted canvas, used as the ground for the product sections. */
.canvas {
  background-color: var(--ice);
  background-image: radial-gradient(#c5d6db 1.1px, transparent 1.1px);
  background-size: 22px 22px;
}

.try-stage {
  border-radius: 32px;
  background: linear-gradient(150deg, #e4f4f0 0%, #eaeffe 100%);
  padding: clamp(1rem, 3vw, 2.75rem);
}

.dark {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: var(--petrol-deep);
  color: #ffffff;
}

.flow-stage {
  overflow: hidden;
  border-radius: 32px;
  background: linear-gradient(150deg, #e4f4f0, #eaeffe);
}

.bento {
  display: grid;
  gap: 1rem;
}

@media (min-width: 900px) {
  .bento {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .tile {
    grid-column: span 2;
  }

  .tile-wide {
    grid-column: span 3;
  }
}

.tile {
  min-width: 0;
  border-radius: 26px;
  background: #ffffff;
  padding: 1.75rem;
  box-shadow: 0 1px 2px rgb(13 27 36 / 0.05), 0 20px 40px -28px rgb(13 27 36 / 0.35);
}

.tile-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 19px;
  font-weight: 700;
}

.tile-icon {
  display: inline-grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border-radius: 11px;
  background: var(--petrol);
  color: var(--lime);
}

.tile-text {
  margin-top: 0.75rem;
  max-width: 30rem;
  font-size: 15px;
  line-height: 1.6;
  color: var(--ink-soft);
}

.fees {
  display: grid;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}

.fees div {
  display: flex;
  justify-content: space-between;
  padding-block: 0.6rem;
}

.fees div + div {
  border-top: 1px solid var(--line);
}

.fees dt {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.fees dd {
  color: var(--ink-soft);
}

.fees .fees-total {
  font-weight: 700;
}

.fees .fees-total dd {
  color: var(--loss);
}

.bar {
  height: 0.6rem;
  overflow: hidden;
  border-radius: 999px;
  background: #e7edf0;
}

.bar span {
  display: block;
  height: 100%;
  border-radius: 999px;
}

.quote {
  border-radius: 26px;
  background: var(--ice);
  padding: 1.75rem;
}

.quote-result {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--petrol);
}

.closing {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: var(--petrol-deep);
  color: #ffffff;
}

/* The name set across the whole width, as the page's last word. */
.wordmark {
  margin-top: 4rem;
  font-size: clamp(4.5rem, 17vw, 16rem);
  font-weight: 900;
  line-height: 0.8;
  letter-spacing: -0.06em;
  color: var(--lime);
  white-space: nowrap;
  transform: translateY(0.08em);
}

@media (prefers-reduced-motion: reduce) {
  .glow,
  .hero-copy > *,
  .hero-result {
    animation: none;
  }
}
</style>
