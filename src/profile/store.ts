/**
 * localStorage persistence for IELTS Coach sessions.
 *
 * Store shape (key 'ielts-coach.v1'):
 *   { schemaVersion: 1, sessions: SessionRecord[] }
 *
 * All reads tolerate missing/corrupt data (return empty rather than throw).
 * All writes are wrapped in try/catch so a full or unavailable localStorage
 * never crashes the app — we warn on the console and keep going.
 */

import type { SessionRecord } from '../types'

const STORAGE_KEY = 'ielts-coach.v1'
const SCHEMA_VERSION = 1
const MAX_SESSIONS = 200
const EXPORT_FILENAME = 'ielts-coach-data.json'

interface StoreShape {
  schemaVersion: number
  sessions: SessionRecord[]
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Shape check for a stored session: id, dateISO, essayText, and a complete
 * analysis (issues, structure, paragraphs, stats and band) must all be present
 * so a partial or hand-edited record never reaches the report screen.
 */
function looksLikeSession(value: unknown): value is SessionRecord {
  if (!isRecordObject(value)) return false
  if (typeof value.id !== 'string' || typeof value.dateISO !== 'string') return false
  if (typeof value.essayText !== 'string') return false
  const a = value.analysis
  if (!isRecordObject(a)) return false
  if (!Array.isArray(a.issues) || !a.issues.every(isRecordObject)) return false
  if (!Array.isArray(a.structure) || !a.structure.every(isRecordObject)) return false
  if (!Array.isArray(a.paragraphs)) return false
  if (!isRecordObject(a.stats) || typeof (a.stats as Record<string, unknown>).wordCount !== 'number') return false
  const band = a.band
  if (!isRecordObject(band)) return false
  return isRecordObject(band.byCriterion) && isRecordObject(band.rationale) && typeof band.overall === 'number'
}

/** Ascending by dateISO (oldest first). ISO-8601 strings sort correctly as text. */
function byDateAscending(a: SessionRecord, b: SessionRecord): number {
  return a.dateISO.localeCompare(b.dateISO)
}

/** Keep at most MAX_SESSIONS, dropping the oldest (list must already be sorted ascending). */
function capSessions(sessions: SessionRecord[]): SessionRecord[] {
  return sessions.length > MAX_SESSIONS ? sessions.slice(sessions.length - MAX_SESSIONS) : sessions
}

function readStore(): StoreShape | null {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch (err) {
    console.warn('IELTS Coach: could not read saved sessions (storage unavailable).', err)
    return null
  }
  if (raw === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Corrupt JSON — treat as an empty store rather than crashing.
    return null
  }
  if (!isRecordObject(parsed)) return null
  if (parsed.schemaVersion !== SCHEMA_VERSION) return null
  if (!Array.isArray(parsed.sessions)) return null

  return {
    schemaVersion: SCHEMA_VERSION,
    sessions: parsed.sessions.filter(looksLikeSession),
  }
}

function writeStore(sessions: SessionRecord[]): void {
  const store: StoreShape = { schemaVersion: SCHEMA_VERSION, sessions }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch (err) {
    // Quota exceeded or storage blocked — the app keeps working in memory.
    console.warn(
      'IELTS Coach: could not save your session (storage is full or unavailable). ' +
        'The app keeps working, but this change will not persist.',
      err,
    )
  }
}

/** All saved sessions, oldest first. Returns [] on missing, corrupt, or wrong-version data. */
export function loadSessions(): SessionRecord[] {
  const store = readStore()
  return store ? store.sessions : []
}

/** Append a session, keep the list sorted by date, cap at 200 (oldest dropped). */
export function saveSession(s: SessionRecord): void {
  // Replace any record with the same id so a double-save never duplicates.
  const sessions = loadSessions().filter((existing) => existing.id !== s.id)
  sessions.push(s)
  sessions.sort(byDateAscending)
  writeStore(capSessions(sessions))
}

/** Remove one session by id. Unknown ids are a no-op. */
export function deleteSession(id: string): void {
  const sessions = loadSessions()
  const remaining = sessions.filter((s) => s.id !== id)
  if (remaining.length === sessions.length) return
  writeStore(remaining)
}

/** Download the full store as pretty-printed JSON named ielts-coach-data.json. */
export function exportData(): void {
  const store: StoreShape = { schemaVersion: SCHEMA_VERSION, sessions: loadSessions() }
  const json = JSON.stringify(store, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = EXPORT_FILENAME
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

/**
 * Validate an exported JSON string and REPLACE the store with it.
 * Throws an Error with a learner-facing message when the input is not valid
 * IELTS Coach data — callers should catch and show the message.
 */
export function importData(json: string): void {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error(
      'That file is not valid JSON. Choose the ielts-coach-data.json file you exported from this app.',
    )
  }
  if (!isRecordObject(parsed)) {
    throw new Error(
      'That file does not look like IELTS Coach data. Choose a file exported from this app.',
    )
  }
  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      'This file uses a different data version than this app understands. ' +
        'Export a fresh copy from the app that created it, then try importing again.',
    )
  }
  if (!Array.isArray(parsed.sessions)) {
    throw new Error(
      'This file is missing its sessions list. Choose a complete file exported from IELTS Coach.',
    )
  }
  const incoming = parsed.sessions as unknown[]
  for (let i = 0; i < incoming.length; i++) {
    if (!looksLikeSession(incoming[i])) {
      throw new Error(
        `Session ${i + 1} in this file is incomplete (missing its id, date, or analysis). ` +
          'The file may have been edited or truncated — export a fresh copy and try again.',
      )
    }
  }

  const sessions = (incoming as SessionRecord[]).slice().sort(byDateAscending)
  writeStore(capSessions(sessions))
}
