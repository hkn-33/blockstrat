<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import { READY_CONDITIONS, byIdea } from '~/utils/blockLibrary'
import type { GroupItem, Item, Match } from '~/utils/strategyDocument'

// A group of conditions: the Entry or Exit group at the top, or a group nested inside one. Its items can be
// reordered and moved between groups by dragging, palette tiles dropped in, and conditions added by button.
// It needs all of them, any of them, or at least a number of them; in that last case an item can count
// more than once (x2 is worth two ordinary conditions), which is how one signal is made to matter more.
defineOptions({ name: 'BuilderGroup' })

const props = withDefaults(defineProps<{ group: GroupItem, root?: 'entry' | 'exit', direction?: 'long' | 'short' }>(), { root: undefined, direction: 'long' })

const editor = useStrategyEditor()
const { isAdvanced } = useBuilderMode()
const addAnchor = ref<HTMLElement | null>(null)
const isAdding = ref(false)
const problem = computed(() => editor.problems.value[props.group.id])
const joiner = computed(() => (props.group.match === 'all' ? 'and' : 'or'))
const isScore = computed(() => props.group.match === 'score')
const isWeightedScore = computed(() => isWeighted(props.group))
const totalWeight = computed(() => props.group.items.reduce((sum, item) => sum + item.weight, 0))
const ADD_SECTIONS = byIdea(READY_CONDITIONS)

const MATCHES: { value: Match, label: string }[] = [
  { value: 'all', label: 'all' },
  { value: 'any', label: 'any' },
  { value: 'score', label: 'at least' },
]

// A nested group's sentence starts with the control.
function matchLabel(label: string): string {
  return props.root ? label : label.charAt(0).toUpperCase() + label.slice(1)
}

const items = computed<Item[]>({
  get: () => props.group.items,
  set: value => editor.commit(document => setGroupItems(document, props.group.id, value), 'drag'),
})

// A short side opens by selling and closes by buying back, so its groups say so.
const ROOT_TEXT = computed(() => ({
  entry: { title: props.direction === 'short' ? 'Sell short when' : 'Buy when', icon: 'log-in' },
  exit: { title: props.direction === 'short' ? 'Buy back when' : 'Sell when', icon: 'log-out' },
}))

function setGroupMatch(match: Match): void {
  editor.commit(document => setMatch(document, props.group.id, match))
}

function numberFrom(event: Event): number {
  const value = (event.target as HTMLInputElement).valueAsNumber
  return Number.isNaN(value) ? 0 : value
}

function setGroupThreshold(event: Event): void {
  const threshold = numberFrom(event)
  editor.commit(document => setThreshold(document, props.group.id, threshold), `threshold:${props.group.id}`)
}

// ---------- Weights ----------
const weightAnchor = ref<HTMLElement | null>(null)
const weighingId = ref<string | null>(null)
const weighing = computed(() => props.group.items.find(item => item.id === weighingId.value))

function openWeight(id: string, event: MouseEvent): void {
  weightAnchor.value = event.currentTarget as HTMLElement
  weighingId.value = weighingId.value === id ? null : id
}

function setItemWeight(event: Event): void {
  const id = weighingId.value
  if (!id) return
  const weight = numberFrom(event)
  editor.commit(document => setWeight(document, id, weight), `weight:${id}`)
}

function openAdd(event: MouseEvent): void {
  addAnchor.value = event.currentTarget as HTMLElement
  isAdding.value = !isAdding.value
}

function add(build: () => Item): void {
  editor.commit(document => addItem(document, props.group.id, build()))
  isAdding.value = false
}

function addGroup(): void {
  editor.commit(document => addItem(document, props.group.id, newGroup(props.group.match === 'all' ? 'any' : 'all')))
  isAdding.value = false
}

function removeGroup(): void {
  editor.commit(document => removeItem(document, props.group.id))
}

function negateGroup(): void {
  editor.commit(document => toggleNegated(document, props.group.id))
}
</script>

