<script setup lang="ts">
withDefaults(defineProps<{ inverted?: boolean }>(), { inverted: false })
</script>

<template>
  <span class="brand-logo" :class="{ 'is-inverted': inverted }">
    <!-- Three snapping blocks that rise like a chart: building a strategy and its result in one mark. -->
    <svg viewBox="0 0 32 32" class="brand-logo__mark" aria-hidden="true">
      <rect x="2" y="19" width="8" height="11" rx="2" class="block block--low" />
      <rect x="4.5" y="16.5" width="3" height="3" rx="1" class="block block--low" />
      <rect x="12" y="12" width="8" height="18" rx="2" class="block block--mid" />
      <rect x="14.5" y="9.5" width="3" height="3" rx="1" class="block block--mid" />
      <rect x="22" y="5" width="8" height="25" rx="2" class="block block--top" />
      <rect x="24.5" y="2.5" width="3" height="3" rx="1" class="block block--top" />
    </svg>
    <span class="brand-logo__word">BlockStrat</span>
  </span>
</template>

<style scoped>
.brand-logo {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--logo-ink, #0d1b24);
}

.brand-logo.is-inverted {
  color: #ffffff;
}

.brand-logo__mark {
  width: 1.75rem;
  height: 1.75rem;
}

.block {
  fill: currentColor;
}

.block--low {
  opacity: 0.35;
}

.block--mid {
  opacity: 0.65;
}

/* The tallest block is the brand's accent: lime on dark grounds, the gain green on light ones. */
.block--top {
  fill: var(--logo-accent, var(--color-gain));
}

.is-inverted .block--top {
  fill: var(--logo-accent, var(--color-lime));
}

.brand-logo__word {
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}
</style>
