# Implementation Plans

Four rounds so far:

- **001–005** — 2026-08-05. All DONE and merged.
- **006–014** — 2026-08-10, from a six-dimension audit (26 findings survived
  adversarial refutation, 10 killed) plus a gap analysis against the full exam.
  All DONE except 012 (deferred), 013 and 014.
- **015–024** — 2026-08-10, second `/improve` pass over the merged result.
  All DONE and merged 2026-08-10/11.
- **025–032** — 2026-08-10, UX/direction audit (four lenses: learner journey,
  retention, platform/accounts, competitive) at baseline `d4ddef8`, plus the
  user-reported Listening voice defect. All DONE and merged 2026-08-11.

**Campaign complete (2026-08-11)**: every plan 001–033 except the deferred 012
is DONE. Plan 033 (writing templates — user-requested, planned and executed
2026-08-11 at `1e4559b`) added the Template coach tab: 15 original skeletons
filtered to the desk's question type, with live paragraph progress. Plan 034
(same day) upgraded every template to fill-in-the-blank sentence frames with
styled slots — engine-verified wording (purpose and overview markers match
the rules), variation built in across each type's two templates. Plan 035
(same day, on user feedback) made every frame a full flowing paragraph with
context around each slot, plus a complete worked example per section on one
running topic per template, with a show/hide toggle — all 120 content strings
machine-verified against the engine before writing. Final state at `edf34ca`: **1,453 tests / 51 files**, typecheck covers
`src` + `tests`, CI green, entry chunk **462.00 kB raw / 147.50 kB gzip** with
7 lazy chunks (was one 712.52 kB chunk pre-split). Two original papers per
Reading module and two Listening papers shipped alongside the plans.

**Repo**: https://github.com/Anas-als3/Ielts-Coach (private)
**Baseline for 015–024**: commit `ae92bac` · 23,292 lines of source · 848 tests.

**Parallel sessions: one branch each, off `main`.** Branch names are in each
plan's Git workflow section. Do not work on `main` directly, and do not have two
sessions on the same plan.

## Execution order & status

### Round four — 025–032, all DONE (baseline `d4ddef8`)

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| **025** | **Draft safety — no work in progress dies silently** | **P0** | M | — | DONE |
| 026 | Small honest fixes — 100/150 gate, mode tooltips, intro card, title | P2 | S | — | DONE |
| 027 | Goals & readiness — exam date, target band, persisted exam type | P1 | M | 026 (prefs key, soft) | DONE |
| 031 | Portability pack — merge-import, tombstones (v6), dated exports | P1 | M | **016** | DONE |
| 032 | Listening voice quality — ranked voices now, authoring-time audio next | P1 | M+L | — | DONE |
| 028 | Listening tapescript in the report | P2 | S | — | DONE |
| 029 | Model-answer library | P2 | M | — | DONE |
| 030 | Teach the bands — descriptors, Task 1 sheets, question technique | P2 | L (3 phases) | — | DONE |

**Concurrency rules for this round**: 025, 026, 027 and 029 all add UI to
`App.tsx` — run them sequentially (rebase order in each plan), and none of them
concurrently with 023. 028 touches only the Listening report and can run beside
the App.tsx line, but **028 lands before 030** (Phase C edits the same
component). **032 lands after 026 AND 027** — it extends the prefs module they
create, and its Prong B wiring touches `App.tsx:221`. 031 touches the store and
Dashboard — after 016, not beside 019 or 017's Dashboard work. 026 defines the
`'ielts-coach.prefs.v1'` key that 027 and 032 extend additively.

### Round three — 015–024, all DONE

Ordered by leverage. **015 first**: it is the only one a learner can see.

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| **015** | **Letter false accusations, round two — 3 confirmed regressions** | **P0** | M | — | DONE |
| 016 | Store durability — quota, backup growth, silent data loss | P1 | M | — | DONE |
| 020 | CI + typecheck gate + agent entrypoint | P1 | S | — | DONE |
| 024 | Bring `tests/` under the typechecker (29 errors) | P1 | M | 020 | DONE |
| 021 | Kill the vacuous tests — 11 mutations the suite does not catch | P1 | M | — | DONE |
| 017 | Progress page for all three sections | P1 | M | — | DONE |
| 022 | Answer-key linter for Reading + Listening content | P2 | M | — | DONE |
| 019 | One date comparator, used everywhere | P2 | S | — | DONE |
| 023 | Code-split the sections | P2 | M | — | DONE |
| 018 | Bound the whitespace regex (quadratic on pathological input) | P3 | S | — | DONE |

