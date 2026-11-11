<script setup lang="ts">
import type { DemoMarket, RuleGroup } from '~/composables/useLandingDemo'

// A strategy as the builder shows it: a market, then an entry group and an exit group, each holding any
// number of conditions. A condition reads like a filter in a modern app: [what | how | value].

const props = withDefaults(defineProps<{
  market: DemoMarket
  timeframe: string
  entry: RuleGroup
  exit: RuleGroup
  theme?: 'light' | 'dark' | 'auto'
  entrance?: boolean
  // Show only the first conditions, in order across both groups, with an empty slot where the next one
  // will land, as the builder does while you drag. The rest keep their place, so nothing below moves.
  // Leave it out to show every condition.
  visibleCount?: number
  // Drawn straight onto its container, for when the container is already the frame.
  flush?: boolean
}>(), { theme: 'light', entrance: false, visibleCount: undefined, flush: false })

const coin = computed(() => demoMarket(props.market))
// 'auto' is decided by CSS from the page's dark class, so the prerendered markup is right in both themes.
const themeClass = computed(() => `rules--${props.theme}`)

const sections = computed(() => [
  {
    key: 'entry',
    icon: 'log-in',
    title: 'Buy when',
    tail: props.entry.match === 'all' ? 'all of these are true' : 'any of these is true',
    joiner: props.entry.match === 'all' ? 'and' : 'or',
    group: props.entry,
  },
  {
    key: 'exit',
    icon: 'log-out',
    title: 'Sell when',
    tail: props.exit.match === 'all' ? 'all of these are true' : 'any of these happens',
    joiner: props.exit.match === 'all' ? 'and' : 'or',
    group: props.exit,
  },
])

// Each condition gets its place in one sequence across both groups, so they snap in one after another.
function stepOf(sectionIndex: number, conditionIndex: number): number {
  return sectionIndex === 0 ? conditionIndex : props.entry.conditions.length + conditionIndex
}

function rowState(sectionIndex: number, conditionIndex: number): 'shown' | 'next' | 'pending' {
  if (props.visibleCount === undefined) return 'shown'
  const step = stepOf(sectionIndex, conditionIndex)
  if (step < props.visibleCount) return 'shown'
  return step === props.visibleCount ? 'next' : 'pending'
}
</script>

<template>
  <div class="rules" :class="[themeClass, { 'has-entrance': entrance, 'rules--flush': flush }]">
    <div class="rules-head">
      <img :src="`/brand-icons/${coin.icon}.svg`" alt="" class="coin">
      <span class="font-bold">{{ coin.label }}</span>
      <span class="muted">every {{ timeframe }}</span>
      <span class="ml-auto muted">Long only</span>
    </div>

    <section v-for="(section, sectionIndex) in sections" :key="section.key" class="group">
      <p class="group-title">
        <span class="glyph" :class="`glyph--${section.key}`"><UiIcon :name="section.icon" /></span>
        <span class="font-bold">{{ section.title }}</span>
        <span class="muted">{{ section.tail }}</span>
      </p>
      <ol class="conditions">
        <template v-for="(condition, conditionIndex) in section.group.conditions" :key="`${condition.subject}-${conditionIndex}`">
          <li
            class="condition-row"
            :class="`is-${rowState(sectionIndex, conditionIndex)}`"
            :style="{ '--step': visibleCount === undefined ? stepOf(sectionIndex, conditionIndex) : 0 }"
          >
            <span v-if="conditionIndex > 0" class="joiner">{{ section.joiner }}</span>
            <span class="condition" :class="`condition--${condition.kind ?? 'indicator'}`">
              <span class="segment segment--subject"><span class="dot" />{{ condition.subject }}</span>
              <span class="segment segment--operator">{{ condition.operator }}</span>
              <span class="segment segment--value">{{ condition.value }}</span>
            </span>
            <span v-if="rowState(sectionIndex, conditionIndex) === 'next'" class="slot">Drop a condition here</span>
          </li>
        </template>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.rules {
  --card: #ffffff;
  --text: #0d1b24;
  --soft: #5a6c77;
  --hair: rgb(13 27 36 / 0.1);
  --chip: #ffffff;
  --chip-line: rgb(13 27 36 / 0.12);
  --chip-split: rgb(13 27 36 / 0.08);
  --wash: rgb(13 27 36 / 0.04);
  display: grid;
  border-radius: 16px;
  background: var(--card);
  color: var(--text);
  font-size: var(--rules-size, 14px);
  box-shadow: inset 0 0 0 1px var(--hair), 0 24px 48px -32px rgb(13 27 36 / 0.45);
}

