# Plan 018: Bound the one quadratic regex on the keystroke path, so a pasted blob cannot freeze the tab

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. Do **not** update `plans/README.md`: the
> coordinator owns the index for this batch.
>
> **Drift check (run first)**:
>
> ```bash
> git diff --stat ae92bac..HEAD -- src/analysis/rules/accuracy.ts src/App.tsx tests/
> ```
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW — one regex literal changes; the only behavioural difference is a
  highlight span's start offset on input no learner produces by typing
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `ae92bac`, 2026-08-10

## Why this matters

`src/analysis/rules/accuracy.ts:60` holds `/\s+,/g`, and it is scanned over the
**whole document** on every analysis pass. `\s+` greedily eats a whitespace run,
fails to find the `,`, backtracks one character at a time, and the `g` scan then
restarts one position further into the same run — O(n²) in the run's length.

Measured through the real engine at this commit (`analyzeEssay(text, null)`,
best of three, Node v24.18.0):

| Document | Today | After this plan |
|---|---|---|
| 5,000 spaces | 10.8 ms | 0.24 ms |
| 10,000 spaces | 38.2 ms | 0.41 ms |
| 20,000 spaces | 141.5 ms | 0.80 ms |
| 40,000 spaces | 543.9 ms | 1.38 ms |
| 60,000 spaces | 1250.6 ms | 2.24 ms |

A clean 4× per doubling before, linear after. For scale, a realistic 2,540-character
Task 2 essay analyses in **0.43 ms** — so this is the only non-linear path in the
engine, and nothing a learner types by hand will ever reach it.

The cost is a frozen browser tab, not a slow one. Analysis runs inside a
`useMemo` during render (`src/App.tsx:163-169`), off a 400 ms debounce, so the
work happens synchronously on the main thread with no yield. Paste is blocked
**only in exam mode** (`blockPaste={inExam}`, `src/App.tsx:969`, where
`inExam = mode === 'exam' && view === 'write'`, `src/App.tsx:644`), so coach mode
accepts an arbitrarily large pasted whitespace blob. The second route in is
`handleRedraft` (`src/App.tsx:378-398`): it calls `setEssayText(session.essayText)`
and `setMode('coach')`, so a hand-edited or hostile **imported** file reaches the
same debounced analysis the moment the learner clicks "redraft".

The fix is one character class bound. It is not a rewrite, and it does not change
what the learner is told.

## Current state

Files involved, and their role:

- `src/analysis/rules/accuracy.ts` — the Patch v2 accuracy rules. Holds the regex
  (line 60) and its only consumer (line 92).
- `src/App.tsx` — the two entry points that feed arbitrary text to the engine:
  the debounced coach analysis (lines 162–169) and redraft (lines 378–398).
- `tests/` — the engine suite. `tests/*.test.ts` runs in the `engine` vitest
  project (Node, no DOM); `tests/ui/*.test.tsx` runs in `ui` (jsdom). See
  `vite.config.ts`.

### The regex — `src/analysis/rules/accuracy.ts:58-64`

