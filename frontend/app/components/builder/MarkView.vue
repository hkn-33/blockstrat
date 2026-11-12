<script setup lang="ts">
import {
  CandlestickSeries,
  CrosshairMode,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { Bar, InstrumentInfo, Proposal, StrategyDraft } from '~/types/api'
import type { Timeframe } from '~/utils/strategyDocument'

// The builder's other way in, for someone who knows a good trade when they see one but not the rule behind
// it: click the candles where you would have bought and sold, and get back strategies whose signals land
// on those marks. Each proposal says how well it fits the marks and how it did on the whole history, so a
// rule that only fits the marked stretch is easy to tell from one that holds up.
const props = defineProps<{ instruments: InstrumentInfo[], instrument: string | null, timeframe: Timeframe | null }>()
const emit = defineEmits<{ build: [strategy: StrategyDraft, name: string] }>()

type MarkSide = 'buy' | 'sell'

const MINIMUM_MARKS = 2
const PACES: { value: Timeframe, label: string }[] = [
  { value: '1h', label: '1 hour' },
  { value: '4h', label: '4 hours' },
  { value: '1d', label: '1 day' },
]

const api = useApi()
const market = ref(props.instrument ?? 'BTCUSDT')
const pace = ref<Timeframe>(props.timeframe ?? '4h')
const side = ref<MarkSide>('buy')
const marks = ref<Record<number, MarkSide>>({})
const bars = ref<Bar[]>([])
const proposals = ref<Proposal[]>([])
const shownIndex = ref(0)
const isLoadingBars = ref(false)
const isSearching = ref(false)
const failure = ref<string | null>(null)

const buyCount = computed(() => Object.values(marks.value).filter(mark => mark === 'buy').length)
const sellCount = computed(() => Object.values(marks.value).filter(mark => mark === 'sell').length)
const canSearch = computed(() => buyCount.value >= MINIMUM_MARKS && sellCount.value >= MINIMUM_MARKS && !isSearching.value)
const shown = computed(() => proposals.value[shownIndex.value])
const stillNeeded = computed(() => {
  const buys = Math.max(MINIMUM_MARKS - buyCount.value, 0)
  const sells = Math.max(MINIMUM_MARKS - sellCount.value, 0)
  if (!buys && !sells) return ''
  const parts = [buys ? `${buys} more ${buys === 1 ? 'buy' : 'buys'}` : '', sells ? `${sells} more ${sells === 1 ? 'sell' : 'sells'}` : '']
  return `Mark ${parts.filter(Boolean).join(' and ')} to search`
})

// ---------- Chart ----------
const container = ref<HTMLDivElement | null>(null)
const resolvedTheme = useResolvedChartTheme(() => 'auto')
let chart: IChartApi | undefined
let candles: ISeriesApi<'Candlestick'> | undefined
let markers: ISeriesMarkersPluginApi<Time> | undefined

function drawCandles(): void {
  if (!chart || !candles) return
  const colours = chartPalette(resolvedTheme.value)
  chart.applyOptions({ layout: { textColor: colours.text }, grid: { horzLines: { color: colours.grid } } })
  candles.applyOptions({ upColor: colours.up, downColor: colours.down, wickUpColor: colours.up, wickDownColor: colours.down })
  candles.setData(bars.value.map(bar => ({ ...bar, time: bar.time as UTCTimestamp })))
  chart.timeScale().setVisibleLogicalRange({ from: Math.max(bars.value.length - 220, 0), to: bars.value.length + 4 })
}

// The user's marks are arrows with a word; the shown proposal's own signals are small dots, so the eye can
// compare the two without reading numbers.
function drawMarkers(): void {
  if (!markers) return
  const colours = chartPalette(resolvedTheme.value)
  const own: SeriesMarker<Time>[] = Object.entries(marks.value).map(([time, mark]) => ({
    time: Number(time) as UTCTimestamp,
    position: mark === 'buy' ? 'belowBar' : 'aboveBar',
    shape: mark === 'buy' ? 'arrowUp' : 'arrowDown',
    color: mark === 'buy' ? colours.up : colours.down,
    text: mark === 'buy' ? 'Buy' : 'Sell',
  }))
  const signal = (time: number, isEntry: boolean): SeriesMarker<Time> => ({
    time: time as UTCTimestamp,
    position: isEntry ? 'belowBar' : 'aboveBar',
    shape: 'circle',
    color: colours.accent,
    size: 0.6,
  })
  const suggested = shown.value ? [...shown.value.entry_times.map(time => signal(time, true)), ...shown.value.exit_times.map(time => signal(time, false))] : []
  markers.setMarkers([...own, ...suggested].sort((first, second) => Number(first.time) - Number(second.time)))
}

function toggleMark(time: number): void {
  const next = { ...marks.value }
  if (next[time] === side.value) delete next[time]
  else next[time] = side.value
  marks.value = next
}

function clearMarks(): void {
  marks.value = {}
  proposals.value = []
}

async function loadBars(): Promise<void> {
  isLoadingBars.value = true
  failure.value = null
  clearMarks()
  try {
    bars.value = (await api.bars(market.value, pace.value)).bars
    drawCandles()
  }
  catch (error) {
    failure.value = describeApiError(error)
  }
  finally {
    isLoadingBars.value = false
  }
}

async function search(): Promise<void> {
  isSearching.value = true
  failure.value = null
  try {
    const found = await api.suggestStrategies(market.value, pace.value, Object.entries(marks.value).map(([time, mark]) => ({ time: Number(time), side: mark })))
    proposals.value = found.proposals
    shownIndex.value = 0
  }
  catch (error) {
    failure.value = describeApiError(error)
  }
  finally {
    isSearching.value = false
  }
}

function matchText(proposal: Proposal): string {
  const extras = proposal.extra_buys + proposal.extra_sells
  const fit = `Lands on ${proposal.buys_hit} of your ${proposal.buys_marked} buys and ${proposal.sells_hit} of your ${proposal.sells_marked} sells`
  return extras ? `${fit}, with ${extras} ${extras === 1 ? 'signal' : 'signals'} you did not mark in between` : fit
}

// A rule can sit on every mark and still lose to doing nothing; that is said in words, not left to the numbers.
function caution(proposal: Proposal): string | null {
  if (proposal.total_return_pct < 0) return 'It fits your marks, but on the whole history it lost money.'
  if (proposal.total_return_pct < proposal.buy_and_hold_return_pct) return 'It fits your marks, but simply holding did better over the whole history.'
  return null
}

onMounted(() => {
  const base = baseChartOptions()
  chart = createChart(container.value!, {
    ...base,
    grid: { vertLines: { visible: false } },
    crosshair: { mode: CrosshairMode.Normal },
    // The wheel scrolls the view down to the proposals; the chart moves by dragging and zooms by pinching.
    handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: true },
  })
  candles = chart.addSeries(CandlestickSeries, { borderVisible: false, priceLineVisible: false })
  markers = createSeriesMarkers(candles, [])
  chart.subscribeClick((click) => {
    if (typeof click.time === 'number') toggleMark(click.time)
  })
  loadBars()
})

