# Plan 028: Ship the tapescript in the Listening report — collapsed per section, below the review

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. Do NOT edit `plans/README.md`; the reviewer who
> dispatched you maintains the index.
>
> **Drift check (run first)**:
> `git diff --stat d4ddef8..HEAD -- src/components/ListeningReport.tsx src/components/ListeningReport.css tests/ui/listening.test.tsx SPEC.md src/listening/types.ts src/listening/speech.ts src/listening/tests/test01.ts src/components/ListeningRunner.tsx src/components/PromptPicker.tsx`
> If any file quoted in "Current state" changed since this plan was written,
> compare the excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition. Every line number below was read off `d4ddef8`.

## Status

- **Priority**: P2
- **Effort**: S (half a day)
- **Risk**: LOW — one report component, one CSS file, two UI tests; no store, no engine, no runner change
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `d4ddef8`, 2026-08-10

## Why this matters

The canonical Listening study loop is: sit the paper, then read the tapescript
to find where each mark was lost. The real exam's practice books print the full
tapescript in the back for exactly this reason. This app authored complete
transcripts for every section — `src/listening/tests/test01.ts` carries 95 cues
across four sections, with speaker labels — and the report shows the learner
**none of it**. `src/components/ListeningReport.tsx` (380 lines) contains zero
occurrences of the string `transcript`, while its `test` prop carries the whole
`ListeningTest` whose every section includes one. The per-question
`explanation` line tells a learner roughly where the answer went past; the
tapescript is the primary source it paraphrases, and after submission there is
no doctrine reason to withhold it — the paper is over, and reading the script
of a finished recording is exactly what a learner with the real book would do.

The runner's rule ("the transcript is never shown while a voice is speaking",
`src/components/ListeningRunner.tsx:20-22`) is about the *sitting*, not the
*review*, and this plan does not touch the runner.

## Current state

Read each cited line before changing it. Line numbers are from `d4ddef8`.

### The report today — no transcript anywhere

`src/components/ListeningReport.tsx` is 380 lines. Verified at `d4ddef8`:

```
grep -c "transcript" src/components/ListeningReport.tsx   → 0
```

Its props (`src/types.ts:870-883`) already deliver everything needed:

```ts
export interface ListeningReportProps {
  session: ListeningSessionRecord;
  /**
   * The test as authored, for the question prompts and formats the result does
   * not carry. Null when the stored `testId` names content this build no longer
   * ships — the report still renders the score, the band and every answer.
   */
  test: ListeningTest | null;
```

Note `test` is **nullable**. The component already guards for that —
`ListeningReport.tsx:121-125`:

```tsx
  const questionById = useMemo(() => {
    const map = new Map<string, ListeningQuestion>()
    for (const question of test?.questions ?? []) map.set(question.id, question)
    return map
  }, [test])
```

The tapescript block must render **only when `test !== null`**, matching this
existing pattern: when the build no longer ships the paper there is no script
to print, and printing nothing is the component's documented behaviour for
missing content.

The report's layout is four blocks in one wrapper. The last content block is
the answer review, `ListeningReport.tsx:275`:

```tsx
      {/* 4 — every question against the key */}
      <section className="lrp-review card" aria-label="Answer review">
```

which closes at `:313` (`</section>`), followed by the wrapper's `</div>` at
`:314` and the component's end at `:316`. **The tapescript section goes between
`:313` and `:314`** — below the per-question review, so the score summary and
the review stay primary.

### The transcript types — what there is to render

`src/listening/types.ts`:

- `ListeningTranscript` at `:131-134`:

  ```ts
  /** A section's script: who speaks, and what they say, in order. */
  export interface ListeningTranscript {
    speakers: ListeningSpeaker[]
    cues: ListeningCue[]
  }
  ```

- `ListeningSection.transcript: ListeningTranscript` at `:162`, alongside
  `heading: string` at `:158` (e.g. `'Section 1'`).
