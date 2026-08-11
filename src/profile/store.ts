/**
 * localStorage persistence for IELTS Coach sessions.
 *
 * Store shape (key 'ielts-coach.v1' — the key is opaque, the version is in the
 * payload):
 *   { schemaVersion: 6, sessions: SessionRecord[], deletedIds: string[] }
 *
 * Versions are migrated forward on read, never discarded (see migrateSessions).
 * v1 -> v2 added SessionRecord.task; v2 -> v3 added SessionRecord.module;
 * v3 -> v4 added SessionRecord.section, the Writing/Reading discriminator;
 * v4 -> v5 added the 'listening' member of that discriminator; v5 -> v6 added
 * StoreShape.deletedIds, the delete tombstones a merge-import needs so a
 * session removed on one device is never resurrected by another device's
 * copy (see capDeletedIds and importData's merge mode). The rungs apply
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

import type {
  Criterion,
  ImportMode,
  ImportSummary,
  SaveResult,
  SessionRecord,
  SessionSection,
} from '../types'
import { isWritingSession } from '../types'
import { byDateAscending } from './chronology'
import { loadPrefs, sanitizePrefs, savePrefs } from './prefs'

const STORAGE_KEY = 'ielts-coach.v1'
const SCHEMA_VERSION = 6
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
 * How many delete tombstones to keep (newest wins).
 *
 * A tombstone is ~40 bytes of id, but "per delete, forever" is still unbounded
 * growth inside the same quota that holds the essays — an id can outlive its
 * session by years and the list would only ever grow. 500 is far beyond the
 * store's own live ceiling (3 sections x MAX_SESSIONS_PER_SECTION = 600 live
 * records): to WANT more than 500 tombstones a learner must have deleted more
 * sessions one by one than the store can even hold, and the oldest tombstones
 * are the ones whose sessions are least likely to still exist on any other
 * device. Dropping an old tombstone risks, at worst, one resurrected record on
 * a merge with a very stale file — recoverable by deleting it again — while an
 * unbounded list risks the quota, which loses essays.
 */
const MAX_DELETED_IDS = 500
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
/**
 * The export file's name, minus its date — plan 016 froze the export format
 * within its own scope, but the filename now carries the export's date (see
 * `buildExport`), so a bare constant filename is no longer accurate. Also
 * used to build the import JSON-parse error's learner-facing copy, so the
 * two names can never drift apart.
 */
const EXPORT_FILENAME_PREFIX = 'ielts-coach-data'

