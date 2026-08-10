# Plan 023: Stop shipping three exam papers to a learner who opened the writing desk

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> ```bash
> git diff --stat ae92bac..HEAD -- \
>   src/App.tsx src/components/ src/reading/tests/ src/listening/tests/ \
>   vite.config.ts tests/ui/
> ```
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: **M** — the split itself is half a day; the test churn is the other day and a half, and it is not optional
- **Risk**: MED — no behaviour changes, but a Suspense boundary changes the timing of every UI test that navigates into Reading or Listening, and the suite has a hard 10-consecutive-identical-runs requirement
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `ae92bac`, 2026-08-10

## Why this matters

The app boots to the writing desk — `useState<View>('write')`, `src/App.tsx:105`
— and every learner pays, on first load, for three complete exam papers, both
section runners, both reports, both pickers and the marking code, whether or not
they ever click Reading or Listening.

The numbers, measured at `ae92bac` (these match the `## Bundle size` table in
`plans/README.md`, which was rebuilt at the same commit):

| Artifact | Raw | Gzip -9 | Vite prints |
|---|---|---|---|
| entry JS chunk | 559,904 B | 173,731 B | `559.90 kB │ gzip: 174.03 kB` |
| CSS | 68,707 B | 11,505 B | `68.71 kB │ gzip: 11.59 kB` |

Vite's printed `gzip:` column rounds differently from `gzip -9` (174.03 vs
173.73). **Every gate in this plan is stated against Vite's printed column**,
because that is the number `npm run build` puts in front of you.

What is in that chunk, by raw bytes:

| Module | Raw | Share |
|---|---|---|
| `react` + `react-dom` + `scheduler` + `jsx-runtime` | 138,213 B | 24.7% |
| `src/listening/tests/test01.ts` | 38.7 kB | 6.9% |
| `src/reading/tests/academicTest01.ts` | 27.7 kB | 4.9% |
| `src/prompts/bank.ts` | 23.7 kB | 4.2% |
| `src/reading/tests/generalTest01.ts` | 22.1 kB | 3.9% |
| `src/analysis/rules/accuracy.ts` | 17.7 kB | 3.2% |
| `src/components/CheatSheet.tsx` | 15.5 kB | 2.8% |

**Three authored papers are 88.5 kB raw — 16% of the entry chunk — and the
learner who came to write an essay reads none of them.**

Measuring app code only (React marked external, so a quarter of the bundle that
cannot move does not dilute the delta). These three rows come from the esbuild
reproduction described under "Methodology", which overshoots the real Vite
artifact by 3,764 B (0.7%); the **deltas between the rows** are what this plan
leans on, not the absolute figures:

| Scenario | Raw | Gzip |
|---|---|---|
| all-in, as it ships today | 408,427 B | 127,543 B |
| Reading + Listening externalised | 268,660 B | 86,351 B |
| …plus `CheatSheet` and the three model-answer modules | 231,747 B | 73,245 B |

- **Stage 1** (Reading + Listening): **−139,767 B raw, −41,192 B gzip**
- **Stage 2** (also deferring `CheatSheet` and the model answers): a further
  **−36,913 B raw, −13,106 B gzip**

Applied to the shipped artifact (559,904 B raw / 174.03 kB as Vite prints it),
initial JS transfer goes **174.03 kB gzip → ~132.8 kB (−24%)** after stage 1, or
**~119.7 kB (−31%)** after stage 2. The entry chunk goes 559,904 B →
**~420,137 B raw (~420.1 kB)**, which clears Vite's 500 kB
`chunkSizeWarningLimit` **honestly** — by shipping less, not by raising the
threshold.

**Be clear about what the win is not.** Module *evaluation* is not the cost: the
Reading barrel evaluates in **0.47 ms** and the Listening barrel in **0.49 ms**.
Nobody's app is slow because a paper's object literal is being constructed. The
win is **transfer and parse** — 41 kB less over the wire and ~140 kB less
JavaScript for the engine to parse and compile before the first paint of a page
that is a `<textarea>`. On a mid-range phone on a slow connection that is the
difference the learner feels; on a fast desktop it is invisible. Say so in the
PR rather than overselling it.

There is a second, quieter argument. `plans/README.md` already tracks bundle
size as a done-criterion under its `## Bundle size` heading (Listening cost
+11.7% gzip), and the roadmap is more
content: a second Reading paper per module, a second Listening paper, mock test
mode. Every one of those lands in the entry chunk under the current structure.
This plan changes the slope, not just the intercept.

### Methodology, so the numbers can be re-derived

Composition and the externalised scenarios were produced with esbuild
reproductions of the same graph rather than by editing the app. The
reproduction's all-in output came to 563,668 B against the committed Vite
artifact's 559,904 B — **within 0.7%** (+3,764 B, esbuild's slightly different
minifier and helper preamble), which is why the deltas are trustworthy to within
a few percent rather than being an estimate. `dist/` is gitignored, so reproduce
the baseline with `npm run build` before you start (step 1) and use *your*
numbers as the before, not these.

## Current state

### The static import graph

`src/App.tsx:31-32` and `:46-51` pull both sections in at module scope:

```ts
import { readingTestById, readingTestsForModule } from './reading/tests'      // :31
import { LISTENING_TESTS, listeningTestById } from './listening/tests'        // :32
import { createSpeechDriver } from './listening/speech'                       // :33
import { markListening } from './listening/mark'                              // :34
import { markAnswerKey } from './marking/markAnswerKey'                       // :35
...
import ReadingRunner from './components/ReadingRunner'                        // :46
import ReadingReport from './components/ReadingReport'                        // :47
import ReadingPicker from './components/ReadingPicker'                        // :48
import ListeningRunner from './components/ListeningRunner'                    // :49
import ListeningReport from './components/ListeningReport'                    // :50
import ListeningPicker from './components/ListeningPicker'                    // :51
```

and the barrels drag the paper bodies in behind them —
`src/reading/tests/index.ts:10-11`:

```ts
import { ACADEMIC_TEST_01 } from './academicTest01'
import { GENERAL_TEST_01 } from './generalTest01'
```

`src/listening/tests/index.ts:15`:

```ts
import { LISTENING_TEST_01 } from './test01'
```

### Where the sections actually render

Only under `view === 'reading'` or `view === 'listening'`, at
`src/App.tsx:1054-1131` — six blocks: runner, report and picker for each
section, each gated on a `ReadingStage`/`ListeningStage` of
`'picker' | 'running' | 'report'` (`src/App.tsx:56-59`).

