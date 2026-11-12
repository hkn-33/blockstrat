<script setup lang="ts">
import { Handle, Panel, Position, VueFlow, useVueFlow, type Edge, type Node, type XYPosition } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { MiniMap } from '@vue-flow/minimap'
import { VueDraggable } from 'vue-draggable-plus'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import type { InstrumentInfo, StrategyDraft } from '~/types/api'
import type { Direction, LimitKind, SideDocument, Timeframe } from '~/utils/strategyDocument'

// The middle of the builder: the strategy as cards joined top to bottom on a canvas the user moves around,
// with a minimap. Below the market the flow splits into a lane per side (long, short), each ending in its own
// end card, so the different ways in and out are visible at a glance; a dashed branch offers the side that is
// not there yet. Before anything exists it asks for a name; after that an arrow and an outline point at the
// next card to fill, and a checklist ticks along.
defineProps<{ instruments: InstrumentInfo[] }>()
const name = defineModel<string>('name', { required: true })
const emit = defineEmits<{
  showJson: []
  useExample: []
  startNew: []
  describe: []
  open: [strategy: StrategyDraft, name: string]
  build: [strategy: StrategyDraft, name: string]
}>()

const FLOW_ID = 'strategy-canvas'
const CARD_WIDTH = 416
const CARD_GAP = 56
const LANE_GAP = 56
// The room the guide's note and arrow take beside a card.
const HINT_WIDTH = 220
const PACES: { value: Timeframe, label: string }[] = [
  { value: '1h', label: 'Every hour' },
  { value: '4h', label: 'Every 4 hours' },
  { value: '1d', label: 'Once a day' },
]
const QUICK_MARKETS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']
const LANE_PARTS = ['entry', 'exit', 'end'] as const

const editor = useStrategyEditor()
const document = editor.document
const { isAdvanced } = useBuilderMode()
const colorMode = useColorMode()
const { onNodesInitialized, onNodesChange, onNodeDragStop, findNode, updateNode, fitView, zoomIn, zoomOut, setCenter, getViewport } = useVueFlow(FLOW_ID)

const step = computed(() => nextGuideStep(document.value, name.value))
const guidedSide = computed(() => guideSide(document.value))
const sides = computed(() => document.value.sides)

// The side the strategy does not have yet, offered on the canvas once there is a market to trade.
const missingDirection = computed<Direction | null>(() => {
  if (sides.value.length === 2) return null
  return sides.value[0]!.direction === 'long' ? 'short' : 'long'
})
const hasMarket = computed(() => document.value.instruments.length > 0)
const canOfferSide = computed(() => missingDirection.value !== null && hasMarket.value)

function sideById(id: string): SideDocument | undefined {
  return document.value.sides.find(side => side.id === id)
}

// ---------- Cards and lanes ----------
const nodes = shallowRef<Node[]>([])
const edges = shallowRef<Edge[]>([])

function edge(source: string, target: string, isOffer = false): Edge {
  return { id: `${source}->${target}`, source, target, type: 'smoothstep', class: isOffer ? 'flow-edge flow-edge--offer' : 'flow-edge' }
}

// The cards follow the sides: a lane of entry, exit and end card for each one.
function buildCards(): void {
  const placed = new Map(nodes.value.map(node => [node.id, node.position]))
  // Cards move by their grip only: everywhere else a drag belongs to the blocks or to the canvas.
  const card = (id: string, type: string, data: Record<string, string> = {}): Node => ({
    id, type, data, position: placed.get(id) ?? { x: -CARD_WIDTH / 2, y: 0 }, dragHandle: '.card-grip',
  })
  const cards = [card('strategy', 'strategy'), card('market', 'market')]
  const links = [edge('strategy', 'market')]
  for (const side of sides.value) {
    cards.push(...LANE_PARTS.map(part => card(`${part}-${side.id}`, part, { sideId: side.id })))
    links.push(edge('market', `entry-${side.id}`), edge(`entry-${side.id}`, `exit-${side.id}`), edge(`exit-${side.id}`, `end-${side.id}`))
  }
  if (canOfferSide.value) {
    cards.push(card('offer', 'offer'))
    links.push(edge('market', 'offer', true))
  }
  if (isAdvanced.value) {
    cards.push(card('costs', 'costs'))
    links.push(...sides.value.map(side => edge(`end-${side.id}`, 'costs')))
  }
  nodes.value = cards
  edges.value = links
}

watch(() => `${sides.value.map(side => side.id).join()} ${canOfferSide.value} ${isAdvanced.value}`, buildCards, { immediate: true })

