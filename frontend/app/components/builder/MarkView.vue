<script setup lang="ts">
import {
  CandlestickSeries,
  CrosshairMode,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type Logical,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { Bar, InstrumentInfo, Proposal, StrategyDraft } from '~/types/api'
import type { MarketRuns } from '~/composables/useBacktest'
import type { DrawnTrade, TradeOutcome } from '~/utils/drawnTrades'
import type { Direction, Timeframe } from '~/utils/strategyDocument'

// The builder's other way in, for someone who knows a good trade when they see one but not the rule behind
// it. They draw trades on past candles the way TradingView's long and short position tools work: pick the
// tool, click where the trade gets in (at any price), click again where it should take its profit; the box
// shows green to the take-profit, red to the stop-loss, as wide as the trade may last, and how it would have
// ended. From the boxes BlockStrat proposes strategies whose signals land on them, each with how well it fits
// and how it did on the whole history, so a rule that only fits the drawing is easy to spot. The strategy
// being built shows its own trades on the same candles as arrows, so the drawing and the rules can be compared.
const props = defineProps<{ instruments: InstrumentInfo[], instrument: string | null, timeframe: Timeframe | null, runs: MarketRuns }>()
const emit = defineEmits<{ build: [strategy: StrategyDraft, name: string] }>()

const MINIMUM_TRADES = 2
const READABLE_BAR_WIDTH = 9
const PACES: { value: Timeframe, label: string }[] = [
  { value: '1h', label: '1 hour' },
  { value: '4h', label: '4 hours' },
  { value: '1d', label: '1 day' },
]
const TOOLS: { value: Direction, label: string, icon: string }[] = [
  { value: 'long', label: 'Long position', icon: 'trending-up' },
  { value: 'short', label: 'Short position', icon: 'trending-down' },
]

const api = useApi()
const market = ref(props.instrument ?? 'BTCUSDT')
const pace = ref<Timeframe>(props.timeframe ?? '4h')
const tool = ref<Direction>('long')
const bars = ref<Bar[]>([])
const trades = ref<DrawnTrade[]>([])
// A trade between its first click and its second: it follows the pointer until it is placed.
const placing = ref<DrawnTrade | null>(null)
const proposals = ref<Proposal[]>([])
const shownIndex = ref(0)
const isLoadingBars = ref(false)
const isSearching = ref(false)
const failure = ref<string | null>(null)
let nextTradeId = 1
// The market and candle size the candles and drawn trades on screen belong to; set once the candles are in,
// so trades are never saved under a chart that has not loaded.
const chartKey = ref('')

// The strategy's trades on this chart: only when it checks its rules at the candle size shown.
const strategyTrades = computed(() => (props.timeframe === pace.value ? props.runs[market.value]?.result?.trades ?? [] : []))
const isShowingStrategy = ref(true)
// The user's own boxes can be hidden too, to read the candles or the strategy's trades alone.
const isShowingDrawn = ref(true)

// The reward to risk a new trade starts with: the stop-loss is the take-profit divided by it. Remembered.
const REWARD_TO_RISK_CHOICES = [1, 1.5, 2, 3, 4]
const rewardToRisk = ref(2)
const ratioButton = ref<HTMLButtonElement | null>(null)
const isPickingRatio = ref(false)

function setRewardToRisk(value: number): void {
  rewardToRisk.value = value
  saveRewardToRisk(value)
  isPickingRatio.value = false
}

const marketButton = ref<HTMLButtonElement | null>(null)
const isPickingMarket = ref(false)
const marketLabel = computed(() => props.instruments.find(instrument => instrument.symbol === market.value)?.label ?? market.value)

type ProposalOrder = 'profit' | 'fit' | 'safest' | 'riskiest'
const ORDERS: { value: ProposalOrder, label: string }[] = [
  { value: 'profit', label: 'Most profit' },
  { value: 'fit', label: 'Best fit' },
  { value: 'safest', label: 'Lowest risk' },
  { value: 'riskiest', label: 'Highest risk' },
]
const order = ref<ProposalOrder>('profit')

function fitShare(proposal: Proposal): number {
  return proposal.entries_hit / Math.max(proposal.entries_marked, 1)
}

// Risk is the deepest fall from a high on the way: the closer to zero, the calmer the ride.
const sortedProposals = computed(() => {
  const byOrder: Record<ProposalOrder, (proposal: Proposal) => number> = {
    profit: proposal => proposal.total_return_pct,
    fit: proposal => fitShare(proposal),
    safest: proposal => proposal.max_drawdown_pct,
    riskiest: proposal => -proposal.max_drawdown_pct,
  }
  return [...proposals.value].sort((first, second) => byOrder[order.value](second) - byOrder[order.value](first))
})

const shown = computed(() => proposals.value[shownIndex.value])
const searchable = computed(() => (['long', 'short'] as const).filter(direction => trades.value.filter(trade => trade.direction === direction).length >= MINIMUM_TRADES))
const canSearch = computed(() => searchable.value.length > 0 && !isSearching.value)
const stillNeeded = computed(() => {
  if (searchable.value.length) return ''
  const count = trades.value.filter(trade => trade.direction === tool.value).length
  const missing = MINIMUM_TRADES - count
  return `Draw ${missing} more ${tool.value} ${missing === 1 ? 'trade' : 'trades'} to search`
})
const hint = computed(() => {
  if (placing.value) return 'Click again where it should take its profit. Esc cancels.'
  return `Click where the ${tool.value} trade gets in`
})

// ---------- Chart ----------
const area = ref<HTMLDivElement | null>(null)
const proposalList = ref<HTMLElement | null>(null)
// The found strategies sit under the chart; while they are out of sight a button over the chart says so.
const areProposalsInView = ref(false)
let proposalWatcher: IntersectionObserver | undefined

watch(proposalList, (list) => {
  proposalWatcher?.disconnect()
  if (!list) return
  proposalWatcher = new IntersectionObserver(([entry]) => {
    areProposalsInView.value = Boolean(entry?.isIntersecting)
  }, { threshold: 0.05 })
  proposalWatcher.observe(list)
})

function showProposals(): void {
  proposalList.value?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
}
const container = ref<HTMLDivElement | null>(null)
const resolvedTheme = useResolvedChartTheme(() => 'auto')
const plot = ref({ width: 0, height: 0 })
// Bumped whenever the view moves or scales, so the boxes are placed again over their candles.
const viewVersion = ref(0)
let chart: IChartApi | undefined
let candles: ISeriesApi<'Candlestick'> | undefined
let markers: ISeriesMarkersPluginApi<Time> | undefined
let resizeObserver: ResizeObserver | undefined

function formatPrice(value: number): string {
  if (value >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (value >= 1) return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return value.toLocaleString('en-US', { maximumFractionDigits: 5 })
}

// The boxes are placed again only when the view really moved or rescaled: the crosshair alone moves on
// every mouse move, and re-placing every box on each of those made the chart stutter.
let lastViewKey = ''

// Dragged back into the past, the chart offers the way back to now.
const isAwayFromLatest = ref(false)

function refreshView(): void {
  if (!chart || !candles) return
  const range = chart.timeScale().getVisibleLogicalRange()
  isAwayFromLatest.value = Boolean(range && range.to < bars.value.length - 1.5)
  const width = Math.max(0, (container.value?.clientWidth ?? 0) - chart.priceScale('right').width())
  const height = Math.max(0, (container.value?.clientHeight ?? 0) - chart.timeScale().height())
  const anchorPrice = bars.value[0]?.close ?? 0
  const viewKey = `${width}x${height}:${chart.timeScale().logicalToCoordinate(0 as Logical)}:${chart.timeScale().logicalToCoordinate(100 as Logical)}:${candles.priceToCoordinate(anchorPrice)}:${candles.priceToCoordinate(anchorPrice * 1.1)}`
  if (viewKey === lastViewKey) return
  lastViewKey = viewKey
  if (width !== plot.value.width || height !== plot.value.height) plot.value = { width, height }
  viewVersion.value++
}

function applyColours(): void {
  if (!chart || !candles) return
  const colours = chartPalette(resolvedTheme.value)
  chart.applyOptions({ layout: { textColor: colours.text }, grid: { vertLines: { color: colours.grid }, horzLines: { color: colours.grid } } })
  candles.applyOptions({ upColor: colours.up, downColor: colours.down, wickUpColor: colours.up, wickDownColor: colours.down })
}

// The prices are fitted once to the candles in view and then left alone, as in TradingView: the chart can
// be dragged freely in every direction without jumping back. "Fit" fits them again.
function fitPrices(): void {
  const scale = chart?.priceScale('right')
  if (!scale) return
  scale.applyOptions({ autoScale: true })
  // The view may have closed by the next frame, taking the chart with it.
  requestAnimationFrame(() => {
    if (chart) scale.applyOptions({ autoScale: false })
  })
}

function showLatest(): void {
  const visible = Math.max(40, Math.floor((container.value?.clientWidth ?? 800) / READABLE_BAR_WIDTH))
  chart?.timeScale().setVisibleLogicalRange({ from: bars.value.length - visible, to: bars.value.length + 6 })
  fitPrices()
}

// The strategy's trades are arrows, as on the result chart; the shown proposal's signals are small dots, so the
// eye compares both with the boxes directly. A candle carries at most one marker of each kind.
function drawMarkers(): void {
  if (!markers) return
  const colours = chartPalette(resolvedTheme.value)
  const onChart = new Set(bars.value.map(bar => bar.time))
  const arrows = new Map<string, SeriesMarker<Time>>()
  for (const trade of isShowingStrategy.value ? strategyTrades.value : []) {
    const isShort = trade.direction === 'short'
    if (onChart.has(trade.entry_time)) {
      arrows.set(`in:${trade.entry_time}`, { time: trade.entry_time as UTCTimestamp, position: isShort ? 'aboveBar' : 'belowBar', shape: isShort ? 'arrowDown' : 'arrowUp', color: colours.accent, size: 0.9 })
    }
    if (onChart.has(trade.exit_time)) {
      arrows.set(`out:${trade.exit_time}`, { time: trade.exit_time as UTCTimestamp, position: isShort ? 'belowBar' : 'aboveBar', shape: isShort ? 'arrowUp' : 'arrowDown', color: trade.return_pct >= 0 ? colours.up : colours.down, size: 0.9 })
    }
  }
  const isShort = shown.value?.strategy.sides[0]?.direction === 'short'
  const dot = (time: number, isEntry: boolean): SeriesMarker<Time> => ({
    time: time as UTCTimestamp,
    position: isEntry !== isShort ? 'belowBar' : 'aboveBar',
    shape: 'circle',
    color: isEntry ? colours.up : colours.down,
    size: 0.7,
  })
  const signals = shown.value ? [...shown.value.entry_times.map(time => dot(time, true)), ...shown.value.exit_times.map(time => dot(time, false))] : []
  markers.setMarkers([...arrows.values(), ...signals].sort((first, second) => Number(first.time) - Number(second.time)))
}

function pointerAt(event: MouseEventParams<Time>): { index: number, price: number } | null {
  if (!event.point || event.logical === undefined || event.logical === null || !candles) return null
  const price = candles.coordinateToPrice(event.point.y)
  if (price === null) return null
  return { index: Math.min(Math.max(Math.round(event.logical), 0), bars.value.length - 1), price }
}

// First click: the entry, at the price clicked. Second click: the take-profit and the box's right edge.
function onChartClick(event: MouseEventParams<Time>): void {
  const pointer = pointerAt(event)
  if (!pointer) return
  if (placing.value) {
    const placed = { ...placing.value, ...sizeFromPointer(placing.value, pointer.index, pointer.price, rewardToRisk.value) }
    placed.endIndex = Math.min(placed.endIndex, bars.value.length - 1)
    trades.value = [...trades.value, placed]
    placing.value = null
    return
  }
  if (pointer.index >= bars.value.length - 1) return
  placing.value = newDrawnTrade(nextTradeId++, tool.value, pointer.index, pointer.price, bars.value.length, pace.value)
  activeId.value = placing.value.id
}

function onCrosshairMove(event: MouseEventParams<Time>): void {
  const pointer = pointerAt(event)
  if (placing.value && pointer && pointer.index > placing.value.entryIndex) {
    placing.value = { ...placing.value, ...sizeFromPointer(placing.value, pointer.index, pointer.price, rewardToRisk.value) }
  }
  // Dragging the price axis rescales without moving time; the crosshair follows the pointer through it.
  refreshView()
}

let followFrame = 0
let isPointerDown = false

function followView(): void {
  isPointerDown = true
  cancelAnimationFrame(followFrame)
  const step = (): void => {
    refreshView()
    if (isPointerDown) followFrame = requestAnimationFrame(step)
  }
  followFrame = requestAnimationFrame(step)
}

function stopFollowing(): void {
  isPointerDown = false
}

function cancelPlacing(event: KeyboardEvent): void {
  if (event.key === 'Escape') placing.value = null
}

// ---------- Boxes ----------
interface Box {
  trade: DrawnTrade
  outcome: TradeOutcome
  isPlacing: boolean
  left: number
  width: number
  targetY: number
  entryY: number
  stopY: number
  exitX: number
  exitY: number
  targetText: string
  stopText: string
  outcomeText: string
  detailText: string
}

function outcomeText(outcome: TradeOutcome): string {
  if (outcome.reason === 'target') return `Take-profit hit: ${formatSignedPercent(outcome.returnPct)}`
  if (outcome.reason === 'stop') return `Stop-loss hit: ${formatSignedPercent(outcome.returnPct)}`
  return `Closed at the end: ${formatSignedPercent(outcome.returnPct)}`
}

function detailText(outcome: TradeOutcome, trade: DrawnTrade): string {
  const candlesHeld = outcome.exitIndex - trade.entryIndex
  return `${trade.direction === 'long' ? 'Long' : 'Short'} · after ${candlesHeld} ${candlesHeld === 1 ? 'candle' : 'candles'} · reward to risk ${(trade.takeProfitPct / trade.stopLossPct).toFixed(1)} : 1`
}

// Only the trade being worked on shows every label and handle; the others shrink to their result, so several
// trades side by side stay readable. The active one is drawn last, on top of the rest.
const activeId = ref<number | null>(null)

function boxOf(trade: DrawnTrade, isPlacing: boolean): Box | null {
  const timeScale = chart!.timeScale()
  const levels = tradeLevels(trade)
  const outcome = tradeOutcome(bars.value, trade)
  const left = timeScale.logicalToCoordinate(trade.entryIndex as Logical)
  const right = timeScale.logicalToCoordinate(trade.endIndex as Logical)
  const exitX = timeScale.logicalToCoordinate(outcome.exitIndex as Logical)
  const targetY = candles!.priceToCoordinate(levels.target)
  const entryY = candles!.priceToCoordinate(levels.entry)
  const stopY = candles!.priceToCoordinate(levels.stop)
  if (left === null || right === null || exitX === null || targetY === null || entryY === null || stopY === null) return null
  const exitPrice = outcome.reason === 'target' ? levels.target : outcome.reason === 'stop' ? levels.stop : bars.value[outcome.exitIndex]!.close
  return {
    trade,
    outcome,
    isPlacing,
    left,
    width: Math.max(right - left, 8),
    targetY,
    entryY,
    stopY,
    exitX,
    exitY: candles!.priceToCoordinate(exitPrice) ?? entryY,
    targetText: `Take-profit ${formatSignedPercent(trade.takeProfitPct)} at ${formatPrice(levels.target)}`,
    stopText: `Stop-loss ${formatSignedPercent(-trade.stopLossPct)} at ${formatPrice(levels.stop)}`,
    outcomeText: outcomeText(outcome),
    detailText: detailText(outcome, trade),
  }
}

interface StrategyPath {
  key: number
  x1: number
  y1: number
  x2: number
  y2: number
  isWin: boolean
  text: string
}

// The strategy's trades as they really filled: a line from the open it bought at to the price it sold at, so
// a trade that got in high and out a little higher reads as the small gain it was.
// Built once per set of candles, not on every move of the view.
const barIndexByTime = computed(() => new Map(bars.value.map((bar, index) => [bar.time, index])))

const strategyPaths = computed<StrategyPath[]>(() => {
  void viewVersion.value
  if (!chart || !candles || !isShowingStrategy.value || !strategyTrades.value.length) return []
  const timeScale = chart.timeScale()
  const indexByTime = barIndexByTime.value
  return strategyTrades.value.flatMap((trade) => {
    const entryIndex = indexByTime.get(trade.entry_time)
    const exitIndex = indexByTime.get(trade.exit_time)
    if (entryIndex === undefined || exitIndex === undefined) return []
    const x1 = timeScale.logicalToCoordinate(entryIndex as Logical)
    const x2 = timeScale.logicalToCoordinate(exitIndex as Logical)
    const y1 = candles!.priceToCoordinate(trade.entry_price)
    const y2 = candles!.priceToCoordinate(trade.exit_price)
    if (x1 === null || x2 === null || y1 === null || y2 === null) return []
    return [{ key: trade.entry_time, x1, y1, x2, y2, isWin: trade.return_pct >= 0, text: formatSignedPercent(trade.return_pct) }]
  })
})

const boxes = computed<Box[]>(() => {
  void viewVersion.value
  if (!chart || !candles || !bars.value.length) return []
  const drawn = trades.value.flatMap(trade => boxOf(trade, false) ?? [])
  const inProgress = placing.value ? boxOf(placing.value, true) : null
  const ordered = drawn.sort((first, second) => Number(first.trade.id === activeId.value) - Number(second.trade.id === activeId.value))
  return inProgress ? [...ordered, inProgress] : ordered
})

type DragPart = 'target' | 'stop' | 'start' | 'end' | 'move'

function replaceTrade(changed: DrawnTrade): void {
  trades.value = trades.value.map(trade => (trade.id === changed.id ? changed : trade))
}

function removeTrade(id: number): void {
  trades.value = trades.value.filter(trade => trade.id !== id)
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10
}

/** The distance from the entry to a price, in percent, on the side a level belongs on (0.1% at least). */
function distancePct(trade: DrawnTrade, price: number, isTarget: boolean): number {
  const above = (price / trade.entryPrice - 1) * 100
  const winsUpward = trade.direction === 'long'
  const signed = isTarget === winsUpward ? above : -above
  return roundToTenth(Math.min(Math.max(signed, 0.1), isTarget ? 500 : 95))
}

/** One handler for every edge and handle: the top and bottom follow the pointer's price, the sides its
 * candle, and the whole box moves freely, in time and in price. */
function startDrag(original: DrawnTrade, part: DragPart, event: PointerEvent): void {
  if (!chart || !candles || !area.value) return
  activeId.value = original.id
  const box = area.value.getBoundingClientRect()
  const timeScale = chart.timeScale()
  const startLogical = timeScale.coordinateToLogical(event.clientX - box.left) ?? original.entryIndex
  const startPrice = candles.coordinateToPrice(event.clientY - box.top) ?? original.entryPrice
  const lastIndex = bars.value.length - 1

  const onMove = (move: PointerEvent): void => {
    const price = candles!.coordinateToPrice(move.clientY - box.top)
    const logical = timeScale.coordinateToLogical(move.clientX - box.left)
    if (price === null || logical === null) return
    if (part === 'target') replaceTrade({ ...original, takeProfitPct: distancePct(original, price, true) })
    if (part === 'stop') replaceTrade({ ...original, stopLossPct: distancePct(original, price, false) })
    if (part === 'start') {
      replaceTrade({ ...original, entryIndex: Math.min(Math.max(Math.round(logical), 0), original.endIndex - 1) })
    }
    if (part === 'end') {
      replaceTrade({ ...original, endIndex: Math.min(Math.max(Math.round(logical), original.entryIndex + 1), lastIndex) })
    }
    if (part === 'move') {
      const entryIndex = Math.min(Math.max(original.entryIndex + Math.round(logical - startLogical), 0), lastIndex - 1)
      const width = original.endIndex - original.entryIndex
      replaceTrade({ ...original, entryIndex, endIndex: Math.min(entryIndex + width, lastIndex), entryPrice: original.entryPrice + (price - startPrice) })
    }
  }
  // The pointer is followed on the whole window: a quick drag leaves the small handle at once.
  const onEnd = (): void => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onEnd)
    window.removeEventListener('pointercancel', onEnd)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onEnd)
  window.addEventListener('pointercancel', onEnd)
}

