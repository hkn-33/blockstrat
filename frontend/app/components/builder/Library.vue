<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import type { InstrumentInfo } from '~/types/api'
import { INDICATOR_BLOCKS, READY_CONDITIONS, byIdea, indicatorBlock, indicatorIcon, type IndicatorKind } from '~/utils/blockLibrary'
import type { GuideStep } from '~/utils/strategyGuide'
import type { Item, LimitKind } from '~/utils/strategyDocument'

// The left column, in four tabs that follow the guide: Market, Buy, Sell and Learn. Buy and Sell offer ready
// conditions for that moment, under the idea each belongs to, and a "make your own" tile to set up before
// adding. Blocks drag onto the canvas or go in with a click. Hovering a condition shows what its indicator
// is, drawn on real candles; any indicator opens on a large chart to study.
const props = defineProps<{ instruments: InstrumentInfo[], chosen: string[], step: GuideStep, sides: { id: string, direction: 'long' | 'short' }[], sideId: string }>()
const emit = defineEmits<{
  'update:sideId': [id: string]
  addCondition: [item: Item, target: 'entry' | 'exit']
  toggleMarket: [symbol: string]
  addRisk: [kind: LimitKind, percent: number]
}>()

type Tab = 'market' | 'buy' | 'sell' | 'learn'
const TABS: { value: Tab, label: string, icon: string }[] = [
  { value: 'market', label: 'Market', icon: 'coins' },
  { value: 'buy', label: 'Get in', icon: 'log-in' },
  { value: 'sell', label: 'Get out', icon: 'log-out' },
  { value: 'learn', label: 'Learn', icon: 'book-open' },
]

const IDEA_ICONS: Record<string, string> = {
  'Trend': 'trending-up',
  'Dips and peaks': 'arrow-down-up',
  'Momentum': 'zap',
  'Breakouts': 'arrow-up-from-line',
  'Volume': 'audio-lines',
}

// The groups the Get in / Get out tabs add to, named for the side they belong to.
const isShort = computed(() => props.sides.find(side => side.id === props.sideId)?.direction === 'short')
const entryName = computed(() => (isShort.value ? 'Sell short when' : 'Buy when'))
const exitName = computed(() => (isShort.value ? 'Buy back when' : 'Sell when'))

const tab = ref<Tab>('market')
const query = ref('')
const stopLoss = ref(5)
const takeProfit = ref(15)
const trailingStop = ref(10)

// The limits in the order the Get out tab lists them; each can be dragged onto a side's exit card.
const LIMIT_KINDS: LimitKind[] = ['stopLoss', 'takeProfit', 'trailingStop']

function cloneLimit(kind: LimitKind): { limit: LimitKind, percent: number } {
  return { limit: kind, percent: { stopLoss: stopLoss.value, takeProfit: takeProfit.value, trailingStop: trailingStop.value }[kind] }
}
const expanded = ref<IndicatorKind | null>(null)
const root = ref<HTMLDivElement | null>(null)

// The tabs follow the guide, so the blocks the user needs next are the ones on screen.
const STEP_TABS: Partial<Record<GuideStep, Tab>> = { market: 'market', entry: 'buy', exit: 'sell' }
watch(() => props.step, (step) => {
  const next = STEP_TABS[step]
  if (next) tab.value = next
}, { immediate: true })

const words = computed(() => query.value.trim().toLowerCase())
const matches = (text: string) => !words.value || text.toLowerCase().includes(words.value)

const markets = computed(() => props.instruments.filter(instrument => matches(instrument.label)))

const BUY_START = { left: { kind: 'rsi', period: 14 }, operator: 'lt', right: { kind: 'constant', value: 30 } } as const
const SELL_START = { left: { kind: 'rsi', period: 14 }, operator: 'gt', right: { kind: 'constant', value: 70 } } as const

