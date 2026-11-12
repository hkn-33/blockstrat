<script setup lang="ts">
import type { DemoMarket, RuleCondition, RuleGroup } from '~/composables/useLandingDemo'

// A demo strategy as the builder's canvas draws it, read-only: cards joined by lines on a dotted board. The
// tiles and group rows are the builder's own (rules.css, RuleTile).
//
// The blocks are numbered in the order they are built: the market, the entry conditions, the exit conditions,
// then the limits. `revealed` is how many of them have landed (leave it out to show them all); a block that
// has not landed keeps its room, so nothing moves when the next one arrives. `fly` carries a block there.
const props = defineProps<{
  market: DemoMarket
  name: string
  entry: RuleGroup
  exit: RuleGroup
  revealed?: number
  // Only the cards that carry the rules, for a small frame like the assistant's answer.
  compact?: boolean
}>()

interface Block {
  label: string
  kind: 'market' | 'entry' | 'exit'
}

const PACES = ['Every hour', 'Every 4 hours', 'Once a day']
const ACTIVE_PACE = 'Every 4 hours'
const MATCHES = ['all', 'any', 'at least']

const coin = computed(() => demoMarket(props.market))
const exitConditions = computed(() => props.exit.conditions.filter(condition => condition.kind !== 'risk'))
const limits = computed(() => props.exit.conditions.filter(condition => condition.kind === 'risk'))

const exitStart = computed(() => 1 + props.entry.conditions.length)
const limitStart = computed(() => exitStart.value + exitConditions.value.length)

function conditionLabel(condition: RuleCondition): string {
  return `${condition.subject} ${condition.operator} ${condition.value}`
}

const blocks = computed<Block[]>(() => [
  { label: coin.value.label, kind: 'market' },
  ...props.entry.conditions.map<Block>(condition => ({ label: conditionLabel(condition), kind: 'entry' })),
  ...exitConditions.value.map<Block>(condition => ({ label: conditionLabel(condition), kind: 'exit' })),
  ...limits.value.map<Block>(condition => ({ label: conditionLabel(condition), kind: 'exit' })),
])

function isLanded(index: number): boolean {
  return props.revealed === undefined || index < props.revealed
}

function limitEnding(limit: RuleCondition): string {
  const amount = limit.value.slice(1)
  return limit.subject === 'Stop-loss' ? `After losing ${amount} (stop-loss)` : `After gaining ${amount} (take-profit)`
}

const endings = computed(() => {
  const ways = limits.value.map((limit, index) => ({ text: limitEnding(limit), block: limitStart.value + index }))
  if (!exitConditions.value.length) return ways
  return [{ text: 'When a sell condition is true', block: exitStart.value }, ...ways]
})

function groupTail(group: RuleGroup, verb: string): string {
  return `of these ${group.match === 'all' ? 'are true' : verb}`
}

// ---------- The block in the air ----------
const FLIGHT_MS = 420

const board = ref<HTMLElement | null>(null)
const carried = ref<{ $el: HTMLElement } | null>(null)
const flightBlock = ref<Block>({ label: '', kind: 'market' })
const isFlying = ref(false)
let flight: Animation | undefined

function cancelFlight(): void {
  flight?.cancel()
  isFlying.value = false
}

// Where a block's tile sits on the board, in the board's own pixels (the window is tilted in 3D at first,
// so the screen box is scaled back to the board's layout size).
function centreOf(target: HTMLElement, within: HTMLElement): { x: number, y: number } {
  const boardBox = within.getBoundingClientRect()
  const targetBox = target.getBoundingClientRect()
  const scale = boardBox.width / within.offsetWidth
  return {
    x: (targetBox.left - boardBox.left + targetBox.width / 2) / scale,
    y: (targetBox.top - boardBox.top + targetBox.height / 2) / scale,
  }
}

