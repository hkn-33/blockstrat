<script setup lang="ts">
import type { DemoMarket, DemoStopLoss, DemoStrategy } from '~/composables/useLandingDemo'

// The product, whole and working: the rules on the left, the market and every trade on the right.
// The controls switch between real precomputed backtests; the rules snap in and the chart redraws.
const STRATEGIES: { value: DemoStrategy, label: string }[] = [
  { value: 'combo', label: 'Trend with filter' },
  { value: 'trend', label: 'Trend' },
  { value: 'dip', label: 'Buy the dip' },
]

const strategy = ref<DemoStrategy>('combo')
const market = ref<DemoMarket>('SOLUSDT')
const stopLoss = ref<DemoStopLoss>(5)

const run = computed(() => demoRun(strategy.value, market.value, stopLoss.value))
const rules = computed(() => demoRules(strategy.value, stopLoss.value))
</script>

<template>
  <div class="window">
    <div class="toolbar">
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
      <div class="segmented" role="radiogroup" aria-label="Market">
        <button
          v-for="option in DEMO_MARKETS"
          :key="option.value"
          type="button"
          role="radio"
          :aria-checked="market === option.value"
          :class="{ 'is-on': market === option.value }"
          @click="market = option.value"
        >
          <img :src="`/brand-icons/${option.icon}.svg`" alt="" class="coin">
          {{ option.label.split('/')[0] }}
        </button>
      </div>
      <div class="segmented" role="radiogroup" aria-label="Stop-loss">
        <button
          v-for="option in DEMO_STOP_LOSSES"
          :key="option"
          type="button"
          role="radio"
          :aria-checked="stopLoss === option"
          :class="{ 'is-on': stopLoss === option }"
          @click="stopLoss = option"
        >
          Stop {{ option }}%
        </button>
      </div>
      <span class="period">Jun 2025 to Nov 2026 · $10,000 start</span>
    </div>

    <div class="body">
      <div class="rules-col">
        <LandingRuleBuilder
          :key="strategy"
          :market="market"
          timeframe="4 hours"
          :entry="rules.entry"
          :exit="rules.exit"
          theme="dark"
          entrance
          flush
        />
        <dl class="costs">
          <div><dt>Position size</dt><dd>100% of the account</dd></div>
          <div><dt>Exchange fee</dt><dd>0.1% a side</dd></div>
          <div><dt>Slippage</dt><dd>0.05% a fill</dd></div>
          <div><dt>Orders fill</dt><dd>At the next candle's open</dd></div>
        </dl>
      </div>
      <div class="chart-col">
        <ClientOnly>
          <LandingTvChart :market="market" :run="run" :delay-ms="300" :height="440" />
          <template #fallback>
            <div class="h-[492px]" />
          </template>
        </ClientOnly>
        <LandingStrategyTester :market="market" :run="run" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.window {
  overflow: hidden;
  border-radius: 28px;
  background: #0b2125;
  color: #ffffff;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.08), inset 0 0 0 1px rgb(255 255 255 / 0.08);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  border-bottom: 1px solid rgb(255 255 255 / 0.07);
  padding: 0.75rem;
}

.period {
  margin-left: auto;
  font-size: 13px;
  color: rgb(214 226 230 / 0.7);
}

.segmented {
  display: inline-flex;
  gap: 2px;
  border-radius: 10px;
  background: rgb(255 255 255 / 0.06);
  padding: 3px;
}

.segmented button {
  display: inline-flex;
  min-height: 2rem;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  border-radius: 7px;
  padding: 0.25rem 0.75rem;
  font-size: 13px;
  font-weight: 600;
  color: rgb(214 226 230 / 0.75);
  transition: background-color 180ms, color 180ms, transform 120ms;
}

.segmented button:hover {
  color: #ffffff;
}

.segmented button:active {
  transform: scale(0.97);
}

.segmented button.is-on {
  background: rgb(255 255 255 / 0.14);
  color: #ffffff;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.12);
}

.segmented button:focus-visible {
  outline: 2px solid #c8f25a;
  outline-offset: 2px;
}

.body {
  display: grid;
}

@media (min-width: 1024px) {
  .body {
    grid-template-columns: minmax(0, 23rem) minmax(0, 1fr);
  }

  .rules-col {
    border-right: 1px solid rgb(255 255 255 / 0.07);
  }
}

.costs {
  display: grid;
  gap: 0.1rem;
  border-top: 1px solid rgb(255 255 255 / 0.07);
  padding: 1rem 1.1rem 1.25rem;
  font-size: 13px;
}

.costs div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding-block: 0.35rem;
}

.costs dt {
  color: rgb(214 226 230 / 0.7);
}

.costs dd {
  font-weight: 600;
  text-align: right;
}

.coin {
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 999px;
  background: #ffffff;
  padding: 1px;
}

.chart-col {
  min-width: 0;
}

@media (max-width: 1023px) {
  .period {
    width: 100%;
    margin-left: 0.25rem;
  }
}
</style>
