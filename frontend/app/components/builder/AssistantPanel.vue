<script setup lang="ts">
import type { AiMessage, StrategyDraft } from '~/types/api'
import type { AiBuildResponse } from '~/composables/useApi'

// The assistant beside the results: describe a strategy, or paste one written elsewhere (another AI's
// answer, a forum post), get it back as tiles, apply it with one click (undo brings the old one back), and
// pick a follow-up to keep refining.
const props = defineProps<{ currentStrategy: StrategyDraft }>()
const emit = defineEmits<{ apply: [strategy: StrategyDraft], close: [] }>()

interface Answer {
  text: string
  strategy: StrategyDraft | null
  unsupported: string[]
  applied: boolean
}

type Turn = { role: 'user', text: string } | ({ role: 'assistant' } & Answer)

const EXAMPLES = [
  'Buy BTC on the daily chart when RSI drops below 30, sell when it climbs above 70.',
  'Go short ETH on 4h when the price crosses below the 50 EMA, 3% stop-loss, 6% take-profit.',
  'Buy SOL when the 20 EMA crosses above the 50 SMA and RSI is under 70.',
]

const FOLLOW_UPS = [
  'Add a 5% stop-loss',
  'Only buy when the price is above the 200 SMA',
  'Try it on the 4 hour chart',
]

// The API's limit on one message; a pasted prompt is cut to it instead of being refused.
const MAX_MESSAGE_LENGTH = 6000

const api = useApi()
const turns = ref<Turn[]>([])
const input = ref('')
const inputField = ref<HTMLTextAreaElement | null>(null)
const pasteNote = ref('')
const isThinking = ref(false)
const failure = ref<string | null>(null)

// When the model is out of capacity the request waits its turn, counting down, and goes again by itself,
// a few times at most; the user can stop waiting.
const MAX_WAITS = 3
const waitSeconds = ref(0)
let isWaitCancelled = false

function sleep(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

async function askWaitingIfBusy(history: AiMessage[]): Promise<AiBuildResponse> {
  isWaitCancelled = false
  for (let wait = 0; ; wait++) {
    const response = await api.buildStrategy(history, props.currentStrategy)
    if (response.status !== 'busy' || wait >= MAX_WAITS) return response
    waitSeconds.value = response.retry_after_seconds ?? 20
    while (waitSeconds.value > 0 && !isWaitCancelled) {
      await sleep(1000)
      waitSeconds.value--
    }
    waitSeconds.value = 0
    if (isWaitCancelled) return { ...response, message: 'Stopped waiting. Send it again when you like.' }
  }
}

function stopWaiting(): void {
  isWaitCancelled = true
}
const body = ref<HTMLDivElement | null>(null)

const lastAnswer = computed(() => {
  const last = turns.value.at(-1)
  return last?.role === 'assistant' ? last : null
})

async function scrollToEnd(): Promise<void> {
  await nextTick()
  body.value?.scrollTo({ top: body.value.scrollHeight, behavior: 'smooth' })
}

async function send(text = input.value): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed || isThinking.value) return
  input.value = ''
  failure.value = null
  turns.value.push({ role: 'user', text: trimmed })
  isThinking.value = true
  await scrollToEnd()
  try {
    // Only the last few turns: enough context for refinements, cheap on the free tier.
    const history: AiMessage[] = turns.value.slice(-8).map(turn => ({ role: turn.role, text: turn.text }))
    const response = await askWaitingIfBusy(history)
    if (response.status !== 'ok') {
      failure.value = response.message
      turns.value.pop()
      return
    }
    turns.value.push({ role: 'assistant', text: response.message, strategy: response.strategy, unsupported: response.unsupported, applied: false })
  }
  catch {
    failure.value = 'The assistant could not be reached. Build the rules by hand for now.'
    turns.value.pop()
  }
  finally {
    isThinking.value = false
    await scrollToEnd()
  }
}

function apply(answer: Answer): void {
  if (!answer.strategy) return
  emit('apply', answer.strategy)
  answer.applied = true
}

async function pasteFromClipboard(): Promise<void> {
  pasteNote.value = ''
  try {
    const pasted = (await navigator.clipboard.readText()).trim()
    if (pasted) input.value = pasted.slice(0, MAX_MESSAGE_LENGTH)
    else pasteNote.value = 'The clipboard is empty. Copy the text first.'
  }
  catch {
    // The browser did not let the page read the clipboard; the keyboard shortcut always works.
    pasteNote.value = 'Click the box below and press Ctrl+V to paste.'
  }
  inputField.value?.focus()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || event.shiftKey) return
  event.preventDefault()
  send()
}
</script>

