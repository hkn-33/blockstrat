<script setup lang="ts">
// Counts from the previous value to the new one, so a changed result reads as "recalculated".
// With countUpDelayMs it also counts up from zero once on mount, for an entrance.
const props = withDefaults(defineProps<{
  value: number
  format: (value: number) => string
  durationMs?: number
  countUpDelayMs?: number
}>(), { durationMs: 700, countUpDelayMs: undefined })

const shown = ref(props.value)
let frame = 0
let delayTimer: ReturnType<typeof setTimeout> | undefined

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function tweenTo(target: number, from: number): void {
  cancelAnimationFrame(frame)
  const startedAt = performance.now()
  const step = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / props.durationMs)
    const eased = 1 - (1 - progress) ** 3
    shown.value = from + (target - from) * eased
    if (progress < 1) frame = requestAnimationFrame(step)
  }
  frame = requestAnimationFrame(step)
}

watch(() => props.value, (target) => {
  clearTimeout(delayTimer)
  if (prefersReducedMotion()) {
    cancelAnimationFrame(frame)
    shown.value = target
    return
  }
  tweenTo(target, shown.value)
})

onMounted(() => {
  if (props.countUpDelayMs === undefined || prefersReducedMotion()) return
  shown.value = 0
  delayTimer = setTimeout(() => tweenTo(props.value, 0), props.countUpDelayMs)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  clearTimeout(delayTimer)
})
</script>

<template>
  <span class="tabular-nums">{{ format(shown) }}</span>
</template>