// Rising signals open a long and close a short; falling signals open a short and close a long.
function readyFor(part: 'entry' | 'exit') {
  const wanted = (part === 'entry') !== isShort.value ? 'buy' : 'sell'
  return READY_CONDITIONS.filter(condition => condition.side === wanted && matches(`${condition.label} ${condition.idea} ${indicatorBlock(condition.kind).name}`))
}
const buyConditions = computed(() => readyFor('entry'))
const sellConditions = computed(() => readyFor('exit'))
const readyLists = computed(() => [
  { part: 'entry', tab: 'buy', target: entryName.value, start: BUY_START, title: 'Ready conditions to get in', sections: byIdea(buyConditions.value) },
  { part: 'exit', tab: 'sell', target: exitName.value, start: SELL_START, title: 'Ready conditions to get out', sections: byIdea(sellConditions.value) },
] as const)
const indicators = computed(() => INDICATOR_BLOCKS.filter(block => matches(`${block.name} ${block.short}`)))

// A search looks in every tab at once.
const isSearching = computed(() => words.value.length > 0)
const showTab = (name: Tab) => isSearching.value || tab.value === name

function cloneCondition(condition: { build: () => Item }): Item {
  return condition.build()
}

function cloneMarket(instrument: InstrumentInfo): { market: string } {
  return { market: instrument.symbol }
}

// ---------- Hover help ----------
const hovered = ref<{ kind: IndicatorKind, top: number, left: number } | null>(null)
let hoverTimer: ReturnType<typeof setTimeout> | undefined
const CARD_HEIGHT = 340

function startDrag(): void {
  clearTimeout(hoverTimer)
  hovered.value = null
}

function showHelp(kind: IndicatorKind, event: Event): void {
  // A block in hand (Sortable puts its copy on <body>) passes over other blocks; their help stays away, and
  // so does it while the large chart covers the page.
  if (studied.value || document.querySelector('body > .sortable-fallback')) return
  const item = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const column = root.value?.getBoundingClientRect()
  clearTimeout(hoverTimer)
  hoverTimer = setTimeout(() => {
    const top = Math.min(Math.max(12, item.top - 24), window.innerHeight - CARD_HEIGHT - 12)
    hovered.value = { kind, top, left: (column?.right ?? item.right) + 10 }
  }, hovered.value ? 0 : 140)
}

function hideHelp(): void {
  clearTimeout(hoverTimer)
  hoverTimer = setTimeout(() => (hovered.value = null), 80)
}

const PREVIEW_LEGEND: Record<IndicatorKind, string> = {
  price: 'Solana\'s daily candles',
  sma: 'Solana, with the 50-day SMA in colour',
  ema: 'Solana, with the 20-day EMA in colour and the 50-day SMA in grey',
  rsi: 'Solana, with the 14-day RSI underneath; the dashed lines are 70 and 30',
  macd: 'Solana, with MACD (colour), its signal (grey) and the gap between them',
  bollinger: 'Solana, with the 20-day Bollinger Bands around its average',
  highest: 'Solana, with the highest high of the previous 20 days in colour',
  lowest: 'Solana, with the lowest low of the previous 10 days in colour',
  change: 'Solana, with its change over 7 days in % underneath; the dashed line is 0',
  relative_volume: 'Solana, with each day\'s volume against its 20-day average underneath; the dashed line is 1, an ordinary day',
  stochastic: 'Solana, with the 14-day stochastic %K (colour) and %D (grey) underneath; the dashed lines are 80 and 20',
}

// ---------- Large chart ----------
const studied = ref<IndicatorKind | null>(null)

function study(kind: IndicatorKind): void {
  clearTimeout(hoverTimer)
  hovered.value = null
  studied.value = kind
}

function useStudied(kind: IndicatorKind, part: 'entry' | 'exit'): void {
  emit('addCondition', indicatorBlock(kind).build(), part)
}

onBeforeUnmount(() => clearTimeout(hoverTimer))
</script>

