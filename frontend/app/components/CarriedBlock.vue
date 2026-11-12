<script setup lang="ts">
// A block in the air while a strategy builds itself: a tilted tile with a pointer on it. The parent moves it
// by animating the transform of this element, which is placed by its top left corner.
defineProps<{ label: string, kind: 'market' | 'entry' | 'exit', tileScale?: number }>()
</script>

<template>
  <div class="carried" :class="`carried--${kind}`" aria-hidden="true">
    <span class="carried-tile" :style="tileScale === undefined ? undefined : { scale: tileScale }">
      <span class="carried-dot" />{{ label }}
    </span>
    <svg class="carried-pointer" viewBox="0 0 24 24">
      <path d="M5 3l14 8-6.2 1.6L9.6 19z" />
    </svg>
  </div>
</template>

<style scoped>
.carried {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  will-change: transform;
}

/* The block is placed by its centre, so it lifts from the middle of one tile and lands on the middle of another. */
.carried-tile {
  position: absolute;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  translate: -50% -50%;
  rotate: -2deg;
  border-radius: 10px;
  background: var(--panel);
  padding: 0.5rem 0.8rem;
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
  color: var(--panel-ink);
  box-shadow: inset 0 0 0 1px var(--tile-line);
  filter: drop-shadow(0 18px 24px rgb(0 0 0 / 0.35));
}

.carried-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 3px;
  background: var(--color-indicator);
}

.carried--entry .carried-dot {
  background: var(--color-gain);
}

.carried--exit .carried-dot {
  background: var(--color-loss);
}

.carried-pointer {
  position: absolute;
  top: 2px;
  left: 6px;
  width: 1.5rem;
  height: 1.5rem;
  fill: var(--panel-ink);
  stroke: var(--panel);
  stroke-width: 1.5;
  stroke-linejoin: round;
  filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.4));
}
</style>
