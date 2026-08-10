# CLAUDE.md

Start here before touching anything. This repo is built almost entirely by
agents; this file is the one page telling you what is canonical, what has
already been decided, and what you must not touch.

## What this is

An IELTS practice app: React 18 + TypeScript (strict) + Vite. **Pure
client-side** — `localStorage` only, no server, no network calls, and no LLM
anywhere in the product. Every band, every issue and every piece of feedback
is produced by deterministic rules in `src/analysis/` (regex + word lists +
arithmetic). Do not assume you may call a model to produce feedback — that is
the wrong design for this codebase.

## Verification commands

| Command | Proves |
|---|---|
| `npm run typecheck` | `src/` compiles under `strict`. **Does not cover `tests/`** — `tsconfig.json`'s `include` is `["src"]` only. |
| `npm test` | Both vitest projects: `engine` (Node, no DOM) and `ui` (jsdom). 853 tests / 24 files at this commit. |
| `npm run test:engine` / `npm run test:ui` | One project each, when you only touched one. |
| `npm run build` | `tsc -b` then a real Vite bundle. |

A change is not done until all three of typecheck, test and build exit 0 —
the same three checks CI runs on every push (`.github/workflows/ci.yml`).

## Where canon lives

- `SPEC.md` — thresholds, rule inventory, band tables. The source of truth; if
  code and SPEC disagree, that is a bug in one of them and you must say which.
- `DESIGN.md` — visual direction. Do not invent tokens.
- `src/types.ts` — the shared contract. **`IssueCategory` ids are frozen**;
  they are persisted in `localStorage` and in exported JSON, so changing one
  silently invalidates a learner's saved history.
- `plans/` — numbered implementation plans; `plans/README.md` is the index and
  carries the status of each.

## Read before proposing

`plans/README.md` carries two lists you must check before proposing anything:

- **"Findings considered and rejected"** — decisions already made and argued,
  including *adding a chart library* (rejected: the two-runtime-dependency
  property is architectural) and *merging the two complexity-marker lists*
  (rejected: it moves the Structure Rail check and the band calibration at the
  same time). If your proposal is on that list, it needs a new argument, not a
  rediscovery.
- **"Known limitations carried forward"** — including one entry recording a
  fix that was tried, **measured, and reverted**. These are known, not
  overlooked.

## Do not refactor these, and why

- `src/analysis/complexity.ts` — there are deliberately **two**
  complexity-marker lists, both canonical in `SPEC.md`. Merging them moves the
  rail check and the band calibration anchors simultaneously. Reasoning is at
  `complexity.ts:1-25`.
- `src/analysis/engine.ts:175-176` — a sort block duplicated from
  `analyzeEssay` on purpose: "analyzeEssay must stay byte-identical so the
  Task 2 regression tests mean what they say."
- `src/analysis/rules/accuracy.ts:11` — "a false positive costs more than a
  miss." Guards err on the side of silence. A rule that accuses correct
  English is worse than a rule that misses an error, and
  `plans/006-stop-false-accusations.md` exists because that was once violated.

## House style

TypeScript strict, no `any`. Comments explain **why**, not what —
module-level regexes and non-obvious constants carry a doc comment naming the
SPEC rule they implement and the reasoning behind them. Analysis modules are
pure and synchronous. **No new runtime dependencies** — `react` and
`react-dom` are the entire list, and that is an architectural property, not
an accident.

## Working conventions

Branch `advisor/NNN-slug` off `main`; never commit to `main` directly; one
session per plan; do not push or open a PR unless asked.
