<script setup lang="ts">
import type { Operand } from '~/utils/strategyDocument'

// Picks what one side of a condition measures, and its settings: a price, an indicator with its periods,
// or (on the right-hand side) a plain number. The choices come in small families so the list stays easy
// to scan. Every change is sent at once.
const props = defineProps<{ operand: Operand, allowNumber: boolean }>()
const emit = defineEmits<{ change: [operand: Operand] }>()

type Kind = Operand['kind']

const KIND_FAMILIES: { name: string, kinds: { kind: Kind, label: string }[] }[] = [
  { name: 'Price', kinds: [{ kind: 'price', label: 'Price' }, { kind: 'highest', label: 'Highest high' }, { kind: 'lowest', label: 'Lowest low' }, { kind: 'change', label: 'Change %' }] },
  { name: 'Averages and bands', kinds: [{ kind: 'sma', label: 'SMA' }, { kind: 'ema', label: 'EMA' }, { kind: 'bollinger', label: 'Bollinger' }] },
  { name: 'Momentum', kinds: [{ kind: 'rsi', label: 'RSI' }, { kind: 'stochastic', label: 'Stochastic' }, { kind: 'macd', label: 'MACD' }] },
  { name: 'Volume', kinds: [{ kind: 'relative_volume', label: 'Volume vs average' }] },
  { name: 'A fixed value', kinds: [{ kind: 'constant', label: 'Number' }] },
]

const DEFAULTS: Record<Kind, Operand> = {
  price: { kind: 'price', field: 'close' },
  sma: { kind: 'sma', period: 50 },
  ema: { kind: 'ema', period: 20 },
  rsi: { kind: 'rsi', period: 14 },
  macd: { kind: 'macd', fast: 12, slow: 26, signal: 9, line: 'macd' },
  bollinger: { kind: 'bollinger', period: 20, std_dev: 2, band: 'lower' },
  highest: { kind: 'highest', period: 20 },
  lowest: { kind: 'lowest', period: 10 },
  change: { kind: 'change', period: 7 },
  relative_volume: { kind: 'relative_volume', period: 20 },
  stochastic: { kind: 'stochastic', period: 14, smooth: 3, line: 'k' },
  constant: { kind: 'constant', value: 30 },
}

const families = computed(() => KIND_FAMILIES.filter(family => props.allowNumber || family.kinds.every(option => option.kind !== 'constant')))

function pick(kind: Kind): void {
  if (kind === props.operand.kind) return
  emit('change', DEFAULTS[kind])
}

function set<K extends string>(key: K, value: number | string): void {
  emit('change', { ...props.operand, [key]: value } as Operand)
}

function setNumber(key: string, event: Event): void {
  const value = (event.target as HTMLInputElement).valueAsNumber
  set(key, Number.isNaN(value) ? 0 : value)
}
</script>

