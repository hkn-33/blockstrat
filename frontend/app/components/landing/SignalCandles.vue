<script setup lang="ts">
import {
  CandlestickSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'

// A close-up in the hero chart's own style: a slide, the buy signal on one candle's close, and the order
// filled at the next candle's open. The candles are an illustration, not market data, and the strip says so.
interface Candle {
  open: number
  high: number
  low: number
  close: number
}

const CANDLE_COUNT = 42
const SIGNAL_INDEX = 26
const DAY = 86_400
const START = 1_735_689_600

// A slow slide, then a turn: a smooth path with a little wobble, every candle opening at the last close.
function illustrativeCandles(): Candle[] {
  const candles: Candle[] = []
  let close = 108
  for (let index = 0; index < CANDLE_COUNT; index++) {
    const drift = index <= SIGNAL_INDEX ? -0.42 : 0.62
    const wobble = Math.sin(index * 1.9) * 1.3 + Math.cos(index * 0.7) * 0.6
    const open = close
    close = index === SIGNAL_INDEX ? open + 1.6 : open + drift + wobble
    const high = Math.max(open, close) + 0.4 + Math.abs(Math.sin(index * 2.3)) * 1.1
    const low = Math.min(open, close) - 0.4 - Math.abs(Math.cos(index * 1.3)) * 1.1
    candles.push({ open, high, low, close })
  }
  return candles
}

const CANDLES = illustrativeCandles()
const FILL_PRICE = CANDLES[SIGNAL_INDEX + 1]!.open

const container = ref<HTMLDivElement | null>(null)
const resolvedTheme = useResolvedChartTheme(() => 'auto')
let chart: IChartApi | undefined
let series: ISeriesApi<'Candlestick'> | undefined
let markers: ISeriesMarkersPluginApi<Time> | undefined
let fillLine: IPriceLine | undefined

const time = (index: number) => (START + index * DAY) as UTCTimestamp

function applyTheme(): void {
  if (!chart || !series || !markers) return
  const colours = chartPalette(resolvedTheme.value)
  chart.applyOptions({
    layout: { textColor: colours.text },
    grid: { vertLines: { color: colours.grid }, horzLines: { color: colours.grid } },
  })
  series.applyOptions({ upColor: colours.up, downColor: colours.down, wickUpColor: colours.up, wickDownColor: colours.down })
  markers.setMarkers([
    { time: time(SIGNAL_INDEX), position: 'aboveBar', color: colours.text, shape: 'circle', text: 'Signal on close' },
    { time: time(SIGNAL_INDEX + 1), position: 'belowBar', color: colours.up, shape: 'arrowUp', text: 'Bought at the next open' },
  ])
  if (fillLine) series.removePriceLine(fillLine)
  fillLine = series.createPriceLine({
    price: FILL_PRICE,
    color: colours.up,
    lineWidth: 1,
    lineStyle: LineStyle.Dashed,
    axisLabelVisible: true,
    title: 'Fill',
  })
}

onMounted(() => {
  const base = baseChartOptions()
  chart = createChart(container.value!, {
    ...base,
    rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.18, bottom: 0.14 } },
    timeScale: { borderVisible: false, visible: false, rightOffset: 2 },
    localization: { ...base.localization, priceFormatter: (value: number) => value.toFixed(2) },
  })
  series = chart.addSeries(CandlestickSeries, { borderVisible: false, priceLineVisible: false, lastValueVisible: true })
  series.setData(CANDLES.map((candle, index) => ({ time: time(index), ...candle })))
  markers = createSeriesMarkers(series, [])
  applyTheme()
  chart.timeScale().fitContent()
})

watch(resolvedTheme, applyTheme)

onBeforeUnmount(() => chart?.remove())
</script>

<template>
  <div>
    <ChartBar name="Example candles" detail="how a fill works, not market data">
      <span>Fill <b>{{ FILL_PRICE.toFixed(2) }}</b></span>
    </ChartBar>
    <div ref="container" class="mx-3 h-[240px]" role="img" aria-label="Illustration: a buy signal on one candle's close, filled at the next candle's open price" />
  </div>
</template>
