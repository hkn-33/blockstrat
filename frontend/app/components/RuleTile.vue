<script setup lang="ts">
// One condition as a tile split in three: what is measured, how, and against what. The landing page shows
// it read-only; the builder makes each part a button that opens its editor.
export type TilePart = 'left' | 'operator' | 'right'

withDefaults(defineProps<{
  subject: string
  operator: string
  value: string
  kind?: 'indicator' | 'risk'
  editable?: boolean
  invalid?: boolean
}>(), { kind: 'indicator', editable: false, invalid: false })

const emit = defineEmits<{ edit: [part: TilePart, anchor: HTMLElement] }>()

function open(part: TilePart, event: MouseEvent): void {
  emit('edit', part, event.currentTarget as HTMLElement)
}
</script>

<template>
  <span class="tile" :class="[`tile--${kind}`, { 'is-editable': editable, 'is-invalid': invalid }]">
    <template v-if="editable">
      <button type="button" class="segment segment--subject" @click="open('left', $event)"><span class="dot" />{{ subject }}</button>
      <button type="button" class="segment segment--operator" @click="open('operator', $event)">{{ operator }}</button>
      <button type="button" class="segment segment--value" @click="open('right', $event)">{{ value }}</button>
    </template>
    <template v-else>
      <span class="segment segment--subject"><span class="dot" />{{ subject }}</span>
      <span class="segment segment--operator">{{ operator }}</span>
      <span class="segment segment--value">{{ value }}</span>
    </template>
    <slot />
  </span>
</template>

<style scoped>
.tile {
  display: inline-flex;
  max-width: 100%;
  align-items: stretch;
  overflow: hidden;
  border-radius: 10px;
  background: var(--tile-bg);
  box-shadow: inset 0 0 0 1px var(--tile-line), 0 1px 2px rgb(13 27 36 / 0.06);
}

.tile.is-invalid {
  box-shadow: inset 0 0 0 1.5px var(--loss-ink);
}

.segment {
  display: inline-flex;
  align-items: center;
  gap: 0.45em;
  padding: 0.45em 0.7em;
  white-space: nowrap;
  color: inherit;
  font: inherit;
}

.segment + .segment,
.tile > :deep(:not(.segment)) {
  box-shadow: inset 1px 0 0 var(--tile-split);
}

.segment--subject {
  font-weight: 700;
}

.segment--operator {
  color: var(--panel-soft);
}

.segment--value {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.is-editable .segment {
  cursor: pointer;
  transition: background-color 140ms;
}

.is-editable .segment:hover {
  background: var(--panel-fill);
}

/* Editable parts carry a dotted underline, the web's usual sign for "this can be changed". */
.is-editable .segment--subject,
.is-editable .segment--value,
.is-editable .segment--operator {
  text-decoration: underline dotted;
  text-decoration-color: var(--panel-soft);
  text-underline-offset: 4px;
}

.is-editable .segment:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: -2px;
}

.dot {
  width: 0.5em;
  height: 0.5em;
  border-radius: 2px;
  background: var(--color-indicator);
}

.tile--risk .dot {
  background: var(--color-loss);
}

@media (max-width: 480px) {
  .segment {
    white-space: normal;
  }
}
</style>
