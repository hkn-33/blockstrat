<script setup lang="ts">
import type { StrategyDraft } from '~/types/api'
import type { StrategyLibrary } from '~/utils/strategyFiles'

// The bar over the builder: the strategy's name, undo, the simple or advanced mode, saved strategies, the
// share link and the theme.
const props = defineProps<{ draft: StrategyDraft, name: string }>()

const emit = defineEmits<{
  open: [strategy: StrategyDraft, name: string]
  startNew: []
}>()

const editor = useStrategyEditor()
const { isAdvanced, setAdvanced } = useBuilderMode()
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value !== 'light')

const menu = ref<'strategies' | null>(null)
const menuAnchor = ref<HTMLElement | null>(null)
const library = ref<StrategyLibrary>({})
const saveName = ref('')
const notice = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
let noticeTimer: ReturnType<typeof setTimeout> | undefined

function toggleMenu(event: MouseEvent): void {
  menuAnchor.value = event.currentTarget as HTMLElement
  menu.value = menu.value ? null : 'strategies'
  if (menu.value) {
    library.value = loadLibrary()
    saveName.value = props.name
  }
}

function say(text: string): void {
  notice.value = text
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => (notice.value = ''), 2400)
}


function saveAs(): void {
  const name = saveName.value.trim()
  if (!name) return
  library.value = { ...library.value, [name]: props.draft }
  saveLibrary(library.value)
  saveName.value = ''
  say(`Saved as "${name}"`)
}

function openSaved(name: string): void {
  const strategy = library.value[name]
  if (!strategy) return
  emit('open', strategy, name)
  menu.value = null
  say(`Opened "${name}"`)
}

function deleteSaved(name: string): void {
  const { [name]: _removed, ...rest } = library.value
  library.value = rest
  saveLibrary(rest)
}

function download(): void {
  const blob = new Blob([serializeStrategy(props.draft)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `blockstrat-${(props.draft.instrument ?? 'strategy').toLowerCase()}.json`
  link.click()
  URL.revokeObjectURL(link.href)
  menu.value = null
}

async function openFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    emit('open', parseStrategy(await file.text()), file.name.replace(/\.json$/i, ''))
    menu.value = null
    say(`Opened ${file.name}`)
  }
  catch (error) {
    say(error instanceof InvalidStrategyError ? error.message : 'The file could not be read.')
  }
}

async function share(): Promise<void> {
  const url = `${window.location.origin}${window.location.pathname}${shareHash(props.draft)}`
  try {
    await navigator.clipboard.writeText(url)
    say('Link copied')
  }
  catch {
    window.prompt('Copy this link', url)
  }
}

function toggleTheme(): void {
  const wanted = isDark.value ? 'light' : 'dark'
  const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  colorMode.preference = wanted === (systemIsDark ? 'dark' : 'light') ? 'system' : wanted
}

onBeforeUnmount(() => clearTimeout(noticeTimer))
</script>

<template>
  <header class="toolbar">
    <NuxtLink to="/" class="logo" aria-label="BlockStrat home">
      <BrandLogo />
    </NuxtLink>

    <p class="strategy-name">
      {{ name || 'New strategy' }}
    </p>

    <div class="flex items-center gap-1">
      <button type="button" class="icon" aria-label="Undo" title="Undo (Ctrl+Z)" :disabled="!editor.canUndo.value" @click="editor.undo()">
        <UiIcon name="undo-2" />
      </button>
      <button type="button" class="icon" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" :disabled="!editor.canRedo.value" @click="editor.redo()">
        <UiIcon name="redo-2" />
      </button>
    </div>

    <span class="spacer" />

    <p class="notice" role="status" aria-live="polite">
      {{ notice }}
    </p>

    <div class="mode" role="radiogroup" aria-label="How much of the builder is shown">
      <button type="button" role="radio" :aria-checked="!isAdvanced" :class="{ 'is-on': !isAdvanced }" title="Only what a first strategy needs" @click="setAdvanced(false)">
        Simple
      </button>
      <button type="button" role="radio" :aria-checked="isAdvanced" :class="{ 'is-on': isAdvanced }" title="Adds groups inside groups, weighted signals and the JSON" @click="setAdvanced(true)">
        Advanced
      </button>
    </div>
    <button type="button" class="icon mode-compact" :class="{ 'is-on': isAdvanced }" :aria-pressed="isAdvanced" aria-label="Advanced mode" title="Advanced mode: groups inside groups, weighted signals and the JSON" @click="setAdvanced(!isAdvanced)">
      <UiIcon name="graduation-cap" />
    </button>
    <button type="button" class="control" title="Start a new strategy (undo brings this one back)" @click="emit('startNew')">
      <UiIcon name="file-plus" /> <span class="label">New strategy</span>
    </button>
    <button type="button" class="control" :aria-expanded="menu === 'strategies'" @click="toggleMenu">
      <UiIcon name="folder-open" /> <span class="label">Strategies</span>
    </button>
    <button type="button" class="control" @click="share">
      <UiIcon name="share-2" /> <span class="label">Share</span>
    </button>
    <ClientOnly>
      <button type="button" class="icon" :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'" @click="toggleTheme">
        <UiIcon :name="isDark ? 'sun' : 'moon'" />
      </button>
    </ClientOnly>


    <BuilderPopover v-if="menu === 'strategies'" :anchor="menuAnchor" label="Strategies" @close="menu = null">
      <form class="flex gap-2" @submit.prevent="saveAs">
        <label class="sr-only" for="save-name">Name for this strategy</label>
        <input id="save-name" v-model="saveName" class="text-input" placeholder="Name this strategy">
        <button type="submit" class="small-button" :disabled="!saveName.trim()">
          <UiIcon name="save" /> Save
        </button>
      </form>
      <p v-if="Object.keys(library).length" class="menu-heading">
        Saved in this browser
      </p>
      <ul class="grid gap-0.5">
        <li v-for="name in Object.keys(library)" :key="name" class="flex items-center gap-1">
          <button type="button" class="choice" @click="openSaved(name)">
            {{ name }}
          </button>
          <button type="button" class="icon icon--small" :aria-label="`Delete ${name}`" @click="deleteSaved(name)">
            <UiIcon name="trash-2" />
          </button>
        </li>
      </ul>
      <div class="menu-actions">
        <button type="button" class="choice" @click="emit('startNew'); menu = null">
          <UiIcon name="file-plus" /> Start a new strategy
        </button>
        <button type="button" class="choice" @click="download">
          <UiIcon name="download" /> Download as a file
        </button>
        <button type="button" class="choice" @click="fileInput?.click()">
          <UiIcon name="upload" /> Open a file
        </button>
        <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="openFile">
      </div>
    </BuilderPopover>
  </header>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid var(--panel-line);
  padding: 0.6rem 0.75rem;
  font-size: 14px;
}

