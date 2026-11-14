<script setup lang="ts">
import type { ExecutionPreset, InstrumentInfo, StrategyDraft } from '~/types/api'
import type { Item, LimitKind } from '~/utils/strategyDocument'
import type { Layout, PanelWidths } from '~/utils/strategyFiles'
import type { BacktestPeriod } from '~/composables/useApi'

// The builder in three columns: the block library on the left, the strategy as cards on a canvas in the
// middle, and the result with the assistant on the right. A first visit starts empty and guided.
usePageMeta(
  '/app',
  'Strategy builder · BlockStrat',
  'Snap a crypto trading strategy together from blocks and backtest it on real Binance prices, or mark trades on a chart and get matching strategies.',
)
useHead({ bodyAttrs: { class: 'app' } })

// The landing page's featured strategy, one click away for anyone who wants to see a finished one.
const EXAMPLE = STRATEGY_TEMPLATES[0]!
const DEFAULT_EXECUTION = EXAMPLE.strategy.execution

const api = useApi()
// How much of the latest history the result covers; a year by default, the stretch most people judge by.
const period = ref<BacktestPeriod>('1y')
const backtest = useBacktest(period)
const editor = createStrategyEditor(emptyDocument(DEFAULT_EXECUTION))
provide(STRATEGY_EDITOR, editor)
const { isAdvanced } = useBuilderMode()
const canvas = ref<{ showTarget: (target: string) => void } | null>(null)
const replay = useStrategyReplay(editor, step => canvas.value?.showTarget(step.target))

const name = ref('')
const instruments = ref<InstrumentInfo[]>([])
const presets = ref<ExecutionPreset[]>([])
const notice = ref<string | null>(null)
const rightTab = ref<'result' | 'assistant' | 'json'>('result')
const mobileTab = ref<'library' | 'strategy' | 'result'>('strategy')
// The middle column is the canvas of blocks, or a chart to mark trades on and get matching strategies.
const centreView = ref<'blocks' | 'chart'>('blocks')
// The side columns belong to building with blocks. Going to the chart they slide out to their sides first,
// then the chart takes the whole width and comes into focus; coming back, the canvas comes into focus and
// the columns slide back in. The switch itself never moves.
// Going to the chart: the columns slide away and the canvas fades where it stands; part way through, the
// chart starts to come into focus over the whole width, so one view dissolves into the other with no empty
// moment; once the columns are gone the grid closes to the one column the chart already fills.
const SIDES_OUT_MS = 300
const CHART_IN_AFTER_MS = 130
const CANVAS_OUT_MS = 260
const areSidesTucked = ref(false)
const isCanvasLeaving = ref(false)
const isMarking = ref(false)

function wait(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()))
}

async function showView(view: 'blocks' | 'chart'): Promise<void> {
  if (view === centreView.value) return
  const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (view === 'chart') {
    areSidesTucked.value = true
    isCanvasLeaving.value = true
    if (!isReduced) await wait(CHART_IN_AFTER_MS)
    centreView.value = 'chart'
    if (!isReduced) await wait(SIDES_OUT_MS - CHART_IN_AFTER_MS)
    isMarking.value = true
    if (!isReduced) await wait(CANVAS_OUT_MS)
    isCanvasLeaving.value = false
    return
  }
  centreView.value = 'blocks'
  isMarking.value = false
  // The columns come back in their tucked place, then slide in from it.
  await nextTick()
  await nextFrame()
  areSidesTucked.value = false
}
// The canvas waits for the saved strategy and name, so a returning user never sees the welcome flash.
const isReady = ref(false)

const draft = computed(() => documentToDraft(editor.document.value))
const missing = computed(() => missingParts(editor.document.value))
const problemCount = computed(() => Object.keys(editor.problems.value).length)
const checklist = computed(() => guideSteps(editor.document.value, name.value))
const step = computed(() => nextGuideStep(editor.document.value, name.value))

watch(draft, (current) => {
  // A strategy that is still being built in front of the user is neither saved nor tested step by step.
  if (replay.isRunning.value) return
  saveCurrentStrategy(current)
  if (missing.value.length || problemCount.value) backtest.cancel()
  else backtest.schedule(current)
})

watch(name, saveCurrentName)

