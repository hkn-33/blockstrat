<script setup lang="ts">
import {
  CandlestickSeries,
  ColorType,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type ISeriesMarkersPluginApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'

// A close-up in the same chart style as the hero: the signal fires on one candle's close, the order fills
// at the next open. The candles are an illustration, not market data.
const CANDLES: [number, number, number, number][] = [
  [100, 104, 98, 103], [103, 106, 101, 102], [102, 103, 97, 98], [98, 100, 95, 96], [96, 99, 94, 98],
  [98, 101, 96, 97], [97, 98, 92, 93], [93, 95, 90, 94], [94, 99, 93, 98], [98, 103, 97, 102],
  [102.6, 107, 101, 106], [106, 109, 104, 108], [108, 112, 107, 111], [111, 113, 108, 109], [109, 115, 108, 114],
]
const SIGNAL_INDEX = 9
const DAY = 86_400
const START = 1_735_689_600

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
    { time: time(SIGNAL_INDEX + 1), position: 'belowBar', color: colours.accent, shape: 'arrowUp', text: 'Bought at the next open' },
  ])
  if (fillLine) series.removePriceLine(fillLine)
  fillLine = series.createPriceLine({
    price: CANDLES[SIGNAL_INDEX + 1]![0],
    color: colours.accent,
    lineWidth: 1,
    lineStyle: LineStyle.Dashed,
    axisLabelVisible: true,
    title: 'Fill',
  })
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
    rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.2, bottom: 0.2 } },
    timeScale: { borderVisible: false, visible: false },
    localization: { locale: 'en-US' },
    handleScroll: false,
    handleScale: false,
  })
  series = chart.addSeries(CandlestickSeries, {
    borderVisible: false,
    priceLineVisible: false,
    lastValueVisible: false,
    autoscaleInfoProvider: () => ({ priceRange: { minValue: 89, maxValue: 116 } }),
  })
  series.setData(CANDLES.map(([open, high, low, close], index) => ({ time: time(index), open, high, low, close })))
  markers = createSeriesMarkers(series, [])
  applyTheme()
  chart.timeScale().fitContent()
})

watch(resolvedTheme, applyTheme)

onBeforeUnmount(() => chart?.remove())
</script>

<template>
  <div ref="container" class="h-full w-full" role="img" aria-label="Illustration: a buy signal on one candle's close, filled at the next candle's open price" />
</template>
