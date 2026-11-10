<script setup lang="ts">
useSeoMeta({
  title: 'BlockStrat: build and test trading strategies from blocks',
  ogTitle: 'BlockStrat: build and test trading strategies from blocks',
  description: 'Snap together a trading strategy from blocks, or describe it in plain words, and see how it would have done on years of real crypto prices. No code.',
  ogDescription: 'Snap together a trading strategy from blocks, or describe it in plain words, and see how it would have done on years of real crypto prices.',
})

const STEPS = [
  {
    title: 'Pick a market',
    text: 'Choose one of ten crypto pairs, like BTC/USDT or ETH/USDT, and how often to check it: every hour, every four hours or once a day.',
  },
  {
    title: 'Snap the rules together',
    text: 'Say when to buy or sell short, and when to get out. Drag indicators like moving averages or RSI into a condition, or type your idea and let the assistant place the blocks.',
  },
  {
    title: 'Read the result',
    text: 'The backtest reruns the moment you change a block. You see every trade on the chart, your account over time, and how it compares with simply holding.',
  },
]

const HONEST_RULES = [
  {
    title: 'No peeking at the future',
    text: 'A signal on today\'s close is filled at tomorrow\'s open price, the way a real order would be.',
  },
  {
    title: 'Fees and slippage included',
    text: 'Pick a cost preset or enter your exchange\'s fees. Turning them off is possible, and clearly labelled unrealistic.',
  },
  {
    title: 'Always next to buy and hold',
    text: 'A strategy that earns less than holding the coin says so, right under the result.',
  },
  {
    title: 'The worst drop, not just the best number',
    text: 'Maximum drawdown, win rate and time in the market sit next to the return.',
  },
]

const FAQ = [
  {
    question: 'Do I need to know how to code?',
    answer: 'No. Everything is built from blocks you drag into place. If you prefer, describe the idea in a sentence and the assistant builds the blocks for you to check and change.',
  },
  {
    question: 'Does BlockStrat trade for me?',
    answer: 'No. It never places orders, never asks for exchange keys and never touches money. It shows how a set of rules would have performed on past prices.',
  },
  {
    question: 'Is this investment advice?',
    answer: 'No. BlockStrat is a tool for testing your own ideas on historical data. A good result on the past does not mean the strategy will make money in the future.',
  },
  {
    question: 'Where do the prices come from?',
    answer: 'From Binance\'s public market data: hourly, four-hourly and daily prices for ten large crypto pairs, going back to 2017 where available.',
  },
  {
    question: 'Can I keep and share my strategies?',
    answer: 'Yes. Save them in your browser, download them as a file, or copy a link. Whoever opens the link sees your blocks and the result, no account needed.',
  },
  {
    question: 'Does it cost anything?',
    answer: 'No. BlockStrat is free and needs no sign-up.',
  },
]
</script>

