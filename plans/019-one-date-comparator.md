# Plan 019: One date comparator, used everywhere — so an imported file cannot congratulate a learner on a weakness they still have

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. Do **not** update `plans/README.md`: the
> coordinator owns the index for this batch.
>
> **Drift check (run first)**:
>
> ```bash
> git diff --stat ae92bac..HEAD -- src/profile/store.ts src/profile/profile.ts \
>   src/components/Dashboard.tsx src/App.tsx SPEC.md tests/
> ```
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED — the change is small, but it moves the order that feeds the
  band trend chart, the trend/`lastSeenISO` maths, and the report's
  "previous session" comparison. Every one of those is learner-facing.
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `ae92bac`, 2026-08-10

## Why this matters

This app already knows that ISO-8601 strings do not sort correctly as text.
`SPEC.md:264-267` says so in as many words, and `src/profile/store.ts:202-211`
implements it. Three other places sort the same records **by text anyway**, and
one of them still carries a doc comment asserting the opposite.

The failure is not cosmetic. `src/profile/profile.ts:157` feeds the chronological
order into `leastSquaresSlope` over the last six sessions (`:181`), whose sign
decides `improving` / `flat` / `worsening` (`:182-183`); the same order decides
`lastSeenISO` (`:191`) and drives every sparkline in `computeTrends` (`:226`).
Reverse two sessions and a live weakness reports as fixed.

`src/types.ts:590-595` already names this exact failure as the one to design
against:

> the paper counts towards `totalSessions`, contributes zero issues over zero
> words to every category, and a weakness the learner still has flips from
> `flat` to `improving`. The Dashboard then congratulates them on fixing it. A
> silent wrong answer in a coaching signal is the worst failure mode in this app.

The trigger is real and already contemplated by the codebase: the app writes
`toISOString()` (always UTC), but `importData` accepts a file written anywhere.
`2026-01-01T23:00:00+05:00` is 18:00Z — three hours **before** `2026-01-01T20:00:00Z`,
and **after** it as text. `tests/store.test.ts:994-1010` already pins that exact
fixture for the storage cap. The profile, the Dashboard and the report have no
such pin, because they never got the fix.

After this plan there is one comparator, in one module, used by all four call
sites, with a test that fails if any of them regresses.

## Current state

Files involved, and their role:

- `src/profile/store.ts` — localStorage persistence. Holds the **correct**
  comparator, module-private, at lines 202–211; uses it at `:471` and `:564`.
- `src/profile/profile.ts` — `computeProfile` / `computeTrends`. Sorts by text at
  line 89, under a comment at line 87 that states the false premise.
- `src/components/Dashboard.tsx` — the Progress page. Sorts by text at line 227.
- `src/App.tsx` — picks the report's "previous session" by text comparison at
  line 641.
- `SPEC.md:264-267` — the canonical statement of the rule, currently scoped to
  the storage cap only.

### The correct comparator — `src/profile/store.ts:184-211`

```ts
/**
 * Ascending by INSTANT (oldest first).
 *
 * Compared as parsed times rather than as text, because "ISO-8601 sorts
 * correctly as text" is only true while every string is in the same zone. This
 * app writes `toISOString()`, which is always UTC — but an IMPORTED file need
 * not be, and `2026-01-01T23:00:00+05:00` (18:00Z) sorts AFTER
 * `2026-01-01T20:00:00Z` as text while falling three hours before it in time.
 * A mis-ordered list is not cosmetic here: the list order is what `capSessions`
 * calls "oldest", so text order decides which record gets deleted.
 *
 * Unparseable dates sort last and are compared to each other as text. They
 * cannot be placed on the timeline at all, and the end of the list is where the
 * cap cannot reach them — when in doubt, keep the learner's record.
 *
 * Equal instants return 0, so `Array.prototype.sort`, which is stable, leaves
 * them in the order they arrived.
 */
function byDateAscending(a: SessionRecord, b: SessionRecord): number {
  const ta = Date.parse(a.dateISO)
  const tb = Date.parse(b.dateISO)
  const aValid = Number.isFinite(ta)
  const bValid = Number.isFinite(tb)
  if (aValid && bValid) return ta - tb
  if (aValid) return -1
  if (bValid) return 1
  return a.dateISO.localeCompare(b.dateISO)
}
```

