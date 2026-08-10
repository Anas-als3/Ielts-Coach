# Plan 016: Make the store durable — prune backups, unique keys, surface failures, guard the report

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. Do NOT edit `plans/README.md`; the reviewer who
> dispatched you maintains the index.
>
> **Drift check (run first)**:
> `git diff --stat ae92bac..HEAD -- src/profile/store.ts src/App.tsx src/components/Report.tsx src/types.ts tests/store.test.ts SPEC.md`
> If any file quoted in "Current state" changed since this plan was written,
> compare the excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition. Every line number below was read off `ae92bac`.

## Status

- **Priority**: **P0** — silent data loss, and a blank page after a 40-minute timed exam
- **Effort**: M (1 day)
- **Risk**: MED — `store.ts` is the file plan 001 exists because of; a bad change here destroys learners' history
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `ae92bac`, 2026-08-10

## Why this matters

**The store's stated contract is "nothing is ever destroyed without a recoverable
copy" (`src/profile/store.ts:15-25`, `:338-342`). Five separate defects break it,
and one of them ends a timed exam on a blank screen.**

Every claim below was reproduced against the real exported API on 2026-08-10 at
`ae92bac`, using the same in-memory `localStorage` stub `tests/store.test.ts` uses.

| Defect | Measured |
|---|---|
| **016-a** Backups are minted forever and nothing ever deletes one — `removeItem` appears **nowhere** in `src/` | 6 damaged payloads → 6 backup keys, none pruned, no UI to list or delete them |
| **016-b** The per-section cap allows 200 writing + 400 answer-key records | **6.23 MB** worst case, against a typical **~5 MB** origin quota — and backups sit on top of that |
| **016-c** `writeStore` swallows a quota failure into `console.warn`; `saveSession` returns `void` | `saveSession(record)` returned `undefined`, `loadSessions()` did **not** contain the record, and `App.tsx` then navigated to a report for a session that does not exist |
| **016-d** The backup key is a bare millisecond timestamp — no salt, no collision check | 3 **different** damaged payloads on one millisecond → **1** key, holding only the third. A and B destroyed, with the console still saying a copy was kept |
| **016-e** `clampBand(undefined)` returns 4 and `formatBand` renders `"4.0"` | An imported record with `byCriterion: {}` loads cleanly and renders a confident **"Task Response 4.0"** with a filled bar and a matching `aria-label` |

016-c is the one a learner actually feels. `App.tsx:1041` is:

```tsx
      {view === 'report' && reportSession && (
```

with **no fallback branch** — unlike Reading (`:1075-1088`) and Listening
(`:1118-1131`), which both fall back to their picker when the session is null. So
a failed write means a learner finishes a 40-minute timed essay, the app switches
to the report view, `reportSession` resolves to `null`, and they get a page with
a header and **nothing else**. The only signal is a line in a console they are
not looking at.

016-e is the app violating a policy it wrote down itself. `src/reading/bandTable.ts:104-106`:

> Returning the floor band instead would be worse than a possibly wrong table —
> it would report a confident 4.0 to a learner who may have scored 39, and **a
> band that low is exactly the number someone acts on**.

The report does exactly that.

## Current state

Read each cited line before changing it. Line numbers are from `ae92bac`.

### 016-a — backups accumulate; nothing prunes them

`src/profile/store.ts:352-364`:

```ts
function backupRaw(raw: string, reason: string): void {
  try {
    if (hasIdenticalBackup(raw)) return
    const key = `${BACKUP_KEY_PREFIX}${new Date().toISOString()}`
    window.localStorage.setItem(key, raw)
    console.warn(
      `IELTS Coach: ${reason} ` +
        `A copy of the data as it was stored was kept at localStorage key "${key}".`,
    )
  } catch (err) {
    console.warn('IELTS Coach: could not back up saved data before replacing it.', err)
  }
}
```

`BACKUP_KEY_PREFIX` is `'ielts-coach.backup.'` (`:44`). There is no cap, no age
pruning and no UI: `src/components/Dashboard.tsx:280-282` offers "Restore from a
backup file" (a file picker over `importData`), and nothing anywhere lists or
deletes the `localStorage` backup keys.

