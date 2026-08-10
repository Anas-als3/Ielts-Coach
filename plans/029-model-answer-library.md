# Plan 029: Model-answer library — browse every worked answer without writing first

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. Do NOT edit `plans/README.md`; the reviewer who
> dispatched you maintains the index.
>
> **Drift check (run first)**:
> `git diff --stat d4ddef8..HEAD -- src/App.tsx src/components/ModelAnswer.tsx src/answers src/prompts src/types.ts SPEC.md tests/ui`
> If any file quoted in "Current state" changed since this plan was written,
> compare the excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition — **except** a drift caused by plan 023 having
> landed, which has its own branch in "Coordination with plan 023" below.
> Every line number in this plan was read off `d4ddef8`.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW — additive UI only; no engine, store, or schema change. The only
  shared surface is `App.tsx`, which plan 023 also touches (see Coordination).
- **Depends on**: none. **Coordinates with** `plans/023-code-split-sections.md`
  (both touch `App.tsx`; never run concurrently — see "Coordination with plan 023").
- **Category**: direction
- **Planned at**: commit `d4ddef8`, 2026-08-10

## Why this matters

The app carries a genuinely good worked-answer system — five hand-written Task 2
essays, three hand-written GT letters, and a generator that composes a correct
Academic Task 1 answer from any chart's own numbers, every one graded live by the
app's own engine so the target is verifiable rather than asserted. But all of it
is reachable from exactly **one** place: the "Model answer" tab inside the write
view's coach panel (`src/App.tsx:1036-1041`), which shows only the answer for the
prompt currently on the desk. A learner who wants to *study* — read three
discussion essays back to back, compare the formal letter against the informal
one, see which prompts have exact answers — has to draw prompts one at a time and
open a tab each time. This plan adds a browsable library view: every prompt
listed and grouped, exact answers badged, each entry rendering the existing
`ModelAnswer` component (scorecard, memorisation warning and all), with a
"Practise this prompt" button that puts that question on the writing desk.

## Current state

Read each cited line before changing anything. Line numbers are from `d4ddef8`.

### The one render site, and why the component is already reusable

`src/App.tsx:1035-1041`, inside the coach panel's tabpanel:

```tsx
                ) : activePanelTab === 'model' ? (
                  <ModelAnswer
                    task={task}
                    prompt={prompt}
                    task1Prompt={task === 'task1' && !isLetter ? task1Prompt : null}
                    letterPrompt={isLetter ? letterPrompt : null}
                  />
```

**Verified: `ModelAnswer` is standalone.** Its props (`src/types.ts:763-775`)
are pure data — no callbacks, no write-view state:

```ts
export interface ModelAnswerProps {
  task: TaskKind;
  /** The active Task 2 prompt, when task is 'task2'. */
  prompt: PromptSpec | null;
  /** The active Task 1 prompt, when task is 'task1' in the Academic module. */
  task1Prompt: Task1PromptSpec | null;
  /** … letterPrompt takes precedence over task1Prompt … */
  letterPrompt?: LetterPromptSpec | null;
}
```

`src/components/ModelAnswer.tsx` (135 lines) resolves the model itself
(`:37-60`), grades it with the real engine itself (`:62-79` — `analyzeEssay` /
`analyzeLetter` / `analyzeTask1`), renders the scorecard (`:105-121`), the
fallback honesty notice when `!model.exact` (`:96-101`), and the memorisation
warning (`:129-132`):

```tsx
      <p className="ma-warning">
        Read it for the method, not the wording. Examiners recognise memorised phrasing and discount
        it, so reuse the structure and write the sentences yourself.
      </p>
```

The warning and scorecard are unconditional parts of the component's render, so
they appear wherever the component renders. **No changes to `ModelAnswer.tsx`
are needed and none are permitted** (out of scope). Note `task1Prompt` is a
*required* prop — pass `null` explicitly where it does not apply.

### Coverage, measured