// ---------- Data ----------
function clearTrades(): void {
  trades.value = []
  placing.value = null
  proposals.value = []
}

async function loadBars(): Promise<void> {
  isLoadingBars.value = true
  failure.value = null
  placing.value = null
  proposals.value = []
  const key = `${market.value}:${pace.value}`
  try {
    bars.value = (await api.bars(market.value, pace.value)).bars
    candles?.setData(bars.value.map(bar => ({ ...bar, time: bar.time as UTCTimestamp })))
    chartKey.value = key
    trades.value = restoredTrades(bars.value, loadDrawnTrades(key))
    nextTradeId = trades.value.length + 1
    proposals.value = loadFoundStrategies(key)
    shownIndex.value = 0
    showLatest()
    drawMarkers()
  }
  catch (error) {
    failure.value = describeApiError(error)
  }
  finally {
    isLoadingBars.value = false
  }
}

// One search per direction that has enough trades; long and short proposals come back side by side.
// ---------- Search progress ----------
// The search runs as one request, so its progress is told, not measured: the bar moves through the stages
// the backend goes through at the pace it usually takes, holds short of the end, and fills once the
// proposals are in.
const SEARCH_STAGES = [
  'Reading the candles',
  'Trying every entry idea on your trades',
  'Pairing the best ideas two at a time',
  'Narrowing them with trend, momentum and volume',
  'Testing four ways out for each',
  'Replaying the best on the whole history',
  'Ranking by profit and fit',
]
const COMBINING_STAGE = 'Putting the best long and short together'
// With both ways drawn, the search also tries the best long and short sides as one strategy.
const stages = computed(() => (searchable.value.length > 1 ? [...SEARCH_STAGES.slice(0, -1), COMBINING_STAGE, SEARCH_STAGES.at(-1)!] : SEARCH_STAGES))
const USUAL_SEARCH_MS = 5000
const RULES_TRIED_PER_DIRECTION = 160
const searchProgress = ref(0)
const stageIndex = computed(() => Math.min(Math.floor(searchProgress.value * stages.value.length), stages.value.length - 1))
const rulesTried = computed(() => Math.round(searchProgress.value * RULES_TRIED_PER_DIRECTION * Math.max(searchable.value.length, 1)))
let progressFrame = 0

