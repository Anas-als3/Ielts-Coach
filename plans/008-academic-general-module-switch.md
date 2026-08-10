# Plan 008: Add the Academic / General Training module switch

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b942572..HEAD -- src/ SPEC.md`
> If any file quoted in "Current state" changed since this plan was written,
> compare the excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — touches the storage schema and the app shell, both of which every view depends on
- **Depends on**: `plans/006-*.md` and `plans/007-*.md` should land first (they are defect fixes); no code dependency
- **Category**: direction
- **Planned at**: commit `b942572`, 2026-08-10

## Why this matters

IELTS is two different exams sharing a name. **Academic** is taken for
university entry; **General Training** for migration and work. The app currently
implements Academic only, and nothing in the code records that fact — a learner
preparing for General Training gets Academic content with no indication that it
is the wrong exam.

The differences are precise and worth stating, because they determine everything
plans 009-013 build:

| Section | Academic | General Training |
|---|---|---|
| Writing Task 1 | Describe a chart, graph, table or process | **Write a letter** (formal / semi-formal / informal) |
| Writing Task 2 | Essay. Same criteria, same 250 words, same 40 min | Essay. **Same marking**, but everyday topics rather than abstract ones |
| Reading | 3 long academic passages | 3 sections: short workplace/social texts, work texts, then one long general-interest text |
| Reading band conversion | 30/40 → band 7.0 | **34–35/40 → band 7.0** — GT needs ~4 more correct for the same band |
| Listening | Identical | Identical |
| Speaking | Identical | Identical |

So the switch is not cosmetic. It changes which Task 1 engine runs, which prompt
bank loads, and — once plan 008 lands — which raw-score-to-band table applies.

This plan does **only** the module concept: the type, the persistence, the
switch, and the plumbing that later plans hang off. It adds no General Training
content. After it lands the app behaves exactly as it does today when the module
is Academic, and shows an honest "not built yet" state for the General Training
parts that plans 009+ will fill in.

## Current state

### The task discriminator this mirrors — `src/types.ts:311`

```ts
/**
 * Which IELTS task a session belongs to. `task2` is the only value produced by
 * the current app; sessions saved before schemaVersion 2 are migrated to it.
 */
