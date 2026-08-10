# Plan 031: Portability pack — merge-import, delete tombstones, self-describing exports, cross-tab refresh

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. Do NOT edit `plans/README.md`; the reviewer who
> dispatched you maintains the index.
>
> **Dependency gate (run before anything else)**: this plan lands AFTER plan
> 016 (`plans/016-store-durability.md`). Step 0 verifies that. If 016 has not
> landed, STOP and report — do not implement 016 yourself and do not proceed
> without it.
>
> **Drift check (run second)**:
> `git diff --stat d4ddef8..HEAD -- src/profile/store.ts src/App.tsx src/components/Dashboard.tsx src/types.ts tests/store.test.ts SPEC.md`
> Every line number in this plan was read off `d4ddef8`, which is BEFORE plan
> 016 lands. 016 is EXPECTED drift, confined to: `writeStore` returning a
> `SaveResult`, a `nextBackupKey`/`pruneBackups`/`MAX_BACKUPS` addition around
> `backupRaw`, a tightened `byCriterion` check inside `looksLikeSession`, band
> helpers in `Report.tsx`, a save-failure banner and report fallback in
> `App.tsx`, and new tests. Re-anchor every citation below **by symbol name**,
> not by line number, and treat 016's changes as expected. Any OTHER change to
> the excerpts quoted in "Current state" is a STOP condition.

## Status

- **Priority**: P1 — export/import is the app's only durability story across devices, and today it is replace-only, resurrection-prone, and blind to other tabs
- **Effort**: M (1–2 days)
- **Risk**: MED — this plan bumps `SCHEMA_VERSION`, the single most dangerous move in this codebase (plan 001 exists because a bump once destroyed every saved session); the append-only ladder makes it safe, but only if the rung conventions below are followed exactly
- **Depends on**: `plans/016-store-durability.md` (MUST land first — see Step 0)
- **Category**: direction
- **Planned at**: commit `d4ddef8`, 2026-08-10

## Why this matters

The app is deliberately serverless — `localStorage` only, runtime deps exactly
`react` + `react-dom`, no network. That moat means multi-device sync will never
be a server feature; the honest 80% substitute is a file a learner carries
between devices. Today that file is a blunt instrument: `importData` REPLACES
the whole store (the Dashboard confirm says so in as many words), so importing a
laptop's export onto a phone destroys the phone's history. Worse, `deleteSession`
leaves no record that an id ever existed, so the moment imports become merges, a
session deleted on one device is resurrected by every other device's copy —
deletion silently stops working the day merge ships, unless tombstones ship
first. Exports also carry no date (constant filename, no timestamp inside), and
two open tabs never see each other's writes. This plan ships the four pieces in
dependency order: tombstones (schema v6), merge-import built on them, dated
self-describing exports, and a cross-tab `storage` listener.

## Current state

Read each cited symbol before changing it. Line numbers are from `d4ddef8` —
**pre-016** — so re-anchor by symbol name (see the drift check above).

### The store — `src/profile/store.ts` (568 lines at `d4ddef8`)

Key constants and shape:

```ts
const STORAGE_KEY = 'ielts-coach.v1'          // :35
const SCHEMA_VERSION = 5                       // :36
const MIN_MIGRATABLE_VERSION = 1               // :38
const BACKUP_KEY_PREFIX = 'ielts-coach.backup.'// :44
const MAX_SESSIONS_PER_SECTION = 200           // :61
const EXPORT_FILENAME = 'ielts-coach-data.json'// :62

interface StoreShape {                         // :64-67
  schemaVersion: number
  sessions: SessionRecord[]
}
```

`deleteSession` (`:476-481`) — filters and writes, **no record that the id
existed**. This is the resurrection bug waiting for merge:

```ts
export function deleteSession(id: string): void {
  const sessions = loadSessions()
  const remaining = sessions.filter((s) => s.id !== id)
  if (remaining.length === sessions.length) return
  writeStore(remaining)
}
```

`saveSession` (`:467-473`) — re-reads inside the call, so a stale UI can never
clobber the store (`:469` is `loadSessions().filter(...)`; this fact is why the
cross-tab write race in step 6 is acceptable to leave open):

```ts
export function saveSession(s: SessionRecord): void {
  // Replace any record with the same id so a double-save never duplicates.
  const sessions = loadSessions().filter((existing) => existing.id !== s.id)
  sessions.push(s)
  sessions.sort(byDateAscending)
  writeStore(capSessions(sessions))
}
```

`capSessions` (`:226-241`) — per-section cap, walked newest-first, returns the
kept list and nothing else (no eviction count). It runs on EVERY write,
including import (`:566` is `writeStore(capSessions(sessions))`).

