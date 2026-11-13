<script setup lang="ts">
import { CandlestickSeries, createChart, type IChartApi, type ISeriesApi, type Logical, type UTCTimestamp } from 'lightweight-charts'
import type { DemoCandle, DemoStopLoss, DemoStrategy } from '~/composables/useLandingDemo'

// The builder's "Mark on a chart" view, playing by itself on real SOL/USDT 4-hour candles: a pointer draws three
// long trades, the way TradingView's position tool works (a click at the entry, a click at the target), presses
// "Find matching strategies", and the rules come back with every trade they really made on these candles and
// what those made, fees included. The three drawn trades are three of those real trades, so the fit is true.
// It starts when the card comes into view and loops; with reduced motion it shows the finished state still.
const SHOWN = 150
const MARK_COUNT = 3
const STRATEGY: DemoStrategy = 'trend'
const STOP_LOSS: DemoStopLoss = 5
const candles: DemoCandle[] = demoCandles('SOLUSDT').slice(-SHOWN)
const SEARCH_STAGES = ['Trying every entry idea on your trades', 'Narrowing them with trend and volume', 'Testing the ways out on years of candles']
const RULES = demoRules(STRATEGY, STOP_LOSS)
const STRATEGY_NAME = DEMO_STRATEGY_NAMES[STRATEGY]

const indexByTime = new Map(candles.map((candle, index) => [candle[0], index]))

interface ShownTrade {
  entry: number
  exit: number
  entryPrice: number
  exitPrice: number
  returnPct: number
}

// The rules' real trades that start and end on the candles shown.
const TRADES: ShownTrade[] = demoRun(STRATEGY, 'SOLUSDT', STOP_LOSS).trades.flatMap((trade) => {
  const entry = indexByTime.get(trade.entry_time)
  const exit = indexByTime.get(trade.exit_time)
  if (entry === undefined || exit === undefined) return []
  return [{ entry, exit, entryPrice: trade.entry_price, exitPrice: trade.exit_price, returnPct: trade.return_pct }]
})
const STRETCH_RETURN_PCT = (TRADES.reduce((balance, trade) => balance * (1 + trade.returnPct / 100), 1) - 1) * 100

interface DemoMark {
  entry: number
  end: number
  entryPrice: number
  target: number
  stop: number
  gainPct: number
}

// What the user draws: the three best of those trades, in time order, each boxed from its entry to its exit
// price, with the stop-loss half as far on the other side.
const MARKS: DemoMark[] = [...TRADES]
  .sort((first, second) => second.returnPct - first.returnPct)
  .slice(0, MARK_COUNT)
  .sort((first, second) => first.entry - second.entry)
  .map(trade => ({
    entry: trade.entry,
    end: trade.exit,
    entryPrice: trade.entryPrice,
    target: trade.exitPrice,
    stop: trade.entryPrice - (trade.exitPrice - trade.entryPrice) / 2,
    gainPct: trade.returnPct,
  }))

// ---------- Chart and the boxes' places on it ----------
const card = ref<HTMLDivElement | null>(null)
const container = ref<HTMLDivElement | null>(null)
const findButton = ref<HTMLButtonElement | null>(null)
const resolvedTheme = useResolvedChartTheme(() => 'auto')
let chart: IChartApi | undefined
let series: ISeriesApi<'Candlestick'> | undefined
let resizeObserver: ResizeObserver | undefined

interface BoxPlace {
  left: number
  width: number
  entryY: number
  targetY: number
  stopY: number
}

const places = ref<BoxPlace[]>([])

interface TradePath {
  x1: number
  y1: number
  x2: number
  y2: number
  isWin: boolean
  text: string
}

const tradePaths = ref<TradePath[]>([])
const chartOffset = ref({ left: 0, top: 0 })

