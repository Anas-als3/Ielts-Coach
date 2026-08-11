/**
 * The mock sitting's combined band (`src/analysis/mockBand.ts`), pinned as a
 * pure function so the two things plan 013 explicitly asks to be
 * mutation-tested — the rounding rule, and the guard against an unfinished
 * leg — are decidable without rendering anything.
 *
 * `roundOverallHalfUp` is tested DIRECTLY against `roundOverallHalfDown`
 * rather than only through `mockBandsFor`, and that split is deliberate, not
 * redundant: a mock's three inputs are always 0.5-band values, and the mean of
 * three 0.5-multiples can never land on an EXACT quarter band (its
 * denominator is 6, and 6 * 0.25 is not an integer) — so a mutant that swapped
 * `roundOverallHalfUp` for `roundOverallHalfDown` inside `mockBandsFor` would
 * pass every test built only from realistic section bands. The direct test
 * below is the one that actually distinguishes the two functions.
 */
import { describe, expect, it } from 'vitest'
import { mockBandsFor, roundOverallHalfUp } from '../src/analysis/mockBand'
import { roundOverallHalfDown } from '../src/analysis/bandEstimate'
import type {
  Analysis,
  BandEstimate,
  Criterion,
  ListeningSessionRecord,
  MockAttempt,
  ReadingSessionRecord,
  WritingSessionRecord,
} from '../src/types'

/* --------------------------------- fixtures ---------------------------------- */

const CRITERIA: Criterion[] = ['TR', 'CC', 'LR', 'GRA']

function fakeBand(overall: number): BandEstimate {
  const byCriterion = {} as Record<Criterion, number>
  const rationale = {} as Record<Criterion, string[]>
  for (const c of CRITERIA) {
    byCriterion[c] = overall
    rationale[c] = []
  }
  return { overall, byCriterion, rationale }
}

function fakeAnalysis(overall: number): Analysis {
  return {
    issues: [],
    paragraphs: [],
    structure: [],
    stats: {
      wordCount: 260,
      sentenceCount: 12,
      paragraphCount: 4,
      avgSentenceLength: 20,
      sentenceLengthStdDev: 5,
      typeTokenRatio: 0.6,
      linkingDeviceCount: 6,
    },
    band: fakeBand(overall),
  }
}

function readingRecord(band: number): ReadingSessionRecord {
  return {
    section: 'reading',
    id: 'r1',
    dateISO: '2026-08-01T00:00:00Z',
    module: 'academic',
    testId: 'reading-academic-01',
    testTitle: 'Academic Reading Test 1',
    answers: {},
    durationSec: 3600,
    result: {
      testId: 'reading-academic-01',
      module: 'academic',
      raw: 30,
      total: 40,
      band,
      questions: [],
      byType: [],
    },
  }
}

function listeningRecord(band: number): ListeningSessionRecord {
  return {
    section: 'listening',
    id: 'l1',
    dateISO: '2026-08-01T00:00:00Z',
    testId: 'listening-01',
    testTitle: 'Listening Test 1',
    answers: {},
    durationSec: 1800,
    practice: false,
    result: {
      testId: 'listening-01',
      raw: 30,
      total: 40,
      band,
      questions: [],
      byType: [],
      byFormat: [],
    },
  }
}

function writingRecord(overall: number): WritingSessionRecord {
  return {
    section: 'writing',
    id: 'w1',
    dateISO: '2026-08-01T00:00:00Z',
    mode: 'exam',
    task: 'task2',
    module: 'academic',
    promptId: null,
    promptText: '',
    questionType: null,
    essayText: 'x'.repeat(1500),
    durationSec: 2400,
    pacing: null,
    pasteAttempts: 0,
    analysis: fakeAnalysis(overall),
  }
}

function attempt(
  overrides: Partial<Pick<MockAttempt, 'listeningRecord' | 'readingRecord' | 'writingRecord'>> = {},
): MockAttempt {
  return {
    module: 'academic',
    listeningTestId: 'listening-01',
    readingTestId: 'reading-academic-01',
    listeningRecord: listeningRecord(6.5),
    readingRecord: readingRecord(6.5),
    writingRecord: writingRecord(6.5),
    ...overrides,
  }
}

/* -------------------------- roundOverallHalfUp -------------------------- */