`hasIdenticalBackup` (`:328-336`) only suppresses a **byte-identical** payload,
so every import of a changed store, and every read of a newly-damaged store,
mints another full copy.

**Verify the absence yourself**: `grep -rn "removeItem" src/` → **no matches**
(measured at `ae92bac`).

**Reproduced**: six distinct damaged payloads, one per millisecond, produce six
backup keys and nothing prunes them.

### 016-b — the per-section cap allows 600 records

`src/profile/store.ts:61`:

```ts
const MAX_SESSIONS_PER_SECTION = 200
```

Applied per section by `capSessions` (`:226-241`) across `writing` / `reading` /
`listening`. **Measured record sizes**, by building real records through
`analyzeEssay` and `markAnswerKey` and calling `JSON.stringify(...).length`:

| Record | Bytes | kB |
|---|---|---|
| Writing — a clean worked answer (0 issues) | 4,929–5,006 | 4.81–4.89 |
| Writing — a flawed Band-6 answer (12 issues, 290 words) | **8,177** | **7.99** |
| Answer key — `reading-academic-01`, all 40 answered | **12,241** | **11.95** |
| Answer key — `reading-general-01`, all 40 answered | 12,137 | 11.85 |

Worst case at the current cap: 200 × 7.99 kB + 400 × 11.95 kB = **6.23 MB**,
against a typical ~5 MB origin quota. Under the old global 200-record cap the
same measurement gives **1.56 MB**. Backups are on top of both.

(The realistic writing figure depends on issue count and essay length; a longer,
weaker answer will exceed 7.99 kB. Take 8 kB as a measured floor, not a ceiling.)

### 016-c — a failed write is invisible to the caller and to the learner

`src/profile/store.ts:446-458`:

```ts
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
```

`saveSession` (`:467-473`) returns `void`. All three call sites in `App.tsx` do
save → re-read → set an id:

- `:350-353` (writing submit), `:490-492` (Reading submit), `:551-553` (Listening submit)

```tsx
    saveSession(record)
    // Re-read the store so in-memory state always matches persistence (cap, sort).
    setSessions(loadSessions())
    setReportSessionId(record.id)
```

and `reportSession` is resolved from the re-read list (`App.tsx:639`):

```tsx
  const reportSession = writingSessions.find((s) => s.id === reportSessionId) ?? null
```

**Reproduced**: with `setItem` throwing `QuotaExceededError` for `STORAGE_KEY`,
`saveSession` returned `undefined` and `loadSessions()` did not contain the
record. `App.tsx` then sets `view = 'report'` with `reportSession === null`, and
`:1041` renders nothing.

Compare the shape the two answer-key sections already have —
`App.tsx:1075-1078`:

```tsx
      {view === 'reading' &&
        (readingStage === 'picker' ||
          (readingStage === 'running' && readingTest === null) ||
          (readingStage === 'report' && readingSession === null)) && (
```

### 016-d — the backup key collides silently

`src/profile/store.ts:355` again:

```ts
    const key = `${BACKUP_KEY_PREFIX}${new Date().toISOString()}`
```

`toISOString()` has millisecond resolution. There is no salt and no
`getItem(key) === null` check, so `setItem` on an existing key **overwrites**.

**Reproduced on a frozen clock** (`vi.setSystemTime(new Date('2026-08-10T12:00:00.000Z'))`),
three DIFFERENT damaged payloads read in sequence:

```
three DIFFERENT damaged payloads on one millisecond -> 1 backup key(s):
  ["ielts-coach.backup.2026-08-10T12:00:00.000Z"]
    ielts-coach.backup.2026-08-10T12:00:00.000Z holds C
```

A and B are gone, and the console said a copy was kept for each. This is the one
line that breaks the module's stated contract.

### 016-d(ii) — `tests/store.test.ts:829` is vacuous

```ts
  it('does not mint a second backup of a payload it has already copied', () => {
    // Reads are pure, so the damaged payload is seen again on every render.
    // One backup per read would fill the quota holding the surviving essays.
    seed(5, [ … ])

    loadSessions()
    loadSessions()
    loadSessions()

    expect(backupKeys()).toHaveLength(1)
  })
```