function measure(): void {
  if (!chart || !series || !container.value || !card.value) return
  const timeScale = chart.timeScale()
  places.value = MARKS.flatMap((mark) => {
    const left = timeScale.logicalToCoordinate(mark.entry as Logical)
    const right = timeScale.logicalToCoordinate(mark.end as Logical)
    const entryY = series!.priceToCoordinate(mark.entryPrice)
    const targetY = series!.priceToCoordinate(mark.target)
    const stopY = series!.priceToCoordinate(mark.stop)
    if (left === null || right === null || entryY === null || targetY === null || stopY === null) return []
    return [{ left, width: right - left, entryY, targetY, stopY }]
  })
  tradePaths.value = TRADES.flatMap((trade) => {
    const x1 = timeScale.logicalToCoordinate(trade.entry as Logical)
    const x2 = timeScale.logicalToCoordinate(trade.exit as Logical)
    const y1 = series!.priceToCoordinate(trade.entryPrice)
    const y2 = series!.priceToCoordinate(trade.exitPrice)
    if (x1 === null || x2 === null || y1 === null || y2 === null) return []
    return [{ x1, y1, x2, y2, isWin: trade.returnPct >= 0, text: `${trade.returnPct >= 0 ? '+' : '−'}${Math.abs(trade.returnPct).toFixed(1)}%` }]
  })
  const cardBox = card.value.getBoundingClientRect()
  const chartBox = container.value.getBoundingClientRect()
  chartOffset.value = { left: chartBox.left - cardBox.left, top: chartBox.top - cardBox.top }
}

function applyTheme(): void {
  if (!chart || !series) return
  const colours = chartPalette(resolvedTheme.value)
  chart.applyOptions({ layout: { textColor: colours.text }, grid: { vertLines: { color: colours.grid }, horzLines: { color: colours.grid } } })
  series.applyOptions({ upColor: colours.up, downColor: colours.down, wickUpColor: colours.up, wickDownColor: colours.down })
}

// ---------- The play ----------
type Phase = 'drawing' | 'searching' | 'found'
const phase = ref<Phase>('drawing')
const placed = ref(0)
const placing = ref<number | null>(null)
const cursor = ref({ x: 0, y: 0, isVisible: false, isClicking: false, moveMs: 700 })
const stage = ref(0)
const isFading = ref(false)
let timers: ReturnType<typeof setTimeout>[] = []
let observer: IntersectionObserver | undefined
let isPlaying = false

function wait(milliseconds: number): Promise<void> {
  return new Promise(resolve => timers.push(setTimeout(resolve, milliseconds)))
}

async function moveTo(x: number, y: number, milliseconds: number): Promise<void> {
  cursor.value = { ...cursor.value, x, y, moveMs: milliseconds, isVisible: true }
  await wait(milliseconds)
}

async function click(): Promise<void> {
  cursor.value = { ...cursor.value, isClicking: true }
  await wait(160)
  cursor.value = { ...cursor.value, isClicking: false }
}

async function play(): Promise<void> {
  isPlaying = true
  while (isPlaying) {
    measure()
    phase.value = 'drawing'
    placed.value = 0
    placing.value = null
    isFading.value = false
    cursor.value = { x: chartOffset.value.left + 240, y: chartOffset.value.top + 60, isVisible: false, isClicking: false, moveMs: 0 }
    await wait(600)
    for (const [index, place] of places.value.entries()) {
      await moveTo(chartOffset.value.left + place.left, chartOffset.value.top + place.entryY, 800)
      await click()
      placing.value = index
      await moveTo(chartOffset.value.left + place.left + place.width, chartOffset.value.top + place.targetY, 820)
      await click()
      placing.value = null
      placed.value = index + 1
      await wait(380)
    }
    const button = findButton.value?.getBoundingClientRect()
    const cardBox = card.value?.getBoundingClientRect()
    if (button && cardBox) await moveTo(button.left - cardBox.left + button.width / 2, button.top - cardBox.top + button.height / 2, 900)
    await click()
    cursor.value = { ...cursor.value, isVisible: false }
    phase.value = 'searching'
    for (let index = 0; index < SEARCH_STAGES.length; index++) {
      stage.value = index
      await wait(900)
    }
    stage.value = SEARCH_STAGES.length
    phase.value = 'found'
    await wait(6500)
    isFading.value = true
    await wait(500)
  }
}

function showFinished(): void {
  measure()
  placed.value = places.value.length
  phase.value = 'found'
}