It is **not exported**. `grep -rn "byDateAscending" src/ tests/` returns exactly
three lines: the definition at `store.ts:202` and its two uses at `store.ts:471`
(`sessions.sort(byDateAscending)`) and `store.ts:564`
(`migrateSessions(...).sort(byDateAscending)`).

### Wrong site 1 — `src/profile/profile.ts:87-90`

```ts
/** Oldest first. ISO-8601 date strings sort correctly as text. */
function sortChronological(sessions: WritingSessionRecord[]): WritingSessionRecord[] {
  return sessions.slice().sort((a, b) => a.dateISO.localeCompare(b.dateISO))
}
```

The comment on line 87 asserts precisely what `SPEC.md:264-267` exists to deny.
`sortChronological` is called twice: `computeProfile` (`profile.ts:157`) and
`computeTrends` (`profile.ts:226`) — so this one line orders **both** exported
functions.

What that order decides, in the same file:

```ts
    // Trend: least-squares slope over the last 6 sessions' rates.
    const slope = leastSquaresSlope(rates.slice(-TREND_WINDOW))
    const trend: CategoryStat['trend'] =
      slope < IMPROVING_SLOPE ? 'improving' : slope > WORSENING_SLOPE ? 'worsening' : 'flat'
```
(`src/profile/profile.ts:180-183`; `IMPROVING_SLOPE = -0.05`, `WORSENING_SLOPE = 0.05`,
`TREND_WINDOW = 6`, declared at `profile.ts:46-51`)

```ts
      if (count > 0) lastSeenISO = ordered[i].dateISO
```
(`src/profile/profile.ts:191`)

With exactly two sessions, `leastSquaresSlope([r0, r1])` reduces to `r1 - r0`.
Swap them and the sign flips — `worsening` becomes `improving`, with no other
change to the data.

### Wrong site 2 — `src/components/Dashboard.tsx:226-230`

```tsx
  const chrono = useMemo(
    () => [...sessions].sort((a, b) => a.dateISO.localeCompare(b.dateISO)),
    [sessions],
  )
  const newestFirst = useMemo(() => [...chrono].reverse(), [chrono])
```

`chrono` is the band trend chart's x-axis (`<BandTrendChart sessions={chrono} />`,
`Dashboard.tsx:328`, rendered when `chrono.length >= 2`, `:324`); `newestFirst`
is the session table (`:396`). `sessions` here is `WritingSessionRecord[]`
(`DashboardProps`, `src/types.ts:720-730`).

### Wrong site 3 — `src/App.tsx:639-642`

```tsx
  const reportSession = writingSessions.find((s) => s.id === reportSessionId) ?? null
  const previousSession = reportSession
    ? writingSessions.filter((s) => s.dateISO < reportSession.dateISO).slice(-1)[0] ?? null
    : null
```

`previousSession` is passed to `<Report>` (`src/App.tsx:1045`), which turns it
into the report's deltas (`buildDeltas(previousSession, session)`,
`src/components/Report.tsx:392`, rendered at `:540`). The wrong "previous"
essay means the learner is shown a comparison against an essay they wrote
afterwards.

`.slice(-1)[0]` takes the **last** match, which is only "the most recent earlier
session" if the list is already in ascending order. It is: `sessions` in `App`
is always `loadSessions()` (`src/App.tsx:123`, and re-read at `:352`, `:492`,
`:553`, `:583`, `:593`), and `loadSessions` sorts by instant. So swapping the
predicate to an instant comparison makes the whole expression correct — do not
also change `.slice(-1)[0]`.

### The canonical rule — `SPEC.md:264-267`

