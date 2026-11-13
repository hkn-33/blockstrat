<script setup lang="ts">
import { indicatorBlock, type IndicatorKind } from '~/utils/blockLibrary'

// One indicator, large: its explanation beside a chart to study, with zoom, a crosshair and a period to
// change, so "what does RSI 14 against RSI 7 look like" is answered by looking. Mounted only while open.
const props = defineProps<{ kind: IndicatorKind, legend: string }>()
const emit = defineEmits<{ close: [], use: [part: 'entry' | 'exit'] }>()

// The periods traders reach for first; the indicator's usual one is preselected.
const PERIOD_CHOICES: Partial<Record<IndicatorKind, number[]>> = {
  sma: [20, 50, 100, 200],
  ema: [9, 20, 50, 100],
  rsi: [7, 14, 21],
  bollinger: [10, 20, 50],
  highest: [10, 20, 55],
  lowest: [10, 20, 55],
  change: [1, 7, 30],
  relative_volume: [10, 20, 50],
  stochastic: [5, 14, 21],
}
const USUAL_PERIODS: Partial<Record<IndicatorKind, number>> = { sma: 50, ema: 20, rsi: 14, bollinger: 20, highest: 20, lowest: 10, change: 7, relative_volume: 20, stochastic: 14 }

const dialog = ref<HTMLDialogElement | null>(null)
const block = computed(() => indicatorBlock(props.kind))
const periods = computed(() => PERIOD_CHOICES[props.kind] ?? [])
const period = ref(USUAL_PERIODS[props.kind])

function closeOnBackdrop(event: MouseEvent): void {
  if (event.target === dialog.value) dialog.value?.close()
}

function use(part: 'entry' | 'exit'): void {
  emit('use', part)
  dialog.value?.close()
}

// The chart is drawn only once the dialog is open: drawn inside a closed dialog it has no width to fit to.
const isOpen = ref(false)

onMounted(() => {
  dialog.value?.showModal()
  isOpen.value = true
})
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="indicator-dialog" :aria-label="block.name" @close="emit('close')" @click="closeOnBackdrop">
      <div class="dialog-body">
        <header class="dialog-head">
          <div class="min-w-0">
            <h2 class="dialog-title">
              {{ block.name }}
            </h2>
            <p class="dialog-short">
              {{ block.short }}
            </p>
          </div>
          <button type="button" class="dialog-close" v-tip="'Close'" @click="dialog?.close()">
            <UiIcon name="x" />
          </button>
        </header>

        <p class="dialog-help">
          {{ block.help }}
        </p>

        <div v-if="periods.length" class="periods" role="radiogroup" aria-label="Period, in candles">
          <span class="periods-label">Period</span>
          <button v-for="choice in periods" :key="choice" type="button" role="radio" :aria-checked="period === choice" :class="{ 'is-on': period === choice }" @click="period = choice">
            {{ choice }}
          </button>
          <span class="periods-note">candles. A shorter period reacts faster and gives more false alarms.</span>
        </div>

        <div class="dialog-chart">
          <BuilderIndicatorPreview v-if="isOpen" :kind="kind" :period="period" large />
        </div>
        <p class="dialog-legend">
          {{ legend }}. Drag to move through time, scroll to zoom.
        </p>

        <footer class="dialog-actions">
          <button type="button" class="dialog-use" @click="use('entry')">
            <UiIcon name="log-in" /> Use when getting in
          </button>
          <button type="button" class="dialog-use" @click="use('exit')">
            <UiIcon name="log-out" /> Use when getting out
          </button>
        </footer>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.indicator-dialog {
  width: min(56rem, calc(100vw - 2rem));
  max-height: calc(100dvh - 2rem);
  margin: auto;
  border-radius: 22px;
  background: var(--panel);
  padding: 0;
  color: var(--panel-ink);
  box-shadow: var(--panel-shadow), 0 40px 80px -30px rgb(0 0 0 / 0.6);
}

.indicator-dialog::backdrop {
  background: rgb(4 20 23 / 0.6);
  backdrop-filter: blur(4px);
}

.indicator-dialog[open] {
  animation: dialog-in 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes dialog-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
}

.dialog-body {
  display: grid;
  gap: 0.9rem;
  padding: 1.4rem 1.5rem 1.5rem;
}

.dialog-head {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.dialog-title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.dialog-short,
.dialog-legend,
.periods-note {
  font-size: 13px;
  color: var(--panel-soft);
}

.dialog-close {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex-shrink: 0;
  place-items: center;
  margin-left: auto;
  border-radius: 10px;
  color: var(--panel-soft);
}

.dialog-close:hover {
  background: var(--panel-fill);
  color: var(--panel-ink);
}

.dialog-help {
  max-width: 44rem;
  font-size: 15px;
  line-height: 1.55;
}

.periods {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

.periods-label {
  margin-right: 0.25rem;
  font-size: 13px;
  font-weight: 700;
}

.periods button {
  min-width: 2.6rem;
  border-radius: 9px;
  padding: 0.3rem 0.6rem;
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--panel-soft);
  box-shadow: inset 0 0 0 1px var(--panel-line);
  transition: background-color 140ms, color 140ms;
}

.periods button:hover {
  background: var(--panel-fill);
  color: var(--panel-ink);
}

.periods button.is-on {
  background: var(--panel-fill);
  color: var(--panel-ink);
  box-shadow: inset 0 0 0 1.5px var(--accent-ink);
}

.periods-note {
  margin-left: 0.25rem;
}

.dialog-chart {
  min-height: min(26rem, 52vh);
  border-radius: 14px;
  background: var(--panel-2);
  padding: 0.5rem;
  box-shadow: inset 0 0 0 1px var(--panel-line);
}

.dialog-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.dialog-use {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border-radius: 10px;
  padding: 0.5rem 0.9rem;
  font-size: 14px;
  font-weight: 700;
  box-shadow: inset 0 0 0 1px var(--panel-line);
  transition: background-color 140ms, transform 120ms;
}

.dialog-use:hover {
  background: var(--panel-fill);
}

.dialog-use:active {
  transform: scale(0.97);
}

.dialog-close:focus-visible,
.periods button:focus-visible,
.dialog-use:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .indicator-dialog[open] {
    animation: none;
  }
}
</style>
