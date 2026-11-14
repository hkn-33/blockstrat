<script setup lang="ts">
import {
  BaselineSeries,
  CandlestickSeries,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { ChartTheme } from '~/composables/useChartTheme'
import type { ChartData, ChartTrade, IndicatorLine } from '~/utils/chartData'

// A chart in the manner of TradingView's strategy view: candles (with volume when known), every trade
// marked on them, and the account balance against simply holding in a pane underneath. The first draw
// runs left to right; given `progress` (0 to 1) it shows just that share of the period, so a scroll can
// draw it. `interactive` adds zoom and pan, and `focusTrade` moves the view onto one trade.
const props = withDefaults(defineProps<{
  data: ChartData
  name: string
  icon?: string
  detail?: string
  startingCash?: number
  delayMs?: number
  height?: number
  theme?: ChartTheme | 'auto'
  progress?: number
  interactive?: boolean
  // Draw every new data set from left to right, not only the first one.
  redrawAnimated?: boolean
  // The strategy's own indicators: averages over the candles, oscillators in panes under them.
  indicators?: IndicatorLine[]
}>(), {
  icon: undefined,
  detail: undefined,
  startingCash: 10_000,
  delayMs: 0,
  height: 420,
  theme: 'dark',
  progress: undefined,
  interactive: false,
  redrawAnimated: false,
  indicators: () => [],
})

const INDICATOR_COLOURS = ['#f5a524', '#2962ff', '#e040fb', '#00bcd4', '#ff7043', '#8bc34a']
const OSCILLATOR_PANE_HEIGHT = 96
const oscillatorPanes = computed(() => [...new Set(props.indicators.filter(line => line.pane !== 'price').map(line => line.pane))])
// Each oscillator pane adds its height, so the candles keep theirs.
const chartHeight = computed(() => props.height + oscillatorPanes.value.length * OSCILLATOR_PANE_HEIGHT)
let indicatorSeries: ISeriesApi<'Line'>[] = []

function drawIndicators(): void {
  if (!chart) return
  // The candles and the balance are panes 0 and 1; panes below them, and their series, belonged to the last
  // indicators. Removing a pane disposes its series, so only those left over the candles are removed after.
  while (chart.panes().length > 2) chart.removePane(chart.panes().length - 1)
  const overCandles = chart.panes()[0]?.getSeries() ?? []
  for (const series of indicatorSeries) {
    if (overCandles.includes(series)) chart.removeSeries(series)
  }
  indicatorSeries = []
  props.indicators.forEach((line, index) => {
    const pane = line.pane === 'price' ? 0 : 2 + oscillatorPanes.value.indexOf(line.pane)
    const series = chart!.addSeries(LineSeries, {
      color: INDICATOR_COLOURS[index % INDICATOR_COLOURS.length],
      lineWidth: 2,
      title: line.label,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    }, pane)
    series.setData(line.points.map(({ time, value }) => ({ time: time as UTCTimestamp, value })))
    indicatorSeries.push(series)
  })
  chart.panes().slice(2).forEach(pane => pane.setHeight(OSCILLATOR_PANE_HEIGHT))
}

const DRAW_MS = 1100

const container = ref<HTMLDivElement | null>(null)
const legend = ref({ open: 0, high: 0, low: 0, close: 0, change: 0 })
const resolvedTheme = useResolvedChartTheme(() => props.theme)
const palette = computed(() => chartPalette(resolvedTheme.value))

let chart: IChartApi | undefined
let candleSeries: ISeriesApi<'Candlestick'> | undefined
let volumeSeries: ISeriesApi<'Histogram'> | undefined
let equitySeries: ISeriesApi<'Baseline'> | undefined
let holdingSeries: ISeriesApi<'Line'> | undefined
let markers: ISeriesMarkersPluginApi<Time> | undefined
let frame = 0
let showUpTo: ((count: number) => void) | undefined
let delayTimer: ReturnType<typeof setTimeout> | undefined
let observer: IntersectionObserver | undefined
let hasBeenSeen = false
let hasDrawn = false
let drawnPeriod = ''

function showLegendAt(index: number): void {
  const candle = props.data.candles[index]
  if (!candle) return
  legend.value = { open: candle.open, high: candle.high, low: candle.low, close: candle.close, change: ((candle.close - candle.open) / candle.open) * 100 }
}

function price(value: number): string {
  return value >= 1000 ? value.toLocaleString('en-US', { maximumFractionDigits: 0 }) : value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

/** The candle a moment falls in. A long history comes merged into fewer candles, so a trade's own time is
 * usually inside one rather than on it. */
function candleTimeAt(time: number): number {
  const candles = props.data.candles
  let low = 0
  let high = candles.length - 1
  while (low < high) {
    const middle = (low + high + 1) >> 1
    if (candles[middle]!.time <= time) low = middle
    else high = middle - 1
  }
  return candles[low]!.time
}

// Every marker sits on a candle the chart has, and a candle carries at most one of each kind: a marker off
// the data, or a thousand of them, makes the chart search for each one again on every frame it draws.
function tradeMarkers(): SeriesMarker<Time>[] {
  const colours = palette.value
  const byCandle = new Map<string, SeriesMarker<Time>>()
  for (const trade of props.data.trades) {
    const isShort = trade.direction === 'short'
    const entryTime = candleTimeAt(trade.entry_time)
    const exitTime = candleTimeAt(trade.exit_time)
    byCandle.set(`in:${entryTime}`, { time: entryTime as UTCTimestamp, position: isShort ? 'aboveBar' : 'belowBar', color: colours.accent, shape: isShort ? 'arrowDown' : 'arrowUp', size: 0.8 })
    byCandle.set(`out:${exitTime}`, {
      time: exitTime as UTCTimestamp,
      position: isShort ? 'belowBar' : 'aboveBar',
      color: trade.return_pct >= 0 ? colours.up : colours.down,
      shape: isShort ? 'arrowUp' : 'arrowDown',
      size: 0.8,
    })
  }
  return [...byCandle.values()].sort((a, b) => (a.time as number) - (b.time as number))
}

function applyTheme(): void {
  if (!chart || !candleSeries || !equitySeries || !holdingSeries) return
  const colours = palette.value
  chart.applyOptions({
    layout: { textColor: colours.text, panes: { separatorColor: colours.separator, enableResize: false } },
    grid: { vertLines: { color: colours.grid }, horzLines: { color: colours.grid } },
  })
  candleSeries.applyOptions({ upColor: colours.up, downColor: colours.down, wickUpColor: colours.up, wickDownColor: colours.down })
  holdingSeries.applyOptions({ color: colours.holding })
  equitySeries.applyOptions({
    topLineColor: colours.up,
    topFillColor1: `${colours.upFill}0.35)`,
    topFillColor2: `${colours.upFill}0.02)`,
    bottomLineColor: colours.down,
    bottomFillColor1: `${colours.downFill}0.02)`,
    bottomFillColor2: `${colours.downFill}0.35)`,
  })
}

function draw(): void {
  if (!chart || !candleSeries || !volumeSeries || !equitySeries || !holdingSeries || !markers) return
  cancelAnimationFrame(frame)
  const { candles, equity, holding } = props.data
  if (!candles.length) return
  const colours = palette.value
  const candleData = candles.map(({ time, open, high, low, close }) => ({ time: time as UTCTimestamp, open, high, low, close }))
  const hasVolume = candles.some(candle => candle.volume !== undefined)
  const volumeData = hasVolume
    ? candles.map(({ time, open, close, volume }) => ({ time: time as UTCTimestamp, value: volume ?? 0, color: close >= open ? `${colours.upFill}0.25)` : `${colours.downFill}0.25)` }))
    : []
  const equityData = equity.map(({ time, value }) => ({ time: time as UTCTimestamp, value }))
  const holdingData = holding.map(({ time, value }) => ({ time: time as UTCTimestamp, value }))
  const allMarkers = tradeMarkers()

  // A chart that draws itself has its scales fixed to the whole period, so it does not keep rescaling; a chart
  // to work with fits its scales to the candles in view, as any trading chart does.
  if (!props.interactive) {
    const prices = candles.flatMap(({ high, low }) => [high, low])
    const balances = [...equityData, ...holdingData].map(point => point.value)
    candleSeries.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: { minValue: Math.min(...prices), maxValue: Math.max(...prices) } }) })
    const balanceRange = { minValue: Math.min(...balances), maxValue: Math.max(...balances) }
    equitySeries.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: balanceRange }) })
    holdingSeries.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: balanceRange }) })
  }

  // Drawing itself is a landing-page effect; a chart to work with shows its candles at once.
  const isAnimating = props.progress === undefined && !props.interactive && (!hasDrawn || props.redrawAnimated)
  // A zoomed view survives a new result for the same period; a new market or pace starts zoomed out.
  const period = `${candleData[0]!.time}:${candleData.length}`
  const periodChanged = period !== drawnPeriod
  drawnPeriod = period
  showUpTo = (count: number) => {
    const lastTime = candleData[count - 1]!.time
    const upTo = <T extends { time: UTCTimestamp }>(points: T[]) => points.filter(point => point.time <= lastTime)
    candleSeries!.setData(candleData.slice(0, count))
    volumeSeries!.setData(volumeData.slice(0, count))
    equitySeries!.setData(upTo(equityData))
    holdingSeries!.setData(upTo(holdingData))
    markers!.setMarkers(allMarkers.filter(marker => (marker.time as number) <= lastTime))
    // A new result opens on the whole tested period, so the chart matches the period picked above it.
    if (props.interactive && periodChanged && !isAnimating) showAll()
    else if (!props.interactive || isAnimating || props.progress !== undefined) {
      chart!.timeScale().setVisibleLogicalRange({ from: -2, to: candleData.length + 2 })
    }
    showLegendAt(count - 1)
  }
  hasDrawn = true

  if (props.progress !== undefined) {
    showProgress()
    return
  }
  if (!isAnimating || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    showUpTo(candleData.length)
    return
  }
  const startedAt = performance.now()
  const step = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / DRAW_MS)
    const eased = 1 - (1 - progress) ** 2
    showUpTo!(Math.max(2, Math.ceil(eased * candleData.length)))
    if (progress < 1) frame = requestAnimationFrame(step)
  }
  frame = requestAnimationFrame(step)
}

