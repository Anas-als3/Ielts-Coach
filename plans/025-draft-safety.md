# Plan 025: No work in progress dies silently — draft persistence, an unload guard, toggle consent, and a blank-expiry guard

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. Do NOT edit `plans/README.md`; the reviewer who
> dispatched you maintains the index.
>
> **Drift check (run first)**:
> `git diff --stat d4ddef8..HEAD -- src/App.tsx src/profile/draft.ts src/profile/store.ts src/components/ReadingRunner.tsx src/components/ListeningRunner.tsx src/types.ts tests/draft.test.ts tests/ui/draft-safety.test.tsx tests/ui/task-switching.test.tsx tests/ui/module-switch.test.tsx tests/ui/reading.test.tsx SPEC.md`
> (the pathlist covers every file "Current state" quotes, not only the files
> this plan edits — plan 016 legitimately edits `store.ts` first, and that
> drift must be LOOKED AT, not missed)
> If any file quoted in "Current state" changed since this plan was written,
> compare the excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition. Every line number below was read off `d4ddef8`.

## Status

- **Priority**: **P0** — silent, unrecoverable loss of a learner's work in progress
- **Effort**: M (1 day)
- **Risk**: MED — touches the exam clock and the submit path in `App.tsx`; a bad
  change here either loses essays faster or saves ones that should not exist
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `d4ddef8`, 2026-08-10

## Why this matters

**The store's contract is "nothing is ever destroyed without a recoverable
copy" — but that contract only starts at submit. Everything BEFORE submit is
`useState` and nothing else, and four separate paths destroy it silently.**

Every claim below was verified against the real code on 2026-08-10 at `d4ddef8`.

| Defect | Where | What a learner loses |
|---|---|---|
| **025-a** `essayText` lives only in React state (`src/App.tsx:122`); the sole `localStorage` writer in `src/` is `store.ts`, called on submit (`submitInner`, `App.tsx:314-360`). `examDeadlineRef` (`:146`) is memory-only. | reload / crash / tab close | The whole essay — 280 words, 35 minutes of a timed exam — and the exam cannot resume |
| **025-b** No `beforeunload` listener anywhere in `src/` (`grep -rn "beforeunload" src/` → no matches at `d4ddef8`). The Reading runner holds answers in `useState({})` (`ReadingRunner.tsx:428`) and persists only on submit (its own doctrine, `:9-13`); Listening is its declared sibling (`ListeningRunner.tsx:4-9`). In-app exits confirm (`ReadingRunner.tsx:501-506`, `ListeningRunner.tsx:621-626`); browser exits do not. | closing the tab mid-paper | 40+ minutes of answers, with no warning at all |
| **025-c** `switchTask` confirms ONLY while an exam clock runs (`App.tsx:402-407`), then clears unconditionally (`:413`); `switchModule` the same (`:426-431`, clear at `:460`). | one curious click on a toggle | A coach-mode draft, 280 words in, gone with no confirm and no copy |
| **025-d** Timer expiry submits unguarded — `App.tsx:271-274` calls `handleSubmit()` at `examSecondsLeft === 0` — while both manual paths refuse an empty essay (keyboard `:282`, button `disabled` `:832`). | walking away from a started exam | Nothing — worse: a BLANK session is saved, polluting the history and the error profile with a Band-4 script the learner never wrote |

