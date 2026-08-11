/**
 * `ielts-coach.prefs.v1` (SPEC.md "Preferences"). A SEPARATE key from the
 * session store, so a preference write can never race or damage learner work.
 * These cases pin the properties that make that safe: reads never throw on
 * hostile data, writes never drop a field this build does not know about
 * (the plan-026 contract, extended by plan 027), and each plan-027 field
 * (exam date, target bands, exam type) is validated INDEPENDENTLY — one
 * hostile value must not take a good one down with it. `buildExportJson` /
 * `importData`'s prefs rider is pinned separately, in the cases below that
 * import from `../src/profile/store`.
 *
 * Same in-memory localStorage stub as `tests/store.test.ts` — the module
 * reads `window.localStorage` at call time, so installing it in `beforeEach`
 * is enough, no module mocking needed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { daysUntil, loadPrefs, sanitizePrefs, savePrefs } from '../src/profile/prefs'
import { buildExportJson, importData } from '../src/profile/store'

const PREFS_KEY = 'ielts-coach.prefs.v1'
const STORAGE_KEY = 'ielts-coach.v1'

/**
 * Minimal in-memory localStorage on globalThis.window. The store reads
 * `window.localStorage` at call time, not at module load, so installing this
 * in beforeEach is enough — no module mocking needed.
 */
function installLocalStorage(): Map<string, string> {
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
  return map
}

let store: Map<string, string>

