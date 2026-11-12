<script setup lang="ts">
// A coin's logo in a white disc, or its first letters when there is no logo for it.
const props = defineProps<{ symbol: string }>()

const icon = computed(() => coinIcon(props.symbol))
</script>

<template>
  <img v-if="icon" :src="`/brand-icons/${icon}.svg`" alt="" class="coin-mark">
  <span v-else class="coin-mark coin-mark--letters" aria-hidden="true">{{ baseCoin(symbol).slice(0, 2) }}</span>
</template>

<style scoped>
.coin-mark {
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
  border-radius: 999px;
  background: #ffffff;
  padding: 2px;
}

.coin-mark--letters {
  display: grid;
  place-items: center;
  background: var(--panel-fill-strong);
  font-size: 10px;
  font-weight: 700;
  color: var(--panel-ink);
}
</style>