function runProgress(): void {
  const startedAt = performance.now()
  const step = (now: number): void => {
    // Eases towards 92% and waits there for the answer.
    searchProgress.value = 0.92 * (1 - Math.exp(-(now - startedAt) / (USUAL_SEARCH_MS / 2.5)))
    progressFrame = requestAnimationFrame(step)
  }
  progressFrame = requestAnimationFrame(step)
}

async function finishProgress(): Promise<void> {
  cancelAnimationFrame(progressFrame)
  searchProgress.value = 1
  await new Promise(resolve => setTimeout(resolve, 350))
}

async function search(): Promise<void> {
  isSearching.value = true
  failure.value = null
  searchProgress.value = 0
  runProgress()
  try {
    const found = await Promise.all(searchable.value.map(direction =>
      api.suggestStrategies({ instrument: market.value, timeframe: pace.value, ...tradesToRequest(bars.value, trades.value, direction) })))
    const separate = found.flatMap(response => response.proposals)
    const combined = await combinedProposals(separate)
    await finishProgress()
    proposals.value = [...combined, ...separate]
    shownIndex.value = 0
    await nextTick()
    showProposals()
  }
  catch (error) {
    failure.value = describeApiError(error)
  }
  finally {
    cancelAnimationFrame(progressFrame)
    isSearching.value = false
  }
}

