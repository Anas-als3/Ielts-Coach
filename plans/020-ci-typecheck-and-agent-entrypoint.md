# Plan 020: Put a gate behind the work — CI, a `typecheck` script, a Node pin, and an entry point for the agents that build this repo

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. Do **not** update `plans/README.md`: the
> coordinator owns the index for this batch.
>
> **Drift check (run first)**:
>
> ```bash
> git diff --stat ae92bac..HEAD -- package.json README.md tsconfig.json \
>   .github/ CLAUDE.md .nvmrc
> ```
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW — adds files and one script; changes no application code
- **Depends on**: none (but see Maintenance notes: run it **after** any
  in-flight plan lands, so CI goes green on its first run)
- **Category**: dx
- **Planned at**: commit `ae92bac`, 2026-08-10

## Why this matters

This repository is built almost entirely by agents, and it has no gate.

- **No CI of any kind.** `git ls-files | grep -iE 'claude\.md|agents\.md|contributing|\.github|workflow|\.nvmrc|node-version|tool-versions|Makefile|\.ya?ml|\.toml'` returns nothing. Meanwhile the remote is
  `https://github.com/Anas-als3/Ielts-Coach.git` with **21 branches pushed**
  across **48 commits**, **11 of them merges** — a PR-shaped workflow where the
  only thing standing between a red suite and `main` is whether someone
  remembered to run the suite.
- **The gate is cheap.** Measured at this commit on Node v24.18.0:
  `npx tsc --noEmit` **1.12 s**, `npx vitest run` **7.6 s**,
  `npm run build` **1.5 s**. Ten seconds of compute. A GitHub Actions job would
  be dominated by `npm ci`, not by the checks.
- **There is no `typecheck` script.** `package.json` scripts are exactly `dev`,
  `build`, `preview`, `test`, `test:engine`, `test:ui`. `tsc` runs **only**
  inside `"build": "tsc -b && vite build"`. So `npm test` — the command a
  contributor or an agent naturally runs — can be fully green while `tsc` is red,
  and nothing named "typecheck" exists to run instead.
- **There is no `CLAUDE.md`, `AGENTS.md` or `CONTRIBUTING.md`**, in a repo that
  is unambiguously agent-executed: 14 numbered plans in `plans/`, branch names
  `advisor/001-schema-migration` through `advisor/011-listening`, and
  `plans/README.md:15` headed "Execution order & status". The constraints an
  agent must not violate are real, written down, and **scattered**:
  `plans/README.md` has a "Findings considered and rejected" section (adding a
  chart library; merging the two complexity-marker lists) and a "Known
  limitations carried forward" section; `SPEC.md` is named canonical only at
  `README.md:167`; and load-bearing "do not refactor this" reasoning sits in
  source comments at `src/analysis/complexity.ts:15-18` and
  `src/analysis/engine.ts:175-176` that an agent sees only if it happens to open
  those files. The predictable failure is an agent re-proposing something already
  killed, or "cleaning up" the deliberately duplicated sort block in `engine.ts`.
- **No Node pin.** No `.nvmrc`, `.node-version`, `.tool-versions`, and no
  `engines` field. The binding constraint is not Vite or Vitest — it is
  **jsdom 30**, whose `engines.node` is `^22.22.2 || ^24.15.0 || >=26.0.0`. The
  working machine is v24.18.0 and nothing records it, so a CI runner defaulting
  to Node 20 would fail to install.

After this plan: every push runs typecheck, tests and build; `npm run typecheck`
is a nameable local command; the Node version is written down in a file CI reads;
and an agent opening the repo finds one page telling it what is canonical, what
was already rejected, and what it must not touch.

## Current state

### `package.json` — verbatim, at `ae92bac`

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:engine": "vitest run --project engine",
    "test:ui": "vitest run --project ui"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