The initial view is `'write'` (`src/App.tsx:105`).

### **The part that makes this more than six `React.lazy` calls**

Bare `React.lazy` on the six leaf components is **insufficient, not useless.**
Be precise about which, because the difference is the whole shape of this plan.

**What it does move** — measured, not guessed: **~44.5 kB raw / ~11.3 kB gzip**,
about **11% raw and 9% gzip of the app-code bundle** (the React-external figures
above). That is the six component bodies, `src/listening/player.ts` (reachable
only through `ListeningRunner.tsx:40-41`; nothing in `src/` imports
`src/listening/index.ts`, which is its only other route) and the six section CSS
files (`ReadingRunner.css`, `ReadingReport.css`, `ReadingPicker.css` and their
Listening counterparts, 39,085 B of source between them). No other
entry-reachable module imports any of it.

**What it does not move** — the ~88.5 kB of authored paper data, which is 16% of
the entry chunk and the entire reason this plan exists. `App.tsx` keeps both
registries at module scope, so `academicTest01.ts`, `generalTest01.ts` and
`listening/tests/test01.ts` stay exactly where they are however many `lazy()`
calls wrap the components. There are **eight** such registry sites — two static
imports, three synchronous `useMemo` derivations, three synchronous JSX calls:

```
src/App.tsx:31     import { readingTestById, readingTestsForModule } from './reading/tests'
src/App.tsx:32     import { LISTENING_TESTS, listeningTestById } from './listening/tests'
src/App.tsx:179    const readingTests = useMemo(() => readingTestsForModule(module), [module])
src/App.tsx:181      () => (readingTestId === null ? null : readingTestById(readingTestId)),
src/App.tsx:214      () => (listeningTestId === null ? null : listeningTestById(listeningTestId)),
src/App.tsx:1068           test={readingTestById(readingSession.testId)}
src/App.tsx:1106           test={listeningTestById(listeningSession.testId)}
src/App.tsx:1124              tests={[...LISTENING_TESTS]}
```

(`grep -n "readingTestById\|readingTestsForModule\|LISTENING_TESTS\|listeningTestById" src/App.tsx`
prints exactly these eight lines plus the prose comment at `:206`. Two further
imports — `markAnswerKey` at `:35`, called at `:487`, and `markListening` at
`:34`, called at `:544` — are not registry references but move for the same reason: they are
Reading/Listening-only code held in the entry graph by App.)

App owns the section state (`readingStage`, `readingTestId`, `listeningStage`,
`listeningTestId`, both histories, both submit handlers) and derives the test
objects synchronously in `useMemo`. **That is the refactor**: those eight sites
have to move behind the async boundary before a single byte of paper text moves
out of the entry chunk. `lazy()` alone buys the 44.5 kB of component code and
strands the 88.5 kB of content — a third of the available win, and the third
that does not grow as papers are authored.

### The UI tests that will feel it

Nine files in `tests/ui/`. Four drive the real `<App/>` into a section
synchronously:

| File | Lines | `getBy*` | Navigations into a lazy section |
|---|---|---|---|
| `tests/ui/listening.test.tsx` | 578 | 42 | 8 (`:105, 136, 150, 153, 161, 175, 185, 574`) |
| `tests/ui/a11y.test.tsx` | 361 | 35 | 4 (`:90, 96, 249, 311`) |
| `tests/ui/reading.test.tsx` | 347 | 25 | 4 (`:80, 96, 105, 124`) |
| `tests/ui/reading-word-limits.test.tsx` | 183 | 7 | via `renderApp()` for the real-app half; the mixed-limit half renders `ReadingRunner` directly and is unaffected |

(`tests/ui/reading.test.tsx:126` and `tests/ui/listening.test.tsx:560` navigate
*out* to Write and Progress, which are not lazy. `tests/ui/listening.test.tsx:150`
and `:574` cross from Listening into Reading — a second boundary, and the sites
most likely to be missed.)

The exact shape that breaks, `tests/ui/reading.test.tsx:93-99`:

```ts
    const user = userEvent.setup()
    renderApp()

    await user.click(navLink('Reading'))

    expect(screen.getByText(ACADEMIC_PAPER)).toBeInTheDocument()
    expect(screen.queryByText(GENERAL_PAPER)).not.toBeInTheDocument()
```

`getByText` throws the moment the picker is behind a Suspense boundary that has
not resolved.

Some navigations are already partly awaited — `tests/ui/reading.test.tsx:79-83`
and `tests/ui/a11y.test.tsx:89-99` both end on `await screen.findByRole('tab', …)`
— and their **final** `await` keeps working; their **middle**
`getByRole('button', …)` line does not, because it queries the picker, which is
the lazy component. See step 4: the lines that break are
`reading.test.tsx:81`, `a11y.test.tsx:91` and `:97`, and
`reading-word-limits.test.tsx:79`. It is the *first assertion or query against
section-rendered content after the first click into a section* in each test that
changes.

### The rule the suite is held to

`plans/README.md` records that the UI suite once failed roughly four runs in six,
and plan 007 spent a day removing that. `tests/ui/renderApp.tsx:1-22` is the
result and every test that renders `<App/>` must use it. **Ten consecutive
`npx vitest run --project ui` runs must print ten identical lines** after this
plan lands. A Suspense boundary is exactly the kind of change that reintroduces
order-dependent timing, so that gate is not ceremony.

### Design constraints this must honour

