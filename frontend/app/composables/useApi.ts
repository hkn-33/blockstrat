import type {
  AiBuildFailed,
  AiBuildOk,
  AiMessage,
  BarsResponse,
  ExecutionPreset,
  InstrumentsResponse,
  MissingResponse,
  ResultResponse,
  StrategyDraft,
  SuggestRequest,
  SuggestResponse,
} from '~/types/api'

export type BacktestMode = 'preview' | 'full'
export type AiBuildResponse = AiBuildOk | AiBuildFailed
export type BacktestResponse = MissingResponse | ResultResponse

export function useApi() {
  const baseURL = useRuntimeConfig().public.apiBase

  return {
    backtest(strategy: StrategyDraft, mode: BacktestMode, signal?: AbortSignal): Promise<BacktestResponse> {
      return $fetch<BacktestResponse>('/api/backtest', { baseURL, method: 'POST', body: { strategy, mode }, signal })
    },
    instruments(): Promise<InstrumentsResponse> {
      return $fetch<InstrumentsResponse>('/api/instruments', { baseURL })
    },
    executionPresets(): Promise<ExecutionPreset[]> {
      return $fetch<ExecutionPreset[]>('/api/execution-presets', { baseURL })
    },
    bars(instrument: string, timeframe: SuggestRequest['timeframe']): Promise<BarsResponse> {
      return $fetch<BarsResponse>('/api/bars', { baseURL, query: { instrument, timeframe } })
    },
    suggestStrategies(instrument: string, timeframe: SuggestRequest['timeframe'], marks: SuggestRequest['marks']): Promise<SuggestResponse> {
      return $fetch<SuggestResponse>('/api/suggest-strategies', { baseURL, method: 'POST', body: { instrument, timeframe, marks } })
    },
    buildStrategy(messages: AiMessage[], currentStrategy: StrategyDraft | null): Promise<AiBuildResponse> {
      return $fetch<AiBuildResponse>('/api/ai/build-strategy', {
        baseURL,
        method: 'POST',
        body: { messages, current_strategy: currentStrategy },
      })
    },
  }
}

/** Readable message from a failed request: the API's validation detail when there is one. */
export function describeApiError(error: unknown): string {
  const detail = (error as { data?: { detail?: unknown } }).data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as { msg?: string, loc?: (string | number)[] }
    return `${first.msg ?? 'Invalid strategy'}${first.loc ? ` (${first.loc.slice(1).join(' → ')})` : ''}`
  }
  return 'The backtest server is not reachable.'
}