// The long that made most is put with the short that made most, and the best fitting with the best fitting:
// one strategy that trades both ways, tested as one, since it holds one position at a time.
async function combinedProposals(found: Proposal[]): Promise<Proposal[]> {
  const longs = found.filter(proposal => directionOf(proposal) === 'long')
  const shorts = found.filter(proposal => directionOf(proposal) === 'short')
  if (!longs.length || !shorts.length) return []
  const best = (list: Proposal[], score: (proposal: Proposal) => number): Proposal => [...list].sort((first, second) => score(second) - score(first))[0]!
  const pairs = [
    [best(longs, proposal => proposal.total_return_pct), best(shorts, proposal => proposal.total_return_pct)],
    [best(longs, fitShare), best(shorts, fitShare)],
  ] as const
  const distinct = pairs.filter((pair, index) => index === 0 || pair[0] !== pairs[0][0] || pair[1] !== pairs[0][1])
  const chartTimes = new Set(bars.value.map(bar => bar.time))
  const tested = await Promise.all(distinct.map(async ([long, short]) => {
    const response = await api.backtest(bothWays(long, short), 'full', 'all')
    return response.status === 'ok' ? [combinedProposal(long, short, response.result, chartTimes)] : []
  }))
  return tested.flat()
}

function directionOf(proposal: Proposal): Direction | 'both' {
  if (proposal.strategy.sides.length > 1) return 'both'
  return proposal.strategy.sides[0]?.direction ?? 'long'
}

const DIRECTION_LABELS: Record<Direction | 'both', string> = { long: 'Long', short: 'Short', both: 'Long + Short' }

function matchText(proposal: Proposal): string {
  const extras = proposal.extra_entries + proposal.extra_exits
  const fit = `Gets in on ${proposal.entries_hit} of your ${proposal.entries_marked} entries and out on ${proposal.exits_hit} of your ${proposal.exits_marked} exits`
  return extras ? `${fit}, with ${extras} more ${extras === 1 ? 'signal' : 'signals'} in between` : fit
}

// A rule can fit every box and still lose money; that is said in words, not left to the numbers.
function caution(proposal: Proposal): string | null {
  return proposal.total_return_pct < 0 ? 'It fits your trades, but on the whole history it lost money.' : null
}

onMounted(() => {
  const base = baseChartOptions()
  chart = createChart(container.value!, {
    ...base,
    crosshair: { ...base.crosshair, mode: CrosshairMode.Normal },
    timeScale: { ...base.timeScale, rightOffset: 6, timeVisible: true },
    localization: { ...base.localization, priceFormatter: formatPrice },
    handleScroll: true,
    handleScale: true,
  })
  candles = chart.addSeries(CandlestickSeries, { borderVisible: false, priceLineVisible: false })
  markers = createSeriesMarkers(candles, [])
  applyColours()
  chart.subscribeClick(onChartClick)
  chart.timeScale().subscribeVisibleLogicalRangeChange(refreshView)
  chart.subscribeCrosshairMove(onCrosshairMove)
  let hadWidth = false
  resizeObserver = new ResizeObserver(() => {
    const hasWidth = (container.value?.clientWidth ?? 0) > 0
    if (hasWidth && !hadWidth && bars.value.length) showLatest()
    hadWidth = hasWidth
    refreshView()
  })
  resizeObserver.observe(container.value!)
  window.addEventListener('keydown', cancelPlacing)
  window.addEventListener('pointerup', stopFollowing)
  rewardToRisk.value = loadRewardToRisk()
  loadBars()
})

watch([market, pace], loadBars)
watch(tool, () => {
  placing.value = null
})
watch([shown, resolvedTheme, strategyTrades, isShowingStrategy], drawMarkers)
watch(resolvedTheme, applyColours)
watch(trades, () => {
  lastViewKey = ''
  refreshView()
  if (chartKey.value) saveDrawnTrades(chartKey.value, savedTrades(bars.value, trades.value))
})
watch(proposals, () => {
  if (chartKey.value) saveFoundStrategies(chartKey.value, proposals.value)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', cancelPlacing)
  window.removeEventListener('pointerup', stopFollowing)
  cancelAnimationFrame(followFrame)
  proposalWatcher?.disconnect()
  resizeObserver?.disconnect()
  chart?.remove()
  chart = undefined
})
</script>

