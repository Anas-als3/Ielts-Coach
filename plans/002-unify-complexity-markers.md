# Plan 002: Collapse three copies of the complexity-marker lists into one module, and stop matching hyphenated compounds

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: this repository is **not under version control**
> at the time of writing (`git rev-parse` fails). There is no SHA to diff
> against. Instead: open the three files named in "Current state" and confirm
> the excerpts quoted below appear verbatim. If any excerpt does not match,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED — one behaviour change (the hyphen guard) affects band scores; the rest must be byte-for-byte behaviour-preserving
- **Depends on**: none (independent of 001; can run before, after, or in parallel)
- **Category**: tech-debt
- **Planned at**: no VCS — written 2026-08-05 against the working tree as read on that date

## Why this matters

"Complex sentence" is defined **three times** in this codebase, in two mutually
inconsistent ways, and the learner is shown counts from two of them side by side.

1. `src/analysis/rules/grammarRange.ts:13-34` — the GRA definition.
2. `src/analysis/bandEstimate.ts:24-42` — a verbatim copy of #1, with a comment
   that openly admits the duplication.
3. `src/analysis/rules/structure.ts:65-66` — the Structure Rail definition, a
   **different list**.

The Structure Rail counts `after` and `before`, which the GRA rules do not. The
GRA rules count `despite`, `so that`, `provided that`, `in spite of` and
participial openers, which the Rail does not. So an essay can be told
"6 complex sentences" by the rail and have the band estimator count 4 — from the
same text, in the same session, on the same screen.

Both lists are currently canonical in SPEC.md (rail at `SPEC.md:254-257`, GRA at
`SPEC.md:124-128`), so this is *specified* inconsistency rather than drift.
This plan does **not** merge the lists — that would change the rail's
satisfied/unsatisfied behaviour and the band calibration anchors. It makes the
divergence explicit and single-sourced, so the next person to touch it sees both
definitions in one file and has to make a deliberate choice.

It also fixes one genuine false positive found in real learner text: the rail's
`\bafter\b` matches the `after` inside **`after-school`**, so
"offering enjoyable after-school sports" is scored as a complex clause. A word
boundary sits between `after` and `-`, so the hyphenated compound matches. The
same bug affects `before-` compounds. This is a real, wrong credit toward a
learner-facing target.

## Current state

### Copy 1 — `src/analysis/rules/grammarRange.ts:12-34`

```ts
/** Subordinators from SPEC — multi-word phrases first so alternation prefers them. */
const SUBORDINATORS = [
  'provided that',
  'in spite of',
  'even though',
  'so that',
  'although',
  'though',
  'whereas',
  'while',
  'because',
  'since',
  'unless',
  'if',
  'when',
  'despite',
]

const SUBORDINATOR_RE = new RegExp(`\\b(${SUBORDINATORS.join('|')})\\b`, 'gi')
const OPENS_WITH_SUBORDINATOR_RE = new RegExp(`^\\s*(${SUBORDINATORS.join('|')})\\b`, 'i')
const RELATIVE_RE = /\b(which|whose|who)\b/gi
/** Participial opener, applied to the sentence text: "Considering, …" / "Faced, …". */
const PARTICIPIAL_OPENER_RE = /^[A-Z][a-z]+(ing|ed),/
```

and its consumer at `src/analysis/rules/grammarRange.ts:106-114`:

```ts
/** Count complexity markers in one sentence: subordinators + relative pronouns + participial opener. */
function countSentenceMarkers(text: string): { total: number; because: number } {
  const subs = text.match(SUBORDINATOR_RE) ?? []
  let because = 0
  for (const m of subs) if (m.toLowerCase() === 'because') because += 1
  let total = subs.length + (text.match(RELATIVE_RE) ?? []).length
  if (PARTICIPIAL_OPENER_RE.test(text.trimStart())) total += 1
  return { total, because }
}
```

`OPENS_WITH_SUBORDINATOR_RE` is used separately at
`src/analysis/rules/grammarRange.ts:292` as a comma-splice guard.

### Copy 2 — `src/analysis/bandEstimate.ts:20-52`