interface StoreShape {
  schemaVersion: number
  sessions: SessionRecord[]
  /** Ids the learner explicitly deleted. See MAX_DELETED_IDS for why capped. */
  deletedIds: string[]
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
 *
 * **Cap eviction is NOT a delete.** This function must never write a
 * tombstone for a record it drops — only the learner's explicit
 * `deleteSession` does that (see `capDeletedIds` / `MAX_DELETED_IDS`).
 * Otherwise a future sync would turn a local retention policy into global
 * history loss: this device evicting record 201 must not tell every other
 * device, via a merge-import, to destroy its own copy of that same record.
 * This function taking no `deletedIds` parameter and returning none is that
 * rule enforced by the type signature, not only by the comment.
 *
 * Reports `evictedCount` alongside the survivors: `saveSession`'s eviction is
 * the documented per-section retention policy and ignores it, but merging two
 * devices each already near the cap can silently evict on import, and the
 * learner must be told (see `ImportSummary`).
 */
function capSessions(sessions: SessionRecord[]): { kept: SessionRecord[]; evictedCount: number } {
  // Nothing can be over a per-section cap while the whole list is under it.
  if (sessions.length <= MAX_SESSIONS_PER_SECTION) return { kept: sessions, evictedCount: 0 }

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
  return { kept, evictedCount: sessions.length - kept.length }
}

/**
 * Deduplicate and cap a tombstone list at `MAX_DELETED_IDS`, keeping the
 * NEWEST ids (the tail of the append-ordered list).
 *
 * A repeated id keeps its LAST occurrence's position rather than its first:
 * an id can only be deleted once at a time this device knows about, so a
 * later occurrence (from a merged file, say) is the more recent fact about
 * when the deletion became known here, not a stale duplicate to discard.
 */
function capDeletedIds(ids: string[]): string[] {
  const deduped: string[] = []
  const seen = new Set<string>()
  // Walk from the end so each id's LAST occurrence decides its position,
  // then reverse back into append (oldest-first) order.
  for (let i = ids.length - 1; i >= 0; i--) {
    const id = ids[i]
    if (seen.has(id)) continue
    seen.add(id)
    deduped.push(id)
  }
  deduped.reverse()
  return deduped.length > MAX_DELETED_IDS ? deduped.slice(deduped.length - MAX_DELETED_IDS) : deduped
}

/**
 * Upgrade a parsed session list from `fromVersion` to SCHEMA_VERSION, in
 * ascending single-version steps.
 *
 * A user can arrive from ANY older version, so the steps are cumulative and
 * **must never be reordered or collapsed**. A v1 store reaching this build
 * climbs all five rungs in a single read and comes out with `task`, `module`
 * and `section` all stamped; `tests/store.test.ts` pins that chain end to end.
 *
 * Each rung tests `version < N`, NOT `version === N - 1`, and that is the whole
 * difference between a ladder and a lucky guess. `readStore` admits any version
 * in the RANGE [1, SCHEMA_VERSION], so `2.5` — a half-written store, a build
 * that shipped a fractional version, a hand-edited payload — reached here and
 * matched no `===` rung at all: zero steps ran, the store was stamped 6 on the
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

  // v5 -> v6: StoreShape gained `deletedIds` — a STORE-level field, not a
  // record field, so there is nothing to stamp onto a session here.
  // `readStore` supplies the [] default when the payload predates the field;
  // this rung exists so the ladder still reads one line per version and so
  // `importData` knows a v6 export is readable while refusing a v7 one.
  if (version < 6) {
    version = 6
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
 * - `deletedIds` missing (any payload older than v6) → defaults to [], which
 *   IS the migration for that field — see the note above the return below.
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

  // `deletedIds` is hostile input exactly like `sessions`: a v5 (or older)
  // payload has no such key at all, and the [] default here IS the v5 -> v6
  // migration for this STORE-level field — there is no record to stamp it
  // onto, so `migrateSessions`' v5 -> v6 rung is a version bump only.
  const rawDeletedIds: unknown = parsed.deletedIds
  const deletedIds = capDeletedIds(
    Array.isArray(rawDeletedIds)
      ? rawDeletedIds.filter((d): d is string => typeof d === 'string')
      : [],
  )

  return {
    schemaVersion: SCHEMA_VERSION,
    sessions: migrateSessions(valid, version),
    deletedIds,
  }
}

/**
 * `readStore`, but never null — an empty store rather than a missing one.
 * Every mutation below (`saveSession`, `deleteSession`, `importData`) reads
 * through this so sessions and tombstones come from ONE read, never two
 * separate calls that could observe two different writes in between.
 */
function loadStore(): StoreShape {
  return readStore() ?? { schemaVersion: SCHEMA_VERSION, sessions: [], deletedIds: [] }
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
function writeStore(sessions: SessionRecord[], deletedIds: string[]): SaveResult {
  const store: StoreShape = { schemaVersion: SCHEMA_VERSION, sessions, deletedIds }
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
  const store = loadStore()
  // Replace any record with the same id so a double-save never duplicates.
  const sessions = store.sessions.filter((existing) => existing.id !== s.id)
  sessions.push(s)
  sessions.sort(byDateAscending)
  // A deliberate re-save wins over a stale tombstone: the invariant this
  // module keeps is that no id ever appears in both `sessions` and
  // `deletedIds` at once. Without this, resurrecting a session by saving it
  // again would leave a tombstone that a later merge could use to delete it
  // right back out.
  const deletedIds = store.deletedIds.filter((d) => d !== s.id)
  // The eviction count is ignored here: a single session's cap eviction is
  // the documented per-section retention policy, not news to the caller —
  // `importData`'s merge/replace surfaces its own count instead.
  const { kept } = capSessions(sessions)
  return writeStore(kept, deletedIds)
}

/** Remove one session by id. Unknown ids are a no-op. */
export function deleteSession(id: string): void {
  const store = loadStore()
  const remaining = store.sessions.filter((s) => s.id !== id)
  if (remaining.length === store.sessions.length) return
  // A tombstone must testify to a REAL deletion this device performed — an
  // unknown id above returned already, so nothing is appended for a session
  // that never existed here. Recording one anyway would let a future merge
  // subtract a record this device never even saw, which is not what "the
  // learner deleted this" means.
  const deletedIds = capDeletedIds([...store.deletedIds.filter((d) => d !== id), id])
  writeStore(remaining, deletedIds)
}

/**
 * The export payload, and the ONE `exportedAtISO` clock read both
 * `buildExportJson` and `buildExport` derive from — a second `new Date()`
 * between building the payload and naming the file could straddle midnight
 * and stamp a filename date that contradicts the payload's own timestamp.
 *
 * Sessions and tombstones come from a single `loadStore()` read, matching
 * every mutation in this file. Prefs ride along ADDITIVELY: `importData` has
 * never enumerated keys — it reads the fields it knows and ignores the rest
 * — so an older build importing a newer file keeps working, and the field is
 * omitted when empty so a prefs-less export stays exactly as small as before.
 */
function buildExportPayload(): { json: string; exportedAtISO: string } {
  const prefs = loadPrefs()
  const store = loadStore()
  const exportedAtISO = new Date().toISOString()
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    exportedAtISO,
    sessions: store.sessions,
    deletedIds: store.deletedIds,
    ...(Object.keys(prefs).length > 0 ? { prefs } : {}),
  }
  return { json: JSON.stringify(payload, null, 2), exportedAtISO }
}

/**
 * The export payload as a JSON string alone. Split from `exportData` so the
 * engine tests can pin the payload without a DOM (Blob/anchor stay in
 * `exportData`); kept as its own export (rather than folded into
 * `buildExport`) because existing callers already read it this way.
 */
export function buildExportJson(): string {
  return buildExportPayload().json
}

/**
 * The export payload and its dated filename, sharing the ONE clock read in
 * `buildExportPayload` — see that function's doc comment for why a second
 * clock read would be a bug, not a simplification.
 */
export function buildExport(): { json: string; filename: string } {
  const { json, exportedAtISO } = buildExportPayload()
  return { json, filename: `${EXPORT_FILENAME_PREFIX}-${exportedAtISO.slice(0, 10)}.json` }
}

/** Download the full store as pretty-printed, dated JSON. */
export function exportData(): void {
  const { json, filename } = buildExport()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

/**
 * Validate an exported JSON string and reconcile it against the store,
 * either MERGING it in (`mode: 'merge'`, the UI's default) or REPLACING the
 * store with it outright (`mode: 'replace'`, the default here so every
 * pre-existing call site and test keeps its exact old behaviour).
 * Throws an Error with a learner-facing message when the input is not valid
 * IELTS Coach data — callers should catch and show the message.
 *
 * The existing store is copied to a backup key first, AFTER validation (a
 * file that is going to be rejected never mints a backup of data nothing was
 * going to touch) and BEFORE the write. `replace` is the only destructive
 * action in the app a learner reaches through a file picker with no undo in
 * the UI; `merge` is not destructive by design (see the resurrect-prevention
 * comment below) but backs up too, since a merge still rewrites the live key.
 *
 * Returns an `ImportSummary` so the caller can tell the learner what
 * happened, including an eviction count — merging two devices each already
 * near the per-section cap can silently evict on import.
 */
export function importData(json: string, mode: ImportMode = 'replace'): ImportSummary {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error(
      `That file is not valid JSON. Choose an ${EXPORT_FILENAME_PREFIX} file you exported from this app.`,
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

  // The file's own tombstones, parsed exactly as hostile as `readStore`
  // parses the live key's: missing or malformed -> []. A pre-v6 file simply
  // has none.
  const rawFileDeletedIds: unknown = parsed.deletedIds
  const fileDeletedIds = Array.isArray(rawFileDeletedIds)
    ? rawFileDeletedIds.filter((d): d is string => typeof d === 'string')
    : []

  // Migrate BEFORE deduplicating: order does not matter for the dedupe (it
  // keys on `id`, which no rung ever touches) but matters for merge's union
  // below, which needs every incoming record already carrying its stamps.
  const migratedIncoming = migrateSessions(incoming as SessionRecord[], version)
  // Deduplicate the FILE's own records by id, last occurrence winning — the
  // same rule `saveSession` applies when it filters the id it is about to
  // push. Two records sharing an id are not two sessions: they collide as
  // React keys in the history list, and `deleteSession(id)` removes BOTH, so
  // deleting an essay can silently take a Reading paper with it. A file can
  // carry them (it may have been hand-merged from two exports); the store
  // must not.
  const fileDeduped = new Map<string, SessionRecord>()
  for (const s of migratedIncoming) fileDeduped.set(s.id, s)
  const fileSessions = Array.from(fileDeduped.values())

  let sessions: SessionRecord[]
  let deletedIds: string[]

  if (mode === 'merge') {
    const current = loadStore()
    // Union by id — current first, incoming last, so an incoming record wins
    // an id collision (same last-wins rule as the file-only dedupe above;
    // records are immutable after creation, so this is a tie-break between
    // two copies of the same fact, not a data choice).
    const unioned = new Map<string, SessionRecord>()
    for (const s of current.sessions) unioned.set(s.id, s)
    for (const s of fileSessions) unioned.set(s.id, s)

    deletedIds = capDeletedIds([...current.deletedIds, ...fileDeletedIds])
    const deletedSet = new Set(deletedIds)
    // THE RESURRECT-PREVENTION LINE. Without it, a session this device
    // deleted — or a session the FILE's own author deleted, on their end —
    // would come right back the moment either side merged a copy the other
    // still held. This is tombstones' entire reason to exist.
    const surviving = Array.from(unioned.values()).filter((s) => !deletedSet.has(s.id))
    // ORDER IS LOAD-BEARING: subtract (above) THEN cap (via capSessions,
    // below) — never the reverse. Capping first could evict a record to
    // protect one that the tombstone subtraction was about to remove anyway,
    // silently costing the learner a survivor for no reason.
    sessions = surviving.sort(byDateAscending)
  } else {
    // replace: the file's sessions and the file's tombstones wholesale — but
    // still subtract the file's OWN tombstones from the file's OWN sessions,
    // so the no-id-appears-in-both invariant holds even for a hand-edited
    // file that violated it on disk.
    deletedIds = capDeletedIds(fileDeletedIds)
    const deletedSet = new Set(deletedIds)
    sessions = fileSessions.filter((s) => !deletedSet.has(s.id)).sort(byDateAscending)
  }

  backupCurrentStore(
    mode === 'merge'
      ? 'your saved sessions were changed by a merged file.'
      : 'your saved sessions were replaced by an imported file.',
  )
  const { kept, evictedCount } = capSessions(sessions)
  writeStore(kept, deletedIds)

  // Prefs are device-local taste, not history, so the two modes treat them
  // differently: REPLACE takes the file's (unchanged from the old
  // behaviour — restored only after the sessions have fully validated and
  // been written, sanitized field-by-field so one hostile value cannot
  // poison the good fields beside it); MERGE keeps THIS device's, because
  // combining two devices' session histories is not the same request as
  // overwriting this device's font-size-adjacent preferences with a
  // laptop's.
  if (mode === 'replace' && isRecordObject(parsed.prefs)) {
    savePrefs(sanitizePrefs(parsed.prefs))
  }

  return { mode, sessionCount: kept.length, evictedCount }
}

/**
 * Notify `callback` when ANOTHER tab writes this store. Returns unsubscribe.
 *
 * The 'storage' event fires only in OTHER same-origin tabs — never in the tab
 * that wrote — so this closes the read-staleness half of multi-tab use: tab B
 * sees tab A's new essay without a reload. The write race stays open and
 * accepted: every mutation here re-reads inside the call (`saveSession` starts
 * from `loadStore()`), so a tab holding stale REACT state can render stale
 * but can never clobber the store with it.
 *
 * `e.key === null` means `localStorage.clear()` — treat it as a change too.
 *
 * Filtered to `STORAGE_KEY` (and `null`) specifically so a backup write —
 * `ielts-coach.backup.<iso>`, minted on every damaged read or replace/merge
 * — can never fire this callback. `STORAGE_KEY` itself stays unexported (the
 * whole point of this function existing instead) so no caller outside this
 * module can be tempted to compare against a DIFFERENT key by hand and drift
 * out of sync with the filter here.
 */
export function onExternalStoreChange(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY && e.key !== null) return
    callback()
  }
  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}
