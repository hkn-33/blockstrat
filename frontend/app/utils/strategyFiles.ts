// Strategy persistence outside the editor: browser storage, JSON files and share links.
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { Proposal, StrategyDraft } from '~/types/api'
import type { SavedTrade } from './drawnTrades'
import { documentFromDraft, documentToDraft } from './strategyDocument'

export class InvalidStrategyError extends Error {}

const TIMEFRAMES = ['1d', '4h', '1h']

/** Parses JSON text into a strategy, rejecting anything the builder could not show. Version 1 files open as one side. */
export function parseStrategy(text: string): StrategyDraft {
  let value: unknown
  try {
    value = JSON.parse(text)
  }
  catch {
    throw new InvalidStrategyError('The file is not valid JSON.')
  }
  if (!isStrategyShape(value)) {
    throw new InvalidStrategyError('The file is not a BlockStrat strategy (or comes from an unsupported version).')
  }
  try {
    // The builder's document is the source of truth: the strategy is returned as the builder will send it.
    return documentToDraft(documentFromDraft(value))
  }
  catch {
    throw new InvalidStrategyError('The strategy contains blocks or values this builder does not support.')
  }
}

export function serializeStrategy(strategy: StrategyDraft): string {
  return JSON.stringify(strategy, null, 2)
}

function isListOfNames(value: unknown): boolean {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function isStrategyShape(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  const execution = candidate.execution as Record<string, unknown> | undefined
  return (candidate.schema_version === 1 || (candidate.schema_version === 2 && Array.isArray(candidate.sides)))
    && (candidate.instrument === null || typeof candidate.instrument === 'string')
    && (candidate.extra_instruments === undefined || isListOfNames(candidate.extra_instruments))
    && (candidate.timeframe === null || TIMEFRAMES.includes(candidate.timeframe as string))
    && typeof candidate.position_size_pct === 'number'
    && typeof execution === 'object' && execution !== null
    && typeof execution.commission_pct === 'number'
    && typeof execution.slippage_bps === 'number'
}

// ---------- Share links ----------

const SHARE_PREFIX = '#s='

export function shareHash(strategy: StrategyDraft): string {
  return SHARE_PREFIX + compressToEncodedURIComponent(JSON.stringify(strategy))
}

/** The shared strategy in a URL hash, null when the hash is not a share link. */
export function strategyFromHash(hash: string): StrategyDraft | null {
  if (!hash.startsWith(SHARE_PREFIX)) return null
  const json = decompressFromEncodedURIComponent(hash.slice(SHARE_PREFIX.length))
  if (!json) throw new InvalidStrategyError('The share link is broken or incomplete.')
  return parseStrategy(json)
}

// ---------- Browser storage ----------

const CURRENT_KEY = 'blockstrat:current'
const LIBRARY_KEY = 'blockstrat:library'

export type StrategyLibrary = Record<string, StrategyDraft>

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  }
  catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  }
  catch {
    // Storage blocked or full: the app keeps working, it just cannot remember.
  }
}

export function loadCurrentStrategy(): StrategyDraft | null {
  const text = readStorage(CURRENT_KEY)
  if (!text) return null
  try {
    return parseStrategy(text)
  }
  catch {
    return null
  }
}

export function saveCurrentStrategy(strategy: StrategyDraft): void {
  writeStorage(CURRENT_KEY, JSON.stringify(strategy))
}

const NAME_KEY = 'blockstrat:current-name'

/** The current strategy's name; it lives beside the strategy, which the API never needs to see. */
export function loadCurrentName(): string {
  return readStorage(NAME_KEY) ?? ''
}

export function saveCurrentName(name: string): void {
  writeStorage(NAME_KEY, name)
}

const HINTS_KEY = 'blockstrat:hints-off'

/** Whether the canvas guide's hints are shown; they are until the user turns them off. */
export function loadHintsOn(): boolean {
  return readStorage(HINTS_KEY) === null
}

export function saveHintsOn(isOn: boolean): void {
  try {
    if (isOn) window.localStorage.removeItem(HINTS_KEY)
    else window.localStorage.setItem(HINTS_KEY, '1')
  }
  catch {
    // Storage blocked: the choice lasts for this visit only.
  }
}

// Lists kept per chart (one market at one candle size), under one storage key each.
function readPerChart<T>(storageKey: string): Record<string, T[]> {
  try {
    const saved = JSON.parse(readStorage(storageKey) ?? '{}') as Record<string, T[]>
    return typeof saved === 'object' && saved !== null ? saved : {}
  }
  catch {
    return {}
  }
}