<template>
  <section :class="root ? 'rules-group' : 'nested'">
    <div v-if="root" class="rules-title">
      <span class="rules-glyph" :class="`rules-glyph--${root}`"><UiIcon :name="ROOT_TEXT[root].icon" /></span>
      <span class="font-bold">{{ ROOT_TEXT[root].title }}</span>
      <span class="match" role="radiogroup" :aria-label="`${ROOT_TEXT[root].title}: how the conditions combine`">
        <button v-for="option in MATCHES" :key="option.value" type="button" role="radio" :aria-checked="group.match === option.value" :class="{ 'is-on': group.match === option.value }" @click="setGroupMatch(option.value)">{{ matchLabel(option.label) }}</button>
      </span>
      <template v-if="isScore">
        <input class="threshold nodrag" type="number" inputmode="decimal" :min="isWeightedScore ? 0.5 : 1" :max="totalWeight" :step="isWeightedScore ? 'any' : 1" :value="group.threshold" aria-label="How many of these must be true" @input="setGroupThreshold">
        <span class="rules-muted">are true</span>
      </template>
      <span v-else class="rules-muted">of these {{ group.match === 'all' ? 'are true' : (root === 'exit' ? 'happens' : 'is true') }}</span>
      <slot name="title" />
    </div>
    <div v-else class="nested-title">
      <span class="match" role="radiogroup" aria-label="How the conditions in this group combine">
        <button v-for="option in MATCHES" :key="option.value" type="button" role="radio" :aria-checked="group.match === option.value" :class="{ 'is-on': group.match === option.value }" @click="setGroupMatch(option.value)">{{ matchLabel(option.label) }}</button>
      </span>
      <input v-if="isScore" class="threshold nodrag" type="number" inputmode="decimal" :min="isWeightedScore ? 0.5 : 1" :max="totalWeight" :step="isWeightedScore ? 'any' : 1" :value="group.threshold" aria-label="How many of these must be true" @input="setGroupThreshold">
      <span class="rules-muted">{{ group.negated ? 'of these must not be true' : 'of these' }}</span>
      <span class="ml-auto flex gap-1">
        <button v-if="isAdvanced || group.negated" type="button" class="icon-button" :aria-pressed="group.negated" :title="group.negated ? 'Remove the &quot;not&quot;' : 'Turn into its opposite'" @click="negateGroup">not</button>
        <button type="button" class="icon-button" v-tip="'Remove this group'" @click="removeGroup"><UiIcon name="x" /></button>
      </span>
    </div>

    <div :class="{ branch: root }" :data-replay-target="root ? group.id : undefined">
      <VueDraggable
        v-model="items"
        tag="ol"
        class="rules-list drop-list nodrag"
        :class="{ 'is-empty': !group.items.length }"
        group="conditions"
        :animation="180"
        easing="cubic-bezier(0.22, 1, 0.36, 1)"
        ghost-class="is-ghost"
        :empty-insert-threshold="56"
        :swap-threshold="0.65"
        chosen-class="is-chosen"
        drag-class="is-dragging"
        :force-fallback="true"
        :fallback-on-body="true"
        :fallback-tolerance="4"
        filter="input, select, .popover"
        :prevent-on-filter="false"
      >
        <li v-for="(item, index) in group.items" :key="item.id" class="rules-row drag-row" :class="{ 'has-weight': isScore && (isAdvanced || item.weight !== 1) }">
          <!-- In a score neither "and" nor "or" is true, so the rows stand alone. -->
          <span v-if="index > 0 && !isScore" class="rules-joiner">{{ joiner }}</span>
          <template v-if="isScore">
            <button
              v-if="isAdvanced"
              type="button"
              class="weight"
              :aria-expanded="weighingId === item.id"
              :aria-label="`${timesLabel(item.weight)}: change`"
              :title="timesLabel(item.weight)"
              @click="openWeight(item.id, $event)"
            >
              ×{{ weightLabel(item.weight) }}
            </button>
            <span v-else-if="item.weight !== 1" class="weight" :title="timesLabel(item.weight)">×{{ weightLabel(item.weight) }}</span>
          </template>
          <BuilderCondition v-if="item.type === 'condition'" :item="item" />
          <BuilderGroup v-else :group="item" />
        </li>
      </VueDraggable>
      <p v-if="!group.items.length && root" class="empty-hint">
        <UiIcon name="grip-vertical" /> Drag a condition here, or add one below
      </p>
      <p v-if="isWeightedScore" class="weighted-note">
        A condition marked ×2 counts as two.
      </p>
      <p v-if="problem" class="problem">
        {{ problem }}
      </p>

      <slot name="after" />
    </div>

    <div class="add-row">
      <button type="button" class="add" :aria-expanded="isAdding" @click="openAdd">
        <UiIcon name="plus" /> Add condition
      </button>
    </div>

    <BuilderPopover v-if="isAdding" :anchor="addAnchor" label="Add a condition" @close="isAdding = false">
      <div v-for="section in ADD_SECTIONS" :key="section.idea" class="add-idea">
        <p class="add-idea-title">
          {{ section.idea }}
        </p>
        <ul class="grid gap-0.5">
          <li v-for="condition in section.conditions" :key="condition.label">
            <button type="button" class="choice" @click="add(condition.build)">
              {{ condition.label }}
            </button>
          </li>
        </ul>
      </div>
      <div v-if="isAdvanced" class="mt-1 border-t border-[var(--panel-line)] pt-1">
        <button type="button" class="choice" @click="addGroup">
          A group: {{ group.match === 'all' ? 'any' : 'all' }} of several conditions
        </button>
      </div>
    </BuilderPopover>

    <BuilderPopover v-if="weighing" :anchor="weightAnchor" label="What this condition counts for" @close="weighingId = null">
      <p class="weight-help">
        How much this condition counts. A condition that counts 2 is worth two ordinary ones.
      </p>
      <label class="field">Counts as this many conditions
        <input type="number" inputmode="decimal" min="0.5" max="100" step="0.5" :value="weighing.weight" @input="setItemWeight">
      </label>
    </BuilderPopover>
  </section>
