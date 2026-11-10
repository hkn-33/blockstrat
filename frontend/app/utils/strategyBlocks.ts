// Converts between Blockly's serialized workspace state and the strategy JSON (ADR 0001).
// Pure functions on plain objects, so they run and are tested without Blockly or a DOM.
import type {
  Comparison,
  ExecutionModel,
  Exit,
  PriceOperand,
  StrategyDraft,
} from '~/types/api'

export type Condition = NonNullable<StrategyDraft['entry']>['condition']
export type Operand = Comparison['left']
export type RequiredPart = 'instrument' | 'timeframe' | 'entry' | 'exit'
export const REQUIRED_PARTS: RequiredPart[] = ['instrument', 'timeframe', 'entry', 'exit']
export const DEFAULT_POSITION_SIZE_PCT = 100

export interface BlockState {
  type: string
  id?: string
  x?: number
  y?: number
  deletable?: boolean
  fields?: Record<string, string | number>
  inputs?: Record<string, { block?: BlockState }>
  next?: { block?: BlockState }
}

export interface WorkspaceState {
  blocks?: { languageVersion: number, blocks: BlockState[] }
  [other: string]: unknown
}

export const BlockType = {
  root: 'strategy_root',
  instrument: 'strategy_instrument',
  timeframe: 'strategy_timeframe',
  entry: 'strategy_entry',
  exitRule: 'exit_rule',
  stopLoss: 'exit_stop_loss',
  takeProfit: 'exit_take_profit',
  positionSize: 'setting_position_size',
  compare: 'condition_compare',
  and: 'condition_and',
  or: 'condition_or',
  not: 'condition_not',
  price: 'operand_price',
  sma: 'operand_sma',
  ema: 'operand_ema',
  rsi: 'operand_rsi',
  macd: 'operand_macd',
  bollinger: 'operand_bollinger',
  constant: 'operand_constant',
} as const

export class UnknownBlockError extends Error {}

// ---------- Blocks → strategy ----------

export interface ConvertedWorkspace {
  draft: StrategyDraft
  missing: RequiredPart[]
}

export function workspaceToDraft(state: WorkspaceState, execution: ExecutionModel): ConvertedWorkspace {
  const root = state.blocks?.blocks.find(block => block.type === BlockType.root)
  const draft: StrategyDraft = {
    schema_version: 1,
    instrument: stringField(child(root, 'INSTRUMENT'), 'SYMBOL'),
    timeframe: (stringField(child(root, 'TIMEFRAME'), 'TIMEFRAME') as StrategyDraft['timeframe']),
    entry: blockToEntry(child(root, 'ENTRY')),
    exit: blockToExit(child(root, 'EXIT')),
    position_size_pct: positionSize(child(root, 'SETTINGS')),
    execution,
  }
  return { draft, missing: missingParts(draft) }
}

export function missingParts(draft: StrategyDraft): RequiredPart[] {
  const missing: RequiredPart[] = []
  if (!draft.instrument) missing.push('instrument')
  if (!draft.timeframe) missing.push('timeframe')
  if (!draft.entry) missing.push('entry')
  if (!draft.exit) missing.push('exit')
  return missing
}

function child(block: BlockState | undefined, input: string): BlockState | undefined {
  return block?.inputs?.[input]?.block
}

function stringField(block: BlockState | undefined, field: string): string | null {
  const value = block?.fields?.[field]
  return value === undefined ? null : String(value)
}

function numberField(block: BlockState, field: string): number {
  return Number(block.fields?.[field])
}

function chain(first: BlockState | undefined): BlockState[] {
  const blocks: BlockState[] = []
  let current = first
  while (current) {
    blocks.push(current)
    current = current.next?.block
  }
  return blocks
}

function blockToEntry(block: BlockState | undefined): StrategyDraft['entry'] {
  if (!block) return null
  const condition = blockToCondition(child(block, 'CONDITION'))
  if (!condition) return null
  const direction = block.fields?.DIRECTION === 'short' ? 'short' : 'long'
  return { direction, condition }
}