- **Task 2**: `TASK2_MODELS` (`src/answers/task2Models.ts:24`) holds exactly 5
  hand-written answers keyed `op-01`, `di-01`, `ps-01`, `ad-01`, `dq-01` — one
  per `QuestionType` (`REPRESENTATIVE` map at `:72`). `task2ModelFor(prompt)`
  (`:99`) returns `{ text, sourcePromptId, exact }` — `exact: true` only for
  those five ids, otherwise the same-type representative with `exact: false`.
- **GT letters**: `LETTER_MODELS` (`src/answers/letterModels.ts:91-95`) holds
  exactly 3, keyed by source prompt: `gt-01` (formal), `gt-07` (semi-formal),
  `gt-11` (informal). `letterModelFor(prompt)` (`:105-114`) — exact for those
  three ids, same-tone fallback otherwise.
- **Academic Task 1**: `buildTask1ModelAnswer(prompt)`
  (`src/answers/task1Model.ts:374`) *generates* a correct answer from any
  chart's own numbers — coverage is total, every chart is "exact".
- **Banks**: `PROMPTS` (`src/prompts/bank.ts:38`) has **40** Task 2 prompts;
  `LETTER_PROMPTS` (`src/prompts/letterBank.ts:30`) has **15**;
  `TASK1_PROMPTS` (`src/prompts/task1Bank.ts:35`) has **12** (`t1-01`…`t1-12`).
  Verify yourself: `grep -c "id: '" src/prompts/bank.ts` → 40;
  `grep -c "id: '" src/prompts/letterBank.ts` → 15;
  `grep -c "id: '" src/prompts/task1Bank.ts` → 12.

### The view machinery you are extending

`src/App.tsx:53`:

```ts
type View = 'write' | 'report' | 'dashboard' | 'reading' | 'listening'
```

State at `:105` (`const [view, setView] = useState<View>('write')`). The three
prompt slots at `:110-121` (`prompt` / `task1Prompt` / `letterPrompt`), with the
comment explaining why there are three. Top-level view branches each render one
`<main className="page">`: report `:1056`, dashboard `:1148-1164`.

The topbar nav (`:681-715`) is hidden whenever the desk is cleared, and each
link is a `<button className="nav-link">` with `aria-current`:

```tsx
          {/* `aria-current="page"` rather than `aria-pressed`: these are not
              toggles but navigation, and the class that greys the other three
              is otherwise the only statement of where the learner is. */}
          {!deskCleared && (
            <nav className="nav">
              <button
                className={view === 'write' ? 'nav-link active' : 'nav-link'}
                aria-current={view === 'write' ? 'page' : undefined}
```

**Match this pattern exactly for the new "Models" link** — it is the a11y
pattern a completed a11y plan settled on (the coach-panel tablist at `:999-1023`
is the same plan's work; the library's own entry list should use plain
`<ul>`/`<button aria-expanded>` markup, not a tablist — see step 2).

Exam gating is already structural — `:659-667`:

```ts
  const inExam = mode === 'exam' && view === 'write'
  ...
  const inListeningTest = view === 'listening' && listeningStage === 'running'
  const deskCleared = inExam || inReadingTest || inListeningTest
```

The nav (and with it the Models link) disappears the moment `deskCleared` is
true, so the library is **never reachable under exam conditions** — the same
mechanism that already hides Progress. And `inExam` requires `view === 'write'`,
so being *in* the library can never coincide with a running writing exam. The
coach panel itself is additionally gated by `mode === 'coach'` at `:994`.
SPEC.md:817-818 states the contract: "**Never rendered in exam mode** — handing
a learner a finished answer mid-exam defeats the exercise." The library keeps
that contract via the nav gate; state it in SPEC (step 5).

### The practise machinery

`startNewEssay` — signature at `src/App.tsx:362`, prompt draw at `:369`:

