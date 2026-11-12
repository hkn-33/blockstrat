<script setup lang="ts">
import type { Trade } from '~/types/api'
import type TvChart from '~/components/TvChart.vue'
import type { MarketRun, MarketRuns } from '~/composables/useBacktest'
import type { ResultSummary } from '~/utils/resultSummary'
import type { GuideItem } from '~/utils/strategyGuide'
import type { RequiredPart } from '~/utils/strategyDocument'

// The right side of the builder: the chart with every trade, the tester's numbers and the trade list. While
// a new result is on its way the last one stays, dimmed; an incomplete or broken strategy says what to do.
// With several markets, tabs on top switch between them, under one sentence and a table comparing them all.
const props = defineProps<{
  instruments: string[]
  runs: MarketRuns
  isLoading: boolean
  missing: RequiredPart[]
  checklist: GuideItem[]
  problemCount: number
  commissionPct: number
}>()

const emit = defineEmits<{ runFull: [], retry: [] }>()

const chart = ref<InstanceType<typeof TvChart> | null>(null)

const CHECK_TEXT: Record<string, string> = {
  market: 'A market, like BTC/USDT, or several',
  entry: 'When to buy: at least one condition',
  exit: 'When to sell: a condition, a stop-loss or a take-profit',
}

const NOT_RUN: MarketRun = { result: null, isLoading: false, error: null }

interface MarketRow {
  symbol: string
  coin: string
  run: MarketRun
  summary: ResultSummary | null
  isPending: boolean
  hasFailed: boolean
}

const requirements = computed(() => props.checklist.filter(item => item.key !== 'name'))
const isBlocked = computed(() => props.missing.length > 0 || props.problemCount > 0)
const isSeveral = computed(() => props.instruments.length > 1)

const markets = computed<MarketRow[]>(() => props.instruments.map((symbol) => {
  const run = props.runs[symbol] ?? NOT_RUN
  return {
    symbol,
    coin: baseCoin(symbol),
    run,
    summary: run.result ? summaryFromResult(run.result, props.commissionPct) : null,
    isPending: run.isLoading || (!run.result && !run.error),
    hasFailed: run.error !== null && !run.isLoading,
  }
}))

const verdict = computed(() => marketsVerdict(markets.value.map(market => ({
  returnPct: market.hasFailed ? null : market.summary?.total_return_pct ?? null,
  isPending: market.isPending,
}))))

// The chosen tab survives every re-run; once its market is removed, the first market takes over.
const pickedSymbol = ref<string | null>(null)
const selected = computed(() => markets.value.find(market => market.symbol === pickedSymbol.value) ?? markets.value[0] ?? null)
const result = computed(() => selected.value?.run.result ?? null)
const error = computed(() => selected.value?.run.error ?? null)
const isSelectedLoading = computed(() => selected.value?.run.isLoading ?? false)
const coin = computed(() => selected.value?.coin ?? '')

const chartData = computed(() => (result.value ? chartDataFromResult(result.value) : null))

const period = computed(() => {
  if (!result.value) return ''
  const format = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
  const span = `${format.format(new Date(result.value.start_time * 1000))} to ${format.format(new Date(result.value.end_time * 1000))}`
  return result.value.mode === 'full' ? `Full history, ${span}` : `Last ${result.value.bar_count.toLocaleString('en-US')} candles, ${span}`
})

function selectTrade(trade: Trade): void {
  chart.value?.focusTrade(trade)
}

function selectMarket(symbol: string): void {
  pickedSymbol.value = symbol
}

/** The gap to holding the coin, in percentage points: +5.2 pts. */
function holdingPoints(summary: ResultSummary): string {
  return formatSignedPercent(summary.total_return_pct - summary.buy_and_hold_return_pct).replace('%', ' pts')
}

function tone(value: number): string {
  return value >= 0 ? 'up' : 'down'
}
</script>