```ts
/* ------------------------- complexity markers (GRA) ------------------------- */
// Same marker definition as rules/grammarRange.ts (kept module-private there,
// so the small counter is mirrored here).

const SUBORDINATORS = [
  'provided that',
  'in spite of',
  'even though',
  'so that',
  'although',
  'though',
  'whereas',
  'while',
  'because',
  'since',
  'unless',
  'if',
  'when',
  'despite',
]
const SUBORDINATOR_RE = new RegExp(`\\b(${SUBORDINATORS.join('|')})\\b`, 'gi')
const RELATIVE_RE = /\b(which|whose|who)\b/gi
const PARTICIPIAL_OPENER_RE = /^[A-Z][a-z]+(ing|ed),/

function countComplexityMarkers(doc: TokenizedDoc): number {
  let markers = 0
  for (const s of doc.sentences) {
    markers += (s.text.match(SUBORDINATOR_RE) ?? []).length
    markers += (s.text.match(RELATIVE_RE) ?? []).length
    if (PARTICIPIAL_OPENER_RE.test(s.text.trimStart())) markers += 1
  }
  return markers
}
```

The comment on line 21-22 is the admission that this is a copy. Note that
copy 2 does **not** define `OPENS_WITH_SUBORDINATOR_RE`.

### Copy 3 — `src/analysis/rules/structure.ts:60-66` and `119-122`

```ts
/**
 * Complexity markers (Patch v2 C5): subordinators and relative pronouns that
 * signal a complex sentence. 'that' is deliberately excluded — it is too
 * ambiguous (demonstrative, complementiser) to count reliably.
 */
const COMPLEXITY_MARKER =
  /\b(?:although|even though|though|whereas|while|unless|if|because|since|when|after|before|which|whose|who)\b/gi
```

```ts
/** Number of complexity markers in a stretch of text (Patch v2 C5). */
function complexityCount(text: string): number {
  return (text.match(COMPLEXITY_MARKER) ?? []).length
}
```

Consumed at `src/analysis/rules/structure.ts:379` to build the `complex-count`
Structure Rail check.

### The two lists, differenced

| Marker | Rail (structure.ts) | GRA (grammarRange + bandEstimate) |
|---|---|---|
| although, even though, though, whereas, while, unless, if, because, since, when | yes | yes |
| **after**, **before** | yes | no |
| **despite**, **so that**, **provided that**, **in spite of** | no | yes |
| which, whose, who | yes | yes |
| participial opener (`Considering,`) | no | yes |

### Repo conventions you must match

- **TypeScript strict**, no `any`.
- **Analysis modules are pure and synchronous.** They take a `TokenizedDoc` (and
  sometimes a `PromptSpec | null`) and return values; no I/O, no state.
- **Regexes are module-level constants** with a doc comment saying which SPEC
  rule they implement, e.g. `/** Complexity markers (Patch v2 C5): ... */`.
  Match that style.
- **Global regexes are never shared across calls without care.** See
  `src/analysis/tokenize.ts:143-144` for the existing idiom and its rationale:
  `// Fresh regex per call: module-level lastIndex state would be a footgun.`
  `String.prototype.match` with a `/g` regex resets `lastIndex` internally, so
  the existing `text.match(RE)` call sites are safe as written — **do not**
  convert them to `RE.exec` or `matchAll` loops in this plan.
- **SPEC.md is canonical** and both lists are currently specified there. Step 5
  updates SPEC.md to record the hyphen guard.
- **Tests**: vitest in `tests/`, one file per concern. `tests/false-positives.test.ts`
  is the right home for the hyphen-guard case — it exists precisely to pin
  things the rules must *not* flag.

## Commands you will need

| Purpose   | Command                                        | Expected on success |
|-----------|------------------------------------------------|---------------------|
| Typecheck | `npx tsc -b --noEmit`                          | exit 0, no output   |
| Tests     | `npx vitest run`                               | all files pass      |
| One file  | `npx vitest run tests/band-rewards.test.ts`    | all pass            |
| Build     | `npm run build`                                | exit 0              |

Dependencies are already installed. Do **not** run `npm install`.

## Scope

**In scope**:

- `src/analysis/complexity.ts` (create)
- `src/analysis/rules/grammarRange.ts` (modify — remove the local list, import instead)
- `src/analysis/bandEstimate.ts` (modify — remove the local list, import instead)
- `src/analysis/rules/structure.ts` (modify — remove the local list, import instead)
- `tests/false-positives.test.ts` (modify — add the hyphen cases)
- `SPEC.md` (modify — record the hyphen guard in the two marker specs)

**Out of scope** (do NOT touch):

- **Do not merge the two marker lists.** They stay different. Merging changes
  the `complex-count` rail check and the GRA band calibration simultaneously,
  and `tests/band-rewards.test.ts` pins calibration anchors that would move.
  If you believe merging is correct, say so in your report — do not do it.
- `src/analysis/rules/accuracy.ts`, `cohesion.ts`, `lexical.ts`,
  `taskResponse.ts` — untouched.
- `OPENS_WITH_SUBORDINATOR_RE` semantics — it stays a comma-splice guard in
  `grammarRange.ts` with exactly its current behaviour. It moves to the shared
  module but its pattern must not change (note: it has no hyphen guard and must
  not gain one — see step 2).
- Any `IssueCategory` change. The union is frozen.
- The `complex-count` check's target of 4, or its "one per paragraph" rule.

## Git workflow

If plan 001 has not run yet and the repo is still not a git repository, run
`git init` and commit the current tree first (see plan 001, "Git workflow").

- Branch: `advisor/002-unify-complexity-markers`
- One commit per step is fine; plain imperative subjects.
- Do NOT push and do NOT open a PR.

## Steps

### Step 1: Create the shared module

Create `src/analysis/complexity.ts`:

```ts
/**
 * Complexity-marker definitions — the single source of truth for "what counts
 * as a complex sentence" anywhere in the app.
 *
 * There are deliberately TWO lists, because SPEC.md specifies two:
 *
 * - `GRA_SUBORDINATORS` (SPEC.md "rules/grammarRange.ts → sentence-variety")
 *   drives the Grammatical Range criterion and the band estimate. It includes
 *   `despite`, `so that`, `provided that`, `in spite of`, and pairs with a
 *   participial-opener test.
 * - `RAIL_MARKERS` (SPEC.md "Patch v2 → structure C5") drives the Structure
 *   Rail's `complex-count` check. It includes `after` and `before`, excludes
 *   the four phrases above, and has no participial test.
 *
 * They are not the same list and are not interchangeable. Before changing
 * either, note that `tests/band-rewards.test.ts` pins band calibration anchors
 * that depend on the GRA list, and the rail check's satisfied/unsatisfied
 * behaviour depends on the rail list.
 *
 * Both alternations carry a NEGATIVE LOOKAHEAD FOR A HYPHEN. A word boundary
 * sits between `after` and `-`, so an unguarded `\bafter\b` matches the
 * `after` inside `after-school` and credits a hyphenated compound modifier as
 * a subordinate clause. `(?!-)` suppresses that without affecting any
 * genuine clause, since a real subordinator is always followed by whitespace.
 */

/**
 * Subordinators for Grammatical Range (SPEC.md rules/grammarRange.ts).
 * Multi-word phrases first so the alternation prefers them over their prefixes.
 */
export const GRA_SUBORDINATORS: readonly string[] = [
  'provided that',
  'in spite of',
  'even though',
  'so that',
  'although',
  'though',
  'whereas',
  'while',
  'because',
  'since',
  'unless',
  'if',
  'when',
  'despite',
]

/**
 * Structure Rail markers (SPEC.md Patch v2 structure C5). 'that' is
 * deliberately excluded — it is too ambiguous (demonstrative, complementiser)
 * to count reliably.
 */
export const RAIL_MARKERS: readonly string[] = [
  'although',
  'even though',
  'though',
  'whereas',
  'while',
  'unless',
  'if',
  'because',
  'since',
  'when',
  'after',
  'before',
  'which',
  'whose',
  'who',
]

/** Relative pronouns, shared by both definitions. */
export const RELATIVE_PRONOUNS: readonly string[] = ['which', 'whose', 'who']

/** Participial opener, applied to sentence text: "Considering, …" / "Faced, …". (GRA only.) */
export const PARTICIPIAL_OPENER_RE = /^[A-Z][a-z]+(ing|ed),/

/**
 * Build a fresh global alternation over `words`, hyphen-guarded.
 *
 * A NEW RegExp per call, never a shared module constant: a `/g` regex carries
 * `lastIndex` state, and sharing one across call sites is the footgun
 * `tokenize.ts` already documents. Callers that use `String.prototype.match`
 * are safe either way; callers that use `.exec`/`.matchAll` are not.
 */
export function markerRegex(words: readonly string[]): RegExp {
  return new RegExp(`\\b(${words.join('|')})\\b(?!-)`, 'gi')
}

/** GRA markers in one stretch of text: subordinators + relatives. Participial opener is the caller's job. */
export function countGraMarkers(text: string): { total: number; because: number } {
  const subs = text.match(markerRegex(GRA_SUBORDINATORS)) ?? []
  let because = 0
  for (const m of subs) if (m.toLowerCase() === 'because') because += 1
  const relatives = text.match(markerRegex(RELATIVE_PRONOUNS)) ?? []
  return { total: subs.length + relatives.length, because }
}

/** Structure Rail marker count for one stretch of text (SPEC.md Patch v2 C5). */
export function countRailMarkers(text: string): number {
  return (text.match(markerRegex(RAIL_MARKERS)) ?? []).length
}
```

