/**
 * Small durable UI preferences — a SEPARATE localStorage key from the session
 * store, so a preference write can never race or damage learners' work and
 * `ielts-coach.v1`'s schemaVersion + migration ladder stay about session data
 * only.
 *
 * Contract (plan 026 defines it, plan 027 extends it): one flat JSON object;
 * fields are ADDITIVE and optional; nothing is renamed or repurposed. Reads
 * validate field-by-field against hostile data — a malformed blob or a
 * wrong-typed field is discarded, never crashed on, because losing a
 * dismissed-intro flag costs one extra card while throwing on mount costs the
 * app. Writes MERGE over the raw stored object, so a field this build does
 * not know about (e.g. one written by a newer build) survives a round-trip.
 *
 * "Migration" here is field-by-field validation on read, not a version
 * ladder: the record is a handful of independent optional scalars, so a
 * hostile value in one field is dropped alone rather than versioned around —
 * there is no ordering between fields for a ladder to preserve.
 */
import type { Prefs, SessionSection } from '../types'

export const PREFS_KEY = 'ielts-coach.prefs.v1'

const SECTION_KEYS: SessionSection[] = ['writing', 'reading', 'listening']

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The stored blob as an object, or {} when missing, malformed, or blocked. */
function readRaw(): Record<string, unknown> {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!isRecordObject(parsed)) return {}
    return parsed
  } catch {
    // Malformed JSON or storage blocked — behave as "no preferences saved".
    return {}
  }
}

/** True for 4.0–9.0 in half steps — the only bands IELTS awards. */
function isHalfBand(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 4 && n <= 9 && Number.isInteger(n * 2)
}

/** True for a real calendar date written 'YYYY-MM-DD'. Reject rollover
 *  ('2026-13-40' normalises to a different date — round-trip the components). */
function isCalendarDate(s: unknown): s is string {
  if (typeof s !== 'string') return false
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return false
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const d = new Date(year, month - 1, day)
  // A rollover date (e.g. 2026-13-40) normalises to a DIFFERENT date under
  // the Date constructor — round-tripping the components back out is what
  // catches that, rather than trusting the regex shape alone.
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day
}

/**
 * Keep only the fields this build understands AND that hold valid values.
 * Field-by-field, not record-level: one hostile number must not destroy a
 * good exam date sitting beside it. Unknown fields are dropped HERE (the app
 * never acts on data it cannot validate) but preserved on DISK by savePrefs.
 */
export function sanitizePrefs(value: unknown): Prefs {
  if (!isRecordObject(value)) return {}
  const prefs: Prefs = {}

  if (typeof value.introDismissedAtISO === 'string') {
    prefs.introDismissedAtISO = value.introDismissedAtISO
  }
  if (isCalendarDate(value.examDateISO)) {
    prefs.examDateISO = value.examDateISO
  }
  if (isHalfBand(value.targetOverall)) {
    prefs.targetOverall = value.targetOverall
  }
  if (isRecordObject(value.targetBySection)) {
    const bySection: Partial<Record<SessionSection, number>> = {}
    for (const key of SECTION_KEYS) {
      const candidate = value.targetBySection[key]
      if (isHalfBand(candidate)) bySection[key] = candidate
    }
    if (Object.keys(bySection).length > 0) prefs.targetBySection = bySection
  }
  if (value.module === 'academic' || value.module === 'general') {
    prefs.module = value.module
  }

  return prefs
}

/** Parse + sanitize the stored payload. Missing key, corrupt JSON, or a
 *  non-object payload → {}. Never throws. */
export function loadPrefs(): Prefs {
  return sanitizePrefs(readRaw())
}

/**
 * MERGE-ON-WRITE: read the RAW stored object (unvalidated), spread it, apply
 * the patch, write. This is what lets plan 026's introDismissedAtISO — or any
 * future field — survive a save from a build that has never heard of it.
 * A key explicitly present in the patch with value `undefined` clears that
 * field (JSON.stringify drops undefined properties). Write failures warn to
 * the console and never throw, matching writeStore (store.ts:446-458).
 */
export function savePrefs(patch: Partial<Prefs>): void {
  try {
    const merged = { ...readRaw(), ...patch }
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(merged))
  } catch (err) {
    console.warn(
      'IELTS Coach: could not save your preferences (storage is full or unavailable). ' +
        'The app keeps working, but this change will not persist.',
      err,
    )
  }
}

/**
 * Whole calendar days from `now` to the exam date; 0 = today, negative =
 * past, null = unparseable. Compares LOCAL midnights and rounds, so a DST
 * hour cannot make "in 10 days" print as 9. `now` is a parameter so the
 * engine tests need no fake timers.
 */
export function daysUntil(examDateISO: string, now: Date): number | null {
  if (!isCalendarDate(examDateISO)) return null
  const [year, month, day] = examDateISO.split('-').map(Number)
  const examMidnight = new Date(year, month - 1, day).getTime()
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  return Math.round((examMidnight - nowMidnight) / MS_PER_DAY)
}
