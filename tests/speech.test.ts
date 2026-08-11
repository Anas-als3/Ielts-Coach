/**
 * Plan 032 Prong A: quality-ranked voice selection and per-speaker
 * differentiation.
 *
 * `SpeechSynthesisVoice` has no methods (`lib.dom.d.ts`), so every voice below
 * is a hand-built plain object — no jsdom, no browser global, exactly like
 * `pickVoice`'s existing "best effort" contract asks for. Utterances DO need a
 * few methods the strict `SpeechSynthesisUtterance` type declares that Node
 * cannot construct (there is no `Event` global here); `fakeEngine` below casts
 * through a narrower shape at the two points that need it, the same
 * `as unknown as` discipline `tests/prefs.test.ts` and `tests/store.test.ts`
 * already use to stub `window`.
 */
import { describe, expect, it } from 'vitest'
import {
  LEGACY_VOICE_MARKERS,
  QUALITY_VOICE_MARKERS,
  SpeechSynthesisDriver,
  assignSectionVoices,
  createSpeechDriver,
  pickVoice,
  rankVoices,
  voiceQualityScore,
  type SpeechCue,
  type SpeechEngine,
} from '../src/listening/speech'
import { savePrefs } from '../src/profile/prefs'
import type { ListeningVoiceHint } from '../src/listening/types'

/* --------------------------------- helpers ---------------------------------- */

function voice(name: string, lang: string, voiceURI: string = name): SpeechSynthesisVoice {
  return { default: false, lang, localService: true, name, voiceURI }
}

const GB: ListeningVoiceHint = { gender: 'female', accent: 'en-GB' }
const AU: ListeningVoiceHint = { gender: 'male', accent: 'en-AU' }

/** Minimal in-memory localStorage on globalThis.window, same pattern as
 *  `tests/prefs.test.ts` — installed only where a test cares what
 *  `createSpeechDriver` reads from `loadPrefs()`. */
function installLocalStorage(): void {
  const map = new Map<string, string>()
  const stub = {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size
    },
  }
  ;(globalThis as unknown as { window: { localStorage: typeof stub } }).window = {
    localStorage: stub,
  }
}

/** The fields `SpeechSynthesisDriver` actually reads or writes on an
 *  utterance — deliberately narrower than the real `SpeechSynthesisUtterance`,
 *  which Node cannot construct or fire real events against. */
interface FakeUtterance {
  text: string
  voice: SpeechSynthesisVoice | null
  rate: number
  pitch: number
  onend: (() => void) | null
  onerror: (() => void) | null
}

/** A `SpeechEngine` whose `speak` resolves every utterance on the next
 *  microtask — deterministic, no real timers, no DOM. `utterances` records
 *  every one created, in order, so a test can inspect what the driver set. */
function fakeEngine(voices: readonly SpeechSynthesisVoice[]): {
  engine: SpeechEngine
  utterances: FakeUtterance[]
} {
  const utterances: FakeUtterance[] = []
  const engine: SpeechEngine = {
    synthesis: {
      getVoices: () => [...voices],
      speak: (utterance) => {
        const fake = utterance as unknown as FakeUtterance
        queueMicrotask(() => fake.onend?.())
      },
      cancel: () => {},
    },
    createUtterance: (text) => {
      const fake: FakeUtterance = { text, voice: null, rate: 1, pitch: 1, onend: null, onerror: null }
      utterances.push(fake)
      return fake as unknown as SpeechSynthesisUtterance
    },
  }
  return { engine, utterances }
}

/* ==================================== A1 ===================================== */

