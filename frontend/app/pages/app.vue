<script setup lang="ts">
import type BlockEditor from '~/components/BlockEditor.vue'
import { setInstrumentOptions } from '~/blocks/definitions'
import type { ExecutionModel, ExecutionPreset, StrategyDraft } from '~/types/api'
import {
  draftToWorkspace,
  emptyWorkspace,
  REQUIRED_PARTS,
  UnknownBlockError,
  workspaceToDraft,
  type RequiredPart,
  type WorkspaceState,
} from '~/utils/strategyBlocks'
import { InvalidStrategyError, loadCurrentStrategy, saveCurrentStrategy, strategyFromHash } from '~/utils/strategyFiles'

const DEFAULT_EXECUTION: ExecutionModel = { commission_pct: 0.1, slippage_bps: 5 }
const EXAMPLE_STRATEGY: StrategyDraft = {
  schema_version: 1,
  instrument: 'BTCUSDT',
  timeframe: '1d',
  entry: {
    direction: 'long',
    condition: { kind: 'compare', operator: 'crosses_above', left: { kind: 'ema', period: 20 }, right: { kind: 'sma', period: 50 } },
  },
  exit: {
    rule: { kind: 'compare', operator: 'crosses_below', left: { kind: 'ema', period: 20 }, right: { kind: 'sma', period: 50 } },
    stop_loss_pct: 8,
    take_profit_pct: null,
  },
  position_size_pct: 100,
  execution: DEFAULT_EXECUTION,
}

useHead({ title: 'BlockStrat builder' })

const api = useApi()
const backtest = useBacktest()
const editor = ref<InstanceType<typeof BlockEditor> | null>(null)
const workspaceState = ref<WorkspaceState>(emptyWorkspace())
const execution = ref<ExecutionModel>({ ...DEFAULT_EXECUTION })
const presets = ref<ExecutionPreset[]>([])
const activeTab = ref<'results' | 'ai'>('results')
const startupError = ref<string | null>(null)

const converted = computed(() => {
  try {
    return workspaceToDraft(workspaceState.value, execution.value)
  }
  catch (error) {
    if (!(error instanceof UnknownBlockError)) throw error
    return workspaceToDraft(emptyWorkspace(), execution.value)
  }
})
const strategy = computed<StrategyDraft>(() => converted.value.draft)
const missing = computed<RequiredPart[]>(() => converted.value.missing)
const isEmpty = computed(() => missing.value.length === REQUIRED_PARTS.length)

watch(strategy, (current) => {
  saveCurrentStrategy(current)
  if (missing.value.length) backtest.cancel()
  else backtest.schedulePreview(current)
}, { deep: true })

onMounted(async () => {
  const initial = initialStrategy()
  try {
    const [instruments, executionPresets] = await Promise.all([api.instruments(), api.executionPresets()])
    setInstrumentOptions(instruments.instruments)
    presets.value = executionPresets
  }
  catch {
    startupError.value = 'The backtest server is not reachable. Blocks still work; results appear once it is back.'
  }
  openStrategy(initial)
})

function initialStrategy(): StrategyDraft | null {
  try {
    const shared = strategyFromHash(window.location.hash)
    if (shared) {
      // Drop the hash so a reload shows the user's own edits, not the link again.
      history.replaceState(null, '', window.location.pathname)
      return shared
    }
  }
  catch (error) {
    startupError.value = error instanceof InvalidStrategyError ? error.message : 'The share link could not be opened.'
  }
  // First visit: start from a working example so there is a result to look at right away.
  return loadCurrentStrategy() ?? EXAMPLE_STRATEGY
}

function openStrategy(draft: StrategyDraft | null): void {
  execution.value = draft ? { ...draft.execution } : { ...DEFAULT_EXECUTION }
  editor.value?.load(draft ? draftToWorkspace(draft) : emptyWorkspace())
  if (draft) activeTab.value = 'results'
}

function runFullBacktest(): void {
  if (!missing.value.length) backtest.run(strategy.value, 'full')
}
</script>

<template>
  <div class="flex h-dvh flex-col">
    <header class="flex flex-wrap items-center justify-between gap-3 border-b border-[#dde6e9] bg-white px-4 py-2.5">
      <div class="flex items-center gap-3">
        <NuxtLink to="/" class="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indicator">
          <BrandLogo />
        </NuxtLink>
        <h1 class="hidden text-sm text-slate-500 md:block">
          Strategy builder
        </h1>
      </div>
      <StrategyToolbar :strategy="strategy" @open="openStrategy" @reset="openStrategy(null)" />
    </header>

    <p v-if="startupError" class="bg-amber-50 px-4 py-2 text-sm text-amber-800" role="alert">
      {{ startupError }}
    </p>

    <main class="grid min-h-0 flex-1 grid-rows-[65vh_auto] lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:grid-rows-1">
      <div class="relative min-h-0 border-b border-slate-200 lg:border-b-0 lg:border-r">
        <BlockEditor ref="editor" :missing="missing" @change="workspaceState = $event" />
        <button
          v-if="isEmpty"
          type="button"
          class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-petrol"
          @click="openStrategy(EXAMPLE_STRATEGY)"
        >
          Load an example strategy
        </button>
      </div>

      <aside class="flex min-h-0 flex-col gap-3 overflow-y-auto bg-[#f7fafb] p-4">
        <nav class="flex gap-0.5 rounded-xl bg-ink/[0.07] p-[3px] text-sm font-bold" aria-label="Panels">
          <button
            v-for="tab in (['results', 'ai'] as const)"
            :key="tab"
            type="button"
            class="flex-1 rounded-lg px-3 py-1.5 transition-colors"
            :class="activeTab === tab ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-ink'"
            @click="activeTab = tab"
          >
            {{ tab === 'results' ? 'Result' : 'Describe it to AI' }}
          </button>
        </nav>

        <template v-if="activeTab === 'results'">
          <ResultsPanel
            :missing="missing"
            :result="backtest.result.value"
            :is-loading="backtest.isLoading.value"
            :error="backtest.error.value"
            :duration-ms="backtest.durationMs.value"
            @full-backtest="runFullBacktest"
          />
          <details class="rounded-[20px] bg-white ring-1 ring-[#dde6e9]">
            <summary class="cursor-pointer px-4 py-3 text-sm text-slate-600">
              <span class="font-semibold text-slate-700">Trading costs:</span>
              {{ execution.commission_pct }}% fee, {{ execution.slippage_bps }} bps slippage
            </summary>
            <div class="border-t border-slate-100 p-3">
              <ExecutionPanel v-model="execution" :presets="presets" />
            </div>
          </details>
        </template>
        <AiChat v-else class="min-h-[420px] flex-1" :current-strategy="strategy" @apply="openStrategy" />
      </aside>
    </main>

    <footer class="border-t border-slate-200 bg-white px-4 py-1.5 text-[11px] text-slate-500">
      Results are simulations on historical Binance data. They are not investment advice and do not predict future returns.
    </footer>
  </div>
</template>