**Verify**: `npx tsc -b --noEmit` → exit 0 (the new file compiles; nothing
imports it yet).

### Step 2: Rewire `grammarRange.ts`

Delete the block at `src/analysis/rules/grammarRange.ts:12-34` (the
`SUBORDINATORS` array, `SUBORDINATOR_RE`, `RELATIVE_RE`,
`PARTICIPIAL_OPENER_RE`) **except** `OPENS_WITH_SUBORDINATOR_RE`, and replace
it with:

```ts
import {
  GRA_SUBORDINATORS,
  PARTICIPIAL_OPENER_RE,
  countGraMarkers,
} from '../complexity'

/**
 * Comma-splice guard: does the sentence OPEN with a subordinator? Anchored, so
 * it needs no hyphen guard — a sentence opening "After-school clubs help" is
 * correctly not a subordinate opener, and the anchored `\b` before a hyphen
 * would be the same false positive, so the guard is kept deliberately narrow
 * by reusing the same word list without `(?!-)`.
 */
const OPENS_WITH_SUBORDINATOR_RE = new RegExp(`^\\s*(${GRA_SUBORDINATORS.join('|')})\\b`, 'i')
```

Add the import to the existing import block at the top of the file (below the
`import type { ... } from '../../types'` line at
`src/analysis/rules/grammarRange.ts:8`).

Then replace `countSentenceMarkers` (`src/analysis/rules/grammarRange.ts:106-114`) with:

```ts
/** Count complexity markers in one sentence: subordinators + relative pronouns + participial opener. */
function countSentenceMarkers(text: string): { total: number; because: number } {
  const { total, because } = countGraMarkers(text)
  return {
    total: total + (PARTICIPIAL_OPENER_RE.test(text.trimStart()) ? 1 : 0),
    because,
  }
}
```

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `grep -c "const SUBORDINATORS" src/analysis/rules/grammarRange.ts` → `0`.

### Step 3: Rewire `bandEstimate.ts`

Delete the whole block at `src/analysis/bandEstimate.ts:20-52` (the banner
comment, `SUBORDINATORS`, `SUBORDINATOR_RE`, `RELATIVE_RE`,
`PARTICIPIAL_OPENER_RE`, and `countComplexityMarkers`) and replace it with:

```ts
/* ------------------------- complexity markers (GRA) ------------------------- */

import { PARTICIPIAL_OPENER_RE, countGraMarkers } from './complexity'

/** Total GRA complexity markers across the document (SPEC.md rules/grammarRange.ts). */
function countComplexityMarkers(doc: TokenizedDoc): number {
  let markers = 0
  for (const s of doc.sentences) {
    markers += countGraMarkers(s.text).total
    if (PARTICIPIAL_OPENER_RE.test(s.text.trimStart())) markers += 1
  }
  return markers
}
```

Move the `import` up to join the existing import block at the top of the file
(above the `/* ---- complexity markers ---- */` banner) rather than leaving it
mid-file — the repo keeps all imports at the top.

