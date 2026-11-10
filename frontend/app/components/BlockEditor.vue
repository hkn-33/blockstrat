<script setup lang="ts">
import * as Blockly from 'blockly'
import { REQUIRED_SLOT_STATUS_FIELDS, createTheme, registerBlocks, toolbox } from '~/blocks/definitions'
import { BlockType, emptyWorkspace, type RequiredPart, type WorkspaceState } from '~/utils/strategyBlocks'

const props = defineProps<{ missing: RequiredPart[] }>()
const emit = defineEmits<{ change: [state: WorkspaceState] }>()

const container = ref<HTMLDivElement | null>(null)
let workspace: Blockly.WorkspaceSvg | null = null
let isLoading = false

onMounted(() => {
  registerBlocks()
  workspace = Blockly.inject(container.value!, {
    toolbox,
    theme: createTheme(),
    renderer: 'zelos',
    trashcan: true,
    sounds: false,
    move: { scrollbars: true, drag: true, wheel: true },
    zoom: { controls: true, wheel: false, startScale: 0.8, maxScale: 2, minScale: 0.4, scaleSpeed: 1.15, pinch: true },
    grid: { spacing: 24, length: 2, colour: '#e2e8f0', snap: false },
  })
  workspace.addChangeListener(Blockly.Events.disableOrphans)
  workspace.addChangeListener(onWorkspaceChange)
})

onBeforeUnmount(() => {
  workspace?.dispose()
})

function onWorkspaceChange(event: Blockly.Events.Abstract): void {
  // UI events (selection, scrolling, opening the toolbox) never change what the strategy means.
  if (!workspace || isLoading || event.isUiEvent) return
  // Wait until a drag ends; the strategy changes when the block lands, not while it moves.
  if (workspace.isDragging()) return
  keepSingleRoot()
  emit('change', save())
}

function keepSingleRoot(): void {
  const roots = workspace!.getBlocksByType(BlockType.root, true)
  for (const extra of roots.slice(1)) extra.dispose(false)
}

function save(): WorkspaceState {
  return Blockly.serialization.workspaces.save(workspace!) as WorkspaceState
}

/** Replaces the whole workspace, e.g. with a strategy built by the AI or loaded from a file. */
function load(state: WorkspaceState): void {
  if (!workspace) return
  isLoading = true
  try {
    Blockly.serialization.workspaces.load(state, workspace)
    if (!workspace.getBlocksByType(BlockType.root, false).length) {
      Blockly.serialization.workspaces.load(emptyWorkspace(), workspace)
    }
  }
  finally {
    isLoading = false
  }
  workspace.scrollCenter()
  emit('change', save())
}

watch(() => props.missing, (missing) => {
  const root = workspace?.getBlocksByType(BlockType.root, false)[0]
  if (!root) return
  for (const [part, fieldName] of Object.entries(REQUIRED_SLOT_STATUS_FIELDS)) {
    root.setFieldValue(missing.includes(part as RequiredPart) ? '○' : '✓', fieldName)
  }
})

defineExpose({ load })
</script>

<template>
  <div ref="container" class="h-full w-full" />
</template>
