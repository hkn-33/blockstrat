<script setup lang="ts">
import {
  BaselineSeries,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { DemoMarket, DemoRun } from '~/composables/useLandingDemo'

// The balance pane of the hero chart on its own: the strategy's $10,000 against simply holding (dashed).
const props = withDefaults(defineProps<{ market: DemoMarket, run: DemoRun, height?: number }>(), { height: 120 })

const container = ref<HTMLDivElement | null>(null)
const resolvedTheme = useResolvedChartTheme(() => 'auto')
let chart: IChartApi | undefined
let equitySeries: ISeriesApi<'Baseline'> | undefined
let holdingSeries: ISeriesApi<'Line'> | undefined

function setData(): void {
  if (!equitySeries || !holdingSeries) return
  const candles = demoCandles(props.market)
  const firstClose = candles[0]![4]
  equitySeries.setData(candles.map(([time], index) => ({ time: time as UTCTimestamp, value: props.run.equity[index] ?? DEMO_STARTING_CASH })))
  holdingSeries.setData(candles.map(([time, , , , close]) => ({ time: time as UTCTimestamp, value: (DEMO_STARTING_CASH * close) / firstClose })))
  chart?.timeScale().fitContent()
}

function applyTheme(): void {
  if (!equitySeries || !holdingSeries) return
  const colours = chartPalette(resolvedTheme.value)
  holdingSeries.applyOptions({ color: colours.holding })
  equitySeries.applyOptions({
    topLineColor: colours.up,
    topFillColor1: `${colours.upFill}0.3)`,
    topFillColor2: `${colours.upFill}0.02)`,
    bottomLineColor: colours.down,
    bottomFillColor1: `${colours.downFill}0.02)`,
    bottomFillColor2: `${colours.downFill}0.3)`,
  })
}

onMounted(() => {
  const base = baseChartOptions()
  chart = createChart(container.value!, {
    ...base,
    grid: { vertLines: { visible: false }, horzLines: { visible: false } },
    rightPriceScale: { visible: false },
    timeScale: { visible: false },
    crosshair: { vertLine: { visible: false }, horzLine: { visible: false } },
  })
  holdingSeries = chart.addSeries(LineSeries, {
    lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
  })
  equitySeries = chart.addSeries(BaselineSeries, {
    baseValue: { type: 'price', price: DEMO_STARTING_CASH },
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  })
  applyTheme()
  setData()
})

watch(() => [props.run, props.market], setData)
watch(resolvedTheme, applyTheme)

onBeforeUnmount(() => chart?.remove())
</script>

<template>
  <div ref="container" :style="{ height: `${height}px` }" role="img" aria-label="The strategy's balance against simply holding the coin, from the same $10,000" />
</template>
