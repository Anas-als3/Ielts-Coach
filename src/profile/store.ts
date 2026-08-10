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
 * SINGLE read.
 *
 * ANY data this build is about to lose sight of is copied to a timestamped
 * 'ielts-coach.backup.<iso>' key first, and that promise is now literal rather
 * than approximate. It covers all four ways data leaves:
 *   1. the payload will not parse, or names a version we cannot migrate;
 *   2. SOME of its records fail validation and are filtered out (the likelier
 *      case by far — one truncated record from a partial write — and the case
 *      that used to vanish in silence);
 *   3. an import replaces the whole store;
 *   4. (not a loss, but the same rule) nothing is ever backed up twice: a
 *      byte-identical copy already on disk is a backup, and writing a second
 *      one per read would fill the quota that holds the learner's essays.
 *
 * All reads tolerate missing/corrupt data (return empty rather than throw).
 * All writes are wrapped in try/catch so a full or unavailable localStorage
 * never crashes the app — we warn on the console and keep going.
 */

import type { Criterion, SaveResult, SessionRecord, SessionSection } from '../types'
import { isWritingSession } from '../types'
import { byDateAscending } from './chronology'
import { loadPrefs, sanitizePrefs, savePrefs } from './prefs'

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
/**
 * Retention limit, applied PER SECTION rather than across the whole store.
 *
 * A single global cap made the sections compete for one budget, and the loser
 * was always Writing: sitting 190 Reading papers permanently deleted the
 * learner's 10 oldest essays. That inverts the entire point of the
 * `isWritingSession` guards — they exist so answer-key papers cannot DILUTE the
 * writing profile, and a section-blind cap let those same papers DELETE it.
 * An essay is also the most expensive thing in the app to replace: 40 minutes
 * of writing plus its analysis, against a Reading paper that can be re-sat.
 *
 * Per section, the limit only ever evicts like for like — Reading practice
 * pushes out old Reading practice — so no learner can lose work in one section
 * by practising another. The worst case grows from 200 records to 3 x 200, and
 * `writeStore` already survives a full quota by warning rather than throwing.
 */
const MAX_SESSIONS_PER_SECTION = 200
/**
 * How many timestamped backup copies to keep.
 *
 * Backups exist so nothing is destroyed without a recoverable copy — but a copy
 * is a full serialisation of the store, and MEASURED at ae92bac a store can
 * reach several megabytes against a typical ~5 MB origin quota. Unbounded
 * copies fill the quota holding the essays they exist to protect, which turns
 * the safety net into the thing that breaks the save.
 *
 * Newest N wins: a learner recovering by hand wants the most recent readable
 * state, and an old copy of a store that has since been read successfully many
 * times is not the one they will reach for.
 */
const MAX_BACKUPS = 5
const EXPORT_FILENAME = 'ielts-coach-data.json'

