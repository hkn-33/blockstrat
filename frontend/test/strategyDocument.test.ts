import { describe, expect, it } from 'vitest'
import type { Comparison, ExecutionModel, SideDraft, StrategyDraft } from '~/types/api'
import {
  addInstrument,
  addItem,
  addSide,
  documentFromDraft,
  documentToDraft,
  emptyDocument,
  findItem,
  missingParts,
  moveItem,
  newCondition,
  newGroup,
  problemsOf,
  removeInstrument,
  removeItem,
  removeSide,
  setGroupItems,
  setMatch,
  setSideLimit,
  setThreshold,
  setWeight,
  toggleInstrument,
  toggleNegated,
  updateCondition,
  type ConditionItem,
  type GroupItem,
  type StrategyDocument,
} from '~/utils/strategyDocument'
import { STRATEGY_TEMPLATES } from '~/utils/strategyTemplates'

const EXECUTION: ExecutionModel = { commission_pct: 0.1, slippage_bps: 5 }
const CLOSE = { kind: 'price', field: 'close' } as const
const RSI = { kind: 'rsi', period: 14 } as const
const EMA20 = { kind: 'ema', period: 20 } as const
const SMA50 = { kind: 'sma', period: 50 } as const

function compare(operator: Comparison['operator'], left: Comparison['left'], right: Comparison['right']): Comparison {
  return { kind: 'compare', operator, left, right }
}

const LONG: SideDraft = {
  direction: 'long',
  entry: compare('crosses_above', EMA20, SMA50),
  exit: { rule: compare('crosses_below', EMA20, SMA50), stop_loss_pct: 8, take_profit_pct: null, trailing_stop_pct: null },
}

const SHORT: SideDraft = {
  direction: 'short',
  entry: compare('crosses_below', EMA20, SMA50),
  exit: { rule: null, stop_loss_pct: 4, take_profit_pct: 10, trailing_stop_pct: null },
}

function draft(overrides: Partial<StrategyDraft> = {}): StrategyDraft {
  return {
    schema_version: 2,
    instrument: 'BTCUSDT',
    extra_instruments: [],
    timeframe: '1d',
    sides: [LONG],
    position_size_pct: 100,
    execution: EXECUTION,
    ...overrides,
  }
}

const RSI_BELOW_30 = compare('lt', RSI, { kind: 'constant', value: 30 })
const CLOSE_ABOVE_SMA = compare('gt', CLOSE, SMA50)
const MACD_RISING = compare('gt', { kind: 'macd', fast: 12, slow: 26, signal: 9, line: 'histogram' }, { kind: 'constant', value: 0 })

type Rule = NonNullable<SideDraft['entry']>

function score(threshold: number, ...parts: [number, Rule][]): Rule {
  const [first, second, ...rest] = parts.map(([weight, condition]) => ({ weight, condition }))
  return { kind: 'score', threshold, parts: [first!, second!, ...rest] }
}

function withSide(side: SideDraft): StrategyDraft {
  return draft({ sides: [side] })
}

function roundTrip(strategy: StrategyDraft): StrategyDraft {
  return documentToDraft(documentFromDraft(strategy))
}

function long(document: StrategyDocument) {
  return document.sides[0]!
}

function withSecondEntryCondition(): StrategyDocument {
  const document = documentFromDraft(draft())
  return addItem(document, long(document).entry.id, newCondition('lt', RSI, { kind: 'constant', value: 70 }))
}