Three back-to-back reads land in the same millisecond, so the assertion holds
whether or not `hasIdenticalBackup` exists. **Measured: 199 of 200 runs** had all
three reads inside one millisecond. Fixing 016-d — which makes colliding keys
distinct — turns this test from vacuous into actively wrong, so it must be fixed
in the same step, with `vi.useFakeTimers()` (already imported: `tests/store.test.ts:14`).

`tests/store.test.ts:109-111` already has the helper you need:

```ts
function backupKeys(): string[] {
  return Array.from(store.keys()).filter((k) => k.startsWith(BACKUP_PREFIX))
}
```

and the stub at `:30-46` already implements `removeItem`, `key(i)` and `length`.

### 016-e — a confident 4.0 for a band the record does not contain

`src/components/Report.tsx:112-123`:

```ts
function clampBand(n: number): number {
  return Math.min(9, Math.max(4, Number.isFinite(n) ? n : 4))
}

function formatBand(n: number): string {
  return clampBand(n).toFixed(1)
}

/** Position of a band value on the 4-to-9 scale, as a 0–100 percentage. */
function bandPct(n: number): number {
  return ((clampBand(n) - 4) / 5) * 100
}
```

`src/types.ts:356` types the field as **total**:

```ts
  byCriterion: Record<Criterion, number>;
```

so `analysis.band.byCriterion[c]` type-checks at all four call sites —
`Report.tsx:476` (the scale's `aria-label`), `:488` and `:490` (marker position
and `title`), `:510` (the tile's printed band), `:514` (the tile's fill width) —
while the runtime value can be `undefined`.

`src/profile/store.ts:181` admits it:

```ts
  return isRecordObject(band.byCriterion) && isRecordObject(band.rationale) && typeof band.overall === 'number'
```

`isRecordObject({})` is `true`. `importData` runs the same `looksLikeSession`
validator (`:546-553`).

**Reproduced**: a record with `band: { overall: 7, byCriterion: {}, rationale: {} }`
loads through `loadSessions()`, and

```
    TR:  value=undefined  formatBand -> "4.0"  bandPct -> 0%
    CC:  value=undefined  formatBand -> "4.0"  bandPct -> 0%
    LR:  value=undefined  formatBand -> "4.0"  bandPct -> 0%
    GRA: value=undefined  formatBand -> "4.0"  bandPct -> 0%
```

`src/components/ModelAnswer.tsx:117` and `src/components/FeedbackPanel.tsx:131`
read the same field but only ever from a **live** analysis the engine just
produced, so they are not at risk and are out of scope.

### Repo conventions you must match

- **React 18 + TypeScript strict, Vite, pure client-side, `localStorage` only,
  deterministic rule analysis. No LLM, no server, no network.** Runtime
  dependencies are exactly `react` and `react-dom`.
- **`store.ts` never throws on a read and never crashes the app on a write.** Every
  new path must keep that: "Losing the backup is bad; refusing to load the app
  because the backup failed would be worse" (`:344-346`).
- **Comments explain WHY** — the failure mode prevented. `store.ts` is written
  that way throughout; match it.
- **Mutation-check anything you pin.** `SPEC.md:717-724` records that every letter
  constant was documented but unexercised until a test failed when it moved. Any
  constant you add here (a backup cap, a retry count) needs the same treatment.