// Strategy and market sit centred; the lanes run side by side below, the offered side beside the only lane,
// and in advanced mode the costs card closes the flow. When a card grows or shrinks, the ones below it glide
// to keep the gaps even. A card the user dragged keeps its distance from that place until "Tidy up".
const GLIDE_MS = 240
const nudges = ref<Record<string, XYPosition>>({})
const hasNudges = computed(() => Object.keys(nudges.value).length > 0)
const homes = new Map<string, XYPosition>()
const targets = new Map<string, XYPosition>()
let glideFrame = 0

function layout(): void {
  for (const id of [...targets.keys()]) {
    if (!findNode(id)) targets.delete(id)
  }
  const isNew = (id: string): boolean => !targets.has(id)
  const fresh = new Set<string>()
  const place = (id: string, x: number, y: number): number => {
    const node = findNode(id)
    if (!node) return y
    if (isNew(id)) fresh.add(id)
    const nudge = nudges.value[id] ?? { x: 0, y: 0 }
    homes.set(id, { x, y })
    targets.set(id, { x: x + nudge.x, y: y + nudge.y })
    return y + (node.dimensions.height || 120) + CARD_GAP
  }
  const centre = -CARD_WIDTH / 2
  const laneTop = place('market', centre, place('strategy', centre, 0))
  const laneX = sides.value.length === 2 ? [-CARD_WIDTH - LANE_GAP / 2, LANE_GAP / 2] : [centre]
  const laneBottoms = sides.value.map((side, index) => LANE_PARTS.reduce((y, part) => place(`${part}-${side.id}`, laneX[index]!, y), laneTop))
  place('offer', centre + CARD_WIDTH + LANE_GAP, laneTop)
  place('costs', centre, Math.max(...laneBottoms))
  glide(fresh)
}

// A card that has just appeared is put straight in its place: only cards already on screen travel.
function glide(fresh: Set<string>): void {
  cancelAnimationFrame(glideFrame)
  const isStill = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const starts = new Map<string, XYPosition>()
  for (const [id, target] of targets) {
    const node = findNode(id)
    if (node) starts.set(id, fresh.has(id) || isStill ? target : { ...node.position })
  }
  const startedAt = performance.now()
  const frame = (now: number): void => {
    const progress = Math.min((now - startedAt) / GLIDE_MS, 1)
    const eased = 1 - (1 - progress) ** 3
    for (const [id, start] of starts) {
      const target = targets.get(id)!
      updateNode(id, { position: { x: start.x + (target.x - start.x) * eased, y: start.y + (target.y - start.y) * eased } })
    }
    if (progress < 1) glideFrame = requestAnimationFrame(frame)
  }
  frame(isStill ? startedAt + GLIDE_MS : startedAt)
}

onNodeDragStop(({ node }) => {
  const home = homes.get(node.id)
  if (!home) return
  nudges.value = { ...nudges.value, [node.id]: { x: node.position.x - home.x, y: node.position.y - home.y } }
  targets.set(node.id, { ...node.position })
})

function tidyUp(): void {
  nudges.value = {}
  layout()
}

// Readable first: the opening view keeps the cards near full size and starts at the top. It runs again whenever
// the cards are rebuilt, so only a different strategy (a new first side) gets it; a side the user adds is
// brought into view instead.
let openedForSideId: string | null = null
let addedSideCard: string | null = null

onNodesInitialized(async () => {
  layout()
  await nextTick()
  const firstSideId = sides.value[0]!.id
  if (addedSideCard) {
    centreOn(addedSideCard, 0, false)
    addedSideCard = null
    openedForSideId = firstSideId
    return
  }
  if (firstSideId === openedForSideId) return
  openedForSideId = firstSideId
  // With two lanes the first entry card stands off to the left; fitting it too would push the top cards
  // off a phone's screen.
  const openingCards = sides.value.length === 1 ? ['strategy', 'market', `entry-${firstSideId}`] : ['strategy', 'market']
  await fitView({ nodes: openingCards, padding: 0.12, minZoom: 0.85, maxZoom: 1 })
  showGuidedCard(true)
})

onNodesChange((changes) => {
  if (changes.some(change => change.type === 'dimensions')) layout()
})

// Each finished part glides the view to the card the guide points at next.
function guidedCardId(current: string): string | undefined {
  if (current === 'market') return 'market'
  if (current === 'entry' || current === 'exit') return `${current}-${guidedSide.value.id}`
  return undefined
}