</template>

<style scoped>
.nested {
  display: grid;
  border-radius: 12px;
  background: var(--panel-fill);
  padding: 0.6em 0.7em 0.7em;
  box-shadow: inset 0 0 0 1px var(--panel-line);
}

.nested-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45em;
}

.nested .rules-list {
  margin-top: 0.5em;
}

.match {
  display: inline-grid;
  grid-auto-columns: 1fr;
  grid-auto-flow: column;
  gap: 2px;
  border-radius: 8px;
  background: var(--panel-fill);
  padding: 2px;
}

.match button {
  cursor: pointer;
  border-radius: 6px;
  padding: 0.1em 0.55em;
  font-weight: 700;
  color: var(--panel-soft);
  transition: background-color 140ms, color 140ms;
}

.match button.is-on {
  background: var(--panel);
  color: var(--panel-ink);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.15), inset 0 0 0 1px var(--panel-line);
}

.threshold {
  width: 2.6em;
  border-radius: 8px;
  background: var(--panel-fill);
  padding: 0.15em 0.4em;
  text-align: center;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--panel-ink);
  box-shadow: inset 0 0 0 1px var(--panel-line);
  transition: box-shadow 140ms;
}

.threshold:hover {
  box-shadow: inset 0 0 0 1px var(--tile-line);
}

/* How many conditions a row counts as in a score: a small mark before the tile, a button in advanced mode.
   It never shrinks or wraps, so every row keeps its mark and its tile on one line. */
.weight {
  display: inline-flex;
  min-width: 2.1rem;
  min-height: 1.75rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  padding: 0 0.35em;
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: var(--panel-soft);
  box-shadow: inset 0 0 0 1px var(--panel-line);
  transition: background-color 140ms, color 140ms;
}

button.weight {
  cursor: pointer;
}

button.weight:hover,
button.weight[aria-expanded="true"] {
  background: var(--panel-fill);
  color: var(--panel-ink);
}

/* A row with a mark keeps the mark beside its tile: the tile narrows and wraps instead of dropping below. */
.rules-row.has-weight {
  flex-wrap: nowrap;
  align-items: flex-start;
}

.weighted-note {
  margin: 0.5em 0 0 0.85em;
  font-size: 12.5px;
  color: var(--panel-soft);
}

.weight-help {
  max-width: 17rem;
  margin-bottom: 0.6rem;
  font-size: 13px;
  line-height: 1.45;
}

.field {
  display: grid;
  gap: 0.35rem;
  font-size: 12px;
  font-weight: 600;
  color: var(--panel-soft);
}

.field input {
  border-radius: 8px;
  background: var(--panel-fill);
  padding: 0.45rem 0.6rem;
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--panel-ink);
  box-shadow: inset 0 0 0 1px var(--panel-line);
}

.add-idea + .add-idea {
  margin-top: 0.4rem;
}

.add-idea-title {
  padding: 0.2rem 0.6rem;
  font-size: 12px;
  font-weight: 600;
  color: var(--panel-soft);
}

