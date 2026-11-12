// The strategy as the builder edits it: a long side, a short side or both, each with an Entry group and an
// Exit group of condition tiles plus its own stop-loss, take-profit and trailing stop. A group matches "all"
// or "any" of its items, or scores them: true once the weights of its true items reach its threshold. Any
// item may be a nested group. Every edit is a pure function that returns a new document, so undo
// is a list of documents. The document converts both ways to the StrategyDraft the API validates and runs
// (ADR 0001), and reads version 1 strategies as one side (ADR 0003).
import type { Comparison, ExecutionModel, ScorePart, SideDraft, StrategyDraft } from '~/types/api'

export type Operand = Comparison['left']
export type Operator = Comparison['operator']
export type Timeframe = '1d' | '4h' | '1h'
export type Direction = 'long' | 'short'
export type Match = 'all' | 'any' | 'score'
export type RequiredPart = 'instrument' | 'timeframe' | 'entry' | 'exit'
type Condition = NonNullable<SideDraft['entry']>

export interface ConditionItem {
  id: string
  type: 'condition'
  operator: Operator
  left: Operand
  right: Operand
  negated: boolean
  /** What it counts for directly inside a score group; 1 everywhere else. */
  weight: number
}

export interface GroupItem {
  id: string
  type: 'group'
  match: Match
  items: Item[]
  negated: boolean
  /** What the weights of the true items must add up to; only used while the match is "score". */
  threshold: number
  weight: number
}

export type Item = ConditionItem | GroupItem

export interface SideDocument {
  id: string
  direction: Direction
  entry: GroupItem
  exit: GroupItem
  stopLossPct: number | null
  takeProfitPct: number | null
  trailingStopPct: number | null
}

export interface StrategyDocument {
  /** The markets the same rules are tested on, each separately; the first is the main one. */
  instruments: string[]
  timeframe: Timeframe | null
  /** One or two sides, never two facing the same way; the long side comes first. */
  sides: SideDocument[]
  positionSizePct: number
  execution: ExecutionModel
}

export type LimitField = 'stopLossPct' | 'takeProfitPct' | 'trailingStopPct'
export type LimitKind = 'stopLoss' | 'takeProfit' | 'trailingStop'

export const LIMIT_FIELDS: Record<LimitKind, LimitField> = { stopLoss: 'stopLossPct', takeProfit: 'takeProfitPct', trailingStop: 'trailingStopPct' }

/** Problems keyed by item id, "stopLoss:<side id>", "takeProfit:<side id>", "trailingStop:<side id>" and "positionSize". */
export type Problems = Record<string, string>

export const REQUIRED_PARTS: RequiredPart[] = ['instrument', 'timeframe', 'entry', 'exit']

/** The main market and at most nine extra ones, as the API allows. */
export const MAX_INSTRUMENTS = 10

let lastId = 0

function nextId(): string {
  lastId += 1
  return `item-${lastId}`
}

// ---------- Building items ----------

export function newCondition(operator: Operator, left: Operand, right: Operand): ConditionItem {
  return { id: nextId(), type: 'condition', operator, left, right, negated: false, weight: 1 }
}

/** Where a new score starts: two of its conditions, or all of them when there are fewer. */
function startingThreshold(items: Item[]): number {
  return Math.max(1, Math.min(2, items.length))
}

export function newGroup(match: Match, items: Item[] = [], threshold = startingThreshold(items)): GroupItem {
  return { id: nextId(), type: 'group', match, items, negated: false, threshold, weight: 1 }
}

/** A copy with fresh ids all the way down, for a palette tile dropped more than once. */
export function cloneItem(item: Item): Item {
  if (item.type === 'condition') return { ...item, id: nextId() }
  return { ...item, id: nextId(), items: item.items.map(cloneItem) }
}

export function newSide(direction: Direction): SideDocument {
  return { id: nextId(), direction, entry: newGroup('all'), exit: newGroup('any'), stopLossPct: null, takeProfitPct: null, trailingStopPct: null }
}

export function emptyDocument(execution: ExecutionModel): StrategyDocument {
  return { instruments: [], timeframe: null, sides: [newSide('long')], positionSizePct: 100, execution }
}

// ---------- Draft → document ----------

