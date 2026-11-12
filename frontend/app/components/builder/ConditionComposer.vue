<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import type { TilePart } from '~/components/RuleTile.vue'
import type { Item, Operand, Operator } from '~/utils/strategyDocument'

// "Make your own" in the library: the same tile as on the canvas, set up part by part before it is added,
// so a user who wants "EMA 9 crosses above EMA 21" does not need a ready block for it. The finished tile
// goes in with the button or by dragging it onto a card.
const props = defineProps<{ target: string, start: { left: Operand, operator: Operator, right: Operand } }>()
const emit = defineEmits<{ add: [item: Item] }>()

const left = ref<Operand>(props.start.left)
const operator = ref<Operator>(props.start.operator)
const right = ref<Operand>(props.start.right)
const openPart = ref<TilePart | null>(null)
const anchor = ref<HTMLElement | null>(null)

function edit(part: TilePart, element: HTMLElement): void {
  openPart.value = openPart.value === part ? null : part
  anchor.value = element
}

function setOperand(operand: Operand): void {
  if (openPart.value === 'left') left.value = operand
  else right.value = operand
}

function clone(): Item {
  return newCondition(operator.value, left.value, right.value)
}

function add(): void {
  emit('add', newCondition(operator.value, left.value, right.value))
}
</script>

<template>
  <div class="composer">
    <p class="composer-title">
      Make your own
    </p>
    <p class="composer-hint">
      Click each part to change it, then drag the tile onto a card
    </p>
    <VueDraggable :model-value="[0]" class="composer-drag" :group="{ name: 'conditions', pull: 'clone', put: false }" :sort="false" :clone="clone" :force-fallback="true" :fallback-on-body="true" :fallback-tolerance="4" drag-class="is-dragging" ghost-class="drop-preview">
      <div class="composer-tile">
        <RuleTile :subject="operandLabel(left)" :operator="operatorLabel(operator)" :value="operandLabel(right)" editable @edit="edit" />
      </div>
    </VueDraggable>
    <button type="button" class="composer-add" @click="add">
      <UiIcon name="plus" /> Add to {{ target }}
    </button>

    <BuilderPopover v-if="openPart === 'left' || openPart === 'right'" :anchor="anchor" :label="openPart === 'left' ? 'What to measure' : 'What to compare with'" @close="openPart = null">
      <BuilderOperandEditor :operand="openPart === 'left' ? left : right" :allow-number="openPart === 'right'" @change="setOperand" />
    </BuilderPopover>
    <BuilderPopover v-if="openPart === 'operator'" :anchor="anchor" label="How to compare" @close="openPart = null">
      <ul class="grid gap-1">
        <li v-for="choice in OPERATOR_CHOICES" :key="choice">
          <button type="button" class="choice" :class="{ 'is-on': choice === operator }" @click="operator = choice; openPart = null">
            {{ operatorLabel(choice) }}
          </button>
        </li>
      </ul>
    </BuilderPopover>
  </div>
</template>

<style scoped>
.composer {
  border-radius: 14px;
  background: var(--panel-fill);
  padding: 0.8rem;
  box-shadow: inset 0 0 0 1px var(--panel-line);
}

.composer-title {
  font-weight: 700;
}

.composer-hint {
  font-size: 12px;
  color: var(--panel-soft);
}

.composer-drag {
  margin-top: 0.5rem;
}

.composer-tile {
  display: inline-block;
  cursor: grab;
}

.composer-tile.is-dragging {
  cursor: grabbing;
  rotate: -2deg;
  filter: drop-shadow(0 18px 24px rgb(0 0 0 / 0.28));
}

.composer-add {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  margin-top: 0.7rem;
  border-radius: 10px;
  background: var(--color-lime);
  padding: 0.5rem;
  font-weight: 700;
  color: var(--color-ink);
  transition: background-color 140ms, transform 120ms;
}

.composer-add:hover {
  background: #d6f87c;
}

.composer-add:active {
  transform: scale(0.97);
}

.composer-add:focus-visible,
.choice:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.choice {
  display: block;
  width: 100%;
  border-radius: 8px;
  padding: 0.45rem 0.6rem;
  text-align: left;
  font-weight: 600;
}

.choice:hover,
.choice.is-on {
  background: var(--panel-fill);
}
</style>