.match button:focus-visible,
.icon-button:focus-visible,
.add:focus-visible,
.choice:focus-visible,
.weight:focus-visible,
.threshold:focus-visible,
.field input:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.icon-button {
  display: grid;
  min-width: 1.75rem;
  height: 1.75rem;
  place-items: center;
  border-radius: 8px;
  padding: 0 0.4rem;
  font-size: 12px;
  font-weight: 700;
  color: var(--panel-soft);
  transition: background-color 140ms, color 140ms;
}

.icon-button:hover,
.icon-button[aria-pressed="true"] {
  background: var(--panel);
  color: var(--panel-ink);
}

/* A top group's tiles, its stop-loss and take-profit hang off one line that runs down from its title,
   so everything that belongs to the group starts at the same edge. */
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

/* An empty list keeps a target to drop into. */
.drop-list {
  min-height: 2.4em;
}

/* An empty top group shows that target: a dashed box the size of a tile row, with the invitation in it. */
.branch > .drop-list.is-empty {
  min-height: 3.6em;
  margin-left: 0.85em;
  border: 1.5px dashed var(--tile-line);
  border-radius: 12px;
  transition: border-color 140ms, background-color 140ms;
}

.branch > .drop-list.is-empty .drag-row {
  padding: 0.55em 0.6em;
}

/* While a condition is in hand the box lights up; it needs no reach past its edges. */
:global(body[data-dragging="condition"] .branch > .drop-list.is-empty),
:global(body[data-dragging="limit"] .branch > .drop-list.is-empty) {
  margin-bottom: 0;
  padding-bottom: 0;
  border-color: var(--accent-ink);
  background: color-mix(in srgb, var(--accent-ink) 8%, transparent);
}

/* The block shows inside the box in place of the invitation. */
.drop-list:has(.is-ghost, .drop-preview) + .empty-hint {
  visibility: hidden;
}

/* A tile that has just been added grows into place; one being removed fades before the list closes. */
.drag-row {
  cursor: grab;
  animation: row-in 220ms cubic-bezier(0.22, 1, 0.36, 1);
  transition: opacity 150ms, transform 150ms;
}

@keyframes row-in {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.97);
  }
}

.drag-row.is-leaving {
  opacity: 0;
  transform: scale(0.96);
}

/* While a block is in hand, every group's drop area reaches past its edges, so a block let go near a group
   snaps into it rather than needing a pixel-exact aim. */
:global(body[data-dragging] .drop-list) {
  position: relative;
  z-index: 2;
  margin-bottom: -3rem;
  padding-bottom: 3rem;
}

/* The hand stays closed over whatever the block passes, so it reads as held all the way. */
:global(body[data-dragging] *) {
  cursor: grabbing !important;
}

/* Where the tile will land: the tile itself, see-through, in a dashed accent outline of its own size,
   so the list opens once and nothing else moves. */
.drag-row.is-ghost {
  border-radius: 10px;
  outline: 1.5px dashed var(--accent-ink);
  outline-offset: 2px;
  background: color-mix(in srgb, var(--accent-ink) 10%, transparent);
}

.drag-row.is-ghost > * {
  opacity: 0.55;
}

/* The tile in hand lifts with a shadow and a slight tilt. */
.drag-row.is-dragging {
  cursor: grabbing;
  opacity: 1 !important;
  transform: rotate(-2deg);
  filter: drop-shadow(0 18px 24px rgb(0 0 0 / 0.28));
}

.drag-row.is-dragging .rules-joiner {
  display: none;
}

.empty-hint {
  display: flex;
  height: 3.6em;
  align-items: center;
  gap: 0.4em;
  margin: -3.6em 0 0 1.7em;
  pointer-events: none;
  font-size: 13px;
  color: var(--panel-soft);
}

.empty-hint .ui-icon {
  width: 1em;
  height: 1em;
  opacity: 0.7;
}

.problem {
  margin-top: 0.4rem;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--loss-ink);
}

.add-row {
  margin-top: 0.6em;
  padding-left: 2.1em;
}

.add {
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

.add:hover {
  background: var(--panel-fill);
  color: var(--panel-ink);
}

.choice {
  display: block;
  width: 100%;
  border-radius: 8px;
  padding: 0.45rem 0.6rem;
  text-align: left;
  font-weight: 600;
}

.choice:hover {
  background: var(--panel-fill);
}

@media (prefers-reduced-motion: reduce) {
  .drag-row {
    animation: none;
    transition: none;
  }

  .drag-row.is-dragging {
    transform: none;
  }
}
</style>