<template>
  <div ref="root" class="library">
    <div class="library-head">
      <label class="search">
        <UiIcon name="search" />
        <span class="sr-only">Search blocks</span>
        <input v-model="query" type="search" placeholder="Search, e.g. RSI">
      </label>
      <div v-if="!isSearching" class="tabs" role="tablist" aria-label="Block groups">
        <button v-for="option in TABS" :key="option.value" type="button" role="tab" :aria-selected="tab === option.value" :class="{ 'is-on': tab === option.value }" @click="tab = option.value">
          <UiIcon :name="option.icon" class="tab-icon" /> {{ option.label }}
        </button>
      </div>
    </div>

    <div class="library-body" data-replay-source="conditions">
      <!-- Market -->
      <section v-if="showTab('market') && markets.length" class="section">
        <h2 class="section-title">
          Pick one or more markets to test on, Binance prices since 2017
        </h2>
        <VueDraggable :model-value="markets" tag="ul" class="entries" :group="{ name: 'markets', pull: 'clone', put: false }" :sort="false" :clone="cloneMarket" :force-fallback="true" :fallback-on-body="true" :fallback-tolerance="4" drag-class="is-dragging" ghost-class="drop-preview">
          <li v-for="instrument in markets" :key="instrument.symbol" class="entry-row" :data-replay-source="`market:${instrument.symbol}`">
            <button type="button" class="entry" :aria-pressed="chosen.includes(instrument.symbol)" @click="emit('toggleMarket', instrument.symbol)">
              <CoinMark :symbol="instrument.symbol" />
              <span class="entry-label min-w-0">{{ instrument.label }}</span>
              <UiIcon v-if="chosen.includes(instrument.symbol)" name="check" class="entry-add entry-add--chosen" />
              <UiIcon v-else name="plus" class="entry-add" />
            </button>
          </li>
        </VueDraggable>
      </section>

      <div v-if="sides.length > 1 && (tab === 'buy' || tab === 'sell') && !isSearching" class="side-pick" role="radiogroup" aria-label="Which side the blocks go to">
        <span class="side-pick-label">Add to</span>
        <button v-for="side in sides" :key="side.id" type="button" role="radio" :aria-checked="side.id === sideId" :class="[{ 'is-on': side.id === sideId }, `side-pick--${side.direction}`]" @click="emit('update:sideId', side.id)">
          {{ side.direction === 'long' ? 'Long' : 'Short' }}
        </button>
      </div>

      <!-- Buy and Sell -->
      <template v-for="list in readyLists" :key="list.part">
        <template v-if="showTab(list.tab)">
          <BuilderConditionComposer v-if="!isSearching" :target="list.target" :start="list.start" @add="emit('addCondition', $event, list.part)" />
          <section v-if="list.part === 'exit' && !isSearching" class="section">
            <h2 class="section-title">
              Limits that close the trade
            </h2>
            <VueDraggable :model-value="LIMIT_KINDS" class="limits" :group="{ name: 'limits', pull: 'clone', put: false }" :sort="false" :clone="cloneLimit" :force-fallback="true" :fallback-on-body="true" :fallback-tolerance="4" filter="input, button" :prevent-on-filter="false" drag-class="is-dragging">
              <label class="limit">
                <span class="entry-label">Stop-loss</span>
                <span class="entry-detail">Close the trade once it has lost this much</span>
                <span class="limit-row">
                  <input v-model.number="stopLoss" type="number" inputmode="decimal" min="0.5" max="99" step="0.5" aria-label="Stop-loss, in %">
                  %
                  <button type="button" class="limit-add" @click="emit('addRisk', 'stopLoss', stopLoss)">Add</button>
                </span>
              </label>
              <label class="limit">
                <span class="entry-label">Take-profit</span>
                <span class="entry-detail">Close the trade once it has gained this much</span>
                <span class="limit-row">
                  <input v-model.number="takeProfit" type="number" inputmode="decimal" min="0.5" max="1000" step="0.5" aria-label="Take-profit, in %">
                  %
                  <button type="button" class="limit-add" @click="emit('addRisk', 'takeProfit', takeProfit)">Add</button>
                </span>
              </label>
              <label class="limit">
                <span class="entry-label">Trailing stop</span>
                <span class="entry-detail">{{ isShort ? 'Close the trade once the price has risen this far from its lowest level since you got in' : 'Close the trade once the price has fallen this far from its best level since you got in' }}</span>
                <span class="limit-row">
                  <input v-model.number="trailingStop" type="number" inputmode="decimal" min="0.5" max="99" step="0.5" aria-label="Trailing stop, in %">
                  %
                  <button type="button" class="limit-add" @click="emit('addRisk', 'trailingStop', trailingStop)">Add</button>
                </span>
              </label>
            </VueDraggable>
          </section>
          <section v-if="list.sections.length" class="section">
            <h2 class="section-title">
              {{ list.title }}
            </h2>
            <div v-for="section in list.sections" :key="section.idea" class="idea">
              <h3 class="idea-title">
                <UiIcon v-if="IDEA_ICONS[section.idea]" :name="IDEA_ICONS[section.idea]!" /> {{ section.idea }}
              </h3>
              <VueDraggable :model-value="section.conditions" tag="ul" class="entries" :group="{ name: 'conditions', pull: 'clone', put: false }" :sort="false" :clone="cloneCondition" :force-fallback="true" :fallback-on-body="true" :fallback-tolerance="4" filter=".entry-study" :prevent-on-filter="false" drag-class="is-dragging" ghost-class="drop-preview" @start="startDrag">
                <li v-for="condition in section.conditions" :key="condition.label" class="entry-row">
                  <button type="button" class="entry" @click="emit('addCondition', condition.build(), list.part)" @mouseenter="showHelp(condition.kind, $event)" @mouseleave="hideHelp" @focus="showHelp(condition.kind, $event)" @blur="hideHelp">
                    <span class="entry-mark" :class="{ 'entry-mark--sell': list.part === 'exit' }"><UiIcon :name="indicatorIcon(condition.kind)" /></span>
                    <span class="min-w-0">
                      <span class="entry-label">{{ condition.label }}</span>
                      <span class="entry-detail">{{ indicatorBlock(condition.kind).short }}</span>
                    </span>
                    <UiIcon name="plus" class="entry-add" />
                  </button>
                  <button type="button" class="entry-study" v-tip="`Study ${indicatorBlock(condition.kind).name} on a large chart`" @click="study(condition.kind)">
                    <UiIcon name="expand" />
                  </button>
                </li>
              </VueDraggable>
            </div>
          </section>
        </template>
      </template>

      <!-- Learn -->
      <section v-if="showTab('learn') && indicators.length" class="section">
        <h2 class="section-title">
          What each indicator measures
        </h2>
        <ul class="grid gap-1.5">
          <li v-for="block in indicators" :key="block.kind" class="learn" :class="{ 'is-open': expanded === block.kind }">
            <button type="button" class="learn-head" :aria-expanded="expanded === block.kind" @click="expanded = expanded === block.kind ? null : block.kind">
              <span class="learn-icon"><UiIcon :name="indicatorIcon(block.kind)" /></span>
              <span class="min-w-0">
                <span class="entry-label">{{ block.name }}</span>
                <span class="entry-detail">{{ block.short }}</span>
              </span>
              <UiIcon name="chevron-down" class="learn-chevron" />
            </button>
            <div v-if="expanded === block.kind" class="learn-body">
              <p>{{ block.help }}</p>
              <BuilderIndicatorPreview :kind="block.kind" class="mt-2" />
              <p class="help-legend">
                {{ PREVIEW_LEGEND[block.kind] }}
              </p>
              <button type="button" class="study" @click="study(block.kind)">
                <UiIcon name="expand" /> Study it on a large chart
              </button>
              <div class="mt-2 flex flex-wrap gap-2">
                <button type="button" class="limit-add" @click="emit('addCondition', block.build(), 'entry')">
                  Use when buying
                </button>
                <button type="button" class="limit-add" @click="emit('addCondition', block.build(), 'exit')">
                  Use when selling
                </button>
              </div>
            </div>
          </li>
        </ul>
      </section>

      <p v-if="isSearching && !markets.length && !buyConditions.length && !sellConditions.length && !indicators.length" class="empty">
        No block matches "{{ query }}"
      </p>
    </div>

    <BuilderIndicatorDialog v-if="studied" :kind="studied" :legend="PREVIEW_LEGEND[studied]" @close="studied = null" @use="useStudied(studied, $event)" />

    <Teleport to="body">
      <div v-show="hovered" class="help" :class="{ 'is-shown': hovered }" :style="hovered ? { top: `${hovered.top}px`, left: `${hovered.left}px` } : {}" role="tooltip">
        <template v-if="hovered">
          <p class="help-title">
            {{ indicatorBlock(hovered.kind).name }}
          </p>
          <p class="help-text">
            {{ indicatorBlock(hovered.kind).help }}
          </p>
        </template>
        <ClientOnly>
          <BuilderIndicatorPreview v-if="hovered" :kind="hovered.kind" class="mt-3" />
        </ClientOnly>
        <p v-if="hovered" class="help-legend">
          {{ PREVIEW_LEGEND[hovered.kind] }}
        </p>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.library {
  display: flex;
  min-width: 0;
  flex-direction: column;
  font-size: 13.5px;
}