/** A strategy (from a file, a link or the assistant) uses something the builder cannot show. */
export class UnsupportedStrategyError extends Error {}

const OPERAND_KINDS = new Set(['price', 'sma', 'ema', 'rsi', 'macd', 'bollinger', 'highest', 'lowest', 'change', 'relative_volume', 'stochastic', 'constant'])
const OPERATORS = new Set(['gt', 'lt', 'crosses_above', 'crosses_below'])

function itemFromCondition(condition: Condition): Item {
  switch (condition.kind) {
    case 'compare': {
      const known = OPERATORS.has(condition.operator) && OPERAND_KINDS.has(condition.left?.kind) && OPERAND_KINDS.has(condition.right?.kind)
      if (!known) throw new UnsupportedStrategyError('Unknown comparison or indicator')
      return newCondition(condition.operator, condition.left, condition.right)
    }
    case 'not': {
      const inner = itemFromCondition(condition.condition)
      return { ...inner, negated: !inner.negated }
    }
    case 'and':
    case 'or':
      if (!Array.isArray(condition.conditions)) throw new UnsupportedStrategyError('A group without conditions')
      return groupFromConditions(condition.kind === 'and' ? 'all' : 'any', condition.conditions)
    case 'score':
      if (!Array.isArray(condition.parts)) throw new UnsupportedStrategyError('A score without conditions')
      return groupFromParts(condition.threshold, condition.parts)
    default:
      throw new UnsupportedStrategyError('Unknown condition')
  }
}

// A group of the same kind inside a group adds nothing: its conditions join the outer group.
function groupFromConditions(match: Match, conditions: readonly Condition[]): GroupItem {
  const items = conditions.flatMap((condition) => {
    const item = itemFromCondition(condition)
    if (item.type === 'group' && !item.negated && item.match === match) return item.items
    return [item]
  })
  return newGroup(match, items)
}

// A score's parts keep their weights and are never merged: each counts on its own.
function groupFromParts(threshold: number, parts: readonly ScorePart[]): GroupItem {
  const items = parts.map(part => ({ ...itemFromCondition(part.condition), weight: part.weight }))
  return newGroup('score', items, threshold)
}

function rootGroup(condition: Condition | null | undefined, defaultMatch: Match): GroupItem {
  if (!condition) return newGroup(defaultMatch)
  const item = itemFromCondition(condition)
  if (item.type === 'group' && !item.negated) return item
  return newGroup(defaultMatch, [item])
}

/** A version 1 strategy (one entry rule with a direction, one exit) as a version 2 strategy with one side. */
function upgradeDraft(draft: unknown): StrategyDraft {
  const candidate = draft as Record<string, unknown>
  if (candidate.schema_version !== 1) return draft as StrategyDraft
  const entry = candidate.entry as { direction?: Direction, condition: Condition } | null | undefined
  const exit = candidate.exit as SideDraft['exit'] | undefined
  const { entry: _entry, exit: _exit, ...shared } = candidate
  return {
    ...(shared as Omit<StrategyDraft, 'schema_version' | 'sides'>),
    schema_version: 2,
    sides: [{ direction: entry?.direction ?? 'long', entry: entry?.condition ?? null, exit: exit ?? null }],
  }
}

function sideFromDraft(side: SideDraft): SideDocument {
  return {
    id: nextId(),
    direction: side.direction,
    entry: rootGroup(side.entry, 'all'),
    exit: rootGroup(side.exit?.rule, 'any'),
    stopLossPct: side.exit?.stop_loss_pct ?? null,
    takeProfitPct: side.exit?.take_profit_pct ?? null,
    trailingStopPct: side.exit?.trailing_stop_pct ?? null,
  }
}

// Strategies saved before extra markets existed have no extra_instruments at all.
function instrumentsFromDraft(strategy: StrategyDraft): string[] {
  const named = [strategy.instrument, ...(strategy.extra_instruments ?? [])].filter((symbol): symbol is string => typeof symbol === 'string')
  return [...new Set(named)].slice(0, MAX_INSTRUMENTS)
}

