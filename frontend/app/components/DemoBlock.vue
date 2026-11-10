<script setup lang="ts">
// A static look-alike of an editor block for the landing page; not interactive.
export type BlockTone = 'market' | 'indicator' | 'condition' | 'action' | 'risk'

defineProps<{ tone: BlockTone }>()

const TONE_CLASSES: Record<BlockTone, string> = {
  market: 'bg-market',
  indicator: 'bg-indicator',
  condition: 'bg-condition',
  action: 'bg-action',
  risk: 'bg-risk',
}
</script>

<template>
  <span
    class="demo-block inline-flex flex-wrap items-center gap-1.5 rounded-2xl px-2.5 py-1 text-[13px] font-semibold text-white shadow-[inset_0_-2px_0_rgb(0_0_0/0.18)]"
    :class="TONE_CLASSES[tone]"
  >
    <slot />
  </span>
</template>

<style scoped>
/* On wide screens blocks stay on one line like in the editor; on phones they wrap. */
@media (min-width: 640px) {
  .demo-block {
    flex-wrap: nowrap;
    white-space: nowrap;
    border-radius: 9999px;
  }
}

/* Field chips inside a block, like Blockly's dropdowns and number inputs. */
.demo-block :deep(.field) {
  border-radius: 9999px;
  background: rgb(255 255 255 / 0.22);
  padding: 0.05rem 0.5rem;
}

.demo-block :deep(.number) {
  border-radius: 9999px;
  background: #ffffff;
  padding: 0.05rem 0.45rem;
  color: #172036;
}
</style>