/** Carries block `index` in from the left edge to its place and resolves when it has landed. */
async function fly(index: number): Promise<void> {
  const block = blocks.value[index]
  const target = board.value?.querySelector<HTMLElement>(`[data-block="${index}"]`)
  if (!block || !target || !board.value || !carried.value) return

  cancelFlight()
  flightBlock.value = block
  isFlying.value = true
  await nextTick()

  const end = centreOf(target, board.value)
  const start = { x: 24, y: Math.max(16, end.y - 90) }
  const animation = carried.value.$el.animate(
    [
      { transform: `translate(${start.x}px, ${start.y}px)`, opacity: 0 },
      { opacity: 1, offset: 0.2 },
      { transform: `translate(${end.x}px, ${end.y}px)`, opacity: 1 },
    ],
    { duration: FLIGHT_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' },
  )
  flight = animation
  try {
    await animation.finished
  }
  catch {
    // Cancelled by a newer flight or by the page leaving.
    return
  }
  isFlying.value = false
}

defineExpose({ fly, cancelFlight })
</script>

<template>
  <div ref="board" class="board" :class="{ 'is-building': revealed !== undefined, 'is-compact': compact }">
    <div class="card card--secondary">
      <div class="card-body">
        <p class="card-kicker">
          Strategy
        </p>
        <p class="name">
          {{ name }}
        </p>
      </div>
    </div>
    <span class="link link--secondary" />

    <div class="card">
      <div class="card-body">
        <p class="card-kicker">
          Market
        </p>
        <div class="market-chips">
          <span class="market-chip" :class="{ 'is-pending': !isLanded(0) }" data-block="0">
            <img :src="`/brand-icons/${coin.icon}.svg`" alt="" class="coin-mark">
            {{ coin.label }}
          </span>
        </div>
        <div class="pace" :class="{ 'is-pending': !isLanded(0) }">
          <p class="field-label">
            Check the rules
          </p>
          <div class="segmented">
            <span v-for="pace in PACES" :key="pace" :class="{ 'is-on': pace === ACTIVE_PACE }">{{ pace }}</span>
          </div>
        </div>
      </div>
    </div>
    <span class="link" />

    <div class="card">
      <div class="lane-head">
        <span class="lane-badge">Long: profits when the price rises</span>
      </div>
      <div class="rules">
        <section class="rules-group">
          <div class="rules-title">
            <span class="rules-glyph rules-glyph--entry"><UiIcon name="log-in" /></span>
            <span class="font-bold">Buy when</span>
            <span class="match">
              <span v-for="option in MATCHES" :key="option" :class="{ 'is-on': option === entry.match }">{{ option }}</span>
            </span>
            <span class="rules-muted">{{ groupTail(entry, 'is true') }}</span>
          </div>
          <div class="branch">
            <ol class="rules-list">
              <li
                v-for="(condition, index) in entry.conditions"
                :key="conditionLabel(condition)"
                class="rules-row"
                :class="{ 'is-pending': !isLanded(1 + index) }"
                :data-block="1 + index"
              >
                <span v-if="index > 0" class="rules-joiner">{{ entry.match === 'all' ? 'and' : 'or' }}</span>
                <RuleTile :subject="condition.subject" :operator="condition.operator" :value="condition.value" />
              </li>
            </ol>
          </div>
        </section>
      </div>
    </div>
    <span class="link" />

    <div class="card">
      <div class="rules">
        <section class="rules-group">
          <div class="rules-title">
            <span class="rules-glyph rules-glyph--exit"><UiIcon name="log-out" /></span>
            <span class="font-bold">Sell when</span>
            <span class="match">
              <span v-for="option in MATCHES" :key="option" :class="{ 'is-on': option === exit.match }">{{ option }}</span>
            </span>
            <span class="rules-muted">{{ groupTail(exit, 'happens') }}</span>
          </div>
          <div class="branch">
            <ol class="rules-list">
              <li
                v-for="(condition, index) in exitConditions"
                :key="conditionLabel(condition)"
                class="rules-row"
                :class="{ 'is-pending': !isLanded(exitStart + index) }"
                :data-block="exitStart + index"
              >
                <span v-if="index > 0" class="rules-joiner">{{ exit.match === 'all' ? 'and' : 'or' }}</span>
                <RuleTile :subject="condition.subject" :operator="condition.operator" :value="condition.value" />
              </li>
            </ol>
            <div class="risk">
              <span
                v-for="(limit, index) in limits"
                :key="limit.subject"
                class="risk-tile"
                :class="{ 'is-pending': !isLanded(limitStart + index) }"
                :data-block="limitStart + index"
              >
                <RuleTile :subject="limit.subject" :operator="limit.operator" :value="limit.value" kind="risk" />
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
    <span class="link link--secondary" />

    <div class="card card--secondary">
      <div class="card-body">
        <p class="end-title">
          <span class="end-dot" />Sold, trade closed
        </p>
        <ul class="end-list">
          <li v-for="ending in endings" :key="ending.text" :class="{ 'is-pending': !isLanded(ending.block) }">
            {{ ending.text }}
          </li>
        </ul>
      </div>
    </div>

    <CarriedBlock ref="carried" :label="flightBlock.label" :kind="flightBlock.kind" :style="{ visibility: isFlying ? 'visible' : 'hidden' }" />
  </div>
</template>

<style scoped>
.board {
  --canvas-dot: color-mix(in srgb, var(--panel-ink) 16%, transparent);
  --rules-size: 13px;
  position: relative;
  display: grid;
  align-content: start;
  justify-items: center;
  overflow: hidden;
  padding: 1.25rem 1rem 1.5rem;
  background-color: var(--board-bg);
  background-image: radial-gradient(circle, var(--canvas-dot) 1.2px, transparent 1.4px);
  background-size: 22px 22px;
  color: var(--panel-ink);
}

.card {
  width: min(26rem, 100%);
  border-radius: 18px;
  background: var(--panel);
  box-shadow: var(--panel-shadow);
}

.link {
  width: 2px;
  height: 1.1rem;
  background: var(--tile-line);
}

/* Where room is short (the hero's window, the "how it works" picture, a narrow screen) only the cards that
   carry the rules show, closer together and without the market's pace switch. */
.is-compact .card--secondary,
.is-compact .link--secondary,
.is-compact .pace {
  display: none;
}

.is-compact {
  padding-block: 1rem;
}

.is-compact .link {
  height: 0.75rem;
}

.is-compact .card-body {
  padding: 0.8rem 1.1rem 0.9rem;
}

@media (max-width: 1023px) {
  .card--secondary,
  .link--secondary {
    display: none;
  }
}

.card-body {
  padding: 1.1rem 1.2rem 1.2rem;
}

.card-kicker {
  font-size: 12px;
  font-weight: 700;
  color: var(--panel-soft);
}

.name {
  margin-top: 0.2rem;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.market-chips {
  margin-top: 0.6rem;
}

.market-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border-radius: 10px;
  padding: 0.25rem 0.6rem 0.25rem 0.35rem;
  font-size: 13.5px;
  font-weight: 700;
  box-shadow: inset 0 0 0 1px var(--panel-line);
}

.coin-mark {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 999px;
  background: #ffffff;
  padding: 2px;
}

.pace {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.75rem;
  margin-top: 0.9rem;
}

.field-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--panel-soft);
}

