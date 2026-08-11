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
import { buildExport, deleteSession, importData, loadSessions, saveSession } from '../src/profile/store'
import { loadPrefs, savePrefs } from '../src/profile/prefs'
import { rawToBand } from '../src/reading/bandTable'
import type { ReadingModule } from '../src/reading/types'
import { isWritingSession } from '../src/types'
import type { Module, SessionRecord, TaskKind } from '../src/types'

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
 * A brand-new record as App.tsx would build it today (schemaVersion 5 shape).
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

// Every `makeSession`/`newRecord` fixture in this file is a Writing (task2 or
// task1 essay) record — the migration cases exercise `task`/`module`, neither
// of which `SessionRecord` carries unconditionally (`task` is Writing-only;
// `module` is absent on Listening). Narrow with `isWritingSession` rather than
// casting, per `src/types.ts`'s guard contract.
function writingTask(s: SessionRecord): TaskKind | undefined {
  return isWritingSession(s) ? s.task : undefined
}
function writingModule(s: SessionRecord): Module | undefined {
  return isWritingSession(s) ? s.module : undefined
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
    expect(sessions.every((s) => writingTask(s) === 'task2')).toBe(true)
  })

  it('migrates on read without rewriting the stored payload', () => {
    seed(1, [
      makeSession('a', '2026-01-01T10:00:00.000Z'),
      makeSession('b', '2026-01-02T10:00:00.000Z'),
      makeSession('c', '2026-01-03T10:00:00.000Z'),
    ])

    const sessions = loadSessions()
    expect(sessions).toHaveLength(3)
    expect(sessions.every((s) => writingTask(s) === 'task2')).toBe(true)

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
    expect(sessions.map(writingTask)).toEqual(['task1', 'task2'])
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
    expect(sessions.every((s) => writingTask(s) === 'task2')).toBe(true)
    expect(sessions.every((s) => writingModule(s) === 'academic')).toBe(true)
    expect(sessions.every((s) => s.section === 'writing')).toBe(true)

    // One read did all three. Reads stay pure: the payload is still v1.
    const raw = JSON.parse(store.get(STORAGE_KEY) as string)
    expect(raw.schemaVersion).toBe(1)
    expect(raw.sessions[0].task).toBeUndefined()
    expect(raw.sessions[0].module).toBeUndefined()
    expect(raw.sessions[0].section).toBeUndefined()
  })

  it('keeps a v1 history intact across the save that rewrites it forward', () => {
    seed(1, [
      makeSession('a', '2026-01-01T10:00:00.000Z'),
      makeSession('b', '2026-01-02T10:00:00.000Z'),
      makeSession('c', '2026-01-03T10:00:00.000Z'),
    ])

    saveSession(newRecord('d', '2026-01-04T10:00:00.000Z'))

    const sessions = loadSessions()
    expect(sessions.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(sessions.every((s) => s.section === 'writing')).toBe(true)
    // Whatever the current SCHEMA_VERSION is — 4 when this was written, 5 since
    // Listening, 6 since delete tombstones. The assertion that matters is that
    // the three v1 essays above came through the rewrite, not the digit itself.
    expect(JSON.parse(store.get(STORAGE_KEY) as string).schemaVersion).toBe(6)
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
    // Written before Listening shipped, when 'listening' was simply an unknown
    // value. It still holds at schemaVersion 5, and for a STRONGER reason: the
    // section is now recognised, so the record is routed to the Listening shape
    // check — where an essay with no testId, no answers and no marking result
    // still fails. Claiming a section is not enough; the record has to be one.
    seed(4, [
      makeSession('a', '2026-01-01T10:00:00.000Z', { task: 'task2', section: 'writing' }),
      makeSession('bad', '2026-01-02T10:00:00.000Z', { task: 'task2', section: 'listening' }),
    ])

    expect(loadSessions().map((s) => s.id)).toEqual(['a'])
  })

  it('still drops a record naming a section this build has never heard of', () => {
    // The case the test above used to cover. Kept explicitly so the guard is
    // pinned by a value no future plan is going to make legal by accident.
    seed(4, [
      makeSession('a', '2026-01-01T10:00:00.000Z', { task: 'task2', section: 'writing' }),
      makeSession('bad', '2026-01-02T10:00:00.000Z', { task: 'task2', section: 'speaking' }),
    ])

    expect(loadSessions().map((s) => s.id)).toEqual(['a'])
  })
})

/* --------------------- v5: the Listening variant ---------------------------- */

/**
 * A Listening session on the wire, as schemaVersion 5 writes one.
 *
 * Note what is NOT here: `module`. Academic and General Training candidates sit
 * the identical Listening paper and convert through the identical table, so the
 * record has no exam type to store — and the validator must therefore not
 * demand one. A test that quietly added `module: 'academic'` would let a
 * regression through on the very field this section is defined by not having.
 */
function makeListeningSession(
  id: string,
  dateISO: string,
  overrides: Record<string, unknown> = {},
): unknown {
  return {
    section: 'listening',
    id,
    dateISO,
    testId: 'listening-01',
    testTitle: 'Listening Test 1',
    answers: { 'ls-q01': 'Lindqvist', 'ls-q07': '680' },
    durationSec: 2400,
    practice: false,
    result: {
      testId: 'listening-01',
      raw: 30,
      total: 40,
      band: 7,
      questions: [],
      byType: [],
      byFormat: [{ format: 'form-completion', total: 8, correct: 6, accuracy: 0.75 }],
    },
    ...overrides,
  }
}

