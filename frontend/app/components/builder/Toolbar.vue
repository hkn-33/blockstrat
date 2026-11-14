<script setup lang="ts">
import type { StrategyDraft } from '~/types/api'
import type { Layout, StrategyLibrary } from '~/utils/strategyFiles'

// The bar over the builder: the strategy's name, undo, the simple or advanced mode, the file actions (new,
// open, save, share, each as wide as the others) and the theme.
const props = defineProps<{ draft: StrategyDraft, name: string, layout: Layout, hasCustomLayout: boolean, hasUnsavedChanges: boolean, lastSavedAt: number | null }>()

// Whether the strategy is saved, said quietly beside its name; clicking it saves at once.
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  clock = setInterval(() => (now.value = Date.now()), 15_000)
})
const saveStatus = computed(() => {
  if (props.hasUnsavedChanges) return 'Unsaved changes'
  if (props.lastSavedAt === null) return ''
  const minutes = Math.floor((now.value - props.lastSavedAt) / 60_000)
  return minutes < 1 ? 'Saved just now' : `Saved ${minutes} min ago`
})

const emit = defineEmits<{
  'open': [strategy: StrategyDraft, name: string]
  'startNew': []
  'update:name': [name: string]
  'update:layout': [layout: Layout]
  'saveNow': []
}>()

const editor = useStrategyEditor()
const { isAdvanced, setAdvanced } = useBuilderMode()
const { isDark, toggleTheme } = useThemeToggle()

const menu = ref<'open' | 'save' | 'layout' | null>(null)
const layoutAnchor = ref<HTMLElement | null>(null)

function chooseLayout(layout: Layout): void {
  emit('update:layout', layout)
  menu.value = null
}
const menuAnchor = ref<HTMLElement | null>(null)
const library = ref<StrategyLibrary>({})
const saveName = ref('')
const notice = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
let noticeTimer: ReturnType<typeof setTimeout> | undefined

function toggleMenu(which: 'open' | 'save', event: MouseEvent): void {
  menuAnchor.value = event.currentTarget as HTMLElement
  menu.value = menu.value === which ? null : which
  if (menu.value) {
    library.value = loadLibrary()
    saveName.value = props.name
  }
}

// The Share button itself says the link was copied, for a moment, in place of its label.
const isLinkCopied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

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
  menu.value = null
  say(`Saved a copy as "${name}"`)
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

function saveFile(text: string, type: string, extension: string): void {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([text], { type }))
  link.download = `blockstrat-${(props.draft.instrument ?? 'strategy').toLowerCase()}.${extension}`
  link.click()
  URL.revokeObjectURL(link.href)
  menu.value = null
}

function download(): void {
  saveFile(serializeStrategy(props.draft), 'application/json', 'json')
}

// The same rules as a TradingView strategy, to paste into its Pine Editor.
function downloadPine(): void {
  saveFile(pineScript(props.draft, props.name), 'text/plain', 'pine')
}

async function copyPine(): Promise<void> {
  menu.value = null
  try {
    await navigator.clipboard.writeText(pineScript(props.draft, props.name))
    say('Pine Script copied: paste it into TradingView\'s Pine Editor')
  }
  catch {
    downloadPine()
  }
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
    isLinkCopied.value = true
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (isLinkCopied.value = false), 2000)
  }
  catch {
    window.prompt('Copy this link', url)
  }
}

onBeforeUnmount(() => {
  clearInterval(clock)
  clearTimeout(noticeTimer)
  clearTimeout(copiedTimer)
})
</script>

