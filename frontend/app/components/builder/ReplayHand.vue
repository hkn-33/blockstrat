<script setup lang="ts">
import type { ReplayFlight } from '~/composables/useStrategyReplay'

// What the user sees while a strategy builds itself: the block in the air with a pointer on it, a shield
// that keeps stray clicks from editing a strategy that is still arriving, and a way to skip to the end.
defineProps<{ flight: ReplayFlight | null }>()
const emit = defineEmits<{ skip: [] }>()
</script>

<template>
  <Teleport to="body">
    <div class="replay" role="status" aria-live="polite">
      <div class="replay-bar">
        <span class="replay-dot" />
        <span>Building your strategy</span>
        <button type="button" class="replay-skip" @click="emit('skip')">
          Skip
        </button>
      </div>

      <CarriedBlock
        v-if="flight"
        :label="flight.label"
        :kind="flight.kind"
        :tile-scale="0.92 + 0.08 * Math.sin(flight.progress * Math.PI)"
        :style="{ transform: `translate(${flight.x}px, ${flight.y}px)` }"
      />
    </div>
  </Teleport>
</template>

<style scoped>
.replay {
  position: fixed;
  inset: 0;
  z-index: 95;
  cursor: progress;
}

.replay-bar {
  position: absolute;
  top: 4.25rem;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  transform: translateX(-50%);
  border-radius: 999px;
  background: var(--panel-ink);
  padding: 0.4rem 0.45rem 0.4rem 0.9rem;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--panel);
  box-shadow: 0 18px 40px -18px rgb(0 0 0 / 0.6);
  animation: bar-in 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes bar-in {
  from {
    opacity: 0;
    transform: translate(-50%, -8px);
  }
}

.replay-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: var(--color-lime);
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  50% {
    opacity: 0.35;
  }
}

.replay-skip {
  cursor: pointer;
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel) 16%, transparent);
  padding: 0.2rem 0.7rem;
  font-size: 12.5px;
  transition: background-color 140ms;
}

.replay-skip:hover {
  background: color-mix(in srgb, var(--panel) 28%, transparent);
}

.replay-skip:focus-visible {
  outline: 2px solid var(--color-lime);
  outline-offset: 2px;
}
</style>
