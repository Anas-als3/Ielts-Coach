/**
 * One comparator, four call sites (SPEC.md "profile/").
 *
 * The app writes `toISOString()`, so every date it produces is UTC and text
 * order and instant order agree. `importData` accepts a file written anywhere,
 * and then they do not: `2026-01-01T23:00:00+05:00` is 18:00Z — three hours
 * BEFORE `2026-01-01T20:00:00.000Z`, and AFTER it as text. The same pair is
 * used by `tests/store.test.ts:994`; one fixture, one meaning.
 */
import { describe, expect, it } from 'vitest'
import { byDateAscending, isBefore, sortByDateAscending } from '../src/profile/chronology'
import { computeProfile, computeTrends } from '../src/profile/profile'
import type { Analysis, IssueCategory, SessionRecord, TaskKind } from '../src/types'

/** 18:00Z, but sorts SECOND as text. */
const EARLIER = '2026-01-01T23:00:00+05:00'
/** 20:00Z, but sorts FIRST as text. */
const LATER = '2026-01-01T20:00:00.000Z'

/* --------------------------------- helpers ---------------------------------- */

// Mirrors tests/profile-scoping.test.ts's session()/fakeAnalysis() shapes, with
// one change: `section: 'writing'` is included. The reference helper omits it,
// which is a latent type error nothing currently catches (tsc does not cover
// tests/, see plans/020-*) — do not copy the omission.
function session(id: string, dateISO: string, task: TaskKind, analysis: Analysis): SessionRecord {
  return {
    id,
    dateISO,
    mode: 'coach',
    task,
    module: 'academic',
    section: 'writing',
    promptId: null,
    promptText: '',
    questionType: null,
    essayText: '',
    durationSec: null,
    pacing: null,
    pasteAttempts: null,
    analysis,
  }
}

/** An analysis carrying exactly the issues named, over `words` words. */
function fakeAnalysis(categories: IssueCategory[], words: number): Analysis {
  return {
    issues: categories.map((category, i) => ({
      id: `i${i}`,
      category,
      criterion: 'TR' as const,
      severity: 'error' as const,
      message: 'x',
      start: null,
      end: null,
    })),
    paragraphs: [],
    structure: [],
    stats: {
      wordCount: words,
      sentenceCount: 10,
      paragraphCount: 4,
      avgSentenceLength: words / 10,
      sentenceLengthStdDev: 5,
      typeTokenRatio: 0.6,
      linkingDeviceCount: 6,
    },
    band: {
      overall: 6,
      byCriterion: { TR: 6, CC: 6, LR: 6, GRA: 6 },
      rationale: { TR: [], CC: [], LR: [], GRA: [] },
    },
  }
}

/* ---------------------------------------------------------------------------- */

describe('chronology', () => {
  describe('the premise', () => {
    it('text order and instant order disagree for the fixture pair', () => {
      expect(LATER < EARLIER).toBe(true)
      expect(Date.parse(EARLIER)).toBeLessThan(Date.parse(LATER))
    })
  })

  describe('sortByDateAscending', () => {
    it('puts EARLIER first regardless of input order', () => {
      const a = { dateISO: LATER }
      const b = { dateISO: EARLIER }
      expect(sortByDateAscending([a, b]).map((x) => x.dateISO)).toEqual([EARLIER, LATER])
      expect(sortByDateAscending([b, a]).map((x) => x.dateISO)).toEqual([EARLIER, LATER])
    })

    it('does not mutate its argument', () => {
      const input = [{ dateISO: LATER }, { dateISO: EARLIER }]
      const copy = input.slice()
      sortByDateAscending(input)
      expect(input).toEqual(copy)
    })
  })

  describe('invalid dates', () => {
    it('sort last, after every valid date', () => {
      const valid = { dateISO: EARLIER }
      const invalid = { dateISO: 'not-a-date' }
      expect(sortByDateAscending([invalid, valid]).map((x) => x.dateISO)).toEqual([
        EARLIER,
        'not-a-date',
      ])
      expect(sortByDateAscending([valid, invalid]).map((x) => x.dateISO)).toEqual([
        EARLIER,
        'not-a-date',
      ])
    })

    it('two invalid dates keep a stable text order', () => {
      const a = { dateISO: 'zzz-invalid' }
      const b = { dateISO: 'aaa-invalid' }
      // Neither is parseable, so byDateAscending falls back to localeCompare:
      // 'aaa-invalid' sorts before 'zzz-invalid' as text.
      expect(sortByDateAscending([a, b]).map((x) => x.dateISO)).toEqual([
        'aaa-invalid',
        'zzz-invalid',
      ])
    })
  })

  describe('equal instants', () => {
    it('return 0, including across representations', () => {
      expect(byDateAscending({ dateISO: '2026-01-01T20:00:00.000Z' }, { dateISO: '2026-01-01T20:00:00Z' })).toBe(0)
      expect(
        byDateAscending(
          { dateISO: '2026-01-01T20:00:00.000Z' },
          { dateISO: '2026-01-02T01:00:00+05:00' },
        ),
      ).toBe(0)
    })
  })

  describe('the computeProfile trend flip', () => {
    it('reports worsening in true chronological order, regardless of input order', () => {
      const early = session('early', EARLIER, 'task2', fakeAnalysis(['connector-comma'], 100))
      const late = session('late', LATER, 'task2', fakeAnalysis(Array(5).fill('connector-comma'), 100))

      const forward = computeProfile([early, late])
      const reversed = computeProfile([late, early])

      expect(forward.categories['connector-comma']?.trend).toBe('worsening')
      expect(reversed.categories['connector-comma']?.trend).toBe('worsening')
      expect(forward.categories['connector-comma']?.lastSeenISO).toBe(LATER)
      expect(reversed.categories['connector-comma']?.lastSeenISO).toBe(LATER)
    })
  })

  describe('the computeTrends sparkline order', () => {
    it('orders perSession by instant regardless of input order', () => {
      const early = session('early', EARLIER, 'task2', fakeAnalysis(['connector-comma'], 100))
      const late = session('late', LATER, 'task2', fakeAnalysis(Array(5).fill('connector-comma'), 100))

      for (const sessions of [
        [early, late],
        [late, early],
      ]) {
        const trends = computeTrends(sessions)
        const entry = trends.find((t) => t.category === 'connector-comma')
        expect(entry?.perSession.map((p) => p.dateISO)).toEqual([EARLIER, LATER])
      }
    })
  })

  describe('isBefore', () => {
    it('is true when a precedes b, false the other way, false when equal', () => {
      expect(isBefore({ dateISO: EARLIER }, { dateISO: LATER })).toBe(true)
      expect(isBefore({ dateISO: LATER }, { dateISO: EARLIER })).toBe(false)
      expect(isBefore({ dateISO: LATER }, { dateISO: LATER })).toBe(false)
    })
  })
})
