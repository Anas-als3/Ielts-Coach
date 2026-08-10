# Plan 007: Make the UI suite deterministic, and grade the worked answer against its own prompt

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b942572..HEAD -- src/App.tsx src/components/ModelAnswer.tsx tests/ui/`

## Status

- **Priority**: **P0** — small, and it unblocks verification of everything else
- **Effort**: S (half a day)
- **Risk**: LOW
- **Depends on**: none. Do this **first thing**, before plan 006, because it buys back the test signal plan 006 needs.
- **Category**: bug
- **Planned at**: commit `b942572`, 2026-08-10

## Why this matters

Two defects, both introduced by earlier work in this repo, both measured on
2026-08-10.

**1. The UI suite is flaky and I shipped it green.** `npx vitest run --project ui`
was run six times: it failed on four of them. `src/App.tsx` seeds its Task 2
prompt from `randomPrompt()` over 40 prompts, and nothing in `tests/ui/setup.ts`
stubs that. So `render(<App />)` draws a different question each run and two
assertions in `tests/ui/model-answer.test.tsx` are only true for some draws:

- `getByText('8.0')` throws whenever the overall band and a criterion tile both
  render `8.0` — "found multiple elements".
- The comment claiming "only op-01 has an exact answer" is **wrong**: di-01,
  ps-01, ad-01 and dq-01 have exact answers too.

A suite that fails a third of the time is worse than no suite: it trains everyone
to re-run until green, which is exactly how a real regression gets waved through.
Plan 006 changes calibrated rules and needs a trustworthy suite to land against.

**2. The worked answer is graded against the wrong prompt.** `ModelAnswer.tsx`
calls `analyzeEssay(model.text, prompt)` using the **learner's** prompt, even
when `task2ModelFor` returned a different prompt's answer as a fallback
(`exact: false`, which happens for 35 of the 40 prompts).

Measured over all 40 prompts through the panel's own code path: **14 render a
worked answer that the app's own scorecard marks below 8.0.** The discussion
prompts di-02…di-08 show overall 7.5, and dq-02…dq-08 show Task Response **5.5**
carrying a `question-coverage` **error** — because the answer legitimately does
not address a question it was never written for.

SPEC.md states verbatim: *"A model answer the engine would mark down is worse
than none… so the target is verifiable rather than asserted."* That is currently
false for 65% of the bank, and the panel displays the wrong band to the learner.

## Current state

### The unseeded prompt — `src/App.tsx`

```ts
  const [prompt, setPrompt] = useState<PromptSpec | null>(() => randomPrompt())
```

and `src/prompts/bank.ts`:

```ts
export function randomPrompt(): PromptSpec {
  const index = Math.floor(Math.random() * PROMPTS.length)
  return PROMPTS[index] ?? PROMPTS[0]
}
```

`tests/ui/setup.ts` stubs `localStorage`, `matchMedia` and `scrollTo` — but
nothing seeds the prompt.

### The mis-grading — `src/components/ModelAnswer.tsx`

```ts
  const model = useMemo(() => {
    ...
    const m = task2ModelFor(prompt)
    if (!m) return null
    return { text: m.text, exact: m.exact, sourceLabel: m.sourcePromptId }
  }, [task, prompt, task1Prompt])

  const analysis = useMemo(() => {
    if (!model) return null
    return task === 'task1' && task1Prompt
      ? analyzeTask1(model.text, task1Prompt)
      : analyzeEssay(model.text, prompt)   // <-- the LEARNER's prompt
  }, [model, task, prompt, task1Prompt])
```

`model` discards `sourcePromptId` as a label only; the analysis never sees it.

### The fallback that makes it matter — `src/answers/task2Models.ts`

```ts
  const fallbackId = REPRESENTATIVE[prompt.type]
  const fallbackText = fallbackId ? TASK2_MODELS[fallbackId] : undefined
  if (!fallbackText || !fallbackId) return null

  return { text: fallbackText, sourcePromptId: fallbackId, exact: false }