<template>
  <aside class="side" aria-label="Strategy assistant">
    <div class="side-head">
      <span class="ai-mark" aria-hidden="true"><UiIcon name="sparkles" /></span>
      <span class="font-bold">Strategy assistant</span>
      <button type="button" class="close" v-tip="'Close the assistant'" @click="emit('close')">
        <UiIcon name="x" />
      </button>
    </div>

    <div ref="body" class="side-body">
      <template v-if="!turns.length">
        <p class="hint">
          Describe a strategy the way you would text a friend. The answer comes back as rules you can check and change.
        </p>
        <button v-for="example in EXAMPLES" :key="example" type="button" class="example" @click="send(example)">
          {{ example }}
        </button>
        <div class="paste">
          <span class="paste-icon"><UiIcon name="clipboard-paste" /></span>
          <span class="min-w-0">
            <span class="paste-title">Already have it written down?</span>
            <span class="paste-text">Paste a prompt or an answer from another AI, a forum post or your notes. The assistant turns it into blocks.</span>
            <button type="button" class="paste-button" @click="pasteFromClipboard">
              Paste from the clipboard
            </button>
            <span v-if="pasteNote" class="paste-note" role="status">{{ pasteNote }}</span>
          </span>
        </div>
      </template>

      <template v-for="(turn, index) in turns" :key="index">
        <p v-if="turn.role === 'user'" class="bubble">
          {{ turn.text }}
        </p>
        <div v-else class="answer">
          <p>{{ turn.text }}</p>
          <BuilderStrategyPreview v-if="turn.strategy" :strategy="turn.strategy" />
          <p v-if="turn.unsupported.length" class="unsupported">
            Not possible yet: {{ turn.unsupported.join(', ') }}
          </p>
          <button v-if="turn.strategy" type="button" class="apply" :disabled="turn.applied" @click="apply(turn)">
            <UiIcon :name="turn.applied ? 'check' : 'arrow-right'" />
            {{ turn.applied ? 'Applied, undo brings yours back' : 'Use these rules' }}
          </button>
        </div>
      </template>

      <div v-if="isThinking && waitSeconds > 0" class="waiting" role="status">
        <span class="waiting-spinner" aria-hidden="true" />
        <span class="min-w-0">
          <b>The AI is busy right now</b>
          <small>Your request waits its turn: trying again in {{ waitSeconds }} s</small>
        </span>
        <button type="button" class="waiting-stop" @click="stopWaiting">
          Stop
        </button>
      </div>
      <p v-else-if="isThinking" class="thinking" role="status">
        Building your rules
      </p>
      <p v-if="failure" class="failure" role="alert">
        {{ failure }}
      </p>
    </div>

    <div v-if="lastAnswer && !isThinking" class="follow-ups">
      <span class="text-[12px] font-semibold text-[var(--panel-soft)]">Ask next</span>
      <button v-for="followUp in FOLLOW_UPS" :key="followUp" type="button" class="follow-up" @click="send(followUp)">
        {{ followUp }}
      </button>
    </div>

    <form class="composer" @submit.prevent="send()">
      <label class="sr-only" for="assistant-input">Describe a strategy</label>
      <textarea id="assistant-input" ref="inputField" v-model="input" rows="2" :maxlength="MAX_MESSAGE_LENGTH" placeholder="Describe a strategy, or paste one" @keydown="onKeydown" />
      <button type="submit" class="send" :disabled="!input.trim() || isThinking" v-tip="'Send'">
        <UiIcon name="arrow-up" />
      </button>
    </form>
    <p v-if="input.length > MAX_MESSAGE_LENGTH * 0.8" class="count" role="status">
      {{ input.length.toLocaleString('en-US') }} of {{ MAX_MESSAGE_LENGTH.toLocaleString('en-US') }} characters
    </p>
    <p class="privacy">
      Beta: up to {{ AI_MESSAGES_PER_HOUR }} messages an hour. Don't share personal data: messages go to Groq's AI model. <NuxtLink to="/privacy#assistant" target="_blank">Privacy</NuxtLink>
    </p>
  </aside>
</template>

<style scoped>
.side {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: var(--panel);
  color: var(--panel-ink);
  font-size: 14px;
}

.side-head {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  border-bottom: 1px solid var(--panel-line);
  padding: 0.75rem 1rem;
}

.close {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  margin-left: auto;
  border-radius: 8px;
  color: var(--panel-soft);
}

.close:hover {
  background: var(--panel-fill);
  color: var(--panel-ink);
}

.side-body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.8rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 1rem;
}

.hint,
.privacy {
  color: var(--panel-soft);
}

.privacy {
  padding: 0 1rem 0.8rem;
  font-size: 11.5px;
}

