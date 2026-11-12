<script setup lang="ts">
import type { StrategyDraft } from '~/types/api'

// The strategy exactly as the engine receives it, for whoever wants to look under the hood.
const props = defineProps<{ strategy: StrategyDraft }>()
const emit = defineEmits<{ close: [] }>()

const text = computed(() => serializeStrategy(props.strategy))
const copied = ref(false)

async function copy(): Promise<void> {
  await navigator.clipboard.writeText(text.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1800)
}
</script>

<template>
  <aside class="side" aria-label="Strategy JSON">
    <div class="side-head">
      <UiIcon name="file-json" />
      <span class="font-bold">strategy.json</span>
      <button type="button" class="head-button ml-auto" @click="copy">
        {{ copied ? 'Copied' : 'Copy' }}
      </button>
      <button type="button" class="head-button" aria-label="Close the JSON view" @click="emit('close')">
        <UiIcon name="x" />
      </button>
    </div>
    <pre class="code">{{ text }}</pre>
    <p class="foot">
      <UiIcon name="shield-check" /> Checked against one schema; the engine never runs generated code
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
