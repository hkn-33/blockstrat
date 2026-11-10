<script setup lang="ts">
import {
  BaselineSeries,
  ColorType,
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
// with the deepest point marked.
const props = defineProps<{ market: DemoMarket, run: DemoRun }>()

const container = ref<HTMLDivElement | null>(null)
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
  const deepest = points.value.reduce((lowest, point) => (point.value < lowest.value ? point : lowest))
  markers.setMarkers([
    { time: deepest.time, position: 'belowBar', color: colours.down, shape: 'arrowUp', text: `Worst point ${formatSignedPercent(deepest.value)}` },
  ])
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
    rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.18 } },
    timeScale: { borderVisible: false },
    localization: { locale: 'en-US', priceFormatter: (value: number) => `${Math.round(value)}%` },
    handleScroll: false,
    handleScale: false,
  })
  series = chart.addSeries(BaselineSeries, {
    baseValue: { type: 'price', price: 0 },
    topLineColor: 'rgba(0,0,0,0)',
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
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
  <div ref="container" class="h-full w-full" role="img" aria-label="How far the balance sat below its last high over time, with the deepest point marked" />
</template>
