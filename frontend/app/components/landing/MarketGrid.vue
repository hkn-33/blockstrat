<script setup lang="ts">
import type { DemoStrategy } from '~/composables/useLandingDemo'

// One strategy at a time on three coins over the same 16 months, 5% stop: real backtests side by side,
// so a visitor sees that rules which work on one coin can fail on the next. Each card says one thing:
// what the rules made, what holding made, and a line of each. Under the cards sits what the builder shows
// for a strategy tested on several markets: its one-sentence verdict and its comparison table.
const STRATEGIES: { value: DemoStrategy, label: string, detail: string }[] = [
  { value: 'combo', label: 'Trend with filter', detail: 'Buy when the 20 EMA crosses above the 50 SMA and RSI is under 70' },
  { value: 'trend', label: 'Trend', detail: 'Buy when the 20 EMA crosses above the 50 SMA, sell on the cross back' },
  { value: 'dip', label: 'Buy the dip', detail: 'Buy when RSI drops under 30, sell when it climbs over 70' },
]

const strategy = ref<DemoStrategy>('combo')
const chosen = computed(() => STRATEGIES.find(option => option.value === strategy.value)!)

const cards = computed(() => COMPARISON_MARKETS.map((market) => {
  const run = demoRun(strategy.value, market.value, 5)
  const coin = market.label.split('/')[0]!
  const result = run.metrics.total_return_pct
  const holding = run.metrics.buy_and_hold_return_pct
  return { market: market.value, name: market.name, icon: market.icon, coin, run, result, holding, beat: result > holding, summary: runSnapshot(market.value, run) }
}))

const verdict = computed(() => marketsVerdict(cards.value.map(card => ({ returnPct: card.result, isPending: false }))))
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center gap-x-5 gap-y-3">
      <div class="segmented" role="radiogroup" aria-label="Strategy">
        <button
          v-for="option in STRATEGIES"
          :key="option.value"
          type="button"
          role="radio"
          :aria-checked="strategy === option.value"
          :class="{ 'is-on': strategy === option.value }"
          @click="strategy = option.value"
        >
          {{ option.label }}
        </button>
      </div>
      <p class="text-[15px] text-[var(--ink-soft)]">
        {{ chosen.detail }}
      </p>
    </div>

    <div class="cards mt-6">
      <article v-for="card in cards" :key="card.market" class="card">
        <header class="flex items-center gap-2 font-bold">
          <img :src="`/brand-icons/${card.icon}.svg`" alt="" class="coin">
          {{ card.name }}
          <span class="verdict" :class="{ 'is-ahead': card.beat }">
            <UiIcon :name="card.beat ? 'circle-check' : 'x'" />
            {{ card.beat ? 'Beat holding' : 'Lost to holding' }}
          </span>
        </header>
        <p class="result" :class="card.result >= 0 ? 'is-up' : 'is-down'">
          {{ formatSignedPercent(card.result) }}
        </p>
        <p class="text-[14px] text-[var(--ink-soft)]">
          Holding {{ card.coin }}: {{ formatSignedPercent(card.holding) }}
        </p>
        <ClientOnly>
          <LandingEquityChart :market="card.market" :run="card.run" class="mt-4" />
          <template #fallback>
            <div class="mt-4 h-[120px]" />
          </template>
        </ClientOnly>
        <p class="legend">
          <span><i class="swatch swatch--rules" /> These rules</span>
          <span><i class="swatch swatch--holding" /> Holding</span>
        </p>
      </article>
    </div>

    <div class="compare mt-4">
      <p class="compare-verdict">
        {{ verdict }}
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Market</th>
            <th scope="col" class="num">Return</th>
            <th scope="col" class="num">vs holding</th>
            <th scope="col" class="num is-extra">Biggest drop</th>
            <th scope="col" class="num is-extra">Trades</th>
            <th scope="col" class="num">Profitable</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="card in cards" :key="card.market">
            <th scope="row">
              <span class="row-market"><img :src="`/brand-icons/${card.icon}.svg`" alt="" class="coin"><span>{{ card.coin }}<span class="pair">/USDT</span></span></span>
            </th>
            <td class="num" :class="card.result >= 0 ? 'is-up' : 'is-down'">{{ formatSignedPercent(card.result) }}</td>
            <td class="num" :class="card.beat ? 'is-up' : 'is-down'">{{ formatSignedPercent(card.result - card.holding).replace('%', ' pts') }}</td>
            <td class="num is-extra">{{ formatSignedPercent(card.summary.max_drawdown_pct) }}</td>
            <td class="num is-extra">{{ card.summary.trade_count }}</td>
            <td class="num">{{ Math.round(card.summary.win_rate_pct) }}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
/* The builder's "Compare markets" table, in the landing page's card. */
.compare {
  overflow-x: auto;
  border-radius: 20px;
  background: var(--surface);
  padding: 1rem 1.25rem 0.75rem;
  box-shadow: var(--card-shadow);
}

.compare-verdict {
  font-weight: 700;
}

.compare table {
  width: 100%;
  margin-top: 0.6rem;
  border-collapse: collapse;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.compare th,
.compare td {
  border-top: 1px solid var(--line);
  padding: 0.55rem 0.5rem;
  text-align: left;
  white-space: nowrap;
}

.compare thead th {
  border-top: 0;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--muted);
}

.compare tbody th {
  font-weight: 700;
}

.row-market {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  vertical-align: middle;
}

/* A phone keeps the columns that answer "did it work": the coin, its return, holding and the win rate. */
@media (max-width: 639px) {
  .compare table {
    font-size: 13px;
  }

  .compare .is-extra,
  .compare .pair {
    display: none;
  }
}

.compare .num {
  text-align: right;
}

.compare .is-up {
  font-weight: 700;
  color: var(--gain-ink);
}

.compare .is-down {
  font-weight: 700;
  color: var(--loss-ink);
}

.segmented {
  display: inline-flex;
  gap: 2px;
  border-radius: 12px;
  background: var(--tint);
  padding: 3px;
}

.segmented button {
  cursor: pointer;
  border-radius: 9px;
  padding: 0.5rem 0.9rem;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--ink-soft);
  transition: background-color 180ms, color 180ms, transform 120ms;
}

.segmented button:hover {
  color: var(--ink);
}

.segmented button:active {
  transform: scale(0.97);
}

.segmented button.is-on {
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.12), inset 0 0 0 1px var(--line);
}

.segmented button:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.cards {
  display: grid;
  gap: 1rem;
}

@media (min-width: 900px) {
  .cards {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.card {
  min-width: 0;
  border-radius: 20px;
  background: var(--panel);
  padding: 1.25rem 1.25rem 1rem;
  font-variant-numeric: tabular-nums;
  box-shadow: var(--panel-shadow);
}

.coin {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 999px;
}

.verdict {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-left: auto;
  font-size: 13px;
  color: var(--muted);
}

.verdict.is-ahead {
  color: var(--gain-ink);
}

.result {
  margin-top: 1rem;
  font-size: 40px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
}

.result.is-up {
  color: var(--gain-ink);
}

.result.is-down {
  color: var(--loss-ink);
}

.legend {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
  font-size: 12px;
  color: var(--muted);
}

.legend span {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.swatch {
  width: 0.9rem;
  height: 0;
  border-top: 2px solid var(--gain-ink);
}

.swatch--holding {
  border-top: 1px dashed var(--muted);
}
</style>