watch([market, pace], loadBars)
watch([marks, shown, resolvedTheme], drawMarkers)
watch(resolvedTheme, drawCandles)
onBeforeUnmount(() => chart?.remove())
</script>

<template>
  <div class="mark-view">
    <header class="mark-head">
      <div class="min-w-0">
        <h2 class="mark-title">
          Mark where you would buy and sell
        </h2>
        <p class="mark-text">
          Click a candle to mark it. BlockStrat looks for rules whose signals land on your marks.
        </p>
      </div>
      <div class="mark-controls">
        <label class="market">
          <span class="sr-only">Market</span>
          <CoinMark :symbol="market" />
          <select v-model="market">
            <option v-for="instrument in instruments" :key="instrument.symbol" :value="instrument.symbol">
              {{ instrument.label }}
            </option>
          </select>
        </label>
        <div class="segmented" role="radiogroup" aria-label="Candle size">
          <button v-for="option in PACES" :key="option.value" type="button" role="radio" :aria-checked="pace === option.value" :class="{ 'is-on': pace === option.value }" @click="pace = option.value">
            {{ option.label }}
          </button>
        </div>
      </div>
    </header>

    <div class="mark-bar">
      <div class="sides" role="radiogroup" aria-label="What a click marks">
        <button type="button" role="radio" :aria-checked="side === 'buy'" class="side side--buy" :class="{ 'is-on': side === 'buy' }" @click="side = 'buy'">
          <UiIcon name="log-in" /> Mark buys <span class="count">{{ buyCount }}</span>
        </button>
        <button type="button" role="radio" :aria-checked="side === 'sell'" class="side side--sell" :class="{ 'is-on': side === 'sell' }" @click="side = 'sell'">
          <UiIcon name="log-out" /> Mark sells <span class="count">{{ sellCount }}</span>
        </button>
      </div>
      <button v-if="buyCount || sellCount" type="button" class="quiet" @click="clearMarks">
        <UiIcon name="trash-2" /> Clear marks
      </button>
      <span class="mark-need" role="status">{{ stillNeeded }}</span>
      <button type="button" class="find" :disabled="!canSearch" @click="search">
        <UiIcon name="wand-sparkles" /> {{ isSearching ? 'Searching' : 'Find matching strategies' }}
      </button>
    </div>

    <div class="chart-box" :class="{ 'is-busy': isLoadingBars, 'has-proposals': proposals.length }" :aria-busy="isLoadingBars">
      <div ref="container" class="chart" />
      <p v-if="shown" class="chart-key">
        <span class="key-dot" /> Dots: where "{{ shown.name }}" would have traded
      </p>
    </div>

    <p v-if="failure" class="failure" role="alert">
      {{ failure }}
    </p>

    <section v-if="proposals.length" class="proposals" aria-label="Matching strategies">
      <article v-for="(proposal, index) in proposals" :key="proposal.name" class="proposal" :class="{ 'is-shown': index === shownIndex }">
        <header class="proposal-head">
          <h3 class="proposal-name">
            {{ proposal.name }}
          </h3>
          <button v-if="index !== shownIndex" type="button" class="quiet" @click="shownIndex = index">
            <UiIcon name="expand" /> Show on the chart
          </button>
        </header>
        <BuilderStrategyPreview :strategy="proposal.strategy" />
        <p class="proposal-fit">
          {{ matchText(proposal) }}
        </p>
        <p class="proposal-result">
          Whole history: <b :class="proposal.total_return_pct >= 0 ? 'up' : 'down'">{{ formatSignedPercent(proposal.total_return_pct) }}</b>
          over {{ proposal.trade_count }} trades, holding made {{ formatSignedPercent(proposal.buy_and_hold_return_pct) }}
        </p>
        <p v-if="caution(proposal)" class="proposal-caution">
          <UiIcon name="info" /> {{ caution(proposal) }}
        </p>
        <button type="button" class="use" @click="emit('build', proposal.strategy, proposal.name)">
          Build this strategy <UiIcon name="arrow-right" />
        </button>
      </article>
    </section>
  </div>
