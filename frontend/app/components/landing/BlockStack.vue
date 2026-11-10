<script setup lang="ts">
// The strategy as a stack of action blocks: neutral cards joined by one rail, colour only on each block's icon.
export type BlockTone = 'entry' | 'exit' | 'risk'
export type BlockPart = string | { value: string }

export interface StrategyBlock {
  tone: BlockTone
  label: string
  parts: BlockPart[]
}

withDefaults(defineProps<{
  market: string
  timeframe: string
  blocks: StrategyBlock[]
  entrance?: boolean
  theme?: 'light' | 'dark'
}>(), { entrance: false, theme: 'light' })

const TONE_ICON: Record<BlockTone, string> = {
  entry: 'log-in',
  exit: 'log-out',
  risk: 'shield',
}
</script>

<template>
  <div class="stack" :class="[`stack--${theme}`, { 'has-entrance': entrance }]">
    <div class="block block--head">
      <span class="glyph glyph--head"><UiIcon name="coins" /></span>
      <span class="label">Trade</span>
      <span class="value">{{ market }}</span>
      <span class="text">every</span>
      <span class="value">{{ timeframe }}</span>
    </div>
    <div
      v-for="(block, index) in blocks"
      :key="index"
      class="block"
      :style="{ '--step': index }"
    >
      <span class="glyph" :class="`glyph--${block.tone}`"><UiIcon :name="TONE_ICON[block.tone]" /></span>
      <span class="label">{{ block.label }}</span>
      <template v-for="(part, partIndex) in block.parts" :key="partIndex">
        <span v-if="typeof part === 'string'" class="text">{{ part }}</span>
        <span v-else class="value">{{ part.value }}</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.stack {
  --surface: #ffffff;
  --surface-line: rgb(13 27 36 / 0.08);
  --text: #0d1b24;
  --text-soft: #4a5c66;
  --value-bg: rgb(13 27 36 / 0.06);
  --rail: rgb(13 27 36 / 0.14);
  --shadow: 0 1px 2px rgb(13 27 36 / 0.06), 0 10px 24px -16px rgb(13 27 36 / 0.35);
  position: relative;
  display: grid;
  gap: 0.6em;
  font-size: var(--block-size, 15px);
}

.stack--dark {
  --surface: rgb(255 255 255 / 0.08);
  --surface-line: rgb(255 255 255 / 0.12);
  --text: #ffffff;
  --text-soft: rgb(255 255 255 / 0.7);
  --value-bg: rgb(255 255 255 / 0.1);
  --rail: rgb(255 255 255 / 0.18);
  --shadow: 0 10px 30px -18px rgb(0 0 0 / 0.6);
}

/* The rail that joins every block, through the centre of the icons. */
.stack::before {
  position: absolute;
  top: 1.5em;
  bottom: 1.5em;
  left: calc(0.75em + 0.95em);
  width: 2px;
  border-radius: 2px;
  background: var(--rail);
  content: "";
}

.block {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4em 0.45em;
  border-radius: 14px;
  background: var(--surface);
  padding: 0.65em 0.9em 0.65em 0.75em;
  color: var(--text);
  box-shadow: inset 0 0 0 1px var(--surface-line), var(--shadow);
  backdrop-filter: blur(12px);
}

.glyph {
  display: grid;
  width: 1.9em;
  height: 1.9em;
  flex-shrink: 0;
  place-items: center;
  margin-right: 0.3em;
  border-radius: 0.6em;
  color: #ffffff;
  font-size: 0.95em;
}

.glyph :deep(.ui-icon) {
  width: 1.05em;
  height: 1.05em;
}

.glyph--head { background: #0e3f47; color: #c8f25a; }
.glyph--entry { background: #16a37a; }
.glyph--exit { background: #3d6ef5; }
.glyph--risk { background: #ec5b4d; }

.label {
  font-weight: 700;
}

.text {
  color: var(--text-soft);
}

.value {
  border-radius: 6px;
  background: var(--value-bg);
  padding: 0.1em 0.4em;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* Entrance: each block snaps under the one above it, with a small overshoot. */
.has-entrance .block:not(.block--head) {
  animation: snap-in 460ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
  animation-delay: calc(500ms + var(--step) * 380ms);
}

@keyframes snap-in {
  from {
    opacity: 0;
    transform: translate(44px, -12px) rotate(3deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .has-entrance .block:not(.block--head) {
    animation: none;
  }
}
</style>
