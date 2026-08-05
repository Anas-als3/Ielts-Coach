# Plan 005: Wire Task 1 into the app — task switcher, 20-minute exam clock, chart panel, rail and report

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: this repository is **not under version control**
> at the time of writing. Confirm the excerpts in "Current state" appear
> verbatim, and confirm plans 001, 003 and 004 have landed:
> - `grep -n "SCHEMA_VERSION = 2" src/profile/store.ts` → one match
> - `grep -n "export function analyzeTask1" src/analysis/engine.ts` → one match
> - `grep -n "criterionLabel" src/meta.ts` → one match
>
> If any check fails, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — touches the app shell, which every view depends on
- **Depends on**: `plans/004-task1-analysis-rules.md` (which depends on 003 → 001)
- **Category**: direction
- **Planned at**: no VCS — written 2026-08-05 against the working tree as read on that date

## Why this matters

After plan 004 the Task 1 engine is complete and tested, but unreachable — no
learner can open it. This plan makes it usable: a task switcher, the correct
exam constants (20 minutes, 150 words instead of 40 minutes, 250 words), the
chart on screen beside the answer sheet, and a report that says "Task
Achievement" where Task 1 is being marked.

It is the last plan in the Task 1 sequence. When it lands, Task 1 is shipped.

## Current state

### App state and the analysis call — `src/App.tsx:36-61`

```ts
export default function App() {
  const [view, setView] = useState<View>('write')
  const [mode, setMode] = useState<WritingMode>('coach')
  const [prompt, setPrompt] = useState<PromptSpec | null>(() => randomPrompt())
  const [essayText, setEssayText] = useState('')
  const [sessions, setSessions] = useState<SessionRecord[]>(() => loadSessions())
  const [reportSessionId, setReportSessionId] = useState<string | null>(null)
  const [focusIssueId, setFocusIssueId] = useState<string | null>(null)
  const [examState, setExamState] = useState<ExamState>('idle')
  const [examSecondsLeft, setExamSecondsLeft] = useState(EXAM_DURATION_SEC)
  const [panelTab, setPanelTab] = useState<'feedback' | 'cheatsheet'>('feedback')
  // ... refs ...

  const debouncedText = useDebounced(essayText, 400)
  const analysis = useMemo(
    () => (mode === 'coach' ? analyzeEssay(debouncedText, prompt) : null),
    [debouncedText, prompt, mode],
  )
```

### The exam timer's constant — `src/App.tsx:69-91` (excerpt)

```ts
  useEffect(() => {
    if (examState !== 'running') return
    const tick = () => {
      const deadline = examDeadlineRef.current
      if (deadline == null) return
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000))
      const elapsed = EXAM_DURATION_SEC - left
```

`EXAM_DURATION_SEC` appears **9 times** in `src/App.tsx` and once in
`src/meta.ts`. It is currently a module constant, not state.

### The constants — `src/meta.ts` (last three lines)

```ts
export const EXAM_DURATION_SEC = 40 * 60
export const MIN_WORDS = 250
export const TARGET_WORDS = 280
```

### The session record construction — `src/App.tsx:147-160`

```ts
    const finalAnalysis = analyzeEssay(essayText, prompt)
    const record: SessionRecord = {
      id: makeId(),
      dateISO: new Date().toISOString(),
      mode,
      task: 'task2',
      promptId: prompt?.id ?? null,
      promptText: prompt?.text ?? '',
      questionType: prompt?.type ?? null,
      essayText,
      durationSec: mode === 'exam' ? secondsUsed : null,
      pacing: mode === 'exam' && pacingRef.current.length ? [...pacingRef.current] : null,
      pasteAttempts: mode === 'exam' ? pasteAttemptsRef.current : null,
      analysis: finalAnalysis,
    }
```

(`task: 'task2'` was added by plan 001.)

### The mode toggle in the topbar — `src/App.tsx:283-296`

```tsx
            <div className="mode-toggle" role="group" aria-label="Writing mode">
              <button
                className={mode === 'coach' ? 'mode-btn active' : 'mode-btn'}
                onClick={() => switchMode('coach')}
              >
                Coach
              </button>
              <button
                className={mode === 'exam' ? 'mode-btn active' : 'mode-btn'}
                onClick={() => switchMode('exam')}
              >
                Exam
              </button>
            </div>
```

