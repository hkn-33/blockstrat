<script setup lang="ts">
import {
  CandlestickSeries,
  ColorType,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type UTCTimestamp,
} from 'lightweight-charts'

// A TradingView-style close-up: the signal fires on one candle's close, the order fills at the next open.
// The candles are an illustration, not market data.
const CANDLES: [number, number, number, number][] = [
  [100, 104, 98, 103], [103, 106, 101, 102], [102, 103, 97, 98], [98, 100, 95, 96], [96, 99, 94, 98],
  [98, 101, 96, 97], [97, 98, 92, 93], [93, 95, 90, 94], [94, 99, 93, 98], [98, 103, 97, 102],
  [102.6, 107, 101, 106], [106, 109, 104, 108], [108, 112, 107, 111], [111, 113, 108, 109], [109, 115, 108, 114],
]
const SIGNAL_INDEX = 9
const DAY = 86_400
const START = 1_735_689_600

const container = ref<HTMLDivElement | null>(null)
let chart: IChartApi | undefined

onMounted(() => {
  chart = createChart(container.value!, {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: '#6a7b85',
      fontFamily: 'Satoshi, ui-sans-serif, system-ui, sans-serif',
      fontSize: 11,
      attributionLogo: false,
    },
    grid: { vertLines: { color: 'rgba(13,27,36,0.05)' }, horzLines: { color: 'rgba(13,27,36,0.05)' } },
    rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.18, bottom: 0.18 } },
    timeScale: { borderVisible: false, visible: false },
    handleScroll: false,
    handleScale: false,
  })
  const series = chart.addSeries(CandlestickSeries, {
    upColor: '#16a37a',
    downColor: '#ec5b4d',
    borderVisible: false,
    wickUpColor: '#16a37a',
    wickDownColor: '#ec5b4d',
    priceLineVisible: false,
    lastValueVisible: false,
    autoscaleInfoProvider: () => ({ priceRange: { minValue: 89, maxValue: 116 } }),
  })
  const time = (index: number) => (START + index * DAY) as UTCTimestamp
  series.setData(CANDLES.map(([open, high, low, close], index) => ({ time: time(index), open, high, low, close })))
  createSeriesMarkers(series, [
    { time: time(SIGNAL_INDEX), position: 'aboveBar', color: '#0d1b24', shape: 'circle', text: 'Signal on close' },
    { time: time(SIGNAL_INDEX + 1), position: 'belowBar', color: '#2f6bff', shape: 'arrowUp', text: 'Bought at open' },
  ])
  series.createPriceLine({
    price: CANDLES[SIGNAL_INDEX + 1]![0],
    color: '#2f6bff',
    lineWidth: 1,
    lineStyle: LineStyle.Dashed,
    axisLabelVisible: true,
    title: 'Fill',
  })
  chart.timeScale().fitContent()
})

onBeforeUnmount(() => chart?.remove())
</script>

<template>
  <div ref="container" class="h-full w-full" role="img" aria-label="Illustration: a buy signal on one candle's close, filled at the next candle's open price" />
</template>
