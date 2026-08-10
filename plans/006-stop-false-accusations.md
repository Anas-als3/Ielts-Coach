# Plan 006: Stop the engine accusing correct English — five guards and a golden corpus

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b942572..HEAD -- src/analysis/`
> If any file quoted in "Current state" changed since this plan was written,
> compare the excerpts against the live code before proceeding.

## Status

- **Priority**: **P0** — this is the highest-priority work in the repository
- **Effort**: M (1–1.5 days)
- **Risk**: MED — touches calibrated rules; `tests/false-positives.test.ts` and `tests/band-rewards.test.ts` pin behaviour that must not regress
- **Depends on**: none. **Everything else should wait for this.**
- **Category**: bug
- **Planned at**: commit `b942572`, 2026-08-10

## Why this matters

**The app currently tells learners to write ungrammatical English.**

Every one of these was reproduced through the real `analyzeEssay` pipeline on
2026-08-10. The input is correct, natural, band-8 English. The output is what the
app says about it:

| Learner writes (correct) | App says |
|---|---|
| Working from home can **reduce** commuting costs | "An -ing subject is one thing — the verb takes s: 'reduce' → **'reduces'**" |
| Governments must act to **reduce crime** | "'crime' … needs a determiner — write **'a reduce crime'** or **'the reduce crime'**" |
| **However, it is clear that** the government should invest | "A comma may be joining two full sentences here" |
| **If a country invests in education it will prosper.** | "This starts with 'If' but **a main clause never arrives**" (it does — "it will prosper") |
| Governments inspect factories every **10 years** | "'every … years' does not agree — **years → year**" |

Four of the five hand the learner a **suggested fix that is itself wrong**. For a
coaching product this is the worst possible output — worse than a miss, worse
than silence. The codebase already says so: `src/analysis/rules/accuracy.ts:11`
states that a false positive costs more than a miss, and SPEC.md repeats it.

It is not cosmetic. Each of these feeds a band deduction, and they compound:

- `bandEstimate.ts` — 2+ comma splices → −0.5 GRA; article+agreement ≥ 3 → −0.5;
  a **single** fragment → −0.5; and any `warning` at all kills the +0.5
  clean-sweep reward.
- The same three deductions exist in `task1BandEstimate.ts`, and
  `engine.ts` runs `accuracyRules` on Task 1 too — so every one of these hits
  **both** tasks.

Measured: a clean Band-8 essay loses 0.5–1.0 GRA to phantom errors.

These are five separate small diffs, but they are **one plan** on purpose. The
thing that stops the class recurring is the golden corpus in step 7, and the
corpus only pays for itself once. Fixing them one at a time would mean
recalibrating five times.

## Current state

Read each cited line before changing it.

### 1. Comma splice — pattern A has no fronted-adverbial guard

`src/analysis/rules/grammarRange.ts:25` (approx — verify):

```ts
const SPLICE_PRONOUN_RE =
  /,\s*(it|this|they|he|she|we|I|there)\s+(is|are|was|were|has|have|had|can|will|would|should|do|does|did)\b/gi
