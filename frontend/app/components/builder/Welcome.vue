<script setup lang="ts">
import type { StrategyDraft } from '~/types/api'

// The first screen of an empty builder: name the idea and start from blank, or take another road in:
// describe it to the assistant, open a saved strategy or a file, or pick one of the strategies people most
// often start from and watch it being built.
const emit = defineEmits<{
  start: [name: string]
  describe: [name: string]
  open: [strategy: StrategyDraft, name: string]
  build: [strategy: StrategyDraft, name: string]
}>()

const name = ref('')
const savedNames = ref<string[]>([])
const isPickingSaved = ref(false)
const isPickingTemplate = ref(false)
const fileError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

onMounted(() => {
  savedNames.value = Object.keys(loadLibrary())
})

function start(): void {
  const trimmed = name.value.trim()
  if (trimmed) emit('start', trimmed)
}

function describe(): void {
  emit('describe', name.value.trim() || 'My strategy')
}

function openSaved(savedName: string): void {
  const strategy = loadLibrary()[savedName]
  if (strategy) emit('open', strategy, savedName)
}

async function openFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    emit('open', parseStrategy(await file.text()), file.name.replace(/\.json$/i, ''))
  }
  catch (error) {
    fileError.value = error instanceof InvalidStrategyError ? error.message : 'The file could not be read.'
  }
}
</script>