This is the visual pattern the task switcher must match.

### The sheet zone, where the chart goes — `src/App.tsx:323-332`

```tsx
          <section className="sheet-zone">
            {!inExam && (
              <PromptPicker prompts={PROMPTS} current={prompt} onPick={(p) => setPrompt(p)} />
            )}
            {inExam && prompt && (
              <div className="exam-prompt card">
                <p className="eyebrow">Task 2 · write at least 250 words</p>
                <p className="exam-prompt-text">{prompt.text}</p>
              </div>
            )}
```

Note the hard-coded `Task 2 · write at least 250 words` eyebrow at line 329 —
it must become task-aware.

### The exam start card — `src/App.tsx:334-353` (excerpt)

```tsx
              <div className="exam-start card">
                <h2>Exam conditions</h2>
                <p>
                  40 minutes, no feedback, no highlights. The full report appears when you submit —
                  exactly like the real thing.
                </p>
```

Another hard-coded `40 minutes`.

### The structure rail's props — `src/types.ts:256-261`

```ts
export interface StructureRailProps {
  checks: StructureCheck[];
  paragraphs: ParagraphInfo[];
  /** Question type of the active prompt, to label expected parts. */
  questionType: QuestionType | null;
}
```

`StructureRail` groups checks by id prefix — `src/components/StructureRail.tsx:26-30`:

```ts
function groupOf(check: StructureCheck): GroupKey {
  if (check.id.startsWith('intro') || check.id === 'position-stated') return 'intro'
  if (check.id.startsWith('conclusion')) return 'conclusion'
  return 'body'
}
```

Task 1 check ids (`t1-paraphrase`, `t1-overview`, `t1-detail-1`, …) all fall
through to `'body'` today. That is the one behaviour you must fix in the rail.

### Repo conventions you must match

- **TypeScript strict**, no `any`, no new dependencies.
- **Props interfaces live in `src/types.ts`**, not in component files.
- **Co-located CSS** — `import './Chart.css'` next to `Chart.tsx`.
- **Design tokens from `src/index.css`**, specified in `DESIGN.md:23-45`. Never
  hard-code hex. `--marking-red` is errors only (`DESIGN.md:9`).
- **The exam-mode transition** is a stated signature moment (`DESIGN.md:19-21`):
  "switching to Exam Mode slides every panel away and drops the chrome to
  near-monochrome navy … One orchestrated transition (~400ms), disabled under
  `prefers-reduced-motion`." Do not break it, and do not add a second competing
  transition for the task switch.
- **Copy voice** (`DESIGN.md:47-48`): plain verbs, sentence case, specific,
  never scolding.
- **Layout** (`DESIGN.md:42-44`): Coach Mode is three zones — rail 220px, sheet
  max 68ch, panel 320px; responsive to ~900px where panels stack.
- **SPEC.md is canonical** — step 8 records the UI behaviour.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc -b --noEmit`    | exit 0, no output   |
| Tests     | `npx vitest run`         | all files pass      |
| Build     | `npm run build`          | exit 0              |
| Dev       | `npm run dev`            | serves on :5173     |

## Scope

**In scope**:

- `src/meta.ts` (modify — task-keyed exam constants)
- `src/types.ts` (modify — `StructureRailProps` gains `task`; add `ActivePrompt` union)
- `src/App.tsx` (modify — task state, routing, constants, chart panel)
- `src/components/StructureRail.tsx` (modify — group Task 1 check ids)
- `src/components/PromptPicker.tsx` (modify — accept Task 1 prompts)
- `src/components/Report.tsx` (modify — task-aware criterion labels and copy)
- `src/components/Dashboard.tsx` (modify — a task column and filter)
- `src/App.css` / component CSS as needed
- `SPEC.md` (modify — extend the Task 1 section with UI behaviour)

**Out of scope** (do NOT touch):

- `src/analysis/**` — the engine is finished. If a UI need seems to require an
  analysis change, that is a STOP condition.
- `src/profile/store.ts` and `src/profile/profile.ts` — no persistence or
  profile changes. Task-scoping the error profile is a deliberate follow-up
  (see Maintenance notes).
- `src/prompts/bank.ts` and `src/prompts/task1Bank.ts` — content is final.
- `src/components/CheatSheet.tsx` — it is a Task 2 cheat sheet. Hide it in Task 1
  rather than writing Task 1 content; a Task 1 cheat sheet is separate work.
- `src/components/Editor.tsx` — the editor is task-agnostic.

## Git workflow

- Branch: `advisor/005-task1-ui`
- One commit per step; plain imperative subjects.
- Do NOT push and do NOT open a PR.

## Steps

### Step 1: Make the exam constants task-keyed

In `src/meta.ts`, replace the three trailing constants:

```ts
export const EXAM_DURATION_SEC = 40 * 60
export const MIN_WORDS = 250
export const TARGET_WORDS = 280
```

with:

```ts
/**
 * Per-task exam constants. Task 2 keeps the original values so existing
 * behaviour is unchanged; Task 1 is 20 minutes and 150 words.
 */