`countComplexityMarkers` is called once, at `src/analysis/bandEstimate.ts:392`.
Do not change that call site.

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `grep -c "const SUBORDINATORS" src/analysis/bandEstimate.ts` → `0`.

### Step 4: Rewire `structure.ts`

Delete `src/analysis/rules/structure.ts:60-66` (the `COMPLEXITY_MARKER` doc
comment and constant). Add to the import block at the top of the file (after
the `import { CATEGORY_META, QUESTION_TYPE_META } from '../../meta'` line at
`src/analysis/rules/structure.ts:21`):

```ts
import { countRailMarkers } from '../complexity'
```

Then replace `complexityCount` (`src/analysis/rules/structure.ts:119-122`):

```ts
/** Number of complexity markers in a stretch of text (Patch v2 C5). */
function complexityCount(text: string): number {
  return (text.match(COMPLEXITY_MARKER) ?? []).length
}
```

with:

```ts
/** Number of complexity markers in a stretch of text (Patch v2 C5). */
function complexityCount(text: string): number {
  return countRailMarkers(text)
}
```

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `grep -c "COMPLEXITY_MARKER" src/analysis/rules/structure.ts` → `0`.

### Step 5: Run the full suite and triage any calibration movement

**Verify**: `npx vitest run` → all 4 files pass, 54 tests.

The hyphen guard is a genuine behaviour change, so a test *may* move. If
`tests/band-rewards.test.ts` fails:

- Read the failing assertion. The calibration anchors (SPEC.md:160-161) are
  "op-05 high-band answer ≥ 8.0 on every criterion" and "a weak answer ≤ 6.5".
- If the high-band answer's fixture contains a hyphenated compound whose first
  half is a marker (`after-`, `before-`, `while-`, `if-`), the guard correctly
  removed a marker that was never a clause.
- **Do NOT adjust the anchor thresholds to make the test pass.** Report the
  delta and stop — that is a STOP condition. Changing calibration anchors is a
  product decision, not an executor decision.

### Step 6: Add the false-positive regression tests

Open `tests/false-positives.test.ts` and read its existing structure before
writing — match its `describe`/`it` shape and its helper style.

Add a `describe('hyphenated compounds are not complex markers', ...)` block with
these cases, all going through the real pipeline (`analyzeEssay(text, null)`):

1. An essay containing `"offering enjoyable after-school sports"` and **no
   other marker in that paragraph** produces a `complex-count` structure check
   whose `detail` names that paragraph as having zero markers.
2. The same text with `"after school sports"` (no hyphen) **does** count the
   marker — proving the guard is hyphen-specific, not a blanket removal.
3. `"a before-tax figure"` likewise contributes zero rail markers.
4. `"a well-known problem, which is serious"` still counts `which` — the guard
   must not suppress a marker merely because a hyphen appears elsewhere in the
   sentence.

Find the check with
`analysis.structure.find((c) => c.id === 'complex-count')` and assert on its
`detail` / `satisfied`. Note the rail check requires **≥ 4 total AND ≥ 1 per
paragraph**, so build fixtures where the assertion isolates the marker you are
testing — use short single-paragraph essays and assert on the count in the
`detail` string rather than on `satisfied`.

**Verify**: `npx vitest run tests/false-positives.test.ts` → all pass, including
4 new tests.

### Step 7: Record the guard in SPEC.md

Two edits, both single-sentence additions. Do not change the word lists
themselves.

**7a.** At `SPEC.md:124-128`, the `sentence-variety` spec. Append to the
sentence that ends `+ participial openers (/^[A-Z][a-z]+(ing|ed),/)`:

```
Every marker alternation is hyphen-guarded (`\b(...)\b(?!-)`): a word boundary sits before a hyphen, so
an unguarded `\bafter\b` credits the compound modifier in "after-school" as a subordinate clause.
```

**7b.** At `SPEC.md:254-257`, the structure C5 spec. Append the same note after
`excluding 'that'`:

```
The alternation is hyphen-guarded (`(?!-)`) so hyphenated compounds ("after-school", "before-tax") do
not count. Both marker lists live in `analysis/complexity.ts`; the GRA list and the rail list are
deliberately DIFFERENT and must not be merged without re-running the band calibration anchors.
```