.library-head {
  position: sticky;
  top: 0;
  z-index: 2;
  display: grid;
  gap: 0.6rem;
  border-bottom: 1px solid var(--panel-line);
  background: var(--panel);
  padding: 0.9rem 1rem 0.75rem;
}

.library-body {
  display: grid;
  min-width: 0;
  gap: 1.1rem;
  padding: 1rem;
}

.library-body > * {
  min-width: 0;
}

.search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 12px;
  background: var(--panel-fill);
  padding: 0.55rem 0.75rem;
  color: var(--panel-soft);
  box-shadow: inset 0 0 0 1px var(--panel-line);
}

.search input {
  min-width: 0;
  flex: 1;
  background: transparent;
  color: var(--panel-ink);
}

.search input:focus {
  outline: none;
}

.search:focus-within {
  box-shadow: inset 0 0 0 1.5px var(--focus);
}

.tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 2px;
  border-radius: 10px;
  background: var(--panel-fill);
  padding: 3px;
}

/* Each tab is its glyph over its name, so four fit a narrow column. */
.tabs button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  border-radius: 7px;
  padding: 0.35rem 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--panel-soft);
  transition: background-color 140ms, color 140ms;
}

.tabs button.is-on {
  background: var(--panel);
  color: var(--panel-ink);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.15), inset 0 0 0 1px var(--panel-line);
}