export const TASK_CONSTANTS: Record<TaskKind, {
  examDurationSec: number
  minWords: number
  targetWords: number
  /** Learner-facing task name, e.g. for the exam eyebrow. */
  label: string
}> = {
  task2: { examDurationSec: 40 * 60, minWords: 250, targetWords: 280, label: 'Task 2' },
  task1: { examDurationSec: 20 * 60, minWords: 150, targetWords: 190, label: 'Task 1' },
}

/** Task 2 defaults, kept as named exports so existing call sites are unchanged. */
export const EXAM_DURATION_SEC = TASK_CONSTANTS.task2.examDurationSec
export const MIN_WORDS = TASK_CONSTANTS.task2.minWords
export const TARGET_WORDS = TASK_CONSTANTS.task2.targetWords
```

Keeping the three old exports means nothing else breaks in this step.

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `npx vitest run` → all pass.

### Step 2: Add the active-prompt union and task-aware rail props

In `src/types.ts`, below `Task1PromptSpec` (added by plan 003), add:

```ts
/**
 * The prompt currently loaded in the writing view. A discriminated union: Task 2
 * prompts carry a `type`, Task 1 prompts carry `task: 'task1'` and a chart.
 */
export type ActivePrompt =
  | { task: 'task2'; spec: PromptSpec }
  | { task: 'task1'; spec: Task1PromptSpec };
```

Then extend `StructureRailProps` (`src/types.ts:256-261`) with a task field:

```ts
export interface StructureRailProps {
  checks: StructureCheck[];
  paragraphs: ParagraphInfo[];
  /** Question type of the active prompt, to label expected parts. Null for Task 1. */
  questionType: QuestionType | null;
  /** Which task the rail is describing. Defaults to 'task2' when omitted. */
  task?: TaskKind;
}
```

Making `task` optional means `StructureRail`'s existing call site keeps
compiling untouched until step 5.

**Verify**: `npx tsc -b --noEmit` → exit 0.

### Step 3: Add task state and analysis routing to App

In `src/App.tsx`:

**3a.** Add task state beside the mode state (`src/App.tsx:37`):

```ts
  const [task, setTask] = useState<TaskKind>('task2')
  const [task1Prompt, setTask1Prompt] = useState<Task1PromptSpec>(() => randomTask1Prompt())
```

Keep the existing `prompt` state for Task 2 exactly as it is. Two separate
state slots — rather than one union — means switching tasks preserves each
task's chosen prompt, which is what a learner expects.

**3b.** Derive the active constants:

```ts
  const taskConstants = TASK_CONSTANTS[task]
```

**3c.** Route the analysis (`src/App.tsx:55-58`):

```ts
  const analysis = useMemo(() => {
    if (mode !== 'coach') return null
    return task === 'task1'
      ? analyzeTask1(debouncedText, task1Prompt)
      : analyzeEssay(debouncedText, prompt)
  }, [debouncedText, prompt, task1Prompt, mode, task])