// ---------- Saving to the strategy library ----------
// Every strategy is kept in the browser under its name, so there can be many. It is saved every half minute
// when it has changed, and at once before another strategy takes its place or the page is closed.
const SAVE_EVERY_MS = 30_000
const savedAs = ref<string | null>(null)
const hasUnsavedChanges = ref(false)
const lastSavedAt = ref<number | null>(null)
let saveTimer: ReturnType<typeof setInterval> | undefined
// What was saved last, so a change undone, or the name the save itself gave, is not a change to save.
let lastSaved = ''

function snapshot(): string {
  return JSON.stringify([name.value, draft.value])
}

watch([draft, name], () => {
  if (isReady.value && !replay.isRunning.value) hasUnsavedChanges.value = snapshot() !== lastSaved
})

function saveNow(): void {
  if (!hasUnsavedChanges.value) return
  hasUnsavedChanges.value = false
  // An empty strategy is not worth a place in the list.
  if (!draft.value.sides.some(side => side.entry !== null || side.exit !== null)) return
  const saved = autosaved(loadLibrary(), savedAs.value, name.value, draft.value)
  saveLibrary(saved.library)
  savedAs.value = saved.savedAs
  if (saved.name !== name.value) name.value = saved.name
  lastSaved = snapshot()
  lastSavedAt.value = Date.now()
}

/** Before another strategy takes the canvas: the current one is saved, and the next one saved on its own. */
function switchStrategy(nextSavedAs: string | null): void {
  saveNow()
  savedAs.value = nextSavedAs
}

function open(strategy: StrategyDraft, strategyName: string): void {
  switchStrategy(strategyName in loadLibrary() ? strategyName : null)
  editor.replace(documentFromDraft(strategy))
  name.value = strategyName
}

/** Opens a finished strategy by building it in front of the user, then shows its result. */
async function build(strategy: StrategyDraft, strategyName: string): Promise<void> {
  name.value = strategyName
  mobileTab.value = 'strategy'
  await showView('blocks')
  // The canvas was hidden while the chart was up; it needs a frame to measure itself again.
  await nextTick()
  await replay.play(documentFromDraft(strategy))
  rightTab.value = 'result'
}

// A found strategy does not silently replace one already being built: the user keeps it or replaces it.
const pendingBuild = ref<{ strategy: StrategyDraft, name: string } | null>(null)

function askBuild(strategy: StrategyDraft, strategyName: string): void {
  const isBuilding = draft.value.sides.some(side => side.entry !== null || side.exit !== null)
  if (!isBuilding) {
    build(strategy, strategyName)
    return
  }
  pendingBuild.value = { strategy, name: strategyName }
}

function finishBuild(choice: 'replace' | 'keep'): void {
  const chosen = pendingBuild.value
  if (!chosen) return
  // Kept: the current one is saved where it is and the new one gets its own place. Replaced: the new one takes
  // the current one's place.
  if (choice === 'keep') switchStrategy(null)
  build(chosen.strategy, chosen.name)
}

function useExample(): void {
  switchStrategy(null)
  build(EXAMPLE.strategy, EXAMPLE.name)
}

// The JSON is an advanced tool: leaving advanced mode leaves its tab too.
watch(isAdvanced, (isOn) => {
  if (!isOn && rightTab.value === 'json') rightTab.value = 'result'
})

function startNew(): void {
  switchStrategy(null)
  editor.replace(emptyDocument(DEFAULT_EXECUTION))
  name.value = ''
}

// Library blocks go to one side: the one the guide points at, until the user picks another in the library.
const chosenSideId = ref<string | null>(null)
const targetSide = computed(() => editor.document.value.sides.find(side => side.id === chosenSideId.value) ?? guideSide(editor.document.value))
const sideChoices = computed(() => editor.document.value.sides.map(side => ({ id: side.id, direction: side.direction })))

// A block clicked in the library goes into the group its tab is for; its tile then opens its value editor.
function addCondition(item: Item, part: 'entry' | 'exit'): void {
  const group = targetSide.value[part]
  editor.focusItem.value = item.id
  editor.commit(document => addItem(document, group.id, item))
  mobileTab.value = 'strategy'
}

function toggleMarket(symbol: string): void {
  editor.commit(document => toggleInstrument(document, symbol))
  mobileTab.value = 'strategy'
}

function addRisk(kind: LimitKind, percent: number): void {
  const sideId = targetSide.value.id
  editor.commit(document => setSideLimit(document, sideId, LIMIT_FIELDS[kind], percent))
  mobileTab.value = 'strategy'
}

