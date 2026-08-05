# Plan 001: Make a schemaVersion bump non-destructive, and add a `task` discriminator to SessionRecord

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: this repository is **not under version control**
> (`git rev-parse` fails). There is no SHA to diff against. Instead: open
> `src/profile/store.ts` and `src/types.ts` and confirm the excerpts quoted in
> "Current state" below appear verbatim. If any excerpt does not match, treat
> it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: no VCS — written 2026-08-05 against the working tree as read on that date

## Why this matters

`src/profile/store.ts` silently destroys every saved session whenever
`SCHEMA_VERSION` changes. The read path returns `null` on a version mismatch,
`loadSessions()` converts that to `[]`, and `saveSession()` then writes that
empty list plus one new record back over the storage key. A learner with 60
essays of history loses all of it on their next submit, with no warning and no
recovery.

This is not hypothetical. Every plan after this one adds a `task` field to
`SessionRecord`, which requires `schemaVersion: 2`. Shipping that on top of the
current code would wipe every existing user's data on first use. This plan must
land first.

The plan does two things: it makes version changes **migrate rather than
discard**, and it adds a **backup-before-overwrite** safety net so that even an
unrecognised future version can be recovered by hand. It also introduces the
`task` field itself, so plan 003 onward can assume it exists.

## Current state

Files involved:

- `src/profile/store.ts` — localStorage persistence. Contains the bug.
- `src/types.ts` — the shared contract. `SessionRecord` is defined here.
- `tests/` — four vitest files, all currently passing. There is **no test file
  for the store** yet; you will create one.

### The bug, exactly

`src/profile/store.ts:58-83` — the read path:

```ts
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
  if (parsed.schemaVersion !== SCHEMA_VERSION) return null      // <-- discards everything
  if (!Array.isArray(parsed.sessions)) return null

  return {
    schemaVersion: SCHEMA_VERSION,
    sessions: parsed.sessions.filter(looksLikeSession),
  }
}
```

`src/profile/store.ts:99-112` — how that becomes data loss:

```ts
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
  writeStore(capSessions(sessions))                              // <-- overwrites with 1 record
}
```

`src/profile/store.ts:14-22` — the constants and shape:

```ts
const STORAGE_KEY = 'ielts-coach.v1'
const SCHEMA_VERSION = 1
const MAX_SESSIONS = 200
const EXPORT_FILENAME = 'ielts-coach-data.json'

interface StoreShape {
  schemaVersion: number
  sessions: SessionRecord[]
}
```

`src/profile/store.ts:33-46` — the per-session shape check you will extend:

```ts
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
```

`src/types.ts:193-211` — the record you are extending:

```ts
export type WritingMode = 'coach' | 'exam';

export interface SessionRecord {
  id: string;
  dateISO: string;
  mode: WritingMode;
  promptId: string | null;
  promptText: string;
  questionType: QuestionType | null;
  essayText: string;
  /** Seconds spent, exam mode only. */
  durationSec: number | null;
  /** Word-count samples every 30s, exam mode only — drives the pacing chart. */
  pacing: Array<{ t: number; words: number }> | null;
  /** Blocked paste attempts, exam mode only. */
  pasteAttempts: number | null;
  /** Analysis snapshot taken at submit time. */
  analysis: Analysis;
}
```

### Repo conventions you must match

- **TypeScript strict.** No `any`. Narrow `unknown` with the existing
  `isRecordObject` helper rather than casting.
- **Defensive persistence.** Every read tolerates missing/corrupt data by
  returning empty; every write is wrapped in `try/catch` and warns on the
  console. Never throw from a read or a write. See the existing `writeStore`
  at `src/profile/store.ts:85-97` for the exact idiom — match it.