interface StoreShape {
  schemaVersion: number
  sessions: SessionRecord[]
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Every `Criterion`, derived from a totality-checked record rather than a
 * hard-coded array of four strings. Adding a member to `Criterion` without
 * adding it to `CRITERION_PRESENT` is a COMPILE failure, so `looksLikeSession`
 * below cannot silently keep checking only the original four keys once a
 * fifth criterion exists.
 */
const CRITERION_PRESENT: Record<Criterion, true> = { TR: true, CC: true, LR: true, GRA: true }
const CRITERIA = Object.keys(CRITERION_PRESENT) as Criterion[]

/**
 * Shape check for a stored READING session: the answer sheet and a complete
 * marking result must both be present, so a partial record never reaches the
 * report with a band it cannot justify.
 *
 * Deliberately structural rather than exhaustive — it checks the fields the
 * report actually reads and not every leaf of every question result, matching
 * how `looksLikeSession` treats an Analysis.
 *
 * `module` is checked here and, unlike on the writing path, it is REQUIRED
 * rather than optional-but-not-wrong. Two separate reasons, and both are about
 * a crash rather than about tidiness:
 *
 *  - It is the KEY of a lookup, not a label. `rawToBand` and the report's own
 *    `bandRowFor` both index `READING_BAND_TABLES[module]`; a record stored
 *    with `module: 'speaking'` or with no module at all used to sail through
 *    this check and then hand `undefined` to a `for...of`, throwing "table is
 *    not iterable" out of a render and blanking the WHOLE app behind the error
 *    boundary. Dropping one unreadable paper is a far smaller loss than that.
 *  - Nothing legitimate can be missing it. Reading shipped at schemaVersion 4,
 *    a version AFTER `module` was added at v3, so unlike a writing record there
 *    is no era of Reading data that predates the field and no migration rung to
 *    stamp it. A Reading record without a valid module was hand-edited or
 *    half-written, and is exactly what this validator exists to catch.
 */
function looksLikeReadingSession(value: Record<string, unknown>): boolean {
  if (value.module !== 'academic' && value.module !== 'general') return false
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
  if (!isRecordObject(band.byCriterion) || !isRecordObject(band.rationale)) return false
  if (typeof band.overall !== 'number') return false
  // `byCriterion` must carry all four criteria as finite numbers.
  //
  // `isRecordObject(band.byCriterion)` alone accepted `{}`, and the report
  // then read `undefined` through `clampBand`, which floored a non-finite
  // value to 4 — so an imported record rendered a confident "Task Response
  // 4.0" with a filled bar and a matching aria-label for a band the record
  // does not contain. `src/reading/bandTable.ts:104-106` states this
  // project's policy on exactly this: a band that low is exactly the number
  // someone acts on.
  const byCriterion = band.byCriterion
  return CRITERIA.every(
    (c) => typeof byCriterion[c] === 'number' && Number.isFinite(byCriterion[c]),
  )
}

/**
 * Keep at most MAX_SESSIONS_PER_SECTION of EACH section, dropping that
 * section's oldest (the list must already be sorted ascending).
 *
 * Walked newest-first so the survivors are the most recent per section, then
 * reversed to restore ascending order. The alternative — one global cap — meant
 * a learner who sat a run of answer-key papers had their oldest ESSAYS deleted
 * to make room, which no amount of Reading practice should ever cost them.
 *
 * A record whose `section` is absent counts as Writing, via the same
 * `isWritingSession` guard the profile uses, so the cap and the profile can
 * never disagree about what a pre-v4 record is.
 */
function capSessions(sessions: SessionRecord[]): SessionRecord[] {
  // Nothing can be over a per-section cap while the whole list is under it.
  if (sessions.length <= MAX_SESSIONS_PER_SECTION) return sessions

  const keptPerSection = new Map<SessionSection, number>()
  const kept: SessionRecord[] = []
  for (let i = sessions.length - 1; i >= 0; i--) {
    const session = sessions[i]
    const section: SessionSection = isWritingSession(session) ? 'writing' : session.section
    const n = (keptPerSection.get(section) ?? 0) + 1
    keptPerSection.set(section, n)
    if (n <= MAX_SESSIONS_PER_SECTION) kept.push(session)
  }
  kept.reverse()
  return kept
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
 * Each rung tests `version < N`, NOT `version === N - 1`, and that is the whole
 * difference between a ladder and a lucky guess. `readStore` admits any version
 * in the RANGE [1, SCHEMA_VERSION], so `2.5` — a half-written store, a build
 * that shipped a fractional version, a hand-edited payload — reached here and
 * matched no `===` rung at all: zero steps ran, the store was stamped 5 on the
 * next write, and every record kept `task`, `module` and `section` undefined
 * forever. With `<`, anything below a rung climbs it. The stamps are already
 * conditional on the field being absent, so climbing a rung a record did not
 * need is a no-op rather than an overwrite.
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
  if (version < 2) {
    out = out.map((s) => (s.task === undefined ? { ...s, task: 'task2' } : s))
    version = 2
  }

  // v2 -> v3: the `module` discriminator was added. Everything written before
  // v3 was IELTS Academic, because that was the only exam the app supported.
  if (version < 3) {
    out = out.map((s) => (s.module === undefined ? { ...s, module: 'academic' } : s))
    version = 3
  }

  // v3 -> v4: the `section` discriminator was added. Everything written before
  // v4 was a WRITING session, because Reading did not exist — so a stored
  // record without the field can only be an essay, a chart answer or a letter.
  if (version < 4) {
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
  if (version < 5) {
    version = 5
  }

  return out as unknown as SessionRecord[]
}

/**
 * Is this exact payload already sitting in a backup key?
 *
 * Backing up is triggered by READS, and a read is pure — it does not repair the
 * live key — so the same damaged payload is seen again on every single read.
 * Without this check one truncated record would mint a fresh backup per render,
 * and the quota those copies eat is the same quota holding the essays we are
 * trying to protect. A byte-identical copy IS the backup; a second one is not a
 * second safety net.
 */
function hasIdenticalBackup(raw: string): boolean {
  const storage = window.localStorage
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key === null || !key.startsWith(BACKUP_KEY_PREFIX)) continue
    if (storage.getItem(key) === raw) return true
  }
  return false
}

