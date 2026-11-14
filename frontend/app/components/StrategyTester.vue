<script setup lang="ts">
import type { ResultSummary } from '~/utils/resultSummary'

// The numbers under the chart, laid out like a strategy tester's overview. On the landing page the gap to
// holding leads, the case for testing at all. In the builder, given the months the test covers, what the
// rules made leads instead, and how much that is a month: the question a trader actually asks.
// `compact` keeps the four numbers a first strategy is judged by.
const props = withDefaults(defineProps<{ summary: ResultSummary, coin: string, months?: number, compact?: boolean }>(), { months: undefined, compact: false })

const netProfit = computed(() => (STARTING_CASH * props.summary.total_return_pct) / 100)
const gap = computed(() => holdingGap(props.summary, props.coin))
const isProfitFirst = computed(() => props.months !== undefined)

/** The steady monthly return that compounds to the total over the period. */
const perMonth = computed(() => {
  if (!props.months) return 0
  return ((1 + props.summary.total_return_pct / 100) ** (1 / props.months) - 1) * 100
})

function periodWords(months: number): string {
  if (months < 1.5) return 'in a month'
  if (months < 23.5) return `in ${Math.round(months)} months`
  return `in ${(months / 12).toFixed(1).replace(/\.0$/, '')} years`
}

function plainPercent(value: number): string {
  return `${Math.abs(Math.round(value))}%`
}

function tradePercent(value: number | null): string {
  return value === null ? 'None yet' : formatSignedPercent(value)
}
</script>

<template>
  <div class="tester">
    <div v-if="isProfitFirst" class="headline">
      <p class="edge" :class="netProfit >= 0 ? 'is-ahead' : 'down'">
        {{ netProfit >= 0 ? '+' : '' }}{{ formatDollars(netProfit) }} <span>{{ periodWords(months!) }} from $10,000</span>
      </p>
      <p class="summary">
        {{ formatSignedPercent(summary.total_return_pct) }} over {{ summary.trade_count }} {{ summary.trade_count === 1 ? 'trade' : 'trades' }}, about {{ formatSignedPercent(perMonth) }} a month.
      </p>
    </div>
    <div v-else class="headline">
      <p class="edge" :class="gap.isAhead ? 'is-ahead' : 'down'">
        {{ gap.dollars }} <span>{{ gap.words }}</span>
      </p>
      <p class="summary">
        Holding {{ coin }} {{ summary.buy_and_hold_return_pct >= 0 ? 'made' : 'lost' }} {{ plainPercent(summary.buy_and_hold_return_pct) }}.
        These rules {{ summary.total_return_pct >= 0 ? 'made' : 'lost' }} {{ plainPercent(summary.total_return_pct) }}.
      </p>
    </div>
    <dl class="overview">
      <!-- The headline already says the profit in dollars and percent; the builder says how often it trades instead. -->
      <div v-if="isProfitFirst && !compact">
        <dt>Trades a month</dt>
        <dd>{{ (summary.trade_count / months!).toFixed(1) }}</dd>
      </div>
      <div v-else-if="!isProfitFirst">
        <dt>Net profit</dt>
        <dd :class="netProfit >= 0 ? 'up' : 'down'">
          {{ formatDollars(netProfit) }} <small>{{ formatSignedPercent(summary.total_return_pct) }}</small>
        </dd>
      </div>
      <div v-if="isProfitFirst">
        <dt>A month, on average</dt>
        <dd :class="perMonth >= 0 ? 'up' : 'down'">
          {{ formatSignedPercent(perMonth) }}
        </dd>
      </div>
      <div v-else>
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
      <div v-if="!compact">
        <dt>Best trade</dt>
        <dd>{{ tradePercent(summary.best_trade_pct) }}</dd>
      </div>
      <div v-if="!compact">
        <dt>Worst trade</dt>
        <dd>{{ tradePercent(summary.worst_trade_pct) }}</dd>
      </div>
      <div>
        <dt>Max drawdown</dt>
        <dd>{{ formatSignedPercent(summary.max_drawdown_pct) }}</dd>
      </div>
      <div v-if="!compact">
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
