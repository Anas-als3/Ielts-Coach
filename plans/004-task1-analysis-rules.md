# Plan 004: Add the Task 1 analysis pipeline — achievement rules, structure checks, band estimate, engine routing

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: this repository is **not under version control**
> at the time of writing. Confirm the excerpts in "Current state" appear
> verbatim, and confirm plans 001 and 003 have landed:
> - `grep -n "SCHEMA_VERSION = 2" src/profile/store.ts` → one match
> - `test -f src/analysis/chartFacts.ts && test -f src/prompts/task1Bank.ts` → succeeds
>
> If either check fails, STOP.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED — adds to the frozen-by-convention `IssueCategory` union and introduces a second band-estimate path; must not perturb any Task 2 behaviour
- **Depends on**: `plans/003-task1-data-model-and-chart.md` (which depends on 001)
- **Category**: direction
- **Planned at**: no VCS — written 2026-08-05 against the working tree as read on that date

## Why this matters

Plan 003 gave the app Task 1 chart *data*. This plan turns that into coaching.

The high-value move — the thing this app can do that a generic grammar checker
cannot — is **factual checking**. Because the prompt bank owns the numbers, the
engine can tell a learner "you wrote 47%, but no value in this chart is 47" or
"you never stated an overview, which is the single largest scoring lever in
Task 1". Neither needs an LLM. Both are impossible for a tool that only receives
a chart image.

Four of the five existing rule modules apply to Task 1 **unchanged** —
`cohesion.ts`, `lexical.ts`, `grammarRange.ts` and `accuracy.ts` never reference
Task 2 concepts. Only Task Response and structure need Task 1 siblings. That is
why Task 1 is the cheapest stage to add and why it is first.

## Key design decision, already made — read this before step 1

**`Criterion` is NOT extended.** IELTS Task 1 marks "Task Achievement" where
Task 2 marks "Task Response", but these are the same slot with different names,
not two slots. Extending `Criterion` to five members would force
`Record<Criterion, number>` in `BandEstimate.byCriterion` and
`BandEstimate.rationale` to carry a key that is always absent for one task —
rippling `Partial<>` through `bandEstimate.ts`, `Report.tsx`, `FeedbackPanel.tsx`
and `meta.ts` for no gain.

Instead: Task 1 reuses the `'TR'` slot, and the **label** varies by task. You
will add a `criterionLabel(criterion, task)` helper in `src/meta.ts`.

Do not extend `Criterion`. If you believe you must, that is a STOP condition.

## Current state

### The engine — `src/analysis/engine.ts:39-67` (whole function)

```ts
export function analyzeEssay(text: string, prompt: PromptSpec | null): Analysis {
  const doc = tokenize(text)
  const { paragraphs, checks, issues: structureIssues } = buildStructure(doc, prompt)

  const issues: Issue[] = [
    ...structureIssues,
    ...taskResponseRules(doc, prompt),
    ...cohesionRules(doc, prompt),
    ...lexicalRules(doc, prompt),
    ...grammarRangeRules(doc, prompt),
    ...accuracyRules(doc, prompt),
  ]

  issues.sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (sev !== 0) return sev
    return (a.start ?? -1) - (b.start ?? -1)
  })
  // Engine owns id uniqueness so rule modules never collide.
  issues.forEach((issue, i) => {
    issue.id = `i${i}`
  })

  const stats = computeStats(doc)
  const partial = { issues, paragraphs, structure: checks, stats }
  const band = estimateBand(partial, doc)

  return { ...partial, band }
}
```

`computeStats` (`src/analysis/engine.ts:13-32`) is task-agnostic and will be
reused verbatim — it is currently module-private and you will export it.

### The four reusable rule modules

Each exports a `RuleFn`. Confirmed task-agnostic by inspection — none reads
`prompt.type` or any Task 2 concept:

- `src/analysis/rules/cohesion.ts` → `cohesionRules`, plus `countLinkingDevices`
- `src/analysis/rules/lexical.ts` → `lexicalRules`
- `src/analysis/rules/grammarRange.ts` → `grammarRangeRules`
- `src/analysis/rules/accuracy.ts` → `accuracyRules`

`RuleFn` is `(doc: TokenizedDoc, prompt: PromptSpec | null) => Issue[]`
(`src/types.ts:189`). Task 1 calls them with `null` as the prompt. Verify this
is safe before relying on it — see step 4.

### The criterion metadata — `src/meta.ts:1-9`

```ts
import type { Criterion, IssueCategory, QuestionType } from './types'

/** Display metadata for the four IELTS band criteria. */
export const CRITERION_META: Record<Criterion, { label: string; short: string }> = {
  TR: { label: 'Task Response', short: 'Task' },
  CC: { label: 'Coherence & Cohesion', short: 'Coherence' },
  LR: { label: 'Lexical Resource', short: 'Vocabulary' },
  GRA: { label: 'Grammatical Range & Accuracy', short: 'Grammar' },
}
```

