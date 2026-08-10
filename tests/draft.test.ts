/**
 * The scratch-draft module (SPEC.md "profile/" — the draft subsection).
 *
 * `draft.ts` treats stored bytes as hostile wire, exactly like `store.ts`:
 * every field is validated on read and any field failing validation
 * invalidates the whole draft. These cases pin that validator field by field,
 * plus the round-trip, the throw-swallowing, `clearDraft`'s no-op case, and
 * the `isExamDraftExpired` truth table.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DRAFT_KEY,
  clearDraft,
  isExamDraftExpired,
  loadDraft,
  saveDraft,
  type WritingDraft,
} from '../src/profile/draft'

/* --------------------------------- helpers ---------------------------------- */

/**
 * Minimal in-memory localStorage on globalThis.window. `draft.ts` reads
 * `window.localStorage` at call time, not at module load, so installing this
 * in beforeEach is enough — no module mocking needed. Modelled on
 * `tests/store.test.ts`'s `installLocalStorage`.
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
  // draft.ts warns to the console on a read/write failure — expected, not a
  // test failure.
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

/** A valid coach draft, overridable field by field. */
function makeDraft(overrides: Partial<WritingDraft> = {}): WritingDraft {
  return {
    task: 'task2',
    module: 'academic',
    promptId: 'op-01',
    essayText: 'A draft essay in progress.',
    mode: 'coach',
    examDeadlineEpochMs: null,
    savedAtISO: '2026-08-10T12:00:00.000Z',
    ...overrides,
  }
}

/* ---------------------------------- tests ----------------------------------- */

describe('round-trip', () => {
  it('1. round-trips a coach draft', () => {
    const draft = makeDraft()
    saveDraft(draft)
    expect(loadDraft()).toEqual(draft)
  })

  it('2. round-trips an exam draft with a numeric examDeadlineEpochMs', () => {
    const draft = makeDraft({ mode: 'exam', examDeadlineEpochMs: 1_800_000_000_000 })
    saveDraft(draft)
    expect(loadDraft()).toEqual(draft)
  })
})

describe('loadDraft validation', () => {
  it('3. returns null when the key is absent', () => {
    expect(loadDraft()).toBeNull()
  })

  it('4. returns null when the payload is not JSON', () => {
    store.set(DRAFT_KEY, 'not json{')
    expect(loadDraft()).toBeNull()
  })

  it('5. returns null when the payload is JSON but not an object', () => {
    store.set(DRAFT_KEY, '42')
    expect(loadDraft()).toBeNull()
  })

  it('6. returns null when task is not task1 | task2', () => {
    store.set(DRAFT_KEY, JSON.stringify({ ...makeDraft(), task: 'task9' }))
    expect(loadDraft()).toBeNull()
  })

  it('7. returns null when module is invalid', () => {
    store.set(DRAFT_KEY, JSON.stringify({ ...makeDraft(), module: 'business' }))
    expect(loadDraft()).toBeNull()
  })

  it('8. returns null when mode is invalid', () => {
    store.set(DRAFT_KEY, JSON.stringify({ ...makeDraft(), mode: 'zen' }))
    expect(loadDraft()).toBeNull()
  })

  it('9. returns null when essayText is missing or not a string', () => {
    const { essayText: _omit, ...withoutEssayText } = makeDraft()
    store.set(DRAFT_KEY, JSON.stringify(withoutEssayText))
    expect(loadDraft()).toBeNull()

    store.set(DRAFT_KEY, JSON.stringify({ ...makeDraft(), essayText: 42 }))
    expect(loadDraft()).toBeNull()
  })

  it('10. returns null when essayText has zero words', () => {
    store.set(DRAFT_KEY, JSON.stringify({ ...makeDraft(), essayText: '' }))
    expect(loadDraft()).toBeNull()

    store.set(DRAFT_KEY, JSON.stringify({ ...makeDraft(), essayText: '   ...!!!' }))
    expect(loadDraft()).toBeNull()
  })

  it('11. returns null when examDeadlineEpochMs is neither null nor finite', () => {
    store.set(DRAFT_KEY, JSON.stringify({ ...makeDraft(), examDeadlineEpochMs: 'soon' }))
    expect(loadDraft()).toBeNull()

    // `JSON.stringify(NaN)` serialises to `null`, which is a VALID value, so a
    // literal NaN cannot survive a round trip — it would silently test the
    // null case instead of the finite check. `1e1000` is valid JSON (a
    // numeric literal) that `JSON.parse` overflows to `Infinity`, which IS a
    // number but is not finite, so it exercises the same `Number.isFinite`
    // branch the plan's "NaN" case names.
    store.set(
      DRAFT_KEY,
      `{"task":"task2","module":"academic","promptId":"op-01","essayText":"A draft essay in progress.","mode":"exam","examDeadlineEpochMs":1e1000,"savedAtISO":"2026-08-10T12:00:00.000Z"}`,
    )
    expect(loadDraft()).toBeNull()
  })
})

describe('storage failures are swallowed', () => {
  it('12. neither loadDraft nor saveDraft throws when the underlying storage call throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('storage unavailable')
      },
      setItem: () => {
        throw new Error('storage unavailable')
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    }
    ;(globalThis as unknown as { window: { localStorage: typeof throwing } }).window = {
      localStorage: throwing,
    }
    expect(() => saveDraft(makeDraft())).not.toThrow()
    expect(() => loadDraft()).not.toThrow()
    expect(loadDraft()).toBeNull()
  })
})

describe('clearDraft', () => {
  it('13. removes the key, and is a no-op when the key is absent', () => {
    saveDraft(makeDraft())
    expect(store.has(DRAFT_KEY)).toBe(true)
    clearDraft()
    expect(store.has(DRAFT_KEY)).toBe(false)
    expect(() => clearDraft()).not.toThrow()
    expect(store.has(DRAFT_KEY)).toBe(false)
  })
})

describe('isExamDraftExpired', () => {
  it('14. is true only for a running exam whose deadline has passed', () => {
    const now = 1_800_000_000_000
    // A coach draft is never "expired", even with a past deadline value —
    // that field means nothing outside exam mode.
    expect(isExamDraftExpired(makeDraft({ mode: 'coach', examDeadlineEpochMs: now - 1000 }), now)).toBe(
      false,
    )
    // A future deadline: the exam is still running.
    expect(
      isExamDraftExpired(makeDraft({ mode: 'exam', examDeadlineEpochMs: now + 1000 }), now),
    ).toBe(false)
    // A past-or-equal deadline: expired.
    expect(
      isExamDraftExpired(makeDraft({ mode: 'exam', examDeadlineEpochMs: now - 1000 }), now),
    ).toBe(true)
    expect(isExamDraftExpired(makeDraft({ mode: 'exam', examDeadlineEpochMs: now }), now)).toBe(true)
    // A null deadline is exam-idle, never "expired".
    expect(isExamDraftExpired(makeDraft({ mode: 'exam', examDeadlineEpochMs: null }), now)).toBe(
      false,
    )
  })
})
