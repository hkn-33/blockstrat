<script setup lang="ts">
import {
  CandlestickSeries,
  ColorType,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { BacktestResult } from '~/types/api'

const props = defineProps<{ result: BacktestResult }>()

const priceContainer = ref<HTMLDivElement | null>(null)
const equityContainer = ref<HTMLDivElement | null>(null)

const GREEN = '#059669'
const RED = '#dc2626'
const CHART_OPTIONS = {
  autoSize: true,
  layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#475569', fontFamily: 'Inter, sans-serif', attributionLogo: false },
  grid: { vertLines: { color: '#f1f5f9' }, horzLines: { color: '#f1f5f9' } },
  rightPriceScale: { borderVisible: false },
  // The default minimum bar spacing (0.5 px) is too wide to fit thousands of bars into the panel.
  timeScale: { borderVisible: false, minBarSpacing: 0.05 },
}

let priceChart: IChartApi
let equityChart: IChartApi
let candles: ISeriesApi<'Candlestick'>
let equityLine: ISeriesApi<'Line'>
let buyAndHoldLine: ISeriesApi<'Line'>
let markers: ISeriesMarkersPluginApi<Time>

onMounted(() => {
  priceChart = createChart(priceContainer.value!, CHART_OPTIONS)
  candles = priceChart.addSeries(CandlestickSeries, {
    upColor: GREEN, downColor: RED, borderVisible: false, wickUpColor: GREEN, wickDownColor: RED,
  })
  markers = createSeriesMarkers(candles, [])

  equityChart = createChart(equityContainer.value!, CHART_OPTIONS)
  buyAndHoldLine = equityChart.addSeries(LineSeries, { color: '#94a3b8', lineWidth: 2, title: 'Buy & hold' })
  equityLine = equityChart.addSeries(LineSeries, { color: '#2563eb', lineWidth: 2, title: 'Strategy' })

  // Bars and curves share the same timestamps, so the two charts scroll and zoom together.
  linkTimeScales(priceChart, equityChart)
  linkTimeScales(equityChart, priceChart)

  render(props.result)
})

onBeforeUnmount(() => {
  priceChart?.remove()
  equityChart?.remove()
})

watch(() => props.result, render)

function render(result: BacktestResult): void {
  candles.setData(result.bars.map(bar => ({ ...bar, time: bar.time as UTCTimestamp })))
  equityLine.setData(result.equity.map(point => ({ time: point.time as UTCTimestamp, value: point.value })))
  buyAndHoldLine.setData(result.buy_and_hold.map(point => ({ time: point.time as UTCTimestamp, value: point.value })))
  markers.setMarkers(tradeMarkers(result))
  // autoSize measures the container on the next frame; fitting earlier would fit a zero-width chart.
  requestAnimationFrame(() => {
    priceChart.timeScale().fitContent()
    equityChart.timeScale().fitContent()
  })
}

let isSyncing = false

function linkTimeScales(source: IChartApi, target: IChartApi): void {
  source.timeScale().subscribeVisibleLogicalRangeChange((range) => {
    if (!range || isSyncing) return
    isSyncing = true
    target.timeScale().setVisibleLogicalRange(range)
    isSyncing = false
  })
}

function tradeMarkers(result: BacktestResult): SeriesMarker<Time>[] {
  const barTimes = result.bars.map(bar => bar.time)
  const list: SeriesMarker<Time>[] = []
  for (const trade of result.trades) {
    const isLong = trade.direction === 'long'
    list.push({
      time: barAtOrBefore(barTimes, trade.entry_time) as UTCTimestamp,
      position: isLong ? 'belowBar' : 'aboveBar',
      shape: isLong ? 'arrowUp' : 'arrowDown',
      color: isLong ? GREEN : RED,
    })
    list.push({
      time: barAtOrBefore(barTimes, trade.exit_time) as UTCTimestamp,
      position: isLong ? 'aboveBar' : 'belowBar',
      shape: 'circle',
      color: trade.profit >= 0 ? GREEN : RED,
      size: 0.6,
    })
  }
  return list.sort((a, b) => (a.time as number) - (b.time as number))
}

/** Long histories are merged into fewer chart bars, so a trade lands on the bar that contains it. */
function barAtOrBefore(barTimes: number[], time: number): number {
  let low = 0
  let high = barTimes.length - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (barTimes[middle]! <= time) low = middle
    else high = middle - 1
  }
  return barTimes[low]!
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div ref="priceContainer" class="h-56 w-full" />
    <div class="flex items-center gap-4 px-1 text-xs text-slate-500">
      <span class="flex items-center gap-1"><span class="h-0.5 w-4 bg-blue-600" /> Strategy equity</span>
      <span class="flex items-center gap-1"><span class="h-0.5 w-4 bg-slate-400" /> Buy & hold</span>
    </div>
    <div ref="equityContainer" class="h-40 w-full" />
  </div>
</template>