// Runs every chosen market again; markets whose result is already current are not sent again.
function retry(): void {
  backtest.run(draft.value)
}

// ---------- Column widths ----------
// The side columns can be dragged wider or narrower; a double click on a divider gives its column back
// its default width. The canvas always keeps room for one card.
const MINIMUM_SIDE_WIDTH = 240
const MINIMUM_CANVAS_WIDTH = 380
const KEY_STEP = 24
type SidePanel = 'library' | 'result'

const DEFAULT_WIDTHS: PanelWidths = { library: null, result: null }
const customWidths = ref<PanelWidths>(DEFAULT_WIDTHS)
const layout = ref<Layout>('custom')
const hasCustomLayout = computed(() => customWidths.value.library !== null || customWidths.value.result !== null)
const panelWidths = computed(() => (layout.value === 'custom' ? customWidths.value : DEFAULT_WIDTHS))
const workspace = ref<HTMLElement | null>(null)

function setLayout(chosen: Layout): void {
  layout.value = chosen
  saveLayout(chosen)
}
const workspaceStyle = computed(() => ({
  '--library-width': panelWidths.value.library === null ? undefined : `${panelWidths.value.library}px`,
  '--result-width': panelWidths.value.result === null ? undefined : `${panelWidths.value.result}px`,
}))

function columnWidth(panel: SidePanel): number {
  return workspace.value?.querySelector(`.column--${panel}`)?.getBoundingClientRect().width ?? 0
}

function setPanelWidth(panel: SidePanel, width: number): void {
  const other = columnWidth(panel === 'library' ? 'result' : 'library')
  const widest = (workspace.value?.clientWidth ?? window.innerWidth) - other - MINIMUM_CANVAS_WIDTH
  // Dragging a column makes the layout the user's own.
  customWidths.value = { ...panelWidths.value, [panel]: Math.round(Math.max(MINIMUM_SIDE_WIDTH, Math.min(width, widest))) }
  savePanelWidths(customWidths.value)
  if (layout.value !== 'custom') setLayout('custom')
}

function resetPanelWidth(panel: SidePanel): void {
  customWidths.value = { ...customWidths.value, [panel]: null }
  savePanelWidths(customWidths.value)
}

function startResize(panel: SidePanel, event: PointerEvent): void {
  const startX = event.clientX
  const startWidth = columnWidth(panel)
  // The library grows to the right, the result column to the left.
  const direction = panel === 'library' ? 1 : -1
  // Followed on the whole window, so a fast drag that leaves the thin divider keeps resizing.
  const onMove = (move: PointerEvent): void => setPanelWidth(panel, startWidth + direction * (move.clientX - startX))
  const onEnd = (): void => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onEnd)
    window.removeEventListener('pointercancel', onEnd)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onEnd)
  window.addEventListener('pointercancel', onEnd)
}

function resizeByKey(panel: SidePanel, event: KeyboardEvent): void {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  event.preventDefault()
  const grows = (event.key === 'ArrowRight') === (panel === 'library')
  setPanelWidth(panel, columnWidth(panel) + (grows ? KEY_STEP : -KEY_STEP))
}