```ts
  function startNewEssay(nextPrompt?: PromptSpec | null) {
    submittingRef.current = false
    examDeadlineRef.current = null
    if (isLetter) setLetterPrompt(randomLetterPrompt())
    else if (task === 'task1') setTask1Prompt(randomTask1Prompt())
    // Draw from the active exam's pool: ...
    else setPrompt(nextPrompt ?? randomPrompt(module))
```

Its `nextPrompt` parameter only targets **Task 2** — letters and charts are
drawn at random. So "practise this prompt" for all three kinds needs a new
handler modeled on `handleRedraft` (`:378-399`), which already shows how to pin
task + module + the exact prompt slot for every kind:

```ts
    if (session.task === 'task1' && session.module === 'general') {
      const letter = LETTER_PROMPTS.find((x) => x.id === session.promptId)
      if (letter) setLetterPrompt(letter)
    } else if (session.task === 'task1') {
      const t1 = TASK1_PROMPTS.find((x) => x.id === session.promptId)
      if (t1) setTask1Prompt(t1)
    } else {
      setPrompt(PROMPTS.find((x) => x.id === session.promptId) ?? null)
    }
```

Module fitting for Task 2: `suitsModule(prompt, module)`
(`src/prompts/bank.ts:564`). Per the comment at `App.tsx:436-440`, 28 of the 40
Task 2 prompts suit both exams and **none is General-only** — so every Task 2
prompt suits Academic, and `setModule('academic')` is always a safe fallback
when the current module does not suit the chosen prompt.

Exam-clock reset when the task changes: `switchTask` does
`setExamSecondsLeft(TASK_CONSTANTS[next].examDurationSec)` (`:415`);
`TASK_CONSTANTS` is imported at `:24`.

### Repo conventions you must match

- **Runtime deps are EXACTLY `react` + `react-dom`.** Never add one.
- Client-side only, `localStorage` only, deterministic engine, no LLM/network.
- Components live in `src/components/` as `Name.tsx` + `Name.css`, imported
  `import './Name.css'` (see `ModelAnswer.tsx:23`). Props interfaces live in
  `src/types.ts` (all 15 existing `*Props` interfaces are there).
- Comments explain WHY — the failure mode prevented. Match `ModelAnswer.tsx`'s
  voice.
- **`IssueCategory` ids are FROZEN; `Criterion` stays four members.** Nothing
  here touches either.
- **Every UI test renders through `renderApp()`** from `tests/ui/renderApp.tsx`
  (pins `op-01`, `t1-01`, `gt-01` and a `FakeSpeechDriver`). `render(<App />)`
  reintroduces a ~3-in-10 flake. `renderApp.tsx` also exports `EXACT_PROMPT`
  (op-01) and `FALLBACK_PROMPT` (op-05) — use them.
- `tsconfig.json` `"include": ["src"]` — `npx tsc -b --noEmit` gates **src/
  only**; tests are not typechecked today (plan 024 fixes that). Write test
  code that would survive 024: no `any`, no missing required fields, no unused
  imports.
- SPEC.md is canonical: behaviour changes land there in the same branch.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck (src/ only) | `npx tsc -b --noEmit` | exit 0, no output |
| Full suite | `npx vitest run` | **853 passed / 24 files** at `d4ddef8`; 861 / 25 after this plan |
| UI project only | `npx vitest run --project ui` | all pass |
| New file only | `npx vitest run tests/ui/model-library.test.tsx` | 8 pass (after step 4) |
| Build | `npm run build` | exit 0 (`tsc -b && vite build`) |
| Scope check | `git status --porcelain -- . ':!plans/'` | only in-scope files |

**UI determinism**: after any UI change, run `npx vitest run --project ui` ten
consecutive times and confirm identical results.

## Coordination with plan 023 (MANDATORY reading)

`plans/023-code-split-sections.md` (TODO at `d4ddef8`) extracts
`ReadingSection`/`ListeningSection` containers out of `App.tsx` and lazy-loads
them. Both plans modify `App.tsx`. **They must not run concurrently.** Two legal
sequences:

