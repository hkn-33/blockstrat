<script setup lang="ts">
import type { DemoStrategy } from '~/composables/useLandingDemo'

// One strategy at a time on three coins over the same 16 months, 5% stop: real backtests side by side,
// so a visitor sees that rules which work on one coin can fail on the next. Each card says one thing:
// what the rules made, what holding made, and a line of each.
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
  return { market: market.value, name: market.name, icon: market.icon, coin, run, result, holding, beat: result > holding }
}))
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
  </div>
</template>

<style scoped>
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
  background: #ffffff;
  padding: 1px;
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