.section-title {
  margin-bottom: 0.4rem;
  font-size: 12px;
  font-weight: 700;
  color: var(--panel-soft);
}

.entries {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.15rem;
}

.idea + .idea {
  margin-top: 0.55rem;
}

.idea-title {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0 0 0.1rem 0.5rem;
  font-size: 12px;
  font-weight: 600;
  color: var(--panel-ink);
}

.idea-title svg {
  width: 0.9rem;
  height: 0.9rem;
  color: var(--accent-ink);
}

/* list-style: the dragged copy is moved onto <body>, outside its list, where a list item gets a bullet. */
.entry-row {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  border-radius: 10px;
  list-style: none;
  transition: background-color 140ms;
}

.entry-row:hover,
.entry-row:focus-within {
  background: var(--panel-fill);
}

.entry {
  display: flex;
  width: 100%;
  min-width: 0;
  flex: 1;
  align-items: flex-start;
  gap: 0.6rem;
  cursor: grab;
  border-radius: 10px;
  padding: 0.45rem 0.5rem;
  text-align: left;
}

/* Beside the row's plus, not inside its button: opens the indicator on the large chart. */
.entry-study {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  flex-shrink: 0;
  place-items: center;
  margin: 0.3rem 0.3rem 0 0;
  border-radius: 8px;
  color: var(--panel-soft);
  opacity: 0;
  transition: opacity 140ms, background-color 140ms, color 140ms;
}