- **029 first (App.tsx as quoted here)**: build exactly as this plan says. The
  library lives in its own component file (`src/components/ModelLibrary.tsx`),
  so only ~15 lines land in `App.tsx` (one `View` member, one nav button, one
  view branch, one handler). Whichever of 023 lands second rebases over those
  lines; 023 may then choose to lazy-load `ModelLibrary` alongside its sections
  — that is 023's call, not yours.
- **023 first (drift check flags App.tsx)**: do NOT stop for this drift alone.
  Re-locate the nav, the `View` union, `deskCleared`, and the view branches in
  the post-023 `App.tsx` (023 keeps all of them in `App.tsx`; only the Reading/
  Listening subtrees move out). Then follow 023's landed container pattern for
  the library view branch: make `ModelLibrary` a `React.lazy` import wrapped in
  the same `Suspense` fallback 023 used for its sections, and keep the nav
  button eager. Everything else in this plan is unchanged. If you cannot find
  the nav or the `View` union in the post-023 `App.tsx`, THAT is a STOP.

## Scope

**In scope** (the only files you may create/modify):

- `src/App.tsx` — `View` member `'library'`, nav button, view branch, practise handler
- `src/components/ModelLibrary.tsx` (create)
- `src/components/ModelLibrary.css` (create)
- `src/types.ts` — `ModelLibraryProps` + `LibrarySelection` only
- `tests/ui/model-library.test.tsx` (create)
- `SPEC.md` — the "Worked answers (`answers/`)" section (`:815`)

**Out of scope** (do NOT touch, even though they look related):

- `src/components/ModelAnswer.tsx` / `ModelAnswer.css` — verified standalone;
  reused as-is. Forking or "improving" it here is exactly the drift this plan
  exists to avoid. (Step 4's mutation M3 temporarily edits it and **fully
  reverts** via `git checkout` — the file must end the branch byte-identical.)
- `src/answers/**`, `src/prompts/**` — the data and the exact/fallback rules
  stay where they are; the library *reads* them.
- `src/profile/store.ts`, `SCHEMA_VERSION`, anything stored — the library
  writes nothing.
- `src/analysis/**` — no engine change.
- `tests/ui/renderApp.tsx`, `tests/ui/model-answer.test.tsx` — the existing
  coverage of the coach-panel tab stays exactly as it is.
- `package.json` — no new dependency, no script change.
- `plans/README.md` — the reviewer owns the index.

## Git workflow

- Branch: `advisor/029-model-answer-library`, off the current default branch.
- Commit per step; message style matches `git log`: a plain imperative sentence,
  e.g. `Add a browsable library of the worked answers`.
- Do NOT push and do NOT open a PR.
- **Commit the completed implementation BEFORE running step 4's mutation
  checks**, so each mutation can be reverted with a clean
  `git checkout -- <file>`.

## Steps

### Step 1: The `'library'` view and the "Models" nav link

In `src/App.tsx`:

1. Extend the union at `:53`:
   `type View = 'write' | 'report' | 'dashboard' | 'reading' | 'listening' | 'library'`
2. Add a nav button between "Listening" and "Progress" inside the existing
   `<nav className="nav">` (`:682-714`), copying the Progress button
   (`:707-713`) exactly — className ternary, `aria-current`, label `Models`,
   `onClick={() => setView('library')}`. Because the whole nav sits inside
   `{!deskCleared && (` (`:681`), the link inherits the exam gating — add no
   extra condition.
3. Add the view branch after the dashboard branch (`:1148-1164`), matching its
   shape:

```tsx
      {view === 'library' && (
        <main className="page">
          <ModelLibrary onPractise={handlePractiseFromLibrary} />
        </main>
      )}
```

(`handlePractiseFromLibrary` arrives in step 3; to keep the tree compiling you
may add it in the same commit as this step — steps 1–3 can be one commit.)

**Verify** (after step 3): `npx tsc -b --noEmit` → exit 0.
**Verify**: `grep -n "'library'" src/App.tsx` → at least the `View` union line
and the two view/nav usages.

