// Block shapes, toolbox and theme of the strategy editor. Block types and field names must match
// what `utils/strategyBlocks.ts` reads and writes.
import * as Blockly from 'blockly/core'
import { BlockType } from '~/utils/strategyBlocks'

export const REQUIRED_SLOT_STATUS_FIELDS = {
  instrument: 'INSTRUMENT_STATUS',
  timeframe: 'TIMEFRAME_STATUS',
  entry: 'ENTRY_STATUS',
  exit: 'EXIT_STATUS',
} as const

const STYLE = {
  root: 'root_blocks',
  market: 'market_blocks',
  indicator: 'indicator_blocks',
  condition: 'condition_blocks',
  logic: 'logic_blocks',
  action: 'action_blocks',
  risk: 'risk_blocks',
} as const

// Mirrors the backend's instrument list so saved and shared strategies load correctly before
// the API answers; the API's list replaces it once loaded.
let instrumentOptions: [string, string][] = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'LINK', 'LTC']
  .map(base => [`${base}/USDT`, `${base}USDT`])

export function setInstrumentOptions(options: { symbol: string, label: string }[]): void {
  if (options.length) instrumentOptions = options.map(option => [option.label, option.symbol])
}

const PERIOD = (value: number, min = 1) => ({ type: 'field_number', name: 'PERIOD', value, min, max: 1000, precision: 1 })
const PERCENT = (value: number, max: number) => ({ type: 'field_number', name: 'PCT', value, min: 0.1, max, precision: 0.1 })

let registered = false