```
DELETE it. Sitting an answer-key paper must never cost a learner an essay. Records are ordered for
that cap by parsed INSTANT, not by the text of `dateISO`: an imported file may carry an offset
(`23:00+05:00` is three hours before `20:00Z` and sorts after it as text), and list order is what
"oldest" means here.
```

Note "for that cap" — the spec scopes the rule to `capSessions`. Step 5
generalises that sentence, because after this plan it is the app-wide rule.

### The fixture that already exists — `tests/store.test.ts:994-1010`

```ts
  it('orders imported records by instant, not by the text of the date', () => {
    // 23:00+05:00 is 18:00Z — three hours BEFORE 20:00Z, and after it as text.
    // The app only ever writes UTC, but an imported file need not, and the list
    // order is what `capSessions` calls "oldest": text order decides which
    // record gets deleted.
    importData(
      JSON.stringify({
        schemaVersion: 5,
        sessions: [
          makeSession('later', '2026-01-01T20:00:00.000Z', { task: 'task2', section: 'writing' }),
          makeSession('earlier', '2026-01-01T23:00:00+05:00', { task: 'task2', section: 'writing' }),
        ],
      }),
    )

    expect(loadSessions().map((s) => s.id)).toEqual(['earlier', 'later'])
  })
```

Reuse these two timestamps in the new tests. Using the same fixture across the
storage, profile and comparator suites is the point: one pair of dates, one
meaning.

### Repo conventions you must match

- **TypeScript strict**, no `any`. Runtime dependencies are exactly `react` and
  `react-dom` (`README.md:165`, "No runtime dependencies beyond React"). **This
  plan must not add a dependency**, and in particular must not reach for a date
  library — `Date.parse` is sufficient and is already the shipped approach.
- **Analysis and profile modules are pure and synchronous.** No I/O, no state.
  The new module must be importable by a component without dragging
  `localStorage` in, which is why it is its own file rather than an export added
  to `store.ts`.
- **Comments explain WHY.** See the excerpt above from `store.ts:184-201` for the
  density expected: the reasoning, the counter-example, and the consequence.
- **`src/types.ts` holds the shared contract and `IssueCategory` is frozen**
  (`README.md:169`). Do not edit `types.ts`.
