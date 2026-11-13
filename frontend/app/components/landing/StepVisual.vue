<script setup lang="ts">
// The picture for one "how it works" step. `progress` (0 to 1) is how far the visitor has scrolled through
// that step, and the picture changes all the way with it: the pair is typed and picked, the rules snap in
// one by one, the chart draws and its numbers count along. Each picture uses the hero window's look.
const props = withDefaults(defineProps<{ step: number, progress?: number }>(), { progress: 1 })

const MARKETS = [
  { icon: 'bitcoin', pair: 'BTC/USDT', name: 'Bitcoin' },
  { icon: 'ethereum', pair: 'ETH/USDT', name: 'Ethereum' },
  { icon: 'solana', pair: 'SOL/USDT', name: 'Solana' },
  { icon: 'binance', pair: 'BNB/USDT', name: 'BNB' },
]
const PACES = ['1 hour', '4 hours', '1 day']
// The walkthrough follows one strategy on Solana from start to verdict, so the pair typed is SOL/USDT.
const QUERY = 'SOL/USDT'

const RULES = demoRules('combo', 5)
// The market and every condition are blocks the scroll lands one by one.
const BLOCK_COUNT = 1 + RULES.entry.conditions.length + RULES.exit.conditions.length
const run = demoRun('combo', 'SOLUSDT', 5)
const chartData = demoChartData('SOLUSDT', run)

const typed = computed(() => QUERY.slice(0, Math.round(Math.min(1, props.progress / 0.5) * QUERY.length)))
const isPicked = computed(() => props.progress >= 0.6)
const pace = computed(() => (props.progress >= 0.85 ? '4 hours' : '1 day'))
const landedBlocks = computed(() => Math.max(1, Math.ceil(props.progress * BLOCK_COUNT)))
const chartProgress = computed(() => Math.max(0.04, props.progress))
const summary = computed(() => runSnapshot('SOLUSDT', run, chartProgress.value))

function matches(pair: string): boolean {
  return pair.startsWith(typed.value)
}
</script>

<template>
  <div v-if="step === 0" class="panel panel--padded">
    <div class="search">
      <UiIcon name="search" />
      <span class="text-[var(--panel-ink)]">{{ typed }}</span>
      <span class="search-caret" />
      <span v-if="!typed" class="text-[var(--panel-soft)]">Search a pair</span>
    </div>
    <ul class="mt-3 grid gap-1">
      <li
        v-for="market in MARKETS"
        :key="market.pair"
        class="market"
        :class="{ 'is-on': isPicked && market.pair === QUERY, 'is-dim': !matches(market.pair) }"
      >
        <img :src="`/brand-icons/${market.icon}.svg`" alt="" class="coin">
        <span>
          <span class="block font-bold">{{ market.pair }}</span>
          <span class="block text-[13px] text-[var(--panel-soft)]">{{ market.name }}, since 2017</span>
        </span>
        <UiIcon v-if="isPicked && market.pair === QUERY" name="check" class="pick ml-auto text-[var(--gain-ink)]" />
      </li>
    </ul>
    <div class="mt-4 flex items-center justify-between gap-3 text-[14px] text-[var(--panel-soft)]">
      Check every
      <span class="segmented">
        <span v-for="option in PACES" :key="option" :class="{ 'is-on': option === pace }">{{ option }}</span>
      </span>
    </div>
  </div>

  <div v-else-if="step === 1" class="panel">
    <LandingStrategyBoard
      market="SOLUSDT"
      :name="DEMO_STRATEGY_NAMES.combo"
      :entry="RULES.entry"
      :exit="RULES.exit"
      :revealed="landedBlocks"
      compact
    />
  </div>

  <div v-else class="panel">
    <ClientOnly>
      <TvChart :data="chartData" name="SOL/USDT" icon="solana" detail="1D candles, 4h strategy, Binance prices" :height="260" theme="auto" :progress="chartProgress" />
      <template #fallback>
        <div class="h-[312px]" />
      </template>
    </ClientOnly>
    <StrategyTester :summary="summary" coin="SOL" />
  </div>
</template>

<style scoped>
.panel {
  overflow: hidden;
  border-radius: 20px;
  background: var(--panel);
  color: var(--panel-ink);
  box-shadow: var(--panel-shadow);
}

.panel--padded {
  padding: 1.25rem;
}

.coin {
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
}

.search {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  border-radius: 12px;
  background: var(--panel-fill);
  padding: 0.7rem 0.9rem;
  color: var(--panel-soft);
  font-size: 15px;
}

.search-caret {
  width: 2px;
  height: 1.1em;
  margin-left: -0.45rem;
  background: var(--panel-ink);
  animation: blink 900ms steps(1) infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

.market {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  border-radius: 14px;
  padding: 0.6rem 0.7rem;
  font-size: 15px;
  transition: opacity 220ms cubic-bezier(0.22, 1, 0.36, 1), background-color 240ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.market.is-dim {
  opacity: 0.35;
}

.market.is-on {
  background: var(--panel-fill);
  box-shadow: inset 0 0 0 1.5px var(--gain-ink);
}

.pick {
  animation: pick-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes pick-in {
  from {
    opacity: 0;
    transform: scale(0.6);
    filter: blur(2px);
  }
}

.segmented {
  display: inline-flex;
  gap: 2px;
  border-radius: 10px;
  background: var(--panel-fill);
  padding: 3px;
}

.segmented span {
  white-space: nowrap;
  border-radius: 7px;
  padding: 0.3rem 0.7rem;
  font-weight: 600;
  transition: background-color 200ms, color 200ms, box-shadow 200ms;
}

.segmented .is-on {
  background: var(--panel);
  color: var(--panel-ink);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.12), inset 0 0 0 1px var(--panel-line);
}

@media (prefers-reduced-motion: reduce) {
  .search-caret,
  .pick {
    animation: none;
  }

  .market,
  .segmented span {
    transition: none;
  }
}
</style>
