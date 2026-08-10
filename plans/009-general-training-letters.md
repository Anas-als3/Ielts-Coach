# Plan 009: General Training Writing Task 1 — letters

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: confirm plan 008 has landed —
> `grep -c "SCHEMA_VERSION = 3" src/profile/store.ts` must return 1 and
> `grep -c "export type Module" src/types.ts` must return 1. If either fails,
> STOP.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED — adds `IssueCategory` members and a third analysis pipeline
- **Depends on**: `plans/008-academic-general-module-switch.md`
- **Category**: direction
- **Planned at**: commit `b942572`, 2026-08-10

## Why this matters

**Of everything left to build, General Training letters are the best fit for
this engine — better than Task 2, and arguably better than Academic Task 1.**

The reason is that letter conventions are *formulaic and externally fixed*, which
is exactly the shape of problem a deterministic rule engine solves perfectly. A
candidate loses real marks for things a regex can see with certainty:

- **Sign-off / salutation pairing.** "Yours faithfully" is correct only with
  "Dear Sir or Madam". "Yours sincerely" is correct only with a named
  recipient — "Dear Mr Hughes". Getting this backwards is one of the most common
  Band-6 giveaways in General Training, and it is a pure lookup.
- **Tone consistency.** A formal letter containing "I can't wait to hear back"
  mixes registers. The app already has a contraction detector and an
  informal-register lexicon; letters give both a *purpose* they lack in an essay.
- **Bullet coverage.** Every GT Task 1 prompt gives three bullet points, and all
  three must be addressed. This is the same machinery as `question-coverage`.
- **Purpose statement.** A strong letter states why it is being written in the
  opening paragraph ("I am writing to…").

None of these needs to understand meaning. All of them are worth marks. That is a
rare combination, and it is why this plan ranks above Reading and Listening
despite those being larger features.

There is one genuinely interesting design problem, called out in step 4: **the
existing `contraction` rule must not fire in an informal letter.** "I can't wait
to see you" is *correct* in a letter to a friend and wrong in a letter to a bank.
The engine currently treats contractions as an unconditional error, which would
mark a correct informal letter down. That interaction has to be handled
deliberately.

## Current state

### The Task 1 pipeline you are mirroring — `src/analysis/engine.ts`

```ts
export function analyzeTask1(text: string, prompt: Task1PromptSpec): Analysis {
  const doc = tokenize(text)
  const facts = deriveChartFacts(prompt.chart)
  const context = topicContext(prompt)

  // Achievement runs first: the structure checks read its prompt-echo spans to
  // decide whether the opening genuinely paraphrases the title.
  const achievementIssues = task1AchievementRules(doc, prompt, facts)
  const { paragraphs, checks, issues: structureIssues } = buildTask1Structure(
    doc,
    prompt,
    facts,
    achievementIssues,
  )
  ...
}
```

`analyzeLetter` follows this shape exactly: achievement rules first, then
structure, then the four shared modules, then a band estimate.

### The four shared rule modules

`cohesionRules`, `lexicalRules`, `grammarRangeRules`, `accuracyRules` all apply
to letters unchanged — a letter is still marked on Coherence, Lexical Resource
and Grammatical Range. Note `cohesionRules` already takes an optional
`TaskKind` third parameter (added when Task 1 shipped, to scope the
example-linker requirement). Letters will need the same treatment; see step 4.

### The `topicContext` adapter — `src/analysis/engine.ts`

```ts
function topicContext(prompt: Task1PromptSpec): PromptSpec {
  return {
    id: prompt.id,
    type: 'problem-solution', // inert here — only 'discussion' triggers a branch
    text: prompt.text,
    topic: prompt.topic,
    parts: prompt.parts,
    keywords: [...prompt.keywords, ...TASK1_MEASUREMENT_VOCABULARY],
  }
}
```

Letters need their own version. Do not reuse the measurement vocabulary — a
letter quotes no figures.

### The category metadata contract — `src/meta.ts`

```ts
export const CATEGORY_META: Record<IssueCategory, { label: string; criterion: Criterion; hint: string }> = {
```

`Record<IssueCategory, …>` is exhaustive, so adding a union member without a
`CATEGORY_META` entry is a compile error. That is the safety net making category
additions safe.

