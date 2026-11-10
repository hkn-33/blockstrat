<script setup lang="ts">
import type { BacktestResult } from '~/types/api'
import type { RequiredPart } from '~/utils/strategyBlocks'
import { REQUIRED_PARTS } from '~/utils/strategyBlocks'

const props = defineProps<{
  missing: RequiredPart[]
  result: BacktestResult | null
  isLoading: boolean
  error: string | null
  durationMs: number | null
}>()
const emit = defineEmits<{ fullBacktest: [] }>()

const PART_LABELS: Record<RequiredPart, string> = {
  instrument: 'Instrument',
  timeframe: 'Timeframe',
  entry: 'Entry rule',
  exit: 'Exit',
}

const isComplete = computed(() => props.missing.length === 0)

const metrics = computed(() => {
  const value = props.result?.metrics
  if (!value) return []
  return [
    { label: 'Return', text: percent(value.total_return_pct), tone: tone(value.total_return_pct) },
    { label: 'Buy & hold', text: percent(value.buy_and_hold_return_pct), tone: 'neutral' },
    { label: 'Max drawdown', text: percent(-Math.abs(value.max_drawdown_pct)), tone: 'neutral' },
    { label: 'Sharpe', text: value.sharpe_ratio === null ? '–' : value.sharpe_ratio.toFixed(2), tone: 'neutral' },
    { label: 'Win rate', text: value.win_rate_pct === null ? '–' : `${value.win_rate_pct.toFixed(0)}%`, tone: 'neutral' },
    { label: 'Trades', text: String(value.trade_count), tone: 'neutral' },
    { label: 'Time in market', text: `${value.exposure_time_pct.toFixed(0)}%`, tone: 'neutral' },
  ]
})

const beatsBuyAndHold = computed(() => {
  const value = props.result?.metrics
  return value ? value.total_return_pct > value.buy_and_hold_return_pct : false
})

function percent(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function tone(value: number): string {
  return value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'
}

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 16).replace('T', ' ')
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <ol class="grid grid-cols-4 gap-2" aria-label="Required parts">
      <li
        v-for="part in REQUIRED_PARTS"
        :key="part"
        class="rounded-lg border px-2 py-1.5 text-center text-xs font-semibold transition-colors"
        :class="missing.includes(part) ? 'border-slate-200 bg-white text-slate-400' : 'border-emerald-200 bg-emerald-50 text-emerald-700'"
      >
        {{ missing.includes(part) ? '○' : '✓' }} {{ PART_LABELS[part] }}
      </li>
    </ol>

    <div v-if="!isComplete" class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
      <p class="font-semibold text-slate-700">
        Missing: {{ missing.map(part => PART_LABELS[part]).join(', ') }}
      </p>
      <p class="mt-1 text-sm text-slate-500">
        Drag blocks into the Strategy block. The backtest appears as soon as all four are filled.
      </p>
    </div>

    <p v-else-if="error" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
      {{ error }}
    </p>

    <div v-else-if="!result" class="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
      Running the first backtest… The first run on an instrument downloads its price history and can take a few seconds.
    </div>

    <template v-if="isComplete && result">
      <div class="flex flex-col gap-4 transition-opacity duration-150" :class="isLoading ? 'opacity-50' : 'opacity-100'">
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            {{ result.mode === 'preview' ? 'Preview' : 'Full backtest' }} ·
            {{ result.bar_count.toLocaleString() }} bars ·
            {{ formatDate(result.start_time).slice(0, 10) }} → {{ formatDate(result.end_time).slice(0, 10) }}
            <template v-if="durationMs !== null"> · {{ durationMs }} ms</template>
          </span>
          <button
            type="button"
            class="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            :disabled="isLoading"
            @click="emit('fullBacktest')"
          >
            Full backtest
          </button>
        </div>

        <dl class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div
            v-for="metric in metrics"
            :key="metric.label"
            class="rounded-xl border border-slate-200 bg-white px-3 py-2"
          >
            <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {{ metric.label }}
            </dt>
            <dd
              class="text-lg font-bold tabular-nums"
              :class="{ 'text-emerald-600': metric.tone === 'positive', 'text-red-600': metric.tone === 'negative', 'text-slate-900': metric.tone === 'neutral' }"
            >
              {{ metric.text }}
            </dd>
          </div>
          <div
            class="rounded-xl px-3 py-2 text-xs font-semibold"
            :class="beatsBuyAndHold ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'"
          >
            {{ beatsBuyAndHold ? 'Beats buy & hold on this period.' : 'Does not beat simply holding.' }}
          </div>
        </dl>

        <p v-if="result.trades.length === 0" class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          The strategy made no trades in this period. Its entry condition was never true. Try looser values or a longer history.
        </p>

        <div class="rounded-xl border border-slate-200 bg-white p-2">
          <ResultsCharts :result="result" />
        </div>

        <details v-if="result.trades.length" class="rounded-xl border border-slate-200 bg-white">
          <summary class="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-700">
            Trades ({{ result.trades.length }})
          </summary>
          <div class="max-h-64 overflow-auto">
            <table class="w-full text-left text-xs tabular-nums">
              <thead class="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  <th class="px-3 py-1.5 font-medium">Direction</th>
                  <th class="px-3 py-1.5 font-medium">Entry</th>
                  <th class="px-3 py-1.5 font-medium">Exit</th>
                  <th class="px-3 py-1.5 text-right font-medium">Size</th>
                  <th class="px-3 py-1.5 text-right font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(trade, index) in result.trades" :key="index" class="border-t border-slate-100">
                  <td class="px-3 py-1.5 font-semibold" :class="trade.direction === 'long' ? 'text-emerald-700' : 'text-red-700'">
                    {{ trade.direction }}
                  </td>
                  <td class="px-3 py-1.5">{{ formatDate(trade.entry_time) }}<br><span class="text-slate-500">{{ trade.entry_price.toPrecision(6) }}</span></td>
                  <td class="px-3 py-1.5">{{ formatDate(trade.exit_time) }}<br><span class="text-slate-500">{{ trade.exit_price.toPrecision(6) }}</span></td>
                  <td class="px-3 py-1.5 text-right">{{ trade.size.toPrecision(4) }}</td>
                  <td class="px-3 py-1.5 text-right font-semibold" :class="trade.return_pct >= 0 ? 'text-emerald-600' : 'text-red-600'">
                    {{ percent(trade.return_pct) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </template>
  </section>
</template>
