<script setup lang="ts">
// The strip above every landing chart, as in TradingView: what is charted on the left, a reading on the right.
defineProps<{ name: string, detail?: string, icon?: string }>()
</script>

<template>
  <div class="chart-bar">
    <img v-if="icon" :src="`/brand-icons/${icon}.svg`" alt="" class="coin">
    <span class="chart-bar-name">{{ name }}</span>
    <span v-if="detail">{{ detail }}</span>
    <span class="chart-bar-reading">
      <slot />
    </span>
  </div>
</template>

<style scoped>
.chart-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.6rem;
  container-type: inline-size;
  padding: 0.8rem 1rem;
  font-size: 13px;
  color: var(--panel-soft);
  font-variant-numeric: tabular-nums;
}

.chart-bar-name {
  font-weight: 700;
  color: var(--panel-ink);
}

.coin {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 999px;
  background: #ffffff;
  padding: 1px;
}

/* The reading changes under the crosshair on every move, so it never wraps and never changes width:
   otherwise the chart below it would jump up and down. */
.chart-bar-reading {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.6rem;
  margin-left: auto;
  white-space: nowrap;
}

.chart-bar-reading :deep(b) {
  display: inline-block;
  min-width: 6ch;
  font-weight: 600;
}

/* In a narrow panel the reading gets its own fixed line under the name. */
@container (max-width: 560px) {
  .chart-bar-reading {
    width: 100%;
    margin-left: 0;
  }
}

@media (max-width: 640px) {
  .chart-bar-reading {
    display: none;
  }
}
</style>
