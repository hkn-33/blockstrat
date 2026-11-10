// Strategy persistence outside the editor: browser storage, JSON files and share links.
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { StrategyDraft } from '~/types/api'
import { draftToWorkspace, workspaceToDraft } from './strategyBlocks'

export class InvalidStrategyError extends Error {}

const TIMEFRAMES = ['1d', '4h', '1h']

/** Parses JSON text into a strategy, rejecting anything the editor could not show faithfully. */
export function parseStrategy(text: string): StrategyDraft {
  let value: unknown
  try {
    value = JSON.parse(text)
  }
  catch {
    throw new InvalidStrategyError('The file is not valid JSON.')
  }
  if (!isStrategyShape(value)) {
    throw new InvalidStrategyError('The file is not a Strategy Lab strategy (or comes from an unsupported version).')
  }
  try {
    // The blocks are the source of truth: a strategy that does not survive the trip into blocks
    // and back contains something the editor cannot represent.
    const roundTripped = workspaceToDraft(draftToWorkspace(value), value.execution).draft
    if (stableJson(roundTripped) !== stableJson(value)) throw new Error('changed')
    return roundTripped
  }
  catch {
    throw new InvalidStrategyError('The strategy contains blocks or values this editor does not support.')
  }
}

export function serializeStrategy(strategy: StrategyDraft): string {
  return JSON.stringify(strategy, null, 2)
}

function isStrategyShape(value: unknown): value is StrategyDraft {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  const execution = candidate.execution as Record<string, unknown> | undefined
  return candidate.schema_version === 1
    && (candidate.instrument === null || typeof candidate.instrument === 'string')
    && (candidate.timeframe === null || TIMEFRAMES.includes(candidate.timeframe as string))
    && typeof candidate.position_size_pct === 'number'
    && typeof execution === 'object' && execution !== null
    && typeof execution.commission_pct === 'number'
    && typeof execution.slippage_bps === 'number'
}

/** JSON with sorted keys, so equal strategies compare equal regardless of key order. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_, nested: unknown) => {
    if (typeof nested !== 'object' || nested === null || Array.isArray(nested)) return nested
    return Object.fromEntries(Object.entries(nested).sort(([a], [b]) => a.localeCompare(b)))
  })
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

const CURRENT_KEY = 'strategy-lab:current'
const LIBRARY_KEY = 'strategy-lab:library'

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