.entry-study .ui-icon {
  width: 0.95rem;
  height: 0.95rem;
}

.entry-row:hover .entry-study,
.entry-row:focus-within .entry-study {
  opacity: 1;
}

.entry-study:hover {
  background: var(--panel);
  color: var(--panel-ink);
}

@media (hover: none) {
  .entry-study {
    opacity: 1;
  }
}

.entry-row.drop-preview .entry-study,
.entry-row.is-ghost .entry-study,
.entry-row.is-dragging .entry-study {
  display: none;
}

/* Each ready condition shows its indicator's glyph, tinted for getting in or getting out. */
.entry-mark {
  display: grid;
  width: 1.9rem;
  height: 1.9rem;
  flex-shrink: 0;
  place-items: center;
  border-radius: 9px;
  background: color-mix(in srgb, var(--color-gain) 16%, transparent);
  color: var(--gain-ink);
  transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
}

.entry-mark svg {
  width: 1rem;
  height: 1rem;
}

.entry:hover .entry-mark {
  transform: scale(1.08);
}

.entry-mark--sell {
  background: color-mix(in srgb, var(--color-loss) 16%, transparent);
  color: var(--loss-ink);
}

.tab-icon {
  width: 0.95rem;
  height: 0.95rem;
}

@media (prefers-reduced-motion: reduce) {
  .entry-mark {
    transition: none;
  }
}

/* Names and descriptions wrap rather than being cut: a newcomer needs the whole sentence. */
.entry-label {
  display: block;
  font-weight: 700;
  line-height: 1.3;
}

.entry-detail {
  display: block;
  margin-top: 0.1rem;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
  color: var(--panel-soft);
}

.entry-add {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  margin-left: auto;
  color: var(--panel-soft);
  opacity: 0;
  transition: opacity 140ms;
}

.entry-row:hover .entry-add,
.entry:focus-visible .entry-add {
  opacity: 1;
}

.entry-add--chosen {
  color: var(--accent-ink);
  opacity: 1;
}

/* Where the block will land: the block itself, see-through, inside a dashed outline in the accent. */
.entry-row.drop-preview,
.entry-row.is-ghost {
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent-ink) 10%, transparent);
  outline: 1.5px dashed var(--accent-ink);
  outline-offset: -1.5px;
  list-style: none;
}

.entry-row.drop-preview .entry,
.entry-row.is-ghost .entry {
  opacity: 0.6;
}

.entry-row.drop-preview .entry-add,
.entry-row.is-ghost .entry-add {
  display: none;
}

.entry-row.is-dragging .entry {
  cursor: grabbing;
  background: var(--panel);
  transform: rotate(-2deg);
  box-shadow: inset 0 0 0 1px var(--tile-line);
  filter: drop-shadow(0 18px 24px rgb(0 0 0 / 0.28));
}

.side-pick {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.side-pick-label {
  margin-right: 0.25rem;
  font-size: 12px;
  font-weight: 700;
  color: var(--panel-soft);
}

.side-pick button {
  flex: 1;
  border-radius: 8px;
  padding: 0.3rem;
  font-size: 13px;
  font-weight: 700;
  color: var(--panel-soft);
  box-shadow: inset 0 0 0 1px var(--panel-line);
  transition: background-color 140ms, color 140ms, box-shadow 140ms;
}

.side-pick button.is-on.side-pick--long {
  background: color-mix(in srgb, var(--gain-ink) 16%, transparent);
  color: var(--gain-ink);
  box-shadow: inset 0 0 0 1.5px var(--gain-ink);
}

.side-pick button.is-on.side-pick--short {
  background: color-mix(in srgb, var(--loss-ink) 16%, transparent);
  color: var(--loss-ink);
  box-shadow: inset 0 0 0 1.5px var(--loss-ink);
}

.side-pick button:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.limits {
  display: grid;
  gap: 0.5rem;
}

.limit {
  cursor: grab;
  background: var(--panel);
}

.limit.is-dragging {
  cursor: grabbing;
  rotate: -2deg;
  filter: drop-shadow(0 18px 24px rgb(0 0 0 / 0.28));
}

.limit {
  display: grid;
  border-radius: 12px;
  padding: 0.6rem 0.7rem;
  box-shadow: inset 0 0 0 1px var(--panel-line);
}

.limit-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.45rem;
  font-weight: 600;
}

