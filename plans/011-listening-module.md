# Plan 011: Listening — the marking is easy, the audio is the project

> **Executor instructions**: follow step by step; STOP conditions apply; update
> `plans/README.md` when done.
>
> **Drift check**: confirm plan 010 landed — `test -f src/reading/bandTable.ts`.

## Status

- **Priority**: P3
- **Effort**: L (engine S — it reuses plan 010 almost entirely; audio is the cost)
- **Risk**: MED — the audio strategy is an unresolved product decision, see below
- **Depends on**: `plans/010-reading-module.md`
- **Category**: direction
- **Planned at**: commit `b942572`, 2026-08-10

## Why this matters, and why it is ranked below Reading

Listening is **identical for Academic and General Training** — same paper, same
timing, same scoring — so it needs no module branching at all. Its marking model
is the same answer-key lookup as Reading, so `markReading` generalises with
little work.

The reason it ranks lower is not the engine. It is that **a Listening test needs
audio**, and this app has no server, no CDN and a stated no-runtime-dependency
constraint. That is a genuine architectural problem, not a content chore.

## The audio decision — resolve this BEFORE writing code

Three options. Pick one, record the choice and the reasoning in SPEC.md, and do
not start until it is chosen.

**A. Bundled audio files.** Ship `.mp3`/`.opus` in the repo. Honest and highest
quality. Cost: roughly 25–30 MB per full test at usable quality, which dwarfs the
current 362 kB bundle and makes the repo unpleasant. Needs voice actors or
licensed recordings. Multiple accents (British, Australian, North American) are
part of the real exam.

**B. Browser speech synthesis.** `window.speechSynthesis` is built into every
modern browser, needs no server, no dependency and no bundled bytes. Ships the
**transcript** and speaks it. Genuinely viable and fits the architecture
perfectly. Cost: voice quality and available accents vary by platform, timing is
harder to control, and overlapping speakers in Section 3 are awkward. It is
noticeably not the real exam experience.

**C. Transcript-only "reading-as-listening" drill.** Reveal the transcript at a
fixed pace. Honest about what it is, near-zero cost, and still trains the
question types and note-taking. Weakest of the three as exam practice.

**Recommendation: B, with C as the fallback for any browser without a usable
voice.** It is the only option that keeps the offline no-dependency property
while still being an aural exercise. State plainly in the UI that the voice is
synthetic and the real exam uses recorded speakers with varied accents.

If B is chosen, `speechSynthesis` is a browser API, not a runtime dependency —
it does not violate the "no dependency beyond React" property. Confirm that
reading of the constraint with the maintainer before building.

## Scope

- `src/listening/` — test data (4 sections, 40 questions), reusing the
  `ReadingQuestion` union from plan 010 wherever the shapes match
- `src/listening/bandTable.ts` — the Listening conversion table (**one table,
  not two** — identical for both modules)
- `src/components/ListeningRunner.tsx` — player/speaker, section navigation,
  30:00 + 10:00 transfer time
- Reuse `markReading` (rename it `markAnswerKey` and move it somewhere neutral
  such as `src/marking/`, since it now serves two sections)
- `SessionRecord` gains `section: 'listening'` (no new schemaVersion if plan 010
  already introduced the union — verify)

## Steps

1. Resolve the audio decision. Record it in SPEC.md with the reasoning.
2. Generalise plan 010's marking module out of `src/reading/` into
   `src/marking/`, keeping its tests green. Pure rename plus move.
3. Add the Listening band table and test every raw score 0–40.
4. Author one complete test: 4 sections, 40 questions, full transcript with
   speaker labels and timing cues.
5. Build the runner. Play once only — the real exam does not replay. Make that
   a deliberate, stated rule, with a practice mode that allows replay.
6. Include the 10-minute transfer period, or state in the UI why it is omitted.
7. Tests: band table exhaustively; the runner's play-once rule; transfer timing;
   marking cases already covered by plan 010's suite.

## Done criteria

- [ ] The audio decision is recorded in SPEC.md before any component exists
- [ ] Listening band table exhaustively tested for 0–40
- [ ] The marking module is shared with Reading, not duplicated
- [ ] One complete 4-section test with transcript
- [ ] Bundle growth is measured and reported

## STOP conditions

- The audio decision has not been made. Do not guess it.
- Option A is chosen and the bundle grows past ~5 MB. Report and reconsider.
- `speechSynthesis` proves unusable on the target browsers. Fall back to C and
  say so in the UI rather than shipping something that silently does not speak.

## Maintenance notes

- Listening needs **no** Academic/General branching. Resist any abstraction that
  implies otherwise.
- Accents are part of what the exam tests. Whatever option is chosen, be explicit
  in the UI about how the practice differs from the real thing.