describe('v4 -> v5 migration', () => {
  it('changes no data, because no v4 record could have been a Listening paper', () => {
    // The rung is a version bump and nothing else. What must be proved is that
    // a v4 store survives it byte for byte: every field of every record comes
    // back exactly as it went in, with no stamping and no defaults invented.
    const essay = makeSession('essay', '2026-01-01T10:00:00.000Z', {
      task: 'task1',
      module: 'general',
      section: 'writing',
    })
    const paper = makeReadingSession('paper', '2026-01-02T10:00:00.000Z')
    seed(4, [essay, paper])

    const sessions = loadSessions()

    expect(sessions).toHaveLength(2)
    expect(sessions[0]).toEqual(essay)
    expect(sessions[1]).toEqual(paper)
  })

  it('accepts a Listening session that carries no module', () => {
    seed(5, [makeListeningSession('heard', '2026-01-03T10:00:00.000Z')])

    const sessions = loadSessions()
    expect(sessions).toHaveLength(1)

    const listening = sessions[0]
    if (listening.section !== 'listening') throw new Error('expected a Listening session')
    expect(listening.result.raw).toBe(30)
    expect(listening.result.band).toBe(7)
    expect(listening.result.byFormat[0].format).toBe('form-completion')
    expect(listening.answers['ls-q07']).toBe('680')
    // The absence is the contract, not an omission in the fixture.
    expect('module' in listening).toBe(false)
  })

  it('drops a Listening record with no per-format breakdown', () => {
    // `byFormat` is what the whole report is built around — the coaching signal
    // plan 011 asks for. A record without it would reach the report with
    // nothing to break down.
    seed(5, [
      makeListeningSession('good', '2026-01-01T10:00:00.000Z'),
      makeListeningSession('bad', '2026-01-02T10:00:00.000Z', {
        result: { testId: 'listening-01', raw: 1, total: 40, band: 4, questions: [], byType: [] },
      }),
    ])

    expect(loadSessions().map((s) => s.id)).toEqual(['good'])
  })

  it('keeps all three sections side by side', () => {
    seed(5, [
      makeSession('essay', '2026-01-01T10:00:00.000Z', {
        task: 'task2',
        module: 'academic',
        section: 'writing',
      }),
      makeReadingSession('read', '2026-01-02T10:00:00.000Z'),
      makeListeningSession('heard', '2026-01-03T10:00:00.000Z'),
    ])

    expect(loadSessions().map((s) => s.section)).toEqual(['writing', 'reading', 'listening'])
  })
})

/* --------------- the whole ladder: v1 -> v5 in a SINGLE read ---------------- */

describe('v1 -> v5 in a single read', () => {
  it('climbs every rung, stamping task, then module, then section', () => {
    // A learner who last opened the app before ANY discriminator existed and is
    // arriving at the build where Listening shipped. Plan 001 exists because a
    // schemaVersion bump once destroyed exactly this person's history, and each
    // new section is another chance to do it again.
    seed(1, [
      makeSession('a', '2026-01-01T10:00:00.000Z'),
      makeSession('b', '2026-01-02T10:00:00.000Z'),
      makeSession('c', '2026-01-03T10:00:00.000Z'),
    ])

    const sessions = loadSessions()

    expect(sessions.map((s) => s.id)).toEqual(['a', 'b', 'c'])
    expect(sessions.every((s) => s.section === 'writing')).toBe(true)
    expect(sessions.every((s) => s.section === 'writing' && s.task === 'task2')).toBe(true)
    expect(sessions.every((s) => s.section === 'writing' && s.module === 'academic')).toBe(true)
    // The essays are intact, not merely present: the whole point of the ladder
    // is that nothing about them changes except the fields being added.
    expect(sessions.every((s) => s.section === 'writing' && s.essayText === 'An essay.')).toBe(true)

    // One read did all four rungs. Reads stay pure: the payload is still v1.
    const raw = JSON.parse(store.get(STORAGE_KEY) as string)
    expect(raw.schemaVersion).toBe(1)
    expect(raw.sessions[0].task).toBeUndefined()
    expect(raw.sessions[0].module).toBeUndefined()
    expect(raw.sessions[0].section).toBeUndefined()
  })

  it('rewrites a v1 store as v6 on the next save, losing nothing', () => {
    seed(1, [
      makeSession('a', '2026-01-01T10:00:00.000Z'),
      makeSession('b', '2026-01-02T10:00:00.000Z'),
    ])

    saveSession(newRecord('c', '2026-01-04T10:00:00.000Z'))

    expect(loadSessions().map((s) => s.id)).toEqual(['a', 'b', 'c'])
    expect(JSON.parse(store.get(STORAGE_KEY) as string).schemaVersion).toBe(6)
  })

  it('lets a v1 store gain a Listening session without losing an essay', () => {
    seed(1, [makeSession('old', '2026-01-01T10:00:00.000Z')])

    saveSession(makeListeningSession('heard', '2026-01-05T10:00:00.000Z') as never)

    const sessions = loadSessions()
    expect(sessions.map((s) => s.id)).toEqual(['old', 'heard'])
    expect(sessions.map((s) => s.section)).toEqual(['writing', 'listening'])
  })

  it('imports a v1 export and a v5 export alike', () => {
    importData(
      JSON.stringify({
        schemaVersion: 1,
        sessions: [makeSession('x', '2026-03-01T10:00:00.000Z')],
      }),
    )
    expect(loadSessions()[0].section).toBe('writing')

    importData(
      JSON.stringify({
        schemaVersion: 5,
        sessions: [
          makeSession('y', '2026-03-02T10:00:00.000Z', { task: 'task2', section: 'writing' }),
          makeListeningSession('z', '2026-03-03T10:00:00.000Z'),
        ],
      }),
    )
    expect(loadSessions().map((s) => s.section)).toEqual(['writing', 'listening'])
  })
})

/* -------------------- the plan-001 guarantee, at v4 -------------------------- */