/** Reads version 2 strategies, and version 1 strategies as one side. */
export function documentFromDraft(draft: StrategyDraft | unknown): StrategyDocument {
  const strategy = upgradeDraft(draft)
  if (!Array.isArray(strategy.sides) || !strategy.sides.length) throw new UnsupportedStrategyError('A strategy without sides')
  return {
    instruments: instrumentsFromDraft(strategy),
    timeframe: strategy.timeframe,
    sides: strategy.sides.map(sideFromDraft),
    positionSizePct: strategy.position_size_pct,
    execution: strategy.execution,
  }
}

// ---------- Document → draft ----------

function negate(condition: Condition, negated: boolean): Condition {
  return negated ? { kind: 'not', condition } : condition
}

function conditionOf(item: Item): Condition | null {
  if (item.type === 'condition') {
    return negate({ kind: 'compare', operator: item.operator, left: item.left, right: item.right }, item.negated)
  }
  // An empty nested group adds nothing, so it neither counts nor takes its weight along.
  const parts = item.items.flatMap((child) => {
    const condition = conditionOf(child)
    return condition === null ? [] : [{ weight: child.weight, condition }]
  })
  if (!parts.length) return null
  if (parts.length === 1) return negate(parts[0]!.condition, item.negated)
  return negate(combined(item, parts as [ScorePart, ScorePart, ...ScorePart[]]), item.negated)
}

function combined(group: GroupItem, parts: [ScorePart, ScorePart, ...ScorePart[]]): Condition {
  if (group.match === 'score') return { kind: 'score', threshold: group.threshold, parts }
  const [first, second, ...rest] = parts.map(part => part.condition) as [Condition, Condition, ...Condition[]]
  return { kind: group.match === 'all' ? 'and' : 'or', conditions: [first, second, ...rest] }
}

function sideToDraft(side: SideDocument): SideDraft {
  const exitRule = conditionOf(side.exit)
  const hasExit = exitRule !== null || side.stopLossPct !== null || side.takeProfitPct !== null || side.trailingStopPct !== null
  return {
    direction: side.direction,
    entry: conditionOf(side.entry),
    exit: hasExit
      ? { rule: exitRule, stop_loss_pct: side.stopLossPct, take_profit_pct: side.takeProfitPct, trailing_stop_pct: side.trailingStopPct }
      : null,
  }
}

export function documentToDraft(document: StrategyDocument): StrategyDraft {
  return {
    schema_version: 2,
    instrument: document.instruments[0] ?? null,
    extra_instruments: document.instruments.slice(1),
    timeframe: document.timeframe,
    sides: document.sides.map(sideToDraft) as StrategyDraft['sides'],
    position_size_pct: document.positionSizePct,
    execution: document.execution,
  }
}

/** A score whose conditions do not all count the same, so its tiles show what each counts as. */
export function isWeighted(group: GroupItem): boolean {
  return group.match === 'score' && group.items.some(item => item.weight !== 1)
}

export function isSideComplete(side: SideDraft): boolean {
  return side.entry !== null && side.exit !== null
}

/** What stops a backtest, as the API decides it: one complete side is enough. */
export function missingParts(document: StrategyDocument): RequiredPart[] {
  const draft = documentToDraft(document)
  const missing: RequiredPart[] = []
  if (draft.instrument === null) missing.push('instrument')
  if (draft.timeframe === null) missing.push('timeframe')
  if (draft.sides.some(isSideComplete)) return missing
  const withEntry = draft.sides.filter(side => side.entry !== null)
  if (!withEntry.length) missing.push('entry')
  if (!(withEntry.length ? withEntry : draft.sides).some(side => side.exit !== null)) missing.push('exit')
  return missing
}

// ---------- Edits ----------

function mapGroups(group: GroupItem, change: (group: GroupItem) => GroupItem): GroupItem {
  const items = group.items.map(item => (item.type === 'group' ? mapGroups(item, change) : item))
  return change({ ...group, items })
}

function mapDocumentGroups(document: StrategyDocument, change: (group: GroupItem) => GroupItem): StrategyDocument {
  return { ...document, sides: document.sides.map(side => ({ ...side, entry: mapGroups(side.entry, change), exit: mapGroups(side.exit, change) })) }
}

function mapItem(document: StrategyDocument, id: string, change: (item: Item) => Item): StrategyDocument {
  const visit = (item: Item): Item => {
    if (item.id === id) return change(item)
    if (item.type === 'group') return { ...item, items: item.items.map(visit) }
    return item
  }
  return { ...document, sides: document.sides.map(side => ({ ...side, entry: visit(side.entry) as GroupItem, exit: visit(side.exit) as GroupItem })) }
}

