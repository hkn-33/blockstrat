<script setup lang="ts">
import type { StrategyBlock } from './BlockStack.vue'

// "How it works" as a pinned section: the page holds still while scrolling walks through the three steps,
// and the picture on the right changes with each one. On narrow screens the steps simply stack.
const STEPS = [
  { title: 'Pick a market and a pace', text: 'Ten crypto pairs from Binance, checked every hour, every four hours or once a day.' },
  { title: 'Snap the rules together', text: 'Drop a ready condition into place, then change its numbers. RSI, moving averages, MACD, Bollinger Bands.' },
  { title: 'Read the verdict', text: 'Your balance over nine years, every trade, and whether it beat simply holding the coin.' },
]

const MARKETS = [
  { icon: 'bitcoin', pair: 'BTC/USDT', name: 'Bitcoin' },
  { icon: 'ethereum', pair: 'ETH/USDT', name: 'Ethereum' },
  { icon: 'solana', pair: 'SOL/USDT', name: 'Solana' },
  { icon: 'binance', pair: 'BNB/USDT', name: 'BNB' },
]

const BLOCKS: StrategyBlock[] = [
  { tone: 'entry', label: 'Buy when', parts: ['EMA', { value: '20' }, 'crosses above SMA', { value: '50' }] },
  { tone: 'exit', label: 'Sell when', parts: ['EMA', { value: '20' }, 'crosses below SMA', { value: '50' }] },
  { tone: 'risk', label: 'Stop-loss', parts: [{ value: '8%' }, 'below entry'] },
]

const run = demoRun('trend', 'BTCUSDT', 5)
const section = ref<HTMLElement | null>(null)
const active = ref(0)

