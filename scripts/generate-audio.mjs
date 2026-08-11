#!/usr/bin/env -S node --experimental-strip-types
/**
 * Generates the per-cue neural-voice audio for one Listening test and writes
 * it under `public/audio/<testId>/`, plus the `manifest.json`
 * `AudioFileDriver` (`src/listening/speech.ts`) reads at runtime.
 *
 * ## Why this is a script, not code the app calls — plan 032's binding rule
 *
 * This app calls no TTS API at runtime. Read `SPEC.md`'s "The audio decision"
 * and plan 032's "trap" section for the full reasoning; in short: the API key
 * would be public in a client-only bundle, every playback would cost money
 * and depend on the network, and the recording would not be the same from one
 * sitting to the next. The honest use of a good TTS voice is to generate the
 * audio ONCE, here, on the maintainer's own machine, with a key that never
 * leaves it, and commit the result as an ordinary static asset. This file is
 * never imported by `src/`, lives outside it, and is not part of
 * `npm run build` — nothing about it reaches the shipped app except the
 * static files it writes.
 *
 * The key comes from the `TTS_API_KEY` environment variable, is read once via
 * `process.env`, and is never written anywhere by this script — not to a
 * file, not to the manifest, not to a log line.
 *
 * ## Usage
 *
 *   TTS_API_KEY=sk-... node --experimental-strip-types scripts/generate-audio.mjs --test listening-01
 *   node --experimental-strip-types scripts/generate-audio.mjs --test listening-01 --dry-run
 *
 * See `scripts/README.md` for the full maintainer checklist. `--dry-run`
 * needs no key, calls no API, and is the one command CI can actually run —
 * it is this plan's automated test for the script.
 *
 * ## Loading TypeScript content without a bundler
 *
 * `src/listening/tests/*.ts` is written like the rest of this project:
 * extensionless relative imports (`from './test01'`), resolved by
 * Vite/tsc's bundler-style resolution at build time. `--experimental-strip-
 * types` strips TYPES from a `.ts` file but does not add that extension
 * resolution on its own, so this script registers `./ts-resolve-loader.mjs`
 * — a small Node loader hook, not a new dependency — before importing
 * anything from `src/`. See that file's own doc comment for why.
 */
import { register } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

register('./ts-resolve-loader.mjs', import.meta.url)

import { mkdir, readFile, writeFile } from 'node:fs/promises'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..')

/** OpenAI's TTS endpoint and default model. `gpt-4o-mini-tts` (rather than
 *  `tts-1`) so `scripts/voice-map.json` can use its fuller voice roster —
 *  more of them read plausibly as a specific gender, which matters more here
 *  than for a general-purpose TTS call, because every speaker's gender is
 *  already declared in the transcript (`ListeningVoiceHint.gender`). */
const OPENAI_MODEL = 'gpt-4o-mini-tts'
const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech'

function parseArgs(argv) {
  const args = {
    dryRun: false,
    test: null,
    out: path.join(REPO_ROOT, 'public', 'audio'),
    voiceMap: path.join(SCRIPT_DIR, 'voice-map.json'),
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--test') args.test = argv[(i += 1)]
    else if (arg === '--out') args.out = path.resolve(argv[(i += 1)])
    else if (arg === '--voice-map') args.voiceMap = path.resolve(argv[(i += 1)])
    else if (arg === '--help' || arg === '-h') args.help = true
    else {
      console.error(`Unknown argument: ${arg}`)
      process.exit(1)
    }
  }
  return args
}

function printUsage() {
  console.log(
    [
      'Usage: generate-audio.mjs --test <testId> [--dry-run] [--out <dir>] [--voice-map <file>]',
      '',
      '  --test <testId>    Required. A registered LISTENING_TESTS id, e.g. listening-01.',
      '  --dry-run          Print the cue count and voice map; call no API, write no files.',
      '  --out <dir>        Defaults to public/audio.',
      '  --voice-map <file> Defaults to scripts/voice-map.json.',
      '',
      'Reads the API key from TTS_API_KEY. Required unless --dry-run is given; never',
      'written anywhere by this script. See scripts/README.md for the full checklist.',
    ].join('\n'),
  )
}

/** Imports `src/listening/tests/index.ts` and looks up one test by id. */
async function loadTest(testId) {
  const indexPath = path.join(REPO_ROOT, 'src', 'listening', 'tests', 'index.ts')
  const mod = await import(pathToImportSpecifier(indexPath))
  const test = mod.listeningTestById(testId)
  if (test === null) {
    const known = mod.LISTENING_TESTS.map((t) => t.id).join(', ')
    console.error(`No Listening test registered with id "${testId}". Known ids: ${known}`)
    process.exit(1)
  }
  return test
}

