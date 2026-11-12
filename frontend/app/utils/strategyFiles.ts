// Strategy persistence outside the editor: browser storage, JSON files and share links.
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { StrategyDraft } from '~/types/api'
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