- `ListeningSpeaker` at `:92-100` — `id`, `label` (e.g. `'ROSS'`,
  `'NARRATOR'`), optional `description`, `voice`.
- `ListeningCue` at `:110-128` — `id`, `speakerId`, `text`, optional
  `pauseBeforeSec`, optional `answersQuestions` (`:117-127`, "Review-screen
  only … Never consulted when marking").

### Reuse `sectionCues`, not a shared component

`src/listening/speech.ts:87-100` already flattens a section's transcript into
display-ready cues, resolving `speakerId` → label:

```ts
export function sectionCues(section: ListeningSection): SpeechCue[] {
  const byId = new Map(section.transcript.speakers.map((speaker) => [speaker.id, speaker]))

  return section.transcript.cues.map((cue) => {
    const speaker = byId.get(cue.speakerId)
    return {
      id: cue.id,
      speaker: speaker?.label ?? cue.speakerId,
      ...
```

It is pure, total, and exported; its doc comment (`:78-86`) explains why a cue
naming an undeclared speaker still renders with its raw id. **Import and call
it in the report** rather than duplicating the speaker map.

**Do NOT extract a shared TranscriptView component from the runner.** The
runner's transcript markup (`ListeningRunner.tsx:209-230`: `.lr-stage`,
`.lr-cues`, `.lr-cue-speaker`, `.lr-cue-text`) renders an *incremental reveal*
— the `revealed: readonly SpeechCue[]` prop grows during playback and the
current cue gets a `lr-cue-now` highlight tied to live playback state
(`:216-227`). The report needs a *static, complete* rendering with no reveal
state and no highlight. The only genuinely shared logic is the
transcript→cues flattening, and `sectionCues` already owns it. A shared
component would carry the runner's reveal props for nothing and couple the
report to a file this plan must not touch.

### The runner doctrine, and the test that already pins it

`src/components/ListeningRunner.tsx:20-22`:

```
 * 3. **The transcript is never shown while a voice is speaking.** Under the
 *    fallback driver the revealed text IS the exercise; under a real voice it
 *    would be subtitles, and a subtitled listening test is a reading test.
```

This is already pinned by two existing UI tests — do **not** duplicate them:

- `tests/ui/listening.test.tsx:238-249` — `'never prints the words while a
  voice is speaking'`: sits the paper under the speaking `FakeSpeechDriver`,
  plays section 1, then asserts
  `expect(document.body.textContent).not.toContain(firstCue.text)`.
- `tests/ui/listening.test.tsx:251-266` — the inverse: under the fallback
  `transcriptDriver()` the words DO print.

Both run **mid-paper, before submit**, so a tapescript that exists only on the
post-submit report cannot trip them. If either fails after your change, the
tapescript has leaked into the runner — that is a STOP condition, not a test to
adjust.

### The repo's disclosure pattern: native `<details>`

Verified: `grep -rn "aria-expanded\|<details\|<summary" src/components/` finds
one `<details>` disclosure — `src/components/PromptPicker.tsx:153-154`:

```tsx
            <details className="pp-parts">
              <summary className="pp-parts-summary">
```

with a caret SVG inside the summary that rotates via
`.pp-parts[open] .pp-parts-caret` (`src/components/PromptPicker.css:176-184`;
the whole pattern is `:137-199`, including hover/active/focus-visible states
and `::-webkit-details-marker` suppression at `:157`). The two
`aria-expanded` hits (`FeedbackPanel.tsx:242`, `Report.tsx:635`) are
button-toggled note panels tied to per-item state — heavier than needed here.
**Match the PromptPicker pattern**: native `<details>`/`<summary>`, zero JS,
collapsed by default, caret rotating on `[open]`.

### Two `<details>` facts your tests depend on (verified at `d4ddef8`)

1. **Content inside a closed `<details>` is still in the DOM.** So "collapsed
   by default" must be asserted with the `open` property and jest-dom's
   `.toBeVisible()` / `.not.toBeVisible()` — jest-dom (v7, wired in
   `tests/ui/setup.ts:7`) treats non-summary content of a closed `<details>`
   as not visible. Never assert collapse via `queryByText(...)` absence — the
   text IS there.