function startingPoint(): { strategy: StrategyDraft | null, name: string } {
  try {
    const shared = strategyFromHash(window.location.hash)
    if (shared) {
      // Drop the hash so a reload shows the user's own edits, not the link again.
      history.replaceState(null, '', window.location.pathname)
      mobileTab.value = 'result'
      return { strategy: shared, name: 'Shared strategy' }
    }
  }
  catch (error) {
    notice.value = error instanceof InvalidStrategyError ? error.message : 'The share link could not be opened.'
  }
  return { strategy: loadCurrentStrategy(), name: loadCurrentName() }
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

function onKeydown(event: KeyboardEvent): void {
  if (!(event.ctrlKey || event.metaKey) || isTyping(event.target)) return
  const key = event.key.toLowerCase()
  if (key === 'z' && !event.shiftKey) {
    event.preventDefault()
    editor.undo()
  }
  else if (key === 'y' || (key === 'z' && event.shiftKey)) {
    event.preventDefault()
    editor.redo()
  }
}

// What is being dragged, on <body> while it is: Sortable carries the block's copy as a child of <body>, and
// the drop areas light up for it. A body:has() selector would say the same, but it makes the browser re-check
// the whole page on every change anywhere, which made the charts stutter.
let dragWatcher: MutationObserver | undefined

function markDragging(): void {
  const carried = document.querySelector('body > .sortable-fallback')
  if (!carried) {
    delete document.body.dataset.dragging
    return
  }
  if (carried.querySelector('.coin-mark')) document.body.dataset.dragging = 'market'
  else if (carried.classList.contains('limit')) document.body.dataset.dragging = 'limit'
  else document.body.dataset.dragging = 'condition'
}

onMounted(async () => {
  dragWatcher = new MutationObserver(markDragging)
  dragWatcher.observe(document.body, { childList: true })
  window.addEventListener('keydown', onKeydown)
  customWidths.value = loadPanelWidths()
  layout.value = loadLayout()
  const start = startingPoint()
  // The first document is not an edit, so it gets no undo step.
  if (start.strategy) editor.document.value = documentFromDraft(start.strategy)
  name.value = start.name
  isReady.value = true
  savedAs.value = name.value && name.value in loadLibrary() ? name.value : null
  lastSaved = snapshot()
  saveTimer = setInterval(saveNow, SAVE_EVERY_MS)
  window.addEventListener('pagehide', saveNow)
  if (start.strategy) backtest.schedule(draft.value)
  try {
    const [instrumentList, executionPresets] = await Promise.all([api.instruments(), api.executionPresets()])
    instruments.value = instrumentList.instruments
    presets.value = executionPresets
  }
  catch {
    notice.value = 'The backtest server is not reachable. You can still build; results appear once it is back.'
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  dragWatcher?.disconnect()
  clearInterval(saveTimer)
  window.removeEventListener('pagehide', saveNow)
  saveNow()
})
</script>

<template>
  <div class="app builder">
    <BuilderToolbar v-model:name="name" :draft="draft" :has-unsaved-changes="hasUnsavedChanges" :last-saved-at="lastSavedAt" @save-now="saveNow" :layout="layout" :has-custom-layout="hasCustomLayout" @update:layout="setLayout" @open="open" @start-new="startNew" />

    <p v-if="notice" class="notice" role="alert">
      {{ notice }}
      <button type="button" class="ml-auto font-bold" @click="notice = null">
        Dismiss
      </button>
    </p>

    <div v-show="centreView === 'blocks'" class="mobile-tabs" role="tablist" aria-label="Builder views">
      <button v-for="tab in (['library', 'strategy', 'result'] as const)" :key="tab" type="button" role="tab" :aria-selected="mobileTab === tab" :class="{ 'is-on': mobileTab === tab }" @click="mobileTab = tab">
        {{ tab === 'library' ? 'Blocks' : tab === 'strategy' ? 'Strategy' : 'Result' }}
      </button>
    </div>

    <main ref="workspace" class="workspace" :class="{ 'is-marking': isMarking, 'are-sides-tucked': areSidesTucked, 'is-canvas-leaving': isCanvasLeaving }" :data-tab="mobileTab" :style="workspaceStyle">
      <aside class="column column--library" aria-label="Blocks">
        <BuilderLibrary :instruments="instruments" :chosen="editor.document.value.instruments" :step="step" :sides="sideChoices" :side-id="targetSide.id" @update:side-id="chosenSideId = $event" @add-condition="addCondition" @toggle-market="toggleMarket" @add-risk="addRisk" />
      </aside>

      <div class="divider divider--library" role="separator" aria-orientation="vertical" aria-label="Width of the blocks column: drag, or use the arrow keys" tabindex="0" @pointerdown.prevent="startResize('library', $event)" @dblclick="resetPanelWidth('library')" @keydown="resizeByKey('library', $event)" />

      <section class="column column--canvas" aria-label="Strategy">
        <div class="view-tabs" :class="{ 'is-chart': areSidesTucked }" role="tablist" aria-label="How to build the strategy">
          <span class="view-pill" aria-hidden="true" />
          <button type="button" role="tab" :aria-selected="!areSidesTucked" :class="{ 'is-on': !areSidesTucked }" @click="showView('blocks')">
            <UiIcon name="layers" /> Build with blocks
          </button>
          <button type="button" role="tab" :aria-selected="areSidesTucked" :class="{ 'is-on': areSidesTucked }" @click="showView('chart')">
            <UiIcon name="chart-candlestick" /> Mark on a chart
          </button>
        </div>
        <Transition name="chart-swap">
          <BuilderMarkView v-if="isReady" v-show="centreView === 'chart'" class="centre-view" :instruments="instruments" :instrument="editor.document.value.instruments[0] ?? null" :timeframe="editor.document.value.timeframe" :runs="backtest.runs.value" @build="askBuild" />
        </Transition>
        <BuilderBuildChoice v-if="pendingBuild" :current-name="name" :new-name="pendingBuild.name" @choose="finishBuild" @close="pendingBuild = null" />
        <Transition name="canvas-swap">
          <BuilderCanvas v-if="isReady" v-show="centreView === 'blocks'" ref="canvas" class="centre-view" v-model:name="name" :instruments="instruments" @build="build" @show-json="rightTab = 'json'; mobileTab = 'result'" @use-example="useExample" @start-new="startNew" @describe="rightTab = 'assistant'; mobileTab = 'result'" @open="open" />
        </Transition>
      </section>

      <div class="divider divider--result" role="separator" aria-orientation="vertical" aria-label="Width of the result column: drag, or use the arrow keys" tabindex="0" @pointerdown.prevent="startResize('result', $event)" @dblclick="resetPanelWidth('result')" @keydown="resizeByKey('result', $event)" />

      <section class="column column--result" aria-label="Result and assistant">
        <div class="right-tabs" role="tablist" aria-label="Result, assistant and JSON">
          <button type="button" role="tab" :aria-selected="rightTab === 'result'" :class="{ 'is-on': rightTab === 'result' }" @click="rightTab = 'result'">
            <UiIcon name="chart-line" /> Result
          </button>
          <button type="button" role="tab" :aria-selected="rightTab === 'assistant'" :class="{ 'is-on': rightTab === 'assistant' }" @click="rightTab = 'assistant'">
            <UiIcon name="sparkles" /> Assistant
          </button>
          <button v-if="isAdvanced" type="button" role="tab" :aria-selected="rightTab === 'json'" :class="{ 'is-on': rightTab === 'json' }" @click="rightTab = 'json'">
            <UiIcon name="code" /> Code
          </button>
        </div>
        <div class="right-body">
          <div v-show="rightTab === 'result'" class="right-scroll">
            <BuilderResultsPanel
              :instruments="editor.document.value.instruments"
              :runs="backtest.runs.value"
              :is-loading="backtest.isLoading.value"
              :missing="missing"
              :checklist="checklist"
              :problem-count="problemCount"
              :commission-pct="editor.document.value.execution.commission_pct"
              :period="period"
              :strategy="draft"
              @update:period="period = $event; retry()"
              @retry="retry"
            />
            <BuilderTestSettings v-if="isAdvanced" :presets="presets" />
            <p class="disclaimer">
              Simulations on historical Binance prices, not investment advice. Past results do not promise future ones.
              <NuxtLink to="/terms" target="_blank">Terms</NuxtLink> · <NuxtLink to="/privacy" target="_blank">Privacy</NuxtLink>
            </p>
          </div>
          <BuilderAssistantPanel v-show="rightTab === 'assistant'" :current-strategy="draft" @apply="build($event, name || 'From the assistant')" @close="rightTab = 'result'" />
          <BuilderJsonPanel v-show="rightTab === 'json'" :strategy="draft" :name="name" @close="rightTab = 'result'" />
        </div>
      </section>
    </main>

    <BuilderReplayHand v-if="replay.isRunning.value" :flight="replay.flight.value" @skip="replay.skip" />
  </div>
</template>

<style scoped>
.builder {
  display: flex;
  height: 100dvh;
  flex-direction: column;
  background: var(--panel);
  color: var(--panel-ink);
  font-family: var(--font-sans);
  font-variant-numeric: tabular-nums;
}

.notice {
  display: flex;
  gap: 1rem;
  border-bottom: 1px solid var(--panel-line);
  background: var(--panel-fill);
  padding: 0.55rem 1rem;
  font-size: 14px;
}

.workspace {
  /* The side columns give way on a narrower screen, so the canvas keeps room for a card and its note;
     a width the user dragged a column to replaces its default. */
  --library-column: var(--library-width, clamp(18rem, 20vw, 21rem));
  --result-column: var(--result-width, clamp(24rem, 28vw, 28rem));
  position: relative;
  /* The side columns slide out past its edges. */
  overflow: hidden;
  /* The same dotted board as the canvas lies under both views and under the columns, so nothing changes
     colour when the view changes. */
  background-color: var(--board-bg);
  background-image: radial-gradient(var(--canvas-dot) 1.2px, transparent 1.3px);
  background-size: 22px 22px;
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: var(--library-column) minmax(0, 1fr) var(--result-column);
}

/* Marking trades on a chart is a view of its own: the blocks and the result belong to building with blocks,
   so the chart takes the whole width. They stay mounted, so nothing is lost on the way back. */
.workspace.is-marking {
  grid-template-columns: minmax(0, 1fr);
}

.workspace.is-marking > .column:not(.column--canvas),
.workspace.is-marking > .divider {
  display: none;
}

/* A divider is a thin strip over the border between two columns, wide enough to grab. */
.divider {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 5;
  width: 10px;
  cursor: col-resize;
  touch-action: none;
}

.divider--library {
  left: calc(var(--library-column) - 5px);
}

.divider--result {
  right: calc(var(--result-column) - 5px);
}

.divider::after {
  position: absolute;
  inset: 0 4px;
  border-radius: 2px;
  background: var(--accent-ink);
  opacity: 0;
  transition: opacity 140ms;
  content: "";
}

.divider:hover::after,
.divider:active::after,
.divider:focus-visible::after {
  opacity: 1;
}

.divider:focus-visible {
  outline: none;
}

.column--canvas {
  display: flex;
  flex-direction: column;
}

/* The switch sits at the middle of the whole workspace, so it stays put while the columns come and go.
   The canvas column keeps its room. */
.column--canvas {
  padding-top: 3.1rem;
}

.view-tabs {
  position: absolute;
  z-index: 6;
  top: 0.5rem;
  left: 50%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  translate: -50% 0;
  border-radius: 10px;
  background: var(--panel-fill);
  padding: 3px;
}

/* One pill under both buttons slides to the chosen one. */
.view-pill {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 3px;
  width: calc(50% - 3px);
  border-radius: 7px;
  background: var(--color-lime);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.2);
  transition: transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

.view-tabs.is-chart .view-pill {
  transform: translateX(100%);
}

.view-tabs button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border-radius: 7px;
  padding: 0.35rem 0.9rem;
  font-size: 13.5px;
  font-weight: 700;
  white-space: nowrap;
  color: var(--panel-soft);
  transition: color 200ms;
}

.view-tabs button.is-on {
  color: var(--color-ink);
}

/* Going to the chart the columns leave quickly to their own sides; coming back they arrive a little slower. */
.column--library,
.column--result {
  transition: transform 460ms cubic-bezier(0.22, 1, 0.36, 1), opacity 380ms cubic-bezier(0.22, 1, 0.36, 1);
}

.are-sides-tucked > .column--library,
.are-sides-tucked > .column--result {
  opacity: 0;
  pointer-events: none;
  transition: transform 300ms cubic-bezier(0.4, 0, 1, 1), opacity 260ms cubic-bezier(0.4, 0, 1, 1);
}

.are-sides-tucked > .column--library {
  transform: translateX(-100%);
}

.are-sides-tucked > .column--result {
  transform: translateX(100%);
}

.are-sides-tucked > .divider {
  display: none;
}

/* A view comes into focus: from a little lower, a little smaller and soft, to its place. */
.chart-swap-enter-active,
.canvas-swap-enter-active {
  transition: opacity 560ms cubic-bezier(0.22, 1, 0.36, 1), transform 640ms cubic-bezier(0.22, 1, 0.36, 1), filter 520ms cubic-bezier(0.22, 1, 0.36, 1);
}

.chart-swap-enter-from,
.canvas-swap-enter-from {
  opacity: 0;
  transform: translateY(14px) scale(0.985);
  filter: blur(8px);
}

/* The chart, coming and going, lies over the whole workspace, whatever the columns are doing under it, so
   it never changes size on the way. */
.chart-swap-enter-active,
.chart-swap-leave-active {
  position: absolute;
  z-index: 2;
  inset: 3.1rem 0 0;
}

.chart-swap-leave-active {
  transition: opacity 240ms cubic-bezier(0.4, 0, 1, 1), filter 240ms cubic-bezier(0.4, 0, 1, 1);
}

.chart-swap-leave-to {
  opacity: 0;
  filter: blur(6px);
}

/* The canvas leaves where it stands; it has already begun to fade (below). */
.canvas-swap-leave-active {
  transition: opacity 200ms cubic-bezier(0.4, 0, 1, 1) !important;
}

.canvas-swap-leave-to {
  opacity: 0;
}

/* Going to the chart, the canvas softens and fades where it stands while the columns slide away. */
.is-canvas-leaving .column--canvas > .canvas {
  opacity: 0;
  filter: blur(6px);
  transform: scale(0.985);
  transition: opacity 260ms cubic-bezier(0.4, 0, 1, 1), filter 260ms cubic-bezier(0.4, 0, 1, 1), transform 300ms cubic-bezier(0.4, 0, 1, 1);
}

@media (prefers-reduced-motion: reduce) {
  .view-pill,
  .column--library,
  .column--result,
  .are-sides-tucked > .column--library,
  .are-sides-tucked > .column--result {
    transition: none;
  }

  .are-sides-tucked > .column--library,
  .are-sides-tucked > .column--result {
    transform: none;
  }

  .chart-swap-enter-active,
  .canvas-swap-enter-active,
  .chart-swap-leave-active {
    transition: opacity 120ms linear;
  }

  .chart-swap-enter-from,
  .canvas-swap-enter-from,
  .chart-swap-leave-to {
    transform: none;
    filter: none;
  }

  .is-canvas-leaving .column--canvas > .canvas {
    filter: none;
    transform: none;
    transition: opacity 120ms linear;
  }
}

.view-tabs button:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

/* Either view takes the room under the tabs, whatever height it asks for on its own. */
.column--canvas > .centre-view {
  height: auto;
  min-height: 0;
  flex: 1;
}

.column {
  min-width: 0;
  min-height: 0;
}

.column--library {
  overflow-x: hidden;
  overflow-y: auto;
  /* Room for the scrollbar is kept even when nothing scrolls, so opening an entry never narrows the column. */
  scrollbar-gutter: stable;
  overscroll-behavior: contain;
  border-right: 1px solid var(--panel-line);
  background: var(--panel);
}

.column--result {
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--panel-line);
  background: var(--panel);
}

