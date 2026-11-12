<script setup lang="ts">
import type { DemoMarket, DemoStopLoss, DemoStrategy } from '~/composables/useLandingDemo'

// A working conversation with the assistant. The first request plays by itself when the section comes
// into view; after every answer three follow-ups are offered, and each one changes the strategy, the
// blocks, the JSON and the real backtest result. One fixed-height card with two tabs: the chat, and the
// JSON the engine runs. The chat follows its newest message by itself and never takes the page's scroll.
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
// The JSON panel opens on the first strategy, so it is never empty before the conversation starts.
const linesShown = ref(strategyJsonLines(FIRST_STATE.strategy, FIRST_STATE.market, FIRST_STATE.stopLoss).length)
const hasStarted = ref(false)
const tab = ref<'chat' | 'json'>('chat')
const jsonIsNew = ref(false)
const root = ref<HTMLDivElement | null>(null)
const body = ref<HTMLDivElement | null>(null)
let nextId = 1
let timers: ReturnType<typeof setTimeout>[] = []
let observer: IntersectionObserver | undefined

const jsonLines = computed(() => strategyJsonLines(current.value.strategy, current.value.market, current.value.stopLoss))
// The JSON tab only appears once the assistant has answered: it is something the answer made.
const hasAnswer = computed(() => messages.value.some(message => message.state))
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
  if (tab.value === 'chat') jsonIsNew.value = true
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
  const isNewStrategy = JSON.stringify(state) !== JSON.stringify(current.value)
  current.value = state
  messages.value[messages.value.length - 1]!.state = state
  await scrollToEnd()
  // The blocks grow in as they snap into place; follow them down once they have landed.
  await wait(prefersReducedMotion() ? 0 : 600)
  await scrollToEnd()
  isBusy.value = false
  // The follow-ups take room under the conversation; keep the result line above them in view.
  await scrollToEnd()
  if (tab.value === 'chat') jsonIsNew.value = true
  if (isNewStrategy) await streamJson()
}

function showTab(next: 'chat' | 'json'): void {
  tab.value = next
  if (next === 'json') jsonIsNew.value = false
  else scrollToEnd()
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
  tab.value = 'chat'
  jsonIsNew.value = false
  current.value = FIRST_STATE
  linesShown.value = jsonLines.value.length
  typed.value = ''
  isBusy.value = false
  start()
}

onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    if (hasStarted.value || !entries.some(entry => entry.isIntersecting)) return
    start()
  }, { threshold: 0.15 })
  observer.observe(root.value!)
})

onBeforeUnmount(() => {
  timers.forEach(clearTimeout)
  observer?.disconnect()
})
</script>

<template>
  <div ref="root" class="card">
    <div class="card-head">
      <div class="tabs" role="tablist" aria-label="Assistant views">
        <button type="button" role="tab" class="tab" :class="{ 'is-on': tab === 'chat' }" :aria-selected="tab === 'chat'" @click="showTab('chat')">
          <img src="/brand-icons/gemini.svg" alt="" class="h-5 w-5"> Assistant
        </button>
        <Transition name="tab-in">
          <button v-if="hasAnswer" type="button" role="tab" class="tab" :class="{ 'is-on': tab === 'json' }" :aria-selected="tab === 'json'" @click="showTab('json')">
            <UiIcon name="file-json" /> strategy.json
            <span v-if="jsonIsNew" class="tab-new">New</span>
          </button>
        </Transition>
      </div>
      <button type="button" class="replay" :disabled="isBusy || !hasStarted" @click="restart">
        <UiIcon name="refresh-cw" /> <span class="replay-label">Start over</span>
      </button>
    </div>

    <div v-show="tab === 'chat'" class="chat" role="tabpanel">
      <div ref="body" class="chat-body" aria-live="polite">
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
              <div class="answer-rules">
                <LandingStrategyBoard
                  compact
                  :market="message.state.market"
                  :name="DEMO_STRATEGY_NAMES[message.state.strategy]"
                  :entry="demoRules(message.state.strategy, message.state.stopLoss).entry"
                  :exit="demoRules(message.state.strategy, message.state.stopLoss).exit"
                />
              </div>
              <p class="answer-result">
                {{ resultLine(message.state) }}
              </p>
            </template>
          </div>
        </template>
      </div>

      <div class="suggestions" :class="{ 'is-hidden': !suggestions.length }">
        <span class="suggestions-label">Ask next</span>
        <button v-for="suggestion in suggestions" :key="suggestion.label" type="button" class="suggestion" @click="choose(suggestion)">
          {{ suggestion.label }}
          <UiIcon name="arrow-up" class="suggestion-icon" />
        </button>
      </div>

      <div class="composer">
        <span class="composer-text" :class="{ 'is-empty': !typed }">{{ typed || 'Message the assistant' }}<span v-if="typed" class="caret" /></span>
        <span class="send" :class="{ 'is-ready': typed.length > 0 }"><UiIcon name="arrow-up" /></span>
      </div>
    </div>

    <div v-show="tab === 'json'" class="code" role="tabpanel" aria-label="The current strategy as the JSON the engine runs">
      <div class="code-body">
        <template v-for="(line, index) in jsonLines" :key="`${index}-${line}`">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <code v-if="index < linesShown" class="line" v-html="line" />
          <span v-else class="skeleton" :style="{ width: `${30 + ((index * 37) % 55)}%` }" />
        </template>
      </div>
      <p class="code-foot">
        <UiIcon name="shield-check" /> {{ linesShown === jsonLines.length ? 'Valid against the one schema the engine reads' : 'Updating' }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.card {
  display: flex;
  height: 42rem;
  flex-direction: column;
  overflow: hidden;
  border-radius: 28px;
  background: var(--panel);
  color: var(--panel-ink);
  box-shadow: var(--panel-shadow);
}

.card-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-bottom: 1px solid var(--panel-line);
  padding: 0.6rem 0.75rem;
}