`DESIGN.md` — the aesthetic is "institutional exam stationery"; the transitions
budget is one orchestrated ~400 ms move ("clearing the desk"), disabled under
`prefers-reduced-motion`. A loading state is new UI and must be quiet: no
spinner, no layout shift that pushes the topbar, and nothing that reads as an
error. `plans/README.md` also records a known, pre-existing wordmark contrast
issue during the exam-mode crossfade — do not touch it, and do not let a new
fallback land inside `.topbar`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npx tsc -b --noEmit` | exit 0 — but see the note below: it covers `src/` only |
| Whole suite | `npx vitest run` | `Test Files 24 passed`, `Tests 848 passed` at the baseline |
| UI only | `npx vitest run --project ui` | all pass |
| UI determinism | `for i in $(seq 1 10); do npx vitest run --project ui 2>&1 \| grep -E "^ *Tests "; done` | 10 identical passing lines |
| Build | `npm run build` | exit 0 |
| Read the chunk table | `npm run build 2>&1 \| grep -E "dist/assets/.*\.(js\|css)"` | entry + at least two async chunks |
| Chunk count | `ls dist/assets/*.js \| wc -l` | ≥ 3 after the split |
| Serve the build | `npm run preview` | for the manual pass in step 8 |

**The typecheck does not see your test edits.** `tsconfig.json` ends with
`"include": ["src"]`, so `tests/` is never typechecked and
`npx tsc -b --noEmit` exits 0 today regardless of what is in there. Step 4's
conversions are checked by `npx vitest run` alone — a mistyped `await` in a test
file will surface as a failing or hanging test, never as a type error.

**Which gzip number counts**: the figures in this plan's gates are **Vite's
printed `gzip:` column** from `npm run build`, not `gzip -9 < file | wc -c`. The
two disagree — at `ae92bac` the entry chunk is `gzip: 174.03 kB` printed and
173,731 B under `gzip -9`. Quote the printed line in your report so the numbers
are comparable to `plans/README.md`'s `## Bundle size` table, which is stated the
same way.

## Scope

**In scope**:

- `src/App.tsx` (modify — hand the two section subtrees to containers, lazy-load them, prefetch on hover. The section **state** stays here; see step 2)
- `src/components/ReadingSection.tsx` (**create**)
- `src/components/ListeningSection.tsx` (**create**)
- `src/components/SectionFallback.tsx` (**create** — or an inline element; one small shared thing, not two)
- `src/types.ts` (modify — props for the two new containers, plus the two stage unions moved out of `App.tsx:56-59`, following the existing `*Props` interfaces at `:711-882`)
- `tests/ui/reading.test.tsx`, `tests/ui/listening.test.tsx`, `tests/ui/a11y.test.tsx`, `tests/ui/reading-word-limits.test.tsx` (modify — awaited queries at the section boundary)
- `plans/README.md` (status row, and the table under the `## Bundle size` heading)

**Out of scope** (do NOT touch, even though they look related):

- **`src/analysis/`, `src/prompts/bank.ts`, `src/profile/`.** The writing desk
  needs the analysis engine on the first keystroke and the prompt bank on the
  first render. `accuracy.ts` (17.7 kB) and `bank.ts` (23.7 kB) are the entry
  chunk's third and sixth largest modules and **both belong there**. Deferring
  them would trade a real bundle number for a stutter in the product's core
  loop.
- **A router.** `View` is a five-member union in one `useState`. Introducing a
  routing library to get code splitting would add the runtime dependency this
  repo does not have, to solve a problem `React.lazy` solves in six lines.
- **`vite.config.ts` `manualChunks`.** Dynamic `import()` is the mechanism;
  hand-tuning the chunk graph on top of it is a second, competing source of
  truth for the same decision.
- **`chunkSizeWarningLimit`.** Raising it would make the warning go away without
  making the bundle smaller. The point is to clear 500 kB by being under it.
- **`tests/ui/renderApp.tsx`'s contract.** It still pins the prompts and the
  speech driver; a `Suspense` wrapper does not change what it seeds.
- `package.json` — no runtime dependency may be added.

## Git workflow

- Branch: `advisor/023-code-split-sections`
- Commits, in this order, each independently green:
  1. `Extract the Reading and Listening sections into container components` (no lazy loading yet — pure move, suite still green with zero test changes)
  2. `Load the exam sections on demand` (the `lazy`/`Suspense` switch + the test churn)
  3. `Prefetch a section when the learner reaches for it`
  4. optional: `Defer the cheat sheet and the worked answers` (stage 2)
- Message style matches `git log`: imperative, sentence case, no prefix tag.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Measure the baseline yourself

```bash
npx tsc -b --noEmit
npx vitest run 2>&1 | tail -5
npm run build 2>&1 | grep -E "dist/assets/"
ls dist/assets/*.js | wc -l
```

**Verify**: typecheck 0; `Test Files 24 passed`, `Tests 848 passed`; the build
prints **one** JS chunk, and at `ae92bac` the line is exactly:

```
dist/assets/index-p4i49yWY.js   559.90 kB │ gzip: 174.03 kB
```

(559,904 B raw on disk; the hash changes with any source edit. CSS prints
`68.71 kB │ gzip: 11.59 kB` = 68,707 B. Vite's kB is 1000 B and its `gzip:`
column rounds differently from `gzip -9`, which gives 173,731 B — record the
exact printed line rather than re-deriving it.)

**Write the exact line down.** It is the "before" in your report and in the
`plans/README.md` bundle table, and every threshold in "Done criteria" is
relative to it.

### Step 2: Extract `ReadingSection` — a pure move, no lazy loading

**Decided, not left to the executor: the state stays in `App.tsx`.** All seven
atoms at `src/App.tsx:129-140` — `readingStage`, `readingTestId`,
`readingSessionId`, `listeningStage`, `listeningTestId`, `listeningSessionId`,
`listeningPractice` — stay exactly where they are, and so do the six functions
that read and write them: `openReading` (`:452-457`), `startReadingTest`
(`:459-463`), `openReadingSession` (`:497-501`), `openListening` (`:505-510`),
`startListeningTest` (`:512-517`), `openListeningSession` (`:558-563`). The
containers own **rendering and registry lookups only**, and receive stage,
identifiers and setters as props.

Two reasons, both of which rule out moving the stage into the container:

1. **App writes the stage while the container is unmounted.** `openReading`
   reads and writes `readingStage` at `:456`
   (`if (readingStage === 'report') setReadingStage('picker')`), and the
   identical `openListening` at `:509`. Those run from the topbar nav button
   (`:681`, `:688`) at a moment when `view` is not yet `'reading'`, so under
   `{view === 'reading' && <Suspense>…</Suspense>}` the container does not exist
   and cannot hold the value being set. Step 5 keeps `onClick={openReading}` on
   that button, so this is not hypothetical.
2. **The container unmounts on every navigation away.** `{view === 'reading' && …}`
   tears the subtree down when the learner clicks Write or Progress. State held
   inside it would be discarded — `readingStage`, `readingTestId`,
   `readingSessionId` and `listeningPractice` are all preserved across
   navigation today, and a learner returning to Reading would silently lose the
   report they were reading.

Keeping the atoms in App also preserves `inReadingTest` (`:648`) and
`inListeningTest` (`:651`) **verbatim** — no `onExamStateChange`, no second
source of truth. (An `onExamStateChange` callback would additionally be wrong on
timing: App would learn `inReadingTest` one render *late*, so the topbar nav and
the exam-type toggle at `:708-744` would still be on screen for a frame after the
runner mounts. `deskCleared` at `:652` is the whole point of that flag.)

So `src/components/ReadingSection.tsx` owns only:

- the derived tests: `readingTestsForModule(module)` (`App.tsx:179`) and
  `readingTestById(...)` (`:181`, `:1068`)
- the marking call now inside its own submit handler (`markAnswerKey`, `:487`) —
  the container builds the `ReadingSessionRecord` and hands the finished record
  to App, which persists it.

  **This needs `makeId`, which is currently App-internal** (`src/App.tsx:307-312`,
  a function declared *inside* the component). It closes over nothing, so hoist it
  to module scope in `src/App.tsx` and export it, then import it in both
  containers; App keeps calling it at `:336` for the writing handler. Add
  `makeId`'s new home to this step's file list. Without this the container cannot
  mint `id` and the record is unpersistable
- the three render blocks (`App.tsx:1054-1088`)

Its props are the seam. Keep it narrow — the container must not need to know
about the writing desk:

```ts
export interface ReadingSectionProps {
  module: Module;
  /** Where the learner is in the section. Owned by App (`App.tsx:129`) so it
   *  survives the container's unmount on navigation, and so `openReading`
   *  (`:456`) can still reset it while the container does not exist. */
  stage: ReadingStage;
  onStageChange: (stage: ReadingStage) => void;
  /** The paper being sat or reviewed; null on the picker. App owns it (`:130`). */
  testId: string | null;
  /** Start a paper — App's `startReadingTest` (`:459-463`), unchanged. */
  onStart: (testId: string) => void;
  /** Reading sessions for the ACTIVE module, newest first, for the picker's
   *  history list. Derived in App at `:191-199`, which filters by `module`. */
  history: ReadingSessionRecord[];
  /** The stored sitting being reviewed, or null. Derived in App at `:200-203`
   *  from the UNFILTERED session list — see the note below; the container must
   *  not re-derive it from `history`. */
  session: ReadingSessionRecord | null;
  /** Open a stored result — App's `openReadingSession` (`:497-501`), which takes
   *  the record, not an id. */
  onOpenSession: (session: ReadingSessionRecord) => void;
  /** Persist a completed paper. The container marks; App stores. */
  onSubmit: (record: ReadingSessionRecord) => void;
}
```

**The report session is passed in; it is not derivable from `history`.**
`App.tsx:200-203` is

```ts
  const readingSession = useMemo<ReadingSessionRecord | null>(
    () => sessions.filter(isReadingSession).find((s) => s.id === readingSessionId) ?? null,
    [sessions, readingSessionId],
  )