This plan makes one promise: **work in progress is either on disk, or the
learner explicitly consented to losing it.** A scratch-draft key holds the
essay (and a running exam's absolute deadline) between keystroke and submit;
`beforeunload` guards the windows the draft cannot cover; the toggles ask
before they clear; and an expired blank exam is returned, not marked.

## Current state

Read each cited line before changing it. Line numbers are from `d4ddef8`.

### 025-a — the essay exists only in memory

`src/App.tsx:122` and `:146-148`:

```tsx
  const [essayText, setEssayText] = useState('')
  ...
  const examDeadlineRef = useRef<number | null>(null)
  const essayTextRef = useRef(essayText)
  essayTextRef.current = essayText
```

The only write to `localStorage` happens at the end of a successful submit
(`App.tsx:350-357`):

```tsx
    saveSession(record)
    // Re-read the store so in-memory state always matches persistence (cap, sort).
    setSessions(loadSessions())
    setReportSessionId(record.id)
    setExamState('idle')
    setExamSecondsLeft(taskConstants.examDurationSec)
    examDeadlineRef.current = null
    setView('report')
```

The debounce helper you will reuse, `App.tsx:85-92`:

```tsx
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}
```

is already applied to the essay at `:162`: `const debouncedText =
useDebounced(essayText, 400)` — the draft effect keys off this existing value,
adding no new debounce machinery. `countWords` is at `:94-97`.

The exam clock is a wall-clock deadline, set once at `:962`
(`examDeadlineRef.current = Date.now() + taskConstants.examDurationSec * 1000`)
and read by the tick effect at `:240-262`. In exam mode with `examState ===
'idle'`, the EDITOR IS NOT RENDERED — the ternary at `:949-968` shows the
"Start the clock" card instead. This fact decides where an expired draft can
be restored to (step 4).

The prompt slots and their restore-by-id pattern (`handleRedraft`,
`App.tsx:385-394`):

```tsx
    if (session.task === 'task1' && session.module === 'general') {
      const letter = LETTER_PROMPTS.find((x) => x.id === session.promptId)
      if (letter) setLetterPrompt(letter)
    } else if (session.task === 'task1') {
      const t1 = TASK1_PROMPTS.find((x) => x.id === session.promptId)
      if (t1) setTask1Prompt(t1)
    } else {
      setPrompt(PROMPTS.find((x) => x.id === session.promptId) ?? null)
    }
    setEssayText(session.essayText)
```

### 025-b — no beforeunload guard anywhere

`grep -rn "beforeunload" src/ tests/` → no matches (verified at `d4ddef8`;
grep exits 1 on no match — that exit code IS the confirmation here).

`src/components/ReadingRunner.tsx:9-13` (module doctrine):

```
 * Answers live in component state and are persisted ONLY on submit. A
 * half-finished paper is not a session: writing one to storage would put a
 * band in the learner's history for a test they never completed, and the error
 * profile and the Reading history would both then describe something that did
 * not happen.
```

with `const [answers, setAnswers] = useState<ReadingAnswers>({})` at `:428`,
and the in-app exit confirm at `:501-506`. `ListeningRunner.tsx:4-9` declares
the same rule ("the same 'answers live in component state and are persisted
ONLY on submit'"), with its exit confirm at `:621-626`. That doctrine is
CORRECT and this plan keeps it — see "Out of scope".

Both runners' stages are App state: `readingStage` (`App.tsx:129`) and
`listeningStage` (`:132`), each `'picker' | 'running' | 'report'`-shaped. The
guard can therefore live entirely in `App.tsx` without touching either runner.

### 025-c — the toggles clear without consent

`src/App.tsx:400-419` (`switchTask`):

```tsx
  function switchTask(next: TaskKind) {
    if (next === task) return
    if (mode === 'exam' && examState === 'running') {
      const leave = window.confirm(
        'The exam clock is running. Switch task and abandon this attempt?',
      )
      if (!leave) return
    }
    submittingRef.current = false
    examDeadlineRef.current = null
    setTask(next)
    // A Task 2 essay sitting in a Task 1 answer sheet would be scored against
    // the wrong rules and produce confidently wrong feedback.
    setEssayText('')
```

`switchModule` (`:421-463`) has the same shape: exam-only confirm at
`:426-431`, then — ONLY when `view === 'write'`, via the early return at
`:457` — `setEssayText('')` at `:460`. When the module is switched from the
Reading section the essay deliberately survives, and
`tests/ui/reading.test.tsx:115-134` pins that ("does not destroy an essay in
progress when the exam type changes"). Do not break it: the new confirm must
fire only on the path that clears.

Two existing tests exercise the now-unguarded clear and will need a
`confirm` mock once consent is required (jsdom's `window.confirm` returns
`undefined`, which reads as "declined"):

- `tests/ui/task-switching.test.tsx:84-97` — types, then clicks Task 1,
  asserts `sheet().value` is `''`.
- `tests/ui/module-switch.test.tsx:75-87` — types, then clicks General,
  asserts the sheet cleared.

No other existing UI test types text and then presses a task/module toggle
(verified by grep over `tests/ui/` at `d4ddef8`; `module-switch.test.tsx:89-119`
toggles with an EMPTY sheet, so `countWords === 0` and no confirm fires).

### 025-d — expiry submits a blank script

`src/App.tsx:271-274`:

```tsx
  useEffect(() => {
    if (examState === 'running' && examSecondsLeft === 0) handleSubmit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examSecondsLeft, examState])
```

Both manual submit paths refuse an empty sheet — keyboard (`:282`,
`if (countWords(essayTextRef.current) === 0) return`) and button (`:832`,
`disabled={liveWordCount === 0}`) — so this effect is the ONLY path that can
write a zero-word session. `role="status"` precedent for a non-urgent notice:
`src/components/ListeningRunner.tsx:723`.

### The store this plan must NOT entangle

`src/profile/store.ts` stays session-only. Its constants, for reference and
for the key-collision argument: `STORAGE_KEY = 'ielts-coach.v1'` (`:35`),
`BACKUP_KEY_PREFIX = 'ielts-coach.backup.'` (`:44`), `SCHEMA_VERSION = 5`
(`:36`), `writeStore` catches quota errors (`:446-458`), and read validation
treats stored bytes as hostile wire. The new draft key
`'ielts-coach.draft.v1'` shares the `ielts-coach.` namespace but matches
neither the store key nor the backup prefix.

### Repo conventions you must match

- **React 18 + TypeScript strict, Vite, pure client-side, `localStorage` only,
  deterministic rule analysis. Runtime dependencies are exactly `react` and
  `react-dom` — add none.**
- **Storage reads are hostile-wire**: `draft.ts` must validate every field on
  read and never throw, exactly as `store.ts` does. A hand-edited or truncated
  draft yields `null`, not a crash and not a half-applied restore.
- **Comments explain WHY** — the failure mode prevented. Match `store.ts`'s voice.
- **UI tests render through `renderApp()`** from `tests/ui/renderApp.tsx`,
  never `render(<App />)` — the helper's header explains the flake it pins.
  `tests/ui/setup.ts:11-19` clears `localStorage` before and after every test.
- **`tsconfig.json` has `"include": ["src"]`** — `npx tsc -b --noEmit` gates
  `src/` only; tests are NOT typechecked today (plan 024 fixes that). Write
  test code that will survive plan 024 anyway: no `any`, no missing required
  fields, import the real types.
- **`IssueCategory` ids are FROZEN** and `Criterion` stays four members.
  Neither changes here.
- **Type names you will import**: `TaskKind` (`src/types.ts:405`), `Module`
  (`:399`), `WritingMode` (`:407`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npx tsc -b --noEmit` | exit 0, no output |
| Full suite | `npx vitest run` | **853 passed / 24 files** at `d4ddef8`; more after this plan |
| New engine file | `npx vitest run tests/draft.test.ts` | all pass |
| New UI file | `npx vitest run tests/ui/draft-safety.test.tsx` | all pass |
| Engine project | `npx vitest run --project engine` | all pass |
| UI project | `npx vitest run --project ui` | all pass |
| Build | `npm run build` | exit 0 |

(Projects: `vite.config.ts:22-29` engine, node, `tests/*.test.ts`;
`:30-38` ui, jsdom, `tests/ui/*.test.tsx` with `tests/ui/setup.ts`.)

**UI determinism**: after any UI change, run `npx vitest run --project ui`
**ten consecutive times** and confirm identical results.

## Scope

**In scope** (the only files you may modify or create):

- `src/profile/draft.ts` (create) — the scratch-draft module
- `src/App.tsx` — draft effect, restore card, beforeunload guard, toggle
  consent, blank-expiry guard
- `tests/draft.test.ts` (create) — engine tests for `draft.ts`
- `tests/ui/draft-safety.test.tsx` (create) — restore / discard / unload /
  expiry UI tests
- `tests/ui/task-switching.test.tsx` — consent mock + two new consent cases
- `tests/ui/module-switch.test.tsx` — consent mock + one new consent case
- `SPEC.md` — record the draft key, its shape, and the four new behaviours

**Out of scope** (do NOT touch, even though they look related):

- **`src/profile/store.ts`** — plan 016 owns store durability. `draft.ts` is a
  NEW file precisely so the two plans cannot collide. Do not add draft
  awareness to the store, and do not change any store constant.
- **`src/components/ReadingRunner.tsx` / `ListeningRunner.tsx`** — answer
  persistence (resume mid-paper) is deliberately NOT built. Listening's
  play-once audio makes an honest resume impossible: the recording cannot be
  rewound to where the crash happened, so a "resumed" paper would either
  replay audio (coaching the answers) or mark questions the learner never
  heard. Reading could technically resume, but shipping it for one section
  and not its declared sibling breaks the symmetry both file headers promise
  — and the runners' own doctrine ("a half-finished paper is not a session")
  is correct. The `beforeunload` guard in `App.tsx` is the whole runner
  deliverable, and it needs no change to either file.
- `src/components/Editor.tsx`, `src/analysis/**`, `src/prompts/**` — read-only
  from this plan's point of view.
- `SCHEMA_VERSION`, the migration ladder (`store.ts:265-316`), `importData` /
  `exportData` — the draft is scratch state, not history: it is never
  exported, never imported, never versioned past its own key name.
- `plans/README.md` — the reviewer owns the index.

## Coordination

- **Plan 016 (`plans/016-store-durability.md`)**: no file overlap (`016` edits
  `store.ts`/`Report.tsx`/`types.ts`; this plan creates `draft.ts`), but both
  add `localStorage` keys. 016's backup pruning iterates keys by the prefix
  `'ielts-coach.backup.'` (`store.ts:44`) — `'ielts-coach.draft.v1'` does not
  match that prefix, so it can never be swept — the protection is
  **structural** (prefix pruning), not something 016's plan text states; 016
  does not mention the draft key at all. One true conflict: 016's done
  criterion expects `grep -rn "removeItem" src/` to return exactly its
  `pruneBackups` site. This plan's `clearDraft` also calls `removeItem`.
  **Whichever plan lands second must note the other's `removeItem` site when
  checking that criterion** — both sites are legitimate.
- **Plan 023 (App split)**: NOT concurrent with this plan — both rewrite
  `App.tsx`. Whichever lands second rebases onto the other's `App.tsx`.

## Git workflow

- Branch: `advisor/025-draft-safety`, off `main`.
- One commit per step (the draft module, the persistence wiring, the restore
  card, the unload guard, the consent change, the expiry guard, SPEC.md), so
  each behaviour can be reverted independently. Message style matches
  `git log`: one plain imperative sentence, e.g.
  `Persist the essay draft between keystroke and submit`.
- Do NOT push and do NOT open a PR.
- Mutation checks in this plan temporarily edit a source file; revert each
  with `git checkout -- <file>` inside your branch after recording the result.

## Steps

### Step 1: Create `src/profile/draft.ts`

New file. It mirrors `store.ts`'s discipline — reads `window.localStorage` at
call time (so the engine tests' stub works), treats stored bytes as hostile,
never throws — but is deliberately NOT part of the session store: a draft is
scratch state with exactly one owner, one key, no versioned migration ladder
and no backup on loss (its whole content is at most one debounce window ahead
of what the learner can retype; the ladder exists for irreplaceable history).

```ts
export const DRAFT_KEY = 'ielts-coach.draft.v1'

export interface WritingDraft {
  task: TaskKind
  module: Module
  promptId: string | null
  essayText: string
  mode: WritingMode
  /** Absolute wall-clock deadline of a RUNNING exam. null in coach mode and in exam-idle. */
  examDeadlineEpochMs: number | null
  savedAtISO: string
}

/** The stored draft, or null when absent, unreadable, or invalid in ANY field. Never throws. */
export function loadDraft(): WritingDraft | null

/** Best-effort write. Quota or blocked storage is warned to the console, never thrown. */
export function saveDraft(draft: WritingDraft): void

/** Best-effort delete. Removing an absent key is a no-op. */
export function clearDraft(): void

/** True iff the draft was a RUNNING exam whose deadline is at or before nowEpochMs. */
export function isExamDraftExpired(draft: WritingDraft, nowEpochMs: number): boolean
```

(Signatures only — you write the bodies.) `loadDraft` validation, all of which
must hold or the function returns `null`:

- payload parses as JSON to a non-null object
- `task` is `'task1' | 'task2'`; `module` is `'academic' | 'general'`;
  `mode` is `'coach' | 'exam'` (import the types; check membership against
  literal arrays — do not cast)
- `promptId` is a string or `null`
- `essayText` is a string containing at least one word by the same
  `/[A-Za-zÀ-ɏ'’-]+/` test `App.tsx:94-97` uses (duplicate the tiny regex test
  locally rather than importing from `App.tsx` — a storage module importing
  the component tree would be an upside-down dependency). A zero-word draft is
  never written (step 2), so one on disk is hand-edited or corrupt: reject it.
- `examDeadlineEpochMs` is `null` or a finite number
- `savedAtISO` is a string
- `getItem` throwing (storage blocked) is caught → `null`

`isExamDraftExpired` returns `true` only when `draft.mode === 'exam' &&
draft.examDeadlineEpochMs !== null && draft.examDeadlineEpochMs <= nowEpochMs`.
A coach draft and an exam-idle draft (deadline `null`) are never "expired".

**Verify**: `npx tsc -b --noEmit` → exit 0.

### Step 2: Engine tests for the draft module, with the validation mutation-checked

Create `tests/draft.test.ts` (engine project — node, no jsdom). Model the
in-memory `localStorage` stub on `tests/store.test.ts:30-46`
(`installLocalStorage()` builds a `Map`-backed stub on `globalThis.window`;
install it in `beforeEach`, silence `console.warn` as `store.test.ts:50-54`
does). Import `DRAFT_KEY`, all four functions, and a `makeDraft(overrides)`
helper you write returning a valid coach draft.

The 14 cases, exactly:

1. round-trips a coach draft (`saveDraft` → `loadDraft` deep-equals)
2. round-trips an exam draft with a numeric `examDeadlineEpochMs`
3. `loadDraft` → `null` when the key is absent
4. `null` when the payload is not JSON (`'not json{'`)
5. `null` when the payload is JSON but not an object (`'42'`)
6. `null` when `task` is not `'task1' | 'task2'` (`'task9'`)
7. `null` when `module` is invalid (`'business'`)
8. `null` when `mode` is invalid (`'zen'`)
9. `null` when `essayText` is missing or not a string
10. `null` when `essayText` has zero words (`''` and `'   ...!!!'`)
11. `null` when `examDeadlineEpochMs` is neither `null` nor finite
    (`'soon'`, `NaN`)
12. neither `loadDraft` nor `saveDraft` throws when the underlying storage
    call throws (override `getItem`/`setItem` to throw; `loadDraft` → `null`)
13. `clearDraft` removes the key, and is a no-op when the key is absent
14. `isExamDraftExpired`: `false` for a coach draft even with a past
    deadline value, `false` for a future deadline, `true` for a past-or-equal
    deadline, `false` for a `null` deadline

**Verify**: `npx vitest run tests/draft.test.ts` → 14 passed.

**Mutation check (validation)**: in `loadDraft`, temporarily delete the `task`
membership check. `npx vitest run tests/draft.test.ts` → case 6 FAILS (a
`task: 'task9'` draft is returned instead of `null`). Revert with
`git checkout -- src/profile/draft.ts`, re-run, 14 passed. Report both results.

### Step 3: Wire persistence into `App.tsx` — debounced write, cleared on submit

All `App.tsx` work in steps 3–7 goes inside the existing component; import
`loadDraft, saveDraft, clearDraft, isExamDraftExpired` and type `WritingDraft`
from `./profile/draft`.

**3a.** New state and ref, next to the existing ones (`:122-149`):

```tsx
  // The draft found at mount, held until the learner decides. NEVER applied
  // silently: a draft is an offer, because auto-restoring would overwrite the
  // empty sheet a learner deliberately reloaded to get.
  const [pendingDraft, setPendingDraft] = useState<WritingDraft | null>(() => loadDraft())
  // The exact text last written to the draft key — what beforeunload compares
  // against to know whether closing the tab would lose anything.
  const draftTextRef = useRef('')
```

**3b.** The persistence effect, keyed off the EXISTING `debouncedText`
(`:162`, 400 ms) — no new debounce:

```tsx
  useEffect(() => {
    if (view !== 'write') return
    // While a restore offer is undecided, the effect must not run at all:
    // essayText is '' at mount, and the zero-word branch below would delete
    // the very draft the card is offering to restore.
    if (pendingDraft !== null) return
    if (countWords(debouncedText) === 0) {
      clearDraft()
      draftTextRef.current = ''
      return
    }
    const activeSpec = isLetter ? letterPrompt : task === 'task1' ? task1Prompt : prompt
    saveDraft({
      task,
      module,
      promptId: activeSpec?.id ?? null,
      essayText: debouncedText,
      mode,
      examDeadlineEpochMs: examState === 'running' ? examDeadlineRef.current : null,
      savedAtISO: new Date().toISOString(),
    })
    draftTextRef.current = debouncedText
  }, [debouncedText, view, task, module, mode, examState, isLetter, letterPrompt, task1Prompt, prompt, pendingDraft])
```

**3c.** Clear on successful submit: in `submitInner`, next to the other
post-save resets (`:350-357`), add `clearDraft()` and
`draftTextRef.current = ''`. The comment should say why here and not in the
effect: after submit the view is `'report'`, so the effect never runs again
to do it, and a stale draft would offer back an essay that is already in the
history.

**Verify**: `npx tsc -b --noEmit` → exit 0; `npx vitest run --project ui` →
all existing tests still pass (`setup.ts` clears storage per test, and no
existing test mounts with a draft present, so the card never shows).

### Step 4: The restore card — offered, never silent; expiry-aware

**4a.** New state for the clock notices (used again in step 7):

```tsx
  const [clockNotice, setClockNotice] = useState<string | null>(null)
```

**4b.** The handlers:

```tsx
  function restoreDraft(draft: WritingDraft): void   // signature only — body below, in prose
  function discardDraft(): void                       // clearDraft(); draftTextRef.current = ''; setPendingDraft(null)
```

`restoreDraft` does, in order:

- `submittingRef.current = false`; `setTask(draft.task)`; `setModule(draft.module)`
- restore the matching prompt slot by `promptId`, copying the exact
  three-branch lookup of `handleRedraft` (`App.tsx:385-393`; letter when
  `task1`+`general`, chart when `task1`, else `PROMPTS`). A `promptId` no bank
  contains leaves the current slot untouched — the text still restores.
- `setEssayText(draft.essayText)`; `setFocusIssueId(null)`
- **If** `draft.mode === 'exam' && draft.examDeadlineEpochMs !== null &&
  !isExamDraftExpired(draft, Date.now())` — resume the running exam from the
  ABSOLUTE deadline: `pacingRef.current = []`, `pasteAttemptsRef.current = 0`,
  `examDeadlineRef.current = draft.examDeadlineEpochMs`, `setMode('exam')`,
  `setExamState('running')`, `setExamSecondsLeft(Math.max(0,
  Math.round((draft.examDeadlineEpochMs - Date.now()) / 1000)))`. The clock
  lost no time while the tab was closed — that is the point of persisting the
  deadline rather than the seconds left.
- **Else** — coach, exam-idle, or expired: `examDeadlineRef.current = null`,
  `setMode('coach')`, `setExamState('idle')`,
  `setExamSecondsLeft(TASK_CONSTANTS[draft.task].examDurationSec)`. When the
  draft was an EXPIRED exam (`isExamDraftExpired(draft, Date.now())`), also
  `setClockNotice('The exam clock ran out while you were away. Your essay was
  kept — review it here and submit when you are ready.')`. **Never
  auto-submit on mount**: submitting is an act the learner performs, and an
  app that marks an essay nobody handed in is hostile. Restoring into COACH
  mode (which IS exam-idle — `examState` is `'idle'`) rather than exam mode
  is forced by the UI itself: in exam mode + idle the editor is not rendered
  (the ternary at `App.tsx:949-968` shows "Start the clock" instead), so the
  restored text would be invisible, and starting the clock over a pre-filled
  sheet is a head start the real exam does not allow.
- `setPendingDraft(null)`; `setView('write')`. Do NOT `clearDraft()` on
  restore — the debounced effect re-saves within 400 ms anyway, and clearing
  first would open a window where a crash loses the essay twice.

**4c.** Render, as the FIRST children of `<section className="sheet-zone">`
(`App.tsx:856`), before the existing prompt ternary:

```tsx
            {clockNotice !== null && (
              <div className="card" role="status">
                <p>{clockNotice}</p>
                <button className="btn" onClick={() => setClockNotice(null)}>
                  Dismiss
                </button>
              </div>
            )}
            {pendingDraft !== null && (
              <div className="card" role="status">
                <p>
                  You have an unfinished draft from earlier
                  {/* word count from countWords(pendingDraft.essayText) */}
                </p>
                <button className="btn btn-primary" onClick={() => restoreDraft(pendingDraft)}>
                  Restore draft
                </button>
                <button className="btn" onClick={discardDraft}>
                  Discard draft
                </button>
              </div>
            )}
```

(Exact copy is yours; the two button NAMES — "Restore draft", "Discard
draft" — and the two `role="status"` are load-bearing for the tests.
`role="status"` matches the app's one precedent for a non-urgent notice,
`ListeningRunner.tsx:723`.) Also clear a stale notice when a fresh exam
starts: add `setClockNotice(null)` inside the "Start the clock" onClick
(`:958-964`).

**Verify**: `npx tsc -b --noEmit` → exit 0.

### Step 5: The beforeunload guard

One effect in `App.tsx`. **The rule, stated honestly**: warn exactly when
closing the tab would destroy something no key holds —

1. a Reading or Listening paper is running (`view === 'reading' &&
   readingStage === 'running'`, or `view === 'listening' && listeningStage
   === 'running'`) — their answers are memory-only by doctrine; or
2. on the write view, the sheet has words AND its text differs from the last
   text written to the draft key (`essayTextRef.current !==
   draftTextRef.current`) — i.e. only inside the ≤400 ms debounce window.
   Once the draft is on disk, closing the tab is SAFE, and a warning then
   would be a lie that teaches learners to click through warnings.

```tsx
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const runnerLive =
        (view === 'reading' && readingStage === 'running') ||
        (view === 'listening' && listeningStage === 'running')
      const draftStale =
        view === 'write' &&
        countWords(essayTextRef.current) > 0 &&
        essayTextRef.current !== draftTextRef.current
      if (!runnerLive && !draftStale) return
      e.preventDefault()
      e.returnValue = '' // legacy Chrome requires an assigned returnValue
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [view, readingStage, listeningStage])
```

Browsers ignore custom message text; `preventDefault` is the whole mechanism.
jsdom fires the listener and records `defaultPrevented`, which is what the
tests assert.

**Verify**: `npx tsc -b --noEmit` → exit 0.

### Step 6: Toggle consent — the clear is never free

**6a.** `switchTask` (`:400-419`): keep the exam-running confirm exactly as
is (its wording is pinned by `module-switch.test.tsx:186`'s sibling pattern),
and add an `else if` for everything else:

```tsx
    } else if (countWords(essayText) > 0) {
      const leave = window.confirm(
        'Switching task clears the answer sheet and discards the essay in progress. Switch anyway?',
      )
      if (!leave) return
    }
```

After the confirms, alongside the existing `setEssayText('')` (`:413`), add
`clearDraft()` and `draftTextRef.current = ''` — consent to clear IS the
"explicit discard" the draft contract names; keeping a draft the learner just
agreed to abandon would re-offer it at next launch as if the consent never
happened.

**6b.** `switchModule` (`:421-463`): same `else if`, but conditioned on
`view === 'write'` so the Reading-view path stays confirm-free (the essay
SURVIVES that path — early return at `:457` — and
`tests/ui/reading.test.tsx:115-134` pins it):

```tsx
    } else if (view === 'write' && countWords(essayText) > 0) {
      const leave = window.confirm(
        'Switching exam type clears the answer sheet and discards the essay in progress. Switch anyway?',
      )
      if (!leave) return
    }
```

and add `clearDraft()` + `draftTextRef.current = ''` next to the clear at
`:460` (inside the `view === 'write'` tail only).

**6c.** Update the two existing tests that now hit the confirm:

- `tests/ui/task-switching.test.tsx:84-97`: add
  `vi.spyOn(window, 'confirm').mockReturnValue(true)` before the switch and
  assert it was called once with a message matching
  `/clears the answer sheet/i`.
- `tests/ui/module-switch.test.tsx:75-87`: same.

**6d.** Add the consent cases (model on `module-switch.test.tsx:177-190`,
which already spies on `confirm`):

- `task-switching.test.tsx`: **"refuses to clear a coach-mode draft without
  consent"** — mock `confirm` → `false`, type words, click Task 1: sheet
  still holds the text, Task 2 button still has class `active`, confirm
  called once.
- `task-switching.test.tsx`: **"switching with an empty sheet asks nothing"**
  — no typing, click Task 1: confirm NOT called, switch happens.
- `module-switch.test.tsx`: **"refuses to clear a coach-mode draft without
  consent"** — mock `confirm` → `false`, type, click General: text intact,
  Academic still active.

**Mutation check (consent)**: **commit step 6's own App.tsx and test changes
FIRST** — `git checkout -- src/App.tsx` restores the last commit, and if step
6's consent code is uncommitted the checkout wipes it along with the mutation
and the re-run fails for the wrong reason. Then temporarily change the new
`switchTask` condition from `countWords(essayText) > 0` to `false`.
`npx vitest run tests/ui/task-switching.test.tsx` → the "refuses to clear"
case FAILS (the sheet clears without any confirm). Revert with
`git checkout -- src/App.tsx`. Re-run → pass. Report both.

**Verify**: `npx vitest run tests/ui/task-switching.test.tsx tests/ui/module-switch.test.tsx tests/ui/reading.test.tsx` → all pass (reading.test.tsx proves the Reading-view path still asks nothing).

### Step 7: The blank-expiry guard

Replace the effect at `:271-274` with:

```tsx
  useEffect(() => {
    if (examState !== 'running' || examSecondsLeft !== 0) return
    if (countWords(essayTextRef.current) === 0) {
      // An examiner does not mark a blank script. Submitting here would put a
      // Band-4-floor session into the history and the error profile for an
      // essay that was never written — the manual paths already refuse this
      // (the keyboard guard above, the disabled submit button), and expiry
      // was the one path that did not.
      examDeadlineRef.current = null
      setExamState('idle')
      setExamSecondsLeft(taskConstants.examDurationSec)
      setClockNotice(
        'Time is up. A blank answer sheet is never submitted — nothing was added to your history.',
      )
      return
    }
    handleSubmit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examSecondsLeft, examState])
```

`submittingRef` is untouched on the blank path (nothing was submitted), and
the draft key needs no explicit clear (a zero-word sheet means the
persistence effect already holds no draft). An essay with ≥1 word still
submits exactly as before.

**Verify**: `npx tsc -b --noEmit` → exit 0.

### Step 8: UI tests — `tests/ui/draft-safety.test.tsx`

Create the file. Render through `renderApp()` ONLY. Reuse the established
helpers by copying their shape: `sheet()` / `type()` from
`tests/ui/task-switching.test.tsx:48-54` (focus + `user.paste`), the
`PADDING` word generator (`:59-65`) for submittable essays, `navLink` from
`tests/ui/reading.test.tsx:35-37`, and the paper-start flow from
`reading.test.tsx:79-83`. Seed drafts by writing
`localStorage.setItem(DRAFT_KEY, JSON.stringify({...}))` BEFORE `renderApp()`
(import `DRAFT_KEY` and the `WritingDraft` type from `../../src/profile/draft`;
build complete, correctly-typed drafts — plan 024 will typecheck this file).
Use `initialPrompt`'s id `'op-01'` (`renderApp.tsx:32`) as the seeded
`promptId` so restore lands on the pinned prompt.

The 11 cases:

1. **"typing mints a draft after the debounce"** — paste words; `waitFor`
   until `JSON.parse(localStorage.getItem(DRAFT_KEY)!)` has
   `essayText` equal to the sheet text.
2. **"submitting clears the draft"** — paste a PADDING essay, click
   "Finish & review", await the report (`findByRole('button', { name: 'New
   essay' })` — the pattern `tests/ui/a11y.test.tsx:325-331` uses), then
   `expect(localStorage.getItem(DRAFT_KEY)).toBeNull()`.
3. **"a draft is offered, never applied silently"** — seed a coach draft;
   `renderApp()`; the "Restore draft" button is present AND the sheet is
   still empty; click it; sheet now holds the draft text and the card is gone.
4. **"Discard removes the draft"** — seed; click "Discard draft"; key is
   `null`, sheet empty, card gone.
5. **"an unclaimed draft survives the debounce window"** — seed;
   `renderApp()`; wait past the 400 ms debounce (e.g.
   `await new Promise((r) => setTimeout(r, 600))` inside the test); the key
   is STILL present and the card still shows. (This pins the
   `pendingDraft !== null` early return in the persistence effect.)
6. **"an expired exam draft restores to coach with a notice and never
   auto-submits"** — seed `mode: 'exam'`, `examDeadlineEpochMs: Date.now() -
   1000`; restore; assert: sheet holds the text, the "Finish & review" button
   is visible (coach mode), a `role="status"` element matches
   /clock ran out/i, and `localStorage.getItem('ielts-coach.v1')` is still
   `null` (no session was written).
7. **"a live exam draft resumes the clock from the absolute deadline"** —
   seed `examDeadlineEpochMs: Date.now() + 600_000`; restore; assert the
   "Submit" button is visible (exam running) and the timer text matches
   `/^(09:5[0-9]|10:00)$/`.
8. **"beforeunload warns only while the draft is stale"** — paste words, then
   IMMEDIATELY (before the debounce fires) dispatch
   `const e = new Event('beforeunload', { cancelable: true });
   window.dispatchEvent(e)` and assert `e.defaultPrevented` is `true`; then
   `waitFor` the draft key to hold the text, dispatch a fresh event, assert
   `defaultPrevented` is `false`.
9. **"beforeunload warns while a Reading paper is running"** — start the
   Academic paper (`reading.test.tsx:79-83` flow), dispatch, assert
   prevented; also assert NOT prevented from the picker before starting.
10. **"a blank exam at zero seconds is returned, not marked"** —
    `vi.useFakeTimers()`; `const user = userEvent.setup({ advanceTimers:
    (ms) => vi.advanceTimersByTime(ms) })`; `renderApp()`; click "Exam",
    click "Start the clock"; advance `40 * 60 * 1000` ms inside
    `act(...)`; assert the "Start the clock" card is back on screen, a
    `role="status"` element matches /blank answer sheet/i, and
    `localStorage.getItem('ielts-coach.v1')` is `null`. Call
    `vi.useRealTimers()` in a `finally`/`afterEach` — `setup.ts`'s
    `restoreAllMocks` does not undo fake timers.
11. **"expiry with words on the page still submits"** — same fake-timer
    setup; paste a PADDING essay first, advance 40 min; the report renders
    (`findByRole('button', { name: 'New essay' })`) and the store key now
    holds exactly one session.

**Verify**: `npx vitest run tests/ui/draft-safety.test.tsx` → 11 passed.

**Mutation check (expiry guard)**: temporarily replace the zero-word branch in
step 7's effect so expiry ALWAYS calls `handleSubmit()`. Run
`npx vitest run tests/ui/draft-safety.test.tsx` → case 10 FAILS (a session
appears in the store / the status notice never renders). Revert with
`git checkout -- src/App.tsx` (steps 3–7 must already be committed), re-run →
pass. Report both.

**Mutation check (unload guard)**: temporarily delete the `e.preventDefault()`
line. Cases 8 and 9 FAIL (`defaultPrevented` stays `false`). Revert, re-run,
report both.

**Mutation check (expiry-restore)**: temporarily make `isExamDraftExpired`
return `false` unconditionally. Case 6 FAILS (the app resumes a dead exam —
"Submit" appears instead of the coach notice). Revert with
`git checkout -- src/profile/draft.ts`, re-run → pass. Report both.

### Step 9: SPEC.md

In the `### profile/ (store.ts + profile.ts)` section (`SPEC.md:229`), add a
short subsection for the draft (do not edit the existing store paragraphs):

- the key `'ielts-coach.draft.v1'`, its exact shape, and that it is scratch
  state: never exported, never imported, never migrated — validation rejects
  wholesale instead
- written debounced (400 ms) from the write view; cleared on successful
  submit, on consented task/module switch, and on explicit discard; an
  UNCLAIMED draft is never cleared at mount
- restore is an offer (card), never silent; an expired exam draft restores
  its TEXT into coach mode with a notice and is never auto-submitted; a live
  exam draft resumes from the absolute deadline
- `beforeunload` warns exactly when: a Reading/Listening paper is running, or
  the write-view text is non-empty and newer than the draft on disk
- task/module switches confirm whenever they would clear a non-empty sheet,
  in any mode; expiry at zero words returns to exam-idle with a notice and
  writes nothing

**Verify**: `grep -c "ielts-coach.draft.v1" SPEC.md` → at least 1.

### Step 10: Full green

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `npx vitest run` → all pass; total is 853 + your new cases (14
engine + 11 in `draft-safety` + 3 consent cases = 28 new; existing counts may
shift only if you split/merged an `it`, which you should not).
**Verify**: `npm run build` → exit 0.
**Verify**: `npx vitest run --project ui` ten consecutive times → identical
results each time.

## Test plan

| File | Cases |
|---|---|
| `tests/draft.test.ts` (new, engine) | the 14 cases of step 2: two round-trips · absent key · non-JSON · non-object · bad `task` / `module` / `mode` · bad or empty `essayText` (2) · bad deadline · throwing storage swallowed · `clearDraft` semantics · the four-way `isExamDraftExpired` truth table — plus the `task`-check mutation run |
| `tests/ui/draft-safety.test.tsx` (new, ui) | the 11 cases of step 8: mint on debounce · cleared on submit · offered-never-silent restore · discard · unclaimed draft survives mount · expired exam → coach + notice + no auto-submit · live exam resumes from absolute deadline · beforeunload stale/clean · beforeunload during a Reading paper · blank expiry returns to idle and saves nothing · non-blank expiry still submits — plus three mutation runs (expiry guard, unload guard, `isExamDraftExpired`) |
| `tests/ui/task-switching.test.tsx` | `:84-97` gains a consenting `confirm` mock + message assertion · new: declined consent keeps the sheet · new: empty sheet asks nothing — plus the consent-condition mutation run |
| `tests/ui/module-switch.test.tsx` | `:75-87` gains a consenting `confirm` mock + message assertion · new: declined consent keeps the sheet |
| `tests/ui/reading.test.tsx` (NOT edited) | `:115-134` must stay green as-is — it pins that switching module from the Reading view neither clears nor confirms |

Model the engine file's structure on `tests/store.test.ts` (stub, `beforeEach`,
helper factory) and the UI file's on `tests/ui/task-switching.test.tsx`
(helpers, paste-not-type, `waitFor`).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc -b --noEmit` exits 0
- [ ] `npx vitest run` exits 0; every case named in the Test plan exists and
      passes; total tests > 853
- [ ] `npm run build` exits 0
- [ ] `npx vitest run --project ui` produces identical results across 10 consecutive runs
- [ ] `grep -rn "beforeunload" src/App.tsx` returns the one new effect
      (it returned nothing anywhere in `src/` at `d4ddef8`)
- [ ] `grep -rn "ielts-coach.draft.v1" src/` returns exactly one file:
      `src/profile/draft.ts`
- [ ] `git status --porcelain -- src/components/` prints nothing — neither
      runner was modified
- [ ] `grep -n "STORAGE_KEY = 'ielts-coach.v1'" src/profile/store.ts` still
      matches and `git status --porcelain -- src/profile/store.ts` prints
      nothing — the store was not touched
- [ ] All five mutation checks (steps 2, 6, and the three in step 8) were run
      and both outcomes (fail with mutation, pass after revert) reported
- [ ] `git status --porcelain -- . ':!plans/'` shows nothing outside the
      in-scope list (NEVER bare `git status --porcelain` — the baseline tree
      carries untracked `plans/*.md`, so the bare form is never clean and
      proves nothing)
- [ ] `grep -c "ielts-coach.draft.v1" SPEC.md` ≥ 1

## STOP conditions

Stop and report back (do not improvise) if:

- Any excerpt in "Current state" does not match the live file (drift since
  `d4ddef8`). If ONLY line numbers shifted but the quoted code is verbatim
  intact, re-anchor by content and continue; report the shift in your summary.
- You find yourself wanting to edit `src/profile/store.ts`, either runner, or
  to add a `schemaVersion` to the draft payload. The draft is scratch state
  by design; report why you think it needs more.
- `tests/ui/reading.test.tsx:115-134` fails after step 6. That means the new
  confirm fires on the Reading-view module switch — the condition is wrong;
  fix the condition (`view === 'write'` guard), never the test. If it still
  fails after that fix, stop.
- Case 5 (unclaimed draft survives) cannot pass without removing the
  zero-word `clearDraft` branch entirely. The fix is the `pendingDraft`
  early-return ORDER inside the effect, not deleting the cleanup; if ordering
  does not solve it, stop and report the effect as written.
- The fake-timer expiry tests (cases 10–11) are flaky across the ten UI runs.
  Do not paper over with retries or longer waits — report which assertion
  flakes and under what timer setup.
- Any test outside the files you edited fails. In particular a
  `tests/store.test.ts` failure means you touched storage behaviour this plan
  promised not to touch.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

For whoever owns this code next:

- **The draft key is scratch, and everything downstream assumes exactly one.**
  If multi-draft (per task, per prompt) is ever wanted, the key becomes a
  prefix and `beforeunload`'s `draftTextRef` comparison, the restore card,
  and the mount-time `loadDraft()` all need rethinking — do not bolt a second
  key on quietly.
- **Plan 016 interaction**: 016's done criterion greps `removeItem` in `src/`
  expecting only its `pruneBackups` site; `clearDraft` is now a second
  legitimate site. 016's backup pruning iterates the `'ielts-coach.backup.'`
  prefix and can never sweep `'ielts-coach.draft.v1'` — keep it that way if
  the pruning is ever generalised.
- **Plan 023 (App split)**: the draft effect, restore card, unload guard and
  expiry guard all live in `App.tsx` today. When the section components are
  extracted, the unload guard must stay wherever BOTH runner stages remain
  visible, or it silently stops guarding one section.
- **Deliberately deferred**: mid-paper resume for Reading/Listening (the
  runners' "a half-finished paper is not a session" doctrine is correct, and
  Listening's play-once audio makes honest resume impossible); pacing samples
  across an exam resume (`pacingRef` restarts empty, so a resumed exam's
  pacing chart has a gap — honest, since nothing was typed while the tab was
  closed); any UI listing the draft key itself.
- **What a reviewer should scrutinise**: that the persistence effect can
  never run while `pendingDraft` is unclaimed (the mount-clobber bug); that
  `restoreDraft` never calls `clearDraft` (the crash-during-restore window);
  that expiry at zero words neither saves nor sets `submittingRef`; and that
  the `beforeunload` handler reads refs, not captured state, so it never
  warns on stale text.