- **`SPEC.md` is canonical** for thresholds and rules (`README.md:167`).
- **Tests**: vitest, one file per concern, in `tests/`. `tests/*.test.ts` runs in
  the `engine` project (Node, no DOM); `tests/ui/*.test.tsx` in `ui` (jsdom).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npx tsc -b --noEmit` | exit 0, no output (~1.1 s) |
| Full suite | `npx vitest run` | 24 files, **848 tests**, all pass (~7.3 s) |
| Engine only | `npx vitest run --project engine` | all pass |
| The two pinned suites | `npx vitest run tests/profile-scoping.test.ts tests/store.test.ts` | 2 files, **92 tests**, all pass |
| Build | `npm run build` | exit 0 |

Dependencies are already installed. Do **not** run `npm install`.

The **848 passed / 24 files** and **92 tests** figures are the baseline at
`ae92bac`, measured while writing this plan.

## Scope

**In scope** (the only files you should modify):

- `src/profile/chronology.ts` (create — the one comparator)
- `src/profile/store.ts` (modify — delete the private copy, import instead)
- `src/profile/profile.ts` (modify — line 89 and the false comment at line 87)
- `src/components/Dashboard.tsx` (modify — line 227)
- `src/App.tsx` (modify — line 641 only)
- `tests/chronology.test.ts` (create)
- `SPEC.md` (modify — generalise the one sentence at `:264-267`)

**Out of scope** (do NOT touch, even though they look related):

- **`src/types.ts`.** No new shared type is needed; the comparator's parameter
  type is structural and lives with it.
- **`.slice(-1)[0]` in `src/App.tsx:641`, and `newestFirst` in
  `Dashboard.tsx:230`.** Both are correct once the ordering underneath them is.
  Changing them is a second, unrelated behaviour change.
- **The unparseable-date policy** (invalid sorts last, ties broken by
  `localeCompare`). It is deliberate and documented — `store.ts:195-197`: "the
  end of the list is where the cap cannot reach them — when in doubt, keep the
  learner's record." Carry it across verbatim; do not "improve" it.
- **`src/profile/profile.ts:215` and `:234`** — `a.category.localeCompare(b.category)`
  and `Array.from(fired).sort(...)`. Those sort **category ids**, not dates.
  They are correct. Do not touch them.
- **Any change to `EWMA_ALPHA`, `TREND_WINDOW`, `RECENT_WINDOW`,
  `IMPROVING_SLOPE`, `WORSENING_SLOPE`, `FOCUS_LIMIT`** (`profile.ts:46-51`).
  `SPEC.md:270-274` calls those five constants canonical and says
  `tests/profile-scoping.test.ts` pins each one by behaviour. This plan changes
  the *order* they run over, never the constants.
- **Adding component tests for `Dashboard.tsx`.** It has none
  (`plans/README.md`, "Known limitations carried forward") and that gap is real,
  but it is a separate job. The comparator test plus the grep in "Done criteria"
  is this plan's coverage of that call site.
- **Any date library.**

## Git workflow

- Branch: `advisor/019-one-date-comparator` (matches the repo's existing
  `advisor/NNN-slug` convention — see `git branch -a`).
- One commit per step is fine. Plain imperative subjects, matching `git log`
  (e.g. "Fix six storage and data-integrity defects").
- Do NOT push and do NOT open a PR.

## Steps

### Step 1: Create the shared module

Create `src/profile/chronology.ts`. The doc comment is lifted from
`store.ts:184-201` and extended, because the reasoning now covers four call
sites rather than one:

```ts
/**
 * The ONE chronological comparator for session records.
 *
 * "ISO-8601 sorts correctly as text" is true only while every string is in the
 * same zone. This app writes `toISOString()`, which is always UTC — but an
 * IMPORTED file need not be, and `2026-01-01T23:00:00+05:00` (18:00Z) sorts
 * AFTER `2026-01-01T20:00:00Z` as text while falling three hours before it in
 * time. `SPEC.md` states the rule; this module is the only implementation of it.
 *
 * Four things depend on this order, and every one of them is learner-facing:
 *
 *  1. `capSessions` (profile/store.ts) — list order is what "oldest" means, so
 *     text order decides which record gets DELETED.
 *  2. `computeProfile` (profile/profile.ts) — the least-squares slope over the
 *     last six sessions decides improving / flat / worsening, and with two
 *     sessions the slope is just `r1 - r0`. Reversed, a weakness the learner
 *     still has reports as fixed and the Dashboard congratulates them on it.
 *     `types.ts` calls that the worst failure mode in this app.
 *  3. `computeTrends` (profile/profile.ts) and the Dashboard band chart — the
 *     x-axis of every line the learner reads as progress.
 *  4. The report's "previous session" deltas — comparing an essay against one
 *     written afterwards.
 *
 * Unparseable dates sort LAST and are compared to each other as text. They
 * cannot be placed on the timeline at all, and the end of the list is where the
 * cap cannot reach them — when in doubt, keep the learner's record.
 *
 * Equal instants return 0, so `Array.prototype.sort`, which is stable, leaves
 * them in the order they arrived.
 */

/**
 * Structural, not `SessionRecord`: the Dashboard sorts `WritingSessionRecord[]`
 * and the store sorts `SessionRecord[]`, and a component should not have to
 * import the storage module to get a comparator.
 */
export interface HasDateISO {
  readonly dateISO: string
}

/** Ascending by parsed instant (oldest first). */
export function byDateAscending(a: HasDateISO, b: HasDateISO): number {
  const ta = Date.parse(a.dateISO)
  const tb = Date.parse(b.dateISO)
  const aValid = Number.isFinite(ta)
  const bValid = Number.isFinite(tb)
  if (aValid && bValid) return ta - tb
  if (aValid) return -1
  if (bValid) return 1
  return a.dateISO.localeCompare(b.dateISO)
}