function blockToExit(first: BlockState | undefined): StrategyDraft['exit'] {
  const exit: Exit = { rule: null, stop_loss_pct: null, take_profit_pct: null }
  for (const block of chain(first)) {
    if (block.type === BlockType.exitRule && !exit.rule) {
      exit.rule = blockToCondition(child(block, 'CONDITION'))
    }
    else if (block.type === BlockType.stopLoss) {
      exit.stop_loss_pct = numberField(block, 'PCT')
    }
    else if (block.type === BlockType.takeProfit) {
      exit.take_profit_pct = numberField(block, 'PCT')
    }
  }
  const isEmpty = !exit.rule && exit.stop_loss_pct === null && exit.take_profit_pct === null
  return isEmpty ? null : exit
}

function positionSize(first: BlockState | undefined): number {
  const block = chain(first).find(setting => setting.type === BlockType.positionSize)
  return block ? numberField(block, 'PCT') : DEFAULT_POSITION_SIZE_PCT
}

/** Null while the condition still has empty sockets. */
function blockToCondition(block: BlockState | undefined): Condition | null {
  if (!block) return null
  switch (block.type) {
    case BlockType.compare: {
      const left = blockToOperand(child(block, 'LEFT'))
      const right = blockToOperand(child(block, 'RIGHT'))
      if (!left || !right) return null
      return { kind: 'compare', operator: block.fields?.OPERATOR as Comparison['operator'], left, right }
    }
    case BlockType.and:
    case BlockType.or: {
      const kind = block.type === BlockType.and ? 'and' : 'or'
      const parts = [blockToCondition(child(block, 'A')), blockToCondition(child(block, 'B'))]
      if (parts.some(part => part === null)) return null
      // Nested blocks of the same kind flatten into one list: and(and(a, b), c) is and(a, b, c).
      const conditions = (parts as Condition[]).flatMap(part => part.kind === kind ? part.conditions : [part])
      return { kind, conditions } as Condition
    }
    case BlockType.not: {
      const condition = blockToCondition(child(block, 'CONDITION'))
      return condition ? { kind: 'not', condition } : null
    }
    default:
      throw new UnknownBlockError(`Not a condition block: ${block.type}`)
  }
}

function blockToOperand(block: BlockState | undefined): Operand | null {
  if (!block) return null
  switch (block.type) {
    case BlockType.price:
      return { kind: 'price', field: block.fields?.FIELD as PriceOperand['field'] }
    case BlockType.sma:
      return { kind: 'sma', period: numberField(block, 'PERIOD') }
    case BlockType.ema:
      return { kind: 'ema', period: numberField(block, 'PERIOD') }
    case BlockType.rsi:
      return { kind: 'rsi', period: numberField(block, 'PERIOD') }
    case BlockType.macd:
      return {
        kind: 'macd',
        fast: numberField(block, 'FAST'),
        slow: numberField(block, 'SLOW'),
        signal: numberField(block, 'SIGNAL'),
        line: block.fields?.LINE as 'macd' | 'signal' | 'histogram',
      }
    case BlockType.bollinger:
      return {
        kind: 'bollinger',
        period: numberField(block, 'PERIOD'),
        std_dev: numberField(block, 'STD_DEV'),
        band: block.fields?.BAND as 'upper' | 'middle' | 'lower',
      }
    case BlockType.constant:
      return { kind: 'constant', value: numberField(block, 'VALUE') }
    default:
      throw new UnknownBlockError(`Not an operand block: ${block.type}`)
  }
}

// ---------- Strategy → blocks ----------

