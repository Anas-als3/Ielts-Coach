# Plan 013: Full mock test mode

## Status

- **Priority**: P2 (rises to P1 once Reading exists)
- **Effort**: M (3 days once the sections exist)
- **Risk**: LOW
- **Depends on**: `plans/010-reading-module.md`; better with 011
- **Category**: direction
- **Planned at**: commit `b942572`, 2026-08-10

## Why this matters

This is what "best site to prepare for IELTS" actually means to a candidate.
Individual practice is preparation; **a full timed sitting is the thing that
tells them whether they are ready.** No amount of per-section drilling reproduces
the experience of two and a half hours of sustained concentration, or teaches
someone that they always run out of time in Writing Task 2 because they
overspent on Task 1.

The real order and timing:

| Order | Section | Time |
|---|---|---|
| 1 | Listening | 30 min + 10 min transfer |
| 2 | Reading | 60 min, no extra transfer time |
| 3 | Writing | 60 min (Task 1 ~20, Task 2 ~40, candidate-managed) |
| — | Speaking | Separate, often a different day |

Crucially, **Writing is one 60-minute block, not two separate timers.** The app
currently gives Task 1 its own 20:00 and Task 2 its own 40:00, which removes the
single most important skill Writing tests: budgeting the hour yourself. A mock
test must give one clock for both tasks and show how the candidate spent it.

The overall band is the mean of the four section bands, **rounded to the nearest
half band** (a .25 rounds up to .5, a .75 rounds up to the next whole). Note this
differs from the conservative rounding the app uses internally for its Writing
estimate — do not reuse `roundOverallHalfDown` here.

## Scope

- `src/mock/` — session orchestration: section order, timing, transitions
- `src/components/MockRunner.tsx` — a shell that hands off between section runners
- A combined 60-minute Writing block with a task switcher inside it
- `src/components/MockReport.tsx` — four section bands, the overall band, and a
  time-spent breakdown per task
- `SessionRecord` — a mock variant linking its child section results
- Resume-on-reload: a mock is long enough that a browser crash must not destroy it

## Steps

1. Section orchestration with the real order and timing.
2. The combined Writing block: one 60:00 clock, both tasks reachable, a visible
   warning when Task 1 has consumed more than 25 minutes.
3. Persist progress after every section so a reload resumes rather than restarts.
4. The report: four bands, the correctly-rounded overall, and where the hour went.
5. Honest labelling: Speaking is not included and the Writing bands are estimates.
   The Listening and Reading bands are exact; say which is which.

## Done criteria

- [ ] Section order and timings match the real exam
- [ ] Writing is one 60-minute block, not two
- [ ] Overall band rounds to the nearest 0.5 with .25 rounding UP (distinct from the Writing estimator's conservative rounding — tested explicitly)
- [ ] A reload mid-test resumes
- [ ] The report distinguishes exact bands (Listening, Reading) from estimates (Writing)

## STOP conditions

- Reading does not exist yet — a two-section mock is not worth shipping.
- The resume logic requires storing more than ~1 MB. Reconsider what is persisted.

## Maintenance notes

- The time-spent breakdown is the most valuable output here. Most candidates do
  not know they overspend on Task 1 until someone measures it.
