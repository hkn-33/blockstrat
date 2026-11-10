<script setup lang="ts">
import type { AiMessage, StrategyDraft } from '~/types/api'

const props = defineProps<{ currentStrategy: StrategyDraft }>()
const emit = defineEmits<{ apply: [strategy: StrategyDraft] }>()

const api = useApi()
const messages = ref<AiMessage[]>([])
const input = ref('')
const isThinking = ref(false)
const pending = ref<{ strategy: StrategyDraft, unsupported: string[] } | null>(null)
const failure = ref<string | null>(null)

const EXAMPLES = [
  'Buy BTC on the daily chart when RSI(14) drops below 30, sell when it rises above 70.',
  'Go short ETH on 4h when price crosses below the 50 EMA, 3% stop-loss, 6% take-profit.',
]

async function send(text = input.value): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed || isThinking.value) return
  input.value = ''
  failure.value = null
  messages.value.push({ role: 'user', text: trimmed })
  isThinking.value = true
  try {
    // Only the last few turns: enough context for refinements, cheap on the free tier.
    const response = await api.buildStrategy(messages.value.slice(-8), props.currentStrategy)
    if (response.status !== 'ok') {
      failure.value = response.message
      messages.value.pop()
      return
    }
    messages.value.push({ role: 'assistant', text: response.message })
    if (response.strategy) pending.value = { strategy: response.strategy, unsupported: response.unsupported }
  }
  catch {
    failure.value = 'The AI could not be reached. Build the blocks by hand for now.'
    messages.value.pop()
  }
  finally {
    isThinking.value = false
  }
}

function apply(): void {
  if (!pending.value) return
  emit('apply', pending.value.strategy)
  pending.value = null
}
</script>

<template>
  <section class="flex h-full flex-col gap-3">
    <p class="text-xs text-slate-500">
      Describe a strategy in plain words. The assistant builds it as blocks you can inspect and edit.
      Don't enter personal data: on the free tier, Google may use prompts to improve its models.
    </p>

    <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
      <template v-if="!messages.length">
        <button
          v-for="example in EXAMPLES"
          :key="example"
          type="button"
          class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-600 hover:border-petrol/40 hover:bg-canvas"
          @click="send(example)"
        >
          {{ example }}
        </button>
      </template>
      <p
        v-for="(message, index) in messages"
        :key="index"
        class="max-w-[85%] rounded-2xl px-3 py-2 text-sm"
        :class="message.role === 'user' ? 'self-end bg-indicator text-white' : 'self-start bg-white text-slate-800 ring-1 ring-slate-200'"
      >
        {{ message.text }}
      </p>
      <p v-if="isThinking" class="self-start text-sm text-slate-400">
        Building blocks…
      </p>
    </div>

    <div v-if="pending" class="rounded-2xl bg-canvas p-3 text-sm ring-1 ring-petrol/15">
      <p class="font-semibold text-ink">
        Replace the strategy in the editor with this one?
      </p>
      <p v-if="pending.unsupported.length" class="mt-1 text-amber-800">
        Left out (the blocks cannot express it): {{ pending.unsupported.join(', ') }}
      </p>
      <div class="mt-2 flex gap-2">
        <button type="button" class="rounded-xl bg-lime px-3 py-1.5 font-bold text-ink hover:bg-[#d6f87c]" @click="apply">
          Replace
        </button>
        <button type="button" class="rounded-lg px-3 py-1.5 font-semibold text-slate-600 hover:bg-white" @click="pending = null">
          Discard
        </button>
      </div>
    </div>

    <p v-if="failure" class="rounded-xl bg-amber-50 p-3 text-sm text-amber-800" role="status">
      {{ failure }}
    </p>

    <form class="flex gap-2" @submit.prevent="send()">
      <input
        v-model="input"
        type="text"
        maxlength="2000"
        placeholder="e.g. Buy SOL when the 20 EMA crosses above the 50 EMA"
        class="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        :disabled="isThinking"
      >
      <button
        type="submit"
        class="rounded-xl bg-ink px-3 py-2 text-sm font-bold text-white hover:bg-petrol disabled:opacity-50"
        :disabled="isThinking || !input.trim()"
      >
        Send
      </button>
    </form>
  </section>
</template>
