<script setup lang="ts">
import * as Blockly from 'blockly'
import { ContinuousToolbox, registerContinuousToolbox } from '@blockly/continuous-toolbox'
import { REQUIRED_SLOT_STATUS_FIELDS, createTheme, registerBlocks, toolbox } from '~/blocks/definitions'
import { BlockType, emptyWorkspace, type RequiredPart, type WorkspaceState } from '~/utils/strategyBlocks'

const props = defineProps<{ missing: RequiredPart[] }>()
const emit = defineEmits<{ change: [state: WorkspaceState] }>()

/**
 * The plugin rebuilds the whole block list after every change in the editor (meant for lists that
 * change, like variables). Ours never changes, and the rebuild scrambles the block positions.
 */
class StaticContinuousToolbox extends ContinuousToolbox {
  override refreshSelection(): void {}
}

const container = ref<HTMLDivElement | null>(null)
let workspace: Blockly.WorkspaceSvg | null = null
let isLoading = false

onMounted(() => {
  registerBlocks()
  // Registering twice throws, and Blockly's registry survives hot reloads.
  if (!Blockly.registry.hasItem(Blockly.registry.Type.TOOLBOX, 'ContinuousToolbox')) registerContinuousToolbox()
  Blockly.registry.register(Blockly.registry.Type.TOOLBOX, 'StaticContinuousToolbox', StaticContinuousToolbox, true)
  workspace = Blockly.inject(container.value!, {
    toolbox,
    // Every block stays visible in one scrolling list; the category names jump to their group.
    plugins: {
      flyoutsVerticalToolbox: 'ContinuousFlyout',
      metricsManager: 'ContinuousMetrics',
      toolbox: 'StaticContinuousToolbox',
    },
    theme: createTheme(),
    renderer: 'zelos',
    // Dragging a block back onto the list deletes it, like in Scratch.
    trashcan: false,
    sounds: false,
    // The canvas itself stays put: only blocks move. The wheel scrolls when a strategy grows tall.
    move: { scrollbars: true, drag: false, wheel: true },
    // Smaller blocks on narrow screens so the whole Strategy block fits next to the block list.
    zoom: { controls: false, wheel: false, startScale: container.value!.clientWidth < 1000 ? 0.62 : 0.8 },
  })
  workspace.addChangeListener(onWorkspaceChange)
})

onBeforeUnmount(() => {
  workspace?.dispose()
})

function onWorkspaceChange(event: Blockly.Events.Abstract): void {
  if (!workspace || isLoading) return
  // A drop is reported as the end of a drag; react right away instead of waiting for the next event.
  if (event.type === Blockly.Events.BLOCK_DRAG) {
    if (!(event as Blockly.Events.BlockDrag).isStart) applyChange()
    return
  }
  // UI events (selection, scrolling) never change what the strategy means, and mid-drag moves are not final.
  if (event.isUiEvent || workspace.isDragging()) return
  applyChange()
}

function applyChange(): void {
  removeLooseBlocks()
  emit('change', save())
}

/**
 * The canvas works like a form: everything lives inside the Strategy block. A block dragged out of
 * it, or pushed out by a block dropped in its place, is removed rather than left lying around.
 */
function removeLooseBlocks(): void {
  const roots = workspace!.getBlocksByType(BlockType.root, false)
  for (const block of workspace!.getTopBlocks(false)) {
    if (block !== roots[0]) block.dispose(false)
  }
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
  workspace.scroll(0, 0)
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
