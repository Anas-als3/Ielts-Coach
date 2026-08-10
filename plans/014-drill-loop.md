# Plan 014: Make the error profile do something — the drill loop

## Status

- **Priority**: P1 — highest-value item that is pure product, not content
- **Effort**: M (2–3 days)
- **Risk**: LOW
- **Depends on**: `plans/006-stop-false-accusations.md` (drilling a false positive would be actively harmful)
- **Category**: direction
- **Planned at**: commit `b942572`, 2026-08-10

## Why this matters

The app computes a personal error profile — per-category rates, EWMA smoothing,
least-squares trends, top-three focus categories — and then **does nothing with
it.** Confirmed in the audit:

- `src/App.tsx` — `function handleStartPractice(_focus: IssueCategory | null) { startNewEssay() }`.
  The focus argument is underscore-prefixed and discarded.
- `src/types.ts` — the `onStartPractice` prop carries a doc comment promising
  "if focus is set, the app pre-selects amplified coaching for it". That
  behaviour does not exist.

So the Dashboard identifies a learner's three biggest weaknesses, offers a
"practice" button, and hands them a blank 250-word essay — the same thing they
would get from any other button. README.md promises the app "confronts the
learner's recurring errors"; today it only *reports* them.

This is the largest gap between what the app knows and what it does, and unlike
Reading or Listening it needs **no new content at all**. Everything required is
already computed.

## What to build

Three levels, in order of value:

**1. Focused practice (the minimum).** `handleStartPractice(focus)` picks a
prompt whose topic historically triggers that category for this learner, opens
the editor with a one-line brief naming the target ("Your weakest area is
articles. Watch every singular countable noun."), and after submit reports that
category first and compares its rate against the learner's average.

**2. Micro-drills (the real value).** A category-specific exercise that is not a
whole essay. For `article`: ten sentences with the determiner removed, learner
fills it in. For `comma-splice`: ten sentence pairs, join them correctly. For
`memorised-phrase`: rewrite five template openings. Each drill is 2–3 minutes,
generated from the existing word lists in the rule modules — the lists that
detect the error also generate the exercise.

**3. Spaced repetition.** A category that has been clean for three sessions drops
out of focus; one that reappears comes back. `computeProfile` already has the
per-session series this needs.

## Scope

- `src/drills/` — one generator per drillable category, sharing the rule modules' word lists
- `src/components/Drill.tsx` — present, check, explain
- `src/App.tsx` — implement `handleStartPractice` properly
- `src/components/Report.tsx` — a "what to do next" card naming one category and offering its drill
- `SessionRecord` — a drill variant recording category and score

## Steps

1. Implement `handleStartPractice(focus)` for real, and delete the doc comment
   promising behaviour that does not exist — or make it true. Do not leave it.
2. Pick the four highest-frequency drillable categories from real profile data,
   or from `tests/false-positives.test.ts`'s calibration essay if no data exists.
3. Build generators that draw from the rule modules' existing word lists, so a
   drill can never test something the engine does not detect.
4. The "what to do next" card on the report — this is the path from "here is your
   band" to "here is tomorrow's work", which the app currently lacks entirely.
5. Tests: each generator produces solvable items with exactly one correct answer;
   a drill result updates the profile; a category clean for three sessions leaves
   the focus list.

## Done criteria

- [ ] `grep -n "_focus" src/App.tsx` returns nothing — the parameter is used
- [ ] The `onStartPractice` doc comment matches actual behaviour
- [ ] At least four drillable categories with generators
- [ ] Every drill item has exactly one defensible correct answer (tested)
- [ ] The report ends with one concrete next action

## STOP conditions

- Plan 006 has not landed. Drilling a learner on a false positive would teach
  them to write incorrect English — strictly worse than doing nothing.
- A generated drill item has more than one defensible answer. Fix the generator;
  an ambiguous drill is worse than no drill.

## Maintenance notes

- **The word lists are the shared asset.** A drill generator and its detector
  must read the same list, or the app will drill something it cannot detect (or
  vice versa).
- This plan is the one that turns a marking tool into a coaching tool. Rank it
  above any new section once the defects are fixed.
