<script setup lang="ts">
import type { StrategyDraft } from '~/types/api'

// The strategy exactly as the engine receives it, for whoever wants to look under the hood, or as Pine Script
// to run the same rules on TradingView.
const props = defineProps<{ strategy: StrategyDraft, name: string }>()
const emit = defineEmits<{ close: [] }>()

const format = ref<'json' | 'pine'>('json')
const text = computed(() => (format.value === 'json' ? serializeStrategy(props.strategy) : pineScript(props.strategy, props.name)))
const copied = ref(false)

async function copy(): Promise<void> {
  await navigator.clipboard.writeText(text.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1800)
}
</script>

<template>
  <aside class="side" aria-label="Strategy code">
    <div class="side-head">
      <div class="formats" role="radiogroup" aria-label="Code format">
        <button type="button" role="radio" :aria-checked="format === 'json'" :class="{ 'is-on': format === 'json' }" @click="format = 'json'">
          <UiIcon name="file-json" /> strategy.json
        </button>
        <button type="button" role="radio" :aria-checked="format === 'pine'" :class="{ 'is-on': format === 'pine' }" @click="format = 'pine'">
          <UiIcon name="file-code" /> Pine Script
        </button>
      </div>
      <button type="button" class="head-button ml-auto" @click="copy">
        {{ copied ? 'Copied' : 'Copy' }}
      </button>
      <button type="button" class="head-button" v-tip="'Close the JSON view'" @click="emit('close')">
        <UiIcon name="x" />
      </button>
    </div>
    <pre class="code">{{ text }}</pre>
    <p v-if="format === 'json'" class="foot">
      <UiIcon name="shield-check" /> Checked against one schema; the engine never runs generated code
    </p>
    <p v-else class="foot">
      <UiIcon name="info" /> Paste it into TradingView's Pine Editor and add it to the chart
    </p>
  </aside>
</template>

<style scoped>
.side {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: var(--panel-2);
  color: var(--panel-ink);
  font-size: 14px;
}

.side-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid var(--panel-line);
  background: var(--panel);
  padding: 0.75rem 1rem;
  font-family: var(--font-mono);
  font-size: 13px;
}

.head-button {
  display: grid;
  min-width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 8px;
  padding: 0 0.6rem;
  font-family: var(--font-sans);
  font-weight: 600;
  color: var(--panel-soft);
}

.formats {
  display: inline-flex;
  gap: 2px;
  border-radius: 9px;
  background: var(--panel-fill);
  padding: 2px;
}

.formats button {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border-radius: 7px;
  padding: 0.25rem 0.55rem;
  font-weight: 700;
  color: var(--panel-soft);
}

.formats button.is-on {
  background: var(--panel);
  color: var(--panel-ink);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.15), inset 0 0 0 1px var(--panel-line);
}

.formats button:focus-visible {
  outline: 2px solid var(--focus);
}

.head-button:hover {
  background: var(--panel-fill);
  color: var(--panel-ink);
}

.head-button:focus-visible {
  outline: 2px solid var(--focus);
}

.code {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 1rem;
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--code-key);
}

.foot {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-top: 1px solid var(--panel-line);
  padding: 0.75rem 1rem;
  font-size: 12.5px;
  color: var(--panel-soft);
}
</style>
