<script setup lang="ts">
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'

useSeoMeta({
  title: 'BlockStrat: test a trading idea before you risk money',
  ogTitle: 'BlockStrat: test a trading idea before you risk money',
  description: 'Snap a trading strategy together from blocks, or describe it in a sentence, and see how it would have done on real Binance prices. No code.',
  ogDescription: 'Build a trading strategy from blocks or a sentence and backtest it on real Binance prices.',
})

// The run the bento tiles quote: trend with an RSI filter on Solana, 5% stop.
const featuredRun = demoRun('combo', 'SOLUSDT', 5)
const featuredReturn = Math.round(featuredRun.metrics.total_return_pct)
const featuredHolding = Math.round(featuredRun.metrics.buy_and_hold_return_pct)
const featuredDrawdown = Math.round(Math.abs(featuredRun.metrics.max_drawdown_pct))

const COINS = ['bitcoin', 'ethereum', 'solana']

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value !== 'light')

function toggleTheme(): void {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}

// Smooth, eased scrolling on the landing page only; the builder keeps native scrolling for its editor.
let lenis: Lenis | undefined

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  lenis = new Lenis({ autoRaf: true, anchors: true })
})

onBeforeUnmount(() => lenis?.destroy())

const FAQ = [
  { question: 'Do I need to know how to code?', answer: 'No. Describe the idea in a sentence or snap the blocks together. You never see code.' },
  { question: 'Does BlockStrat trade for me?', answer: 'No. It never places orders, never asks for exchange keys and never touches your money.' },
  { question: 'Is this investment advice?', answer: 'No. A strategy that worked on past prices can still lose money in the future.' },
  { question: 'Where do the prices come from?', answer: 'Binance public market data: hourly, four-hourly and daily candles for ten large crypto pairs, back to 2017.' },
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
          <a href="#ai" class="nav-link">Assistant</a>
          <a href="#honest" class="nav-link">How it counts</a>
          <a href="#faq" class="nav-link">Questions</a>
        </nav>
        <div class="flex items-center gap-2">
          <ClientOnly>
            <button type="button" class="theme-toggle" :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'" @click="toggleTheme">
              <UiIcon :name="isDark ? 'sun' : 'moon'" />
            </button>
          </ClientOnly>
          <NuxtLink to="/app" class="btn btn-lime btn-small">
            Open the builder
          </NuxtLink>
        </div>
      </header>

      <div class="wrap relative z-10 pb-24 pt-14 lg:pb-28 lg:pt-28">
        <div class="hero-copy grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
          <h1 class="headline">
            Test it before you trade it
          </h1>
          <div class="lg:pt-3">
            <p class="max-w-[33rem] text-[19px] leading-[1.6] text-white/75">
              Snap a strategy together from blocks, or just describe it. BlockStrat replays it on real Binance prices,
              fees included, and tells you if it beat simply holding.
            </p>
            <div class="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <NuxtLink to="/app" class="btn btn-lime">
                Open the builder
                <UiIcon name="arrow-right" class="arrow" />
              </NuxtLink>
              <span class="flex items-center gap-3 text-[14px] text-white/70">
                <span class="flex -space-x-2">
                  <img v-for="coin in COINS" :key="coin" :src="`/brand-icons/${coin}.svg`" alt="" class="coin">
                </span>
                10 pairs, free, no sign-up
              </span>
            </div>
          </div>
        </div>

        <div class="product mt-14">
          <LandingProductWindow />
        </div>
      </div>
    </section>

    <div id="how" class="canvas scroll-mt-4">
      <LandingPinnedSteps />
    </div>

    <section id="ai" class="dark scroll-mt-4">
      <div class="wrap py-24 lg:py-32">
        <div class="max-w-[44rem]">
          <h2 class="section-title text-white">
            Describe a strategy and get blocks you can edit
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

    <section id="markets" class="scroll-mt-4">
      <div class="wrap py-24 lg:py-32">
        <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
          <h2 class="section-title">
            The same rules can win on one coin and lose on the next
          </h2>
          <p class="max-w-[30rem] text-[18px] leading-[1.6] text-[var(--ink-soft)]">
            Three strategies, three coins, the same 16 months and a 5% stop. Lime means the rules beat simply holding.
          </p>
        </div>
        <div class="mt-12">
          <LandingMarketGrid />
        </div>
      </div>
    </section>

    <section id="honest" class="canvas scroll-mt-4">
      <div class="wrap py-24 lg:py-32">
        <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
          <h2 class="section-title">
            Counted the way an exchange would count it
          </h2>
          <p class="max-w-[30rem] text-[18px] leading-[1.6] text-[var(--ink-soft)]">
            Many backtests look great because they quietly cheat. BlockStrat fills, charges and compares the way a real
            account would.
          </p>
        </div>

        <div class="bento mt-14">
          <article class="tile tile-wide">
            <h3 class="tile-title">
              Orders fill at the next candle
            </h3>
            <p class="tile-text">
              A signal on a candle's close buys at the next candle's open, the price you could really have got
            </p>
            <div class="mt-5 h-[230px]">
              <ClientOnly>
                <LandingSignalCandles />
              </ClientOnly>
            </div>
          </article>

          <article class="tile">
            <h3 class="tile-title">
              Every fee on the bill
            </h3>
            <p class="tile-text">
              0.1% a side and 0.05% slippage on each fill by default, or your exchange's own numbers.
            </p>
            <dl class="fees mt-6">
              <div><dt><img src="/brand-icons/ethereum.svg" alt="" class="fee-coin"> Buy $10,000 of ETH</dt><dd>$10.00</dd></div>
              <div><dt><img src="/brand-icons/ethereum.svg" alt="" class="fee-coin"> Sell at $10,410</dt><dd>$10.41</dd></div>
              <div><dt>Slippage, both fills</dt><dd>$10.21</dd></div>
              <div class="fees-total">
                <dt>This trade cost</dt><dd>$30.62</dd>
              </div>
            </dl>
          </article>

          <article class="tile">
            <h3 class="tile-title">
              Always next to holding
            </h3>
            <p class="tile-text">
              If simply holding the coin did better, the result says so
            </p>
            <div class="mt-6 grid gap-4 text-[15px]">
              <div>
                <div class="flex justify-between">
                  <span>Trend with filter, SOL</span><span class="font-bold tabular-nums text-[var(--color-gain)]">+{{ featuredReturn }}%</span>
                </div>
                <div class="diverging mt-2">
                  <span class="diverging-gain" :style="{ width: `${featuredReturn}%` }" />
                </div>
              </div>
              <div>
                <div class="flex justify-between">
                  <span>Holding SOL</span><span class="font-bold tabular-nums text-[var(--color-loss)]">−{{ Math.abs(featuredHolding) }}%</span>
                </div>
                <div class="diverging mt-2">
                  <span class="diverging-loss" :style="{ width: `${Math.abs(featuredHolding)}%` }" />
                </div>
              </div>
            </div>
          </article>

          <article class="tile tile-wide">
            <h3 class="tile-title">
              The worst drop, in plain sight
            </h3>
            <p class="tile-text">
              Even the strategy that beat holding spent weeks {{ featuredDrawdown }}% under its high, shown right next to the return
            </p>
            <div class="mt-5 h-[200px]">
              <ClientOnly>
                <LandingDrawdownChart market="SOLUSDT" :run="featuredRun" />
              </ClientOnly>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section id="faq" class="wrap grid scroll-mt-4 gap-12 py-24 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:py-28">
      <div>
        <h2 class="section-title">
          Questions
        </h2>
        <p class="mt-5 max-w-[24rem] text-[17px] leading-[1.6] text-[var(--ink-soft)]">
          The builder opens with an example strategy, so the fastest answer is often to change a block and watch.
        </p>
        <NuxtLink to="/app" class="btn btn-ink mt-8">
          Open the builder
          <UiIcon name="arrow-right" class="arrow" />
        </NuxtLink>
      </div>
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
      <div class="wrap pt-24 lg:pt-28">
        <div class="flex flex-col items-start gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 class="section-title max-w-[32rem] text-white">
              Your first test takes about a minute
            </h2>
            <p class="mt-4 text-[18px] text-white/70">
              Free, no sign-up, with an example strategy already loaded
            </p>
          </div>
          <NuxtLink to="/app" class="btn btn-lime">
            Open the builder
            <UiIcon name="arrow-right" class="arrow" />
          </NuxtLink>
        </div>
        <p class="wordmark" aria-hidden="true">
          BlockStrat
        </p>
        <div class="flex flex-col gap-4 border-t border-white/15 py-8 text-[14px] text-white/70 md:flex-row md:items-center md:justify-between">
          <span>© 2026 BlockStrat · Simulations on historical Binance data, not investment advice</span>
          <nav class="flex flex-wrap gap-x-6 gap-y-2" aria-label="Footer">
            <NuxtLink to="/app" class="footer-link">Builder</NuxtLink>
            <a href="#how" class="footer-link">How it works</a>
            <a href="#honest" class="footer-link">How it counts</a>
            <a href="#faq" class="footer-link">Questions</a>
          </nav>
        </div>
      </div>
    </footer>
  </div>
</template>

<style>
.lp {
  --page: #ffffff;
  --surface: #ffffff;
  --ink: var(--color-ink);
  --ink-soft: #394c57;
  --muted: #56676f;
  --line: #dde6e9;
  --tint: rgb(13 27 36 / 0.05);
  --tint-strong: #e7edf0;
  --canvas-bg: var(--color-canvas);
  --canvas-dots: var(--color-dots);
  --card-shadow: 0 1px 2px rgb(13 27 36 / 0.05), 0 20px 40px -28px rgb(13 27 36 / 0.35);
  font-family: var(--font-sans);
}

.dark .lp {
  --page: #071d21;
  --surface: #0e272c;
  --ink: #eaf2f3;
  --ink-soft: rgb(234 242 243 / 0.78);
  --muted: rgb(234 242 243 / 0.66);
  --line: rgb(255 255 255 / 0.09);
  --tint: rgb(255 255 255 / 0.06);
  --tint-strong: rgb(255 255 255 / 0.1);
  --canvas-bg: #0a2226;
  --canvas-dots: rgb(255 255 255 / 0.07);
  --card-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.07), 0 20px 40px -28px rgb(0 0 0 / 0.6);
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
  line-height: 1.06;
  letter-spacing: -0.02em;
  text-wrap: balance;
}