### Step 2: The `ModelLibrary` component

Create `src/components/ModelLibrary.tsx` + `ModelLibrary.css`. Add to
`src/types.ts` (beside the other `*Props` interfaces, e.g. after
`ModelAnswerProps` at `:763-776`):

```ts
/** What the learner picked in the library, carried to the writing desk. */
export type LibrarySelection =
  | { kind: 'task2'; prompt: PromptSpec }
  | { kind: 'chart'; prompt: Task1PromptSpec }
  | { kind: 'letter'; prompt: LetterPromptSpec };

export interface ModelLibraryProps {
  /** Put this question on the writing desk and switch to the write view. */
  onPractise: (selection: LibrarySelection) => void;
}
```

Component requirements (signature only — you write the body):

```ts
export default function ModelLibrary({ onPractise }: ModelLibraryProps)
```

- **Three groups**, each a heading + `<ul>` of entries, in this order:
  1. **Task 2 essays** — all of `PROMPTS` (40). Entry shows id, `type`,
     `topic`, and the prompt `text`.
  2. **General Training letters** — all of `LETTER_PROMPTS` (15). Entry shows
     id, `tone`, `recipient`, and `text`.
  3. **Academic Task 1** — all of `TASK1_PROMPTS` (12). Entry shows id and
     `chart.title`.
- **Exact badge**: compute from the SAME functions the panel uses — never
  duplicate the rule:
  - Task 2: `task2ModelFor(p)?.exact === true` → badge "Worked answer for this
    exact question"; otherwise "Type example — a worked answer to a different
    <type> question". Exactly 5 entries badge exact (`op-01`, `di-01`, `ps-01`,
    `ad-01`, `dq-01`).
  - Letters: `letterModelFor(p)?.exact === true` — exactly `gt-01`, `gt-07`,
    `gt-11`.
  - Task 1: every entry is generated from its own chart — one shared badge
    "Generated from this chart's own numbers" on all 12.
- **Selection**: local `useState<string | null>` of the selected entry id
  (one open at a time is enough). Each entry header is a
  `<button aria-expanded={open} aria-controls={panelDomId}>`; when open, render
  the existing component underneath, inside a `<div id={panelDomId}>`:
  - Task 2: `<ModelAnswer task="task2" prompt={p} task1Prompt={null} />`
  - Letter: `<ModelAnswer task="task1" prompt={null} task1Prompt={null} letterPrompt={p} />`
  - Chart:  `<ModelAnswer task="task1" prompt={null} task1Prompt={p} />`
  (`task1Prompt` is required in `ModelAnswerProps` — pass `null` explicitly.)
  The memorisation warning (`ModelAnswer.tsx:129-132`) and scorecard render
  automatically because they are unconditional in the component.
- **Practise button** per entry: label `Practise this prompt`, calls
  `onPractise` with the entry's `LibrarySelection`.
- Do NOT use `role="tablist"` for the groups or entries — the roving-tabindex
  tablist at `App.tsx:999-1023` labels a single tabpanel; an accordion of 67
  entries is list + disclosure-button territory (`aria-expanded`).
- Grading 67 answers eagerly on mount would run the engine 67 times for
  nothing; only the OPEN entry may render `ModelAnswer` (which is where grading
  happens, in its own `useMemo`). The closed list renders data already in
  memory.
- Header comment in the repo's voice: what the library is for, why it reuses
  `ModelAnswer` rather than forking it, why only the open entry grades.
- CSS: new classes prefixed `mlib-`, in `ModelLibrary.css`, following the plain
  class-based style of `ModelAnswer.css`. Reuse existing global classes
  (`page`, `eyebrow`) where they fit.

**Verify**: `npx tsc -b --noEmit` → exit 0.

### Step 3: The practise handler

In `src/App.tsx`, next to `handleRedraft` (`:378-399`), add (target shape —
adapt names to what exists):

