# Plan 022: Make every registered paper inherit its integrity checks, and lint answer keys for the renderings SPEC already requires

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
>   src/marking/ src/reading/tests/ src/listening/tests/ \
>   tests/reading-marking.test.ts tests/listening-marking.test.ts SPEC.md
> ```
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: **P2**
- **Effort**: M (022-a is ten minutes; 022-b is one to two days, most of it in the number/time/unit generators and in triaging what they find)
- **Risk**: MED — the linter will report findings against the three shipped papers, and each finding is a content judgement, not a mechanical fix. See step 8.
- **Depends on**: none
- **Category**: tests / tech-debt
- **Planned at**: commit `ae92bac`, 2026-08-10

## Why this matters

This is a plan about **what breaks first as content grows**. Nothing in it is
broken today. Both statements are true at once, and the second is why it is P2
rather than P1.

**022-a.** `tests/reading-marking.test.ts` carries fifteen integrity checks —
forty questions numbered 1–40 with unique ids, every multiple-choice key one of
its own options, every completion key inside its own word limit, all three
True/False responses used, every question pointed at a passage that exists.
They are driven by `describe.each(AUTHORED)`, and `AUTHORED` is a hand-written
array of the two papers rather than the registry. A third **Listening** paper
inherits all of its integrity coverage free, because
`tests/listening-marking.test.ts:81` spreads `LISTENING_TESTS`. A third
**Reading** paper — registered in the one place `src/reading/tests/index.ts:17`
says to register it — inherits **none**. This is a one-line fix, and it has to
land before paper #2 exists, because after that the omission is invisible.

**022-b.** SPEC.md already states the rule, and states it better than this plan
could:

> a key that lists some of them is more dangerous than one that lists none,
> because the omission is invisible: a test that walks `question.answers` passes
> however much of the key has been deleted
> — `SPEC.md:968-970`

The marker is built to make that burden total. `src/marking/markAnswerKey.ts:10-15`:

> **What the marker does NOT do is as important as what it does.** It never
> guesses at equivalence. British and American spellings, plurals and genuine
> synonyms are accepted because the answer key LISTS them, not because this
> file transforms them — an automatic -ise/-ize rewrite would be a rule the
> item-writer cannot see, and the first time it accepted something the real
> exam rejects, the app's band would stop meaning what it claims to mean.

That is the right design and this plan does not touch it. But it means an
incomplete key is a **marking defect**, and today the only thing catching that
class is a block of assertions written **by hand, per question id**
(`tests/reading-marking.test.ts:505-551`, `tests/listening-marking.test.ts:312-353`).
Those blocks name `gt1-q14`, `gt1-q11`, `ls-q07`, `ls-q33`, `ls-q29`. They are
excellent for the three papers that exist and worth nothing to a paper that does
not.

The failure mode when a key is short a rendering is specific and quiet: **a
learner loses a mark they earned**, in the under-scoring direction, with no
error message, on the one number this app advertises as exact —

> **The Reading band is exact, not an estimate.** There is no heuristic anywhere
> in it: your answers are marked against a key and the raw score is converted by
> the published table.
> — `README.md:65-67`

One missing rendering on one completion gap is one mark, and at the General
Training conversion table a single mark is worth half a band between 33 and 34
(`tests/reading-marking.test.ts:603-611` pins exactly that cliff — the two
assertions that matter are at `:610-611`).

There is a second reason, and it is the one that will make an item-writer
actually want this. Plan 010 budgets **4–6 hours per passage** with its 13–14
questions. A linter that says *"q17's key lists `two` but not `2`"* turns the
most tedious part of that job — enumerating renderings by hand, from memory,
under a word limit — into a checklist. It reduces the cost of new content, which
is the thing standing between this app and a second paper per module.

## Current state

### The registry, and the one place a paper is registered

`src/reading/tests/index.ts:1-31` (whole file, abridged):

```ts
/**
 * The authored Reading tests, and the two lookups the app needs.
 *
 * One complete test per module ships in v1, which is deliberate: plan 010
 * budgets 4–6 hours of item-writing per passage and says to validate the format
 * before authoring more. Adding a test means adding a file here and one entry
 * to `READING_TESTS`; nothing else in the Reading code counts or names them.
 */
