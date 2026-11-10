<script setup lang="ts">
import type { StrategyBlock } from './BlockStack.vue'

// The assistant at work, played once when it comes into view: the sentence is typed and sent,
// the request is analysed step by step, then the blocks and the JSON arrive.
type Phase = 'idle' | 'typing' | 'thinking' | 'done'

const MESSAGE = 'Buy Ethereum every 4 hours when RSI drops under 30, sell above 70, and never lose more than 5% on a trade'
const STEPS = ['Reading your rules', 'Picking indicators: RSI 14', 'Checking against the schema']
const BLOCKS: StrategyBlock[] = [
  { tone: 'entry', label: 'Buy when', parts: ['RSI', { value: '14' }, 'drops below', { value: '30' }] },
  { tone: 'exit', label: 'Sell when', parts: ['RSI', { value: '14' }, 'rises above', { value: '70' }] },
  { tone: 'risk', label: 'Stop-loss', parts: [{ value: '5%' }, 'below entry'] },
]
const TYPE_MS = 28
const STEP_MS = 650

const phase = ref<Phase>('idle')
const typed = ref('')
const stepsDone = ref(0)
const root = ref<HTMLDivElement | null>(null)
let timers: ReturnType<typeof setTimeout>[] = []
let observer: IntersectionObserver | undefined

function later(ms: number, action: () => void): void {
  timers.push(setTimeout(action, ms))
}

function showFinal(): void {
  typed.value = ''
  stepsDone.value = STEPS.length
  phase.value = 'done'
}

function play(): void {
  timers.forEach(clearTimeout)
  timers = []
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    showFinal()
    return
  }
  phase.value = 'typing'
  typed.value = ''
  stepsDone.value = 0
  for (let index = 1; index <= MESSAGE.length; index++) later(index * TYPE_MS, () => (typed.value = MESSAGE.slice(0, index)))
  const sentAt = MESSAGE.length * TYPE_MS + 450
  later(sentAt, () => {
    typed.value = ''
    phase.value = 'thinking'
  })
  STEPS.forEach((_, index) => later(sentAt + (index + 1) * STEP_MS, () => (stepsDone.value = index + 1)))
  later(sentAt + (STEPS.length + 1) * STEP_MS, () => (phase.value = 'done'))
}

onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    if (phase.value !== 'idle' || !entries.some(entry => entry.isIntersecting)) return
    play()
  }, { threshold: 0.4 })
  observer.observe(root.value!)
})

onBeforeUnmount(() => {
  timers.forEach(clearTimeout)
  observer?.disconnect()
})
</script>

<template>
  <div ref="root" class="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
    <div class="chat min-w-0">
      <div class="chat-head">
        <img src="/brand-icons/gemini.svg" alt="" class="h-6 w-6">
        <span class="font-bold">Strategy assistant</span>
        <button v-if="phase === 'done'" type="button" class="replay" @click="play">
          <UiIcon name="refresh-cw" /> Replay
        </button>
      </div>

      <div class="chat-body" aria-live="polite">
        <p v-if="phase === 'idle'" class="hint">
          Describe a strategy the way you would text a friend.
        </p>
        <template v-if="phase === 'thinking' || phase === 'done'">
          <p class="bubble">
            {{ MESSAGE }}
          </p>
          <ul class="steps">
            <li v-for="(step, index) in STEPS" :key="step" :class="{ 'is-done': index < stepsDone }">
              <span class="tick">
                <UiIcon v-if="index < stepsDone" name="check" />
                <span v-else class="spinner" />
              </span>
              {{ step }}
            </li>
          </ul>
          <div v-if="phase === 'done'" class="answer">
            <p class="text-[14px] text-white/65">
              Here are your blocks. Change anything before you run it.
            </p>
            <LandingBlockStack market="ETH/USDT" timeframe="4 hours" :blocks="BLOCKS" theme="dark" entrance class="answer-blocks" />
          </div>
        </template>
      </div>

      <div class="composer">
        <span class="composer-text" :class="{ 'is-empty': !typed }">{{ typed || 'Message the assistant' }}<span v-if="phase === 'typing'" class="caret" /></span>
        <span class="send" :class="{ 'is-ready': typed.length > 0 }"><UiIcon name="arrow-up" /></span>
      </div>
    </div>

    <div class="code min-w-0" role="img" aria-label="The same strategy as the JSON the engine runs">
      <p class="code-head">
        <UiIcon name="file-json" /> strategy.json
      </p>
      <pre :class="{ 'is-waiting': phase !== 'done' }"><code><span class="p">{</span>
  <span class="k">"instrument"</span>: <span class="s">"ETHUSDT"</span>,
  <span class="k">"timeframe"</span>: <span class="s">"4h"</span>,
  <span class="k">"entry"</span>: <span class="p">{</span>
    <span class="k">"direction"</span>: <span class="s">"long"</span>,
    <span class="k">"condition"</span>: <span class="p">{</span>
      <span class="k">"kind"</span>: <span class="s">"compare"</span>, <span class="k">"operator"</span>: <span class="s">"lt"</span>,
      <span class="k">"left"</span>: <span class="p">{</span> <span class="k">"kind"</span>: <span class="s">"rsi"</span>, <span class="k">"period"</span>: <span class="n">14</span> <span class="p">}</span>,
      <span class="k">"right"</span>: <span class="p">{</span> <span class="k">"kind"</span>: <span class="s">"constant"</span>, <span class="k">"value"</span>: <span class="n">30</span> <span class="p">}</span>
    <span class="p">}</span>
  <span class="p">}</span>,
  <span class="k">"exit"</span>: <span class="p">{</span>
    <span class="k">"rule"</span>: <span class="p">{</span> <span class="k">"operator"</span>: <span class="s">"gt"</span>, <span class="k">"right"</span>: <span class="n">70</span>, <span class="p">…</span> <span class="p">}</span>,
    <span class="k">"stop_loss_pct"</span>: <span class="n">5</span>
  <span class="p">}</span>
<span class="p">}</span></code></pre>
      <p class="code-foot">
        <UiIcon name="shield-check" /> Checked against one schema. The model never writes code that runs.
      </p>
    </div>
  </div>
