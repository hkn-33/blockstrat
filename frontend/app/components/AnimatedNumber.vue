<script setup lang="ts">
// Counts from the previous value to the new one, so a changed result reads as "recalculated".
const props = withDefaults(defineProps<{
  value: number
  format: (value: number) => string
  durationMs?: number
}>(), { durationMs: 700 })

const shown = ref(props.value)
let frame = 0

watch(() => props.value, (target) => {
  cancelAnimationFrame(frame)
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) {
    shown.value = target
    return
  }
  const from = shown.value
  const startedAt = performance.now()
  const step = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / props.durationMs)
    const eased = 1 - (1 - progress) ** 3
    shown.value = from + (target - from) * eased
    if (progress < 1) frame = requestAnimationFrame(step)
  }
  frame = requestAnimationFrame(step)
})

onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template>
  <span class="tabular-nums">{{ format(shown) }}</span>
</template>
