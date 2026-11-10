<script setup lang="ts">
import {
  BaselineSeries,
  CandlestickSeries,
  ColorType,
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
import type { DemoMarket, DemoRun } from '~/composables/useLandingDemo'

// A chart in the manner of TradingView's strategy view: daily candles with volume, every trade marked
// on them, and the account balance in a pane underneath. It draws from left to right when first seen.
const props = withDefaults(defineProps<{
  market: DemoMarket
  run: DemoRun
  delayMs?: number
  height?: number
  theme?: ChartTheme | 'auto'
}>(), { delayMs: 0, height: 420, theme: 'dark' })

const DRAW_MS = 1100

const container = ref<HTMLDivElement | null>(null)
const coin = computed(() => demoMarket(props.market))
const candles = computed(() => demoCandles(props.market))
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
let delayTimer: ReturnType<typeof setTimeout> | undefined
let observer: IntersectionObserver | undefined
let hasBeenSeen = false

function showLegendAt(index: number): void {
  const candle = candles.value[index]
  if (!candle) return
  const [, open, high, low, close] = candle
  legend.value = { open, high, low, close, change: ((close - open) / open) * 100 }
}

function price(value: number): string {
  return value >= 1000 ? value.toLocaleString('en-US', { maximumFractionDigits: 0 }) : value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function tradeMarkers(): SeriesMarker<Time>[] {
  const colours = palette.value
  return props.run.trades.flatMap(trade => [
    { time: trade.entry_time as UTCTimestamp, position: 'belowBar', color: colours.accent, shape: 'arrowUp', size: 0.8 },
    {
      time: trade.exit_time as UTCTimestamp,
      position: 'aboveBar',
      color: trade.return_pct >= 0 ? colours.up : colours.down,
      shape: 'arrowDown',
      size: 0.8,
    },
  ] satisfies SeriesMarker<Time>[])
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
  const colours = palette.value
  const rows = candles.value
  const firstClose = rows[0]![4]
  const candleData = rows.map(([time, open, high, low, close]) => ({ time: time as UTCTimestamp, open, high, low, close }))
  const volumeData = rows.map(([time, open, , , close, volume]) => ({ time: time as UTCTimestamp, value: volume, color: close >= open ? `${colours.upFill}0.25)` : `${colours.downFill}0.25)` }))
  const equityData = rows.map(([time], index) => ({ time: time as UTCTimestamp, value: props.run.equity[index] ?? DEMO_STARTING_CASH }))
  const holdingData = rows.map(([time, , , , close]) => ({ time: time as UTCTimestamp, value: (DEMO_STARTING_CASH * close) / firstClose }))
  const allMarkers = tradeMarkers()

  const prices = rows.flatMap(([, , high, low]) => [high, low])
  const balances = [...equityData, ...holdingData].map(point => point.value)
  candleSeries.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: { minValue: Math.min(...prices), maxValue: Math.max(...prices) } }) })
  const balanceRange = { minValue: Math.min(...balances), maxValue: Math.max(...balances) }
  equitySeries.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: balanceRange }) })
  holdingSeries.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: balanceRange }) })

  const showUpTo = (count: number) => {
    candleSeries!.setData(candleData.slice(0, count))
    volumeSeries!.setData(volumeData.slice(0, count))
    equitySeries!.setData(equityData.slice(0, count))
    holdingSeries!.setData(holdingData.slice(0, count))
    const lastTime = candleData[count - 1]!.time
    markers!.setMarkers(allMarkers.filter(marker => (marker.time as number) <= lastTime))
    chart!.timeScale().setVisibleLogicalRange({ from: -2, to: candleData.length + 2 })
    showLegendAt(count - 1)
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    showUpTo(candleData.length)
    return
  }
  const startedAt = performance.now()
  const step = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / DRAW_MS)
    const eased = 1 - (1 - progress) ** 2
    showUpTo(Math.max(2, Math.ceil(eased * candleData.length)))
    if (progress < 1) frame = requestAnimationFrame(step)
  }
  frame = requestAnimationFrame(step)
}

