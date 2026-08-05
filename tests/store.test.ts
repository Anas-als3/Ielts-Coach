/**
 * Store migration and backup (SPEC.md "profile/").
 *
 * Regression suite for the bug where any schemaVersion change silently
 * destroyed every saved session: `readStore` returned null on a version
 * mismatch, `loadSessions` turned that into [], and `saveSession` then wrote
 * that empty list plus one record back over the storage key. A learner with 60
 * essays lost all of them on their next submit, with no warning.
 *
 * Every case drives the REAL exported API (loadSessions / saveSession /
 * importData) against an in-memory localStorage, so these tests pin the
 * migration ladder and the backup-before-clobber safety net together.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { importData, loadSessions, saveSession } from '../src/profile/store'
import type { SessionRecord, TaskKind } from '../src/types'

/* --------------------------------- helpers ---------------------------------- */

const STORAGE_KEY = 'ielts-coach.v1'
const BACKUP_PREFIX = 'ielts-coach.backup.'

/**
 * Minimal in-memory localStorage on globalThis.window. The store reads
 * `window.localStorage` at call time, not at module load, so installing this in
 * beforeEach is enough — no module mocking needed.
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
  // The store warns to the console on every backup — expected, not a failure.
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

/** A record that passes `looksLikeSession`. `task` omitted unless overridden. */
function makeSession(id: string, dateISO: string, overrides: Record<string, unknown> = {}): unknown {
  return {
    id,
    dateISO,
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
      stats: {
        wordCount: 260,
        sentenceCount: 12,
        paragraphCount: 4,
        avgSentenceLength: 21.6,
        sentenceLengthStdDev: 6.1,
        typeTokenRatio: 0.62,
        linkingDeviceCount: 9,
      },
      band: {
        overall: 7,
        byCriterion: { TR: 7, CC: 7, LR: 7, GRA: 7 },
        rationale: { TR: ['ok'], CC: ['ok'], LR: ['ok'], GRA: ['ok'] },
      },
    },
    ...overrides,
  }
}

/** A brand-new record as App.tsx would build it today (schemaVersion 2 shape). */
function newRecord(id: string, dateISO: string, task: TaskKind = 'task2'): SessionRecord {
  return makeSession(id, dateISO, { task }) as SessionRecord
}

function seed(schemaVersion: number, sessions: unknown[]): void {
  store.set(STORAGE_KEY, JSON.stringify({ schemaVersion, sessions }))
}

function backupKeys(): string[] {
  return Array.from(store.keys()).filter((k) => k.startsWith(BACKUP_PREFIX))
}

/* ------------------------------- v1 migration ------------------------------- */

describe('v1 -> v2 migration', () => {
  it('does not destroy a v1 store when a new session is saved', () => {
    seed(1, [
      makeSession('a', '2026-01-01T10:00:00.000Z'),
      makeSession('b', '2026-01-02T10:00:00.000Z'),
      makeSession('c', '2026-01-03T10:00:00.000Z'),
    ])

    saveSession(newRecord('d', '2026-01-04T10:00:00.000Z'))

    const sessions = loadSessions()
    expect(sessions).toHaveLength(4)
    expect(sessions.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(sessions.every((s) => s.task === 'task2')).toBe(true)
  })

  it('migrates on read without rewriting the stored payload', () => {
    seed(1, [
      makeSession('a', '2026-01-01T10:00:00.000Z'),
      makeSession('b', '2026-01-02T10:00:00.000Z'),
      makeSession('c', '2026-01-03T10:00:00.000Z'),
    ])

    const sessions = loadSessions()
    expect(sessions).toHaveLength(3)
    expect(sessions.every((s) => s.task === 'task2')).toBe(true)

    // Reads are pure: the raw payload is still v1 until something writes.
    const raw = JSON.parse(store.get(STORAGE_KEY) as string)
    expect(raw.schemaVersion).toBe(1)
    expect(raw.sessions[0].task).toBeUndefined()
  })

  it('round-trips a v2 store and preserves a task1 record', () => {
    seed(2, [
      makeSession('a', '2026-01-01T10:00:00.000Z', { task: 'task1' }),
      makeSession('b', '2026-01-02T10:00:00.000Z', { task: 'task2' }),
    ])

    const sessions = loadSessions()
    expect(sessions.map((s) => s.task)).toEqual(['task1', 'task2'])
  })

  it('drops only the record whose task value is invalid', () => {
    seed(2, [
      makeSession('a', '2026-01-01T10:00:00.000Z', { task: 'task2' }),
      makeSession('bad', '2026-01-02T10:00:00.000Z', { task: 'speaking' }),
      makeSession('c', '2026-01-03T10:00:00.000Z', { task: 'task1' }),
    ])

    expect(loadSessions().map((s) => s.id)).toEqual(['a', 'c'])
  })
})

/* --------------------------- backup before clobber --------------------------- */

describe('backup before overwriting unreadable data', () => {
  it('backs up an unknown future version instead of destroying it', () => {
    const payload = { schemaVersion: 99, sessions: [makeSession('a', '2026-01-01T10:00:00.000Z')] }
    store.set(STORAGE_KEY, JSON.stringify(payload))

    saveSession(newRecord('new', '2026-02-01T10:00:00.000Z'))

    const keys = backupKeys()
    expect(keys).toHaveLength(1)
    expect(JSON.parse(store.get(keys[0]) as string)).toEqual(payload)

    // The live key moved on, but nothing was lost.
    expect(loadSessions().map((s) => s.id)).toEqual(['new'])
  })

  it('backs up corrupt JSON rather than discarding it silently', () => {
    store.set(STORAGE_KEY, '{not json')

    expect(loadSessions()).toEqual([])

    const keys = backupKeys()
    expect(keys).toHaveLength(1)
    expect(store.get(keys[0])).toBe('{not json')
  })
})

/* ---------------------------------- import ---------------------------------- */

describe('importData', () => {
  it('migrates a v1 export forward', () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      sessions: [
        makeSession('x', '2026-03-01T10:00:00.000Z'),
        makeSession('y', '2026-03-02T10:00:00.000Z'),
      ],
    })

    importData(json)

    const sessions = loadSessions()
    expect(sessions.map((s) => s.id)).toEqual(['x', 'y'])
    expect(sessions.every((s) => s.task === 'task2')).toBe(true)
  })

  it('rejects a file exported by a newer version', () => {
    const json = JSON.stringify({ schemaVersion: 99, sessions: [] })

    expect(() => importData(json)).toThrow(/newer version/i)
  })
})
