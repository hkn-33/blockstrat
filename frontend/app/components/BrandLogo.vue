<template>
  <span class="brand-logo">
    <!-- A builder block, notch on top and tab below, with a result line rising inside it: blocks in, a test out. -->
    <svg viewBox="0 0 32 32" class="brand-logo__mark" aria-hidden="true">
      <path
        class="mark-block"
        d="M6 7h3l1.5 2.2h3L15 7h11q3 0 3 3v14q0 3-3 3H15l-1.5 2.2h-3L9 27H6q-3 0-3-3V10q0-3 3-3z"
      />
      <polyline class="mark-line" points="8,21 12.5,16.5 16.5,19.5 24,12" />
    </svg>
    <span class="brand-logo__word">BlockStrat</span>
    <span class="brand-logo__beta">Beta</span>
  </span>
</template>

<style scoped>
.brand-logo {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--logo-ink, #0d1b24);
}

.brand-logo__mark {
  width: 1.75rem;
  height: 1.75rem;
}

/* Ink block with a lime line on light grounds; a lime block with a dark line on dark ones. */
.mark-block {
  fill: var(--logo-block, var(--color-ink));
}

.mark-line {
  fill: none;
  stroke: var(--logo-line, var(--color-lime));
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.brand-logo__word {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.brand-logo__beta {
  border-radius: 6px;
  padding: 0.1rem 0.4rem;
  box-shadow: inset 0 0 0 1px currentColor;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1.4;
  text-transform: uppercase;
  opacity: 0.7;
}
</style>