```ts
  function handlePractiseFromLibrary(sel: LibrarySelection) {
    submittingRef.current = false
    examDeadlineRef.current = null
    if (sel.kind === 'letter') {
      // Letters exist only in General Training; the desk must show that exam.
      setTask('task1')
      setModule('general')
      setLetterPrompt(sel.prompt)
    } else if (sel.kind === 'chart') {
      setTask('task1')
      setModule('academic')
      setTask1Prompt(sel.prompt)
    } else {
      setTask('task2')
      // None of the 40 is General-only (bank.ts tagging rule), so Academic is
      // always a safe home for a prompt the current exam does not ask.
      if (!suitsModule(sel.prompt, module)) setModule('academic')
      setPrompt(sel.prompt)
    }
    setEssayText('')
    setFocusIssueId(null)
    setExamState('idle')
    setExamSecondsLeft(TASK_CONSTANTS[sel.kind === 'task2' ? 'task2' : 'task1'].examDurationSec)
    setMode('coach')
    setView('write')
  }
```

Why not `startNewEssay(prompt)`: its `nextPrompt` only reaches the Task 2 slot
(`:369`); letters and charts are re-randomised (`:365-366`). Why not
`handleRedraft`: it restores a session's essay text; practise starts blank.
Read `TASK_CONSTANTS[sel.kind …]` rather than the `taskConstants` const
(`:151`) — that is derived from the *current* `task` state, which the `setTask`
above has not committed yet (same reason `switchTask` uses
`TASK_CONSTANTS[next]` at `:415`).

**Verify**: `npx tsc -b --noEmit` → exit 0. `npx vitest run` → 853 pass (no
regressions before the new tests land).

### Step 4: UI tests, then the mutation checks

Create `tests/ui/model-library.test.tsx`. Model the file on
`tests/ui/model-answer.test.tsx` (header comment, `renderApp()` import,
`userEvent.setup()` per test). Import `EXACT_PROMPT`, `FALLBACK_PROMPT`,
`renderApp` from `./renderApp`; import `PROMPTS`, `LETTER_PROMPTS`,
`TASK1_PROMPTS` from the banks. **Exactly 8 `it` cases:**

1. **nav opens the library** — click the `Models` nav button, assert the
   library heading is on screen and `Models` has `aria-current="page"`.
2. **groups carry the full banks** — the three group lists have 40, 15 and 12
   entries; pin both directions:
   `expect(PROMPTS).toHaveLength(40)`, `expect(LETTER_PROMPTS).toHaveLength(15)`,
   `expect(TASK1_PROMPTS).toHaveLength(12)`, and each rendered list's item
   count equals its bank's `.length`.
3. **exact badges, Task 2** — exactly 5 entries in the Task 2 group carry the
   exact badge, and they are `op-01`, `di-01`, `ps-01`, `ad-01`, `dq-01`.
4. **exact badges, letters** — exactly `gt-01`, `gt-07`, `gt-11` in the letters
   group; all 12 Task 1 entries carry the generated badge.
5. **selecting shows the engine's scorecard** — open `op-01`, assert
   `/scored by this app.s own engine/i` (curly apostrophe — match around it,
   as `model-answer.test.tsx:52` does).
6. **memorisation warning stays visible** — with an entry open, assert
   `/Read it for the method, not the wording/i`.
7. **practise lands on the desk** — open `FALLBACK_PROMPT`'s entry (`op-05`),
   click `Practise this prompt`, assert the `Write` nav button has
   `aria-current="page"` and a distinctive substring of
   `FALLBACK_PROMPT.text` is on screen (use a substring — the full text may be
   split across markup).
8. **not reachable under exam conditions** — from the write view click the
   `Exam` mode button (copy the `modeButton` helper from
   `model-answer.test.tsx:19-21`), then
   `expect(screen.queryByRole('button', { name: 'Models' })).not.toBeInTheDocument()`
   (the whole nav is gone — `App.tsx:681`).

