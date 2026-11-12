<script setup lang="ts">
import type { ResultSummary } from '~/utils/resultSummary'

// The numbers under the chart, laid out like a strategy tester's overview. The gap to holding leads,
// because it says whether the rules were worth following at all.
const props = defineProps<{ summary: ResultSummary, coin: string }>()

const netProfit = computed(() => (STARTING_CASH * props.summary.total_return_pct) / 100)
const gap = computed(() => holdingGap(props.summary, props.coin))

function plainPercent(value: number): string {
  return `${Math.abs(Math.round(value))}%`
}

function tradePercent(value: number | null): string {
  return value === null ? 'None yet' : formatSignedPercent(value)
}
</script>

<template>
  <div class="tester">
    <div class="headline">
      <p class="edge" :class="gap.isAhead ? 'is-ahead' : 'down'">
        {{ gap.dollars }} <span>{{ gap.words }}</span>
      </p>
      <p class="summary">
        Holding {{ coin }} {{ summary.buy_and_hold_return_pct >= 0 ? 'made' : 'lost' }} {{ plainPercent(summary.buy_and_hold_return_pct) }}.
        These rules {{ summary.total_return_pct >= 0 ? 'made' : 'lost' }} {{ plainPercent(summary.total_return_pct) }}.
      </p>
    </div>
    <dl class="overview">
      <div>
        <dt>Net profit</dt>
        <dd :class="netProfit >= 0 ? 'up' : 'down'">
          {{ formatDollars(netProfit) }} <small>{{ formatSignedPercent(summary.total_return_pct) }}</small>
        </dd>
      </div>
      <div>
        <dt>Holding {{ coin }}</dt>
        <dd>{{ formatSignedPercent(summary.buy_and_hold_return_pct) }}</dd>
      </div>
      <div>
        <dt>Closed trades</dt>
        <dd>{{ summary.trade_count }}</dd>
      </div>
      <div>
        <dt>Profitable</dt>
        <dd>{{ Math.round(summary.win_rate_pct) }}%</dd>
      </div>
      <div>
        <dt>Best trade</dt>
        <dd>{{ tradePercent(summary.best_trade_pct) }}</dd>
      </div>
      <div>
        <dt>Worst trade</dt>
        <dd>{{ tradePercent(summary.worst_trade_pct) }}</dd>
      </div>
      <div>
        <dt>Max drawdown</dt>
        <dd>{{ formatSignedPercent(summary.max_drawdown_pct) }}</dd>
      </div>
      <div>
        <dt>Fees paid</dt>
        <dd>{{ formatDollars(summary.fees_paid) }}</dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.tester {
  display: grid;
  gap: 1rem;
  padding: 1rem 1rem 1.25rem;
  font-size: 13px;
  color: var(--panel-soft);
  font-variant-numeric: tabular-nums;
}

.headline {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 1rem;
}

.edge {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.edge.is-ahead {
  color: var(--accent-ink);
}

.edge span {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0;
  color: var(--panel-soft);
}

.summary {
  font-size: 14px;
}

.overview {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem 1rem;
}

@media (min-width: 640px) {
  .overview {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.overview div {
  border-top: 1px solid var(--panel-line);
  padding-top: 0.6rem;
}

.overview dd {
  margin-top: 0.15rem;
  font-size: 17px;
  font-weight: 700;
  color: var(--panel-ink);
}

.overview dd small {
  font-size: 12px;
  font-weight: 600;
}

.up,
.overview dd.up {
  color: var(--gain-ink);
}

.down,
.overview dd.down {
  color: var(--loss-ink);
}
</style>
