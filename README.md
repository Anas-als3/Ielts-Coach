# IELTS Coach — Writing, Reading and Listening

A single-page web app that coaches one learner through IELTS Writing, Reading and Listening.
Not a grammar checker — an **examiner's eye**: IELTS-specific structural rules plus a
personal error profile tracked across every essay you write, so improvement is visible.

Three sections, scored on two different footings, and the app never blurs them. A **Writing**
band is a form-only estimate from rules that read shape, not meaning. A **Reading** or
**Listening** band is an answer key and a published conversion table — exactly right, and
labelled as such.

## Both exams

IELTS is two exams sharing a name: **Academic** for university entry, **General Training**
for migration and work. A switch in the topbar picks yours, and every saved session records
which exam it was written for. Task 2 is identical in both — same criteria, same 250 words,
same 40 minutes — so the marking never changes; what changes is the questions you are offered,
because General Training asks about everyday matters rather than abstract policy or research.
Task 1 is where they genuinely diverge: Academic describes a chart, General Training writes a
letter. Both are built, and each has its own engine — a letter is never marked with chart rules,
and the app keeps a separate question for each so switching exams does not lose your place.

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
- **General Training letters** — the greeting and the sign-off must pair ("Yours faithfully"
  goes only with "Dear Sir or Madam", "Yours sincerely" only with a name — reversing them is
  one of the most common marks lost in General Training), the greeting must match how formal
  the letter is, all three bullet points must be answered, and the opening must say why you
  are writing. Register is judged in both directions: slang in a letter to the council is a
  fault, and so is officialese in a letter to a friend — where, uniquely in IELTS Writing,
  "I can't wait to see you" is *correct* and the app stays quiet about it.

Band estimates are always shown as a range, labeled "rule-based estimate — not an examiner",
with the exact drivers listed per criterion.

## Reading — the one score that is exactly right

60 minutes, 40 questions, three sections, both exams. The passage is on the left and its
questions on the right, each scrolling on its own, with a 60:00 countdown that submits for
you when it runs out. Six question types are supported: True/False/Not Given, Yes/No/Not
Given, multiple choice, sentence completion (the word limit is printed, and going over it is
marked wrong exactly as in the real exam), matching headings and matching information.

**The Reading band is exact, not an estimate.** There is no heuristic anywhere in it: your
answers are marked against a key and the raw score is converted by the published table. The
report says so in as many words, and quotes the table row that produced your band. The two
exams convert differently, and the gap is large — 30 out of 40 is a band 7.0 in Academic and
a band 6.0 in General Training, roughly four more correct answers for the same band — so you
are only ever offered your own exam's papers, and each is marked with its own table.

The most useful part of the report is **accuracy by question type**, weakest first. "You lose
Not Given, you are fine on matching headings" tells you what to practise on Tuesday; an overall
band only tells you where you stand. Every question is then shown against the key, with where
the answer was found, and a filter to show only the ones you got wrong.

The papers are original: real IELTS passages are University of Cambridge copyright and cannot
ship in an app, so every passage here is prose written for this project, with its source and
licence recorded in the file.

## Listening — one paper, both exams, and an honest caveat about the voice

30 minutes and 40 questions across four sections that get harder as they go — an everyday phone
call, a monologue, a tutorial, then a lecture — followed by the exam's extra 10 minutes. Listening
is **identical in Academic and General Training**: same paper, same timing, same conversion table.
There is no exam type to pick in this section, and the app deliberately has no field to store one.

**The voice is your browser's, not a recording, and the app says so on every screen.** This is the
honest cost of a decision made in the open. The app has no server and no runtime dependency beyond
React; a set of real recordings would add roughly 25–30 MB per test to a 371 kB app, so the choice
was `window.speechSynthesis` — built into every modern browser, no bundled bytes, works offline.
Where a browser has no usable voice at all, the transcript is revealed line by line at speaking pace
instead, and the app tells you that the exercise has changed. The real test uses actors recorded in a
studio with British, Australian, North American and New Zealand accents, and **accents are part of
what it examines**. This trains the question types and note-taking. It does not train accents.

**Each section plays once, in order, and never again** — because that is what the real test does. A
practice that quietly allowed a second listen would report a band you will not reproduce on the day.
There is a **practice mode** that lifts the rule, chosen before the clock starts rather than mid-paper,
and a paper sat that way is labelled a practice run in your history and above the band in its report.
The words are never printed while a voice is speaking: reading along would be a different exam.

Five question formats: form, note and table completion, short answer, multiple choice, matching, and
plan labelling (described in words, since the app ships no images). The report breaks accuracy down
**by format, not by marking type** — matching and plan labelling are both marked as multiple choice,
so a type-keyed report would print one "multiple choice" row and hide the one you actually lose. Every
question is then shown against the key with **where the answer went past in the recording**, which is
the only way to find out what you missed when you cannot replay it.

The extra 10 minutes are kept, with the caveat stated: on a screen there is no answer sheet to copy
onto, so use them to check spellings, plurals and word limits. Practising a 30-minute Listening and
then sitting a 40-minute paper exam is rehearsing the wrong ending.

## The error profile

Every session stores per-category error rates (per 100 words). A recency-weighted average
(EWMA) picks your top three weaknesses; trends (improving / flat / worsening) come from the
slope of your recent sessions. The Progress page shows your band trend (exam sessions
emphasised), focus-area sparklines, and the full session history. Data lives in
localStorage — export/import it as JSON from the Progress page.

Reading and Listening sessions are saved alongside your essays but are deliberately **excluded**
from the writing error profile. An answer-key paper produces no writing errors, so counting one
would read as a flawless essay and quietly dilute every rate you are trying to bring down. Those
results have their own history lists in their own sections.

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
every figure quoted is real; Task 2 examples are hand-written, one per question type, and
letters are hand-written, one per tone. The tab never appears in Exam Mode.

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
- `src/prompts/bank.ts` — 40 Task 2 prompts with coverage metadata and the exam each suits
- `src/prompts/task1Bank.ts` — 12 Academic Task 1 charts, carried as data rather than images
- `src/prompts/letterBank.ts` — 15 General Training letters, five per tone
- `src/reading/` — Reading contracts, both raw-score→band conversion tables, and the
  authored papers (one per exam, 40 questions each, sources and licences in each file header)
- `src/listening/` — Listening contracts, the single conversion table, the speech layer
  (`speech.ts`: the driver interface, the browser synthesiser, the paced-transcript fallback and
  the test double), the headless play-once player, and one authored 4-section paper
- `src/marking/markAnswerKey.ts` — answer-key marking, shared by Reading and Listening. Neither
  section has any marking code of its own; each supplies only its conversion table
- `src/components/` — Editor (mirror-overlay highlighting), StructureRail, FeedbackPanel,
  Timer, Report, Dashboard, ReadingPicker, ReadingRunner, ReadingReport, ListeningPicker,
  ListeningRunner, ListeningReport

Saved data is `schemaVersion 5`. Every version is migrated forward on read and never
discarded — a store written by the very first build climbs every rung in a single read —
and anything this build cannot understand is copied to a timestamped backup key before the
live one is touched. The v4 → v5 rung changes no data: it only widens the `section` union to
admit `'listening'`, and no older record could have been a Listening paper.

`speechSynthesis` is a browser API, not a runtime dependency: `package.json` is still `react` and
`react-dom` and nothing else. Nothing under `src/listening/` touches a browser global at import
time, so the engine suite imports all of it in Node, and no test anywhere depends on a real speech
engine — `FakeSpeechDriver` has no timers, no globals and no randomness.
