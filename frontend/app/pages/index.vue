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
const featuredDrawdown = Math.round(Math.abs(featuredRun.metrics.max_drawdown_pct))

const PAIRS = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'LINK', 'LTC']

const ASSISTANT_FACTS = [
  { icon: 'file-json', title: 'Blocks, never code', text: 'It answers with the same blocks you would snap together, so you can check every rule it set.' },
  { icon: 'shield-check', title: 'Says what it cannot build', text: 'Ask for something the engine does not do, like short selling, and it tells you instead of guessing.' },
  { icon: 'refresh-cw', title: 'Yours to change', text: 'Every block stays editable, and each change replays the backtest in well under a second.' },
]

const MARK_FACTS = [
  { icon: 'mouse-pointer-click', title: 'Draw it like on TradingView', text: 'Long or short: click the entry, click the target. The stop-loss follows the reward to risk you like.' },
  { icon: 'wand-sparkles', title: 'Rules that land on your trades', text: 'Hundreds of rules and their pairs are tried, then narrowed with trend, momentum and volume.' },
  { icon: 'shield-check', title: 'Tested past your drawing', text: 'Every rule that fits is run on years of candles, so one that only fits the picture shows it.' },
]

const COINS = ['bitcoin', 'ethereum', 'solana']

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value !== 'light')

// Picking the theme the browser already asks for hands control back to the browser, so one stray click
// is undone by the next and the page follows the system again.
function toggleTheme(): void {
  const wanted = isDark.value ? 'light' : 'dark'
  const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  colorMode.preference = wanted === (systemIsDark ? 'dark' : 'light') ? 'system' : wanted
}

const HEADLINE_WORDS = 'Test it before you trade it'.split(' ')

// The hero's ground is the taste kit's grain-gradient shader (public/fx), served as plain files so Vite
// leaves it alone. It falls back to a still CSS gradient without WebGL and holds one frame under reduced motion.
interface FxController {
  destroy: () => void
}
interface FxModule {
  mount: (element: HTMLElement, effect: unknown, options: { palette: Record<string, string>, params: Record<string, number>, seed: number }) => Promise<FxController>
}

const ground = ref<HTMLDivElement | null>(null)
let groundEffect: FxController | undefined

// The shader only mixes accents near the ground's hue, so the light is the gain green, not the lime.
const GROUND_PALETTES = {
  dark: { bg: '#082a30', surface: '#0e3f47', ink: '#ffffff', accent: '#2fc59f' },
  light: { bg: '#e9f2f3', surface: '#ffffff', ink: '#0d1b24', accent: '#0e9963' },
}

async function mountGround(): Promise<void> {
  const base = '/fx/'
  const [fx, effect] = await Promise.all([
    import(/* @vite-ignore */ `${base}fx.js`) as Promise<FxModule>,
    import(/* @vite-ignore */ `${base}grain-gradient/effect.js`) as Promise<{ default: unknown }>,
  ])
  if (!ground.value) return
  groundEffect?.destroy()
  groundEffect = await fx.mount(ground.value, effect.default, {
    palette: GROUND_PALETTES[isDark.value ? 'dark' : 'light'],
    params: { speed: 0.35, tint: 0.95, contrast: 0.85, calm: 0.5, calmX: 0.2, calmY: 0.25 },
    seed: 17,
  })
}

watch(isDark, () => {
  mountGround().catch(error => console.warn('Hero ground fell back to a flat colour', error))
})

// The nav stays on screen: full width over the hero, then a smaller floating bar once the page moves.
const isNavCompact = ref(false)

function onScroll(): void {
  isNavCompact.value = window.scrollY > 40
}

// Smooth, eased scrolling on the landing page only; the builder keeps native scrolling for its editor.
let lenis: Lenis | undefined