// The hints (outline, note and arrow) can be turned off; the choice is remembered.
const hintsOn = ref(loadHintsOn())
watch(hintsOn, (isOn) => {
  saveHintsOn(isOn)
  if (isOn) showGuidedCard()
})

// With its note showing, the view centres on the card and the note together, so the note is never cut off.
function showGuidedCard(isInstant = false): void {
  const id = guidedCardId(step.value)
  if (!id) return
  // The note stands left of the card; on a narrow screen it sits above it and takes no room beside it.
  const isBeside = hintsOn.value && window.matchMedia('(min-width: 1100px)').matches
  centreOn(id, isBeside ? -HINT_WIDTH / 2 : 0, isInstant)
}

function centreOn(nodeId: string, shift: number, isInstant: boolean): void {
  const node = findNode(nodeId)
  if (!node) return
  // Where the card is going, not where it is mid-glide.
  const position = targets.get(nodeId) ?? node.position
  const isStill = isInstant || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  setCenter(position.x + node.dimensions.width / 2 + shift, position.y + node.dimensions.height / 2, { zoom: Math.max(getViewport().zoom, 0.85), duration: isStill ? 0 : 450 })
}

watch(step, () => showGuidedCard())

/** Brings the card a replayed block is about to land on into view: "market", or a side's entry or exit group id. */
function showTarget(target: string): void {
  const side = sides.value.find(candidate => candidate.entry.id === target || candidate.exit.id === target)
  centreOn(side ? `${side.entry.id === target ? 'entry' : 'exit'}-${side.id}` : 'market', 0, false)
}

const canShowHints = computed(() => step.value === 'market' || step.value === 'entry' || step.value === 'exit')

function isGuided(part: 'entry' | 'exit', sideId: string): boolean {
  return hintsOn.value && step.value === part && guidedSide.value.id === sideId
}


// A limit dragged from the library lands on a side's exit card; the row itself never keeps it.
function dropLimit(sideId: string, dropped: unknown[]): void {
  const limit = dropped.find((value): value is { limit: LimitKind, percent: number } => typeof value === 'object' && value !== null && 'limit' in value)
  if (limit) editor.commit(current => setSideLimit(current, sideId, LIMIT_FIELDS[limit.limit], limit.percent))
}

// ---------- Sides ----------
function addMissingSide(): void {
  const direction = missingDirection.value
  if (!direction) return
  editor.commit(current => addSide(current, direction))
  const added = sides.value.find(side => side.direction === direction)
  if (added) addedSideCard = `entry-${added.id}`
}

function dropSide(sideId: string): void {
  editor.commit(current => removeSide(current, sideId))
}

/** How a side's trades end, in words, for its end card. */
function endings(side: SideDocument): string[] {
  const ways: string[] = []
  if (side.exit.items.length) ways.push(side.direction === 'short' ? 'When a buy-back condition is true' : 'When a sell condition is true')
  if (side.stopLossPct !== null) ways.push(`After losing ${side.stopLossPct}% (stop-loss)`)
  if (side.takeProfitPct !== null) ways.push(`After gaining ${side.takeProfitPct}% (take-profit)`)
  if (side.trailingStopPct !== null) {
    ways.push(side.direction === 'short'
      ? `After rising ${side.trailingStopPct}% from its lowest price (trailing stop)`
      : `After falling ${side.trailingStopPct}% from its best price (trailing stop)`)
  }
  return ways
}

const maskColor = computed(() => (colorMode.value === 'light' ? 'rgb(233 242 243 / 0.75)' : 'rgb(4 20 23 / 0.7)'))

// ---------- Name ----------
function describe(strategyName: string): void {
  name.value = strategyName
  emit('describe')
}

function rename(event: Event): void {
  name.value = (event.target as HTMLInputElement).value
}

// ---------- Markets ----------
const isPickingMarket = ref(false)
const marketAnchor = ref<HTMLElement | null>(null)
const addMarketButton = ref<HTMLElement | null>(null)
const allMarketsButton = ref<HTMLElement | null>(null)
const isFull = computed(() => document.value.instruments.length >= MAX_INSTRUMENTS)

function addMarket(symbol: string): void {
  editor.commit(current => addInstrument(current, symbol))
}

function toggleMarket(symbol: string): void {
  editor.commit(current => toggleInstrument(current, symbol))
}

function removeMarket(symbol: string): void {
  editor.commit(current => removeInstrument(current, symbol))
}

