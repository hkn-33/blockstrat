<script setup lang="ts">
import type { StrategyDraft, Trade } from '~/types/api'
import type TvChart from '~/components/TvChart.vue'
import type { MarketRun, MarketRuns } from '~/composables/useBacktest'
import type { BacktestPeriod } from '~/composables/useApi'
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
  period: BacktestPeriod
  strategy: StrategyDraft
}>()

const emit = defineEmits<{ 'retry': [], 'update:period': [period: BacktestPeriod] }>()

// Short names, as on trading charts, so they fit one line however narrow the column; the tooltip says it whole.
const PERIODS: { value: BacktestPeriod, label: string, name: string }[] = [
  { value: '3m', label: '3M', name: 'The last 3 months' },
  { value: '6m', label: '6M', name: 'The last 6 months' },
  { value: '1y', label: '1Y', name: 'The last year' },
  { value: '3y', label: '3Y', name: 'The last 3 years' },
  { value: 'all', label: 'All', name: 'The whole history, since 2017' },
]

/** How long the shown result covers, in months, for the per-month figure. */
const months = computed(() => (result.value ? Math.max((result.value.end_time - result.value.start_time) / (30.44 * 86_400), 0.5) : 0))

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

// Advanced mode adds the statistics a trader compares strategies by, each with a line on what it says.
const { isAdvanced } = useBuilderMode()

function ratio(value: number | null | undefined): string {
  return value === null || value === undefined ? '–' : value.toFixed(2)
}

function percent(value: number | null | undefined): string {
  return value === null || value === undefined ? '–' : formatSignedPercent(value)
}

function duration(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return '–'
  return hours < 48 ? `${Math.round(hours)} h` : `${(hours / 24).toFixed(1)} days`
}

const advancedStats = computed(() => {
  const metrics = result.value?.metrics
  if (!metrics) return []
  return [
    { label: 'A year, compounded', value: percent(metrics.annual_return_pct), help: 'The yearly return that grows to the total over the period' },
    { label: 'Sharpe ratio', value: ratio(metrics.sharpe_ratio), help: 'Return for each unit of swing; above 1 is good' },
    { label: 'Sortino ratio', value: ratio(metrics.sortino_ratio), help: 'Like Sharpe, counting only the downward swings' },
    { label: 'Calmar ratio', value: ratio(metrics.calmar_ratio), help: 'Yearly return against the deepest fall' },
    { label: 'Profit factor', value: ratio(metrics.profit_factor), help: 'What the winners made for each dollar the losers lost' },
    { label: 'Average trade', value: percent(metrics.avg_trade_pct), help: 'The mean result of one trade, after fees' },
    { label: 'Average hold', value: duration(metrics.avg_trade_hours), help: 'How long a trade stays open, on average' },
    { label: 'In the market', value: `${Math.round(metrics.exposure_time_pct)}%`, help: 'The share of the time a trade was open' },
    { label: 'Longest fall', value: duration(metrics.max_drawdown_days === null || metrics.max_drawdown_days === undefined ? null : metrics.max_drawdown_days * 24), help: 'The longest stretch below the last high' },
  ]
})
const error = computed(() => selected.value?.run.error ?? null)
const isSelectedLoading = computed(() => selected.value?.run.isLoading ?? false)
const coin = computed(() => selected.value?.coin ?? '')

const chartData = computed(() => (result.value ? chartDataFromResult(result.value) : null))
// Advanced draws the strategy's own indicators on its chart, when every candle is shown as it was tested:
// on merged candles an average would not be the one the rules read.
const indicatorLines = computed(() => {
  const shown = result.value
  if (!isAdvanced.value || !shown || shown.bars.length !== shown.bar_count) return []
  return strategyIndicatorLines(props.strategy, shown.bars)
})