export function findItem(document: StrategyDocument, id: string): Item | undefined {
  const search = (item: Item): Item | undefined => {
    if (item.id === id) return item
    if (item.type !== 'group') return undefined
    for (const child of item.items) {
      const found = search(child)
      if (found) return found
    }
    return undefined
  }
  for (const side of document.sides) {
    const found = search(side.entry) ?? search(side.exit)
    if (found) return found
  }
  return undefined
}

export function addItem(document: StrategyDocument, groupId: string, item: Item, index?: number): StrategyDocument {
  return mapDocumentGroups(document, (group) => {
    if (group.id !== groupId) return group
    const items = [...group.items]
    items.splice(index ?? items.length, 0, item)
    return { ...group, items }
  })
}

export function removeItem(document: StrategyDocument, id: string): StrategyDocument {
  return mapDocumentGroups(document, group => ({ ...group, items: group.items.filter(item => item.id !== id) }))
}

export function moveItem(document: StrategyDocument, id: string, groupId: string, index: number): StrategyDocument {
  const item = findItem(document, id)
  if (!item) return document
  return addItem(removeItem(document, id), groupId, item, index)
}

/** A group's items replaced wholesale, as a drag-and-drop list reports them. */
export function setGroupItems(document: StrategyDocument, groupId: string, items: Item[]): StrategyDocument {
  return mapDocumentGroups(document, group => (group.id === groupId ? { ...group, items } : group))
}

/** Switching to "score" starts the threshold afresh, at two of the group's conditions or all of fewer. */
export function setMatch(document: StrategyDocument, groupId: string, match: Match): StrategyDocument {
  return mapItem(document, groupId, (item) => {
    if (item.type !== 'group' || item.match === match) return item
    return match === 'score' ? { ...item, match, threshold: startingThreshold(item.items) } : { ...item, match }
  })
}

export function setThreshold(document: StrategyDocument, groupId: string, threshold: number): StrategyDocument {
  return mapItem(document, groupId, item => (item.type === 'group' ? { ...item, threshold } : item))
}

export function setWeight(document: StrategyDocument, id: string, weight: number): StrategyDocument {
  return mapItem(document, id, item => ({ ...item, weight }))
}

export function toggleNegated(document: StrategyDocument, id: string): StrategyDocument {
  return mapItem(document, id, item => ({ ...item, negated: !item.negated }))
}

export function updateCondition(
  document: StrategyDocument,
  id: string,
  patch: Partial<Pick<ConditionItem, 'operator' | 'left' | 'right'>>,
): StrategyDocument {
  return mapItem(document, id, item => (item.type === 'condition' ? { ...item, ...patch } : item))
}

export function addSide(document: StrategyDocument, direction: Direction): StrategyDocument {
  if (document.sides.some(side => side.direction === direction)) return document
  const sides = [...document.sides, newSide(direction)].sort((a, b) => (a.direction === 'long' ? -1 : 0) - (b.direction === 'long' ? -1 : 0))
  return { ...document, sides }
}

export function removeSide(document: StrategyDocument, sideId: string): StrategyDocument {
  if (document.sides.length < 2) return document
  return { ...document, sides: document.sides.filter(side => side.id !== sideId) }
}

/** The first market also sets how often the rules are checked, when that is not chosen yet. */
export function addInstrument(document: StrategyDocument, symbol: string): StrategyDocument {
  if (document.instruments.includes(symbol) || document.instruments.length >= MAX_INSTRUMENTS) return document
  return { ...document, instruments: [...document.instruments, symbol], timeframe: document.timeframe ?? '4h' }
}

export function removeInstrument(document: StrategyDocument, symbol: string): StrategyDocument {
  if (!document.instruments.includes(symbol)) return document
  return { ...document, instruments: document.instruments.filter(instrument => instrument !== symbol) }
}

export function toggleInstrument(document: StrategyDocument, symbol: string): StrategyDocument {
  return document.instruments.includes(symbol) ? removeInstrument(document, symbol) : addInstrument(document, symbol)
}

