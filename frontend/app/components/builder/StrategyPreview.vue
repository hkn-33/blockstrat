<script setup lang="ts">
import type { StrategyDraft } from '~/types/api'
import type { GroupItem } from '~/utils/strategyDocument'

// A strategy drawn read-only with the builder's own tiles, for the assistant's answers.
const props = defineProps<{ strategy: StrategyDraft }>()

const document = computed(() => documentFromDraft(props.strategy))

const sections = computed(() => document.value.sides.flatMap(side => [
  { key: `entry-${side.id}`, part: 'entry', icon: 'log-in', title: side.direction === 'short' ? 'Sell short when' : 'Buy when', group: side.entry, side },
  { key: `exit-${side.id}`, part: 'exit', icon: 'log-out', title: side.direction === 'short' ? 'Buy back when' : 'Sell when', group: side.exit, side },
]))

const marketNames = computed(() => {
  if (!document.value.instruments.length) return 'Any market'
  return document.value.instruments.map(symbol => `${baseCoin(symbol)}/USDT`).join(', ')
})

function tail(group: GroupItem): string {
  if (group.match === 'all') return 'all of these'
  if (group.match === 'any') return 'any of these'
  return `at least ${group.threshold} of these`
}
</script>

<template>
  <div class="rules preview">
    <div class="rules-head">
      <CoinMark v-if="document.instruments[0]" :symbol="document.instruments[0]" />
      <span class="font-bold">{{ marketNames }}</span>
      <span v-if="document.timeframe" class="rules-muted">every {{ document.timeframe }}</span>
    </div>
    <section v-for="section in sections" :key="section.key" class="rules-group">
      <p class="rules-title">
        <span class="rules-glyph" :class="`rules-glyph--${section.part}`"><UiIcon :name="section.icon" /></span>
        <span class="font-bold">{{ section.title }}</span>
        <span class="rules-muted">{{ tail(section.group) }}</span>
      </p>
      <ol class="rules-list">
        <li v-for="item in section.group.items" :key="item.id" class="rules-row">
          <span v-if="isWeighted(section.group)" class="weight">×{{ weightLabel(item.weight) }}</span>
          <RuleTile v-if="item.type === 'condition'" :subject="operandLabel(item.left)" :operator="operatorLabel(item.operator, item.negated)" :value="operandLabel(item.right)" />
          <span v-else class="nested">
            <span class="rules-muted">{{ item.negated ? 'none of' : tail(item) }}:</span>
            <template v-for="child in item.items" :key="child.id">
              <span v-if="isWeighted(item)" class="weight">×{{ weightLabel(child.weight) }}</span>
              <RuleTile v-if="child.type === 'condition'" :subject="operandLabel(child.left)" :operator="operatorLabel(child.operator, child.negated)" :value="operandLabel(child.right)" />
              <span v-else class="rules-muted">a further group</span>
            </template>
          </span>
        </li>
        <li v-if="section.part === 'exit' && section.side.stopLossPct !== null" class="rules-row">
          <RuleTile subject="Stop-loss" operator="at" :value="`−${section.side.stopLossPct}%`" kind="risk" />
        </li>
        <li v-if="section.part === 'exit' && section.side.takeProfitPct !== null" class="rules-row">
          <RuleTile subject="Take-profit" operator="at" :value="`+${section.side.takeProfitPct}%`" kind="risk" />
        </li>
        <li v-if="section.part === 'exit' && section.side.trailingStopPct !== null" class="rules-row">
          <RuleTile subject="Trailing stop" operator="follows" :value="`${section.side.trailingStopPct}% behind`" kind="risk" />
        </li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.preview {
  --rules-size: 13px;
  overflow: hidden;
  border-radius: 14px;
  box-shadow: inset 0 0 0 1px var(--panel-line);
}

.nested {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35em;
}

.weight {
  border-radius: 999px;
  padding: 0.15em 0.55em;
  font-size: 0.85em;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: var(--panel-soft);
  box-shadow: inset 0 0 0 1px var(--panel-line);
}
</style>
