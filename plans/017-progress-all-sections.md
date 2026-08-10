# Plan 017: Make Progress honest about all three sections — the S slice

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. Do NOT edit `plans/README.md`; the reviewer who
> dispatched you maintains the index.
>
> **Drift check (run first)**:
> `git diff --stat ae92bac..HEAD -- src/components/Dashboard.tsx src/App.tsx src/types.ts tests/ui/ SPEC.md`
> If any file quoted in "Current state" changed since this plan was written,
> compare the excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition. Every line number below was read off `ae92bac`.

## Status

- **Priority**: **P0** — a learner cannot export data they can already destroy
- **Effort**: S (2–3 hours)
- **Risk**: LOW — two components, no engine, no storage format change
- **Depends on**: none. Independent of plan 016, though both touch `src/App.tsx`
  and `src/components/Dashboard.tsx` — if both are in flight, land 016 first and
  rebase.
- **Category**: bug
- **Planned at**: commit `ae92bac`, 2026-08-10

## Why this matters

**On the Progress page the destructive action is reachable where the protective
one is not, and the confirm dialogue understates what is about to be destroyed.**

A learner who has sat Reading and Listening papers but written no essays sees the
Dashboard's empty state. That state offers **Restore from a backup file**
(`src/components/Dashboard.tsx:280-282`), which routes to `importData` and
**replaces the whole store** — every Reading and Listening result included. It
does **not** offer **Export data**, which exists only in the non-empty header
(`:303-305`) and whose only call site in the app is `App.tsx:1145`.

So the one page that can wipe a complete answer-key history is also the one page
that will not let the learner take a copy of it first.

The confirm dialogue makes it worse. `Dashboard.tsx:239-241`:

```tsx
      const ok = window.confirm(
        `Importing replaces your current history (${sessions.length} essays) with the file's contents. Continue?`,
      )
```

`sessions` is the **writing-only** list (`App.tsx:1136` passes `writingSessions`),
while `importData` (`src/profile/store.ts:513-567`) replaces the entire store. In
the empty state it renders **"(0 essays)"** immediately before destroying a
complete Reading and Listening history.

This plan is the **S slice only**: surface Export in the empty branch, and count
all three sections in the confirm — both derived from the FULL session list
rather than the filtered one. The section-aware Progress page is a separate,
larger job; see Maintenance notes.

## Current state

Read each cited line before changing it. Line numbers are from `ae92bac`.

### The Dashboard only ever sees essays

`src/App.tsx:1133-1149`:

```tsx
      {view === 'dashboard' && (
        <main className="page">
          <Dashboard
            sessions={writingSessions}
            profile={profile}
            trends={trends}
            onOpenSession={(id) => { … }}
            onStartPractice={handleStartPractice}
            onDeleteSession={handleDelete}
            onExport={exportData}
            onImport={handleImport}
          />
        </main>
      )}
```

`writingSessions` is `App.tsx:187-190`:

```tsx
  const writingSessions = useMemo<WritingSessionRecord[]>(
    () => sessions.filter(isWritingSession),
    [sessions],
  )
```

so `sessions.length` inside `Dashboard` counts essays only. `sessions` (the
unfiltered state) is what the store actually holds.

`src/types.ts:720-730`:

```ts
export interface DashboardProps {
  sessions: WritingSessionRecord[];
  profile: ErrorProfile;
  trends: CategoryTrend[];
  onOpenSession: (id: string) => void;
  /** Start a new essay; if focus is set, the app pre-selects amplified coaching for it. */
  onStartPractice: (focus: IssueCategory | null) => void;
  onDeleteSession: (id: string) => void;
  onExport: () => void;
  onImport: (json: string) => void;
}
```

The three section guards you need already exist and are exported from
`src/types.ts`: `isWritingSession` (`:611`), `isReadingSession` (`:549`),
`isListeningSession` (`:554`).

### The empty branch

`src/components/Dashboard.tsx:257-293` — abridged, read it in full before editing:

```tsx
  /* ------------------------------- empty state ------------------------------- */
  if (sessions.length === 0) {
    return (
      <div className="db-root">
        <div className="card db-empty">
          <svg className="db-empty-mark" … />
          <p className="eyebrow">Your progress</p>
          <h2>No essays yet</h2>
          <p className="db-empty-line">Write your first essay and your profile starts here.</p>
          <button className="btn btn-primary" onClick={() => onStartPractice(null)}>
            Start practice
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Restore from a backup file
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={handleFilePicked} />
        </div>
      </div>
    )
  }