**Verify**: `npx vitest run tests/ui/model-library.test.tsx` → 8 pass.
**Verify**: `npx vitest run` → 861 pass / 25 files.
**Now commit**, then run the three mutation checks — each proves a test has
teeth, each is fully reverted before the next:

- **M1 (badge rule)**: in `src/components/ModelLibrary.tsx`, force the Task 2
  exact computation to `true` for every entry. `npx vitest run
  tests/ui/model-library.test.tsx` → case 3 **fails** (40 exact badges, not 5).
  Revert: `git checkout -- src/components/ModelLibrary.tsx`. Re-run → 8 pass.
- **M2 (exam gate)**: in `src/App.tsx`, move ONLY the Models `<button>` outside
  the `{!deskCleared && (` guard (render it unconditionally in the topbar).
  → case 8 **fails** (the button is findable in exam mode). Revert:
  `git checkout -- src/App.tsx`. Re-run → 8 pass.
- **M3 (warning pinned)**: delete the `ma-warning` paragraph
  (`src/components/ModelAnswer.tsx:129-132`). → case 6 **fails**, AND the
  existing `tests/ui/model-answer.test.tsx:95` fails — report both. Revert:
  `git checkout -- src/components/ModelAnswer.tsx`. Re-run
  `npx vitest run --project ui` → all pass.

Report all six observations (3 × fail, 3 × pass-after-revert).

### Step 5: SPEC.md

In the "Worked answers (`answers/`)" section (`SPEC.md:815`), after the
existing coach-panel paragraphs, add a short block:

- A `Models` library view lists all three banks grouped (40 Task 2 / 15
  letters / 12 charts), badges the 5 exact Task 2 answers and 3 exact letters,
  and marks every Task 1 answer as generated from its chart.
- Each entry renders the SAME `ModelAnswer` component the coach panel uses —
  engine-graded scorecard, fallback honesty notice, memorisation warning — so
  the library can never drift from the panel.
- "Practise this prompt" pins task, exam module and prompt on the writing desk
  in coach mode with a blank answer sheet.
- The library link lives in the nav, which the cleared desk removes, so the
  exam-mode contract ("never rendered in exam mode") holds unchanged.
- Only the open entry is graded — the engine never runs 67 times on view load.

**Verify**: `grep -n "Models" SPEC.md | head` → at least one hit in the worked-
answers section.

### Step 6: Full green

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `npm run build` → exit 0.
**Verify**: `npx vitest run` → 861 passed / 25 files.
**Verify**: `npx vitest run --project ui` ten consecutive times → identical
results each time.
**Verify scope**: `git status --porcelain -- . ':!plans/'` → only the six
in-scope files (never use a bare `git status --porcelain`; the baseline tree
carries untracked `plans/*.md`).

## Test plan

| File | Cases |
|---|---|
| `tests/ui/model-library.test.tsx` (new) | the 8 cases in step 4: nav opens library · bank counts 40/15/12 · exact badges = the 5 Task 2 ids · exact badges = the 3 letter ids + 12 generated · scorecard renders on selection · memorisation warning visible · practise lands `op-05` on the write desk · Models absent in exam mode |
| Engine (`tests/*.test.ts`) | **No new engine tests — deliberately.** Nothing in the engine changed; the models' engine-side guarantees are already pinned by `tests/model-answers.test.ts` (all answers ≥ 8.0, every structure check), which this plan reuses through the component untouched. |