### The category metadata shape — `src/meta.ts:11-12`

```ts
/** Learner-facing names and one-line explanations per error category. */
export const CATEGORY_META: Record<IssueCategory, { label: string; criterion: Criterion; hint: string }> = {
  'word-count': { label: 'Word count', criterion: 'TR', hint: 'Task 2 requires at least 250 words; under-length essays are penalised.' },
```

`Record<IssueCategory, ...>` is exhaustive — adding a union member without a
`CATEGORY_META` entry is a compile error. That is the safety net that makes
adding categories safe.

### The issue-construction idiom — `src/analysis/rules/structure.ts:93-112`

```ts
function mk(
  category: IssueCategory,
  severity: Severity,
  message: string,
  start: number | null = null,
  end: number | null = null,
  excerpt?: string,
): Issue {
  const out: Issue = {
    id: 'x', // placeholder — the engine reassigns ids
    category,
    criterion: CATEGORY_META[category].criterion,
    severity,
    message,
    start,
    end,
  }
  if (excerpt !== undefined) out.excerpt = excerpt
  return out
}
```

Note `criterion` is derived from `CATEGORY_META`, not passed in. Match this.

### The band estimator's entry point — `src/analysis/bandEstimate.ts:110-127`

```ts
export function estimateBand(
  partial: { issues: Issue[]; paragraphs: ParagraphInfo[]; structure: StructureCheck[]; stats: EssayStats },
  doc: TokenizedDoc,
): BandEstimate {
  const { issues, structure, stats } = partial

  // Too short to assess at all.
  if (stats.wordCount < 150) {
    const bullets = [
      'Under 150 words — too short to assess.',
      'Write at least 250 words so every criterion can be scored.',
    ]
    return {
      overall: 4,
      byCriterion: { TR: 4, CC: 4, LR: 4, GRA: 4 },
      rationale: { TR: [...bullets], CC: [...bullets], LR: [...bullets], GRA: [...bullets] },
    }
  }
```

Its shared helpers — `count`, `hasError`, `hasWarning`, `isClean`,
`finishScore`, `roundOverallHalfDown`, `composeBullets`
(`src/analysis/bandEstimate.ts:56-106`) — are module-private and you will export
them for reuse rather than duplicating.

### Repo conventions you must match

- **TypeScript strict**, no `any`. No new runtime dependencies.
- **Rule modules are pure and synchronous**, take a `TokenizedDoc`, return
  `Issue[]`, assign no ids (the engine does that), and use a local `mk`/
  `makeIssue` helper.
- **Word lists and regexes are module-level constants** with a doc comment
  naming the SPEC rule they implement.
- **Messages say what is wrong AND how to fix it**, in the DESIGN.md copy voice
  (`DESIGN.md:47-48`): "plain verbs, sentence case, specific …, never scolding,
  never vague. Errors explain the fix." Example from the codebase
  (`src/analysis/rules/structure.ts:221`):
  `"No position yet — state your view in one sentence, e.g. 'I firmly believe …', in the introduction."`
- **Severity model is static per rule** (`SPEC.md:30-34`): `error` = band-capping,
  `warning` = recurring cost, `info` = advisory/low-precision heuristic. Choose
  deliberately; the band estimator's "clean sweep" rewards treat `info` as
  non-blocking.
- **Defensive by design** (`src/analysis/rules/structure.ts:4-7`): empty input
  yields no issues and a stable set of unsatisfied checks. Never index into an
  empty array; never divide by a possibly-zero count.
- **`IssueCategory` ids are frozen** — this means **never rename or remove**.
  Appending new ids is permitted and is what this plan does. The personal error
  profile aggregates on these ids across sessions
  (`src/types.ts:35-38`), so a rename would orphan a learner's history.
- **Complexity markers come from `src/analysis/complexity.ts`** if plan 002 has
  landed. Check with `test -f src/analysis/complexity.ts`. If it exists, import
  `countGraMarkers` from it rather than writing a fourth copy.
- **SPEC.md is canonical** — step 8 records every new rule there.

## Commands you will need

| Purpose   | Command                                     | Expected on success |
|-----------|---------------------------------------------|---------------------|
| Typecheck | `npx tsc -b --noEmit`                       | exit 0, no output   |
| Tests     | `npx vitest run`                            | all files pass      |
| One file  | `npx vitest run tests/task1-rules.test.ts`  | all pass            |
| Build     | `npm run build`                             | exit 0              |

## Scope

**In scope**:

- `src/types.ts` (modify — append `IssueCategory` members; add `Task1Analysis` alias if needed)
- `src/meta.ts` (modify — `CATEGORY_META` entries for the new ids; add `criterionLabel`)
- `src/analysis/rules/task1Achievement.ts` (create)
- `src/analysis/rules/task1Structure.ts` (create)
- `src/analysis/task1BandEstimate.ts` (create)
- `src/analysis/bandEstimate.ts` (modify — **export** existing private helpers; no logic change)
- `src/analysis/engine.ts` (modify — export `computeStats`; add `analyzeTask1`)
- `tests/task1-rules.test.ts` (create)
- `SPEC.md` (modify — extend the "Task 1 (v2)" section added by plan 003)

**Out of scope** (do NOT touch):

- **`Criterion`** — stays four members. See "Key design decision" above.
- `src/analysis/rules/cohesion.ts`, `lexical.ts`, `grammarRange.ts`,
  `accuracy.ts` — reused as-is. If one of them turns out to need a Task 1
  branch, that is a STOP condition, not an edit.
- `src/analysis/rules/structure.ts` and `taskResponse.ts` — the Task 2 modules.
  Task 1 gets siblings; these are not modified or generalised.
- `analyzeEssay` — its behaviour must be byte-identical after this plan. The
  only permitted change to `engine.ts` is exporting `computeStats` and adding a
  new function beside it.
- `src/analysis/bandEstimate.ts` **logic** — you may only change `function foo`
  to `export function foo`. No scoring changes. `tests/band-rewards.test.ts`
  pins the calibration.
- `src/App.tsx`, `src/components/**` — no UI. That is plan 005.
- `src/profile/profile.ts` — task-scoping of the error profile is a deliberate
  follow-up (see Maintenance notes).

## Git workflow

- Branch: `advisor/004-task1-analysis`
- One commit per step; plain imperative subjects.
- Do NOT push and do NOT open a PR.

## Steps

### Step 1: Append the Task 1 issue categories

In `src/types.ts`, append to the `IssueCategory` union — **after** the last
existing member (`'missing-hedging'` at `src/types.ts:80`), keeping the existing
members in their exact current order:

```ts
  // Task 1 (Task Achievement — occupies the 'TR' criterion slot)
  | 't1-word-count'
  | 't1-overview-missing'
  | 't1-invented-figure'
  | 't1-no-data-cited'
  | 't1-no-comparison'
  | 't1-explains-causes'
  | 't1-opinion'
  | 't1-prompt-echo'
  // Task 1 (Coherence & Cohesion)
  | 't1-shape';
```

Move the `;` from `'missing-hedging'` to the new last member.

**Verify**: `npx tsc -b --noEmit` → **fails** with an error on `CATEGORY_META`
in `src/meta.ts` (missing properties). Expected; fixed in step 2.

### Step 2: Add the metadata entries and the task-aware criterion label

**2a.** In `src/meta.ts`, add nine `CATEGORY_META` entries at the end of the
object, matching the existing single-line formatting exactly. All nine map to
`criterion: 'TR'` except `t1-shape`, which maps to `'CC'`. Suggested copy —
adjust wording freely but keep the voice:

```ts
  't1-word-count': { label: 'Word count', criterion: 'TR', hint: 'Task 1 requires at least 150 words; under-length answers are penalised.' },
  't1-overview-missing': { label: 'Overview missing', criterion: 'TR', hint: 'Task 1 needs one sentence naming the overall trend or the biggest difference — it is the largest single scoring lever.' },
  't1-invented-figure': { label: 'Figure not in the chart', criterion: 'TR', hint: 'Every number you quote must appear in the data you were given.' },
  't1-no-data-cited': { label: 'No figures cited', criterion: 'TR', hint: 'Support each main feature with a specific figure from the chart.' },
  't1-no-comparison': { label: 'No comparison made', criterion: 'TR', hint: 'When the chart shows two or more series, compare them directly.' },
  't1-explains-causes': { label: 'Explaining causes', criterion: 'TR', hint: 'Task 1 reports what the data shows — it never explains why, and never predicts.' },
  't1-opinion': { label: 'Opinion in Task 1', criterion: 'TR', hint: 'Task 1 has no opinion. Describe the data, do not evaluate it.' },
  't1-prompt-echo': { label: 'Copied chart title', criterion: 'TR', hint: 'Paraphrase the chart title in your own words — copied wording is excluded from your word count.' },
  't1-shape': { label: 'Answer shape', criterion: 'CC', hint: 'Task 1 shape: paraphrase, overview, one or two detail paragraphs. No conclusion is needed.' },
```

**2b.** Add the task-aware label helper below `CRITERION_META`:

```ts
/**
 * Criterion display name for a given task. IELTS marks the same first slot as
 * "Task Response" in Task 2 and "Task Achievement" in Task 1 — one slot, two
 * names — so `Criterion` stays four members and only the label varies.
 */
export function criterionLabel(criterion: Criterion, task: TaskKind): { label: string; short: string } {
  if (criterion === 'TR' && task === 'task1') return { label: 'Task Achievement', short: 'Task' }
  return CRITERION_META[criterion]
}
```