.lp p {
  text-wrap: pretty;
}
</style>

<style scoped>
.lp {
  overflow-x: clip;
  background: var(--page);
  color: var(--ink);
}

.headline {
  font-size: clamp(3rem, 6vw, 5rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.025em;
  color: #ffffff;
  text-wrap: balance;
}

/* Hero: petrol ground, one still pool of light, film grain over it. */
.hero {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: var(--color-petrol-deep);
}

.glow {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: radial-gradient(45% 55% at 78% 22%, rgb(200 242 90 / 0.28), transparent 70%);
}

.grain {
  position: absolute;
  inset: 0;
  z-index: 0;
  opacity: 0.2;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  pointer-events: none;
}

.product {
  border-radius: 28px;
  box-shadow: 0 50px 100px -40px rgb(0 0 0 / 0.7);
}

.hero-copy > * {
  animation: rise 550ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.hero-copy > :nth-child(2) {
  animation-delay: 90ms;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
}

.coin {
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  background: #ffffff;
  padding: 3px;
  box-shadow: 0 0 0 2px var(--color-petrol-deep);
}

.nav-link:hover,
.footer-link:hover {
  color: #ffffff;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  border-radius: 10px;
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
  background: var(--color-lime);
  color: var(--color-ink);
}

.btn-lime:hover {
  background: #d6f87c;
}

.btn-ink {
  background: var(--ink);
  color: var(--page);
}

.btn-ink:hover {
  opacity: 0.88;
}

.theme-toggle {
  display: grid;
  width: 2.6rem;
  height: 2.6rem;
  place-items: center;
  cursor: pointer;
  border-radius: 10px;
  color: rgb(255 255 255 / 0.8);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.16);
  transition: background-color 160ms, color 160ms;
}

.theme-toggle:hover {
  background: rgb(255 255 255 / 0.08);
  color: #ffffff;
}

.theme-toggle:focus-visible {
  outline: 2px solid var(--color-lime);
  outline-offset: 3px;
}

.arrow {
  width: 1.1em;
  height: 1.1em;
  transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.btn:focus-visible,
.nav-link:focus-visible,
.footer-link:focus-visible {
  outline: 2px solid var(--color-lime);
  outline-offset: 3px;
}

/* The editor's dotted canvas, used as the ground for the product sections. */
.canvas {
  background-color: var(--canvas-bg);
  background-image: radial-gradient(var(--canvas-dots) 1.1px, transparent 1.1px);
  background-size: 22px 22px;
}

.dark {
  background: var(--color-petrol-deep);
  color: #ffffff;
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
  border-radius: 28px;
  background: var(--surface);
  padding: 1.75rem;
  box-shadow: var(--card-shadow);
}

.tile-title {
  font-size: 19px;
  font-weight: 700;
}

.tile-text {
  margin-top: 0.6rem;
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
  gap: 1rem;
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

.fee-coin {
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 999px;
  background: #ffffff;
  padding: 2px;
  box-shadow: 0 0 0 1px var(--line);
}

.fees dd {
  color: var(--ink-soft);
}

.fees .fees-total {
  font-weight: 700;
}

.fees .fees-total dd {
  color: var(--color-loss);
}

/* Bars that grow out of one centre line: right for a gain, left for a loss. */
.diverging {
  position: relative;
  height: 0.6rem;
  border-radius: 999px;
  background: var(--tint-strong);
}

.diverging::after {
  position: absolute;
  top: -0.2rem;
  bottom: -0.2rem;
  left: 50%;
  width: 2px;
  background: #a3b1b9;
  content: "";
}

.diverging span {
  position: absolute;
  top: 0;
  bottom: 0;
  max-width: 50%;
  border-radius: 999px;
}

.diverging-gain {
  left: 50%;
  background: var(--color-gain);
}

.diverging-loss {
  right: 50%;
  background: var(--color-loss);
}

.closing {
  overflow: hidden;
  background: var(--color-petrol-deep);
  color: #ffffff;
}

/* The name set large and quiet across the width, as the page's last word. */
.wordmark {
  margin-top: 4rem;
  font-size: clamp(4.5rem, 17vw, 16rem);
  font-weight: 900;
  line-height: 0.8;
  letter-spacing: -0.02em;
  color: var(--color-petrol);
  white-space: nowrap;
  padding-bottom: 1.5rem;
}

@media (prefers-reduced-motion: reduce) {
  .hero-copy > * {
    animation: none;
  }
}
</style>
