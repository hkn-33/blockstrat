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

// What a tile measures and compares with is changed in a draft and applied by Save, so trying settings out
// does not rerun the backtest at every keystroke. A draft left by moving away stays, and its part lights up
// until it is saved or undone.
type OperandSide = 'left' | 'right'
const drafts = ref<Partial<Record<OperandSide, Operand>>>({})
const unsaved = computed<TilePart[]>(() => (['left', 'right'] as const).filter(side => drafts.value[side] !== undefined))

function setDraft(side: OperandSide, operand: Operand): void {
  if (JSON.stringify(operand) === JSON.stringify(props.item[side])) {
    discard(side)
    return
  }
  drafts.value = { ...drafts.value, [side]: operand }
}

function discard(side: OperandSide): void {
  const { [side]: _dropped, ...rest } = drafts.value
  drafts.value = rest
}

function save(side: OperandSide): void {
  const draft = drafts.value[side]
  if (draft) editor.commit(document => updateCondition(document, props.item.id, { [side]: draft }))
  discard(side)
  openPart.value = null
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
        :unsaved="unsaved"
        :icon="item.left.kind === 'constant' ? undefined : indicatorIcon(item.left.kind)"
        @edit="edit"
      />
      <button type="button" class="remove" v-tip="'Remove this condition'" @click="remove">
        <UiIcon name="x" />
      </button>
    </div>
    <p v-if="problem" class="problem">
      {{ problem }}
    </p>

    <BuilderPopover v-if="openPart === 'left' || openPart === 'right'" :anchor="anchor" :label="openPart === 'left' ? 'What to measure' : 'What to compare with'" close-on-leave @close="openPart = null">
      <div @keydown.enter.prevent="save(openPart as OperandSide)">
        <BuilderOperandEditor
          :operand="drafts[openPart] ?? item[openPart]"
          :allow-number="openPart === 'right'"
          @change="setDraft(openPart as OperandSide, $event)"
        />
        <div class="editor-actions">
          <span v-if="drafts[openPart]" class="unsaved-note"><span class="unsaved-dot" /> Not saved yet</span>
          <button v-if="drafts[openPart]" type="button" class="undo" @click="discard(openPart as OperandSide)">
            Undo
          </button>
          <button type="button" class="save" :disabled="!drafts[openPart]" @click="save(openPart as OperandSide)">
            <UiIcon name="check" /> Save
          </button>
        </div>
      </div>
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

.editor-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.75rem;
  border-top: 1px solid var(--panel-line);
  padding-top: 0.65rem;
}

.unsaved-note {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-right: auto;
  font-size: 12.5px;
  font-weight: 600;
  color: #d48806;
}

.unsaved-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  background: #f0a020;
}

.undo {
  border-radius: 8px;
  padding: 0.35rem 0.6rem;
  font-size: 13px;
  font-weight: 700;
  color: var(--panel-soft);
}

.undo:hover {
  background: var(--panel-fill);
}

.save {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border-radius: 8px;
  background: var(--color-lime);
  padding: 0.35rem 0.8rem;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-ink);
}

.save:disabled {
  opacity: 0.45;
}

.save:focus-visible,
.undo:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
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