</template>

<style scoped>
.mark-view {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
  background: var(--board-bg);
  padding: 1rem 1.25rem 1.25rem;
  color: var(--panel-ink);
  font-size: 14px;
}

.mark-head,
.mark-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1rem;
}

.mark-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.mark-text {
  color: var(--panel-soft);
}

.mark-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-left: auto;
}

.market {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border-radius: 10px;
  background: var(--panel);
  padding: 0.3rem 0.6rem;
  box-shadow: inset 0 0 0 1px var(--panel-line);
}

.market select {
  background: transparent;
  font-weight: 700;
  color: var(--panel-ink);
}

.market option {
  background: var(--panel);
  color: var(--panel-ink);
}

.segmented {
  display: inline-flex;
  gap: 2px;
  border-radius: 10px;
  background: var(--panel-fill);
  padding: 3px;
}

.segmented button {
  border-radius: 7px;
  padding: 0.3rem 0.65rem;
  font-size: 13px;
  font-weight: 700;
  color: var(--panel-soft);
  transition: background-color 140ms, color 140ms;
}

.segmented button.is-on {
  background: var(--panel);
  color: var(--panel-ink);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.15), inset 0 0 0 1px var(--panel-line);
}

.sides {
  display: inline-flex;
  gap: 0.4rem;
}

.side {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border-radius: 10px;
  background: var(--panel);
  padding: 0.4rem 0.7rem;
  font-weight: 700;
  color: var(--panel-soft);
  box-shadow: inset 0 0 0 1px var(--panel-line);
  transition: background-color 140ms, color 140ms, box-shadow 140ms;
}

.side--buy.is-on {
  background: color-mix(in srgb, var(--gain-ink) 14%, var(--panel));
  color: var(--gain-ink);
  box-shadow: inset 0 0 0 1.5px var(--gain-ink);
}