describe('an unrecognised future version is backed up, never destroyed', () => {
  it('backs up the very NEXT version rather than guessing at it', () => {
    // 99 is an obvious stranger; the NEXT version is the dangerous one, because
    // it is what a learner gets by opening a newer build of this same app on
    // another device and then coming back. It must be treated exactly as
    // cautiously. This case tracks SCHEMA_VERSION + 1 and was re-pointed from 6
    // to 7 when delete tombstones made 6 a version this build understands — the
    // assertion is unchanged, only the boundary moved.
    const payload = {
      schemaVersion: 7,
      sessions: [
        makeSession('a', '2026-01-01T10:00:00.000Z', { task: 'task2', section: 'writing' }),
      ],
    }
    store.set(STORAGE_KEY, JSON.stringify(payload))

    saveSession(newRecord('new', '2026-02-01T10:00:00.000Z'))

    const keys = backupKeys()
    expect(keys).toHaveLength(1)
    expect(JSON.parse(store.get(keys[0]) as string)).toEqual(payload)

    // The live key moved on, but the v7 data is recoverable by hand.
    expect(loadSessions().map((s) => s.id)).toEqual(['new'])
  })

  it('refuses to import a v7 export rather than dropping its unknown fields', () => {
    const json = JSON.stringify({ schemaVersion: 7, sessions: [] })
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
    expect(sessions.every((s) => writingTask(s) === 'task2')).toBe(true)
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
    expect(writingTask(sessions[0])).toBe('task2')
    expect(writingModule(sessions[0])).toBe('academic')
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

/* ------------ a Reading module is a table KEY, not a label ------------------ */

/**
 * The two ends of ONE defect, which is why a band-table assertion lives in the
 * storage suite rather than beside the other band tests.
 *
 * A stored Reading record's `module` is not decoration: `rawToBand` and the
 * report's own row lookup both use it to index `READING_BAND_TABLES`. A record
 * saying `module: 'speaking'` passed validation, reached the report, indexed the
 * table to `undefined`, and threw "table is not iterable" out of a render — the
 * error boundary then blanked the WHOLE app, so one mistyped field cost the
 * learner every screen including the history list holding their essays.
 *
 * Both ends are pinned here: the validator must not admit such a record, and
 * the conversion must not throw even if one ever reaches it.
 */
describe('a Reading record with an unusable module cannot crash the app', () => {
  it('drops a stored Reading record whose module is not an IELTS exam', () => {
    seed(5, [
      makeReadingSession('good', '2026-01-01T10:00:00.000Z'),
      makeReadingSession('bad', '2026-01-02T10:00:00.000Z', { module: 'speaking' }),
    ])

    expect(loadSessions().map((s) => s.id)).toEqual(['good'])
  })

  it('drops a stored Reading record carrying no module at all', () => {
    // Unlike a writing record, this one cannot be excused as pre-v3 data:
    // Reading shipped at v4, AFTER `module` existed, so no rung would ever
    // stamp it and the report would index the table with `undefined`.
    seed(5, [
      makeReadingSession('good', '2026-01-01T10:00:00.000Z'),
      makeReadingSession('bad', '2026-01-02T10:00:00.000Z', { module: undefined }),
    ])

    expect(loadSessions().map((s) => s.id)).toEqual(['good'])
  })

  it('drops the same record inside the marking result but keeps the exam pair', () => {
    // The record-level module is the one every consumer reads; a valid pair
    // must still survive, or this validator would have eaten real history.
    seed(5, [
      makeReadingSession('academic', '2026-01-01T10:00:00.000Z'),
      makeReadingSession('general', '2026-01-02T10:00:00.000Z', { module: 'general' }),
    ])

    expect(loadSessions().map((s) => s.id)).toEqual(['academic', 'general'])
  })

  it('converts an unknown module with the Academic table instead of throwing', () => {
    // The second line of defence, for a record that reaches the conversion by
    // some route the validator does not guard. Throwing here is what took the
    // app down; Academic is the same default the v2 -> v3 migration stamps.
    const unknown = 'speaking' as unknown as ReadingModule

    expect(() => rawToBand(30, unknown)).not.toThrow()
    expect(rawToBand(30, unknown)).toBe(rawToBand(30, 'academic'))
    expect(rawToBand(30, unknown)).toBe(7)
    // Total in BOTH arguments, at every corner of the raw-score range.
    expect(rawToBand(0, unknown)).toBe(4)
    expect(rawToBand(40, unknown)).toBe(9)
    expect(rawToBand(Number.NaN, unknown)).toBe(4)
  })

  it('never converts silently with the wrong table', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    rawToBand(30, 'speaking' as unknown as ReadingModule)
    expect(warn).toHaveBeenCalled()
  })
})

/* ------------------- the cap is per section, not global --------------------- */

/** `n` days after 1 January 2026, as the ISO string the app would store. */
function day(n: number): string {
  return new Date(Date.UTC(2026, 0, 1, 10) + n * 86_400_000).toISOString()
}

describe('sitting answer-key papers can never delete an essay', () => {
  it('keeps all 20 essays after 190 Reading papers are sat', () => {
    // The reported scenario, exactly. Under one global 200-record cap the
    // 201st save evicted the oldest record in the STORE — which was an essay —
    // so a learner who moved on to Reading practice lost ten essays they could
    // only get back by writing them again. It also inverts the purpose of the
    // `isWritingSession` guards: those exist so answer-key papers cannot dilute
    // the writing profile, and the cap let them delete it outright.
    seed(5, Array.from({ length: 20 }, (_, i) =>
      makeSession(`essay-${i}`, day(i), { task: 'task2', section: 'writing' }),
    ))

    for (let i = 0; i < 190; i++) {
      saveSession(makeReadingSession(`paper-${i}`, day(100 + i)) as SessionRecord)
    }

    const sessions = loadSessions()
    const essays = sessions.filter((s) => s.section === 'writing')
    const papers = sessions.filter((s) => s.section === 'reading')

    expect(essays.map((s) => s.id)).toEqual(
      Array.from({ length: 20 }, (_, i) => `essay-${i}`),
    )
    expect(papers).toHaveLength(190)
  })

  it('keeps every essay when Listening papers fill the store instead', () => {
    seed(5, Array.from({ length: 20 }, (_, i) =>
      makeSession(`essay-${i}`, day(i), { task: 'task2', section: 'writing' }),
    ))

    for (let i = 0; i < 190; i++) {
      saveSession(makeListeningSession(`heard-${i}`, day(100 + i)) as SessionRecord)
    }

    expect(loadSessions().filter((s) => s.section === 'writing')).toHaveLength(20)
    expect(loadSessions().filter((s) => s.section === 'listening')).toHaveLength(190)
  })

  it('still evicts the oldest record WITHIN a section that is over the cap', () => {
    // The cap is not removed, only scoped. 200 essays plus one more is still
    // 200 essays, and the one that goes is the oldest of that section.
    seed(5, Array.from({ length: 200 }, (_, i) =>
      makeSession(`essay-${i}`, day(i), { task: 'task2', section: 'writing' }),
    ))

    saveSession(newRecord('newest', day(500)))

    const ids = loadSessions().map((s) => s.id)
    expect(ids).toHaveLength(200)
    expect(ids).not.toContain('essay-0')
    expect(ids).toContain('essay-1')
    expect(ids).toContain('newest')
  })

  it('does not let an over-cap section evict another section', () => {
    // Reading is at its own limit and one more paper arrives; the essays are
    // not the oldest thing in the store's eyes, and must not be touched.
    seed(5, [
      ...Array.from({ length: 3 }, (_, i) =>
        makeSession(`essay-${i}`, day(i), { task: 'task2', section: 'writing' }),
      ),
      ...Array.from({ length: 200 }, (_, i) => makeReadingSession(`paper-${i}`, day(100 + i))),
    ])

    saveSession(makeReadingSession('paper-new', day(400)) as SessionRecord)

    const sessions = loadSessions()
    expect(sessions.filter((s) => s.section === 'writing').map((s) => s.id)).toEqual([
      'essay-0',
      'essay-1',
      'essay-2',
    ])
    expect(sessions.filter((s) => s.section === 'reading')).toHaveLength(200)
    expect(sessions.map((s) => s.id)).not.toContain('paper-0')
  })
})

/* ------------- a record dropped on read is backed up, not binned ------------ */

describe('backup when only SOME records fail validation', () => {
  it('keeps a copy of the payload before a damaged record is filtered out', () => {
    // The likeliest form of corruption by far — one record truncated by a write
    // that was interrupted — and the one case the file header promised to back
    // up and did not. The read is silent, the next save persists the filtered
    // list, and the learner's essay is gone with nothing to recover it from.
    const good = makeSession('good', '2026-01-01T10:00:00.000Z', {
      task: 'task2',
      section: 'writing',
    })
    const damaged = makeSession('damaged', '2026-01-02T10:00:00.000Z', {
      task: 'task2',
      section: 'writing',
      analysis: undefined,
    })
    seed(5, [good, damaged])

    expect(loadSessions().map((s) => s.id)).toEqual(['good'])

    const keys = backupKeys()
    expect(keys).toHaveLength(1)
    const rescued = JSON.parse(store.get(keys[0]) as string)
    // The whole payload, so the damaged record is recoverable by hand — it is
    // the only copy left once anything writes.
    expect(rescued.sessions).toHaveLength(2)
    expect(rescued.sessions[1].id).toBe('damaged')
  })

  it('does not mint a second backup of a payload it has already copied', () => {
    // Reads are pure, so the damaged payload is seen again on every render.
    // One backup per read would fill the quota holding the surviving essays.
    //
    // Fake timers PROVE the three reads below share a millisecond — without
    // them, this assertion held whether or not `hasIdenticalBackup` existed
    // (measured: 199 of 200 real-clock runs landed all three reads inside one
    // millisecond), which is a vacuous test wearing a real one's assertion.
    // 016-d makes colliding keys distinct, which is exactly what would turn
    // this test from vacuous into actively wrong if it were not pinned here.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T12:00:00.000Z'))

    seed(5, [
      makeSession('good', '2026-01-01T10:00:00.000Z', { task: 'task2', section: 'writing' }),
      makeSession('damaged', '2026-01-02T10:00:00.000Z', { section: 'writing', analysis: undefined }),
    ])

    loadSessions()
    loadSessions()
    loadSessions()

    expect(backupKeys()).toHaveLength(1)

    vi.useRealTimers()
  })

  it('backs nothing up when every record validates', () => {
    seed(5, [makeSession('a', '2026-01-01T10:00:00.000Z', { task: 'task2', section: 'writing' })])

    expect(loadSessions()).toHaveLength(1)
    expect(backupKeys()).toEqual([])
  })
})

/* -------------------- import backs up before it replaces -------------------- */

describe('importData backs up the store it is about to replace', () => {
  it('keeps the existing sessions recoverable after an import wipes them', () => {
    // The only destructive action a learner reaches through a file picker, with
    // no undo in the UI and (per SPEC) not even a confirm on some paths. Every
    // other destructive path in the store backs up first; this one replaced two
    // years of essays with whatever file was double-clicked.
    seed(5, [
      makeSession('mine-1', '2026-01-01T10:00:00.000Z', { task: 'task2', section: 'writing' }),
      makeSession('mine-2', '2026-01-02T10:00:00.000Z', { task: 'task2', section: 'writing' }),
    ])

    importData(
      JSON.stringify({
        schemaVersion: 5,
        sessions: [
          makeSession('theirs', '2026-02-01T10:00:00.000Z', { task: 'task2', section: 'writing' }),
        ],
      }),
    )

    expect(loadSessions().map((s) => s.id)).toEqual(['theirs'])

    const keys = backupKeys()
    expect(keys).toHaveLength(1)
    const rescued = JSON.parse(store.get(keys[0]) as string)
    expect(rescued.sessions.map((s: { id: string }) => s.id)).toEqual(['mine-1', 'mine-2'])
  })

  it('backs nothing up when a first run imports into an empty store', () => {
    importData(
      JSON.stringify({
        schemaVersion: 5,
        sessions: [
          makeSession('theirs', '2026-02-01T10:00:00.000Z', { task: 'task2', section: 'writing' }),
        ],
      }),
    )

    expect(loadSessions().map((s) => s.id)).toEqual(['theirs'])
    expect(backupKeys()).toEqual([])
  })

  it('does not back up a store an invalid import was never going to replace', () => {
    seed(5, [makeSession('mine', '2026-01-01T10:00:00.000Z', { task: 'task2', section: 'writing' })])

    expect(() => importData('{not json')).toThrow()
    // Tracks SCHEMA_VERSION + 1, same re-point as above.
    expect(() => importData(JSON.stringify({ schemaVersion: 7, sessions: [] }))).toThrow()

    expect(loadSessions().map((s) => s.id)).toEqual(['mine'])
    expect(backupKeys()).toEqual([])
  })
})

/* --------------------- a version between two rungs -------------------------- */

describe('a fractional schemaVersion still climbs every rung above it', () => {
  it('migrates a 2.5 store instead of stamping it v6 with nothing filled in', () => {
    // `readStore` admits any version in the RANGE [1, 6], but the ladder used to
    // step on exact `===` integers, so 2.5 ran ZERO rungs and was then written
    // back as the current version — permanently, with `module` and `section`
    // undefined on every record. A store can hold such a version from a
    // half-finished write, a hand edit, or a build that ever shipped a
    // fractional one.
    seed(2.5, [makeSession('a', '2026-01-01T10:00:00.000Z', { task: 'task2' })])

    const sessions = loadSessions()
    expect(sessions).toHaveLength(1)
    expect(writingModule(sessions[0])).toBe('academic')
    expect(sessions[0].section).toBe('writing')
    // The rung it is already past is not re-run: `task` keeps its stored value.
    expect(writingTask(sessions[0])).toBe('task2')
  })

  it('climbs from below the first rung too', () => {
    seed(1.5, [makeSession('a', '2026-01-01T10:00:00.000Z')])

    const sessions = loadSessions()
    expect(writingTask(sessions[0])).toBe('task2')
    expect(writingModule(sessions[0])).toBe('academic')
    expect(sessions[0].section).toBe('writing')
  })

  it('survives the write that stamps the fractional store as v6', () => {
    seed(2.5, [makeSession('a', '2026-01-01T10:00:00.000Z', { task: 'task2' })])

    saveSession(newRecord('b', '2026-01-02T10:00:00.000Z'))

    const sessions = loadSessions()
    expect(sessions.map((s) => s.id)).toEqual(['a', 'b'])
    expect(sessions.every((s) => s.section === 'writing')).toBe(true)
    expect(JSON.parse(store.get(STORAGE_KEY) as string).schemaVersion).toBe(6)
  })

  it('imports a fractional export the same way', () => {
    importData(
      JSON.stringify({
        schemaVersion: 3.5,
        sessions: [makeSession('x', '2026-03-01T10:00:00.000Z', { task: 'task2' })],
      }),
    )

    expect(loadSessions()[0].section).toBe('writing')
  })
})

/* --------------------- import: one record per id, real dates ---------------- */

describe('importData will not create two records sharing an id', () => {
  it('keeps one record when a file carries the same id twice', () => {
    // `saveSession` has always deduplicated; import did not, so a hand-merged
    // file produced duplicate React keys in the history list AND made
    // `deleteSession` remove both records at once — deleting an essay could
    // silently take a Reading paper with it.
    importData(
      JSON.stringify({
        schemaVersion: 5,
        sessions: [
          makeSession('dup', '2026-01-01T10:00:00.000Z', { task: 'task2', section: 'writing' }),
          makeReadingSession('dup', '2026-01-02T10:00:00.000Z'),
        ],
      }),
    )

    expect(loadSessions()).toHaveLength(1)
  })

  it('leaves nothing behind when the surviving record is deleted', () => {
    importData(
      JSON.stringify({
        schemaVersion: 5,
        sessions: [
          makeSession('dup', '2026-01-01T10:00:00.000Z', { task: 'task2', section: 'writing' }),
          makeReadingSession('dup', '2026-01-02T10:00:00.000Z'),
        ],
      }),
    )

    deleteSession('dup')
    expect(loadSessions()).toEqual([])
  })

  it('orders imported records by instant, not by the text of the date', () => {
    // 23:00+05:00 is 18:00Z — three hours BEFORE 20:00Z, and after it as text.
    // The app only ever writes UTC, but an imported file need not, and the list
    // order is what `capSessions` calls "oldest": text order decides which
    // record gets deleted.
    importData(
      JSON.stringify({
        schemaVersion: 5,
        sessions: [
          makeSession('later', '2026-01-01T20:00:00.000Z', { task: 'task2', section: 'writing' }),
          makeSession('earlier', '2026-01-01T23:00:00+05:00', { task: 'task2', section: 'writing' }),
        ],
      }),
    )

    expect(loadSessions().map((s) => s.id)).toEqual(['earlier', 'later'])
  })
})

/* ------------------------- saveSession id dedupe ---------------------------- */

describe('saveSession replaces a record with the same id', () => {
  it('never stores the same session twice', () => {
    // A double submit — a double-clicked button, a re-render mid-save — must
    // update the record, not append a second one with the same id. Two records
    // sharing an id collide as React keys and are deleted together.
    saveSession(newRecord('same', '2026-01-01T10:00:00.000Z'))
    const rewritten = newRecord('same', '2026-01-01T10:00:00.000Z')
    if (!isWritingSession(rewritten)) throw new Error('fixture must be a writing session')
    saveSession({ ...rewritten, essayText: 'The rewritten essay.' })

    const sessions = loadSessions()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].section === 'writing' && sessions[0].essayText).toBe('The rewritten essay.')
  })
})

/* -------------------- 016-d: colliding backup keys -------------------- */

describe('016-d: the backup key no longer collides inside one millisecond', () => {
  it('keeps all three backups when three different payloads are read on a frozen clock', () => {
    // Reproduces the measured bug exactly: three DIFFERENT damaged payloads,
    // read in sequence with the clock frozen to one millisecond, used to
    // collapse into ONE key holding only the third — A and B were destroyed
    // while the console said a copy had been kept for each.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T12:00:00.000Z'))

    const payloadFor = (id: string) => ({
      schemaVersion: 99, // unrecognised future version -> whole payload backed up
      sessions: [makeSession(id, '2026-01-01T10:00:00.000Z')],
    })

    store.set(STORAGE_KEY, JSON.stringify(payloadFor('a')))
    loadSessions()
    store.set(STORAGE_KEY, JSON.stringify(payloadFor('b')))
    loadSessions()
    store.set(STORAGE_KEY, JSON.stringify(payloadFor('c')))
    loadSessions()

    const keys = backupKeys()
    expect(keys).toHaveLength(3)
    const recoveredIds = keys
      .map((k) => JSON.parse(store.get(k) as string).sessions[0].id)
      .sort()
    expect(recoveredIds).toEqual(['a', 'b', 'c'])

    vi.useRealTimers()
  })
})

/* -------------------- 016-a: backups are capped and pruned -------------------- */

describe('016-a: backups are capped and pruned, newest kept', () => {
  it('never keeps more backups than the cap, and the survivors are the newest', () => {
    // MAX_BACKUPS is 5 and private to store.ts; this mirrors it the same way
    // the existing per-section cap tests mirror MAX_SESSIONS_PER_SECTION as a
    // bare 200 rather than importing it.
    const CAP = 5
    const MINTED = 8

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T12:00:00.000Z'))

    for (let i = 0; i < MINTED; i++) {
      store.set(
        STORAGE_KEY,
        JSON.stringify({ schemaVersion: 99, sessions: [makeSession(`s${i}`, '2026-01-01T10:00:00.000Z')] }),
      )
      loadSessions()
      // A distinct millisecond per backup, so the cap — not the collision
      // suffix — is what this test is pinning.
      vi.advanceTimersByTime(1000)
    }

    const keys = backupKeys()
    expect(keys.length).toBeLessThanOrEqual(CAP)
    const survivorIds = keys
      .map((k) => JSON.parse(store.get(k) as string).sessions[0].id)
      .sort()
    expect(survivorIds).toEqual(
      Array.from({ length: CAP }, (_, i) => `s${MINTED - CAP + i}`).sort(),
    )

    vi.useRealTimers()
  })
})

/* -------------------- 016-c: a failed write is reported -------------------- */

/** Access to the localStorage stub `installLocalStorage` installed on `window`. */
function fakeStorage(): {
  setItem: (k: string, v: string) => void
  getItem: (k: string) => string | null
  removeItem: (k: string) => void
  key: (i: number) => string | null
  length: number
} {
  return (
    globalThis as unknown as {
      window: {
        localStorage: {
          setItem: (k: string, v: string) => void
          getItem: (k: string) => string | null
          removeItem: (k: string) => void
          key: (i: number) => string | null
          length: number
        }
      }
    }
  ).window.localStorage
}

function quotaExceededError(): DOMException {
  return new DOMException('The quota has been exceeded.', 'QuotaExceededError')
}

/**
 * Make `setItem` throw for `key` on the next `times` calls, then behave
 * normally again. Used to simulate a `writeStore` quota failure and, with
 * `times: 1`, a failure the retry recovers from.
 */
function failSetItem(key: string, times: number): void {
  const ls = fakeStorage()
  const real = ls.setItem
  let remaining = times
  ls.setItem = (k: string, v: string) => {
    if (k === key && remaining > 0) {
      remaining--
      throw quotaExceededError()
    }
    real(k, v)
  }
}

describe('016-c: saveSession reports whether the write persisted', () => {
  it('reports a quota failure instead of returning void', () => {
    failSetItem(STORAGE_KEY, Number.POSITIVE_INFINITY)

    const result = saveSession(newRecord('a', '2026-01-01T10:00:00.000Z'))

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('quota')
      expect(result.message.length).toBeGreaterThan(0)
    }
    // Nothing was actually persisted.
    expect(loadSessions()).toEqual([])
  })

  it('evicts the oldest backup and persists on the second attempt', () => {
    const oldBackupKey = `${BACKUP_PREFIX}2020-01-01T00:00:00.000Z`
    store.set(oldBackupKey, 'an old backup payload')
    failSetItem(STORAGE_KEY, 1) // fails once, then behaves normally

    const result = saveSession(newRecord('a', '2026-01-01T10:00:00.000Z'))

    expect(result.ok).toBe(true)
    expect(store.has(oldBackupKey)).toBe(false)
    expect(loadSessions().map((s) => s.id)).toEqual(['a'])
  })

  it('does not retry more than once', () => {
    let calls = 0
    const ls = fakeStorage()
    ls.setItem = (k: string) => {
      if (k === STORAGE_KEY) {
        calls++
        throw quotaExceededError()
      }
    }

    const result = saveSession(newRecord('a', '2026-01-01T10:00:00.000Z'))

    expect(result.ok).toBe(false)
    // One first attempt, one retry, and never a third — a second failure is
    // reported, not retried again.
    expect(calls).toBe(2)
  })

  it('reports a failure rather than crashing when counting backups itself fails', () => {
    // Storage that is genuinely UNAVAILABLE (not merely full) can throw on
    // `length`/`key` too, not only on `setItem` — the retry path counts
    // backups before evicting one, and that count must be exactly as
    // best-effort as everything else here. A crash out of `saveSession` would
    // be worse than the write failure it was trying to recover from.
    failSetItem(STORAGE_KEY, Number.POSITIVE_INFINITY)
    const ls = fakeStorage()
    Object.defineProperty(ls, 'length', {
      configurable: true,
      get() {
        throw new Error('storage unavailable')
      },
    })

    let result: ReturnType<typeof saveSession> | undefined
    expect(() => {
      result = saveSession(newRecord('a', '2026-01-01T10:00:00.000Z'))
    }).not.toThrow()
    expect(result?.ok).toBe(false)
  })
})