function openMarkets(event: MouseEvent): void {
  marketAnchor.value = event.currentTarget as HTMLElement
  isPickingMarket.value = !isPickingMarket.value
}

// The first market picked in the open list swaps "All markets" for "Add market" (and the last one removed
// swaps them back); the list stays open and moves to the button that is there now.
watch([addMarketButton, allMarketsButton], () => {
  if (marketAnchor.value?.isConnected) return
  marketAnchor.value = addMarketButton.value ?? allMarketsButton.value
}, { flush: 'post' })

function setPace(timeframe: Timeframe): void {
  editor.commit(current => ({ ...current, timeframe }))
}

// A market dragged from the library lands here; the list itself never keeps it.
const marketDrop = computed<unknown[]>({
  get: () => [],
  set: (dropped) => {
    const market = dropped.find((value): value is { market: string } => typeof value === 'object' && value !== null && 'market' in value)
    if (market) addMarket(market.market)
  },
})

defineExpose({ fitView: () => fitView({ padding: 0.2, maxZoom: 1, duration: 300 }), showTarget })
</script>

<template>
  <div class="canvas">
    <VueFlow
      :id="FLOW_ID"
      :nodes="nodes"
      :edges="edges"
      :nodes-draggable="true"
      :nodes-connectable="false"
      :elements-selectable="false"
      :pan-on-drag="[0, 1]"
      :pan-on-scroll="true"
      :zoom-on-scroll="false"
      :zoom-on-pinch="true"
      :zoom-on-double-click="false"
      :min-zoom="0.35"
      :max-zoom="1.5"
      :delete-key-code="null"
      class="flow"
    >
      <Background :gap="22" :size="1.2" pattern-color="var(--canvas-dot)" />

      <template #node-strategy>
        <BuilderCanvasCard first>
          <div class="card-body">
            <p class="card-kicker">
              Strategy
            </p>
            <input class="name-input nodrag" :value="name" aria-label="Strategy name" placeholder="Name this strategy" @change="rename">
            <div class="mt-3 flex flex-wrap gap-2">
              <button v-if="isAdvanced" type="button" class="pill-button nodrag" @click="emit('showJson')">
                <UiIcon name="file-json" /> See the JSON
              </button>
              <button type="button" class="pill-button nodrag" @click="emit('startNew')">
                <UiIcon name="file-plus" /> Start a new one
              </button>
              <button type="button" class="pill-button nodrag" @click="emit('useExample')">
                <UiIcon name="play" /> Load the example
              </button>
            </div>
          </div>
        </BuilderCanvasCard>
      </template>

      <template #node-market>
        <BuilderCanvasCard :is-next="hintsOn && step === 'market'" hint="Start here: pick a market" @hide-hints="hintsOn = false">
          <div class="card-body">
            <p class="card-kicker">
              {{ document.instruments.length > 1 ? 'Markets' : 'Market' }}
            </p>
            <VueDraggable v-model="marketDrop" :empty-insert-threshold="60" class="market-drop nodrag" data-replay-target="market" :class="{ 'is-empty': !hasMarket }" :group="{ name: 'markets', put: true, pull: false }" :sort="false">
              <div v-if="hasMarket" class="market-chips">
                <span v-for="symbol in document.instruments" :key="symbol" class="market-chip">
                  <CoinMark :symbol="symbol" />
                  {{ baseCoin(symbol) }}/USDT
                  <button type="button" class="chip-remove" :aria-label="`Remove ${baseCoin(symbol)}/USDT`" @click="removeMarket(symbol)">
                    <UiIcon name="x" />
                  </button>
                </span>
                <button ref="addMarketButton" type="button" class="pill-button" :aria-expanded="isPickingMarket" @click="openMarkets">
                  <UiIcon name="plus" /> Add market
                </button>
              </div>
              <p v-else class="drop-text">
                Drag a market here from the left, or pick one below
              </p>
            </VueDraggable>
            <div v-if="!hasMarket" class="mt-3 flex flex-wrap gap-2">
              <button v-for="symbol in QUICK_MARKETS" :key="symbol" type="button" class="pill-button nodrag" @click="addMarket(symbol)">
                <CoinMark :symbol="symbol" /> {{ baseCoin(symbol) }}
              </button>
              <button ref="allMarketsButton" type="button" class="pill-button nodrag" :aria-expanded="isPickingMarket" @click="openMarkets">
                All {{ instruments.length || 10 }} markets <UiIcon name="chevron-down" />
              </button>
            </div>
            <BuilderPopover v-if="isPickingMarket" :anchor="marketAnchor" label="Markets" @close="isPickingMarket = false">
              <p class="market-note">
                {{ isFull ? `Up to ${MAX_INSTRUMENTS} markets: remove one to pick another` : 'The same rules are tested on each market you pick' }}
              </p>
              <ul class="grid gap-0.5">
                <li v-for="instrument in instruments" :key="instrument.symbol">
                  <button
                    type="button"
                    class="market-choice"
                    :class="{ 'is-on': document.instruments.includes(instrument.symbol) }"
                    :aria-pressed="document.instruments.includes(instrument.symbol)"
                    :disabled="isFull && !document.instruments.includes(instrument.symbol)"
                    @click="toggleMarket(instrument.symbol)"
                  >
                    <CoinMark :symbol="instrument.symbol" /> {{ instrument.label }}
                    <UiIcon v-if="document.instruments.includes(instrument.symbol)" name="check" class="market-check" />
                  </button>
                </li>
              </ul>
            </BuilderPopover>
            <div v-if="hasMarket" class="pace">
              <p class="field-label">
                Check the rules
              </p>
              <div class="segmented nodrag" role="radiogroup" aria-label="How often the rules are checked">
                <button v-for="pace in PACES" :key="pace.value" type="button" role="radio" :aria-checked="document.timeframe === pace.value" :class="{ 'is-on': document.timeframe === pace.value }" @click="setPace(pace.value)">
                  {{ pace.label }}
                </button>
              </div>
            </div>
            <p v-if="isAdvanced && hasMarket" class="card-note">
              <UiIcon name="info" /> Rules are checked when a candle closes. Orders fill at the next candle's open.
            </p>
          </div>
        </BuilderCanvasCard>
      </template>

      <template #node-entry="{ data }">
        <!-- The side's badge pushes this card's drop area down, and the note follows it. -->
        <BuilderCanvasCard v-if="sideById(data.sideId)" style="--guide-top: 4.75rem" :is-next="isGuided('entry', data.sideId)" hint="Now: when should it get in?" @hide-hints="hintsOn = false">
          <div class="lane-head">
            <span class="lane-badge" :class="`lane-badge--${sideById(data.sideId)!.direction}`">{{ sideById(data.sideId)!.direction === 'long' ? 'Long: profits when the price rises' : 'Short: profits when the price falls' }}</span>
            <button v-if="sides.length > 1" type="button" class="lane-remove nodrag" :aria-label="`Remove the ${sideById(data.sideId)!.direction} side`" @click="dropSide(data.sideId)">
              <UiIcon name="x" />
            </button>
          </div>
          <div class="rules">
            <BuilderGroup :group="sideById(data.sideId)!.entry" root="entry" :direction="sideById(data.sideId)!.direction" />
          </div>
        </BuilderCanvasCard>
      </template>

      <template #node-exit="{ data }">
        <BuilderCanvasCard v-if="sideById(data.sideId)" :is-next="isGuided('exit', data.sideId)" hint="Last: when should it get out?" @hide-hints="hintsOn = false">
          <div class="rules">
            <BuilderGroup :group="sideById(data.sideId)!.exit" root="exit" :direction="sideById(data.sideId)!.direction">
              <template #after>
                <VueDraggable :model-value="[]" class="risk nodrag" :group="{ name: 'limits', put: true, pull: false }" :sort="false" :empty-insert-threshold="40" @update:model-value="dropLimit(data.sideId, $event)">
                  <BuilderRiskTile kind="stopLoss" :side-id="data.sideId" />
                  <BuilderRiskTile kind="takeProfit" :side-id="data.sideId" />
                  <BuilderRiskTile kind="trailingStop" :side-id="data.sideId" />
                </VueDraggable>
              </template>
            </BuilderGroup>
          </div>
        </BuilderCanvasCard>
      </template>

      <template #node-end="{ data }">
        <BuilderCanvasCard v-if="sideById(data.sideId)" class="end-card">
          <div class="card-body">
            <p class="end-title">
              <span class="end-dot" :class="`end-dot--${sideById(data.sideId)!.direction}`" />
              {{ sideById(data.sideId)!.direction === 'short' ? 'Bought back, trade closed' : 'Sold, trade closed' }}
            </p>
            <ul v-if="endings(sideById(data.sideId)!).length" class="end-list">
              <li v-for="ending in endings(sideById(data.sideId)!)" :key="ending">
                {{ ending }}
              </li>
            </ul>
            <p v-else class="text-[var(--panel-soft)]">
              No way out yet: add a condition, a stop-loss, a take-profit or a trailing stop above
            </p>
          </div>
        </BuilderCanvasCard>
      </template>

      <template #node-costs>
        <BuilderCanvasCard last>
          <div class="card-body">
            <p class="card-kicker">
              How every trade is counted
            </p>
            <dl class="costs">
              <div><dt>Position size</dt><dd>{{ document.positionSizePct }}% of the account</dd></div>
              <div><dt>Exchange fee</dt><dd>{{ document.execution.commission_pct }}% a buy or a sell</dd></div>
              <div><dt>Slippage</dt><dd>{{ document.execution.slippage_bps }} bps a fill</dd></div>
              <div><dt>Starting cash</dt><dd>$10,000</dd></div>
            </dl>
            <p class="card-note">
              <UiIcon name="sliders-horizontal" /> Change these under the result, in "How it is counted".
            </p>
          </div>
        </BuilderCanvasCard>
      </template>

      <template #node-offer>
        <button type="button" class="offer nodrag" @click="addMissingSide">
          <Handle type="target" :position="Position.Top" class="offer-handle" :connectable="false" />
          <span class="offer-plus"><UiIcon name="plus" /></span>
          <span class="min-w-0">
            <span class="offer-title">{{ missingDirection === 'short' ? 'Add a short side' : 'Add a long side' }}</span>
            <span class="offer-text">{{ missingDirection === 'short' ? 'Also trade when the price falls' : 'Also trade when the price rises' }}</span>
          </span>
        </button>
      </template>

      <Panel v-if="hasNudges || (!hintsOn && canShowHints)" position="top-left" class="canvas-actions">
        <button v-if="hasNudges" type="button" class="pill-button canvas-action" @click="tidyUp">
          <UiIcon name="wand-sparkles" /> Tidy up
        </button>
        <button v-if="!hintsOn && canShowHints" type="button" class="pill-button canvas-action" @click="hintsOn = true">
          <UiIcon name="lightbulb" /> Show hints
        </button>
      </Panel>

      <Panel position="bottom-left" class="zoom">
        <button type="button" aria-label="Zoom in" @click="zoomIn({ duration: 200 })">
          <UiIcon name="plus" />
        </button>
        <button type="button" aria-label="Zoom out" @click="zoomOut({ duration: 200 })">
          <span class="minus" />
        </button>
        <button type="button" aria-label="Fit the whole strategy" @click="fitView({ padding: 0.2, maxZoom: 1, duration: 300 })">
          <UiIcon name="maximize-2" />
        </button>
      </Panel>

      <MiniMap position="bottom-right" pannable zoomable :mask-color="maskColor" :node-border-radius="10" node-class-name="mini-node" class="minimap" aria-label="Map of the strategy" />
    </VueFlow>

    <Transition name="welcome">
      <BuilderWelcome
        v-if="step === 'name'"
        @start="name = $event"
        @describe="describe"
        @open="(strategy, strategyName) => emit('open', strategy, strategyName)"
        @build="(strategy, strategyName) => emit('build', strategy, strategyName)"
      />
    </Transition>
  </div>