const period = computed(() => {
  if (!result.value) return ''
  const format = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
  const span = `${format.format(new Date(result.value.start_time * 1000))} to ${format.format(new Date(result.value.end_time * 1000))}`
  const candles = `${span}, ${result.value.bar_count.toLocaleString('en-US')} candles`
  // A long history reaches the chart merged into fewer candles; the trades were tested on every one.
  const testedCandleSeconds = (result.value.end_time - result.value.start_time) / Math.max(result.value.bar_count - 1, 1)
  const chartCandleSeconds = (result.value.bars[1]?.time ?? 0) - (result.value.bars[0]?.time ?? 0)
  const merged = Math.round(chartCandleSeconds / testedCandleSeconds)
  return merged > 1 ? `${candles}, shown ${merged} to a chart candle` : candles
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
        <svg class="working-art" viewBox="0 0 320 150" fill="none" aria-hidden="true">
          <path d="M8 118 L 46 96 L 78 108 L 118 70 L 150 84 L 192 46 L 226 62 L 268 28 L 312 40" class="working-line working-line--holding" pathLength="1" />
          <path d="M8 124 L 46 112 L 78 112 L 118 86 L 150 86 L 192 58 L 226 58 L 268 34 L 312 22" class="working-line" pathLength="1" />
        </svg>
        <p class="state-title">
          Analysing the data
        </p>
        <p class="mt-1 text-[var(--panel-soft)]">
          Checking your rules on the whole history, with fees on every trade.
        </p>
      </div>

      <div v-else class="market-result">
        <div class="period-bar">
          <div class="periods" role="radiogroup" aria-label="How much of the history to test">
            <button v-for="option in PERIODS" :key="option.value" type="button" role="radio" :aria-checked="props.period === option.value" :class="{ 'is-on': props.period === option.value }" v-tip="option.name" @click="emit('update:period', option.value)">
              {{ option.label }}
            </button>
          </div>
          <span class="period-span">{{ period }}</span>
          <span class="ml-auto flex items-center gap-2">
            <span v-if="error" class="text-[var(--loss-ink)]">{{ error }}</span>
            <button type="button" class="action action--small" @click="chart?.showAll()">
              <UiIcon name="maximize-2" /> Show all
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
            :indicators="indicatorLines"
          />
          <StrategyTester :summary="selected!.summary!" :coin="coin" :months="months" :compact="!isAdvanced" />
          <section v-if="isAdvanced" class="advanced-stats" aria-label="Further statistics">
            <h3 class="advanced-title">
              <UiIcon name="graduation-cap" /> Further statistics
            </h3>
            <dl class="advanced-grid">
              <div v-for="stat in advancedStats" :key="stat.label" :title="stat.help">
                <dt>{{ stat.label }}</dt>
                <dd>{{ stat.value }}</dd>
                <p class="advanced-help">
                  {{ stat.help }}
                </p>
              </div>
            </dl>
          </section>
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
        <Transition name="analysing">
          <div v-if="isSelectedLoading" class="analysing" role="status">
            <p class="analysing-title">
              <span class="analysing-spinner" aria-hidden="true" /> Analysing the data
            </p>
            <p class="analysing-text">
              Replaying {{ result.bar_count.toLocaleString('en-US') }} candles with fees on every trade
            </p>
            <span class="analysing-track"><span class="analysing-fill" /></span>
          </div>
        </Transition>
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

/* While the first result is on its way two lines draw themselves over and over: the rules against holding. */
.working-art {
  width: 20rem;
  max-width: 100%;
  margin: 0 auto 1.25rem;
}

.working-line {
  stroke: var(--accent-ink);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 1;
  animation: draw-line 1.6s cubic-bezier(0.45, 0, 0.2, 1) infinite;
}

.working-line--holding {
  stroke: var(--panel-soft);
  stroke-width: 2;
  opacity: 0.5;
}

@keyframes draw-line {
  from {
    stroke-dashoffset: 1;
  }

  70%,
  to {
    stroke-dashoffset: 0;
  }
}

/* The periods share the whole width evenly. */
.periods {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 2px;
  border-radius: 9px;
  background: var(--panel-fill);
  padding: 2px;
}

.periods button {
  border-radius: 7px;
  padding: 0.2rem 0.55rem;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--panel-soft);
  transition: background-color 140ms, color 140ms;
}

.periods button.is-on {
  background: var(--panel);
  color: var(--panel-ink);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.15), inset 0 0 0 1px var(--panel-line);
}

.periods button:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.period-span {
  min-width: 0;
  flex: 1;
  font-size: 12px;
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

/* While a new result is on its way the old one greys out and blurs under the card that says so. */
.result-body {
  transition: opacity 200ms, filter 200ms;
}

.result-body.is-stale {
  opacity: 0.6;
  filter: grayscale(1) blur(3px);
  pointer-events: none;
}

.analysing {
  position: absolute;
  z-index: 4;
  top: 9rem;
  left: 50%;
  display: grid;
  width: min(18rem, calc(100% - 2rem));
  gap: 0.45rem;
  translate: -50% 0;
  border-radius: 16px;
  background: var(--panel);
  padding: 0.9rem 1rem;
  box-shadow: inset 0 0 0 1px var(--panel-line), 0 24px 48px -20px rgb(0 0 0 / 0.5);
}

.analysing-enter-active,
.analysing-leave-active {
  transition: opacity 180ms, translate 180ms;
}

.analysing-enter-from,
.analysing-leave-to {
  opacity: 0;
  translate: -50% 6px;
}

.analysing-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 14px;
  font-weight: 700;
}

.analysing-spinner {
  width: 0.95rem;
  height: 0.95rem;
  border: 2px solid var(--panel-line);
  border-top-color: var(--color-lime);
  border-radius: 999px;
  animation: analysing-spin 700ms linear infinite;
}

@keyframes analysing-spin {
  to {
    rotate: 1turn;
  }
}

.analysing-text {
  font-size: 12.5px;
  color: var(--panel-soft);
  font-variant-numeric: tabular-nums;
}

.analysing-track {
  position: relative;
  overflow: hidden;
  height: 4px;
  border-radius: 999px;
  background: var(--panel-fill);
}

.analysing-fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: 40%;
  border-radius: inherit;
  background: var(--color-lime);
  animation: analysing-sweep 1.1s ease-in-out infinite;
}

@keyframes analysing-sweep {
  from {
    translate: -100% 0;
  }

  to {
    translate: 250% 0;
  }
}

.advanced-stats {
  border-top: 1px solid var(--panel-line);
  padding: 0.9rem 1rem;
}

.advanced-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 13px;
  font-weight: 700;
  color: var(--accent-ink);
}

.advanced-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
  gap: 0.75rem 1rem;
  margin-top: 0.7rem;
}

.advanced-grid dt {
  font-size: 12px;
  color: var(--panel-soft);
}

.advanced-grid dd {
  margin-top: 0.1rem;
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.advanced-help {
  margin-top: 0.15rem;
  font-size: 11.5px;
  line-height: 1.3;
  color: var(--panel-soft);
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
  .working-line,
  .analysing-spinner,
  .analysing-fill,
  .spinner {
    animation: none;
  }

  .compare-chevron {
    transition: none;
  }
}
</style>