<template>
  <div class="results">
    <div v-if="isBlocked" class="state">
      <template v-if="missing.length">
        <svg class="state-art" viewBox="0 0 160 90" fill="none" aria-hidden="true">
          <path d="M10 70 L 40 52 L 62 60 L 92 34 L 118 42 L 150 16" class="art-line art-line--faint" />
          <rect x="18" y="58" width="12" height="22" rx="3" class="art-candle" />
          <rect x="50" y="44" width="12" height="30" rx="3" class="art-candle" />
          <rect x="82" y="28" width="12" height="34" rx="3" class="art-candle" />
          <rect x="114" y="18" width="12" height="40" rx="3" class="art-candle" />
        </svg>
        <p class="state-title">
          Your result appears here
        </p>
        <p class="mt-1 text-[var(--panel-soft)]">
          The chart and the numbers show up as soon as the strategy has these three parts:
        </p>
        <ul class="mt-4 grid gap-2.5">
          <li v-for="item in requirements" :key="item.key" class="state-item" :class="{ 'is-done': item.isDone }">
            <span class="state-check"><UiIcon v-if="item.isDone" name="check" /></span>
            {{ CHECK_TEXT[item.key] }}
          </li>
        </ul>
      </template>
      <template v-else>
        <p class="state-title">
          Fix the marked {{ problemCount === 1 ? 'value' : 'values' }} to see a result
        </p>
        <p class="mt-2 text-[var(--panel-soft)]">
          The red tiles on the left say what each one needs.
        </p>
      </template>
    </div>

    <template v-else>
      <div v-if="isSeveral" class="markets">
        <div class="market-tabs" role="tablist" aria-label="Markets">
          <button
            v-for="market in markets"
            :key="market.symbol"
            type="button"
            role="tab"
            class="market-tab"
            :class="{ 'is-on': market.symbol === selected?.symbol }"
            :aria-selected="market.symbol === selected?.symbol"
            @click="selectMarket(market.symbol)"
          >
            <CoinMark :symbol="market.symbol" />
            {{ market.coin }}
            <span class="tab-status">
              <span v-if="market.isPending" class="spinner"><span class="sr-only">calculating</span></span>
              <span v-else-if="market.hasFailed" class="down"><UiIcon name="info" /><span class="sr-only">could not be calculated</span></span>
              <span v-else-if="market.summary" :class="tone(market.summary.total_return_pct)">{{ formatSignedPercent(market.summary.total_return_pct) }}</span>
            </span>
          </button>
        </div>
        <p class="verdict" role="status">
          {{ verdict }}
        </p>
        <details class="compare">
          <summary>
            <UiIcon name="chevron-down" class="compare-chevron" /> Compare markets
          </summary>
          <table>
            <thead>
              <tr>
                <th scope="col">
                  Market
                </th>
                <th scope="col" class="num">
                  <abbr title="Total return of the rules">Return</abbr>
                </th>
                <th scope="col" class="num">
                  <abbr title="Return of the rules minus simply holding the coin, in percentage points">vs hold</abbr>
                </th>
                <th scope="col" class="num">
                  <abbr title="Biggest drop of the account from a high (max drawdown)">Drop</abbr>
                </th>
                <th scope="col" class="num">
                  <abbr title="Closed trades">Trades</abbr>
                </th>
                <th scope="col" class="num">
                  <abbr title="Share of the trades that made money">Won</abbr>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="market in markets" :key="market.symbol" :class="{ 'is-on': market.symbol === selected?.symbol, 'is-pending': market.isPending }" @click="selectMarket(market.symbol)">
                <th scope="row">
                  <button type="button" class="row-market" @click.stop="selectMarket(market.symbol)">
                    <CoinMark :symbol="market.symbol" /> {{ market.coin }}
                  </button>
                </th>
                <td v-if="market.hasFailed" colspan="5" class="down">
                  Could not be calculated
                </td>
                <td v-else-if="!market.summary" colspan="5" class="muted">
                  Calculating
                </td>
                <template v-else>
                  <td class="num" :class="tone(market.summary.total_return_pct)">
                    {{ formatSignedPercent(market.summary.total_return_pct) }}
                  </td>
                  <td class="num" :class="tone(market.summary.total_return_pct - market.summary.buy_and_hold_return_pct)">
                    {{ holdingPoints(market.summary) }}
                  </td>
                  <td class="num">
                    {{ formatSignedPercent(market.summary.max_drawdown_pct) }}
                  </td>
                  <td class="num">
                    {{ market.summary.trade_count }}
                  </td>
                  <td class="num">
                    {{ Math.round(market.summary.win_rate_pct) }}%
                  </td>
                </template>
              </tr>
            </tbody>
          </table>
        </details>
      </div>

      <div v-if="error && !result" class="state">
        <p class="state-title">
          {{ isSeveral ? `${coin}/USDT could not be calculated` : 'The result could not be calculated' }}
        </p>
        <p class="mt-2 text-[var(--panel-soft)]">
          {{ error }}
        </p>
        <button type="button" class="action mt-4" @click="emit('retry')">
          <UiIcon name="refresh-cw" /> Try again
        </button>
      </div>

      <div v-else-if="!result" class="state">
        <p class="state-title">
          Calculating the first result
        </p>
        <div class="skeleton mt-4" />
      </div>

      <div v-else class="market-result">
        <div class="period-bar">
          <span>{{ period }}</span>
          <span class="ml-auto flex items-center gap-2">
            <span v-if="error" class="text-[var(--loss-ink)]">{{ error }}</span>
            <button type="button" class="action action--small" @click="chart?.showAll()">
              <UiIcon name="maximize-2" /> Show all
            </button>
            <button v-if="result.mode === 'preview'" type="button" class="action action--small" :disabled="isLoading" @click="emit('runFull')">
              <UiIcon name="play" /> Run the full history
            </button>
          </span>
        </div>
        <div class="result-body" :class="{ 'is-stale': isSelectedLoading }" :aria-busy="isSelectedLoading">
          <TvChart
            ref="chart"
            :data="chartData!"
            :name="`${coin}/USDT`"
            :icon="selected ? coinIcon(selected.symbol) : undefined"
            :height="300"
            theme="auto"
            interactive
          />
          <StrategyTester :summary="selected!.summary!" :coin="coin" />
          <div v-if="result.sides.length > 1 || result.both_signalled" class="side-split">
            <div v-for="side in result.sides" :key="side.direction" class="side-row">
              <span class="side-name" :class="`side-name--${side.direction}`">{{ side.direction === 'long' ? 'Long side' : 'Short side' }}</span>
              <span>{{ side.trade_count }} {{ side.trade_count === 1 ? 'trade' : 'trades' }}</span>
              <span>{{ side.win_rate_pct === null ? 'none closed' : `${Math.round(side.win_rate_pct)}% profitable` }}</span>
              <b :class="side.return_pct >= 0 ? 'up' : 'down'">{{ formatSignedPercent(side.return_pct) }}</b>
            </div>
            <p v-if="result.both_signalled" class="both-note">
              On {{ result.both_signalled }} {{ result.both_signalled === 1 ? 'candle' : 'candles' }} both sides wanted in at once, so no trade opened.
            </p>
          </div>
          <BuilderTradeList class="trade-list" :trades="result.trades" @select="selectTrade" />
        </div>
        <p v-if="isSelectedLoading" class="loading" role="status">
          Updating the result
        </p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.results {
  position: relative;
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.state {
  margin: auto;
  max-width: 26rem;
  padding: 3rem 1.5rem;
  text-align: center;
  font-size: 15px;
}

/* The checklist reads as a list: its lines start at one edge, and the list as a whole sits centred. */
.state ul {
  display: inline-grid;
  text-align: left;
}

.state .action {
  margin-inline: auto;
}

.state-title {
  font-size: 20px;
  font-weight: 700;
}

.state-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.state-item {
  color: var(--panel-soft);
}

.state-item.is-done {
  color: var(--panel-ink);
}

.state-check {
  display: grid;
  width: 1.2rem;
  height: 1.2rem;
  flex-shrink: 0;
  place-items: center;
  border-radius: 6px;
  color: var(--panel);
  box-shadow: inset 0 0 0 1.5px var(--tile-line);
}

.state-check :deep(.ui-icon) {
  width: 0.8rem;
  height: 0.8rem;
}

.state-item.is-done .state-check {
  background: var(--gain-ink);
  box-shadow: none;
}

.state-art {
  width: 9rem;
  margin: 0 auto 1rem;
}

.art-candle {
  fill: var(--panel-fill-strong);
}

.art-line {
  stroke: var(--accent-ink);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.art-line--faint {
  stroke-dasharray: 6 6;
}

.skeleton {
  width: 20rem;
  max-width: 100%;
  height: 14rem;
  border-radius: 14px;
  background: var(--panel-fill);
  animation: breathe 1.4s ease-in-out infinite;
}

@keyframes breathe {
  50% {
    opacity: 0.55;
  }
}

.period-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  border-bottom: 1px solid var(--panel-line);
  padding: 0.55rem 1rem;
  font-size: 13px;
  color: var(--panel-soft);
}

.market-result {
  position: relative;
}

.result-body {
  transition: opacity 200ms;
}

.result-body.is-stale {
  opacity: 0.55;
}

.side-split {
  display: grid;
  gap: 0.4rem;
  border-top: 1px solid var(--panel-line);
  padding: 0.8rem 1rem;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.side-row {
  display: grid;
  grid-template-columns: 6.5rem 1fr 1fr auto;
  gap: 0.75rem;
  align-items: center;
  color: var(--panel-soft);
}

.side-name {
  font-weight: 700;
}

.side-name--long {
  color: var(--gain-ink);
}

.side-name--short {
  color: var(--loss-ink);
}

.up {
  color: var(--gain-ink);
}

.down {
  color: var(--loss-ink);
}

.both-note {
  color: var(--panel-soft);
}

.trade-list {
  max-height: 18rem;
  overflow-y: auto;
  border-top: 1px solid var(--panel-line);
}

.loading {
  position: absolute;
  top: 3.2rem;
  left: 50%;
  transform: translateX(-50%);
  border-radius: 999px;
  background: var(--panel-ink);
  padding: 0.3rem 0.8rem;
  font-size: 12px;
  font-weight: 700;
  color: var(--panel);
}

.action {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border-radius: 9px;
  padding: 0.5rem 0.9rem;
  font-weight: 700;
  color: var(--panel-ink);
  box-shadow: inset 0 0 0 1px var(--panel-line);
  transition: background-color 140ms, transform 120ms;
}

.action--small {
  padding: 0.3rem 0.6rem;
  font-size: 12.5px;
}

.action:hover:not(:disabled) {
  background: var(--panel-fill);
}

.action:active:not(:disabled) {
  transform: scale(0.97);
}

.action:disabled {
  opacity: 0.5;
}

.action:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

/* ---------- Several markets ---------- */
.markets {
  display: grid;
  gap: 0.6rem;
  border-bottom: 1px solid var(--panel-line);
  padding: 0.75rem 1rem;
}

.market-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.market-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border-radius: 10px;
  padding: 0.3rem 0.55rem 0.3rem 0.35rem;
  font-size: 13px;
  font-weight: 700;
  color: var(--panel-ink);
  box-shadow: inset 0 0 0 1px var(--panel-line);
  transition: background-color 140ms, box-shadow 140ms;
}

.market-tab:hover,
.market-tab.is-on {
  background: var(--panel-fill);
}

.market-tab.is-on {
  box-shadow: inset 0 0 0 1.5px var(--accent-ink);
}

.market-tab :deep(.coin-mark) {
  width: 1.2rem;
  height: 1.2rem;
}

/* Wide enough for "+123.4%", so a tab keeps its width when its number arrives. */
.tab-status {
  display: inline-flex;
  min-width: 3.4rem;
  justify-content: flex-end;
  font-variant-numeric: tabular-nums;
}

.spinner {
  width: 0.85rem;
  height: 0.85rem;
  border: 2px solid var(--panel-line);
  border-top-color: var(--panel-soft);
  border-radius: 999px;
  animation: spin 800ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.verdict {
  font-size: 14px;
  font-weight: 600;
}

.compare summary {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  cursor: pointer;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--panel-soft);
  list-style: none;
}

.compare summary::-webkit-details-marker {
  display: none;
}

.compare summary:hover {
  color: var(--panel-ink);
}

.compare-chevron {
  transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.compare[open] .compare-chevron {
  transform: rotate(180deg);
}

/* Fits a 24rem column without scrolling sideways: short headers, tight cells, the column's own edges. */
.compare table {
  width: calc(100% + 2rem);
  margin: 0.5rem -1rem 0;
  border-collapse: collapse;
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}

.compare th,
.compare td {
  padding: 0.4rem 0.35rem;
  border-bottom: 1px solid var(--panel-line);
  white-space: nowrap;
  text-align: left;
}

.compare thead th {
  font-weight: 600;
  color: var(--panel-soft);
}

.compare th:first-child,
.compare td:first-child {
  padding-left: 1rem;
}

.compare th:last-child,
.compare td:last-child {
  padding-right: 1rem;
}

.compare .num {
  text-align: right;
}

.compare tbody tr {
  cursor: pointer;
}

.compare tbody tr:hover,
.compare tbody tr.is-on {
  background: var(--panel-fill);
}

.compare tbody tr.is-pending td {
  opacity: 0.55;
}

.row-market {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border-radius: 6px;
  font-weight: 700;
}

.row-market :deep(.coin-mark) {
  width: 1.1rem;
  height: 1.1rem;
}

.muted {
  color: var(--panel-soft);
}

.market-tab:focus-visible,
.compare summary:focus-visible,
.row-market:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .skeleton,
  .spinner {
    animation: none;
  }

  .compare-chevron {
    transition: none;
  }
}
</style>
