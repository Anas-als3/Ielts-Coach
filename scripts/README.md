# Generating Listening audio (plan 032 Prong B)

This is a **maintainer task**, not something the app does. Read
`plans/032-listening-voice-quality.md`'s "trap" section first if you have not:
this app calls no TTS API at runtime, on purpose, for good reasons. The audio
is generated ONCE, here, on your own machine, and the result is committed as
an ordinary static asset. Learners never see an API key and the app never
makes a network call to synthesise speech.

Until a test's audio has been generated, the app plays it exactly as it does
today — the browser's own (now quality-ranked, see Prong A) synthetic voice,
or the paced transcript fallback. Nothing breaks by skipping this.

## Prerequisites

- Node matching this repo's `engines` field (`package.json`) — the script
  uses `node --experimental-strip-types`, which needs a reasonably recent
  Node 22/24/26.
- An OpenAI API key with access to the audio/speech endpoint, in the
  `TTS_API_KEY` environment variable. Nothing else reads this variable, and
  the script never writes it anywhere — not to a file, not to the manifest,
  not to a log line.

## The one command

```sh
TTS_API_KEY=sk-... node --experimental-strip-types scripts/generate-audio.mjs --test listening-01
```

Repeat with `--test listening-02` for the second paper, and again for any
future one — `LISTENING_TESTS` in `src/listening/tests/index.ts` lists every
registered id.

This writes `public/audio/<testId>/000.mp3`, `001.mp3`, … (one file per cue,
zero-padded, in transcript order) and `public/audio/<testId>/manifest.json`.
**Commit the whole `public/audio/<testId>/` directory.** It is original
content synthesised from this repo's own original transcripts, the same as
the transcripts themselves.

Once committed, the app picks it up with no code change: `createSpeechDriver`
(`src/listening/speech.ts`) already prefers a test's manifest over synthesis
whenever one is reachable at `/audio/<testId>/manifest.json`, and falls back
to synthesis automatically if it is not there yet.

## Checking before you spend anything

```sh
node --experimental-strip-types scripts/generate-audio.mjs --test listening-01 --dry-run
```

Prints the cue count and the voice map that would be used — no API key
needed, no API called, no files written. This is also this plan's automated
test (`tests/generate-audio.test.ts` runs it in CI); running it costs nothing
and proves the wiring (test lookup, voice map lookup) still works.

Running the script WITHOUT `TTS_API_KEY` and without `--dry-run` exits
non-zero with a one-line explanation rather than doing anything.

## The voice map (`scripts/voice-map.json`)

One entry per test id, one entry per `speakerId` the test's transcript
declares (`src/listening/tests/*.ts`), naming the
[`gpt-4o-mini-tts`](https://platform.openai.com/docs/guides/text-to-speech)
voice to use for that speaker plus the gender/accent the transcript's own
`ListeningVoiceHint` already calls for (restated here so this file is
reviewable without cross-referencing the transcript). This is checked in
beside the script — **it is the reviewable record of who sounds like what**,
and the run refuses (rather than defaulting silently) if a cue's speaker has
no entry.

OpenAI's TTS voices do not currently offer accent selection — every voice
reads as American English regardless of which one you pick. The `accent`
field records what the transcript calls for, not a guarantee the audio
reproduces it; distinct voices are still assigned per section so speakers
never collide, which is the part that actually matters for a listening
exercise (telling speakers apart). **Listen to a generated test once
end-to-end and adjust the voice choices by ear before trusting them** — this
file's starting assignments are a reasonable first pass, not a verified
match.

To use a different provider, edit `synthesize()` in `generate-audio.mjs` (the
OpenAI call is isolated to that one function) and update `provider` in the
written manifest accordingly — `AudioFileDriver` does not care which
provider made the files, only that the manifest and the files agree.

## Cost and size

~99 cues per test × ~40 words ≈ 25 minutes of speech per test. OpenAI TTS
pricing puts one full test's generation well under $1, one-time. Mono MP3 at
a modest bitrate runs roughly 4–6 MB per test — negligible against a typical
origin, and it costs the JS bundle nothing: `public/` is served untouched by
Vite, not bundled.

## Regenerating

The manifest records `generatedAtISO` and `provider`, so a regeneration (a
better voice, a fixed transcript typo, a new provider) is just re-running the
same command — it overwrites the test's files and manifest in place. There is
no versioning beyond what git already gives you.

## If real recorded human audio ever happens

It slots in as a manifest + files with no code change — `AudioFileDriver`
does not care who spoke, only that the manifest's cue ids match the
transcript's and the files exist. Point `provider` at whatever produced them
and skip this script entirely.