beforeEach(() => {
  store = installLocalStorage()
  // savePrefs warns to the console on a write failure — expected, not a
  // failure of the test itself (tests/store.test.ts:54 does the same).
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('loadPrefs reads defensively', () => {
  it('missing key returns {}', () => {
    expect(loadPrefs()).toEqual({})
  })

  it('malformed JSON returns {} without throwing', () => {
    store.set(PREFS_KEY, '{not json')
    expect(() => loadPrefs()).not.toThrow()
    expect(loadPrefs()).toEqual({})
  })

  it('non-object JSON returns {}', () => {
    for (const raw of ['42', '[]', '[1,2]', '"hi"', 'null']) {
      store.set(PREFS_KEY, raw)
      expect(loadPrefs()).toEqual({})
    }
  })

  it('a wrong-typed field is discarded', () => {
    store.set(PREFS_KEY, '{"introDismissedAtISO":7}')
    expect(loadPrefs()).toEqual({})
  })
})

describe('savePrefs writes safely', () => {
  it('round-trips a written field', () => {
    savePrefs({ introDismissedAtISO: '2026-08-10T00:00:00.000Z' })
    expect(loadPrefs()).toEqual({ introDismissedAtISO: '2026-08-10T00:00:00.000Z' })
  })

  it('round-trips every plan-027 field together', () => {
    savePrefs({
      examDateISO: '2026-11-07',
      targetOverall: 7,
      targetBySection: { writing: 6.5 },
      module: 'general',
    })
    expect(loadPrefs()).toEqual({
      examDateISO: '2026-11-07',
      targetOverall: 7,
      targetBySection: { writing: 6.5 },
      module: 'general',
    })
  })

  it('preserves an unknown field across a write (plan-027 contract)', () => {
    store.set(
      PREFS_KEY,
      JSON.stringify({ introDismissedAtISO: '2026-08-10T00:00:00.000Z', futureField: true }),
    )
    savePrefs({ introDismissedAtISO: '2026-08-11T00:00:00.000Z' })
    const raw = JSON.parse(store.get(PREFS_KEY) as string) as Record<string, unknown>
    expect(raw.futureField).toBe(true)
    expect(raw.introDismissedAtISO).toBe('2026-08-11T00:00:00.000Z')
  })

  it('merge-on-write preserves a field this build does not own AT ALL, beside a field it does (the 026 contract, pinned)', () => {
    store.set(
      PREFS_KEY,
      JSON.stringify({ introDismissedAtISO: '2026-08-01T00:00:00.000Z', futureField: 123 }),
    )
    savePrefs({ targetOverall: 7 })
    const raw = JSON.parse(store.get(PREFS_KEY) as string) as Record<string, unknown>
    expect(raw.introDismissedAtISO).toBe('2026-08-01T00:00:00.000Z')
    expect(raw.futureField).toBe(123)
    expect(raw.targetOverall).toBe(7)
  })

  it('an explicit undefined in the patch clears that field on disk, leaving its neighbour', () => {
    savePrefs({ examDateISO: '2026-11-07', targetOverall: 7 })
    savePrefs({ targetOverall: undefined })
    expect(loadPrefs().targetOverall).toBeUndefined()
    const raw = JSON.parse(store.get(PREFS_KEY) as string) as Record<string, unknown>
    expect('targetOverall' in raw).toBe(false)
    expect(loadPrefs().examDateISO).toBe('2026-11-07')
  })

  it('a throwing setItem is swallowed, not propagated', () => {
    const stub = (globalThis as unknown as { window: { localStorage: Storage } }).window
      .localStorage
    stub.setItem = () => {
      throw new Error('quota exceeded')
    }
    expect(() => savePrefs({ introDismissedAtISO: '2026-08-10T00:00:00.000Z' })).not.toThrow()
  })
})

describe('sanitizePrefs drops a hostile targetOverall, field by field', () => {
  const hostileValues: unknown[] = [3.5, 9.5, 7.25, '7', NaN, Infinity]

  it.each(hostileValues)('drops targetOverall = %p but keeps examDateISO beside it', (bad) => {
    const prefs = sanitizePrefs({ examDateISO: '2026-11-07', targetOverall: bad })
    expect(prefs.targetOverall).toBeUndefined()
    expect(prefs.examDateISO).toBe('2026-11-07')
  })

  it('the JSON-representable hostile values are dropped when they arrive through real storage too', () => {
    for (const bad of [3.5, 9.5, 7.25, '7']) {
      store.set(PREFS_KEY, JSON.stringify({ examDateISO: '2026-11-07', targetOverall: bad }))
      const prefs = loadPrefs()
      expect(prefs.targetOverall).toBeUndefined()
      expect(prefs.examDateISO).toBe('2026-11-07')
    }
  })
})

describe('sanitizePrefs drops a hostile examDateISO, field by field', () => {
  const hostileDates: unknown[] = ['not-a-date', '2026-13-40', '07/11/2026', 20261107]

  it.each(hostileDates)('drops examDateISO = %p but keeps targetOverall beside it', (bad) => {
    const prefs = sanitizePrefs({ examDateISO: bad, targetOverall: 7 })
    expect(prefs.examDateISO).toBeUndefined()
    expect(prefs.targetOverall).toBe(7)
  })
})

describe('sanitizePrefs drops a hostile module', () => {
  const hostileModules: unknown[] = ['speaking', '', 7]

  it.each(hostileModules)('drops module = %p', (bad) => {
    expect(sanitizePrefs({ module: bad }).module).toBeUndefined()
  })

  it('keeps a recognised module', () => {
    expect(sanitizePrefs({ module: 'general' }).module).toBe('general')
  })
})

describe('sanitizePrefs filters targetBySection per section', () => {
  it('keeps only the known sections holding a valid band, drops the rest', () => {
    const prefs = sanitizePrefs({ targetBySection: { writing: 6.5, speaking: 7, reading: 11 } })
    expect(prefs.targetBySection).toEqual({ writing: 6.5 })
  })

  it('omits the field entirely when nothing in it survives', () => {
    const prefs = sanitizePrefs({ targetBySection: { speaking: 7 } })
    expect(prefs.targetBySection).toBeUndefined()
  })
})

describe('sanitizePrefs validates preferredVoiceURI (plan 032)', () => {
  it('keeps a plausible voiceURI', () => {
    expect(sanitizePrefs({ preferredVoiceURI: 'Microsoft Sonia Online (Natural)' }).preferredVoiceURI).toBe(
      'Microsoft Sonia Online (Natural)',
    )
  })

  it('drops an empty string but keeps a neighbour field', () => {
    const prefs = sanitizePrefs({ preferredVoiceURI: '', examDateISO: '2026-11-07' })
    expect(prefs.preferredVoiceURI).toBeUndefined()
    expect(prefs.examDateISO).toBe('2026-11-07')
  })

  it('drops a wrong-typed value, field by field', () => {
    for (const bad of [7, null, {}, [], true]) {
      expect(sanitizePrefs({ preferredVoiceURI: bad, targetOverall: 7 })).toEqual({ targetOverall: 7 })
    }
  })

  it('drops a URI far longer than any real voiceURI, rather than storing it unbounded', () => {
    const prefs = sanitizePrefs({ preferredVoiceURI: 'x'.repeat(301) })
    expect(prefs.preferredVoiceURI).toBeUndefined()
  })

  it('keeps a URI right at the length boundary', () => {
    const uri = 'x'.repeat(300)
    expect(sanitizePrefs({ preferredVoiceURI: uri }).preferredVoiceURI).toBe(uri)
  })

  it('round-trips through savePrefs/loadPrefs', () => {
    savePrefs({ preferredVoiceURI: 'Google UK English Female' })
    expect(loadPrefs()).toEqual({ preferredVoiceURI: 'Google UK English Female' })
  })

  it('an explicit undefined clears it, leaving a neighbour field alone', () => {
    savePrefs({ preferredVoiceURI: 'Some Voice', targetOverall: 7 })
    savePrefs({ preferredVoiceURI: undefined })
    expect(loadPrefs()).toEqual({ targetOverall: 7 })
  })
})

describe('daysUntil', () => {
  it('the exam date itself is 0', () => {
    expect(daysUntil('2026-08-10', new Date(2026, 7, 10, 15, 30))).toBe(0)
  })

  it('ten calendar days out is 10', () => {
    expect(daysUntil('2026-08-20', new Date(2026, 7, 10))).toBe(10)
  })

  it('a date already passed is negative', () => {
    expect(daysUntil('2026-08-01', new Date(2026, 7, 10))).toBe(-9)
  })

  it('an unparseable date is null', () => {
    expect(daysUntil('2026-13-40', new Date(2026, 7, 10))).toBeNull()
  })
})

/**
 * The export/import rider (SPEC.md "Preferences"): `buildExportJson` adds a
 * `prefs` field when non-empty, `importData` restores it AFTER the file has
 * validated — sanitized field-by-field, same as a normal read — so prefs
 * never rescue a bad file and a bad prefs value never poisons a good import.
 * `tests/store.test.ts` stays untouched (016's territory); these cases drive
 * `buildExportJson`/`importData` from `../src/profile/store` instead.
 */
describe('prefs ride the export additively', () => {
  it('the export carries saved prefs', () => {
    savePrefs({ targetOverall: 7 })
    const parsed = JSON.parse(buildExportJson()) as { schemaVersion: number; prefs?: { targetOverall?: number } }
    // Tracks whatever SCHEMA_VERSION currently is (6, since delete tombstones
    // landed) — not the digit itself; see tests/store.test.ts's convention.
    expect(parsed.schemaVersion).toBe(6)
    expect(parsed.prefs?.targetOverall).toBe(7)
  })

  it('the export omits the field entirely when no prefs exist', () => {
    const parsed = JSON.parse(buildExportJson()) as Record<string, unknown>
    expect('prefs' in parsed).toBe(false)
  })

  it('export then import round-trips prefs, sessions intact', () => {
    // A minimal record that passes `looksLikeSession` (mirrors the fixture
    // tests/store.test.ts:58-91 uses), so "sessions intact" is checked against
    // real session data, not just an empty array both sides agree on trivially.
    const session = {
      id: 's1',
      dateISO: '2026-08-01T00:00:00.000Z',
      mode: 'coach',
      promptId: 'op-01',
      promptText: 'Some prompt text.',
      questionType: 'opinion',
      essayText: 'An essay.',
      durationSec: null,
      pacing: null,
      pasteAttempts: null,
      analysis: {
        issues: [],
        paragraphs: [],
        structure: [],
        stats: { wordCount: 260 },
        band: {
          overall: 7,
          byCriterion: { TR: 7, CC: 7, LR: 7, GRA: 7 },
          rationale: { TR: ['ok'], CC: ['ok'], LR: ['ok'], GRA: ['ok'] },
        },
      },
    }
    store.set(STORAGE_KEY, JSON.stringify({ schemaVersion: 5, sessions: [session] }))
    savePrefs({ targetOverall: 7, module: 'general' })

    const json = buildExportJson()
    store.clear()
    importData(json)

    expect(loadPrefs()).toEqual({ targetOverall: 7, module: 'general' })
    const restored = JSON.parse(store.get(STORAGE_KEY) as string) as { sessions: Array<{ id: string }> }
    expect(restored.sessions.map((s) => s.id)).toEqual(['s1'])
  })

  it('importing a file without prefs leaves the current prefs alone', () => {
    savePrefs({ targetOverall: 7 })
    importData(JSON.stringify({ schemaVersion: 5, sessions: [] }))
    expect(loadPrefs()).toEqual({ targetOverall: 7 })
  })

  it("hostile prefs in an imported file don't poison the import — the file's good fields still restore", () => {
    store.set(STORAGE_KEY, JSON.stringify({ schemaVersion: 5, sessions: [] }))
    importData(
      JSON.stringify({
        schemaVersion: 5,
        sessions: [],
        prefs: { targetOverall: 99, examDateISO: '2026-11-07' },
      }),
    )
    expect(loadPrefs()).toEqual({ examDateISO: '2026-11-07' })
  })

  it("an invalid file's prefs never rescue it — import throws and prefs are untouched", () => {
    savePrefs({ targetOverall: 7 })
    expect(() =>
      importData(
        JSON.stringify({ schemaVersion: 99, sessions: [], prefs: { targetOverall: 5 } }),
      ),
    ).toThrow()
    expect(loadPrefs()).toEqual({ targetOverall: 7 })
  })
})