`importData` (`:513-567`) — REPLACE semantics. Validation gates in order:
JSON parse (`:514-521`), object check (`:522-526`), version-too-old
(`:527-533`), **version-too-new at `:534-539`** ("This file was exported by a
newer version of IELTS Coach. Update this app, then import again."), sessions
array (`:540-544`), per-record `looksLikeSession` (`:545-553`). Then
**dedup-by-id into a Map, last occurrence wins** (`:561-562`):

```ts
  const deduplicated = new Map<string, SessionRecord>()
  for (const session of incoming as SessionRecord[]) deduplicated.set(session.id, session)

  const sessions = migrateSessions(Array.from(deduplicated.values()), version).sort(byDateAscending)
  backupCurrentStore('your saved sessions were replaced by an imported file.')   // :565
  writeStore(capSessions(sessions))                                              // :566
```

`importData` reads ONLY `schemaVersion` and `sessions` off the parsed object —
unknown extra fields are ignored (verified: `:522-543` never enumerates keys).
That is what makes step 4's additive payload fields safe for older builds of
the same major version — while `:534-539` correctly rejects a file whose
`schemaVersion` is higher than the build understands.

`exportData` (`:484-496`) — writes `{ schemaVersion, sessions }` (bare — no
timestamp, no deletedIds) to a Blob named by the constant `EXPORT_FILENAME`
(`:62`, `'ielts-coach-data.json'`). No date anywhere.

The migration ladder `migrateSessions` (`:265-316`) — **append-only rungs**,
each testing `version < N` never `=== N - 1`, with the v4→v5 rung deliberately
written out as a bare version bump (`:311-313`) and a long comment (`:296-310`)
explaining that a rung with no data change is a convention, not a gap, and that
"a data-carrying v5 -> v6 lands below it without anyone having to work out
where v5 went". Your v5→v6 rung lands exactly there and follows that comment's
shape. `readStore` (`:395-444`) admits versions in the RANGE
`[MIN_MIGRATABLE_VERSION, SCHEMA_VERSION]` and backs up anything outside it.

`backupCurrentStore` (`:374-381`) — copies the live key to a timestamped backup
before a destructive overwrite; `importData` already calls it (`:565`). Both
merge and replace must keep calling it.

`looksLikeSession` (`:148-182`) treats all input as hostile — every field
checked, unknown `section` rejected. Your `deletedIds` parsing must be equally
hostile (non-array → `[]`, non-string entries dropped).

### The app — `src/App.tsx` (1167 lines at `d4ddef8`)

- Sessions state loads ONCE at mount — `:123`:
  ```tsx
  const [sessions, setSessions] = useState<SessionRecord[]>(() => loadSessions())
  ```
  There is **no `storage` event listener and no `BroadcastChannel` anywhere in
  `src/`** (verified: `grep -rn "addEventListener('storage'\|BroadcastChannel" src/`
  → no matches at `d4ddef8`). A second tab's writes are invisible until reload.
- `handleImport` — `:596-599`:
  ```ts
  function handleImport(json: string) {
    importData(json)
    setSessions(loadSessions())
  }
  ```
- Ids are `crypto.randomUUID` with a `getRandomValues` fallback — `makeId`,
  `:307-312` — so cross-device id collision is nil and union-by-id is sound.
- Existing `useEffect` blocks with add/remove listener cleanup live at
  `:240-262` (interval + `visibilitychange`) — model the storage effect's
  subscribe/unsubscribe shape on them.
- Dashboard is rendered at `:1150-1162` with `onExport={exportData}` and
  `onImport={handleImport}`.

### The Dashboard — `src/components/Dashboard.tsx` (474 lines at `d4ddef8`)

`handleFilePicked` (`:232-247`) with the replace-confirm at `:239-241`:

```tsx
  async function handleFilePicked(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target
    const file = input.files && input.files[0]
    input.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const ok = window.confirm(
        `Importing replaces your current history (${sessions.length} essays) with the file's contents. Continue?`,
      )
      if (!ok) return
      onImport(text)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'That file could not be imported.')
    }
  }