export function registerBlocks(): void {
  if (registered) return
  registered = true

  Blockly.Blocks[BlockType.root] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('Strategy')
      this.appendValueInput('INSTRUMENT')
        .setCheck('Instrument')
        .appendField(new Blockly.FieldLabel('○'), REQUIRED_SLOT_STATUS_FIELDS.instrument)
        .appendField('instrument')
      this.appendValueInput('TIMEFRAME')
        .setCheck('Timeframe')
        .appendField(new Blockly.FieldLabel('○'), REQUIRED_SLOT_STATUS_FIELDS.timeframe)
        .appendField('timeframe')
      this.appendValueInput('ENTRY')
        .setCheck('Entry')
        .appendField(new Blockly.FieldLabel('○'), REQUIRED_SLOT_STATUS_FIELDS.entry)
        .appendField('entry')
      this.appendStatementInput('EXIT')
        .setCheck('ExitPart')
        .appendField(new Blockly.FieldLabel('○'), REQUIRED_SLOT_STATUS_FIELDS.exit)
        .appendField('exit')
      this.appendStatementInput('SETTINGS').setCheck('Setting').appendField('settings (optional)')
      this.setStyle(STYLE.root)
      this.setDeletable(false)
      this.setTooltip('Fill all four slots to see the backtest.')
    },
  }

  Blockly.Blocks[BlockType.instrument] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('market')
        .appendField(new Blockly.FieldDropdown(() => instrumentOptions), 'SYMBOL')
      this.setOutput(true, 'Instrument')
      this.setStyle(STYLE.market)
    },
  }

  Blockly.Extensions.register('macd_periods_check', function (this: Blockly.Block) {
    this.setOnChange(() => {
      const fast = Number(this.getFieldValue('FAST'))
      const slow = Number(this.getFieldValue('SLOW'))
      this.setWarningText(fast >= slow ? 'Fast period must be shorter than slow period.' : null)
    })
  })

  Blockly.common.defineBlocksWithJsonArray([
    {
      type: BlockType.timeframe,
      message0: 'every %1',
      args0: [{ type: 'field_dropdown', name: 'TIMEFRAME', options: [['1 day', '1d'], ['4 hours', '4h'], ['1 hour', '1h']] }],
      output: 'Timeframe',
      style: STYLE.market,
    },
    {
      type: BlockType.entry,
      message0: 'go %1 when %2',
      args0: [
        { type: 'field_dropdown', name: 'DIRECTION', options: [['long', 'long'], ['short', 'short']] },
        { type: 'input_value', name: 'CONDITION', check: 'Condition' },
      ],
      output: 'Entry',
      style: STYLE.action,
      tooltip: 'Opens a position when the condition is true at a bar\'s close. Fills at the next bar\'s open.',
    },
    {
      type: BlockType.exitRule,
      message0: 'close when %1',
      args0: [{ type: 'input_value', name: 'CONDITION', check: 'Condition' }],
      previousStatement: 'ExitPart',
      nextStatement: 'ExitPart',
      style: STYLE.action,
    },
    {
      type: BlockType.stopLoss,
      message0: 'stop-loss %1 %',
      args0: [PERCENT(5, 99)],
      previousStatement: 'ExitPart',
      nextStatement: 'ExitPart',
      style: STYLE.risk,
    },
    {
      type: BlockType.takeProfit,
      message0: 'take-profit %1 %',
      args0: [PERCENT(10, 1000)],
      previousStatement: 'ExitPart',
      nextStatement: 'ExitPart',
      style: STYLE.risk,
    },
    {
      type: BlockType.positionSize,
      message0: 'position size %1 % of equity',
      args0: [PERCENT(100, 100)],
      previousStatement: 'Setting',
      nextStatement: 'Setting',
      style: STYLE.risk,
    },
    {
      type: BlockType.compare,
      message0: '%1 %2 %3',
      args0: [
        { type: 'input_value', name: 'LEFT', check: 'Operand' },
        {
          type: 'field_dropdown',
          name: 'OPERATOR',
          options: [['crosses above', 'crosses_above'], ['crosses below', 'crosses_below'], ['>', 'gt'], ['<', 'lt']],
        },
        { type: 'input_value', name: 'RIGHT', check: 'Operand' },
      ],
      inputsInline: true,
      output: 'Condition',
      style: STYLE.condition,
    },
    {
      type: BlockType.and,
      message0: '%1 and %2',
      args0: [
        { type: 'input_value', name: 'A', check: 'Condition' },
        { type: 'input_value', name: 'B', check: 'Condition' },
      ],
      inputsInline: true,
      output: 'Condition',
      style: STYLE.logic,
    },
    {
      type: BlockType.or,
      message0: '%1 or %2',
      args0: [
        { type: 'input_value', name: 'A', check: 'Condition' },
        { type: 'input_value', name: 'B', check: 'Condition' },
      ],
      inputsInline: true,
      output: 'Condition',
      style: STYLE.logic,
    },
    {
      type: BlockType.not,
      message0: 'not %1',
      args0: [{ type: 'input_value', name: 'CONDITION', check: 'Condition' }],
      output: 'Condition',
      style: STYLE.logic,
    },
    {
      type: BlockType.price,
      message0: '%1',
      args0: [{
        type: 'field_dropdown',
        name: 'FIELD',
        options: [['close', 'close'], ['open', 'open'], ['high', 'high'], ['low', 'low'], ['volume', 'volume']],
      }],
      output: 'Operand',
      style: STYLE.indicator,
    },
    { type: BlockType.sma, message0: 'SMA %1', args0: [PERIOD(50)], output: 'Operand', style: STYLE.indicator },
    { type: BlockType.ema, message0: 'EMA %1', args0: [PERIOD(21)], output: 'Operand', style: STYLE.indicator },
    { type: BlockType.rsi, message0: 'RSI %1', args0: [PERIOD(14, 2)], output: 'Operand', style: STYLE.indicator },
    {
      type: BlockType.macd,
      message0: 'MACD %1 of %2 %3 %4',
      args0: [
        { type: 'field_dropdown', name: 'LINE', options: [['line', 'macd'], ['signal', 'signal'], ['histogram', 'histogram']] },
        { type: 'field_number', name: 'FAST', value: 12, min: 1, max: 1000, precision: 1 },
        { type: 'field_number', name: 'SLOW', value: 26, min: 2, max: 1000, precision: 1 },
        { type: 'field_number', name: 'SIGNAL', value: 9, min: 1, max: 1000, precision: 1 },
      ],
      output: 'Operand',
      style: STYLE.indicator,
      extensions: ['macd_periods_check'],
    },
    {
      type: BlockType.bollinger,
      message0: 'Bollinger %1 band %2 σ %3',
      args0: [
        { type: 'field_dropdown', name: 'BAND', options: [['middle', 'middle'], ['upper', 'upper'], ['lower', 'lower']] },
        PERIOD(20, 2),
        { type: 'field_number', name: 'STD_DEV', value: 2, min: 0.1, max: 10, precision: 0.1 },
      ],
      output: 'Operand',
      style: STYLE.indicator,
    },
    {
      type: BlockType.constant,
      message0: 'number %1',
      args0: [{ type: 'field_number', name: 'VALUE', value: 30 }],
      output: 'Operand',
      style: STYLE.indicator,
    },
  ])
}

