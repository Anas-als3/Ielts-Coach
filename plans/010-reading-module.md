# Plan 010: Reading — both modules, real question types, real band conversion

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Update `plans/README.md` when done.
>
> **Drift check**: confirm plan 008 landed — `grep -c "export type Module" src/types.ts` returns 1.

## Status

- **Priority**: P2
- **Effort**: L (engine ~3 days; content is the real cost, see "The content problem")
- **Risk**: LOW for the engine, HIGH for content licensing
- **Depends on**: `plans/008-academic-general-module-switch.md`
- **Category**: direction
- **Planned at**: commit `b942572`, 2026-08-10

## Why this matters

Reading is the **best possible fit for this architecture**, and for a reason
worth stating plainly: it needs no natural-language analysis at all. A Reading
test is an answer key. Raw score → band conversion is a lookup table. There is no
heuristic, no false positive, no "form-only estimate" caveat — the app can tell a
learner their exact Reading band with the same authority as the real exam.

That makes it the only section where this app can be *exactly right* rather than
*approximately right*, which is worth a great deal for a product whose Writing
scores must always be hedged.

It also matters for the Academic/General split. The two modules use **different
conversion tables**, and General Training is markedly stricter:

| Band | Academic (raw/40) | General Training (raw/40) |
|---|---|---|
| 9.0 | 39–40 | 40 |
| 8.5 | 37–38 | 39 |
| 8.0 | 35–36 | 37–38 |
| 7.5 | 33–34 | 36 |
| 7.0 | 30–32 | 34–35 |
| 6.5 | 27–29 | 32–33 |
| 6.0 | 23–26 | 30–31 |
| 5.5 | 19–22 | 27–29 |
| 5.0 | 15–18 | 23–26 |
| 4.5 | 13–14 | 19–22 |
| 4.0 | 10–12 | 15–18 |

A General Training candidate needs roughly **four more correct answers** for the
same band. Getting this wrong in either direction misleads the learner about
their readiness, so the tables are canonical data and belong in SPEC.md.

