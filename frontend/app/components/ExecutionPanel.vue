<script setup lang="ts">
import type { ExecutionModel, ExecutionPreset } from '~/types/api'

const props = defineProps<{ presets: ExecutionPreset[] }>()
const execution = defineModel<ExecutionModel>({ required: true })

const activePreset = computed(() =>
  props.presets.find(preset =>
    preset.execution.commission_pct === execution.value.commission_pct
    && preset.execution.slippage_bps === execution.value.slippage_bps,
  )?.id ?? 'custom',
)

function choosePreset(id: string): void {
  const preset = props.presets.find(candidate => candidate.id === id)
  if (preset) execution.value = { ...preset.execution }
}

function update(field: keyof ExecutionModel, raw: string): void {
  const value = Number(raw)
  if (Number.isFinite(value) && value >= 0) execution.value = { ...execution.value, [field]: value }
}
</script>

<template>
  <fieldset class="flex flex-wrap items-end gap-3">
    <legend class="sr-only">
      Trading costs
    </legend>
    <label class="flex flex-col text-xs text-slate-600">
      Preset
      <select
        class="mt-0.5 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
        :value="activePreset"
        @change="choosePreset(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="preset in presets" :key="preset.id" :value="preset.id">
          {{ preset.label }}
        </option>
        <option value="custom" disabled>
          Custom
        </option>
      </select>
    </label>
    <label class="flex flex-col text-xs text-slate-600">
      Commission %
      <input
        type="number" min="0" max="5" step="0.01"
        class="mt-0.5 w-20 rounded-md border border-slate-300 px-2 py-1 text-sm tabular-nums"
        :value="execution.commission_pct"
        @change="update('commission_pct', ($event.target as HTMLInputElement).value)"
      >
    </label>
    <label class="flex flex-col text-xs text-slate-600">
      Slippage bps
      <input
        type="number" min="0" max="500" step="1"
        class="mt-0.5 w-20 rounded-md border border-slate-300 px-2 py-1 text-sm tabular-nums"
        :value="execution.slippage_bps"
        @change="update('slippage_bps', ($event.target as HTMLInputElement).value)"
      >
    </label>
    <p class="basis-full text-[11px] text-slate-500">
      Orders fill at the next bar's open, never at the signal bar's close.
    </p>
  </fieldset>
</template>