onMounted(() => {
  const base = baseChartOptions()
  chart = createChart(container.value!, {
    ...base,
    // Room above the candles for the card with the rules that were found.
    rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.36, bottom: 0.05 } },
    timeScale: { ...base.timeScale, borderVisible: false, rightOffset: 2 },
    handleScroll: false,
    handleScale: false,
    crosshair: { ...base.crosshair, vertLine: { visible: false, labelVisible: false }, horzLine: { visible: false, labelVisible: false } },
  })
  series = chart.addSeries(CandlestickSeries, { borderVisible: false, priceLineVisible: false, lastValueVisible: false })
  series.setData(candles.map(([time, open, highPrice, lowPrice, close]) => ({ time: time as UTCTimestamp, open, high: highPrice, low: lowPrice, close })))
  applyTheme()
  chart.timeScale().setVisibleLogicalRange({ from: -1, to: SHOWN + 1 })
  resizeObserver = new ResizeObserver(() => requestAnimationFrame(measure))
  resizeObserver.observe(container.value!)

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    requestAnimationFrame(showFinished)
    return
  }
  observer = new IntersectionObserver((entries) => {
    if (isPlaying || !entries.some(entry => entry.isIntersecting)) return
    play()
  }, { threshold: 0.4 })
  observer.observe(card.value!)
})

watch(resolvedTheme, applyTheme)

onBeforeUnmount(() => {
  isPlaying = false
  timers.forEach(clearTimeout)
  timers = []
  observer?.disconnect()
  resizeObserver?.disconnect()
  chart?.remove()
})

function boxStyle(place: BoxPlace, part: 'target' | 'stop'): Record<string, string> {
  const top = part === 'target' ? place.targetY : place.entryY
  const bottom = part === 'target' ? place.entryY : place.stopY
  return { left: `${place.left}px`, top: `${top}px`, width: `${place.width}px`, height: `${bottom - top}px` }
}
</script>

