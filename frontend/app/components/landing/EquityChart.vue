<script setup lang="ts">
import {
  AreaSeries,
  BaselineSeries,
  ColorType,
  LineSeries,
  LineStyle,
  LineType,
  PriceScaleMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { DemoRun } from '~/composables/useLandingDemo'

// A TradingView-style chart of a demo run: the balance against holding, or how far it sat below its high.
// It draws from left to right the first time it comes into view, and again whenever the run changes.
const props = withDefaults(defineProps<{
  run: DemoRun
  variant?: 'equity' | 'drawdown'
  theme?: 'light' | 'dark'
  accent?: string
  delayMs?: number
}>(), { variant: 'equity', theme: 'light', accent: '#2f6bff', delayMs: 0 })

const DRAW_MS = 1300
const container = ref<HTMLDivElement | null>(null)

interface Point {
  time: UTCTimestamp
  value: number
}

let chart: IChartApi | undefined
let mainSeries: ISeriesApi<SeriesType> | undefined
let holdingSeries: ISeriesApi<'Line'> | undefined
let frame = 0
let delayTimer: ReturnType<typeof setTimeout> | undefined
let observer: IntersectionObserver | undefined
let hasBeenSeen = false

function timesFor(run: DemoRun): UTCTimestamp[] {
  const count = run.equity.length
  const step = (run.end_time - run.start_time) / (count - 1)
  return run.equity.map((_, index) => Math.round(run.start_time + index * step) as UTCTimestamp)
}

function seriesData(run: DemoRun): { main: Point[], holding: Point[] } {
  const times = timesFor(run)
  if (props.variant === 'drawdown') {
    let peak = 0
    const main = run.equity.map((value, index) => {
      peak = Math.max(peak, value)
      return { time: times[index]!, value: (value / peak - 1) * 100 }
    })
    return { main, holding: [] }
  }
  return {
    main: run.equity.map((value, index) => ({ time: times[index]!, value })),
    holding: run.buy_and_hold.map((value, index) => ({ time: times[index]!, value })),
  }
}

function compactDollars(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`
  return `$${Math.round(value)}`
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function draw(): void {
  if (!chart || !mainSeries) return
  cancelAnimationFrame(frame)
  const { main, holding } = seriesData(props.run)
  const all = [...main, ...holding].map(point => point.value)
  const range = { minValue: Math.min(...all), maxValue: Math.max(...all) }
  // Fixed price range while drawing, so the axis does not jump as points arrive.
  mainSeries.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: range }) })
  holdingSeries?.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: range }) })

  const showUpTo = (count: number) => {
    mainSeries!.setData(main.slice(0, count))
    holdingSeries?.setData(holding.slice(0, count))
    chart!.timeScale().setVisibleLogicalRange({ from: 0, to: main.length - 1 })
  }

  if (prefersReducedMotion()) {
    showUpTo(main.length)
    return
  }
  const startedAt = performance.now()
  const step = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / DRAW_MS)
    const eased = 1 - (1 - progress) ** 2
    showUpTo(Math.max(2, Math.ceil(eased * main.length)))
    if (progress < 1) frame = requestAnimationFrame(step)
  }
  frame = requestAnimationFrame(step)
}

onMounted(() => {
  const isDark = props.theme === 'dark'
  chart = createChart(container.value!, {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: isDark ? 'rgba(255,255,255,0.55)' : '#6a7b85',
      fontFamily: 'Satoshi, ui-sans-serif, system-ui, sans-serif',
      fontSize: 11,
      attributionLogo: false,
    },
    grid: {
      vertLines: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(13,27,36,0.05)' },
      horzLines: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(13,27,36,0.05)' },
    },
    rightPriceScale: {
      borderVisible: false,
      mode: props.variant === 'equity' ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    },
    timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
    localization: {
      priceFormatter: props.variant === 'equity' ? compactDollars : (value: number) => `${Math.round(value)}%`,
    },
    handleScroll: false,
    handleScale: false,
  })

  if (props.variant === 'drawdown') {
    mainSeries = chart.addSeries(BaselineSeries, {
      baseValue: { type: 'price', price: 0 },
      topLineColor: 'rgba(0,0,0,0)',
      bottomLineColor: '#ec5b4d',
      bottomFillColor1: 'rgba(236,91,77,0.08)',
      bottomFillColor2: 'rgba(236,91,77,0.45)',
      lineWidth: 2,
      lineType: LineType.Curved,
      priceLineVisible: false,
      lastValueVisible: false,
    })
  }
  else {
    holdingSeries = chart.addSeries(LineSeries, {
      color: isDark ? 'rgba(255,255,255,0.45)' : '#a3b1b9',
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    mainSeries = chart.addSeries(AreaSeries, {
      lineColor: props.accent,
      topColor: `${props.accent}55`,
      bottomColor: `${props.accent}00`,
      lineWidth: 2,
      priceLineVisible: false,
    })
  }

  observer = new IntersectionObserver((entries) => {
    if (hasBeenSeen || !entries.some(entry => entry.isIntersecting)) return
    hasBeenSeen = true
    delayTimer = setTimeout(draw, props.delayMs)
  }, { threshold: 0.3 })
  observer.observe(container.value!)
})

watch(() => props.run, () => {
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
  <div ref="container" class="equity-chart" />
</template>

<style scoped>
.equity-chart {
  width: 100%;
  height: 100%;
}
</style>