2. **jsdom 30.0.1 (the installed version) toggles `details.open` on summary
   click.** Verified by script at `d4ddef8`: dispatching a click on the
   `<summary>` flipped `open` from `false` to `true`. So
   `user.click(summary)` is a real expand.

### The content you will assert against

`src/listening/tests/test01.ts` (exported as `LISTENING_TEST_01` from
`src/listening/tests`, already imported by `tests/ui/listening.test.tsx:28`):

- Section headings `'Section 1'`–`'Section 4'` at `:198`, `:441`, `:626`,
  `:837`. Four sections, 95 cues in total.
- Cue `ls1-c02`, `test01.ts:219`:

  ```ts
  text: 'Good morning, Harbour View Cottages, Ross speaking.',
  ```

  This exact string appears in **exactly one cue** in the whole paper
  (verified by script at `d4ddef8`) and is a single string literal, not a
  `line(...)` join — so `screen.getByText()` on it is unambiguous.
- Speaker label `'ROSS'` is declared at `test01.ts:87`.
- **No question `explanation` string equals any cue text** (verified by
  script: 40 explanations × 95 cues, 0 exact matches), so the existing
  `getByText(explanation)` assertion at `tests/ui/listening.test.tsx:536-538`
  cannot become ambiguous when the tapescript enters the report DOM.

### CSS you must reuse