```

`.db-empty .btn` is already styled (`src/components/Dashboard.css:96-100`), so a
third button needs no new CSS.

### The confirm, and the import it guards

`src/components/Dashboard.tsx:232-247`:

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

One handler serves both branches — the empty state's picker and the header's
picker both call it — so fixing the count fixes both at once.

### Three existing tests touch the empty state — and none of them needs to change

Checked at `ae92bac`. All three assert only that the string
`'Write your first essay and your profile starts here.'` is present:

- `tests/ui/reading.test.tsx:342-345` — after sitting a Reading paper
- `tests/ui/listening.test.tsx:560-565` — after sitting a Listening paper
- `tests/ui/a11y.test.tsx:354-358` — after a delete empties the store

Their intent — "a paper is not writing progress" — stays true, and this plan does
not change that line. **Keep it exactly as it is** and add beside it, rather than
rewording it; that is what lets all three stay green. `grep -rn "Export data" tests/`
returns nothing, so nothing asserts the button's absence either.

### Repo conventions you must match

- **React 18 + TypeScript strict, Vite, pure client-side, `localStorage` only,
  deterministic rule analysis. No LLM, no server, no network.** Runtime
  dependencies are exactly `react` and `react-dom`.
- **UI tests MUST render through `renderApp()`** from `tests/ui/renderApp.tsx` —
  never `render(<App />)`, which draws a random prompt from 40 and made the suite
  fail roughly three runs in ten. Read that file's header before writing a test.
- **Comments explain WHY** — the failure mode prevented, not what the line does.
- **Learner-facing copy states what is happening and what to do**, in the
  DESIGN.md voice used by the surrounding strings.
- **`IssueCategory` ids are FROZEN** and `Criterion` stays four members. Neither
  is involved here.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npx tsc -b --noEmit` | exit 0, no output |
| Full suite | `npx vitest run` | **848 passed / 24 files** at `ae92bac`; more after this plan |
| UI project | `npx vitest run --project ui` | all pass |
| Reading UI | `npx vitest run tests/ui/reading.test.tsx` | all pass, **unchanged** |
| Listening UI | `npx vitest run tests/ui/listening.test.tsx` | all pass, **unchanged** |
| Build | `npm run build` | exit 0 |

**UI determinism**: after any change here, run `npx vitest run --project ui`
**ten consecutive times** and confirm identical results.

## Scope

**In scope**:

- `src/types.ts` — one added `DashboardProps` field
- `src/App.tsx` — one added prop at the `<Dashboard>` call site
- `src/components/Dashboard.tsx` — the empty branch and the confirm string
- `tests/ui/dashboard-all-sections.test.tsx` (create)
- `SPEC.md` — record what Progress counts and what it exports

**Out of scope** (do NOT touch, even though they look related):

- **The writing-only nature of the Progress page.** The band trend, the error
  sparklines and the session table are writing views and stay writing views. This
  slice adds no Reading or Listening rows, no combined trend and no section
  filter — see Maintenance notes for why that is a separate job.
- `src/profile/store.ts` — `exportData` (`:484-496`) already exports the whole
  store via `loadSessions()`; nothing there needs changing, and that is exactly
  why surfacing the button is sufficient.
- `src/profile/profile.ts` and anything that computes `ErrorProfile` or `trends` —
  they are writing-only on purpose, and `categoryAppliesTo` scoping depends on it.
- `tests/ui/reading.test.tsx`, `tests/ui/listening.test.tsx`,
  `tests/ui/a11y.test.tsx` — they must pass **unchanged**. If one fails you have
  changed the empty-state line; put it back.
- `src/components/Dashboard.css` — `.db-empty .btn` already covers a third button.
- `plans/README.md` — the reviewer owns the index.

## Git workflow

- Branch: `advisor/017-progress-all-sections`, off `main`.
- One commit; message style matches `git log`: a plain imperative sentence, e.g.
  `Let Progress export and count every section, not only essays`.
- Do NOT push and do NOT open a PR.

## Steps

### Step 1: Write the failing test FIRST

Create `tests/ui/dashboard-all-sections.test.tsx`, rendering through
`renderApp()`. Model the "sit a paper then go to Progress" flow on
`tests/ui/reading.test.tsx:331-346`, whose helper `sitPassageOne(user)` shows the
shape.

Two cases:

1. **Export is reachable with no essays.** Sit a Reading paper, navigate to
   Progress, and assert `screen.getByRole('button', { name: 'Export data' })` is
   present alongside the unchanged
   `'Write your first essay and your profile starts here.'`. **Fails now** — the
   button exists only in the non-empty header.
