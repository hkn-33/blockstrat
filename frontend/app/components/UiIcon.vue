<script setup lang="ts">
// Lucide interface glyphs (fetched by the taste skill's icons.mjs into assets/icons), inlined so they take the text colour.
const ICONS = import.meta.glob<string>('~/assets/icons/ui-*.svg', { query: '?raw', import: 'default', eager: true })

const props = defineProps<{ name: string }>()

const svg = computed(() => {
  const entry = Object.entries(ICONS).find(([path]) => path.endsWith(`/ui-${props.name}.svg`))
  if (!entry) throw new Error(`Unknown icon: ${props.name}`)
  return entry[1].replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true"')
})
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <span class="ui-icon" v-html="svg" />
</template>

<style scoped>
.ui-icon {
  display: inline-flex;
  width: 1.25em;
  height: 1.25em;
  flex-shrink: 0;
}

.ui-icon :deep(svg) {
  width: 100%;
  height: 100%;
}
</style>