<template>
  <header class="toolbar">
    <NuxtLink to="/" class="logo" aria-label="BlockStrat home">
      <BrandLogo />
    </NuxtLink>

    <label class="strategy-name">
      <span class="sr-only">Strategy name</span>
      <input :value="name" placeholder="Name your strategy" maxlength="80" @input="emit('update:name', ($event.target as HTMLInputElement).value)" @keydown.enter="($event.target as HTMLInputElement).blur()">
      <UiIcon name="pencil" class="name-pencil" />
    </label>
    <button v-if="saveStatus" type="button" class="save-status" :class="{ 'is-unsaved': hasUnsavedChanges }" v-tip="hasUnsavedChanges ? 'Saved every half minute; click to save now' : 'Kept in this browser, under Open'" @click="emit('saveNow')">
      <UiIcon :name="hasUnsavedChanges ? 'loader-circle' : 'cloud-check'" /> {{ saveStatus }}
    </button>

    <div class="flex items-center gap-1">
      <button type="button" class="icon" v-tip="'Undo (Ctrl+Z)'" :disabled="!editor.canUndo.value" @click="editor.undo()">
        <UiIcon name="undo-2" />
      </button>
      <button type="button" class="icon" v-tip="'Redo (Ctrl+Shift+Z)'" :disabled="!editor.canRedo.value" @click="editor.redo()">
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
    <button type="button" class="icon mode-compact" :class="{ 'is-on': isAdvanced }" :aria-pressed="isAdvanced" v-tip="'Advanced mode: groups inside groups, weighted signals and the JSON'" @click="setAdvanced(!isAdvanced)">
      <UiIcon name="graduation-cap" />
    </button>
    <button ref="layoutAnchor" type="button" class="icon" :aria-expanded="menu === 'layout'" v-tip="'Layout'" @click="menu = menu === 'layout' ? null : 'layout'">
      <UiIcon name="panels-top-left" />
    </button>
    <div class="file-actions">
      <button type="button" class="control" v-tip="'Start a new strategy; undo brings this one back'" @click="emit('startNew')">
        <UiIcon name="file-plus" /> <span class="label">New</span>
      </button>
      <button type="button" class="control" :class="{ 'is-on': menu === 'open' }" :aria-expanded="menu === 'open'" @click="toggleMenu('open', $event)">
        <UiIcon name="folder-open" /> <span class="label">Open</span>
      </button>
      <button type="button" class="control" :class="{ 'is-on': menu === 'save' }" :aria-expanded="menu === 'save'" @click="toggleMenu('save', $event)">
        <UiIcon name="save" /> <span class="label">Save</span>
      </button>
      <button type="button" class="control" :class="{ 'is-copied': isLinkCopied }" aria-live="polite" @click="share">
        <UiIcon :name="isLinkCopied ? 'check' : 'share-2'" /> <span class="label">{{ isLinkCopied ? 'Copied' : 'Share' }}</span>
      </button>
    </div>
    <!-- The builder is rendered in the browser only, so the button is there from the first frame. -->
    <button type="button" class="icon" v-tip="isDark ? 'Switch to light mode' : 'Switch to dark mode'" @click="toggleTheme">
      <UiIcon :name="isDark ? 'sun' : 'moon'" />
    </button>


    <BuilderPopover v-if="menu === 'layout'" :anchor="layoutAnchor" label="Layout" @close="menu = null">
      <p class="menu-heading">
        Layout
      </p>
      <ul class="grid gap-0.5">
        <li>
          <button type="button" class="choice" :aria-pressed="layout === 'default'" @click="chooseLayout('default')">
            <UiIcon name="panels-top-left" />
            <span class="grid">
              <b>Default</b>
              <small class="layout-help">The columns at their usual widths</small>
            </span>
            <UiIcon v-if="layout === 'default'" name="check" class="ml-auto" />
          </button>
        </li>
        <li>
          <button type="button" class="choice" :aria-pressed="layout === 'custom'" :disabled="!hasCustomLayout" @click="chooseLayout('custom')">
            <UiIcon name="sliders-horizontal" />
            <span class="grid">
              <b>Yours</b>
              <small class="layout-help">{{ hasCustomLayout ? 'The widths you dragged the columns to' : 'Drag a column\'s edge to make one' }}</small>
            </span>
            <UiIcon v-if="layout === 'custom' && hasCustomLayout" name="check" class="ml-auto" />
          </button>
        </li>
      </ul>
    </BuilderPopover>
    <BuilderPopover v-if="menu === 'open'" :anchor="menuAnchor" label="Open a strategy" @close="menu = null">
      <p class="menu-heading">
        Saved in this browser
      </p>
      <ul v-if="Object.keys(library).length" class="grid gap-0.5">
        <li v-for="savedName in Object.keys(library)" :key="savedName" class="flex items-center gap-1">
          <button type="button" class="choice" @click="openSaved(savedName)">
            <UiIcon name="file-chart-line" /> {{ savedName }}
          </button>
          <button type="button" class="icon icon--small" v-tip="`Delete ${savedName}`" @click="deleteSaved(savedName)">
            <UiIcon name="trash-2" />
          </button>
        </li>
      </ul>
      <p v-else class="layout-help">
        Nothing saved yet: Save keeps a strategy here.
      </p>
      <div class="menu-actions">
        <button type="button" class="choice" @click="fileInput?.click()">
          <UiIcon name="upload" /> Open a file
        </button>
        <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="openFile">
      </div>
    </BuilderPopover>
    <BuilderPopover v-if="menu === 'save'" :anchor="menuAnchor" label="Save the strategy" @close="menu = null">
      <form class="flex gap-2" @submit.prevent="saveAs">
        <label class="sr-only" for="save-name">Name for this strategy</label>
        <input id="save-name" v-model="saveName" class="text-input" placeholder="Name this strategy">
        <button type="submit" class="small-button" :disabled="!saveName.trim()">
          <UiIcon name="save" /> Save a copy
        </button>
      </form>
      <p class="layout-help mt-1">
        Your strategy saves itself every half minute; this keeps a copy under another name.
      </p>
      <div class="menu-actions">
        <button type="button" class="choice" @click="download">
          <UiIcon name="download" /> Download as a file
        </button>
        <button type="button" class="choice" @click="copyPine">
          <UiIcon name="code" /> Copy as Pine Script for TradingView
        </button>
        <button type="button" class="choice" @click="downloadPine">
          <UiIcon name="file-code" /> Download as Pine Script
        </button>
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

