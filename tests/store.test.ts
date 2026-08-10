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

/**
 * A brand-new record as App.tsx would build it today (schemaVersion 4 shape).
 *
 * It carries `section` because App.tsx stamps it at the point of creation:
 * the migration ladder is for records written by OLDER builds, and a record
 * this build writes must already be in this build's shape. `makeSession` is
 * the deliberately pre-v2 wire shape and stays that way — that is what the
 * migration cases feed in.
 */
function newRecord(id: string, dateISO: string, task: TaskKind = 'task2'): SessionRecord {
  return makeSession(id, dateISO, { task, section: 'writing' }) as SessionRecord
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

/* ------------------------- v4: the Reading variant --------------------------- */

/**
 * A Reading session on the wire, as schemaVersion 4 writes one.
 *
 * Nothing in common with a writing record but `id`, `dateISO` and `module` —
 * which is the whole argument for the discriminated union, and the reason
 * `looksLikeSession` has to branch before it looks for an essay.
 */
function makeReadingSession(
  id: string,
  dateISO: string,
  overrides: Record<string, unknown> = {},
): unknown {
  return {
    section: 'reading',
    id,
    dateISO,
    module: 'academic',
    testId: 'reading-academic-01',
    testTitle: 'Academic Reading Test 1',
    answers: { 'ac1-q01': 'ii', 'ac1-q13': 'NOT GIVEN' },
    durationSec: 3480,
    result: {
      testId: 'reading-academic-01',
      module: 'academic',
      raw: 30,
      total: 40,
      band: 7,
      questions: [],
      byType: [],
    },
    ...overrides,
  }
}

describe('v3 -> v4 migration', () => {
  it('stamps section: writing on every pre-v4 record', () => {
    seed(3, [
      makeSession('a', '2026-01-01T10:00:00.000Z', { task: 'task2', module: 'academic' }),
      makeSession('b', '2026-01-02T10:00:00.000Z', { task: 'task1', module: 'general' }),
    ])

    const sessions = loadSessions()

    expect(sessions).toHaveLength(2)
    // Reading did not exist before v4, so a record without the field can only
    // be an essay, a chart answer or a letter.
    expect(sessions.every((s) => s.section === 'writing')).toBe(true)
  })

  it('migrates on read without rewriting the stored payload', () => {
    seed(3, [makeSession('a', '2026-01-01T10:00:00.000Z', { task: 'task2', module: 'academic' })])

    expect(loadSessions()[0].section).toBe('writing')

    const raw = JSON.parse(store.get(STORAGE_KEY) as string)
    expect(raw.schemaVersion).toBe(3)
    expect(raw.sessions[0].section).toBeUndefined()
  })
})

/* --------------- the whole ladder: v1 -> v4 in a SINGLE read ----------------- */

describe('v1 -> v4 in a single read', () => {
  it('climbs all three rungs, stamping task, then module, then section', () => {
    // A learner who last opened the app before ANY of the three discriminators
    // existed. Plan 001 exists because a schemaVersion bump once destroyed
    // exactly this person's history.
    seed(1, [
      makeSession('a', '2026-01-01T10:00:00.000Z'),
      makeSession('b', '2026-01-02T10:00:00.000Z'),
      makeSession('c', '2026-01-03T10:00:00.000Z'),
    ])

    const sessions = loadSessions()

    expect(sessions.map((s) => s.id)).toEqual(['a', 'b', 'c'])
    expect(sessions.every((s) => s.task === 'task2')).toBe(true)
    expect(sessions.every((s) => s.module === 'academic')).toBe(true)
    expect(sessions.every((s) => s.section === 'writing')).toBe(true)

    // One read did all three. Reads stay pure: the payload is still v1.
    const raw = JSON.parse(store.get(STORAGE_KEY) as string)
    expect(raw.schemaVersion).toBe(1)
    expect(raw.sessions[0].task).toBeUndefined()
    expect(raw.sessions[0].module).toBeUndefined()
    expect(raw.sessions[0].section).toBeUndefined()
  })

  it('keeps a v1 history intact across the save that rewrites it as v4', () => {
    seed(1, [
      makeSession('a', '2026-01-01T10:00:00.000Z'),
      makeSession('b', '2026-01-02T10:00:00.000Z'),
      makeSession('c', '2026-01-03T10:00:00.000Z'),
    ])

    saveSession(newRecord('d', '2026-01-04T10:00:00.000Z'))

    const sessions = loadSessions()
    expect(sessions.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(sessions.every((s) => s.section === 'writing')).toBe(true)
    expect(JSON.parse(store.get(STORAGE_KEY) as string).schemaVersion).toBe(4)
  })

  it('lets a v1 store gain a Reading session without losing an essay', () => {
    seed(1, [makeSession('old', '2026-01-01T10:00:00.000Z')])

    saveSession(makeReadingSession('read', '2026-01-05T10:00:00.000Z') as never)

    const sessions = loadSessions()
    expect(sessions.map((s) => s.id)).toEqual(['old', 'read'])
    expect(sessions.map((s) => s.section)).toEqual(['writing', 'reading'])
  })
})

/* --------------------------- reading records survive ------------------------ */

describe('Reading sessions round-trip', () => {
  it('keeps a Reading session and a writing session side by side', () => {
    seed(4, [
      makeSession('essay', '2026-01-01T10:00:00.000Z', {
        task: 'task2',
        module: 'academic',
        section: 'writing',
      }),
      makeReadingSession('paper', '2026-01-02T10:00:00.000Z'),
    ])

    const sessions = loadSessions()
    expect(sessions.map((s) => s.id)).toEqual(['essay', 'paper'])
    expect(sessions.map((s) => s.section)).toEqual(['writing', 'reading'])

    const reading = sessions[1]
    if (reading.section !== 'reading') throw new Error('expected a Reading session')
    expect(reading.result.raw).toBe(30)
    expect(reading.result.band).toBe(7)
    expect(reading.answers['ac1-q13']).toBe('NOT GIVEN')
  })

  it('drops a Reading record whose marking result is missing', () => {
    seed(4, [
      makeReadingSession('good', '2026-01-01T10:00:00.000Z'),
      makeReadingSession('bad', '2026-01-02T10:00:00.000Z', { result: undefined }),
    ])

    expect(loadSessions().map((s) => s.id)).toEqual(['good'])
  })

  it('drops a record whose section value is not one this build knows', () => {
    seed(4, [
      makeSession('a', '2026-01-01T10:00:00.000Z', { task: 'task2', section: 'writing' }),
      makeSession('bad', '2026-01-02T10:00:00.000Z', { task: 'task2', section: 'listening' }),
    ])

    expect(loadSessions().map((s) => s.id)).toEqual(['a'])
  })
})

/* -------------------- the plan-001 guarantee, at v4 -------------------------- */

describe('an unrecognised future version is backed up, never destroyed', () => {
  it('backs up the very NEXT version rather than guessing at it', () => {
    // 99 is an obvious stranger; 5 is the dangerous one, because it is what a
    // learner gets by opening a newer build of this same app on another device
    // and then coming back. It must be treated exactly as cautiously.
    const payload = {
      schemaVersion: 5,
      sessions: [
        makeSession('a', '2026-01-01T10:00:00.000Z', { task: 'task2', section: 'writing' }),
      ],
    }
    store.set(STORAGE_KEY, JSON.stringify(payload))

    saveSession(newRecord('new', '2026-02-01T10:00:00.000Z'))

    const keys = backupKeys()
    expect(keys).toHaveLength(1)
    expect(JSON.parse(store.get(keys[0]) as string)).toEqual(payload)

    // The live key moved on, but the v5 data is recoverable by hand.
    expect(loadSessions().map((s) => s.id)).toEqual(['new'])
  })

  it('refuses to import a v5 export rather than dropping its unknown fields', () => {
    const json = JSON.stringify({ schemaVersion: 5, sessions: [] })
    expect(() => importData(json)).toThrow(/newer version/i)
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

  it('climbs the whole ladder on a v1 export, section included', () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      sessions: [makeSession('x', '2026-03-01T10:00:00.000Z')],
    })

    importData(json)

    const sessions = loadSessions()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].task).toBe('task2')
    expect(sessions[0].module).toBe('academic')
    expect(sessions[0].section).toBe('writing')
  })

  it('imports a v4 export containing a Reading session', () => {
    const json = JSON.stringify({
      schemaVersion: 4,
      sessions: [
        makeSession('essay', '2026-03-01T10:00:00.000Z', { task: 'task2', section: 'writing' }),
        makeReadingSession('paper', '2026-03-02T10:00:00.000Z'),
      ],
    })

    importData(json)

    expect(loadSessions().map((s) => s.section)).toEqual(['writing', 'reading'])
  })
})