2. **The confirm counts every section.** With a Reading paper saved and no
   essays, spy on `window.confirm` (`vi.spyOn(window, 'confirm').mockReturnValue(false)`
   — return `false` so the import does not run and the test asserts on the
   message alone, which is the safe direction), trigger the empty state's
   "Restore from a backup file" picker with a valid exported JSON file, and
   assert the confirm message names the Reading paper and does **not** say
   "0 essays" on its own. **Fails now** — it reads `(0 essays)`.

Each test needs a comment naming what it prevents, in the voice the UI suite
already uses (see `tests/ui/reading.test.tsx:340-341`).

**Verify**: `npx vitest run tests/ui/dashboard-all-sections.test.tsx` → **2
failures**. If either passes now, the fixture is not reproducing the bug.

### Step 2: Give the Dashboard the full session list

`src/types.ts`, in `DashboardProps`:

```ts
  /**
   * EVERY saved session, not only the essays in `sessions`.
   *
   * The page is a writing view and `sessions` stays writing-only — but two of
   * its controls act on the WHOLE store: `onExport` writes every section to the
   * file, and `onImport` replaces every section. Counting those from the
   * filtered list told a learner with a complete Reading history that importing
   * would replace "0 essays", immediately before it destroyed all of it.
   */
  allSessions: SessionRecord[];
```

`src/App.tsx:1133-1149`: pass `allSessions={sessions}` beside the existing
`sessions={writingSessions}`. `sessions` is the unfiltered state already in
scope; add nothing else.

**Verify**: `npx tsc -b --noEmit` → exit 0.

### Step 3: Surface Export in the empty branch

In `src/components/Dashboard.tsx`, inside the `sessions.length === 0` branch
(`:258-293`), add an **Export data** button with the same label and the same
`onClick={onExport}` as the header's (`:303-305`) — the label must match exactly
so a learner and a test find the same control in both states.

Render it only when `allSessions.length > 0`. On a genuinely first run there is
nothing to export and the button would be a dead end; the bug is specifically
that data exists and cannot be reached.

Add one line of copy above the buttons, in the same conditional, naming what is
there — otherwise an Export button on a page headed "No essays yet" reads as a
mistake. Something in the shape of:

> You have 1 Reading paper and 2 Listening papers saved. Exporting includes them.

Singular/plural must be handled; the surrounding code does this already (see
`src/analysis/letterBandEstimate.ts:82` for the house pattern).

**Do not change** `<h2>No essays yet</h2>` or the
`'Write your first essay and your profile starts here.'` line. Three existing
tests assert that string, and it is still true — this page is the writing record.

**Verify**: `npx vitest run tests/ui/dashboard-all-sections.test.tsx` → case 1
passes.
**Verify**: `npx vitest run tests/ui/reading.test.tsx tests/ui/listening.test.tsx tests/ui/a11y.test.tsx`
→ all pass, **with no edit to those files**.

### Step 4: Make the confirm tell the truth

Rewrite the confirm at `Dashboard.tsx:239-241` to count from `allSessions`, split
by section using `isWritingSession` / `isReadingSession` / `isListeningSession`
from `src/types.ts`. It must:

- name every non-zero section, with correct singular/plural;
- say plainly that the replacement covers all of them;
- read correctly when the store is genuinely empty (a first-run import is a
  legitimate restore and must not be scary or ungrammatical).

Add a comment recording why it reads `allSessions` and not `sessions`: the count
must match what `importData` replaces, and it did not.

Leave the rest of `handleFilePicked` alone — the `input.value = ''` reset
(`:235`), the `try/catch`, and the `alert` on failure all stay.

**Verify**: `npx vitest run tests/ui/dashboard-all-sections.test.tsx` → both
cases pass.

### Step 5: SPEC.md

Add to the Progress/Dashboard section:

- Progress is a **writing** view: the band trend, sparklines and session table
  count essays only, and that is deliberate.
- **Export and Import act on the WHOLE store.** Export is reachable from both the
  empty and the populated state; the import confirm counts every section, because
  `importData` replaces every section.
- The empty state keeps its writing wording because it is accurate — the page is
  the writing record — and names the other sections' data separately.

**Verify**: `npx vitest run` → all pass.

### Step 6: Full green

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `npx vitest run` → all pass, 848 + 2 new.
**Verify**: `npm run build` → exit 0.
**Verify**: `npx vitest run --project ui` ten consecutive times → identical results.

## Test plan