</template>

<style scoped>
.canvas {
  position: relative;
  container-type: inline-size;
  height: 100%;
  min-height: 0;
  background: var(--board-bg);
}

.flow {
  --canvas-dot: color-mix(in srgb, var(--panel-ink) 16%, transparent);
  height: 100%;
}

.card-body {
  padding: 1.1rem 1.2rem 1.2rem;
}

.card-kicker {
  font-size: 12px;
  font-weight: 700;
  color: var(--panel-soft);
}

.name-input {
  width: 100%;
  margin-top: 0.2rem;
  border-radius: 8px;
  background: transparent;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--panel-ink);
}

.name-input:focus {
  outline: 2px solid var(--focus);
  outline-offset: 4px;
}

.pill-button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border-radius: 10px;
  padding: 0.4rem 0.7rem;
  font-size: 13px;
  font-weight: 600;
  box-shadow: inset 0 0 0 1px var(--panel-line);
  transition: background-color 140ms, transform 120ms;
}

.pill-button:hover,
.pill-button.is-on {
  background: var(--panel-fill);
}

.pill-button.is-on {
  box-shadow: inset 0 0 0 1.5px var(--accent-ink);
}

.pill-button:active {
  transform: scale(0.97);
}

.market-drop {
  margin-top: 0.6rem;
  border-radius: 12px;
  padding: 0.8rem;
  font-size: 14px;
}