<template>
  <div ref="card" class="mark-demo" :class="{ 'is-fading': isFading }" role="img" aria-label="A pointer marks three trades at the dips of a SOL/USDT chart, asks for matching strategies, and a rule that would have taken the same trades appears">
    <div class="demo-head">
      <span class="demo-title">
        <UiIcon name="chart-candlestick" /> Mark your trades
      </span>
      <span class="demo-market"><CoinMark symbol="SOLUSDT" /> SOL/USDT · 4 hours</span>
      <button ref="findButton" type="button" class="demo-find" :class="{ 'is-searching': phase === 'searching' }" tabindex="-1" aria-hidden="true">
        <UiIcon name="wand-sparkles" /> {{ phase === 'searching' ? 'Searching' : 'Find matching strategies' }}
      </button>
    </div>

    <div class="demo-body">
      <div class="demo-rail" aria-hidden="true">
        <span class="demo-tool is-on"><UiIcon name="trending-up" /></span>
        <span class="demo-tool"><UiIcon name="trending-down" /></span>
        <span class="demo-split" />
        <span class="demo-tool"><UiIcon name="maximize-2" /></span>
      </div>
      <div class="demo-chart-area">
        <div ref="container" class="demo-chart" />
        <div class="demo-boxes" aria-hidden="true">
          <template v-for="(place, index) in places" :key="index">
            <div v-if="index < placed || index === placing" class="demo-trade" :class="{ 'is-placing': index === placing }">
              <div class="demo-zone demo-zone--target" :style="boxStyle(place, 'target')" />
              <div class="demo-zone demo-zone--stop" :style="boxStyle(place, 'stop')" />
              <span v-if="index < placed" class="demo-chip" :style="{ left: `${place.left + place.width}px`, top: `${place.targetY}px` }">+{{ MARKS[index]!.gainPct.toFixed(1) }}%</span>
            </div>
          </template>
        </div>

        <Transition name="demo-trades">
          <div v-if="phase === 'found'" class="demo-paths" aria-hidden="true">
            <svg>
              <g v-for="(path, index) in tradePaths" :key="index" :class="path.isWin ? 'is-win' : 'is-loss'" :style="{ animationDelay: `${index * 70}ms` }">
                <line :x1="path.x1" :y1="path.y1" :x2="path.x2" :y2="path.y2" />
                <circle :cx="path.x1" :cy="path.y1" r="3.5" class="path-entry" />
                <circle :cx="path.x2" :cy="path.y2" r="3.5" />
              </g>
            </svg>
            <span v-for="(path, index) in tradePaths" :key="index" class="demo-path-chip" :class="path.isWin ? 'is-win' : 'is-loss'" :style="{ left: `${path.x2}px`, top: `${path.y2}px`, animationDelay: `${index * 70}ms` }">{{ path.text }}</span>
          </div>
        </Transition>

        <Transition name="demo-search">
          <div v-if="phase === 'searching'" class="demo-searching">
            <div class="demo-progress">
              <p class="demo-progress-title">
                <span class="demo-spinner" /> Searching for strategies
              </p>
              <ol>
                <li v-for="(text, index) in SEARCH_STAGES" :key="text" :class="{ 'is-done': index < stage, 'is-now': index === stage }">
                  <UiIcon v-if="index < stage" name="check" />
                  <span v-else class="demo-dot" />
                  {{ text }}
                </li>
              </ol>
            </div>
          </div>
        </Transition>

        <Transition name="demo-found">
          <div v-if="phase === 'found'" class="demo-proposal">
            <div class="demo-proposal-head">
              <span class="demo-badge">Long</span>
              <span class="demo-fit"><UiIcon name="target" /> Gets in on {{ places.length }} of your {{ places.length }} entries</span>
            </div>
            <p class="demo-proposal-name">
              {{ STRATEGY_NAME }}
            </p>
            <div class="demo-rules">
              <span class="demo-rule-label"><UiIcon name="log-in" /> Buy when</span>
              <RuleTile v-for="rule in RULES.entry.conditions" :key="rule.subject + rule.value" :subject="rule.subject" :operator="rule.operator" :value="rule.value" :kind="rule.kind" :icon="rule.kind === 'risk' ? undefined : 'activity'" />
              <span class="demo-rule-label demo-rule-label--sell"><UiIcon name="log-out" /> Sell when any of these</span>
              <RuleTile v-for="rule in RULES.exit.conditions" :key="rule.subject + rule.value" :subject="rule.subject" :operator="rule.operator" :value="rule.value" :kind="rule.kind" :icon="rule.kind === 'risk' ? undefined : 'activity'" />
            </div>
            <p class="demo-result">
              <b :class="STRETCH_RETURN_PCT >= 0 ? 'up' : 'down'">{{ STRETCH_RETURN_PCT >= 0 ? '+' : '−' }}{{ Math.abs(STRETCH_RETURN_PCT).toFixed(1) }}%</b>
              over its {{ TRADES.length }} trades on these candles, fees included
            </p>
          </div>
        </Transition>
      </div>
    </div>

    <span v-if="cursor.isVisible" class="demo-cursor" :class="{ 'is-clicking': cursor.isClicking }" :style="{ transform: `translate(${cursor.x}px, ${cursor.y}px)`, transitionDuration: `${cursor.moveMs}ms` }" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 2.5 19.5 12 12.6 13.4 9.4 20z" /></svg>
    </span>
  </div>
</template>

<style scoped>
.mark-demo {
  position: relative;
  display: flex;
  height: 34rem;
  flex-direction: column;
  overflow: hidden;
  border-radius: 28px;
  background: var(--panel);
  color: var(--panel-ink);
  box-shadow: var(--panel-shadow);
  transition: opacity 400ms cubic-bezier(0.4, 0, 1, 1);
}

.mark-demo.is-fading {
  opacity: 0.35;
}

.demo-head {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  border-bottom: 1px solid var(--panel-line);
  padding: 0.85rem 1rem;
  font-size: 13.5px;
}

.demo-title {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-weight: 700;
}

.demo-market {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--panel-soft);
}

.demo-market :deep(.coin-mark) {
  width: 1.15rem;
  height: 1.15rem;
}

.demo-find {
  display: inline-flex;
  min-width: 13.5rem;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  margin-left: auto;
  border-radius: 10px;
  background: var(--color-lime);
  padding: 0.45rem 0.9rem;
  font-weight: 700;
  color: var(--color-ink);
  pointer-events: none;
}

.demo-find.is-searching {
  background: linear-gradient(90deg, var(--color-lime), #e4fba6, var(--color-lime));
  background-size: 200% 100%;
  animation: demo-shimmer 1.2s linear infinite;
}

@keyframes demo-shimmer {
  to {
    background-position: -200% 0;
  }
}

.demo-body {
  display: flex;
  min-height: 0;
  flex: 1;
}

.demo-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  border-right: 1px solid var(--panel-line);
  padding: 0.6rem 0.45rem;
}