```

The module defines a `guardedBeforeComma(idx)` helper that checks for a
coordinator or auxiliary before the comma, and applies it to splice patterns
B, C and D — **but not to pattern A**. Pattern A's only guards are
`OPENS_WITH_SUBORDINATOR_RE` and a coordinator check.

So `However, it is clear that…` matches: comma, `it`, `is`. A fronted adverbial
(`However,` / `Therefore,` / `In addition,` / `For example,` / `In my opinion,`)
followed by a pronoun subject is ordinary correct English and extremely common
in IELTS writing.

### 2. Article walk — no mass-noun escape, and it quotes a verb back

`src/analysis/rules/accuracy.ts` — the `COUNTABLE` set contains `crime`, `time`,
`government`, `future`, `world`, `environment`, `home`, `way`, `company`. Several
of these are **mass nouns in their commonest IELTS sense**: "reduce crime",
"protect the environment", "waste time" take no article.

Worse, the leftward walk crosses `reduce` (a verb not in `WALK_VERBS`) and the
message then quotes the crossed span back, producing `'a reduce crime'`. The
`usePhrase` guard rejects plurals and pronouns but not verbs.

### 3. Fragment — asserts something it cannot verify

`src/analysis/rules/accuracy.ts` — `FRAGMENT_RE` fires on any subordinator-opened
sentence with no comma before the full stop. But a main clause can follow
without a comma: "If a country invests in education it will prosper." The
message asserts "a main clause never arrives", which the regex has not checked.

### 4. `-ing` subject agreement — only inspects one token

`src/analysis/rules/accuracy.ts` — `ING_SUBJECT_VERB_RE` matches an `-ing` word
followed within 60 characters by a plural-form verb. `ING_PRECEDING_SKIP`
inspects only the token immediately before the `-ing`.

"Working from home can reduce…" — the `-ing` is a gerund subject, but the verb
found is `reduce`, which is governed by the modal `can`, not by the subject. A
modal always takes the bare infinitive. The correction `can reduces` is
ungrammatical.

### 5. Quantity agreement — no digit in the pattern

`src/analysis/rules/accuracy.ts` — `QUANTITY_MIDDLE_RE` allows a small number of
intervening words between `every`/`each`/`a` and a plural noun, but does not
account for a **numeral**. "every 10 years" is correct; "every year" and "every
10 years" are both right and the rule only knows the first.

### 6. The test that pretends to pin the walk cap

`tests/false-positives.test.ts` — the block asserting the `MAX_MODIFIER_WALK`
cap is **vacuous**: all three of its fixtures hit a stop-word on the first step,
so the cap can be changed from 3 to 99 with the suite still green. Verify this
yourself by changing the constant and re-running before you fix it.

### Repo conventions you must match

- **TypeScript strict**, no `any`, no new dependencies.
- Guards are **module-level named predicates with a doc comment saying which
  false positive they exist to prevent** — this file is full of them already;
  match that style exactly.
- **Never widen a rule to make a fixture pass.** If a guard cannot be written
  without gutting the rule, downgrade the severity or disable the rule and say
  so, rather than leaving a wrong accusation in place.
- SPEC.md specifies these patterns and their existing guards. Every guard you add
  must be recorded there (step 8).

## Commands you will need

| Purpose   | Command                                            | Expected |
|-----------|----------------------------------------------------|----------|
| Typecheck | `npx tsc -b --noEmit`                              | exit 0   |
| Engine    | `npx vitest run --project engine`                  | all pass |
| Corpus    | `npx vitest run tests/false-positive-corpus.test.ts` | all pass |
| Build     | `npm run build`                                    | exit 0   |

## Scope

**In scope**:

- `src/analysis/rules/grammarRange.ts` (modify — guard splice pattern A)
- `src/analysis/rules/accuracy.ts` (modify — four guards)
- `tests/false-positive-corpus.test.ts` (create)
- `tests/false-positives.test.ts` (modify — fix the vacuous walk-cap block only)
- `SPEC.md` (modify — record every new guard)

**Out of scope**:

- `src/analysis/bandEstimate.ts` / `task1BandEstimate.ts` — do **not** retune
  deductions to compensate. Fix the detection; the scores follow.
- Any rule not listed above.
- `IssueCategory` — frozen, and nothing here needs a new one.

## Git workflow

- Branch: `advisor/006-false-accusations`
- One commit per guard, so each can be reverted independently.
- Do NOT push and do NOT open a PR.

## Steps

### Step 1: Build the golden corpus FIRST

Create `tests/false-positive-corpus.test.ts` **before** changing any rule. It
asserts that a list of known-correct sentences raises **zero** non-`info` issues.

Seed it with ~60 sentences:

- The five reproduced failures from "Why this matters" (these will FAIL now —
  that is the point).
- Every sentence the existing guards in `accuracy.ts` were written for (read the
  guard comments; each names its case).
- 20–30 further ordinary IELTS sentences using: fronted adverbials + pronoun
  subjects, mass nouns after verbs (`reduce crime`, `protect the environment`,
  `save time`, `provide information`), modal + bare infinitive after a gerund
  subject, subordinator-opened sentences with and without a comma, numerals with
  time nouns, and compound modifiers.

Each entry needs a one-line comment saying which rule it guards, so a future
reader knows why it is there.

Run each through `analyzeEssay(text, null)` padded past the rules' word gates —
reuse the letters-only `pad()` helper from `tests/task1-rules.test.ts` (a digit
in the padding would itself trigger rules).

**Verify**: `npx vitest run tests/false-positive-corpus.test.ts` → **at least 5
failures**, naming the five cases above. If it passes, the corpus is not
exercising the rules — fix the harness before continuing.

### Step 2: Guard splice pattern A

Apply the existing `guardedBeforeComma(idx)` to pattern A, and add a fronted-
adverbial guard:

```ts
/**
 * A fronted adverbial followed by a pronoun subject is not a splice.
 * "However, it is clear that…" is ordinary correct English and among the most
 * common openings in IELTS writing; pattern A saw only ", it is".
 */