<template>
  <div class="bg-white text-ink">
    <header class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
      <NuxtLink to="/" class="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indicator">
        <BrandLogo />
      </NuxtLink>
      <nav class="flex items-center gap-1 text-sm font-semibold sm:gap-4" aria-label="Main">
        <a href="#how-it-works" class="hidden rounded-md px-2 py-1 text-slate-600 hover:text-ink sm:inline">How it works</a>
        <a href="#faq" class="hidden rounded-md px-2 py-1 text-slate-600 hover:text-ink sm:inline">Questions</a>
        <NuxtLink to="/app" class="cta-small">
          Open the builder
        </NuxtLink>
      </nav>
    </header>

    <main>
      <section class="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-8 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:pt-14">
        <div class="min-w-0 max-w-xl">
          <h1 class="font-display text-[clamp(2.4rem,4.6vw,3.6rem)] font-extrabold leading-[1.02] tracking-[-0.03em]">
            Snap together a trading idea. See how it would have done.
          </h1>
          <p class="mt-6 max-w-[34rem] text-lg leading-relaxed text-slate-600">
            BlockStrat turns a strategy into blocks you can drag, drop and change, or builds them from a sentence you type.
            Every change is tested on years of real crypto prices in under a second.
          </p>
          <div class="mt-8 flex flex-wrap items-center gap-3">
            <NuxtLink to="/app" class="cta">
              Open the builder
            </NuxtLink>
            <a href="#how-it-works" class="rounded-xl px-4 py-3 font-semibold text-slate-700 hover:bg-slate-100">
              How it works
            </a>
          </div>
          <p class="mt-5 text-sm text-slate-500">
            Free, no sign-up, no code. It never trades or touches your money.
          </p>
        </div>
        <HeroDemo class="min-w-0" />
      </section>

      <section class="border-y border-slate-200 bg-ink text-white">
        <div class="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 class="font-display text-[clamp(1.9rem,3.6vw,2.8rem)] font-bold leading-tight tracking-[-0.02em]">
              Not sure which blocks you need? Just say what you mean.
            </h2>
            <p class="mt-5 max-w-lg leading-relaxed text-slate-300">
              Describe your idea the way you would tell a friend. The assistant builds it as blocks in the editor,
              so you can see exactly what it understood and change anything before you trust the result.
              If you ask for something the blocks can't do, it tells you what it left out.
            </p>
          </div>
          <div class="flex min-w-0 flex-col gap-4" aria-label="Example conversation">
            <p class="max-w-md self-end rounded-3xl rounded-br-md bg-indicator px-5 py-3 leading-relaxed">
              Buy Ethereum every 4 hours when RSI drops below 30. Sell when it goes above 70, and never lose more than 5%.
            </p>
            <div class="max-w-md rounded-3xl rounded-bl-md bg-white/8 p-4 ring-1 ring-white/15">
              <p class="text-sm text-slate-300">
                Done. Here are your blocks:
              </p>
              <div class="mt-3 flex flex-col items-start gap-2">
                <DemoBlock tone="market">
                  market <span class="field">ETH/USDT</span>
                </DemoBlock>
                <DemoBlock tone="market">
                  every <span class="field">4 hours</span>
                </DemoBlock>
                <DemoBlock tone="action">
                  go <span class="field">long</span> when
                  <DemoBlock tone="condition">
                    <DemoBlock tone="indicator">
                      RSI <span class="number">14</span>
                    </DemoBlock>
                    &lt; <span class="number">30</span>
                  </DemoBlock>
                </DemoBlock>
                <DemoBlock tone="action">
                  close when
                  <DemoBlock tone="condition">
                    <DemoBlock tone="indicator">
                      RSI <span class="number">14</span>
                    </DemoBlock>
                    &gt; <span class="number">70</span>
                  </DemoBlock>
                </DemoBlock>
                <DemoBlock tone="risk">
                  stop-loss <span class="number">5</span> %
                </DemoBlock>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" class="mx-auto max-w-6xl scroll-mt-8 px-5 py-24 sm:px-8">
        <h2 class="max-w-2xl font-display text-[clamp(1.9rem,3.6vw,2.8rem)] font-bold leading-tight tracking-[-0.02em]">
          From idea to result in three moves
        </h2>
        <ol class="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          <li v-for="(step, index) in STEPS" :key="step.title" class="border-t-4 pt-5" :class="['border-market', 'border-condition', 'border-indicator'][index]">
            <p class="font-display text-5xl font-extrabold text-slate-200" aria-hidden="true">
              {{ index + 1 }}
            </p>
            <h3 class="mt-2 font-display text-xl font-bold">
              {{ step.title }}
            </h3>
            <p class="mt-2 leading-relaxed text-slate-600">
              {{ step.text }}
            </p>
          </li>
        </ol>
      </section>

      <section class="dotted-canvas border-y border-slate-200">
        <div class="mx-auto grid max-w-6xl gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 class="font-display text-[clamp(1.9rem,3.6vw,2.8rem)] font-bold leading-tight tracking-[-0.02em]">
              Results you can believe
            </h2>
            <p class="mt-5 max-w-md leading-relaxed text-slate-600">
              Many backtests look great because they quietly cheat. BlockStrat is strict by default, so a strategy
              that looks good here had to earn it.
            </p>
          </div>
          <dl class="grid gap-x-8 gap-y-8 sm:grid-cols-2">
            <div v-for="rule in HONEST_RULES" :key="rule.title" class="rounded-2xl bg-white/80 p-5 ring-1 ring-slate-200">
              <dt class="font-display text-lg font-bold">
                {{ rule.title }}
              </dt>
              <dd class="mt-1.5 leading-relaxed text-slate-600">
                {{ rule.text }}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section class="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <div class="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <h2 class="font-display text-[clamp(1.9rem,3.6vw,2.8rem)] font-bold leading-tight tracking-[-0.02em]">
            What BlockStrat will never do
          </h2>
          <ul class="grid gap-4 text-lg leading-relaxed text-slate-700">
            <li class="border-l-4 border-risk pl-4">
              Place trades, or ask for your exchange account or API keys.
            </li>
            <li class="border-l-4 border-risk pl-4">
              Send you buy or sell signals.
            </li>
            <li class="border-l-4 border-risk pl-4">
              Promise that a strategy will make money. It shows the past, not the future.
            </li>
          </ul>
        </div>
      </section>

      <section id="faq" class="border-t border-slate-200 bg-slate-50">
        <div class="mx-auto max-w-3xl scroll-mt-8 px-5 py-24 sm:px-8">
          <h2 class="font-display text-[clamp(1.9rem,3.6vw,2.8rem)] font-bold leading-tight tracking-[-0.02em]">
            Questions
          </h2>
          <div class="mt-10 divide-y divide-slate-200 border-y border-slate-200">
            <details v-for="item in FAQ" :key="item.question" class="group py-5">
              <summary class="flex cursor-pointer list-none items-center justify-between gap-6 font-display text-lg font-bold">
                {{ item.question }}
                <span class="text-2xl font-normal text-slate-400 transition-transform group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p class="mt-3 max-w-2xl leading-relaxed text-slate-600">
                {{ item.answer }}
              </p>
            </details>
          </div>
        </div>
      </section>

      <section class="bg-ink">
        <div class="mx-auto flex max-w-6xl flex-col items-start gap-8 px-5 py-20 sm:px-8 md:flex-row md:items-center md:justify-between">
          <h2 class="max-w-xl font-display text-[clamp(1.9rem,3.6vw,2.8rem)] font-bold leading-tight tracking-[-0.02em] text-white">
            Your first strategy is already waiting in the builder.
          </h2>
          <NuxtLink to="/app" class="cta shrink-0 bg-white! text-ink! hover:bg-slate-100!">
            Open the builder
          </NuxtLink>
        </div>
      </section>
    </main>

    <footer class="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-sm text-slate-500 sm:px-8 md:flex-row md:items-center md:justify-between">
      <BrandLogo />
      <p class="max-w-xl">
        BlockStrat shows simulations on historical market data from Binance. They are not investment advice and do not predict future returns.
      </p>
    </footer>
  </div>
</template>

<style scoped>
.cta {
  display: inline-block;
  border-radius: 0.875rem;
  background: var(--color-indicator);
  padding: 0.85rem 1.4rem;
  font-weight: 700;
  color: #ffffff;
  box-shadow: inset 0 -3px 0 rgb(0 0 0 / 0.2);
}

.cta:hover {
  background: #1d4ed8;
}

.cta-small {
  border-radius: 0.75rem;
  background: var(--color-ink);
  padding: 0.5rem 0.9rem;
  color: #ffffff;
}

.cta-small:hover {
  background: #2a3655;
}

.cta:focus-visible,
.cta-small:focus-visible,
a:focus-visible,
summary:focus-visible {
  outline: 2px solid var(--color-indicator);
  outline-offset: 3px;
}
</style>
