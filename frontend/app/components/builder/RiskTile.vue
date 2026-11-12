<script setup lang="ts">
import type { Direction, LimitKind } from '~/utils/strategyDocument'

// Stop-loss, take-profit or trailing stop as a tile in the Exit group, like any other way out:
// "Stop-loss | at | −5%", "Trailing stop | follows | 10% behind". Without a value it is a small button that
// adds one.
const props = defineProps<{ kind: LimitKind, sideId: string }>()

const editor = useStrategyEditor()
const anchor = ref<HTMLElement | null>(null)
const isEditing = ref(false)

interface LimitText {
  name: string
  operator: string
  initial: number
  tileValue: (percent: number) => string
  /** The number field's label. */
  help: string
  /** A fuller explanation above the field, for the limit that needs one. */
  explain?: (direction: Direction) => string
}

const TEXT: Record<LimitKind, LimitText> = {
  stopLoss: { name: 'Stop-loss', operator: 'at', initial: 5, tileValue: percent => `−${percent}%`, help: 'Close the trade once it has lost this much, in %' },
  takeProfit: { name: 'Take-profit', operator: 'at', initial: 15, tileValue: percent => `+${percent}%`, help: 'Close the trade once it has gained this much, in %' },
  trailingStop: {
    name: 'Trailing stop',
    operator: 'follows',
    initial: 10,
    tileValue: percent => `${percent}% behind`,
    help: 'How far behind the price, in %',
    explain: direction => (direction === 'short'
      ? 'Closes the trade once the price has risen this far from its lowest level since you got in. It follows the price down and never moves back up.'
      : 'Closes the trade once the price has fallen this far from its best level since you got in. It follows the price up and never moves back down.'),
  },
}

const text = computed(() => TEXT[props.kind])
const field = computed(() => LIMIT_FIELDS[props.kind])
const side = computed(() => editor.document.value.sides.find(candidate => candidate.id === props.sideId))
const value = computed(() => side.value?.[field.value] ?? null)
const problem = computed(() => editor.problems.value[`${props.kind}:${props.sideId}`])

function setValue(next: number | null): void {
  editor.commit(document => setSideLimit(document, props.sideId, field.value, next), `${props.kind}:${props.sideId}`)
}

function edit(_part: string, element: HTMLElement): void {
  anchor.value = element
  isEditing.value = !isEditing.value
}

function onInput(event: Event): void {
  const number = (event.target as HTMLInputElement).valueAsNumber
  setValue(Number.isNaN(number) ? 0 : number)
}
</script>

<template>
  <div v-if="value !== null" class="grid gap-1">
    <div class="flex items-center gap-1">
      <RuleTile :subject="text.name" :operator="text.operator" :value="text.tileValue(value)" kind="risk" editable :invalid="Boolean(problem)" @edit="edit" />
      <button type="button" class="remove" :aria-label="`Remove the ${text.name.toLowerCase()}`" @click="setValue(null)">
        <UiIcon name="x" />
      </button>
    </div>
    <p v-if="problem" class="problem">
      {{ problem }}
    </p>
    <BuilderPopover v-if="isEditing" :anchor="anchor" :label="text.name" @close="isEditing = false">
      <p v-if="text.explain && side" class="explain">
        {{ text.explain(side.direction) }}
      </p>
      <label class="field">{{ text.help }}
        <input type="number" inputmode="decimal" min="0.1" step="0.5" :value="value" @input="onInput">
      </label>
    </BuilderPopover>
  </div>
  <button v-else type="button" class="add" @click="setValue(text.initial)">
    <UiIcon name="plus" /> {{ text.name }}
  </button>
</template>

<style scoped>
.remove {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  place-items: center;
  border-radius: 8px;
  color: var(--panel-soft);
  opacity: 0;
  transition: opacity 140ms, background-color 140ms, color 140ms;
}

div:hover > .remove,
.remove:focus-visible {
  opacity: 1;
}

.remove:hover {
  background: var(--panel-fill);
  color: var(--loss-ink);
}

@media (hover: none) {
  .remove {
    opacity: 1;
  }
}

.problem {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--loss-ink);
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
  box-shadow: inset 0 0 0 1px var(--panel-line);
  transition: background-color 140ms, color 140ms;
}

.add:hover {
  background: var(--panel-fill);
  color: var(--panel-ink);
}

.add:focus-visible,
.remove:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.explain {
  max-width: 19rem;
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
  color: var(--panel-ink);
  box-shadow: inset 0 0 0 1px var(--panel-line);
}

.field input:focus {
  outline: 2px solid var(--focus);
}
</style>
