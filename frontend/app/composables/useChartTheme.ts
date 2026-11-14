import { ColorType, LineStyle, type ChartOptions, type DeepPartial } from 'lightweight-charts'

// One look for every chart, in a light and a dark version, in TradingView's own colours: the candles,
// grid and crosshair a trader already knows.
export type ChartTheme = 'light' | 'dark'

export interface ChartPalette {
  text: string
  grid: string
  up: string
  down: string
  upFill: string
  downFill: string
  holding: string
  separator: string
  accent: string
}

const PALETTES: Record<ChartTheme, ChartPalette> = {
  dark: {
    text: '#b2b5be',
    grid: 'rgba(255,255,255,0.045)',
    up: '#26a69a',
    down: '#ef5350',
    upFill: 'rgba(38,166,154,',
    downFill: 'rgba(239,83,80,',
    holding: 'rgba(214,226,230,0.5)',
    separator: 'rgba(255,255,255,0.08)',
    accent: '#c8f25a',
  },
  light: {
    text: '#56676f',
    grid: 'rgba(13,27,36,0.06)',
    up: '#089981',
    down: '#f23645',
    upFill: 'rgba(8,153,129,',
    downFill: 'rgba(242,54,69,',
    holding: '#8d9ca4',
    separator: 'rgba(13,27,36,0.1)',
    accent: '#0e3f47',
  },
}

export function chartPalette(theme: ChartTheme): ChartPalette {
  return PALETTES[theme]
}

/** A chart's theme: fixed, or following the page's light or dark mode when set to 'auto'. */
export function useResolvedChartTheme(theme: () => ChartTheme | 'auto'): ComputedRef<ChartTheme> {
  const colorMode = useColorMode()
  return computed(() => {
    const wanted = theme()
    if (wanted !== 'auto') return wanted
    return colorMode.value === 'light' ? 'light' : 'dark'
  })
}

/** The options every landing chart shares: the page's font, no frame, English dates, no pan or zoom. */
export function baseChartOptions(): DeepPartial<ChartOptions> {
  return {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      fontFamily: 'Satoshi, ui-sans-serif, system-ui, sans-serif',
      fontSize: 11,
      attributionLogo: false,
    },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false },
    crosshair: {
      vertLine: { color: 'rgba(117,134,150,0.7)', style: LineStyle.LargeDashed, labelBackgroundColor: '#2a2e39' },
      horzLine: { color: 'rgba(117,134,150,0.7)', style: LineStyle.LargeDashed, labelBackgroundColor: '#2a2e39' },
    },
    localization: { locale: 'en-US' },
    handleScroll: false,
    handleScale: false,
  }
}
