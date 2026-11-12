<script setup lang="ts">
import {
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type UTCTimestamp,
} from 'lightweight-charts'
import { indicatorBlock, type IndicatorKind } from '~/utils/blockLibrary'
import type { Series } from '~/utils/indicators'

// A chart of real Solana daily candles with one indicator drawn on it, so a newcomer sees what the line is
// and how it moves. Small, it is a still picture for the library's hover help; `large` makes it a chart to
// study: more history, scales, a crosshair, zoom and pan, and the indicator's period can be changed. The
// chart is made once; another indicator or period only swaps its lines, so hovering down the library stays
// instant. The candles come from the landing demo: no request needed.
const props = withDefaults(defineProps<{ kind: IndicatorKind, large?: boolean, period?: number }>(), { large: false, period: undefined })

const DEFAULT_PERIODS: Partial<Record<IndicatorKind, number>> = { sma: 50, ema: 20, rsi: 14, bollinger: 20, highest: 20, lowest: 10, change: 7, relative_volume: 20, stochastic: 14 }
const visible = props.large ? 260 : 150
// Enough candles before the first visible one for the longest period on offer to have a value.
const warmUp = props.large ? 210 : 60
const candles = demoCandles('SOLUSDT').slice(-(visible + warmUp))
const times = candles.map(([time]) => time as UTCTimestamp)
const highs = candles.map(([, , high]) => high)
const lows = candles.map(([, , , low]) => low)
const closes = candles.map(([, , , , close]) => close)
const volumes = candles.map(([, , , , , volume]) => volume)
const period = computed(() => props.period ?? DEFAULT_PERIODS[props.kind] ?? 14)

const container = ref<HTMLDivElement | null>(null)
const resolvedTheme = useResolvedChartTheme(() => 'auto')
let chart: IChartApi | undefined
let candleSeries: ISeriesApi<'Candlestick'> | undefined
let extras: ISeriesApi<SeriesType>[] = []

function lineData(values: Series) {
  return values.flatMap((value, index) => (value === null ? [] : [{ time: times[index]!, value }]))
}

function drawIndicator(): void {
  if (!chart || !candleSeries) return
  extras.forEach(series => chart!.removeSeries(series))
  extras = []
  const colours = chartPalette(resolvedTheme.value)
  chart.applyOptions({ layout: { textColor: colours.text, panes: { separatorColor: colours.separator } }, grid: { horzLines: { color: colours.grid } } })
  candleSeries.applyOptions({ upColor: colours.up, downColor: colours.down, wickUpColor: colours.up, wickDownColor: colours.down })

  const line = (values: Series, pane: number, color: string, width: 1 | 2 = 2, dashed = false) => {
    const series = chart!.addSeries(LineSeries, {
      color,
      lineWidth: width,
      lineStyle: dashed ? LineStyle.Dashed : LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    }, pane)
    series.setData(lineData(values))
    extras.push(series)
    return series
  }

  const accent = colours.accent
  const guide = (series: ISeriesApi<SeriesType>, price: number, color: string) => {
    series.createPriceLine({ price, color, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '' })
  }
  switch (props.kind) {
    case 'sma':
      line(sma(closes, period.value), 0, accent)
      break
    case 'ema':
      line(ema(closes, period.value), 0, accent)
      line(sma(closes, 50), 0, colours.holding, 1)
      break
    case 'bollinger': {
      const bands = bollinger(closes, period.value, 2)
      line(bands.upper, 0, accent, 1)
      line(bands.middle, 0, colours.holding, 1, true)
      line(bands.lower, 0, accent, 1)
      break
    }
    case 'rsi': {
      const rsiLine = line(rsi(closes, period.value), 1, accent)
      guide(rsiLine, 70, colours.down)
      guide(rsiLine, 30, colours.up)
      break
    }
    case 'highest':
      line(highest(highs, period.value), 0, accent)
      break
    case 'lowest':
      line(lowest(lows, period.value), 0, accent)
      break
    case 'change':
      guide(line(change(closes, period.value), 1, accent), 0, colours.holding)
      break
    case 'relative_volume': {
      const bars = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, 1)
      bars.setData(relativeVolume(volumes, period.value).flatMap((value, index) => (value === null ? [] : [{ time: times[index]!, value, color: value >= 1 ? accent : colours.holding }])))
      extras.push(bars)
      guide(bars, 1, colours.text)
      break
    }
    case 'stochastic': {
      const lines = stochastic(highs, lows, closes, period.value, 3)
      const kLine = line(lines.k, 1, accent)
      line(lines.d, 1, colours.holding, 1)
      guide(kLine, 80, colours.down)
      guide(kLine, 20, colours.up)
      break
    }
    case 'macd': {
      const lines = macd(closes, 12, 26, 9)
      const histogram = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, 1)
      histogram.setData(lines.histogram.flatMap((value, index) => (value === null ? [] : [{ time: times[index]!, value, color: value >= 0 ? `${colours.upFill}0.45)` : `${colours.downFill}0.45)` }])))
      extras.push(histogram)
      line(lines.line, 1, accent)
      line(lines.signal, 1, colours.holding, 1)
      break
    }
  }
  chart.panes()[1]?.setHeight(props.large ? 130 : 56)
}

onMounted(() => {
  const base = baseChartOptions()
  chart = createChart(container.value!, {
    ...base,
    layout: { ...base.layout, fontSize: props.large ? 11 : 10, panes: { enableResize: false } },
    grid: { vertLines: { visible: false } },
    timeScale: { borderVisible: false, visible: props.large },
    rightPriceScale: { borderVisible: false, visible: props.large },
    crosshair: { vertLine: { visible: props.large }, horzLine: { visible: props.large } },
    handleScroll: props.large,
    handleScale: props.large,
  })
  candleSeries = chart.addSeries(CandlestickSeries, { borderVisible: false, priceLineVisible: false, lastValueVisible: false })
  candleSeries.setData(candles.map(([time, open, high, low, close]) => ({ time: time as UTCTimestamp, open, high, low, close })))
  drawIndicator()
  // The demo has fewer candles than the large chart asks for, so the view starts where the candles do.
  chart.timeScale().setVisibleLogicalRange({ from: Math.max(candles.length - visible, 0), to: candles.length - 1 })
})

watch([() => props.kind, period], drawIndicator)
watch(resolvedTheme, drawIndicator)
onBeforeUnmount(() => chart?.remove())
</script>

<template>
  <div ref="container" class="w-full" :class="large ? 'h-[min(26rem,52vh)]' : 'h-[170px]'" role="img" :aria-label="`Solana daily candles with ${indicatorBlock(kind).name} drawn on them`" />
</template>