```

Two entry points share it: the empty-state "Restore from a backup file" button
(`:281`) and the header "Import data" button (`:306-308` inside the
`db-actions` div at `:302`). `window.confirm` is binary — it cannot offer
Merge / Replace / Cancel — so step 3 replaces it with a small inline choice
card. **No new dependency**; plain buttons in the existing `card` / `btn`
classes.

`DashboardProps` lives in `src/types.ts:720-730`; `onImport` is
`(json: string) => void` at `:729`.

### Tests — `tests/store.test.ts` (1030 lines, engine project, node env)

- In-memory localStorage stub `installLocalStorage()` (`:30-46` — implements
  `removeItem`, `key(i)`, `length`); `seed(schemaVersion, sessions)` (`:105-107`);
  `backupKeys()` (`:109-111`); wire-shape fixture `makeSession` (`:57-90`, a
  deliberately pre-v2 shape); current-shape fixture `newRecord` (`:101-103`).
- The ladder-chain pattern to copy for v1→v6: `describe('v1 -> v5 in a single
  read')` at `:480-530` — climbs every rung in one read, asserts reads stay
  pure (payload still v1), then asserts the next save rewrites at the current
  version.
- **Version-pinned cases that MUST move when `SCHEMA_VERSION` becomes 6**
  (enumerated exhaustively — verified by
  `grep -n "toBe(5)\|schemaVersion: 6" tests/store.test.ts` at `d4ddef8`):
  - `:302`, `:519`, `:943` — `expect(...schemaVersion).toBe(5)` → `toBe(6)`.
    The comment at `:299-301` says exactly this: "Whatever the current
    SCHEMA_VERSION is … the assertion that matters is that the three v1 essays
    came through the rewrite, not the digit itself."
  - `:565` (seed inside "backs up the very NEXT version", `:557`) and `:583`
    ("refuses to import a v6 export") and `:900` — these track
    `SCHEMA_VERSION + 1` and re-point from 6 to **7**. The comment at
    `:561-563` documents this exact convention: "This case tracks
    SCHEMA_VERSION + 1 and was re-pointed from 5 to 6 when Listening made 5 a
    version this build understands."
  - Seeds that say `schemaVersion: 5` (`:543`, `:867`, `:885`, `:968`, `:982`,
    `:1001`) STAY as they are — v5 is now a migratable older version, which is
    the point.
  - Every read of the written payload is field-level
    (`grep -n "store.get(STORAGE_KEY)" tests/store.test.ts` → `:143`, `:253`,
    `:280`, `:302`, `:503`, `:519`, `:943`) — none does a whole-object
    `toEqual` on the live key, so adding `deletedIds` to writes breaks none of
    them beyond the three `toBe(5)` digits.

Plan 016 adds more store tests before you start; the enumeration above is of
`d4ddef8` cases, which 016 does not renumber semantically — find them by the
quoted strings, not the line numbers.

### UI tests — `tests/ui/` (jsdom project)

**Every UI test must render through `renderApp()` from
`tests/ui/renderApp.tsx`** — its header comment explains that a bare
`render(<App />)` draws a random prompt and failed roughly three runs in ten.
New UI test files follow that pattern (`tests/ui/a11y.test.tsx:27` is one
exemplar of the import). Vitest projects: engine = `tests/*.test.ts` (node,
`vite.config.ts:22-29`), ui = `tests/ui/*.test.tsx` (jsdom,
`vite.config.ts:30-38`).

### Typechecking caveat

`tsconfig.json` has `"include": ["src"]` — **`tests/` is not typechecked
today**; `npx tsc -b --noEmit` gates `src/` only. Plan 024 (may land before or
after this one) turns typechecking on for tests. Write all test code as if 024
were already enforced: no `any`, no missing required fields on fixtures, typed
imports (`import type` where values are not needed).

### Repo conventions you must match

- React 18 + TS strict + Vite; runtime deps EXACTLY `react` + `react-dom` —
  **never add a dependency**. No server, no network at runtime.
- `store.ts` never throws on a read, never crashes the app on a write.
- Comments explain WHY — the failure mode prevented. Match `store.ts`'s voice.
- `IssueCategory` ids are FROZEN (append-only); `Criterion` stays four members.
  Neither changes here.
- SPEC.md is canonical — behaviour and storage changes land there in the same
  plan (step 7).
- Mutation-check anything you pin (SPEC.md records why; plan 016 did the same).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck (src only — see caveat above) | `npx tsc -b --noEmit` | exit 0, no output |
| Full suite | `npx vitest run` | **853 passed / 24 files at `d4ddef8`**; more after 016; record the count at your branch start — it must never decrease |
| Store only | `npx vitest run tests/store.test.ts` | all pass |
| Engine project | `npx vitest run --project engine` | all pass |
| UI project | `npx vitest run --project ui` | all pass |
| Build | `npm run build` | exit 0 |
| Scope check | `git status --porcelain -- . ':!plans/'` | only in-scope files (NEVER bare `git status --porcelain` — the baseline tree carries untracked `plans/*.md`) |

**UI determinism**: after any UI change, run `npx vitest run --project ui` ten
consecutive times and confirm identical results.

## Scope

**In scope** (the only files you may modify):

- `src/profile/store.ts` — schema v6, tombstones, merge mode, export payload, `onExternalStoreChange`
- `src/types.ts` — `ImportMode`, `ImportSummary`, `DashboardProps.onImport` signature
- `src/components/Dashboard.tsx` — three-way import choice, result/eviction copy
- `src/App.tsx` — `handleImport` signature, cross-tab effect
- `tests/store.test.ts` — new cases + the enumerated version-digit updates
- `tests/ui/import-choice.test.tsx` (create)
- `tests/ui/cross-tab.test.tsx` (create)
- `SPEC.md` — schema v6, tombstone rule, merge semantics, export format, cross-tab

**Out of scope** (do NOT touch, even though they look related):

- `MAX_SESSIONS_PER_SECTION` as a number, and everything 016 built
  (`MAX_BACKUPS`, `nextBackupKey`, `pruneBackups`, `SaveResult` semantics) —
  you consume them, you do not change them.
- The migration rungs v1→v5 (`migrateSessions` `:276-313`) — append below,
  never edit.
- `IssueCategory`, `Criterion`, any analysis or marking module.
- `src/profile/profile.ts` — tombstones never feed `computeProfile`.
- Any server, network, or third dependency — the moat is the point.
- `plans/README.md` — the reviewer owns the index.

**Coordination note — plan 023**: 023 (TODO) extracts ReadingSection /
ListeningSection out of `App.tsx` and code-splits. This plan edits `App.tsx`
(`handleImport`, the cross-tab effect near `:240`). **Do not run concurrently
with 023; whichever lands second rebases onto the other.** The store-side steps
(1, 2, 4) are unaffected either way.

## Git workflow

- Branch: `advisor/031-portability-pack`, off `main` AFTER 016 has merged.
- One commit per step (v6+tombstones, merge, dashboard UI, exports, cross-tab,
  SPEC). Message style matches `git log`: a plain imperative sentence, e.g.
  `Record deletions as tombstones so a merge can never resurrect them`.
- Mutation checks may be done with a temporary edit reverted via
  `git checkout -- <file>` inside this branch.
- Do NOT push and do NOT open a PR.

## Steps

### Step 0: Dependency gate and drift check

1. **Verify 016 landed**:
   `grep -n "MAX_BACKUPS" src/profile/store.ts` → at least 1 match, AND
   `grep -n "SaveResult" src/types.ts` → at least 1 match.
   If either is absent, **STOP and report**: "plan 016 has not landed; 031
   depends on it." Do not implement any part of 016 yourself.
2. Run the drift check from the header. Re-anchor every citation by symbol.
3. Record your baseline test count: `npx vitest run` → note N passed / M files
   (≥ 853 / 24). Every later "full suite" verify compares against this N.

**Verify**: both greps match; suite green at ≥ 853.

### Step 1: Schema v6 — delete tombstones

All in `src/profile/store.ts` unless said otherwise.

**1a.** Extend the shape and bump the version:

```ts
const SCHEMA_VERSION = 6

interface StoreShape {
  schemaVersion: number
  sessions: SessionRecord[]
  /** Ids the learner explicitly deleted. See MAX_DELETED_IDS for why capped. */
  deletedIds: string[]
}
```

Update the module header comment (`:1-30`): add the v5 → v6 line to the version
history ("v5 -> v6 added StoreShape.deletedIds, the delete tombstones") in the
same voice as the existing lines.

**1b.** Add the tombstone cap next to `MAX_SESSIONS_PER_SECTION`, with a
doc comment in the file's voice:

```ts
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
```

**1c.** `capDeletedIds(ids: string[]): string[]` — deduplicate keeping the LAST
occurrence's position, then keep the newest `MAX_DELETED_IDS` (the tail of the
append-ordered list). Signature only — you write the body.