export function draftToWorkspace(draft: StrategyDraft): WorkspaceState {
  const inputs: Record<string, { block?: BlockState }> = {}
  if (draft.instrument) inputs.INSTRUMENT = { block: { type: BlockType.instrument, fields: { SYMBOL: draft.instrument } } }
  if (draft.timeframe) inputs.TIMEFRAME = { block: { type: BlockType.timeframe, fields: { TIMEFRAME: draft.timeframe } } }
  if (draft.entry) {
    inputs.ENTRY = {
      block: {
        type: BlockType.entry,
        fields: { DIRECTION: draft.entry.direction },
        inputs: { CONDITION: { block: conditionToBlock(draft.entry.condition) } },
      },
    }
  }
  const exitBlocks = exitToBlocks(draft.exit)
  if (exitBlocks.length) inputs.EXIT = { block: linked(exitBlocks) }
  if (draft.position_size_pct !== DEFAULT_POSITION_SIZE_PCT) {
    inputs.SETTINGS = { block: { type: BlockType.positionSize, fields: { PCT: draft.position_size_pct } } }
  }

  return { blocks: { languageVersion: 0, blocks: [rootBlock(inputs)] } }
}

export function emptyWorkspace(): WorkspaceState {
  return { blocks: { languageVersion: 0, blocks: [rootBlock({})] } }
}

function rootBlock(inputs: Record<string, { block?: BlockState }>): BlockState {
  return { type: BlockType.root, x: 40, y: 40, deletable: false, inputs }
}

function linked(blocks: BlockState[]): BlockState {
  for (let index = 0; index < blocks.length - 1; index++) {
    blocks[index]!.next = { block: blocks[index + 1] }
  }
  return blocks[0]!
}

function exitToBlocks(exit: StrategyDraft['exit']): BlockState[] {
  if (!exit) return []
  const blocks: BlockState[] = []
  if (exit.rule) blocks.push({ type: BlockType.exitRule, inputs: { CONDITION: { block: conditionToBlock(exit.rule) } } })
  if (exit.stop_loss_pct != null) blocks.push({ type: BlockType.stopLoss, fields: { PCT: exit.stop_loss_pct } })
  if (exit.take_profit_pct != null) blocks.push({ type: BlockType.takeProfit, fields: { PCT: exit.take_profit_pct } })
  return blocks
}

function conditionToBlock(condition: Condition): BlockState {
  switch (condition.kind) {
    case 'compare':
      return {
        type: BlockType.compare,
        fields: { OPERATOR: condition.operator },
        inputs: { LEFT: { block: operandToBlock(condition.left) }, RIGHT: { block: operandToBlock(condition.right) } },
      }
    case 'and':
    case 'or':
      return logicChain(condition.kind, condition.conditions)
    case 'not':
      return { type: BlockType.not, inputs: { CONDITION: { block: conditionToBlock(condition.condition) } } }
    default:
      throw new UnknownBlockError(`Unknown condition: ${(condition as { kind: string }).kind}`)
  }
}

/** Logic blocks have two sockets; longer lists become a right-nested chain. */
function logicChain(kind: 'and' | 'or', conditions: Condition[]): BlockState {
  const [first, ...rest] = conditions
  const second = rest.length === 1 ? conditionToBlock(rest[0]!) : logicChain(kind, rest)
  return {
    type: kind === 'and' ? BlockType.and : BlockType.or,
    inputs: { A: { block: conditionToBlock(first!) }, B: { block: second } },
  }
}

function operandToBlock(operand: Operand): BlockState {
  switch (operand.kind) {
    case 'price':
      return { type: BlockType.price, fields: { FIELD: operand.field } }
    case 'sma':
      return { type: BlockType.sma, fields: { PERIOD: operand.period } }
    case 'ema':
      return { type: BlockType.ema, fields: { PERIOD: operand.period } }
    case 'rsi':
      return { type: BlockType.rsi, fields: { PERIOD: operand.period } }
    case 'macd':
      return {
        type: BlockType.macd,
        fields: { FAST: operand.fast, SLOW: operand.slow, SIGNAL: operand.signal, LINE: operand.line },
      }
    case 'bollinger':
      return { type: BlockType.bollinger, fields: { PERIOD: operand.period, STD_DEV: operand.std_dev, BAND: operand.band } }
    case 'constant':
      return { type: BlockType.constant, fields: { VALUE: operand.value } }
    default:
      throw new UnknownBlockError(`Unknown operand: ${(operand as { kind: string }).kind}`)
  }
}