Also note `TASK1_ONLY_CATEGORIES` / `TASK2_ONLY_CATEGORIES` and
`categoryAppliesTo(category, task)` — the error-profile scoping added earlier.
Letter categories need the same treatment, and `categoryAppliesTo` will need to
consider module as well as task (see step 8).

### Repo conventions you must match

- **TypeScript strict**, no `any`, no new runtime dependencies.
- **Rule modules are pure and synchronous**, take a `TokenizedDoc`, return
  `Issue[]`, assign no ids (the engine does that), and use a local `mk` helper
  that derives `criterion` from `CATEGORY_META`.
- **Word lists and regexes are module-level constants** with a doc comment
  naming the SPEC rule they implement.
- **Messages say what is wrong AND how to fix it** in the DESIGN.md voice.
- **Severity model** (SPEC.md): `error` = band-capping, `warning` = recurring
  cost, `info` = advisory. Choose deliberately — the band estimator's clean-sweep
  rewards treat `info` as non-blocking.
- **Defensive by design**: empty input yields no issues and a stable set of
  unsatisfied checks. Never index into an empty array.
- **A false accusation is worse than a miss.** Every guard in
  `task1Achievement.ts` exists for that reason; letters need the same care.

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Typecheck | `npx tsc -b --noEmit`                    | exit 0              |
| Tests     | `npx vitest run`                         | all pass            |
| One file  | `npx vitest run tests/letters.test.ts`   | all pass            |
| Build     | `npm run build`                          | exit 0              |

## Scope

**In scope**:

- `src/types.ts` (modify — `LetterTone`, `LetterPromptSpec`, append `IssueCategory` members)
- `src/meta.ts` (modify — `CATEGORY_META` entries, letter category sets)
- `src/prompts/letterBank.ts` (create — 15 prompts, 5 per tone)
- `src/analysis/rules/letterAchievement.ts` (create)
- `src/analysis/rules/letterStructure.ts` (create)
- `src/analysis/letterBandEstimate.ts` (create)
- `src/analysis/engine.ts` (modify — add `analyzeLetter`; do NOT touch the other two)
- `src/analysis/rules/lexical.ts` (modify — ONE guarded change, see step 4)
- `src/answers/letterModels.ts` (create — one worked letter per tone)
- `src/App.tsx`, `src/components/StructureRail.tsx`, `src/components/Report.tsx` (modify — wiring)
- `tests/letters.test.ts`, `tests/ui/letters.test.tsx` (create)
- `SPEC.md`, `README.md` (modify)

**Out of scope**:

- `analyzeEssay` and `analyzeTask1` — both must stay byte-identical. The
  regression tests depend on it.
- `src/analysis/rules/accuracy.ts`, `grammarRange.ts` — reused unchanged.
- Academic content of any kind.
- `Criterion` — stays four members. Letters are marked on Task Achievement,
  which occupies the `TR` slot exactly as Academic Task 1 does.

## Git workflow

- Branch: `advisor/009-gt-letters`
- One commit per step.
- Do NOT push and do NOT open a PR.

## Steps

### Step 1: Types

In `src/types.ts`, in the Task 1 section:

```ts
/**
 * How formal a letter must be. The prompt fixes this — "write to your manager"
 * is semi-formal, "write to the council" is formal, "write to a friend" is
 * informal — and the whole letter must hold that register consistently.
 */
export type LetterTone = 'formal' | 'semi-formal' | 'informal';

/**
 * A General Training Writing Task 1 prompt.
 *
 * A SIBLING of PromptSpec and Task1PromptSpec, for the same reason those two are
 * siblings: a letter has no QuestionType and no chart, and forcing one shape to
 * cover all three would make every rule defend against fields it cannot use.
 */
export interface LetterPromptSpec {
  id: string;
  task: 'letter';
  /** Full task text, ending with the standard General Training instruction. */
  text: string;
  tone: LetterTone;
  /** Who the letter goes to, as the prompt names them: "your manager", "the council". */
  recipient: string;
  /**
   * The three bullet points the prompt supplies. All three must be covered —
   * this drives the `gt-bullet-uncovered` check.
   */
  bullets: string[];
  /** Content words per bullet, lowercase — how coverage is detected. */
  bulletKeywords: string[][];
  topic: string;
  keywords: string[];
}
```

Append to `IssueCategory` (after the existing `t1-` members, never reordering):