describe('strategy ↔ document', () => {
  it.each<[string, StrategyDraft]>([
    ['the example strategy', draft()],
    ['a short-only strategy', withSide(SHORT)],
    ['a strategy with both sides', draft({ sides: [LONG, SHORT] })],
    ['an exit with only a take-profit', withSide({ ...LONG, exit: { rule: null, stop_loss_pct: null, take_profit_pct: 15, trailing_stop_pct: null } })],
    ['all of two conditions', withSide({ ...LONG, entry: { kind: 'and', conditions: [compare('crosses_above', EMA20, SMA50), compare('lt', RSI, { kind: 'constant', value: 70 })] } })],
    ['any inside all, with a negation', withSide({
      ...LONG,
      entry: {
        kind: 'and',
        conditions: [
          { kind: 'or', conditions: [compare('lt', RSI, { kind: 'constant', value: 30 }), compare('lt', CLOSE, { kind: 'bollinger', period: 20, std_dev: 2, band: 'lower' })] },
          { kind: 'not', condition: compare('gt', CLOSE, { kind: 'sma', period: 200 }) },
        ],
      },
    })],
    ['a negated group', withSide({ ...LONG, entry: { kind: 'not', condition: { kind: 'or', conditions: [compare('gt', CLOSE, SMA50), compare('gt', CLOSE, EMA20)] } } })],
    ['every indicator kind', withSide({
      ...LONG,
      entry: {
        kind: 'or',
        conditions: [
          compare('crosses_above', { kind: 'macd', fast: 12, slow: 26, signal: 9, line: 'macd' }, { kind: 'macd', fast: 12, slow: 26, signal: 9, line: 'signal' }),
          compare('gt', { kind: 'price', field: 'volume' }, { kind: 'constant', value: 1000 }),
          compare('lt', { kind: 'price', field: 'low' }, { kind: 'bollinger', period: 20, std_dev: 2.5, band: 'lower' }),
        ],
      },
    })],
    ['a trailing stop', withSide({ ...LONG, exit: { rule: null, stop_loss_pct: null, take_profit_pct: null, trailing_stop_pct: 10 } })],
    ['a trailing stop beside a stop-loss on a short side', withSide({ ...SHORT, exit: { rule: null, stop_loss_pct: 4, take_profit_pct: null, trailing_stop_pct: 6 } })],
    ['two of three conditions', withSide({ ...LONG, entry: score(2, [1, RSI_BELOW_30], [1, CLOSE_ABOVE_SMA], [1, MACD_RISING]) })],
    ['weighted conditions', withSide({ ...LONG, entry: score(3, [2, RSI_BELOW_30], [1, CLOSE_ABOVE_SMA], [0.5, MACD_RISING]) })],
    ['a score inside all', withSide({ ...LONG, entry: { kind: 'and', conditions: [CLOSE_ABOVE_SMA, score(1, [1, RSI_BELOW_30], [1, MACD_RISING])] } })],
    ['a score holding groups and a negation', withSide({
      ...LONG,
      entry: score(2, [1, { kind: 'or', conditions: [RSI_BELOW_30, MACD_RISING] }], [2, { kind: 'not', condition: CLOSE_ABOVE_SMA }], [1, { kind: 'and', conditions: [RSI_BELOW_30, CLOSE_ABOVE_SMA] }]),
    })],
    ['a score inside a score', withSide({ ...LONG, entry: score(2, [1, score(1, [1, RSI_BELOW_30], [1, MACD_RISING])], [1, CLOSE_ABOVE_SMA]) })],
    ['a negated score', withSide({ ...LONG, entry: { kind: 'not', condition: score(2, [1, RSI_BELOW_30], [1, CLOSE_ABOVE_SMA], [1, MACD_RISING]) } })],
    ['the newer indicators', withSide({
      ...LONG,
      entry: {
        kind: 'or',
        conditions: [
          compare('crosses_above', CLOSE, { kind: 'highest', period: 20 }),
          compare('crosses_below', CLOSE, { kind: 'lowest', period: 10 }),
          compare('lt', { kind: 'change', period: 7 }, { kind: 'constant', value: -10 }),
          compare('gt', { kind: 'relative_volume', period: 20 }, { kind: 'constant', value: 1.5 }),
          compare('crosses_above', { kind: 'stochastic', period: 14, smooth: 3, line: 'k' }, { kind: 'stochastic', period: 14, smooth: 3, line: 'd' }),
        ],
      },
    })],
    ['an unfinished second side', draft({ sides: [LONG, { direction: 'short', entry: compare('lt', RSI, { kind: 'constant', value: 70 }), exit: null }] })],
    ['a strategy tested on three markets', draft({ extra_instruments: ['ETHUSDT', 'SOLUSDT'] })],
  ])('keeps %s unchanged', (_, strategy) => {
    expect(roundTrip(strategy)).toEqual(strategy)
  })

  it('upgrades a version 1 strategy to one side', () => {
    const version1 = {
      schema_version: 1,
      instrument: 'ETHUSDT',
      timeframe: '4h',
      entry: { direction: 'short', condition: compare('lt', RSI, { kind: 'constant', value: 30 }) },
      exit: { rule: null, stop_loss_pct: 3, take_profit_pct: 9 },
      position_size_pct: 50,
      execution: EXECUTION,
    }

    expect(documentToDraft(documentFromDraft(version1))).toEqual({
      schema_version: 2,
      instrument: 'ETHUSDT',
      extra_instruments: [],
      timeframe: '4h',
      sides: [{ direction: 'short', entry: version1.entry.condition, exit: { ...version1.exit, trailing_stop_pct: null } }],
      position_size_pct: 50,
      execution: EXECUTION,
    })
  })

  it('reads a strategy saved before extra markets as one market', () => {
    const { extra_instruments: _extra, ...older } = draft()

    expect(documentFromDraft(older).instruments).toEqual(['BTCUSDT'])
    expect(documentToDraft(documentFromDraft(older))).toEqual(draft())
  })

  it('reads the markets without gaps or repeats', () => {
    const messy = draft({ instrument: null, extra_instruments: ['ETHUSDT', 'SOLUSDT', 'ETHUSDT'] })

    expect(documentFromDraft(messy).instruments).toEqual(['ETHUSDT', 'SOLUSDT'])
    expect(documentToDraft(documentFromDraft(messy))).toMatchObject({ instrument: 'ETHUSDT', extra_instruments: ['SOLUSDT'] })
  })

  it('flattens nested groups of the same kind', () => {
    const nested = withSide({
      ...LONG,
      entry: {
        kind: 'and',
        conditions: [
          { kind: 'and', conditions: [compare('gt', CLOSE, SMA50), compare('gt', CLOSE, EMA20)] },
          compare('lt', RSI, { kind: 'constant', value: 70 }),
        ],
      },
    })
    const entry = roundTrip(nested).sides[0]!.entry!

    expect(entry.kind === 'and' && entry.conditions.length).toBe(3)
  })

  it('opens every template and sends it back unchanged', () => {
    for (const template of STRATEGY_TEMPLATES) {
      expect(roundTrip(template.strategy), template.name).toEqual(template.strategy)
    }
  })

  it('reads a score as a group of weighted items, never merged into its parent', () => {
    const document = documentFromDraft(withSide({ ...LONG, entry: { kind: 'and', conditions: [CLOSE_ABOVE_SMA, score(2, [2, RSI_BELOW_30], [1, MACD_RISING])] } }))
    const scoreGroup = long(document).entry.items[1] as GroupItem

    expect(scoreGroup).toMatchObject({ type: 'group', match: 'score', threshold: 2 })
    expect(scoreGroup.items.map(item => item.weight)).toEqual([2, 1])
  })

  it('sends a score group of one condition as that condition alone', () => {
    const document = documentFromDraft(draft())
    const scored = setMatch(document, long(document).entry.id, 'score')

    expect(documentToDraft(scored).sides[0]!.entry).toEqual(LONG.entry)
  })

  it('counts a trailing stop alone as a way out', () => {
    const document = documentFromDraft(withSide({ ...LONG, exit: null }))
    const trailed = setSideLimit(document, long(document).id, 'trailingStopPct', 10)

    expect(missingParts(trailed)).toEqual([])
    expect(documentToDraft(trailed).sides[0]!.exit).toEqual({ rule: null, stop_loss_pct: null, take_profit_pct: null, trailing_stop_pct: 10 })
  })

  it('sends a group of one condition as that condition alone', () => {
    const document = documentFromDraft(draft())
    expect(long(document).entry.items).toHaveLength(1)
    expect(documentToDraft(document).sides[0]!.entry!.kind).toBe('compare')
  })
})