.market-drop.is-empty {
  border: 1.5px dashed var(--tile-line);
}

/* Chosen markets keep their edge in line with the kicker; the padding is only room for the drop highlight. */
.market-drop:not(.is-empty) {
  margin-inline: -0.4rem;
  padding: 0.4rem;
}

.market-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.market-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border-radius: 10px;
  padding: 0.25rem 0.25rem 0.25rem 0.35rem;
  font-size: 13.5px;
  font-weight: 700;
  box-shadow: inset 0 0 0 1px var(--panel-line);
}

.market-chip :deep(.coin-mark) {
  width: 1.25rem;
  height: 1.25rem;
}

.chip-remove {
  display: grid;
  width: 1.4rem;
  height: 1.4rem;
  place-items: center;
  border-radius: 7px;
  color: var(--panel-soft);
  transition: background-color 140ms, color 140ms;
}

.chip-remove:hover {
  background: var(--panel-fill);
  color: var(--loss-ink);
}

.chip-remove :deep(.ui-icon) {
  width: 0.95rem;
  height: 0.95rem;
}

/* While a market is in hand the drop area lights up; once it is over the area, the market shows inside it,
   see-through, in place of what is there, so it is clear where it lands. */
:global(body:has(> .sortable-fallback .coin-mark) .market-drop) {
  border: 1.5px dashed var(--accent-ink);
  background: color-mix(in srgb, var(--accent-ink) 8%, transparent);
}