```ts
  // General Training Task 1 (letters). Task Achievement occupies the 'TR' slot.
  | 'gt-word-count'
  | 'gt-salutation-missing'
  | 'gt-salutation-tone'
  | 'gt-signoff-missing'
  | 'gt-signoff-pairing'
  | 'gt-bullet-uncovered'
  | 'gt-purpose-missing'
  | 'gt-tone-mismatch';
```

**Verify**: `npx tsc -b --noEmit` → fails on `CATEGORY_META`. Expected.

### Step 2: Metadata

Add eight `CATEGORY_META` entries. All map to `'TR'` except `gt-tone-mismatch`,
which is a register fault and maps to `'LR'`. Suggested copy:

```ts
  'gt-word-count': { label: 'Word count', criterion: 'TR', hint: 'A Task 1 letter needs at least 150 words.' },
  'gt-salutation-missing': { label: 'No greeting', criterion: 'TR', hint: "Every letter opens with a greeting: 'Dear Sir or Madam,' or 'Dear Anna,'." },
  'gt-salutation-tone': { label: 'Greeting does not match', criterion: 'TR', hint: "Match the greeting to the reader: 'Dear Sir or Madam' when you do not know their name, 'Dear Mr Hughes' when you do." },
  'gt-signoff-missing': { label: 'No sign-off', criterion: 'TR', hint: "Close the letter: 'Yours faithfully', 'Yours sincerely' or 'Best wishes', then your name." },
  'gt-signoff-pairing': { label: 'Greeting and sign-off clash', criterion: 'TR', hint: "'Yours faithfully' goes with 'Dear Sir or Madam'; 'Yours sincerely' goes with a name." },
  'gt-bullet-uncovered': { label: 'Bullet point not covered', criterion: 'TR', hint: 'All three bullet points in the task must be addressed.' },
  'gt-purpose-missing': { label: 'Purpose not stated', criterion: 'TR', hint: "Say why you are writing in the first paragraph: 'I am writing to …'." },
  'gt-tone-mismatch': { label: 'Wrong register', criterion: 'LR', hint: 'Hold one level of formality throughout — a formal letter takes no contractions or slang.' },
```

Add the letter category set beside the existing task sets:

```ts
export const LETTER_ONLY_CATEGORIES: ReadonlySet<IssueCategory> = new Set<IssueCategory>([
  'gt-word-count', 'gt-salutation-missing', 'gt-salutation-tone', 'gt-signoff-missing',
  'gt-signoff-pairing', 'gt-bullet-uncovered', 'gt-purpose-missing', 'gt-tone-mismatch',
])
```

**Verify**: `npx tsc -b --noEmit` → exit 0. `npx vitest run` → all pass
(adding union members changes no runtime behaviour).

### Step 3: `letterAchievement.ts`

Create `src/analysis/rules/letterAchievement.ts` exporting:

```ts
export function letterAchievementRules(doc: TokenizedDoc, prompt: LetterPromptSpec): Issue[]
```

**The salutation/sign-off table is the heart of this module.** Encode it as data,
not as branching:

```ts
/**
 * Salutation forms, and what each licenses as a sign-off.
 *
 * The pairing rule is fixed English letter convention and is worth real marks:
 * "Yours faithfully" belongs ONLY with an unnamed recipient, "Yours sincerely"
 * ONLY with a named one. Reversing them is one of the most common marks lost in
 * General Training Task 1, and it is a pure lookup — exactly the kind of thing
 * this engine should catch with certainty.
 */
```

- `SALUTATIONS`: patterns for unnamed formal (`^dear sir or madam,?$`,
  `^dear sir/madam,?$`), named formal/semi-formal (`^dear (mr|mrs|ms|miss|dr|prof)\.? \w+,?$`),
  informal (`^dear [a-z]+,?$` where the name is a bare first name), plus
  `^hi \w+`, `^hello \w+` (informal only).
- `SIGNOFFS`: `yours faithfully`, `yours sincerely`, `kind regards`,
  `best regards`, `regards`, `best wishes`, `all the best`, `love`, `take care`.
- The pairing matrix: faithfully↔unnamed only; sincerely↔named only;
  regards/best wishes↔semi-formal or informal; love/take care↔informal only.

Rules to implement:

1. **`gt-word-count`** — error below 150, warning 150–159, warning above 220.
   Mirror `t1-word-count` in `task1Achievement.ts` exactly.
2. **`gt-salutation-missing`** (error, gated at 40 words) — the first line
   matches no salutation form.
3. **`gt-salutation-tone`** (warning) — the salutation form does not match
   `prompt.tone`. "Hi Dave" in a formal letter; "Dear Sir or Madam" in a letter
   to a friend.
4. **`gt-signoff-missing`** (error, gated at 100 words) — no sign-off in the last
   two lines.
5. **`gt-signoff-pairing`** (error, inline on the sign-off) — the pairing matrix
   is violated. Message names the correct pairing explicitly.
6. **`gt-bullet-uncovered`** (error, essay-level, gated at 100 words) — for each
   bullet, fewer than 2 distinct keywords from `bulletKeywords[i]` appear
   anywhere in the body. Message names WHICH bullet, quoting it.
7. **`gt-purpose-missing`** (warning, gated at 100 words) — no purpose marker in
   the first body paragraph: `I am writing to`, `I am writing regarding`,
   `I am writing in connection with`, `I would like to`, `I wish to`,
   `this letter is to`.
8. **`gt-tone-mismatch`** (warning, inline) — register markers wrong for the
   tone. Formal letters: contractions, slang, exclamation marks, `hey`, `guys`,
   `wanna`. Informal letters: over-formal markers (`I am writing to express my
   profound dissatisfaction`, `henceforth`, `aforementioned`) — an informal
   letter that reads like a legal notice is equally wrong.

**Guards, all required** (a false accusation is the worst failure mode):

- The salutation and sign-off lines are excluded from the bullet-coverage scan —
  a name in the greeting is not coverage.
- `gt-signoff-pairing` fires only when BOTH a salutation and a sign-off were
  found. Never guess from one.
- Bullet coverage requires ≥2 distinct keywords, not 1 — a single common word
  is not evidence the point was addressed.

**Verify**: `npx tsc -b --noEmit` → exit 0.

### Step 4: The contraction interaction — one guarded change to `lexical.ts`

This is the only edit permitted outside the new files, and it must be surgical.

`contraction` currently fires as an **error** unconditionally
(SPEC.md: "explicit list (~40 forms)… List-match only"). In an **informal**
letter, "I can't wait to see you" is correct English at the target register, and
flagging it would mark a correct answer down.

Add an optional tone parameter to `lexicalRules`, exactly as `cohesionRules`
already takes an optional `TaskKind`:

```ts
export const lexicalRules: RuleFn = (
  doc: TokenizedDoc,
  prompt: PromptSpec | null,
  task?: TaskKind,
  tone?: LetterTone,
): Issue[] => {
```

Inside the contraction rule:

```ts
  // Contractions are correct at informal register. An informal General Training
  // letter is the one place in IELTS writing where "I can't wait" is right, and
  // flagging it would mark a correct answer down.
  if (tone === 'informal') return
```

Do **not** change the rule for any other caller. Task 2 and Academic Task 1 pass
no tone and behave exactly as before — the existing tests prove it.

**Verify**: `npx vitest run` → all existing tests pass unchanged. If any
contraction test moves, you changed the default path; revert and retry.

### Step 5: `letterStructure.ts`

Create `src/analysis/rules/letterStructure.ts` exporting
`buildLetterStructure(doc, prompt, achievementIssues)`, returning the same
`{ paragraphs, checks, issues }` shape as the other two structure modules.

**Paragraph roles**: paragraph 0 is the `introduction` (greeting + purpose);
everything after is `body`. **Never `conclusion`** — the sign-off is not a
conclusion paragraph.

**Structure Rail checks** (stable from the first keystroke):

| id | label | satisfied when |
|---|---|---|
| `gt-salutation` | `Greeting` | a salutation matching the prompt's tone was found |
| `gt-purpose` | `Purpose stated` | a purpose marker in the opening |
| `gt-bullet-1` | `Bullet 1 covered` | ≥2 keywords from bullet 1 in the body |
| `gt-bullet-2` | `Bullet 2 covered` | ≥2 keywords from bullet 2 |
| `gt-bullet-3` | `Bullet 3 covered` | ≥2 keywords from bullet 3 |
| `gt-signoff` | `Sign-off` | a sign-off found AND correctly paired |
| `complex-count` | `Complex sentences` | reuse `countRailMarkers` from `analysis/complexity.ts`, target 4 |

