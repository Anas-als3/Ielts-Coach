/**
 * The Academic / General Training module discriminator (SPEC.md "Modules").
 *
 * Two things are pinned here, and they fail for different reasons.
 *
 * The migration cases are the important half. Plan 001 exists because a
 * schemaVersion bump once silently destroyed every saved session, and v3 is the
 * first bump since. The ladder now has TWO rungs, so a learner arriving from v1
 * must clear both in a single read — that is the whole design of a cumulative
 * ladder, and if it ever stops working the ladder is wrong rather than the
 * caller. The unknown-future-version case re-proves plan 001's guarantee
 * survived this bump.
 *
 * The prompt-bank cases guard the OTHER failure mode: tagging prompts
 * Academic-only is a judgement call, and a heavy hand would leave the General
 * Training picker nearly empty without breaking a single type.
 *
 * Every case drives the REAL exported API against an in-memory localStorage,
 * the same way tests/store.test.ts does.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { importData, loadSessions, saveSession } from '../src/profile/store'
import { PROMPTS, promptsForModule, randomPrompt, suitsModule } from '../src/prompts/bank'
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

/** A record that passes `looksLikeSession`. `task`/`module` omitted unless overridden. */
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

/** A brand-new record as App.tsx builds it today (schemaVersion 3 shape). */
function newRecord(
  id: string,
  dateISO: string,
  task: TaskKind = 'task2',
  module: Module = 'academic',
): SessionRecord {
  return makeSession(id, dateISO, { task, module }) as SessionRecord
}

function seed(schemaVersion: number, sessions: unknown[]): void {
  store.set(STORAGE_KEY, JSON.stringify({ schemaVersion, sessions }))
}

function backupKeys(): string[] {
  return Array.from(store.keys()).filter((k) => k.startsWith(BACKUP_PREFIX))
}

/* ------------------------------- v2 migration ------------------------------- */

