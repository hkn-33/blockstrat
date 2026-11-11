<script setup lang="ts">
import {
  BaselineSeries,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { DemoMarket, DemoRun } from '~/composables/useLandingDemo'

// How far the balance sat below its last high, day by day: the "underwater" chart of a strategy report,
// in the hero chart's style, with the deepest point marked.
const props = defineProps<{ market: DemoMarket, run: DemoRun }>()

const container = ref<HTMLDivElement | null>(null)
const coin = computed(() => demoMarket(props.market))
const resolvedTheme = useResolvedChartTheme(() => 'auto')
let chart: IChartApi | undefined
let series: ISeriesApi<'Baseline'> | undefined
let markers: ISeriesMarkersPluginApi<Time> | undefined

const points = computed(() => {
  let peak = 0
  const times = demoCandles(props.market).map(([time]) => time as UTCTimestamp)
  return props.run.equity.map((value, index) => {
    peak = Math.max(peak, value)
    return { time: times[index]!, value: (value / peak - 1) * 100 }
  })
})

const deepest = computed(() => points.value.reduce((lowest, point) => (point.value < lowest.value ? point : lowest)))
const maxDrawdown = computed(() => formatSignedPercent(-Math.abs(props.run.metrics.max_drawdown_pct)))

function applyTheme(): void {
  if (!chart || !series || !markers) return
  const colours = chartPalette(resolvedTheme.value)
  chart.applyOptions({
    layout: { textColor: colours.text },
    grid: { vertLines: { visible: false }, horzLines: { color: colours.grid } },
  })
  series.applyOptions({
    bottomLineColor: colours.down,
    bottomFillColor1: `${colours.downFill}0.05)`,
    bottomFillColor2: `${colours.downFill}0.4)`,
  })
  // The label quotes the backtest's own max drawdown (measured on 4h bars), the number the strategy
  // tester shows, at the deepest point of these daily closes.
  markers.setMarkers([
    { time: deepest.value.time, position: 'belowBar', color: colours.down, shape: 'arrowUp', text: `Worst point ${maxDrawdown.value}` },
  ])
}

onMounted(() => {
  const base = baseChartOptions()
  chart = createChart(container.value!, {
    ...base,
    rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.18 } },
    localization: { ...base.localization, priceFormatter: (value: number) => `${Math.round(value)}%` },
  })
  series = chart.addSeries(BaselineSeries, {
    baseValue: { type: 'price', price: 0 },
    topLineColor: 'rgba(0,0,0,0)',
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
    // Whole steps of 10% down to just past the worst point, so the axis ends on a clean label.
    autoscaleInfoProvider: () => ({ priceRange: { minValue: Math.floor(deepest.value.value / 10) * 10, maxValue: 0 } }),
  })
  series.setData(points.value)
  markers = createSeriesMarkers(series, [])
  applyTheme()
  chart.timeScale().fitContent()
})

watch(resolvedTheme, applyTheme)

onBeforeUnmount(() => chart?.remove())
</script>

<template>
  <div>
    <LandingChartBar :icon="coin.icon" :name="coin.label" detail="Trend with filter, balance below its last high">
      <span>Max drawdown <b class="text-[var(--loss-ink)]">{{ maxDrawdown }}</b></span>
    </LandingChartBar>
    <div ref="container" class="mx-3 h-[220px]" role="img" aria-label="How far the balance sat below its last high over time, with the deepest point marked" />
  </div>
</template>