.limit-row input {
  width: 4.5rem;
  border-radius: 8px;
  background: var(--panel-fill);
  padding: 0.3rem 0.5rem;
  font-weight: 700;
  color: var(--panel-ink);
  box-shadow: inset 0 0 0 1px var(--panel-line);
}

.limit-add {
  margin-left: auto;
  border-radius: 8px;
  padding: 0.3rem 0.7rem;
  font-size: 12.5px;
  font-weight: 700;
  box-shadow: inset 0 0 0 1px var(--panel-line);
  transition: background-color 140ms;
}

.limit-add:hover {
  background: var(--panel-fill);
}

.learn {
  border-radius: 12px;
  box-shadow: inset 0 0 0 1px var(--panel-line);
}

.learn-icon {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  place-items: center;
  border-radius: 9px;
  background: var(--panel-fill);
  color: var(--accent-ink);
}

.learn-icon svg {
  width: 1.05rem;
  height: 1.05rem;
}

/* Every entry has the same height however narrow the column: the name on one line, the description on two.
   The whole of both is in the entry once it is opened. */
.learn-head {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.65rem;
  padding: 0.6rem 0.7rem;
  text-align: left;
}

.learn-chevron {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  margin-left: auto;
  color: var(--panel-soft);
  transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.learn.is-open .learn-chevron {
  transform: rotate(180deg);
}

.learn-body {
  padding: 0 0.7rem 0.7rem;
  line-height: 1.5;
  color: var(--panel-soft);
}

.study {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.5rem;
  border-radius: 8px;
  padding: 0.3rem 0.55rem 0.3rem 0.45rem;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--panel-ink);
  transition: background-color 140ms;
}

.study .ui-icon {
  width: 0.95rem;
  height: 0.95rem;
}

.study:hover {
  background: var(--panel-fill);
}

.empty {
  color: var(--panel-soft);
}

.tabs button:focus-visible,
.entry:focus-visible,
.entry-study:focus-visible,
.study:focus-visible,
.limit-add:focus-visible,
.learn-head:focus-visible,
.limit-row input:focus {
  outline: 2px solid var(--focus);
  outline-offset: -2px;
}

.help {
  position: fixed;
  z-index: 90;
  width: 22rem;
  border-radius: 16px;
  background: var(--panel);
  padding: 1rem;
  color: var(--panel-ink);
  pointer-events: none;
  box-shadow: inset 0 0 0 1px var(--panel-line), 0 28px 56px -24px rgb(0 0 0 / 0.5);
  transition: top 160ms cubic-bezier(0.22, 1, 0.36, 1);
}

.help-title {
  font-weight: 700;
}

.help-text {
  margin-top: 0.35rem;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--panel-soft);
}

.help-legend {
  margin-top: 0.4rem;
  font-size: 11.5px;
  color: var(--panel-soft);
}

@media (prefers-reduced-motion: reduce) {
  .help {
    transition: none;
  }

  .entry-row.is-dragging .entry {
    transform: none;
  }
}
</style>

<style scoped>
.learn-head .entry-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.learn-head .entry-detail {
  display: -webkit-box;
  overflow: hidden;
  height: 2.7em;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
</style>
