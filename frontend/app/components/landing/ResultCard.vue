<script setup lang="ts">
import type { DemoRun } from '~/composables/useLandingDemo'

const props = withDefaults(defineProps<{
  run: DemoRun
  holdingLabel: string
  // Set for an entrance: the number counts up and the chart draws after this delay.
  entranceDelayMs?: number
  chartHeight?: number
}>(), { entranceDelayMs: undefined, chartHeight: 170 })

const metrics = computed(() => props.run.metrics)
const beatHolding = computed(() => metrics.value.total_return_pct > metrics.value.buy_and_hold_return_pct)

function signedPercent(value: number): string {
  const rounded = Math.round(value)
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : ''
  return `${sign}${Math.abs(rounded).toLocaleString('en-US')}%`
}

function dollars(returnPct: number): string {
  return `$${Math.round(DEMO_STARTING_CASH * (1 + returnPct / 100)).toLocaleString('en-US')}`
}
</script>

<template>
  <div class="result-card">
    <div class="flex items-end justify-between gap-4">
      <div>
        <p class="text-[13px] text-[var(--muted)]">
          $10,000 since Aug 2017
        </p>
        <p class="mt-1 text-[40px] font-bold leading-none tracking-[-0.03em]" :class="beatHolding ? 'text-[var(--gain)]' : 'text-[var(--loss)]'">
          <AnimatedNumber :value="metrics.total_return_pct" :format="signedPercent" :count-up-delay-ms="entranceDelayMs" :duration-ms="1100" />
        </p>
      </div>
      <p class="verdict" :class="beatHolding ? 'text-[var(--gain)]' : 'text-[var(--loss)]'">
        <UiIcon :name="beatHolding ? 'circle-check' : 'x'" />
        {{ beatHolding ? 'Beat holding' : 'Lost to holding' }}
      </p>
    </div>

    <div class="mt-3" :style="{ height: `${chartHeight}px` }">
      <ClientOnly>
        <LandingEquityChart :run="run" :delay-ms="entranceDelayMs ?? 0" />
      </ClientOnly>
    </div>

    <dl class="mt-3 grid grid-cols-3 gap-3 border-t border-[var(--line)] pt-3 text-[13px]">
      <div>
        <dt class="text-[var(--muted)]">
          {{ holdingLabel }}
        </dt>
        <dd class="mt-0.5 font-bold tabular-nums text-[var(--ink)]">
          {{ signedPercent(metrics.buy_and_hold_return_pct) }}
        </dd>
      </div>
      <div>
        <dt class="text-[var(--muted)]">
          Ends at
        </dt>
        <dd class="mt-0.5 font-bold tabular-nums text-[var(--ink)]">
          {{ dollars(metrics.total_return_pct) }}
        </dd>
      </div>
      <div>
        <dt class="text-[var(--muted)]">
          Trades
        </dt>
        <dd class="mt-0.5 font-bold tabular-nums text-[var(--ink)]">
          {{ metrics.trade_count }}
        </dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.result-card {
  border-radius: 20px;
  background: #ffffff;
  padding: 1.25rem 1.25rem 1rem;
  box-shadow: 0 1px 2px rgb(13 27 36 / 0.05), 0 24px 48px -24px rgb(13 27 36 / 0.4);
}

.verdict {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 14px;
  font-weight: 700;
}
</style>
