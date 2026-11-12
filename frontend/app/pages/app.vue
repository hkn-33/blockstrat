<script setup lang="ts">
import type { ExecutionPreset, InstrumentInfo, StrategyDraft } from '~/types/api'
import type { Item, LimitKind } from '~/utils/strategyDocument'

// The builder in three columns: the block library on the left, the strategy as cards on a canvas in the
// middle, and the result with the assistant on the right. A first visit starts empty and guided.
useHead({ title: 'BlockStrat builder', bodyAttrs: { class: 'app' } })

// The landing page's featured strategy, one click away for anyone who wants to see a finished one.
const EXAMPLE = STRATEGY_TEMPLATES[0]!
const DEFAULT_EXECUTION = EXAMPLE.strategy.execution

const api = useApi()
const backtest = useBacktest()
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
  else backtest.schedulePreview(current)
})

watch(name, saveCurrentName)

function open(strategy: StrategyDraft, strategyName: string): void {
  editor.replace(documentFromDraft(strategy))
  name.value = strategyName
}

/** Opens a finished strategy by building it in front of the user, then shows its result. */
async function build(strategy: StrategyDraft, strategyName: string): Promise<void> {
  name.value = strategyName
  mobileTab.value = 'strategy'
  await replay.play(documentFromDraft(strategy))
  rightTab.value = 'result'
}

function useExample(): void {
  build(EXAMPLE.strategy, EXAMPLE.name)
}

// The JSON is an advanced tool: leaving advanced mode leaves its tab too.
watch(isAdvanced, (isOn) => {
  if (!isOn && rightTab.value === 'json') rightTab.value = 'result'
})

function startNew(): void {
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

// Both run every chosen market; markets whose result is already current are not sent again.
function runFull(): void {
  backtest.run(draft.value, 'full')
}

function retry(): void {
  backtest.run(draft.value, 'preview')
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

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  const start = startingPoint()
  // The first document is not an edit, so it gets no undo step.
  if (start.strategy) editor.document.value = documentFromDraft(start.strategy)
  name.value = start.name
  isReady.value = true
  if (start.strategy) backtest.schedulePreview(draft.value)
  try {
    const [instrumentList, executionPresets] = await Promise.all([api.instruments(), api.executionPresets()])
    instruments.value = instrumentList.instruments
    presets.value = executionPresets
  }
  catch {
    notice.value = 'The backtest server is not reachable. You can still build; results appear once it is back.'
  }
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="app builder">
    <BuilderToolbar :draft="draft" :name="name" @open="open" @start-new="startNew" />

    <p v-if="notice" class="notice" role="alert">
      {{ notice }}
      <button type="button" class="ml-auto font-bold" @click="notice = null">
        Dismiss
      </button>
    </p>

    <div class="mobile-tabs" role="tablist" aria-label="Builder views">
      <button v-for="tab in (['library', 'strategy', 'result'] as const)" :key="tab" type="button" role="tab" :aria-selected="mobileTab === tab" :class="{ 'is-on': mobileTab === tab }" @click="mobileTab = tab">
        {{ tab === 'library' ? 'Blocks' : tab === 'strategy' ? 'Strategy' : 'Result' }}
      </button>
    </div>

    <main class="workspace" :data-tab="mobileTab">
      <aside class="column column--library" aria-label="Blocks">
        <BuilderLibrary :instruments="instruments" :chosen="editor.document.value.instruments" :step="step" :sides="sideChoices" :side-id="targetSide.id" @update:side-id="chosenSideId = $event" @add-condition="addCondition" @toggle-market="toggleMarket" @add-risk="addRisk" />
      </aside>

      <section class="column column--canvas" aria-label="Strategy">
        <BuilderCanvas v-if="isReady" ref="canvas" v-model:name="name" :instruments="instruments" @build="build" @show-json="rightTab = 'json'; mobileTab = 'result'" @use-example="useExample" @start-new="startNew" @describe="rightTab = 'assistant'; mobileTab = 'result'" @open="open" />
      </section>

      <section class="column column--result" aria-label="Result and assistant">
        <div class="right-tabs" role="tablist" aria-label="Result, assistant and JSON">
          <button type="button" role="tab" :aria-selected="rightTab === 'result'" :class="{ 'is-on': rightTab === 'result' }" @click="rightTab = 'result'">
            Result
          </button>
          <button type="button" role="tab" :aria-selected="rightTab === 'assistant'" :class="{ 'is-on': rightTab === 'assistant' }" @click="rightTab = 'assistant'">
            <UiIcon name="sparkles" /> Assistant
          </button>
          <button v-if="isAdvanced" type="button" role="tab" :aria-selected="rightTab === 'json'" :class="{ 'is-on': rightTab === 'json' }" @click="rightTab = 'json'">
            JSON
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
              @run-full="runFull"
              @retry="retry"
            />
            <BuilderTestSettings :presets="presets" />
            <p class="disclaimer">
              Simulations on historical Binance prices, not investment advice. Past results do not promise future ones.
            </p>
          </div>
          <BuilderAssistantPanel v-show="rightTab === 'assistant'" :current-strategy="draft" @apply="build($event, name || 'From the assistant')" @close="rightTab = 'result'" />
          <BuilderJsonPanel v-show="rightTab === 'json'" :strategy="draft" @close="rightTab = 'result'" />
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
  display: grid;
  min-height: 0;
  flex: 1;
  /* The side columns give way on a narrower screen, so the canvas keeps room for a card and its note. */
  grid-template-columns: clamp(18rem, 20vw, 21rem) minmax(0, 1fr) clamp(24rem, 28vw, 28rem);
}

.column {
  min-width: 0;
  min-height: 0;
}

.column--library {
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  border-right: 1px solid var(--panel-line);
}

.column--result {
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--panel-line);
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

  .workspace[data-tab="library"] .column:not(.column--library),
  .workspace[data-tab="strategy"] .column:not(.column--canvas),
  .workspace[data-tab="result"] .column:not(.column--result) {
    display: none;
  }
}
</style>