export function setSideLimit(document: StrategyDocument, sideId: string, field: LimitField, value: number | null): StrategyDocument {
  return { ...document, sides: document.sides.map(side => (side.id === sideId ? { ...side, [field]: value } : side)) }
}

// ---------- Problems ----------

function operandProblem(operand: Operand): string | null {
  const wholeNumberAtLeast = (value: number, minimum: number) => Number.isInteger(value) && value >= minimum && value <= 1000
  switch (operand.kind) {
    case 'sma':
    case 'ema':
      return wholeNumberAtLeast(operand.period, 1) ? null : 'The period must be a whole number from 1 to 1000'
    case 'rsi':
      return wholeNumberAtLeast(operand.period, 2) ? null : 'The RSI period must be a whole number from 2 to 1000'
    case 'bollinger':
      if (!wholeNumberAtLeast(operand.period, 2)) return 'The Bollinger period must be a whole number from 2 to 1000'
      return operand.std_dev > 0 && operand.std_dev <= 10 ? null : 'The band width must be above 0 and at most 10'
    case 'macd':
      if (![operand.fast, operand.slow, operand.signal].every(value => wholeNumberAtLeast(value, 1))) return 'MACD periods must be whole numbers from 1 to 1000'
      return operand.fast < operand.slow ? null : 'The MACD fast period must be shorter than the slow one'
    case 'highest':
    case 'lowest':
    case 'change':
      return wholeNumberAtLeast(operand.period, 1) ? null : 'The number of candles must be a whole number from 1 to 1000'
    case 'relative_volume':
      return wholeNumberAtLeast(operand.period, 2) ? null : 'The volume average must cover a whole number of candles from 2 to 1000'
    case 'stochastic':
      if (!wholeNumberAtLeast(operand.period, 2)) return 'The stochastic period must be a whole number from 2 to 1000'
      return wholeNumberAtLeast(operand.smooth, 1) ? null : 'The %D smoothing must be a whole number from 1 to 1000'
    case 'constant':
      return Number.isFinite(operand.value) ? null : 'Enter a number'
    case 'price':
      return null
  }
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

function scoreProblem(group: GroupItem): string | null {
  if (group.items.some(item => !(item.weight > 0))) return 'Each condition must count for more than 0'
  if (group.items.some(item => item.weight > 100)) return 'A condition can count for at most 100'
  if (!(group.threshold > 0)) return 'The number to reach must be above 0'
  const total = group.items.reduce((sum, item) => sum + item.weight, 0)
  if (group.threshold > total) return `These conditions add up to ${formatNumber(total)}, so ${formatNumber(group.threshold)} can never be reached`
  return null
}

function collectProblems(item: Item, problems: Problems, isRoot: boolean): void {
  if (item.type === 'condition') {
    const problem = operandProblem(item.left) ?? operandProblem(item.right)
    if (problem) problems[item.id] = problem
    return
  }
  if (!isRoot && !item.items.length) problems[item.id] = 'Add a condition to this group or remove it'
  else if (item.match === 'score' && item.items.length) {
    const problem = scoreProblem(item)
    if (problem) problems[item.id] = problem
  }
  item.items.forEach(child => collectProblems(child, problems, false))
}

export function problemsOf(document: StrategyDocument): Problems {
  const problems: Problems = {}
  for (const side of document.sides) {
    collectProblems(side.entry, problems, true)
    collectProblems(side.exit, problems, true)
    if (side.stopLossPct !== null && !(side.stopLossPct > 0 && side.stopLossPct < 100)) {
      problems[`stopLoss:${side.id}`] = 'The stop-loss must be above 0% and below 100%'
    }
    if (side.takeProfitPct !== null && !(side.takeProfitPct > 0 && side.takeProfitPct <= 1000)) {
      problems[`takeProfit:${side.id}`] = 'The take-profit must be above 0% and at most 1000%'
    }
    if (side.trailingStopPct !== null && !(side.trailingStopPct > 0 && side.trailingStopPct < 100)) {
      problems[`trailingStop:${side.id}`] = 'The trailing stop must be above 0% and below 100%'
    }
  }
  if (!(document.positionSizePct > 0 && document.positionSizePct <= 100)) {
    problems.positionSize = 'The position size must be above 0% and at most 100%'
  }
  return problems
}