`src/components/ListeningReport.css` (353 lines) — tokens from DESIGN.md.
Reuse: `card` + `eyebrow` (as `.lrp-formats`/`.lrp-review` do at
`ListeningReport.tsx:240-241`, `:275-277`), `mono` for speaker labels (as the
runner's `.lr-cue-speaker mono` does at `ListeningRunner.tsx:224`), and the
variables already used in this file: `--rule-line`, `--ink`, `--ink-soft`,
`--exam-navy`, `--radius`, `--paper`. A new `lrp-tapescript*` block appended
to this file is expected; new colour values are not.

### Repo conventions that bind this plan

- **React 18 + TS strict + Vite. Runtime deps are exactly `react` +
  `react-dom`** — add nothing. `localStorage` only; no network at runtime.
- **UI tests MUST render through `renderApp()`** from `tests/ui/renderApp.tsx`
  (pins the prompt draw and the speech driver); `render(<App />)` reintroduces
  a known flake. You are adding cases to `tests/ui/listening.test.tsx`, which
  already complies.
- **`npx tsc -b --noEmit` typechecks `src/` only** — tsconfig `include` is
  `["src"]`, so `tests/` is not gated today. Plan 024 will typecheck tests:
  write test code that survives it (no `any`, no missing required fields, no
  unused imports).
- **Comments explain WHY** — the failure mode prevented. Both report files are
  written that way; match them.
- **Plan 023 coordination**: plan 023 extracts Reading/Listening sections out
  of `App.tsx`. This plan touches **no line of `App.tsx`**, so the two do not
  collide and may proceed concurrently.
- 853 tests green across 24 files at `d4ddef8` — verified by running the full
  suite, not quoted from elsewhere.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npx tsc -b --noEmit` | exit 0, no output |
| Full suite | `npx vitest run` | **853 passed / 24 files** at `d4ddef8`; 855 after this plan |
| Listening UI only | `npx vitest run tests/ui/listening.test.tsx` | all pass |
| UI project | `npx vitest run --project ui` | all pass |
| Build | `npm run build` | exit 0 |

After any UI change, run `npx vitest run --project ui` **ten consecutive
times** and confirm identical results.

## Scope

**In scope** (the only files you may modify):

- `src/components/ListeningReport.tsx` — the tapescript section
- `src/components/ListeningReport.css` — its styles
- `tests/ui/listening.test.tsx` — two new cases in the existing
  `'the Listening report'` describe
- `SPEC.md` — record the new report behaviour

**Coordination — plan 030 Phase C**: plan 030's technique disclosures ALSO
modify `ListeningReport.tsx`, `ListeningReport.css` and
`tests/ui/listening.test.tsx`. The two plans must not run concurrently; the
recommended order is **028 before 030**, and whichever lands second rebases
onto the other's changes to those three files.

**Out of scope** (do NOT touch, even though they look related):

- `src/components/ListeningRunner.tsx` / `ListeningRunner.css` — the
  play-once doctrine lives there; this plan is report-only by definition.
- `src/listening/**` — no type change, no content change, no change to
  `sectionCues` (you only *call* it).
- `src/App.tsx` — nothing here needs it, and plan 023 is rearranging it.
- `tests/ui/renderApp.tsx` — the determinism pin; adding anything here risks
  every UI test.
- Linking each question's explanation to its transcript line. The cue-level
  anchors for it **already exist and are unconsumed** —
  `ListeningCue.answersQuestions` (`src/listening/types.ts:117-127`) is
  authored on 36 cues in `test01.ts` and read by no code outside the type
  declaration (verified by grep at `d4ddef8`). That makes the future feature
  cheap, but it is UI + navigation design work deferred deliberately; see
  Maintenance notes. Do not build it and do not consume `answersQuestions`
  here.
- `plans/README.md` — the reviewer owns the index.

## Git workflow

- Branch: `advisor/028-listening-tapescript`, off `main`.
- One commit per step or logical unit; message style matches `git log`: a
  plain imperative sentence, e.g. `Show the tapescript in the Listening
  report, collapsed per section`.
- Do NOT push and do NOT open a PR.

## Steps

### Step 1: Confirm the baseline

Run, from the repo root:

- `git log -1 --format=%h` → `d4ddef8` (or run the drift check in the header
  if HEAD has moved).
- `grep -c "transcript" src/components/ListeningReport.tsx` → `0`.
  (`grep -c` prints `0` and exits 1 when there are no matches — that exit 1
  IS the expected success here.)
- `npx vitest run` → `853 passed (853)`, `24 passed (24)` files.

**Verify**: all three outcomes above, exactly.

### Step 2: Add the tapescript section to `ListeningReport.tsx`

All edits in `src/components/ListeningReport.tsx`.

**2a — imports.** Add `ListeningSection` to the existing type import from
`'../listening/types'` (`:26-30`), and add:

```ts
import { sectionCues } from '../listening/speech'
```

**2b — the section.** Insert a new block between the answer-review
`</section>` (`:313`) and the wrapper `</div>` (`:314`), rendered only when
`test !== null`:

```tsx
      {/* 5 — the tapescript, collapsed. After submission the paper is over,
          so showing the script is the practice-book back-matter, not
          subtitles: the runner's never-show-mid-test rule is about the
          sitting, and this screen only exists once the sitting has ended.
          Collapsed by default because the score and the review stay primary —
          the script is where a learner goes to find a specific lost mark. */}
      {test !== null && (
        <section className="lrp-tapescripts card" aria-label="Tapescript">
          <h2 className="eyebrow">Tapescript</h2>
          <p className="lrp-tapescripts-lead">
            The full script of each section, exactly as spoken. Open the section where you lost a
            mark and find the line that carried the answer.
          </p>
          {test.sections.map((section) => (
            <TapescriptSection key={section.id} section={section} />
          ))}
        </section>
      )}