```

**3d.** Replace every use of `EXAM_DURATION_SEC` in `src/App.tsx` with
`taskConstants.examDurationSec`, and every `MIN_WORDS` with
`taskConstants.minWords`. There are 9 and 1 respectively — find them with:

```bash
grep -n "EXAM_DURATION_SEC\|MIN_WORDS" src/App.tsx
```

**Careful with `useState(EXAM_DURATION_SEC)`** at `src/App.tsx:44`: the initial
value is fine, but `examSecondsLeft` must **reset when the task changes**, or a
learner switching to Task 1 mid-session sees a 40:00 clock. Add:

```ts
  // Switching task resets the clock to that task's duration. Guarded on
  // examState so a running exam is never silently re-timed — switchTask
  // refuses to switch while the clock runs (step 4).
  useEffect(() => {
    if (examState === 'idle') setExamSecondsLeft(taskConstants.examDurationSec)
  }, [taskConstants.examDurationSec, examState])
```

**3e.** In `submitInner` (`src/App.tsx:147-160`), make the record task-aware:

```ts
    const finalAnalysis =
      task === 'task1' ? analyzeTask1(essayText, task1Prompt) : analyzeEssay(essayText, prompt)
    const activeSpec = task === 'task1' ? task1Prompt : prompt
    const record: SessionRecord = {
      id: makeId(),
      dateISO: new Date().toISOString(),
      mode,
      task,
      promptId: activeSpec?.id ?? null,
      promptText: activeSpec?.text ?? '',
      questionType: task === 'task1' ? null : prompt?.type ?? null,
      essayText,
      // ... rest unchanged
    }
```

**Verify**: `npx tsc -b --noEmit` → exit 0.

### Step 4: Add the task switcher to the topbar

Add a `switchTask` function beside `switchMode` (`src/App.tsx:196-210`), modelled
on it exactly — including the running-exam confirmation:

```ts
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
    setEssayText('')
    setExamState('idle')
    setExamSecondsLeft(TASK_CONSTANTS[next].examDurationSec)
    setFocusIssueId(null)
  }
```

Note it clears `essayText` — a Task 2 essay in a Task 1 answer sheet is
meaningless, and silently carrying it over would produce nonsense feedback.

Render the switcher in the topbar, **before** the existing mode toggle at
`src/App.tsx:283`, matching its markup pattern:

```tsx
            <div className="task-toggle" role="group" aria-label="IELTS task">
              <button
                className={task === 'task1' ? 'mode-btn active' : 'mode-btn'}
                onClick={() => switchTask('task1')}
              >
                Task 1
              </button>
              <button
                className={task === 'task2' ? 'mode-btn active' : 'mode-btn'}
                onClick={() => switchTask('task2')}
              >
                Task 2
              </button>
            </div>
```

Add a `.task-toggle` rule in `src/App.css` reusing the `.mode-toggle` styles —
find `.mode-toggle` there and either extend the selector list or duplicate the
block with a comment. Prefer extending the selector.

Also update `startNewEssay` (`src/App.tsx:173-183`) so it picks a fresh prompt
for the **current** task rather than always a Task 2 one:

```ts
  function startNewEssay(nextPrompt?: PromptSpec | null) {
    submittingRef.current = false
    examDeadlineRef.current = null
    if (task === 'task1') setTask1Prompt(randomTask1Prompt())
    else setPrompt(nextPrompt ?? randomPrompt())
    setEssayText('')
    setFocusIssueId(null)
    setExamState('idle')
    setExamSecondsLeft(taskConstants.examDurationSec)
    setMode('coach')
    setView('write')
  }
```

And `handleRedraft` (`src/App.tsx:185-194`) must restore the session's task:

```ts
  function handleRedraft(session: SessionRecord) {
    submittingRef.current = false
    examDeadlineRef.current = null
    setTask(session.task)
    if (session.task === 'task1') {
      const t1 = TASK1_PROMPTS.find((x) => x.id === session.promptId)
      if (t1) setTask1Prompt(t1)
    } else {
      setPrompt(PROMPTS.find((x) => x.id === session.promptId) ?? null)
    }
    setEssayText(session.essayText)
    setMode('coach')
    setExamState('idle')
    setView('write')
  }
