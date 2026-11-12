import type { BacktestResult, StrategyDraft } from '~/types/api'
import type { BacktestMode } from './useApi'

const PREVIEW_DEBOUNCE_MS = 250
// A backtest often returns in under 100 ms. Showing "Calculating" for a moment makes it clear the
// result is new, instead of numbers silently swapping.
const MINIMUM_CALCULATING_MS = 450

/** One market's backtest: its latest result stays while a newer one is on its way. */
export interface MarketRun {
  result: BacktestResult | null
  isLoading: boolean
  error: string | null
}

/** Each chosen market's backtest, by instrument symbol. */
export type MarketRuns = Record<string, MarketRun>

const NOT_RUN: MarketRun = { result: null, isLoading: false, error: null }

/** The instruments a strategy is tested on, main one first. */
function instrumentsOf(strategy: StrategyDraft): string[] {
  return [strategy.instrument, ...(strategy.extra_instruments ?? [])].filter((symbol): symbol is string => symbol !== null)
}

// The API runs one instrument per request, so each market gets the same strategy with only its own symbol.
function strategyFor(strategy: StrategyDraft, symbol: string): StrategyDraft {
  return { ...strategy, instrument: symbol, extra_instruments: [] }
}

/** Runs the latest strategy on every chosen market, one request each: debounced previews, stale requests aborted. */
export function useBacktest() {
  const api = useApi()
  const runs = ref<MarketRuns>({})
  const isLoading = computed(() => Object.values(runs.value).some(run => run.isLoading))

  let timer: ReturnType<typeof setTimeout> | undefined
  const inFlight = new Map<string, { key: string, controller: AbortController }>()
  // The request each market's shown result answers, so an identical request is not sent again.
  const resultKeys = new Map<string, string>()

  function patch(symbol: string, change: Partial<MarketRun>): void {
    runs.value = { ...runs.value, [symbol]: { ...(runs.value[symbol] ?? NOT_RUN), ...change } }
  }

  function dropMarketsOtherThan(symbols: string[]): void {
    for (const [symbol, request] of inFlight) {
      if (symbols.includes(symbol)) continue
      request.controller.abort()
      inFlight.delete(symbol)
    }
    for (const symbol of resultKeys.keys()) {
      if (!symbols.includes(symbol)) resultKeys.delete(symbol)
    }
    runs.value = Object.fromEntries(Object.entries(runs.value).filter(([symbol]) => symbols.includes(symbol)))
  }

  function isCurrent(symbol: string, key: string): boolean {
    if (inFlight.get(symbol)?.key === key) return true
    return resultKeys.get(symbol) === key && runs.value[symbol]?.error === null
  }

  async function runMarket(strategy: StrategyDraft, mode: BacktestMode, key: string): Promise<void> {
    const symbol = strategy.instrument!
    inFlight.get(symbol)?.controller.abort()
    const controller = new AbortController()
    inFlight.set(symbol, { key, controller })
    patch(symbol, { isLoading: true })
    const startedAt = performance.now()
    try {
      const response = await api.backtest(strategy, mode, controller.signal)
      const serverMs = performance.now() - startedAt
      if (serverMs < MINIMUM_CALCULATING_MS) {
        await new Promise(resolve => setTimeout(resolve, MINIMUM_CALCULATING_MS - serverMs))
      }
      if (controller.signal.aborted) return
      if (response.status === 'ok') {
        resultKeys.set(symbol, key)
        patch(symbol, { result: response.result, error: null })
      }
    }
    catch (caught) {
      if (controller.signal.aborted) return
      patch(symbol, { error: describeApiError(caught) })
    }
    finally {
      if (inFlight.get(symbol)?.controller === controller) {
        inFlight.delete(symbol)
        patch(symbol, { isLoading: false })
      }
    }
  }

  function schedulePreview(strategy: StrategyDraft): void {
    clearTimeout(timer)
    timer = setTimeout(() => run(strategy, 'preview'), PREVIEW_DEBOUNCE_MS)
  }

  async function run(strategy: StrategyDraft, mode: BacktestMode): Promise<void> {
    clearTimeout(timer)
    const symbols = instrumentsOf(strategy)
    dropMarketsOtherThan(symbols)
    const requests = symbols.map((symbol) => {
      const marketStrategy = strategyFor(strategy, symbol)
      const key = `${mode}:${JSON.stringify(marketStrategy)}`
      // Editing fires for every keystroke and drag; a market whose request has not changed needs no new run.
      return isCurrent(symbol, key) ? undefined : runMarket(marketStrategy, mode, key)
    })
    await Promise.all(requests)
  }

  function cancel(): void {
    clearTimeout(timer)
    for (const [symbol, request] of inFlight) {
      request.controller.abort()
      patch(symbol, { isLoading: false })
    }
    inFlight.clear()
  }

  return { runs, isLoading, schedulePreview, run, cancel }
}
