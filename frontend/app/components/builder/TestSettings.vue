<script setup lang="ts">
import type { ExecutionPreset } from '~/types/api'

// How the test counts money: the share of the account in each trade, the leverage, the exchange's fee and
// slippage.
// It sits under the result it shapes, closed to one line that says what is in force, and opens to change it.
defineProps<{ presets: ExecutionPreset[] }>()

const editor = useStrategyEditor()
const document = editor.document
const problem = computed(() => editor.problems.value.positionSize)

function setNumber(field: 'positionSizePct' | 'commission_pct' | 'slippage_bps', event: Event): void {
  const value = (event.target as HTMLInputElement).valueAsNumber
  if (Number.isNaN(value)) return
  editor.commit((current) => {
    if (field === 'positionSizePct') return { ...current, positionSizePct: value }
    return { ...current, execution: { ...current.execution, [field]: value } }
  }, field)
}

// The presets are about costs; the leverage chosen stays.
function applyPreset(preset: ExecutionPreset): void {
  editor.commit(current => ({ ...current, execution: { ...preset.execution, leverage: current.execution.leverage } }))
}

const LEVERAGES = [1, 2, 3, 5, 10]

function setLeverage(leverage: number): void {
  editor.commit(current => ({ ...current, execution: { ...current.execution, leverage } }))
}

function isPresetOn(preset: ExecutionPreset): boolean {
  const execution = document.value.execution
  return preset.execution.commission_pct === execution.commission_pct && preset.execution.slippage_bps === execution.slippage_bps
}
</script>

<template>
  <details class="settings">
    <summary>
      <UiIcon name="sliders-horizontal" />
      <span class="min-w-0">
        <span class="summary-title">How it is counted</span>
        <span class="summary-values">{{ document.positionSizePct }}% of the account a trade<template v-if="document.execution.leverage > 1">, {{ document.execution.leverage }}× leverage</template>, {{ document.execution.commission_pct }}% fee, {{ document.execution.slippage_bps }} bps slippage</span>
      </span>
      <UiIcon name="chevron-down" class="chevron" />
    </summary>

    <div class="fields">
      <div v-if="presets.length" class="presets" role="group" aria-label="Cost presets">
        <button v-for="preset in presets" :key="preset.id" type="button" class="preset" :class="{ 'is-on': isPresetOn(preset) }" @click="applyPreset(preset)">
          {{ preset.label }}
        </button>
      </div>

      <label class="field">
        <span class="field-text">
          <span class="field-name">Position size</span>
          <span class="field-help">The share of the account put into each trade</span>
        </span>
        <span class="field-input" :class="{ 'is-invalid': problem }">
          <input type="number" inputmode="decimal" min="1" max="100" step="5" :value="document.positionSizePct" @input="setNumber('positionSizePct', $event)">
          <span class="unit">%</span>
        </span>
      </label>
      <p v-if="problem" class="problem">
        {{ problem }}
      </p>

      <div class="field">
        <span class="field-text">
          <span class="field-name">Leverage</span>
          <span class="field-help">Each trade is this many times the money put in; a fall of 1 ÷ leverage wipes the account out</span>
        </span>
        <span class="presets" role="radiogroup" aria-label="Leverage">
          <button v-for="leverage in LEVERAGES" :key="leverage" type="button" role="radio" class="preset" :class="{ 'is-on': document.execution.leverage === leverage }" :aria-checked="document.execution.leverage === leverage" @click="setLeverage(leverage)">
            {{ leverage }}×
          </button>
        </span>
      </div>

      <label class="field">
        <span class="field-text">
          <span class="field-name">Exchange fee</span>
          <span class="field-help">Charged on every buy and every sell</span>
        </span>
        <span class="field-input">
          <input type="number" inputmode="decimal" min="0" max="5" step="0.01" :value="document.execution.commission_pct" @input="setNumber('commission_pct', $event)">
          <span class="unit">%</span>
        </span>
      </label>

      <label class="field">
        <span class="field-text">
          <span class="field-name">Slippage</span>
          <span class="field-help">How much worse than the quoted price an order fills; 100 bps is 1%</span>
        </span>
        <span class="field-input">
          <input type="number" inputmode="decimal" min="0" max="500" step="1" :value="document.execution.slippage_bps" @input="setNumber('slippage_bps', $event)">
          <span class="unit">bps</span>
        </span>
      </label>

      <p class="note">
        <UiIcon name="info" /> Orders fill at the next candle's open, so a signal never trades on a price it has already seen.
      </p>
    </div>
  </details>
</template>

<style scoped>
.settings {
  margin: 0.75rem 1rem 0;
  border-radius: 14px;
  font-size: 13px;
  box-shadow: inset 0 0 0 1px var(--panel-line);
}

summary {
  display: flex;
  cursor: pointer;
  align-items: center;
  gap: 0.6rem;
  border-radius: 14px;
  padding: 0.65rem 0.8rem;
  color: var(--panel-soft);
  list-style: none;
  transition: background-color 140ms;
}

summary::-webkit-details-marker {
  display: none;
}

summary:hover {
  background: var(--panel-fill);
}

summary:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.summary-title {
  display: block;
  font-weight: 700;
  color: var(--panel-ink);
}

.summary-values {
  display: block;
  font-size: 12px;
}

.chevron {
  width: 1rem;
  height: 1rem;
  margin-left: auto;
  transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.settings[open] .chevron {
  transform: rotate(180deg);
}

.fields {
  display: grid;
  gap: 0.7rem;
  border-top: 1px solid var(--panel-line);
  padding: 0.8rem;
}

.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.preset {
  border-radius: 8px;
  padding: 0.3rem 0.6rem;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--panel-soft);
  box-shadow: inset 0 0 0 1px var(--panel-line);
  transition: background-color 140ms, color 140ms;
}

.preset:hover {
  background: var(--panel-fill);
  color: var(--panel-ink);
}

.preset.is-on {
  background: var(--panel-fill);
  color: var(--panel-ink);
  box-shadow: inset 0 0 0 1.5px var(--accent-ink);
}

.field {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.field-text {
  min-width: 0;
  flex: 1;
}

.field-name {
  display: block;
  font-weight: 700;
}

.field-help {
  display: block;
  font-size: 12px;
  line-height: 1.35;
  color: var(--panel-soft);
}

/* The number and its unit read as one field. */
.field-input {
  display: flex;
  width: 6.5rem;
  flex-shrink: 0;
  align-items: center;
  border-radius: 9px;
  background: var(--panel-fill);
  padding-right: 0.6rem;
  box-shadow: inset 0 0 0 1px var(--panel-line);
  transition: box-shadow 140ms;
}

.field-input:focus-within {
  box-shadow: inset 0 0 0 1.5px var(--focus);
}

.field-input.is-invalid {
  box-shadow: inset 0 0 0 1.5px var(--loss-ink);
}

.field-input input {
  width: 100%;
  min-width: 0;
  background: transparent;
  padding: 0.4rem 0.3rem 0.4rem 0.6rem;
  text-align: right;
  font-weight: 700;
  color: var(--panel-ink);
}

.field-input input:focus {
  outline: none;
}

.unit {
  font-size: 12px;
  font-weight: 600;
  color: var(--panel-soft);
}

.problem {
  margin-top: -0.4rem;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--loss-ink);
}

.note {
  display: flex;
  gap: 0.4rem;
  font-size: 12px;
  line-height: 1.4;
  color: var(--panel-soft);
}

.note .ui-icon {
  width: 1rem;
  height: 1rem;
  margin-top: 0.05rem;
}

.preset:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .chevron {
    transition: none;
  }
}
</style>
