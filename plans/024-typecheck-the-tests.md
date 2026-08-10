# Plan 024: Bring `tests/` under the typechecker

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat ae92bac..HEAD -- tsconfig.json tests/ package.json`
> If any file quoted in "Current state" changed since this plan was written,
> compare the excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW — no runtime code changes; the risk is scope creep into `src/`
- **Depends on**: none, but **plan 020 must not include this** (see below)
- **Category**: dx
- **Planned at**: commit `ae92bac`, 2026-08-10

## Why this matters

`tsconfig.json` ends with `"include": ["src"]`. The test suite is therefore
**never typechecked** — not by `npx tsc -b --noEmit`, not by `npm run build`,
not by anything.

It does not currently compile. Measured at `ae92bac`:

```
$ npx tsc --noEmit --strict --target es2022 --module esnext \
    --moduleResolution bundler --jsx react-jsx --skipLibCheck tests/*.ts
… 29 errors
```

spread across six files: `store.test.ts` (13), `module-switch.test.ts` (9),
`profile-scoping.test.ts` (3), `task1-chart.test.ts` (2),
`listening-marking.test.ts` (1), `task1-rules.test.ts` (1).

Two representative failures, both real:

```
tests/task1-chart.test.ts(103,36): error TS2345: Argument of type '{ kind: "process"; … }'
  is not assignable to parameter of type 'Task1Chart'.
  Property 'subject' is missing … but required in type 'Task1Chart'.

tests/task1-rules.test.ts(26,3): error TS2741: Property 'subject' is missing in type
  '{ kind: "line"; … }' but required in type 'Task1Chart'.
```

`Task1Chart.subject` was added when the worked-answer generator shipped. Every
test fixture that predates it is now structurally wrong, and nothing said so.

**Why this matters beyond tidiness.** A test fixture that no longer matches the
type it claims to be is a test asserting against a shape the app cannot
produce. Several of the `store.test.ts` and `profile-scoping.test.ts` errors are
helpers reaching into `SessionRecord` without narrowing on `section` — the exact
discriminated union whose exhaustiveness `src/types.ts` spends a doc comment
protecting. Those helpers compile today only because nothing checks them.

**Why this is NOT part of plan 020.** Plan 020 turns CI on. Turning CI on and
landing 29 pre-existing errors into it in the same change is the one outcome to
avoid: the first CI run would be red for reasons unrelated to CI, and the
natural response is to weaken the gate. Land 020 first (CI green on the current
`src`-only scope), then land this, then widen the CI gate in this plan's final
step.

## Current state

### The configuration — `tsconfig.json` (whole file, 20 lines)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

There is exactly one `tsconfig.json`; there is no `tsconfig.node.json` or
`tsconfig.test.json`. Note `"strict": true` — whatever scope you widen to
inherits it.

### What the suite looks like

`tests/` holds 24 files: 15 `*.test.ts` under `tests/` (the `engine` vitest
project, Node environment) and 9 `*.test.tsx` under `tests/ui/` (the `ui`
project, jsdom), plus `tests/ui/setup.ts` and `tests/ui/renderApp.tsx`.
`vite.config.ts` defines both projects.

### Repo conventions you must match

- **TypeScript strict**, no `any`. If a fixture needs a partial shape, build it
  from a typed factory and narrow — do not cast it away.
- **Do NOT weaken a type in `src/` to make a test compile.** The types are the
  contract; a fixture that cannot satisfy them is a wrong fixture. If you
  believe a `src/` type is genuinely wrong, that is a STOP condition.
- **Do NOT weaken or delete a test** to make it compile. Fix the fixture.
- `tests/ui/*` must keep using `renderApp()` from `tests/ui/renderApp.tsx`;
  never `render(<App />)`, which reintroduces a flake that was fixed earlier.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck src (today's gate) | `npx tsc -b --noEmit` | exit 0 |
| Typecheck everything (the goal) | `npx tsc --noEmit -p tsconfig.json` | exit 0 once widened |
| Tests | `npx vitest run` | 848 passed / 24 files (plus any added by other plans) |
| Build | `npm run build` | exit 0 |
| UI determinism | 10× `npx vitest run --project ui` | identical output each run |

## Scope

**In scope**:

- `tsconfig.json` (modify — widen `include`, or add a test-scoped project)
- `tests/**` (modify — fix the 29 errors)
- `package.json` (modify — only if plan 020's `typecheck` script needs its scope widened)
- `.github/workflows/ci.yml` (modify — final step only, and only if plan 020 has landed)

**Out of scope** (do NOT touch):

- **Anything under `src/`.** This plan changes no runtime behaviour. If a fix
  appears to require a `src/` change, STOP and report.
- `vite.config.ts` — the two vitest projects stay as they are.
- Adding `any`, `@ts-expect-error`, or `as unknown as X` to silence an error.
  Each is a place the compiler was overruled, and the whole point of this plan
  is to stop overruling it silently.

## Git workflow

- Branch: `advisor/024-typecheck-tests`
- One commit per group of related fixes; plain imperative subjects.
- Do NOT push and do NOT open a PR.

## Steps

### Step 1: Reproduce and record the baseline

```bash
npx tsc --noEmit --strict --target es2022 --module esnext \
  --moduleResolution bundler --jsx react-jsx --skipLibCheck \
  $(find tests -name '*.ts' -o -name '*.tsx') 2>&1 | tee /tmp/024-before.txt
grep -c "error TS" /tmp/024-before.txt
```

**Verify**: a non-zero count. Record the exact number and the per-file
breakdown in your report — it is the before measurement. (29 across six files
when this plan was written, `*.ts` only; including `tests/ui/*.tsx` may raise
it.)

### Step 2: Widen the typechecker's scope

Change `tsconfig.json`'s last line:

```json
  "include": ["src", "tests"]
```

**Verify**: `npx tsc -b --noEmit` now **fails**, reporting the same errors as
step 1. That failure is the point — it proves the scope actually widened. If it
still passes, the config did not take effect; STOP and report.

### Step 3: Fix the fixtures, file by file

Work in ascending order of error count so the easy files build confidence:
`task1-rules.test.ts` (1), `listening-marking.test.ts` (1),
`task1-chart.test.ts` (2), `profile-scoping.test.ts` (3),
`module-switch.test.ts` (9), `store.test.ts` (13).

Two patterns cover most of them:

- **Missing required field on a fixture** (e.g. `Task1Chart.subject`). Add a
  realistic value — read a real entry in `src/prompts/task1Bank.ts` and match
  its style. Do not make the field optional in `src/`.
- **A helper handling `SessionRecord` without narrowing on `section`.** Narrow
  with the existing guards from `src/types.ts` (`isWritingSession`,
  `isReadingSession`, `isListeningSession`) rather than casting. Note
  `tests/profile-scoping.test.ts:54` builds a record that omits `section`
  entirely; that is legal on the wire (the migration stamps it) but not in a
  typed literal — construct it as the pre-migration shape it represents and let
  the test's own migration path add the field.

**Verify after each file**: `npx tsc -b --noEmit 2>&1 | grep -c "error TS"` →
strictly decreasing, and `npx vitest run` → still 848 passing. A fix that
reduces errors but changes a test's behaviour is wrong.

### Step 4: Confirm no test changed meaning

```bash
git diff ae92bac..HEAD -- tests/ | grep -E '^-' | grep -vE '^---' | grep -E 'expect\(|it\(|describe\('
```

**Verify**: empty, or every hit is a line you can justify in your report as a
type-only change (a rename, an added field, a narrowing). **A removed or
weakened assertion is a STOP condition** — this plan is not allowed to change
what any test asserts.

### Step 5: Full green

**Verify**: `npx tsc -b --noEmit` → exit 0, no output.
**Verify**: `npx vitest run` → 848 passed / 24 files.
**Verify**: `npm run build` → exit 0.
**Verify**: 10 consecutive `npx vitest run --project ui` → identical.

### Step 6: Widen the CI gate — only if plan 020 has landed

Check first: `test -f .github/workflows/ci.yml`.

- If it exists, confirm its typecheck step now covers `tests/` (it will
  automatically if it runs `npm run typecheck` or `npx tsc -b --noEmit`, since
  step 2 widened the config). Add a comment in the workflow noting that the
  scope includes tests as of this plan.
- If it does not exist, skip this step and note in your report that plan 020 is
  outstanding.

### Step 7: Record it

Add one line to `SPEC.md`'s tooling/verification area (or `README.md`'s Run it
block, whichever plan 020 established) stating that `tsc` covers `src` **and**
`tests`, so a fixture that drifts from its type fails the build.

## Test plan

- **No new tests.** This plan adds none and changes no assertions; the existing
  848 are the regression suite, and step 4 exists to prove they were not
  altered.
- The verification that matters is step 2's deliberate red and step 5's green.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -c '"tests"' tsconfig.json` returns at least 1
- [ ] `npx tsc -b --noEmit` exits 0 with no output
- [ ] `npx vitest run` exits 0; 848 passed / 24 files, none modified in meaning
- [ ] `npm run build` exits 0
- [ ] 10 consecutive `npx vitest run --project ui` runs give identical output
- [ ] `git diff --stat ae92bac..HEAD -- src/` is **empty**
- [ ] `grep -rn "@ts-expect-error\|as unknown as\|: any" tests/ | wc -l` is no
      higher than at `ae92bac` (record both numbers)
- [ ] `plans/README.md` status row for 024 updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- Any excerpt in "Current state" does not match the live file.
- A fix appears to require changing anything under `src/`. Report the type and
  the fixture that disagree with it — one of them is wrong, and deciding which
  is a design call, not an executor call.
- The error count goes **up** after a file is fixed. That means a fix widened
  inference somewhere; investigate before continuing.
- You cannot fix an error without `any`, a cast, or `@ts-expect-error`. Report
  the specific error; a documented single exception may be acceptable, but it is
  a decision, not a default.
- Any test's assertion changes. Step 4 exists to catch this.

## Maintenance notes

- **This is why the errors accumulated silently**: `Task1Chart.subject` was
  added in the worked-answer work and every pre-existing fixture went stale
  without a signal. Once `include` covers `tests`, that class of drift fails the
  build the day it is introduced.
- **The `SessionRecord` narrowing errors are the valuable ones.** `src/types.ts`
  documents an exhaustive-switch barrier protecting that union; test helpers
  bypassing it were the one place that protection did not reach.
- **Order matters**: plan 020 (CI) should land first and be green, then this,
  then the gate widens. Doing it the other way makes the first CI run red for
  reasons that have nothing to do with CI.
- If `tests/ui/*.tsx` proves to need different compiler options from
  `tests/*.ts`, prefer a second `tsconfig` project over loosening the shared
  one — `strict` must not be weakened for either.
