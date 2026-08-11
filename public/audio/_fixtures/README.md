# Test fixtures — not real Listening audio

`_fixtures/demo/` is NOT a registered `LISTENING_TESTS` id and is never
requested by the running app (`App.tsx` only ever builds a manifest URL from
an actual `listeningTestId`, e.g. `listening-01`). It exists so
`tests/speech.test.ts`'s `AudioFileDriver` suite can exercise a real
on-disk manifest + real (tiny) files, rather than only in-memory fixtures, to
prove the JSON contract this directory's structure is documented against
(`scripts/generate-audio.mjs`, `scripts/README.md`) actually round-trips.

`000.mp3`/`001.mp3`/`002.mp3` are a few bytes of valid MPEG1 Layer III frame
header each (~104 bytes, effectively silence) — generated, not recorded, and
never meant to be listened to. See plan 032's STOP conditions for why: real
per-test audio pushing the repo's test assets past ~1 MB was an explicit
reason to stop and use "generated silence" instead.

Real, maintainer-generated audio for an actual test lives at
`public/audio/<testId>/` (sibling to this directory, e.g.
`public/audio/listening-01/`), written by `scripts/generate-audio.mjs` per
`scripts/README.md` — not here.