Each check needs a learner-facing `detail`, including a "not started" state.

**Issues**: reuse `paragraph-balance` where it genuinely applies. Do **not**
create letter duplicates of existing categories.

`StructureRail`'s `groupOf` will need `gt-salutation` and `gt-purpose` under
`intro` — see step 7.

**Verify**: `npx tsc -b --noEmit` → exit 0.

### Step 6: `letterBandEstimate.ts` and `analyzeLetter`

**6a.** `src/analysis/letterBandEstimate.ts` exporting
`estimateLetterBand(partial, doc)`. Import the shared helpers exported from
`bandEstimate.ts` (`count`, `hasError`, `isClean`, `finishScore`,
`roundOverallHalfDown`, `composeBullets`) rather than redefining them.

CC, LR and GRA score as Task 1 does. TA (the `TR` slot):

- `gt-word-count` error → cap 5.0
- `gt-bullet-uncovered` ≥ 1 → cap **5.5** (an uncovered bullet is an unanswered
  part of the task, the same weight `question-coverage` carries in Task 2)
- `gt-salutation-missing` or `gt-signoff-missing` → −0.5 each
- `gt-signoff-pairing` → −0.5
- `gt-purpose-missing` → −0.5
- `gt-tone-mismatch` ≥ 2 → −0.5
- Rewards: clean sweep · all three bullets covered AND tone consistent · all
  structure checks satisfied

Under-length floor: 100 words → all criteria 4.0, matching Task 1.

**6b.** Add `analyzeLetter(text, prompt)` to `engine.ts`, beside the other two.
Do **not** modify `analyzeEssay` or `analyzeTask1`. Give letters their own
`letterContext(prompt)` adapter (keywords from the prompt and its bullets, no
measurement vocabulary), and pass the tone through to `lexicalRules`.

**Verify**: `npx vitest run` → all existing tests pass unchanged.

### Step 7: UI wiring

- `App.tsx`: when `module === 'general' && task === 'task1'`, replace the plan-006
  placeholder with the letter flow — a letter prompt picker, the prompt text with
  its three bullets rendered as a list, and the editor. Route the analysis to
  `analyzeLetter`.
- `StructureRail.tsx`: `groupOf` maps `gt-salutation` and `gt-purpose` to
  `intro`; the bullets and sign-off fall through to `body`. Add letter paragraph
  norms to the task-keyed `NORMS` record.
- `Report.tsx`: the criterion label is already task-aware via `criterionLabel`.
  Confirm the POSITION CHECK card does not render for letters (it is Task 2 only).

**Verify**: `npm run build` → exit 0.

### Step 8: Scope the error profile by module

`categoryAppliesTo(category, task)` in `meta.ts` currently scopes by task only.
Letter categories can only fire for General Training Task 1, so extend it:

```ts
export function categoryAppliesTo(category: IssueCategory, task: TaskKind, module: Module): boolean
```

Update `profile.ts` to pass `session.module`. The existing test
`tests/profile-scoping.test.ts` pins the sets against what the pipelines emit —
extend it to cover the letter pipeline too.

**Verify**: `npx vitest run --project engine` → all pass.

### Step 9: The prompt bank and worked answers

**9a.** `src/prompts/letterBank.ts` — 15 prompts, 5 per tone, each with three
bullets and per-bullet keywords. Realistic GT scenarios: complaint to a shop,
request to a landlord, apology to a neighbour, invitation to a friend,
application to a manager, and so on. Every `text` ends with the standard
instruction:

```
Write at least 150 words. You do NOT need to write any addresses. Begin your letter as follows: Dear ...,
```

**9b.** `src/answers/letterModels.ts` — one worked letter per tone (three total),
hand-written. Letters cannot be generated the way Academic Task 1 answers are —
there is no data to compose from.

**9c.** Extend `tests/model-answers.test.ts` so the letters are graded by the
app's own engine, exactly as the seventeen existing worked answers are: no error
or warning, every structure check satisfied, band ≥ 8.0. **Expect to iterate
here** — that is the point of the test.

**Verify**: `npx vitest run tests/model-answers.test.ts` → all pass.

### Step 10: Tests

