<script setup lang="ts">
import type { DemoMarket, DemoStopLoss, DemoStrategy } from '~/composables/useLandingDemo'

// A working conversation with the assistant. The first request plays by itself when the section comes
// into view; after every answer three follow-ups are offered, and each one changes the strategy, the
// blocks, the JSON and the real backtest result. Both panels keep a fixed height; the chat scrolls.
interface StrategyState {
  strategy: DemoStrategy
  market: DemoMarket
  stopLoss: DemoStopLoss
}

interface Suggestion {
  label: string
  next: StrategyState
  reply: string
}

interface Message {
  id: number
  role: 'user' | 'assistant'
  text: string
  state?: StrategyState
  stepsDone?: number
}

const FIRST_REQUEST = 'Buy SOL when the 20 EMA crosses above the 50 SMA and RSI is under 70. Get out on the cross back, at −5% or at +15%.'
const FIRST_STATE: StrategyState = { strategy: 'combo', market: 'SOLUSDT', stopLoss: 5 }
const STEPS = ['Reading your request', 'Matching it to blocks', 'Checking against the schema']
const STRATEGY_NAMES: Record<DemoStrategy, string> = { combo: 'trend with an RSI filter', trend: 'plain trend', dip: 'RSI dip-buy' }
const TYPE_MS = 20
const STEP_MS = 450
const LINE_MS = 70

const messages = ref<Message[]>([])
const typed = ref('')
const isBusy = ref(false)
const current = ref<StrategyState>(FIRST_STATE)
const linesShown = ref(0)
const hasStarted = ref(false)
const root = ref<HTMLDivElement | null>(null)
const body = ref<HTMLDivElement | null>(null)
let nextId = 1
let timers: ReturnType<typeof setTimeout>[] = []
let observer: IntersectionObserver | undefined

const jsonLines = computed(() => strategyJsonLines(current.value.strategy, current.value.market, current.value.stopLoss))
const suggestions = computed<Suggestion[]>(() => (isBusy.value || !hasStarted.value ? [] : followUps(current.value)))

function wait(ms: number): Promise<void> {
  return new Promise(resolve => timers.push(setTimeout(resolve, ms)))
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

async function scrollToEnd(): Promise<void> {
  await nextTick()
  body.value?.scrollTo({ top: body.value.scrollHeight, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}

function resultLine(state: StrategyState): string {
  const metrics = demoRun(state.strategy, state.market, state.stopLoss).metrics
  const coin = demoMarket(state.market).label.split('/')[0]
  return `Last 16 months: ${formatSignedPercent(metrics.total_return_pct)}, holding ${coin} ${formatSignedPercent(metrics.buy_and_hold_return_pct)}`
}

function followUps(state: StrategyState): Suggestion[] {
  const otherMarket = DEMO_MARKETS.find(option => option.value !== state.market)!
  const otherStop: DemoStopLoss = state.stopLoss === 5 ? 10 : 5
  const nextStrategy: Record<DemoStrategy, { strategy: DemoStrategy, label: string }> = {
    combo: { strategy: 'trend', label: 'Drop the RSI filter' },
    trend: { strategy: 'dip', label: 'Buy the dip with RSI instead' },
    dip: { strategy: 'combo', label: 'Follow the trend with an RSI filter' },
  }
  const strategyChange = nextStrategy[state.strategy]
  return [
    {
      label: `Try it on ${otherMarket.name}`,
      next: { ...state, market: otherMarket.value },
      reply: `Same rules, now on ${otherMarket.label}`,
    },
    {
      label: otherStop === 10 ? 'Give it a 10% stop-loss' : 'Tighten the stop-loss to 5%',
      next: { ...state, stopLoss: otherStop },
      reply: `Stop-loss moved to ${otherStop}% below the entry`,
    },
    {
      label: strategyChange.label,
      next: { ...state, strategy: strategyChange.strategy },
      reply: `Switched to a ${STRATEGY_NAMES[strategyChange.strategy]}`,
    },
  ]
}

async function typeIntoComposer(text: string): Promise<void> {
  if (prefersReducedMotion()) return
  for (let index = 1; index <= text.length; index++) {
    typed.value = text.slice(0, index)
    await wait(TYPE_MS)
  }
  await wait(250)
}

async function streamJson(): Promise<void> {
  linesShown.value = 0
  for (let index = 1; index <= jsonLines.value.length; index++) {
    linesShown.value = index
    if (!prefersReducedMotion()) await wait(LINE_MS)
  }
}

async function ask(text: string, state: StrategyState, reply: string): Promise<void> {
  isBusy.value = true
  await typeIntoComposer(text)
  typed.value = ''
  messages.value.push({ id: nextId++, role: 'user', text })
  messages.value.push({ id: nextId++, role: 'assistant', text: reply, stepsDone: 0 })
  await scrollToEnd()
  for (let step = 1; step <= STEPS.length; step++) {
    if (!prefersReducedMotion()) await wait(STEP_MS)
    messages.value[messages.value.length - 1]!.stepsDone = step
  }
  current.value = state
  messages.value[messages.value.length - 1]!.state = state
  await scrollToEnd()
  // The blocks grow in as they snap into place; follow them down once they have landed.
  await wait(prefersReducedMotion() ? 0 : 600)
  await scrollToEnd()
  isBusy.value = false
  await streamJson()
}

function choose(suggestion: Suggestion): void {
  if (isBusy.value) return
  ask(suggestion.label, suggestion.next, suggestion.reply)
}

function start(): void {
  hasStarted.value = true
  ask(FIRST_REQUEST, FIRST_STATE, 'Here are your blocks. Change anything before you run it.')
}

function restart(): void {
  timers.forEach(clearTimeout)
  timers = []
  messages.value = []
  current.value = FIRST_STATE
  linesShown.value = 0
  typed.value = ''
  isBusy.value = false
  start()
}

onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    if (hasStarted.value || !entries.some(entry => entry.isIntersecting)) return
    start()
  }, { threshold: 0.4 })
  observer.observe(root.value!)
})