onMounted(() => {
  mountGround().catch(error => console.warn('Hero ground fell back to a flat colour', error))
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  lenis = new Lenis({ autoRaf: true, anchors: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  lenis?.destroy()
  groundEffect?.destroy()
})

// Placeholder proof: invented for the preview, replace with real testers before launch. The numbers in
// them match real demo backtests (buying the dip on ETH, the trend rules on Chainlink).
const QUOTES = [
  { text: 'I copied an RSI dip strategy from a video and was about to put $2,000 on it. On Ethereum the test said minus 47%. I kept my money.', name: 'Marta K.', detail: 'Tested 14 strategies', result: 'Kept $2,000' },
  { text: 'I typed one sentence and got blocks I could actually read. The same trend rules made 39% on Chainlink and lost on Bitcoin.', name: 'Tomasz W.', detail: 'First strategy in 4 minutes', result: 'Found what works where' },
  { text: 'Fees were eating more than half my profit and I had no idea. Seeing them per trade changed how often I trade.', name: 'Ola P.', detail: 'Trades on weekends', result: '$780 in fees spotted' },
]

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
    <header class="nav" :class="{ 'is-compact': isNavCompact }">
      <div class="nav-bar">
        <NuxtLink to="/" class="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4" aria-label="BlockStrat home">
          <BrandLogo />
        </NuxtLink>
        <nav class="nav-links hidden md:flex" aria-label="Main">
          <a href="#how" class="nav-link">How it works</a>
          <a href="#ai" class="nav-link">Assistant</a>
          <a href="#mark" class="nav-link">Mark trades</a>
          <a href="#markets" class="nav-link">Results</a>
          <a href="#honest" class="nav-link">How it counts</a>
          <a href="#faq" class="nav-link">Questions</a>
        </nav>
        <div class="flex items-center gap-2">
          <!-- In the prerendered page from the start, so nothing beside it moves: both icons are there and the
               theme class, set before the first paint, shows the right one. -->
          <button type="button" class="theme-toggle" aria-label="Switch between light and dark mode" @click="toggleTheme">
            <UiIcon name="sun" class="theme-icon theme-icon--sun" />
            <UiIcon name="moon" class="theme-icon theme-icon--moon" />
          </button>
          <NuxtLink to="/app" class="btn btn-lime btn-small">
            Open the builder
          </NuxtLink>
        </div>
      </div>
    </header>

    <section class="hero">
      <div ref="ground" class="ground" aria-hidden="true" />


      <div class="wrap relative z-10 pb-24 pt-36 lg:pb-28 lg:pt-48">
        <div class="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
          <h1 class="headline" aria-label="Test it before you trade it">
            <template v-for="(word, index) in HEADLINE_WORDS" :key="word + index">
              <span class="word" aria-hidden="true"><span :style="{ '--i': index }">{{ word }}</span></span>{{ ' ' }}
            </template>
          </h1>
          <div class="lg:pt-3">
            <p class="enter-step max-w-[33rem] text-[18px] leading-[1.6] text-[var(--ink-soft)]" style="--step: 0">
              Snap a strategy together from blocks, or just describe it. BlockStrat replays it on real Binance prices,
              fees included, and tells you if it beat simply holding.
            </p>
            <div class="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <NuxtLink to="/app" class="btn btn-lime enter-step" style="--step: 1">
                Open the builder
                <UiIcon name="arrow-right" class="arrow" />
              </NuxtLink>
              <span class="enter-step flex items-center gap-3 text-[14px] text-[var(--ink-soft)]" style="--step: 2">
                <span class="flex -space-x-2">
                  <img v-for="coin in COINS" :key="coin" :src="`/brand-icons/${coin}.svg`" alt="" class="coin">
                </span>
                10 pairs, free, no sign-up
              </span>
            </div>
          </div>
        </div>

        <div class="product-tilt mt-14">
          <div class="product">
            <LandingProductWindow />
          </div>
        </div>
      </div>
    </section>

    <div id="how" class="scroll-mt-4">
      <LandingPinnedSteps />
    </div>

    <section id="ai" class="band scroll-mt-4">
      <div class="wrap grid gap-12 py-24 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:py-32">
        <div>
          <h2 class="section-title">
            Describe a strategy and get blocks you can edit
          </h2>
          <p class="mt-5 max-w-[30rem] text-[18px] leading-[1.6] text-[var(--ink-soft)]">
            Write the idea the way you would text a friend. The assistant turns it into blocks and a real backtest.
          </p>
          <dl class="mt-10 grid gap-6">
            <div v-for="fact in ASSISTANT_FACTS" :key="fact.title" class="fact">
              <UiIcon :name="fact.icon" class="fact-icon" />
              <div>
                <dt class="font-bold">
                  {{ fact.title }}
                </dt>
                <dd class="mt-1 text-[15px] leading-[1.55] text-[var(--ink-soft)]">
                  {{ fact.text }}
                </dd>
              </div>
            </div>
          </dl>
        </div>
        <LandingAiDemo class="min-w-0" />
      </div>
    </section>

    <section id="mark" class="scroll-mt-4">
      <div class="wrap grid gap-12 py-24 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:py-32">
        <div class="min-w-0">
          <LandingMarkDemo />
          <p class="mt-3 text-[13px] text-[var(--muted)]">
            Real SOL/USDT four-hour candles and the real trades of the Trend rules on them, fees included. The marks are three of those trades.
          </p>
        </div>
        <div class="lg:order-first">
          <h2 class="section-title">
            Mark the trades you would have made. Get the rules behind them
          </h2>
          <p class="mt-5 max-w-[30rem] text-[18px] leading-[1.6] text-[var(--ink-soft)]">
            You know a good trade when you see one. Draw a few on the chart and BlockStrat finds the rules that would have taken them.
          </p>
          <dl class="mt-10 grid gap-6">
            <div v-for="fact in MARK_FACTS" :key="fact.title" class="fact">
              <UiIcon :name="fact.icon" class="fact-icon" />
              <div>
                <dt class="font-bold">
                  {{ fact.title }}
                </dt>
                <dd class="mt-1 text-[15px] leading-[1.55] text-[var(--ink-soft)]">
                  {{ fact.text }}
                </dd>
              </div>
            </div>
          </dl>
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
            Pick a strategy and see it on three coins. Each starts with $10,000, over the same 16 months.
          </p>
        </div>
        <div class="mt-12">
          <LandingMarketGrid />
        </div>
      </div>
    </section>

    <section id="honest" class="tinted scroll-mt-4">
      <div class="wrap py-24 lg:py-32">
        <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
          <h2 class="section-title">
            Counted the way an exchange would count it
          </h2>
          <p class="max-w-[30rem] text-[18px] leading-[1.6] text-[var(--ink-soft)]">
            Many backtests look great because they quietly cheat. BlockStrat fills, charges and reports the way a real
            account would.
          </p>
        </div>

        <div class="bento mt-14">
          <article class="tile tile-wide tile-chart">
            <div class="tile-head">
              <h3 class="tile-title">
                Orders fill at the next candle
              </h3>
              <p class="tile-text">
                A signal on a candle's close buys at the next candle's open, the price you could really have got
              </p>
            </div>
            <ClientOnly>
              <LandingSignalCandles />
            </ClientOnly>
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

          <article class="tile tile-full tile-chart">
            <div class="tile-head">
              <h3 class="tile-title">
                The worst drop, in plain sight
              </h3>
              <p class="tile-text">
                Even a strategy that made money spent weeks {{ featuredDrawdown }}% under its high, shown right next to the return
              </p>
            </div>
            <ClientOnly>
              <LandingDrawdownChart market="SOLUSDT" :run="featuredRun" />
            </ClientOnly>
          </article>
        </div>
      </div>
    </section>

    <section class="wrap pt-24 lg:pt-28" aria-labelledby="quotes-title">
      <h2 id="quotes-title" class="section-title max-w-[36rem]">
        What early testers found
      </h2>
      <div class="mt-12 grid gap-4 lg:grid-cols-3">
        <figure v-for="quote in QUOTES" :key="quote.name" class="quote">
          <p class="quote-result">
            {{ quote.result }}
          </p>
          <blockquote class="mt-3 text-[18px] leading-[1.6]">
            “{{ quote.text }}”
          </blockquote>
          <figcaption class="mt-6 flex items-center gap-3 text-[14px] text-[var(--muted)]">
            <span class="initials" aria-hidden="true">{{ quote.name.slice(0, 1) }}</span>
            <span><span class="font-bold text-[var(--ink)]">{{ quote.name }}</span>, {{ quote.detail }}</span>
          </figcaption>
        </figure>
      </div>
    </section>

    <section id="faq" class="wrap grid scroll-mt-4 gap-12 py-24 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:py-28">
      <div>
        <h2 class="section-title">
          Questions
        </h2>
        <p class="mt-5 max-w-[24rem] text-[18px] leading-[1.6] text-[var(--ink-soft)]">
          The builder opens with an example strategy, so the fastest answer is often to change a block and watch.
        </p>
        <NuxtLink to="/app" class="btn btn-ink mt-8">
          Open the builder
          <UiIcon name="arrow-right" class="arrow" />
        </NuxtLink>
      </div>
      <dl class="grid gap-x-10 gap-y-9 sm:grid-cols-2">
        <div v-for="item in FAQ" :key="item.question">
          <dt class="text-[18px] font-bold text-[var(--ink)]">
            {{ item.question }}
          </dt>
          <dd class="mt-2 text-[15px] leading-[1.6] text-[var(--ink-soft)]">
            {{ item.answer }}
          </dd>
        </div>
      </dl>
    </section>

    <footer class="closing band">
      <div class="wrap pt-24 lg:pt-28">
        <div class="flex flex-col items-start gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 class="section-title max-w-[32rem]">
              Your first test takes about a minute
            </h2>
            <p class="mt-4 text-[18px] text-[var(--ink-soft)]">
              Free, no sign-up, with an example strategy already loaded
            </p>
          </div>
          <NuxtLink to="/app" class="btn btn-lime">
            Open the builder
            <UiIcon name="arrow-right" class="arrow" />
          </NuxtLink>
        </div>
        <div class="footer-grid">
          <div class="max-w-[22rem]">
            <BrandLogo />
            <p class="mt-4 text-[15px] leading-[1.6] text-[var(--ink-soft)]">
              A no-code backtester for crypto trading ideas. It never trades, never asks for exchange keys and is not investment advice.
            </p>
          </div>
          <nav aria-label="Footer">
            <h3 class="footer-heading">
              Product
            </h3>
            <ul class="footer-list">
              <li><NuxtLink to="/app" class="footer-link">Open the builder</NuxtLink></li>
              <li><a href="#how" class="footer-link">How it works</a></li>
              <li><a href="#ai" class="footer-link">Assistant</a></li>
              <li><a href="#honest" class="footer-link">How it counts</a></li>
              <li><a href="#faq" class="footer-link">Questions</a></li>
            </ul>
          </nav>
          <div>
            <h3 class="footer-heading">
              Markets
            </h3>
            <ul class="footer-list footer-list--pairs">
              <li v-for="pair in PAIRS" :key="pair">
                {{ pair }}/USDT
              </li>
            </ul>
          </div>
          <div>
            <h3 class="footer-heading">
              Under the hood
            </h3>
            <ul class="footer-list">
              <li class="flex items-center gap-2">
                <img src="/brand-icons/binance.svg" alt="" class="footer-icon"> Binance market data
              </li>
              <li class="flex items-center gap-2">
                <UiIcon name="sparkles" class="footer-icon" /> Groq for the assistant
              </li>
              <li>Python backtests, Nuxt front end</li>
              <li>1h, 4h and 1d candles since 2017</li>
            </ul>
          </div>
        </div>
        <p class="wordmark" aria-hidden="true">
          BlockStrat
        </p>
        <p class="border-t border-[var(--line)] py-8 text-[14px] text-[var(--muted)]">
          © 2026 BlockStrat. The tester quotes on this page are placeholders.
        </p>
      </div>
    </footer>
  </div>
</template>

<style>
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
  color: var(--ink);
  text-wrap: balance;
}

/* The nav: the full row over the hero, then a smaller floating glass bar once the page has moved. */
.nav {
  position: fixed;
  inset: 0 0 auto;
  z-index: 50;
  padding-top: 0;
  transition: padding-top 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.nav-bar {
  display: flex;
  width: min(100% - 2.5rem, 1320px);
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  margin-inline: auto;
  border-radius: 16px;
  padding: 1.1rem 0;
  transition:
    width 360ms cubic-bezier(0.22, 1, 0.36, 1),
    padding 360ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 240ms,
    box-shadow 240ms;
}

@media (min-width: 640px) {
  .nav-bar {
    width: min(100% - 4rem, 1320px);
  }
}

/* At the top of the page the bar is a light pane of glass over the hero: a faint tint, a soft blur of what is
   behind it, and a thin highlight along its top edge, as light catches glass. Scrolled, it firms up below. */
.nav:not(.is-compact) {
  padding-top: 0.75rem;
}

.nav:not(.is-compact) .nav-bar {
  padding: 0.7rem 0.75rem 0.7rem 1.25rem;
  background: linear-gradient(180deg, color-mix(in srgb, var(--panel) 22%, transparent), color-mix(in srgb, var(--panel) 10%, transparent));
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.14),
    inset 0 0 0 1px color-mix(in srgb, var(--line) 70%, transparent),
    0 12px 32px -24px rgb(0 0 0 / 0.35);
  backdrop-filter: blur(10px) saturate(1.25);
}

.nav.is-compact {
  padding-top: 0.6rem;
}

.lp .theme-icon--sun,
:root.dark .lp .theme-icon--moon {
  display: none;
}

:root.dark .lp .theme-icon--sun {
  display: inline-flex;
}

.nav.is-compact .nav-bar {
  width: min(100% - 1.5rem, 980px);
  padding: 0.45rem 0.5rem 0.45rem 1rem;
  background: var(--nav-glass);
  box-shadow: inset 0 0 0 1px var(--line), 0 16px 40px -24px rgb(0 0 0 / 0.45);
  backdrop-filter: blur(14px) saturate(1.4);
}

.nav.is-compact .btn-small {
  padding: 0.5rem 0.9rem;
  font-size: 14px;
}

.nav-links {
  align-items: center;
  gap: 1.75rem;
  font-size: 15px;
  font-weight: 500;
  color: var(--ink-soft);
}

.nav.is-compact .nav-links {
  gap: 1.25rem;
  font-size: 14px;
}

/* Hero: the theme's ground with the grain-gradient shader drifting under the words. */
.hero {
  --ease-enter: cubic-bezier(0.22, 1, 0.36, 1);
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: var(--hero-bg);
}

.ground {
  position: absolute;
  inset: 0;
  z-index: 0;
  opacity: 0;
  transition: opacity 1200ms ease-out;
}

.ground[data-fx-mounted] {
  opacity: 1;
}

/* The product window stands tilted back like a screen on a desk, and straightens as the page scrolls
   into it. Scroll-driven where the browser supports it; elsewhere it simply stands flat. */
.product-tilt {
  perspective: 1800px;
}

.product {
  border-radius: 28px;
  box-shadow: 0 50px 100px -40px rgb(0 0 0 / 0.45);
  transform-origin: 50% 0;
  animation: slide-up 1100ms var(--ease-enter) 200ms backwards;
}

@supports (animation-timeline: scroll()) {
  .product-tilt > .product {
    animation:
      slide-up 1100ms var(--ease-enter) 200ms backwards,
      straighten linear both;
    animation-timeline: auto, scroll(root);
    animation-range: normal, 0 32vh;
    animation-composition: replace, add;
  }
}

@keyframes straighten {
  from {
    transform: rotateX(12deg) scale(0.95);
  }

  to {
    transform: none;
  }
}

/* The entrance, once on load: each word rises out of its own mask, then the lead, the button and the
   coins fade up in turn, and the product window settles. Transform and opacity only. */
.word {
  display: inline-block;
  overflow: hidden;
  padding-bottom: 0.12em;
  margin-bottom: -0.12em;
  vertical-align: top;
}

.word > span {
  display: inline-block;
  animation: word-rise 700ms var(--ease-enter) backwards;
  animation-delay: calc(80ms + var(--i) * 45ms);
}

.enter-step {
  animation: step-up 520ms var(--ease-enter) backwards;
  animation-delay: calc(520ms + var(--step) * 60ms);
}

@keyframes word-rise {
  from {
    transform: translateY(calc(100% + 0.2em));
  }
}

@keyframes step-up {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
}

@keyframes slide-up {
  from {
    transform: translateY(72px);
  }
}

.coin {
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  box-shadow: 0 0 0 2px var(--hero-bg);
}

.nav-link:hover,
.footer-link:hover {
  color: var(--ink);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  border-radius: 10px;
  padding: 0.95rem 1.5rem;
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
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
  color: var(--ink-soft);
  box-shadow: inset 0 0 0 1px var(--line);
  transition: background-color 160ms, color 160ms;
}

.theme-toggle:hover {
  background: var(--tint);
  color: var(--ink);
}

.theme-toggle:focus-visible {
  outline: 2px solid var(--focus);
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
  outline: 2px solid var(--focus);
  outline-offset: 3px;
}

/* A quiet tinted ground that sets the product sections apart from the white ones. */
.tinted {
  background: var(--canvas-bg);
}

.fact {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.9rem;
}

.fact-icon {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 10px;
  background: var(--panel-fill);
  padding: 0.55rem;
  color: var(--accent-ink);
}

/* The deeper ground that frames the assistant and the footer. */
.band {
  background: var(--band-bg);
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

  .tile-full {
    grid-column: 1 / -1;
  }
}

.tile {
  min-width: 0;
  border-radius: 28px;
  background: var(--surface);
  padding: 1.75rem;
  box-shadow: var(--card-shadow);
}

/* Chart tiles are the hero's chart window in small: the same panel, colours and chart strip. */
.tile-chart {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--panel);
  padding: 0 0 0.75rem;
  color: var(--panel-ink);
  box-shadow: var(--panel-shadow);
}

