<script setup lang="ts">
// Where the prices come from and where they go: drawn by the taste skill's diagram engine (public/diagrams),
// which animates pulses along the lines. Loaded in the browser only.
const SPEC = {
  layout: 'fanin',
  alt: 'Bitcoin, Ethereum, Solana and seven more Binance markets flow into the backtest engine and out as one result.',
  sources: [
    { label: 'Bitcoin', icon: 'bitcoin', sub: 'BTC/USDT' },
    { label: 'Ethereum', icon: 'ethereum', sub: 'ETH/USDT' },
    { label: 'Solana', icon: 'solana', sub: 'SOL/USDT' },
    { label: 'Binance', icon: 'binance', sub: '7 more pairs' },
  ],
  target: { label: 'Backtest engine', icon: 'ui:cpu' },
  then: { label: 'Your result', icon: 'ui:chart-line', meta: 'under 1 s' },
}

const root = ref<HTMLDivElement | null>(null)

useHead({ link: [{ rel: 'stylesheet', href: '/diagrams/diagram.css' }] })

onMounted(async () => {
  const engineUrl = '/diagrams/diagram.js'
  const engine = await import(/* @vite-ignore */ engineUrl)
  await engine.default.auto(root.value)
})
</script>

<template>
  <div ref="root" class="data-flow" data-icon-base="/diagrams/icons/">
    <div class="dg" :data-diagram="JSON.stringify(SPEC)" />
  </div>
</template>

<style scoped>
.data-flow {
  --ink: #0d1b24;
  --accent: #16a37a;
  --bg: #ffffff;
  --muted: #5a6c77;
  height: 100%;
  min-height: 360px;
}

.data-flow .dg {
  height: 100%;
  min-height: 360px;
}
</style>