Import `TaskKind` from `./types` (added by plan 001).

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `npx vitest run` → all existing tests still pass. Adding union
members changes no runtime behaviour.

### Step 3: Export the helpers you will reuse

Two mechanical edits, **no logic changes**:

**3a.** In `src/analysis/engine.ts:13`, change `function computeStats(` to
`export function computeStats(`.

**3b.** In `src/analysis/bandEstimate.ts`, add `export` to these six
module-private helpers (lines 56-106): `count`, `hasError`, `hasWarning`,
`isClean`, `finishScore`, `roundOverallHalfDown`, `composeBullets`.

**Verify**: `npx vitest run` → all pass, unchanged count. If any test moves,
you changed logic — revert and retry.

### Step 4: Confirm the four shared rule modules are safe with a null prompt

Before building on the assumption, prove it. In a scratch check (do not commit
this), confirm each of `cohesionRules`, `lexicalRules`, `grammarRangeRules`,
`accuracyRules` handles `prompt === null`:

```bash
grep -n "prompt" src/analysis/rules/cohesion.ts src/analysis/rules/lexical.ts \
  src/analysis/rules/grammarRange.ts src/analysis/rules/accuracy.ts
```

Every use must be either an unused parameter or guarded with a null check.
`tests/paragraphing-gate.test.ts:19` already calls `analyzeEssay(text, null)`
through the full pipeline, which is strong evidence, but confirm per-module.

**If any of the four dereferences `prompt` without a guard, STOP and report.**
Do not add guards to those files — they are out of scope, and needing one would
mean the reuse assumption is wrong.

**Verify**: the grep output shows no unguarded `prompt.` dereference in those
four files.

### Step 5: Write `task1Achievement.ts`

Create `src/analysis/rules/task1Achievement.ts` exporting:

```ts
export function task1AchievementRules(
  doc: TokenizedDoc,
  prompt: Task1PromptSpec,
  facts: Task1ChartFacts,
): Issue[]
```

Note the signature differs from `RuleFn` — it needs the chart facts. That is
deliberate and is why `RuleFn` was not widened.

Implement these rules. Each bullet gives the trigger, severity, and the shape of
the message; write the exact copy yourself in the DESIGN.md voice.

1. **`t1-word-count`** (error below 150, warning 150–159 "dangerously close",
   warning above 220 "over-length for the time available"). Mirror the
   structure of the Task 2 word-count rule in
   `src/analysis/rules/taskResponse.ts` — read it first and match its shape,
   including the effective-count deduction for copied prompt wording if that
   logic is factored out; if it is not factored out, do **not** refactor it,
   just implement the equivalent locally.

2. **`t1-overview-missing`** (error, essay-level, only once `doc.wordCount >= 100`).
   An overview is present when any sentence contains an overview marker:
   ```
   overall · in general · generally · it is clear that · the most striking
   feature · the most noticeable · the clearest trend · broadly · in summary
   · taken as a whole · the general trend
   ```
   Gate at 100 words so a learner mid-paraphrase is not told their overview is
   missing before they could have written it — this mirrors the
   `PARAGRAPHING_MIN_WORDS` reasoning at
   `src/analysis/rules/structure.ts:73-89`, which you should read for the
   principle. Message names the fix: start a sentence "Overall, …".

3. **`t1-invented-figure`** (error, inline). Extract every number the learner
   wrote — integers, decimals, and percentages — with their spans. For each,
   if it is **not** in `facts.values`, flag it. Guards, all required:
   - Skip numbers that appear in `prompt.chart.categories` (years like `1990`
     are labels, not values).
   - Skip numbers within a small tolerance of a real value when the learner is
     clearly approximating: accept a written value `w` if any `v` in
     `facts.values` satisfies `Math.abs(w - v) <= 0.5` **or** if `w` is a round
     number and `Math.abs(w - v) / v <= 0.05` (a "roughly 40%" for a real 39
     is correct IELTS practice and must not be flagged).
   - Skip numbers that are sums or differences of two chart values (learners
     legitimately write "a combined 65%"). Precompute the pairwise sums and
     absolute differences of `facts.values` once and treat them as acceptable.
   - Never flag when `facts.values` is empty (a `process` chart).
   These guards exist because a false accusation here is worse than a miss —
   the app would be telling a correct learner they are wrong.

4. **`t1-no-data-cited`** (warning, essay-level, once `doc.wordCount >= 120`).
   Fires when the answer contains **zero** numbers at all and
   `facts.values.length > 0`.

5. **`t1-no-comparison`** (warning, essay-level, once `doc.wordCount >= 120`).
   Only when `facts.comparative` is true. Satisfied by any comparison marker:
   ```
   compared with · compared to · in comparison · whereas · while · higher than
   · lower than · more than · less than · twice · half · the same as ·
   similarly · by contrast · in contrast · outnumbered · exceeded
   ```

