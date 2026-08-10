# Plan 032: Listening voice quality — pick the good voices, then ship real audio

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> Update the status row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat d4ddef8..HEAD -- src/listening/ src/components/ListeningPicker.tsx src/components/ListeningRunner.tsx`
> If `src/listening/speech.ts` changed since this plan was written, re-verify
> every excerpt below against the live file before proceeding.

## Status

- **Priority**: P1 (user-reported: "the AI voice was horrendous")
- **Effort**: Prong A is **M**; Prong B is **L** and has a human-in-the-loop step
- **Risk**: LOW for A (pure selection logic + UI); MED for B (new asset pipeline)
- **Depends on**: nothing hard. Coordinates with 026/027 (`prefs` key — see step A4)
  and 023 (App.tsx — only if B's driver wiring lands while 023 is in flight)
- **Category**: product / audio
- **Planned at**: commit `d4ddef8`, 2026-08-10

## Why this matters

The user sat the Listening paper and reported the voice as horrendous. The code
explains the report — two compounding defects, both verified at `d4ddef8`:

**1. The app picks the platform's WORST voice.** `pickVoice`
(`src/listening/speech.ts:223-237`) matches on language alone and takes the
FIRST hit:

```ts
const exact = voices.find((voice) => voice.lang.toLowerCase().replace('_', '-') === wanted)
if (exact !== undefined) return exact