/** A new array, oldest first. Never mutates its argument. */
export function sortByDateAscending<T extends HasDateISO>(items: readonly T[]): T[] {
  return items.slice().sort(byDateAscending)
}

/**
 * Does `a` fall strictly before `b` in time?
 *
 * Exists so a caller that wants a predicate cannot reach for `<` on the raw
 * strings, which is the defect this module was created to remove. Equal
 * instants are NOT "before", matching the `<` it replaces.
 */
export function isBefore(a: HasDateISO, b: HasDateISO): boolean {
  return byDateAscending(a, b) < 0
}
```

**Verify**: `npx tsc -b --noEmit` → exit 0 (the new file compiles; nothing
imports it yet).

### Step 2: Rewire `store.ts` — the behaviour-preserving one

In `src/profile/store.ts`, delete the whole block at lines **184–211** (the doc
comment and the private `byDateAscending`) and add to the import block at the top
of the file, after `import { isWritingSession } from '../types'` (line 33):

```ts
import { byDateAscending } from './chronology'
```

Leave `sessions.sort(byDateAscending)` (`store.ts:471`) and the `.sort(byDateAscending)`
at `store.ts:564` exactly as they are — the imported function has the same name
and identical behaviour, so both call sites keep compiling and keep meaning what
they meant.

This step must change no behaviour at all.

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `grep -c "^function byDateAscending" src/profile/store.ts` → `0`.
**Verify**: `npx vitest run tests/store.test.ts` → all pass, **unchanged**. If
anything in that file fails here, stop — see STOP conditions.

### Step 3: Fix the three text-sorting call sites

**3a — `src/profile/profile.ts`.** Add to the existing import block at the top
of the file, after `import { categoryAppliesTo } from '../meta'` (line 44):

```ts
import { sortByDateAscending } from './chronology'
```

Then replace lines 87–90 in full:

```ts
/** Oldest first. ISO-8601 date strings sort correctly as text. */
function sortChronological(sessions: WritingSessionRecord[]): WritingSessionRecord[] {
  return sessions.slice().sort((a, b) => a.dateISO.localeCompare(b.dateISO))
}
```

with:

```ts
/**
 * Oldest first, by parsed INSTANT — see `./chronology`.
 *
 * This function used to sort by text, under a comment claiming ISO-8601 strings
 * sort correctly that way. They do not once an imported file carries an offset,
 * and the cost lands here rather than anywhere cosmetic: this one line orders
 * BOTH exported functions, so it sets the sign of every trend slope, which
 * lastSeenISO is read off, and the x-axis of every sparkline.
 */
function sortChronological(sessions: WritingSessionRecord[]): WritingSessionRecord[] {
  return sortByDateAscending(sessions)
}
```

Keep the wrapper rather than inlining `sortByDateAscending` at its two call
sites (`profile.ts:157`, `:226`) — the name is what those lines read as, and the
comment above is where the next reader will look.

**3b — `src/components/Dashboard.tsx`.** Add to the import block at the top,
after `import { TASK1_PROMPTS } from '../prompts/task1Bank'` (line 5):

```ts
import { sortByDateAscending } from '../profile/chronology'
```

Then replace lines 226–229:

```tsx
  const chrono = useMemo(
    () => [...sessions].sort((a, b) => a.dateISO.localeCompare(b.dateISO)),
    [sessions],
  )
```

with:

```tsx
  // By parsed instant, not text — see profile/chronology. This is the band
  // chart's x-axis; an imported file with an offset would draw the learner's
  // progress in the wrong order.
  const chrono = useMemo(() => sortByDateAscending(sessions), [sessions])
