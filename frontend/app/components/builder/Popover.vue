<script setup lang="ts">
// A small panel anchored under the control that opened it: it grows out of that control and shrinks back
// into it, closes on Escape or a click outside, and returns focus to the control.
const props = defineProps<{ anchor: HTMLElement | null, label: string, closeOnLeave?: boolean }>()
const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLDivElement | null>(null)
const position = ref({ top: 0, left: 0, maxHeight: 400 })
const GAP = 8
const EDGE = 12

function place(): void {
  if (!props.anchor || !panel.value) return
  const anchorBox = props.anchor.getBoundingClientRect()
  const width = panel.value.offsetWidth
  const left = Math.min(Math.max(EDGE, anchorBox.left), window.innerWidth - width - EDGE)
  const spaceBelow = window.innerHeight - anchorBox.bottom - GAP - EDGE
  const spaceAbove = anchorBox.top - GAP - EDGE
  const opensUp = spaceBelow < 240 && spaceAbove > spaceBelow
  const maxHeight = Math.max(160, opensUp ? spaceAbove : spaceBelow)
  const height = Math.min(panel.value.scrollHeight, maxHeight)
  const top = opensUp ? anchorBox.top - GAP - height : anchorBox.bottom + GAP
  position.value = { top, left, maxHeight }
}

function onPointerDown(event: PointerEvent): void {
  const target = event.target as Node
  if (panel.value?.contains(target) || props.anchor?.contains(target)) return
  emit('close')
}

// An editor that keeps a draft can close once the pointer has clearly moved on, this far from it and its control.
const LEAVE_DISTANCE = 140

function onPointerMove(event: PointerEvent): void {
  if (!props.closeOnLeave || !panel.value) return
  const boxes = [panel.value.getBoundingClientRect(), props.anchor?.getBoundingClientRect()].filter(box => box !== undefined)
  const distance = Math.min(...boxes.map(box => Math.hypot(
    Math.max(box.left - event.clientX, 0, event.clientX - box.right),
    Math.max(box.top - event.clientY, 0, event.clientY - box.bottom),
  )))
  if (distance > LEAVE_DISTANCE) emit('close')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  event.stopPropagation()
  emit('close')
  props.anchor?.focus()
}

// The anchor can move without any scroll event: the canvas pans and zooms by transform. While open, the
// panel follows it frame by frame, re-placing only when the anchor actually moved.
let followFrame = 0
let lastAnchor = ''

function follow(): void {
  // A block picked up while its editor is open would be carried underneath the panel, so the panel closes.
  if (document.querySelector('body > .sortable-fallback')) {
    emit('close')
    return
  }
  const box = props.anchor?.getBoundingClientRect()
  const key = box ? `${Math.round(box.left)}:${Math.round(box.top)}:${Math.round(box.width)}` : ''
  if (key !== lastAnchor) {
    lastAnchor = key
    place()
  }
  followFrame = requestAnimationFrame(follow)
}

onMounted(async () => {
  await nextTick()
  place()
  followFrame = requestAnimationFrame(follow)
  panel.value?.querySelector<HTMLElement>('input, select, button')?.focus()
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('pointermove', onPointerMove)
  window.addEventListener('resize', place)
  window.addEventListener('scroll', place, true)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(followFrame)
  document.removeEventListener('pointerdown', onPointerDown, true)
  document.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('resize', place)
  window.removeEventListener('scroll', place, true)
})

defineExpose({ place })
</script>

<template>
  <Teleport to="body">
    <div
      ref="panel"
      class="popover app"
      role="dialog"
      :aria-label="label"
      :style="{ top: `${position.top}px`, left: `${position.left}px`, maxHeight: `${position.maxHeight}px` }"
      @keydown="onKeydown"
    >
      <slot />
    </div>
  </Teleport>
</template>

<style scoped>
.popover {
  position: fixed;
  z-index: 80;
  width: max-content;
  min-width: 15rem;
  max-width: min(22rem, calc(100vw - 24px));
  overflow-y: auto;
  border-radius: 14px;
  background: var(--panel);
  padding: 0.75rem;
  color: var(--panel-ink);
  font-size: 14px;
  box-shadow: inset 0 0 0 1px var(--panel-line), 0 24px 48px -20px rgb(0 0 0 / 0.45);
  transform-origin: top left;
  animation: pop-in 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes pop-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
}

@media (prefers-reduced-motion: reduce) {
  .popover {
    animation: none;
  }
}
</style>