.market-drop:has(.entry-row) > .drop-text {
  display: none;
}

.market-drop :deep(.entry-row) {
  list-style: none;
}

.market-drop :deep(.entry-row .entry) {
  opacity: 0.6;
}

.drop-text {
  color: var(--panel-soft);
}

.market-choice {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.55rem;
  border-radius: 8px;
  padding: 0.4rem 0.55rem;
  text-align: left;
  font-weight: 600;
}

.market-choice:hover:not(:disabled),
.market-choice.is-on {
  background: var(--panel-fill);
}

.market-choice:disabled {
  opacity: 0.45;
}

.market-choice:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: -2px;
}

.market-check {
  margin-left: auto;
  color: var(--accent-ink);
}

.market-note {
  margin: 0 0.55rem 0.5rem;
  font-size: 12.5px;
  color: var(--panel-soft);
}

/* The label and the switch share a line, wrapping only on a narrow card. */
.pace {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.75rem;
  margin-top: 0.9rem;
}

.pace .field-label {
  margin-bottom: 0;
}

.field-label {
  margin-bottom: 0.4rem;
  font-size: 12px;
  font-weight: 700;
  color: var(--panel-soft);
}

.segmented,
.direction {
  display: inline-flex;
  gap: 2px;
  border-radius: 10px;
  background: var(--panel-fill);
  padding: 3px;
  font-size: 13px;
}

.segmented button,
.direction button {
  border-radius: 7px;
  padding: 0.3rem 0.65rem;
  font-weight: 700;
  color: var(--panel-soft);
  transition: background-color 140ms, color 140ms;
}

.segmented button.is-on,
.direction button.is-on {
  background: var(--panel);
  color: var(--panel-ink);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.15), inset 0 0 0 1px var(--panel-line);
}

/* The limits sit on the group's line, at the same edge as its condition tiles. */
.risk {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.5rem;
  margin-top: 0.5em;
  margin-left: 0.85em;
  border-radius: 10px;
}

/* While a limit is in hand every exit card's limit row lights up; the library's own entry is not shown in it. */
:global(body:has(> .sortable-fallback.limit) .risk) {
  outline: 1.5px dashed var(--accent-ink);
  outline-offset: 4px;
  background: color-mix(in srgb, var(--accent-ink) 8%, transparent);
}

.risk :deep(.limit) {
  display: none;
}

.pill-button:focus-visible,
.segmented button:focus-visible,
.direction button:focus-visible,
.zoom button:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

/* ---------- Lanes ---------- */
.lane-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.8rem 1.1rem 0;
}

.card-note {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.8rem;
  font-size: 12px;
  line-height: 1.4;
  color: var(--panel-soft);
}

.card-note .ui-icon {
  width: 1rem;
  height: 1rem;
  margin-top: 0.05rem;
}

.costs {
  display: grid;
  gap: 0.35rem;
  margin-top: 0.6rem;
  font-size: 13px;
}

.costs > div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.costs dt {
  color: var(--panel-soft);
}

.costs dd {
  font-weight: 700;
}