### Step 8: Full green

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `npx vitest run` → all files pass, 58 tests (54 + 4 new).
**Verify**: `npm run build` → exit 0.

## Test plan

- **New tests**: 4 cases in `tests/false-positives.test.ts` (step 6), covering
  the hyphen guard positively and negatively.
- **Structural pattern**: the existing `describe` blocks in
  `tests/false-positives.test.ts` — read it first and match it.
- **Behaviour-preservation is checked by the existing suite.** Steps 2–4 are
  pure refactors: `tests/band-rewards.test.ts`, `tests/patch-v2.test.ts`,
  `tests/paragraphing-gate.test.ts` and `tests/false-positives.test.ts` must all
  still pass **unchanged** after step 4, before the hyphen tests are added. If
  any fails at step 5, the only permitted cause is the hyphen guard, and the
  triage in step 5 applies.
- **Verification**: `npx vitest run` → 4 files, 58 tests, all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc -b --noEmit` exits 0 with no output
- [ ] `npx vitest run` exits 0; 58 tests passing
- [ ] `npm run build` exits 0
- [ ] `test -f src/analysis/complexity.ts` succeeds
- [ ] `grep -rn "const SUBORDINATORS" src/` returns **no matches**
- [ ] `grep -rn "COMPLEXITY_MARKER" src/` returns **no matches**
- [ ] `grep -rln "PARTICIPIAL_OPENER_RE = " src/` returns exactly `src/analysis/complexity.ts`
- [ ] `grep -c "(?!-)" src/analysis/complexity.ts` returns at least 1
- [ ] `grep -n "complexity.ts" SPEC.md` returns one match
- [ ] `git status --porcelain` lists only: `src/analysis/complexity.ts`, `src/analysis/rules/grammarRange.ts`, `src/analysis/bandEstimate.ts`, `src/analysis/rules/structure.ts`, `tests/false-positives.test.ts`, `SPEC.md`
- [ ] `plans/README.md` status row for 002 updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- Any excerpt in "Current state" does not match the live file.
- `tests/band-rewards.test.ts` fails after step 4 (the pure-refactor stage,
  before the hyphen tests exist). That means steps 2–4 changed behaviour, which
  they must not.
- `tests/band-rewards.test.ts` fails at step 5 because a **calibration anchor**
  (≥ 8.0 / ≤ 6.5) no longer holds. Report the exact before/after numbers. Do not
  edit the anchors.
- You conclude the two lists should be merged. Report the reasoning; do not
  merge.
- `OPENS_WITH_SUBORDINATOR_RE` turns out to have call sites outside
  `src/analysis/rules/grammarRange.ts:292` (check:
  `grep -rn "OPENS_WITH_SUBORDINATOR_RE" src/`). The plan assumes exactly one.
- Converting `text.match(RE)` to the new `markerRegex(...)` factory changes a
  count anywhere. It should not — `String.prototype.match` with `/g` resets
  `lastIndex` — but if you observe otherwise, stop and report.

## Maintenance notes

For whoever owns this next:

- **The two lists are still two lists.** `src/analysis/complexity.ts` now makes
  that visible in one place with the reason written down. If a future change
  wants one list, the work is: pick the union, re-run
  `tests/band-rewards.test.ts`, and re-derive the calibration anchors in
  SPEC.md:160-161 against the same two reference essays. That is a product
  decision with a measurable outcome, not a cleanup.
- **`markerRegex` returns a fresh RegExp every call.** That is intentional
  (`lastIndex` safety) and slightly allocates per call. Every caller is invoked
  per-sentence or per-paragraph on a debounced keystroke path, so this is not
  hot. If profiling ever says otherwise, cache per word-list in a `Map` — do
  not go back to module-level `/g` constants.
- **Plan 004 (Task 1 rules) will import from this module.** Task 1 answers are
  graded on the same GRA criterion, so `countGraMarkers` is reused as-is there.
  Do not make it Task-2-specific.
- **What a reviewer should scrutinise**: that the hyphen guard appears in
  `markerRegex` only, and that `OPENS_WITH_SUBORDINATOR_RE` did **not** gain
  one — it is anchored at `^`, and adding `(?!-)` there would be a silent
  behaviour change to the comma-splice guard.