```

— **no `module` filter**, while `readingHistory` at `:191-199` *does* filter
(`.filter((s) => s.module === module)`). A container handed only `history` and
`readingSessionId` would fail to find an Academic sitting while the toggle says
General, and the report block at `:1064` would silently fall through to the
picker. Pass the derived `session` down and leave both `useMemo`s in App
untouched. The Listening pair is the mirror image and is safe either way
(`listeningHistory` `:225-228` is deliberately unfiltered, see the comment at
`:222-224`) — pass `session` down there too, for symmetry and for the same
reason.

Do the same for `src/components/ListeningSection.tsx`
(`App.tsx:206-232`, `:544`, `:1090-1131`), which additionally owns
`LISTENING_TESTS`, `listeningTestById`, `markListening` and the `speechDriver`
`useMemo` moved verbatim from `:221`. `ListeningSectionProps` is
`ReadingSectionProps` minus `module`, with `stage: ListeningStage`,
`onStart: (testId: string, practice: boolean) => void`, the
`practice: boolean` flag App holds at `:140`, and:

```ts
  /**
   * The OPTIONAL injected driver — `AppProps.listeningDriver` (`types.ts:760`)
   * forwarded verbatim. When it is absent the container calls
   * `createSpeechDriver()` itself, exactly as `App.tsx:221` does today:
   *
   *   const speechDriver = useMemo(() => driver ?? createSpeechDriver(), [driver])
   *
   * That keeps the test injection working — `tests/ui/renderApp.tsx:50` passes a
   * `FakeSpeechDriver` through `AppProps` and App passes it straight through, so
   * no test ever reaches a real speech engine — while taking
   * `src/listening/speech.ts` (17,914 B of source) OUT of the entry chunk. A
   * required prop would force `App.tsx:33` to keep importing
   * `createSpeechDriver`, pinning that module in the entry graph, which the
   * projection above does not subtract.
   */
  driver?: SpeechDriver;
```

One consequence to note in the commit message: the production driver is now
constructed on first entry into Listening rather than at app boot, and once per
container mount rather than once per App mount. Nothing in the suite depends on
driver identity across navigation — every test that holds a reference injects it
(`listening.test.tsx` `transcriptDriver()`, `a11y.test.tsx:289`), and the
injected object is forwarded unchanged.

**Both containers must have a `default` export** — `lazy(() => import(…))` in
step 3 resolves `.default`, and a named-only export fails at runtime, not at
compile time. That is already the repo convention
(`src/components/ReadingPicker.tsx:36` and `ListeningPicker.tsx:48` are
`export default function`); follow it.

Put the two props interfaces in **`src/types.ts` only** — beside the existing
component props (`:711-882`, which ends with `ListeningReportProps` at
`:870-882`), matching their comment style. The interface bodies shown above are
illustrative of the shape; **do not also declare them in the `.tsx` files.**
`ReadingStage` and `ListeningStage` (`App.tsx:56-59`) are not exported today, so
move those two unions to `src/types.ts` as well and import them back into
`App.tsx` as types — they are erased and cost nothing.

**Verify**:

```bash
npx tsc -b --noEmit
npx vitest run
```

→ exit 0 and **848 tests still passing with zero test-file changes**. That is
the point of doing the move as its own commit: if a single UI test needed
editing here, the extraction changed behaviour and you should find out now,
while the diff is a pure move.

### Step 3: Load the two sections on demand

In `src/App.tsx`, delete the six component imports at `:46-51` and **all five**
value imports at `:31-35` — the two registries (`:31-32`), `createSpeechDriver`
(`:33`, now the container's fallback), `markListening` (`:34`) and
`markAnswerKey` (`:35`), whose only call sites were `:544` and `:487` and which
moved into the containers in step 2. Leaving `:33` behind would keep
`src/listening/speech.ts` in the entry chunk for nothing.

The **type-only** imports of `ReadingAnswers` and `ListeningAnswers` at `:22-23`
cost nothing at runtime — types are erased — but the handlers that used them
moved into the containers in step 2, so App probably no longer references either.
`tsconfig.json` sets `noUnusedLocals: false`, so an orphaned import will not
error; delete it by hand if nothing in `App.tsx` still names it. `src/types.ts:25`
keeps a type-only import of `SpeechDriver` from `./listening/speech`, which is
correct and stays. After this step,
`grep -n "listening/speech" src/App.tsx` must print nothing.

```ts
import { lazy, Suspense } from 'react'