- **`IssueCategory` ids are FROZEN** and `Criterion` stays four members. Neither
  changes here.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npx tsc -b --noEmit` | exit 0, no output |
| Full suite | `npx vitest run` | **848 passed / 24 files** at `ae92bac`; more after this plan |
| Store only | `npx vitest run tests/store.test.ts` | all pass |
| Engine project | `npx vitest run --project engine` | all pass |
| UI project | `npx vitest run --project ui` | all pass |
| Build | `npm run build` | exit 0 |

**UI determinism**: every UI test must render through `renderApp()` from
`tests/ui/renderApp.tsx` — never `render(<App />)`, which draws a random prompt.
After any UI change, run `npx vitest run --project ui` **ten consecutive times**
and confirm identical results.

## Scope

**In scope**:

- `src/profile/store.ts` — 016-a, 016-b, 016-c (the `SaveResult` return), 016-d, 016-e (the validator)
- `src/components/Report.tsx` — 016-e (the three band helpers)
- `src/App.tsx` — 016-c (the save-failure banner and the missing report fallback)
- `src/types.ts` — 016-c only: the `SaveResult` type. **Do not touch `BandEstimate`.**
- `tests/store.test.ts` — new cases, plus repairing the vacuous `:829` test
- `tests/ui/report-fallback.test.tsx` (create) — 016-c's UI half
- `SPEC.md` — record the backup cap, the key salt, the save result and the validator tightening

**Out of scope** (do NOT touch, even though they look related):

- **`src/types.ts:356` `byCriterion: Record<Criterion, number>`** — leave the type
  alone. Widening it to `Partial<Record<…>>` ripples through all three band
  estimators, `FeedbackPanel.tsx`, `ModelAnswer.tsx` and every view, for a value
  that is only ever missing on an imported or hand-edited record. The fix is at
  the two boundaries where untrusted data enters: the validator and the renderer.
- `src/components/ModelAnswer.tsx`, `src/components/FeedbackPanel.tsx` — they read
  live analyses only.
- `src/analysis/**` — the estimators always emit all four criteria.
- Any change to the export file format or `EXPORT_FILENAME` — exported files must
  stay importable by older builds.
- `SCHEMA_VERSION` — **do not bump it.** Nothing here changes the stored shape,
  and plan 001 exists because a bump once destroyed every saved session.
- `MAX_SESSIONS_PER_SECTION` as a number — see step 3; the quota fix is eviction
  and reporting, not a smaller cap chosen by guess.
- `plans/README.md` — the reviewer owns the index.

## Git workflow

- Branch: `advisor/016-store-durability`, off `main`.
- **One commit per lettered fix** (016-a … 016-e), so each can be reverted
  independently. Message style matches `git log`: a plain imperative sentence,
  e.g. `Cap and prune the backup keys, and stop them colliding`.
- Do NOT push and do NOT open a PR.

## Steps

### Step 1: Write the failing tests FIRST

Add to `tests/store.test.ts`, reusing `installLocalStorage()` (`:30-46`),
`seed()` (`:105-107`) and `backupKeys()` (`:109-111`). Every case drives the real
exported API, as the whole file already does.

1. **016-d collision**: with `vi.useFakeTimers()` and
   `vi.setSystemTime(new Date('2026-08-10T12:00:00.000Z'))`, read three DIFFERENT
   damaged payloads. Assert `backupKeys()` has length 3 and that each payload is
   recoverable from exactly one of them. **Fails now** — measured: 1 key holding
   only the third.
2. **016-a cap**: mint more backups than the cap allows, on a frozen clock, and
   assert `backupKeys().length` never exceeds the cap and that the survivors are
   the newest. **Fails now** — nothing prunes.
3. **016-c result**: make `setItem` throw `QuotaExceededError` for `STORAGE_KEY`
   only, then assert `saveSession(record)` reports the failure. **Fails now** —
   returns `undefined`.
4. **016-c retry**: with one old backup present and `setItem` throwing on the
   FIRST attempt for `STORAGE_KEY` and succeeding on the second, assert the oldest
   backup was evicted and the session persisted. **Fails now.**
5. **016-e validator**: a record whose `band.byCriterion` is `{}` — and one where
   a criterion is `null` — must be REJECTED by `loadSessions()` (dropped, with a
   backup taken) and must make `importData` throw. **Fails now** — both accepted.

**Verify**: `npx vitest run tests/store.test.ts` → **at least 5 new failures**.
If any passes now, the fixture is not reproducing the bug — fix the fixture
before touching `store.ts`.

### Step 2: 016-d — make the backup key unique, and repair the vacuous test

In `src/profile/store.ts`, replace the bare timestamp with a
collision-checked key:

```ts
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
function nextBackupKey(): string
```

Take the ISO stamp, and if `getItem` on that key is non-null, append `-1`, `-2`,
… until it is free. Guard the loop with a small bound so a pathological store
cannot spin.

Then repair `tests/store.test.ts:829`. Wrap it in `vi.useFakeTimers()` /
`vi.setSystemTime(...)` so all three reads provably share a millisecond, and
**prove the assertion now has teeth**: temporarily make `hasIdenticalBackup`
return `false` and confirm the test **fails** (it produces 3 keys, not 1);
restore, confirm it passes. Report both observations. This is the same mutation
check plan 001 used on the migration ladder.

**Verify**: `npx vitest run tests/store.test.ts` → cases 1 and the repaired `:829`
pass; every other store test passes.

### Step 3: 016-a and 016-b — cap the backups and prune on write

Add the constant next to `MAX_SESSIONS_PER_SECTION` (`:61`), with a doc comment
in the file's voice explaining what it trades:

```ts
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
```

Write `pruneBackups(keep: number): void` — collect every key with
`BACKUP_KEY_PREFIX`, sort ascending (the keys are ISO stamps with a numeric
suffix, so text order is age order), and `removeItem` the oldest until `keep`
remain. Wrap it in `try/catch`: a failure to prune must never block the read or
write that follows.

Call it at the end of `backupRaw` (`:352-364`), after the successful `setItem`.

**Do not lower `MAX_SESSIONS_PER_SECTION`.** The measured 6.23 MB worst case is
real, but choosing a smaller number by guess deletes learners' work to solve a
problem the eviction-and-retry in step 4 solves without deleting anything. Record
the measurement in SPEC.md (step 7) so the next person has the number.

**Verify**: `npx vitest run tests/store.test.ts` → case 2 passes.
**Verify the cap has teeth (mutation pin)**: change `MAX_BACKUPS` from 5 to 500
and confirm case 2 **fails**; restore it and confirm it passes. Report both.
**Verify**: `grep -rn "removeItem" src/` → now returns exactly the `pruneBackups`
site (it returned nothing at `ae92bac`).

### Step 4: 016-c — give the write a result, and retry once after evicting a backup

**4a.** In `src/types.ts`, add the result type. Keep it small and total — the
caller must not have to guess:

```ts
/** What a write to localStorage did. `saveSession` returns this so a caller can tell the learner. */
export type SaveResult =
  | { ok: true }
  | { ok: false; reason: 'quota' | 'unavailable'; message: string };