/* -------------------- 016-e: byCriterion must be complete -------------------- */

/** A writing record whose `analysis.band.byCriterion` is `byCriterion`. */
function withByCriterion(byCriterion: Record<string, unknown>): unknown {
  const record = makeSession('bad', '2026-01-01T10:00:00.000Z', {
    task: 'task2',
    section: 'writing',
  }) as { analysis: { band: { byCriterion: Record<string, unknown> } } }
  record.analysis.band.byCriterion = byCriterion
  return record
}

describe('016-e: an imported or stored record must carry all four criteria', () => {
  it('drops a record whose byCriterion is empty, and backs it up first', () => {
    seed(5, [withByCriterion({})])

    expect(loadSessions()).toEqual([])
    expect(backupKeys()).toHaveLength(1)
  })

  it('drops a record whose byCriterion has a null criterion', () => {
    seed(5, [withByCriterion({ TR: 7, CC: 7, LR: null, GRA: 7 })])

    expect(loadSessions()).toEqual([])
  })

  it('rejects the same incomplete byCriterion on import', () => {
    expect(() =>
      importData(JSON.stringify({ schemaVersion: 5, sessions: [withByCriterion({})] })),
    ).toThrow()
  })

  it('still loads a complete record', () => {
    seed(5, [makeSession('good', '2026-01-01T10:00:00.000Z', { task: 'task2', section: 'writing' })])

    expect(loadSessions().map((s) => s.id)).toEqual(['good'])
  })
})