describe('sides', () => {
  it('adds a short side next to the long one, and removes it', () => {
    const document = documentFromDraft(draft())
    const twoSided = addSide(document, 'short')

    expect(twoSided.sides.map(side => side.direction)).toEqual(['long', 'short'])
    expect(documentToDraft(removeSide(twoSided, twoSided.sides[1]!.id))).toEqual(draft())
  })

  it('never adds a second side facing the same way', () => {
    const document = documentFromDraft(draft())
    expect(addSide(document, 'long')).toBe(document)
  })

  it('sets one side\'s stop-loss without touching the other', () => {
    const document = documentFromDraft(draft({ sides: [LONG, SHORT] }))
    const changed = setSideLimit(document, document.sides[1]!.id, 'stopLossPct', 6)

    expect(changed.sides[1]!.stopLossPct).toBe(6)
    expect(changed.sides[0]!.stopLossPct).toBe(8)
  })
})

describe('markets', () => {
  const TEN_MARKETS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'LINKUSDT', 'LTCUSDT', 'AVAXUSDT']

  it('adds the first market and starts checking every 4 hours', () => {
    const document = addInstrument(emptyDocument(EXECUTION), 'BTCUSDT')

    expect(document.instruments).toEqual(['BTCUSDT'])
    expect(document.timeframe).toBe('4h')
  })

  it('adds further markets after the first and keeps the chosen pace', () => {
    const document = addInstrument(documentFromDraft(draft()), 'ETHUSDT')

    expect(document.instruments).toEqual(['BTCUSDT', 'ETHUSDT'])
    expect(documentToDraft(document)).toMatchObject({ instrument: 'BTCUSDT', extra_instruments: ['ETHUSDT'], timeframe: '1d' })
  })

  it('never adds a market twice', () => {
    const document = documentFromDraft(draft())
    expect(addInstrument(document, 'BTCUSDT')).toBe(document)
  })

  it('stops at ten markets', () => {
    const full = TEN_MARKETS.reduce(addInstrument, emptyDocument(EXECUTION))

    expect(full.instruments).toHaveLength(10)
    expect(addInstrument(full, 'DOTUSDT')).toBe(full)
  })

  it('removes a market, and the next one becomes the main market', () => {
    const document = documentFromDraft(draft({ extra_instruments: ['ETHUSDT', 'SOLUSDT'] }))
    const removed = removeInstrument(document, 'BTCUSDT')

    expect(documentToDraft(removed)).toMatchObject({ instrument: 'ETHUSDT', extra_instruments: ['SOLUSDT'] })
    expect(missingParts(removeInstrument(documentFromDraft(draft()), 'BTCUSDT'))).toEqual(['instrument'])
  })

  it('toggles a market in and out', () => {
    const document = documentFromDraft(draft())
    const toggledIn = toggleInstrument(document, 'SOLUSDT')

    expect(toggledIn.instruments).toEqual(['BTCUSDT', 'SOLUSDT'])
    expect(toggleInstrument(toggledIn, 'SOLUSDT').instruments).toEqual(['BTCUSDT'])
  })
})