Structural pattern: `tests/ui/model-answer.test.tsx`. Every render through
`renderApp()`. Mutation checks M1–M3 are part of the test work, not optional.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc -b --noEmit` exits 0 (gates `src/` only — tests are not
      typechecked until plan 024)
- [ ] `npx vitest run` exits 0: **861 passed / 25 files** (853 at `d4ddef8`
      + 8 new; if another plan landed after `d4ddef8` the base may differ —
      then require: zero failures, and exactly 8 tests in
      `tests/ui/model-library.test.tsx` all passing)
- [ ] `npm run build` exits 0
- [ ] `npx vitest run --project ui` — identical results across 10 consecutive runs
- [ ] `grep -c "'library'" src/App.tsx` ≥ 3 (View union, nav onClick, view branch)
- [ ] `git diff --stat HEAD -- src/components/ModelAnswer.tsx` prints nothing,
      and `git log --oneline -- src/components/ModelAnswer.tsx` shows no commit
      from this branch — the component was reused, not forked (M3's edit fully
      reverted)
- [ ] `grep -n "task2ModelFor\|letterModelFor" src/components/ModelLibrary.tsx`
      → both present (badges derive from the shared rule, not a re-implementation)
- [ ] `grep -rn "render(<App" tests/ui/model-library.test.tsx` → no matches
      (exit 1 from grep here IS the success signal — it means every render
      goes through `renderApp()`)
- [ ] All three mutation checks run and reported (fail under mutation, pass
      after revert)
- [ ] `git status --porcelain -- . ':!plans/'` lists only the six in-scope files
- [ ] SPEC.md's worked-answers section documents the library

## STOP conditions

Stop and report back (do not improvise) if:

- Any excerpt in "Current state" mismatches the live file — **except** an
  `App.tsx` drift explained by plan 023 having landed; that case follows the
  "023 first" branch in "Coordination with plan 023" and continues.
- Plan 023 is IN PROGRESS on another branch at the time you start (check
  `plans/README.md` status column). Not concurrent means not concurrent —
  report and wait for the operator's ordering decision.
- `ModelAnswer` turns out to need a prop or context change to render in the
  library after all (e.g. something in it reads write-view state this plan's
  recon missed). Do not patch the component — report exactly what it needs;
  amending `ModelAnswer.tsx` requires a scope decision plus a mutation check
  that the write-view usage still passes `tests/ui/model-answer.test.tsx`.
- Rendering the library grades all 67 answers on open (visible as a
  multi-second mount in the UI tests): the only-open-entry-grades requirement
  is being violated; fix the accordion, and if you cannot, report.
- Case 7 cannot find `op-05`'s text on the desk because the module toggled
  unexpectedly — the `suitsModule` fallback logic in step 3 is wrong for some
  prompt; report which prompt and both module values, do not special-case it.
- Any test outside `tests/ui/model-library.test.tsx` fails at any point (M3's
  deliberate, reverted `model-answer.test.tsx` failure excepted).

## Maintenance notes

For whoever owns this code next:

- **The library's honesty is inherited, not implemented.** Badges call
  `task2ModelFor` / `letterModelFor`; the rendered answer, scorecard, fallback
  notice and memorisation warning are `ModelAnswer`'s own. If a sixth Task 2
  model is added to `TASK2_MODELS`, the library badge count changes by itself —
  and test case 3's literal five-id list will fail, which is intended: update
  the list consciously.
- **Bank-size pins.** Case 2 pins 40/15/12. Authoring new prompts breaks it by
  design — the number in the test is the number the SPEC and the UI advertise.
- **Only the open entry grades.** If someone adds "expand all", the 67 engine
  runs come back; profile first.
- **Plan 023 interaction**: whichever lands second rebases `App.tsx`. After 023,
  `ModelLibrary` is a natural candidate for the same `React.lazy` treatment as
  the sections — deferred to 023's owner, not done here.
- **Deferred deliberately**: search/filter within the library; per-entry deep
  links; showing the learner's own past band next to a prompt they practised
  (needs store reads — keep the library store-free until someone asks); a badge
  distinguishing the two letter fallback tiers. All are additive.
- **What a reviewer should scrutinise**: that `ModelAnswer.tsx` has zero diff;
  that the Models button sits INSIDE the `!deskCleared` guard; that
  `handlePractiseFromLibrary` resets the exam clock with `TASK_CONSTANTS[...]`
  keyed off the selection, not off stale `task` state; and that the letters
  branch sets `module` to `'general'` before the desk shows.