| File | Cases |
|---|---|
| `tests/ui/dashboard-all-sections.test.tsx` (new) | **Export reachable**: after one Reading paper and no essays, Progress shows an `Export data` button and still shows the unchanged empty-state line · **Confirm counts every section**: the import confirm names the saved Reading paper and does not report "0 essays" |
| `tests/ui/reading.test.tsx` (unchanged) | must still pass — the empty-state line is untouched |
| `tests/ui/listening.test.tsx` (unchanged) | same |
| `tests/ui/a11y.test.tsx` (unchanged) | same |

Both new tests render through `renderApp()`. Use
`vi.spyOn(window, 'confirm')` to read the message (`tests/ui/a11y.test.tsx:335`
shows the pattern) and return `false`, so the assertion never depends on an
import actually running.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc -b --noEmit` exits 0
- [ ] `npx vitest run` exits 0; 848 + 2 new tests pass
- [ ] `npm run build` exits 0
- [ ] `npx vitest run --project ui` produces identical results across 10 consecutive runs
- [ ] `git status --porcelain -- . ':!plans/'` shows exactly five changed files: `src/types.ts`, `src/App.tsx`, `src/components/Dashboard.tsx`, `tests/ui/dashboard-all-sections.test.tsx`, `SPEC.md`
      (exclude `plans/` — the baseline tree already carries a modified `plans/README.md`
      and ten untracked `plans/0NN-*.md` files, so a bare `git status` is never clean)
- [ ] `git diff --stat main -- tests/ui/reading.test.tsx tests/ui/listening.test.tsx tests/ui/a11y.test.tsx` is empty
- [ ] `grep -c "sessions.length} essays" src/components/Dashboard.tsx` returns 0
- [ ] `grep -c "allSessions" src/types.ts src/App.tsx src/components/Dashboard.tsx` returns at least 1 in each

## STOP conditions

Stop and report back (do not improvise) if:

- Any excerpt in "Current state" does not match the live file.
- `tests/ui/reading.test.tsx`, `tests/ui/listening.test.tsx` or
  `tests/ui/a11y.test.tsx` fails. That means the empty-state line changed; put it
  back rather than editing those tests. If you believe the line genuinely must
  change, **stop and report** — three tests depend on it and rewording it is a
  product decision, not an implementation detail.
- You find yourself adding Reading or Listening rows, a combined band trend, or a
  section filter to the Dashboard. That is the follow-up job, explicitly out of
  scope, and it carries a design constraint this slice does not (see Maintenance
  notes).
- `exportData` or `importData` needs changing. Neither does: `exportData` already
  serialises `loadSessions()` whole, and `importData` already replaces the whole
  store. If you think otherwise, report what you found.
- The confirm cannot be phrased correctly for the empty store without changing
  the empty-state copy. Report the wording problem rather than picking one.

## Maintenance notes

For whoever owns this code next:

- **This is the S slice. The full section-aware Progress page is the follow-up**,
  and it is a real feature: Reading and Listening results currently live in their
  own history lists below their pickers (`App.tsx:1075-1088`, `:1118-1131`), and
  bringing them onto Progress means deciding what a cross-section view even
  shows. `plans/README.md` already carries "Reading results are not on the
  Progress page" and "No Reading band trend" as known limitations.
- **The caveat that follow-up must honour**: with **one paper per module**, a
  repeat sitting of the same paper is partly a memory test, not a fresh
  measurement. A learner who re-sits `reading-academic-01` and scores 34/40 after
  scoring 26/40 has not necessarily improved by 8 marks. **Repeat sittings must be
  labelled as repeats, never silently averaged into a trend** — a trend line that
  climbs because the learner remembers the answers is the same class of error as a
  false accusation: a confident number that is not true. Until a second paper per
  module exists, that labelling is the whole design problem.
- **`allSessions` is deliberately a second prop rather than a replacement for
  `sessions`.** The page's writing-only views would each need their own filter
  otherwise, and the profile scoping (`categoryAppliesTo`, `TASK1_ONLY_CATEGORIES`
  and friends in `src/meta.ts`) depends on nothing but essays reaching them. Keep
  the split.
- **The empty state now has three buttons and can have four.** If it grows again,
  the Export/Import pair should probably move into a shared sub-component used by
  both branches, so the two states cannot drift in label or behaviour — which is
  exactly how this bug started.
- **What a reviewer should scrutinise**: that the confirm count matches what
  `importData` actually replaces; that the Export label is byte-identical in both
  branches; that the empty-state line is untouched; and that no writing-only view
  accidentally started reading `allSessions`.