**1d.** `readStore` (`:395-444`): parse `deletedIds` as hostile input —
`Array.isArray(parsed.deletedIds)` ? filter to `typeof d === 'string'` : `[]` —
cap it, and return it on the `StoreShape`. A v5 payload has no `deletedIds`;
the default `[]` IS the migration. Add the v5→v6 rung to `migrateSessions`
below the v4→v5 rung, in the shape its comment (`:296-310`) prescribes —
written out, one line per version:

```ts
  // v5 -> v6: StoreShape gained `deletedIds` — a STORE-level field, not a
  // record field, so there is nothing to stamp onto a session here.
  // `readStore` supplies the [] default when the payload predates the field;
  // this rung exists so the ladder still reads one line per version and so
  // `importData` knows a v6 export is readable while refusing a v7 one.
  if (version < 6) {
    version = 6
  }
```

**1e.** Thread `deletedIds` through every write. `writeStore` takes the ids and
includes them in the payload (keep whatever return type 016 gave it):

```ts
function writeStore(sessions: SessionRecord[], deletedIds: string[]): SaveResult
```

Add an internal `loadStore(): StoreShape` (`readStore() ?? { schemaVersion:
SCHEMA_VERSION, sessions: [], deletedIds: [] }`) so mutations read sessions and
tombstones in ONE read. Then:

- `saveSession`: read via `loadStore()`; also **remove `s.id` from
  `deletedIds`** before writing — the invariant is that no id ever appears in
  both lists, and a deliberate re-save wins over a stale tombstone.
- `deleteSession`: on an actual removal, write
  `capDeletedIds([...deletedIds.filter((d) => d !== id), id])` alongside the
  remaining sessions. Unknown ids stay a no-op (no tombstone for a session
  that never existed here — comment why: a tombstone must testify to a real
  deletion, or merge subtracts records this device never saw).
- `loadSessions` keeps its exact signature and behaviour.

