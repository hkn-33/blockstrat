<script setup lang="ts">
// "How it works" as a pinned section: the page holds still while scrolling walks through the three steps,
// and the picture on the right changes with each one. On narrow screens the steps simply stack.
const STEPS = [
  { title: 'Pick a market and a pace', text: 'Ten crypto pairs from Binance, checked every hour, every four hours or once a day' },
  { title: 'Snap the rules together', text: 'Drop a ready condition into place and change its numbers: RSI, moving averages, MACD, Bollinger Bands' },
  { title: 'Read the verdict', text: 'Every trade on the chart, your balance underneath, and whether it beat simply holding the coin' },
]

const MARKETS = [
  { icon: 'bitcoin', pair: 'BTC/USDT', name: 'Bitcoin' },
  { icon: 'ethereum', pair: 'ETH/USDT', name: 'Ethereum' },
  { icon: 'solana', pair: 'SOL/USDT', name: 'Solana' },
  { icon: 'binance', pair: 'BNB/USDT', name: 'BNB' },
]

const RULES = demoRules('combo', 5)

const run = demoRun('combo', 'SOLUSDT', 5)
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
            From idea to verdict in three steps
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
                  <img :src="`/brand-icons/${market.icon}.svg`" alt="" class="coin">
                  <span>
                    <span class="block font-bold">{{ market.pair }}</span>
                    <span class="block text-[13px] text-[var(--muted)]">{{ market.name }} · since 2017</span>
                  </span>
                  <UiIcon v-if="index === 1" name="check" class="ml-auto text-[var(--color-gain)]" />
                </li>
              </ul>
              <div class="mt-4 flex items-center justify-between gap-3 text-[14px] text-[var(--muted)]">
                Check every
                <span class="segmented"><span>1 hour</span><span class="is-on">4 hours</span><span>1 day</span></span>
              </div>
            </div>

            <div v-else-if="active === 1" key="blocks" class="panel panel--blocks">
              <LandingRuleBuilder market="SOLUSDT" timeframe="4 hours" :entry="RULES.entry" :exit="RULES.exit" theme="auto" entrance drop-slot />
            </div>

            <div v-else key="verdict" class="panel panel--dark">
              <ClientOnly>
                <LandingTvChart market="SOLUSDT" :run="run" :height="280" />
              </ClientOnly>
              <LandingStrategyTester market="SOLUSDT" :run="run" />
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
  border-radius: 16px;
  padding: 1rem 1.1rem;
  color: var(--muted);
  transition: background-color 300ms, color 300ms;
}

.step.is-active {
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 1px 2px var(--tint), 0 16px 32px -24px rgb(13 27 36 / 0.4);
}

.step-number {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 10px;
  background: var(--tint);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.step.is-active .step-number {
  background: var(--color-petrol);
  color: var(--color-lime);
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
  padding: 0;
}

.panel {
  border-radius: 16px;
  background: var(--surface);
  padding: 1.25rem;
  box-shadow: 0 1px 2px var(--tint), 0 20px 40px -28px rgb(13 27 36 / 0.4);
}

.panel--dark {
  overflow: hidden;
  background: #0b2125;
  padding: 0;
}

.panel--blocks {
  background: transparent;
  padding: 0;
  box-shadow: none;
}

.coin {
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  background: #ffffff;
  padding: 2px;
}

.search {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  border-radius: 12px;
  background: var(--tint);
  padding: 0.7rem 0.9rem;
  color: var(--muted);
  font-size: 15px;
}

.search-caret {
  width: 2px;
  height: 1.1em;
  margin-left: -0.45rem;
  background: var(--ink);
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
  background: var(--surface);
  box-shadow: 0 0 0 1.5px var(--color-petrol), 0 10px 20px -14px rgb(14 63 71 / 0.5);
}

.segmented {
  display: inline-flex;
  gap: 2px;
  border-radius: 10px;
  background: var(--tint);
  padding: 3px;
}

.segmented span {
  border-radius: 7px;
  padding: 0.3rem 0.7rem;
  font-weight: 600;
}

.segmented .is-on {
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 1px 2px rgb(13 27 36 / 0.12);
}

.swap-enter-active {
  transition: opacity 260ms cubic-bezier(0.16, 1, 0.3, 1), transform 260ms cubic-bezier(0.16, 1, 0.3, 1), filter 260ms cubic-bezier(0.16, 1, 0.3, 1);
}

.swap-leave-active {
  transition: opacity 200ms ease-in, transform 200ms ease-in, filter 200ms ease-in;
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

  .search-caret {
    animation: none;
  }
}
</style>