export const toolbox = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Market',
      categorystyle: 'market_category',
      contents: [
        { kind: 'block', type: BlockType.instrument },
        { kind: 'block', type: BlockType.timeframe },
      ],
    },
    {
      kind: 'category',
      name: 'Indicators',
      categorystyle: 'indicator_category',
      contents: [BlockType.price, BlockType.sma, BlockType.ema, BlockType.rsi, BlockType.macd, BlockType.bollinger, BlockType.constant]
        .map(type => ({ kind: 'block', type })),
    },
    {
      kind: 'category',
      name: 'Conditions',
      categorystyle: 'condition_category',
      contents: [
        {
          kind: 'block',
          type: BlockType.compare,
          inputs: {
            LEFT: { block: { type: BlockType.price } },
            RIGHT: { block: { type: BlockType.sma } },
          },
        },
        { kind: 'block', type: BlockType.compare },
      ],
    },
    {
      kind: 'category',
      name: 'Logic',
      categorystyle: 'logic_category',
      contents: [BlockType.and, BlockType.or, BlockType.not].map(type => ({ kind: 'block', type })),
    },
    {
      kind: 'category',
      name: 'Actions',
      categorystyle: 'action_category',
      contents: [
        { kind: 'block', type: BlockType.entry },
        { kind: 'block', type: BlockType.exitRule },
      ],
    },
    {
      kind: 'category',
      name: 'Risk',
      categorystyle: 'risk_category',
      contents: [BlockType.stopLoss, BlockType.takeProfit, BlockType.positionSize].map(type => ({ kind: 'block', type })),
    },
  ],
}

const COLOURS = {
  root: '#334155',
  market: '#0f766e',
  indicator: '#2563eb',
  condition: '#7c3aed',
  logic: '#9333ea',
  action: '#059669',
  risk: '#dc2626',
} as const

export function createTheme(): Blockly.Theme {
  const blockStyles: Record<string, Partial<Blockly.Theme.BlockStyle>> = {}
  const categoryStyles: Record<string, Blockly.Theme.CategoryStyle> = {}
  for (const [name, colour] of Object.entries(COLOURS)) {
    blockStyles[`${name}_blocks`] = { colourPrimary: colour }
    categoryStyles[`${name}_category`] = { colour }
  }
  return Blockly.Theme.defineTheme('strategy-lab', {
    name: 'strategy-lab',
    base: Blockly.Themes.Classic,
    blockStyles: blockStyles as Record<string, Blockly.Theme.BlockStyle>,
    categoryStyles,
    componentStyles: {
      workspaceBackgroundColour: '#f8fafc',
      toolboxBackgroundColour: '#ffffff',
      toolboxForegroundColour: '#0f172a',
      flyoutBackgroundColour: '#f1f5f9',
      flyoutOpacity: 0.97,
      scrollbarColour: '#cbd5e1',
      insertionMarkerColour: '#0f172a',
      insertionMarkerOpacity: 0.25,
    },
    fontStyle: { family: 'Inter, ui-sans-serif, system-ui, sans-serif', weight: '600', size: 11 },
    startHats: true,
  })
}