.tile-head {
  padding: 1.75rem 1.75rem 0.75rem;
}

.tile-chart .tile-text {
  color: var(--panel-soft);
}

.tile-title {
  font-size: 20px;
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
  box-shadow: 0 0 0 1px var(--line);
}

.fees dd {
  color: var(--ink-soft);
}

.fees .fees-total {
  font-weight: 700;
}

.fees .fees-total dd {
  color: var(--loss-ink);
}

.quote {
  display: flex;
  flex-direction: column;
  border-radius: 24px;
  background: var(--surface);
  padding: 1.75rem;
  box-shadow: var(--card-shadow);
}

.quote blockquote {
  flex: 1;
}

.quote-result {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--accent-ink);
}

.initials {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border-radius: 999px;
  background: var(--tint-strong);
  font-weight: 700;
  color: var(--ink);
}

.footer-grid {
  display: grid;
  gap: 2.5rem;
  margin-top: 5rem;
  border-top: 1px solid var(--line);
  padding-top: 3rem;
}

@media (min-width: 768px) {
  .footer-grid {
    grid-template-columns: minmax(0, 1.4fr) repeat(3, minmax(0, 1fr));
  }
}

.footer-heading {
  font-size: 14px;
  font-weight: 700;
}

.footer-list {
  display: grid;
  gap: 0.6rem;
  margin-top: 1rem;
  font-size: 15px;
  color: var(--ink-soft);
}

.footer-list--pairs {
  grid-template-columns: repeat(2, max-content);
  column-gap: 1.5rem;
  font-variant-numeric: tabular-nums;
}

.footer-icon {
  width: 1.1rem;
  height: 1.1rem;
}

.closing {
  overflow: hidden;
}

/* The name set large and quiet across the width, as the page's last word. */
.wordmark {
  margin-top: 3rem;
  font-size: clamp(4.5rem, 17vw, 16rem);
  font-weight: 900;
  line-height: 0.8;
  letter-spacing: -0.02em;
  color: var(--wordmark);
  white-space: nowrap;
  padding-bottom: 1.5rem;
}

@media (prefers-reduced-motion: reduce) {
  .word > span,
  .enter-step,
  .product,
  .product-tilt > .product {
    animation: none;
  }

  .nav,
  .nav-bar {
    transition: none;
  }
}
</style>