const FRONTED_ADVERBIAL_RE = /(^|[.!?]\s+)(however|therefore|moreover|furthermore|nevertheless|consequently|thus|in addition|for example|for instance|in my opinion|in my view|on the other hand|as a result|overall|in conclusion|first|firstly|second|secondly|finally|indeed|admittedly)\s*$/i
```

Test it against the text **before** the comma. Where that matches, skip.

**Verify**: the "However, it is clear" corpus case passes; `npx vitest run --project engine` → everything else still passes.

### Step 3: Give the article walk a mass-noun escape and stop it quoting verbs

Two changes:

**3a.** Add a `MASS_SENSE` set for COUNTABLE nouns that are mass nouns in their
common IELTS sense, and skip the flag when the noun is the direct object of a
verb with no determiner:

```ts
/**
 * Nouns in COUNTABLE that are MASS nouns in their commonest IELTS sense.
 * "reduce crime", "protect the environment", "waste time", "plan for the
 * future" all take no article on the bare reading. They stay in COUNTABLE
 * because "a crime was committed" is also valid — so the escape is contextual,
 * not a removal.
 */
const MASS_SENSE = new Set(['crime', 'time', 'future', 'world', 'environment', 'home', 'way', 'government'])
```

Skip when the noun is in `MASS_SENSE` **and** the walk crossed a verb.

**3b.** The message must never quote a crossed span it cannot vouch for. Extend
`usePhrase` to reject a span containing a verb-like token, and fall back to the
bare noun — the file already does this for the walk cap, so match that shape.

**Verify**: "reduce crime" is clean; the existing `article` tests in
`tests/false-positives.test.ts` and `tests/patch-v2.test.ts` still pass.

### Step 4: Make the fragment rule stop asserting what it has not checked

Two options; take the first that works:

- **Preferred**: extend the pattern to detect whether a main clause follows —
  a subordinate opener followed later in the sentence by a second
  subject+finite-verb sequence is complete. If you can do this reliably, keep
  the rule at `warning`.
- **Fallback**: if reliable detection is not achievable with the token data
  available, **narrow the rule to only fire when the sentence has no finite verb
  after the subordinate clause**, and reword the message to a check rather than
  an assertion ("check: does this sentence have a main clause?").

Either way the message must not claim "a main clause never arrives" unless that
has been verified.

**Verify**: "If a country invests in education it will prosper." is clean; a
genuine fragment ("Although the government invested heavily.") still fires.

### Step 5: Fix the `-ing` subject rule

The verb found must be the one governed by the gerund subject. Skip when a
**modal or auxiliary** sits between the `-ing` word and the matched verb:

```ts
/**
 * A modal takes the bare infinitive, so the verb after one is never the place
 * subject-verb agreement shows up. "Working from home can reduce costs" is
 * correct, and the old rule suggested "can reduces".
 */