.demo-tool {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 8px;
  color: var(--panel-soft);
}

.demo-tool.is-on {
  background: color-mix(in srgb, #26a69a 16%, transparent);
  color: var(--gain-ink);
  box-shadow: inset 0 0 0 1.5px var(--gain-ink);
}

.demo-split {
  width: 1.2rem;
  height: 1px;
  margin: 0.2rem 0;
  background: var(--panel-line);
}

.demo-chart-area {
  position: relative;
  min-width: 0;
  flex: 1;
}

.demo-chart {
  position: absolute;
  inset: 0.5rem 0.25rem 0.25rem 0.5rem;
}

.demo-boxes {
  position: absolute;
  inset: 0.5rem 0.25rem 0.25rem 0.5rem;
  pointer-events: none;
}

.demo-trade > * {
  position: absolute;
}

.demo-zone--target {
  background: rgb(38 166 154 / 0.3);
  box-shadow: inset 0 0 0 1.5px rgb(38 166 154 / 0.8);
}

.demo-zone--stop {
  background: rgb(239 83 80 / 0.28);
  box-shadow: inset 0 0 0 1.5px rgb(239 83 80 / 0.75);
}

/* While it is being drawn the box opens from its entry towards the pointer, in step with it. */
.demo-trade.is-placing .demo-zone {
  animation: demo-open 820ms cubic-bezier(0.45, 0, 0.25, 1) both;
}

@keyframes demo-open {
  from {
    clip-path: inset(0 100% 0 0);
  }

  to {
    clip-path: inset(0 0 0 0);
  }
}

.demo-chip {
  translate: -50% calc(-100% - 6px);
  border-radius: 6px;
  background: #26a69a;
  padding: 0.05rem 0.4rem;
  font-size: 11.5px;
  font-weight: 700;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
  animation: demo-pop 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes demo-pop {
  from {
    opacity: 0;
    scale: 0.9;
  }
}

.demo-cursor {
  position: absolute;
  z-index: 6;
  top: 0;
  left: 0;
  color: #ffffff;
  pointer-events: none;
  transition-property: transform;
  transition-timing-function: cubic-bezier(0.45, 0, 0.25, 1);
  filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.5));
}

.demo-cursor svg {
  fill: #ffffff;
  stroke: #0d1b24;
  stroke-width: 1.4;
  stroke-linejoin: round;
  translate: -3px -2px;
  transition: scale 120ms;
}

.demo-cursor.is-clicking svg {
  scale: 0.86;
}

/* A ring spreads from the tip on each click. */
.demo-cursor.is-clicking::after {
  position: absolute;
  top: -10px;
  left: -10px;
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-lime);
  border-radius: 999px;
  animation: demo-ring 420ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
  content: "";
}

@keyframes demo-ring {
  to {
    opacity: 0;
    scale: 2;
  }
}

.demo-searching {
  position: absolute;
  z-index: 4;
  inset: 0;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--panel) 35%, transparent);
  backdrop-filter: grayscale(1) blur(4px);
}

.demo-progress {
  display: grid;
  width: min(21rem, calc(100% - 2rem));
  gap: 0.7rem;
  border-radius: 16px;
  background: var(--panel);
  padding: 1rem 1.1rem;
  box-shadow: inset 0 0 0 1px var(--panel-line), 0 24px 48px -20px rgb(0 0 0 / 0.5);
}

.demo-progress-title {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-weight: 700;
}

.demo-progress ol {
  display: grid;
  gap: 0.35rem;
  font-size: 13px;
  color: var(--panel-soft);
}

.demo-progress li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.demo-progress li.is-done {
  color: var(--panel-ink);
}

.demo-progress li.is-done svg {
  width: 0.9rem;
  height: 0.9rem;
  color: var(--gain-ink);
}

.demo-progress li.is-now {
  font-weight: 700;
  color: var(--panel-ink);
}

.demo-dot {
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid var(--panel-line);
  border-radius: 999px;
}

.is-now .demo-dot {
  border-color: var(--color-lime);
}

.demo-spinner {
  width: 0.95rem;
  height: 0.95rem;
  border: 2px solid var(--panel-line);
  border-top-color: var(--color-lime);
  border-radius: 999px;
  animation: demo-spin 700ms linear infinite;
}