### Rounds one and two — 001–014

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 001 | Make a schemaVersion bump non-destructive; add `task` | P1 | S | — | DONE |
| 002 | Single-source the complexity markers | P2 | S | — | DONE |
| 003 | Task 1 data model, prompt bank, SVG chart | P1 | M | 001 | DONE |
| 004 | Task 1 analysis pipeline | P1 | L | 003 | DONE |
| 005 | Wire Task 1 into the app | P1 | M | 004 | DONE |
| 007 | Deflake the UI suite; grade the worked answer against its own prompt | P0 | S | — | DONE |
| 006 | Stop the engine accusing correct English — five guards + golden corpus | P0 | M | — | DONE |
| 008 | Academic / General Training module switch | P1 | M | — | DONE |
| 009 | General Training Task 1 — letters | P1 | L | 008 | DONE |
| 010 | Reading — both modules, real question types, real band tables | P2 | L | 008 | DONE |
| 011 | Listening — marking is easy, audio is the project | P3 | L | 010 | DONE |
| 014 | Make the error profile do something — the drill loop | P1 | M | 006, 015 | DONE |
| 013 | Full mock test mode | P2 | M | 010, 011 | DONE |
| 012 | Speaking — the honest deterministic slice | P3 | M | 008 | DEFERRED — user descoped 2026-08-10; Writing/Reading/Listening first |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (one-line reason) | REJECTED.

## Dependency notes

- **024 depends on 020.** 020 turns CI on; 024 lands 29 pre-existing type errors.
  Doing both at once makes the first CI run red for reasons unrelated to CI, and
  the natural response to that is to weaken the gate. 020 green first, then 024.
- **014 now also depends on 015.** Drilling a learner on a false positive teaches
  them to write incorrect English. 006 fixed the essay rules; 015 fixes the
  letter rules, and 014 would drill both.
- **013 depends on 010 and 011.** A mock sitting needs Reading and Listening.
- **021 coordinates with 015 and 016** rather than depending on them. It adds the
  tests that would have caught their bugs, and item 021-e overlaps 015's letter
  fixtures — whichever lands second rebases onto the other. 021 touches **only**
  `tests/`, so it can never conflict on source.
- **015, 016, 017, 018, 019, 021, 022, 023 are otherwise mutually independent**
  and can run in parallel sessions. The only near-collision is 016 and 019 both
  reading `src/profile/store.ts`, in different functions.
- **023 before 013.** A mock sitting loads all three sections at once; splitting
  them afterwards means re-doing the Suspense boundaries around the mock runner.

## What the second audit found

Every claim below was reproduced through the real pipeline at `ae92bac` before
being written down. **The first three are regressions in round two's own
fixes** — plan 009 landed the letter rules and plan 006's follow-up hardened
them, and each hardening opened a new false positive.

### The letter engine still accuses correct English — plan 015

| Learner writes (correct) | App says |
|---|---|
| A short line before `Yours sincerely,` | `gt-signoff-pairing` — reads the body line as the sign-off |
| `Dear Mr Hughes and Mrs Hughes,` | `gt-salutation-missing` |
| One `can't` in an informal letter | reported **twice**, band charged twice |
| One `guys` in an informal letter | reported **twice**, band charged twice |

Same failure mode plan 006 was written for, in the module plan 006 did not
cover. `src/analysis/rules/accuracy.ts:11` states the standard: a false positive
costs more than a miss.

### The store loses data quietly — plan 016

- `writeStore` (`src/profile/store.ts:446-458`) swallows a quota failure into a
  `console.warn`. `saveSession` returns `void`, so the app cannot tell the
  learner their essay was not saved — and it renders as if it were.