/* -------------------- 031: v6 delete tombstones -------------------- */

/** The raw payload as written, typed loosely enough to read `deletedIds` off it. */
function rawStore(): { schemaVersion: number; sessions: unknown[]; deletedIds?: unknown[] } {
  return JSON.parse(store.get(STORAGE_KEY) as string) as {
    schemaVersion: number
    sessions: unknown[]
    deletedIds?: unknown[]
  }
}

describe('031: v5 -> v6 migration (deletedIds)', () => {
  it('defaults deletedIds to [] on a v5 store, read stays pure, next save writes v6', () => {
    seed(5, [makeSession('a', '2026-01-01T10:00:00.000Z', { task: 'task2', section: 'writing' })])

    expect(loadSessions().map((s) => s.id)).toEqual(['a'])

    // Reads stay pure: the payload is still v5 with no deletedIds key at all.
    const before = rawStore()
    expect(before.schemaVersion).toBe(5)
    expect(before.deletedIds).toBeUndefined()

    saveSession(newRecord('b', '2026-01-02T10:00:00.000Z'))

    const after = rawStore()
    expect(after.schemaVersion).toBe(6)
    expect(after.deletedIds).toEqual([])
  })

  it('climbs every rung from v1, stamping task/module/section and gaining deletedIds', () => {
    seed(1, [
      makeSession('a', '2026-01-01T10:00:00.000Z'),
      makeSession('b', '2026-01-02T10:00:00.000Z'),
    ])

    const sessions = loadSessions()
    expect(sessions.map((s) => s.id)).toEqual(['a', 'b'])
    expect(sessions.every((s) => s.section === 'writing')).toBe(true)
    expect(sessions.every((s) => writingTask(s) === 'task2')).toBe(true)
    expect(sessions.every((s) => writingModule(s) === 'academic')).toBe(true)

    // One read climbed every rung. Reads stay pure: the payload is still v1.
    const before = rawStore()
    expect(before.schemaVersion).toBe(1)
    expect(before.deletedIds).toBeUndefined()

    saveSession(newRecord('c', '2026-01-03T10:00:00.000Z'))

    const after = rawStore()
    expect(after.sessions).toHaveLength(3)
    expect(after.schemaVersion).toBe(6)
    expect(after.deletedIds).toEqual([])
  })
})

