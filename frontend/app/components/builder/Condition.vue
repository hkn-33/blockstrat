<script setup lang="ts">
import type { TilePart } from '~/components/RuleTile.vue'
import type { ConditionItem, Operand, Operator } from '~/utils/strategyDocument'

// One editable condition: the shared tile with each part opening its own small editor, a remove control,
// and the problem with it, if any, right underneath.
const props = defineProps<{ item: ConditionItem }>()

const editor = useStrategyEditor()
const { isAdvanced } = useBuilderMode()
const openPart = ref<TilePart | null>(null)
const anchor = ref<HTMLElement | null>(null)
const problem = computed(() => editor.problems.value[props.item.id])

function edit(part: TilePart, element: HTMLElement): void {
  if (openPart.value === part) {
    openPart.value = null
    return
  }
  openPart.value = part
  anchor.value = element
}

function setOperand(side: 'left' | 'right', operand: Operand): void {
  editor.commit(document => updateCondition(document, props.item.id, { [side]: operand }), `${props.item.id}:${side}`)
}

function setOperator(operator: Operator): void {
  editor.commit(document => updateCondition(document, props.item.id, { operator }))
  openPart.value = null
}

function negate(): void {
  editor.commit(document => toggleNegated(document, props.item.id))
  openPart.value = null
}

// The tile fades out first, then the list closes over the gap.
const LEAVE_MS = 150

function remove(): void {
  root.value?.closest('.drag-row')?.classList.add('is-leaving')
  setTimeout(() => editor.commit(document => removeItem(document, props.item.id)), LEAVE_MS)
}

// Advanced mode spells out every number a tile stands for, not only the main one.
function label(operand: Operand): string {
  return isAdvanced.value ? operandDetail(operand) : operandLabel(operand)
}

// A condition just added from the library opens its value at once ("RSI is below [30]"), so the user
// sees it can be changed and tunes it without hunting for where.
const root = ref<HTMLDivElement | null>(null)

onMounted(async () => {
  if (editor.focusItem.value !== props.item.id) return
  editor.focusItem.value = null
  await nextTick()
  const value = root.value?.querySelector<HTMLElement>('.segment--value')
  if (value) edit('right', value)
})
</script>

<template>
  <div ref="root" class="condition">
    <div class="flex items-center gap-1">
      <RuleTile
        :subject="label(item.left)"
        :operator="operatorLabel(item.operator, item.negated)"
        :value="label(item.right)"
        editable
        :invalid="Boolean(problem)"
        @edit="edit"
      />
      <button type="button" class="remove" aria-label="Remove this condition" @click="remove">
        <UiIcon name="x" />
      </button>
    </div>
    <p v-if="problem" class="problem">
      {{ problem }}
    </p>

    <BuilderPopover v-if="openPart === 'left' || openPart === 'right'" :anchor="anchor" :label="openPart === 'left' ? 'What to measure' : 'What to compare with'" @close="openPart = null">
      <BuilderOperandEditor
        :operand="openPart === 'left' ? item.left : item.right"
        :allow-number="openPart === 'right'"
        @change="setOperand(openPart!, $event)"
      />
    </BuilderPopover>

    <BuilderPopover v-if="openPart === 'operator'" :anchor="anchor" label="How to compare" @close="openPart = null">
      <ul class="grid gap-1" role="listbox" aria-label="How to compare">
        <li v-for="operator in OPERATOR_CHOICES" :key="operator">
          <button type="button" class="choice" :class="{ 'is-on': operator === item.operator }" role="option" :aria-selected="operator === item.operator" @click="setOperator(operator)">
            {{ operatorLabel(operator) }}
            <UiIcon v-if="operator === item.operator" name="check" class="ml-auto" />
          </button>
        </li>
      </ul>
      <!-- "Not" takes explaining, so only advanced mode offers it; a "not" already there stays removable. -->
      <button v-if="isAdvanced || item.negated" type="button" class="choice mt-2 border-t border-[var(--panel-line)] pt-2" @click="negate">
        {{ item.negated ? 'Remove the "not"' : 'Turn into its opposite ("not")' }}
      </button>
    </BuilderPopover>
  </div>
</template>

<style scoped>
.condition {
  display: grid;
  min-width: 0;
  max-width: 100%;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.3rem;
}

.condition > div {
  min-width: 0;
}

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

.condition:hover .remove,
.remove:focus-visible {
  opacity: 1;
}

.remove:hover {
  background: var(--panel-fill);
  color: var(--loss-ink);
}

.remove:focus-visible {
  outline: 2px solid var(--focus);
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

.choice {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.5rem;
  border-radius: 8px;
  padding: 0.45rem 0.6rem;
  text-align: left;
  font-weight: 600;
  transition: background-color 140ms;
}

.choice:hover,
.choice.is-on {
  background: var(--panel-fill);
}

.choice:focus-visible {
  outline: 2px solid var(--focus);
}
</style>