<template>
  <div class="mark-view">
    <header class="mark-head">
      <div class="min-w-0">
        <h2 class="mark-title">
          Mark your trades
        </h2>
        <p class="mark-text">
          Click an entry, then a target. BlockStrat finds rules that would have taken the same trades.
        </p>
      </div>
      <div class="mark-controls">
        <button ref="marketButton" type="button" class="market" :aria-expanded="isPickingMarket" aria-haspopup="dialog" @click="isPickingMarket = !isPickingMarket">
          <span class="sr-only">Market:</span>
          <CoinMark :symbol="market" /> {{ marketLabel }}
          <UiIcon name="chevron-down" class="market-chevron" :class="{ 'is-open': isPickingMarket }" />
        </button>
        <BuilderPopover v-if="isPickingMarket" :anchor="marketButton" label="Market" @close="isPickingMarket = false">
          <BuilderMarketList :instruments="instruments" :chosen="[market]" @pick="market = $event; isPickingMarket = false" />
        </BuilderPopover>
        <div class="segmented" role="radiogroup" aria-label="Candle size">
          <button v-for="option in PACES" :key="option.value" type="button" role="radio" :aria-checked="pace === option.value" :class="{ 'is-on': pace === option.value }" @click="pace = option.value">
            {{ option.label }}
          </button>
        </div>
      </div>
    </header>

    <div class="mark-bar">
      <span class="trade-count"><b>{{ trades.length }}</b> {{ trades.length === 1 ? 'trade' : 'trades' }} drawn</span>
      <span v-if="shown" class="chart-key">
        <span class="key-dot" /> <span class="truncate">Dots: where "{{ shown.name }}" gets in and out</span>
      </span>
      <span class="mark-need" role="status">{{ stillNeeded }}</span>
      <button type="button" class="find" :class="{ 'is-searching': isSearching }" :disabled="!canSearch" :aria-busy="isSearching" @click="search">
        <span v-if="isSearching" class="find-spinner" aria-hidden="true" />
        <UiIcon v-else name="wand-sparkles" />
        {{ isSearching ? 'Searching' : 'Find matching strategies' }}
      </button>
    </div>

    <div class="chart-box" :class="{ 'is-busy': isLoadingBars, 'is-searching': isSearching }" :aria-busy="isLoadingBars || isSearching">
      <div class="rail" role="toolbar" aria-label="Drawing tools" aria-orientation="vertical">
        <button v-for="option in TOOLS" :key="option.value" type="button" class="tool" :class="[`tool--${option.value}`, { 'is-on': tool === option.value }]" :aria-pressed="tool === option.value" v-tip="option.label" @click="tool = option.value">
          <UiIcon :name="option.icon" />
        </button>
        <span class="rail-split" />
        <button type="button" class="tool" v-tip="'Fit the prices to the candles in view'" @click="fitPrices">
          <UiIcon name="maximize-2" />
        </button>
        <button v-if="strategyTrades.length" type="button" class="tool" :aria-pressed="isShowingStrategy" v-tip="isShowingStrategy ? 'Hide your strategy\'s trades' : 'Show your strategy\'s trades'" @click="isShowingStrategy = !isShowingStrategy">
          <UiIcon :name="isShowingStrategy ? 'eye' : 'eye-off'" />
        </button>
        <button v-if="trades.length" type="button" class="tool" :aria-pressed="isShowingDrawn" v-tip="isShowingDrawn ? 'Hide your trades' : 'Show your trades'" @click="isShowingDrawn = !isShowingDrawn">
          <UiIcon :name="isShowingDrawn ? 'square-dashed' : 'eye-off'" />
        </button>
        <button ref="ratioButton" type="button" class="tool tool--ratio" :aria-expanded="isPickingRatio" v-tip="`New trades aim for ${rewardToRisk} : 1`" @click="isPickingRatio = !isPickingRatio">
          {{ rewardToRisk }}:1
        </button>
        <BuilderPopover v-if="isPickingRatio" :anchor="ratioButton" label="Reward to risk" @close="isPickingRatio = false">
          <p class="ratio-title">
            Reward to risk for new trades
          </p>
          <p class="ratio-help">
            The stop-loss is the take-profit divided by it.
          </p>
          <div class="ratio-choices" role="radiogroup" aria-label="Reward to risk">
            <button v-for="choice in REWARD_TO_RISK_CHOICES" :key="choice" type="button" role="radio" :aria-checked="rewardToRisk === choice" :class="{ 'is-on': rewardToRisk === choice }" @click="setRewardToRisk(choice)">
              {{ choice }} : 1
            </button>
          </div>
        </BuilderPopover>
        <button v-if="trades.length" type="button" class="tool tool--danger" v-tip="'Remove every drawn trade'" @click="clearTrades">
          <UiIcon name="trash-2" />
        </button>
      </div>
      <div ref="area" class="chart-area" @pointerdown="followView" @wheel.passive="followView">
        <div ref="container" class="chart" />
        <Transition name="below">
          <button v-if="proposals.length && !areProposalsInView && !isSearching" type="button" class="below" @click="showProposals">
            <UiIcon name="arrow-down" /> {{ proposals.length }} matching {{ proposals.length === 1 ? 'strategy' : 'strategies' }} below
          </button>
        </Transition>
        <ChartLatest :visible="isAwayFromLatest && !isSearching" :style="{ right: '4.5rem', bottom: '2.6rem' }" @click="showLatest" />
        <div v-if="strategyPaths.length" class="strategy-trades" :style="{ width: `${plot.width}px`, height: `${plot.height}px` }" aria-hidden="true">
          <svg :width="plot.width" :height="plot.height">
            <g v-for="path in strategyPaths" :key="path.key" :class="path.isWin ? 'is-win' : 'is-loss'">
              <line :x1="path.x1" :y1="path.y1" :x2="path.x2" :y2="path.y2" />
              <circle :cx="path.x1" :cy="path.y1" r="3.5" class="path-entry" />
              <circle :cx="path.x2" :cy="path.y2" r="3.5" />
            </g>
          </svg>
          <span v-for="path in strategyPaths" :key="path.key" class="path-chip" :class="path.isWin ? 'is-win' : 'is-loss'" :style="{ left: `${path.x2}px`, top: `${path.y2}px` }">{{ path.text }}</span>
        </div>
        <div v-show="isShowingDrawn" class="boxes" :style="{ width: `${plot.width}px`, height: `${plot.height}px` }">
          <div v-for="box in boxes" :key="box.trade.id" class="trade" :class="{ 'is-active': box.trade.id === activeId, 'is-placing': box.isPlacing }" @pointerenter="activeId = box.trade.id">
            <div class="zone zone--target" :style="{ left: `${box.left}px`, top: `${Math.min(box.targetY, box.entryY)}px`, width: `${box.width}px`, height: `${Math.abs(box.entryY - box.targetY)}px` }" @pointerdown.prevent="startDrag(box.trade, 'move', $event)" />
            <div class="zone zone--stop" :style="{ left: `${box.left}px`, top: `${Math.min(box.stopY, box.entryY)}px`, width: `${box.width}px`, height: `${Math.abs(box.stopY - box.entryY)}px` }" @pointerdown.prevent="startDrag(box.trade, 'move', $event)" />
            <div class="entry-line" :style="{ left: `${box.left}px`, top: `${box.entryY}px`, width: `${box.width}px` }" />
            <svg class="path" :style="{ left: `${box.left}px`, top: `${Math.min(box.entryY, box.exitY) - 2}px`, width: `${Math.max(box.exitX - box.left, 1)}px`, height: `${Math.abs(box.exitY - box.entryY) + 4}px` }" aria-hidden="true">
              <line x1="0" :y1="box.entryY <= box.exitY ? 2 : Math.abs(box.exitY - box.entryY) + 2" :x2="Math.max(box.exitX - box.left, 1)" :y2="box.entryY <= box.exitY ? Math.abs(box.exitY - box.entryY) + 2 : 2" />
            </svg>
            <span class="exit-dot" :class="`exit-dot--${box.outcome.reason}`" :style="{ left: `${box.exitX}px`, top: `${box.exitY}px` }" />

            <template v-if="box.trade.id === activeId">
              <!-- Every edge can be taken anywhere along it, as in TradingView: the take-profit and stop-loss edges
                   move up and down, the sides change when the trade starts and how long it may run. -->
              <template v-if="!box.isPlacing">
                <div class="edge edge--level" :style="{ left: `${box.left}px`, top: `${box.targetY}px`, width: `${box.width}px` }" @pointerdown.prevent.stop="startDrag(box.trade, 'target', $event)" />
                <div class="edge edge--level" :style="{ left: `${box.left}px`, top: `${box.stopY}px`, width: `${box.width}px` }" @pointerdown.prevent.stop="startDrag(box.trade, 'stop', $event)" />
                <div class="edge edge--side" :style="{ left: `${box.left}px`, top: `${Math.min(box.targetY, box.stopY)}px`, height: `${Math.abs(box.stopY - box.targetY)}px` }" @pointerdown.prevent.stop="startDrag(box.trade, 'start', $event)" />
                <div class="edge edge--side" :style="{ left: `${box.left + box.width}px`, top: `${Math.min(box.targetY, box.stopY)}px`, height: `${Math.abs(box.stopY - box.targetY)}px` }" @pointerdown.prevent.stop="startDrag(box.trade, 'end', $event)" />
              </template>
              <p class="label label--gain label--start" :class="box.targetY < box.entryY ? 'label--above' : 'label--below'" :style="{ left: `${box.left}px`, top: `${box.targetY}px` }">
                {{ box.targetText }}
              </p>
              <p class="label label--loss label--start" :class="box.stopY < box.entryY ? 'label--above' : 'label--below'" :style="{ left: `${box.left}px`, top: `${box.stopY}px` }">
                {{ box.stopText }}
              </p>
              <p class="label label--outcome" :class="`outcome--${box.outcome.reason}`" :style="{ left: `${box.left + box.width + 12}px`, top: `${box.entryY}px` }">
                <span>{{ box.outcomeText }}</span>
                <span class="label-detail">{{ box.detailText }}</span>
              </p>

              <button type="button" class="handle handle--level" :style="{ left: `${box.left + box.width / 2}px`, top: `${box.targetY}px` }" v-tip="'Drag to set the take-profit'" @pointerdown.prevent="startDrag(box.trade, 'target', $event)" />
              <button type="button" class="handle handle--level" :style="{ left: `${box.left + box.width / 2}px`, top: `${box.stopY}px` }" v-tip="'Drag to set the stop-loss'" @pointerdown.prevent="startDrag(box.trade, 'stop', $event)" />
              <button v-if="!box.isPlacing" type="button" class="grip" :style="{ left: `${box.left}px`, top: `${box.entryY}px` }" v-tip="'Drag to move the trade'" @pointerdown.prevent="startDrag(box.trade, 'move', $event)">
                <UiIcon name="move" />
              </button>
              <button type="button" class="handle handle--side" :style="{ left: `${box.left + box.width}px`, top: `${box.entryY}px` }" v-tip="'Drag to set how long the trade may run'" @pointerdown.prevent="startDrag(box.trade, 'end', $event)" />
              <button v-if="!box.isPlacing" type="button" class="remove" :style="{ left: `${box.left + box.width}px`, top: `${Math.min(box.targetY, box.stopY)}px` }" v-tip="'Remove this trade'" @click="removeTrade(box.trade.id)">
                <UiIcon name="x" />
              </button>
            </template>
            <p v-else class="label label--chip" :class="`outcome--${box.outcome.reason}`" :style="{ left: `${box.exitX}px`, top: `${box.exitY}px` }">
              {{ formatSignedPercent(box.outcome.returnPct) }}
            </p>
          </div>
        </div>
        <p v-if="!isLoadingBars && (!trades.length || placing)" class="empty-hint">
          <UiIcon name="mouse-pointer-click" /> {{ hint }}
        </p>
        <Transition name="searching">
          <div v-if="isSearching" class="searching" role="status" aria-live="polite">
            <div class="progress">
              <p class="progress-title">
                <span class="find-spinner" aria-hidden="true" /> Searching for strategies
              </p>
              <ol class="progress-stages">
                <li v-for="(stage, index) in stages" :key="stage" :class="{ 'is-done': index < stageIndex, 'is-now': index === stageIndex }">
                  <UiIcon v-if="index < stageIndex" name="check" />
                  <span v-else class="stage-dot" aria-hidden="true" />
                  {{ stage }}
                </li>
              </ol>
              <div class="progress-track">
                <div class="progress-fill" :style="{ transform: `scaleX(${searchProgress})` }" />
              </div>
              <p class="progress-count">
                {{ rulesTried.toLocaleString('en-US') }} rules tried · {{ Math.round(searchProgress * 100) }}%
              </p>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <p v-if="failure" class="failure" role="alert">
      {{ failure }}
    </p>

    <section v-if="proposals.length" ref="proposalList" class="proposals-area" aria-label="Matching strategies">
      <header class="proposals-head">
        <h3 class="proposals-title">
          {{ proposals.length }} matching {{ proposals.length === 1 ? 'strategy' : 'strategies' }}
        </h3>
        <div class="segmented" role="radiogroup" aria-label="Sort the strategies">
          <button v-for="option in ORDERS" :key="option.value" type="button" role="radio" :aria-checked="order === option.value" :class="{ 'is-on': order === option.value }" @click="order = option.value">
            {{ option.label }}
          </button>
        </div>
      </header>
      <TransitionGroup tag="div" name="reorder" class="proposals">
        <article v-for="proposal in sortedProposals" :key="`${directionOf(proposal)}:${proposal.name}`" class="proposal" :class="{ 'is-shown': proposal === shown }">
          <header class="proposal-head">
            <span class="direction" :class="`direction--${directionOf(proposal)}`">{{ DIRECTION_LABELS[directionOf(proposal)] }}</span>
            <button v-if="proposal !== shown" type="button" class="quiet" @click="shownIndex = proposals.indexOf(proposal)">
              <UiIcon name="expand" /> Show on the chart
            </button>
            <span v-else class="shown-note"><UiIcon name="eye" /> On the chart</span>
          </header>
          <h4 class="proposal-name">
            {{ proposal.name }}
          </h4>
          <dl class="proposal-stats">
            <div>
              <dt><UiIcon name="wallet" /> Whole history</dt>
              <dd :class="proposal.total_return_pct >= 0 ? 'up' : 'down'">
                {{ formatSignedPercent(proposal.total_return_pct) }}
              </dd>
            </div>
            <div>
              <dt><UiIcon name="trending-down" /> Deepest fall</dt>
              <dd>{{ formatSignedPercent(proposal.max_drawdown_pct) }}</dd>
            </div>
            <div>
              <dt><UiIcon name="repeat" /> Trades</dt>
              <dd>{{ proposal.trade_count.toLocaleString('en-US') }}</dd>
            </div>
            <div>
              <dt><UiIcon name="target" /> Fits your entries</dt>
              <dd>{{ proposal.entries_hit }} of {{ proposal.entries_marked }}</dd>
            </div>
          </dl>
          <BuilderStrategyPreview :strategy="proposal.strategy" />
          <p class="proposal-fit">
            {{ matchText(proposal) }}. {{ proposal.exit_note }}.
          </p>
          <p v-if="caution(proposal)" class="proposal-caution">
            <UiIcon name="info" /> {{ caution(proposal) }}
          </p>
          <button type="button" class="use" @click="emit('build', proposal.strategy, proposal.name)">
            Build this strategy <UiIcon name="arrow-right" />
          </button>
        </article>
      </TransitionGroup>
    </section>
  </div>
