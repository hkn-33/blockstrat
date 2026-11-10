<script setup lang="ts">
import type { StrategyDraft } from '~/types/api'
import {
  InvalidStrategyError,
  loadLibrary,
  parseStrategy,
  saveLibrary,
  serializeStrategy,
  shareHash,
  type StrategyLibrary,
} from '~/utils/strategyFiles'

const props = defineProps<{ strategy: StrategyDraft }>()
const emit = defineEmits<{ open: [strategy: StrategyDraft], reset: [] }>()

const library = ref<StrategyLibrary>({})
const notice = ref<{ text: string, isError: boolean } | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
let noticeTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  library.value = loadLibrary()
})

const savedNames = computed(() => Object.keys(library.value).sort((a, b) => a.localeCompare(b)))

function show(text: string, isError = false): void {
  notice.value = { text, isError }
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => (notice.value = null), 3500)
}

function save(): void {
  const name = window.prompt('Name this strategy:', suggestedName())?.trim()
  if (!name) return
  if (library.value[name] && !window.confirm(`Replace the saved strategy "${name}"?`)) return
  library.value = { ...library.value, [name]: props.strategy }
  saveLibrary(library.value)
  show(`Saved "${name}" in this browser.`)
}

function suggestedName(): string {
  const instrument = props.strategy.instrument ?? 'Strategy'
  return `${instrument} ${props.strategy.timeframe ?? ''}`.trim()
}

function open(name: string): void {
  const strategy = library.value[name]
  if (strategy) emit('open', strategy)
}

function remove(name: string): void {
  if (!window.confirm(`Delete the saved strategy "${name}"?`)) return
  const { [name]: _removed, ...rest } = library.value
  library.value = rest
  saveLibrary(library.value)
}

function exportFile(): void {
  const blob = new Blob([serializeStrategy(props.strategy)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${suggestedName().replace(/\s+/g, '-').toLowerCase() || 'strategy'}.json`
  link.click()
  URL.revokeObjectURL(link.href)
}

async function importFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    emit('open', parseStrategy(await file.text()))
    show(`Loaded ${file.name}.`)
  }
  catch (error) {
    show(error instanceof InvalidStrategyError ? error.message : 'Could not read the file.', true)
  }
}

async function copyShareLink(): Promise<void> {
  const url = `${window.location.origin}${window.location.pathname}${shareHash(props.strategy)}`
  try {
    await navigator.clipboard.writeText(url)
    show('Share link copied. Anyone with it sees this strategy and its result.')
  }
  catch {
    window.prompt('Copy this link:', url)
  }
}
</script>

<template>
  <div class="relative flex flex-wrap items-center gap-2 text-sm">
    <button type="button" class="toolbar-button" @click="save">
      Save
    </button>
    <details class="relative">
      <summary class="toolbar-button list-none">
        Open ({{ savedNames.length }})
      </summary>
      <div class="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
        <p v-if="!savedNames.length" class="px-3 py-2 text-xs text-slate-500">
          No saved strategies yet.
        </p>
        <div v-for="name in savedNames" :key="name" class="flex items-center justify-between rounded-lg hover:bg-slate-50">
          <button type="button" class="flex-1 truncate px-3 py-1.5 text-left" @click="open(name)">
            {{ name }}
          </button>
          <button type="button" class="px-2 text-slate-400 hover:text-red-600" :aria-label="`Delete ${name}`" @click="remove(name)">
            ✕
          </button>
        </div>
      </div>
    </details>
    <button type="button" class="toolbar-button" @click="exportFile">
      Export JSON
    </button>
    <button type="button" class="toolbar-button" @click="fileInput?.click()">
      Import JSON
    </button>
    <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="importFile">
    <button type="button" class="toolbar-button" @click="emit('reset')">
      New
    </button>
    <button type="button" class="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-500" @click="copyShareLink">
      Copy share link
    </button>
    <p
      v-if="notice"
      class="absolute right-0 top-full z-30 mt-2 rounded-lg px-3 py-2 text-xs font-medium shadow"
      :class="notice.isError ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'"
      role="status"
    >
      {{ notice.text }}
    </p>
  </div>
</template>

<style scoped>
.toolbar-button {
  cursor: pointer;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  padding: 0.375rem 0.75rem;
  font-weight: 600;
  color: #334155;
}

.toolbar-button:hover {
  background: #f8fafc;
}
</style>