describe('rankVoices / pickVoice — quality-ranked selection', () => {
  it('never fails: no hint, or no voices, is null — not an exception', () => {
    expect(pickVoice([voice('Any', 'en-GB')], undefined)).toBeNull()
    expect(pickVoice([], GB)).toBeNull()
    expect(rankVoices([], GB)).toEqual([])
  })

  it('a quality marker beats earlier list position', () => {
    const plain = voice('Microsoft Zira', 'en-GB')
    const natural = voice('Microsoft Sonia Online (Natural)', 'en-GB')
    // Plain voice listed FIRST — platforms list compact voices first; the
    // ranking, not list order, must win.
    expect(pickVoice([plain, natural], GB)).toBe(natural)
  })

  it('a legacy marker loses to an unmarked voice, regardless of list order', () => {
    const legacy = voice('Fred', 'en-GB')
    const plain = voice('Daniel', 'en-GB')
    expect(pickVoice([legacy, plain], GB)).toBe(plain)
    // And the reverse order — the marker decides, not position.
    expect(pickVoice([plain, legacy], GB)).toBe(plain)
  })

  it('an exact BCP-47 match beats a same-primary-language voice, before quality markers apply', () => {
    const usNatural = voice('Ava (Natural)', 'en-US')
    const gbPlain = voice('Daniel', 'en-GB')
    // en-US "Natural" scores 1 (same-primary) + 4 (quality) = 5.
    // en-GB "Daniel" scores 3 (exact) + 0 = 3.
    // Quality still wins here — this pins the actual arithmetic, not just the ordering.
    expect(pickVoice([gbPlain, usNatural], GB)).toBe(usNatural)

    // Two otherwise-equal voices: exact accent wins.
    const usPlain = voice('Ava', 'en-US')
    expect(pickVoice([usPlain, gbPlain], GB)).toBe(gbPlain)
  })

  it('a voice in a different primary language is never usable, however it is named', () => {
    const french = voice('Amelie (Natural)', 'fr-FR')
    expect(pickVoice([french], GB)).toBeNull()
    expect(rankVoices([french], GB)).toEqual([])
  })

  it('ties keep the platform list order', () => {
    const a = voice('Alpha', 'en-GB')
    const b = voice('Beta', 'en-GB')
    expect(rankVoices([a, b], GB)).toEqual([a, b])
    expect(rankVoices([b, a], GB)).toEqual([b, a])
  })

  it('every declared marker actually participates (voiceQualityScore)', () => {
    for (const marker of QUALITY_VOICE_MARKERS) {
      expect(voiceQualityScore(voice(`Test ${marker} Voice`, 'en-GB'))).toBeGreaterThan(0)
    }
    for (const marker of LEGACY_VOICE_MARKERS) {
      expect(voiceQualityScore(voice(`Test ${marker} Voice`, 'en-GB'))).toBeLessThan(0)
    }
    expect(voiceQualityScore(voice('Plain Voice', 'en-GB'))).toBe(0)
  })

  it('preferredVoiceURI promotes a matching voice to the front, without changing pickVoice', () => {
    const a = voice('Alpha', 'en-GB', 'uri-a')
    const b = voice('Beta', 'en-GB', 'uri-b')
    // Equal score, so plain rankVoices keeps list order: a, b.
    expect(rankVoices([a, b], GB)).toEqual([a, b])
    // Preferring b moves it to the front.
    expect(rankVoices([a, b], GB, 'uri-b')).toEqual([b, a])
    // pickVoice's signature is unchanged — it never sees a preference.
    expect(pickVoice([a, b], GB)).toBe(a)
  })

  it('a preferredVoiceURI naming nothing on this platform changes nothing — never an error', () => {
    const a = voice('Alpha', 'en-GB', 'uri-a')
    const b = voice('Beta', 'en-GB', 'uri-b')
    expect(rankVoices([a, b], GB, 'uri-vanished')).toEqual([a, b])
  })
})

/* ==================================== A2 ===================================== */

describe('assignSectionVoices — distinct voices per speaker', () => {
  it('two speakers, two usable matches: distinct voices, no pitch nudge', () => {
    const a = voice('Alpha', 'en-GB')
    const b = voice('Beta', 'en-GB')
    const speakers = new Map<string, ListeningVoiceHint>([
      ['ROSS', GB],
      ['PETRA', GB],
    ])
    const resolved = assignSectionVoices([a, b], speakers)

    expect(resolved.get('ROSS')?.voice).toBe(a)
    expect(resolved.get('PETRA')?.voice).toBe(b)
    expect(resolved.get('ROSS')?.voice).not.toBe(resolved.get('PETRA')?.voice)
    expect(resolved.get('ROSS')?.pitchOffset).toBe(0)
    expect(resolved.get('PETRA')?.pitchOffset).toBe(0)
  })

  it('two speakers, only one usable match: same voice, alternating pitch', () => {
    const only = voice('Solo', 'en-GB')
    const speakers = new Map<string, ListeningVoiceHint>([
      ['ROSS', GB],
      ['PETRA', GB],
    ])
    const resolved = assignSectionVoices([only], speakers)

    expect(resolved.get('ROSS')?.voice).toBe(only)
    expect(resolved.get('PETRA')?.voice).toBe(only)
    expect(resolved.get('ROSS')?.pitchOffset).toBeGreaterThan(0)
    expect(resolved.get('PETRA')?.pitchOffset).toBeLessThan(0)
    expect(resolved.get('ROSS')?.pitchOffset).toBe(-(resolved.get('PETRA')?.pitchOffset ?? 0))
  })

  it('a single-speaker section gets no pitch nudge, even with one usable voice', () => {
    const only = voice('Solo', 'en-GB')
    const speakers = new Map<string, ListeningVoiceHint>([['NARRATOR', GB]])
    const resolved = assignSectionVoices([only], speakers)
    expect(resolved.get('NARRATOR')?.pitchOffset).toBe(0)
  })

  it('zero usable voices: null voice, still differentiated by pitch when there is more than one speaker', () => {
    const speakers = new Map<string, ListeningVoiceHint>([
      ['ROSS', GB],
      ['PETRA', GB],
    ])
    const resolved = assignSectionVoices([], speakers)
    expect(resolved.get('ROSS')?.voice).toBeNull()
    expect(resolved.get('PETRA')?.voice).toBeNull()
    expect(resolved.get('ROSS')?.pitchOffset).not.toBe(resolved.get('PETRA')?.pitchOffset)
  })

  it('three speakers round-robin over two usable voices, wrapping', () => {
    const a = voice('Alpha', 'en-GB')
    const b = voice('Beta', 'en-GB')
    const speakers = new Map<string, ListeningVoiceHint>([
      ['ONE', GB],
      ['TWO', GB],
      ['THREE', GB],
    ])
    const resolved = assignSectionVoices([a, b], speakers)
    expect(resolved.get('ONE')?.voice).toBe(a)
    expect(resolved.get('TWO')?.voice).toBe(b)
    expect(resolved.get('THREE')?.voice).toBe(a)
  })

  it('different accents are ranked and assigned independently', () => {
    const gbOne = voice('GB One', 'en-GB')
    const gbTwo = voice('GB Two', 'en-GB')
    const auOne = voice('AU One', 'en-AU')
    const speakers = new Map<string, ListeningVoiceHint>([
      ['ROSS', GB],
      ['PETRA', GB],
      ['JOANNA', AU],
    ])
    const resolved = assignSectionVoices([gbOne, gbTwo, auOne], speakers)
    expect(resolved.get('ROSS')?.voice).toBe(gbOne)
    expect(resolved.get('PETRA')?.voice).toBe(gbTwo)
    expect(resolved.get('JOANNA')?.voice).toBe(auOne)
  })

  it('a preferredVoiceURI is promoted within every accent group it appears in', () => {
    const a = voice('Alpha', 'en-GB', 'uri-a')
    const b = voice('Beta', 'en-GB', 'uri-b')
    const speakers = new Map<string, ListeningVoiceHint>([
      ['ROSS', GB],
      ['PETRA', GB],
    ])
    // Without a preference, list order stands: ROSS gets a, PETRA gets b.
    // With b preferred, ROSS (first in insertion order) gets the preference.
    const resolved = assignSectionVoices([a, b], speakers, 'uri-b')
    expect(resolved.get('ROSS')?.voice).toBe(b)
    expect(resolved.get('PETRA')?.voice).toBe(a)
  })
})