describe('roundOverallHalfUp', () => {
  it('rounds an exact quarter band UP to the next half band', () => {
    expect(roundOverallHalfUp(6.25)).toBe(6.5)
    expect(roundOverallHalfUp(6.75)).toBe(7.0)
  })

  it('disagrees with roundOverallHalfDown at exactly the values that distinguish them', () => {
    // The mutation kill: this is the assertion that fails if `mockBandsFor`
    // (or a future refactor) is changed to call the conservative Writing
    // rounding instead of this one.
    expect(roundOverallHalfUp(6.25)).not.toBe(roundOverallHalfDown(6.25))
    expect(roundOverallHalfUp(6.75)).not.toBe(roundOverallHalfDown(6.75))
    expect(roundOverallHalfDown(6.25)).toBe(6.0)
    expect(roundOverallHalfDown(6.75)).toBe(6.5)
  })

  it('leaves an exact half band untouched', () => {
    expect(roundOverallHalfUp(6.0)).toBe(6.0)
    expect(roundOverallHalfUp(6.5)).toBe(6.5)
  })

  it('rounds a non-tie value to its nearer half band, same as the conservative function', () => {
    // Away from the exact quarter, both rounding rules agree — only the
    // tie-break differs, which is the whole point of testing the tie
    // explicitly above rather than trusting a handful of ordinary values.
    expect(roundOverallHalfUp(6.1)).toBe(roundOverallHalfDown(6.1))
    expect(roundOverallHalfUp(6.4)).toBe(roundOverallHalfDown(6.4))
  })
})

/* ------------------------------ mockBandsFor ----------------------------- */

describe('mockBandsFor', () => {
  it('returns null while any leg has not produced a result yet', () => {
    // The orchestration guard: a mutant that dropped this null check (e.g. by
    // treating a missing record as band 0, or by dividing by however many
    // legs happen to be present) would show a confident overall from an
    // unfinished sitting — exactly the "skipping the subtract of an
    // unfinished stage" failure plan 013 calls out.
    expect(mockBandsFor(attempt({ writingRecord: null }))).toBeNull()
    expect(mockBandsFor(attempt({ readingRecord: null }))).toBeNull()
    expect(mockBandsFor(attempt({ listeningRecord: null }))).toBeNull()
    expect(mockBandsFor(attempt({ listeningRecord: null, readingRecord: null, writingRecord: null }))).toBeNull()
  })

  it('reports each section band exactly as its own record carries it', () => {
    const a = attempt({
      listeningRecord: listeningRecord(7.0),
      readingRecord: readingRecord(6.0),
      writingRecord: writingRecord(6.5),
    })
    const bands = mockBandsFor(a)
    expect(bands).not.toBeNull()
    expect(bands!.listening).toBe(7.0)
    expect(bands!.reading).toBe(6.0)
    expect(bands!.writing).toBe(6.5)
  })

  it('rounds the mean of three achievable half-band values to the nearest half band', () => {
    // (6.0 + 6.0 + 6.5) / 3 = 6.1667 -> nearest half band is 6.0.
    expect(
      mockBandsFor(
        attempt({ listeningRecord: listeningRecord(6.0), readingRecord: readingRecord(6.0), writingRecord: writingRecord(6.5) }),
      )!.overall,
    ).toBe(6.0)

    // (6.0 + 6.5 + 6.5) / 3 = 6.3333 -> nearest half band is 6.5.
    expect(
      mockBandsFor(
        attempt({ listeningRecord: listeningRecord(6.0), readingRecord: readingRecord(6.5), writingRecord: writingRecord(6.5) }),
      )!.overall,
    ).toBe(6.5)

    // (6.5 + 7.0 + 7.0) / 3 = 6.8333 -> nearest half band is 7.0.
    expect(
      mockBandsFor(
        attempt({ listeningRecord: listeningRecord(6.5), readingRecord: readingRecord(7.0), writingRecord: writingRecord(7.0) }),
      )!.overall,
    ).toBe(7.0)
  })

  it('leaves an already-exact mean untouched', () => {
    // (6.0 + 6.5 + 7.0) / 3 = 6.5 exactly.
    expect(
      mockBandsFor(
        attempt({ listeningRecord: listeningRecord(6.0), readingRecord: readingRecord(6.5), writingRecord: writingRecord(7.0) }),
      )!.overall,
    ).toBe(6.5)
  })
})