```

**Verify**: `npx tsc -b --noEmit` → exit 0.

### Step 5: Render the chart and fix the task-specific copy

**5a.** In the sheet zone (`src/App.tsx:323-332`), branch on task. Task 1 shows
the chart above the answer sheet in both modes — the chart *is* the question,
so exam mode must show it too:

```tsx
          <section className="sheet-zone">
            {task === 'task1' ? (
              <>
                {!inExam && (
                  <Task1PromptPicker
                    prompts={TASK1_PROMPTS}
                    current={task1Prompt}
                    onPick={setTask1Prompt}
                  />
                )}
                <div className="task1-prompt card">
                  <p className="eyebrow">
                    Task 1 · write at least {taskConstants.minWords} words
                  </p>
                  <p className="exam-prompt-text">{task1Prompt.text}</p>
                  <Chart chart={task1Prompt.chart} />
                </div>
              </>
            ) : (
              <>
                {!inExam && (
                  <PromptPicker prompts={PROMPTS} current={prompt} onPick={(p) => setPrompt(p)} />
                )}
                {inExam && prompt && (
                  <div className="exam-prompt card">
                    <p className="eyebrow">
                      Task 2 · write at least {taskConstants.minWords} words
                    </p>
                    <p className="exam-prompt-text">{prompt.text}</p>
                  </div>
                )}
              </>
            )}
```

Note the Task 2 eyebrow's hard-coded `250` at `src/App.tsx:329` becomes
`{taskConstants.minWords}`. Its value is still 250 for Task 2.

**5b.** For `Task1PromptPicker`: rather than writing a new component, the
cheapest correct move is to **generalise `PromptPicker` minimally**. Read
`src/components/PromptPicker.tsx` first. It filters by `QuestionType`
(`TYPE_ORDER` at lines 6-12) and labels with `QUESTION_TYPE_META`. Task 1 has no
question type. Two acceptable options — pick the second unless it proves
awkward:

- **Option A**: a separate small `Task1PromptPicker.tsx` that lists prompts by
  `chart.kind` instead of question type, reusing `PromptPicker.css`.
- **Option B (preferred)**: keep `PromptPicker` for Task 2 and give Task 1 a
  plain `<select>` of the 12 prompts labelled `"{kind} · {title}"`, styled with
  the existing `.pp-select` classes. Twelve prompts do not need filtering.

Whichever you choose, do not change `PromptPicker`'s existing props or
behaviour for Task 2.

**5c.** Fix the exam-start card copy (`src/App.tsx:336-340`) to use the real
duration:

```tsx
                <h2>Exam conditions</h2>
                <p>
                  {Math.round(taskConstants.examDurationSec / 60)} minutes, no feedback, no
                  highlights. The full report appears when you submit — exactly like the real thing.
                </p>
```

**5d.** Hide the cheat sheet in Task 1 (`src/App.tsx:377-403`). It is Task 2
content. When `task === 'task1'`, render `FeedbackPanel` alone without the tab
strip — do not render an empty or misleading Cheat sheet tab.

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `npm run build` → exit 0.

### Step 6: Teach the Structure Rail about Task 1 checks

In `src/components/StructureRail.tsx`, `groupOf` (lines 26-30) currently sends
every Task 1 check id to `'body'`. Update it:

```ts
function groupOf(check: StructureCheck): GroupKey {
  // Task 1 ids first — 't1-paraphrase' would otherwise fall through to 'body'.
  if (check.id === 't1-paraphrase') return 'intro'
  if (check.id === 't1-overview') return 'intro'
  if (check.id.startsWith('intro') || check.id === 'position-stated') return 'intro'
  if (check.id.startsWith('conclusion')) return 'conclusion'
  return 'body'
}
```

The Task 1 rail therefore shows **Introduction** (paraphrase, overview) and
**Body paragraphs** (details, figures, comparison, complex sentences), and no
Conclusion group — which is correct, because Task 1 has no conclusion.

`GROUP_LABELS` (lines 10-14) must not show an empty "Conclusion" heading. Check
how the component handles a group with zero checks; if it renders an empty
heading, skip groups with no checks. Read the render body before editing.

Pass the new prop at the call site (`src/App.tsx:315-319`):

```tsx
              <StructureRail
                checks={analysis?.structure ?? []}
                paragraphs={analysis?.paragraphs ?? []}
                questionType={task === 'task1' ? null : prompt?.type ?? null}
                task={task}
              />