describe('031: deleteSession writes a tombstone', () => {
  it('appends the deleted id to deletedIds', () => {
    saveSession(newRecord('a', '2026-01-01T10:00:00.000Z'))

    deleteSession('a')

    expect(loadSessions()).toEqual([])
    expect(rawStore().deletedIds).toEqual(['a'])
  })

  it('deleting an unknown id is a no-op — no tombstone, no write at all', () => {
    saveSession(newRecord('a', '2026-01-01T10:00:00.000Z'))
    const before = store.get(STORAGE_KEY)

    deleteSession('never-existed')

    // Nothing changed: the live key is byte-identical, so no tombstone was
    // minted for a session this device never actually held.
    expect(store.get(STORAGE_KEY)).toBe(before)
  })
})

describe('031: the tombstone list is capped at MAX_DELETED_IDS, newest kept', () => {
  it('keeps only the newest 500 ids once more than 500 distinct sessions are deleted', () => {
    const CAP = 500
    const TOTAL = CAP + 1

    seed(
      6,
      Array.from({ length: TOTAL }, (_, i) =>
        makeSession(`id-${i}`, day(i), { task: 'task2', section: 'writing' }),
      ),
    )

    for (let i = 0; i < TOTAL; i++) deleteSession(`id-${i}`)

    const deletedIds = rawStore().deletedIds as string[]
    expect(deletedIds).toHaveLength(CAP)
    // The oldest deletion (id-0) is the one that fell off; every id deleted
    // after it survives.
    expect(deletedIds).not.toContain('id-0')
    expect(deletedIds).toContain('id-1')
    expect(deletedIds).toContain(`id-${TOTAL - 1}`)
  })
})