```

(The lead copy above is a suggestion in the app's register; keep it or write
equivalent copy in the same voice — plain, second person, says what to do.)

**2c — the per-section disclosure.** Add a small component beside `AnswerRow`
(after `:316`, in the same file):

```tsx
function TapescriptSection({ section }: { section: ListeningSection }): JSX.Element
```

(signature only — you write the body). It renders:

- `<details className="lrp-tapescript">` — **no `open` attribute**; collapsed
  is the default and the point.
- `<summary className="lrp-tapescript-summary">` containing a caret SVG and
  the section name, following the PromptPicker summary exactly
  (`PromptPicker.tsx:154-171`: inline SVG, `aria-hidden="true"`, class on the
  caret so CSS can rotate it on `[open]`). Summary text:
  `{section.heading} — {section.rubric}` or just `{section.heading}`; include
  at least the heading verbatim so a learner can match it to the tabs they
  answered under.
- Inside the details, an `<ol>` of `sectionCues(section)` — one `<li>` per
  cue with the speaker label in a `mono` span and the cue text beside it,
  structurally like the runner's `:216-227` list but with report-local class
  names (`lrp-cue`, `lrp-cue-speaker`, `lrp-cue-text`) and **no** now-playing
  state. `key={cue.id}` — cue ids are unique within the test
  (`src/listening/types.ts:112`).

Do not render `pauseBeforeSec`, `answersQuestions`, or voice hints — the
script as printed matter is speakers and words.

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `grep -c "sectionCues" src/components/ListeningReport.tsx` → `2`
(import + call).

### Step 3: Style it in `ListeningReport.css`

Append a `/* ------------------------------- tapescript */` block to
`src/components/ListeningReport.css` styling `.lrp-tapescripts`,
`.lrp-tapescripts-lead`, `.lrp-tapescript`, `.lrp-tapescript-summary`,
`.lrp-cue`, `.lrp-cue-speaker`, `.lrp-cue-text`. Constraints:

- Card padding to match its siblings: `.lrp-formats, .lrp-review` use
  `padding: 18px 22px` (`ListeningReport.css:129-132`) — add
  `.lrp-tapescripts` to that shared rule or repeat the value.
- Lead paragraph mirrors `.lrp-formats-lead` (`:134-140`): 13.5px,
  `--ink-soft`, max-width ~70ch.
- Summary: pointer cursor, `list-style: none` +
  `::-webkit-details-marker { display: none }` and a caret rotated by
  `.lrp-tapescript[open] .lrp-tapescript-caret` — the PromptPicker pattern
  (`PromptPicker.css:137-199`); include a `:focus-visible` outline as it does
  (`:171`).
- Speaker labels: small mono caps in `--ink-soft`, min-width so the script
  column aligns — the runner's look, report-local classes.
- Cue text: readable prose (13.5–14.5px, line-height ≥1.5), `--ink`.
- Only existing CSS variables; no new colour literals.

**Verify**: `npm run build` → exit 0.
**Verify**: `grep -c "lrp-tapescript" src/components/ListeningReport.css` →
≥ 5.

### Step 4: Tests — two new cases in `tests/ui/listening.test.tsx`

Add both inside the existing `describe('the Listening report', …)`
(`:442-578`), reusing its `sitPaper` helper (`:455-467`) — it submits a real
paper and waits for the report. Import nothing new except what these cases
need; `LISTENING_TEST_01` is already imported (`:28`).

**Case A — `'ships the tapescript per section, collapsed, below the review'`**:

1. `renderApp()`; `await sitPaper(user)`.
2. `const details = document.querySelectorAll<HTMLDetailsElement>('details.lrp-tapescript')` →
   `expect(details).toHaveLength(4)`.
3. Every one collapsed: `for (const d of details) expect(d.open).toBe(false)`.
4. The authored line is in the DOM but not visible (the closed-`<details>`
   fact from Current state):
   `expect(screen.getByText('Good morning, Harbour View Cottages, Ross speaking.')).not.toBeVisible()`.
5. Below the review: with
   `const review = document.querySelector('.lrp-review')` and
   `const tape = document.querySelector('.lrp-tapescripts')`, assert
   `expect(review!.compareDocumentPosition(tape!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()`.

**Case B — `'expanding a tapescript section reveals the authored script'`**:

1. `renderApp()`; `await sitPaper(user)`.
2. Click the first summary:
   `await user.click(document.querySelector('.lrp-tapescript-summary') as HTMLElement)`.
3. `expect(document.querySelector<HTMLDetailsElement>('details.lrp-tapescript')!.open).toBe(true)`.
4. `expect(screen.getByText('Good morning, Harbour View Cottages, Ross speaking.')).toBeVisible()` —
   the phrase is `test01.ts:219`, unique in the paper.
5. Speaker labels render: `expect(screen.getAllByText('ROSS').length).toBeGreaterThan(0)`
   (`getAllByText`, not `getByText` — ROSS speaks many cues).

Do NOT add a new runner-side test: the mid-test guard is already pinned at
`:238-249` and `:251-266` (quoted in Current state). Both must still pass
untouched — that is Step 6's check, and their failing is a STOP condition.

**Verify**: `npx vitest run tests/ui/listening.test.tsx` → all pass, including
the 2 new cases.

### Step 5: Mutation-check both new tests

Each guard the tests pin must be shown to have teeth. Run inside your branch;
revert each mutation with `git checkout -- <file>` before proceeding.

1. **Collapsed-by-default has teeth**: in `ListeningReport.tsx`, temporarily
   change `<details className="lrp-tapescript">` to
   `<details className="lrp-tapescript" open>`. Run
   `npx vitest run tests/ui/listening.test.tsx` → Case A **fails** (the
   `expect(d.open).toBe(false)` loop and/or the `.not.toBeVisible()`
   assertion). Revert; re-run; passes.
2. **The script content is really asserted**: temporarily render an empty
   string in place of the cue text (e.g. `{''}` instead of the cue's text in
   `TapescriptSection`). Run the file → Case B **fails** (`getByText` cannot
   find the Harbour View line). Revert; re-run; passes.

Report all four observations (fail, pass, fail, pass) in your completion
message.

**Verify**: after both reverts, `git status --porcelain -- src/components/`
shows only your intended final edits and
`npx vitest run tests/ui/listening.test.tsx` → all pass.

### Step 6: Prove the runner is untouched and the suite is whole

- `git diff --name-only main..HEAD` → exactly:
  `SPEC.md` (after step 7 — at this step, the three code/test files),
  `src/components/ListeningReport.css`, `src/components/ListeningReport.tsx`,
  `tests/ui/listening.test.tsx`. **`ListeningRunner.tsx` must not appear.**
- `npx vitest run` → **855 passed** (853 + the 2 new cases), 24 files.
- The two doctrine tests (`:238-249`, `:251-266` in the pre-change numbering)
  pass unmodified: `git diff main..HEAD -- tests/ui/listening.test.tsx` shows
  only *added* lines inside the report describe, no edits to existing cases.

### Step 7: SPEC.md

SPEC.md is canonical and this is a behaviour change, so record it. Two edits:

1. Extend the **`ListeningReport`** bullet (`SPEC.md:1254-1258`) with a
   sentence in its register, e.g.: the full tapescript of every section,
   collapsed by default below the review, speakers labelled — the
   practice-book back-matter, shown only after submission.
2. Immediately after the runner-doctrine sentence (`SPEC.md:1099-1101`,
   "printing the script while a voice speaks would be subtitling…"), add one
   clarifying sentence: the rule ends when the paper does — the report prints
   the full tapescript after submission, which is what the practice books do.

Currently `grep -ci "tapescript" SPEC.md` → `0` (verified at `d4ddef8`).

**Verify**: `grep -ci "tapescript" SPEC.md` → ≥ 2.

### Step 8: Full green

- `npx tsc -b --noEmit` → exit 0.
- `npx vitest run` → 855 passed, 24 files.
- `npm run build` → exit 0.
- `npx vitest run --project ui` ten consecutive times → identical results.

## Test plan

| File | Cases |
|---|---|
| `tests/ui/listening.test.tsx` (extend the `'the Listening report'` describe) | **A**: 4 `details.lrp-tapescript`, all `open === false`, the `test01.ts:219` line present-but-not-visible, tapescript section positioned after `.lrp-review` · **B**: clicking the first summary sets `open === true`, the `test01.ts:219` line becomes visible, `ROSS` labels render |

Structural pattern: the existing report cases in the same describe
(`:469-479` is the closest model — `renderApp()`, `sitPaper`, then DOM
assertions). Both new cases go through `sitPaper`, so they exercise the real
submit path, not a mounted component. Mutation checks per Step 5. The runner
doctrine needs no new test — `:238-249` and `:251-266` already pin it and must
pass unchanged.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc -b --noEmit` exits 0
- [ ] `npx vitest run` exits 0 with **855 passed / 24 files** (853 at
      `d4ddef8` + 2 new)
- [ ] `npm run build` exits 0
- [ ] `npx vitest run --project ui` produces identical results across 10
      consecutive runs
- [ ] `grep -c "sectionCues" src/components/ListeningReport.tsx` → `2`
- [ ] `grep -c "lrp-tapescript" src/components/ListeningReport.css` → ≥ 5
- [ ] `grep -ci "tapescript" SPEC.md` → ≥ 2 (was 0 at `d4ddef8`)
- [ ] `git diff --name-only main..HEAD` lists exactly the four in-scope files;
      `ListeningRunner.tsx` is absent
- [ ] `git status --porcelain -- . ':!plans/'` shows nothing unexpected
      (the exclusion matters: the baseline tree carries untracked
      `plans/*.md`, so a bare `git status --porcelain` is never clean —
      do not treat those entries as your changes)
- [ ] Both mutation checks (Step 5) were run and all four observations
      reported

## STOP conditions

Stop and report back (do not improvise) if:

- Any excerpt in "Current state" does not match the live file (drift since
  `d4ddef8`).
- Either doctrine test (`'never prints the words while a voice is
  speaking'`, `'DOES print the words when there is no voice, and only then'`)
  fails after your change. That means transcript text is reaching the runner
  DOM — a doctrine break, not a flake, and not a test to loosen.
- Any *existing* report test fails with a "multiple elements" `getByText`
  error. At `d4ddef8` no explanation string equals any cue text (verified),
  so an ambiguity means either drift in `test01.ts` or your markup
  duplicating text outside the details — report which.
- `user.click` on the summary does not flip `details.open` in jsdom. The
  installed jsdom 30.0.1 does this (verified by script); if it stops, the
  environment drifted — do not swap the disclosure for a JS-toggled div to
  work around it without reporting first.
- You find yourself wanting to edit `ListeningRunner.tsx`, `App.tsx`,
  anything under `src/listening/`, or `renderApp.tsx` — all out of scope;
  report why it seemed necessary.
- Case A or B still passes under its Step 5 mutation. The test is not pinning
  what it claims; fix the test, not the mutation.

## Maintenance notes

For whoever owns this code next:

- **The tapescript is report-only by doctrine.** The runner's rule
  (`ListeningRunner.tsx:20-22`) is now bracketed in SPEC.md by the sentence
  added in Step 7: never during the sitting, always after it. Any future
  "peek at the script" feature mid-test is a product regression, not a UX
  improvement.
- **`sectionCues` now has two callers** (the playback path in
  `speech.ts`/the runner, and the report). Its "undeclared speaker renders
  its raw id" behaviour is what keeps a content typo from blanking a report
  line; keep that if the function is ever touched.
- **The deferred feature is closer than it looks**:
  `ListeningCue.answersQuestions` (`src/listening/types.ts:117-127`) is
  authored on 36 cues of `test01.ts` and consumed by nothing. Linking each
  wrong answer's row to the cue that carries it is now mostly a UI/anchor
  problem (an `id` per cue `<li>` and a link from `AnswerRow`), plus a
  decision about auto-expanding the right `<details>`. Deferred here because
  it changes the review's information design, not because data is missing.
- **What a reviewer should scrutinise**: that the section renders nothing
  when `test === null` (deleted-content builds); that no `open` attribute
  crept onto the `<details>`; that the new tests assert *visibility*, not
  DOM presence, for collapse; and that the diff touches exactly four files.