function showProgress(): void {
  if (!showUpTo || props.progress === undefined) return
  showUpTo(Math.max(2, Math.ceil(props.progress * props.data.candles.length)))
}

/** Moves the view onto one trade, with a little of the market before and after it. */
function focusTrade(trade: ChartTrade): void {
  if (!chart) return
  const candles = props.data.candles
  const entryIndex = candles.findIndex(candle => candle.time >= trade.entry_time)
  const exitIndex = candles.findIndex(candle => candle.time >= trade.exit_time)
  if (entryIndex < 0) return
  const end = exitIndex < 0 ? candles.length - 1 : exitIndex
  const margin = Math.max(12, Math.round((end - entryIndex) * 0.6))
  chart.timeScale().setVisibleLogicalRange({ from: entryIndex - margin, to: end + margin })
  fitPrices()
}

// "Back to latest" brings the newest candles in at a width a trader is used to.
const READABLE_BAR_WIDTH = 8

function showLatest(candleCount: number): void {
  const visible = Math.max(40, Math.floor((container.value?.clientWidth ?? 600) / READABLE_BAR_WIDTH))
  chart?.timeScale().setVisibleLogicalRange({ from: candleCount - visible, to: candleCount + 2 })
  fitPrices()
}

// A chart to work with offers a way back once it has been dragged away from the latest candles.
const isAwayFromLatest = ref(false)