```

Use `task` inside the component only where the label genuinely differs. The
`NORMS` constant at `src/components/StructureRail.tsx:17-21` encodes Task 2
paragraph word-count norms (intro 30–60, body 60–120, conclusion 25–60). For
Task 1, paragraph norms differ (paraphrase ~25–40, overview ~20–40, detail
~40–70). Add a task-keyed `NORMS` record rather than branching inline.

**Verify**: `npx tsc -b --noEmit` → exit 0.

### Step 7: Make the Report and Dashboard task-aware

**7a.** `src/components/Report.tsx` — it references the four criteria in four
places (`grep -n "'TR'\|'CC'\|'LR'\|'GRA'" src/components/Report.tsx`). Replace
`CRITERION_META[c].label` lookups with `criterionLabel(c, session.task).label`
(the helper added by plan 004). `session.task` is available from `ReportProps`.

Also make these Task 2 specific strings conditional:
- The POSITION CHECK card (specified at `SPEC.md:270-271`) must not render for
  Task 1 — Task 1 has no position.
- Any copy naming "250 words" or "Task 2".

Leave the band-range hero, the confidence note (`SPEC.md:269-271`) and the
annotated essay exactly as they are — they are task-agnostic and the confidence
note ("This engine checks form, not meaning") is if anything more important for
Task 1.

**7b.** `src/components/Dashboard.tsx` — the session table
(`SPEC.md:190-192`: date, mode, type, words, band, top issue) needs a **Task**
column, and the "type" column should show the chart kind for Task 1 rows
instead of a question type. Add a simple All / Task 1 / Task 2 filter above the
table.

Do **not** change the band trend chart or the sparklines in this step. They
currently mix tasks, which is a known limitation recorded in Maintenance notes.
Add a one-line caption under the trend chart saying it includes both tasks, so
the mixing is disclosed rather than silent.

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `npx vitest run` → all pass.

### Step 8: Manual verification

Run `npm run dev` and check each of these by hand. This plan is UI work; there
is no jsdom environment configured, so manual verification is the gate.

1. App opens on Task 2, behaving exactly as before — same prompt picker, same
   40:00 exam, same 250-word minimum.
2. Click **Task 1**: the chart renders, the word-count target reads 150, the
   editor is empty.
3. Type a short Task 1 answer citing a real figure from the chart → no
   `t1-invented-figure`. Change the figure to one not in the chart → the issue
   appears inline.
4. Omit an overview past 100 words → `Overview` rail node stays hollow and the
   feedback panel shows the error. Add "Overall, …" → both clear.
5. The rail shows no **Conclusion** group in Task 1.
6. Switch to **Exam**: the chart is still visible (it is the question), the
   clock reads 20:00, panels have slid away.
7. Start the clock, type, submit → the report says **Task Achievement**, not
   Task Response, and shows no POSITION CHECK card.
8. Open **Progress**: the new session appears with Task 1 in the task column;
   the filter works; older Task 2 sessions are still listed (this confirms plan
   001's migration held).
9. Resize to ~900px → panels stack, the chart scales, nothing overflows
   horizontally.
10. Enable `prefers-reduced-motion` in devtools → the exam transition is
    disabled and no new animation appears.

Record any failure and fix before proceeding.

### Step 9: Update SPEC.md

Append to the `## Task 1 (v2)` section:

```markdown
### UI
Task switcher in the topbar beside the mode toggle, same markup pattern. Switching task CLEARS the
answer sheet (a Task 2 essay in a Task 1 sheet produces nonsense feedback) and refuses to switch
silently while an exam clock runs — same confirm() as switchMode.
Per-task constants live in `meta.ts` as `TASK_CONSTANTS`: Task 1 = 20:00 and 150 words, Task 2 =
40:00 and 250 words (unchanged). `EXAM_DURATION_SEC` / `MIN_WORDS` / `TARGET_WORDS` remain exported
as the Task 2 values.
The chart renders in BOTH modes — it is the question, so exam mode must show it. The Task 2
cheat sheet is hidden in Task 1 (it is Task 2 content); a Task 1 cheat sheet is separate work.
Structure Rail: `t1-paraphrase` and `t1-overview` group under Introduction; details, figures,
comparison and complex-count under Body. There is NO Conclusion group in Task 1. Paragraph norms are
task-keyed (Task 1: paraphrase 25–40, overview 20–40, detail 40–70).
Report: criterion labels come from `criterionLabel(criterion, session.task)`, so the first slot reads
"Task Achievement" in Task 1. The POSITION CHECK card does not render for Task 1.
Dashboard: a Task column and an All / Task 1 / Task 2 filter. The band trend chart still mixes both
tasks and says so in a caption.
```

