// A strategy as TradingView Pine Script (version 6), to run the same rules on TradingView's own charts. The
// indicators are TradingView's built-ins, which compute what the backtest computes; each is declared once and
// the conditions compare the variables. Orders fill at the next candle's open, an exit rule closes a trade on
// the candle it becomes true, and the stop-loss, take-profit and trailing stop follow the fill price, as in
// the backtest. Slippage is left out: Pine counts it in ticks, not in a share of the price.
import type { Comparison, SideDraft, StrategyDraft } from '~/types/api'

type Operand = Comparison['left']
type Condition = NonNullable<SideDraft['entry']>
type Exit = NonNullable<SideDraft['exit']>

const TIMEFRAME_WORDS: Record<NonNullable<StrategyDraft['timeframe']>, string> = { '1h': '1-hour', '4h': '4-hour', '1d': 'daily' }

function number(value: number): string {
  return String(Number(value.toFixed(6)))
}

/** The declarations a script needs, each once, in the order first needed. */
class Declarations {
  private readonly lines = new Map<string, string>()
  private crossCount = 0
  private readonly crosses = new Map<string, string>()

  declare(key: string, line: string): void {
    if (!this.lines.has(key)) this.lines.set(key, line)
  }

  /** Crossings are computed on every candle, outside any "and", as Pine expects of its ta functions. */
  cross(expression: string): string {
    const known = this.crosses.get(expression)
    if (known) return known
    const name = `cross${++this.crossCount}`
    this.crosses.set(expression, name)
    this.declare(name, `${name} = ${expression}`)
    return name
  }

  all(): string[] {
    return [...this.lines.values()]
  }
}

function operandName(operand: Operand, declarations: Declarations): string {
  switch (operand.kind) {
    case 'price':
      return operand.field
    case 'constant':
      return number(operand.value)
    case 'sma':
      declarations.declare(`sma_${operand.period}`, `sma_${operand.period} = ta.sma(close, ${operand.period})`)
      return `sma_${operand.period}`
    case 'ema':
      declarations.declare(`ema_${operand.period}`, `ema_${operand.period} = ta.ema(close, ${operand.period})`)
      return `ema_${operand.period}`
    case 'rsi':
      declarations.declare(`rsi_${operand.period}`, `rsi_${operand.period} = ta.rsi(close, ${operand.period})`)
      return `rsi_${operand.period}`
    case 'macd': {
      const settings = `${operand.fast}_${operand.slow}_${operand.signal}`
      declarations.declare(`macd_${settings}`, `[macd_${settings}, macdSignal_${settings}, macdHistogram_${settings}] = ta.macd(close, ${operand.fast}, ${operand.slow}, ${operand.signal})`)
      const line = { macd: 'macd', signal: 'macdSignal', histogram: 'macdHistogram' }[operand.line]
      return `${line}_${settings}`
    }
    case 'bollinger': {
      const settings = `${operand.period}_${number(operand.std_dev).replace('.', '_')}`
      declarations.declare(`bb_${settings}`, `[bbMiddle_${settings}, bbUpper_${settings}, bbLower_${settings}] = ta.bb(close, ${operand.period}, ${number(operand.std_dev)})`)
      const band = { upper: 'bbUpper', middle: 'bbMiddle', lower: 'bbLower' }[operand.band]
      return `${band}_${settings}`
    }
    case 'highest':
      // The previous candles only, so a close can break above it.
      declarations.declare(`highest_${operand.period}`, `highest_${operand.period} = ta.highest(high, ${operand.period})[1]`)
      return `highest_${operand.period}`
    case 'lowest':
      declarations.declare(`lowest_${operand.period}`, `lowest_${operand.period} = ta.lowest(low, ${operand.period})[1]`)
      return `lowest_${operand.period}`
    case 'change':
      declarations.declare(`change_${operand.period}`, `change_${operand.period} = (close / close[${operand.period}] - 1) * 100`)
      return `change_${operand.period}`
    case 'relative_volume':
      declarations.declare(`relativeVolume_${operand.period}`, `relativeVolume_${operand.period} = volume / ta.sma(volume, ${operand.period})`)
      return `relativeVolume_${operand.period}`
    case 'stochastic': {
      const k = `stochK_${operand.period}`
      declarations.declare(k, `${k} = ta.stoch(close, high, low, ${operand.period})`)
      if (operand.line === 'k') return k
      const d = `stochD_${operand.period}_${operand.smooth}`
      declarations.declare(d, `${d} = ta.sma(${k}, ${operand.smooth})`)
      return d
    }
  }
}

function conditionExpression(condition: Condition, declarations: Declarations): string {
  switch (condition.kind) {
    case 'compare': {
      const left = operandName(condition.left, declarations)
      const right = operandName(condition.right, declarations)
      if (condition.operator === 'gt') return `${left} > ${right}`
      if (condition.operator === 'lt') return `${left} < ${right}`
      return declarations.cross(`${condition.operator === 'crosses_above' ? 'ta.crossover' : 'ta.crossunder'}(${left}, ${right})`)
    }
    case 'and':
      return `(${condition.conditions.map(inner => conditionExpression(inner, declarations)).join(' and ')})`
    case 'or':
      return `(${condition.conditions.map(inner => conditionExpression(inner, declarations)).join(' or ')})`
    case 'not':
      return `not (${conditionExpression(condition.condition, declarations)})`
    case 'score': {
      const parts = condition.parts.map(part => `(${conditionExpression(part.condition, declarations)} ? ${number(part.weight)} : 0)`)
      return `(${parts.join(' + ')}) >= ${number(condition.threshold)}`
    }
  }
}

