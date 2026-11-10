<script setup lang="ts">
import type { DemoMarket, DemoRun } from '~/composables/useLandingDemo'

// The numbers under the chart, laid out like a strategy tester's overview. The gap to holding leads,
// because it says whether the rules were worth following at all.
const props = defineProps<{ market: DemoMarket, run: DemoRun }>()

const metrics = computed(() => props.run.metrics)
const coinName = computed(() => demoMarket(props.market).label.split('/')[0])
const netProfit = computed(() => (DEMO_STARTING_CASH * metrics.value.total_return_pct) / 100)
const beatHolding = computed(() => metrics.value.total_return_pct > metrics.value.buy_and_hold_return_pct)
const edge = computed(() => metrics.value.total_return_pct - metrics.value.buy_and_hold_return_pct)
const tradeReturns = computed(() => props.run.trades.map(trade => trade.return_pct))

function plainPercent(value: number): string {
  return `${Math.abs(Math.round(value))}%`
}
</script>

<template>
  <div class="tester">
    <div class="headline">
      <p class="edge" :class="beatHolding ? 'is-ahead' : 'down'">
        {{ edge >= 0 ? '+' : '−' }}{{ Math.abs(Math.round(edge)) }} pts <span>vs holding {{ coinName }}</span>
      </p>
      <p class="summary">
        Holding {{ coinName }} {{ metrics.buy_and_hold_return_pct >= 0 ? 'made' : 'lost' }} {{ plainPercent(metrics.buy_and_hold_return_pct) }}.
        These rules {{ metrics.total_return_pct >= 0 ? 'made' : 'lost' }} {{ plainPercent(metrics.total_return_pct) }}.
      </p>
    </div>
    <dl class="overview">
      <div>
        <dt>Net profit</dt>
        <dd :class="netProfit >= 0 ? 'up' : 'down'">
          {{ formatDollars(netProfit) }} <small>{{ formatSignedPercent(metrics.total_return_pct) }}</small>
        </dd>
      </div>
      <div>
        <dt>Holding {{ coinName }}</dt>
        <dd>{{ formatSignedPercent(metrics.buy_and_hold_return_pct) }}</dd>
      </div>
      <div>
        <dt>Closed trades</dt>
        <dd>{{ metrics.trade_count }}</dd>
      </div>
      <div>
        <dt>Profitable</dt>
        <dd>{{ Math.round(metrics.win_rate_pct ?? 0) }}%</dd>
      </div>
      <div>
        <dt>Best trade</dt>
        <dd>{{ formatSignedPercent(Math.max(...tradeReturns)) }}</dd>
      </div>
      <div>
        <dt>Worst trade</dt>
        <dd>{{ formatSignedPercent(Math.min(...tradeReturns)) }}</dd>
      </div>
      <div>
        <dt>Max drawdown</dt>
        <dd>{{ formatSignedPercent(-Math.abs(metrics.max_drawdown_pct)) }}</dd>
      </div>
      <div>
        <dt>Fees paid</dt>
        <dd>{{ formatDollars(run.fees_paid) }}</dd>
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
  color: rgb(214 226 230 / 0.8);
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
  color: var(--color-lime);
}

.edge span {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0;
  color: rgb(214 226 230 / 0.75);
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
  border-top: 1px solid rgb(255 255 255 / 0.07);
  padding-top: 0.6rem;
}

.overview dt {
  color: rgb(214 226 230 / 0.7);
}

.overview dd {
  margin-top: 0.15rem;
  font-size: 17px;
  font-weight: 700;
  color: #ffffff;
}

.overview dd small {
  font-size: 12px;
  font-weight: 600;
}

.up,
.overview dd.up {
  color: var(--color-gain-bright);
}

.down,
.overview dd.down {
  color: var(--color-loss-bright);
}
</style>