.lane-badge {
  border-radius: 8px;
  padding: 0.2rem 0.55rem;
  font-size: 12px;
  font-weight: 700;
}

.lane-badge--long {
  background: color-mix(in srgb, var(--gain-ink) 16%, transparent);
  color: var(--gain-ink);
}

.lane-badge--short {
  background: color-mix(in srgb, var(--loss-ink) 16%, transparent);
  color: var(--loss-ink);
}

.lane-remove {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  place-items: center;
  margin-left: auto;
  border-radius: 8px;
  color: var(--panel-soft);
}

.lane-remove:hover {
  background: var(--panel-fill);
  color: var(--loss-ink);
}

/* The side that is not there yet: a dashed card at the end of a dashed branch. */
.offer {
  display: flex;
  width: 17rem;
  align-items: center;
  gap: 0.7rem;
  border: 1.5px dashed var(--tile-line);
  border-radius: 18px;
  padding: 0.9rem 1rem;
  text-align: left;
  color: var(--panel-soft);
  transition: background-color 140ms, border-color 140ms, color 140ms;
}

.offer:hover {
  border-color: var(--accent-ink);
  background: color-mix(in srgb, var(--accent-ink) 7%, transparent);
  color: var(--panel-ink);
}

.offer-handle {
  left: 50%;
  opacity: 0;
}

.offer-plus {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  place-items: center;
  border-radius: 10px;
  background: var(--panel-fill);
}

.offer-title {
  display: block;
  font-weight: 700;
  color: var(--panel-ink);
}

.offer-text {
  display: block;
  font-size: 13px;
}

.end-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
}

.end-dot {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 999px;
}

.end-dot--long {
  background: var(--gain-ink);
}

.end-dot--short {
  background: var(--loss-ink);
}

.end-list {
  display: grid;
  gap: 0.25rem;
  margin-top: 0.5rem;
  padding-left: 1.15rem;
  font-size: 13px;
  color: var(--panel-soft);
  list-style: disc;
}

.offer:focus-visible,
.lane-remove:focus-visible,
.chip-remove:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

/* ---------- Panels over the canvas ---------- */
.canvas-actions {
  display: flex;
  gap: 0.4rem;
}

.canvas-action {
  background: var(--panel);
  color: var(--panel-soft);
}

.canvas-action:hover {
  color: var(--panel-ink);
}

.zoom {
  display: grid;
  overflow: hidden;
  border-radius: 12px;
  background: var(--panel);
  box-shadow: var(--panel-shadow);
}

.zoom button {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  color: var(--panel-soft);
}

.zoom button + button {
  border-top: 1px solid var(--panel-line);
}

.zoom button:hover {
  background: var(--panel-fill);
  color: var(--panel-ink);
}

.minus {
  width: 0.8rem;
  height: 2px;
  border-radius: 2px;
  background: currentColor;
}

.minimap {
  overflow: hidden;
  border-radius: 14px;
  background: var(--panel);
  box-shadow: var(--panel-shadow);
}

/* On a narrow canvas the map would sit on top of the cards it maps. */
@container (max-width: 900px) {
  .minimap {
    display: none;
  }
}

.minimap :deep(.mini-node) {
  fill: var(--panel-fill-strong);
  stroke: none;
}

.flow :deep(.flow-edge path) {
  stroke: var(--tile-line);
  stroke-width: 2;
}

.flow :deep(.flow-edge--offer path) {
  stroke-dasharray: 5 6;
}

/* Vue Flow turns pointer events off on cards that cannot be dragged or selected; ours are full of
   controls, so they take clicks again. Dragging the empty canvas still moves the view. */
.flow :deep(.vue-flow__node) {
  cursor: default;
  /* Vue Flow writes the "none" inline on each card, so only !important can restore clicks. */
  pointer-events: all !important;
}

/* ---------- The first screen fades away once a road is chosen ---------- */
.welcome-leave-active {
  transition: opacity 260ms, backdrop-filter 260ms;
}

.welcome-leave-active :deep(.welcome-card) {
  transition: transform 260ms cubic-bezier(0.4, 0, 1, 1), opacity 200ms;
}

.welcome-leave-to {
  opacity: 0;
}

.welcome-leave-to :deep(.welcome-card) {
  opacity: 0;
  transform: scale(0.96) translateY(-8px);
}

@media (prefers-reduced-motion: reduce) {
  .welcome-leave-active,
  .welcome-leave-active :deep(.welcome-card) {
    transition: none;
  }
}
</style>