const sameLanguage = voices.find((voice) => voice.lang.toLowerCase().startsWith(primary))
return sameLanguage ?? null
```

Platforms list their legacy compact voices first and their high-quality ones
(Siri voices on macOS/iOS, "Microsoft … Natural" in Edge, "Google UK English"
in Chrome) later in `getVoices()`. A machine with a near-human en-GB voice
installed still gets the robot, every time.

**2. Every speaker sounds identical.** The content declares 8 speakers with
gender hints (`grep -c "gender: '" src/listening/tests/test01.ts` → 8) across
`en-GB` ×7 and `en-AU` ×1, and `ListeningVoiceHint`
(`src/listening/types.ts:80-88`) carries `gender`, `rate` and `pitch` — but
`pickVoice` reads **none of them** (`grep -n gender src/listening/speech.ts`
→ no hits in selection logic). A Section 1 phone call between a woman and a man
is one voice talking to itself. Real IELTS listening leans on voice change to
signal turn-taking; losing it costs comprehension, not just polish.

## The trap this plan exists to avoid — runtime TTS APIs

The suggestion on the table is "use one of the AI-voice APIs" (ElevenLabs,
OpenAI TTS, Azure, Google). Those voices are genuinely good, and this plan DOES
use them — but **only at authoring time**. Calling them at runtime from this app
is not an option, for three hard reasons:

1. **The API key would be public.** This is a static, client-only SPA. Any key
   shipped in the bundle is readable by every visitor and will be extracted and
   abused; there is no way to hide a secret in client-side code. The only
   mitigation is a proxy server — and "no server" is this product's stated
   identity (SPEC.md, plans/README.md "no runtime dependencies beyond React").
2. **Per-play cost and network dependency.** A 25-minute paper re-synthesised on
   every sitting bills the owner for every learner and dies offline.
3. **Non-determinism.** The same paper should sound the same on every sitting.

**The honest use of those APIs**: generate the audio ONCE, on the maintainer's
machine, with the key in a local env var; commit the resulting audio files as
static assets. Learners get real neural voices; the runtime stays serverless;
the key never leaves the dev machine. That is Prong B.

## Current state (all verified at `d4ddef8`)

- `src/listening/speech.ts` (501 lines) — the audio layer. `SpeechDriver`
  interface; `SpeechSynthesisDriver` (browser TTS, cue-chained on `onend`,
  `:248+`); `TranscriptPaceDriver` (no-voice fallback); `FakeSpeechDriver`
  (tests). `sectionCues(section)` at `:87` flattens a section's transcript into
  per-utterance cues — **the driver contract is cue-based**, which Prong B
  exploits. `SYNTHETIC_VOICE_NOTICE` at `:51-55`; the notice-selection function
  is `noticeFor` at `:499-501` (`createSpeechDriver` itself spans `:488-496`).
- `src/listening/player.ts` (144 lines) — play-once and in-order rules, headless,
  driver-agnostic. **Untouched by this plan.**
- Injection: `AppProps.listeningDriver` (`src/types.ts:760`); App builds
  `createSpeechDriver()` when absent; tests inject `FakeSpeechDriver` via
  `renderApp` (`tests/ui/renderApp.tsx`). The seam Prong B's driver slots into
  already exists.
- Content: one paper, `src/listening/tests/test01.ts`, 99 cues
  (`grep -c "text:" …` → 99), 8 speakers, transcripts are original work
  (header, `src/listening/types.ts:29`).
- There is **no `public/` directory yet** (`ls public` → absent). Vite serves
  `public/` as static assets untouched by the bundler — audio there adds zero
  to the JS bundle plan 023 measures.

## Prong A — make the browser voices as good as they can be (ship first)

### A1. Quality-ranked voice selection

Replace first-match with a scored ranking in `pickVoice` (same signature, same
"never fails" contract, same file):

- +3 exact BCP-47 match (`en-gb` for `en-GB` hints), +1 same primary language.
- +4 name matches a known-quality marker, case-insensitive:
  `natural`, `neural`, `premium`, `enhanced`, `siri`, `google`, `aria`, `sonia`,
  `libby`, `ryan`. (Marker list is a heuristic and lives as an exported const
  with a doc comment saying exactly that.)
- −4 name matches a known-legacy marker: `compact`, `espeak`, `eloquence`,
  `albert`, `zarvox`, `fred`, `whisper`, `bells`.
- Ties break by original list order (stability).

Selection returns the TOP-scored voice. The function stays pure and exported —
the engine tests exercise it with hand-built `SpeechSynthesisVoice`-shaped
literals (they are plain objects in the tests; no jsdom needed).

### A2. Distinct voices per speaker

`sectionCues` already carries each cue's speaker hint. Extend selection so the
section's speakers get **distinct** voices when the platform has ≥2 usable
matches: rank as in A1, then assign by speaker id round-robin over the top N.
When only one usable voice exists, differentiate with the pitch field the hint
already carries (`ListeningVoiceHint.pitch`, `src/listening/types.ts:88`; `:87`
is its doc comment):
+0.15 / −0.15 alternating by speaker. Do NOT try to infer voice gender from
voice names — name lists are locale-dependent and wrong often enough to be
worse than pitch differentiation. Record that decision in a comment.

### A3. A voice picker with preview

In `src/components/ListeningPicker.tsx` (where `SYNTHETIC_VOICE_NOTICE` already
renders — verify and cite the line when you get there): a select listing the
platform's English voices (grouped: recommended first, by A1 score), a Preview
button that speaks one fixed sample sentence through the chosen voice, and
"Automatic (recommended)" as the default. `getVoices()` is empty until
`voiceschanged` on some platforms — listen for it and re-render; the existing
driver code already documents this quirk (`speech.ts:218-220`).

### A4. Persist the choice

Store `preferredVoiceURI` in the `'ielts-coach.prefs.v1'` localStorage key that
plan 026 defines and 027 extends — **additive field, hostile-wire validated,
same contract those plans state**. If neither has landed yet, this plan creates
the key with only that field and they rebase. **Execution order rule: this plan
lands AFTER 026 and 027** — neither of those plans knows about
`preferredVoiceURI`, and 026's paste-verbatim prefs module would clobber this
field's validation if 032 landed first. Landing last, this plan EXTENDS the
existing `prefs.ts` additively (new field + its validator) rather than creating
the module.
A persisted URI that no longer exists on the platform (voices come and go with
OS updates) silently falls back to Automatic — never an error.

### A5. Honesty text stays

`SYNTHETIC_VOICE_NOTICE` still shows whenever the speech-synthesis driver is
active. A better-chosen browser voice is still a browser voice.

## Prong B — authoring-time neural audio, shipped as static files

### B1. The pipeline (dev tooling, never shipped)

New dev-only script `scripts/generate-audio.mjs` (a new top-level `scripts/`
dir; NOT under `src/`, never imported by the app, excluded from the bundle by
construction):

- Reads a test's transcript from `src/listening/tests/*.ts` (import the module
  directly under `node --experimental-strip-types`, or via a tiny esbuild
  bundle step — pick one and document it).
- For each of the 99 cues, calls a TTS API (default: OpenAI `tts-1` or
  `gpt-4o-mini-tts`; the script takes provider/voice per speaker id from a
  small JSON voice-map checked in beside it) and writes
  `public/audio/<testId>/<cueIndex>.mp3` (or `.opus` where the API offers it).
- Voice map assigns a DISTINCT named API voice per speaker id, matching the
  declared gender and accent as closely as the provider allows; the map is the
  reviewable record of who sounds like what.
- **The API key comes from an environment variable on the dev machine**
  (`TTS_API_KEY`). The script refuses to run without it, never writes it
  anywhere, and `.gitignore` gains nothing (no key file exists to ignore).
  The generated audio IS committed — it is original content derived from the
  repo's own original transcripts.
- Writes a manifest `public/audio/<testId>/manifest.json`:
  `{generatedAtISO, provider, voiceMap, cues: [{index, file, speakerId}]}`.

Cost and size, estimated honestly (state actuals in the report): ~99 cues ×
~40 words ≈ 25 minutes of speech; mono 24-32 kbps ≈ **4–6 MB per test**;
OpenAI TTS pricing puts one full test well under $1. One-time, per test.

### B2. `AudioFileDriver`

New driver in `src/listening/speech.ts` implementing the existing
`SpeechDriver` interface: given a manifest URL, plays the per-cue files in
sequence through an `HTMLAudioElement`, emitting the same cue-progress events
`SpeechSynthesisDriver` emits (the runner cannot tell the difference — that is
the point of the seam). `available()` = manifest fetched and parsed. Cancel
stops the current element. An audio element error skips to the next cue —
matching the synthesis driver's "one mangled line is better than a dead
section" doctrine (`speech.ts:~244`).

`createSpeechDriver()` gains the preference order:
**audio files (when the test has a manifest) → speech synthesis → transcript
pace**, and `noticeFor` (`speech.ts:499-501` — today a two-way branch on
`kind === 'transcript-pace'`; it becomes a three-way switch when the
`'audio-file'` driver kind is added) gains a third text for the
audio-file case: generated recordings, still not the exam's human speakers —
the honesty rule (`speech.ts:44-55`) extends, never retracts.

Static same-origin asset fetches are not "network at runtime" in the sense the
moat forbids (they are how `index.html` itself arrives), but say it plainly in
SPEC.md: the app now ships audio assets; offline behaviour depends on the
browser cache for them.

### B3. The human step

Running B1 needs a TTS account and key. **The executor cannot do this.** The
plan's deliverable for B is: the script, the driver, the manifest contract, the
tests (driver tested against a fixture manifest + tiny silent audio fixtures),
and a `scripts/README.md` documenting the one command the maintainer runs.
Generation itself is a documented maintainer task, and the driver falls back to
Prong A's improved synthesis until the files exist.

## Scope

**In scope**: `src/listening/speech.ts`, `src/components/ListeningPicker.tsx`,
`src/profile/prefs.ts` (additive field; create only if 026/027 absent),
`src/App.tsx` (**one call site only**: `listeningDriver ?? createSpeechDriver()`
at `App.tsx:221` — see the wiring rule below), `scripts/generate-audio.mjs` +
`scripts/README.md` + voice-map JSON, `public/audio/` (structure + fixtures),
`src/types.ts` (driver-kind/type additions only), SPEC.md, tests.

**Wiring rule** (how the preference and the manifest reach playback): App
constructs the driver synchronously at `App.tsx:221` with no arguments.
Keep that shape. `createSpeechDriver()` gains an optional options argument
`{manifestUrl?: string}` and reads the preferred-voice URI ITSELF via
`src/profile/prefs.ts` at construction — App passes the manifest URL for the
selected test (derived from the test id) and nothing else. The injected-driver
test path (`listeningDriver ?? …`) is unchanged, so `tests/ui/renderApp.tsx`
injection keeps working. Prong A alone needs no App.tsx change at all (the
voice choice lives inside the driver); only Prong B's manifest URL touches
`App.tsx:221`.

**Out of scope**: `src/listening/player.ts` (play-once rules — untouched);
any runtime network call to a TTS API (the trap section is binding); any new
runtime dependency (`HTMLAudioElement` is a platform API); the runner's UI
beyond the notice text; re-recording with human voice actors.

## Git workflow

Branch `advisor/032-listening-voice`. Prong A and Prong B are separate commit
groups; A is shippable without B. Do not push; no PR.

## Steps, tests, done criteria

1. **A1+A2** — rewrite selection; engine tests: quality marker beats list
   order; legacy marker loses to plain; two speakers get distinct voices when
   two matches exist; pitch fallback when one. **Mutation-check**: revert to
   first-match (`voices.find` language-only), the distinct-voices test and the
   quality test must both fail; revert and confirm green.
2. **A3+A4** — picker UI + prefs persistence; UI tests with a stubbed voice
   list (inject via the `SpeechEngine` seam, `speech.ts:190-194`); persisted
   URI round-trip; vanished-URI falls back to Automatic.
   **Mutation check**: make the vanished-URI path return the stale URI instead
   of falling back — the fallback test must fail; revert by hand (the edit is
   one line) and confirm green.
3. **B2** — `AudioFileDriver` + preference order + third notice; engine tests
   drive it with a fixture manifest and assert cue-event parity with
   `FakeSpeechDriver`'s event shape; `createSpeechDriver` preference tested by
   injection (no real fetch in Node — the manifest loader takes an injectable
   fetch, same discipline as `browserSpeechEngine`).
   **Mutation checks**: (a) invert the preference order (synthesis before
   audio-file) — the preference test must fail; (b) make an audio element
   error abort the section instead of skipping to the next cue — the
   error-skip test must fail. Revert each by hand, confirm green after each.
4. **B1+B3** — the script + docs. Done criterion for the script: running it
   WITHOUT `TTS_API_KEY` exits non-zero with a one-line explanation; a
   `--dry-run` flag prints the cue count and voice map without calling any API
   (that dry run IS executable in CI and is the automated test).
5. Full gates: `npx vitest run` (all green, count recorded),
   `npx tsc -b --noEmit` (**src/ only** — `tests/` is not typechecked by tsc
   until plan 024 lands; test-file type errors surface via vitest, not tsc),
   `npm run build`, 10× `--project ui` identical,
   `git status --porcelain -- . ':!plans/'` shows only in-scope files.

## STOP conditions

- Any evidence someone wants to wire a TTS API key into runtime code — stop,
  cite the trap section.
- `getVoices()` stubbing proves impossible through the existing `SpeechEngine`
  seam without widening it — report the widening you need first.
- The per-cue file model fights the runner's cue-progress display in a way the
  event shim cannot hide — report with the specific event mismatch.
- Prong B's fixture audio pushes the repo above ~1 MB of test assets — use
  generated silence (a few bytes of valid MP3 header) instead; if that fails in
  jsdom/Node, report.

## Maintenance notes

- The quality-marker lists WILL rot as platforms rename voices; they are
  heuristics with a doc comment saying so, and Automatic must always be safe.
- Every new test (plan content job) needs its audio generated once by the
  maintainer — `scripts/README.md` is the checklist. The manifest records
  provider and date, so regeneration is reproducible.
- If real recorded human audio ever happens, it slots in as manifest + files
  with no code change — the `AudioFileDriver` does not care who spoke.