.right-tabs {
  display: flex;
  gap: 2px;
  margin: 0.6rem 0.75rem;
  border-radius: 10px;
  background: var(--panel-fill);
  padding: 3px;
}

.right-tabs button,
.mobile-tabs button {
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border-radius: 7px;
  padding: 0.4rem;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--panel-soft);
  transition: background-color 140ms, color 140ms;
}

.right-tabs button.is-on,
.mobile-tabs button.is-on {
  background: var(--panel);
  color: var(--panel-ink);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.15), inset 0 0 0 1px var(--panel-line);
}

.right-tabs button:focus-visible,
.mobile-tabs button:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.right-body {
  min-height: 0;
  flex: 1;
}

.right-body > * {
  height: 100%;
}

/* The result takes the room the settings and the small print leave, so its empty state sits mid-column. */
.right-scroll {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.right-scroll > :first-child {
  flex: 1 0 auto;
}

.disclaimer {
  padding: 0.75rem 1rem 1rem;
  font-size: 12px;
  color: var(--panel-soft);
}

.disclaimer a {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.disclaimer a:hover {
  color: var(--panel-ink);
}

.mobile-tabs {
  display: none;
}

/* Below 1100px the three columns become three tabs, one at a time. */
@media (max-width: 1099px) {
  .mobile-tabs {
    display: flex;
    gap: 2px;
    margin: 0.5rem 0.75rem;
    border-radius: 10px;
    background: var(--panel-fill);
    padding: 3px;
  }

  .workspace {
    grid-template-columns: minmax(0, 1fr);
  }

  .column--library,
  .column--result {
    border: 0;
  }

  .divider {
    display: none;
  }

  .workspace.is-marking[data-tab] > .column.column--canvas {
    display: flex;
  }

  .workspace[data-tab="library"] .column:not(.column--library),
  .workspace[data-tab="strategy"] .column:not(.column--canvas),
  .workspace[data-tab="result"] .column:not(.column--result) {
    display: none;
  }
}
</style>