```

`sortByDateAscending` already copies, so the spread is redundant. Leave
`newestFirst` (line 230) alone.

**3c — `src/App.tsx`.** Add to the import block at the top, next to the existing
profile imports (after `import { computeProfile, computeTrends } from './profile/profile'`,
line 27):

```ts
import { isBefore } from './profile/chronology'
```

Then replace line 641:

```tsx
    ? writingSessions.filter((s) => s.dateISO < reportSession.dateISO).slice(-1)[0] ?? null
```

with:

```tsx
    // `isBefore` compares instants; `<` on the raw strings compares text, which
    // an imported file's offset can invert. `.slice(-1)[0]` is still the most
    // recent earlier session, because `sessions` is always `loadSessions()` and
    // that is instant-ordered.
    ? writingSessions.filter((s) => isBefore(s, reportSession)).slice(-1)[0] ?? null
```

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `grep -rn "localeCompare" src/profile/profile.ts src/components/Dashboard.tsx src/App.tsx` → only `src/profile/profile.ts:215` and `:234`, both of which compare `IssueCategory` ids, not dates.
**Verify**: `npx vitest run` → 24 files, 848 tests, all pass.

### Step 4: Write the regression tests

Create `tests/chronology.test.ts`. It has three jobs: pin the comparator, prove
the profile bug is gone, and prove the `isBefore` predicate that `App.tsx` now
uses.

Read `tests/profile-scoping.test.ts:44-100` first — copy its `session()` and
`fakeAnalysis()` helper shapes rather than inventing new ones. **One change**:
include `section: 'writing'` in the record you build. The helper in that file
omits it, which is a latent type error nothing currently catches (see
`plans/020-*` — `tsc` does not cover `tests/`); do not copy the omission.

```ts
/**
 * One comparator, four call sites (SPEC.md "profile/").
 *
 * The app writes `toISOString()`, so every date it produces is UTC and text
 * order and instant order agree. `importData` accepts a file written anywhere,
 * and then they do not: `2026-01-01T23:00:00+05:00` is 18:00Z — three hours
 * BEFORE `2026-01-01T20:00:00.000Z`, and AFTER it as text. The same pair is
 * used by `tests/store.test.ts:994`; one fixture, one meaning.
 */
import { describe, expect, it } from 'vitest'
import { byDateAscending, isBefore, sortByDateAscending } from '../src/profile/chronology'
import { computeProfile, computeTrends } from '../src/profile/profile'