/*
 * The two exam sections load on demand.
 *
 * The app boots to the writing desk (`useState<View>('write')` below), and a
 * learner who came to write an essay was downloading three complete authored
 * papers to get there: `listening/tests/test01.ts`, `academicTest01.ts` and
 * `generalTest01.ts` are 88.5 kB raw between them, 16% of the entry chunk.
 * Nothing here is about evaluation cost — the Reading barrel evaluates in
 * 0.47 ms — it is about not transferring and parsing what has not been asked
 * for.
 *
 * The thunks are hoisted so the same promise backs both `lazy()` and the
 * prefetch on nav hover: the module registry caches by specifier, so reaching
 * for the link starts the fetch and clicking it usually finds it already there.
 */
const importReadingSection = () => import('./components/ReadingSection')
const importListeningSection = () => import('./components/ListeningSection')

const ReadingSection = lazy(importReadingSection)
const ListeningSection = lazy(importListeningSection)
```

Replace the six render blocks with two, each inside its own boundary:

```tsx
      {view === 'reading' && (
        <Suspense fallback={<SectionFallback label="Reading" />}>
          <ReadingSection … />
        </Suspense>
      )}

      {view === 'listening' && (
        <Suspense fallback={<SectionFallback label="Listening" />}>
          <ListeningSection … />
        </Suspense>
      )}
```

**Two boundaries, not one wrapping both.** A shared boundary would make opening
Reading show a fallback that is also waiting on Listening's chunk if both were
ever in flight, and it would put the two sections in one chunk the moment a
bundler decides they share a boundary.

`src/components/SectionFallback.tsx`:

```tsx
/**
 * The quiet moment while a section's chunk arrives.
 *
 * Deliberately plain. DESIGN.md budgets ONE orchestrated transition in this app
 * ("clearing the desk", ~400ms) and a spinner here would be a second, competing
 * one — on a wait that is usually a single frame from cache. It reserves the
 * page's own padding so nothing below it jumps, it is `role="status"` with
 * `aria-live="polite"` so a screen-reader user is told the view is arriving
 * rather than finding an empty main, and it never takes focus.
 */