@keyframes demo-spin {
  to {
    rotate: 1turn;
  }
}

.demo-search-enter-active {
  transition: opacity 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.demo-search-leave-active {
  transition: opacity 180ms cubic-bezier(0.4, 0, 1, 1);
}

.demo-search-enter-from,
.demo-search-leave-to {
  opacity: 0;
}

/* The strategy that was found settles in over the chart's lower right. */
.demo-proposal {
  position: absolute;
  z-index: 5;
  top: 1rem;
  left: 1rem;
  display: grid;
  width: min(21rem, calc(100% - 2rem));
  gap: 0.45rem;
  border-radius: 16px;
  background: var(--panel);
  padding: 0.9rem 1rem;
  box-shadow: inset 0 0 0 1.5px var(--accent-ink), 0 24px 48px -18px rgb(0 0 0 / 0.55);
}

.demo-found-enter-active {
  transition: opacity 480ms cubic-bezier(0.22, 1, 0.36, 1), transform 520ms cubic-bezier(0.22, 1, 0.36, 1), filter 480ms cubic-bezier(0.22, 1, 0.36, 1);
}

.demo-found-leave-active {
  transition: opacity 200ms cubic-bezier(0.4, 0, 1, 1);
}

.demo-found-enter-from {
  opacity: 0;
  transform: translateY(14px);
  filter: blur(6px);
}

.demo-found-leave-to {
  opacity: 0;
}

.demo-result {
  border-top: 1px solid var(--panel-line);
  padding-top: 0.55rem;
  font-size: 13px;
  color: var(--panel-soft);
}

.demo-result b {
  font-size: 16px;
  font-variant-numeric: tabular-nums;
}

.demo-result .up {
  color: var(--gain-ink);
}

.demo-result .down {
  color: var(--loss-ink);
}

/* The rules' real trades: a line from the price it bought at to the price it sold at, one after another. */
.demo-paths {
  position: absolute;
  z-index: 3;
  inset: 0.5rem 0.25rem 0.25rem 0.5rem;
  pointer-events: none;
}

.demo-paths svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.demo-paths g,
.demo-path-chip {
  animation: demo-pop 300ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
}

.demo-paths line {
  stroke-width: 2;
}

.demo-paths .is-win line,
.demo-paths .is-win circle {
  stroke: #26a69a;
}

.demo-paths .is-loss line,
.demo-paths .is-loss circle {
  stroke: #ef5350;
}

.demo-paths circle {
  fill: var(--panel);
  stroke-width: 2;
}

.demo-paths circle.path-entry {
  fill: var(--color-lime);
  stroke: var(--panel) !important;
}

.demo-path-chip {
  position: absolute;
  translate: -50% calc(-100% - 7px);
  border-radius: 6px;
  padding: 0.05rem 0.35rem;
  font-size: 11px;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.demo-path-chip.is-win {
  background: #26a69a;
}

.demo-path-chip.is-loss {
  background: #ef5350;
}

.demo-trades-leave-active {
  transition: opacity 200ms cubic-bezier(0.4, 0, 1, 1);
}

.demo-trades-leave-to {
  opacity: 0;
}

.demo-proposal-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 12.5px;
}

.demo-badge {
  border-radius: 6px;
  background: #00796b;
  padding: 0.1rem 0.45rem;
  font-weight: 700;
  color: #ffffff;
}

.demo-fit {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-weight: 600;
  color: var(--panel-soft);
}

.demo-proposal-name {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.3;
}

.demo-rules {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  font-size: 11.5px;
}

.demo-rule-label {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.35rem;
  font-weight: 700;
  color: var(--gain-ink);
}

.demo-rule-label--sell {
  margin-top: 0.2rem;
  color: var(--loss-ink);
}

@media (prefers-reduced-motion: reduce) {
  .mark-demo,
  .demo-trade.is-placing .demo-zone,
  .demo-chip,
  .demo-paths g,
  .demo-path-chip,
  .demo-find.is-searching,
  .demo-spinner,
  .demo-found-enter-active {
    transition: none;
    animation: none;
  }
}

@media (max-width: 640px) {
  .demo-market,
  .demo-rail {
    display: none;
  }

  .demo-find {
    min-width: 0;
  }
}
</style>