/** 18:00Z, but sorts SECOND as text. */
const EARLIER = '2026-01-01T23:00:00+05:00'
/** 20:00Z, but sorts FIRST as text. */
const LATER = '2026-01-01T20:00:00.000Z'
```

Cases to write:

1. **The premise.** `expect(LATER < EARLIER).toBe(true)` and
   `expect(Date.parse(EARLIER)).toBeLessThan(Date.parse(LATER))` — assert that
   text and instant order genuinely disagree, so a future reader can see the
   test is testing something.
2. **`sortByDateAscending`** puts `EARLIER` first from both input orders, and
   does not mutate its argument.
3. **Invalid dates sort last**, and two invalid dates keep a stable text order —
   the documented policy carried over from `store.ts:195-197`.
4. **Equal instants return 0**, including across representations
   (`'2026-01-01T20:00:00.000Z'` vs `'2026-01-01T20:00:00Z'` vs
   `'2026-01-02T01:00:00+05:00'`).
5. **The trend no longer flips.** Two writing sessions on a `task2` category —
   `'connector-comma'` works (`src/types.ts:239`):
   - session `early` at `EARLIER`, **1** issue over 100 words → rate 1.0
   - session `late` at `LATER`, **5** issues over 100 words → rate 5.0

   With two sessions `leastSquaresSlope([r0, r1])` is `r1 - r0`, so in true
   chronological order the slope is `+4.0` and the trend must be **`worsening`**
   (`WORSENING_SLOPE = 0.05`). Sorted by text the order reverses, the slope is
   `-4.0`, and the trend reads `improving` — the learner is congratulated on a
   weakness that got worse. Assert:
   - `computeProfile([early, late]).categories['connector-comma']?.trend === 'worsening'`
   - the same for the reversed input `[late, early]` (the sort is the whole
     point, so input order must not matter)
   - `lastSeenISO === LATER` in both cases
6. **`computeTrends` orders the sparkline the same way**: the `perSession` array
   for `'connector-comma'` has `dateISO` `[EARLIER, LATER]`, whichever order the
   sessions arrive in.
7. **`isBefore`** — the predicate `App.tsx:641` now uses:
   `isBefore({ dateISO: EARLIER }, { dateISO: LATER })` is `true`;
   the reverse is `false`; equal instants are `false` in both directions.

**Verify**: `npx vitest run tests/chronology.test.ts` → all pass.

Before moving on, prove the tests bite. Temporarily revert `profile.ts:88-90`
to the `localeCompare` version, run `npx vitest run tests/chronology.test.ts`,
and confirm case 5 **fails** with `improving`. Then restore the fix. If case 5
passes with the old sort, the fixture is wrong — stop and report.

### Step 5: Generalise the rule in SPEC.md

One edit, at `SPEC.md:264-267`. The paragraph currently scopes the instant rule
to the storage cap. Replace the sentence beginning "Records are ordered for that
cap by parsed INSTANT" with:

```
Records are ordered by parsed INSTANT everywhere, not by the text of `dateISO`: an imported file may
carry an offset (`23:00+05:00` is three hours before `20:00Z` and sorts after it as text). List order
is what "oldest" means for the cap, what sets the sign of every trend slope in `computeProfile`, what
`lastSeenISO` is read off, what orders the Dashboard band chart's x-axis, and what picks the report's
"previous session". There is ONE comparator, `profile/chronology.ts`; nothing else may sort a
`dateISO`.
```

Do not touch `SPEC.md:270-274` (the five canonical profile constants) or any
other paragraph.

**Verify**: `grep -c "profile/chronology.ts" SPEC.md` → `1`.

### Step 6: Full green

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `npx vitest run` → 25 files, 848 + your new tests, all pass.
**Verify**: `npx vitest run tests/profile-scoping.test.ts tests/store.test.ts` → 2 files, 92 tests, all pass.
**Verify**: `npm run build` → exit 0.

## Test plan

- **New file**: `tests/chronology.test.ts` in the `engine` project, seven groups
  of cases as listed in step 4: the premise, sorting, invalid dates, equal
  instants, the `computeProfile` trend flip, the `computeTrends` sparkline order,
  and `isBefore`.
- **Structural pattern**: `tests/profile-scoping.test.ts` for the `session()` /
  `fakeAnalysis()` helpers and the `describe` shape; `tests/store.test.ts:994-1010`
  for the date fixture. Reuse both rather than inventing.
- **Existing suites are the behaviour-preservation check.**
  `tests/profile-scoping.test.ts` pins the five canonical profile constants by
  behaviour (`SPEC.md:272-274`: "every one of them survived being mutated with
  the suite green"), and `tests/store.test.ts` pins the storage ordering. Both
  must pass **unchanged** — 92 tests across the two files.
- **The negative check is mandatory**, not optional: step 4 requires you to
  confirm case 5 fails against the old `localeCompare` sort. A regression test
  that passes both before and after is not a regression test.
- **Verification**: `npx vitest run` → 25 files, all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc -b --noEmit` exits 0 with no output
- [ ] `npx vitest run` exits 0; 25 files; the 848 pre-existing tests still pass
- [ ] `npm run build` exits 0
- [ ] `test -f src/profile/chronology.ts` succeeds
- [ ] `test -f tests/chronology.test.ts` succeeds
- [ ] `grep -rn "dateISO.localeCompare" src/` returns **exactly one** match, inside `src/profile/chronology.ts` (the invalid-date fallback)
- [ ] `grep -rn "dateISO <\|dateISO >" src/` returns **no matches**
- [ ] `grep -c "^function byDateAscending" src/profile/store.ts` returns `0`
- [ ] `grep -rln "from '\./chronology'\|from '\.\./profile/chronology'\|from './profile/chronology'" src/` lists exactly `src/profile/store.ts`, `src/profile/profile.ts`, `src/components/Dashboard.tsx`, `src/App.tsx`
- [ ] `grep -n "sort correctly as text" src/` returns **no matches** (the false comment is gone)
- [ ] `grep -c "profile/chronology.ts" SPEC.md` returns `1`
- [ ] `git status --porcelain -- . ':!plans/'` lists only: `src/profile/chronology.ts`, `src/profile/store.ts`, `src/profile/profile.ts`, `src/components/Dashboard.tsx`, `src/App.tsx`, `tests/chronology.test.ts`, `SPEC.md`
      (the `':!plans/'` exclusion is required: at this plan's baseline the tree already
      carries a modified `plans/README.md` and ten untracked `plans/0NN-*.md` files, so a
      bare `git status --porcelain` is never empty and this check would always fail)