onBeforeUnmount(() => {
  timers.forEach(clearTimeout)
  observer?.disconnect()
})
</script>

<template>
  <div ref="root" class="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
    <div class="chat min-w-0">
      <div class="chat-head">
        <img src="/brand-icons/gemini.svg" alt="" class="h-6 w-6">
        <span class="font-bold">Strategy assistant</span>
        <button type="button" class="replay" :disabled="isBusy || !hasStarted" @click="restart">
          <UiIcon name="refresh-cw" /> Start over
        </button>
      </div>

      <div ref="body" class="chat-body" data-lenis-prevent aria-live="polite">
        <p v-if="!messages.length" class="hint">
          Describe a strategy the way you would text a friend
        </p>
        <template v-for="message in messages" :key="message.id">
          <p v-if="message.role === 'user'" class="bubble">
            {{ message.text }}
          </p>
          <div v-else class="answer">
            <ul v-if="!message.state" class="steps">
              <li v-for="(step, index) in STEPS" :key="step" :class="{ 'is-done': index < (message.stepsDone ?? 0) }">
                <span class="tick">
                  <UiIcon v-if="index < (message.stepsDone ?? 0)" name="check" />
                  <span v-else class="spinner" />
                </span>
                {{ step }}
              </li>
            </ul>
            <template v-else>
              <p class="answer-text">
                {{ message.text }}
              </p>
              <LandingRuleBuilder
                :market="message.state.market"
                timeframe="4 hours"
                :entry="demoRules(message.state.strategy, message.state.stopLoss).entry"
                :exit="demoRules(message.state.strategy, message.state.stopLoss).exit"
                theme="dark"
                entrance
                class="answer-rules"
              />
              <p class="answer-result">
                {{ resultLine(message.state) }}
              </p>
            </template>
          </div>
        </template>
      </div>

      <div class="suggestions" :class="{ 'is-hidden': !suggestions.length }">
        <button v-for="suggestion in suggestions" :key="suggestion.label" type="button" class="suggestion" @click="choose(suggestion)">
          {{ suggestion.label }}
        </button>
      </div>

      <div class="composer">
        <span class="composer-text" :class="{ 'is-empty': !typed }">{{ typed || 'Message the assistant' }}<span v-if="typed" class="caret" /></span>
        <span class="send" :class="{ 'is-ready': typed.length > 0 }"><UiIcon name="arrow-up" /></span>
      </div>
    </div>

    <div class="code min-w-0" role="img" aria-label="The current strategy as the JSON the engine runs">
      <p class="code-head">
        <UiIcon name="file-json" /> strategy.json
        <span class="ml-auto">{{ linesShown === jsonLines.length ? 'Valid' : hasStarted ? 'Updating' : '' }}</span>
      </p>
      <div class="code-body">
        <template v-for="(line, index) in jsonLines" :key="`${index}-${line}`">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <code v-if="index < linesShown" class="line" v-html="line" />
          <span v-else class="skeleton" :style="{ width: `${30 + ((index * 37) % 55)}%` }" />
        </template>
      </div>
      <p class="code-foot">
        <UiIcon name="shield-check" /> Checked against one schema, and the model never writes code that runs
      </p>
    </div>
  </div>
</template>

<style scoped>
.chat {
  display: flex;
  height: 42rem;
  flex-direction: column;
  overflow: hidden;
  border-radius: 28px;
  background: #0b2125;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.08);
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
  border-radius: 7px;
  padding: 0.3rem 0.6rem;
  font-size: 13px;
  color: rgb(255 255 255 / 0.75);
  transition: background-color 160ms, color 160ms;
}

