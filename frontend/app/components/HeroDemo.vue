<script setup lang="ts">
// The landing page's one animated moment: blocks snap into the Strategy block, then the result draws.
// The curves are the real full-history result of this exact strategy (log10 of equity / 10 000),
// sampled at 72 points; regenerate them if the example strategy changes.
const STRATEGY_CURVE = [0.0, 0.0, 0.268, 0.586, 0.39, 0.353, 0.316, 0.316, 0.279, 0.279, 0.261, 0.224, 0.224, 0.356, 0.546, 0.61, 0.573, 0.573, 0.536, 0.607, 0.574, 0.661, 0.682, 0.766, 0.71, 0.877, 1.161, 1.401, 1.402, 1.353, 1.353, 1.439, 1.387, 1.388, 1.388, 1.313, 1.276, 1.276, 1.276, 1.239, 1.243, 1.202, 1.339, 1.31, 1.315, 1.311, 1.291, 1.291, 1.405, 1.468, 1.506, 1.608, 1.593, 1.556, 1.519, 1.5, 1.701, 1.695, 1.658, 1.658, 1.721, 1.748, 1.731, 1.679, 1.679, 1.642, 1.642, 1.643, 1.614, 1.611, 1.728, 1.71]
const HOLD_CURVE = [0.0, 0.003, 0.282, 0.6, 0.374, 0.21, 0.241, 0.171, 0.225, 0.189, -0.056, -0.085, -0.039, 0.093, 0.283, 0.349, 0.379, 0.336, 0.225, 0.351, 0.197, 0.309, 0.323, 0.439, 0.403, 0.591, 0.876, 1.115, 1.116, 0.952, 0.903, 1.057, 1.127, 1.125, 0.993, 0.953, 0.967, 0.847, 0.695, 0.718, 0.686, 0.589, 0.743, 0.817, 0.822, 0.853, 0.837, 0.789, 0.93, 0.993, 1.085, 1.187, 1.214, 1.115, 1.175, 1.149, 1.35, 1.344, 1.342, 1.295, 1.375, 1.447, 1.418, 1.416, 1.324, 1.319, 1.237, 1.263, 1.176, 1.176, 1.294, 1.245]

const WIDTH = 320
const HEIGHT = 110
const Y_MIN = -0.15
const Y_MAX = 1.85

function toPath(curve: number[]): string {
  return curve
    .map((value, index) => {
      const x = (index / (curve.length - 1)) * WIDTH
      const y = HEIGHT - ((value - Y_MIN) / (Y_MAX - Y_MIN)) * HEIGHT
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

const strategyPath = toPath(STRATEGY_CURVE)
const holdPath = toPath(HOLD_CURVE)
</script>

<template>
  <figure class="dotted-canvas relative rounded-[28px] p-5 ring-1 ring-slate-200 sm:p-8">
    <div class="rounded-2xl bg-root p-4 text-[13px] font-semibold text-white shadow-[0_18px_40px_-20px_rgb(23_32_54/0.6)]">
      <p class="font-display text-base font-bold">
        Strategy
      </p>
      <dl class="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2.5">
        <dt class="slot-label" style="--step: 0">
          instrument
        </dt>
        <dd class="snap" style="--step: 0">
          <DemoBlock tone="market">
            market <span class="field">BTC/USDT</span>
          </DemoBlock>
        </dd>
        <dt class="slot-label" style="--step: 1">
          timeframe
        </dt>
        <dd class="snap" style="--step: 1">
          <DemoBlock tone="market">
            every <span class="field">1 day</span>
          </DemoBlock>
        </dd>
        <dt class="slot-label" style="--step: 2">
          entry
        </dt>
        <dd class="snap" style="--step: 2">
          <DemoBlock tone="action">
            go <span class="field">long</span> when
            <DemoBlock tone="condition">
              <DemoBlock tone="indicator">
                EMA <span class="number">20</span>
              </DemoBlock>
              crosses above
              <DemoBlock tone="indicator">
                SMA <span class="number">50</span>
              </DemoBlock>
            </DemoBlock>
          </DemoBlock>
        </dd>
        <dt class="slot-label" style="--step: 3">
          exit
        </dt>
        <dd class="snap flex flex-wrap gap-1.5" style="--step: 3">
          <DemoBlock tone="action">
            close when EMA crosses back below
          </DemoBlock>
          <DemoBlock tone="risk">
            stop-loss <span class="number">8</span> %
          </DemoBlock>
        </dd>
      </dl>
    </div>

    <div class="result mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p class="font-display text-2xl font-extrabold text-action">
          +5 025%
        </p>
        <p class="text-sm text-slate-600">
          buy and hold: +1 659%, worst drop: −63%
        </p>
      </div>
      <svg :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" class="mt-3 h-28 w-full overflow-visible" role="img" aria-label="The strategy's equity grew faster than buying and holding Bitcoin over the same years.">
        <path :d="holdPath" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linejoin="round" class="curve" pathLength="1" />
        <path :d="strategyPath" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linejoin="round" class="curve" pathLength="1" />
      </svg>
      <figcaption class="mt-2 text-xs leading-relaxed text-slate-500">
        The blocks above, tested on BTC/USDT daily prices from August 2017 to November 2026, with fees and slippage.
        Log scale. Past results do not predict future returns.
      </figcaption>
    </div>
  </figure>
</template>

<style scoped>
.slot-label {
  white-space: nowrap;
  color: rgb(255 255 255 / 0.75);
}

.slot-label::before {
  content: "○ ";
}

/* Each block drops into its slot in turn, then the slot's mark turns into a tick. */
.snap {
  animation: snap-in 420ms cubic-bezier(0.2, 0.9, 0.3, 1.25) both;
  animation-delay: calc(300ms + var(--step) * 380ms);
}

.slot-label::before {
  animation: tick 1ms both;
  animation-delay: calc(560ms + var(--step) * 380ms);
}

.result {
  animation: rise 500ms ease-out both;
  animation-delay: 1900ms;
}

.curve {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: draw 1400ms ease-out forwards;
  animation-delay: 2150ms;
}

@keyframes snap-in {
  from {
    opacity: 0;
    transform: translate(48px, -14px) rotate(4deg);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes tick {
  to {
    content: "✓ ";
  }
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
}

@keyframes draw {
  to {
    stroke-dashoffset: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .snap,
  .result,
  .curve,
  .slot-label::before {
    animation: none;
  }

  .curve {
    stroke-dashoffset: 0;
  }

  .slot-label::before {
    content: "✓ ";
  }
}
</style>