export type TaskKind = 'task1' | 'task2';
```

and its use in `SessionRecord` (`src/types.ts:420`):

```ts
export interface SessionRecord {
  id: string;
  dateISO: string;
  mode: WritingMode;
  /** Which IELTS task this session answered. Migrated to 'task2' for pre-v2 data. */
  task: TaskKind;
  promptId: string | null;
```

`TaskKind` is the exact pattern to copy. Read how it threads through
`src/App.tsx`, `src/meta.ts` (`TASK_CONSTANTS`, `criterionLabel`) and
`src/profile/profile.ts` (`categoryAppliesTo`) before writing any code —
`Module` needs the same treatment.

### The storage layer you are extending — `src/profile/store.ts:14-30`

```ts
const STORAGE_KEY = 'ielts-coach.v1'
const SCHEMA_VERSION = 2
/** Lowest stored version this build knows how to migrate forward from. */
const MIN_MIGRATABLE_VERSION = 1
```

and the migration ladder (`src/profile/store.ts`, `migrateSessions`):

```ts
function migrateSessions(sessions: SessionRecord[], fromVersion: number): SessionRecord[] {
  let out = sessions
  let version = fromVersion

  // v1 -> v2: the `task` discriminator was added. Everything written before v2
  // was IELTS Academic Writing Task 2, because that was the only task the app
  // supported.
  if (version === 1) {
    out = out.map((s) => (s.task === undefined ? { ...s, task: 'task2' as const } : s))
    version = 2
  }

  return out
}
```

**This ladder is the extension point.** Append a `if (version === 2)` block; never
reorder or collapse the existing one — a user can arrive from any older version.

### The task switcher this mirrors — `src/App.tsx`

Find `switchTask` and the `.task-toggle` markup in the topbar. `switchModule`
must follow the same shape: confirm before abandoning a running exam, clear the
answer sheet, reset the clock.

### The per-task constants — `src/meta.ts`

```ts
export const TASK_CONSTANTS: Record<
  TaskKind,
  { examDurationSec: number; minWords: number; targetWords: number; label: string }
> = {
  task2: { examDurationSec: 40 * 60, minWords: 250, targetWords: 280, label: 'Task 2' },
  task1: { examDurationSec: 20 * 60, minWords: 150, targetWords: 190, label: 'Task 1' },
}
```

Note this is keyed by task only. General Training Task 1 has the **same** 20
minutes and 150 words as Academic Task 1, so this table does not need a module
dimension — but confirm that before assuming it, and record the finding either
way in a comment.

### Repo conventions you must match

- **TypeScript strict**, no `any`. No new runtime dependencies — `package.json`
  has exactly `react` and `react-dom`, and README.md:67 states that as an
  architectural property.
- **`IssueCategory` ids are FROZEN.** The error profile aggregates on them
  across sessions (`src/types.ts` comment on the union), so a rename orphans a
  learner's history. Appending is allowed; this plan appends none.
- **Defensive persistence** (`src/profile/store.ts` header): every read tolerates
  missing or corrupt data by returning empty, every write is wrapped in
  `try/catch` and warns. Never throw from a read or a write.
- **Learner-facing copy voice** (`DESIGN.md:47-48`): plain verbs, sentence case,
  specific, never scolding.
- **SPEC.md is canonical.** Step 7 records the module concept there.
- **Tests**: two vitest projects. `engine` (node) for pure logic in
  `tests/*.test.ts`; `ui` (jsdom + Testing Library) for components in
  `tests/ui/*.test.tsx`. Model new files on `tests/store.test.ts` and
  `tests/ui/task-switching.test.tsx` respectively.

## Commands you will need

| Purpose   | Command                                | Expected on success |
|-----------|----------------------------------------|---------------------|
| Typecheck | `npx tsc -b --noEmit`                  | exit 0, no output   |
| Tests     | `npx vitest run`                       | all pass            |
| Engine    | `npx vitest run --project engine`      | all pass            |
| UI        | `npx vitest run --project ui`          | all pass            |
| Build     | `npm run build`                        | exit 0              |

Dependencies are installed. Do **not** run `npm install`.

## Scope

**In scope**:

- `src/types.ts` (modify — add `Module`, add `module` to `SessionRecord`, extend `PromptSpec`)
- `src/meta.ts` (modify — `MODULE_META`, and a documented note on `TASK_CONSTANTS`)
- `src/profile/store.ts` (modify — schemaVersion 3 + migration rung)
- `src/App.tsx` (modify — module state, switcher, routing to the not-built-yet state)
- `src/App.css` (modify — switcher styling, reusing `.mode-toggle`)
- `src/prompts/bank.ts` (modify — tag each existing prompt with the modules it suits)
- `src/components/Dashboard.tsx` (modify — a Module column)
- `tests/module-switch.test.ts` (create)
- `tests/ui/module-switch.test.tsx` (create)
- `SPEC.md`, `README.md` (modify)

**Out of scope** (do NOT touch):

- **Any General Training CONTENT.** No letter prompts, no letter rules, no GT
  reading passages. Plans 007+ own those. This plan makes the switch exist and
  routes General Training Task 1 to an honest placeholder.
- `src/analysis/**` — no rule changes. The Academic pipeline is unchanged, and
  Task 2 runs identically in both modules (the marking criteria are the same;
  only topic difficulty differs, which is a content matter).
- `IssueCategory` — frozen, and this plan appends nothing to it.
- `src/answers/**` — worked answers are Academic today; plan 009 adds letters.

## Git workflow

- Branch: `advisor/008-module-switch`
- One commit per step; plain imperative subjects.
- Do NOT push and do NOT open a PR.

## Steps

### Step 1: Add the `Module` type

In `src/types.ts`, immediately above `TaskKind`:

```ts
/**
 * Which IELTS exam the learner is preparing for.
 *
 * These are two different exams sharing a name. The differences that reach this
 * codebase:
 *  - Writing Task 1 is a chart description in Academic and a LETTER in General
 *    Training — a different task with a different marking focus.
 *  - Writing Task 2 is marked identically; only the topics differ, which is a
 *    property of the prompt bank rather than of the engine.
 *  - Reading uses a stricter raw-score-to-band conversion for General Training
 *    (roughly four more correct answers for the same band).
 *  - Listening and Speaking are identical in both.
 */
export type Module = 'academic' | 'general';
```

Add it to `SessionRecord`, directly after `task`:

```ts
  /** Which IELTS task this session answered. Migrated to 'task2' for pre-v2 data. */
  task: TaskKind;
  /** Which exam it was preparing for. Migrated to 'academic' for pre-v3 data. */
  module: Module;
```

Extend `PromptSpec` so a Task 2 prompt can declare which exams it suits:

```ts
  /**
   * Which exams this prompt is appropriate for. Task 2 marking is identical in
   * both, so most prompts suit both; abstract topics (space exploration,
   * globalisation) are Academic-only in practice, and everyday ones suit both.
   * Absent means both, so existing bank entries need no edit to keep working.
   */
  modules?: Module[];
```

**Verify**: `npx tsc -b --noEmit` → **fails** on `src/App.tsx` (missing `module`
in the `SessionRecord` literal). Expected; fixed in step 3.

### Step 2: Add module metadata

In `src/meta.ts`:

```ts
/** Learner-facing names and the one-line difference that matters. */
export const MODULE_META: Record<Module, { label: string; short: string; blurb: string }> = {
  academic: {
    label: 'Academic',
    short: 'Academic',
    blurb: 'For university entry. Task 1 describes a chart or process.',
  },
  general: {
    label: 'General Training',
    short: 'General',
    blurb: 'For migration and work. Task 1 is a letter.',
  },
}
```

Add a comment above `TASK_CONSTANTS` recording what you confirmed in step 0:

```ts
/**
 * Per-task exam constants. NOT keyed by module: General Training Task 1 allows
 * the same 20 minutes and the same 150-word minimum as Academic Task 1, and
 * Task 2 is identical in both. If a future module ever differs on timing, this
 * is the table that grows a second dimension.
 */
```

**Verify**: `npx tsc -b --noEmit` → still the one expected `App.tsx` error.

### Step 3: Migrate the store to schemaVersion 3

Three edits to `src/profile/store.ts`, mirroring exactly what the v1→v2 rung did:

**3a.** `const SCHEMA_VERSION = 2` → `const SCHEMA_VERSION = 3`.

**3b.** Append a rung to `migrateSessions`, after the existing v1 block and
before `return out`:

```ts
  // v2 -> v3: the `module` discriminator was added. Everything written before
  // v3 was IELTS Academic, because that was the only exam the app supported.
  if (version === 2) {
    out = out.map((s) => (s.module === undefined ? { ...s, module: 'academic' as const } : s))
    version = 3
  }
```

**3c.** Extend `looksLikeSession` beside the existing `task` check:

```ts
  // `module` is optional on the wire: pre-v3 records predate the field and the
  // migration stamps it. Present-but-wrong is still a reject.
  if (value.module !== undefined && value.module !== 'academic' && value.module !== 'general') return false
```

Update the file header comment to describe v3 alongside v2.

**Verify**: `npx tsc -b --noEmit` → still the one expected `App.tsx` error.

### Step 4: Add module state and the switcher to App

In `src/App.tsx`:

**4a.** State, beside the existing `task` state:

```ts
  const [module, setModule] = useState<Module>('academic')
```

**4b.** Set it on the record in `submitInner`, beside `task`:

```ts
      task,
      module,
```

**4c.** A `switchModule` function modelled on `switchTask` — read that function
and copy its shape exactly, including the running-exam confirmation and the
sheet clearing:

```ts
  function switchModule(next: Module) {
    if (next === module) return
    if (mode === 'exam' && examState === 'running') {
      const leave = window.confirm(
        'The exam clock is running. Switch exam type and abandon this attempt?',
      )
      if (!leave) return
    }
    submittingRef.current = false
    examDeadlineRef.current = null
    setModule(next)
    // Task 1 is a different task in the two exams, so an answer written for one
    // cannot be marked against the other.
    setEssayText('')
    setExamState('idle')
    setFocusIssueId(null)
  }
```

**4d.** Render the switcher in the topbar, **before** the task toggle, matching
its markup:

```tsx
            <div className="mode-toggle module-toggle" role="group" aria-label="IELTS exam type">
              <button
                className={module === 'academic' ? 'mode-btn active' : 'mode-btn'}
                onClick={() => switchModule('academic')}
                title={MODULE_META.academic.blurb}
              >
                Academic
              </button>
              <button
                className={module === 'general' ? 'mode-btn active' : 'mode-btn'}
                onClick={() => switchModule('general')}
                title={MODULE_META.general.blurb}
              >
                General
              </button>
            </div>
```

Add `.module-toggle` to `src/App.css` beside `.task-toggle`.

**4e.** `handleRedraft` must restore the session's module:

```ts
    setModule(session.module)
```

**Verify**: `npx tsc -b --noEmit` → exit 0.

### Step 5: Route General Training Task 1 to an honest placeholder

General Training Task 1 is a letter, and plan 009 builds it. Until then the app
must not pretend. In the sheet zone, when `module === 'general' && task === 'task1'`,
render a card **instead of** the chart and editor:

```tsx
<div className="not-built card">
  <p className="eyebrow">General Training · Task 1</p>
  <h2>Letters are not ready yet</h2>
  <p>
    General Training Task 1 asks you to write a letter, not to describe a chart.
    That needs its own marking rules, so it is being built separately. Task 2 is
    marked identically in both exams and is ready to use now.
  </p>
  <button className="btn btn-primary" onClick={() => switchTask('task2')}>
    Go to Task 2
  </button>
</div>
```

Style `.not-built` in `App.css` using existing tokens. Do **not** disable the
General Training button — a learner must be able to see what the exam contains.

**Verify**: `npm run build` → exit 0.

### Step 6: Show the module in the Dashboard

`src/components/Dashboard.tsx` already has a Task column (added by plan 005).
Add an **Exam** column beside it showing `MODULE_META[s.module].short`. Follow
the Task column's markup exactly.

Extend the existing All / Task 1 / Task 2 filter, or add a second one for
module — whichever reads better in the existing layout. Do not redesign the
table.

**Verify**: `npx vitest run --project ui` → all pass.

### Step 7: Tag the Task 2 prompt bank

In `src/prompts/bank.ts`, add `modules` to each of the 40 prompts. Most suit
both exams. Mark as `['academic']` only those whose topic is genuinely too
abstract for General Training — space exploration, scientific research funding,
globalisation theory and similar. Everyday topics (education, work, health,
family, transport, technology in daily life) suit both and should be
`['academic', 'general']`.

Expect roughly 8–12 Academic-only out of 40. Add a header-comment note
explaining the rule you applied, so the next person tagging a prompt is
consistent.

Then filter the picker: `PromptPicker` receives only prompts matching the active
module. Pass the filtered list from `App.tsx` rather than teaching the component
about modules.

**Verify**: `npx tsc -b --noEmit` → exit 0.

### Step 8: Tests

**`tests/module-switch.test.ts`** (engine project), modelled on
`tests/store.test.ts` — reuse its `installLocalStorage` helper pattern:

1. A v2 store survives a save and every record gains `module: 'academic'`.
2. A v1 store migrates **both** rungs in one read: `task: 'task2'` AND
   `module: 'academic'`.
3. A v3 store round-trips a `module: 'general'` record unchanged.
4. A record with an invalid `module` is dropped, others kept.
5. An unknown future version is still backed up rather than destroyed
   (the plan-001 guarantee must survive this bump).
6. `importData` migrates a v2 export forward.
7. Every prompt in `PROMPTS` has a non-empty `modules` array.
8. At least 25 prompts suit General Training (so the picker is not near-empty).

**`tests/ui/module-switch.test.tsx`** (ui project), modelled on
`tests/ui/task-switching.test.tsx`:

9. The app opens on Academic with that button active.
10. Switching to General clears the answer sheet.
11. General + Task 1 shows the placeholder, not the chart.
12. General + Task 2 shows a normal editor and rail.
13. Switching module mid-exam prompts for confirmation (mock `window.confirm`).
14. A submitted session appears in Progress with its exam type.

**Verify**: `npx vitest run` → all pass, 14 new tests.

### Step 9: Documentation

**SPEC.md** — add a `## Modules (Academic / General Training)` section stating
the table from "Why this matters", that `Module` lives in `types.ts`, that
storage is schemaVersion 3 with a v2→v3 rung stamping `'academic'`, that Task 2
marking is identical in both, and that General Training Task 1 (letters) is
specified in plan 009.

**README.md** — one paragraph under the intro saying both exams are supported
and what differs.

### Step 10: Full green

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `npx vitest run` → all pass (253 existing + 14 new).
**Verify**: `npm run build` → exit 0.

## Test plan

- **New**: `tests/module-switch.test.ts` (8 cases), `tests/ui/module-switch.test.tsx` (6 cases).
- **Pattern**: `tests/store.test.ts` and `tests/ui/task-switching.test.tsx`.
- **No existing test may change.** This plan alters no analysis behaviour. If an
  analysis test fails, something out of scope was touched — a STOP condition.
- The migration cases are the most important in the plan: plan 001 exists
  because a schema bump once destroyed user history, and this is the first bump
  since. Case 5 specifically re-proves that guarantee.

## Done criteria

- [ ] `npx tsc -b --noEmit` exits 0
- [ ] `npx vitest run` exits 0; 14 new tests pass, none modified
- [ ] `npm run build` exits 0
- [ ] `grep -c "SCHEMA_VERSION = 3" src/profile/store.ts` returns 1
- [ ] `grep -c "version === 2" src/profile/store.ts` returns 1 (the new rung)
- [ ] `grep -c "version === 1" src/profile/store.ts` returns 1 (the old rung, intact)
- [ ] `grep -c "module: Module" src/types.ts` returns 1
- [ ] `grep -c "modules?" src/types.ts` returns 1
- [ ] `grep -c "modules:" src/prompts/bank.ts` returns 40
- [ ] `git status --porcelain` lists only the in-scope files
- [ ] `plans/README.md` status row for 008 updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- Any excerpt in "Current state" does not match the live file.
- Any existing test fails.
- The v1→v3 double migration (test case 2) does not work. Two rungs in sequence
  is the whole design of the ladder; if it fails, the ladder is wrong and needs
  a decision, not a patch.
- You find that General Training Task 1 needs different timing or word counts
  from Academic Task 1 — the plan assumes it does not. Report the source.
- Tagging the prompt bank leaves fewer than 25 prompts available to General
  Training. That would make the General picker feel empty and is a content
  decision, not an executor one.

## Maintenance notes

- **The migration ladder now has two rungs.** Every future field addition
  appends one more `if (version === N)` block. Never reorder them and never
  collapse two into one branch: a learner can arrive from any older version, and
  the rungs must apply in sequence.
- **`Module` deliberately does not key `TASK_CONSTANTS`.** General Training
  Task 1 shares Academic's timing and word count. If that ever changes, that
  table grows a second dimension and `App.tsx` reads `TASK_CONSTANTS[module][task]`.
- **The error profile is not module-scoped.** `categoryAppliesTo` in `meta.ts`
  scopes categories by TASK; once plan 009 adds letter-only categories, the same
  treatment will be needed for module. Do it then, not now — the sets would be
  empty today.
- **What a reviewer should scrutinise**: that the v1→v2 rung is untouched, that
  `switchModule` clears the answer sheet, and that the General Training Task 1
  placeholder is honest rather than a disabled button.
