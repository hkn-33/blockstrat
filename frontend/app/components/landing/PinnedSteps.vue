<script setup lang="ts">
// "How it works" as a pinned section: the page holds still while scrolling walks through the three steps.
// Each step's line fills as you scroll, so it is always clear how much is left, and the picture on the
// right changes with every bit of scroll: it finishes a little before the step ends, then holds a moment.
// On narrow screens the steps simply stack, each with its finished picture.
const STEPS = [
  { title: 'Pick a market and a pace', text: 'Ten crypto pairs from Binance, checked every hour, every four hours or once a day' },
  { title: 'Snap the rules together', text: 'Drop a ready condition into place and change its numbers: RSI, moving averages, MACD, Bollinger Bands' },
  { title: 'Read the verdict', text: 'Every trade on the chart, your balance underneath, and whether it beat simply holding the coin' },
]

const section = ref<HTMLElement | null>(null)
const progress = ref(0)
const active = computed(() => Math.min(STEPS.length - 1, Math.floor(progress.value * STEPS.length)))

function stepProgress(index: number): number {
  return Math.min(1, Math.max(0, progress.value * STEPS.length - index))
}

function pictureProgress(index: number): number {
  return Math.min(1, stepProgress(index) / 0.85)
}

function onScroll(): void {
  const element = section.value
  if (!element) return
  const travel = element.offsetHeight - window.innerHeight
  // Not pinned (narrow screens): every step and its picture shows in full.
  if (travel <= 0) {
    progress.value = 0.999
    return
  }
  progress.value = Math.min(0.999, Math.max(0, -element.getBoundingClientRect().top / travel))
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <section ref="section" class="pinned" aria-labelledby="steps-title">
    <div class="pinned-stage">
      <div class="wrap grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center">
        <div class="min-w-0">
          <h2 id="steps-title" class="section-title">
            From idea to verdict in three steps
          </h2>
          <ol class="mt-10 grid">
            <li
              v-for="(step, index) in STEPS"
              :key="step.title"
              class="step"
              :class="{ 'is-active': index === active, 'is-done': index < active }"
              :style="{ '--fill': stepProgress(index) }"
            >
              <span class="step-line" aria-hidden="true" />
              <div class="step-body">
                <h3 class="text-[20px] font-bold">
                  {{ step.title }}
                </h3>
                <p class="step-text">
                  {{ step.text }}
                </p>
                <LandingStepVisual :step="index" class="mt-6 lg:hidden" />
              </div>
            </li>
          </ol>
        </div>

        <div class="visual hidden lg:grid">
          <Transition name="swap" mode="out-in">
            <LandingStepVisual :key="active" :step="active" :progress="pictureProgress(active)" />
          </Transition>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pinned {
  position: relative;
}

@media (min-width: 1024px) {
  .pinned {
    height: 300vh;
  }

  .pinned-stage {
    position: sticky;
    top: 0;
    display: grid;
    height: 100vh;
    align-items: center;
  }
}

@media (max-width: 1023px) {
  .pinned-stage {
    padding-block: 6rem;
  }
}

.step {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 1.1rem;
  color: var(--muted);
  transition: color 300ms;
}

.step.is-active,
.step.is-done {
  color: var(--ink);
}

/* A line beside each step that fills with its share of the scroll. */
.step-line {
  position: relative;
  width: 3px;
  overflow: hidden;
  border-radius: 3px;
  background: var(--line);
}

.step-line::after {
  position: absolute;
  inset: 0;
  background: var(--gain-ink);
  transform: scaleY(var(--fill));
  transform-origin: top;
  content: "";
}

.step-body {
  padding-block: 0.4rem 1.75rem;
}

.step-text {
  margin-top: 0.35rem;
  font-size: 15px;
  line-height: 1.6;
  color: var(--ink-soft);
}

@media (min-width: 1024px) {
  .step:not(.is-active) .step-text {
    display: none;
  }
}

.visual {
  /* One fixed height for all three pictures, so changing step never moves the column beside it. */
  height: 34rem;
  align-content: center;
}

.swap-enter-active {
  transition: opacity 320ms cubic-bezier(0.22, 1, 0.36, 1), transform 320ms cubic-bezier(0.22, 1, 0.36, 1), filter 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.swap-leave-active {
  transition: opacity 220ms cubic-bezier(0.4, 0, 1, 1), transform 220ms cubic-bezier(0.4, 0, 1, 1), filter 220ms cubic-bezier(0.4, 0, 1, 1);
}

.swap-enter-from {
  opacity: 0;
  transform: translateY(24px) scale(0.98);
  filter: blur(6px);
}

.swap-leave-to {
  opacity: 0;
  transform: translateY(-12px) scale(0.99);
  filter: blur(4px);
}

@media (prefers-reduced-motion: reduce) {
  .swap-enter-active,
  .swap-leave-active,
  .step {
    transition: none;
  }
}
</style>
