import type { Directive } from 'vue'

// `v-tip="'Undo'"` gives a button that shows only an icon a tooltip in the page's own style, above it (below
// when there is no room), and the same text as its accessible name. One tooltip element serves every button.
// The first one waits a moment so passing over a toolbar shows nothing; while one is up, the next shows at once.
const SHOW_DELAY_MS = 380
const QUICK_WINDOW_MS = 500
const GAP = 8
const EDGE = 8

let tip: HTMLDivElement | null = null
let owner: HTMLElement | null = null
let showTimer: ReturnType<typeof setTimeout> | undefined
let lastHiddenAt = 0

function tipElement(): HTMLDivElement {
  if (tip) return tip
  tip = document.createElement('div')
  tip.className = 'ui-tip app'
  tip.setAttribute('role', 'tooltip')
  document.body.append(tip)
  return tip
}

function place(element: HTMLElement): void {
  const panel = tipElement()
  const box = element.getBoundingClientRect()
  const width = panel.offsetWidth
  const height = panel.offsetHeight
  const isBelow = box.top - height - GAP < EDGE
  const left = Math.min(Math.max(EDGE, box.left + box.width / 2 - width / 2), window.innerWidth - width - EDGE)
  panel.style.left = `${left}px`
  panel.style.top = `${isBelow ? box.bottom + GAP : box.top - height - GAP}px`
  // It grows out of the button it belongs to.
  panel.style.transformOrigin = `${box.left + box.width / 2 - left}px ${isBelow ? '0' : '100%'}`
}

function show(element: HTMLElement): void {
  clearTimeout(showTimer)
  const reveal = (): void => {
    const panel = tipElement()
    owner = element
    panel.textContent = element.dataset.tip ?? ''
    panel.classList.remove('is-shown')
    place(element)
    requestAnimationFrame(() => panel.classList.add('is-shown'))
  }
  if (Date.now() - lastHiddenAt < QUICK_WINDOW_MS || owner) reveal()
  else showTimer = setTimeout(reveal, SHOW_DELAY_MS)
}

function hide(element: HTMLElement): void {
  clearTimeout(showTimer)
  if (owner !== element) return
  owner = null
  lastHiddenAt = Date.now()
  tip?.classList.remove('is-shown')
}

interface TipListeners {
  enter: () => void
  leave: () => void
}

const listeners = new WeakMap<HTMLElement, TipListeners>()

function setText(element: HTMLElement, text: string): void {
  element.dataset.tip = text
  if (!element.hasAttribute('aria-label') || element.dataset.tipLabel === 'own') {
    element.setAttribute('aria-label', text)
    element.dataset.tipLabel = 'own'
  }
  if (owner === element && tip) tip.textContent = text
}

const tipDirective: Directive<HTMLElement, string> = {
  mounted(element, binding) {
    setText(element, binding.value)
    const handlers: TipListeners = { enter: () => show(element), leave: () => hide(element) }
    listeners.set(element, handlers)
    element.addEventListener('pointerenter', handlers.enter)
    element.addEventListener('focus', handlers.enter)
    element.addEventListener('pointerleave', handlers.leave)
    element.addEventListener('blur', handlers.leave)
    element.addEventListener('pointerdown', handlers.leave)
  },
  updated(element, binding) {
    if (binding.value !== binding.oldValue) setText(element, binding.value)
  },
  beforeUnmount(element) {
    const handlers = listeners.get(element)
    if (handlers) {
      element.removeEventListener('pointerenter', handlers.enter)
      element.removeEventListener('focus', handlers.enter)
      element.removeEventListener('pointerleave', handlers.leave)
      element.removeEventListener('blur', handlers.leave)
      element.removeEventListener('pointerdown', handlers.leave)
    }
    hide(element)
  },
}

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('tip', tipDirective)
})

declare module 'vue' {
  interface GlobalDirectives {
    vTip: Directive<HTMLElement, string>
  }
}
