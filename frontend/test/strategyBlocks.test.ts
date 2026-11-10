import { describe, expect, it } from 'vitest'
import type { ExecutionModel, StrategyDraft } from '~/types/api'
import {
  BlockType,
  draftToWorkspace,
  emptyWorkspace,
  UnknownBlockError,
  workspaceToDraft,
  type BlockState,
  type WorkspaceState,
} from '~/utils/strategyBlocks'

const EXECUTION: ExecutionModel = { commission_pct: 0.1, slippage_bps: 5 }
const CLOSE = { kind: 'price', field: 'close' } as const

function draft(overrides: Partial<StrategyDraft> = {}): StrategyDraft {
  return {
    schema_version: 1,
    instrument: 'BTCUSDT',
    timeframe: '1d',
    entry: {
      direction: 'long',
      condition: { kind: 'compare', operator: 'crosses_above', left: CLOSE, right: { kind: 'sma', period: 50 } },
    },
    exit: { rule: null, stop_loss_pct: 5, take_profit_pct: 10 },
    position_size_pct: 100,
    execution: EXECUTION,
    ...overrides,
  }
}

function workspaceWith(rootInputs: BlockState['inputs'], looseBlocks: BlockState[] = []): WorkspaceState {
  return {
    blocks: {
      languageVersion: 0,
      blocks: [{ type: BlockType.root, id: 'root', x: 0, y: 0, inputs: rootInputs }, ...looseBlocks],
    },
  }
}

const smaCrossBlock: BlockState = {
  type: BlockType.compare,
  fields: { OPERATOR: 'crosses_above' },
  inputs: {
    LEFT: { block: { type: BlockType.price, fields: { FIELD: 'close' } } },
    RIGHT: { block: { type: BlockType.sma, fields: { PERIOD: 50 } } },
  },
}

describe('workspace → strategy', () => {
  it('converts a hand-built workspace into the expected strategy', () => {
    const state = workspaceWith({
      INSTRUMENT: { block: { type: BlockType.instrument, fields: { SYMBOL: 'BTCUSDT' } } },
      TIMEFRAME: { block: { type: BlockType.timeframe, fields: { TIMEFRAME: '1d' } } },
      ENTRY: { block: { type: BlockType.entry, fields: { DIRECTION: 'long' }, inputs: { CONDITION: { block: smaCrossBlock } } } },
      EXIT: {
        block: {
          type: BlockType.stopLoss,
          fields: { PCT: 5 },
          next: { block: { type: BlockType.takeProfit, fields: { PCT: 10 } } },
        },
      },
    })

    const { draft: converted, missing } = workspaceToDraft(state, EXECUTION)

    expect(converted).toEqual(draft())
    expect(missing).toEqual([])
  })

  it('reports every missing required part of an empty strategy', () => {
    expect(workspaceToDraft(emptyWorkspace(), EXECUTION).missing).toEqual(['instrument', 'timeframe', 'entry', 'exit'])
  })

  it('treats an entry with an unfinished condition as missing', () => {
    const halfComparison: BlockState = { type: BlockType.compare, fields: { OPERATOR: 'gt' }, inputs: { LEFT: smaCrossBlock.inputs!.LEFT! } }
    const state = workspaceWith({
      ENTRY: { block: { type: BlockType.entry, fields: { DIRECTION: 'long' }, inputs: { CONDITION: { block: halfComparison } } } },
    })

    expect(workspaceToDraft(state, EXECUTION).missing).toContain('entry')
  })

  it('treats an exit rule without a condition as missing exit', () => {
    const state = workspaceWith({ EXIT: { block: { type: BlockType.exitRule } } })

    expect(workspaceToDraft(state, EXECUTION).missing).toContain('exit')
  })

  it('ignores blocks that are not attached to the strategy block', () => {
    const loose: BlockState = { type: BlockType.instrument, fields: { SYMBOL: 'ETHUSDT' } }
    const state = workspaceWith({}, [loose, { type: BlockType.stopLoss, fields: { PCT: 3 } }])

    const { draft: converted, missing } = workspaceToDraft(state, EXECUTION)

    expect(converted.instrument).toBeNull()
    expect(converted.exit).toBeNull()
    expect(missing).toEqual(['instrument', 'timeframe', 'entry', 'exit'])
  })

  it('flattens nested logic blocks of the same kind', () => {
    const compare = (level: number): BlockState => ({
      type: BlockType.compare,
      fields: { OPERATOR: 'gt' },
      inputs: { LEFT: { block: { type: BlockType.price, fields: { FIELD: 'close' } } }, RIGHT: { block: { type: BlockType.constant, fields: { VALUE: level } } } },
    })
    const nested: BlockState = {
      type: BlockType.and,
      inputs: { A: { block: { type: BlockType.and, inputs: { A: { block: compare(1) }, B: { block: compare(2) } } } }, B: { block: compare(3) } },
    }
    const state = workspaceWith({
      ENTRY: { block: { type: BlockType.entry, fields: { DIRECTION: 'long' }, inputs: { CONDITION: { block: nested } } } },
    })

    const condition = workspaceToDraft(state, EXECUTION).draft.entry!.condition

    expect(condition.kind).toBe('and')
    expect(condition.kind === 'and' && condition.conditions.length).toBe(3)
  })

  it('rejects unknown block types', () => {
    const state = workspaceWith({
      ENTRY: { block: { type: BlockType.entry, fields: { DIRECTION: 'long' }, inputs: { CONDITION: { block: { type: 'hack' } } } } },
    })

    expect(() => workspaceToDraft(state, EXECUTION)).toThrow(UnknownBlockError)
  })
})

