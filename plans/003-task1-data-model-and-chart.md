# Plan 003: Add the Task 1 prompt data model, a 12-prompt bank with real chart data, and an SVG chart renderer

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: this repository is **not under version control**
> at the time of writing. Confirm the excerpts quoted in "Current state" appear
> verbatim in the live files. Also confirm plan 001 has landed:
> `grep -n "SCHEMA_VERSION = 2" src/profile/store.ts` must return a match. If it
> does not, STOP — this plan depends on it.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW — additive only; no existing behaviour changes
- **Depends on**: `plans/001-schema-migration-and-task-field.md`
- **Category**: direction
- **Planned at**: no VCS — written 2026-08-05 against the working tree as read on that date

## Why this matters

IELTS Academic Writing Task 1 asks the candidate to describe a chart, graph,
table, map or process in ≥ 150 words in 20 minutes. `SPEC.md:196` lists Task 1
as deliberately cut from v1. The reason it was cut is real: a deterministic,
offline, no-LLM engine cannot read a chart image, so it cannot tell whether the
candidate described the data correctly.

**The way around that is to author the data instead of the image.** If each
Task 1 prompt carries its chart as structured numbers, the app can render the
chart itself as SVG *and* the analysis engine gains something no competing tool
has deterministically: it can check whether the learner named the actual
highest value, whether they cited a figure that does not exist in the data, and
whether they stated an overview at all. That factual check is only possible
because we own the numbers.

This plan builds the foundation — types, a prompt bank, derived chart facts, and
the renderer. It adds **no analysis rules and no UI wiring**; those are plans 004
and 005. After this plan the app behaves exactly as it does today, with new
unused-but-tested modules alongside.

## Current state

### The existing prompt contract — `src/types.ts:9-27`

```ts
export type QuestionType =
  | 'opinion'                    // "To what extent do you agree or disagree?"
  | 'discussion'                 // "Discuss both views and give your own opinion."
  | 'problem-solution'           // "What problems does this cause? What solutions...?"
  | 'advantages-disadvantages'   // "Do the advantages outweigh the disadvantages?"
  | 'double-question';           // Two direct questions.

export interface PromptSpec {
  id: string;
  type: QuestionType;
  /** Full task text shown to the learner, ending with the standard instruction. */
  text: string;
  /** Short topic tag, e.g. "education", "environment". */
  topic: string;
  /** The parts a complete answer must address, phrased as a checklist. */
  parts: string[];
  /** Content words from the prompt, lowercase — used for prompt-echo and relevance checks. */
  keywords: string[];
}
```

`PromptSpec` is consumed by `RuleFn` (`src/types.ts:189`):

```ts
export type RuleFn = (doc: TokenizedDoc, prompt: PromptSpec | null) => Issue[];
```

and by every rule module, `analyzeEssay`, `App.tsx` and `PromptPicker.tsx`.
**This plan must not change `PromptSpec`.** Task 1 gets a sibling type.

### The existing prompt bank — `src/prompts/bank.ts:1-30`

```ts
/**
 * Prompt bank: 40 realistic IELTS Academic Writing Task 2 prompts,
 * 8 per question type, topics spread across education, technology,
 * environment, health, society, work, government, culture, transport, media.
 *
 * Every `keywords` entry is a lowercase single content word: ...
 */
import type { PromptSpec } from '../types'

/** Standard Task 2 instruction — every prompt text ends with this, verbatim. */
const STANDARD =
  'Give reasons for your answer and include any relevant examples from your own knowledge or experience. Write at least 250 words.'

export const PROMPTS: PromptSpec[] = [
  /* ------------------------------- opinion -------------------------------- */
  {
    id: 'op-01',
    type: 'opinion',
    topic: 'education',
    text: `Some people believe that university education should be free for all students, regardless of their financial background. To what extent do you agree or disagree? ${STANDARD}`,
    parts: [
      'State clearly how far you agree that university education should be free',
      'Give reasons that deal with cost, access or fairness',
      'Restate your position in the conclusion',
    ],
    keywords: ['university', 'education', 'free', 'students', 'financial', 'background', 'tuition', 'fees', 'scholarships', 'degree', 'graduates', 'funding', 'taxpayers', 'affordable'],
  },
```