/**
 * A backup key that is not already taken.
 *
 * `toISOString()` has millisecond resolution and `setItem` overwrites, so two
 * DIFFERENT payloads backed up inside the same millisecond used to collapse
 * into one key — the first was destroyed while the console said a copy had been
 * kept. Measured: three damaged payloads read in sequence on a frozen clock
 * produced ONE key holding only the third. This module's contract is that
 * nothing is ever destroyed without a recoverable copy; this was the line that
 * broke it.
 *
 * The suffix is a counter rather than a random salt so the keys still sort by
 * age as text, which is what the pruning in `pruneBackups` relies on.
 */
function nextBackupKey(): string {
  const stamp = `${BACKUP_KEY_PREFIX}${new Date().toISOString()}`
  if (window.localStorage.getItem(stamp) === null) return stamp
  // Guard the loop with a small bound so a pathological store cannot spin
  // forever. Exhausting it throws, which the caller (`backupRaw`) already
  // treats as a best-effort failure — losing the backup is bad, but crashing
  // the read or write that triggered it would be worse.
  const BOUND = 1000
  // Zero-padded to BOUND's own width: an UNPADDED counter sorts "-10" before
  // "-9" as text, which would make `pruneBackups` evict a NEWER same-
  // millisecond backup while keeping an older one — the exact ordering bug
  // this suffix scheme exists to avoid. Padding keeps every suffix in this
  // function's range the same length, so text order stays numeric order.
  const width = String(BOUND).length
  for (let i = 1; i <= BOUND; i++) {
    const key = `${stamp}-${String(i).padStart(width, '0')}`
    if (window.localStorage.getItem(key) === null) return key
  }
  throw new Error(`IELTS Coach: could not find a free backup key after ${BOUND} attempts.`)
}

/** How many timestamped backup keys currently exist. */
function backupCount(): number {
  const storage = window.localStorage
  let n = 0
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key !== null && key.startsWith(BACKUP_KEY_PREFIX)) n++
  }
  return n
}

/**
 * Delete the oldest timestamped backups until at most `keep` remain.
 *
 * Keys sort by age as plain text — see `nextBackupKey` — so the oldest are
 * simply the first `length - keep` after a lexicographic sort.
 *
 * This is the ONE function in the codebase that deletes a learner's data.
 * Routing every eviction through it — including the single-backup eviction
 * the write retry needs (`pruneBackups(backupCount() - 1)`) — keeps that
 * scrutiny in one place instead of a second, easier-to-miss deletion site.
 *
 * Wrapped in ITS OWN try/catch, separate from `backupRaw`'s: a failure here
 * must never read back as "could not back up saved data" — the backup this
 * call follows already succeeded — and it must never block the read or write
 * that triggered it either.
 */
function pruneBackups(keep: number): void {
  try {
    const storage = window.localStorage
    const keys: string[] = []
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (key !== null && key.startsWith(BACKUP_KEY_PREFIX)) keys.push(key)
    }
    keys.sort()
    for (let i = 0; i < keys.length - keep; i++) storage.removeItem(keys[i])
  } catch (err) {
    console.warn('IELTS Coach: could not prune old backup copies.', err)
  }
}

/**
 * Copy the raw stored string to a timestamped backup key. Used whenever this
 * build is about to lose sight of stored data — because it could not parse it,
 * could not migrate it, had to drop some of its records, or is replacing it
 * with an import — so nothing is ever destroyed without a recoverable copy.
 *
 * Best-effort: a failure here is warned about and never blocks the read or
 * write that follows. Losing the backup is bad; refusing to load the app
 * because the backup failed would be worse.
 *
 * @param reason Learner-facing sentence naming what happened, so the console
 *   line says which of the four cases fired rather than always claiming the
 *   whole store was unreadable.
 */
function backupRaw(raw: string, reason: string): void {
  try {
    if (hasIdenticalBackup(raw)) return
    const key = nextBackupKey()
    window.localStorage.setItem(key, raw)
    console.warn(
      `IELTS Coach: ${reason} ` +
        `A copy of the data as it was stored was kept at localStorage key "${key}".`,
    )
    pruneBackups(MAX_BACKUPS)
  } catch (err) {
    console.warn('IELTS Coach: could not back up saved data before replacing it.', err)
  }
}