</template>

<style scoped>
/* The view scrolls as a page: the chart keeps a size that is easy to draw on, the proposals follow under it.
   Over the chart the wheel zooms it, as in TradingView; anywhere else it scrolls the page. */
.mark-view {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: transparent;
  padding: 0.25rem 1.25rem 1rem;
  color: var(--panel-ink);
  font-size: 14px;
}

.mark-head,
.mark-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1rem;
}

.below {
  position: absolute;
  z-index: 5;
  bottom: 2.6rem;
  left: 50%;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  translate: -50% 0;
  border-radius: 999px;
  background: var(--color-lime);
  padding: 0.4rem 0.9rem;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-ink);
  box-shadow: 0 10px 24px -10px rgb(0 0 0 / 0.6);
  transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
}

.below:hover {
  transform: translateY(2px);
}

.below:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 3px;
}

.below-enter-active {
  transition: opacity 260ms cubic-bezier(0.22, 1, 0.36, 1), transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.below-leave-active {
  transition: opacity 140ms cubic-bezier(0.4, 0, 1, 1);
}

.below-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.below-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .below,
  .below-enter-active {
    transition: opacity 120ms linear;
  }

  .below:hover,
  .below-enter-from {
    transform: none;
  }
}

.tool--ratio {
  width: 2.25rem;
  font-size: 11.5px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.ratio-title {
  font-weight: 700;
}

.ratio-help {
  margin-top: 0.15rem;
  font-size: 12.5px;
  color: var(--panel-soft);
}

.ratio-choices {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 2px;
  margin-top: 0.6rem;
  border-radius: 9px;
  background: var(--panel-fill);
  padding: 2px;
}

.ratio-choices button {
  border-radius: 7px;
  padding: 0.3rem 0.4rem;
  font-size: 12.5px;
  font-weight: 700;
  white-space: nowrap;
  color: var(--panel-soft);
}

.ratio-choices button.is-on {
  background: var(--color-lime);
  color: var(--color-ink);
}

.mark-title {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.mark-text {
  max-width: 44rem;
  font-size: 13px;
  line-height: 1.45;
  color: var(--panel-soft);
}

.mark-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-left: auto;
}

.market {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border-radius: 10px;
  background: var(--panel);
  padding: 0.3rem 0.6rem;
  font-weight: 700;
  box-shadow: inset 0 0 0 1px var(--panel-line);
  transition: box-shadow 140ms;
}

.market:hover,
.market[aria-expanded="true"] {
  box-shadow: inset 0 0 0 1.5px var(--accent-ink);
}

.market:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.market-chevron {
  width: 0.9rem;
  height: 0.9rem;
  color: var(--panel-soft);
  transition: rotate 160ms;
}

.market-chevron.is-open {
  rotate: 180deg;
}

.segmented {
  display: inline-grid;
  grid-auto-columns: 1fr;
  grid-auto-flow: column;
  gap: 2px;
  border-radius: 10px;
  background: var(--panel-fill);
  padding: 3px;
}

.segmented button {
  border-radius: 7px;
  padding: 0.3rem 0.65rem;
  font-size: 13px;
  font-weight: 700;
  color: var(--panel-soft);
  transition: background-color 140ms, color 140ms;
}

.segmented button.is-on {
  background: var(--panel);
  color: var(--panel-ink);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.15), inset 0 0 0 1px var(--panel-line);
}

/* The tools sit in a narrow rail down the chart's left edge, as in TradingView. */
.rail {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  border-right: 1px solid var(--panel-line);
  padding: 0.25rem 0.45rem 0.25rem 0;
}

.rail-split {
  width: 1.4rem;
  height: 1px;
  margin: 0.2rem 0;
  background: var(--panel-line);
}

