// A finished strategy (from the assistant, a template or the example) replayed as the steps a person would
// take to build it by hand: each market, then each side's conditions and limits, one at a time. Every step
// is a whole document, so the builder shows the strategy growing and the backtest never sees a half-edit.
import { baseCoin } from './coins'
import type { GroupItem, Item, LimitField, SideDocument, StrategyDocument } from './strategyDocument'
import { operandLabel, operatorLabel } from './strategyText'

export interface ReplayStep {
  /** The strategy once this step has landed. */
  document: StrategyDocument
  /** What is carried across the screen, worded like its tile. */
  label: string
  kind: 'market' | 'entry' | 'exit'
  /** Where the block is picked up in the library: "market:<symbol>" or "conditions". */
  source: string
  /** Where it is dropped: "market" or the id of the group it joins. */
  target: string
}

const LIMITS: { field: LimitField, label: (percent: number) => string }[] = [
  { field: 'stopLossPct', label: percent => `Stop-loss at −${percent}%` },
  { field: 'takeProfitPct', label: percent => `Take-profit at +${percent}%` },
  { field: 'trailingStopPct', label: percent => `Trailing stop ${percent}% behind` },
]

function itemLabel(item: Item): string {
  if (item.type === 'condition') return `${operandLabel(item.left)} ${operatorLabel(item.operator, item.negated)} ${operandLabel(item.right)}`
  if (item.match !== 'score') return `${item.match === 'all' ? 'All' : 'Any'} of ${item.items.length} conditions`
  return `At least ${item.threshold} of ${item.items.length} conditions`
}

function emptied(group: GroupItem): GroupItem {
  return { ...group, items: [] }
}

/** The strategy with its settings and sides kept but nothing chosen yet: where the replay starts. */
export function replayStart(target: StrategyDocument): StrategyDocument {
  return {
    ...target,
    instruments: [],
    timeframe: null,
    sides: target.sides.map(side => ({ ...side, entry: emptied(side.entry), exit: emptied(side.exit), stopLossPct: null, takeProfitPct: null, trailingStopPct: null })),
  }
}

function withSide(document: StrategyDocument, sideId: string, change: (side: SideDocument) => SideDocument): StrategyDocument {
  return { ...document, sides: document.sides.map(side => (side.id === sideId ? change(side) : side)) }
}

/** The steps from `replayStart(target)` to `target`, in the order the guide asks for them. */
export function replaySteps(target: StrategyDocument): ReplayStep[] {
  const steps: ReplayStep[] = []
  let current = replayStart(target)
  const land = (document: StrategyDocument, step: Omit<ReplayStep, 'document'>): void => {
    current = document
    steps.push({ ...step, document })
  }

  for (const symbol of target.instruments) {
    land(
      { ...current, instruments: [...current.instruments, symbol], timeframe: target.timeframe },
      { label: `${baseCoin(symbol)}/USDT`, kind: 'market', source: `market:${symbol}`, target: 'market' },
    )
  }

  for (const side of target.sides) {
    for (const part of ['entry', 'exit'] as const) {
      for (const item of side[part].items) {
        land(
          withSide(current, side.id, building => ({ ...building, [part]: { ...building[part], items: [...building[part].items, item] } })),
          { label: itemLabel(item), kind: part, source: 'conditions', target: side[part].id },
        )
      }
    }
    for (const limit of LIMITS) {
      const percent = side[limit.field]
      if (percent === null) continue
      land(
        withSide(current, side.id, building => ({ ...building, [limit.field]: percent })),
        { label: limit.label(percent), kind: 'exit', source: 'conditions', target: side.exit.id },
      )
    }
  }
  return steps
}