function loadPerChart<T>(storageKey: string, chart: string): T[] {
  const list = readPerChart<T>(storageKey)[chart]
  return Array.isArray(list) ? list : []
}

function savePerChart<T>(storageKey: string, chart: string, list: T[]): void {
  const saved = readPerChart<T>(storageKey)
  if (list.length) saved[chart] = list
  else delete saved[chart]
  writeStorage(storageKey, JSON.stringify(saved))
}

const DRAWN_TRADES_KEY = 'blockstrat:drawn-trades'
const FOUND_STRATEGIES_KEY = 'blockstrat:found-strategies'

/** The trades drawn on one chart, kept so a reload does not lose them. */
export function loadDrawnTrades(chart: string): SavedTrade[] {
  return loadPerChart(DRAWN_TRADES_KEY, chart)
}

export function saveDrawnTrades(chart: string, trades: SavedTrade[]): void {
  savePerChart(DRAWN_TRADES_KEY, chart, trades)
}

/** The strategies the last search on a chart found, kept so they need not be searched for again. */
export function loadFoundStrategies(chart: string): Proposal[] {
  return loadPerChart(FOUND_STRATEGIES_KEY, chart)
}

export function saveFoundStrategies(chart: string, proposals: Proposal[]): void {
  savePerChart(FOUND_STRATEGIES_KEY, chart, proposals)
}

/** The library after the current strategy is saved into it as it stands: under its name, an untitled one under
 * a name of its own, a renamed one moved, and never over another strategy that has the name. `savedAs` is the
 * name it was last saved under, null for a strategy not saved yet. */
export function autosaved(library: StrategyLibrary, savedAs: string | null, name: string, strategy: StrategyDraft): { library: StrategyLibrary, savedAs: string, name: string } {
  const { [savedAs ?? '']: _previous, ...others } = library
  const wanted = name.trim() || 'Untitled strategy'
  const free = wanted === savedAs ? wanted : freeLibraryName(others, wanted)
  return { library: { ...others, [free]: strategy }, savedAs: free, name: name.trim() && free === wanted ? name : free }
}

/** A name not yet taken in the library: "RSI dip", then "RSI dip 2", "RSI dip 3". */
export function freeLibraryName(library: StrategyLibrary, name: string): string {
  if (!(name in library)) return name
  let number = 2
  while (`${name} ${number}` in library) number++
  return `${name} ${number}`
}

const PANELS_KEY = 'blockstrat:panel-widths'

/** The widths, in pixels, the user dragged the builder's side columns to; null keeps the default. */
export interface PanelWidths {
  library: number | null
  result: number | null
}

export function loadPanelWidths(): PanelWidths {
  try {
    const stored = JSON.parse(readStorage(PANELS_KEY) ?? '{}') as Partial<PanelWidths>
    return { library: typeof stored.library === 'number' ? stored.library : null, result: typeof stored.result === 'number' ? stored.result : null }
  }
  catch {
    return { library: null, result: null }
  }
}

export function savePanelWidths(widths: PanelWidths): void {
  writeStorage(PANELS_KEY, JSON.stringify(widths))
}

const REWARD_TO_RISK_KEY = 'blockstrat:reward-to-risk'

/** How many times its stop-loss a new drawn trade aims to make; 2 unless the user chose otherwise. */
export function loadRewardToRisk(): number {
  const stored = Number(readStorage(REWARD_TO_RISK_KEY))
  return stored > 0 ? stored : 2
}

export function saveRewardToRisk(rewardToRisk: number): void {
  writeStorage(REWARD_TO_RISK_KEY, String(rewardToRisk))
}

const LAYOUT_KEY = 'blockstrat:layout'

/** Which column widths are in use: the default ones, or the user's own (kept even while the default is on). */
export type Layout = 'default' | 'custom'

export function loadLayout(): Layout {
  return readStorage(LAYOUT_KEY) === 'default' ? 'default' : 'custom'
}

export function saveLayout(layout: Layout): void {
  writeStorage(LAYOUT_KEY, layout)
}

export function loadLibrary(): StrategyLibrary {
  const text = readStorage(LIBRARY_KEY)
  if (!text) return {}
  try {
    const stored = JSON.parse(text) as Record<string, unknown>
    const library: StrategyLibrary = {}
    for (const [name, strategy] of Object.entries(stored)) {
      try {
        library[name] = parseStrategy(JSON.stringify(strategy))
      }
      catch {
        // Skip entries a newer or older app version wrote in a shape we cannot read.
      }
    }
    return library
  }
  catch {
    return {}
  }
}

export function saveLibrary(library: StrategyLibrary): void {
  writeStorage(LIBRARY_KEY, JSON.stringify(library))
}