.tool {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border-radius: 9px;
  color: var(--panel-soft);
  transition: background-color 140ms, color 140ms, box-shadow 140ms;
}

.tool svg {
  width: 1.15rem;
  height: 1.15rem;
}

.tool:hover {
  background: var(--panel-fill);
  color: var(--panel-ink);
}

.tool:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
}

.tool--danger:hover {
  color: var(--loss-ink);
}

.tool--long.is-on {
  background: color-mix(in srgb, #26a69a 14%, var(--panel));
  color: var(--gain-ink);
  box-shadow: inset 0 0 0 1.5px var(--gain-ink);
}

.tool--short.is-on {
  background: color-mix(in srgb, #ef5350 14%, var(--panel));
  color: var(--loss-ink);
  box-shadow: inset 0 0 0 1.5px var(--loss-ink);
}

.direction {
  border-radius: 6px;
  padding: 0.1rem 0.45rem;
  font-size: 12px;
  font-weight: 700;
}

.direction--long {
  background: #00796b;
  color: #ffffff;
}

.direction--both {
  background: var(--color-lime);
  color: var(--color-ink);
}

.direction--short {
  background: #d32f2f;
  color: #ffffff;
}

.trade-count {
  font-size: 13px;
  color: var(--panel-soft);
}

.trade-count b {
  color: var(--panel-ink);
  font-variant-numeric: tabular-nums;
}

.quiet {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border-radius: 8px;
  padding: 0.3rem 0.55rem;
  font-size: 13px;
  font-weight: 600;
  color: var(--panel-soft);
  transition: background-color 140ms, color 140ms;
}

.quiet:hover {
  background: var(--panel-fill);
  color: var(--panel-ink);
}

.mark-need {
  margin-left: auto;
  font-size: 13px;
  color: var(--panel-soft);
}

.find,
.use {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border-radius: 10px;
  background: var(--color-lime);
  padding: 0.5rem 0.9rem;
  font-weight: 700;
  color: var(--color-ink);
  transition: background-color 140ms, transform 120ms, opacity 140ms;
}

.find:hover:not(:disabled),
.use:hover {
  background: #d6f87c;
}

.find:active:not(:disabled),
.use:active {
  transform: scale(0.97);
}

/* The button keeps its size while it searches, so nothing beside it moves. */
.find {
  min-width: 15.5rem;
}

.find:disabled:not(.is-searching) {
  opacity: 0.45;
}

.find.is-searching {
  cursor: progress;
  background: linear-gradient(90deg, var(--color-lime), #e4fba6, var(--color-lime));
  background-size: 200% 100%;
  animation: find-shimmer 1.2s linear infinite;
}

@keyframes find-shimmer {
  to {
    background-position: -200% 0;
  }
}

.find-spinner {
  width: 0.95rem;
  height: 0.95rem;
  border: 2px solid rgb(13 27 36 / 0.25);
  border-top-color: var(--color-ink);
  border-radius: 999px;
  animation: spin 700ms linear infinite;
}

@keyframes spin {
  to {
    rotate: 1turn;
  }
}

/* While the search runs, the chart greys out and blurs behind the search's own card. */
.searching {
  position: absolute;
  z-index: 6;
  inset: 0;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel) 35%, transparent);
  backdrop-filter: grayscale(1) blur(5px);
}

.searching-enter-active,
.searching-leave-active {
  transition: opacity 220ms, backdrop-filter 220ms;
}

.searching-enter-from,
.searching-leave-to {
  opacity: 0;
}

.progress-title .find-spinner {
  border-color: var(--panel-line);
  border-top-color: var(--color-lime);
}

.progress-title {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 15px;
  font-weight: 700;
}

.progress-stages {
  display: grid;
  gap: 0.3rem;
  font-size: 13px;
  color: var(--panel-soft);
}

.progress-stages li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: color 200ms;
}

.progress-stages li.is-done {
  color: var(--panel-ink);
}

.progress-stages li.is-done svg {
  width: 0.9rem;
  height: 0.9rem;
  color: var(--gain-ink);
}

.progress-stages li.is-now {
  font-weight: 700;
  color: var(--panel-ink);
}

.stage-dot {
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid var(--panel-line);
  border-radius: 999px;
}

.is-now .stage-dot {
  border-color: var(--color-lime);
  animation: stage-pulse 1s ease-in-out infinite;
}

@keyframes stage-pulse {
  50% {
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-lime) 30%, transparent);
  }
}

.progress {
  display: grid;
  width: min(24rem, calc(100% - 3rem));
  gap: 0.75rem;
  border-radius: 16px;
  background: var(--panel);
  padding: 1rem 1.1rem;
  box-shadow: inset 0 0 0 1px var(--panel-line), 0 24px 48px -20px rgb(0 0 0 / 0.5);
}

.progress-count {
  font-size: 12.5px;
  color: var(--panel-soft);
  font-variant-numeric: tabular-nums;
}

.progress-track {
  overflow: hidden;
  height: 6px;
  border-radius: 999px;
  background: var(--panel-fill);
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--color-lime);
  transform-origin: left;
}

.chart-box {
  display: flex;
  height: clamp(20rem, calc(100% - 12rem), 38rem);
  flex: none;
  border-radius: 16px;
  background: var(--panel);
  padding: 0.5rem 0.25rem 0.25rem 0.5rem;
  box-shadow: var(--panel-shadow);
  transition: opacity 200ms;
}

.chart-box.is-busy .chart-area {
  opacity: 0;
}