**1f. THE CRITICAL DESIGN RULE** — `capSessions` (and any eviction path,
including import's) **must never write tombstones**. Put this comment on
`capSessions` and the verbatim sentence into SPEC.md in step 7:

> Cap eviction is NOT a delete — `capSessions` must never write tombstones;
> only the learner's explicit delete does. Otherwise a future sync turns a
> local cache policy into global history loss.

(Concretely: this device evicting record 201 must not tell every other device
to destroy its copy.)

**1g.** Update the enumerated version-pinned tests (see "Current state" →
Tests): three `toBe(5)` → `toBe(6)`; three `schemaVersion: 6` seeds/imports →
`7`; leave every `schemaVersion: 5` seed alone. Extend the annotations at
`:299-301` and `:561-563` style — one clause noting the re-point, e.g.
"re-pointed 6 → 7 when tombstones made 6 a version this build understands."

**1h.** New engine tests (in `tests/store.test.ts`, using `seed` /
`makeSession` / `newRecord`):

1. v5→v6: seed `5` with no `deletedIds` → `loadSessions()` returns the
   records; the payload is untouched (reads stay pure — still v5, no
   `deletedIds` key); the next `saveSession` writes `schemaVersion: 6` with
   `deletedIds: []`.
2. v1→v6 chain: copy the `:480-530` pattern — seed `1`, one read stamps
   `task`/`module`/`section`, next save writes v6 + `deletedIds: []`, nothing
   lost.
3. `deleteSession` appends the id to `deletedIds`; deleting an unknown id
   writes nothing.
4. Tombstone cap: delete beyond `MAX_DELETED_IDS` distinct ids → length stays
   `MAX_DELETED_IDS`, survivors are the newest.
5. Cap never tombstones: save `MAX_SESSIONS_PER_SECTION + 1` writing records →
   evictions happened, `deletedIds` in the payload is still `[]`.
6. `saveSession` clears a stale tombstone for the id it writes.

**Verify**: `npx vitest run tests/store.test.ts` → all pass.
**Verify**: `npx tsc -b --noEmit` → exit 0.
**Mutation checks (run all three, report each)**:
- Temporarily make `capDeletedIds` return `ids` unchanged → test 4 FAILS
  (length exceeds `MAX_DELETED_IDS`); revert (`git checkout -- src/profile/store.ts`
  is not usable mid-step if you have other uncommitted work in the file —
  instead undo the one-line edit by hand); confirm it passes again.
- Temporarily make `capSessions`' caller append evicted ids to `deletedIds` →
  test 5 FAILS; revert; passes.
- Temporarily drop `deletedIds` from `writeStore`'s payload → tests 1 and 3
  FAIL; revert; pass.

### Step 2: Merge-import

**2a.** In `src/types.ts` (near `DashboardProps`, `:720`):

```ts
export type ImportMode = 'merge' | 'replace';

/** What an import did — the Dashboard shows this to the learner. */
export interface ImportSummary {
  mode: ImportMode;
  /** Live sessions in the store after the write. */
  sessionCount: number;
  /** Sessions dropped by the per-section cap DURING this import (0 almost always). */
  evictedCount: number;
}
```

**2b.** `capSessions` must report what it dropped — smallest honest change:

```ts
function capSessions(sessions: SessionRecord[]): { kept: SessionRecord[]; evictedCount: number }
```

(The early-return branch reports `evictedCount: 0`.) Update both call sites —
`saveSession` and `importData` — to destructure. `saveSession` ignores the
count (its eviction is the documented per-section retention policy);
`importData` surfaces it, because merging two devices each near the cap can
silently evict and the learner must be told (step 3's copy).

**2c.** `importData` gains a mode, **defaulting to `'replace'`** so every
existing call site and test keeps its exact semantics; the UI passes
`'merge'` as ITS default (step 3):

```ts
export function importData(json: string, mode: ImportMode = 'replace'): ImportSummary
```

All validation gates (`:514-553`) run unchanged for both modes, plus: parse the
file's `deletedIds` with the same hostile rule as `readStore` (missing/invalid
→ `[]`). The version gate stays `version > SCHEMA_VERSION` → throw — which now
means v6 accepted, v7 refused, and a v5/v1 file climbs the ladder.

Then, **order is load-bearing (union → subtract → cap — "pull-then-cap")**:

- **merge**: `current = loadStore()`;
  `mergedDeleted = capDeletedIds([...current.deletedIds, ...fileDeletedIds])`;
  union sessions by id into a Map — current first, incoming last, so an
  incoming record wins an id collision (same last-wins rule as `:561-562`;
  records are immutable after creation, so this is a tie-break, not a data
  choice); **subtract**: drop every unioned session whose id is in
  `mergedDeleted` — this is the resurrect-prevention line, comment it as such;
  migrate the incoming records (`migrateSessions(..., version)`) BEFORE the
  union so a v1 file's records carry their stamps; sort `byDateAscending`;
  cap; `backupCurrentStore('your saved sessions were changed by a merged
  file.')`; write.
- **replace**: file's sessions (deduped, migrated, sorted) and file's
  `deletedIds` wholesale — but still subtract the file's own tombstones from
  the file's own sessions, so the no-id-in-both invariant holds even for a
  hand-edited file; cap; `backupCurrentStore(...)` with the existing `:565`
  wording; write.

Both modes return `{ mode, sessionCount: kept.length, evictedCount }`. Both
back up BEFORE the write, AFTER validation (the `:510-511` rule: a rejected
file must not mint a backup).

**2d.** New engine tests:

1. Merge unions two disjoint histories — every id from both survives.
2. Merge with an id collision keeps one record (incoming wins), count correct.
3. **Resurrect prevention (the core case)**: device A's store has essay X
   deleted (`deleteSession('x')` after seeding it); merging a file that still
   carries X → X stays gone, and X's id stays in `deletedIds`.
4. Merge unions the FILE's tombstones too: file says X deleted, store still
   has X → merge removes X.
5. Order pin (union → subtract → cap): construct a merge where a tombstoned
   record would, if subtracted AFTER capping, change which records get
   evicted — assert the survivors prove subtraction ran first.
6. Merge caps and reports: two near-cap section histories merged →
   `evictedCount > 0`, survivors are the newest `MAX_SESSIONS_PER_SECTION`.
7. Replace keeps its exact old semantics via the default parameter — an
   existing replace test re-run through `importData(json)` unchanged.
8. Both modes back up the pre-import store (model on `:854-906`).
9. `importData` on a v7 file still throws (already re-pointed in step 1g).

**Verify**: `npx vitest run tests/store.test.ts` → all pass.
**Mutation checks**:
- Temporarily delete the subtract line in merge → tests 3 and 4 FAIL (X
  resurrected); revert; pass. **This is the plan's most important mutation
  check — report the exact failing assertion text.**
- Temporarily swap the order to cap-then-subtract → test 5 FAILS; revert; pass.

### Step 3: The Dashboard's three-way choice, and honest eviction copy

**3a.** `src/types.ts:729` — change `onImport` to:

```ts
  onImport: (json: string, mode: ImportMode) => ImportSummary;
```

**3b.** `src/App.tsx:596-599` — thread it through:

```ts
  function handleImport(json: string, mode: ImportMode): ImportSummary {
    const summary = importData(json, mode)
    setSessions(loadSessions())
    return summary
  }
```

**3c.** `src/components/Dashboard.tsx` — replace the `window.confirm` flow
(`:232-247`). `window.confirm` is binary and cannot offer Merge / Replace /
Cancel, so use a small inline choice card (existing `card` + `btn` classes, no
new dependency, no new file):

- New local state: `pendingImport: { text: string } | null` and
  `importResult: string | null`.
- `handleFilePicked` becomes: read the file text, `setPendingImport({ text })`
  — no confirm, no import yet. Keep the `input.value = ''` reset.
- Render the choice card whenever `pendingImport` is non-null, in BOTH returns
  (the empty state at `:256-291` and the main view) — build the JSX once in a
  variable above the empty-state `if` so the two returns share it. Copy:
  - Heading: "Import this file?"
  - Body: "Merge adds the file's sessions to your history (recommended —
    nothing here is replaced, and sessions you deleted stay deleted). Replace
    throws away your current history ({sessions.length} essays) and keeps only
    the file."
  - Buttons: **"Merge (recommended)"** (`btn btn-primary`) → mode `'merge'`;
    "Replace everything" (`btn`) → `'replace'`; "Cancel" (`btn`).
- On Merge/Replace: call `onImport(pendingImport.text, mode)` inside
  `try/catch` (keep the existing `alert(err.message)` catch shape from
  `:244-246`), clear `pendingImport`, and set `importResult` to:
  - merge, no eviction: `Merged — your history now holds ${summary.sessionCount} sessions.`
  - replace, no eviction: `Replaced — your history now holds ${summary.sessionCount} sessions.`
  - **when `summary.evictedCount > 0`, append the disclosure (required)**:
    ` Storage keeps the newest 200 per section, so ${summary.evictedCount} older
    session(s) were left out.`