function onScroll(): void {
  const element = section.value
  if (!element) return
  const rect = element.getBoundingClientRect()
  const travel = element.offsetHeight - window.innerHeight
  if (travel <= 0) return
  const progress = Math.min(0.999, Math.max(0, -rect.top / travel))
  active.value = Math.floor(progress * STEPS.length)
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <section ref="section" class="pinned" aria-labelledby="steps-title">
    <div class="pinned-stage">
      <div class="wrap grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center">
        <div class="min-w-0">
          <h2 id="steps-title" class="section-title">
            From idea to verdict in three steps.
          </h2>
          <ol class="mt-10 grid gap-2">
            <li v-for="(step, index) in STEPS" :key="step.title" class="step" :class="{ 'is-active': index === active }">
              <span class="step-number">{{ index + 1 }}</span>
              <div>
                <h3 class="text-[20px] font-bold tracking-[-0.01em]">
                  {{ step.title }}
                </h3>
                <p class="step-text">
                  {{ step.text }}
                </p>
              </div>
            </li>
          </ol>
        </div>

        <div class="visual">
          <Transition name="swap" mode="out-in">
            <div v-if="active === 0" key="market" class="panel">
              <div class="search">
                <UiIcon name="search" />
                <span class="text-[var(--ink)]">ETH</span>
                <span class="search-caret" />
              </div>
              <ul class="mt-3 grid gap-1">
                <li v-for="(market, index) in MARKETS" :key="market.pair" class="market" :class="{ 'is-on': index === 1 }">
                  <img :src="`/brand-icons/${market.icon}.svg`" alt="" class="h-8 w-8">
                  <span>
                    <span class="block font-bold">{{ market.pair }}</span>
                    <span class="block text-[13px] text-[var(--muted)]">{{ market.name }} · since 2017</span>
                  </span>
                  <UiIcon v-if="index === 1" name="check" class="ml-auto text-[var(--gain)]" />
                </li>
              </ul>
              <div class="mt-4 flex items-center justify-between gap-3 text-[14px] text-[var(--muted)]">
                Check every
                <span class="segmented"><span>1 hour</span><span class="is-on">4 hours</span><span>1 day</span></span>
              </div>
            </div>

            <div v-else-if="active === 1" key="blocks" class="panel panel--blocks">
              <LandingBlockStack market="BTC/USDT" timeframe="4 hours" :blocks="BLOCKS" entrance />
            </div>

            <div v-else key="verdict" class="panel">
              <div class="flex items-end justify-between gap-4">
                <div>
                  <p class="text-[13px] text-[var(--muted)]">
                    Trend on BTC, $10,000 since 2017
                  </p>
                  <p class="text-[34px] font-bold tabular-nums tracking-[-0.03em] text-[var(--gain)]">
                    +970%
                  </p>
                </div>
                <p class="flex items-center gap-1.5 text-[14px] font-bold text-[var(--loss)]">
                  <UiIcon name="x" /> Holding BTC made +1,611%
                </p>
              </div>
              <div class="mt-3 h-[260px]">
                <ClientOnly>
                  <LandingEquityChart :run="run" accent="#16a37a" />
                </ClientOnly>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pinned {
  position: relative;
}

@media (min-width: 1024px) {
  .pinned {
    height: 300vh;
  }

  .pinned-stage {
    position: sticky;
    top: 0;
    display: grid;
    height: 100vh;
    align-items: center;
  }
}

@media (max-width: 1023px) {
  .pinned-stage {
    padding-block: 6rem;
  }
}

.step {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 1rem;
  border-radius: 18px;
  padding: 1rem 1.1rem;
  color: var(--muted);
  transition: background-color 300ms, color 300ms;
}

.step.is-active {
  background: #ffffff;
  color: var(--ink);
  box-shadow: 0 1px 2px rgb(13 27 36 / 0.05), 0 16px 32px -24px rgb(13 27 36 / 0.4);
}

.step-number {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 10px;
  background: rgb(13 27 36 / 0.06);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.step.is-active .step-number {
  background: var(--petrol);
  color: var(--lime);
}

.step-text {
  overflow: hidden;
  font-size: 16px;
  line-height: 1.6;
  color: var(--ink-soft);
}

.step.is-active .step-text {
  margin-top: 0.35rem;
}

@media (min-width: 1024px) {
  .step:not(.is-active) .step-text {
    height: 0;
  }
}

.visual {
  display: grid;
  min-height: 26rem;
  align-items: center;
  border-radius: 32px;
  background: linear-gradient(150deg, #dff3ee 0%, #e6ecff 60%, #f3f8df 100%);
  padding: clamp(1.25rem, 3vw, 2.5rem);
}

.panel {
  border-radius: 22px;
  background: rgb(255 255 255 / 0.85);
  padding: 1.25rem;
  box-shadow: inset 0 1px 0 #ffffff, 0 30px 60px -36px rgb(13 27 36 / 0.45);
  backdrop-filter: blur(20px);
}

.panel--blocks {
  background: transparent;
  padding: 0;
  box-shadow: none;
  backdrop-filter: none;
}

.search {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  border-radius: 12px;
  background: rgb(13 27 36 / 0.05);
  padding: 0.7rem 0.9rem;
  color: var(--muted);
  font-size: 15px;
}

.search-caret {
  width: 2px;
  height: 1.1em;
  margin-left: -0.45rem;
  background: var(--blue);
  animation: blink 900ms steps(1) infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

.market {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  border-radius: 14px;
  padding: 0.6rem 0.7rem;
  font-size: 15px;
}

.market.is-on {
  background: #ffffff;
  box-shadow: 0 0 0 1.5px var(--blue), 0 10px 20px -14px rgb(47 107 255 / 0.6);
}

.segmented {
  display: inline-flex;
  gap: 2px;
  border-radius: 10px;
  background: rgb(13 27 36 / 0.07);
  padding: 3px;
}

.segmented span {
  border-radius: 8px;
  padding: 0.3rem 0.7rem;
  font-weight: 600;
}

.segmented .is-on {
  background: #ffffff;
  color: var(--ink);
  box-shadow: 0 1px 2px rgb(13 27 36 / 0.12);
}

.swap-enter-active,
.swap-leave-active {
  transition: opacity 280ms ease, transform 280ms ease, filter 280ms ease;
}

.swap-enter-from {
  opacity: 0;
  transform: translateY(16px) scale(0.98);
  filter: blur(6px);
}

.swap-leave-to {
  opacity: 0;
  transform: translateY(-12px) scale(0.98);
  filter: blur(6px);
}

@media (prefers-reduced-motion: reduce) {
  .swap-enter-active,
  .swap-leave-active {
    transition: none;
  }
}
</style>