.replay:hover:not(:disabled) {
  background: rgb(255 255 255 / 0.08);
  color: #ffffff;
}

.replay:disabled {
  cursor: default;
  opacity: 0.4;
}

/* The conversation scrolls inside its panel and starts at the bottom, as in a messaging app. */
.chat-body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.9rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 1.25rem;
  scrollbar-width: thin;
  scrollbar-color: rgb(255 255 255 / 0.15) transparent;
}

.chat-body > :first-child {
  margin-top: auto;
}

.hint {
  font-size: 15px;
  text-align: center;
  color: rgb(255 255 255 / 0.7);
}

.bubble {
  align-self: flex-end;
  max-width: 30rem;
  border-radius: 20px 20px 6px 20px;
  background: rgb(255 255 255 / 0.14);
  padding: 0.8rem 1.05rem;
  font-size: 15px;
  line-height: 1.5;
  animation: arrive 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes arrive {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
}

.answer {
  display: grid;
  gap: 0.7rem;
  animation: arrive 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.answer-text {
  font-size: 15px;
}

.answer-rules {
  --rules-size: 12.5px;
}

.answer-result {
  border-radius: 10px;
  background: rgb(200 242 90 / 0.1);
  padding: 0.6rem 0.8rem;
  font-size: 14px;
  color: #e7f9b8;
  font-variant-numeric: tabular-nums;
}

.steps {
  display: grid;
  gap: 0.4rem;
  font-size: 14px;
  color: rgb(255 255 255 / 0.65);
}

.steps li {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.steps li.is-done {
  color: rgb(255 255 255 / 0.9);
}

.tick {
  display: grid;
  width: 1.15rem;
  height: 1.15rem;
  place-items: center;
  color: var(--color-lime);
}

.spinner {
  width: 0.85rem;
  height: 0.85rem;
  border: 2px solid rgb(255 255 255 / 0.2);
  border-top-color: var(--color-lime);
  border-radius: 999px;
  animation: spin 700ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0 1rem 0.75rem;
  transition: opacity 200ms;
}

.suggestions.is-hidden {
  opacity: 0;
  pointer-events: none;
}

.suggestion {
  cursor: pointer;
  border-radius: 10px;
  background: rgb(255 255 255 / 0.06);
  padding: 0.45rem 0.75rem;
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.12);
  transition: background-color 160ms, transform 120ms;
}

.suggestion:hover {
  background: rgb(200 242 90 / 0.14);
}

.suggestion:active {
  transform: scale(0.97);
}

.suggestion:focus-visible,
.replay:focus-visible {
  outline: 2px solid var(--color-lime);
  outline-offset: 2px;
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
  min-height: 2.9em;
  font-size: 15px;
  line-height: 1.45;
}

.composer-text.is-empty {
  display: flex;
  align-items: center;
  color: rgb(255 255 255 / 0.65);
}

.caret {
  display: inline-block;
  width: 2px;
  height: 1.05em;
  margin-left: 1px;
  vertical-align: -0.15em;
  background: var(--color-lime);
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
  border-radius: 10px;
  background: rgb(255 255 255 / 0.12);
  color: rgb(255 255 255 / 0.5);
  transition: background-color 200ms, color 200ms;
}

.send.is-ready {
  background: var(--color-lime);
  color: var(--color-ink);
}

.code {
  display: flex;
  height: 42rem;
  flex-direction: column;
  overflow: hidden;
  border-radius: 28px;
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
  color: #a5c2c6;
}

.code-head {
  border-bottom: 1px solid rgb(255 255 255 / 0.08);
  font-family: var(--font-mono);
}

.code-foot {
  border-top: 1px solid rgb(255 255 255 / 0.08);
}

.code-body {
  display: grid;
  flex: 1;
  align-content: start;
  gap: 0.5rem;
  overflow: hidden;
  padding: 1.25rem;
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 1.4;
  color: #d4e6e8;
}

.line {
  white-space: pre-wrap;
  padding-left: 2ch;
  text-indent: -2ch;
  animation: line-in 220ms ease-out both;
}

@keyframes line-in {
  from {
    opacity: 0;
    transform: translateX(-6px);
  }
}

.skeleton {
  display: block;
  height: 0.7rem;
  margin-block: 0.18rem;
  border-radius: 4px;
  background: rgb(255 255 255 / 0.06);
}

.code-body :deep(.k) { color: #7fe3d6; }
.code-body :deep(.s) { color: var(--color-lime); }
.code-body :deep(.n) { color: #b8d0ff; }
.code-body :deep(.p) { color: #7f9da2; }

@media (prefers-reduced-motion: reduce) {
  .bubble,
  .answer,
  .spinner,
  .caret,
  .line {
    animation: none;
  }
}
</style>