.segmented,
.match {
  display: inline-flex;
  gap: 2px;
  border-radius: 10px;
  background: var(--panel-fill);
  padding: 3px;
  font-size: 13px;
}

.segmented span,
.match span {
  white-space: nowrap;
  border-radius: 7px;
  padding: 0.3rem 0.65rem;
  font-weight: 700;
  color: var(--panel-soft);
}

.match {
  border-radius: 8px;
  padding: 2px;
}

.match span {
  border-radius: 6px;
  padding: 0.1em 0.55em;
}

.segmented .is-on,
.match .is-on {
  background: var(--panel);
  color: var(--panel-ink);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.15), inset 0 0 0 1px var(--panel-line);
}

.lane-head {
  padding: 0.8rem 1.1rem 0;
}

.lane-badge {
  display: inline-block;
  border-radius: 8px;
  background: color-mix(in srgb, var(--gain-ink) 16%, transparent);
  padding: 0.2rem 0.55rem;
  font-size: 12px;
  font-weight: 700;
  color: var(--gain-ink);
}

.branch {
  margin: 0.75em 0 0 0.85em;
  border-left: 1.5px solid var(--tile-split);
  padding-left: 0.85em;
}

.branch > .rules-list {
  margin: 0;
  border-left: 0;
  padding-left: 0;
}

.risk {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.5rem;
  margin-top: 0.5em;
  padding-left: 0.85em;
}

.end-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 13px;
  font-weight: 700;
}

.end-dot {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 999px;
  background: var(--gain-ink);
}

.end-list {
  display: grid;
  gap: 0.25rem;
  margin-top: 0.5rem;
  padding-left: 1.15rem;
  font-size: 12.5px;
  color: var(--panel-soft);
  list-style: disc;
}

/* A block that has not landed keeps its room. */
.is-pending {
  visibility: hidden;
}

.is-building .market-chip:not(.is-pending),
.is-building .rules-row:not(.is-pending),
.is-building .risk-tile:not(.is-pending),
.is-building .pace:not(.is-pending),
.is-building .end-list li:not(.is-pending) {
  animation: land 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes land {
  from {
    opacity: 0;
    transform: scale(0.94);
  }
}

@media (prefers-reduced-motion: reduce) {
  .is-building .market-chip,
  .is-building .rules-row,
  .is-building .risk-tile,
  .is-building .pace,
  .is-building .end-list li {
    animation: none;
  }
}
</style>
