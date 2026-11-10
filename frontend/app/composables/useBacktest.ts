import type { BacktestResult, StrategyDraft } from '~/types/api'
import type { BacktestMode } from './useApi'

const PREVIEW_DEBOUNCE_MS = 250

/** Runs backtests for the latest strategy only: debounced previews, stale requests aborted. */
export function useBacktest() {
  const api = useApi()
  const result = ref<BacktestResult | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const durationMs = ref<number | null>(null)

  let controller: AbortController | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastRequestKey = ''

  function schedulePreview(strategy: StrategyDraft): void {
    clearTimeout(timer)
    timer = setTimeout(() => run(strategy, 'preview'), PREVIEW_DEBOUNCE_MS)
  }

  async function run(strategy: StrategyDraft, mode: BacktestMode): Promise<void> {
    clearTimeout(timer)
    const requestKey = `${mode}:${JSON.stringify(strategy)}`
    // Blockly fires events for selection and dragging too; identical strategies need no new run.
    if (requestKey === lastRequestKey && result.value && !error.value) return
    lastRequestKey = requestKey

    controller?.abort()
    const ownController = new AbortController()
    controller = ownController
    isLoading.value = true
    const startedAt = performance.now()
    try {
      const response = await api.backtest(strategy, mode, ownController.signal)
      if (response.status === 'ok') {
        result.value = response.result
        error.value = null
        durationMs.value = Math.round(performance.now() - startedAt)
      }
    }
    catch (caught) {
      if (ownController.signal.aborted) return
      error.value = describeApiError(caught)
      lastRequestKey = ''
    }
    finally {
      if (controller === ownController) isLoading.value = false
    }
  }

  function cancel(): void {
    clearTimeout(timer)
    controller?.abort()
    isLoading.value = false
  }

  return { result, isLoading, error, durationMs, schedulePreview, run, cancel }
}