/**
 * Back up whatever is in the live key right now, before a caller overwrites it.
 *
 * Used by `importData`, which REPLACES the store outright: an import is the one
 * destructive action a learner can trigger by hand, from a file picker, with no
 * undo — and, unlike every other path here, the data it destroys was perfectly
 * readable. A missing key means a first run, and there is nothing to keep.
 */
function backupCurrentStore(reason: string): void {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw !== null) backupRaw(raw, reason)
  } catch (err) {
    console.warn('IELTS Coach: could not back up saved data before replacing it.', err)
  }
}

/**
 * Read and, where necessary, migrate the stored payload.
 *
 * - Missing key → null (a first run, nothing to back up).
 * - Corrupt JSON, wrong shape, or a version this build cannot migrate → the raw
 *   string is backed up to a timestamped key, then null is returned.
 * - A known older version, but SOME records fail validation → the raw string is
 *   backed up too, and the records that did validate are returned.
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
    backupRaw(raw, 'your saved data could not be read by this version of the app.')
    return null
  }
  if (!isRecordObject(parsed) || !Array.isArray(parsed.sessions)) {
    backupRaw(raw, 'your saved data was not in the shape this version of the app expects.')
    return null
  }

  const version = parsed.schemaVersion
  if (typeof version !== 'number' || version < MIN_MIGRATABLE_VERSION || version > SCHEMA_VERSION) {
    // Older than we can migrate, or newer than we understand — do not guess.
    backupRaw(raw, 'your saved data was written by a version of the app this one cannot read.')
    return null
  }

  const valid = parsed.sessions.filter(looksLikeSession)
  if (valid.length !== parsed.sessions.length) {
    // PER-RECORD rejection, and the reason this branch exists. The whole-store
    // failures above are the loud, rare cases; a single record damaged by a
    // write that was interrupted — a closed tab, a full disk — is the common
    // one, and it used to disappear here without a copy and without a word.
    // The next write persists the filtered list, so by then the only remaining
    // copy of that session is this backup. `importData` refuses the entire file
    // over one bad record; a read cannot be that strict without locking a
    // learner out of their history, so it keeps what it can AND keeps the rest.
    backupRaw(
      raw,
      `${parsed.sessions.length - valid.length} of your ${parsed.sessions.length} saved sessions ` +
        'could not be read by this version of the app and were left out.',
    )
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    sessions: migrateSessions(valid, version),
  }
}

/**
 * `err` is the DOMException `setItem` throws when a write exceeds the
 * origin's storage quota. Distinguished from every other write failure
 * (storage disabled, private-browsing restrictions, a non-browser
 * environment) so the learner-facing message can say which one happened.
 */
function isQuotaError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === 'QuotaExceededError' ||
      // Firefox's legacy name for the same condition.
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

function quotaFailure(): SaveResult {
  return {
    ok: false,
    reason: 'quota',
    message:
      "Your device is out of storage space, so this could not be saved. Export your data now " +
      "from Progress, before you write anything else — once space frees up you can import it back.",
  }
}

function unavailableFailure(): SaveResult {
  return {
    ok: false,
    reason: 'unavailable',
    message:
      'Your browser storage is unavailable right now (private browsing can do this), so this ' +
      'could not be saved. Export your data now from Progress, before you write anything else, ' +
      'so nothing is lost.',
  }
}

/**
 * Write the store and report what happened — `saveSession` returns this so a
 * caller can tell the learner rather than have a failed save look identical
 * to a successful one.
 *
 * On failure, tries ONCE more after evicting the oldest backup.
 *
 * A quota failure is the one case where this module is holding something it
 * can give up: an old backup copy. Evicting the oldest and retrying once
 * spends a recovery copy to save the thing the copies exist to protect — a
 * learner's essay, which is 40 minutes of work and cannot be re-run, against
 * a snapshot of a store that has since been read successfully.
 * ONCE, not in a loop: if a second attempt fails too, the store is full of
 * sessions rather than of backups, and the honest answer is to tell the
 * learner rather than to keep deleting their history to make room.
 */