```

**4b.** `writeStore` returns `SaveResult` instead of `void`, and on failure tries
**once** more after evicting the oldest backup:

```ts
  // A quota failure is the one case where this module is holding something it
  // can give up: an old backup copy. Evicting the oldest and retrying once
  // spends a recovery copy to save the thing the copies exist to protect — a
  // learner's essay, which is 40 minutes of work and cannot be re-run, against
  // a snapshot of a store that has since been read successfully.
  // ONCE, not in a loop: if a second attempt fails too, the store is full of
  // sessions rather than of backups, and the honest answer is to tell the
  // learner rather than to keep deleting their history to make room.
```

`message` must be learner-facing, in the DESIGN.md voice, and must say what to
do — export the data now, before more is written.

**4c.** `saveSession` (`:467-473`) returns the `SaveResult` from `writeStore`.
`deleteSession` (`:476-481`) and `importData` (`:513-567`) keep their current
signatures; `importData` already throws for its own failures and its callers
already catch (`Dashboard.tsx:237-247`).

**4d.** In `src/App.tsx`, all three submit handlers (`:350-353`, `:490-492`,
`:551-553`) capture the result and set a persistent banner state on failure.
`role="alert"` — `src/components/ListeningRunner.tsx:723` uses `role="status"`
for a non-urgent notice; a save failure is urgent and losing work is the cost, so
use `alert`. The banner must stay until dismissed; a toast that disappears while
the learner is reading their report is not a warning.

**4e.** Add the missing report fallback at `App.tsx:1041`, mirroring the Reading
shape at `:1075-1078` exactly:

```tsx
      {view === 'report' && reportSession === null && (
        …a card explaining the essay could not be loaded, with a button back to
        the editor and one to Progress…
      )}