```

Runtime dependencies are exactly two. `README.md:165`: "React 18 + TypeScript
(strict) + Vite. No runtime dependencies beyond React."

Installed dev tool versions and their `engines.node`, read from
`node_modules/*/package.json`:

| Package | Version | `engines.node` |
|---|---|---|
| vite | 6.4.3 | `^18.0.0 \|\| ^20.0.0 \|\| >=22.0.0` |
| vitest | 4.1.10 | `^20.0.0 \|\| ^22.0.0 \|\| >=24.0.0` |
| jsdom | 30.0.1 | **`^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`** |
| typescript | 5.6.3 | `>=14.17` |

jsdom's range is a subset of the other three, so it is the whole constraint.

### `tsconfig.json` — verbatim

```json
{
  "compilerOptions": { ... "strict": true, "noEmit": true, ... },
  "include": ["src"]
}
```

There are **no project references**, so `tsc -b` and `tsc --noEmit` check the
same file set. Both exit 0 today.

**`include` is `["src"]`, so `tests/` is never typechecked** — and it does not
currently typecheck clean. Measured by pointing a throwaway config at both
directories: **29 type errors across 6 test files** (`store.test.ts` 13,
`module-switch.test.ts` 9, `profile-scoping.test.ts` 3, `task1-chart.test.ts` 2,
`listening-marking.test.ts` 1, `task1-rules.test.ts` 1). Example, at
`tests/profile-scoping.test.ts:54`: `Property 'section' is missing in type … but
required in type 'WritingSessionRecord'`. Vitest strips types rather than
checking them, so nothing in this repo surfaces any of it. That is a real gap and
this plan **does not** close it — see "Out of scope".

### `vite.config.ts` — the two test projects

```ts
    projects: [
      { extends: true, test: { name: 'engine', environment: 'node', include: ['tests/*.test.ts'] } },
      { extends: true, test: { name: 'ui', environment: 'jsdom', include: ['tests/ui/*.test.tsx'], setupFiles: ['tests/ui/setup.ts'] } },
    ],
```

### `README.md:148-156` — the documented commands

````
## Run it

```bash
npm install
npm run dev
npm test            # everything
npm run test:engine # analysis + storage, Node, no DOM
npm run test:ui     # components, jsdom + Testing Library
```
````

All five are correct and all five pass. `npm run build` and any typecheck are
never mentioned.

`README.md:165-169` is the architecture list, and `:167` is the only place
`SPEC.md` is named canonical:

```
React 18 + TypeScript (strict) + Vite. No runtime dependencies beyond React.

- `SPEC.md` — canonical thresholds and rule inventory (the source of truth)
- `DESIGN.md` — visual direction (exam-stationery aesthetic)
- `src/types.ts` — the shared contract; `IssueCategory` ids are stable across versions
```

### The scattered constraints an agent needs

- `plans/README.md`, "Findings considered and rejected" — seven entries,
  including "Adding a chart library — 'no runtime dependencies beyond React' is
  a stated architectural property" and "Merging the two complexity-marker lists
  — both are canonical; merging moves the rail check and the band calibration
  simultaneously."
- `plans/README.md`, "Known limitations carried forward" — thirteen entries,
  including one recording a fix that was tried, measured, and **reverted** (the
  wordmark `transition: color`, which measurably lengthened the sub-3:1 contrast
  window).
- `src/analysis/complexity.ts:15-18`:
  ```
   * They are not the same list and are not interchangeable. Before changing
   * either, note that `tests/band-rewards.test.ts` pins band calibration anchors
   * that depend on the GRA list, and the rail check's satisfied/unsatisfied
   * behaviour depends on the rail list.
  ```
- `src/analysis/engine.ts:175-176`:
  ```
    // Duplicated from analyzeEssay rather than factored out: analyzeEssay must
    // stay byte-identical so the Task 2 regression tests mean what they say.
  ```

### Baseline measurements at `ae92bac`

| Check | Command | Result | Wall time |
|---|---|---|---|
| Typecheck | `npx tsc --noEmit` | exit 0 | 1.12 s |
| Typecheck (build form) | `npx tsc -b --noEmit` | exit 0 | 1.14 s |
| Tests | `npx vitest run` | 24 files, **848 passed** | 7.6 s |
| Build | `npm run build` | exit 0; 559.90 kB JS (174.03 kB gzip), 68.71 kB CSS | 1.5 s |
| UI stability | `npx vitest run --project ui` ×10 | **97 passed, all ten runs identical** | ~5 s each |

The UI suite was flaky before plan 007 (`plans/README.md`: "Six consecutive runs
of `--project ui`: four failed"). Ten consecutive identical runs at this commit
is what makes CI worth turning on: a gate over a flaky suite trains people to
ignore it.

### Repo conventions you must match

- **House style is heavily commented, and comments explain WHY.** That applies to
  the YAML and the Markdown you write here as much as to TypeScript. Look at
  `vite.config.ts` — its `projects` array carries a paragraph explaining why
  there are two.
- **Runtime dependencies are exactly `react` and `react-dom`.** This plan adds
  **no dependency at all**, runtime or dev.
- **`SPEC.md` is canonical** for thresholds and rules; `DESIGN.md` for visuals.
- **`IssueCategory` ids are frozen** (`README.md:169`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck (before this plan) | `npx tsc -b --noEmit` | exit 0, no output |
| Typecheck (after step 1) | `npm run typecheck` | exit 0, no output |
| Full suite | `npx vitest run` | 24 files, **848 tests**, all pass |
| Build | `npm run build` | exit 0 |
| Parse the workflow YAML | `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('ok')"` | prints `ok` |

Dependencies are already installed. Do **not** run `npm install`, and do not run
`npm ci` locally — it would delete and reinstall a `node_modules` that may be a
symlink in this working copy.

If `python3` has no `yaml` module on your machine, substitute the fallback check
given in step 3. Do **not** install a YAML parser to satisfy a verification step.

## Scope

**In scope** (the only files you should modify or create):

- `package.json` (modify — add one script, add `engines`)
- `.nvmrc` (create)
- `.github/workflows/ci.yml` (create)
- `CLAUDE.md` (create)
- `README.md` (modify — two command lines and one pointer)

**Out of scope** (do NOT touch, even though they look related):

- **ESLint and Prettier.** Measured and rejected; see the section below. Do not
  add either, and do not add a `lint` script.
- **Typechecking `tests/`.** `tsconfig.json`'s `include` stays `["src"]`. Adding
  `tests` produces **29 errors across 6 files** today (measured — the breakdown
  is in "Current state"). Fixing those is a real job with its own risks: several
  are genuine narrowing bugs in test helpers (`Property 'task' does not exist on
  type 'SessionRecord'` — i.e. a helper is reaching into a union without
  narrowing), and one is a helper omitting the `section` field that
  `isWritingSession` exists to interpret. Report the count in your summary so the
  coordinator can file it; do not attempt it here. Turning CI on **and** breaking
  it in the same change is the one outcome this plan must avoid.
- **`vite.config.ts`.** The two-project split is deliberate and documented.
- **Any application code under `src/`.** This plan changes no behaviour.
- **`SPEC.md`, `DESIGN.md`, `plans/README.md`.** `CLAUDE.md` *points at* them; it
  does not restate or edit them. Duplicated canon drifts.
- **Branch protection, required checks, or any GitHub settings.** Those are the
  repository owner's to configure, not an executor's, and they cannot be set from
  a commit.
- **`npm audit`, Dependabot, release automation, deploy.** Out of scope; a first
  gate should be one job that does what a developer already does.
- **The 500 kB chunk-size warning** `vite build` prints. It is pre-existing and
  informational; the build exits 0. Do not add `manualChunks` to silence it.

### Why ESLint and Prettier are out of scope

This was measured, not assumed, and the reasoning is recorded here so nobody
re-proposes it:

- **Zero tabs in `src/`.** `grep -rlP '\t' src/ | wc -l` → `0`.
- **Quote style already matches Prettier's `singleQuote: true` output rule
  exactly**: single quotes throughout, double quotes used only where the string
  contains an apostrophe and would otherwise need escaping. There are 156 such
  lines and every one is a learner-facing message quoting English —
  `"No conclusion found — capped at 6.0. Close with a one-sentence summary ('In conclusion, …')."`
  A Prettier run would change none of them.
- **Semicolons are already consistent**: 240 lines end in `;` inside
  `src/types.ts` (interface and type members, where TypeScript requires a
  separator); across all other `.ts`/`.tsx` files, `grep ';$'` matches 23 lines
  and **every one is prose inside a doc comment**, not a statement.
- **`eslint-plugin-react-hooks` would find nothing today.** `src/App.tsx` — the
  only component with meaningful hook usage — has 13 `useMemo`/`useEffect` calls
  and every one passes a dependency array.

So a Prettier rollout would rewrite 23,352 lines of `src/` to fix a problem that
does not exist, and would bury the next real diff under it. If a linter is ever
added, the case to make is a **correctness** rule
(`@typescript-eslint/no-floating-promises`, or a `no-restricted-syntax` ban on
`dateISO.localeCompare` — see `plans/019-one-date-comparator.md`), not a style
one.

## Git workflow

- Branch: `advisor/020-ci-typecheck-and-agent-entrypoint` (matches the repo's
  existing `advisor/NNN-slug` convention — see `git branch -a`).
- One commit per step is fine. Plain imperative subjects, matching `git log`.
- Do NOT push and do NOT open a PR. **Note**: the workflow you add will not run
  until someone pushes, which is the repository owner's call.

## Steps

### Step 1: Add the `typecheck` script

In `package.json`, add `typecheck` to `scripts`, placed after `build` so the
compile-shaped commands sit together:

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc --noEmit",
    "preview": "vite preview",
    "test": "vitest run",
    "test:engine": "vitest run --project engine",
    "test:ui": "vitest run --project ui"
  },
```

Why this matters and why it is `tsc --noEmit`: until now `tsc` ran **only**
inside `build`, so `npm test` could be green with a red compiler and there was no
command to run instead. `tsc --noEmit` and the build's `tsc -b` check the same
files, because `tsconfig.json` declares no project references — `--noEmit` is
simply the form that has no build-info side effects.

**Verify**: `npm run typecheck` → exit 0, no output.
**Verify**: `node -e "process.exit(require('./package.json').scripts.typecheck === 'tsc --noEmit' ? 0 : 1)"` → exit 0.

### Step 2: Pin Node

**2a.** Create `.nvmrc` containing exactly one line:

```
24.18.0
```

That is the version this repo is verified on (`node -v` at plan time).

**2b.** In `package.json`, add an `engines` block immediately after `"type": "module",`:

```json
  "engines": {
    "node": "^22.22.2 || ^24.15.0 || >=26.0.0"
  },
```

That range is **jsdom 30's own `engines.node`**, copied verbatim. jsdom is the
binding constraint: Vite 6 accepts `>=22.0.0` and Vitest 4 accepts `>=24.0.0`,
and jsdom's range is a subset of both. Node 20 satisfies Vite but **not** jsdom,
so a CI runner on Node 20 fails at install — which is exactly the failure this
pin exists to prevent.

**Verify**: `node -e "const e=require('./package.json').engines; process.exit(e && e.node ? 0 : 1)"` → exit 0.
**Verify**: `cat .nvmrc` → `24.18.0`.
**Verify**: `npm run typecheck && npx vitest run && npm run build` → all exit 0
(the `engines` field is advisory to npm by default; this confirms it changed
nothing locally).

### Step 3: Add the CI workflow

Create `.github/workflows/ci.yml`:

```yaml
# The gate this repo did not have.
#
# 48 commits, 11 of them merges, 21 branches pushed to the remote — a PR-shaped
# workflow where the only thing between a red suite and `main` was whether
# someone remembered to run it. The three checks below are the three commands a
# developer already runs, in the order that fails fastest and most informatively:
# a type error is a one-line report, a test failure names the behaviour, a build
# failure is usually neither.
#
# Cost, measured locally at ae92bac: typecheck 1.1s, tests 7.6s, build 1.5s.
# Roughly ten seconds of compute; the job is dominated by `npm ci`.
name: CI

on:
  # Every branch, not just main: this repo pushes named branches directly, so a
  # gate that only watched pull requests would watch nothing most of the time.
  push:
    branches: ['**']
  # And pull requests, so a PR from a fork (which the push trigger does not
  # cover) is still checked. A same-repo PR therefore runs this job twice. That
  # duplication is accepted deliberately: ten seconds of compute is a smaller
  # cost than an ungated branch.
  pull_request:

# A second push to the same branch makes the first run irrelevant. Cancel it
# rather than queue it.
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # node-version-file, not a hardcoded version: .nvmrc is the single place
      # the Node version is recorded, and jsdom 30 rejects Node 20 outright
      # (engines: ^22.22.2 || ^24.15.0 || >=26.0.0), so the default runner
      # version is not safe to rely on.
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm

      # `npm ci`, never `npm install`: it installs exactly what
      # package-lock.json says and fails if the lockfile and package.json
      # disagree. Reproducing the developer's tree is the only thing that makes
      # a green CI run mean anything.
      - run: npm ci

      - name: Typecheck
        run: npm run typecheck

      # Both vitest projects: `engine` (Node, no DOM) and `ui` (jsdom). The UI
      # suite was flaky before plan 007 and is now stable across ten consecutive
      # runs; if it ever flakes here, fix the flake rather than retrying the job.
      - name: Tests
        run: npm test

      # Last because it is the slowest to interpret when it fails, and because
      # `tsc -b` inside it is redundant with the typecheck above — what this
      # step actually proves is that Vite can bundle the app.
      - name: Build
        run: npm run build
```

**Verify**: `python3 -c "import yaml,sys; d=yaml.safe_load(open('.github/workflows/ci.yml')); print(sorted(d['jobs']['verify']['steps'][-1].keys()))"` → prints a list containing `name` and `run`.
**Verify**: `python3 -c "import yaml; d=yaml.safe_load(open('.github/workflows/ci.yml')); print([s.get('run') for s in d['jobs']['verify']['steps'] if 'run' in s])"` → `['npm ci', 'npm run typecheck', 'npm test', 'npm run build']`.

Fallback if `python3 -c "import yaml"` fails on your machine — check the four
commands are present and that the file has no tab characters (YAML forbids tabs
for indentation):

```bash
grep -c $'\t' .github/workflows/ci.yml   # expect 0
grep -n "npm ci\|npm run typecheck\|npm test\|npm run build" .github/workflows/ci.yml
```

You **cannot** verify the workflow actually runs from here — that needs a push,
which is out of scope. Say so in your report.

### Step 4: Write `CLAUDE.md`

Create `CLAUDE.md` at the repo root. This is the entry point an agent reads
before touching anything. Keep it to roughly 60–90 lines: it must be read in
full, every time, by a model with no other context.

It **points at** canon; it does not restate it. Anything copied from `SPEC.md`
will drift.

Required content, in this order:

1. **One paragraph on what this is**: an IELTS practice app. React 18 +
   TypeScript strict + Vite. **Pure client-side: `localStorage` only, no server,
   no network calls, no LLM anywhere in the product.** Every band, every issue
   and every piece of feedback is produced by deterministic rules in
   `src/analysis/`. State this plainly — an agent that assumes it may call a
   model will design the wrong thing.

2. **The verification commands, and what each one proves**, as a table:

   | Command | Proves |
   |---|---|
   | `npm run typecheck` | `src/` compiles under `strict`. **Does not cover `tests/`** — `tsconfig.json` includes only `src`. |
   | `npm test` | Both vitest projects: `engine` (Node, no DOM) and `ui` (jsdom). 848 tests / 24 files at `ae92bac`. |
   | `npm run test:engine` / `npm run test:ui` | One project each, when you only touched one. |
   | `npm run build` | `tsc -b` then a real Vite bundle. |

   Add the line: **a change is not done until all three of typecheck, test and
   build exit 0** — the same three CI runs.

3. **Where canon lives**, with the reason each is canonical:
   - `SPEC.md` — thresholds, rule inventory, band tables. The source of truth;
     if code and SPEC disagree, that is a bug in one of them and you must say
     which.
   - `DESIGN.md` — visual direction. Do not invent tokens.
   - `src/types.ts` — the shared contract. **`IssueCategory` ids are frozen**;
     they are persisted in `localStorage` and in exported JSON, so changing one
     silently invalidates a learner's saved history.
   - `plans/` — numbered implementation plans; `plans/README.md` is the index and
     carries the status of each.

4. **Read before proposing** — the section that pays for this file. A hard
   pointer to the two lists in `plans/README.md`:
   - **"Findings considered and rejected"** — seven decisions already made and
     argued, including *adding a chart library* (rejected: the two-runtime-dependency
     property is architectural) and *merging the two complexity-marker lists*
     (rejected: it moves the Structure Rail check and the band calibration at the
     same time). If your proposal is on that list, it needs a new argument, not a
     rediscovery.
   - **"Known limitations carried forward"** — thirteen entries, including one
     recording a fix that was tried, **measured, and reverted**. These are known,
     not overlooked.

5. **Do not refactor these, and why** — the reasoning that lives in source
   comments an agent may never open:
   - `src/analysis/complexity.ts` — there are deliberately **two**
     complexity-marker lists, both canonical in `SPEC.md`. Merging them moves the
     rail check and the band calibration anchors simultaneously. The reasoning is
     at `complexity.ts:1-25`.
   - `src/analysis/engine.ts:175-176` — a sort block duplicated from
     `analyzeEssay` on purpose: "analyzeEssay must stay byte-identical so the
     Task 2 regression tests mean what they say."
   - `src/analysis/rules/accuracy.ts:11` — "a false positive costs more than a
     miss." Guards err on the side of silence. A rule that accuses correct
     English is worse than a rule that misses an error, and
     `plans/006-stop-false-accusations.md` exists because that was once violated.

6. **House style, in a few lines**: TypeScript strict, no `any`; comments explain
   **why**, not what — module-level regexes and non-obvious constants carry a doc
   comment naming the SPEC rule they implement and the reasoning behind them;
   analysis modules are pure and synchronous; **no new runtime dependencies**
   (`react` and `react-dom` are the entire list, and that is an architectural
   property, not an accident).

7. **Working conventions**: branch `advisor/NNN-slug` off `main`; never commit to
   `main` directly; one session per plan; do not push or open a PR unless asked.

**Verify**: `test -f CLAUDE.md` succeeds.
**Verify**: `grep -c "SPEC.md" CLAUDE.md` → at least `1`.
**Verify**: `grep -c "plans/README.md" CLAUDE.md` → at least `1`.
**Verify**: `grep -c "npm run typecheck" CLAUDE.md` → at least `1`.
**Verify**: `wc -l < CLAUDE.md` → between 40 and 120.

### Step 5: Fix the README's omissions

Two small edits to `README.md`.

**5a.** In the "Run it" block (`README.md:150-156`), add the two missing
commands. The block becomes:

````
```bash
npm install
npm run dev
npm run typecheck   # tsc --noEmit over src/ — strict, and not covered by npm test
npm test            # everything
npm run test:engine # analysis + storage, Node, no DOM
npm run test:ui     # components, jsdom + Testing Library
npm run build       # tsc -b + a real Vite bundle
```
````

Then add one sentence below the existing paragraph about the two vitest
projects (which ends at `README.md:161`, "and drives it the way a learner
would."):

```
CI runs `typecheck`, `test` and `build` on every push and pull request
(`.github/workflows/ci.yml`); the Node version is pinned in `.nvmrc`.
```

**5b.** In the architecture list (`README.md:167-169`), add one line after the
`DESIGN.md` entry:

```
- `CLAUDE.md` — start here if you are an agent: the verification gate, what is canonical, and what has already been decided
```

**Verify**: `grep -c "npm run typecheck" README.md` → at least `1`.
**Verify**: `grep -c "npm run build" README.md` → at least `1`.
**Verify**: `grep -c "CLAUDE.md" README.md` → at least `1`.

### Step 6: Prove the gate is green before anyone relies on it

Run, in order, exactly what CI will run:

**Verify**: `npm run typecheck` → exit 0, no output.
**Verify**: `npm test` → 24 files, **848 tests**, all pass.
**Verify**: `npm run build` → exit 0.
**Verify**: `git status --porcelain -- . ':!plans/'` → only the five in-scope paths.
The `':!plans/'` exclusion is required: at this plan's baseline the tree already carries a
modified `plans/README.md` and ten untracked `plans/0NN-*.md` files, so a bare
`git status --porcelain` is never empty.

Then confirm the UI suite is genuinely stable, since CI will fail the whole job
on one flake:

```bash
for i in 1 2 3 4 5; do npx vitest run --project ui 2>&1 | grep -E '^\s+Tests\s+'; done
```

**Verify**: five identical lines, each `Tests  97 passed (97)`.

If any run differs, **stop**. Turning on a gate over a flaky suite is worse than
having no gate: it teaches everyone to re-run the job instead of reading it.

## Test plan

This plan adds no application code, so it adds no unit tests. Its correctness is
established by the commands themselves:

- **The `typecheck` script** is verified by running it (exit 0) and by asserting
  its exact value out of `package.json`.
- **The workflow** is verified by parsing the YAML and asserting the ordered list
  of `run` commands is exactly `['npm ci', 'npm run typecheck', 'npm test', 'npm run build']`.
  It cannot be verified end-to-end without a push; say so in your report.
- **The Node pin** is verified by asserting `.nvmrc` and `engines.node` exist,
  and by re-running the full gate locally to confirm nothing changed.
- **`CLAUDE.md`** is verified by the greps in step 4 — the pointers it must
  contain, and a length bound so it stays readable in full.
- **No regression**: the pre-existing 848 tests across 24 files must still pass
  unchanged. Nothing in this plan touches `src/` or `tests/`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run typecheck` exits 0 with no output
- [ ] `npm test` exits 0; 24 files, 848 tests
- [ ] `npm run build` exits 0
- [ ] `test -f .nvmrc && test -f CLAUDE.md && test -f .github/workflows/ci.yml` succeeds
- [ ] `node -e "process.exit(require('./package.json').scripts.typecheck === 'tsc --noEmit' ? 0 : 1)"` exits 0
- [ ] `node -e "process.exit(require('./package.json').engines.node ? 0 : 1)"` exits 0
- [ ] `python3 -c "import yaml; d=yaml.safe_load(open('.github/workflows/ci.yml')); assert [s.get('run') for s in d['jobs']['verify']['steps'] if 'run' in s] == ['npm ci','npm run typecheck','npm test','npm run build']"` exits 0
- [ ] `grep -c $'\t' .github/workflows/ci.yml` returns `0`
- [ ] `grep -q "plans/README.md" CLAUDE.md && grep -q "SPEC.md" CLAUDE.md` succeeds
- [ ] `grep -c "npm run typecheck" README.md` returns at least `1`
- [ ] `git diff --stat ae92bac..HEAD -- src/ tests/ SPEC.md DESIGN.md vite.config.ts tsconfig.json` is **empty**
- [ ] `git diff -- package-lock.json` is empty (no dependency added)
- [ ] `git status --porcelain -- . ':!plans/'` lists only: `package.json`, `.nvmrc`, `.github/workflows/ci.yml`, `CLAUDE.md`, `README.md`
- [ ] Five consecutive `npx vitest run --project ui` runs report `97 passed (97)` identically

## STOP conditions

Stop and report back (do not improvise) if:

- **`npm run typecheck`, `npm test` or `npm run build` is not green at step 6.**
  Do not commit a workflow that is red on arrival, and do not weaken a check to
  make it pass. Report which one failed and its output.
- **The UI suite is not identical across five runs.** Report the differing runs.
  Fix the flake first, or hand it back — do not add `retries` to the vitest
  config or `continue-on-error` to the job.
- **`package.json` scripts do not match the six quoted in "Current state".**
- **You are tempted to add `tests` to `tsconfig.json`'s `include`.** It produces
  29 errors across 6 files today. Report the count; do not fix them here.
- **You are tempted to add ESLint, Prettier, a `lint` script, or any dependency.**
  The measured rationale is in "Scope". Report the argument if you think it has
  changed; do not act on it.
- **A step needs a file outside the five in scope.**
- **`python3 -c "import yaml"` fails and the fallback grep check also cannot
  confirm the file.** Report rather than installing anything.

## Maintenance notes

For whoever owns this next:

- **Sequencing.** Land this **after** any plan currently in flight, or CI's first
  run will be red on someone else's half-finished branch. If plans 018 and 019
  are running in parallel sessions, this one goes last.
- **The one thing an executor cannot verify** is that the workflow runs. The
  first real proof is the first push. When that happens, check that
  `actions/setup-node` picked up `.nvmrc` (the log prints the resolved version)
  and that `cache: npm` actually hit — a cold cache makes the job feel far more
  expensive than the ten seconds of checks it contains.
- **Branch protection is deliberately not part of this plan.** It cannot be set
  from a commit. Once CI has run green a few times, the repository owner should
  make the `verify` job a required status check on `main` — that is the step that
  turns a signal into a gate.
- **The `tests/` typecheck gap is the obvious follow-up**, and it is worth doing:
  29 errors across 6 files, several of which are helpers reaching into
  `SessionRecord` without narrowing (`Property 'task' does not exist on type
  'SessionRecord'`) — exactly the class of mistake `src/types.ts:580-611` builds
  its `switch`/`never` guard to prevent in `src/`. The shape of the fix is a
  second config (`tsconfig.test.json` extending the root one with
  `"include": ["src", "tests"]`) and a `typecheck:tests` script, added only once
  the errors are actually fixed.
- **What a reviewer should scrutinise**: that `CLAUDE.md` *points at* `SPEC.md`
  and `plans/README.md` rather than restating them. A copied threshold is a
  future contradiction, and the whole value of this file is that an agent trusts
  it.
- **Keep `CLAUDE.md` short.** It is read in full on every task. When it grows past
  ~120 lines, the answer is a link, not another paragraph.
- **`.nvmrc` needs updating** whenever jsdom, Vite or Vitest raise their
  `engines.node`. jsdom is currently the binding constraint; check it first.