interface CompleteSide {
  direction: 'long' | 'short'
  entry: Condition
  exit: Exit
}

function isComplete(side: SideDraft): side is SideDraft & CompleteSide {
  const exit = side.exit
  return side.entry !== null && exit !== null && (exit.rule !== null || exit.stop_loss_pct !== null || exit.take_profit_pct !== null || exit.trailing_stop_pct !== null)
}

/** The orders of one side: in when flat, out on its rule, and its limits while open. */
function sideOrders(side: CompleteSide, hasOtherSide: boolean): string[] {
  const isLong = side.direction === 'long'
  const prefix = side.direction
  const label = isLong ? 'Long' : 'Short'
  const other = isLong ? 'shortEntry' : 'longEntry'
  const isOpen = isLong ? 'strategy.position_size > 0' : 'strategy.position_size < 0'
  const lines = [
    `if strategy.position_size == 0 and ${prefix}Entry${hasOtherSide ? ` and not ${other}` : ''}`,
    `    strategy.entry("${label}", ${isLong ? 'strategy.long' : 'strategy.short'})`,
  ]
  if (side.exit.rule) lines.push(`if ${isOpen} and ${prefix}Exit`, `    strategy.close("${label}")`)

  const { stop_loss_pct: stopLoss, take_profit_pct: takeProfit, trailing_stop_pct: trailing } = side.exit
  if (stopLoss === null && takeProfit === null && trailing === null) return lines
  const away = isLong ? '-' : '+'
  const toward = isLong ? '+' : '-'
  const stops: string[] = []
  if (stopLoss !== null) stops.push(`strategy.position_avg_price * (1 ${away} ${number(stopLoss)} / 100)`)
  if (trailing !== null) {
    lines.push(`var float ${prefix}Best = na`)
    stops.push(`${prefix}Best * (1 ${away} ${number(trailing)} / 100)`)
  }
  lines.push(`if ${isOpen}`)
  if (trailing !== null) {
    const extreme = isLong ? 'high' : 'low'
    const pick = isLong ? 'math.max' : 'math.min'
    const wasFlat = isLong ? 'strategy.position_size[1] <= 0' : 'strategy.position_size[1] >= 0'
    lines.push(`    ${prefix}Best := ${wasFlat} ? ${extreme} : ${pick}(${prefix}Best, ${extreme})`)
  }
  const levels: string[] = []
  if (stops.length) levels.push(`stop = ${stops.length > 1 ? `${isLong ? 'math.max' : 'math.min'}(${stops.join(', ')})` : stops[0]}`)
  if (takeProfit !== null) levels.push(`limit = strategy.position_avg_price * (1 ${toward} ${number(takeProfit)} / 100)`)
  if (levels.length) lines.push(`    strategy.exit("${label} limits", "${label}", ${levels.join(', ')})`)
  return lines
}

export function pineScript(strategy: StrategyDraft, name: string): string {
  const sides = strategy.sides.filter(isComplete)
  const declarations = new Declarations()
  const signals: string[] = []
  for (const side of sides) {
    signals.push(`${side.direction}Entry = ${conditionExpression(side.entry, declarations)}`)
    if (side.exit.rule) {
      signals.push(`${side.direction}ExitRule = ${conditionExpression(side.exit.rule, declarations)}`)
      // An exit rule closes a trade on the candle it becomes true, not on every candle it holds.
      signals.push(`${side.direction}Exit = ${side.direction}ExitRule and not ${side.direction}ExitRule[1]`)
    }
  }

  const { commission_pct: commission, slippage_bps: slippage, leverage } = strategy.execution
  const title = (name.trim() || 'BlockStrat strategy').replaceAll('"', '\'')
  const market = strategy.instrument && strategy.timeframe ? `Run it on BINANCE:${strategy.instrument}, ${TIMEFRAME_WORDS[strategy.timeframe]} candles.` : ''
  const header = [
    '//@version=6',
    `// "${title}", made with BlockStrat. ${market}`.trimEnd(),
    '// Rules are checked when a candle closes and orders fill at the next candle\'s open, as in the backtest.',
    ...(slippage > 0 ? [`// The backtest's ${number(slippage)} bps of slippage is not included: Pine counts slippage in ticks; set it in the strategy's Properties.`] : []),
    `strategy("${title}", overlay = true, initial_capital = 10000, default_qty_type = strategy.percent_of_equity, default_qty_value = ${number(strategy.position_size_pct * leverage)}, commission_type = strategy.commission.percent, commission_value = ${number(commission)}, margin_long = ${number(100 / leverage)}, margin_short = ${number(100 / leverage)}, process_orders_on_close = false)`,
  ]
  const orders = sides.flatMap(side => sideOrders(side, sides.length > 1))
  return [...header, '', ...declarations.all(), '', ...signals, '', ...orders, ''].join('\n')
}
