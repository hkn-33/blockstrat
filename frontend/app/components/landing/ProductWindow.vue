<script setup lang="ts">
import type { DemoMarket, DemoStopLoss, DemoStrategy } from '~/composables/useLandingDemo'

// The product, whole and working: the rules on the left, the market and every trade on the right.
// The controls switch between real precomputed backtests; the rules snap in and the chart redraws.
const STRATEGIES: { value: DemoStrategy, label: string }[] = [
  { value: 'combo', label: 'Trend with filter' },
  { value: 'trend', label: 'Trend' },
  { value: 'dip', label: 'Buy the dip' },
]

const strategy = ref<DemoStrategy>('combo')
const market = ref<DemoMarket>('SOLUSDT')
const stopLoss = ref<DemoStopLoss>(5)

const run = computed(() => demoRun(strategy.value, market.value, stopLoss.value))
const chartData = computed(() => demoChartData(market.value, run.value))
const coin = computed(() => demoMarket(market.value))
const summary = computed(() => runSnapshot(market.value, run.value))
const rules = computed(() => demoRules(strategy.value, stopLoss.value))

// The strategy builds itself when the rules come into view and again whenever another one is picked: its
// blocks are carried onto the cards one at a time (about half a second each). The server render and a visitor
// who asks for less motion get the finished strategy, which is what `revealed` being undefined means.
interface BoardHandle {
  fly: (index: number) => Promise<void>
  cancelFlight: () => void
}

const board = ref<BoardHandle | null>(null)
const rulesColumn = ref<HTMLElement | null>(null)
const revealed = ref<number | undefined>(undefined)
const blockCount = computed(() => 1 + rules.value.entry.conditions.length + rules.value.exit.conditions.length)
const BUILD_START_DELAY_MS = 250
const BLOCK_PAUSE_MS = 80

let buildId = 0
let hasBuildStarted = false
let viewObserver: IntersectionObserver | undefined

function wait(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

async function buildStrategy(): Promise<void> {
  const thisBuild = ++buildId
  revealed.value = 0
  await wait(BUILD_START_DELAY_MS)
  for (let index = 0; index < blockCount.value; index++) {
    await board.value?.fly(index)
    if (thisBuild !== buildId) return
    revealed.value = index + 1
    await wait(BLOCK_PAUSE_MS)
    if (thisBuild !== buildId) return
  }
}

function startBuild(): void {
  buildStrategy().catch(error => console.warn('The strategy build was interrupted', error))
}

function startOnceInView(): void {
  if (!rulesColumn.value) return
  viewObserver = new IntersectionObserver(([entry]) => {
    if (!entry?.isIntersecting) return
    viewObserver?.disconnect()
    hasBuildStarted = true
    startBuild()
  }, { threshold: 0.25 })
  viewObserver.observe(rulesColumn.value)
}

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  revealed.value = 0
  startOnceInView()
})

watch(strategy, () => {
  if (hasBuildStarted) startBuild()
})

onBeforeUnmount(() => {
  buildId++
  viewObserver?.disconnect()
  board.value?.cancelFlight()
})
</script>

<template>
  <div class="window">
    <div class="toolbar">
      <div class="segmented" role="radiogroup" aria-label="Strategy">
        <button
          v-for="option in STRATEGIES"
          :key="option.value"
          type="button"
          role="radio"
          :aria-checked="strategy === option.value"
          :class="{ 'is-on': strategy === option.value }"
          @click="strategy = option.value"
        >
          {{ option.label }}
        </button>
      </div>
      <div class="segmented" role="radiogroup" aria-label="Market">
        <button
          v-for="option in DEMO_MARKETS"
          :key="option.value"
          type="button"
          role="radio"
          :aria-checked="market === option.value"
          :class="{ 'is-on': market === option.value }"
          @click="market = option.value"
        >
          <img :src="`/brand-icons/${option.icon}.svg`" alt="" class="coin">
          {{ option.label.split('/')[0] }}
        </button>
      </div>
      <div class="segmented" role="radiogroup" aria-label="Stop-loss">
        <button
          v-for="option in DEMO_STOP_LOSSES"
          :key="option"
          type="button"
          role="radio"
          :aria-checked="stopLoss === option"
          :class="{ 'is-on': stopLoss === option }"
          @click="stopLoss = option"
        >
          Stop {{ option }}%
        </button>
      </div>
      <span class="period">Jun 2025 to Nov 2026, $10,000 start</span>
    </div>

    <div class="body">
      <div ref="rulesColumn" class="rules-col">
        <LandingStrategyBoard
          ref="board"
          :market="market"
          :name="DEMO_STRATEGY_NAMES[strategy]"
          :entry="rules.entry"
          :exit="rules.exit"
          :revealed="revealed"
          compact
        />
      </div>
      <div class="chart-col">
        <ClientOnly>
          <TvChart :data="chartData" :name="coin.label" :icon="coin.icon" detail="1D candles, 4h strategy, Binance prices" :delay-ms="300" :height="360" theme="auto" redraw-animated />
          <template #fallback>
            <div class="h-[412px]" />
          </template>
        </ClientOnly>
        <StrategyTester :summary="summary" :coin="coin.label.split('/')[0]!" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.window {
  overflow: hidden;
  border-radius: 28px;
  background: var(--panel);
  color: var(--panel-ink);
  font-variant-numeric: tabular-nums;
  box-shadow: var(--panel-shadow);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  border-bottom: 1px solid var(--panel-line);
  padding: 0.75rem;
}

.period {
  margin-left: auto;
  font-size: 13px;
  color: var(--panel-soft);
}

.segmented {
  display: inline-flex;
  gap: 2px;
  border-radius: 10px;
  background: var(--panel-fill);
  padding: 3px;
}

.segmented button {
  display: inline-flex;
  min-height: 2rem;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  border-radius: 7px;
  padding: 0.25rem 0.75rem;
  font-size: 13px;
  font-weight: 600;
  color: var(--panel-soft);
  transition: background-color 180ms, color 180ms, transform 120ms;
}

.segmented button:hover {
  color: var(--panel-ink);
}

.segmented button:active {
  transform: scale(0.97);
}

.segmented button.is-on {
  background: var(--panel);
  color: var(--panel-ink);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.12), inset 0 0 0 1px var(--panel-line);
}

.segmented button:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.body {
  display: grid;
}

@media (min-width: 1024px) {
  .body {
    grid-template-columns: minmax(0, 23rem) minmax(0, 1fr);
  }

  /* The chart column sets the window's height (the longest strategy's board is shorter), so picking another
     strategy never moves the page; the board stretches to fill what is left. */
  .rules-col {
    display: grid;
    border-right: 1px solid var(--panel-line);
  }
}

.coin {
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 999px;
  background: #ffffff;
  padding: 1px;
}

.chart-col {
  min-width: 0;
}

@media (max-width: 1023px) {
  .period {
    width: 100%;
    margin-left: 0.25rem;
  }
}
</style>