- [ ] `git diff --stat -- package.json package-lock.json` is empty (no dependency added)

## STOP conditions

Stop and report back (do not improvise) if:

- **Any excerpt in "Current state" does not match the live file.**
- **`tests/store.test.ts` fails after step 2** — the behaviour-preserving step.
  The imported comparator is byte-identical to the deleted one; if that suite
  moves, something else changed and you must find out what before continuing.
- **`tests/profile-scoping.test.ts` fails at any point.** It pins the five
  canonical profile constants by behaviour. This plan changes the order those
  constants run over, not the constants — but if a fixture in that file happens
  to depend on text ordering, the right answer is a report, not an edited
  assertion. Report the exact before/after values.
- **Case 5 of the new tests passes against the old `localeCompare` sort.** The
  fixture then does not reproduce the bug and the test is worthless.
- **`grep -rn "byDateAscending" src/ tests/` at the start returns anything other
  than `store.ts:202`, `:471`, `:564`.** The plan assumes exactly one definition
  and two uses.
- **You conclude the comparator belongs in `src/types.ts` or exported from
  `store.ts`.** Report the reasoning; do not move it. A component importing the
  storage module to sort a list is how the copy got made in the first place.
- **The band chart or the report visibly changes for UTC-only data.** It must
  not: for `toISOString()` dates, instant order and text order agree exactly.
  A visible change means the comparator is wrong.
- **Anything tempts you to add a date library.**

## Maintenance notes

For whoever owns this next:

- **What a reviewer should scrutinise**: that step 2 is a pure move (diff the
  deleted `store.ts` block against the new `chronology.ts` function body — they
  must be identical), and that the invalid-date fallback survived intact. That
  fallback is the one branch where `localeCompare` is still correct, and it is
  easy to "clean up" into a bug.
- **The rule to enforce from here**: nothing outside `src/profile/chronology.ts`
  may compare a `dateISO`. The two greps in "Done criteria" are the enforcement;
  if this repo ever gets a lint step (see `plans/020-*`), a
  `no-restricted-syntax` rule on `dateISO.localeCompare` would make it automatic.
- **Still uncovered by a test**: `Dashboard.tsx` and `Report.tsx` have no
  component tests at all (`plans/README.md`, "Known limitations carried
  forward"). This plan covers their *ordering* through the shared comparator's
  unit tests and a grep, which is the honest limit of what a non-UI test can
  claim. If Dashboard component tests are ever written, the band chart's x-order
  under an offset import is the first case to add.
- **Deliberately deferred**: normalising `dateISO` to UTC on import. It would
  make text order safe again, but it destroys information the learner might
  legitimately want (the local time they sat the paper), and it cannot fix
  records already on disk. Comparing instants is correct for both old and new
  data.
- **If a future section is added** (Speaking is planned — `plans/README.md` row
  012), it inherits the correct order for free as long as it stores a `dateISO`
  and goes through `loadSessions`. Nothing new to do.