function followRange(): void {
  const range = chart?.timeScale().getVisibleLogicalRange()
  isAwayFromLatest.value = Boolean(range && range.to < props.data.candles.length - 1.5)
}

function showAll(): void {
  chart?.timeScale().fitContent()
  fitPrices()
}

// A chart to work with fits its prices when its view is set, then leaves them alone, as the chart trades are
// drawn on does: panning along the candles no longer makes the price axis, and every candle, jump.
function fitPrices(): void {
  if (!chart || !props.interactive) return
  const scales = [chart.priceScale('right', 0), chart.priceScale('right', 1)]
  for (const scale of scales) scale.applyOptions({ autoScale: true })
  requestAnimationFrame(() => {
    // The chart may have been removed by the next frame.
    if (!chart) return
    for (const scale of scales) scale.applyOptions({ autoScale: false })
  })
}

defineExpose({ focusTrade, showAll })

function onCrosshairMove(param: MouseEventParams<Time>): void {
  if (param.logical === undefined || param.logical === null) {
    showLegendAt(props.data.candles.length - 1)
    return
  }
  showLegendAt(Math.round(param.logical))
}

onMounted(() => {
  const base = baseChartOptions()
  chart = createChart(container.value!, {
    ...base,
    crosshair: { ...base.crosshair, mode: CrosshairMode.Normal },
    // The default 0.5px floor per candle keeps a year of 4-hour candles from fitting; this lets the whole period show.
    timeScale: { ...base.timeScale, rightOffset: 2, timeVisible: props.interactive, minBarSpacing: 0.05 },
    localization: { ...base.localization, priceFormatter: price },
    handleScroll: props.interactive,
    handleScale: props.interactive,
  })

  candleSeries = chart.addSeries(CandlestickSeries, { borderVisible: false })
  volumeSeries = chart.addSeries(HistogramSeries, { priceScaleId: 'volume', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false })
  chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })
  markers = createSeriesMarkers(candleSeries, [])

  holdingSeries = chart.addSeries(LineSeries, {
    lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
  }, 1)
  equitySeries = chart.addSeries(BaselineSeries, {
    baseValue: { type: 'price', price: props.startingCash },
    lineWidth: 2,
    priceLineVisible: false,
    priceFormat: { type: 'custom', formatter: (value: number) => formatDollars(value) },
  }, 1)
  chart.panes()[1]?.setHeight(Math.round(props.height * 0.3))
  applyTheme()
  drawIndicators()
  chart.subscribeCrosshairMove(onCrosshairMove)
  showLegendAt(props.data.candles.length - 1)

  if (props.progress !== undefined) {
    hasBeenSeen = true
    draw()
    return
  }
  if (props.interactive) chart.timeScale().subscribeVisibleLogicalRangeChange(followRange)
  observer = new IntersectionObserver((entries) => {
    if (hasBeenSeen || !entries.some(entry => entry.isIntersecting)) return
    hasBeenSeen = true
    delayTimer = setTimeout(draw, props.delayMs)
  }, { threshold: 0.25 })
  observer.observe(container.value!)
})