<template>
  <div class="welcome">
    <div class="welcome-card">
      <svg class="welcome-art" viewBox="0 0 200 120" fill="none" aria-hidden="true">
        <rect x="18" y="62" width="22" height="40" rx="5" class="art-block art-block--soft" />
        <rect x="52" y="44" width="22" height="58" rx="5" class="art-block art-block--mid" />
        <rect x="86" y="24" width="22" height="78" rx="5" class="art-block" />
        <path d="M120 86 C 140 80, 150 56, 172 40" class="art-line" />
        <path d="M160 36 L 174 38 L 170 52" class="art-line" />
        <circle cx="150" cy="20" r="6" class="art-dot" />
      </svg>
      <h2 class="welcome-title">
        What idea do you want to test?
      </h2>

      <form class="name-row" @submit.prevent="start">
        <label class="sr-only" for="strategy-name">Strategy name</label>
        <input id="strategy-name" v-model="name" class="welcome-input" placeholder="Name it, e.g. RSI dip on Bitcoin" autofocus>
        <button type="submit" class="welcome-button" :disabled="!name.trim()">
          Build it from blank <UiIcon name="arrow-right" />
        </button>
      </form>

      <p class="divider">
        or start another way
      </p>

      <div class="paths">
        <button type="button" class="path" @click="describe">
          <span class="path-icon"><UiIcon name="sparkles" /></span>
          <span><span class="path-title">Describe or paste it</span><span class="path-text">The assistant builds it</span></span>
        </button>
        <button type="button" class="path" :disabled="!savedNames.length" :aria-expanded="isPickingSaved" @click="isPickingSaved = !isPickingSaved">
          <span class="path-icon"><UiIcon name="folder-open" /></span>
          <span><span class="path-title">Open a saved one</span><span class="path-text">{{ savedNames.length ? `${savedNames.length} in this browser` : 'Nothing saved yet' }}</span></span>
        </button>
        <button type="button" class="path" @click="fileInput?.click()">
          <span class="path-icon"><UiIcon name="upload" /></span>
          <span><span class="path-title">Open a file</span><span class="path-text">A downloaded .json</span></span>
        </button>
        <button type="button" class="path" :aria-expanded="isPickingTemplate" @click="isPickingTemplate = !isPickingTemplate">
          <span class="path-icon"><UiIcon name="lightbulb" /></span>
          <span><span class="path-title">Popular strategies</span><span class="path-text">{{ STRATEGY_TEMPLATES.length }} well-known ideas</span></span>
        </button>
      </div>
      <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="openFile">

      <ul v-if="isPickingSaved" class="saved">
        <li v-for="savedName in savedNames" :key="savedName">
          <button type="button" class="saved-item" @click="openSaved(savedName)">
            {{ savedName }} <UiIcon name="arrow-right" class="ml-auto" />
          </button>
        </li>
      </ul>
      <ul v-if="isPickingTemplate" class="templates">
        <li v-for="template in STRATEGY_TEMPLATES" :key="template.name">
          <button type="button" class="template" @click="emit('build', template.strategy, template.name)">
            <span class="path-icon"><UiIcon :name="template.icon" /></span>
            <span class="min-w-0">
              <span class="template-head"><span class="path-title">{{ template.name }}</span><span class="template-style">{{ template.style }}</span></span>
              <span class="path-text">{{ template.summary }}</span>
            </span>
          </button>
        </li>
      </ul>
      <p v-if="fileError" class="file-error" role="alert">
        {{ fileError }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.welcome {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  overflow-y: auto;
  background: color-mix(in srgb, var(--canvas-bg) 82%, transparent);
  backdrop-filter: blur(6px);
  padding: 1.5rem;
}

.welcome-card {
  display: grid;
  width: min(32rem, 100%);
  justify-items: center;
  gap: 0.9rem;
  border-radius: 24px;
  background: var(--panel);
  padding: 1.75rem 1.5rem 1.5rem;
  text-align: center;
  box-shadow: var(--panel-shadow);
}

.welcome-art {
  width: 8.5rem;
}

.art-block {
  fill: var(--accent-ink);
}

.art-block--mid {
  fill: color-mix(in srgb, var(--accent-ink) 60%, var(--panel));
}

.art-block--soft {
  fill: color-mix(in srgb, var(--accent-ink) 30%, var(--panel));
}

.art-line {
  stroke: var(--panel-ink);
  stroke-width: 3.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.art-dot {
  fill: var(--color-lime);
  stroke: var(--panel-ink);
  stroke-width: 3;
}

.welcome-title {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.01em;
  text-wrap: balance;
}

.name-row {
  display: grid;
  width: 100%;
  gap: 0.6rem;
}

.welcome-input {
  width: 100%;
  border-radius: 12px;
  background: var(--panel-fill);
  padding: 0.8rem 1rem;
  font-size: 16px;
  font-weight: 600;
  color: var(--panel-ink);
  box-shadow: inset 0 0 0 1px var(--panel-line);
}

.welcome-input:focus {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.welcome-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: 12px;
  background: var(--color-lime);
  padding: 0.85rem 1rem;
  font-size: 16px;
  font-weight: 700;
  color: var(--color-ink);
  transition: background-color 140ms, transform 120ms;
}

.welcome-button:hover:not(:disabled) {
  background: #d6f87c;
}

.welcome-button:active:not(:disabled) {
  transform: scale(0.97);
}

.welcome-button:disabled {
  opacity: 0.5;
}

.divider {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.75rem;
  font-size: 13px;
  font-weight: 600;
  color: var(--panel-soft);
}

.divider::before,
.divider::after {
  flex: 1;
  height: 1px;
  background: var(--panel-line);
  content: "";
}

.paths {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.path {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  border-radius: 14px;
  padding: 0.75rem;
  text-align: left;
  box-shadow: inset 0 0 0 1px var(--panel-line);
  transition: background-color 140ms, box-shadow 140ms, transform 120ms;
}

.path:hover:not(:disabled) {
  background: var(--panel-fill);
  box-shadow: inset 0 0 0 1px var(--panel-soft);
}

.path:active:not(:disabled) {
  transform: scale(0.98);
}

.path:disabled {
  opacity: 0.5;
}

.path-icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex-shrink: 0;
  place-items: center;
  border-radius: 10px;
  background: var(--panel-fill);
  color: var(--accent-ink);
}

.path-title {
  display: block;
  font-size: 14px;
  font-weight: 700;
}

.path-text {
  display: block;
  font-size: 12.5px;
  color: var(--panel-soft);
}

.saved {
  display: grid;
  width: 100%;
  gap: 0.2rem;
  text-align: left;
}

.saved-item {
  display: flex;
  width: 100%;
  align-items: center;
  border-radius: 10px;
  padding: 0.55rem 0.75rem;
  font-weight: 600;
  box-shadow: inset 0 0 0 1px var(--panel-line);
}

.saved-item:hover {
  background: var(--panel-fill);
}

.templates {
  display: grid;
  width: 100%;
  gap: 0.35rem;
  text-align: left;
}

.template {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.7rem;
  border-radius: 14px;
  padding: 0.65rem 0.75rem;
  text-align: left;
  box-shadow: inset 0 0 0 1px var(--panel-line);
  transition: background-color 140ms, box-shadow 140ms;
}

.template:hover {
  background: var(--panel-fill);
  box-shadow: inset 0 0 0 1px var(--panel-soft);
}

.template-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem 0.5rem;
}

.template-style {
  border-radius: 6px;
  background: var(--panel-fill);
  padding: 0.05rem 0.4rem;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--panel-soft);
}

.file-error {
  font-size: 13px;
  font-weight: 600;
  color: var(--loss-ink);
}

.welcome-input:focus-visible,
.welcome-button:focus-visible,
.path:focus-visible,
.template:focus-visible,
.saved-item:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

@media (max-width: 480px) {
  .paths {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
