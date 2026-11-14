import type { StrategyDocument } from '~/utils/strategyDocument'
import type { ReplayStep } from '~/utils/strategyReplay'
import type { StrategyEditor } from './useStrategyEditor'

// Builds a finished strategy in front of the user: each block is carried from the library to its place on
// the canvas, the way they would drag it, while the library's tabs and the canvas follow along. It is one
// undo step, can be skipped, and is skipped altogether for people who asked for less motion.
const SETTLE_MS = 420
const CARRY_MS = 520

export interface ReplayFlight {
  label: string
  kind: ReplayStep['kind']
  x: number
  y: number
  /** 0 when picked up, 1 when dropped. */
  progress: number
}

interface Point {
  x: number
  y: number
}

function screenCentre(): Point {
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
}

function boxOf(selector: string, fallback: string): DOMRect | undefined {
  return (document.querySelector(selector) ?? document.querySelector(fallback))?.getBoundingClientRect()
}

/** Where a block is picked up: the middle of its library entry, or near the top of a longer list. */
function pickUpPoint(source: string): Point {
  const box = boxOf(`[data-replay-source="${source}"]`, '.column--library')
  return box ? { x: box.left + box.width / 2, y: box.top + Math.min(box.height / 2, 60) } : screenCentre()
}

/** Where it is dropped: the end of the list it joins, which is where its tile then appears. */
function dropPoint(target: string): Point {
  const box = boxOf(`[data-replay-target="${target}"]`, '.column--canvas')
  return box ? { x: box.left + Math.min(box.width / 2, 150), y: box.bottom - Math.min(box.height / 2, 24) } : screenCentre()
}

function easeInOut(progress: number): number {
  return progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2
}

/** `reveal` brings the place a step lands on into view before its block sets off. */
export function useStrategyReplay(editor: StrategyEditor, reveal: (step: ReplayStep) => void) {
  const isRunning = ref(false)
  const flight = shallowRef<ReplayFlight | null>(null)
  let isSkipped = false

  function wait(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
  }

  // The drop point is read again on every frame: the canvas glides to the next card while the block is in the air.
  function carry(step: ReplayStep): Promise<void> {
    const from = pickUpPoint(step.source)
    const startedAt = performance.now()
    return new Promise((resolve) => {
      const frame = (now: number): void => {
        const progress = Math.min((now - startedAt) / CARRY_MS, 1)
        if (isSkipped || progress >= 1) {
          flight.value = null
          resolve()
          return
        }
        const to = dropPoint(step.target)
        const eased = easeInOut(progress)
        flight.value = { label: step.label, kind: step.kind, x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased, progress }
        requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
    })
  }

  /** Replaces the strategy with `target`, building it step by step. Resolves when it is all in place. */
  async function play(target: StrategyDocument): Promise<void> {
    const steps = replaySteps(target)
    const wantsStill = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (isRunning.value || wantsStill || !steps.length) {
      editor.replace(target)
      return
    }
    isSkipped = false
    isRunning.value = true
    // The only undo step: the strategy that was there before. The steps after it are not edits.
    editor.replace(replayStart(target))
    for (const step of steps) {
      reveal(step)
      await wait(SETTLE_MS)
      if (isSkipped) break
      await carry(step)
      if (isSkipped) break
      editor.document.value = step.document
    }
    // Ended before the last assignment, so whoever watches the document treats the result as final.
    isRunning.value = false
    editor.document.value = target
  }

  function skip(): void {
    isSkipped = true
  }

  return { isRunning, flight, play, skip }
}