.logo {
  margin-right: 0.5rem;
  border-radius: 8px;
}

.logo:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 3px;
}

.spacer {
  flex: 1;
}

.strategy-name {
  overflow: hidden;
  max-width: 22rem;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-left: 1px solid var(--panel-line);
  padding-left: 0.9rem;
  font-weight: 700;
}

.control {
  display: inline-flex;
  min-height: 2.25rem;
  align-items: center;
  gap: 0.45rem;
  border-radius: 10px;
  padding: 0.3rem 0.75rem;
  font-weight: 600;
  color: var(--panel-ink);
  box-shadow: inset 0 0 0 1px var(--panel-line);
  transition: background-color 140ms, transform 120ms;
}

.control:hover,
.control.is-on {
  background: var(--panel-fill);
}

.control:active {
  transform: scale(0.97);
}

.mode {
  display: inline-flex;
  gap: 2px;
  border-radius: 10px;
  background: var(--panel-fill);
  padding: 3px;
}

.mode button {
  border-radius: 7px;
  padding: 0.3rem 0.7rem;
  font-size: 13px;
  font-weight: 700;
  color: var(--panel-soft);
  transition: background-color 140ms, color 140ms;
}

.mode button.is-on {
  background: var(--panel);
  color: var(--panel-ink);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.15), inset 0 0 0 1px var(--panel-line);
}

/* On a phone the two-word switch would push the bar onto a third row, so it becomes one button there. */
.icon.mode-compact {
  display: none;
}

.icon.mode-compact.is-on {
  background: var(--panel-fill);
  color: var(--accent-ink);
  box-shadow: inset 0 0 0 1.5px var(--accent-ink);
}

@media (max-width: 639px) {
  .mode {
    display: none;
  }

  .icon.mode-compact {
    display: grid;
  }
}

.icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border-radius: 10px;
  color: var(--panel-soft);
  transition: background-color 140ms, color 140ms;
}

.icon--small {
  width: 1.9rem;
  height: 1.9rem;
}

.icon:hover:not(:disabled) {
  background: var(--panel-fill);
  color: var(--panel-ink);
}

.icon:disabled {
  opacity: 0.35;
}

.control:focus-visible,
.mode button:focus-visible,
.icon:focus-visible,
.choice:focus-visible,
.small-button:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.notice {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent-ink);
}

.choice {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.55rem;
  border-radius: 8px;
  padding: 0.45rem 0.55rem;
  text-align: left;
  font-weight: 600;
  transition: background-color 140ms;
}

.choice:hover,
.choice.is-on {
  background: var(--panel-fill);
}

.text-input {
  min-width: 0;
  flex: 1;
  border-radius: 8px;
  background: var(--panel-fill);
  padding: 0.45rem 0.6rem;
  color: var(--panel-ink);
  box-shadow: inset 0 0 0 1px var(--panel-line);
}

.text-input:focus {
  outline: 2px solid var(--focus);
}

.small-button {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border-radius: 8px;
  background: var(--panel-ink);
  padding: 0.4rem 0.7rem;
  font-weight: 700;
  color: var(--panel);
}

.small-button:disabled {
  opacity: 0.4;
}

.menu-heading {
  margin: 0.8rem 0 0.3rem;
  font-size: 12px;
  font-weight: 700;
  color: var(--panel-soft);
}

.menu-actions {
  margin-top: 0.6rem;
  border-top: 1px solid var(--panel-line);
  padding-top: 0.5rem;
}

@media (max-width: 1100px) {
  .label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}

@media (max-width: 640px) {
  .spacer,
  .notice:empty {
    display: none;
  }
}
</style>
