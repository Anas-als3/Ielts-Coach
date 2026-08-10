# Implementation Plans

Plans 001–005 were generated on 2026-08-05 and are **all DONE and merged**.
Plans 006–014 were generated on 2026-08-10 from a six-dimension audit
(26 findings survived adversarial refutation, 10 were killed) plus a gap
analysis against the full IELTS exam.

**Repo**: https://github.com/Anas-als3/Ielts-Coach (private) · baseline `b942572`
· 11,575 lines of source, 253 tests.

**Parallel sessions: one branch each, off `main`.** Branch names are in each
plan's Git workflow section. Do not work on `main` directly, and do not have two
sessions on the same plan.

## Execution order & status

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 001 | Make a schemaVersion bump non-destructive; add `task` | P1 | S | — | DONE |
| 002 | Single-source the complexity markers | P2 | S | — | DONE |
| 003 | Task 1 data model, prompt bank, SVG chart | P1 | M | 001 | DONE |
| 004 | Task 1 analysis pipeline | P1 | L | 003 | DONE |
| 005 | Wire Task 1 into the app | P1 | M | 004 | DONE |
| **007** | **Deflake the UI suite; grade the worked answer against its own prompt** | **P0** | S | — | DONE |
| **006** | **Stop the engine accusing correct English — five guards + golden corpus** | **P0** | M | — | DONE |
| 014 | Make the error profile do something — the drill loop | P1 | M | 006 | TODO |
| 008 | Academic / General Training module switch | P1 | M | — | TODO |
| 009 | General Training Task 1 — letters | P1 | L | 008 | TODO |
| 010 | Reading — both modules, real question types, real band tables | P2 | L | 008 | TODO |
| 013 | Full mock test mode | P2 | M | 010 | TODO |
| 011 | Listening — marking is easy, audio is the project | P3 | L | 010 | TODO |
| 012 | Speaking — the honest deterministic slice | P3 | M | 008 | DEFERRED — user descoped 2026-08-10; Writing/Reading/Listening first |

**Run 007 before 006** even though it is numbered second: it is two hours, and
it restores a trustworthy test suite that plan 006 needs to land against. The
numbering reflects severity; the table reflects order.

Status values: TODO | IN PROGRESS | DONE | BLOCKED (one-line reason) | REJECTED.

## Dependency notes

- **006 and 007 block everything.** 006 fixes an engine that currently tells
  learners to write ungrammatical English; 007 fixes a test suite that fails
  ~4 runs in 6. Building new sections on top of either is building on sand.
- **014 depends on 006.** Drilling a learner on a false positive teaches them to
  write incorrect English — strictly worse than not drilling at all.
- **008 blocks 009, 010 and 012** — they all need the `Module` discriminator.
- **013 depends on 010.** A mock test with only Writing is not a mock test.
- **011 depends on 010** for the shared answer-key marking module.
- 006, 007 and 008 are mutually independent and can run in parallel sessions.

## What the audit found (verified, not just reported)

Every claim below was reproduced through the real pipeline on 2026-08-10 before
being written down.

### The engine accuses correct English — plan 006

| Learner writes (correct) | App says |
|---|---|
| Working from home can **reduce** commuting costs | write "can **reduces**" |
| Governments must act to **reduce crime** | write "**a reduce crime**" |
| **However, it is clear that…** | possible comma splice |
| **If a country invests in education it will prosper.** | "a main clause never arrives" |
| every **10 years** | "years → year" |

Four of five emit a suggested fix that is itself ungrammatical.
`src/analysis/rules/accuracy.ts:11` already states that a false positive costs
more than a miss.

### The worked answer is graded against the wrong prompt — plan 007

`ModelAnswer.tsx` analyses the fallback answer against the **learner's** prompt
rather than the one it was written for. Measured across all 40 prompts:
**14 render an exemplar the app's own scorecard marks below 8.0**; dq-02…dq-08
show Task Response 5.5 with a `question-coverage` error. SPEC.md promises the
opposite in as many words.

### The UI suite is flaky — plan 007

`render(<App />)` draws from `randomPrompt()` over 40 prompts and nothing seeds
it. Six consecutive runs of `--project ui`: four failed.

### The error profile is computed and discarded — plan 014

`handleStartPractice(_focus)` ignores its argument. The Dashboard names the
learner's three weaknesses and the "practice" button hands them a blank essay.

## Gap analysis against the full exam

| Section | Academic | General Training | Plan |
|---|---|---|---|
| Writing Task 1 | ✅ charts | ❌ **letters** | 009 |
| Writing Task 2 | ✅ | ⚠️ same engine, needs GT-appropriate prompts | 008 |
| Reading | ❌ | ❌ (stricter band table) | 010 |
| Listening | ❌ | ❌ (identical to Academic) | 011 |
| Speaking | ❌ | ❌ (identical to Academic) | 012 |
| Full mock sitting | ❌ | ❌ | 013 |

**Best fit for this engine, ranked**: General Training letters (formulaic
conventions a rule engine checks with certainty) → Reading (pure answer-key
marking, the one section the app can be *exactly* right about) → mock test mode
→ Listening (same marking, but audio is unsolved) → Speaking (cannot be scored
without hearing; only an honest drill is possible).

### Academic vs General Training — what actually differs

| Section | Academic | General Training |
|---|---|---|
| Writing Task 1 | Describe a chart, graph, table or process | **Write a letter** (formal / semi-formal / informal) |
| Writing Task 2 | Essay | Essay — **identical marking**, everyday topics |
| Reading | 3 long academic passages | 3 sections: short social/workplace texts, then one long text |
| Reading band | 30/40 → 7.0 | **34–35/40 → 7.0** (~4 more correct for the same band) |
| Listening | Identical | Identical |
| Speaking | Identical | Identical |

Both Reading conversion tables are printed in full in plan 010 and belong in
SPEC.md as canonical data.

## Content sourcing — read before starting 010 or 011

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
test. Ship one test per module and validate the format before authoring more.

## Findings considered and rejected

So nobody re-audits these:

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
- **10 further audit findings** were killed by the refutation pass as
  speculative, already fixed, or documented tradeoffs.

## Known limitations carried forward

- **The band trend chart mixes tasks** (a caption discloses it; the real fix is
  two series or a filter).
- **No Task 1 cheat sheet** — `CheatSheet.tsx` is Task 2 content and is hidden
  in Task 1 rather than replaced.
- **`Report.tsx` (719 lines) and `Dashboard.tsx` (466) have no component tests.**
- **`categoryAppliesTo` scopes by task, not module** — harmless until plan 009
  adds letter-only categories, then it must take `Module` too.

## What was NOT audited

Each auditor reported its own gaps. Not covered: the Editor's mirror-overlay
highlighting under IME/composition input; localStorage quota behaviour at the
200-session cap; any real-device or real-screen-reader testing (contrast was
computed analytically from the design tokens, not measured in a browser); bundle
composition beyond the headline number.