/* The name reads as a title and edits in place: a faint field on hover, a clear one while typing. */
.strategy-name {
  position: relative;
  display: inline-flex;
  align-items: center;
  /* Grows into the free space but starts small, so a long row gives up name width before it wraps. */
  flex: 1 1 8rem;
  min-width: 0;
  max-width: min(22rem, 34vw);
  border-left: 1px solid var(--panel-line);
  padding-left: 0.6rem;
}

.strategy-name input {
  width: 100%;
  border-radius: 8px;
  background: transparent;
  padding: 0.3rem 1.8rem 0.3rem 0.4rem;
  font-weight: 700;
  color: var(--panel-ink);
  text-overflow: ellipsis;
  transition: background-color 140ms, box-shadow 140ms;
}

.strategy-name input::placeholder {
  color: var(--panel-soft);
}

.strategy-name:hover input {
  background: var(--panel-fill);
}

.strategy-name input:focus {
  background: var(--panel-fill);
  box-shadow: inset 0 0 0 1.5px var(--focus);
  outline: none;
}

.name-pencil {
  position: absolute;
  right: 0.5rem;
  width: 0.9rem;
  height: 0.9rem;
  color: var(--panel-soft);
  opacity: 0;
  pointer-events: none;
  transition: opacity 140ms;
}

.strategy-name:hover .name-pencil,
.strategy-name input:focus + .name-pencil {
  opacity: 1;
}

/* New, Open, Save and Share are one group of equally wide buttons. */
.file-actions {
  display: inline-grid;
  grid-auto-columns: 1fr;
  grid-auto-flow: column;
  gap: 0.4rem;
}

/* A fixed width that fits "Copied" too, so nothing moves when Share answers. */
.file-actions .control {
  justify-content: center;
  width: 6.25rem;
}

.control.is-copied {
  color: var(--accent-ink);
  box-shadow: inset 0 0 0 1.5px var(--accent-ink);
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
  display: inline-grid;
  grid-auto-columns: 1fr;
  grid-auto-flow: column;
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

/* Advanced is a mode to notice: it is on in the accent colour. */
.mode button.is-on[aria-checked="true"]:last-child {
  background: var(--color-lime);
  color: var(--color-ink);
  box-shadow: none;
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

.save-status {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border-radius: 8px;
  padding: 0.25rem 0.5rem;
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--panel-soft);
  transition: background-color 140ms, color 140ms;
}

.save-status:hover {
  background: var(--panel-fill);
  color: var(--panel-ink);
}

.save-status.is-unsaved {
  color: #f0a020;
}

.layout-help {
  font-size: 12px;
  font-weight: 500;
  color: var(--panel-soft);
}

.notice {
  max-width: 34rem;
  font-size: 13px;
  line-height: 1.3;
  text-align: right;
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

/* Below this the labelled file buttons no longer fit on one row: they turn into icon buttons. */
@media (max-width: 1399px) {
  .file-actions .control {
    width: 2.25rem;
    padding-inline: 0;
  }

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