.rules--dark,
:global(.dark .rules--auto) {
  --card: #0f2a30;
  --text: #ffffff;
  --soft: rgb(255 255 255 / 0.7);
  --hair: rgb(255 255 255 / 0.1);
  --chip: rgb(255 255 255 / 0.06);
  --chip-line: rgb(255 255 255 / 0.14);
  --chip-split: rgb(255 255 255 / 0.1);
  --wash: rgb(255 255 255 / 0.04);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.08), inset 0 0 0 1px var(--hair), 0 30px 60px -30px rgb(0 0 0 / 0.7);
}

.rules--flush {
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.coin {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 999px;
  background: #ffffff;
  padding: 2px;
}

.rules-head {
  display: flex;
  align-items: center;
  gap: 0.6em;
  border-bottom: 1px solid var(--hair);
  padding: 0.9em 1.1em;
}

.muted {
  color: var(--soft);
}

.group {
  padding: 1em 1.1em 1.1em;
}

.group + .group {
  border-top: 1px solid var(--hair);
}

.group-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45em;
}

.glyph {
  display: grid;
  width: 1.75em;
  height: 1.75em;
  place-items: center;
  margin-right: 0.15em;
  border-radius: 0.55em;
  color: #ffffff;
}

.glyph :deep(.ui-icon) {
  width: 1em;
  height: 1em;
}

.glyph--entry { background: var(--color-gain); }
.glyph--exit { background: var(--color-loss); }

.conditions {
  display: grid;
  gap: 0.35em;
  margin-top: 0.75em;
  padding-left: 0.85em;
  border-left: 1.5px solid var(--chip-split);
  margin-left: 0.85em;
}

.condition-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5em;
  padding-left: 0.85em;
}

.joiner {
  width: 100%;
  font-size: 0.85em;
  font-weight: 600;
  color: var(--soft);
}

/* A condition reads as one control split in three: what is measured, how, and against what. */
.condition {
  display: inline-flex;
  max-width: 100%;
  overflow: hidden;
  border-radius: 10px;
  background: var(--chip);
  box-shadow: inset 0 0 0 1px var(--chip-line), 0 1px 2px rgb(13 27 36 / 0.06);
}

.segment {
  display: inline-flex;
  align-items: center;
  gap: 0.45em;
  padding: 0.45em 0.7em;
  white-space: nowrap;
}

.segment + .segment {
  box-shadow: inset 1px 0 0 var(--chip-split);
}

.segment--subject {
  font-weight: 700;
}

.segment--operator {
  color: var(--soft);
}

.segment--value {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.dot {
  width: 0.5em;
  height: 0.5em;
  border-radius: 2px;
  background: var(--color-indicator);
}

.condition--risk .dot {
  background: var(--color-loss);
}

/* A condition that has not landed yet keeps its room; the next one shows as a dashed slot over it. */
.condition-row.is-pending,
.condition-row.is-next {
  position: relative;
}

.condition-row.is-pending > *,
.condition-row.is-next > :not(.slot) {
  visibility: hidden;
}

.slot {
  position: absolute;
  bottom: 0;
  left: 0.85em;
  border: 1.5px dashed var(--chip-line);
  border-radius: 10px;
  padding: calc(0.45em - 1.5px) 0.8em;
  color: var(--soft);
  white-space: nowrap;
}

@media (max-width: 480px) {
  .segment {
    white-space: normal;
  }
}

/* Entrance: each condition slides into its group in turn. */
.has-entrance .condition-row.is-shown {
  animation: snap-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(120ms + var(--step) * 70ms);
}

@keyframes snap-in {
  from {
    opacity: 0;
    transform: translateX(24px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .has-entrance .condition-row.is-shown {
    animation: none;
  }
}
</style>