```

The two branches must be mutually exclusive so exactly one main element renders.

**Verify**: `npx vitest run tests/store.test.ts` → cases 3 and 4 pass.
**Verify**: `npx tsc -b --noEmit` → exit 0. Any caller that ignored the old
`void` return still compiles; that is intended — the type change is additive.

### Step 5: 016-c (UI) — prove the blank page is gone

Create `tests/ui/report-fallback.test.tsx`. It **must** render through
`renderApp()` from `tests/ui/renderApp.tsx` — the module's header explains why
(`render(<App />)` draws a random prompt from 40 and failed roughly three runs in
ten). Two cases:

1. With `window.localStorage.setItem` throwing `QuotaExceededError` for the store
   key, write and submit an essay: assert the save-failure banner is present
   (`getByRole('alert')`) and that the page is not empty.
2. Without the throw, submit normally: assert the report renders and **no** alert
   is present.

**Verify**: `npx vitest run --project ui` → all pass, ten consecutive times with
identical results.

### Step 6: 016-e — reject the record, and render an em dash when it slips through

Two independent boundaries. Both are needed: the validator stops new bad data
entering, and the renderer stops data already on disk rendering a lie.

**6a.** Tighten `looksLikeSession` in `src/profile/store.ts:179-181`. Require all
four `Criterion` keys present and finite:

```ts
/**
 * `byCriterion` must carry all four criteria as finite numbers.
 *
 * `isRecordObject(band.byCriterion)` accepted `{}`, and the report then read
 * `undefined` through `clampBand`, which floors a non-finite value to 4 — so an
 * imported record rendered a confident "Task Response 4.0" with a filled bar and
 * a matching aria-label for a band the record does not contain.
 * `src/reading/bandTable.ts:104-106` states this project's policy on exactly
 * this: a band that low is exactly the number someone acts on.
 */
```

Derive the key list from the `Criterion` union rather than hard-coding four
strings, so adding a criterion cannot silently skip the check.

Note what this does to existing data: a stored record with an incomplete
`byCriterion` is now DROPPED on read — and dropping records is precisely the
branch at `:424-439` that takes a full backup first, so nothing is destroyed.
`importData` (`:546-553`) rejects the whole file, which is its existing
documented behaviour for a bad record.

**6b.** In `src/components/Report.tsx:112-123`, make the three helpers accept
`number | undefined` and distinguish "no value" from "band 4.0":

- `formatBand(n: number | undefined): string` → `'—'` when `n` is not finite.
- `bandPct(n: number | undefined): number` → `0` when not finite (the bar is
  empty, which reads as "nothing to show" rather than "the floor").
- `clampBand` keeps its floor for genuine numbers; the `: 4` fallback for
  non-finite input moves out of it and becomes the caller's business.

Update all five call sites (`:476`, `:488`, `:490`, `:510`, `:514`). `:473-474`
passes `lo`/`hi`, which are computed at `:426-427` from `overall` and are always
numbers — they keep working unchanged.

The `aria-label` at `:473-477` must say the same thing the visible text says: a
screen-reader user must not hear "Task Response 4.0" where a sighted user sees
"—".

**Verify**: `npx vitest run tests/store.test.ts` → case 5 passes.
**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `npx vitest run` → all pass.

### Step 7: SPEC.md

Record, in the `profile/` section:

- `MAX_BACKUPS`, what it trades, and that pruning is newest-N.
- The backup key's collision suffix and why a counter rather than a random salt.
- The measured record sizes and the 6.23 MB worst case at
  `MAX_SESSIONS_PER_SECTION = 200` — the number the next person needs before they
  reason about the cap again.
- `SaveResult`, the evict-and-retry-once policy, and the rule that a second
  failure is reported rather than retried.
- The tightened `byCriterion` validation, and that `Report.tsx` renders `—` for a
  missing criterion rather than the floor band.

**Verify**: `grep -c "MAX_BACKUPS" SPEC.md` → at least 1.

### Step 8: Full green

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `npx vitest run` → all pass, 848 + your new tests.
**Verify**: `npm run build` → exit 0.
**Verify**: `npx vitest run --project ui` ten consecutive times → identical results.

## Test plan

| File | Cases |
|---|---|
| `tests/store.test.ts` | 016-d: three different payloads on one frozen millisecond → three recoverable keys · repaired `:829` with fake timers, plus its mutation check · 016-a: pruning to `MAX_BACKUPS`, newest kept, plus its mutation check · 016-c: `saveSession` reports a quota failure · 016-c: evict-oldest-and-retry succeeds on the second attempt · 016-c: a second failure is reported, not retried again · 016-e: `byCriterion: {}` rejected on read (with a backup taken) and rejected by `importData` · 016-e: a `null` criterion rejected · regression: a complete record still loads |
| `tests/ui/report-fallback.test.tsx` (new) | a quota-failing submit shows a persistent `role="alert"` banner and a non-empty page · a normal submit renders the report with no alert |

Model the store cases on the existing blocks: `:801-850` for backup behaviour and
`:854-…` for import behaviour. Model the UI test on any existing file under
`tests/ui/`, all of which use `renderApp()`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc -b --noEmit` exits 0
- [ ] `npx vitest run` exits 0; ≥ 848 tests pass; all new cases pass
- [ ] `npm run build` exits 0
- [ ] `npx vitest run --project ui` produces identical results across 10 consecutive runs
- [ ] `grep -rn "removeItem" src/` returns the `pruneBackups` site (it returned nothing at `ae92bac`).
      Forward note for reconciliation: plan 025 later adds a second legitimate
      site (`clearDraft` in `src/profile/draft.ts`) — if 025 has landed, this
      criterion reads "exactly the pruneBackups and clearDraft sites".