6. **`t1-explains-causes`** (warning, inline). Task 1 must not explain or
   predict. Fire on causal/speculative markers:
   ```
   because · due to · owing to · as a result of · this is why · the reason
   for this · probably because · may be caused by · will continue to · is
   likely to rise · in the future · I expect
   ```
   **Guard**: `due to` and `because` legitimately appear in a *within-data*
   statement only rarely, so accept the small false-positive rate but set
   severity to `warning`, not `error`, and word the message as a check:
   "Task 1 reports what the data shows — check this sentence is not explaining
   why."

7. **`t1-opinion`** (warning, inline). Reuse the stance regexes already
   specified at `SPEC.md:54-57` — copy them into this module (they are
   module-private in `structure.ts`; do not export them from there, since
   `structure.ts` is out of scope). Any stance marker in a Task 1 answer is
   wrong.

8. **`t1-prompt-echo`** (warning, inline). Maximal runs of **≥ 8** consecutive
   words shared verbatim with `prompt.chart.title` or `prompt.text`
   (normalised: lowercase, punctuation stripped), requiring ≥ 2 content words
   in the run. This mirrors the Task 2 `prompt-echo` spec at `SPEC.md:61-67` —
   read it and match the threshold reasoning exactly. Do not lower the 8-word
   threshold; `SPEC.md:63-66` documents why 4 words was wrong.

**Verify**: `npx tsc -b --noEmit` → exit 0.

### Step 6: Write `task1Structure.ts`

Create `src/analysis/rules/task1Structure.ts` exporting:

```ts
export function buildTask1Structure(
  doc: TokenizedDoc,
  prompt: Task1PromptSpec,
  facts: Task1ChartFacts,
): { paragraphs: ParagraphInfo[]; checks: StructureCheck[]; issues: Issue[] }
```

Same return shape as `buildStructure` (`src/analysis/rules/structure.ts:633-643`)
— read that function and mirror its organisation (an `assignRoles`-equivalent,
a `buildChecks`, a `buildIssues`, then the exported assembler).

**Paragraph roles.** Task 1's shape is *paraphrase · overview · 1–2 detail
paragraphs*, with **no conclusion**. `ParagraphRole` is
`'introduction' | 'body' | 'conclusion'` (`src/types.ts:136`) and is **not**
changed. Map: paragraph 0 → `introduction` (the paraphrase), all others →
`body`. Never assign `conclusion` for Task 1.

**Structure Rail checks** — a stable list present from the first keystroke, so
the rail never jumps (the Task 2 module's stated principle,
`src/analysis/rules/structure.ts:237-242`). Ids and labels:

