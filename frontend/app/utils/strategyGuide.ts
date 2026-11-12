// The builder's guide: which part a new user should fill next, and the checklist that ticks as they go.
// Everything is derived from the document and the strategy's name; nothing is stored.
import { documentToDraft, missingParts, type SideDocument, type StrategyDocument } from './strategyDocument'

export type GuideStep = 'name' | 'market' | 'entry' | 'exit' | 'done'

export interface GuideItem {
  key: Exclude<GuideStep, 'done'>
  label: string
  isDone: boolean
}

const LABELS: Record<Exclude<GuideStep, 'done'>, string> = {
  name: 'Name your strategy',
  market: 'Pick a market',
  entry: 'Say when to get in',
  exit: 'Say when to get out',
}

export function guideSteps(document: StrategyDocument, name: string): GuideItem[] {
  const missing = missingParts(document)
  const done: Record<Exclude<GuideStep, 'done'>, boolean> = {
    name: name.trim().length > 0,
    market: !missing.includes('instrument') && !missing.includes('timeframe'),
    entry: !missing.includes('entry'),
    exit: !missing.includes('exit'),
  }
  return (Object.keys(LABELS) as Exclude<GuideStep, 'done'>[]).map(key => ({ key, label: LABELS[key], isDone: done[key] }))
}

/** One finished side is enough for a result, but the guide goes on until every side has a way in and a way
 * out, so a side added later is not left half-built. */
export function nextGuideStep(document: StrategyDocument, name: string): GuideStep {
  const [nameStep, marketStep] = guideSteps(document, name)
  if (!nameStep!.isDone) return 'name'
  if (!marketStep!.isDone) return 'market'
  const unfinished = unfinishedSide(document)
  if (!unfinished) return 'done'
  return unfinished.entry === null ? 'entry' : 'exit'
}

function unfinishedSide(document: StrategyDocument): { index: number, entry: unknown } | undefined {
  const drafts = documentToDraft(document).sides
  const index = drafts.findIndex(side => side.entry === null || side.exit === null)
  return index < 0 ? undefined : { index, entry: drafts[index]!.entry }
}

/** The side the guide points at: the first one that still lacks a way in or a way out. */
export function guideSide(document: StrategyDocument): SideDocument {
  return document.sides[unfinishedSide(document)?.index ?? 0]!
}