watch(() => props.data, () => {
  if (hasBeenSeen) draw()
})

watch(() => props.indicators, drawIndicators)

watch(() => props.progress, () => {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(showProgress)
})

watch(resolvedTheme, () => {
  applyTheme()
  if (hasBeenSeen) draw()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  clearTimeout(delayTimer)
  observer?.disconnect()
  chart?.remove()
  chart = undefined
})
</script>

<template>
  <div class="tv" :class="`tv--${theme}`">
    <ChartBar :icon="icon" :name="name" :detail="detail">
      <span>O <b :class="legend.change >= 0 ? 'up' : 'down'">{{ price(legend.open) }}</b></span>
      <span>H <b :class="legend.change >= 0 ? 'up' : 'down'">{{ price(legend.high) }}</b></span>
      <span>L <b :class="legend.change >= 0 ? 'up' : 'down'">{{ price(legend.low) }}</b></span>
      <span>C <b :class="legend.change >= 0 ? 'up' : 'down'">{{ price(legend.close) }}</b></span>
      <b :class="legend.change >= 0 ? 'up' : 'down'">{{ formatSignedPercent(legend.change, 2) }}</b>
    </ChartBar>
    <div class="tv-plot">
      <div ref="container" class="tv-chart" :style="{ height: `${chartHeight}px` }" role="img" :aria-label="`${name} candles with every trade of the strategy marked, and the account balance underneath`" />
      <!-- Over the candles' pane, just above the time axis and left of the price axis. -->
      <ChartLatest :visible="interactive && isAwayFromLatest" :style="{ right: '4.5rem', bottom: `${Math.round(height * 0.3) + oscillatorPanes.length * OSCILLATOR_PANE_HEIGHT + 40}px` }" @click="showLatest(data.candles.length)" />
    </div>
  </div>
</template>

<style scoped>
/* The legend's colours are the candles' own (see useChartTheme). */
.tv {
  --tv-up: #26a69a;
  --tv-down: #ef5350;
  display: grid;
  font-variant-numeric: tabular-nums;
}

.tv--light,
.tv--auto {
  --tv-up: #089981;
  --tv-down: #f23645;
}

:global(.dark .tv--auto) {
  --tv-up: #26a69a;
  --tv-down: #ef5350;
}

.up {
  color: var(--tv-up);
}

.down {
  color: var(--tv-down);
}

.tv-plot {
  position: relative;
}

.tv-chart {
  width: 100%;
}
</style>