</template>

<style scoped>
.chat {
  display: flex;
  min-height: 34rem;
  flex-direction: column;
  overflow: hidden;
  border-radius: 24px;
  background: rgb(255 255 255 / 0.07);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.18), inset 0 0 0 1px rgb(255 255 255 / 0.1), 0 30px 60px -30px rgb(0 0 0 / 0.6);
  backdrop-filter: blur(30px) saturate(1.6);
}

.chat-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  border-bottom: 1px solid rgb(255 255 255 / 0.08);
  padding: 0.9rem 1.25rem;
  font-size: 15px;
}

.replay {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-left: auto;
  cursor: pointer;
  border-radius: 8px;
  padding: 0.3rem 0.6rem;
  font-size: 13px;
  color: rgb(255 255 255 / 0.7);
}

.replay:hover {
  background: rgb(255 255 255 / 0.08);
  color: #ffffff;
}

.chat-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
}

.hint {
  margin: auto;
  font-size: 15px;
  color: rgb(255 255 255 / 0.5);
}

.bubble {
  align-self: flex-end;
  max-width: 30rem;
  border-radius: 20px 20px 6px 20px;
  background: #2f6bff;
  padding: 0.85rem 1.1rem;
  font-size: 15px;
  line-height: 1.5;
  animation: send 420ms cubic-bezier(0.2, 0.9, 0.3, 1.1) both;
}

@keyframes send {
  from {
    opacity: 0;
    transform: translateY(40px) scale(0.96);
  }
}

.steps {
  display: grid;
  gap: 0.45rem;
  font-size: 14px;
  color: rgb(255 255 255 / 0.45);
}

.steps li {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  transition: color 200ms;
}

.steps li.is-done {
  color: rgb(255 255 255 / 0.85);
}

.tick {
  display: grid;
  width: 1.15rem;
  height: 1.15rem;
  place-items: center;
  color: #c8f25a;
}

.spinner {
  width: 0.85rem;
  height: 0.85rem;
  border: 2px solid rgb(255 255 255 / 0.2);
  border-top-color: #c8f25a;
  border-radius: 999px;
  animation: spin 700ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.answer {
  display: grid;
  gap: 0.75rem;
}

.answer-blocks {
  --block-size: 14px;
}

.composer {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0 1rem 1rem;
  border-radius: 16px;
  background: rgb(255 255 255 / 0.08);
  padding: 0.7rem 0.7rem 0.7rem 1rem;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.1);
}

.composer-text {
  flex: 1;
  min-height: 1.4rem;
  font-size: 15px;
  line-height: 1.45;
}

.composer-text.is-empty {
  color: rgb(255 255 255 / 0.4);
}

.caret {
  display: inline-block;
  width: 2px;
  height: 1.05em;
  margin-left: 1px;
  vertical-align: -0.15em;
  background: #c8f25a;
  animation: blink 900ms steps(1) infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

.send {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex-shrink: 0;
  place-items: center;
  border-radius: 12px;
  background: rgb(255 255 255 / 0.12);
  color: rgb(255 255 255 / 0.5);
  transition: background-color 200ms, color 200ms;
}

.send.is-ready {
  background: #c8f25a;
  color: #0d1b24;
}

.code {
  overflow: hidden;
  border-radius: 24px;
  background: #061e23;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.08);
}

.code-head,
.code-foot {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.9rem 1.25rem;
  font-size: 13px;
  color: #8fb0b5;
}

.code-head {
  border-bottom: 1px solid rgb(255 255 255 / 0.08);
  font-family: "JetBrains Mono", ui-monospace, monospace;
}

.code-foot {
  border-top: 1px solid rgb(255 255 255 / 0.08);
}

.code pre {
  overflow-x: auto;
  padding: 1.1rem 1.25rem;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 13px;
  line-height: 1.75;
  color: #d4e6e8;
  transition: opacity 500ms, filter 500ms;
}

.code pre.is-waiting {
  opacity: 0.25;
  filter: blur(3px);
}

.code .k { color: #7fe3d6; }
.code .s { color: #c8f25a; }
.code .n { color: #9ec1ff; }
.code .p { color: #6f8f94; }

@media (prefers-reduced-motion: reduce) {
  .bubble,
  .spinner,
  .caret {
    animation: none;
  }
}
</style>