describe('strategy → workspace → strategy', () => {
  const cases: Record<string, StrategyDraft> = {
    'stop-loss and take-profit': draft(),
    'short with exit rule and position size': draft({
      entry: { direction: 'short', condition: { kind: 'compare', operator: 'lt', left: { kind: 'rsi', period: 14 }, right: { kind: 'constant', value: 70 } } },
      exit: { rule: { kind: 'compare', operator: 'crosses_below', left: CLOSE, right: { kind: 'ema', period: 21 } }, stop_loss_pct: null, take_profit_pct: null },
      position_size_pct: 25,
    }),
    'every operand and logic block': draft({
      timeframe: '4h',
      entry: {
        direction: 'long',
        condition: {
          kind: 'and',
          conditions: [
            { kind: 'compare', operator: 'gt', left: { kind: 'macd', fast: 12, slow: 26, signal: 9, line: 'histogram' }, right: { kind: 'constant', value: 0 } },
            { kind: 'or', conditions: [
              { kind: 'compare', operator: 'lt', left: { kind: 'price', field: 'low' }, right: { kind: 'bollinger', period: 20, std_dev: 2, band: 'lower' } },
              { kind: 'compare', operator: 'gt', left: { kind: 'price', field: 'volume' }, right: { kind: 'constant', value: 1000 } },
            ] },
            { kind: 'not', condition: { kind: 'compare', operator: 'crosses_below', left: { kind: 'ema', period: 9 }, right: { kind: 'sma', period: 30 } } },
          ],
        },
      },
      exit: { rule: { kind: 'compare', operator: 'gt', left: { kind: 'rsi', period: 14 }, right: { kind: 'constant', value: 75 } }, stop_loss_pct: 4, take_profit_pct: 12 },
    }),
    'draft with missing parts': draft({ instrument: null, entry: null }),
  }

  for (const [name, original] of Object.entries(cases)) {
    it(`round-trips unchanged: ${name}`, () => {
      const workspace = draftToWorkspace(original)

      expect(workspaceToDraft(workspace, EXECUTION).draft).toEqual(original)
    })
  }

  it('reports the missing parts of a round-tripped draft', () => {
    const workspace = draftToWorkspace(draft({ instrument: null, exit: null }))

    expect(workspaceToDraft(workspace, EXECUTION).missing).toEqual(['instrument', 'exit'])
  })
})