Note the id convention: a two-letter type prefix plus a zero-padded ordinal
(`op-01`, and by inspection `ds-`, `ps-`, `ad-`, `dq-` for the other types).
Task 1 ids follow the same shape with a `t1-` prefix.

### Repo conventions you must match

- **TypeScript strict**, no `any`. No new runtime dependencies —
  `package.json` has exactly `react` and `react-dom` and that is a stated
  architectural property (`README.md:67`: "No runtime dependencies beyond
  React"). The chart renderer is hand-written SVG. Do **not** add a chart
  library.
- **Components**: one `.tsx` per component in `src/components/`, each importing
  a co-located `.css` file of the same name — see
  `src/components/StructureRail.tsx:1-4`:

  ```ts
  import type { CSSProperties } from 'react'
  import type { ParagraphRole, StructureCheck, StructureRailProps } from '../types'
  import { QUESTION_TYPE_META } from '../meta'
  import './StructureRail.css'
  ```

  Props interfaces live in `src/types.ts` under the
  `/* ---- component props ---- */` banner (`src/types.ts:238`), not in the
  component file. Follow both conventions.
- **Design tokens** are CSS custom properties defined in `src/index.css` and
  specified in `DESIGN.md:23-45`. The chart must use them, never hard-coded
  hex. The ones you need:
  - `--ink: #1C2536` (primary text/lines), `--ink-soft: #5A6478` (axis labels)
  - `--rule-line: #E2E6DF` (gridlines, hairlines)
  - `--sheet: #FDFDFB` (chart surface)
  - `--exam-navy: #24344D` (primary data series)
  - `--font-mono` with `font-variant-numeric: tabular-nums` for all numeric
    readouts — `DESIGN.md:13` is explicit: "Timer, word count and band digits
    are tabular monospace — instrument readouts, not decoration." Axis numbers
    are instrument readouts.
  - **`--marking-red` is reserved exclusively for errors** (`DESIGN.md:9`:
    "Examiner red is reserved exclusively for errors — it is semantic, never
    decorative"). A chart series must NEVER use it.
  - Quality floor (`DESIGN.md:44-45`): keyboard focus always visible, responsive
    to ~900px, `prefers-reduced-motion` respected.
- **Pure analysis modules**: `deriveChartFacts` goes in `src/analysis/`, is
  pure and synchronous, and must not import React.
- **Doc comments** on every export, saying what it returns and its behaviour on
  degenerate input. See `src/analysis/tokenize.ts:177-219` for the house style
  (a long `@param`/`@returns`/`@example` block on the main export).
- **Defensive by design**: `src/analysis/rules/structure.ts:4-7` states the
  principle — "an empty essay yields no paragraphs, a stable set of unsatisfied
  checks and no issues — nothing here divides or indexes into an empty array."
  `deriveChartFacts` must survive an empty series, all-null values, and a
  single data point without throwing or dividing by zero.
- **SPEC.md is canonical.** Step 6 adds the Task 1 section.
- **`IssueCategory` is frozen.** This plan adds no categories (plan 004 does).

## Commands you will need

| Purpose   | Command                                       | Expected on success |
|-----------|-----------------------------------------------|---------------------|
| Typecheck | `npx tsc -b --noEmit`                         | exit 0, no output   |
| Tests     | `npx vitest run`                              | all files pass      |
| One file  | `npx vitest run tests/task1-chart.test.ts`    | all pass            |
| Build     | `npm run build`                               | exit 0              |
| Dev       | `npm run dev`                                 | serves on :5173     |

Dependencies are installed. Do **not** run `npm install` and do **not** add any
package.

## Scope

**In scope**:

- `src/types.ts` (modify — add Task 1 types under a new banner; touch nothing existing)
- `src/prompts/task1Bank.ts` (create)
- `src/analysis/chartFacts.ts` (create)
- `src/components/Chart.tsx` (create)
- `src/components/Chart.css` (create)
- `tests/task1-chart.test.ts` (create)
- `SPEC.md` (modify — append a Task 1 section)

**Out of scope** (do NOT touch):

- `src/prompts/bank.ts` — the Task 2 bank is untouched. Task 1 prompts live in
  a separate file so the two banks stay independently browsable.
- `src/analysis/engine.ts`, `bandEstimate.ts`, `src/analysis/rules/**` — no
  analysis routing or rules in this plan. That is plan 004.
- `src/App.tsx`, `src/components/PromptPicker.tsx`, `src/meta.ts` — no UI
  wiring, no task switcher, no `Criterion` change. That is plans 004 and 005.
- `PromptSpec`, `QuestionType`, `RuleFn` — unchanged. Task 1 gets siblings, not
  edits. Widening `RuleFn`'s prompt parameter now would ripple through six rule
  modules for no benefit at this stage.
- `IssueCategory` — frozen; no additions here.

## Git workflow

- Branch: `advisor/003-task1-data-model`
- One commit per step; plain imperative subjects.
- Do NOT push and do NOT open a PR.

## Steps

### Step 1: Add the Task 1 types

In `src/types.ts`, insert a new section immediately **after** the existing
prompts block (after `PromptSpec` closes at `src/types.ts:27`) and **before**
the `/* ---- band criteria ---- */` banner:

```ts
/* --------------------------------- task 1 ----------------------------------- */

/** What an IELTS Academic Task 1 visual actually is. */
export type Task1VisualKind = 'line' | 'bar' | 'pie' | 'table' | 'process';

/**
 * One named data series. `values` is index-aligned with `Task1Chart.categories`;
 * a `null` entry means "no data for this category" and is rendered as a gap,
 * never as zero.
 */
export interface Task1Series {
  name: string;
  values: Array<number | null>;
}

/**
 * The chart as DATA, not as an image — this is what makes deterministic Task 1
 * analysis possible. Because the app owns the numbers, the rules can check
 * whether a learner cited a figure that exists, named the real maximum, and
 * covered the actual trend.
 *
 * `process` charts carry no numbers: they use `steps` and leave `series` empty.
 */
export interface Task1Chart {
  kind: Task1VisualKind;
  /** Chart title as it would be printed above the visual in the exam. */
  title: string;
  /** Unit of the values, e.g. "%", "million tonnes", "students". Used in feedback copy. */
  unit: string;
  /** x-axis / row labels, e.g. ["1990", "2000", "2010"] or ["Cycling", "Bus"]. */
  categories: string[];
  /** Empty for `process` charts. */
  series: Task1Series[];
  /** Ordered step labels — `process` charts only; empty otherwise. */
  steps: string[];
  /** Optional axis captions. */
  xLabel?: string;
  yLabel?: string;
}

/**
 * A Task 1 prompt. Deliberately a SIBLING of PromptSpec rather than an
 * extension: Task 1 has no QuestionType, and every Task 2 rule that takes a
 * `PromptSpec` would otherwise have to defend against a shape it cannot use.
 */
export interface Task1PromptSpec {
  id: string;
  /** Always the literal 'task1' — lets a union of the two prompt kinds discriminate. */
  task: 'task1';
  /** Full task text shown to the learner, ending with the standard Task 1 instruction. */
  text: string;
  /** Short topic tag, e.g. "energy", "transport". */
  topic: string;
  chart: Task1Chart;
  /** The parts a complete answer must address, phrased as a checklist. */
  parts: string[];
  /** Content words from the prompt and chart labels, lowercase — for prompt-echo and relevance. */
  keywords: string[];
}

/**
 * Facts derived from a Task1Chart, computed once and reused by the analysis
 * rules. See `analysis/chartFacts.ts`.
 */
export interface Task1ChartFacts {
  /** Every distinct numeric value present in the chart, for the "invented figure" check. */
  values: number[];
  /** Highest value with the series and category it belongs to; null when the chart has no numbers. */
  peak: { series: string; category: string; value: number } | null;
  /** Lowest value, same shape. */
  trough: { series: string; category: string; value: number } | null;
  /** Largest single step-to-step increase across all series; null when fewer than 2 points. */
  biggestRise: { series: string; from: string; to: string; delta: number } | null;
  /** Largest single step-to-step decrease; null when fewer than 2 points. */
  biggestFall: { series: string; from: string; to: string; delta: number } | null;
  /** True when at least two series exist — a comparison is then expected of the learner. */
  comparative: boolean;
}
```

Also, in the component-props section (after `PromptPickerProps` at
`src/types.ts:296-300`), add:

```ts
export interface ChartProps {
  chart: Task1Chart;
  /** Accessible caption; falls back to `chart.title` when omitted. */
  caption?: string;
}
```

Do not modify any existing type.

**Verify**: `npx tsc -b --noEmit` → exit 0 (types are additive; nothing uses
them yet).

### Step 2: Write `deriveChartFacts`

Create `src/analysis/chartFacts.ts`. It exports one pure function:

```ts
export function deriveChartFacts(chart: Task1Chart): Task1ChartFacts
```

Requirements — all of these are load-bearing for plan 004's rules:

- `values`: every non-null number across every series, **deduplicated and
  sorted ascending**. For a `table` chart this is the same walk. For `process`
  charts (no series) it is `[]`.
- `peak` / `trough`: scan all series × categories. Ties resolve to the **first**
  occurrence in series order then category order, so the result is deterministic.
  `null` when there are no numeric values.
- `biggestRise` / `biggestFall`: within each series, compare consecutive
  **non-null** pairs only — a null between two points does not create a false
  step. Rise means `delta > 0`, fall means `delta < 0`; `delta` is stored as a
  positive magnitude for `biggestFall` (document this on the type — update the
  doc comment in `types.ts` if you change the convention, but prefer positive
  magnitude for both since the field names already carry the direction).
  `null` when the series has fewer than 2 non-null points.
- `comparative`: `chart.series.length >= 2`.
- **Degenerate input must not throw.** Empty `series`, empty `categories`,
  all-null `values`, a single data point, and `series` longer than `categories`
  (extra values ignored) all return a well-formed `Task1ChartFacts`. Never
  index past `categories.length`; never divide.
- Floating-point: values come from the authored bank and are already rounded.
  Do not round again, and do not use `===` on computed deltas anywhere in the
  facts (comparisons for max/min are fine).

Write the doc comment in the house style — a `@param`, `@returns`, and a short
`@example` — modelled on `src/analysis/tokenize.ts:177-219`.

**Verify**: `npx tsc -b --noEmit` → exit 0.

### Step 3: Author the Task 1 prompt bank

Create `src/prompts/task1Bank.ts` exporting:

```ts
export const TASK1_PROMPTS: Task1PromptSpec[]
export function randomTask1Prompt(): Task1PromptSpec
```

`randomTask1Prompt` mirrors `randomPrompt()` in `src/prompts/bank.ts` — read
that function and match its implementation exactly.

Write **12 prompts**, ids `t1-01` … `t1-12`, distributed:

| Count | kind | Notes |
|---|---|---|
| 4 | `line` | multi-year trends; at least two with 2+ series so `comparative` is true |
| 3 | `bar` | at least one grouped (2+ series) |
| 2 | `pie` | single series summing to 100 with `unit: '%'` |
| 2 | `table` | 2+ series, mixed units in the title not the values |
| 1 | `process` | `series: []`, `steps: [...]`, `categories: []` |

Every prompt's `text` must end with the standard Task 1 instruction, defined
once as a module constant mirroring `STANDARD` in `bank.ts`:

```ts
/** Standard Task 1 instruction — every prompt text ends with this, verbatim. */
const STANDARD_T1 =
  'Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.'
```

Data authoring rules — these matter because plan 004's rules trust them:

- **Numbers must be internally consistent.** A pie must sum to 100. A "total"
  row in a table must equal its parts. If a rule later says "you invented the
  figure 47", the bank has to be right.
- **Values are plain numbers**, no unit suffix in the value. The unit lives in
  `Task1Chart.unit`.
- **`categories` are strings** even when they are years (`'1990'`, not `1990`).
- **`keywords`** follow the Task 2 bank's convention exactly (see the
  `bank.ts:29` example): lowercase single content words drawn from the prompt
  text *and* the chart's title, series names and category labels, widened with
  plausible synonyms a good answer would use. 10–16 per prompt.
- **`parts`** are checklist phrasings of what a complete Task 1 answer must do.
  For a data chart, the three that always apply:
  `'Paraphrase the chart title in your own words'`,
  `'State an overview of the main trend or the biggest difference'`,
  `'Support the overview with specific figures from the chart'`.
  Add a fourth when `comparative` — `'Compare the two series directly'`.
  For the `process` chart, replace the figure part with
  `'Describe the stages in order, using sequencing language'`.
- **No opinions anywhere.** Task 1 answers must not explain causes; the prompt
  text must not invite it.

Add a file header comment in the style of `bank.ts:1-10`, stating the count,
the kind distribution, and — importantly — that the numbers are the source of
truth for the factual-accuracy rules.

**Verify**: `npx tsc -b --noEmit` → exit 0.

### Step 4: Build the chart renderer

Create `src/components/Chart.tsx` and `src/components/Chart.css`.

`Chart` takes `ChartProps` and renders hand-written SVG. Requirements:

- **One component, five branches** (`line`, `bar`, `pie`, `table`, `process`),
  dispatched on `chart.kind`. `table` renders an actual `<table>`, not SVG;
  `process` renders an ordered list of labelled step boxes.
- **`viewBox` + `preserveAspectRatio`, no fixed pixel width.** The chart must
  scale down to ~320px wide. Set `width="100%"` and a `viewBox` with a fixed
  internal coordinate system (e.g. `0 0 640 360`) so all the layout maths is in
  constant units.
- **Colours from the design tokens only.** Series colours come from CSS custom
  properties set in `Chart.css`; series *n* gets `--chart-series-n`. Define
  four: `--exam-navy` for series 1, then three further hues that are NOT
  `--marking-red` and NOT `--marking-amber` (both are semantically reserved per
  `DESIGN.md:9-10`). Pick from the cool end so they sit with the paper palette —
  e.g. a slate blue, a muted teal, a desaturated indigo. Define them in
  `Chart.css` as new tokens scoped to `.chart`, and list them in a comment so a
  future `DESIGN.md` update can absorb them.
- **Axis labels and value readouts use `--font-mono` with
  `font-variant-numeric: tabular-nums`** (`DESIGN.md:13, 40`).
- **Gridlines use `--rule-line`**, axis lines `--ink-soft`.
- **Accessibility**: `role="img"` with an `aria-label` built from
  `caption ?? chart.title`, plus a visually-hidden `<figcaption>`-style text
  summary listing each series' first and last value so a screen-reader user
  gets the data, not just the title. A `<table>` chart needs a real `<caption>`
  and `<th scope>` headers.
- **`null` values are gaps.** A line chart must break the path at a null, not
  interpolate through it and not plot it as zero.
- **No animation** beyond what `prefers-reduced-motion` permits; the simplest
  correct choice here is no entrance animation at all.
- **Pure presentational.** No state, no effects, no data fetching. It receives
  a `Task1Chart` and draws it.

Guard the degenerate cases explicitly: empty `series`, empty `categories`, a
single data point (a line chart with one point draws a dot, not a path), and all
values equal (the y-scale must not collapse to zero height — floor the range).

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `npm run build` → exit 0.

### Step 5: Test the facts and the bank

Create `tests/task1-chart.test.ts`. Model its shape on
`tests/paragraphing-gate.test.ts` (header comment naming what it pins, a
helpers banner, then `describe` blocks).

**`describe('deriveChartFacts')`** — at minimum:

1. Peak and trough on a two-series line chart, including the tie-breaking rule.
2. `biggestRise` / `biggestFall` skip over a `null` correctly (a series
   `[10, null, 40]` yields a rise from category 0 to category 2, not two steps).
3. A single-point series yields `biggestRise === null` and
   `biggestFall === null`.
4. An all-null series yields `peak === null`, `trough === null`, `values === []`.
5. Empty `series` (a `process` chart) yields every field null/empty and
   `comparative === false`, and does not throw.
6. `values` is deduplicated and ascending.
7. `comparative` is true at 2 series, false at 1.

**`describe('TASK1_PROMPTS bank integrity')`** — these guard the data plan 004
will trust:

8. Exactly 12 prompts; ids are `t1-01`…`t1-12`, unique.
9. Every `text` ends with the standard Task 1 instruction string.
10. Every prompt has `task === 'task1'` and ≥ 3 `parts`.
11. Every prompt has 10–16 `keywords`, all lowercase, no duplicates within a
    prompt.
12. For every non-`process` chart: `series.length >= 1`, and **every** series'
    `values.length === categories.length` (index alignment is what `chartFacts`
    assumes).
13. For every `pie` chart: exactly one series and its non-null values sum to
    100 (± 0.01), and `unit === '%'`.
14. For the `process` chart: `series` is empty, `categories` is empty, `steps`
    has ≥ 3 entries.
15. `deriveChartFacts` does not throw for any prompt in the bank (loop over all
    12).
16. The kind distribution matches the table in step 3 (4 line, 3 bar, 2 pie,
    2 table, 1 process).

Do **not** write DOM/render tests for `Chart.tsx`. There is no jsdom
environment configured and this plan does not add one — visual verification is
step 7.

**Verify**: `npx vitest run tests/task1-chart.test.ts` → 16 tests pass.

### Step 6: Document the Task 1 model in SPEC.md

Two edits.

**6a.** At `SPEC.md:196`, the "Cut from v1" line currently ends:

```
dictionary
spell-check (browser spellcheck covers Coach) · per-finding dismissal · plan-phase timer · Task 1.
```

Change the trailing `· Task 1.` to `· Task 1 (see "Task 1 (v2)" below).`

**6b.** Append a new top-level section at the end of SPEC.md:

```markdown
## Task 1 (v2)

IELTS Academic Writing Task 1: describe a visual in ≥ 150 words in 20 minutes.

**The chart is DATA, not an image.** `Task1PromptSpec.chart` carries the numbers
(`kind`, `title`, `unit`, `categories`, `series[]`, `steps[]`). The app renders
the visual itself from that data (`components/Chart.tsx`), which is what makes
deterministic factual checking possible: because the engine owns the numbers it
can verify that a cited figure exists, that the stated maximum is the real
maximum, and that an overview was given at all.

- `Task1PromptSpec` is a SIBLING of `PromptSpec`, not an extension — Task 1 has
  no `QuestionType`, and `RuleFn` keeps its `PromptSpec | null` signature.
- `analysis/chartFacts.ts` → `deriveChartFacts(chart): Task1ChartFacts`
  (`values` deduped ascending, `peak`, `trough`, `biggestRise`, `biggestFall`,
  `comparative`). Pure; total on degenerate input (empty series, all-null
  values, single point) — never throws, never divides by zero.
- `prompts/task1Bank.ts` → 12 prompts (`t1-01`…`t1-12`): 4 line, 3 bar, 2 pie,
  2 table, 1 process. Standard instruction ends every prompt text: "Summarise
  the information by selecting and reporting the main features, and make
  comparisons where relevant. Write at least 150 words."
- **Bank integrity is a contract.** Pie series sum to 100; every series is
  index-aligned with `categories`; authored numbers are the source of truth for
  the factual-accuracy rules. `tests/task1-chart.test.ts` pins all of it.
- Canonical Task 1 constants: word count minimum **150** (error below),
  target 170–200, exam duration **20:00**. Paragraph shape: paraphrase ·
  overview · 1–2 detail paragraphs · NO conclusion (a conclusion is not
  required and repeats the overview).
```

### Step 7: Visual check

Run `npm run dev`. The app is unchanged (nothing renders `Chart` yet), so this
step only confirms the build is clean and the dev server starts.

**Verify**: `npm run dev` starts without error and the existing Coach view loads
at `http://localhost:5173`. Stop the server.

If you want to eyeball the chart, temporarily render
`<Chart chart={TASK1_PROMPTS[0].chart} />` in `App.tsx`, look at it, then
**revert that edit** — `src/App.tsx` is out of scope and must not appear in
`git status` at the end.

### Step 8: Full green

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `npx vitest run` → all files pass (54 pre-existing + 8 from plan 001
if it landed + 16 new).
**Verify**: `npm run build` → exit 0.

## Test plan

- **New file**: `tests/task1-chart.test.ts`, 16 cases (step 5): 7 on
  `deriveChartFacts` behaviour including degenerate input, 9 on bank integrity.
- **Structural pattern**: `tests/paragraphing-gate.test.ts`.
- **No existing test may change.** This plan is purely additive; if any
  pre-existing test fails, something out of scope was modified — that is a STOP
  condition.
- **Verification**: `npx vitest run` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc -b --noEmit` exits 0 with no output
- [ ] `npx vitest run` exits 0; `tests/task1-chart.test.ts` contributes 16 passing tests
- [ ] `npm run build` exits 0
- [ ] `test -f src/prompts/task1Bank.ts && test -f src/analysis/chartFacts.ts && test -f src/components/Chart.tsx && test -f src/components/Chart.css` succeeds
- [ ] `grep -c "id: 't1-" src/prompts/task1Bank.ts` returns 12
- [ ] `grep -rn "marking-red" src/components/Chart.css` returns **no matches**
- [ ] `grep -rn "from 'recharts'\|from 'd3'\|from 'chart.js'" src/` returns no matches, and `git diff --stat package.json` is empty
- [ ] `grep -n "Task 1 (v2)" SPEC.md` returns one match
- [ ] `git status --porcelain` lists only: `src/types.ts`, `src/prompts/task1Bank.ts`, `src/analysis/chartFacts.ts`, `src/components/Chart.tsx`, `src/components/Chart.css`, `tests/task1-chart.test.ts`, `SPEC.md`
- [ ] `plans/README.md` status row for 003 updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 001 has not landed (`grep -n "SCHEMA_VERSION = 2" src/profile/store.ts`
  finds nothing).
- Any excerpt in "Current state" does not match the live file.
- You find yourself needing to modify `PromptSpec`, `QuestionType`, or `RuleFn`
  to make something compile. The plan's whole design is that Task 1 is a
  sibling; if that fails, the design is wrong and needs a decision, not a
  workaround.
- Any pre-existing test fails.
- You conclude a chart library is needed. It is not — but if you believe
  otherwise, report why rather than adding a dependency. "No runtime
  dependencies beyond React" is a stated architectural property
  (`README.md:67`).
- Authoring the 12 prompts surfaces a chart kind that `Task1Chart` cannot
  express (e.g. a map). Report it; do not extend the type unilaterally.

## Maintenance notes

For whoever owns this next:

- **The bank is the contract.** Plan 004's `t1-invented-figure` rule reports a
  learner error whenever they cite a number not in `Task1ChartFacts.values`. A
  typo in the bank therefore becomes a *false accusation* shown to a learner.
  `tests/task1-chart.test.ts` cases 12–14 are the guard; keep them passing and
  extend them when new prompts are added.
- **`Task1ChartFacts` is where new rules get their evidence.** If plan 004
  needs a fact the type does not carry (e.g. "which series is flattest"), add it
  here with a test, rather than re-deriving it inside a rule module.
- **Maps are not supported.** IELTS Task 1 also uses maps ("the town in 1990 vs
  2010"). `Task1VisualKind` deliberately omits them because a map cannot be
  expressed as `categories × series` and would need a different renderer and
  different rules. Adding maps is a separate piece of work.
- **What a reviewer should scrutinise**: (1) that pie values sum to 100 in every
  pie prompt — check by hand, not just by test; (2) that `Chart.tsx` breaks
  lines at nulls rather than interpolating; (3) that no series colour is
  `--marking-red` or `--marking-amber`, since that would break the design
  system's error semantics.
- **The four chart series tokens should migrate into `DESIGN.md`** once they
  have been seen on screen and approved. They are defined locally in
  `Chart.css` for now with a comment saying so.
