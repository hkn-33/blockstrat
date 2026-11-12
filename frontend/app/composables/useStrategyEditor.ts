import type { InjectionKey, Ref } from 'vue'
import type { Problems, StrategyDocument } from '~/utils/strategyDocument'

// The builder's one source of truth: the strategy document, every edit applied through `commit`, and an
// undo history of whole documents. Edits that arrive together (a drag removes from one list and adds to
// another, a number typed digit by digit) fold into one undo step.
const HISTORY_LIMIT = 100
const FOLD_MS = 600

export interface StrategyEditor {
  document: Ref<StrategyDocument>
  problems: Ref<Problems>
  canUndo: Ref<boolean>
  canRedo: Ref<boolean>
  /** A condition just added from the library: its tile opens its value editor once, so it can be tuned at once. */
  focusItem: Ref<string | null>
  commit: (edit: (document: StrategyDocument) => StrategyDocument, foldKey?: string) => void
  replace: (document: StrategyDocument) => void
  undo: () => void
  redo: () => void
}

export const STRATEGY_EDITOR: InjectionKey<StrategyEditor> = Symbol('strategy editor')

export function createStrategyEditor(initial: StrategyDocument): StrategyEditor {
  const document = shallowRef(initial)
  const past = shallowRef<StrategyDocument[]>([])
  const future = shallowRef<StrategyDocument[]>([])
  let lastFoldKey = ''
  let lastCommitAt = 0

  function push(next: StrategyDocument, foldKey: string): void {
    const now = performance.now()
    const folds = foldKey !== '' && foldKey === lastFoldKey && now - lastCommitAt < FOLD_MS
    if (!folds) past.value = [...past.value, document.value].slice(-HISTORY_LIMIT)
    future.value = []
    document.value = next
    lastFoldKey = foldKey
    lastCommitAt = now
  }

  return {
    document,
    problems: computed(() => problemsOf(document.value)),
    canUndo: computed(() => past.value.length > 0),
    canRedo: computed(() => future.value.length > 0),
    focusItem: ref<string | null>(null),
    commit(edit, foldKey = '') {
      const next = edit(document.value)
      if (next !== document.value) push(next, foldKey)
    },
    replace(next) {
      push(next, '')
    },
    undo() {
      const previous = past.value.at(-1)
      if (!previous) return
      past.value = past.value.slice(0, -1)
      future.value = [document.value, ...future.value]
      document.value = previous
      lastFoldKey = ''
    },
    redo() {
      const next = future.value[0]
      if (!next) return
      future.value = future.value.slice(1)
      past.value = [...past.value, document.value]
      document.value = next
      lastFoldKey = ''
    },
  }
}

export function useStrategyEditor(): StrategyEditor {
  const editor = inject(STRATEGY_EDITOR)
  if (!editor) throw new Error('useStrategyEditor must be used inside the builder')
  return editor
}
