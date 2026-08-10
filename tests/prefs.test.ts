/**
 * `ielts-coach.prefs.v1` (SPEC.md "Preferences"). A SEPARATE key from the
 * session store, so a preference write can never race or damage learner work.
 * These cases pin the two properties that make that safe: reads never throw
 * on hostile data, and writes never drop a field this build does not know
 * about (the plan-027 contract).
 *
 * Same in-memory localStorage stub as `tests/store.test.ts` — the module
 * reads `window.localStorage` at call time, so installing it in `beforeEach`
 * is enough, no module mocking needed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadPrefs, savePrefs } from '../src/profile/prefs'

const PREFS_KEY = 'ielts-coach.prefs.v1'

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
    store.set(PREFS_KEY, '42')
    expect(loadPrefs()).toEqual({})
    store.set(PREFS_KEY, '[1,2]')
    expect(loadPrefs()).toEqual({})
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

  it('a throwing setItem is swallowed, not propagated', () => {
    const stub = (globalThis as unknown as { window: { localStorage: Storage } }).window
      .localStorage
    stub.setItem = () => {
      throw new Error('quota exceeded')
    }
    expect(() => savePrefs({ introDismissedAtISO: '2026-08-10T00:00:00.000Z' })).not.toThrow()
  })
})