- Render `importResult` in a `<p role="status">` — a completed import is a
  non-urgent notice, matching the repo's `role="status"` precedent
  (`src/components/ListeningRunner.tsx` uses it for non-urgent notices; 016
  reserves `role="alert"` for data-loss urgency).

**3d.** New UI test file `tests/ui/import-choice.test.tsx` — **must** use
`renderApp()` from `tests/ui/renderApp.tsx`. Driving a real file input in jsdom
is awkward but doable: fire `change` on the hidden input with
`Object.defineProperty`-style file lists is NOT needed — instead construct a
`File` and use `fireEvent.change(input, { target: { files: [file] } })`;
`file.text()` resolves in jsdom. Await the card with `findByText`. Cases:

1. Picking a file surfaces the three-way card (Merge recommended, Replace,
   Cancel all present) and does NOT import yet (store unchanged).
2. Cancel dismisses the card; store unchanged.
3. Merge: seed one saved session via `saveSession(...)` (build the fixture on
   the `tests/store.test.ts` `newRecord`/`makeSession` shape, `:57-103`, typed
   — no `any`, all required fields, so it survives plan 024), pick a file
   carrying a DIFFERENT session, click "Merge (recommended)" → both sessions
   listed, and the `role="status"` line shows the merged count.
4. Replace: same setup, click "Replace everything" → only the file's session
   remains.