### Step 10: Full green

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `npx vitest run` → all files pass.
**Verify**: `npm run build` → exit 0.

## Test plan

- **No new automated tests.** This plan is UI wiring; the repo has no jsdom
  environment and this plan does not add one (that is its own piece of work —
  see Maintenance notes). The gate is the 10-point manual checklist in step 8.
- **The existing suite must stay green throughout.** Plans 003 and 004 tested
  the Task 1 engine; this plan must not change any analysis behaviour, so
  `tests/task1-rules.test.ts`, `tests/task1-chart.test.ts` and the four
  pre-existing files all pass unchanged.
- **Verification**: `npx vitest run` → all pass; step 8's 10 manual checks all
  observed.

## Done criteria

Machine-checkable where possible. ALL must hold:

- [ ] `npx tsc -b --noEmit` exits 0 with no output
- [ ] `npx vitest run` exits 0; every test passes, none modified
- [ ] `npm run build` exits 0
- [ ] `grep -c "EXAM_DURATION_SEC" src/App.tsx` returns 0 — all call sites moved to `taskConstants`
- [ ] `grep -c "MIN_WORDS" src/App.tsx` returns 0
- [ ] `grep -n "TASK_CONSTANTS" src/meta.ts` returns a match
- [ ] `grep -n "analyzeTask1" src/App.tsx` returns at least 2 matches (coach memo + submit)
- [ ] `grep -n "t1-paraphrase" src/components/StructureRail.tsx` returns one match
- [ ] `grep -n "criterionLabel" src/components/Report.tsx` returns at least one match
- [ ] All 10 manual checks in step 8 pass, and you state in your report which
      ones you actually ran
- [ ] `plans/README.md` status row for 005 updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- Plans 001, 003 or 004 have not landed.
- Any excerpt in "Current state" does not match the live file.
- A UI need appears to require an `src/analysis/**` change. The engine is
  finished; report what the UI needs instead of editing rules.
- Any existing test fails.
- Manual check 8 shows older Task 2 sessions **missing** from the Progress
  table. That would mean plan 001's migration did not hold, which is a data-loss
  regression and the most serious failure this sequence can have. Stop
  immediately and report.
- Generalising `PromptPicker` (step 5b, option B) turns out to require changing
  its existing props or Task 2 behaviour. Fall back to option A.
- The exam-mode transition (`DESIGN.md:19-21`) visibly breaks or double-fires
  when switching task. Report what you observe.

## Maintenance notes

For whoever owns this next:

- **The error profile still mixes tasks.** `computeProfile` and `computeTrends`
  aggregate across every session regardless of `task`. For LR/GRA categories
  that is arguably right — article and agreement errors transfer between tasks.
  For TR/CC and every `t1-*` category it is not: a learner who never writes
  Task 1 will still see Task 1 categories at rate zero diluting their EWMA, and
  focus-category recommendations can point at the wrong task. The
  `SessionRecord.task` field is the hook. Do this before adding a third task.
- **The band trend chart mixes tasks too**, and now says so in a caption. The
  real fix is two series or a task filter on the chart.
- **No jsdom / component tests exist.** This plan's gate is a manual checklist,
  which does not scale to a third task. Adding
  `environment: 'jsdom'` to `vite.config.ts` plus `@testing-library/react` and
  converting step 8's checklist into render tests is the right next investment —
  it is deliberately out of scope here because it would double this plan's size
  and add dev dependencies.
- **A Task 1 cheat sheet is missing.** `CheatSheet.tsx` is Task 2 content and is
  hidden in Task 1 rather than replaced. A Task 1 sheet (overview sentence
  templates, trend verbs and their adverbs, comparison structures, the "no
  explanations" rule) is a well-scoped follow-up with real learner value.
- **What a reviewer should scrutinise**: (1) that `switchTask` clears
  `essayText` — carrying an essay across tasks produces confidently wrong
  feedback; (2) that the clock reset effect cannot fire mid-exam; (3) that the
  chart renders in exam mode, since hiding the question would make the task
  impossible.