```

### The test that never sees it — `tests/model-answers.test.ts`

Its Task 2 block iterates `Object.entries(TASK2_MODELS)` and pairs each answer
with **its own** prompt. The fallback path is never exercised.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| UI, repeatedly | `for i in $(seq 1 10); do npx vitest run --project ui 2>&1 \| grep -E "^ *Tests "; done` | 10 identical passing lines |
| Engine | `npx vitest run --project engine` | all pass |
| Typecheck | `npx tsc -b --noEmit` | exit 0 |

## Scope

**In scope**:

- `src/App.tsx` (modify — accept an optional initial prompt)
- `src/types.ts` (modify — the new prop)
- `src/components/ModelAnswer.tsx` (modify — grade against the source prompt)
- `tests/ui/setup.ts`, `tests/ui/*.test.tsx` (modify — seed the prompt, fix the two wrong assertions)
- `tests/model-answers.test.ts` (modify — cover the fallback path)
- `SPEC.md` (modify — one line)

**Out of scope**:

- `randomPrompt()` itself — production behaviour stays random. The fix is
  injectability, not determinism in the app.
- The worked answers' text.
- Anything in `src/analysis/`.

## Git workflow

- Branch: `advisor/007-deflake-and-model-grading`
- Two commits, one per defect.

## Steps

### Step 1: Prove the flake

```bash
for i in $(seq 1 10); do npx vitest run --project ui 2>&1 | grep -E "^ *Tests "; done
```

**Verify**: at least two runs differ. Record the failure count in your report —
this is the before measurement.

### Step 2: Make the initial prompt injectable

Add an optional prop to `App`:

```ts
export interface AppProps {
  /**
   * Initial Task 2 prompt. Production passes nothing and gets a random draw;
   * tests pass a fixed prompt so `render(<App />)` is deterministic. Without
   * this the UI suite drew a different question every run and two assertions
   * were true only for some draws.
   */
  initialPrompt?: PromptSpec
  /** Initial Task 1 prompt, same reasoning. */
  initialTask1Prompt?: Task1PromptSpec
}
```

```ts
export default function App({ initialPrompt, initialTask1Prompt }: AppProps = {}) {
  const [prompt, setPrompt] = useState<PromptSpec | null>(() => initialPrompt ?? randomPrompt())
  const [task1Prompt, setTask1Prompt] = useState<Task1PromptSpec>(
    () => initialTask1Prompt ?? randomTask1Prompt(),
  )
```

Do not change `src/main.tsx` — production keeps the random draw.

**Verify**: `npx tsc -b --noEmit` → exit 0.

### Step 3: Seed every UI test

In `tests/ui/`, replace every `render(<App />)` with a seeded render. Add a
helper to `tests/ui/setup.ts` or a small shared module:

```ts
/** Deterministic render. Every UI test must use this — see plan 007. */
export function renderApp(overrides: Partial<AppProps> = {}) {
  return render(
    <App
      initialPrompt={PROMPTS.find((p) => p.id === 'op-01')!}
      initialTask1Prompt={TASK1_PROMPTS.find((p) => p.id === 't1-01')!}
      {...overrides}
    />,
  )
}
```

`op-01` is chosen because it has an **exact** worked answer, which makes the
"exact vs fallback" assertions decidable rather than draw-dependent.

**Verify**: `grep -c "render(<App />)" tests/ui/` returns 0.

### Step 4: Fix the two wrong assertions

In `tests/ui/model-answer.test.tsx`:

- `getByText('8.0')` → scope it to the band element
  (`document.querySelector('.ma-band')`) or use `getAllByText('8.0')[0]`. The
  duplication is real: the overall band and a criterion tile can both be 8.0.
- The comment and logic claiming only `op-01` has an exact answer is **false**.
  With `op-01` seeded, assert the exact case directly: no "different question"
  notice. Add a second test seeded with a prompt that has **no** exact answer
  (e.g. `op-05`) asserting the notice **is** present.

**Verify**: run the UI project 10 times → 10 identical passing lines.

### Step 5: Grade the worked answer against its own prompt

In `src/components/ModelAnswer.tsx`, carry the source prompt through and analyse
against it:

```ts
    const m = task2ModelFor(prompt)
    if (!m) return null
    const source = PROMPTS.find((p) => p.id === m.sourcePromptId) ?? prompt
    return { text: m.text, exact: m.exact, sourcePrompt: source, sourceLabel: m.sourcePromptId }
```

```ts
      : analyzeEssay(model.text, model.sourcePrompt)
```

Add a comment saying why:

```ts
  // Graded against the prompt the answer was WRITTEN for, not the one on
  // screen. A fallback answer legitimately does not address the learner's
  // question, and scoring it against that question made the app mark its own
  // exemplar down on 14 of 40 prompts.
```

**Verify**: `npx tsc -b --noEmit` → exit 0.

### Step 6: Cover the fallback path in the engine test

Add to `tests/model-answers.test.ts`:

```ts
  it('shows an answer that scores 8.0+ for every prompt in the bank', () => {
    for (const prompt of PROMPTS) {
      const m = task2ModelFor(prompt)!
      const source = PROMPTS.find((p) => p.id === m.sourcePromptId)!
      const analysis = analyzeEssay(m.text, source)
      expect(analysis.band.overall, `${prompt.id} -> ${m.sourcePromptId}`).toBeGreaterThanOrEqual(8)
    }
  })
```

This is the assertion SPEC.md already promises and the suite never made.

**Verify**: `npx vitest run tests/model-answers.test.ts` → all pass, including
the new case over all 40 prompts.

### Step 7: Confirm the fix end-to-end and update SPEC

Write a throwaway probe (in `/tmp`, deleted afterwards) that walks all 40 prompts
through `task2ModelFor` → `analyzeEssay(text, sourcePrompt)` and prints any
below 8.0. Expect **zero**. Report the before (14) and after (0) counts.

Add one line to SPEC.md's worked-answers section: the panel grades the example
against the prompt it was written for, not the one on screen.

### Step 8: Full green

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `npx vitest run` → all pass.
**Verify**: 10 consecutive `--project ui` runs → identical.
**Verify**: `npm run build` → exit 0.

## Done criteria

- [ ] 10 consecutive `npx vitest run --project ui` runs give identical passing output
- [ ] `grep -rc "render(<App />)" tests/ui/` returns 0
- [ ] The all-40-prompts model-answer assertion exists and passes
- [ ] The before/after flake counts and the 14 → 0 mis-grading counts are reported
- [ ] `npx tsc -b --noEmit` exits 0, `npm run build` exits 0
- [ ] `plans/README.md` status row for 007 updated to DONE

## STOP conditions

- The UI suite is still non-deterministic after step 4. Something else is
  random — find it before proceeding; do not add retries or increase timeouts.
- Any prompt still yields a worked answer below 8.0 after step 5. That means a
  hand-written answer is genuinely below target and needs rewriting, which is a
  content decision — report which one and its score.
- Adding `AppProps` breaks `src/main.tsx`. It should not; the props are optional.

## Maintenance notes

- **Never call `render(<App />)` unseeded again.** The helper from step 3 is the
  only supported entry point for UI tests; a future test that bypasses it
  reintroduces the flake.
- **Randomness in a component initialiser is the root cause**, not the two bad
  assertions. If a third random source appears (a shuffled question order, a
  random tip), make it injectable at the same time.
- **What a reviewer should scrutinise**: that production still draws randomly
  (`main.tsx` unchanged), and that the new all-40 assertion actually iterates
  the fallback path rather than only the five exact ones.