const MODAL_BEFORE_VERB_RE = /\b(can|could|may|might|must|shall|should|will|would|do|does|did|to)\s+$/i
```

Test the span between the `-ing` and the verb. Where it matches, skip.

**Verify**: "Working from home can reduce…" is clean; a genuine error
("Working from home reduce costs") still fires with the correct suggestion.

### Step 6: Let quantity agreement see numerals

Allow an optional numeral between the determiner and the plural noun, and treat
`every`/`each` + numeral + plural as **correct**:

```ts
// "every 10 years", "each 6 months" are correct: the numeral makes the plural
// grammatical. Only a bare "every years" is an error.
```

**Verify**: "every 10 years" is clean; "a random women" (the original
calibration case) still fires.

### Step 7: Repair the vacuous walk-cap test

In `tests/false-positives.test.ts`, replace the three fixtures in the walk-cap
block with ones that genuinely cross 3+ non-stop-word tokens, so the assertion
has teeth.

**Verify the test has teeth**: temporarily change `MAX_MODIFIER_WALK` from 3 to
99 and confirm the block **fails**; restore it and confirm it passes. Report both
observations. This is the same mutation check used on the store migration in
plan 001.

### Step 8: SPEC.md

Record every guard added, with the false positive it prevents, in the rule's
existing SPEC entry. SPEC.md currently specifies these patterns and only the
guards that existed — it must not stay out of date, since it is canonical.

### Step 9: Full green and recalibration

**Verify**: `npx vitest run` → all pass.
**Verify**: `npm run build` → exit 0.
**Verify**: `npx vitest run tests/false-positive-corpus.test.ts` → all ~60 pass.

Then **re-check the calibration anchors** (SPEC.md: the op-05 high-band answer
≥ 8.0 on every criterion; a weak answer ≤ 6.5). Removing false positives should
move the clean essay UP. If `tests/band-rewards.test.ts` now fails because a
score rose above an upper bound, report the exact before/after numbers — do not
silently adjust an anchor.

## Done criteria

- [ ] `npx tsc -b --noEmit` exits 0
- [ ] `npx vitest run` exits 0; all pre-existing tests pass
- [ ] `tests/false-positive-corpus.test.ts` exists with ≥ 55 sentences, all clean
- [ ] Each of the five reproduced failures is clean, verified individually
- [ ] Each corresponding true positive still fires (one test per rule)
- [ ] The walk-cap mutation check was run and reported
- [ ] `npm run build` exits 0
- [ ] SPEC.md records every new guard
- [ ] `plans/README.md` status row for 006 updated to DONE

## STOP conditions

- Any excerpt in "Current state" does not match the live file.
- A guard cannot be written without gutting the rule it guards. Report which,
  with the cases that conflict — downgrading a rule to `info`, or disabling it,
  is an acceptable outcome and better than leaving a wrong accusation live.
- `tests/band-rewards.test.ts` fails on a **lower** bound (a score fell). That
  would mean a guard suppressed a true positive; investigate before proceeding.
- The corpus passes at step 1 before any fix. The harness is then wrong.
- You find a sixth false-positive class. Add it to the corpus, report it, and
  ask before expanding scope.

## Maintenance notes

- **The corpus is the deliverable.** The five guards are small; the file that
  stops the class recurring is `tests/false-positive-corpus.test.ts`. Every
  future false-positive report should be added there *first*, as a failing test,
  before the rule is touched.
- **`accuracy.ts` is where this keeps happening** — it is the largest and most
  regex-dense rule module, and every guard in it was added after a real false
  positive. Treat any new rule there as guilty until a corpus entry proves it
  innocent.
- **Do not compensate in the band estimator.** If scores feel high after this
  lands, that is the correct scores appearing for the first time.
- **What a reviewer should scrutinise**: that each guard is narrow (it should
  suppress the false positive and nothing else), and that every true-positive
  test still passes with an unchanged message.
