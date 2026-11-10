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

type Popover = 'save' | 'open' | 'share' | 'more' | null

const library = ref<StrategyLibrary>({})
const popover = ref<Popover>(null)
const saveName = ref('')
const pendingDelete = ref<string | null>(null)
const shareUrl = ref('')
const notice = ref<{ text: string, isError: boolean } | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const nameInput = ref<HTMLInputElement | null>(null)
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

function toggle(target: Exclude<Popover, null>): void {
  popover.value = popover.value === target ? null : target
  pendingDelete.value = null
  if (popover.value === 'save') {
    saveName.value = suggestedName()
    nextTick(() => nameInput.value?.select())
  }
}

function suggestedName(): string {
  const instrument = props.strategy.instrument?.replace('USDT', '/USDT') ?? 'My strategy'
  return `${instrument} ${props.strategy.timeframe ?? ''}`.trim()
}

function save(): void {
  const name = saveName.value.trim()
  if (!name) return
  const replaced = name in library.value
  library.value = { ...library.value, [name]: props.strategy }
  saveLibrary(library.value)
  popover.value = null
  show(replaced ? `Replaced "${name}".` : `Saved "${name}" in this browser.`)
}

function open(name: string): void {
  const strategy = library.value[name]
  if (!strategy) return
  emit('open', strategy)
  popover.value = null
}

function remove(name: string): void {
  // First click asks, second click deletes: no browser dialogs, which some browsers block.
  if (pendingDelete.value !== name) {
    pendingDelete.value = name
    return
  }
  const { [name]: _removed, ...rest } = library.value
  library.value = rest
  saveLibrary(library.value)
  pendingDelete.value = null
}

function exportFile(): void {
  const blob = new Blob([serializeStrategy(props.strategy)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${suggestedName().replace(/[\s/]+/g, '-').toLowerCase()}.json`
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
    show(`Opened ${file.name}.`)
  }
  catch (error) {
    show(error instanceof InvalidStrategyError ? error.message : 'Could not read the file.', true)
  }
}

async function copyShareLink(): Promise<void> {
  shareUrl.value = `${window.location.origin}${window.location.pathname}${shareHash(props.strategy)}`
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    popover.value = null
    show('Link copied. Anyone who opens it sees this strategy and its result.')
  }
  catch {
    // Clipboard blocked: show the link so it can be copied by hand.
    popover.value = 'share'
  }
}
</script>

<template>
  <div class="relative flex flex-wrap items-center gap-2 text-sm">
    <button type="button" class="toolbar-button" :aria-expanded="popover === 'save'" @click="toggle('save')">
      Save
    </button>
    <button type="button" class="toolbar-button" :aria-expanded="popover === 'open'" @click="toggle('open')">
      Open ({{ savedNames.length }})
    </button>
    <button type="button" class="rounded-xl bg-lime px-3 py-1.5 font-bold text-ink hover:bg-[#d6f87c]" @click="copyShareLink">
      Share
    </button>
    <button type="button" class="toolbar-button" :aria-expanded="popover === 'more'" aria-label="More actions" @click="toggle('more')">
      More
    </button>
    <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="importFile">

    <div v-if="popover === 'more'" class="popover w-56! p-1" @keydown.esc="popover = null">
      <button type="button" class="menu-item" @click="emit('reset'); popover = null">
        Start from an empty strategy
      </button>
      <button type="button" class="menu-item" @click="exportFile(); popover = null">
        Download as file
      </button>
      <button type="button" class="menu-item" @click="fileInput?.click(); popover = null">
        Open a file
      </button>
    </div>

    <form
      v-if="popover === 'save'"
      class="popover"
      @submit.prevent="save"
      @keydown.esc="popover = null"
    >
      <label class="text-xs font-semibold text-slate-600" for="save-name">Name</label>
      <div class="mt-1 flex gap-2">
        <input
          id="save-name"
          ref="nameInput"
          v-model="saveName"
          maxlength="60"
          class="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1"
        >
        <button type="submit" class="rounded-lg bg-ink px-3 py-1 font-bold text-white" :disabled="!saveName.trim()">
          {{ saveName.trim() in library ? 'Replace' : 'Save' }}
        </button>
      </div>
      <p class="mt-1 text-xs text-slate-500">
        Saved in this browser only.
      </p>
    </form>

    <div v-if="popover === 'open'" class="popover p-1" @keydown.esc="popover = null">
      <p v-if="!savedNames.length" class="px-2 py-2 text-xs text-slate-500">
        Nothing saved yet. Use Save to keep a strategy here.
      </p>
      <div v-for="name in savedNames" :key="name" class="flex items-center justify-between rounded-lg hover:bg-slate-50">
        <button type="button" class="flex-1 truncate px-2 py-1.5 text-left" @click="open(name)">
          {{ name }}
        </button>
        <button
          type="button"
          class="rounded-md px-2 py-1 text-xs font-semibold"
          :class="pendingDelete === name ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-red-600'"
          @click="remove(name)"
        >
          {{ pendingDelete === name ? 'Delete?' : 'Delete' }}
        </button>
      </div>
    </div>

    <div v-if="popover === 'share'" class="popover" @keydown.esc="popover = null">
      <label class="text-xs font-semibold text-slate-600" for="share-url">Copy this link</label>
      <input id="share-url" readonly :value="shareUrl" class="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs" @focus="($event.target as HTMLInputElement).select()">
    </div>

    <p
      v-if="notice"
      class="absolute right-0 top-full z-30 mt-2 rounded-lg px-3 py-2 text-xs font-medium shadow"
      :class="notice.isError ? 'bg-loss text-white' : 'bg-ink text-white'"
      role="status"
    >
      {{ notice.text }}
    </p>
  </div>
</template>

<style scoped>
.toolbar-button {
  cursor: pointer;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  padding: 0.375rem 0.75rem;
  font-weight: 600;
  color: #334155;
}

.toolbar-button:hover {
  background: #f8fafc;
}

.menu-item {
  display: block;
  width: 100%;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  text-align: left;
}

.menu-item:hover {
  background: #f1f5f9;
}

.popover {
  position: absolute;
  right: 0;
  top: 100%;
  z-index: 20;
  margin-top: 0.5rem;
  width: 20rem;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  padding: 0.75rem;
  box-shadow: 0 10px 30px -10px rgb(15 23 42 / 0.25);
}
</style>