```ts
const FRONTED_CONNECTOR_RE = new RegExp(`(^\\s*|[.!?]["')\\]]?\\s+|\\n\\s*)(${CONNECTORS})\\b(?!,)`, 'g')

const SPACE_BEFORE_COMMA_RE = /\s+,/g

/** "However hard they try…" is a concession opener, not a fronted connector. */
const HOWEVER_ADVERB_RE =
  /^\s+(hard|much|many|long|far|well|often|good|great|small|big|high|low|strong|difficult|quickly)\b/i
```

Line 60 is the whole defect. Note it has **no doc comment**, unlike every other
regex around it — the repo convention is that a module-level regex carries a
comment saying which SPEC rule it implements. Step 1 fixes that too.

### Its only consumer — `src/analysis/rules/accuracy.ts:92-106`

```ts
  for (const m of doc.text.matchAll(SPACE_BEFORE_COMMA_RE)) {
    const start = m.index ?? 0
    const end = start + m[0].length
    out.push(
      makeIssue(
        'connector-comma',
        'GRA',
        'warning',
        "Remove the space before this comma — the comma sticks to the word before it: 'word, …' not 'word , …'.",
        start,
        end,
        excerptAround(doc.text, start, end),
      ),
    )
  }
```

`doc.text` is the **entire** document. `grep -rn "SPACE_BEFORE_COMMA_RE" src/ tests/`
returns exactly these two lines — there is no other call site and no test pins it.

### The keystroke path — `src/App.tsx:162-169`

```tsx
  const debouncedText = useDebounced(essayText, 400)
  const analysis = useMemo(() => {
    if (mode !== 'coach') return null
    if (isLetter) return analyzeLetter(debouncedText, letterPrompt)
    return task === 'task1'
      ? analyzeTask1(debouncedText, task1Prompt)
      : analyzeEssay(debouncedText, prompt)
  }, [debouncedText, prompt, task1Prompt, letterPrompt, mode, task, isLetter])
```

`useDebounced` (`src/App.tsx:85-92`) is a `setTimeout` that swaps state after
400 ms. The `useMemo` then runs during the render that state change triggers —
synchronously, on the main thread.

### What was already ruled out, with numbers

Three candidate patterns, measured on a 40,000-space document at this commit
(best of three, the regex alone via `matchAll`):

| Variant | Time |
|---|---|
| `/\s+,/g` (today) | 572.7 ms |
| `/\s{1,12},/g` (**this plan**) | 0.8 ms |
| `(?=(\s+))\1,` (atomic-group emulation) | 372.8 ms |

The atomic-group idiom is the textbook answer and it **does not work here** —
V8 still backtracks through the backreference. Do not reach for it. Bounding the
quantifier is the fix.

All three agree on every realistic input:

| Input | `/\s+,/g` | `/\s{1,12},/g` | `(?=(\s+))\1,` |
|---|---|---|---|
| `"a ,b"` | `1:" ,"` | `1:" ,"` | `1:" ,"` |
| `"a   ,b"` | `1:"   ,"` | `1:"   ,"` | `1:"   ,"` |
| `"a,b"` | (none) | (none) | (none) |
| `"a\n\n,b"` | `1:"\n\n,"` | `1:"\n\n,"` | `1:"\n\n,"` |
| `"x  ,  y ,z"` | `1:"  ,"`, `7:" ,"` | `1:"  ,"`, `7:" ,"` | `1:"  ,"`, `7:" ,"` |

### The one behavioural difference, stated exactly

Both patterns emit **exactly one issue per comma preceded by whitespace** — the
count, the category, the message and the `end` offset are identical. Only the
`start` offset moves, and only when **more than 12** whitespace characters sit
immediately before the comma. Measured through the real engine:

| Input | Today | After |
|---|---|---|
| `"The plan is good , but costly."` | issue at 16–18 | issue at 16–18 |
| `"The plan is good     , but costly."` | 16–22 | 16–22 |
| `"The plan is good, but costly."` | none | none |
| `"One idea.\n\n , Another."` | 9–13 | 9–13 |
| `"x  ,  y ,z"` | 1–4, 7–9 | 1–4, 7–9 |
| `"A" + " ".repeat(30) + ", b"` | 1–32 | **19–32** |

The highlight underlines the last 12 whitespace characters instead of all 30. On
input that only arrives by paste or import, that is the correct trade.

### Repo conventions you must match

- **TypeScript strict**, no `any`. Runtime dependencies are exactly `react` and
  `react-dom` — `README.md:165` states "No runtime dependencies beyond React" as
  an architectural property. **This plan must not add a dependency of any kind**,
  including a dev dependency for benchmarking.
- **Module-level regexes carry a doc comment naming the SPEC rule and the WHY.**
  See `src/analysis/rules/accuracy.ts:62`, `:597`, `:633` for the house shape.
  Comments explain *why*, not *what*.
- **Guards err on the side of silence.** `src/analysis/rules/accuracy.ts:11`:
  "a false positive costs more than a miss." A bound that suppressed a real
  issue would violate that; this one does not — it suppresses no issue, only
  shortens a highlight.
- **Tests**: vitest, one file per concern, in `tests/`. Engine tests are plain
  `.ts` in `tests/` and run in Node.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npx tsc -b --noEmit` | exit 0, no output (~1.1 s) |
| Full suite | `npx vitest run` | 24 files, **848 tests**, all pass (~7.3 s) |
| Engine only | `npx vitest run --project engine` | all pass |
| One file | `npx vitest run tests/regex-safety.test.ts` | all pass |
| Build | `npm run build` | exit 0 |

Dependencies are already installed. Do **not** run `npm install`.

The **848 passed / 24 files** figure is the baseline at `ae92bac`, measured while
writing this plan. This plan adds tests, so the final number is 848 + the number
you add.

## Scope

**In scope** (the only files you should modify):

- `src/analysis/rules/accuracy.ts` (modify — one regex literal plus its comment)
- `tests/regex-safety.test.ts` (create)

**Out of scope** (do NOT touch, even though they look related):

- **Any other regex in `src/`.** Every other one was screened and is linear —
  see "Maintenance notes" for what was checked and how. Narrowness is the point:
  a one-literal diff is reviewable, a regex sweep is not.
- **`FRONTED_CONNECTOR_RE` (`accuracy.ts:58`)**, immediately above the target. It
  is a longest-first alternation of literal connector words — linear per start
  position. Leave it alone.
- **The `matchAll` loop at `accuracy.ts:92-106`.** The message, category,
  severity and `end` offset must not change.
- **`src/App.tsx`.** Do not add paste blocking to coach mode, do not add a length
  cap on the editor, do not move analysis to a worker. Those are product
  decisions with their own costs (a length cap silently truncates a learner's
  essay; a worker restructures the whole render path). Bounding the regex removes
  the freeze without any of them.
- **Any `IssueCategory` change.** The union is frozen (`README.md:169`).
- **`SPEC.md`.** The spec describes *which* issues are emitted, and this plan
  changes none of them. Do not edit it.

## Git workflow

- Branch: `advisor/018-bound-whitespace-regex` (matches the repo's existing
  `advisor/NNN-slug` convention — see `git branch -a`).
- Commit per step is fine. Plain imperative subjects, matching `git log`
  (e.g. "Fix six storage and data-integrity defects", "Complete the ARIA tab
  pattern, expose toggle state, and fix the rubric").
- Do NOT push and do NOT open a PR.

## Steps

### Step 1: Reproduce the freeze before fixing it

Do not skip this. The plan's whole justification is a measurement, and you should
see it yourself before you change anything.

Create `tests/regex-safety.test.ts` with **only** the timing test for now:

```ts
/**
 * The analysis engine must stay LINEAR in document length.
 *
 * This is not a micro-benchmark and it is not here to chase milliseconds. It
 * pins one specific defect class: a backtracking regex on the keystroke path.
 * Analysis runs inside a `useMemo` during render (src/App.tsx:163-169) off a
 * 400ms debounce, so a quadratic scan is not a slow app — it is a frozen tab,
 * with React blocked mid-render. Coach mode does not block paste
 * (`blockPaste={inExam}`, src/App.tsx:969), and `handleRedraft` feeds a stored
 * or IMPORTED essay to the same path, so "no learner would type that" is not a
 * defence.
 */
import { describe, expect, it } from 'vitest'
import { analyzeEssay } from '../src/analysis/engine'

/** A whitespace blob with no comma anywhere — the worst case for `\s+,`. */
function whitespaceBlob(spaces: number): string {
  return `a${' '.repeat(spaces)}b`
}

describe('the engine stays linear on pathological whitespace', () => {
  it('analyses a 40,000-character whitespace blob well under a frozen frame', () => {
    // Warm the JIT on a realistic document first, so the measurement is of the
    // scan and not of first-call compilation.
    analyzeEssay('Some people believe that governments should invest in transport.', null)

    const doc = whitespaceBlob(40_000)
    const t0 = performance.now()
    analyzeEssay(doc, null)
    const elapsed = performance.now() - t0

    // Measured on the reference machine (Node v24.18.0): 543.9 ms before the
    // fix, 1.38 ms after. 100 ms sits ~72x above the fixed cost and ~5x below
    // the broken cost, so it is neither flaky on a slow CI runner nor able to
    // pass with the quadratic regex restored.
    expect(elapsed).toBeLessThan(100)
  })
})
```

**Verify**: `npx vitest run tests/regex-safety.test.ts` → the test **FAILS**,
reporting an elapsed time in the hundreds of milliseconds.

If it PASSES at this step, stop — see STOP conditions. Either the machine is
extraordinarily fast or the defect is already fixed, and in both cases the test
is not pinning what it claims to.

### Step 2: Bound the quantifier

In `src/analysis/rules/accuracy.ts`, replace line 60:

```ts
const SPACE_BEFORE_COMMA_RE = /\s+,/g
```

with:

```ts
/**
 * A2, second half: whitespace wrongly separating a word from its comma.
 *
 * The bound is load-bearing, not cosmetic. Written `/\s+,/g`, this was the only
 * non-linear path in the engine: `\s+` eats a whitespace run, fails to find the
 * comma, backtracks a character at a time, and the `g` scan restarts one
 * position further into the SAME run — O(n^2) in the run's length. Measured
 * through `analyzeEssay`: 40,000 spaces took 543.9 ms and 60,000 took 1250.6 ms,
 * against 0.43 ms for a real 2,540-character essay. That is a frozen tab, since
 * analysis runs synchronously inside a render off the 400ms debounce, and coach
 * mode accepts pasted and imported text without a length limit.
 *
 * Bounded at 12, each start position tries at most 12 characters and the scan is
 * linear: the same document now analyses in 1.4 ms and 2.2 ms. Twelve is far
 * beyond any real run — the longest legitimate whitespace before a comma is a
 * line break plus indentation.
 *
 * The bound emits exactly the SAME issues: one per comma preceded by whitespace,
 * same message, same `end` offset. Only the `start` offset differs, and only past
 * 12 characters, where the highlight now underlines the last 12 rather than all
 * of them. On input that only arrives by paste or import, that is the right trade.
 *
 * An atomic-group emulation, `(?=(\s+))\1,`, was measured and REJECTED: V8
 * backtracks through the backreference and it took 372.8 ms on the same input.
 */
const SPACE_BEFORE_COMMA_RE = /\s{1,12},/g
```

Change nothing else in the file.

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `grep -c 'SPACE_BEFORE_COMMA_RE = /\\s{1,12},/g' src/analysis/rules/accuracy.ts` → `1`.
**Verify**: `npx vitest run tests/regex-safety.test.ts` → passes.

### Step 3: Pin the behaviour, not just the speed

A timing test alone would pass if someone deleted the rule. Add a second
`describe` block to `tests/regex-safety.test.ts` that pins what the rule still
does. Model the assertion style on `tests/false-positives.test.ts` — read it
first and match its `describe`/`it` shape.

```ts
/** The `connector-comma` issues a document produces, as `start-end` strings. */
function spaceBeforeCommaSpans(text: string): string[] {
  return analyzeEssay(text, null)
    .issues.filter((i) => i.category === 'connector-comma')
    .map((i) => `${i.start}-${i.end}`)
}

describe('bounding the quantifier changed no issue anyone will see', () => {
  it.each([
    ['The plan is good , but costly.', ['16-18']],
    ['The plan is good     , but costly.', ['16-22']],
    ['The plan is good, but costly.', []],
    ['One idea.\n\n , Another.', ['9-13']],
    ['x  ,  y ,z', ['1-4', '7-9']],
  ])('%j still yields %j', (text, expected) => {
    expect(spaceBeforeCommaSpans(text as string)).toEqual(expected)
  })

  it('clamps the highlight to the last 12 characters of an absurd run, and still flags it once', () => {
    // The ONE documented behaviour difference. 30 spaces before the comma: the
    // issue is still emitted exactly once and still ends at the comma, but the
    // underline starts 12 characters back instead of 30. Nothing a learner
    // types produces this; paste and import do.
    const text = `A${' '.repeat(30)}, b`
    expect(spaceBeforeCommaSpans(text)).toEqual(['19-32'])
  })
})
```

The expected spans above were measured through the real engine at `ae92bac` —
the first five are **identical before and after** the change, which is exactly
what makes them worth asserting.

**Verify**: `npx vitest run tests/regex-safety.test.ts` → all pass.

### Step 4: Confirm nothing else regressed

**Verify**: `npx vitest run` → 25 files, 848 + your new tests, all pass.
**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `npm run build` → exit 0.

If any pre-existing test now fails, that means some fixture contains a
>12-character whitespace run before a comma. Read the failure before touching
anything: the only legitimate change is a `start` offset. If a **count** or a
**message** moved, stop — see STOP conditions.

### Step 5: Confirm the whole engine is now linear

A one-off check, to make the claim in this plan's title true rather than hopeful.

```bash
npx vitest run tests/regex-safety.test.ts --reporter=verbose
```

Then add one last test to the timing `describe`:

```ts
  it('stays linear at 60,000 characters — no other rule is quadratic', () => {
    analyzeEssay('Warm up.', null)
    const t0 = performance.now()
    analyzeEssay(whitespaceBlob(60_000), null)
    const elapsed = performance.now() - t0
    // 1250.6 ms before the fix, 2.24 ms after, on the reference machine. If
    // some future rule reintroduces a backtracking scan, this is where it
    // surfaces: a quadratic path shows up here long before anyone reports a
    // frozen tab.
    expect(elapsed).toBeLessThan(150)
  })
```

**Verify**: `npx vitest run tests/regex-safety.test.ts` → all pass.

## Test plan

- **New file**: `tests/regex-safety.test.ts`, in the `engine` project (Node, no
  DOM — it matches `tests/*.test.ts` in `vite.config.ts`). Contents:
  1. 40,000-space blob analyses in < 100 ms (the regression this plan fixes).
  2. 60,000-space blob analyses in < 150 ms (nothing else in the engine is
     quadratic).
  3. Five behaviour-parity cases whose spans are byte-identical before and after.
  4. One case pinning the single documented difference (the clamped `start`).
- **Structural pattern**: `tests/false-positives.test.ts` — it exists to pin
  things the rules must *not* do, which is the same job. Match its shape.
- **Why the thresholds are what they are**: measured post-fix cost is 1.38 ms
  (40k) and 2.24 ms (60k); measured pre-fix cost is 543.9 ms and 1250.6 ms. The
  thresholds sit roughly 70× above the pass case and 5–8× below the fail case,
  so they neither flake on a slow runner nor let the defect back in.
- **Verification**: `npx vitest run` → 25 files, all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc -b --noEmit` exits 0 with no output
- [ ] `npx vitest run` exits 0; 25 files; 848 pre-existing tests still pass
- [ ] `npm run build` exits 0
- [ ] `test -f tests/regex-safety.test.ts` succeeds
- [ ] `grep -c 'SPACE_BEFORE_COMMA_RE = /\\s{1,12},/g' src/analysis/rules/accuracy.ts` returns `1`
- [ ] `grep -c 'SPACE_BEFORE_COMMA_RE = /\\s+,/g' src/analysis/rules/accuracy.ts` returns `0`
- [ ] `git diff --stat ae92bac..HEAD -- src/` shows **only** `src/analysis/rules/accuracy.ts`
- [ ] `git status --porcelain -- . ':!plans/'` lists only `src/analysis/rules/accuracy.ts` and `tests/regex-safety.test.ts`
      (the `':!plans/'` exclusion is required: at this plan's baseline the tree already
      carries a modified `plans/README.md` and ten untracked `plans/0NN-*.md` files, so a
      bare `git status --porcelain` is never empty and this check would always fail)
- [ ] `git diff --stat -- package.json package-lock.json` is empty (no dependency added)

## STOP conditions

Stop and report back (do not improvise) if:

- **The step 1 test passes before the fix.** The test is then not pinning the
  defect. Report the elapsed time you measured and stop.
- **A pre-existing test's issue COUNT or MESSAGE changes.** Only `start` offsets
  may move, and only where >12 whitespace characters precede a comma. A count
  change means the bound is wrong.
- **The excerpt at `src/analysis/rules/accuracy.ts:58-64` or `:92-106` does not
  match** what is quoted in "Current state".
- **`grep -rn "SPACE_BEFORE_COMMA_RE" src/ tests/` returns more than the two
  lines named here.** The plan assumes exactly one definition and one consumer.
- **You conclude the bound should be a different number than 12.** Report the
  input that motivated it — do not change it silently. 12 was chosen to be far
  beyond any legitimate run, and the tests encode it.
- **You find a second quadratic regex** while working. Do not fix it here.
  Report it with the input and the measurement; it is a separate plan.
- **Anything tempts you to add a dependency** (a benchmark library, a
  regex-safety linter, `safe-regex`). The two-runtime-dependency property is
  architectural. Report instead.

## Maintenance notes

For whoever owns this next:

- **What a reviewer should scrutinise**: that `end` offsets and messages are
  untouched, and that the diff to `src/` is one regex literal plus its comment.
  Anything larger is out of scope for this plan.
- **The screen behind the narrowness.** The audit that produced this plan
  screened every regex literal in `src/` (206 by its count) against 18
  adversarial inputs at 60,000 characters. `/\s+,/g` was the **only** literal
  exceeding 200 ms. Three families came back clean and are worth knowing about,
  because they *look* dangerous:
  - **Large alternations** — `FRONTED_CONNECTOR_RE` (`accuracy.ts:58`),
    `LINKER_REGEX` (`cohesion.ts:151`), and the alternation built by
    `markerRegex` (`complexity.ts:86`). All are longest-first alternations of
    literal words, which is linear per start position. Size is not the risk.
  - **Nested quantifiers** — `SPLICE_ADVERB_NO_COMMA_RE` (`grammarRange.ts:45`,
    `(?![^,]{0,20},)`), `ING_SUBJECT_VERB_RE` (`accuracy.ts:599`,
    `[^.,;]{0,60}?`), `SINGULAR_DET_PLURAL_RE` (`accuracy.ts:635`,
    `((?:\w+\s+){0,2})`). Every one is **bounded** and non-overlapping. That is
    the property to preserve.
  - The end-to-end measurement in step 5 is the durable version of that screen:
    after this plan the whole engine runs 60,000 pathological characters in
    2.24 ms, so any future non-linear rule shows up as a test failure rather
    than a bug report.
- **The rule to apply to new regexes**: an unbounded quantifier over a character
  class that can also match the following literal (`\s+,` where `\s` can precede
  a `,` that never comes) is the shape to avoid. Bound it, or make the class
  disjoint from what follows.
- **Deliberately deferred**: coach-mode paste handling and any editor length cap.
  A learner may legitimately paste their own draft in from a word processor, and
  a silent truncation is worse than a slow parse. Bounding the regex removes the
  need to choose.
- **Also deferred**: moving analysis off the main thread. At 0.43 ms for a real
  essay there is nothing to move; revisit only if a future rule is genuinely
  expensive on ordinary input.
