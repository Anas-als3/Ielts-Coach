/**
 * localStorage persistence for IELTS Coach sessions.
 *
 * Store shape (key 'ielts-coach.v1' — the key is opaque, the version is in the
 * payload):
 *   { schemaVersion: 5, sessions: SessionRecord[] }
 *
 * Versions are migrated forward on read, never discarded (see migrateSessions).
 * v1 -> v2 added SessionRecord.task; v2 -> v3 added SessionRecord.module;
 * v3 -> v4 added SessionRecord.section, the Writing/Reading discriminator;
 * v4 -> v5 added the 'listening' member of that discriminator. The rungs apply
 * in sequence, so a v1 store arriving at this build gains every field in a
 * SINGLE read. Anything this build cannot migrate is copied to a timestamped
 * 'ielts-coach.backup.<iso>' key before being replaced.
 *
 * All reads tolerate missing/corrupt data (return empty rather than throw).
 * All writes are wrapped in try/catch so a full or unavailable localStorage
 * never crashes the app — we warn on the console and keep going.
 */

import type { SessionRecord } from '../types'

const STORAGE_KEY = 'ielts-coach.v1'
const SCHEMA_VERSION = 5
/** Lowest stored version this build knows how to migrate forward from. */
const MIN_MIGRATABLE_VERSION = 1
/**
 * Data this build cannot understand is copied here before anything overwrites
 * the live key, so an unrecognised (e.g. newer) store is always recoverable by
 * hand from devtools rather than silently destroyed.
 */
const BACKUP_KEY_PREFIX = 'ielts-coach.backup.'
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
 * Shape check for a stored READING session: the answer sheet and a complete
 * marking result must both be present, so a partial record never reaches the
 * report with a band it cannot justify.
 *
 * Deliberately structural rather than exhaustive — it checks the fields the
 * report actually reads and not every leaf of every question result, matching
 * how `looksLikeSession` treats an Analysis.
 */
function looksLikeReadingSession(value: Record<string, unknown>): boolean {
  if (typeof value.testId !== 'string') return false
  if (!isRecordObject(value.answers)) return false
  const result = value.result
  if (!isRecordObject(result)) return false
  if (typeof result.raw !== 'number' || typeof result.total !== 'number') return false
  if (typeof result.band !== 'number') return false
  return Array.isArray(result.questions) && Array.isArray(result.byType)
}

/**
 * Shape check for a stored LISTENING session.
 *
 * The Reading checks plus `byFormat`, which is the field the Listening report
 * is actually built around — per-format accuracy is the coaching signal, and a
 * record missing it would reach the report with nothing to break down.
 *
 * It does NOT require `module`, because a Listening session does not have one:
 * both exams sit the same paper. It does not require `practice` either, so a
 * record hand-written before that flag existed still loads; the report treats a
 * missing flag as an exam-condition run, which is what every record predating
 * the flag would have been.
 */
function looksLikeListeningSession(value: Record<string, unknown>): boolean {
  if (typeof value.testId !== 'string') return false
  if (!isRecordObject(value.answers)) return false
  const result = value.result
  if (!isRecordObject(result)) return false
  if (typeof result.raw !== 'number' || typeof result.total !== 'number') return false
  if (typeof result.band !== 'number') return false
  return (
    Array.isArray(result.questions) &&
    Array.isArray(result.byType) &&
    Array.isArray(result.byFormat)
  )
}

/**
 * Shape check for a stored session.
 *
 * A Writing session needs id, dateISO, essayText and a complete analysis
 * (issues, structure, paragraphs, stats and band); a Reading or Listening
 * session needs its answers and its marking result. Either way a partial or
 * hand-edited record never reaches a report screen.
 *
 * `section` is optional ON THE WIRE, because pre-v4 records predate the field
 * and the migration stamps it — but present-but-unrecognised is still a reject,
 * the same rule `task` and `module` follow.
 */