function onCrosshairMove(param: MouseEventParams<Time>): void {
  if (param.logical === undefined || param.logical === null) {
    showLegendAt(candles.value.length - 1)
    return
  }
  showLegendAt(Math.round(param.logical))
}

onMounted(() => {
  chart = createChart(container.value!, {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      fontFamily: 'Satoshi, ui-sans-serif, system-ui, sans-serif',
      fontSize: 11,
      attributionLogo: false,
    },
    crosshair: { mode: CrosshairMode.Normal },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false, rightOffset: 2 },
    localization: { locale: 'en-US', priceFormatter: price },
    handleScroll: false,
    handleScale: false,
  })

  candleSeries = chart.addSeries(CandlestickSeries, { borderVisible: false })
  volumeSeries = chart.addSeries(HistogramSeries, { priceScaleId: 'volume', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false })
  chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })
  markers = createSeriesMarkers(candleSeries, [])

  holdingSeries = chart.addSeries(LineSeries, {
    lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
  }, 1)
  equitySeries = chart.addSeries(BaselineSeries, {
    baseValue: { type: 'price', price: DEMO_STARTING_CASH },
    lineWidth: 2,
    priceLineVisible: false,
    priceFormat: { type: 'custom', formatter: (value: number) => formatDollars(value) },
  }, 1)
  chart.panes()[1]?.setHeight(Math.round(props.height * 0.3))
  applyTheme()
  chart.subscribeCrosshairMove(onCrosshairMove)
  showLegendAt(candles.value.length - 1)

  observer = new IntersectionObserver((entries) => {
    if (hasBeenSeen || !entries.some(entry => entry.isIntersecting)) return
    hasBeenSeen = true
    delayTimer = setTimeout(draw, props.delayMs)
  }, { threshold: 0.25 })
  observer.observe(container.value!)
})

watch(() => [props.run, props.market], () => {
  if (hasBeenSeen) draw()
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
})
</script>

<template>
  <div class="tv" :class="`tv--${resolvedTheme}`">
    <div class="tv-bar">
      <img :src="`/brand-icons/${coin.icon}.svg`" alt="" class="coin">
      <span class="tv-name">{{ coin.label }}</span>
      <span class="tv-dim">· 1D candles · 4h strategy · Binance</span>
      <span class="tv-ohlc">
        <span>O <b :class="legend.change >= 0 ? 'up' : 'down'">{{ price(legend.open) }}</b></span>
        <span>H <b :class="legend.change >= 0 ? 'up' : 'down'">{{ price(legend.high) }}</b></span>
        <span>L <b :class="legend.change >= 0 ? 'up' : 'down'">{{ price(legend.low) }}</b></span>
        <span>C <b :class="legend.change >= 0 ? 'up' : 'down'">{{ price(legend.close) }}</b></span>
        <b :class="legend.change >= 0 ? 'up' : 'down'">{{ formatSignedPercent(legend.change, 2) }}</b>
      </span>
    </div>
    <div ref="container" class="tv-chart" :style="{ height: `${height}px` }" role="img" :aria-label="`Daily ${coin.label} candles with every trade of the strategy marked, and the account balance underneath`" />
  </div>
</template>

<style scoped>
.tv {
  --tv-text: rgb(214 226 230 / 0.75);
  --tv-strong: #ffffff;
  --tv-up: var(--color-gain-bright);
  --tv-down: var(--color-loss-bright);
  display: grid;
  font-variant-numeric: tabular-nums;
}

.tv--light {
  --tv-text: #56676f;
  --tv-strong: #0d1b24;
  --tv-up: var(--color-gain);
  --tv-down: var(--color-loss);
}

.tv-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.6rem;
  padding: 0.8rem 1rem;
  font-size: 13px;
  color: var(--tv-text);
}

.tv-name {
  font-weight: 700;
  color: var(--tv-strong);
}

.coin {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 999px;
  background: #ffffff;
  padding: 1px;
}

.tv-ohlc {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-left: auto;
}

.tv-ohlc b {
  font-weight: 600;
}

.up {
  color: var(--tv-up);
}

.down {
  color: var(--tv-down);
}

.tv-chart {
  width: 100%;
}

@media (max-width: 640px) {
  .tv-ohlc {
    display: none;
  }
}
</style>