describe('031: capSessions never writes a tombstone for what it evicts', () => {
  it('leaves deletedIds empty after a save that evicts an over-cap session', () => {
    seed(
      6,
      Array.from({ length: 200 }, (_, i) =>
        makeSession(`essay-${i}`, day(i), { task: 'task2', section: 'writing' }),
      ),
    )

    // Pushes the writing section from 200 to 201, which the per-section cap
    // must trim back to 200 by dropping the oldest — a retention policy, not
    // a learner delete.
    saveSession(newRecord('newest', day(500)))

    const sessions = loadSessions()
    expect(sessions).toHaveLength(200)
    expect(sessions.map((s) => s.id)).not.toContain('essay-0')

    // The eviction above must be invisible to the tombstone list: only an
    // explicit `deleteSession` may ever write one.
    expect(rawStore().deletedIds).toEqual([])
  })
})

describe('031: saveSession clears a stale tombstone for the id it writes', () => {
  it('removes the id from deletedIds when the same id is saved again', () => {
    store.set(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: 6, sessions: [], deletedIds: ['x', 'y'] }),
    )

    saveSession(newRecord('x', '2026-01-01T10:00:00.000Z'))

    const after = rawStore()
    expect(after.deletedIds).toEqual(['y'])
    expect((after.sessions as Array<{ id: string }>).map((s) => s.id)).toEqual(['x'])
  })
})

/* -------------------- 031: merge-import -------------------- */

