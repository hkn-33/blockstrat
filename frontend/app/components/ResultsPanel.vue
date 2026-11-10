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
  instrument: 'Market',
  timeframe: 'How often',
  entry: 'When to get in',
  exit: 'When to get out',
}

const metrics = computed(() => props.result?.metrics ?? null)
const beatsBuyAndHold = computed(() =>
  metrics.value ? metrics.value.total_return_pct > metrics.value.buy_and_hold_return_pct : false,
)

function percent(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

function wholeNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}

function wholePercent(value: number): string {
  return `${Math.round(value)}%`
}

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

function formatDateTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 16).replace('T', ' ')
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <div v-if="missing.length" class="rounded-2xl border border-dashed border-slate-300 bg-white p-5">
      <p class="font-semibold text-slate-800">
        Fill in the Strategy block to see a result
      </p>
      <ul class="mt-3 grid grid-cols-2 gap-2 text-sm">
        <li
          v-for="part in REQUIRED_PARTS"
          :key="part"
          class="rounded-lg px-3 py-2 font-medium"
          :class="missing.includes(part) ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'"
        >
          {{ missing.includes(part) ? '○' : '✓' }} {{ PART_LABELS[part] }}
        </li>
      </ul>
      <p class="mt-3 text-sm text-slate-500">
        Drag a block from the list on the left into each empty slot.
      </p>
    </div>

    <template v-else>
      <div class="relative h-1 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div v-if="isLoading" class="calculating-bar absolute inset-y-0 w-1/3 rounded-full bg-indicator" />
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p v-if="isLoading" class="font-semibold text-indicator" role="status">
          Calculating…
        </p>
        <p v-else-if="result" class="text-slate-500">
          {{ result.mode === 'preview' ? 'Recent history' : 'Full history' }}:
          {{ formatDate(result.start_time) }} to {{ formatDate(result.end_time) }}
        </p>
        <p v-else class="text-slate-500">
          Getting price history…
        </p>
        <button
          v-if="result?.mode === 'preview'"
          type="button"
          class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          :disabled="isLoading"
          @click="emit('fullBacktest')"
        >
          Test full history
        </button>
      </div>

      <p v-if="error" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
        {{ error }}
      </p>

      <template v-if="result && metrics">
        <div class="rounded-[20px] bg-white p-5 ring-1 ring-[#dde6e9]">
          <p class="text-sm text-slate-500">
            Your strategy
          </p>
          <p class="font-display text-4xl font-extrabold" :class="metrics.total_return_pct >= 0 ? 'text-gain' : 'text-loss'">
            <AnimatedNumber :value="metrics.total_return_pct" :format="percent" />
          </p>
          <p class="mt-1 text-sm text-slate-600">
            Simply holding: <AnimatedNumber :value="metrics.buy_and_hold_return_pct" :format="percent" class="font-semibold" />
          </p>
          <p class="mt-3 flex items-center gap-1.5 text-sm font-bold" :class="beatsBuyAndHold ? 'text-gain' : 'text-loss'">
            <UiIcon :name="beatsBuyAndHold ? 'circle-check' : 'x'" />
            {{ beatsBuyAndHold ? 'Did better than holding' : 'Did worse than holding' }}
          </p>

          <dl class="mt-5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
            <div>
              <dt class="text-xs text-slate-500">
                Worst drop
              </dt>
              <dd class="text-lg font-bold text-slate-900">
                <AnimatedNumber :value="-Math.abs(metrics.max_drawdown_pct)" :format="percent" />
              </dd>
            </div>
            <div>
              <dt class="text-xs text-slate-500">
                Trades
              </dt>
              <dd class="text-lg font-bold text-slate-900">
                <AnimatedNumber :value="metrics.trade_count" :format="wholeNumber" />
              </dd>
            </div>
            <div>
              <dt class="text-xs text-slate-500">
                Winning trades
              </dt>
              <dd class="text-lg font-bold text-slate-900">
                <AnimatedNumber :value="metrics.win_rate_pct ?? 0" :format="wholePercent" />
              </dd>
            </div>
          </dl>
        </div>

        <p v-if="result.trades.length === 0" class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          No trades in this period: the entry condition was never true. Try a looser value or test the full history.
        </p>

        <div class="rounded-2xl bg-white p-2 ring-1 ring-slate-200">
          <ResultsCharts :result="result" />
        </div>

        <details class="rounded-2xl bg-white ring-1 ring-slate-200">
          <summary class="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">
            More details
          </summary>
          <div class="border-t border-slate-100 px-4 py-3 text-sm">
            <dl class="grid grid-cols-2 gap-2 text-slate-600">
              <dt>Sharpe ratio</dt>
              <dd class="text-right font-semibold text-slate-900">
                {{ metrics.sharpe_ratio === null ? 'n/a' : metrics.sharpe_ratio.toFixed(2) }}
              </dd>
              <dt>Time in the market</dt>
              <dd class="text-right font-semibold text-slate-900">
                {{ wholePercent(metrics.exposure_time_pct) }}
              </dd>
              <dt>Bars tested</dt>
              <dd class="text-right font-semibold text-slate-900">
                {{ result.bar_count.toLocaleString('en-US') }}
              </dd>
              <dt v-if="durationMs !== null">
                Calculated in
              </dt>
              <dd v-if="durationMs !== null" class="text-right font-semibold text-slate-900">
                {{ durationMs }} ms
              </dd>
            </dl>
          </div>
          <div v-if="result.trades.length" class="max-h-64 overflow-auto border-t border-slate-100">
            <table class="w-full text-left text-xs tabular-nums">
              <thead class="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  <th class="px-3 py-1.5 font-medium">
                    Trade
                  </th>
                  <th class="px-3 py-1.5 font-medium">
                    In
                  </th>
                  <th class="px-3 py-1.5 font-medium">
                    Out
                  </th>
                  <th class="px-3 py-1.5 text-right font-medium">
                    Result
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(trade, index) in result.trades" :key="index" class="border-t border-slate-100">
                  <td class="px-3 py-1.5 font-semibold" :class="trade.direction === 'long' ? 'text-emerald-700' : 'text-red-700'">
                    {{ trade.direction }}
                  </td>
                  <td class="px-3 py-1.5">
                    {{ formatDateTime(trade.entry_time) }}
                  </td>
                  <td class="px-3 py-1.5">
                    {{ formatDateTime(trade.exit_time) }}
                  </td>
                  <td class="px-3 py-1.5 text-right font-semibold" :class="trade.return_pct >= 0 ? 'text-emerald-600' : 'text-red-600'">
                    {{ percent(trade.return_pct) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      </template>
    </template>
  </section>
</template>

<style scoped>
.calculating-bar {
  animation: slide 900ms ease-in-out infinite;
}

@keyframes slide {
  from {
    left: -33%;
  }

  to {
    left: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .calculating-bar {
    left: 0;
    width: 100%;
    animation: none;
  }
}
</style>