`tests/letters.test.ts` (engine), everything through `analyzeLetter`:

- **Pairing (6)**: faithfully+unnamed passes; sincerely+named passes;
  faithfully+named fails with a message naming the fix; sincerely+unnamed fails;
  no salutation means no pairing issue (guard); no sign-off means no pairing
  issue (guard).
- **Tone (4)**: a contraction in a formal letter fires `gt-tone-mismatch`; the
  same contraction in an informal letter fires **nothing**; "Hi Dave" in a formal
  letter fires `gt-salutation-tone`; over-formal wording in an informal letter
  fires `gt-tone-mismatch`.
- **Bullets (4)**: all three covered → no issue and three satisfied checks; one
  uncovered → one issue naming that bullet; a keyword appearing only in the
  greeting does not count as coverage; one keyword is not enough (needs 2).
- **Purpose and shape (3)**: missing purpose gated below 100 words; present
  above it; no paragraph is ever assigned the `conclusion` role.
- **Band (3)**: under 100 words → 4.0 across the board; an uncovered bullet caps
  TR at 5.5; a model letter scores ≥ 8.0 (the calibration anchor).
- **Regression (2)**: `analyzeEssay` and `analyzeTask1` outputs are unchanged for
  fixed inputs.

`tests/ui/letters.test.tsx` (ui): the letter flow renders under General+Task 1,
the three bullets are visible, the rail shows Greeting/Purpose/Bullets/Sign-off
and no Conclusion group, and switching to Academic swaps back to the chart.

**Verify**: `npx vitest run` → all pass, ~28 new tests.

### Step 11: Documentation and full green

Add a `### General Training Task 1 (letters)` section to SPEC.md recording the
tone system, the pairing matrix verbatim, every rule with its gate and severity,
the band caps, and the `lexical.ts` tone guard with its reasoning.

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `npx vitest run` → all pass.
**Verify**: `npm run build` → exit 0.

## Done criteria

- [ ] `npx tsc -b --noEmit` exits 0
- [ ] `npx vitest run` exits 0; ~28 new tests pass; **no existing test modified**
- [ ] `npm run build` exits 0
- [ ] `grep -c "gt-" src/meta.ts` returns at least 8
- [ ] `grep -c "export function analyzeLetter" src/analysis/engine.ts` returns 1
- [ ] `grep -c "export function analyzeEssay" src/analysis/engine.ts` returns 1 and its body is unchanged (`git diff main -- src/analysis/engine.ts` shows additions only)
- [ ] `grep -c "id: 'gt-" src/prompts/letterBank.ts` returns 15
- [ ] `grep -rn "'conclusion'" src/analysis/rules/letterStructure.ts` shows no role assignment
- [ ] The three worked letters pass `tests/model-answers.test.ts` at band ≥ 8.0
- [ ] `plans/README.md` status row for 009 updated to DONE

## STOP conditions

- Plan 006 has not landed.
- Any existing test fails.
- The `lexical.ts` tone guard changes behaviour for any non-letter caller.
- You conclude `Criterion` needs a fifth member. It does not — letters are
  marked on Task Achievement, which is the `TR` slot.
- A worked letter cannot reach band 8.0 without weakening a rule. Report the
  actual score and the driving deductions; do **not** loosen a threshold to make
  the app's own example pass, which is teaching to the test.
- Bullet-coverage detection produces false "uncovered" reports on a letter that
  plainly covers the point. Report the case — under-detecting coverage tells a
  correct learner they failed the task, which is the worst outcome this app can
  produce.

## Maintenance notes

- **The pairing matrix is the feature.** If a learner reports a false positive,
  add a salutation or sign-off form to the table — do not weaken the pairing
  rule, which is the most valuable deterministic check in the whole letter
  module.
- **`lexical.ts` now has a tone-dependent branch.** It is the only one. If a
  second rule needs tone, consider passing a small context object rather than
  growing the parameter list further.
- **Letters have no worked-answer generator.** Academic Task 1 answers are
  composed from chart data; a letter has no equivalent source, so the three
  models are hand-written and must be maintained by hand.
- **What a reviewer should scrutinise**: the guards on `gt-signoff-pairing`
  (both parts must be present), that greeting text is excluded from bullet
  coverage, and that the informal-contraction guard cannot leak into Task 2.