<template>
  <div class="grid gap-3">
    <div class="families" role="radiogroup" aria-label="What to measure">
      <div v-for="family in families" :key="family.name" class="family" role="group" :aria-label="family.name">
        <span class="family-name">{{ family.name }}</span>
        <div class="kinds">
          <button
            v-for="option in family.kinds"
            :key="option.kind"
            type="button"
            role="radio"
            :aria-checked="operand.kind === option.kind"
            :class="{ 'is-on': operand.kind === option.kind }"
            @click="pick(option.kind)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="operand.kind === 'price'" class="fields">
      <label class="field">Value
        <select :value="operand.field" @change="set('field', ($event.target as HTMLSelectElement).value)">
          <option value="close">Close</option>
          <option value="open">Open</option>
          <option value="high">High</option>
          <option value="low">Low</option>
          <option value="volume">Volume</option>
        </select>
      </label>
    </div>

    <div v-else-if="operand.kind === 'sma' || operand.kind === 'ema' || operand.kind === 'rsi'" class="fields">
      <label class="field">Period, in candles
        <input type="number" inputmode="numeric" min="1" max="1000" step="1" :value="operand.period" @input="setNumber('period', $event)">
      </label>
    </div>

    <div v-else-if="operand.kind === 'macd'" class="fields fields--three">
      <label class="field">Fast
        <input type="number" inputmode="numeric" min="1" step="1" :value="operand.fast" @input="setNumber('fast', $event)">
      </label>
      <label class="field">Slow
        <input type="number" inputmode="numeric" min="2" step="1" :value="operand.slow" @input="setNumber('slow', $event)">
      </label>
      <label class="field">Signal
        <input type="number" inputmode="numeric" min="1" step="1" :value="operand.signal" @input="setNumber('signal', $event)">
      </label>
      <label class="field field--wide">Line
        <select :value="operand.line" @change="set('line', ($event.target as HTMLSelectElement).value)">
          <option value="macd">MACD line</option>
          <option value="signal">Signal line</option>
          <option value="histogram">Histogram</option>
        </select>
      </label>
    </div>

    <div v-else-if="operand.kind === 'bollinger'" class="fields">
      <label class="field">Band
        <select :value="operand.band" @change="set('band', ($event.target as HTMLSelectElement).value)">
          <option value="upper">Upper</option>
          <option value="middle">Middle</option>
          <option value="lower">Lower</option>
        </select>
      </label>
      <label class="field">Period
        <input type="number" inputmode="numeric" min="2" step="1" :value="operand.period" @input="setNumber('period', $event)">
      </label>
      <label class="field">Width, in deviations
        <input type="number" inputmode="decimal" min="0.1" max="10" step="0.1" :value="operand.std_dev" @input="setNumber('std_dev', $event)">
      </label>
    </div>

    <div v-else-if="operand.kind === 'highest' || operand.kind === 'lowest'" class="fields">
      <label class="field">Look back over this many candles, not counting the current one
        <input type="number" inputmode="numeric" min="1" max="1000" step="1" :value="operand.period" @input="setNumber('period', $event)">
      </label>
    </div>

    <div v-else-if="operand.kind === 'change'" class="fields">
      <label class="field">Compare the close with this many candles ago
        <input type="number" inputmode="numeric" min="1" max="1000" step="1" :value="operand.period" @input="setNumber('period', $event)">
      </label>
    </div>

    <div v-else-if="operand.kind === 'relative_volume'" class="fields">
      <label class="field">Average the volume over this many candles
        <input type="number" inputmode="numeric" min="2" max="1000" step="1" :value="operand.period" @input="setNumber('period', $event)">
      </label>
    </div>

    <div v-else-if="operand.kind === 'stochastic'" class="fields fields--two">
      <label class="field field--wide">Line
        <select :value="operand.line" @change="set('line', ($event.target as HTMLSelectElement).value)">
          <option value="k">%K, the fast line</option>
          <option value="d">%D, the smoothed line</option>
        </select>
      </label>
      <label class="field">Period, in candles
        <input type="number" inputmode="numeric" min="2" max="1000" step="1" :value="operand.period" @input="setNumber('period', $event)">
      </label>
      <label class="field">%D smoothing, in candles
        <input type="number" inputmode="numeric" min="1" max="1000" step="1" :value="operand.smooth" @input="setNumber('smooth', $event)">
      </label>
    </div>

    <div v-else-if="operand.kind === 'constant'" class="fields">
      <label class="field">Number
        <!-- No inputmode: the iOS decimal pad has no minus key, and a fixed value can be negative (MACD below 0). -->
        <input type="number" step="any" :value="operand.value" @input="setNumber('value', $event)">
      </label>
    </div>
  </div>
</template>

<style scoped>
.families {
  display: grid;
  gap: 0.55rem;
}

.family {
  display: grid;
  gap: 0.25rem;
}

.family-name {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--panel-soft);
}

.kinds {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.kinds button {
  cursor: pointer;
  border-radius: 8px;
  padding: 0.35rem 0.6rem;
  font-size: 13px;
  font-weight: 600;
  color: var(--panel-soft);
  box-shadow: inset 0 0 0 1px var(--panel-line);
  transition: background-color 140ms, color 140ms;
}

.kinds button:hover {
  color: var(--panel-ink);
}

.kinds button.is-on {
  background: var(--panel-ink);
  color: var(--panel);
  box-shadow: none;
}

.kinds button:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.fields {
  display: grid;
  gap: 0.6rem;
}

.fields--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.fields--two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.field--wide {
  grid-column: 1 / -1;
}

.field {
  display: grid;
  gap: 0.3rem;
  font-size: 12px;
  font-weight: 600;
  color: var(--panel-soft);
}

.field input,
.field select {
  min-width: 0;
  border-radius: 8px;
  background: var(--panel-fill);
  padding: 0.45rem 0.6rem;
  font-size: 14px;
  font-weight: 600;
  color: var(--panel-ink);
  font-variant-numeric: tabular-nums;
  box-shadow: inset 0 0 0 1px var(--panel-line);
}

.field select option {
  background: var(--panel);
  color: var(--panel-ink);
}

.field input:focus,
.field select:focus {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
}
</style>