describe('v2 -> v3 migration', () => {
  it('does not destroy a v2 store when a new session is saved', () => {
    seed(2, [
      makeSession('a', '2026-01-01T10:00:00.000Z', { task: 'task2' }),
      makeSession('b', '2026-01-02T10:00:00.000Z', { task: 'task1' }),
      makeSession('c', '2026-01-03T10:00:00.000Z', { task: 'task2' }),
    ])

    saveSession(newRecord('d', '2026-01-04T10:00:00.000Z'))

    const sessions = loadSessions()
    expect(sessions).toHaveLength(4)
    expect(sessions.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd'])
    // Everything written before v3 was Academic, because that was the only exam.
    expect(sessions.every((s) => s.module === 'academic')).toBe(true)
    // The v2 rung's work is still there: the task discriminator survived.
    expect(sessions.map((s) => s.task)).toEqual(['task2', 'task1', 'task2', 'task2'])
  })

  it('round-trips a v3 store and preserves a general record', () => {
    seed(3, [
      makeSession('a', '2026-01-01T10:00:00.000Z', { task: 'task2', module: 'academic' }),
      makeSession('b', '2026-01-02T10:00:00.000Z', { task: 'task2', module: 'general' }),
    ])

    const sessions = loadSessions()
    expect(sessions.map((s) => s.module)).toEqual(['academic', 'general'])

    // A general record survives a write untouched — the migration must not
    // re-stamp records that already carry the field.
    saveSession(newRecord('c', '2026-01-03T10:00:00.000Z', 'task2', 'general'))
    expect(loadSessions().map((s) => s.module)).toEqual(['academic', 'general', 'general'])
  })

  it('drops only the record whose module value is invalid', () => {
    seed(3, [
      makeSession('a', '2026-01-01T10:00:00.000Z', { task: 'task2', module: 'academic' }),
      makeSession('bad', '2026-01-02T10:00:00.000Z', { task: 'task2', module: 'life-skills' }),
      makeSession('c', '2026-01-03T10:00:00.000Z', { task: 'task2', module: 'general' }),
    ])

    expect(loadSessions().map((s) => s.id)).toEqual(['a', 'c'])
  })
})

/* ---------------------- the whole ladder, in one read ----------------------- */

describe('v1 -> v3 in a single read', () => {
  it('climbs both rungs, stamping task and then module', () => {
    // A learner who last opened the app before EITHER discriminator existed.
    seed(1, [
      makeSession('a', '2026-01-01T10:00:00.000Z'),
      makeSession('b', '2026-01-02T10:00:00.000Z'),
    ])

    const sessions = loadSessions()

    expect(sessions).toHaveLength(2)
    expect(sessions.every((s) => s.task === 'task2')).toBe(true)
    expect(sessions.every((s) => s.module === 'academic')).toBe(true)

    // Reads stay pure: the raw payload is still v1 until something writes.
    const raw = JSON.parse(store.get(STORAGE_KEY) as string)
    expect(raw.schemaVersion).toBe(1)
    expect(raw.sessions[0].module).toBeUndefined()
  })

  it('keeps a v1 history intact across the save that rewrites it at the current version', () => {
    seed(1, [
      makeSession('a', '2026-01-01T10:00:00.000Z'),
      makeSession('b', '2026-01-02T10:00:00.000Z'),
      makeSession('c', '2026-01-03T10:00:00.000Z'),
    ])

    saveSession(newRecord('d', '2026-01-04T10:00:00.000Z', 'task2', 'general'))

    expect(loadSessions().map((s) => s.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(loadSessions().map((s) => s.module)).toEqual([
      'academic',
      'academic',
      'academic',
      'general',
    ])
    // The rewrite stamps whatever SCHEMA_VERSION this build is at — 5 since the
    // Listening session variant landed, 4 for Reading, 3 when this case was
    // written. The guarantee under test is that all three v1 records SURVIVED
    // the rewrite; the number moves with every deliberate bump and is pinned so
    // an accidental one is caught.
    expect(JSON.parse(store.get(STORAGE_KEY) as string).schemaVersion).toBe(5)
  })
})

/* --------------------------- backup before clobber --------------------------- */

describe('the plan-001 guarantee still holds at v3', () => {
  it('backs up an unknown future version instead of destroying it', () => {
    const payload = {
      schemaVersion: 99,
      sessions: [makeSession('a', '2026-01-01T10:00:00.000Z', { task: 'task2', module: 'general' })],
    }
    store.set(STORAGE_KEY, JSON.stringify(payload))

    saveSession(newRecord('new', '2026-02-01T10:00:00.000Z'))

    const keys = backupKeys()
    expect(keys).toHaveLength(1)
    expect(JSON.parse(store.get(keys[0]) as string)).toEqual(payload)

    // The live key moved on, but nothing was lost.
    expect(loadSessions().map((s) => s.id)).toEqual(['new'])
  })
})

/* ---------------------------------- import ---------------------------------- */

describe('importData', () => {
  it('migrates a v2 export forward to v3', () => {
    const json = JSON.stringify({
      schemaVersion: 2,
      sessions: [
        makeSession('x', '2026-03-01T10:00:00.000Z', { task: 'task2' }),
        makeSession('y', '2026-03-02T10:00:00.000Z', { task: 'task1' }),
      ],
    })

    importData(json)

    const sessions = loadSessions()
    expect(sessions.map((s) => s.id)).toEqual(['x', 'y'])
    expect(sessions.every((s) => s.module === 'academic')).toBe(true)
    expect(sessions.map((s) => s.task)).toEqual(['task2', 'task1'])
  })
})

/* ------------------------------- the prompt bank ----------------------------- */

describe('the Task 2 prompt bank is tagged for both exams', () => {
  it('gives every prompt a non-empty modules array', () => {
    const untagged = PROMPTS.filter((p) => !p.modules || p.modules.length === 0).map((p) => p.id)
    expect(untagged).toEqual([])
    expect(PROMPTS).toHaveLength(40)
    // Academic is the exam the bank was written for: every prompt suits it.
    expect(PROMPTS.every((p) => suitsModule(p, 'academic'))).toBe(true)
  })

  it('leaves General Training a pool worth practising with', () => {
    const general = promptsForModule('general')
    // Below ~25 the General picker feels empty, which is a content decision
    // rather than an executor one — see plan 008's STOP conditions.
    expect(general.length).toBeGreaterThanOrEqual(25)
    expect(general.length).toBeLessThan(PROMPTS.length)

    // Every question type must survive the filter, or the General learner can
    // never practise one of the five shapes the exam actually sets.
    const types = new Set(general.map((p) => p.type))
    expect(types.size).toBe(5)

    // randomPrompt must respect the pool it is handed.
    for (let i = 0; i < 60; i++) {
      expect(suitsModule(randomPrompt('general'), 'general')).toBe(true)
    }
  })
})
