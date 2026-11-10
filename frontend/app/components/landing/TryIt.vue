<script setup lang="ts">
import type { DemoMarket, DemoRule, DemoStopLoss } from '~/composables/useLandingDemo'
import type { StrategyBlock } from './BlockStack.vue'

// A working slice of the builder: pick a strategy, a market and a stop-loss; the real backtest redraws.
type StrategyChoice = 'dip' | 'trend'

const choice = ref<StrategyChoice>('dip')
const market = ref<DemoMarket>('ETHUSDT')
const stopLoss = ref<DemoStopLoss>(5)

const STRATEGIES: { value: StrategyChoice, label: string }[] = [
  { value: 'dip', label: 'Buy the dip' },
  { value: 'trend', label: 'Follow the trend' },
]

const COIN_ICON: Record<DemoMarket, string> = {
  BTCUSDT: 'bitcoin',
  ETHUSDT: 'ethereum',
  SOLUSDT: 'solana',
}

const rule = computed<DemoRule>(() => (choice.value === 'dip' ? 'rsi30' : 'trend'))
const run = computed(() => demoRun(rule.value, market.value, stopLoss.value))
const marketLabel = computed(() => DEMO_MARKETS.find(option => option.value === market.value)?.label ?? market.value)
const coinName = computed(() => marketLabel.value.split('/')[0])

const blocks = computed<StrategyBlock[]>(() => {
  const stop: StrategyBlock = { tone: 'risk', label: 'Stop-loss', parts: [{ value: `${stopLoss.value}%` }, 'below entry'] }
  if (choice.value === 'dip') {
    return [
      { tone: 'entry', label: 'Buy when', parts: ['RSI', { value: '14' }, 'drops below', { value: '30' }] },
      { tone: 'exit', label: 'Sell when', parts: ['RSI', { value: '14' }, 'rises above', { value: '70' }] },
      stop,
    ]
  }
  return [
    { tone: 'entry', label: 'Buy when', parts: ['EMA', { value: '20' }, 'crosses above SMA', { value: '50' }] },
    { tone: 'exit', label: 'Sell when', parts: ['EMA', { value: '20' }, 'crosses below SMA', { value: '50' }] },
    stop,
  ]
})
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
    <div class="flex min-w-0 flex-col gap-5">
      <div class="segmented" role="radiogroup" aria-label="Strategy">
        <button
          v-for="option in STRATEGIES"
          :key="option.value"
          type="button"
          role="radio"
          :aria-checked="choice === option.value"
          :class="{ 'is-on': choice === option.value }"
          @click="choice = option.value"
        >
          {{ option.label }}
        </button>
      </div>
      <LandingBlockStack :market="marketLabel" timeframe="4 hours" :blocks="blocks" />
      <div class="flex flex-wrap gap-3">
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
            <img :src="`/brand-icons/${COIN_ICON[option.value]}.svg`" alt="" class="h-4 w-4">
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
      </div>
    </div>
    <LandingResultCard :run="run" :holding-label="`Holding ${coinName}`" :chart-height="230" />
  </div>
</template>

<style scoped>
/* iOS-style segmented control: a recessed track, the chosen option raised on it. */
.segmented {
  display: inline-flex;
  gap: 2px;
  justify-self: start;
  align-self: flex-start;
  border-radius: 12px;
  background: rgb(13 27 36 / 0.07);
  padding: 3px;
}

.segmented button {
  display: inline-flex;
  min-height: 2.25rem;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  border-radius: 9px;
  padding: 0.35rem 0.9rem;
  font-size: 14px;
  font-weight: 600;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
  transition: background-color 180ms, color 180ms, box-shadow 180ms, transform 120ms;
}

.segmented button:hover {
  color: var(--ink);
}

.segmented button:active {
  transform: scale(0.97);
}

.segmented button.is-on {
  background: #ffffff;
  color: var(--ink);
  box-shadow: 0 1px 2px rgb(13 27 36 / 0.12), 0 4px 10px -4px rgb(13 27 36 / 0.25);
}

.segmented button:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}
</style>