export default function SectionFallback({ label }: { label: string }) {
  return (
    <main className="page">
      <p className="eyebrow" role="status" aria-live="polite">
        Loading {label}…
      </p>
    </main>
  )
}
```

**Verify**:

```bash
npx tsc -b --noEmit
npm run build 2>&1 | grep -E "dist/assets/"
ls dist/assets/*.js | wc -l
```

→ typecheck 0; **at least three JS chunks**; the entry chunk is at least 100 kB
raw smaller than the step-1 line. The suite will be red at this point — step 4.

### Step 4: Convert the queries that now cross an async boundary

This is the work. The rule is narrow and mechanical, and it is about **what the
query targets**, not about its position in the file:

> **In each test, the first query that targets content rendered BY THE SECTION
> becomes `await screen.findBy*`. Everything after it in that test stays
> `getBy*`. Queries against the topbar are never converted.**

"The topbar" means the nav links (`src/App.tsx:666-700`, the `navLink(…)` helper
in every one of these files) and the exam-type block at `:708-744`, whose
`role="group" aria-label="IELTS exam type"` div is `:725`. All of it is rendered
by `App` and none of it is behind a boundary — `view` flips synchronously on
click, so the topbar is already correct on the very next assertion.

**Do not use "the first query after the click".** It mis-fires: the query right
after a navigation click is very often a topbar query that passes fine, while the
one that actually throws is two or three lines further down. The clearest case is
`tests/ui/listening.test.tsx:150-155` — `:151` and `:154` query the exam-type
group (topbar, pass), and it is `:155`, `getByText(/identical/i)`, that hits
`src/components/ListeningPicker.tsx:67` and throws.

Once the chunk has resolved, the component is synchronous for the rest of that
render tree, so blanket-converting every `getBy*` in the file is wrong: it is
noise, it slows the suite, and it hides which assertion is actually the
asynchronous one.

Before / after, `tests/ui/reading.test.tsx:93-99`:

```ts
    await user.click(navLink('Reading'))

-   expect(screen.getByText(ACADEMIC_PAPER)).toBeInTheDocument()
+   expect(await screen.findByText(ACADEMIC_PAPER)).toBeInTheDocument()
    expect(screen.queryByText(GENERAL_PAPER)).not.toBeInTheDocument()
```

Note the `queryBy` on the next line is **still correct** — it asserts an
absence, and once the `findBy` above has resolved, the section is rendered and
the absence is meaningful. A `queryBy` that runs *before* the boundary resolves
is the trap: it would pass vacuously because nothing is rendered at all. Check
every `queryBy`/`not.toBeInTheDocument` in the four files and make sure a
resolved `findBy` precedes it in the same test.

The navigation helpers' **final** `await` already does the right thing. Their
**middle line** does not — it queries the picker, which is now the lazy
component:

```ts
// tests/ui/reading.test.tsx:79-83
async function startAcademicPaper(user: User): Promise<void> {
  await user.click(navLink('Reading'))
  await user.click(screen.getByRole('button', { name: 'Start this paper' }))   // :81 — picker
  await screen.findByRole('tab', { name: /Reading Passage 1/ })                // fine
}
```

Convert that middle line to:

```ts
  await user.click(navLink('Reading'))
  await user.click(await screen.findByRole('button', { name: 'Start this paper' }))
  await screen.findByRole('tab', { name: /Reading Passage 1/ })
```

**The exact lines to convert.** Each was checked against the component that
renders the queried text; convert these and nothing else:

| File | Line | Query | Rendered by |
|---|---|---|---|
| `reading.test.tsx` | `:81` | `getByRole('button', { name: 'Start this paper' })` (inside `startAcademicPaper`) | `ReadingPicker.tsx:91` |
| `reading.test.tsx` | `:98` | `getByText(ACADEMIC_PAPER)` | `ReadingPicker` paper list |
| `reading.test.tsx` | `:109` | `getByText(GENERAL_PAPER)` — first section query after the `:107` module switch; the `:105` navigation was never awaited | `ReadingPicker` paper list |
| `listening.test.tsx` | `:107` | `getByRole('button', { name: 'Sit under exam conditions' \| 'Practice mode' })` (inside `startPaper`) | `ListeningPicker` |
| `listening.test.tsx` | `:138` | `getByRole('heading', { name: 'Listening', level: 1 })` | `ListeningPicker.tsx:60` (`<h1 className="lsp-title">`) |
| `listening.test.tsx` | `:155` | `getByText(/identical/i)` | `ListeningPicker.tsx:67` |
| `listening.test.tsx` | `:165` | `getByText(/generated by your browser, not a recording/i)` | `ListeningPicker` driver notice |
| `listening.test.tsx` | `:177` | `getByText(/revealed line by line at speaking pace/i)` | `ListeningPicker` driver notice |
| `listening.test.tsx` | `:187` | `getByText(/The two ways to sit it/i)` | `ListeningPicker.tsx:136` |
| `a11y.test.tsx` | `:91` | `getByRole('button', { name: 'Start this paper' })` (inside `startReadingPaper`) | `ReadingPicker.tsx:91` |
| `a11y.test.tsx` | `:97` | `getByRole('button', { name: 'Sit under exam conditions' })` (inside `startListeningPaper`) | `ListeningPicker` |
| `reading-word-limits.test.tsx` | `:79` | `getByRole('button', { name: 'Start this paper' })` (inside `sitPaper`) | `ReadingPicker.tsx:91` |

Note `listening.test.tsx:139` (`getByText(LISTENING_TEST_01.title)`) is also
picker content but comes *after* `:138` in the same test, so it stays `getBy` —
that is the rule working, not an oversight.

**The lines that MUST stay `getBy`-shaped.** Converting any of these would be
wrong, and two of them would be actively misleading:

- `a11y.test.tsx:251` — `pressed('IELTS exam type')` after the `:249` navigation. Topbar (`App.tsx:708-744`).
- `a11y.test.tsx:312` — `current()`, which reads `document.querySelector('.nav')` (`:303`). Topbar.
- `a11y.test.tsx:315` — `expect(navLink('Reading')).not.toHaveAttribute('aria-pressed')`. Topbar.
- `listening.test.tsx:151` — `getByRole('group', { name: 'IELTS exam type' })` after the `:150` crossing into Reading. Topbar.
- `listening.test.tsx:154` — `queryByRole('group', …)).not.toBeInTheDocument()` after the `:153` crossing into Listening. Topbar, and an **absence** assertion: it is valid here only because `view` flips synchronously and the group is App-rendered.

**One absence assertion needs a barrier added rather than a conversion.**
`listening.test.tsx:576` is
`expect(screen.queryByText(/Your Academic Reading results/i)).not.toBeInTheDocument()`,
and the only thing before it in that test after the `:574` crossing into Reading
is the click itself. Converting a `queryBy` would invert its meaning, so instead
precede it with a resolved query against the Reading picker, e.g.

```ts
    await user.click(navLink('Reading'))
+   await screen.findByRole('heading', { name: 'Reading', level: 1 })   // ReadingPicker.tsx:49

    expect(screen.queryByText(/Your Academic Reading results/i)).not.toBeInTheDocument()
```

Without it the assertion passes vacuously against an unresolved boundary, which
is exactly the failure mode the second reviewer property below exists to catch.

Then re-read the four files for any other `queryBy`/`not.toBeInTheDocument`
against **section** content and confirm a resolved query precedes it in the same
test (`reading.test.tsx:99` and `:112` are covered by the `:98`/`:109`
conversions above; `listening.test.tsx:179` is covered by `:177`).

Also check the two tests that navigate to **Progress** immediately after a
section (`tests/ui/reading.test.tsx:342` and `tests/ui/listening.test.tsx:560`)
— Progress is not lazy, so those stay synchronous,
but they run *after* a lazy section has mounted and unmounted, which is exactly
where a leaked pending promise would show up as flake.

`tests/ui/reading-word-limits.test.tsx` needs `:79` and nothing else: `:73` and
`:75` in the same helper are the nav link and the exam-type group (topbar), `:80`
runs after the picker has resolved, and the half of the file that renders
`ReadingRunner` directly (see its header, `:20-27`) never mounts `App` at all and
must stay that way.

**Verify**:

```bash
npx vitest run
for i in $(seq 1 10); do npx vitest run --project ui 2>&1 | grep -E "^ *Tests "; done
```

→ all 848 pass; ten identical lines. **If any two of the ten differ, STOP** —
that is plan 007's flake returning and it must not be re-litigated by re-running
until green.

### Step 5: Prefetch on reach

On the two nav buttons (`src/App.tsx:678-691`), start the fetch when the learner
reaches for the link rather than when they arrive:

```tsx
              <button
                className={view === 'reading' ? 'nav-link active' : 'nav-link'}
                aria-current={view === 'reading' ? 'page' : undefined}
                // Reaching for the link is the earliest honest signal of intent,
                // and it buys the whole round trip: by the time the click lands
                // the chunk is usually already in the module registry, so the
                // Suspense fallback never paints. `onFocus` as well as
                // `onMouseEnter` so keyboard users get the same head start.
                onMouseEnter={importReadingSection}
                onFocus={importReadingSection}
                onClick={openReading}
              >
                Reading
              </button>
```

`onClick={openReading}` is unchanged — that is the point of step 2's decision to
leave the stage in App. `openReading` still reads and writes `readingStage`
(`App.tsx:456`) at a moment when the container is not mounted, and it still works
because App owns the value.

The thunks return the module registry's cached promise on every call after the
first, so this is idempotent and costs nothing to fire repeatedly. **Do not** add
a `useEffect` that prefetches on mount — that reintroduces the download this
plan removes, just later.

**Verify**: `npx vitest run --project ui` → all pass (hover handlers are inert
under `userEvent.click`, which does dispatch `mouseenter`; if a test now resolves
the section *before* its `findBy`, `findBy` still passes — that is the intended
behaviour, not a broken test).

### Step 6 (optional, stage 2): Defer the cheat sheet and the worked answers

`CheatSheet` (15.5 kB raw) and `ModelAnswer`'s three model modules
(`src/answers/task1Model.ts` 16.6 kB, `task2Models.ts` 11.9 kB,
`letterModels.ts` 6.5 kB source) render only under the coach panel's
`cheatsheet` and `model` tabs (`src/App.tsx:1018-1026`), and the panel opens on
`feedback`. Same treatment: `lazy` the two components, `Suspense` around the
panel body, prefetch on tab hover.

**Measured worth: a further −36,913 B raw / −13,106 B gzip**, taking initial
transfer to ~119.7 kB gzip (−31% from today).

Two cautions:

- `tests/ui/model-answer.test.tsx` (127 lines, 18 `getBy*`) clicks the `model`
  tab and asserts immediately. Same conversion rule as step 4.
- The panel body is a `role="tabpanel"` with `aria-labelledby`
  (`src/App.tsx:1012-1017`), and `tests/ui/a11y.test.tsx` asserts the complete
  ARIA tab pattern. The fallback must render **inside** the existing tabpanel
  `<div>`, never replace it, or the panel briefly has no accessible name.

This step is optional and may be split into its own follow-up. If you defer it,
say so in your report and in the `plans/README.md` row — do not leave it
half-done.

### Step 7: Update the bundle table in `plans/README.md`

The heading is **`## Bundle size`** (there is no "Bundle growth" heading — check
with `grep -in "bundle" plans/README.md`). Its table already has four columns:
_(blank)_, `Baseline 7e471c6`, `Plan 011 branch`, `**Measured at ae92bac**`, with
`JS` / `CSS` / `Total` rows, followed by an "Exact bytes at `ae92bac`" paragraph
and the note that this plan's gates are stated against Vite's printed column.

Do **one** of these, not both:

- add a fifth column, `**After 023**`, filling the same three rows from your own
  `npm run build` — and say in the column header or the paragraph beneath that
  the JS figure is now the **entry chunk**, not the only chunk, since the async
  chunks are the rest of the same download when a learner does open a section; or
- append a `### Code split (plan 023)` subsection immediately under the existing
  table with a before/after of the **entry JS chunk** only, plus the per-chunk
  listing from `npm run build`.

Either way add one sentence naming what the win is (transfer and parse) and what
it is not (evaluation — 0.47 ms and 0.49 ms).

Two other lines in that file are now stale and should be corrected in the same
commit, since this plan is what made them stale:

- the last line of the `## Bundle size` section, "Plan 023 addresses the
  single-chunk shape" — say that it landed and what the shape is now;
- `plans/README.md:159-167` ("One 623 kB chunk — plan 023") and `:245-248` (the
  gap-analysis bullet) both still say `React.lazy` on the six leaf components
  "moves **nothing**" and cite "ten registry call sites". Both are wrong: it
  moves ~44.5 kB raw / ~11.3 kB gzip and there are **eight** registry sites.
  Correct them to match the "more than six `React.lazy` calls" section above.

### Step 8: Look at it

```bash
npm run build && npm run preview
```

Open the app, click Reading, click Listening, and go back to Write. Confirm by
eye:

- the fallback is either invisible (prefetched) or a single quiet line — no
  spinner, no layout jump, no flash of unstyled section content. Vite splits CSS
  per async chunk by default and injects the `<link>` before the module runs, so
  a FOUC would mean something is wrong, not a known cost;
- the topbar does not flicker, and the exam-type toggle appears with the Reading
  picker rather than a frame before it;
- with the network throttled (DevTools → Slow 3G) and hover prefetch defeated
  (navigate by keyboard `Tab` then `Enter` too fast to prefetch), the fallback
  reads as "the page is arriving", not "the page is broken".

Record what you saw. This is the one check in the plan that is a judgement, and
it is the one a reviewer cannot make from a diff.

### Step 9: Full verification

```bash
npx tsc -b --noEmit
npx vitest run
npm run build 2>&1 | grep -E "dist/assets/|larger than"
ls dist/assets/*.js | wc -l
git status --porcelain package.json package-lock.json
for i in $(seq 1 10); do npx vitest run --project ui 2>&1 | grep -E "^ *Tests "; done
```

## Test plan

**No new test files.** This plan changes when code loads, not what it does, so
the correct test outcome is *the same 848 assertions, unchanged in meaning*.
Adding tests here would mostly be testing React.

What changes, and why each change is the minimum:

| File | Change | Why |
|---|---|---|
| `tests/ui/reading.test.tsx` | 3 queries → `findBy` (`:81` in the helper, `:98`, `:109`) | first query against picker-rendered content |
| `tests/ui/listening.test.tsx` | 6 queries → `findBy` (`:107` in the helper, `:138`, `:155`, `:165`, `:177`, `:187`) + one added barrier before `:576` | same, more entry points; `:151`/`:154` are topbar and stay |
| `tests/ui/a11y.test.tsx` | 2 queries → `findBy` (`:91`, `:97`, both helper middles); topbar queries untouched | `:251`, `:312`, `:315` are topbar, not section |
| `tests/ui/reading-word-limits.test.tsx` | 1 query → `findBy` (`:79`) | the direct-`ReadingRunner` half is unaffected |
| `tests/ui/model-answer.test.tsx` | only if step 6 lands | the `model` tab becomes async |

Two properties a reviewer should be able to check by reading the diff:

1. **No assertion changed its meaning.** Every edit is `getBy → await findBy` or
   wrapping an existing query in `await`. If any edit changes *what* is asserted,
   it is a behaviour change hiding in a perf PR.
2. **No `queryBy`-based absence assertion against section content runs before a
   resolved `findBy` in the same test.** That is the one way this refactor can
   make a test pass vacuously — the failure mode plan 021 exists to stop this
   repo repeating. (Absence assertions against the **topbar**, such as
   `listening.test.tsx:154`, are exempt: nothing there is behind a boundary.)

Verification: `npx vitest run` → 848 pass; ten consecutive UI runs identical.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc -b --noEmit` exits 0
- [ ] `npx vitest run` exits 0, `Test Files 24 passed`, `Tests 848 passed` — **the same count as the baseline**
- [ ] `npm run build` exits 0
- [ ] `ls dist/assets/*.js | wc -l` ≥ 3
- [ ] The entry chunk is **≤ 445 kB raw and ≤ 138 kB gzip** after stage 1, both read from `npm run build`'s printed line. Re-derived against the corrected baseline: 559,904 − 139,767 = **420,137 B raw** projected (Vite prints kB = 1000 B, so ~420.1 kB) and 174.03 − 41.19 = **~132.8 kB gzip**; the gates keep ~25 kB raw and ~5 kB gzip of headroom for bundler-version drift. If step 6 landed: **≤ 400 kB raw and ≤ 125 kB gzip** (projection 383.2 kB / ~119.7 kB).
- [ ] `npm run build 2>&1 | grep -c "larger than 500 kB"` returns 0 — the warning is gone because the chunk is smaller, and `chunkSizeWarningLimit` is unchanged (`git diff vite.config.ts` is empty)
- [ ] `grep -n "reading/tests\|listening/tests" src/App.tsx` shows **no value imports** — type-only imports are fine
- [ ] `grep -n "listening/speech" src/App.tsx` returns **no match** — the driver's fallback lives in `ListeningSection` now, and `src/types.ts:25`'s type-only import is the only reference left in the entry graph
- [ ] `grep -n "markAnswerKey\|markListening" src/App.tsx` returns no match — both moved into the containers with their call sites
- [ ] `grep -c "import ReadingRunner\|import ListeningRunner\|import ReadingPicker\|import ListeningPicker\|import ReadingReport\|import ListeningReport" src/App.tsx` returns 0
- [ ] `git status --porcelain package.json package-lock.json` is empty — no dependency added
- [ ] Ten consecutive `npx vitest run --project ui` print ten identical `Tests` lines
- [ ] The `plans/README.md` table under `## Bundle size` carries the measured before/after
- [ ] No files outside the Scope list are modified. Check with `git status --porcelain src/ tests/ vite.config.ts package.json`, **not** bare `git status`: the tree at `ae92bac` is already dirty in a known way (` M plans/README.md` plus ten untracked `plans/0NN-*.md` files), so a bare check reports noise that is not yours. `git status --porcelain src/` is empty at the baseline.
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at any `file:line` in "Current state" does not match the excerpt.
- The step-1 baseline is not 848 passing tests, or the entry chunk is more than
  10% away from **559.90 kB raw** (i.e. outside 503.9–615.9 kB) — the graph has
  changed and the projections in "Why this matters" no longer apply.
- **Step 2 (the pure extraction) requires editing any test file.** That means
  the move changed behaviour. Report what broke; do not paper over it with a
  test edit, because the whole point of doing the extraction as a separate
  commit is that it is provably behaviour-preserving.
- **Two of the ten UI runs differ.** Report the differing lines and which test
  varied. Do not re-run until green — that is the exact habit plan 007 was
  written to break.
- The measured entry chunk after stage 1 is **larger than 470 kB raw**. The
  split did not move the papers, which almost certainly means something still
  imports a registry at module scope from the entry graph. Find it with
  `npx vite build --mode production` and inspect the chunk, or bisect by
  commenting out `App.tsx` imports; report what you found.
- The measured entry chunk after stage 1 lands **above 445 kB and at or below
  470 kB raw** (the pass gate is `≤ 445 kB`, so this band starts strictly above it
  and the two never both apply to one measurement).
  This is the awkward middle: the split worked — the chunk moved — but something
  is still shared between the entry graph and the sections, so the papers or a
  large sibling did not leave. Do **not** improvise a fix and do not raise the
  gate. Report the full per-chunk table from `npm run build`, the four `grep`
  checks from "Done criteria", and stop. Likely culprits, in order: a value
  import left at `App.tsx:31-35`; a barrel (`src/listening/index.ts` re-exports
  `./player`) pulled in by something on the writing desk; or a shared
  `Suspense` boundary that let the bundler merge the two section chunks back
  into one.
- A test needs a `waitFor` with a raised timeout, or a `vi.advanceTimers` call,
  to pass. That is a timing hack and it will flake on someone else's machine.
- You find yourself wanting `manualChunks`, a router, or a raised
  `chunkSizeWarningLimit`. All three are out of scope and each is a different
  plan.
- The Suspense fallback is visible for more than a frame on a warm local
  `npm run preview`. The prefetch is not working and shipping a visible loading
  state on a local build would be a regression in feel for a saving nobody can
  perceive on that machine.

## Maintenance notes

For the human or agent who owns this code next:

- **This changes the slope, not just the intercept.** Every future paper —
  Reading #2 per module, Listening #2, plan 013's mock test — now lands in a
  section chunk instead of the entry chunk, *provided it is reached only through
  `ReadingSection`/`ListeningSection`*. The moment `App.tsx` imports something
  from `src/reading/tests/` or `src/listening/tests/` again, the whole saving
  silently reverts and no test will notice. The `grep` in Done criteria is the
  guard; consider keeping it as a one-line assertion in a test if it reverts
  once.
- **`plans/013-mock-test-mode.md` will want all three sections at once.** A mock
  sitting is Writing then Reading then Listening in sequence, so it should
  prefetch the next section as the current one starts rather than loading all
  three up front — the same thunks are already exported for that.
- **The section state is in `App.tsx` on purpose.** `readingStage` and
  `listeningStage` look like they belong in the containers, and the next person
  to read `ReadingSection.tsx` will want to move them. They cannot go: `App.tsx`
  writes the stage from `openReading`/`openListening` (`:456`, `:509`) while the
  container is unmounted, `inReadingTest`/`inListeningTest` (`:648`, `:651`)
  clear the desk on the same render the runner mounts, and the container is torn
  down on every navigation away, which would discard the stage, the test id, the
  session id and the practice flag. Step 2 of this plan spells out all three.
- **What a reviewer should scrutinise in this PR**: that the extraction commit
  touched no test; that every test edit is `getBy → await findBy` and nothing
  else; that no absence assertion (`queryBy`, `not.toBeInTheDocument`) against
  section content runs before a resolved query in the same test; that no topbar
  query was converted along the way; and that the measured chunk table in the PR
  body matches `npm run build`.
- **The 0.47 ms / 0.49 ms figures are worth keeping in the PR body.** They are
  what stops the next person "optimising" module evaluation, and they are the
  honest boundary of this plan's claim: it makes the app *download and parse*
  less, and it makes it start no faster once cached.
- **Deferred out of this plan, deliberately**: splitting the analysis engine
  (`accuracy.ts`, 17.7 kB) or the prompt bank (23.7 kB) — both are needed by the
  first screen and the first keystroke; a route-based architecture; preloading
  via `<link rel="modulepreload">` in `index.html`, which would put a second,
  hand-maintained copy of the chunk graph in a file the bundler does not own;
  and stage 2 if you chose not to land it, which is a clean follow-up worth
  −13 kB gzip on its own.