function pathToImportSpecifier(absolutePath) {
  // A file:// URL, not a bare path — `import()` on Windows-style paths (and
  // some Node builds on POSIX too) needs an explicit URL for an absolute
  // filesystem path outside node_modules resolution.
  return new URL(`file://${absolutePath}`).href
}

/**
 * Flatten every section's cues into one ordered list for the whole test,
 * matching the manifest contract (`AudioManifest.cues` in `speech.ts`): one
 * manifest per TEST, covering every section, `index` a stable position for
 * the file name, `id` what the driver actually matches cues by.
 */
function flattenCues(test) {
  const cues = []
  for (const section of test.sections) {
    const bySpeaker = new Map(section.transcript.speakers.map((s) => [s.id, s]))
    for (const cue of section.transcript.cues) {
      cues.push({
        id: cue.id,
        speakerId: cue.speakerId,
        speakerLabel: bySpeaker.get(cue.speakerId)?.label ?? cue.speakerId,
        text: cue.text,
      })
    }
  }
  return cues
}

async function loadVoiceMapForTest(voiceMapPath, testId) {
  const raw = JSON.parse(await readFile(voiceMapPath, 'utf8'))
  const forTest = raw[testId]
  if (forTest === undefined) {
    console.error(`${voiceMapPath} has no entry for test "${testId}".`)
    process.exit(1)
  }
  return forTest
}

/** Every speaker id the cues actually use that the voice map does not cover —
 *  the run refuses rather than falling back to a default voice, because a
 *  silently-defaulted voice is exactly the kind of unreviewed choice the
 *  voice map exists to prevent. */
function missingVoices(cues, voiceMap) {
  const used = new Set(cues.map((c) => c.speakerId))
  return [...used].filter((speakerId) => voiceMap[speakerId] === undefined)
}

async function synthesize(text, voice, apiKey) {
  const response = await fetch(OPENAI_TTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: OPENAI_MODEL, voice: voice.voice, input: text, response_format: 'mp3' }),
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`TTS API error ${response.status}: ${body}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help === true) {
    printUsage()
    return
  }
  if (args.test === null) {
    printUsage()
    process.exit(1)
  }

  const test = await loadTest(args.test)
  const cues = flattenCues(test)
  const voiceMap = await loadVoiceMapForTest(args.voiceMap, args.test)

  const missing = missingVoices(cues, voiceMap)
  if (missing.length > 0) {
    console.error(`${args.voiceMap} is missing a voice for speaker(s): ${missing.join(', ')}`)
    process.exit(1)
  }

  if (args.dryRun) {
    console.log(`${test.id}: ${cues.length} cues across ${test.sections.length} sections.`)
    console.log('Voice map:')
    for (const [speakerId, voice] of Object.entries(voiceMap)) {
      console.log(`  ${speakerId} -> ${voice.provider ?? 'openai'}:${voice.voice} (${voice.gender}, ${voice.accent})`)
    }
    console.log('Dry run: no API called, no files written.')
    return
  }

  const apiKey = process.env.TTS_API_KEY
  if (apiKey === undefined || apiKey === '') {
    console.error(
      'TTS_API_KEY is not set. Export it in your shell before running this script — ' +
        'it is read once from the environment and never written anywhere.',
    )
    process.exit(1)
  }

  const outDir = path.join(args.out, test.id)
  await mkdir(outDir, { recursive: true })

  const manifestCues = []
  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index]
    const voice = voiceMap[cue.speakerId]
    const fileName = `${String(index).padStart(3, '0')}.mp3`
    const audio = await synthesize(cue.text, voice, apiKey)
    await writeFile(path.join(outDir, fileName), audio)
    manifestCues.push({ id: cue.id, index, file: fileName, speakerId: cue.speakerId })
    console.log(`  [${index + 1}/${cues.length}] ${cue.speakerId} -> ${fileName}`)
  }

  const manifest = {
    generatedAtISO: new Date().toISOString(),
    provider: `openai:${OPENAI_MODEL}`,
    voiceMap: Object.fromEntries(Object.entries(voiceMap).map(([id, v]) => [id, v.voice])),
    cues: manifestCues,
  }
  await writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Wrote ${manifestCues.length} files and manifest.json to ${outDir}`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