describe('missing parts', () => {
  it('lists every part of an empty document', () => {
    expect(missingParts(emptyDocument(EXECUTION))).toEqual(['instrument', 'timeframe', 'entry', 'exit'])
  })

  it('treats an empty entry group as a missing entry', () => {
    const document = documentFromDraft(draft())
    const emptied = removeItem(document, long(document).entry.items[0]!.id)

    expect(documentToDraft(emptied).sides[0]!.entry).toBeNull()
    expect(missingParts(emptied)).toEqual(['entry'])
  })

  it('treats an exit with no rule, stop-loss or take-profit as missing', () => {
    const document = documentFromDraft(withSide({ ...LONG, exit: { rule: compare('lt', RSI, { kind: 'constant', value: 30 }), stop_loss_pct: null, take_profit_pct: null, trailing_stop_pct: null } }))
    const emptied = removeItem(document, long(document).exit.items[0]!.id)

    expect(documentToDraft(emptied).sides[0]!.exit).toBeNull()
    expect(missingParts(emptied)).toEqual(['exit'])
  })

  it('is complete with one complete side even if the other is unfinished', () => {
    const document = addSide(documentFromDraft(draft()), 'short')
    expect(missingParts(document)).toEqual([])
  })
})

describe('edits', () => {
  it('adds a condition to a group at the end', () => {
    const document = documentFromDraft(draft())
    const added = withSecondEntryCondition()

    expect(long(added).entry.items).toHaveLength(2)
    expect(documentToDraft(added).sides[0]!.entry!.kind).toBe('and')
    expect(long(document).entry.items).toHaveLength(1)
  })

  it('adds a nested group and fills it', () => {
    const document = documentFromDraft(draft())
    const group = newGroup('any')
    const withGroup = addItem(document, long(document).entry.id, group)
    const filled = addItem(addItem(withGroup, group.id, newCondition('lt', RSI, { kind: 'constant', value: 30 })), group.id, newCondition('gt', CLOSE, SMA50))

    const entry = documentToDraft(filled).sides[0]!.entry!
    expect(entry.kind === 'and' && entry.conditions[1]!.kind).toBe('or')
  })

  it('moves a condition from the entry to the exit group', () => {
    const document = documentFromDraft(draft())
    const moving = long(document).entry.items[0]!.id
    const moved = moveItem(document, moving, long(document).exit.id, 0)

    expect(long(moved).entry.items).toHaveLength(0)
    expect(long(moved).exit.items[0]!.id).toBe(moving)
  })

  it('replaces a group\'s items in a new order, as a drag does', () => {
    const document = withSecondEntryCondition()
    const reversed = [...long(document).entry.items].reverse()
    const reordered = setGroupItems(document, long(document).entry.id, reversed)

    expect(long(reordered).entry.items.map(item => item.id)).toEqual(reversed.map(item => item.id))
  })

  it('switches a group between all and any', () => {
    const document = withSecondEntryCondition()
    const switched = setMatch(document, long(document).entry.id, 'any')

    expect(documentToDraft(switched).sides[0]!.entry!.kind).toBe('or')
  })

  it('starts a score at two, or at the number of conditions when there are fewer', () => {
    const two = withSecondEntryCondition()
    const one = documentFromDraft(draft())

    expect(long(setMatch(two, long(two).entry.id, 'score')).entry.threshold).toBe(2)
    expect(long(setMatch(one, long(one).entry.id, 'score')).entry.threshold).toBe(1)
  })

  it('sets a score\'s threshold and a condition\'s weight', () => {
    const start = withSecondEntryCondition()
    const document = setMatch(start, long(start).entry.id, 'score')
    const changed = setWeight(setThreshold(document, long(document).entry.id, 3), long(document).entry.items[0]!.id, 2)

    expect(documentToDraft(changed).sides[0]!.entry).toMatchObject({ kind: 'score', threshold: 3, parts: [{ weight: 2 }, { weight: 1 }] })
  })

  it('negates a condition and back', () => {
    const document = documentFromDraft(draft())
    const id = long(document).entry.items[0]!.id
    const negated = toggleNegated(document, id)

    expect(documentToDraft(negated).sides[0]!.entry!.kind).toBe('not')
    expect(documentToDraft(toggleNegated(negated, id))).toEqual(draft())
  })

  it('changes one part of a condition', () => {
    const document = documentFromDraft(draft())
    const id = long(document).entry.items[0]!.id
    const changed = updateCondition(document, id, { right: { kind: 'sma', period: 200 } })
    const condition = long(changed).entry.items[0] as ConditionItem

    expect(condition.right).toEqual({ kind: 'sma', period: 200 })
    expect(condition.left).toEqual(EMA20)
  })

  it('finds an item in any side', () => {
    const document = documentFromDraft(draft({ sides: [LONG, SHORT] }))
    expect(findItem(document, document.sides[1]!.entry.items[0]!.id)?.type).toBe('condition')
    expect(findItem(document, 'nope')).toBeUndefined()
  })
})