Sources: [IELTS scoring in detail](https://www.ielts.org/take-a-test/your-results/ielts-scoring-in-detail),
[raw-score conversion tables](https://typogrammar.com/ielts/reading-raw-score-to-band-conversion/).

## The content problem — read this before starting

**The engine is a few days. The content is the project.** A single Reading test
is 3 passages (~2,200 words total) plus 40 questions with an answer key.

The user suggested sourcing tests from `ieltsonlinetests.com`. **Do not scrape or
copy that site's test content.** Its passages and question sets are largely
reproductions of Cambridge IELTS material, copyright University of Cambridge
(UCLES); republishing them in this app would be infringement, and the app is
outward-facing. That is a legal problem, not a stylistic preference.

What is legitimate and should be done instead:

1. **Use the site as a format reference** — question types, section structure,
   instruction wording, timing. Formats are not copyrightable.
2. **Author original passages**, or source them from genuinely public-domain and
   open-licensed material: Wikipedia (CC BY-SA, needs attribution), Project
   Gutenberg (public domain), NASA/NOAA/government publications (public domain),
   PLOS and other CC-BY journals. Academic Reading passages are science, history
   and social-science expository prose — public-domain sources cover this well.
3. **Write the question sets yourself** against those passages.

Budget honestly: an experienced item-writer takes **4–6 hours per passage** with
its 13–14 questions. A single complete test is roughly a day and a half. Ship
**one complete test per module** first and validate the format before authoring
more.

## Question types to support

These are the real IELTS Reading types. Support the first six in v1; they cover
roughly 80% of real papers.

| Type | Answer shape | v1? |
|---|---|---|
| True / False / Not Given | one of 3 | yes |
| Yes / No / Not Given | one of 3 | yes |
| Multiple choice (single) | one of 4 | yes |
| Sentence / summary completion | short text, ≤3 words | yes |
| Matching headings | heading id per paragraph | yes |
| Matching information | paragraph letter per statement | yes |
| Matching features | feature id per statement | later |
| Short answer | short text | later |
| Diagram / map labelling | label per position | later |

**Marking rules that matter**: answers are case-insensitive; a word-limit
("NO MORE THAN THREE WORDS") is enforced and exceeding it is wrong; British and
American spellings are both accepted; a set of acceptable alternatives per item
is required (`["car", "automobile"]`); there is no partial credit and no penalty
for a wrong answer.

## Scope

**In scope**:

- `src/types.ts` — `ReadingTest`, `ReadingPassage`, `ReadingQuestion` (a
  discriminated union on `type`), `ReadingAttempt`, `ReadingResult`
- `src/reading/bandTable.ts` — both conversion tables + `rawToBand(raw, module)`
- `src/reading/mark.ts` — pure marking: `markReading(test, answers) → ReadingResult`
- `src/reading/tests/` — authored content, one file per test
- `src/components/ReadingRunner.tsx` — passage pane + question pane + 60:00 timer
- `src/components/ReadingReport.tsx` — score, band, per-question review, per-type accuracy
- `src/App.tsx` — a Reading section alongside Writing
- `src/types.ts` `SessionRecord` — a Reading session variant (**schemaVersion 4**)
- `tests/reading-marking.test.ts`, `tests/reading-bands.test.ts`, `tests/ui/reading.test.tsx`
- `SPEC.md`, `README.md`

**Out of scope**:

- Any content copied from a third-party test site.
- Listening (plan 011) — it shares the marking model but has its own content problem.
- Adaptive difficulty or question recommendation.

## Steps

1. **Types.** `ReadingQuestion` is a discriminated union on `type`; each variant
   carries `id`, `prompt`, `answer` (or `answers` for alternatives), and
   type-specific fields (`options` for MCQ, `maxWords` for completion). Model the
   union on how `Task1Chart` handles its `kind`.
2. **Band tables.** `src/reading/bandTable.ts` with both tables as data, exactly
   as printed above, plus `rawToBand(raw: number, module: Module): number`.
   Clamp 0–40; below the lowest listed row returns the floor band. This module
   must be pure and trivially testable.
3. **Marking.** `markReading(test, answers)` returns per-question correctness,
   raw score, band, and a per-question-type breakdown. Normalisation:
   trim, collapse whitespace, lowercase, strip surrounding articles for
   completion answers, accept any listed alternative, reject over the word limit.
   **Never** mark a blank as correct.
4. **Content: one Academic test.** 3 passages from public-domain sources, 40
   questions across the six v1 types. Record each passage's source and licence in
   the file header. Attribute CC BY-SA material as its licence requires.
5. **Content: one General Training test.** GT structure differs: section 1 is
   two or three short social/notice texts, section 2 is two workplace texts,
   section 3 is one longer general-interest text. Same 40 questions.
6. **Runner UI.** Split pane, passage left and questions right, 60:00 countdown
   reusing the existing `Timer`. Answers held in component state and persisted on
   submit only. Highlighting the passage is a nice-to-have — defer it.
7. **Report.** Raw score, band (from the module's table), every question with the
   learner's answer against the key, and **per-question-type accuracy** — that
   last one is the coaching value, because "you lose Not Given, you are fine on
   matching headings" is actionable in a way an overall band is not.
8. **Persistence.** `SessionRecord` needs a Reading variant. Prefer a
   discriminated union on a `section: 'writing' | 'reading'` field over making
   every writing field optional. This is **schemaVersion 4** — append a rung to
   `migrateSessions` stamping `section: 'writing'` on existing records. Re-read
   plan 001 before touching that file.
9. **Profile.** Reading produces no `IssueCategory` issues, so `computeProfile`
   must skip Reading sessions rather than treat them as clean writing. Verify
   `categoryAppliesTo` is not silently counting them.
10. **Tests.** Every band boundary in both tables (a table-driven test over all
    41 raw scores × 2 modules); marking normalisation cases (case, whitespace,
    alternatives, word limit, blank); one end-to-end run of the authored test
    scoring a known band; UI: timer, navigation, submit, report.

## Done criteria

- [ ] `rawToBand` is exhaustively tested for 0–40 in both modules (82 assertions)
- [ ] One complete Academic and one complete GT test exist, each with 40 questions
- [ ] Every passage file header records its source URL and licence
- [ ] `grep -rn "ieltsonlinetests" src/` returns no matches
- [ ] schemaVersion 4 migration tested, including the v1→v4 chain
- [ ] `npx vitest run` and `npm run build` both clean

## STOP conditions

- You are about to copy passage or question text from a third-party site. Stop.
- A public-domain passage cannot be found at the right difficulty — report it;
  authoring original prose is acceptable and may be faster.
- The `SessionRecord` union change ripples into more than ~6 files. Report the
  blast radius before continuing; it may be better to introduce a separate
  `ReadingSessionRecord` and a top-level union.

## Maintenance notes

- **The band tables are canonical data.** Put them in SPEC.md too. If IELTS
  publishes a revision, that is the single place to change.
- **Per-type accuracy is the differentiator.** Once several tests exist, the
  error profile can extend to Reading question types, and the drill loop
  (plan 014) can serve "10 Not Given questions" — that is the real product.
- The 60-minute timer has no per-section breaks in Reading; unlike Listening
  there is no transfer time.