/* ============================ A1+A2 integration ============================== */

describe('SpeechSynthesisDriver applies the ranking and the assignment', () => {
  it('gives two speakers in the same section distinct voices, consistently across their cues', async () => {
    const a = voice('Alpha', 'en-GB')
    const b = voice('Beta', 'en-GB')
    const { engine, utterances } = fakeEngine([a, b])
    const driver = new SpeechSynthesisDriver(engine)

    const cues: SpeechCue[] = [
      { id: 'c1', speaker: 'ROSS', text: 'Hello.', voice: GB },
      { id: 'c2', speaker: 'PETRA', text: 'Hi.', voice: GB },
      { id: 'c3', speaker: 'ROSS', text: 'How can I help?', voice: GB },
    ]
    const outcome = await driver.play(cues)

    expect(outcome).toBe('completed')
    expect(utterances).toHaveLength(3)
    // ROSS keeps the same voice across both of his cues.
    expect(utterances[0].voice).toBe(utterances[2].voice)
    expect(utterances[0].voice).not.toBe(utterances[1].voice)
    expect(new Set(utterances.map((u) => u.voice))).toEqual(new Set([a, b]))
  })

  it('threads a preferredVoiceURI from construction onto the utterance', async () => {
    const a = voice('Alpha', 'en-GB', 'uri-a')
    const b = voice('Beta', 'en-GB', 'uri-b')
    const { engine, utterances } = fakeEngine([a, b])
    const driver = new SpeechSynthesisDriver(engine, 'uri-b')

    await driver.play([{ id: 'c1', speaker: 'NARRATOR', text: 'Welcome.', voice: GB }])

    expect(utterances[0].voice).toBe(b)
  })

  it('createSpeechDriver reads preferredVoiceURI from prefs at construction', async () => {
    installLocalStorage()
    savePrefs({ preferredVoiceURI: 'uri-b' })

    const a = voice('Alpha', 'en-GB', 'uri-a')
    const b = voice('Beta', 'en-GB', 'uri-b')
    const { engine, utterances } = fakeEngine([a, b])
    const driver = createSpeechDriver({ engine })
    expect(driver.kind).toBe('speech-synthesis')

    await driver.play([{ id: 'c1', speaker: 'NARRATOR', text: 'Welcome.', voice: GB }])

    expect(utterances[0].voice).toBe(b)
  })
})

describe('createSpeechDriver still falls back to the paced transcript when there is no engine', () => {
  it('reports transcript-pace, unaffected by any preference (baseline behaviour, unchanged)', () => {
    expect(createSpeechDriver({ engine: null }).kind).toBe('transcript-pace')
  })
})
