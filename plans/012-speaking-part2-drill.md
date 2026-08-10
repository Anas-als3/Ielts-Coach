# Plan 012: Speaking — the honest deterministic slice

> **Executor instructions**: follow step by step; STOP conditions apply; update
> `plans/README.md` when done.

## Status

- **Priority**: P3
- **Effort**: M (4–5 days)
- **Risk**: LOW — provided the scope stays honest
- **Depends on**: `plans/008-academic-general-module-switch.md` (for the shell only)
- **Category**: direction
- **Planned at**: commit `b942572`, 2026-08-10

## Why this matters, and what this plan deliberately will NOT do

Speaking is **identical for Academic and General Training**, and it is the
section this architecture fits worst.

IELTS Speaking is marked on Fluency and Coherence, Lexical Resource, Grammatical
Range and Accuracy, and **Pronunciation**. Three of those need to hear the
candidate; Pronunciation cannot be scored by rules at all. Automatic speech
recognition would need a model or a server, both excluded by the product's stated
architecture.

**So this plan does not attempt to score speaking.** Claiming a Speaking band
from typed notes would be dishonest, and the app's credibility rests on the
opposite habit — it labels its Writing band "form-only estimate" precisely
because it knows what it cannot see.

What it does build is the part that genuinely helps and is genuinely
deterministic: **the Part 2 cue-card drill.** Part 2 gives the candidate a card,
one minute to prepare, and one to two minutes to speak on four bullet points.
Most candidates lose marks by under-preparing in that minute and then drying up
or missing a bullet. That is a trainable habit, and every part of it is
checkable without hearing anything:

- Did the preparation notes cover all four bullets? (Same machinery as
  `gt-bullet-uncovered` from plan 009.)
- Did the candidate speak for the full two minutes? (A timer knows.)
- Did they use varied, specific vocabulary in their notes rather than the same
  three words? (The existing lexical rules already do this.)

Optionally, `MediaRecorder` can record the attempt **locally** so the learner can
play it back and judge their own fluency. No upload, no analysis, no band. That
is a real feature and an honest one.

## Scope

- `src/speaking/cueCards.ts` — 30 Part 2 cue cards, each with the four bullets
  and a keyword set per bullet
- `src/speaking/part1Questions.ts`, `part3Questions.ts` — question banks for
  warm-up and follow-up practice (no scoring, just the questions and a timer)
- `src/analysis/rules/cueCardNotes.ts` — bullet coverage over typed notes,
  reusing the coverage helper written for plan 009
- `src/components/SpeakingDrill.tsx` — 60s prep with a note field, then a 2:00
  speak timer, then a self-review checklist
- Optional: `MediaRecorder` playback, local only, never persisted to storage
- `SessionRecord` gains `section: 'speaking'` with `notes` and `spokeSeconds`

## Steps

1. Author 30 cue cards across the standard topic families (a person, a place, an
   object, an event, a habit, a plan, a media item).
2. Build the two-phase timer: 60s prep, then 2:00 speak, with the card visible
   throughout as in the real exam.
3. Bullet coverage over the typed notes, reusing plan 009's helper. Show it
   **after** the prep minute ends, never during — the point is to train
   preparation, not to autocomplete it.
4. A self-review checklist after speaking: did you cover all four bullets, did
   you speak the full two minutes, did you repeat yourself. Self-assessment is
   honest where automatic assessment is not.
5. Optional local recording with playback. Explicitly no upload and no storage.
6. **UI copy must state that no Speaking band is given, and why.** One sentence:
   the app cannot hear you, and pronunciation and fluency are a third of the
   Speaking mark.

## Done criteria

- [ ] No Speaking band score is produced anywhere in the app
- [ ] The UI explains why, in one plain sentence
- [ ] 30 cue cards with four bullets each
- [ ] Bullet coverage is revealed only after the prep phase ends
- [ ] Any recording stays in memory and is never written to localStorage

## STOP conditions

- Anyone proposes inferring a Speaking band from notes or timing. That is the
  one thing this plan exists to refuse.
- `MediaRecorder` needs a permission flow that blocks the drill for users who
  decline. Make recording strictly optional and skippable.

## Maintenance notes

- If ASR ever becomes viable fully offline in-browser, this is the plan to
  revisit — but the honest framing (no band without hearing pronunciation) should
  survive even then.