- **Learner-facing error strings.** `importData` throws `Error` with plain,
  actionable messages ("Choose the ielts-coach-data.json file you exported
  from this app."). Follow that voice for any new message.
- **Doc comments.** Every exported function has a `/** ... */` one-or-two-liner
  saying what it returns and how it behaves on bad input. The file header
  comment documents the store shape — you must update it.
- **Tests.** Vitest, `describe`/`it`/`expect`, one file per concern in
  `tests/`. Model the new test file on `tests/paragraphing-gate.test.ts`:
  a header comment explaining what regression the file pins, a helpers
  section, then `describe` blocks. Its opening looks like this
  (`tests/paragraphing-gate.test.ts:1-24`):

  ```ts
  /**
   * Paragraphing gates (SPEC.md "Canonical constants → Paragraphing gates").
   *
   * Regression suite for the bug where ...
   */
  import { describe, expect, it } from 'vitest'
  import { analyzeEssay } from '../src/analysis/engine'
  import type { Analysis, Issue } from '../src/types'

  /* --------------------------------- helpers ---------------------------------- */
  ```

- **SPEC.md is canonical.** `SPEC.md:165-171` currently documents the store as
  `localStorage key 'ielts-coach.v1' → { schemaVersion: 1, sessions: SessionRecord[] }`.
  You must update that line as part of this plan (step 6).
- **`IssueCategory` ids are frozen** and this plan does not touch them. Do not
  add, rename, or reorder anything in the `IssueCategory` union.

## Commands you will need

| Purpose   | Command                                | Expected on success |
|-----------|----------------------------------------|---------------------|
| Typecheck | `npx tsc -b --noEmit`                  | exit 0, no output   |
| Tests     | `npx vitest run`                       | all files pass      |
| One file  | `npx vitest run tests/store.test.ts`   | all pass            |
| Build     | `npm run build`                        | exit 0              |

Dependencies are already installed (`node_modules/` exists). Do **not** run
`npm install`.

## Scope

**In scope** (the only files you may modify or create):

- `src/profile/store.ts` (modify)
- `src/types.ts` (modify — the `SessionRecord` interface and a new `TaskKind` type only)
- `src/App.tsx` (modify — one line, in `submitInner`, to set the new field)
- `tests/store.test.ts` (create)
- `SPEC.md` (modify — the storage line only)

**Out of scope** (do NOT touch, even though they look related):

- `src/analysis/**` — no analysis behaviour changes in this plan. Adding the
  `task` field must not change a single issue, band score, or structure check.
- `src/profile/profile.ts` — `computeProfile` / `computeTrends` aggregate over
  `IssueCategory` and are unaffected. Do not add task-scoping here; that is
  deliberately deferred to plan 004's follow-up (see Maintenance notes).
- The `IssueCategory` union in `src/types.ts` — frozen.
- `src/components/**` — no UI changes. The Dashboard will keep listing all
  sessions regardless of task; filtering by task is plan 005's job.

## Git workflow

The repository is **not** a git repository. Before starting, run `git init`
and make one initial commit of the current tree so your changes are reviewable
and revertable:

```bash
git init
git add -A
git commit -m "Initial commit: IELTS Coach as of plan 001"
```

Then work on a branch:

- Branch: `advisor/001-schema-migration`
- One commit per step is fine. There is no existing commit-message convention
  to match (no history) — use plain imperative subjects, e.g.
  `Add v1 to v2 store migration`.
- Do NOT push and do NOT open a PR.

## Steps

### Step 1: Add the `TaskKind` type and the `task` field to `SessionRecord`

In `src/types.ts`, immediately above the `WritingMode` declaration
(`src/types.ts:193`), add:

```ts
/**
 * Which IELTS task a session belongs to. `task2` is the only value produced by
 * the current app; sessions saved before schemaVersion 2 are migrated to it.
 */
export type TaskKind = 'task1' | 'task2';
```

Then add the field to `SessionRecord`, as the **first** field after `mode`:

```ts
export interface SessionRecord {
  id: string;
  dateISO: string;
  mode: WritingMode;
  /** Which IELTS task this session answered. Migrated to 'task2' for pre-v2 data. */
  task: TaskKind;
  promptId: string | null;
  // ... rest unchanged
}
```

Do not change any other field.

**Verify**: `npx tsc -b --noEmit` → **fails** with errors about `task` missing
in `src/App.tsx` (in `submitInner`, around `src/App.tsx:148`). That failure is
expected at this step and is fixed in step 2.

### Step 2: Set `task: 'task2'` at the one construction site

`src/App.tsx:148-160` constructs the only `SessionRecord` in the app:

```ts
    const record: SessionRecord = {
      id: makeId(),
      dateISO: new Date().toISOString(),
      mode,
      promptId: prompt?.id ?? null,
```

Add `task: 'task2',` immediately after the `mode,` line:

```ts
    const record: SessionRecord = {
      id: makeId(),
      dateISO: new Date().toISOString(),
      mode,
      task: 'task2',
      promptId: prompt?.id ?? null,
```

Do not change anything else in `App.tsx`. In particular do not add a task
selector, task state, or any UI — that is plan 005.

**Verify**: `npx tsc -b --noEmit` → exit 0, no output.

### Step 3: Rewrite the store's read path to migrate instead of discard

In `src/profile/store.ts`:

**3a.** Change the version constant and add a backup-key prefix. Replace
`src/profile/store.ts:14-17`:

```ts
const STORAGE_KEY = 'ielts-coach.v1'
const SCHEMA_VERSION = 1
const MAX_SESSIONS = 200
const EXPORT_FILENAME = 'ielts-coach-data.json'
```

with:

```ts
const STORAGE_KEY = 'ielts-coach.v1'
const SCHEMA_VERSION = 2
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
```

Note the storage KEY string stays `'ielts-coach.v1'`. It is an opaque key, not
a version marker — the version lives in the payload. Changing the key would
strand existing data, which is the exact bug being fixed.

**3b.** Make `looksLikeSession` tolerate a missing `task` (pre-v2 records
legitimately lack it — the migration adds it, but the validator runs on raw
parsed input). Add this check to `looksLikeSession`, after the `essayText`
check at `src/profile/store.ts:36`:

```ts
  // `task` is optional on the wire: v1 records predate the field and the
  // migration stamps it. Present-but-wrong is still a reject.
  if (value.task !== undefined && value.task !== 'task1' && value.task !== 'task2') return false
```

**3c.** Add the migration function. Place it immediately above `readStore`:

```ts
/**
 * Upgrade a parsed store payload from `fromVersion` to SCHEMA_VERSION,
 * in ascending single-version steps. Returns the migrated session list.
 *
 * Each step mutates a shallow copy — the caller's parsed object is not reused
 * after this returns, so in-place field stamping is safe and cheap.
 */
function migrateSessions(sessions: SessionRecord[], fromVersion: number): SessionRecord[] {
  let out = sessions
  let version = fromVersion

  // v1 -> v2: the `task` discriminator was added. Everything written before
  // v2 was IELTS Academic Writing Task 2, because that was the only task the
  // app supported.
  if (version === 1) {
    out = out.map((s) => (s.task === undefined ? { ...s, task: 'task2' as const } : s))
    version = 2
  }

  return out
}
```

**3d.** Add the backup helper. Place it immediately above `writeStore`:

```ts
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
      `IELTS Coach: saved data could not be read by this version. ` +
        `A copy was kept at localStorage key "${key}" before it was replaced.`,
    )
  } catch (err) {
    console.warn('IELTS Coach: could not back up unreadable saved data before replacing it.', err)
  }
}
```

**3e.** Replace `readStore` in full (`src/profile/store.ts:58-83`) with:

```ts
/**
 * Read and, where necessary, migrate the stored payload.
 *
 * - Missing key → null (a first run, nothing to back up).
 * - Corrupt JSON, wrong shape, or a version this build cannot migrate →
 *   the raw string is backed up to a timestamped key, then null is returned.
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
```

**Verify**: `npx tsc -b --noEmit` → exit 0.

### Step 4: Apply the same version handling to `importData`

`src/profile/store.ts:156-161` currently rejects any non-current version
outright:

```ts
  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      'This file uses a different data version than this app understands. ' +
        'Export a fresh copy from the app that created it, then try importing again.',
    )
  }
```

Replace that block with version-range handling that migrates old exports:

```ts
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
```

Then, at the end of `importData`, run the migration before writing. Replace
`src/profile/store.ts:177-178`:

```ts
  const sessions = (incoming as SessionRecord[]).slice().sort(byDateAscending)
  writeStore(capSessions(sessions))
```

with:

```ts
  const sessions = migrateSessions((incoming as SessionRecord[]).slice(), version).sort(byDateAscending)
  writeStore(capSessions(sessions))
```

**Verify**: `npx tsc -b --noEmit` → exit 0.

### Step 5: Update the file header comment

Replace the store-shape line in the header comment at `src/profile/store.ts:4-5`:

```
 * Store shape (key 'ielts-coach.v1'):
 *   { schemaVersion: 1, sessions: SessionRecord[] }
```

with:

```
 * Store shape (key 'ielts-coach.v1' — the key is opaque, the version is in the
 * payload):
 *   { schemaVersion: 2, sessions: SessionRecord[] }
 *
 * Versions are migrated forward on read, never discarded (see migrateSessions).
 * v1 -> v2 added SessionRecord.task. Anything this build cannot migrate is
 * copied to a timestamped 'ielts-coach.backup.<iso>' key before being replaced.
```

**Verify**: `npx vitest run` → all 4 existing files pass, 54 tests.

### Step 6: Update SPEC.md

`SPEC.md:165-167` reads:

```
### `profile/` (store.ts + profile.ts)
localStorage key `ielts-coach.v1` → `{ schemaVersion: 1, sessions: SessionRecord[] }`. Cap 200 sessions
(drop oldest). `computeProfile`: per category, per-100-words rate per session; EWMA α = 0.35; trend from
```

Change the first sentence of that paragraph to:

```
localStorage key `ielts-coach.v1` (opaque; the version lives in the payload) →
`{ schemaVersion: 2, sessions: SessionRecord[] }`. Versions are MIGRATED FORWARD on read, never
discarded: v1 → v2 stamps `task: 'task2'` on every record. Anything this build cannot migrate (corrupt,
or a newer version) is copied to `ielts-coach.backup.<ISO timestamp>` before the live key is replaced —
a schemaVersion bump must never destroy a learner's history. Cap 200 sessions
(drop oldest). `computeProfile`: per category, per-100-words rate per session; EWMA α = 0.35; trend from
```

Do not edit any other part of SPEC.md.

### Step 7: Write the regression test

Create `tests/store.test.ts`. It must run in Node (vitest's default
environment), where `window.localStorage` does not exist — so install a minimal
in-memory stub in `beforeEach`.

Required cases, all of which must fail against the pre-plan code and pass after:

1. **A v1 store survives a save.** Seed the key with
   `{ schemaVersion: 1, sessions: [threeValidV1Sessions] }`, call
   `saveSession(newRecord)`, then `loadSessions()` → returns **4** records,
   and every one has `task === 'task2'`.
2. **`loadSessions` migrates without writing.** Seed a v1 store, call
   `loadSessions()` → 3 records each with `task: 'task2'`; the raw stored
   string is still `schemaVersion: 1` (reads do not rewrite).
3. **A v2 store round-trips unchanged.** Seed v2 with a `task: 'task1'`
   record; `loadSessions()` preserves `task: 'task1'`.
4. **An unknown future version is backed up, not destroyed.** Seed
   `{ schemaVersion: 99, sessions: [...] }`, call `saveSession(newRecord)`,
   then assert some key starting with `ielts-coach.backup.` exists and its
   value parses to the original `schemaVersion: 99` payload.
5. **Corrupt JSON is backed up.** Seed the key with `'{not json'`, call
   `loadSessions()` → `[]`, and a backup key exists holding `'{not json'`.
6. **A record with an invalid `task` is rejected.** Seed v2 with one record
   whose `task` is `'speaking'` → `loadSessions()` drops that record only.
7. **`importData` migrates a v1 export.** Pass a v1 JSON string; afterwards
   `loadSessions()` returns those records with `task: 'task2'`.
8. **`importData` rejects a newer version** with a message containing
   `'newer version'`.

Suggested localStorage stub — put it in the helpers section:

```ts
function installLocalStorage(): Map<string, string> {
  const map = new Map<string, string>()
  const stub = {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size
    },
  }
  // vitest's node environment has no window; create the minimum the store needs.
  ;(globalThis as unknown as { window: { localStorage: typeof stub } }).window = {
    localStorage: stub,
  }
  return map
}
```

Build session fixtures with a helper that produces a **valid** record (it must
pass `looksLikeSession`, so `analysis` needs `issues`, `structure`,
`paragraphs`, `stats.wordCount` and `band.{overall,byCriterion,rationale}`).
Write a `makeSession(id, dateISO, overrides)` helper rather than repeating the
literal eight times.

Because `store.ts` reads `window.localStorage` at call time (not module load),
`installLocalStorage()` in a `beforeEach` is sufficient — no module mocking or
`vi.resetModules()` is needed.

**Verify**: `npx vitest run tests/store.test.ts` → 8 tests pass.

### Step 8: Full green

**Verify**: `npx vitest run` → 5 files, 62 tests, all pass.
**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `npm run build` → exit 0.

## Test plan

- **New file**: `tests/store.test.ts`, the 8 cases listed in step 7.
- **Structural pattern**: `tests/paragraphing-gate.test.ts` — header comment
  naming the regression, a `/* helpers */` banner, then `describe` blocks
  grouped by behaviour (`describe('migration', ...)`,
  `describe('backup on unreadable data', ...)`, `describe('importData', ...)`).
- **Existing tests must not change.** `tests/band-rewards.test.ts`,
  `tests/patch-v2.test.ts`, `tests/paragraphing-gate.test.ts` and
  `tests/false-positives.test.ts` exercise the analysis engine, which this plan
  does not touch. If any of them starts failing, that is a STOP condition — it
  means an analysis file was modified out of scope.
- **Verification**: `npx vitest run` → 5 files, 62 tests, all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc -b --noEmit` exits 0 with no output
- [ ] `npx vitest run` exits 0; 5 test files, 62 tests, all passing
- [ ] `npm run build` exits 0
- [ ] `grep -n "SCHEMA_VERSION = 2" src/profile/store.ts` returns one match
- [ ] `grep -n "migrateSessions" src/profile/store.ts` returns at least 3 matches (definition + 2 call sites)
- [ ] `grep -n "backupRaw" src/profile/store.ts` returns at least 4 matches
- [ ] `grep -cn "task: TaskKind" src/types.ts` returns 1
- [ ] `grep -n "task: 'task2'" src/App.tsx` returns exactly one match
- [ ] `grep -n "schemaVersion: 2" SPEC.md` returns one match
- [ ] `git status --porcelain` lists only: `src/types.ts`, `src/App.tsx`, `src/profile/store.ts`, `SPEC.md`, `tests/store.test.ts`
- [ ] `plans/README.md` status row for 001 updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- Any excerpt quoted in "Current state" does not appear verbatim in the live
  file — the tree has drifted since this plan was written.
- Any of the four pre-existing test files starts failing. This plan changes no
  analysis behaviour; a failure there means something out of scope was touched.
- `looksLikeSession` turns out to reject the fixture records you build in step 7
  for a reason other than the `task` field — that would mean the validator has
  additional requirements this plan did not account for. Report what it rejects.
- You find a second construction site for `SessionRecord` anywhere outside
  `src/App.tsx:148` (check with `grep -rn "SessionRecord = {" src/`). The plan
  assumes exactly one.
- The assumption "**vitest runs in a Node environment with no `window`**" turns
  out to be false — i.e. a `window.localStorage` already exists and your stub
  conflicts. Check `vite.config.ts` for a `test.environment` setting first and
  report what it says.

## Maintenance notes

For whoever owns this next:

- **The migration ladder is the extension point.** Every future field addition
  bumps `SCHEMA_VERSION` and appends one `if (version === N)` block to
  `migrateSessions`. Never reorder the blocks and never collapse two versions
  into one branch — a user can be arriving from any older version.
- **`profile.ts` does not yet scope by task.** `computeProfile` and
  `computeTrends` aggregate `IssueCategory` counts across *all* sessions. Once
  Task 1 sessions exist (plan 004), a learner's Task 1 article errors and Task 2
  article errors will land in the same EWMA. That is acceptable for
  grammar/vocabulary categories (the skill genuinely transfers) but wrong for
  task-specific ones. Decide and implement task-scoping as a follow-up to plan
  004 — it is deliberately out of scope here so this fix can ship immediately.
- **What a reviewer should scrutinise**: that `readStore` never returns a
  partially-migrated list, and that `backupRaw` is called on *every* path that
  returns `null` for a non-empty raw string. A missed path is a silent data-loss
  regression, which is the whole point of this plan.
- **The backup keys accumulate.** They are only written on unreadable data, so
  in practice at most a handful. If that ever changes, add a sweep that keeps
  the newest three.