.side--sell.is-on {
  background: color-mix(in srgb, var(--loss-ink) 14%, var(--panel));
  color: var(--loss-ink);
  box-shadow: inset 0 0 0 1.5px var(--loss-ink);
}

.count {
  min-width: 1.4rem;
  border-radius: 999px;
  background: var(--panel-fill);
  padding: 0 0.35rem;
  text-align: center;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.quiet {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border-radius: 8px;
  padding: 0.3rem 0.55rem;
  font-size: 13px;
  font-weight: 600;
  color: var(--panel-soft);
  transition: background-color 140ms, color 140ms;
}

.quiet:hover {
  background: var(--panel-fill);
  color: var(--panel-ink);
}

.mark-need {
  margin-left: auto;
  font-size: 13px;
  color: var(--panel-soft);
}

.find,
.use {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border-radius: 10px;
  background: var(--color-lime);
  padding: 0.5rem 0.9rem;
  font-weight: 700;
  color: var(--color-ink);
  transition: background-color 140ms, transform 120ms, opacity 140ms;
}

.find:hover:not(:disabled),
.use:hover {
  background: #d6f87c;
}

.find:active:not(:disabled),
.use:active {
  transform: scale(0.97);
}

.find:disabled {
  opacity: 0.45;
}

.chart-box {
  position: relative;
  min-height: 22rem;
  flex: 1 0 22rem;
  border-radius: 18px;
  background: var(--panel);
  padding: 0.6rem;
  box-shadow: var(--panel-shadow);
  transition: opacity 200ms;
}

/* Once there are proposals the chart gives up room, so the first of them shows without scrolling. */
.chart-box.has-proposals {
  flex: 0 0 22rem;
}

.chart-box.is-busy {
  opacity: 0.55;
}

.chart {
  height: 100%;
  cursor: crosshair;
}

.chart-key {
  position: absolute;
  top: 0.8rem;
  left: 1rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  border-radius: 8px;
  background: color-mix(in srgb, var(--panel) 85%, transparent);
  padding: 0.2rem 0.5rem;
  font-size: 12px;
  color: var(--panel-soft);
  pointer-events: none;
}

.key-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  background: var(--accent-ink);
}

.failure {
  border-radius: 10px;
  background: var(--panel);
  padding: 0.55rem 0.75rem;
  color: var(--loss-ink);
  box-shadow: inset 0 0 0 1px var(--panel-line);
}

.proposals {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
  gap: 0.75rem;
}

.proposal {
  display: grid;
  align-content: start;
  gap: 0.6rem;
  border-radius: 18px;
  background: var(--panel);
  padding: 1rem;
  box-shadow: var(--panel-shadow);
  animation: proposal-in 260ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
}

.proposal:nth-child(2) {
  animation-delay: 70ms;
}

.proposal:nth-child(3) {
  animation-delay: 140ms;
}

@keyframes proposal-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

.proposal.is-shown {
  box-shadow: var(--panel-shadow), inset 0 0 0 1.5px var(--accent-ink);
}

.proposal-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.proposal-head .quiet {
  margin-left: auto;
}

.proposal-name {
  font-size: 16px;
  font-weight: 700;
}

.proposal-fit,
.proposal-result {
  font-size: 13px;
  line-height: 1.45;
  color: var(--panel-soft);
  font-variant-numeric: tabular-nums;
}

.proposal-result b {
  color: var(--panel-ink);
}

.proposal-result .up {
  color: var(--gain-ink);
}

.proposal-result .down {
  color: var(--loss-ink);
}

.proposal-caution {
  display: flex;
  gap: 0.4rem;
  border-radius: 10px;
  background: var(--panel-fill);
  padding: 0.5rem 0.6rem;
  font-size: 13px;
  line-height: 1.4;
}

.proposal-caution .ui-icon {
  width: 1rem;
  height: 1rem;
  margin-top: 0.1rem;
  color: var(--loss-ink);
}

.market:focus-within,
.segmented button:focus-visible,
.side:focus-visible,
.quiet:focus-visible,
.find:focus-visible,
.use:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.market select:focus {
  outline: none;
}

@media (prefers-reduced-motion: reduce) {
  .proposal {
    animation: none;
  }
}
</style>