describe('problems', () => {
  it('has none for a valid strategy', () => {
    expect(problemsOf(documentFromDraft(draft({ sides: [LONG, SHORT] })))).toEqual({})
  })

  it('flags a period below the minimum on the condition', () => {
    const document = documentFromDraft(draft())
    const id = long(document).entry.items[0]!.id
    const broken = updateCondition(document, id, { left: { kind: 'ema', period: 0 } })

    expect(problemsOf(broken)[id]).toMatch(/period/i)
  })

  it('flags a MACD whose fast period is not shorter than its slow one', () => {
    const document = documentFromDraft(draft())
    const id = long(document).entry.items[0]!.id
    const broken = updateCondition(document, id, { left: { kind: 'macd', fast: 30, slow: 26, signal: 9, line: 'macd' } })

    expect(problemsOf(broken)[id]).toMatch(/fast/i)
  })

  it('flags an empty nested group', () => {
    const document = documentFromDraft(draft())
    const group = newGroup('any')
    expect(problemsOf(addItem(document, long(document).entry.id, group))[group.id]).toBeTruthy()
  })

  it.each<[string, Comparison['left']]>([
    ['a highest high over 0 candles', { kind: 'highest', period: 0 }],
    ['a lowest low over 1001 candles', { kind: 'lowest', period: 1001 }],
    ['a change over 2.5 candles', { kind: 'change', period: 2.5 }],
    ['a volume average over 1 candle', { kind: 'relative_volume', period: 1 }],
    ['a stochastic over 1 candle', { kind: 'stochastic', period: 1, smooth: 3, line: 'k' }],
    ['a stochastic smoothed over 0 candles', { kind: 'stochastic', period: 14, smooth: 0, line: 'd' }],
  ])('flags %s on the condition', (_, operand) => {
    const document = documentFromDraft(draft())
    const id = long(document).entry.items[0]!.id

    expect(problemsOf(updateCondition(document, id, { left: operand }))[id]).toBeTruthy()
  })

  it('has none for any template', () => {
    for (const template of STRATEGY_TEMPLATES) {
      expect(problemsOf(documentFromDraft(template.strategy)), template.name).toEqual({})
    }
  })

  describe('in a score', () => {
    function scored(threshold: number, weights: number[]): { document: StrategyDocument, group: GroupItem } {
      const conditions = [RSI_BELOW_30, CLOSE_ABOVE_SMA, MACD_RISING].slice(0, weights.length)
      const entry = score(threshold, ...conditions.map((condition, index): [number, Rule] => [weights[index]!, condition]))
      const document = documentFromDraft(withSide({ ...LONG, entry }))
      return { document, group: long(document).entry }
    }

    it('has none when the threshold can be reached', () => {
      expect(problemsOf(scored(3, [2, 1, 1]).document)).toEqual({})
    })

    it('says what the conditions add up to when the threshold is out of reach', () => {
      const { document, group } = scored(2, [1, 1])
      expect(problemsOf(setThreshold(document, group.id, 3))[group.id]).toBe('These conditions add up to 2, so 3 can never be reached')
    })

    it('flags a threshold that is not above 0', () => {
      const { document, group } = scored(2, [1, 1])
      expect(problemsOf(setThreshold(document, group.id, 0))[group.id]).toBeTruthy()
    })

    it.each([0, -1, 101])('flags a weight of %s on the group', (weight) => {
      const { document, group } = scored(1, [1, 1])
      expect(problemsOf(setWeight(document, group.items[0]!.id, weight))[group.id]).toBeTruthy()
    })

    it('ignores weights outside a score', () => {
      const document = withSecondEntryCondition()
      expect(problemsOf(setWeight(document, long(document).entry.items[0]!.id, 0))).toEqual({})
    })
  })

  it('flags a trailing stop outside 0 to 100% on its own side', () => {
    const document = documentFromDraft(draft())
    const broken = setSideLimit(document, long(document).id, 'trailingStopPct', 100)
    expect(problemsOf(broken)[`trailingStop:${long(document).id}`]).toBeTruthy()
  })

  it('flags a stop-loss outside 0 to 100% on its own side', () => {
    const document = documentFromDraft(draft())
    const broken = setSideLimit(document, long(document).id, 'stopLossPct', 120)
    expect(problemsOf(broken)[`stopLoss:${long(document).id}`]).toBeTruthy()
  })
})