| id | label | satisfied when |
|---|---|---|
| `t1-paraphrase` | `Title paraphrased` | ≥ 1 paragraph, first paragraph ≥ 15 words, and no `t1-prompt-echo` issue inside it |
| `t1-overview` | `Overview` | an overview marker was found (rule 2's detector — share one exported predicate, do not write it twice) |
| `t1-detail-1` | `Detail paragraph 1` | a body paragraph exists with ≥ 40 words and ≥ 1 figure |
| `t1-detail-2` | `Detail paragraph 2` | a second such body paragraph exists |
| `t1-figures` | `Figures cited` | ≥ 2 distinct numbers from `facts.values` appear in the answer |
| `t1-comparison` | `Comparison made` | only pushed when `facts.comparative`; satisfied by rule 5's detector |
| `complex-count` | `Complex sentences` | reuse the Task 2 rule verbatim — see below |

For `complex-count`, reuse `countRailMarkers` from `src/analysis/complexity.ts`
if plan 002 landed. If it did not, copy the exact regex from
`src/analysis/rules/structure.ts:65-66` with a `TODO(plan-002)` comment. Target
stays 4 with ≥ 1 per paragraph.

Every check needs a `detail` string in the learner-facing voice, including a
"not started" state, exactly as the Task 2 module does.

**Issues** emitted here:

- **`t1-shape`** (warning, essay-level, once `doc.wordCount >= 150`): fires when
  the paragraph count is outside 3–4, **or** when the final paragraph opens with
  a Task 2 conclusion signal (`in conclusion|to conclude|to sum up|in summary`)
  — a conclusion in Task 1 just repeats the overview and wastes words. Reuse the
  `CONCLUSION_SIGNAL` pattern from `src/analysis/rules/structure.ts:36` by
  copying it locally.
- Reuse the Task 2 **`paragraph-balance`** and **`topic-sentence`** categories
  where the logic genuinely applies. Both are already in `CATEGORY_META` and are
  not Task-2-specific in meaning. Do not create `t1-` duplicates of them.

**Verify**: `npx tsc -b --noEmit` → exit 0.

### Step 7: Write `task1BandEstimate.ts` and route the engine

**7a.** Create `src/analysis/task1BandEstimate.ts` exporting:

```ts
export function estimateTask1Band(
  partial: { issues: Issue[]; paragraphs: ParagraphInfo[]; structure: StructureCheck[]; stats: EssayStats },
  doc: TokenizedDoc,
): BandEstimate
```

Import the helpers exported in step 3b rather than redefining them. Structure it
exactly like `estimateBand` — start each criterion at 7.0, apply caps and
deductions, then rewards, `finishScore`, mean, `roundOverallHalfDown`.

**CC, LR and GRA are scored identically to Task 2.** Copy those three blocks
from `src/analysis/bandEstimate.ts:201-413` with only these changes:
- the CC "shape on target" reward uses **3–4** paragraphs (not 4–5) and drops
  the `conclusion-present` requirement — Task 1 has no conclusion;
- the CC `no-conclusion` cap is removed entirely.

**TR (displayed as Task Achievement)** — Task 1 specific:
- `t1-word-count` error → cap 5.0
- `t1-overview-missing` error → cap **5.5**. This is the single most
  band-defining Task 1 feature; a missing overview genuinely caps Task
  Achievement in the public band descriptors.
- `t1-invented-figure` ≥ 1 → −0.5; ≥ 3 → cap 6.0
- `t1-no-data-cited` → −1.0
- `t1-no-comparison` → −0.5
- `t1-explains-causes` ≥ 2 → −0.5
- `t1-opinion` ≥ 1 → −0.5
- `t1-prompt-echo` ≥ 1 → −0.5
- Rewards (each +0.5, needing positive evidence, per `SPEC.md:141-144`):
  clean sweep on TR · `t1-overview` check satisfied AND ≥ 3 distinct figures
  cited · all structure checks satisfied.

**The under-length floor moves.** `estimateBand` returns all-4.0 below 150
words (`src/analysis/bandEstimate.ts:117`). For Task 1 that threshold is
**100 words**, and the bullet copy must say "Write at least 150 words".

**7b.** In `src/analysis/engine.ts`, add a new exported function beside
`analyzeEssay` — **do not modify `analyzeEssay`**:

```ts
/**
 * Full Task 1 analysis. Same contract as `analyzeEssay`: pure, synchronous,
 * safe to call debounced on every keystroke.
 *
 * Four of the five Task 2 rule families apply unchanged — cohesion, lexical,
 * grammatical range and accuracy never reference a Task 2 concept, so they run
 * here with a null prompt. Only task achievement and structure are Task 1
 * specific.
 */
export function analyzeTask1(text: string, prompt: Task1PromptSpec): Analysis {
  const doc = tokenize(text)
  const facts = deriveChartFacts(prompt.chart)
  const { paragraphs, checks, issues: structureIssues } = buildTask1Structure(doc, prompt, facts)

  const issues: Issue[] = [
    ...structureIssues,
    ...task1AchievementRules(doc, prompt, facts),
    ...cohesionRules(doc, null),
    ...lexicalRules(doc, null),
    ...grammarRangeRules(doc, null),
    ...accuracyRules(doc, null),
  ]

  issues.sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (sev !== 0) return sev
    return (a.start ?? -1) - (b.start ?? -1)
  })
  issues.forEach((issue, i) => {
    issue.id = `i${i}`
  })

  const stats = computeStats(doc)
  const partial = { issues, paragraphs, structure: checks, stats }
  const band = estimateTask1Band(partial, doc)

  return { ...partial, band }
}
```

The sort-and-id block is duplicated from `analyzeEssay`. That is acceptable and
deliberate — factoring it out would mean editing `analyzeEssay`, which must stay
byte-identical for this plan's regression guarantee. Add a one-line comment
saying so.

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `npx vitest run` → all pre-existing tests pass, unchanged.

### Step 8: Extend the SPEC.md Task 1 section

Append to the `## Task 1 (v2)` section that plan 003 created:

```markdown
### `analysis/rules/task1Achievement.ts` — exports `task1AchievementRules(doc, prompt, facts)`
Signature takes `Task1ChartFacts`, so it is NOT a `RuleFn` — `RuleFn` keeps its
`(doc, PromptSpec | null)` shape.
- `t1-word-count`: < 150 error · 150–159 warning "dangerously close" · > 220 warning "over-length".
- `t1-overview-missing` (error, ≥ 100 words): no overview marker anywhere (overall|in general|generally|
  it is clear that|the most striking feature|the most noticeable|the clearest trend|broadly|in summary|
  taken as a whole|the general trend). Gated at 100 words for the same reason as the paragraphing gates.
- `t1-invented-figure` (error, inline): a number in the answer that is not in `facts.values`. GUARDS —
  skip values appearing in `chart.categories` (years are labels); accept |written − real| ≤ 0.5 or a
  round number within 5% (approximation is correct IELTS practice); accept pairwise sums and absolute
  differences of chart values ("a combined 65%"); never fire when `facts.values` is empty. A false
  accusation is worse than a miss.
- `t1-no-data-cited` (warning, ≥ 120 words): zero numbers written while the chart has values.
- `t1-no-comparison` (warning, ≥ 120 words, only when `facts.comparative`): no comparison marker.
- `t1-explains-causes` (warning, inline): causal/predictive markers — Task 1 reports, never explains
  or forecasts. Worded as a check, not an accusation.
- `t1-opinion` (warning, inline): any Task 2 stance regex in a Task 1 answer.
- `t1-prompt-echo` (warning, inline): ≥ 8 verbatim words shared with the chart title or task text,
  ≥ 2 content words in the run — same threshold and reasoning as Task 2 `prompt-echo`.

### `analysis/rules/task1Structure.ts` — exports `buildTask1Structure(doc, prompt, facts)`
Paragraph roles: paragraph 0 = `introduction` (the paraphrase), all others = `body`. **Never
`conclusion`** — Task 1 has none. Checks: `t1-paraphrase`, `t1-overview`, `t1-detail-1`,
`t1-detail-2`, `t1-figures`, `t1-comparison` (only when `facts.comparative`), `complex-count`
(reused from Task 2, target 4, one per paragraph). Issues: `t1-shape` (warning, ≥ 150 words —
paragraph count outside 3–4, or a conclusion signal in the final paragraph), plus the reused
`paragraph-balance` and `topic-sentence` categories.

### `analysis/task1BandEstimate.ts` — exports `estimateTask1Band(partial, doc)`
CC, LR and GRA are scored exactly as Task 2, except: the CC shape reward targets **3–4** paragraphs
with no conclusion requirement, and the `no-conclusion` cap does not exist. Under **100** words →
all criteria 4.0 (Task 2's floor is 150).
TA (the 'TR' slot): `t1-word-count` error → cap 5.0 · `t1-overview-missing` → cap 5.5 ·
`t1-invented-figure` ≥ 1 → −0.5, ≥ 3 → cap 6.0 · `t1-no-data-cited` → −1.0 · `t1-no-comparison` → −0.5 ·
`t1-explains-causes` ≥ 2 → −0.5 · `t1-opinion` ≥ 1 → −0.5 · `t1-prompt-echo` ≥ 1 → −0.5.
Rewards: clean sweep · overview satisfied AND ≥ 3 distinct figures · all structure checks satisfied.

### Criterion naming
`Criterion` stays FOUR members. IELTS marks the same first slot as "Task Response" (Task 2) and
"Task Achievement" (Task 1) — one slot, two names. `meta.ts` exports
`criterionLabel(criterion, task)`; `CRITERION_META` remains the Task 2 default.

### Engine
`analyzeTask1(text, prompt)` in `analysis/engine.ts`, beside an UNCHANGED `analyzeEssay`. It reuses
`cohesionRules`, `lexicalRules`, `grammarRangeRules` and `accuracyRules` with a null prompt — those
four modules contain no Task 2 concepts. The sort-and-assign-ids block is deliberately duplicated
rather than factored out, so `analyzeEssay` stays byte-identical.
```

### Step 9: Write the tests

Create `tests/task1-rules.test.ts`, modelled on
`tests/paragraphing-gate.test.ts`. Everything runs through the real pipeline
(`analyzeTask1`), as that file's header comment argues for.

Build a fixture prompt with a known chart, e.g. two series over four years with
values you control, so the factual assertions are exact. Add a helper
`t1(text, prompt = FIXTURE): Analysis`.

Required cases (grouped in `describe` blocks):

**Overview (5)** — missing below 100 words is silent; missing above 100 words is
an error; each of three different overview markers satisfies it; the
`t1-overview` structure check tracks the same predicate as the issue (they must
never disagree).

**Invented figures (7)** — a value present in the chart is not flagged; a value
absent is flagged with a correct inline span; a year from `categories` is never
flagged; `39` written as `40` is not flagged (5% round-number tolerance); a sum
of two chart values is not flagged; nothing is flagged for a `process` chart
(empty `facts.values`); a decimal that matches within 0.5 is not flagged.

**Comparison and data (3)** — `t1-no-comparison` fires only when
`facts.comparative`; a comparison marker clears it; `t1-no-data-cited` fires on
a number-free answer above 120 words and is silent below.

**Task 1 prohibitions (3)** — `t1-explains-causes` fires on "because"; `t1-opinion`
fires on "In my opinion"; neither fires on a clean descriptive answer.

**Structure (4)** — no paragraph is ever assigned the `conclusion` role; a
final paragraph opening "In conclusion" produces `t1-shape`; the check list is
stable (same ids, in the same order) for empty text and for a full answer; the
`t1-comparison` check is absent when `facts.comparative` is false.

**Band (3)** — an answer under 100 words scores 4.0 on all four criteria; a
missing overview caps the TR slot at 5.5; a clean, well-supported answer scores
≥ 7.0 on TR. Write this last one against a hand-authored model answer for your
fixture chart and treat it as the Task 1 calibration anchor, mirroring
`SPEC.md:160-161`.

**Regression (2)** — `analyzeEssay` output for a fixed Task 2 essay is
unchanged by this plan (snapshot the issue categories and band, compare); the
four shared rule modules produce the same issues when called through
`analyzeTask1` as through `analyzeEssay` for the same text.

**Verify**: `npx vitest run tests/task1-rules.test.ts` → 27 tests pass.

### Step 10: Full green

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `npx vitest run` → all files pass.
**Verify**: `npm run build` → exit 0.

## Test plan

- **New file**: `tests/task1-rules.test.ts`, 27 cases (step 9).
- **Structural pattern**: `tests/paragraphing-gate.test.ts` — real pipeline, no
  unit-testing of private helpers.
- **The Task 2 regression cases are the most important tests in this plan.**
  This plan touches `types.ts`, `meta.ts`, `bandEstimate.ts` and `engine.ts` —
  all shared. The two regression cases plus the four pre-existing test files are
  what prove Task 2 is untouched.
- **Verification**: `npx vitest run` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc -b --noEmit` exits 0 with no output
- [ ] `npx vitest run` exits 0; all pre-existing tests pass **unchanged**; 27 new tests pass
- [ ] `npm run build` exits 0
- [ ] `grep -c "'TA'" src/types.ts` returns 0 — `Criterion` was not extended
- [ ] `grep -c "export type Criterion" src/types.ts` returns 1 and the line still reads `'TR' | 'CC' | 'LR' | 'GRA'`
- [ ] `grep -c "t1-" src/meta.ts` returns 9
- [ ] `grep -n "export function analyzeTask1" src/analysis/engine.ts` returns one match
- [ ] `grep -n "export function analyzeEssay" src/analysis/engine.ts` returns one match and the function body is unchanged
- [ ] `grep -rn "conclusion'" src/analysis/rules/task1Structure.ts` shows no role assignment to `'conclusion'`
- [ ] `git status --porcelain` lists only the in-scope files
- [ ] `plans/README.md` status row for 004 updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 003 has not landed.
- Any excerpt in "Current state" does not match the live file.
- You conclude `Criterion` must gain a fifth member. The design decision at the
  top of this plan says it must not; if that is wrong, it needs a decision, not
  a workaround.
- Step 4 finds any of the four shared rule modules dereferencing `prompt`
  without a null guard.
- Any pre-existing test in `tests/band-rewards.test.ts`,
  `tests/patch-v2.test.ts`, `tests/paragraphing-gate.test.ts` or
  `tests/false-positives.test.ts` fails. This plan must not change Task 2
  behaviour at all.
- The `t1-invented-figure` guards cannot be made to pass the seven cases in
  step 9 without weakening the rule to uselessness. Report the specific case —
  it is better to ship this rule as a `warning` worded as a check than to ship a
  rule that tells correct learners they are wrong.
- The Task 1 calibration anchor (a hand-written model answer scoring ≥ 7.0 on
  TR) cannot be reached. Report the actual score and the driving deductions
  rather than loosening the thresholds.

## Maintenance notes

For whoever owns this next:

- **`profile.ts` still does not scope by task.** `computeProfile` and
  `computeTrends` aggregate `IssueCategory` counts across all sessions, so a
  learner's Task 1 and Task 2 error rates now land in the same EWMA. For
  `article`, `agreement`, `contraction` and the rest of LR/GRA that is arguably
  *correct* — those skills transfer. For `t1-*` and the Task 2 TR/CC categories
  it is not. The `SessionRecord.task` field added by plan 001 is the hook; the
  work is to add an optional task filter to `computeProfile` and let the
  Dashboard switch between "All", "Task 1" and "Task 2". Do this before the
  focus-categories feature starts recommending Task 2 practice for a Task 1
  weakness.
- **`t1-invented-figure` is the rule most likely to generate complaints.** Every
  guard in it exists because of a specific way a correct answer can look wrong.
  If a false positive is reported, add a guard and a test case — do not lower
  the severity as a first move, and never remove the rule; it is the app's most
  distinctive Task 1 feature.
- **The duplicated sort-and-id block in `engine.ts` is deliberate.** Once Task 1
  has shipped and its behaviour is stable, factoring it into a shared
  `finalizeIssues(issues)` is a safe cleanup. Doing it in this plan would have
  meant editing `analyzeEssay`, which is what the regression tests guarantee is
  untouched.
- **What a reviewer should scrutinise**: (1) that `analyzeEssay`'s body is
  genuinely unchanged — diff it line by line; (2) the `t1-invented-figure`
  guards against the seven step-9 cases; (3) that the `t1-overview` structure
  check and the `t1-overview-missing` issue share one predicate rather than two
  drifting copies.