.privacy a {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.example {
  border-radius: 12px;
  padding: 0.65rem 0.8rem;
  text-align: left;
  color: var(--panel-ink);
  box-shadow: inset 0 0 0 1px var(--panel-line);
  transition: background-color 140ms;
}

.example:hover {
  background: var(--panel-fill);
}

.paste {
  display: flex;
  gap: 0.7rem;
  border: 1.5px dashed var(--tile-line);
  border-radius: 12px;
  padding: 0.75rem 0.8rem;
}

.paste-icon {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  place-items: center;
  border-radius: 9px;
  background: var(--panel-fill);
  color: var(--accent-ink);
}

.paste-title {
  display: block;
  font-weight: 700;
}

.paste-text,
.paste-note {
  display: block;
  margin-top: 0.15rem;
  font-size: 13px;
  line-height: 1.45;
  color: var(--panel-soft);
}

.paste-button {
  margin-top: 0.55rem;
  border-radius: 9px;
  padding: 0.35rem 0.7rem;
  font-size: 13px;
  font-weight: 700;
  box-shadow: inset 0 0 0 1px var(--panel-line);
  transition: background-color 140ms;
}

.paste-button:hover {
  background: var(--panel-fill);
}

/* A pasted prompt keeps its line breaks and never pushes the column wider. */
.bubble {
  align-self: flex-end;
  max-width: 90%;
  max-height: 14rem;
  overflow-y: auto;
  border-radius: 16px 16px 6px 16px;
  background: var(--panel-fill-strong);
  padding: 0.6rem 0.85rem;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.answer {
  display: grid;
  gap: 0.6rem;
  line-height: 1.5;
}

.unsupported {
  border-radius: 10px;
  background: var(--panel-fill);
  padding: 0.5rem 0.7rem;
  font-size: 13px;
  color: var(--panel-soft);
}

.apply {
  display: inline-flex;
  justify-self: start;
  align-items: center;
  gap: 0.4rem;
  border-radius: 10px;
  background: var(--color-lime);
  padding: 0.5rem 0.9rem;
  font-weight: 700;
  color: var(--color-ink);
  transition: background-color 140ms, transform 120ms;
}

.apply:hover:not(:disabled) {
  background: #d6f87c;
}

.apply:active:not(:disabled) {
  transform: scale(0.97);
}

.apply:disabled {
  background: var(--panel-fill);
  color: var(--panel-soft);
}

.thinking {
  color: var(--panel-soft);
}

.ai-mark {
  display: grid;
  width: 1.6rem;
  height: 1.6rem;
  place-items: center;
  border-radius: 8px;
  background: var(--color-lime);
  color: var(--color-ink);
}

.ai-mark svg {
  width: 0.95rem;
  height: 0.95rem;
}

.waiting {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  border-radius: 12px;
  background: var(--panel-fill);
  padding: 0.65rem 0.8rem;
  font-size: 13px;
}

.waiting b,
.waiting small {
  display: block;
}

.waiting small {
  color: var(--panel-soft);
  font-variant-numeric: tabular-nums;
}

.waiting-spinner {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  border: 2px solid var(--panel-line);
  border-top-color: var(--color-lime);
  border-radius: 999px;
  animation: waiting-spin 800ms linear infinite;
}

@keyframes waiting-spin {
  to {
    rotate: 1turn;
  }
}

.waiting-stop {
  margin-left: auto;
  border-radius: 8px;
  padding: 0.3rem 0.6rem;
  font-weight: 700;
  color: var(--panel-soft);
  box-shadow: inset 0 0 0 1px var(--panel-line);
}

.waiting-stop:hover {
  color: var(--panel-ink);
}

@media (prefers-reduced-motion: reduce) {
  .waiting-spinner {
    animation-duration: 2s;
  }
}

.failure {
  border-radius: 10px;
  background: var(--panel-fill);
  padding: 0.55rem 0.75rem;
  color: var(--loss-ink);
}

.follow-ups {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  padding: 0 1rem 0.6rem;
}

.follow-up {
  border-radius: 9px;
  padding: 0.35rem 0.65rem;
  font-size: 12.5px;
  font-weight: 600;
  box-shadow: inset 0 0 0 1px var(--panel-line);
  transition: background-color 140ms;
}

.follow-up:hover {
  background: var(--panel-fill);
}

.composer {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  margin: 0 1rem 0.5rem;
  border-radius: 14px;
  background: var(--panel-fill);
  padding: 0.5rem 0.5rem 0.5rem 0.8rem;
  box-shadow: inset 0 0 0 1px var(--panel-line);
}

/* The box grows with what is typed or pasted, up to a third of the column. */
.composer textarea {
  flex: 1;
  max-height: 12rem;
  field-sizing: content;
  resize: none;
  background: transparent;
  color: var(--panel-ink);
  line-height: 1.45;
}

.composer textarea:focus {
  outline: none;
}

.composer:focus-within {
  box-shadow: inset 0 0 0 1.5px var(--focus);
}

.send {
  display: grid;
  width: 2.1rem;
  height: 2.1rem;
  flex-shrink: 0;
  place-items: center;
  border-radius: 9px;
  background: var(--color-lime);
  color: var(--color-ink);
}

.send:disabled {
  background: var(--panel-fill-strong);
  color: var(--panel-soft);
}

.count {
  padding: 0 1rem 0.3rem;
  text-align: right;
  font-size: 11.5px;
  color: var(--panel-soft);
}

.close:focus-visible,
.example:focus-visible,
.apply:focus-visible,
.follow-up:focus-visible,
.paste-button:focus-visible,
.send:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
</style>