function writeStore(sessions: SessionRecord[]): SaveResult {
  const store: StoreShape = { schemaVersion: SCHEMA_VERSION, sessions }
  const json = JSON.stringify(store)
  try {
    window.localStorage.setItem(STORAGE_KEY, json)
    return { ok: true }
  } catch {
    // Evict exactly one backup — the oldest — rather than re-applying the
    // whole cap: a quota failure needs ONE slot back to try again, not every
    // backup but MAX_BACKUPS - 1 gone. `pruneBackups` never throws, so this
    // can never turn a save failure into a crash — but `backupCount` reads
    // `storage.length` / `.key()` OUTSIDE that guard, and storage being
    // unavailable (rather than merely full) can make those throw too. Wrapped
    // here so counting the backups can fail exactly like everything else in
    // this module: best-effort, never the thing that turns a save failure
    // into a crash instead of a reported one.
    try {
      const count = backupCount()
      if (count > 0) pruneBackups(count - 1)
    } catch (evictErr) {
      console.warn('IELTS Coach: could not evict an old backup to make room for this save.', evictErr)
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, json)
      return { ok: true }
    } catch (retryErr) {
      // Quota exceeded or storage blocked — the app keeps working in memory.
      console.warn(
        'IELTS Coach: could not save your session (storage is full or unavailable). ' +
          'The app keeps working, but this change will not persist.',
        retryErr,
      )
      return isQuotaError(retryErr) ? quotaFailure() : unavailableFailure()
    }
  }
}

/** All saved sessions, oldest first. Returns [] on missing, corrupt, or wrong-version data. */
export function loadSessions(): SessionRecord[] {
  const store = readStore()
  return store ? store.sessions : []
}

/**
 * Append a session, keep the list sorted by date, cap at
 * MAX_SESSIONS_PER_SECTION per section (oldest of that section dropped), and
 * report whether the write actually persisted — callers used to get `void`
 * here and had no way to tell a silent failure from a success.
 */
export function saveSession(s: SessionRecord): SaveResult {
  // Replace any record with the same id so a double-save never duplicates.
  const sessions = loadSessions().filter((existing) => existing.id !== s.id)
  sessions.push(s)
  sessions.sort(byDateAscending)
  return writeStore(capSessions(sessions))
}

/** Remove one session by id. Unknown ids are a no-op. */
export function deleteSession(id: string): void {
  const sessions = loadSessions()
  const remaining = sessions.filter((s) => s.id !== id)
  if (remaining.length === sessions.length) return
  writeStore(remaining)
}

/**
 * The export payload as a JSON string. Split from exportData so the engine
 * tests can pin the payload without a DOM (Blob/anchor stay in exportData).
 *
 * Prefs ride along ADDITIVELY: importData has never enumerated keys — it
 * reads schemaVersion and sessions and ignores the rest — so an older build
 * importing a newer file keeps working, and the field is omitted when empty
 * so a prefs-less export is byte-identical to today's.
 */
export function buildExportJson(): string {
  const prefs = loadPrefs()
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    sessions: loadSessions(),
    ...(Object.keys(prefs).length > 0 ? { prefs } : {}),
  }
  return JSON.stringify(payload, null, 2)
}

/** Download the full store as pretty-printed JSON named ielts-coach-data.json. */
export function exportData(): void {
  const json = buildExportJson()
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
 *
 * The existing store is copied to a backup key first. This is the only
 * destructive action in the app a learner reaches through a file picker: one
 * wrong file — last month's export, a sibling's — and a whole history of essays
 * is gone, with no undo anywhere in the UI. Every other path in this file backs
 * up before it clobbers; the one that clobbers on purpose has the least excuse
 * not to.
 *
 * The backup is taken AFTER validation, so a file that is going to be rejected
 * never mints a backup of data nothing was going to touch.
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

  // Deduplicate by id, last occurrence winning — the same rule `saveSession`
  // applies when it filters the id it is about to push. Two records sharing an
  // id are not two sessions: they collide as React keys in the history list,
  // and `deleteSession(id)` removes BOTH, so deleting an essay can silently
  // take a Reading paper with it. A file can carry them (it may have been
  // hand-merged from two exports); the store must not.
  const deduplicated = new Map<string, SessionRecord>()
  for (const session of incoming as SessionRecord[]) deduplicated.set(session.id, session)

  const sessions = migrateSessions(Array.from(deduplicated.values()), version).sort(byDateAscending)
  backupCurrentStore('your saved sessions were replaced by an imported file.')
  writeStore(capSessions(sessions))

  // Prefs ride the export additively (see buildExportJson). Restore them the
  // same way they are read from disk: sanitized field-by-field, so a
  // hand-edited file with one hostile number still restores its good fields —
  // and a file from before prefs existed leaves the current prefs untouched.
  if (isRecordObject(parsed.prefs)) savePrefs(sanitizePrefs(parsed.prefs))
}
