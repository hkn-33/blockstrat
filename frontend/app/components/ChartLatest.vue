<script setup lang="ts">
// The button a chart shows once it has been dragged away from the latest candles, as TradingView's does: it
// takes the view back to now. The chart that holds it places it over its plot.
defineProps<{ visible: boolean }>()
const emit = defineEmits<{ click: [] }>()
</script>

<template>
  <Transition name="latest">
    <button v-if="visible" type="button" class="chart-latest" v-tip="'Back to the latest candles'" @click="emit('click')">
      <UiIcon name="chevrons-right" />
    </button>
  </Transition>
</template>

<style scoped>
.chart-latest {
  position: absolute;
  z-index: 5;
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 9px;
  background: var(--panel);
  color: var(--panel-ink);
  box-shadow: inset 0 0 0 1px var(--panel-line), 0 6px 16px -6px rgb(0 0 0 / 0.45);
  transition: background-color 140ms, transform 140ms cubic-bezier(0.22, 1, 0.36, 1);
}

.chart-latest svg {
  width: 1.1rem;
  height: 1.1rem;
}

.chart-latest:hover {
  background: var(--panel-fill);
  transform: translateX(2px);
}

.chart-latest:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.latest-enter-active {
  transition: opacity 200ms cubic-bezier(0.22, 1, 0.36, 1), transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.latest-leave-active {
  transition: opacity 120ms cubic-bezier(0.4, 0, 1, 1), transform 120ms cubic-bezier(0.4, 0, 1, 1);
}

.latest-enter-from {
  opacity: 0;
  transform: translateX(-6px) scale(0.96);
}

.latest-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

@media (prefers-reduced-motion: reduce) {
  .chart-latest,
  .latest-enter-active,
  .latest-leave-active {
    transition: opacity 100ms linear;
  }

  .chart-latest:hover,
  .latest-enter-from,
  .latest-leave-to {
    transform: none;
  }
}
</style>