- The per-section cap allows 200 writing + 400 answer-key records: **6.23 MB
  worst case** against a typical ~5 MB origin quota.
- `backupRaw` mints a timestamped key on every migration and **nothing ever
  removes one** — there is not a single `removeItem` call in `src/`.

### Progress is a Writing-only page — plan 017

Reading and Listening results are persisted, then not shown. `App.tsx:1136`
passes `sessions={writingSessions}`, so a learner who has sat two Reading papers
and a Listening test still sees "Write your first essay and your profile starts
here."

### `tests/` is never typechecked — plan 024

`tsconfig.json` ends `"include": ["src"]`. Measured: **29 type errors across six
test files**, including fixtures missing `Task1Chart.subject` — fixtures
asserting against a shape the app can no longer produce.

### Two date comparators disagree — plan 019

`src/profile/profile.ts:87` still carries the comment "ISO-8601 date strings
sort correctly as text" beside a text sort, while `store.ts:202` parses to a
number. `App.tsx:641` picks the previous session by string comparison. They
agree on well-formed UTC data and diverge on anything imported with an offset.

### Tests that pass whatever the code does — plan 021

`tests/store.test.ts:829` ("does not mint a second backup of a payload it has
already copied") is green **whether or not** the guard at
`src/profile/store.ts:354` exists: the three `loadSessions()` calls land in the
same millisecond, so their ISO-timestamped backup keys overwrite each other and
only one key is ever counted. That is the **third** vacuous test this repo has
produced, which is why the plan treats the recurrence as the finding.

Eleven mutations survive the suite in total. One found by reading rather than
running: `SIGNOFF_TAIL_LINES_MAX` 4→3 passes today, because the existing tests
cover a one-note tail and a three-note tail, and the case that distinguishes the
two values is exactly **two** note lines — which nothing tests.

Plan 021 modifies **no source file**. Every mutation is applied temporarily
under a stated protocol and reverted; `git status --porcelain src/` being empty
is one of its done criteria.

### The answer keys under-accept correct answers — plan 022

Learners lose marks for writing a correct answer in an ordinary alternative
form. The fix is a linter that generates number/unit/time renderings and asks
the **real marker** whether the key already accepts each one — so it can never
drift from `isAccepted`'s case-folding and article rules. It runs at test/build
time only and never enters the app bundle
(`src/marking/markAnswerKey.ts:12-15` is the boundary it quotes).

Spelling and hyphenation equivalence is refused deliberately: a wrong guess
there **over**-scores, which is worse than the under-scoring being fixed.

### One 623 kB chunk — plan 023

Every learner downloads Reading, Listening and Writing to use any one of them.
The plan's structural point is that `React.lazy` on the six leaf components
moves **nothing**, because `App.tsx` holds ten registry call sites including
synchronous `useMemo`s at `:179-214` and markers at `:487`/`:544`. A
behaviour-preserving `ReadingSection` / `ListeningSection` extraction has to
land first, as its own commit. Module evaluation (0.47/0.49 ms) is not the
cost — transfer and parse are.

### Quadratic regex on pathological input — plan 018

`SPACE_BEFORE_COMMA_RE = /\s+,/g` (`accuracy.ts:60`). Measured: 40k spaces →
**556 ms**; bounded `/\s{1,12},/g` → **0.8 ms**. Reachable by paste, and the
analyser runs on a 400 ms debounce while the learner types.

## What the UX audit found (round four, verified at `d4ddef8`)

Four parallel lenses: learner journey, retention/coaching, platform/accounts,
competitive. Every claim below was verified against the live code before a plan
was written.

### Work in progress dies silently — plan 025

`essayText` is `useState` only (`App.tsx:122`); the only localStorage writer in
`src/` is the session store, on submit. No `beforeunload` anywhere. Coach-mode
task/module toggles clear a non-empty sheet with no confirm (`App.tsx:413`,
`:460`). Timer expiry auto-submits a blank paper both manual paths refuse
(`App.tsx:271-274` vs `:282`, `:832`).

### The panel contradicts its own numbers — plan 026

Task 1 copy says "estimates unlock at 100 words" while the gate is hardcoded
`< 150` (`FeedbackPanel.tsx:86` vs `:103`); the engine really assesses from 100
(`task1BandEstimate.ts:36`). Plus: no first-run explanation of Coach vs Exam or
the module toggle, and the tab title still says "Writing Task 2".

### The app knows nothing about the learner — plan 027

The store is `{schemaVersion, sessions}` and nothing else; the module resets to
Academic every visit (`App.tsx:109`). No exam date, no target band — the two
facts every IELTS candidate has. Gap display, not forecasting: the form-only
estimate cannot honestly extrapolate a date.

### The best content is withheld — plans 028, 029, 030

The Listening report never renders the tapescript its props already carry (zero
`transcript` hits in `ListeningReport.tsx`). Worked answers render at exactly
one site, mid-writing (`App.tsx:1035-1041`) — 5 of 40 Task 2 prompts and 3 of
15 letters have exact models, all Task 1 charts generate one. And the app
scores four criteria it never teaches: no band descriptors, no Task 1 phrase
sheets (the cheat-sheet tab is deliberately Task 2-only, `App.tsx:620-622`),
no question-type technique.

### Import is replace-only and deletes leave no trace — plan 031

`importData` replaces the store outright (`store.ts:513-567`) though it already
dedups by id; `deleteSession` leaves no tombstone (`:476-481`), so any future
merge resurrects deletions. Exports are undated with a constant filename. The
serverless fix (merge + tombstones + self-describing exports) is byte-for-byte
the merge a future account sync would need — accounts themselves stay deferred.

### The voice picker takes the platform's worst voice — plan 032

`pickVoice` (`speech.ts:223-237`) is first-match-by-language; platforms list
legacy robot voices first. It also ignores the 8 speakers' gender/pitch hints,
so every speaker is the same voice. User-reported as "horrendous"; the plan
ranks voices by quality markers, differentiates speakers, and pipelines
authoring-time neural audio as static assets (runtime TTS APIs are rejected —
a client-only app cannot keep an API key secret).

### Deferred, not rejected

- **Mobile coach loop collapse** (below 980px the feedback panel sits under a
  55vh editor + full rail — `App.css:312-324`, `Editor.css:10`): the finding is
  CSS-derived, not device-tested. Verify on hardware before planning a fix.

## Gap analysis against the full exam

| Section | Academic | General Training | Plan |
|---|---|---|---|
| Writing Task 1 | ✅ charts | ✅ letters | 009 |
| Writing Task 2 | ✅ | ✅ same engine, 28 of 40 prompts tagged GT-appropriate | 008 |
| Reading | ✅ one paper, 6 question types | ✅ one paper, stricter band table | 010 |
| Listening | ✅ one paper, 7 formats, synthetic voice | ✅ the identical paper — no branching anywhere | 011 |
| Speaking | ❌ | ❌ (identical to Academic) | 012 (deferred) |
| Full mock sitting | ❌ | ❌ | 013 |

### Academic vs General Training — what actually differs

| Section | Academic | General Training |
|---|---|---|
| Writing Task 1 | Describe a chart, graph, table or process | **Write a letter** (formal / semi-formal / informal) |
| Writing Task 2 | Essay | Essay — **identical marking**, everyday topics |
| Reading | 3 long academic passages | 3 sections: short social/workplace texts, then one long text |
| Reading band | 30/40 → 7.0 | **34–35/40 → 7.0** (~4 more correct for the same band) |
| Listening | Identical | Identical |
| Speaking | Identical | Identical |

Both Reading conversion tables are printed in full in plan 010 and are in
SPEC.md ("Reading") as canonical data, alongside `src/reading/bandTable.ts`.

## Content sourcing — read before authoring any new paper

The suggestion to source tests from `ieltsonlinetests.com` **cannot be followed
as stated.** That site's passages and question sets are largely reproductions of
Cambridge IELTS material (copyright UCLES). Copying them into this app would be
infringement, and the app is outward-facing.

What is legitimate:

1. Use the site as a **format reference** — question types, section structure,
   instruction wording, timing. Formats are not copyrightable.
2. Author original passages, or use genuinely open sources: Wikipedia (CC BY-SA,
   attribute), Project Gutenberg (public domain), NASA/NOAA/government
   publications (public domain), PLOS and other CC-BY journals.
3. Write the question sets yourself against those passages.

Budget: ~4–6 hours per passage with its 13–14 questions; ~1.5 days per complete
test. One test per module ships today; validate the format before authoring more.

## Findings considered and rejected

So nobody re-audits these.

**Round four (2026-08-10, UX audit):**

- **Runtime TTS API for the Listening voice** — the voices are good, but a
  static client-only app cannot keep an API key secret: any key in the bundle
  is public and will be abused, and the proxy that hides it is the server this
  product deliberately does not have. Plan 032 uses the same APIs at
  AUTHORING time instead, committing the generated audio as static assets.
- **Accounts/login first** — deferred, not refused. Plan 031 ships the
  serverless 80% (merge, tombstones, portable exports); a backend after that is
  weekend-scale, but it spends the "no server" moat and makes the maintainer a
  custodian of user data. Build it when a second device is a proven need.
- **Async store rewrite to "prepare" for sync** — rejected again (first
  rejected in round three): it ripples through every runner and test for a
  backend that may never ship. A future remote is a replicator beside the sync
  store, not an adapter behind it.
- **Band forecasting ("you will reach 7.0 by March")** — the form-only estimate
  cannot honestly extrapolate; plan 027 shows the gap to target instead.
- **Voice-gender inference from platform voice names** — locale-dependent and
  wrong often enough to be worse than the pitch differentiation plan 032 uses.

**Round three (2026-08-10, second pass):**

- **`localStorage` → IndexedDB** — a real quota fix, but it makes every read
  async and would ripple through `App.tsx`, every runner and every test. Plan
  016 takes eviction + an honest failure signal instead, which fixes the
  learner-visible problem at a fraction of the blast radius.
- **A `ReadingSessionRecord` / `ListeningSessionRecord` split into separate
  stores** — the discriminated union on `section` already works and is tested;
  splitting it would fork the migration ladder three ways.
- **Debounce the analyser harder instead of bounding the regex** — treats the
  symptom. The quadratic pattern stays reachable, just later.
- **Rewriting the sign-off detector as a parser** — plan 015 keeps the
  line-scanning approach and fixes the three specific misreads; a parser is a
  larger change with its own new failure modes, on rules that are 95% right.
- **Extracting a shared `<SessionTable>` from Dashboard, Reading history and
  Listening history** — three views with three different column sets; the
  abstraction would carry more configuration than the duplication costs.
- **Teaching the answer-key linter spelling and hyphenation equivalence**
  (`organise`/`organize`, `car park`/`car-park`) — refused in plan 022. Every
  other class it generates is decidable; this one is a guess, and a wrong guess
  makes the marker accept a wrong answer. Over-scoring a learner is worse than
  the under-scoring the plan exists to fix.
- **`React.lazy` on the six leaf section components** — plan 023 shows this
  moves nothing out of the main chunk while `App.tsx` still holds ten
  synchronous registry references. Anyone proposing it again should read
  023's step 1 first.
- **Service worker / offline install** — the app is already fully client-side
  and works offline once loaded; a manifest buys an install prompt, not
  capability, and adds a cache-invalidation failure mode.

**Rounds one and two (still standing):**

- **`complex-count` requiring one marker per paragraph** — working as specified
  (SPEC.md Patch v2 C5); the per-paragraph requirement is deliberate.
- **Extending `Criterion` to five members** — IELTS marks one slot under two
  names ("Task Response" / "Task Achievement"); a fifth member would push
  `Partial<Record<…>>` through the estimator and every view for nothing.
- **Widening `RuleFn` for Task 1** — would ripple through six modules so four
  could ignore it.
- **Adding a chart library** — "no runtime dependencies beyond React" is a
  stated architectural property.
- **Task 1 map questions** — a map cannot be expressed as `categories × series`.
- **Merging the two complexity-marker lists** — both are canonical; merging moves
  the rail check and the band calibration simultaneously.
- **10 further round-two findings** were killed by the refutation pass as
  speculative, already fixed, or documented tradeoffs.

## Known limitations carried forward

- **The band trend chart mixes tasks** (a caption discloses it; the real fix is
  two series or a filter).
- **No Task 1 cheat sheet** — `CheatSheet.tsx` is Task 2 content and is hidden
  in Task 1 rather than replaced.
- **`Report.tsx` (719 lines) and `Dashboard.tsx` (466) have no component tests.**
- **Reading and Listening ship ONE paper each per module.** Plan 010 said to
  validate the format before authoring more, and that is where it stands. A
  learner who sits both has nothing new to sit; the second paper is the next
  content job, not an engine job.
- **Reading passage highlighting was deferred**, as plan 010 allows. Real
  candidates annotate the passage; this runner does not let them.
- **The Listening voice is synthetic, and accents are untrained.** Plan 011's
  option B: `window.speechSynthesis` costs no bundled bytes and no dependency,
  where real recordings would be 25–30 MB per test. The trade is that the real
  exam's British / Australian / North American / New Zealand accents are part of
  what it examines and this practice cannot reproduce them. Both the picker and
  the runner say so in the exported `SYNTHETIC_VOICE_NOTICE`; the fix, if it is
  ever worth it, is bundled audio, not better prompting of a browser voice.
- **Section 3's overlapping speakers are sequential.** The real exam's
  educational conversation has speakers interrupting each other; a synthetic
  voice takes one turn at a time. Plan 011 named this cost up front.
- **The "Coach" wordmark is briefly illegible while the desk clears.**
  Pre-existing, shared by writing exam mode and the Reading runner. `.topbar`
  crossfades its background over 400ms while `.brand em` snaps to its near-white
  exam colour on frame one — measured in Chromium at **1.02:1 contrast at 0ms**,
  1.5:1 at 60ms, reaching 11.6:1 only once the bar has darkened. A
  `transition: color 400ms` was tried and **reverted**: it fixes frame one
  (5.8:1) but any crossfade from dark-on-light to light-on-dark must pass
  through equal luminance, and it measurably *lengthened* the sub-3:1 window
  (≈140ms → ≈210ms). The real fix is to fade the wordmark's opacity out and back
  in so the colour swaps while it is invisible — a change to the DESIGN.md
  "clearing the desk" signature moment, belonging to whoever owns that.
  Cosmetic and transient; the readouts beside it all measure 12.55:1.

## Bundle size

Rebuilt at `ae92bac` on 2026-08-10. **These are the numbers to compare against**
— the "with Listening" column below was measured on plan 011's branch before it
merged, and drifted by the time `ae92bac` existed.

| | Baseline `7e471c6` | Plan 011 branch | **Measured at `ae92bac`** |
|---|---|---|---|
| JS | 484.35 kB (154.30 kB gzip) | 554.75 kB (172.44 kB gzip) | **559.90 kB (174.03 kB gzip)** |
| CSS | 55.16 kB (10.44 kB gzip) | 68.58 kB (11.58 kB gzip) | **68.71 kB (11.59 kB gzip)** |
| Total | 539.51 kB (164.74 kB gzip) | 623.33 kB (184.02 kB gzip) | **628.61 kB (185.24 kB gzip)** |

Exact bytes at `ae92bac`, for anyone diffing: JS 559,904 raw / 173,731 gzip -9;
CSS 68,707 raw / 11,505 gzip -9. Vite's printed `gzip:` column rounds slightly
differently from `gzip -9` — **plan 023's gates are stated against Vite's
printed column**, so use `npm run build` output, not `gzip -9`, to check them.

Nothing was added to `package.json`; runtime dependencies remain exactly `react`
and `react-dom`. Plan 023 addresses the single-chunk shape.

## What was NOT audited

Round three did not cover: the Editor's mirror-overlay highlighting under
IME/composition input; any real-device or real-screen-reader testing (contrast
was computed analytically from the design tokens and measured in Chromium, not
on hardware); bundle composition beyond the headline number; the synthetic
voice's behaviour across browser TTS engines other than the one measured.