(An eviction-disclosure UI case would need 200+ records rendered in jsdom —
cover the copy string by unit-asserting the engine `ImportSummary` in step 2's
test 6 instead, and assert here only that the status line renders what the
summary says. Note this choice in the test file's header comment.)

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `npx vitest run --project ui` → all pass, ten consecutive runs
identical.
**Verify**: `grep -n "window.confirm" src/components/Dashboard.tsx` → exactly
one match, the DELETE confirm (`confirmDelete`, `:249-255` at `d4ddef8`) — the
import confirm is gone. (grep exits 0 here; a zero-match exit 1 would mean you
removed the delete confirm too — that is out of scope, restore it.)

### Step 4: Self-describing, dated exports

Plan 016 froze the export format **within its own scope** ("Any change to the
export file format or `EXPORT_FILENAME`" was on 016's out-of-scope list,
protecting importability by older builds). This plan changes the format
**deliberately and after 016**. The docs 016 touched are its code files plus
`SPEC.md` — SPEC.md is the only DOC in 016's scope list, and step 7 updates it,
including the compatibility note below. No other doc names the export format
(verify: `grep -rln "ielts-coach-data" --include='*.md' --exclude-dir=plans .`
→ no output, exit 1, until step 7 adds the string to SPEC.md — after step 7 it
prints `./SPEC.md` only. The `:!plans` form is git-pathspec syntax and does NOT
work with grep — plans/ must be excluded with `--exclude-dir`.)

**4a.** In `src/profile/store.ts`, split the pure part out of `exportData` so
node tests can reach it:

```ts
/** The export payload and its dated filename. Pure except for the clock and store reads. */
export function buildExport(): { json: string; filename: string }  // signature only — you write the body
```

- Payload: `{ schemaVersion: SCHEMA_VERSION, exportedAtISO: new Date().toISOString(), sessions, deletedIds }`
  pretty-printed (keep `JSON.stringify(..., null, 2)`).
- Filename: `` `ielts-coach-data-${exportedAtISO.slice(0, 10)}.json` `` —
  **derived from the SAME `exportedAtISO` string, one clock read**; a second
  `new Date()` could straddle midnight and stamp a filename date that
  contradicts the payload. Comment that reason.
- Replace the constant at `:62` with `const EXPORT_FILENAME_PREFIX = 'ielts-coach-data'`
  and build both the filename and the import-error copy from it.
- `exportData()` keeps its name and signature and does only the DOM part
  (Blob, anchor, click — `:487-495` unchanged in shape).

**4b.** Compatibility facts to encode as comments + SPEC (step 7):

- Additive fields are safe DOWN-level within a readable version: `importData`
  ignores unknown keys (verified `:522-543`), so `exportedAtISO` never breaks
  any build.
- But a **v6 file into a v5 build fails the version gate** (`:534-539`,
  "exported by a newer version… Update this app") — that is CORRECT and
  documented behaviour, not a bug. The SPEC note must say: **"update all
  devices to the same build before merging."**
- Update the import JSON-parse error copy (`:518-520`) which names the old
  constant filename: change "Choose the ielts-coach-data.json file you exported
  from this app." to "Choose an ielts-coach-data file you exported from this
  app." (the name now carries a date).

**4c.** New engine tests (node env — `buildExport`, not `exportData`):

1. Payload shape: seed a store, delete one session, freeze the clock
   (`vi.setSystemTime(new Date('2026-08-10T12:00:00.000Z'))` — `vi` already
   imported, `tests/store.test.ts:14`) → `JSON.parse(json)` has
   `schemaVersion: 6`, the sessions, the tombstone in `deletedIds`, and
   `exportedAtISO === '2026-08-10T12:00:00.000Z'`.
2. Filename: same frozen clock → `filename === 'ielts-coach-data-2026-08-10.json'`.
3. Round-trip: `importData(buildExport().json, 'merge')` into an empty store
   reproduces sessions AND tombstones.

**Verify**: `npx vitest run tests/store.test.ts` → all pass.
**Mutation check**: temporarily hardcode the filename to the old constant →
test 2 FAILS; revert; passes. Then temporarily derive the filename from a
SECOND `new Date()` while `vi.setSystemTime` advances the fake clock between
the payload's read and the filename's (`vi.advanceTimersByTime` across a
midnight boundary in the test) — if your test can't observe this cheaply,
assert instead that `filename.slice(17, 27) === JSON.parse(json).exportedAtISO.slice(0, 10)`
in test 2, which pins the derivation; report which form you used.

### Step 5: Conditional — prefs ride the export (only if plan 027 landed)

Plan 027 (a parallel batch; not in `plans/` at `d4ddef8`) may add a preferences
key to the store. **Check first, do not assume**:

`grep -n "prefs" src/profile/store.ts` → matches?

- **No matches** (the `d4ddef8` state): skip this step entirely. Add one line
  to your final report: "prefs not present in the store — step 5 skipped."
- **Matches**: include the prefs value in `buildExport`'s payload as an
  additive field, parse it hostile-style in `importData` (replace mode takes
  the file's, merge keeps the DEVICE's — prefs are device-local taste, not
  history; comment that rule), and add one engine test for each mode. Do not
  restructure whatever 027 built.

Either branch continues to step 6.

**Verify**: the grep's outcome and your action match one branch above.

### Step 6: Cross-tab refresh

**6a.** In `src/profile/store.ts`, keep `STORAGE_KEY` private and export a
subscription instead:

```ts
/**
 * Notify `callback` when ANOTHER tab writes this store. Returns unsubscribe.
 *
 * The 'storage' event fires only in OTHER same-origin tabs — never in the tab
 * that wrote — so this closes the read-staleness half of multi-tab use: tab B
 * sees tab A's new essay without a reload. The write race stays open and
 * accepted: every mutation here re-reads inside the call (`saveSession` starts
 * from `loadSessions()`), so a tab holding stale REACT state can render stale
 * but can never clobber the store with it.
 *
 * `e.key === null` means `localStorage.clear()` — treat it as a change too.
 */
export function onExternalStoreChange(callback: () => void): () => void  // signature only — you write the body
```

(Filter: `e.key === STORAGE_KEY || e.key === null`. Backup-key writes must NOT
fire the callback — they are not store changes.)

**6b.** In `src/App.tsx`, next to the existing listener-effects (`:240-262`
region):

```tsx
  // Another tab saved or deleted a session — re-read so both tabs agree.
  useEffect(() => onExternalStoreChange(() => setSessions(loadSessions())), [])
```

(`onExternalStoreChange` returns its unsubscribe, so returning it directly IS
the cleanup. Note for the 023 rebase: this effect stays in App — it feeds the
top-level `sessions` state at `:123`.)

**6c.** New UI test `tests/ui/cross-tab.test.tsx` — `renderApp()` as always.
jsdom does not fire real cross-tab events, so dispatch a `StorageEvent`
manually:

1. Render, open Progress → empty state ("No essays yet").
2. Simulate the other tab: call `saveSession(fixtureRecord)` directly (jsdom's
   real `window.localStorage`; same typed fixture rules as step 3d). No event
   fires — same-tab writes never do — assert the empty state is STILL shown
   (this pins the "only other tabs" semantics).
3. Inside `act(...)`:
   `window.dispatchEvent(new StorageEvent('storage', { key: 'ielts-coach.v1' }))`
   → the essay row appears.
4. Negative: dispatch with `key: 'unrelated-key'` after deleting the record
   from localStorage by hand → UI unchanged (the filter works).

**Verify**: `npx vitest run --project ui` → all pass, ten consecutive runs
identical.
**Verify**: `grep -rn "addEventListener('storage'" src/` → exactly one match,
in `src/profile/store.ts`.
**Mutation check**: temporarily change the filter to a wrong key name → test
case 3 FAILS (row never appears); revert; passes.

### Step 7: SPEC.md

SPEC.md is canonical; the storage and behaviour changes above land in it now.
Update (anchors at `d4ddef8`; re-locate by quoted text after 016's edits):

- `:45` "**Storage is schemaVersion 5.**" → 6, with one clause on what v6
  added.
- `### profile/` section (`:229-279`): the shape line (`:230-231`) gains
  `deletedIds`; the ladder paragraph gains the v5→v6 rung (store-level field,
  default supplied on read); the cap paragraph gains the tombstone rule
  **verbatim**:
  > Cap eviction is NOT a delete — `capSessions` must never write tombstones;
  > only the learner's explicit delete does. Otherwise a future sync turns a
  > local cache policy into global history loss.
  Also record `MAX_DELETED_IDS = 500` and its rationale (500 > the 600-record
  live ceiling; oldest-dropped).
- The export/import paragraph (`:275-279`): merge vs replace semantics
  (union → subtract → cap, incoming wins id ties, both modes back up first),
  the `ImportSummary` + eviction disclosure, the payload's `exportedAtISO` +
  `deletedIds`, the dated filename, and the compatibility rule: additive
  fields are ignored by older readers of the SAME version, but a v6 file into
  a v5 build fails the version gate by design — **"update all devices to the
  same build before merging."**
- `:281` "(three members at schemaVersion 5)" → 6 (still three members).
- A short cross-tab note: `storage` listener, other-tabs-only, write race
  accepted because mutations re-read.

**Verify**: `grep -c "MAX_DELETED_IDS" SPEC.md` → ≥ 1.
**Verify**: `grep -c "must never write tombstones" SPEC.md` → 1.
**Verify**: `grep -c "same build before merging" SPEC.md` → ≥ 1.

### Step 8: Full green

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `npx vitest run` → all pass; count ≥ your step-0 baseline + every
new test from steps 1–6.
**Verify**: `npm run build` → exit 0.
**Verify**: `npx vitest run --project ui` ten consecutive times → identical.
**Verify**: `git status --porcelain -- . ':!plans/'` → only in-scope files.
**Report**: all seven mutation-check outcomes (steps 1×3, 2×2, 4×1, 6×1), the
step-5 branch taken, and the final test count.

## Test plan

| File | Cases |
|---|---|
| `tests/store.test.ts` | v5→v6 default + pure read + rewrite-on-save · v1→v6 full chain (pattern: `:480-530`) · tombstone append / unknown-id no-op / cap-at-500-newest / save-clears-stale-tombstone · cap-never-tombstones · merge union (disjoint, id-collision) · **resurrect prevention both directions (local tombstone vs file record; file tombstone vs local record)** · union→subtract→cap order pin · merge eviction count · replace unchanged via default param · both modes back up (pattern: `:854-906`) · v7 refused · `buildExport` payload shape, dated filename, round-trip incl. tombstones · digit updates enumerated in step 1g |
| `tests/ui/import-choice.test.tsx` (new) | file pick surfaces three-way card without importing · Cancel inert · Merge keeps both histories + status copy · Replace keeps only the file |
| `tests/ui/cross-tab.test.tsx` (new) | same-tab write does NOT refresh (other-tabs-only semantics) · dispatched `StorageEvent` for the store key refreshes · unrelated key ignored |

All engine cases drive the real exported API against `installLocalStorage()`
(`tests/store.test.ts:30-46`); all UI cases render via `renderApp()`. All
fixtures fully typed (plan-024-proof: no `any`, no missing required fields).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc -b --noEmit` exits 0 (gates `src/` only — see the tsconfig caveat)
- [ ] `npx vitest run` exits 0 with ≥ the step-0 baseline count, all new cases passing
- [ ] `npm run build` exits 0
- [ ] `npx vitest run --project ui` identical across 10 consecutive runs
- [ ] `grep -c "SCHEMA_VERSION = 6" src/profile/store.ts` → 1
- [ ] `grep -c "MAX_DELETED_IDS" src/profile/store.ts` → ≥ 2 (declaration + use)
- [ ] `grep -c "deletedIds" src/profile/store.ts` → ≥ 5
- [ ] `grep -n "window.confirm" src/components/Dashboard.tsx` → exactly 1 match (the delete confirm; the import confirm is gone). NOTE: if this grep exits 1 (zero matches) that is a FAILURE — the delete confirm was removed out of scope.
- [ ] `grep -rn "addEventListener('storage'" src/` → exactly 1 match, in `src/profile/store.ts`
- [ ] `! grep -q "ielts-coach-data.json" src/profile/store.ts` → success is NO match (the undated constant is gone; a match makes the negated grep exit 1 and fail this criterion)
- [ ] `grep -c "must never write tombstones" SPEC.md` → 1
- [ ] `grep -c "same build before merging" SPEC.md` → ≥ 1
- [ ] All seven mutation checks run and reported with their observed failure messages
- [ ] `git status --porcelain -- . ':!plans/'` shows nothing outside the in-scope list (NEVER bare `git status --porcelain` — the baseline tree carries untracked `plans/*.md`)

## STOP conditions

Stop and report back (do not improvise) if:

- Step 0's dependency gate fails — 016 has not landed. Report and end there;
  implementing 016 is outside this plan.
- Drift beyond 016's expected changes: any excerpt in "Current state" differs
  in a way 016's plan does not account for.
- You find yourself wanting to edit an existing migration rung (v1→v5) rather
  than append below it — the ladder is append-only; report why you think an
  edit is needed.
- You find yourself wanting tombstones for cap evictions "for consistency".
  That is the exact failure 1f exists to prevent. Re-read it and report.
- An EXISTING store test other than the ones enumerated in step 1g fails after
  the version bump. The enumeration was verified exhaustive at `d4ddef8`; a
  surprise failure means either 016 added a version-pinned case (update it the
  same way and NOTE it in your report) or your change broke real behaviour —
  distinguish before proceeding, and stop if it is the latter.
- The merge path ever writes without `backupCurrentStore` running first, or
  you cannot make the union→subtract→cap order hold — both are data-loss
  shapes, not style choices.
- `onExternalStoreChange`'s callback fires on backup-key writes (it would
  re-render every tab on every backup) — fix the filter; if you cannot, stop.
- Any UI test needs `render(<App />)` instead of `renderApp()` to pass — that
  reintroduces the documented flake; the test is wrong, not the helper.

## Maintenance notes

For whoever owns this code next:

- **`deletedIds` is the app's first distributed-consistency structure.** Every
  future write path must decide explicitly: is this a learner delete
  (tombstone) or a retention policy (never)? The SPEC sentence in step 7 is
  the test.
- **Merge order is union → subtract → cap, and the order is load-bearing.**
  Subtract-after-cap can evict a survivor to protect a record that a tombstone
  then removes anyway; the order test pins it — do not weaken that test.
- **The export format is now versioned data + additive metadata.** Future
  additions to the payload should stay additive (older same-version builds
  ignore unknown keys); anything structural needs a `SCHEMA_VERSION` bump and
  a ladder rung, and re-points the three `SCHEMA_VERSION + 1` tests again.
- **The filename date is derived from `exportedAtISO`** — one clock read. A
  second `new Date()` reintroduces the midnight-straddle mismatch.
- **Deferred deliberately**: a `BroadcastChannel` fast path (the `storage`
  event already covers same-origin tabs with zero new machinery); merge
  conflict UI beyond last-wins-by-id (records are immutable, ids are UUIDs —
  there is nothing to merge WITHIN a record); tombstone garbage collection
  tied to session ages (500-newest is enough until real sync exists); an
  eviction-disclosure UI test with 200+ jsdom records (covered at the engine
  level, step 3d explains where).
- **What a reviewer should scrutinise**: that `capSessions` cannot reach
  `deletedIds` (1f); that both import modes back up before writing; that the
  resurrect-prevention mutation check was actually run (it is the whole point
  of tombstones); and that the storage listener filters to the store key so
  backup writes cannot storm every open tab.
