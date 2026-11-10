<script setup lang="ts">
withDefaults(defineProps<{ inverted?: boolean }>(), { inverted: false })
</script>

<template>
  <span class="inline-flex items-center gap-2">
    <!-- Two stacked blocks, the same notched shape as the editor's statement blocks. -->
    <svg viewBox="0 0 28 28" class="h-7 w-7" aria-hidden="true">
      <path d="M3 4a3 3 0 0 1 3-3h4l2 2.5h4L18 1h4a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-4l-2 2.5h-4L10 13H6a3 3 0 0 1-3-3z" fill="#2563eb" />
      <path d="M3 18a3 3 0 0 1 3-3h4l2 2.5h4L18 15h4a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" fill="#059669" />
    </svg>
    <span class="font-display text-xl font-extrabold tracking-tight" :class="inverted ? 'text-white' : 'text-ink'">BlockStrat</span>
  </span>
</template>