- [ ] `grep -c "SCHEMA_VERSION = 5" src/profile/store.ts` still returns 1 — the version was NOT bumped
- [ ] `grep -n "byCriterion: Record<Criterion, number>" src/types.ts` still matches — the type was NOT widened
- [ ] Both mutation checks (step 2's `hasIdenticalBackup`, step 3's `MAX_BACKUPS`) were run and reported
- [ ] `git status --porcelain -- . ':!plans/'` shows no file modified outside the in-scope
      list (exclude `plans/` — the baseline tree already carries a modified `plans/README.md`
      and ten untracked `plans/0NN-*.md` files, so a bare `git status` is never clean)
- [ ] SPEC.md records `MAX_BACKUPS`, the key suffix, `SaveResult` and the validator tightening

## STOP conditions

Stop and report back (do not improvise) if:

- Any excerpt in "Current state" does not match the live file.
- You find yourself wanting to bump `SCHEMA_VERSION`. Nothing here changes the
  stored shape, and plan 001 exists because a bump once destroyed every saved
  session.
- You find yourself wanting to widen `BandEstimate.byCriterion` to a `Partial`.
  That is explicitly out of scope; report why you think it is needed.
- The tightened validator drops a record any existing test seeds. That means an
  existing fixture is incomplete — report the fixture, do not loosen the
  validator to accommodate it.
- Pruning removes a backup any existing test relies on. Report which test and
  what it asserts; do not raise `MAX_BACKUPS` to make it pass.
- The evict-and-retry path can loop more than once, or `pruneBackups` can throw
  out of `backupRaw`. Both would turn a save failure into a crash.
- Any store test fails on a path you did not change. `store.ts` is the file plan
  001 exists because of; an unexplained failure there is data loss, not flake.

## Maintenance notes

For whoever owns this code next:

- **`removeItem` now exists in this codebase for the first time.** It is
  `pruneBackups` and nothing else. Any second caller is deleting a learner's data
  and needs the same scrutiny the eviction path got here.
- **The backup keys sort by age as text only because the suffix is a counter.**
  If anyone ever swaps it for a random salt, `pruneBackups` silently starts
  deleting the wrong copies.
- **`SaveResult` is the first place the store tells a caller something failed.**
  Reading and Listening submits now have somewhere to report to as well; if a
  fourth section is added, wire its submit into the same banner rather than
  inventing a second one.
- **The quota measurement will drift.** 6.23 MB was measured at
  `MAX_SESSIONS_PER_SECTION = 200` with one Reading paper per module. Authoring
  a second paper does not change the per-record size, but a Listening record's
  size was not measured here and a mock-test record (plan 013) would be larger
  than either. Re-measure before raising any cap.
- **Deferred deliberately**: a UI for listing and restoring the `localStorage`
  backup keys. The Dashboard's "Restore from a backup file" only reads exported
  FILES, so the timestamped keys remain devtools-only — recoverable by hand, as
  the module promises, but not by a learner. Worth building once someone has
  actually needed one.
- **What a reviewer should scrutinise**: that `pruneBackups` can never throw out
  of `backupRaw`; that the retry runs at most once; that the tightened validator
  drops records only through the branch that backs up first; and that the report
  fallback and the report itself are mutually exclusive so the page can never
  render two `<main>` elements or none.