import { ACADEMIC_TEST_01 } from './academicTest01'
import { GENERAL_TEST_01 } from './generalTest01'
...
/** Every authored test, in the order they should be offered. */
export const READING_TESTS: readonly ReadingTest[] = [ACADEMIC_TEST_01, GENERAL_TEST_01]   // :17
```

"nothing else in the Reading code counts or names them" is true of `src/`. It
is **false** of `tests/`.

### The hand-written list that does not follow the registry

`tests/reading-marking.test.ts:25` already imports the registry:

```ts
import { ACADEMIC_TEST_01, GENERAL_TEST_01, READING_TESTS, readingTestById, readingTestsForModule } from '../src/reading/tests'
```

and then, at `:66`:

```ts
const AUTHORED: ReadingTest[] = [ACADEMIC_TEST_01, GENERAL_TEST_01]
```

feeding fifteen `it`s inside `describe.each(AUTHORED)('$title integrity', (test) => {` at
`:342`. Count them before you quote the number anywhere: they open at `:343`,
`:349`, `:354`, `:364`, `:371`, `:387`, `:403`, `:414`, `:426`, `:436`, `:446`,
`:451`, `:465`, `:472` and `:486`, and the block closes at `:492`.

Listening does it correctly, `tests/listening-marking.test.ts:81`:

```ts
const AUTHORED: ListeningTest[] = [...LISTENING_TESTS]
```

There **is** a tripwire, `tests/reading-marking.test.ts:577-581`:

```ts
  it('offers each module only its own test', () => {
    expect(readingTestsForModule('academic')).toEqual([ACADEMIC_TEST_01])
    expect(readingTestsForModule('general')).toEqual([GENERAL_TEST_01])
    expect(READING_TESTS).toHaveLength(2)
  })
```

so a third paper does fail *something*. But the obvious repair is to edit those
three lines, and nothing then draws attention to `:66`. That is precisely how
drift like this survives — the forcing function points at the wrong line.

### The by-hand completeness blocks, and what they cannot generalise to

`tests/reading-marking.test.ts:494-551`. Its header states the problem exactly:

```
 * The integrity block above walks `q.answers`, so it passes however much of a
 * key you delete: it proves a key is self-consistent, never that it is
 * complete. These write the learner's forms out by hand instead, and fail the
 * moment the paper loses one.
```

and the block itself is question-id-specific:

```ts
describe('authored answer keys are complete in their own renderings', () => {
  const FERRY_TIME = 'gt1-q14'

  it('accepts every ordinary way of writing the ferry’s departure time', () => {
    const forms = [
      '18:15', '18.15', '6.15pm', '6:15pm', '6.15 pm', '6:15 pm',
      '6.15p.m.', '6:15p.m.', '6.15 p.m.', '6:15 p.m.',
      // Case and stray space are the marker's job, not the key's.
      '6.15 PM', '  6:15 p.m. ',
    ]
    for (const given of forms) {
      const result = markAnswerKey(GENERAL_TEST_01, { [FERRY_TIME]: given })
      expect(result.raw, `Q14 rejects "${given}"`).toBe(1)
    }
  })
  ...
  it('gives both the numeral and the word form of every number a learner writes', () => {
    const numeric: Array<[string, string[]]> = [
      ['gt1-q11', ['8', 'eight']],
      ['gt1-q16', ['six months', '6 months']],
      ['gt1-q17', ['two', '2']],
      ['gt1-q19', ['three months', '3 months']],
    ]
    ...
```

`tests/listening-marking.test.ts:312-352` is the same idea, hard-coded to
`ls-q07` (a preprinted `£`), `ls-q33` and `ls-q38` (preprinted units), and
`ls-q29` (an authored article). Note that this one sits *outside* the
`describe.each(AUTHORED)` block and names `LISTENING_TEST_01` directly — so even
Listening, whose registry wiring is correct, gives a second paper the integrity
block and **not** the completeness block.

### What SPEC already commits the papers to

`SPEC.md:964-991`, the section "The other half of that rule: keys must be
COMPLETE". Its table is the whole specification of what 022-b generates:

| Class | Written out as |
|---|---|
| numbers | figures and words, and the ordinal where the gap is a date — `['14', '14th', 'fourteenth']` |
| a unit or currency symbol **preprinted beside the gap** | with it repeated and without — `£ ____` takes `['680', '£680', '£ 680', '680 pounds']` |
| times | both separators and both clocks, `pm` spaced and closed up, pointed and bare — ten forms for one sailing |
| spelling and hyphenation | every variant the exam accepts, British and American — `['1,000 metres', '1,000 meters']`, `['cross-dating', 'cross dating', 'crossdating']` |

and its boundary, `SPEC.md:980-986`:

> Two forms are deliberately NOT listed… **A unit or symbol is the same value
> written differently** — "£680" and "680" are one answer, so both belong in the
> key. **Preprinted words that are not units are additional content**, not
> another rendering… And anything that breaks the printed word limit stays out
> however right it sounds, because the marker checks the limit first and would
> fail it anyway.

### The marker, which the linter will use as its oracle

`src/marking/markAnswerKey.ts` exports exactly three things — `normaliseAnswer`
(`:93`), `countWords` (`:113`) and `markAnswerKey` (`:204`).

**`isAccepted` (`:142`) and `stripLeadingArticle` (`:119`) are module-private and
carry no `export`.** Read the file and confirm this before writing a line of
`keyLint.ts`: it means `markAnswerKey` is the ONLY entry point through which the
linter can ask "does the key accept this?", and every candidate the linter
generates has to be marked as a whole submission. Exporting `isAccepted` to make
the linter's life easier is out of scope — it is a change to
`markAnswerKey.ts`, which "The hard boundary" forbids.

The per-question result records `overWordLimit` separately from `correct`
(`:214-231`):

```ts
    const limit = question.maxWords
    const overWordLimit =
      typeof limit === 'number' && limit > 0 && !blank && countWords(normalised) > limit
    ...
      // Order matters: a blank is never correct, and an over-length answer is
      // wrong before its content is ever compared.
      correct: !blank && !overWordLimit && isAccepted(normalised, question),
```

That distinction is what makes the linter cheap and exact: a candidate rendering
that comes back `overWordLimit: true` is one SPEC says to leave out, and a
candidate that comes back `correct: false, overWordLimit: false` is a missing
key entry. Both come off the same `ReadingQuestionResult`
(`src/reading/types.ts:259` declares `overWordLimit`), so the linter reads the
word limit off the result and never re-checks it.

The linter therefore never re-implements case folding, edge punctuation,
typographic quotes or the optional leading article — that logic lives in the
private `isAccepted` (`:142-154`), which it cannot call and must not copy. It
asks the real marker instead.

### The question shapes it lints

Reading, `src/reading/types.ts:126-172`:

```ts
interface ReadingQuestionBase {
  id: string
  number: number
  passageIndex: number
  /** The statement, question or gapped sentence shown to the learner. */
  prompt: string
  /** Accepted answers, canonical key first. Never empty. */
  answers: string[]
  explanation?: string
}

export interface CompletionQuestion extends ReadingQuestionBase {
  type: 'completion'
  maxWords: number
}
```

Listening, `src/listening/types.ts:201-202`:

```ts
export type ListeningCompletionQuestion = Omit<CompletionQuestion, 'passageIndex'> & ListeningItemFields
```

So one structural input type covers both. The `prompt` carries the gap as a run
of underscores, and the preprinted unit sits beside it — real examples:

```
src/reading/tests/generalTest01.ts:481   'The Spanish class takes no more than ______ students.'          answers ['8', 'eight']
src/reading/tests/generalTest01.ts:511   'In winter the last ferry of the day sails at ______.'           answers [ …ten time forms… ]
src/listening/tests/test01.ts:1128       'Total cost of the stay: £ ____________'                        answers ['680', '£680', '£ 680', '680 pounds']
src/listening/tests/test01.ts:1492       'In the middle latitudes the sound-speed minimum lies about ____________ metres down.'
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npx tsc -b --noEmit` | exit 0, no output |
| Whole suite | `npx vitest run` | `Test Files 24 passed`, `Tests 848 passed` at the baseline |
| Engine only | `npx vitest run --project engine` | all pass |
| Reading marking | `npx vitest run tests/reading-marking.test.ts` | all pass |
| The new lint | `npx vitest run tests/answer-key-lint.test.ts` | all pass |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**:

- `tests/reading-marking.test.ts` (modify — 022-a, plus one coverage guard)
- `src/marking/keyLint.ts` (**create** — the pure generator)
- `tests/answer-key-lint.test.ts` (**create** — runs it over every registered paper)
- `src/reading/tests/academicTest01.ts`, `src/reading/tests/generalTest01.ts`,
  `src/listening/tests/test01.ts` (modify — **only** to ADD accepted renderings
  the linter finds, each with a one-line comment naming the class it belongs to)
- `SPEC.md` (modify — record that the linter exists, and what it deliberately
  does not cover)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):

- **`src/marking/markAnswerKey.ts`.** Not one line. See "The hard boundary"
  below — this is the single most important constraint in the plan.
- **Spelling and hyphenation variant generation.** SPEC's fourth class is not
  mechanisable and the plan must not pretend otherwise (see "What this linter
  cannot do").
- The passages, the question prompts, the explanations, or which answer is
  canonical. The linter adds *alternatives*; `answers[0]` stays where it is,
  because `markAnswerKey.ts:229` reports it back to the learner as `expected`.
- Non-completion question types. True/False, Yes/No, multiple choice and both
  matching types have closed answer sets already pinned by
  `tests/reading-marking.test.ts:371-412` and `:426-`.
- `package.json` — no runtime dependency may be added. Runtime deps are exactly
  `react` and `react-dom` and that is a stated architectural property.
- Authoring a third paper. This plan makes one cheaper; it does not write one.

## The hard boundary — test/build time ONLY

**`keyLint` must never be reachable from `markAnswerKey`.** Not imported by it,
not called by it, not wired into `isAccepted` behind a flag.

The reason is stated in the code the plan is protecting
(`src/marking/markAnswerKey.ts:12-15`): a transform the item-writer cannot see is
a rule nobody can audit, and the first time it accepts something the real exam
rejects, the band stops meaning what it claims. Generating `['680', '£680', '£ 680', '680 pounds']`
inside the marker would be **exactly** that transform — the same code, moved to
the place where it becomes invisible.

The distinction is not stylistic:

- **A lint is visible to the author.** It fails a test, prints a rendering, and a
  human decides whether the exam really accepts it and writes it into the key.
  The key remains the whole truth, and `answers` is still readable as the
  complete list of what will be marked right.
- **A runtime transform is invisible to everyone.** The key no longer says what
  the marker accepts, `ReadingQuestionResult.accepted` (`:230`) becomes a lie,
  and the report shows a learner an `accepted` list that is not the one they were
  marked against.

`! grep -q keyLint src/marking/markAnswerKey.ts` is a done criterion for this
reason. Written negated on purpose: `grep` exits 1 when it finds nothing, so the
absence this plan wants is a `grep` "failure", and a checklist that reads a
non-zero `grep` as a broken step will report the correct outcome as a problem.

## What this linter cannot do — say it in the file header

Three of SPEC's four classes are mechanical. The fourth is not, and the plan is
worthless if the executor pretends otherwise:

- **numbers**, **units/symbols** and **times** are closed transformations of a
  value. `8 ↔ eight`, `680 ↔ £680 ↔ 680 pounds`, `18:15 ↔ 6.15 pm`. A generator
  enumerates them completely and the word limit prunes them.
- **"every spelling variant the exam accepts"** is not a function of the answer
  string. `metres/meters` is a lookup; `cross-dating / cross dating / crossdating`
  is a judgement about a specific compound; `judgement/judgment`,
  `programme/program` and `-ise/-ize` are a dictionary this repo does not have
  and must not invent. Emitting a guess here would produce keys that accept
  things the real exam rejects — the app over-scoring, which is worse than the
  under-scoring this plan fixes, because a learner acts on it.

So the linter covers three classes exactly and reports nothing about the fourth.
Write that in `keyLint.ts`'s header comment and in the SPEC edit, so nobody
later reads a clean lint as "the keys are complete".

## Git workflow

- Branch: `advisor/022-answer-key-linter`
- Commits: one for 022-a; one for `keyLint.ts` + its test; one per class of
  content addition in step 8 (`numbers`, `units`, `times`), so a reviewer can
  read the content changes separately from the machinery; one for SPEC.
- Message style matches `git log`: imperative, sentence case, no prefix tag —
  e.g. `Drive the Reading integrity block from the registry`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Establish the baseline

```bash
npx tsc -b --noEmit
npx vitest run 2>&1 | tail -5
```

**Verify**: typecheck exits 0; `Test Files 24 passed`, `Tests 848 passed`. If
any test fails, STOP.

### Step 2 (022-a): Drive the Reading integrity block from the registry

In `tests/reading-marking.test.ts`, replace `:66`:

```ts
const AUTHORED: ReadingTest[] = [ACADEMIC_TEST_01, GENERAL_TEST_01]
```

with:

```ts
/**
 * Every registered paper, not a hand-written list of the two that exist today.
 *
 * `src/reading/tests/index.ts` says a paper is added by putting one entry in
 * `READING_TESTS` and that "nothing else in the Reading code counts or names
 * them" — which was true of src/ and false here. A hand-written array means a
 * third paper ships with none of the fifteen integrity checks below: no
 * guarantee it has forty questions, no guarantee its multiple-choice keys are
 * among their own options, no guarantee a completion key fits its own word
 * limit. Listening already spreads its registry; this matches it.
 */
const AUTHORED: ReadingTest[] = [...READING_TESTS]
```

`READING_TESTS` is already imported at `:25` — no import change is needed.

Then add one guard to the `describe('authored test structure', …)` block that
ends at `:587`, so a paper that is registered but unreachable cannot slip past:

```ts
  it('offers every registered paper to exactly one module', () => {
    // A paper whose `module` is neither value is registered, marked, and never
    // shown to anyone — the pickers only ever list `readingTestsForModule`.
    const offered = [...readingTestsForModule('academic'), ...readingTestsForModule('general')]
    expect(offered.map((t) => t.id).sort()).toEqual(READING_TESTS.map((t) => t.id).sort())
  })
```

Leave `:577-581` (`offers each module only its own test`) exactly as it is. It
is a deliberate tripwire on the count, and this plan is not the place to loosen
it.

**Verify**:

```bash
npx vitest run tests/reading-marking.test.ts
grep -n "AUTHORED" tests/reading-marking.test.ts
```

→ all pass; `AUTHORED` is defined once, from `READING_TESTS`.

**Verify (behaviour-preserving)**: the file's test count is unchanged except for
the one new case. `describe.each` still produces two suites,
`Academic Reading Test 1 integrity` and `General Training Reading Test 1 integrity`.

### Step 3: Create `src/marking/keyLint.ts` — types and the oracle

The module is pure, has no imports outside `src/marking/` and `src/reading/`,
and exports **one function and three types**: `keyLint`, plus
`LintableQuestion`, `KeyLintClass` and `KeyLintFinding`.

Everything shown in this step and in steps 4–6 is the module's SHAPE, not its
text. Signatures given without a body are marked **"signature only"** and you
write the body: pasting a bodyless `export function` into a `.ts` file is
`TS2391 Function implementation is missing`, and `keyLint.ts` lives under `src/`,
which `tsconfig.json` typechecks (`"include": ["src"]` is the last line of that
file — `tests/` is not typechecked, `src/` is).

```ts
/**
 * Answer-key completeness lint. Implements SPEC.md "The other half of that rule:
 * keys must be COMPLETE".
 *
 * `markAnswerKey` never guesses at equivalence — see its header — so every
 * rendering a real examiner accepts has to be written into `question.answers`
 * by hand. That is the right design and this file does not change it. What it
 * does is tell the ITEM-WRITER which renderings they still owe, at test time,
 * by generating the forms SPEC's table implies and asking the real marker
 * whether the key already accepts each one.
 *
 * **This module is test/build-time only.** It is not imported by
 * `markAnswerKey.ts` and must never be. A lint is visible to the author, who
 * decides whether the exam really accepts a form and writes it into the key; a
 * runtime transform is invisible to everyone, makes `answers` no longer the
 * truth about what is marked right, and turns the `accepted` list the report
 * shows a learner into a lie.
 *
 * **It covers three of SPEC's four classes and no more.** Numbers, preprinted
 * units and symbols, and times are closed transformations of a value and can be
 * enumerated completely. "Every spelling variant the exam accepts" is not a
 * function of the answer string — `metres/meters` is a lookup, `cross-dating /
 * cross dating / crossdating` is a judgement about one compound — and guessing
 * there would make keys accept forms the real exam rejects, which is the
 * OVER-scoring direction and worse than the gap it would close. A clean lint
 * therefore does not mean a complete key.
 */
```

Types. **`type` must be declared `ReadingQuestionType`, not `string`** — this is
the one detail that decides whether the file compiles at all:

```ts
import type { ReadingQuestionType } from '../reading/types'
import { markAnswerKey } from './markAnswerKey'
```

```ts
/**
 * The minimum a question must expose to be linted. Both `CompletionQuestion`
 * (Reading) and `ListeningCompletionQuestion` satisfy it structurally — the
 * Listening variant is the Reading one minus `passageIndex` — so one function
 * covers both papers without either module importing the other.
 */
export interface LintableQuestion {
  id: string
  number: number
  /** Only 'completion' is linted; anything else returns []. */
  type: ReadingQuestionType
  /** The gapped sentence as printed, gap marked by a run of underscores. */
  prompt: string
  /** Absent on the non-completion types, exactly as in `MarkableQuestion`. */
  maxWords?: number
  answers: string[]
}

export type KeyLintClass = 'number' | 'unit' | 'time'

export interface KeyLintFinding {
  questionId: string
  questionNumber: number
  klass: KeyLintClass
  /** The rendering the key does not accept. */
  missing: string
  /** Which listed answer implied it, so the author can see the derivation. */
  from: string
  /** One sentence for the item-writer, quoting the SPEC class. */
  reason: string
}

// Signature only — you write the body.
export function keyLint(question: LintableQuestion): KeyLintFinding[]
```

Why those two field types are not free choices:

- **`type: ReadingQuestionType`** (the union at `src/reading/types.ts:104-110`).
  The oracle hands the question straight to `markAnswerKey`, whose
  `MarkableQuestion.type` is `ReadingQuestionType`
  (`src/marking/markAnswerKey.ts:50`). `string` is not assignable to that union,
  so `type: string` is a compile error the moment `verdict` is written — and
  step 3's verify is `npx tsc -b --noEmit` → exit 0, which it would fail
  immediately. The alternative — keeping `string` and having `verdict`
  construct a `MarkableQuestion` with a hard-coded `type: 'completion'` — is
  rejected on purpose: it would make the linter mark a multiple-choice question
  as a completion one instead of returning `[]` for it.
- **`maxWords?: number`**, optional, mirroring `MarkableQuestion.maxWords`
  (`markAnswerKey.ts:54`). The test plan calls `keyLint` on a multiple-choice
  question and expects `[]`; multiple choice has no `maxWords`, so a required
  field would make that test itself a type error.

The oracle, which every class routes through:

```ts
/**
 * Would the marker accept `candidate` for this question, as the key stands?
 *
 * Goes through `markAnswerKey`, which is not a preference but the only option:
 * `isAccepted` and `stripLeadingArticle` are module-private in
 * `markAnswerKey.ts` and cannot be imported. It is also the right option. The
 * marker folds case, strips edge punctuation, normalises typographic quotes and
 * dashes, and treats a leading article as optional on completion answers. A
 * linter that re-derived any of that would eventually disagree with it, and
 * would then demand renderings the marker already accepts — noise, which is how
 * an author learns to ignore a lint.
 *
 * The word limit is read off the result rather than re-checked, because SPEC is
 * explicit that an over-limit form "stays out however right it sounds".
 */
// Signature only — you write the body.
function verdict(question: LintableQuestion, candidate: string): 'accepted' | 'missing' | 'over-limit'
```

The body is one call and two reads:

```ts
const result = markAnswerKey(
  // `module` only selects a band table, and the band is discarded here, so the
  // value is arbitrary. `id` is never read back either.
  { id: 'lint', module: 'academic', questions: [question] },
  { [question.id]: candidate },
)
const marked = result.questions[0]
if (marked.overWordLimit) return 'over-limit'
return marked.correct ? 'accepted' : 'missing'
```

Check `overWordLimit` FIRST. `markAnswerKey.ts:226` already makes an over-limit
answer `correct: false`, so testing `correct` first would report an over-limit
form as a missing key entry — the class-3 mistake step 8 says should never
reach a finding.

**Verify**: `npx tsc -b --noEmit` → exit 0.

To reach exit 0 at the end of this step, `keyLint` needs a body even though no
class is written yet — `return []` for anything that is not
`type === 'completion'`, and `return []` for now otherwise, with the classes
filled in over steps 4–6. A declaration with no body does not typecheck, and
`src/` is typechecked. No test runs yet.

### Step 4: The `time` class

Trigger: any listed answer whose **normalised** form is a clock time. Match
against `normaliseAnswer(answer)`, never the raw string, and match the WHOLE
string:

```ts
/** Anchored at both ends, and run over `normaliseAnswer(answer)`. */
const TIME = /^(\d{1,2})[.:]([0-5]\d)(?:\s?(a\.?m|p\.?m))?$/
```

The marker forms in that alternation are `am`, `pm`, `a.m` and `p.m` — with **no
trailing period** — and the optional space is a single `\s?`, not a general
"followed by a marker". That is not a simplification, it is what the marker
leaves behind: `normaliseAnswer` strips edge punctuation
(`markAnswerKey.ts:73,103`), so

- `'6.15p.m.'` normalises to the single token **`6.15p.m`** — one token, nothing
  following it, trailing period gone. A matcher expecting a separate am/pm token
  after the time misses this form entirely, and with it four of the ten;
- `'6.15 p.m.'` normalises to **`6.15 p.m`** (two tokens rejoined by one space);
- `'6.15 PM'` normalises to **`6.15 pm`**, which is why the key does not list it
  and the linter must not demand it.

Confirm this for yourself before writing the regex — `normaliseAnswer('6.15p.m.')`
in a scratch test — because the ten-form target below is only reachable if the
closed-up form matches.

**Only generate when at least one listed form is unambiguous** — a 24-hour
reading (hour ≥ 13, or hour 12/0), or one carrying an explicit am/pm. A key
listing only `6.15` does not say which half of the day it means, and inventing
`18:15` for it would put a wrong answer in the key. When every listed form is
ambiguous, return no findings and say why in a comment.

From an unambiguous time, generate the ten forms SPEC names, which are exactly
the twelve minus the two the marker already handles (case, stray space):

```
24-hour: HH:MM, HH.MM                       (HH zero-padded)
12-hour: h:MMpm, h.MMpm, h:MM pm, h.MM pm, h:MMp.m., h.MMp.m., h:MM p.m., h.MM p.m.
```

Generate these as the strings an author would PASTE — `'6.15p.m.'` with its
trailing period, not the normalised `'6.15p.m'` — because `missing` is copied
into a content file by hand. `verdict` normalises them on the way in, so the two
never diverge.

`gt1-q14` (`src/reading/tests/generalTest01.ts:505-531`; the item-writer's
comment at `:512-517`, the `answers` array at `:518-529` with the ten strings
themselves at `:519-528`) already lists all ten and is the fixture that proves
the generator agrees with the hand-written block at
`tests/reading-marking.test.ts:508-529`.
**`keyLint` over `gt1-q14` must return zero findings.** If it returns any, the
generator is wrong, not the key.

**Precedence over the `number` class — read this before writing step 5.**
`gt1-q14`'s ten answers contain the digit runs `18`, `15` and `6`. A number
generator that saw them would demand `eighteen`/`fifteen`, `keyLint(gt1-q14)`
would be non-empty, and the STOP condition below would fire with no remedy
available. Two independent rules stop that, and the plan wants both:

1. **The time class wins.** If `TIME` matches a listed answer, the number class
   does not run on that answer at all. Compute the time matches first and pass
   the set of consumed answers to the number class.
2. **The number tokeniser structurally excludes clock digits anyway** (step 5).
   Its guards refuse any digit run adjacent to a `:` or a `.`, so `18:15`,
   `18.15` and `6.15pm` yield no count token even if rule 1 were removed. Rule 1
   is the stated policy; rule 2 is the thing that actually holds if someone
   reorders the classes.

**Verify**: a unit test in `tests/answer-key-lint.test.ts` (created in step 7,
or write this one first and let the file grow):

- `keyLint(gt1-q14)` → `[]`
- `keyLint({ …gt1-q14, answers: ['18:15'] })` → nine findings, all `klass: 'time'`,
  whose `missing` values are the other nine forms
- `keyLint({ …gt1-q14, answers: ['6.15'] })` → `[]`, with a test name saying
  **why**: an ambiguous clock is not something the linter may resolve

### Step 5: The `number` class

Trigger: a listed answer that the time class did not consume (step 4, rule 1)
and that contains a **standalone count token**. Both halves of that phrase are
load-bearing and are defined here, because a loose reading of either produces
findings the papers will never accept.

**What a count token is.** Run over the normalised answer, split on spaces. A
whitespace-separated token is a count token when the WHOLE token is either

- a figure matching

  ```ts
  /^(?:\d{1,3}(?:,\d{3})+|\d{1,4})$/
  ```

  — and when scanning a longer string rather than a single token, the same shape
  guarded on both sides:

  ```ts
  /(?<![\d.:,])(?:\d{1,3}(?:,\d{3})+|\d{1,4})(?![\d.:,])/
  ```

- or a number name from the bounded table below (`eight`, `one thousand`, …);

- **or, inside a date gap only** (the carve-out in step 5 below — the prompt
  contains a month name), an ordinal figure matching `/^\d{1,4}(?:st|nd|rd|th)$/`
  or an ordinal word from the bounded table. Each maps to its cardinal: `14th`
  and `fourteenth` both map to `14`.

  This third form exists solely so the date carve-out can derive the ordinal
  pair from *any* of the three listed spellings rather than only from the bare
  figure. **Outside a date gap an ordinal is never a count token** — it is
  neither a generation source nor a target, so `21st` in an ordinary completion
  answer is left alone.

The guards are what make `18:15`, `18.15`, `6.15pm` and `0.9` structurally
impossible to tokenise: every digit in them is adjacent to a `:` `.` or another
digit, so no match starts or ends there. Check that yourself against `18:15`
(no match), `0.9 seconds` (`src/reading/tests/academicTest01.ts:830` — no
match), `1,000` (matches whole), `1000` (matches whole), `680` (matches whole),
and `14th` (**no** match as a whole token under the first form — it is a count
token only under the date-gap form above, and only when the prompt names a
month).

**Where a count token may sit.** The class fires only when the count token is
either

- **(a)** the entire answer — `'8'`, `'eight'`, `'1,000'`; or
- **(b)** the first of exactly two tokens, whose second token is in the closed
  unit list of step 6 — `'six months'`, `'20 hertz'`, `'15 pounds'`,
  `'1,000 metres'`.

Nothing else. In particular the class never substitutes a number word buried in
a compound or in prose:

- `ls-q30`'s key is `['a one-page plan', 'one-page plan', 'one page plan']`
  (`src/listening/tests/test01.ts:1457`). `'one-page'` is a single normalised
  token and is not a count token, so forms (a) and (b) both miss it. The third
  entry IS three tokens beginning with `one` — which is exactly why (b) is
  capped at two tokens and requires a unit word as the second. Naive "substitute
  the number token in place" would emit `'1-page plan'` and `'1 page plan'`,
  both class-2 findings against a key a human wrote deliberately.
- `'£15'` is one token and not a count token, and `'£ 15'` puts the count token
  second, so neither can produce `'£fifteen'` or `'£ fifteen'` — forms
  `ls-q08`'s own comment (`src/listening/tests/test01.ts:1145-1146`) says nobody
  writes.

Generate the counterpart rendering — figure from word, word from figure — using a
**bounded** table:

- integers 0–20 by name; tens 30…90; composition for 21–99 (`twenty-one`, and
  `twenty one`, since the marker treats a hyphen and a space differently once
  normalised — verify this with the oracle rather than assuming);
- `100`/`one hundred`, `1,000`/`1000`/`one thousand`, and the comma/no-comma pair
  for any four-digit figure.

Deliberately **not** generated, and each needs a comment saying so:

- anything above 10,000 or with a decimal point — no candidate writes
  `twenty-six thousand four hundred` into a two-word gap, and the word limit
  would reject it anyway;
- ordinals, **except** in a date gap — see the carve-out immediately below.

#### The date-gap carve-out, and why it is not optional

A gap is a **date gap** when its `prompt` contains one of the twelve month names
(closed list, case-insensitive: January…December). SPEC scopes the ordinal to
exactly this case — "the ordinal where the gap is a date", `SPEC.md:975`, whose
worked example is `['14', '14th', 'fourteenth']`.

In a date gap the number class emits, from any listed count token, the **ordinal
pair** — the ordinal figure (`14th`) and the ordinal word (`fourteenth`) — and
**not the bare cardinal word** (`fourteen`).

That last clause is the whole point of the carve-out. `ls-q03`
(`src/listening/tests/test01.ts:1076-1085`) is `prompt: 'Arrival date:
____________ September'` with `answers: ['14', '14th', 'fourteenth']` — the very
list SPEC.md:975 prints. The default rule ("integers 0–20 by name") would
generate `fourteen` from `14`, `fourteen` is not in that key, and a rendering
the paper deliberately omits is a **class-2** finding, which STOPs the executor
on the first Listening question in the file. With the carve-out, `14` yields
`14th` and `fourteenth`, `14th` yields `14` and `fourteenth`, `fourteenth`
yields `14` and `14th` — all three already listed, so `keyLint(ls-q03)` is `[]`.

Outside a date gap the rule is unchanged and no ordinal is ever demanded:
`'The Spanish class takes no more than ______ students.'` (`gt1-q11`) must not
produce `8th`, which is exactly the noise that trains an author to stop reading
the lint.

#### Multi-word answers

Handled by form (b) only — the count token plus one unit word, substituted in
place: `six months → 6 months`, the pair `tests/reading-marking.test.ts:540`
already writes by hand. Longer answers are left alone; see the `ls-q30` case
above.

**Verify**: `keyLint` over `gt1-q11` (`['8', 'eight']`), `gt1-q16`
(`['six months', '6 months']`), `gt1-q17` and `gt1-q19` returns `[]` — the four
questions the hand-written block at `tests/reading-marking.test.ts:537-550`
already covers. Then **four** more, each of which is a defect the plan has already
been through once — write all four; the date one is the case whose absence STOPs
the plan:

- `keyLint({ …gt1-q11, answers: ['8'] })` → one finding, `missing: 'eight'`
  (the generator has teeth);
- **`keyLint(gt1-q14)` → `[]`, asserted again here and named
  "the number class does not fire on a time"** — step 4 pins the same value from
  the time side; this test fails if the precedence rule or the tokeniser guards
  are dropped. Write it before step 8, not after;
- `keyLint(ls-q03)` → `[]`, named "a date gap takes the ordinal, never the
  cardinal word"; and `keyLint({ …ls-q03, answers: ['14'] })` → findings for
  `14th` and `fourteenth` and **not** for `fourteen`;
- `keyLint(ls-q30)` → `[]`, named "a number word inside a compound is not a
  count token".

### Step 6: The `unit` class

Trigger: the `prompt`. Find the gap (`/_{2,}/`), then look at the token
immediately before and immediately after it:

- **before**: a currency symbol (`£ $ € ¥`), possibly space-separated —
  `'Total cost of the stay: £ ____________'` (`src/listening/tests/test01.ts:1128`);
- **after**: a unit word from a small closed list — `metres, meters, kilometres,
  kilometers, km, m, kg, hertz, hz, pounds, dollars, euros, per cent, percent,
  minutes, hours, days, weeks, months, years`. `'…lies about ____________ metres down.'`
  (`src/listening/tests/test01.ts:1492`).

A question whose prompt has no `/_{2,}/` gap at all — the short-answer format,
`ls-q29` and `ls-q30` — has no preprinted anything, so this class generates
nothing for it. Say so in a comment; it is not an oversight.

**"Numeric listed answer" is defined, not left to taste.** A listed answer is
numeric for this class when, after normalisation and after removing an adjacent
currency symbol or trailing unit word, what remains is a single **count token**
in the step-5 sense — a figure (`680`, `1,000`, `1000`) or a number name from
the bounded table (`fifteen`, `one thousand`). `'0.9 seconds'`
(`src/reading/tests/academicTest01.ts:830`) is not numeric under that definition:
`0.9` fails the figure guard, so the class stays silent, which is correct —
there is no gap-adjacent unit there either.

From a numeric listed answer, generate the value **with** the symbol/unit
repeated and **without** it, in the shapes SPEC's example gives
(`£ ____` → `['680', '£680', '£ 680', '680 pounds']`), subject to one asymmetry
that the keys already encode:

- the **symbol-attached** forms (`£680`, `£ 680`) are generated **only from a
  figure**, never from a number name. `ls-q08`
  (`src/listening/tests/test01.ts:1138-1149`) lists `['15', 'fifteen', '£15',
  '£ 15', '15 pounds', 'fifteen pounds']` and its own comment at `:1145-1146`
  says why: *"£fifteen is not a form anyone writes and is not listed."* A
  generator that treats `fifteen` as interchangeable with `15` here emits
  `£fifteen` and `£ fifteen`, both class-2, and STOPs the plan;
- the **spelled-out unit** form (`X pounds`, `X metres`, `X hertz`) is generated
  from both the figure and the number name — `15 pounds` and `fifteen pounds`
  are both in `ls-q08`'s key, `20 hertz` and `twenty hertz` are both in
  `ls-q38`'s (`src/listening/tests/test01.ts:1556`).

The `pounds`/`dollars`/`euros` spelled-out form is generated only for the
currency symbols, from a symbol→word map.

Hold SPEC's boundary at `:982-985` exactly: **only units and currency symbols**.
A preprinted word that is not a unit is additional content, not another
rendering. Keep the unit list closed and short; when the token after the gap is
not in it, generate nothing. If an author needs a unit the list does not know,
the fix is one entry in the list plus a comment — not a heuristic.

**Verify**: `keyLint` over `ls-q07`, `ls-q08`, `ls-q33`, `ls-q38` returns `[]`
(the four the hand-written Listening block at `tests/listening-marking.test.ts:312-343`
already covers). Then two more:

- **Teeth**: `keyLint({ …ls-q07, answers: ['680'] })` returns findings for
  `£680`, `£ 680` and `680 pounds` — and nothing else. It must NOT ask for
  `six hundred and eighty`: `680` is in none of step 5's tables (0–20 by name,
  tens 30–90, composition 21–99, `100`, `1,000`, four-digit comma pairs), so no
  number name exists for it and the linter never coins one.
- **The over-limit path, on `ls-q33`**: `keyLint({ …ls-q33, answers: ['1,000', 'one thousand'] })`
  must report `1000` and `1,000 metres` and **must not report
  `one thousand metres`**. That candidate really is generated — `1,000`/`1000`/
  `one thousand` is in step 5's table, `metres` is the unit printed after the gap
  (`src/listening/tests/test01.ts:1492`) — and it is three words against
  `maxWords: 2`, so `verdict` must return `over-limit` and the class must drop
  it. Assert that path explicitly; it is the SPEC clause most likely to be
  dropped, and the marker side of the same case is already pinned at
  `tests/listening-marking.test.ts:340-342`:

  ```ts
  const tooLong = markListening(LISTENING_TEST_01, { 'ls-q33': 'one thousand metres' })
  expect(tooLong.questions.find((q) => q.number === 33)!.overWordLimit).toBe(true)
  ```

  `ls-q33`'s own comment (`src/listening/tests/test01.ts:1493-1496`) states the
  same exclusion in the item-writer's voice: *"One thousand metres is not
  listed: three words against a two-word limit."*

  Do **not** use `ls-q07` and `six hundred and eighty` for this test. That
  candidate is never generated (previous bullet), so the assertion would pass
  vacuously whether or not `verdict` checks `overWordLimit` at all.

### Step 7: Run it over every registered paper

Create `tests/answer-key-lint.test.ts`. It lands in the **engine** project,
whose block is `vite.config.ts:22-29` — `name: 'engine'`,
`environment: 'node'`, and `include: ['tests/*.test.ts']` at `:27`. (`:30-38` is
the `ui` project — jsdom, `include: ['tests/ui/*.test.tsx']` — which is not
where this file goes.)

```ts
import { READING_TESTS } from '../src/reading/tests'
import { LISTENING_TESTS } from '../src/listening/tests'
import { keyLint } from '../src/marking/keyLint'
```

Build one flat list over `[...READING_TESTS, ...LISTENING_TESTS]`, filtered to
`type === 'completion'`, whose entries are

```ts
{ paperId: paper.id, questionId: question.id, question }
```

— three fields, not two. `paperId` and `questionId` are flat strings because
`it.each`'s `'$paperId $questionId …'` title only interpolates top-level
properties: an entry shaped `{ paper, question }` would title every case
`$paperId $questionId` literally, and the coverage guard below would compute
`covered.size === 1` from `undefined` and fail for a reason that has nothing to
do with coverage. If you see that failure, fix the shape — **do not** change the
guard's expected value to `1`, which silently disables it.

Then assert:

```ts
it.each(COMPLETION_QUESTIONS)('$paperId $questionId lists every rendering SPEC requires', ({ question }) => {
  const findings = keyLint(question)
  expect(
    findings.map((f) => `${f.klass}: "${f.missing}" (from "${f.from}") — ${f.reason}`),
  ).toEqual([])
})
```

The failure output is the deliverable: an item-writer reads it as a to-do list.
Make sure `reason` is a full sentence naming the SPEC class, not a code.

Add two guards on the harness itself:

```ts
it('is actually looking at some questions', () => {
  // A filter bug that matched nothing would make every assertion above vacuous
  // — the exact failure mode plan 021 exists to stop repeating.
  expect(COMPLETION_QUESTIONS.length).toBeGreaterThanOrEqual(20)
})

it('covers every registered paper', () => {
  const covered = new Set(COMPLETION_QUESTIONS.map((c) => c.paperId))
  expect(covered.size).toBe(READING_TESTS.length + LISTENING_TESTS.length)
})
```

**Verify**: `npx vitest run tests/answer-key-lint.test.ts`. It may go **red**.
That is step 8.

### Step 8: Triage what it finds

Every finding is one of three things, and the executor must classify each one
before touching a content file:

1. **A real gap in the key.** The exam accepts the rendering, the paper does not
   list it, a learner would lose a mark. **Fix**: add it to `answers` in the
   content file, after the canonical entry, with a comment naming the class —
   match the voice already used at `src/reading/tests/generalTest01.ts:512-517`
   and `src/listening/tests/test01.ts:1129-1132`, which explain *why* each
   alternate is there.
2. **A rendering the exam would NOT accept.** The generator is over-reaching.
   **Fix**: narrow the generator, never widen the key. Record which case and why.
3. **A rendering that breaks the word limit.** Should never reach a finding —
   the oracle classifies it `over-limit` and it is dropped. If one appears, the
   `verdict` wiring is wrong.

**The default when you cannot tell 1 from 2: it is class 2, and you STOP.**

Sorting a finding into class 1 rather than class 2 is an assertion about what a
real IELTS examiner accepts. That is a content judgement, and an executor with
no IELTS marking experience and no access to a rubric cannot make it — the
temptation is to reason "this looks like the same value, so the exam must take
it", which is precisely the guessing `markAnswerKey.ts:10-15` refuses to do,
performed one layer up. So:

- Classify a finding as **class 1 only when a source in this repo already says
  the form is accepted** — the SPEC table at `SPEC.md:973-978`, an existing
  key's own comment, or an assertion in one of the by-hand blocks. Quote it in
  the commit message.
- **Anything else is class 2**, which means: do not edit the content file, add
  the case to the report, and STOP. Reporting a finding you were unsure about is
  cheap and reversible. Writing it into an `answers` array makes the app accept
  something the exam may reject — the OVER-scoring direction, which this plan
  says twice is worse than the gap it is closing, because a learner acts on it.
- "I could not decide" is a complete and acceptable outcome for this step. It is
  not a failure to report it.

**STOP and report before making any content change if the count of class-1
findings exceeds 15**, or if any class-2 finding appears (including any finding
you could not confidently classify, per the default above). Fifteen is not a magic
number; it is the point at which "the linter found gaps" becomes "the linter
disagrees with how these papers were authored", and that is a conversation, not
an edit. A run that finds three or four is the expected shape.

Do not change `answers[0]` on any question. `markAnswerKey.ts:229` reports it to
the learner as `expected`, and reordering the key changes what the report says
the right answer was.

**Verify** after each content edit:

```bash
npx vitest run tests/answer-key-lint.test.ts tests/reading-marking.test.ts tests/listening-marking.test.ts
```

→ all pass. The existing by-hand blocks must stay green: they are now the
regression proof that the linter's additions did not disturb the keys those
blocks pin.

### Step 9: Record the rule in SPEC.md

Add a short paragraph to `SPEC.md` at the end of the "keys must be COMPLETE"
section (after `:991`), in the document's own voice:

- `src/marking/keyLint.ts` generates the number, unit and time classes and
  `tests/answer-key-lint.test.ts` asserts every registered paper's completion
  keys against it, so a new paper inherits the check instead of needing a new
  hand-written block;
- the spelling/hyphenation class is **not** generated and remains the
  item-writer's judgement — a clean lint does not mean a complete key;
- the linter is test-time only and must never be called from `markAnswerKey`,
  for the reason `:956-960` already gives.

Keep the two existing by-hand blocks and the sentence at `SPEC.md:988-991` that names
them. They now serve a second purpose — they are the fixture proving the
generator agrees with expectations a human wrote down first.

**Verify**: `grep -q keyLint SPEC.md` → exit 0 (this is a grep that must MATCH).

### Step 10: Full verification

Every check below is written so that **exit 0 means pass**, including the ones
that are satisfied by an absence. `grep` exits 1 when it finds nothing, which is
a success here, not a failure — so those are written `! grep -q …`. Do not
"fix" a `grep` that exits 1 in this section.

```bash
npx tsc -b --noEmit
npx vitest run
npm run build

# Absence checks — exit 0 means the thing is correctly absent.
! grep -q keyLint src/marking/markAnswerKey.ts

# Presence checks — exit 0 means the thing is correctly present.
grep -q 'AUTHORED: ReadingTest\[\] = \[\.\.\.READING_TESTS\]' tests/reading-marking.test.ts
grep -q keyLint SPEC.md
test -f src/marking/keyLint.ts -a -f tests/answer-key-lint.test.ts

# Content edits are additive only: every changed line in a content file is
# either a quoted answers entry or a comment. Expect NO OUTPUT.
git diff -U0 -- src/reading/tests src/listening/tests \
  | grep -E '^[+-]' \
  | grep -vE '^(\+\+\+|---) ' \
  | grep -vE "^[+-][[:space:]]*('|//)"

# Scope. Note the paths: a bare `git status --porcelain` is NOT empty at this
# plan's baseline (see below).
git status --porcelain src/ tests/
```

**Verify**: typecheck 0; build 0; suite green.

Test count: the three registered papers hold **39** completion questions today
(9 in `academicTest01.ts`, 10 in `generalTest01.ts`, 20 in
`listening/tests/test01.ts` — `grep -c "type: 'completion'"` on each). So
`it.each` alone adds 39, the two harness guards add 2, and the per-class unit
tests add the rest: expect `Test Files 25 passed` and **at least 848 + 41**.

**The dirty-baseline caveat, which applies to every scope check in this plan.**
At commit `ae92bac` the working tree is *already* dirty in a known way:
` M plans/README.md` plus ten untracked `plans/0NN-*.md` files. A bare
`git status --porcelain` therefore never returns empty and must not be used as a
scope assertion. Always scope it to the directories the assertion is about —
`git status --porcelain src/ tests/`, which IS empty at baseline — and treat the
`plans/` entries as expected.

## Test plan

| File | Status | Covers |
|---|---|---|
| `tests/reading-marking.test.ts` | modify | `AUTHORED` from the registry; every registered paper reachable from exactly one module |
| `tests/answer-key-lint.test.ts` | create | `keyLint` over every completion question of every registered paper; per-class unit tests with a deliberately gutted key to prove each generator has teeth; two harness guards against a vacuous filter |

Cases the per-class unit tests must include, each named after the behaviour:

- **time**: full ten-form key (`gt1-q14`) → `[]`; single 24-hour form → the nine
  others, including the closed-up `6.15p.m.`; ambiguous `6.15` → `[]` and the
  test name says the linter may not guess.
- **number**: `['8', 'eight']` → `[]`; `['8']` → `eight`; `['six months']` →
  `6 months`; a figure over 10,000 → `[]`.
- **number × time precedence**: `keyLint(gt1-q14)` → `[]`, named "the number
  class does not fire on a time". This is the case that would otherwise STOP the
  plan against its own fixture.
- **number × date**: `keyLint(ls-q03)` → `[]`; `keyLint({ …ls-q03, answers: ['14'] })`
  → `14th` and `fourteenth` and **not** `fourteen`; `keyLint({ …gt1-q11, answers: ['8'] })`
  → `eight` and **not** `8th`, because that prompt names no month.
- **number × compound**: `keyLint(ls-q30)` → `[]`, named "a number word inside a
  compound is not a count token".
- **unit**: `£`-preprinted key (`ls-q07`) → `[]`; the same key stripped to
  `['680']` → exactly three findings and no word-form demand; `ls-q08` → `[]`,
  proving no `£fifteen` is demanded; a preprinted word that is **not** a unit
  (`students`, `gt1-q11`) → `[]`; a prompt with no gap at all (`ls-q29`) → `[]`.
- **unit × word limit**: `keyLint({ …ls-q33, answers: ['1,000', 'one thousand'] })`
  does not report `one thousand metres` — three words against `maxWords: 2`,
  classified `over-limit` by `verdict` and dropped.
- **non-completion**: `keyLint` on a multiple-choice question → `[]` (this is
  also what forces `maxWords` to be optional on `LintableQuestion`).

Structural pattern to follow: `tests/reading-marking.test.ts` — a `describe` per
concern, `it.each` over data, and an assertion message that names the question id
(`` `Q14 rejects "${given}"` ``) so a failure is diagnosable without a debugger.

Verification: `npx vitest run` → all pass.

## Done criteria

Machine-checkable, and written so that **every command below exits 0 on pass**.
Four of them pass by finding nothing, so they are negated (`! grep -q …`) or
expected to print nothing — a bare `grep` exiting 1 there is the SUCCESS case and
must not be treated as a failure. ALL must hold:

- [ ] `npx tsc -b --noEmit` exits 0
- [ ] `npx vitest run` exits 0, `Test Files 25 passed`, test count ≥ 848 + 41 (39 completion questions + 2 harness guards, before the per-class unit tests)
- [ ] `npm run build` exits 0
- [ ] `! grep -q keyLint src/marking/markAnswerKey.ts` — exits 0 because there is no match, which is the point
- [ ] `grep -q 'AUTHORED: ReadingTest\[\] = \[\.\.\.READING_TESTS\]' tests/reading-marking.test.ts`
- [ ] `! grep -q 'AUTHORED: ReadingTest\[\] = \[ACADEMIC_TEST_01' tests/reading-marking.test.ts` — the hand-written array is gone
- [ ] `test -f src/marking/keyLint.ts -a -f tests/answer-key-lint.test.ts`
- [ ] `grep -q spelling src/marking/keyLint.ts` — the header states the class it does not cover
- [ ] `git status --porcelain package.json package-lock.json` prints nothing — no dependency added
- [ ] Content edits are additive only. Expect **no output** from:
      `git diff -U0 -- src/reading/tests src/listening/tests | grep -E '^[+-]' | grep -vE '^(\+\+\+|---) ' | grep -vE "^[+-][[:space:]]*('|//)"`
      Every surviving line would be a change to something other than a quoted
      `answers` entry or a comment — a touched `prompt`, `explanation`,
      `maxWords`, or a reordered `answers[0]`.
- [ ] `npx vitest run tests/reading-marking.test.ts tests/listening-marking.test.ts` passes with the existing by-hand blocks unmodified
- [ ] `git status --porcelain src/ tests/` lists only the files named in Scope. **Scope the path**: a bare `git status --porcelain` is not empty at baseline — ` M plans/README.md` plus ten untracked `plans/0NN-*.md` files are expected and pre-existing.
- [ ] `plans/README.md` status row updated (its own dirtiness is therefore expected, not a scope violation)

## STOP conditions

Stop and report back (do not improvise) if:

- The code at any `file:line` in "Current state" does not match the excerpt.
- The step-1 baseline is not green.
- **The linter reports more than 15 class-1 findings, or any class-2 finding**
  (a rendering the exam would not accept). Report the full list and stop; the
  keys' authoring conventions need a human decision, not a generator.
- `keyLint` over any of these **twelve** hand-pinned questions is non-empty. Each
  is expected to return `[]`, and a finding against one means **the generator is
  wrong**, not the key. Do not add anything to these keys to make the lint pass.

  | Question | Expected | Why it is pinned |
  |---|---|---|
  | `gt1-q14` | `[]` | The ferry time. Also the time-vs-number precedence case: its key contains `18:15` and `6:15pm`, and a number generator that tokenises across `:` or `.` demands `eighteen`/`fifteen`. See step 4's precedence rule and step 5's tokeniser guards. |
  | `gt1-q11`, `gt1-q16`, `gt1-q17`, `gt1-q19` | `[]` | The four numeric pairs written out at `tests/reading-marking.test.ts:537-550`. |
  | `ls-q03` | `[]` | The date gap, `['14', '14th', 'fourteenth']` — SPEC.md:975's own worked example. Without step 5's date carve-out the generator demands `fourteen`, which the paper deliberately omits: a class-2 finding on the first Listening question in the file. |
  | `ls-q07`, `ls-q08` | `[]` | The preprinted `£`. `ls-q08` additionally pins that no `£fifteen`/`£ fifteen` is demanded. |
  | `ls-q29` | `[]` | The authored article, and a short-answer prompt with no `_{2,}` gap at all — the unit class must generate nothing rather than crash or guess. |
  | `ls-q30` | `[]` | `['a one-page plan', 'one-page plan', 'one page plan']` — the compound case. A naive number substitution emits `1-page plan` / `1 page plan`. |
  | `ls-q33`, `ls-q38` | `[]` | The preprinted units, and `ls-q33` is where the `over-limit` path is exercised (`one thousand metres`, three words against `maxWords: 2`). |
- You find yourself needing a word list, a dictionary, or a spelling rule. That
  is SPEC's fourth class and it is out of scope by design.
- You are about to import `keyLint` from anything under `src/` other than a test.
- Fixing a finding appears to require changing `markAnswerKey.ts`.

## Maintenance notes

For the human or agent who owns this code next:

- **The linter is a floor, not a ceiling.** A clean run means the three
  mechanical classes are complete. It says nothing about spelling variants,
  synonyms, or whether the question is answerable from the passage at all. The
  by-hand blocks and a human read are still the acceptance test for new content.
- **When a new paper is authored** (the next content job named in
  `plans/README.md` under "Known limitations"), the workflow is: write the key
  with the canonical answer only, run `npx vitest run tests/answer-key-lint.test.ts`,
  and paste the findings in as alternates after checking each. That is the
  4–6-hours-per-passage saving this plan was written for, and it only exists if
  the linter stays fast and quiet — resist adding classes that produce
  maybe-findings.
- **Adding a unit** to the closed list in the `unit` class is expected and
  cheap. Adding a *heuristic* to guess units is not: the moment the list becomes
  a pattern match, the linter starts demanding renderings for preprinted words
  that are content, which SPEC explicitly rules out at `:982-985`.
- **What a reviewer should scrutinise in this PR**: that `markAnswerKey.ts` is
  untouched; that every content diff is additive within an `answers` array; that
  the twelve hand-pinned questions produced no findings; and that the header of
  `keyLint.ts` states the spelling class is out of scope, because that sentence
  is what stops the next person reading a green lint as a complete key.
- **Deferred out of this plan, deliberately**: a lint for the *other* question
  types (matching banks that offer fewer distractors than the real exam,
  True/False sets that never use all three responses — the latter is already
  pinned at `tests/reading-marking.test.ts:414-424` for the two shipped papers
  and would generalise the same way `AUTHORED` now does); and any check that a
  question is answerable from its own passage, which is a content review, not a
  lint.
