<script setup lang="ts">
import type { InstrumentInfo } from '~/types/api'

// The markets as a list of logos and names, for a popover: the chosen ones carry a check.
defineProps<{ instruments: InstrumentInfo[], chosen: string[], isDisabled?: (symbol: string) => boolean }>()
const emit = defineEmits<{ pick: [symbol: string] }>()
</script>

<template>
  <ul class="grid gap-0.5">
    <li v-for="instrument in instruments" :key="instrument.symbol">
      <button
        type="button"
        class="market-choice"
        :class="{ 'is-on': chosen.includes(instrument.symbol) }"
        :aria-pressed="chosen.includes(instrument.symbol)"
        :disabled="isDisabled?.(instrument.symbol)"
        @click="emit('pick', instrument.symbol)"
      >
        <CoinMark :symbol="instrument.symbol" /> {{ instrument.label }}
        <UiIcon v-if="chosen.includes(instrument.symbol)" name="check" class="market-check" />
      </button>
    </li>
  </ul>
</template>

<style scoped>
.market-choice {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.55rem;
  border-radius: 8px;
  padding: 0.4rem 0.55rem;
  text-align: left;
  font-weight: 600;
}

.market-choice:hover:not(:disabled),
.market-choice.is-on {
  background: var(--panel-fill);
}

.market-choice:disabled {
  opacity: 0.45;
}

.market-choice:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: -2px;
}

.market-check {
  margin-left: auto;
  color: var(--accent-ink);
}
</style>