.tabs {
  display: flex;
  gap: 2px;
  border-radius: 12px;
  background: var(--panel-fill);
  padding: 3px;
}

.tab {
  display: inline-flex;
  white-space: nowrap;
  align-items: center;
  gap: 0.45rem;
  cursor: pointer;
  border-radius: 9px;
  padding: 0.45rem 0.8rem;
  font-size: 14px;
  font-weight: 600;
  color: var(--panel-soft);
  transition: background-color 160ms, color 160ms;
}

.tab:hover {
  color: var(--panel-ink);
}

.tab.is-on {
  background: var(--panel-fill);
  color: var(--panel-ink);
}

.tab:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.tab-new {
  border-radius: 6px;
  background: var(--color-lime);
  padding: 0.05rem 0.4rem;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-ink);
}

.chat {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
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
  color: var(--panel-soft);
  transition: background-color 160ms, color 160ms;
}

@media (max-width: 480px) {
  .replay-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}

.replay:hover:not(:disabled) {
  background: var(--panel-fill);
  color: var(--panel-ink);
}

.replay:disabled {
  cursor: default;
  opacity: 0.4;
}

/* The conversation starts at the bottom, as in a messaging app, and follows its newest message by
   itself. It never scrolls under the wheel, so the page always does. */
.chat-body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.9rem;
  overflow: hidden;
  padding: 1.25rem;
}

.chat-body > :first-child {
  margin-top: auto;
}

.hint {
  font-size: 15px;
  text-align: center;
  color: var(--panel-soft);
}

.bubble {
  align-self: flex-end;
  max-width: 30rem;
  border-radius: 20px 20px 6px 20px;
  background: var(--panel-fill-strong);
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
  overflow: hidden;
  border-radius: 16px;
  box-shadow: inset 0 0 0 1px var(--panel-line);
}

.answer-result {
  border-radius: 10px;
  background: var(--result-bg);
  padding: 0.6rem 0.8rem;
  font-size: 14px;
  color: var(--result-ink);
  font-variant-numeric: tabular-nums;
}

.steps {
  display: grid;
  gap: 0.4rem;
  font-size: 14px;
  color: var(--panel-soft);
}

.steps li {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.steps li.is-done {
  color: var(--panel-ink);
}

.tick {
  display: grid;
  width: 1.15rem;
  height: 1.15rem;
  place-items: center;
  color: var(--gain-ink);
}

.spinner {
  width: 0.85rem;
  height: 0.85rem;
  border: 2px solid var(--panel-line);
  border-top-color: var(--gain-ink);
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
  align-items: center;
  gap: 0.5rem;
  /* One row of follow-ups is always reserved, so the conversation does not jump when they appear. */
  min-height: calc(1.9rem + 0.75rem);
  padding: 0 1rem 0.75rem;
  transition: opacity 200ms;
}

.suggestions.is-hidden {
  opacity: 0;
  pointer-events: none;
}

.suggestions-label {
  font-size: 13px;
  color: var(--panel-soft);
}

/* Follow-ups look like what they do: a message you send, with the composer's own send arrow. */
.suggestion {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  cursor: pointer;
  border-radius: 10px;
  background: var(--panel-fill);
  padding: 0.45rem 0.5rem 0.45rem 0.8rem;
  font-size: 13px;
  font-weight: 600;
  color: var(--panel-ink);
  box-shadow: inset 0 0 0 1px var(--panel-line);
  transition: background-color 160ms, box-shadow 160ms, transform 120ms;
}

.suggestion-icon {
  display: grid;
  width: 1.3rem;
  height: 1.3rem;
  border-radius: 6px;
  background: var(--color-lime);
  padding: 0.2rem;
  color: var(--color-ink);
}

.suggestion:hover {
  background: var(--panel-fill-strong);
  box-shadow: inset 0 0 0 1px var(--gain-ink);
}

.suggestion:active {
  transform: scale(0.97);
}

.suggestion:focus-visible,
.replay:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.composer {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0 1rem 1rem;
  border-radius: 16px;
  background: var(--panel-fill);
  padding: 0.7rem 0.7rem 0.7rem 1rem;
  box-shadow: inset 0 0 0 1px var(--panel-line);
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
  color: var(--panel-soft);
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
  background: var(--panel-fill-strong);
  color: var(--panel-soft);
  transition: background-color 200ms, color 200ms;
}

.send.is-ready {
  background: var(--color-lime);
  color: var(--color-ink);
}

.code {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  background: var(--panel-2);
}

.code-foot {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.9rem 1.25rem;
  font-size: 13px;
  color: var(--panel-soft);
}

.code-foot {
  border-top: 1px solid var(--panel-line);
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
  color: var(--panel-ink);
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
  background: var(--panel-fill);
}

.code-body :deep(.k) { color: var(--code-key); }
.code-body :deep(.s) { color: var(--code-string); }
.code-body :deep(.n) { color: var(--code-number); }
.code-body :deep(.p) { color: var(--code-punctuation); }

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

.tab-in-enter-active {
  transition: opacity 260ms cubic-bezier(0.22, 1, 0.36, 1), transform 260ms cubic-bezier(0.22, 1, 0.36, 1), filter 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.tab-in-enter-from {
  opacity: 0;
  transform: translateX(-8px) scale(0.96);
  filter: blur(3px);
}

@media (prefers-reduced-motion: reduce) {
  .tab-in-enter-active {
    transition: none;
  }
}
