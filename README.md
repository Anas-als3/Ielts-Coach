# IELTS Coach — Writing Task 2

A single-page web app that coaches one learner through IELTS Academic Writing Task 2.
Not a grammar checker — an **examiner's eye**: IELTS-specific structural rules plus a
personal error profile tracked across every essay you write, so improvement is visible.

## Two modes

- **Coach Mode** — live analysis as you type: inline highlights (examiner red = errors only),
  a Structure Rail that fills in as your essay takes shape, and a feedback panel with an
  honest band-range estimate. Errors you make repeatedly get a "recurring for you" badge
  and rise to the top.
- **Exam Mode** — the desk clears: 40:00 wall-clock countdown, paste blocked, spellcheck off,
  zero feedback. The full report appears at submit, including your pacing curve against a
  target pace and any paste attempts.

## What it checks (deterministic, offline, no AI calls)

- **Task Response** — effective word count (words copied verbatim from the prompt are
  deducted, as examiners do), question coverage by question type (opinion / discussion /
  problem-solution / advantages-disadvantages / double question), position statements,
  off-topic drift, overgeneralisation, personal anecdotes.
- **Coherence & Cohesion** — paragraph shape and balance, topic sentences, conclusion,
  linking-device overuse / underuse / repetition from a 97-phrase tagged lexicon.
- **Lexical Resource** — contractions, informal register with academic swaps, vague
  quantifiers, repetition (naive-stemmed, prompt words excluded), a memorised-phrase bank
  ("every coin has two sides" and friends).
- **Grammatical Range** — run-on sentences, choppy runs, complexity-marker variety,
  comma splices, hedging balance, section-aware first-person usage.

Band estimates are always shown as a range, labeled "rule-based estimate — not an examiner",
with the exact drivers listed per criterion.

## The error profile

Every session stores per-category error rates (per 100 words). A recency-weighted average
(EWMA) picks your top three weaknesses; trends (improving / flat / worsening) come from the
slope of your recent sessions. The Progress page shows your band trend (exam sessions
emphasised), focus-area sparklines, and the full session history. Data lives in
localStorage — export/import it as JSON from the Progress page.

Since patch v2 (calibrated against a real human-marked Band-6 essay) the engine also catches
sentence-mechanics errors: missing articles (token-walk over ~40 countable nouns), agreement
slips ("a random women", "prisoners are human being", -ing subjects), comma splices with
adverbs ("…, then he…"), fronted connectors missing their comma, sentence fragments,
capitalisation, "that" used for people, connector misuse ("meanwhile" for contrast) and wrong
collocations ("the key for"). It also checks essay shape (3-sentence intro, 2-sentence
conclusion, 4 complex sentences — one per paragraph) and flags a position that flips between
the introduction and conclusion; the report pairs that heuristic with a manual side-by-side
POSITION CHECK, because rules read form, not meaning — which is also why every band figure is
labeled "form-only estimate — your real band is likely this or lower."

A **Model answer** tab shows a worked example of the question on screen, together with the
band this app's own engine gives it and the structure checks it satisfies — so the target is
verifiable rather than asserted. Task 1 examples are generated from the chart's own numbers, so
every figure quoted is real; Task 2 examples are hand-written, one per question type. The tab
never appears in Exam Mode.

A one-page **cheat sheet** (format, sentence starters, comma rules, conclusion template,
complex-sentence patterns, pre-submit checklist) lives in a Feedback ⇄ Cheat sheet tab beside
the editor — Coach Mode only; it disappears with everything else under exam conditions.

## Run it

```bash
npm install
npm run dev
npm test            # everything
npm run test:engine # analysis + storage, Node, no DOM
npm run test:ui     # components, jsdom + Testing Library
```

The suite is split in two vitest projects. `engine` runs the pure analysis and
storage code in Node — keeping it there means nothing in the engine can quietly
start depending on a browser global. `ui` renders the real `<App />` in jsdom
and drives it the way a learner would.

## Architecture

React 18 + TypeScript (strict) + Vite. No runtime dependencies beyond React.

- `SPEC.md` — canonical thresholds and rule inventory (the source of truth)
- `DESIGN.md` — visual direction (exam-stationery aesthetic)
- `src/types.ts` — the shared contract; `IssueCategory` ids are stable across versions
- `src/analysis/` — tokenizer, rule modules, band estimator, engine
- `src/profile/` — localStorage store + profile/trend computation
- `src/prompts/bank.ts` — 40 Task 2 prompts with coverage metadata
- `src/components/` — Editor (mirror-overlay highlighting), StructureRail, FeedbackPanel,
  Timer, Report, Dashboard