describe('031: merge-import', () => {
  it('unions two disjoint histories — every id from both survives', () => {
    saveSession(newRecord('mine', '2026-01-01T10:00:00.000Z'))

    const json = JSON.stringify({
      schemaVersion: 6,
      sessions: [
        makeSession('theirs', '2026-01-02T10:00:00.000Z', { task: 'task2', section: 'writing' }),
      ],
      deletedIds: [],
    })
    const summary = importData(json, 'merge')

    expect(loadSessions().map((s) => s.id)).toEqual(['mine', 'theirs'])
    expect(summary).toEqual({ mode: 'merge', sessionCount: 2, evictedCount: 0 })
  })

  it('an id collision in merge keeps ONE record — the incoming file wins', () => {
    saveSession(
      makeSession('dup', '2026-01-01T10:00:00.000Z', {
        task: 'task2',
        section: 'writing',
        essayText: 'mine',
      }) as SessionRecord,
    )

    const json = JSON.stringify({
      schemaVersion: 6,
      sessions: [
        makeSession('dup', '2026-01-01T10:00:00.000Z', {
          task: 'task2',
          section: 'writing',
          essayText: 'theirs',
        }),
      ],
    })
    const summary = importData(json, 'merge')

    const sessions = loadSessions()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].section === 'writing' && sessions[0].essayText).toBe('theirs')
    expect(summary.sessionCount).toBe(1)
  })

  it('RESURRECT PREVENTION: a session this device deleted stays deleted after merging a file that still carries it', () => {
    // The core case tombstones exist for: without the subtract step, a merge
    // would bring back exactly the essay the learner deliberately removed.
    saveSession(newRecord('x', '2026-01-01T10:00:00.000Z'))
    deleteSession('x')
    expect(loadSessions()).toEqual([])

    const json = JSON.stringify({
      schemaVersion: 6,
      sessions: [
        makeSession('x', '2026-01-01T10:00:00.000Z', { task: 'task2', section: 'writing' }),
      ],
    })
    importData(json, 'merge')

    expect(loadSessions().map((s) => s.id)).not.toContain('x')
    expect(rawStore().deletedIds).toContain('x')
  })

  it('a tombstone carried BY THE FILE removes a session this device still has', () => {
    saveSession(newRecord('x', '2026-01-01T10:00:00.000Z'))

    const json = JSON.stringify({ schemaVersion: 6, sessions: [], deletedIds: ['x'] })
    importData(json, 'merge')

    expect(loadSessions().map((s) => s.id)).not.toContain('x')
    expect(rawStore().deletedIds).toContain('x')
  })

  it('ORDER PIN: subtract runs before cap, so a tombstoned record does not cost the cap an extra survivor', () => {
    const current = Array.from({ length: 200 }, (_, i) =>
      makeSession(`essay-${i}`, day(i), { task: 'task2', section: 'writing' }),
    )
    seed(6, current)

    const json = JSON.stringify({
      schemaVersion: 6,
      sessions: [makeSession('fresh', day(300), { task: 'task2', section: 'writing' })],
      // The FILE's own author deleted essay-100 on their end; this device
      // still has a copy.
      deletedIds: ['essay-100'],
    })

    const summary = importData(json, 'merge')

    const ids = loadSessions().map((s) => s.id)
    expect(ids).toHaveLength(200)
    expect(ids).not.toContain('essay-100')
    // Proves subtraction ran BEFORE the cap: removing essay-100 first leaves
    // a union of exactly 200, so nothing else needs to be evicted and
    // essay-0 — the true oldest — survives. Cap-then-subtract would have
    // evicted essay-0 to bring 201 down to 200, THEN subtracted essay-100
    // too, losing two records instead of one.
    expect(ids).toContain('essay-0')
    expect(ids).toContain('fresh')
    expect(summary.evictedCount).toBe(0)
  })

  it('merge caps a near-cap section and reports the eviction', () => {
    const current = Array.from({ length: 200 }, (_, i) =>
      makeSession(`local-${i}`, day(i), { task: 'task2', section: 'writing' }),
    )
    seed(6, current)

    const json = JSON.stringify({
      schemaVersion: 6,
      sessions: Array.from({ length: 5 }, (_, i) =>
        makeSession(`remote-${i}`, day(300 + i), { task: 'task2', section: 'writing' }),
      ),
    })

    const summary = importData(json, 'merge')

    expect(summary).toEqual({ mode: 'merge', sessionCount: 200, evictedCount: 5 })
    const ids = loadSessions().map((s) => s.id)
    expect(ids).toHaveLength(200)
    // The newest 200 survive: the 5 oldest locals are gone.
    expect(ids).not.toContain('local-0')
    expect(ids).not.toContain('local-4')
    expect(ids).toContain('local-5')
    expect(ids).toContain('remote-0')
  })

  it('replace via the default parameter behaves exactly as the old replace-only importData did', () => {
    seed(5, [makeSession('mine', '2026-01-01T10:00:00.000Z', { task: 'task2', section: 'writing' })])

    const json = JSON.stringify({
      schemaVersion: 5,
      sessions: [
        makeSession('theirs', '2026-02-01T10:00:00.000Z', { task: 'task2', section: 'writing' }),
      ],
    })
    const summary = importData(json) // no mode argument at all — defaults to 'replace'

    expect(loadSessions().map((s) => s.id)).toEqual(['theirs'])
    expect(summary).toEqual({ mode: 'replace', sessionCount: 1, evictedCount: 0 })
  })

  it('merge backs up the pre-import store, same as replace', () => {
    seed(6, [makeSession('mine', '2026-01-01T10:00:00.000Z', { task: 'task2', section: 'writing' })])

    importData(JSON.stringify({ schemaVersion: 6, sessions: [] }), 'merge')

    const keys = backupKeys()
    expect(keys).toHaveLength(1)
    const rescued = JSON.parse(store.get(keys[0]) as string) as { sessions: Array<{ id: string }> }
    expect(rescued.sessions.map((s) => s.id)).toEqual(['mine'])
  })

  it('refuses a v7 file in merge mode too', () => {
    expect(() =>
      importData(JSON.stringify({ schemaVersion: 7, sessions: [] }), 'merge'),
    ).toThrow(/newer version/i)
  })
})

describe('031: prefs are device-local, so merge and replace treat them differently', () => {
  it('replace mode restores the file’s prefs — unchanged from the old replace-only behaviour', () => {
    savePrefs({ targetOverall: 5 })
    seed(6, [])

    importData(
      JSON.stringify({ schemaVersion: 6, sessions: [], prefs: { targetOverall: 9 } }),
      'replace',
    )

    expect(loadPrefs()).toEqual({ targetOverall: 9 })
  })

  it('merge mode keeps THIS device’s prefs — prefs are taste, not history, so a merge never overwrites them', () => {
    savePrefs({ targetOverall: 5 })
    seed(6, [])

    importData(
      JSON.stringify({ schemaVersion: 6, sessions: [], prefs: { targetOverall: 9 } }),
      'merge',
    )

    expect(loadPrefs()).toEqual({ targetOverall: 5 })
  })
})

/* -------------------- 031: buildExport — dated, self-describing exports -------------------- */

describe('031: buildExport', () => {
  it('the payload carries schemaVersion, sessions, tombstones and exportedAtISO', () => {
    saveSession(newRecord('a', '2026-01-01T10:00:00.000Z'))
    saveSession(newRecord('b', '2026-01-02T10:00:00.000Z'))
    deleteSession('b')

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T12:00:00.000Z'))

    const { json } = buildExport()
    const parsed = JSON.parse(json) as {
      schemaVersion: number
      exportedAtISO: string
      sessions: Array<{ id: string }>
      deletedIds: string[]
    }

    expect(parsed.schemaVersion).toBe(6)
    expect(parsed.sessions.map((s) => s.id)).toEqual(['a'])
    expect(parsed.deletedIds).toEqual(['b'])
    expect(parsed.exportedAtISO).toBe('2026-08-10T12:00:00.000Z')

    vi.useRealTimers()
  })

  it('names the file from the SAME exportedAtISO the payload carries — one clock read, not two', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T12:00:00.000Z'))

    const { json, filename } = buildExport()
    const exportedAtISO = (JSON.parse(json) as { exportedAtISO: string }).exportedAtISO

    expect(filename).toBe('ielts-coach-data-2026-08-10.json')
    // Pins the DERIVATION, not just the frozen-clock coincidence: the
    // filename's date is a slice of the payload's own `exportedAtISO`.
    expect(filename.slice(17, 27)).toBe(exportedAtISO.slice(0, 10))

    vi.useRealTimers()
  })

  it('round-trips sessions AND tombstones through a merge import', () => {
    saveSession(newRecord('a', '2026-01-01T10:00:00.000Z'))
    saveSession(newRecord('b', '2026-01-02T10:00:00.000Z'))
    deleteSession('b')

    const { json } = buildExport()
    store.clear()

    importData(json, 'merge')

    expect(loadSessions().map((s) => s.id)).toEqual(['a'])
    expect(rawStore().deletedIds).toEqual(['b'])
  })
})
