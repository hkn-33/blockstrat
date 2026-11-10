<script setup lang="ts">
import type { DemoStrategy } from '~/composables/useLandingDemo'

// The same three strategies on the same three coins over the same 16 months, 5% stop: real backtests
// side by side, so a visitor sees that rules which work on one coin can fail on the next.
const STRATEGIES: { value: DemoStrategy, label: string, detail: string }[] = [
  { value: 'combo', label: 'Trend with filter', detail: 'EMA 20 over SMA 50, RSI under 70' },
  { value: 'trend', label: 'Trend', detail: 'EMA 20 crosses SMA 50' },
  { value: 'dip', label: 'Buy the dip', detail: 'RSI 14 under 30, out above 70' },
]

function cell(strategy: DemoStrategy, market: (typeof DEMO_MARKETS)[number]['value']) {
  const metrics = demoRun(strategy, market, 5).metrics
  const edge = metrics.total_return_pct - metrics.buy_and_hold_return_pct
  return { result: metrics.total_return_pct, holding: metrics.buy_and_hold_return_pct, edge }
}
</script>

<template>
  <div class="grid-wrap" role="table" aria-label="Three strategies on three coins: return, holding and the gap between them">
    <div class="row head" role="row">
      <span role="columnheader" />
      <span v-for="market in DEMO_MARKETS" :key="market.value" class="coin-head" role="columnheader">
        <img :src="`/brand-icons/${market.icon}.svg`" alt="" class="coin">
        {{ market.name }}
      </span>
    </div>
    <div v-for="strategy in STRATEGIES" :key="strategy.value" class="row" role="row">
      <span class="strategy" role="rowheader">
        <span class="block font-bold">{{ strategy.label }}</span>
        <span class="block text-[13px] text-[var(--muted)]">{{ strategy.detail }}</span>
      </span>
      <span
        v-for="market in DEMO_MARKETS"
        :key="market.value"
        class="cell"
        :class="cell(strategy.value, market.value).edge > 0 ? 'is-ahead' : 'is-behind'"
        role="cell"
      >
        <span class="cell-result">{{ formatSignedPercent(cell(strategy.value, market.value).result) }}</span>
        <span class="cell-detail">
          holding {{ formatSignedPercent(cell(strategy.value, market.value).holding) }}
        </span>
        <span class="cell-edge">
          {{ cell(strategy.value, market.value).edge > 0 ? 'Beat holding' : 'Behind holding' }}
          by {{ Math.abs(Math.round(cell(strategy.value, market.value).edge)) }} pts
        </span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.grid-wrap {
  display: grid;
  gap: 0.5rem;
  overflow-x: auto;
  font-variant-numeric: tabular-nums;
}

.row {
  display: grid;
  grid-template-columns: minmax(11rem, 1.1fr) repeat(3, minmax(9.5rem, 1fr));
  gap: 0.5rem;
  min-width: 42rem;
}

.head {
  padding-bottom: 0.25rem;
}

.coin-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-left: 0.25rem;
  font-weight: 700;
}

.coin {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 999px;
  background: #ffffff;
  padding: 1px;
}

.strategy {
  align-self: center;
  padding-right: 1rem;
}

.cell {
  display: grid;
  gap: 0.15rem;
  border-radius: 16px;
  background: var(--surface);
  padding: 1rem 1.1rem;
  box-shadow: inset 0 0 0 1px var(--line);
}

.cell.is-ahead {
  background: color-mix(in srgb, var(--color-lime) 22%, var(--surface));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-lime) 60%, transparent);
}

.cell-result {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.cell-detail {
  font-size: 13px;
  color: var(--muted);
}

.cell-edge {
  margin-top: 0.4rem;
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-soft);
}

.is-ahead .cell-edge {
  color: var(--ink);
}
</style>
