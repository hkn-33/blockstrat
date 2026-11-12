<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

// One card on the canvas, with a grip on its top edge to move it by. The card the guide is waiting for gets
// a dashed outline and, beside it, a short instruction with a hand-drawn arrow onto the place to fill, and a
// button that turns the hints off.
withDefaults(defineProps<{ isNext?: boolean, hint?: string, first?: boolean, last?: boolean }>(), { isNext: false, hint: '', first: false, last: false })
const emit = defineEmits<{ hideHints: [] }>()
</script>

<template>
  <div class="card" :class="{ 'is-next': isNext }">
    <Handle v-if="!first" type="target" :position="Position.Top" class="handle" :connectable="false" />
    <span class="card-grip" title="Drag to move this card" aria-hidden="true"><UiIcon name="grip-vertical" /></span>
    <slot />
    <Handle v-if="!last" type="source" :position="Position.Bottom" class="handle" :connectable="false" />

    <div v-if="isNext && hint" class="guide">
      <div class="guide-note">
        <p class="guide-text">
          {{ hint }}
        </p>
        <button type="button" class="guide-off nodrag nopan" @click="emit('hideHints')">
          Turn off hints
        </button>
      </div>
      <svg class="guide-arrow" viewBox="0 0 70 50" fill="none" aria-hidden="true">
        <path d="M4 10 C 24 4, 46 12, 60 34" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" />
        <path d="M45 37 L 62 38 L 61 21" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.card {
  position: relative;
  width: 26rem;
  border-radius: 18px;
  background: var(--panel);
  color: var(--panel-ink);
  box-shadow: var(--panel-shadow);
  transition: box-shadow 240ms;
}

/* The waiting card gets a dashed outline a little outside its edge, as if drawn around it by hand. */
.card.is-next::before {
  position: absolute;
  inset: -8px;
  border: 2px dashed var(--accent-ink);
  border-radius: 24px;
  pointer-events: none;
  content: "";
  animation: outline-in 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes outline-in {
  from {
    opacity: 0;
    transform: scale(1.03);
  }
}

.card {
  animation: card-in 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes card-in {
  from {
    opacity: 0;
    transform: scale(0.97);
  }
}

.handle {
  opacity: 0;
}

/* The grip sits on the top edge, over the point where the line from the card above arrives. */
.card-grip {
  position: absolute;
  top: 0;
  left: 50%;
  z-index: 1;
  display: grid;
  width: 2.1rem;
  height: 1.05rem;
  place-items: center;
  translate: -50% -50%;
  cursor: grab;
  border-radius: 999px;
  background: var(--panel);
  color: var(--panel-soft);
  box-shadow: inset 0 0 0 1px var(--tile-line);
  transition: color 140ms, box-shadow 140ms;
}

.card-grip:hover {
  color: var(--panel-ink);
  box-shadow: inset 0 0 0 1.5px var(--accent-ink);
}

.card-grip:active {
  cursor: grabbing;
}

.card-grip .ui-icon {
  width: 0.85rem;
  height: 0.85rem;
  rotate: 90deg;
}

/* The note stands left of the card, where the blocks come from, level with the place to fill; the
   hand-drawn arrow runs from it onto that place. */
.guide {
  position: absolute;
  top: var(--guide-top, 2.2rem);
  right: calc(100% + 0.9rem);
  display: flex;
  /* Placed outside the card, it would otherwise be squeezed to its narrowest. */
  width: max-content;
  align-items: flex-start;
  gap: 0.2rem;
  color: var(--accent-ink);
  pointer-events: none;
}

.guide-note {
  display: grid;
  justify-items: start;
  gap: 0.3rem;
}

.guide-text {
  max-width: 9.5rem;
  text-wrap: balance;
  line-height: 1.25;
  transform: rotate(-2deg);
  border-radius: 12px;
  background: var(--accent-ink);
  padding: 0.45rem 0.75rem;
  font-size: 15px;
  font-weight: 700;
  color: var(--panel);
}

.guide-off {
  border-radius: 6px;
  padding: 0.1rem 0.35rem;
  font-size: 12px;
  font-weight: 600;
  color: var(--panel-soft);
  pointer-events: auto;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.guide-off:hover {
  color: var(--panel-ink);
}

.guide-off:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.guide-arrow {
  width: 2.8rem;
  margin-top: 0.9rem;
}

/* One column of cards fills a narrow screen, so the note moves above the card and the arrow goes. */
@media (max-width: 1099px) {
  .guide {
    top: auto;
    right: auto;
    bottom: calc(100% + 0.9rem);
    left: 0;
  }

  /* One line, so it fits in the gap between two cards. */
  .guide-note {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .guide-text {
    max-width: none;
    white-space: nowrap;
  }

  .guide-arrow {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .card,
  .card.is-next::before {
    animation: none;
  }
}
</style>
