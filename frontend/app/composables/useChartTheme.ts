import { ColorType, type ChartOptions, type DeepPartial } from 'lightweight-charts'

// One look for every chart on the landing page, in a light and a dark version (TradingView's own split).
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
    text: 'rgba(214,226,230,0.7)',
    grid: 'rgba(255,255,255,0.05)',
    up: '#2fc59f',
    down: '#ff5a63',
    upFill: 'rgba(47,197,159,',
    downFill: 'rgba(255,90,99,',
    holding: 'rgba(214,226,230,0.5)',
    separator: 'rgba(255,255,255,0.08)',
    accent: '#c8f25a',
  },
  light: {
    text: '#56676f',
    grid: 'rgba(13,27,36,0.06)',
    up: '#0e9963',
    down: '#e5483e',
    upFill: 'rgba(14,153,99,',
    downFill: 'rgba(229,72,62,',
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
    localization: { locale: 'en-US' },
    handleScroll: false,
    handleScale: false,
  }
}