.chart-area {
  position: relative;
  min-width: 0;
  height: 100%;
  flex: 1;
  transition: opacity 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.chart {
  height: 100%;
  cursor: crosshair;
}

/* Each trade is a layer of its own, so the one under the pointer can come forward. */
.trade {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.trade > * {
  position: absolute;
}

.trade:not(.is-active) .zone {
  opacity: 0.7;
}

/* While the second click is awaited the box only follows the pointer; clicks go through it to the chart. */
.trade.is-placing .zone,
.trade.is-placing .handle {
  pointer-events: none;
}

/* A trade that is not being worked on keeps only its result, as a small chip where it ended. */
.label--chip {
  translate: -50% calc(-100% - 8px);
  background: #2a2e39;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.18);
}

.label--chip.outcome--target {
  background: #26a69a;
}

.label--chip.outcome--stop {
  background: #ef5350;
}

/* The boxes cover the plot only, never the price or time axis, and sit above the chart's own canvases;
   between them the chart still takes the pointer, so it pans and zooms as usual. */
.boxes {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 3;
  overflow: hidden;
  pointer-events: none;
}

.zone {
  pointer-events: auto;
  cursor: grab;
}

.zone:active {
  cursor: grabbing;
}

.zone--target {
  background: rgb(38 166 154 / 0.3);
  box-shadow: inset 0 0 0 1.5px rgb(38 166 154 / 0.8);
}

.zone--stop {
  background: rgb(239 83 80 / 0.3);
  box-shadow: inset 0 0 0 1.5px rgb(239 83 80 / 0.8);
}

/* The strategy's own trades sit under the drawn boxes and never take the pointer. */
.strategy-trades {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  overflow: hidden;
  pointer-events: none;
}

.strategy-trades svg {
  position: absolute;
  inset: 0;
}

.strategy-trades line {
  stroke-width: 2;
}

.strategy-trades .is-win line,
.strategy-trades .is-win circle {
  stroke: #26a69a;
}

.strategy-trades .is-loss line,
.strategy-trades .is-loss circle {
  stroke: #ef5350;
}

.strategy-trades circle {
  fill: var(--panel);
  stroke-width: 2;
}

.strategy-trades circle.path-entry {
  fill: var(--color-lime);
  stroke: var(--panel) !important;
}

.path-chip {
  position: absolute;
  translate: -50% calc(-100% - 9px);
  /* A ring of the panel's colour cuts the chip out of the candles behind it. */
  box-shadow: 0 0 0 2px var(--panel), 0 4px 10px -2px rgb(0 0 0 / 0.5);

  border-radius: 6px;
  padding: 0.05rem 0.35rem;
  font-size: 11px;
  font-weight: 700;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.path-chip.is-win {
  background: #26a69a;
}

.path-chip.is-loss {
  background: #ef5350;
}

.entry-line {
  height: 0;
  border-top: 1.5px solid rgb(178 181 190 / 0.9);
}

.path {
  overflow: visible;
}

.path line {
  stroke: rgb(178 181 190 / 0.85);
  stroke-width: 1.5;
  stroke-dasharray: 5 4;
}

.exit-dot {
  width: 0.65rem;
  height: 0.65rem;
  translate: -50% -50%;
  border-radius: 999px;
  box-shadow: 0 0 0 2px var(--panel);
}

.exit-dot--target {
  background: #26a69a;
}

.exit-dot--stop {
  background: #ef5350;
}

.exit-dot--time {
  background: #b2b5be;
}

/* The labels read like TradingView's: solid colour, white text, on the edge they describe. */
.label {
  translate: -50% 0;
  border-radius: 6px;
  padding: 0.2rem 0.5rem;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.35;
  white-space: nowrap;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}

.label--gain {
  background: #26a69a;
}

.label--loss {
  background: #ef5350;
}

.label--above {
  translate: -50% calc(-100% - 4px);
}

.label--below {
  translate: -50% 4px;
}

/* The take-profit and stop-loss read from the box's left edge, leaving its middle to the handle. */
.label--start.label--above {
  translate: 0 calc(-100% - 6px);
}

.label--start.label--below {
  translate: 0 6px;
}

.label--outcome {
  display: grid;
  justify-items: start;
  translate: 0 -50%;
  background: #2a2e39;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.18);
}

.label--outcome.outcome--target {
  box-shadow: inset 0 0 0 1.5px #26a69a;
}

.label--outcome.outcome--stop {
  box-shadow: inset 0 0 0 1.5px #ef5350;
}

.label-detail {
  font-weight: 500;
  color: #d1d4dc;
}

/* A handle is a small white pill along its edge: it says which way it drags without covering the candles. */
.handle {
  width: 22px;
  height: 7px;
  translate: -50% -50%;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 0 0 1px rgb(13 27 36 / 0.45), 0 2px 6px rgb(0 0 0 / 0.35);
  pointer-events: auto;
  cursor: ns-resize;
  touch-action: none;
  transition: transform 140ms cubic-bezier(0.22, 1, 0.36, 1), background-color 140ms;
}

/* A handle is small to look at and larger to grab. */
.handle::before {
  position: absolute;
  inset: -8px;
  content: "";
}

.handle--side {
  width: 7px;
  height: 22px;
  cursor: ew-resize;
}

/* The grip at the entry moves the whole trade; it sits just outside the box, on the entry line. */
.grip {
  display: grid;
  width: 1.5rem;
  height: 1.5rem;
  place-items: center;
  translate: calc(-100% - 6px) -50%;
  border-radius: 8px;
  background: #2a2e39;
  color: #ffffff;
  pointer-events: auto;
  cursor: grab;
  touch-action: none;
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.2), 0 2px 6px rgb(0 0 0 / 0.35);
  transition: transform 140ms cubic-bezier(0.22, 1, 0.36, 1), background-color 140ms;
}

.grip svg {
  width: 0.85rem;
  height: 0.85rem;
}

.grip:hover {
  background: #2962ff;
  transform: scale(1.08);
}

.grip:active {
  cursor: grabbing;
  transform: scale(0.96);
}

.grip:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

/* The edges themselves: thin strips centred on each side, invisible until the pointer is on them. */
.edge {
  pointer-events: auto;
  touch-action: none;
}

.edge--level {
  height: 10px;
  translate: 0 -50%;
  cursor: ns-resize;
}

.edge--side {
  width: 10px;
  translate: -50% 0;
  cursor: ew-resize;
}

.edge:hover {
  background: rgb(41 98 255 / 0.35);
}

.handle:hover,
.handle:focus-visible {
  background: #2962ff;
  transform: scale(1.2);
  outline: none;
}

@media (prefers-reduced-motion: reduce) {
  .handle,
  .grip {
    transition: none;
  }

  .handle:hover,
  .handle:focus-visible,
  .grip:hover,
  .grip:active {
    transform: none;
  }
}

.remove {
  display: grid;
  width: 1.4rem;
  height: 1.4rem;
  place-items: center;
  translate: -50% -50%;
  border-radius: 999px;
  background: #2a2e39;
  color: #ffffff;
  pointer-events: auto;
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.25);
}

.remove .ui-icon {
  width: 0.8rem;
  height: 0.8rem;
}

.remove:hover {
  background: #ef5350;
}

.remove:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.chart-key {
  display: inline-flex;
  min-width: 0;
  max-width: 24rem;
  align-items: center;
  gap: 0.4rem;
  overflow: hidden;
  white-space: nowrap;
  font-size: 12.5px;
  color: var(--panel-soft);
}

.empty-hint {
  position: absolute;
  z-index: 4;
  top: 0.4rem;
  left: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  border-radius: 8px;
  background: color-mix(in srgb, var(--panel) 88%, transparent);
  padding: 0.25rem 0.55rem;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--panel-ink);
  pointer-events: none;
}

.empty-hint .ui-icon {
  width: 1rem;
  height: 1rem;
  color: var(--accent-ink);
}

.key-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  background: #26a69a;
}

.failure {
  border-radius: 10px;
  background: var(--panel);
  padding: 0.55rem 0.75rem;
  color: var(--loss-ink);
  box-shadow: inset 0 0 0 1px var(--panel-line);
}

.proposals-area {
  display: grid;
  flex: none;
  gap: 0.75rem;
  scroll-margin-top: 0.75rem;
}

.proposals-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem 1rem;
}

.proposals-title {
  font-size: 16px;
  font-weight: 700;
}

/* Wide enough for a rule's tiles to sit whole on one line. */
.proposals {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(24rem, 100%), 1fr));
  gap: 0.75rem;
}

.reorder-move {
  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.proposal-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
  border-radius: 12px;
  background: var(--panel-fill);
  padding: 0.6rem 0.7rem;
}

.proposal-stats dt {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 11.5px;
  line-height: 1.25;
  color: var(--panel-soft);
}

.proposal-stats dd {
  margin-top: 0.15rem;
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.shown-note {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-left: auto;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--accent-ink);
}

.proposal {
  display: grid;
  align-content: start;
  gap: 0.6rem;
  border-radius: 16px;
  background: var(--panel);
  padding: 1rem;
  box-shadow: var(--panel-shadow);
  animation: proposal-in 260ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
}

.proposal:nth-child(2) {
  animation-delay: 70ms;
}

.proposal:nth-child(3) {
  animation-delay: 140ms;
}

@keyframes proposal-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

.proposal.is-shown {
  box-shadow: var(--panel-shadow), inset 0 0 0 1.5px var(--accent-ink);
}

.proposal-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.proposal-head .quiet {
  margin-left: auto;
}

.proposal-name {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.3;
  text-wrap: balance;
}

.proposal-fit {
  font-size: 13px;
  line-height: 1.45;
  color: var(--panel-soft);
}

.proposal-stats .up {
  color: var(--gain-ink);
}

.proposal-stats .down {
  color: var(--loss-ink);
}

.proposal-caution {
  display: flex;
  gap: 0.4rem;
  border-radius: 10px;
  background: var(--panel-fill);
  padding: 0.5rem 0.6rem;
  font-size: 13px;
  line-height: 1.4;
}

.proposal-caution .ui-icon {
  width: 1rem;
  height: 1rem;
  margin-top: 0.1rem;
  color: var(--loss-ink);
}

.market:focus-within,
.tool:focus-visible,
.segmented button:focus-visible,
.quiet:focus-visible,
.find:focus-visible,
.use:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.market select:focus {
  outline: none;
}

@media (prefers-reduced-motion: reduce) {
  .proposal,
  .find.is-searching,
  .find-spinner,
  .is-now .stage-dot {
    animation: none;
  }
}
</style>