function looksLikeSession(value: unknown): value is SessionRecord {
  if (!isRecordObject(value)) return false
  if (typeof value.id !== 'string' || typeof value.dateISO !== 'string') return false
  if (
    value.section !== undefined &&
    value.section !== 'writing' &&
    value.section !== 'reading' &&
    value.section !== 'listening'
  ) {
    return false
  }
  // A Reading or Listening session has no essay and no Analysis, so each is
  // validated against its own shape and returns before the writing checks
  // below. A record claiming a section whose shape it does not have — an essay
  // labelled 'listening', say — fails there and is dropped, which is the
  // behaviour an unknown section value had before this section existed.
  if (value.section === 'reading') return looksLikeReadingSession(value)
  if (value.section === 'listening') return looksLikeListeningSession(value)
  if (typeof value.essayText !== 'string') return false
  // `task` is optional on the wire: v1 records predate the field and the
  // migration stamps it. Present-but-wrong is still a reject.
  if (value.task !== undefined && value.task !== 'task1' && value.task !== 'task2') return false
  // `module` is optional on the wire: pre-v3 records predate the field and the
  // migration stamps it. Present-but-wrong is still a reject.
  if (value.module !== undefined && value.module !== 'academic' && value.module !== 'general') return false
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

/**
 * Upgrade a parsed session list from `fromVersion` to SCHEMA_VERSION, in
 * ascending single-version steps.
 *
 * A user can arrive from ANY older version, so the steps are cumulative and
 * **must never be reordered or collapsed**. A v1 store reaching this build
 * climbs all four rungs in a single read and comes out with `task`, `module`
 * and `section` all stamped; `tests/store.test.ts` pins that chain end to end.
 *
 * Plan 001 exists because a schemaVersion bump once destroyed every saved
 * session. Adding a rung is cheap; skipping one is not recoverable.
 */
function migrateSessions(sessions: SessionRecord[], fromVersion: number): SessionRecord[] {
  // The rungs run over the RAW WIRE SHAPE. A pre-v2 record genuinely has no
  // `task` and a pre-v4 record genuinely has no `section` — stamping them is
  // this function's whole job — so typing the working list as the destination
  // shape would have the compiler assert the very fields being added.
  let out = sessions as unknown as Array<Record<string, unknown>>
  let version = fromVersion

  // v1 -> v2: the `task` discriminator was added. Everything written before v2
  // was IELTS Academic Writing Task 2, because that was the only task the app
  // supported.
  if (version === 1) {
    out = out.map((s) => (s.task === undefined ? { ...s, task: 'task2' } : s))
    version = 2
  }

  // v2 -> v3: the `module` discriminator was added. Everything written before
  // v3 was IELTS Academic, because that was the only exam the app supported.
  if (version === 2) {
    out = out.map((s) => (s.module === undefined ? { ...s, module: 'academic' } : s))
    version = 3
  }

  // v3 -> v4: the `section` discriminator was added. Everything written before
  // v4 was a WRITING session, because Reading did not exist — so a stored
  // record without the field can only be an essay, a chart answer or a letter.
  if (version === 3) {
    out = out.map((s) => (s.section === undefined ? { ...s, section: 'writing' } : s))
    version = 4
  }

  // v4 -> v5: `section` gained the value 'listening'. THERE IS NO DATA CHANGE,
  // and that is the correct call rather than a gap.
  //
  // A migration rung exists to repair records that predate a field. No v4
  // record can be a Listening session — Listening did not exist — so every
  // stored record is already valid v5 data as it stands, and any rung here
  // would have to be a no-op or a lie. What the version bump buys is the
  // VALIDATOR: `looksLikeSession` now admits section 'listening', and
  // `importData` now knows a v5 export is readable while still refusing a v6
  // one. Both of those are keyed off SCHEMA_VERSION, not off a rung.
  //
  // The rung stays written out rather than folded into the one above so the
  // ladder still reads as one line per version. The next person adding a
  // section copies this shape, and a data-carrying v5 -> v6 lands below it
  // without anyone having to work out where v5 went.
  if (version === 4) {
    version = 5
  }

  return out as unknown as SessionRecord[]
}

/**
 * Copy the raw stored string to a timestamped backup key. Used before this
 * build overwrites data it could not parse or could not migrate, so nothing is
 * ever destroyed without a recoverable copy. Best-effort: a failure here is
 * warned about and never blocks the write that follows.
 */
function backupRaw(raw: string): void {
  try {
    const key = `${BACKUP_KEY_PREFIX}${new Date().toISOString()}`
    window.localStorage.setItem(key, raw)
    console.warn(
      'IELTS Coach: saved data could not be read by this version. ' +
        `A copy was kept at localStorage key "${key}" before it was replaced.`,
    )
  } catch (err) {
    console.warn('IELTS Coach: could not back up unreadable saved data before replacing it.', err)
  }
}

/**
 * Read and, where necessary, migrate the stored payload.
 *
 * - Missing key → null (a first run, nothing to back up).
 * - Corrupt JSON, wrong shape, or a version this build cannot migrate → the raw
 *   string is backed up to a timestamped key, then null is returned.
 * - A known older version → migrated forward and returned.
 *
 * Never throws.
 */
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
    backupRaw(raw)
    return null
  }
  if (!isRecordObject(parsed) || !Array.isArray(parsed.sessions)) {
    backupRaw(raw)
    return null
  }

  const version = parsed.schemaVersion
  if (typeof version !== 'number' || version < MIN_MIGRATABLE_VERSION || version > SCHEMA_VERSION) {
    // Older than we can migrate, or newer than we understand — do not guess.
    backupRaw(raw)
    return null
  }

  const valid = parsed.sessions.filter(looksLikeSession)
  return {
    schemaVersion: SCHEMA_VERSION,
    sessions: migrateSessions(valid, version),
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
  const version = parsed.schemaVersion
  if (typeof version !== 'number' || version < MIN_MIGRATABLE_VERSION) {
    throw new Error(
      'This file is too old for this app to read. ' +
        'Export a fresh copy from the app that created it, then try importing again.',
    )
  }
  if (version > SCHEMA_VERSION) {
    throw new Error(
      'This file was exported by a newer version of IELTS Coach. ' +
        'Update this app, then import again.',
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

  const sessions = migrateSessions((incoming as SessionRecord[]).slice(), version).sort(
    byDateAscending,
  )
  writeStore(capSessions(sessions))
}
