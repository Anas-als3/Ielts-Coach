/**
 * Reading raw-score → band conversion (plan 010 "Band tables").
 *
 * The expectations below are written out RAW SCORE BY RAW SCORE rather than
 * derived from the tables in `src/reading/bandTable.ts`. That is the whole
 * point: a test that recomputes the lookup from the same data proves only that
 * the loop works, whereas an independent restatement of all 41 rows in both
 * modules catches a mistyped boundary — the one bug in this module that would
 * silently mislead every learner who uses it.
 *
 * 41 raw scores × 2 modules = 82 conversions, plus the published anchors and
 * the ordering property that General Training is never more generous.
 */
import { describe, expect, it } from 'vitest'
import {
  ACADEMIC_READING_BANDS,
  GENERAL_READING_BANDS,
  READING_BAND_TABLES,
  READING_MAX_RAW,
  rawToBand,
} from '../src/reading/bandTable'
import type { ReadingModule } from '../src/reading/types'

/* ------------------------------ the expectations ----------------------------- */

/**
 * Academic Reading, indexed by raw score 0–40.
 *
 * 39–40 → 9.0 · 37–38 → 8.5 · 35–36 → 8.0 · 33–34 → 7.5 · 30–32 → 7.0 ·
 * 27–29 → 6.5 · 23–26 → 6.0 · 19–22 → 5.5 · 15–18 → 5.0 · 13–14 → 4.5 ·
 * 10–12 → 4.0, and below 10 the floor band of 4.0.
 */
const ACADEMIC_EXPECTED: number[] = [
  4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, //  0–9   below the table: floor
  4.0, 4.0, 4.0, //                                     10–12
  4.5, 4.5, //                                          13–14
  5.0, 5.0, 5.0, 5.0, //                                15–18
  5.5, 5.5, 5.5, 5.5, //                                19–22
  6.0, 6.0, 6.0, 6.0, //                                23–26
  6.5, 6.5, 6.5, //                                     27–29
  7.0, 7.0, 7.0, //                                     30–32
  7.5, 7.5, //                                          33–34
  8.0, 8.0, //                                          35–36
  8.5, 8.5, //                                          37–38
  9.0, 9.0, //                                          39–40
]

/**
 * General Training Reading, indexed by raw score 0–40.
 *
 * 40 → 9.0 · 39 → 8.5 · 37–38 → 8.0 · 36 → 7.5 · 34–35 → 7.0 · 32–33 → 6.5 ·
 * 30–31 → 6.0 · 27–29 → 5.5 · 23–26 → 5.0 · 19–22 → 4.5 · 15–18 → 4.0, and
 * below 15 the floor band of 4.0.
 */
const GENERAL_EXPECTED: number[] = [
  4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, //  0–9   below the table: floor
  4.0, 4.0, 4.0, 4.0, 4.0, //                           10–14 below the table: floor
  4.0, 4.0, 4.0, 4.0, //                                15–18
  4.5, 4.5, 4.5, 4.5, //                                19–22
  5.0, 5.0, 5.0, 5.0, //                                23–26
  5.5, 5.5, 5.5, //                                     27–29
  6.0, 6.0, //                                          30–31
  6.5, 6.5, //                                          32–33
  7.0, 7.0, //                                          34–35
  7.5, //                                               36
  8.0, 8.0, //                                          37–38
  8.5, //                                               39
  9.0, //                                               40
]

const RAW_SCORES = Array.from({ length: READING_MAX_RAW + 1 }, (_, raw) => raw)

/* --------------------------------- the tables -------------------------------- */

describe('reading band tables', () => {
  it('covers every raw score from 0 to 40 in the expectations', () => {
    expect(ACADEMIC_EXPECTED).toHaveLength(41)
    expect(GENERAL_EXPECTED).toHaveLength(41)
  })

  it.each(RAW_SCORES)('converts Academic %i correctly', (raw) => {
    expect(rawToBand(raw, 'academic')).toBe(ACADEMIC_EXPECTED[raw])
  })

  it.each(RAW_SCORES)('converts General Training %i correctly', (raw) => {
    expect(rawToBand(raw, 'general')).toBe(GENERAL_EXPECTED[raw])
  })
})

/* ------------------------------- the anchors --------------------------------- */

describe('published anchors', () => {
  it('puts Academic 30/40 at band 7.0', () => {
    expect(rawToBand(30, 'academic')).toBe(7.0)
  })

  it('puts General Training 34/40 at band 7.0', () => {
    expect(rawToBand(34, 'general')).toBe(7.0)
  })

  it('needs four more correct answers for a General Training 7.0', () => {
    const lowestFor = (module: ReadingModule, band: number): number =>
      RAW_SCORES.find((raw) => rawToBand(raw, module) >= band) ?? -1

    expect(lowestFor('academic', 7.0)).toBe(30)
    expect(lowestFor('general', 7.0)).toBe(34)
    expect(lowestFor('general', 7.0) - lowestFor('academic', 7.0)).toBe(4)
  })
})

/* ------------------------------ the ordering rule ---------------------------- */

describe('General Training is never the more generous table', () => {
  it('never awards a higher band than Academic for the same raw score', () => {
    for (const raw of RAW_SCORES) {
      expect(
        rawToBand(raw, 'general'),
        `raw ${raw}: General Training must not beat Academic`,
      ).toBeLessThanOrEqual(rawToBand(raw, 'academic'))
    }
  })

  it('is strictly stricter across most of the usable range', () => {
    const stricter = RAW_SCORES.filter((raw) => rawToBand(raw, 'general') < rawToBand(raw, 'academic'))

    // Everything from 13 (the lowest Academic row above the floor) to 39.
    expect(stricter[0]).toBe(13)
    expect(stricter[stricter.length - 1]).toBe(39)
    expect(stricter).toHaveLength(27)
  })
})

/* -------------------------------- robustness --------------------------------- */

describe('rawToBand input handling', () => {
  it('clamps a score above 40 to the top of the table', () => {
    expect(rawToBand(41, 'academic')).toBe(9.0)
    expect(rawToBand(1000, 'general')).toBe(9.0)
  })

  it('clamps a negative score to the floor band', () => {
    expect(rawToBand(-1, 'academic')).toBe(4.0)
    expect(rawToBand(-1000, 'general')).toBe(4.0)
  })

  it('returns the floor band, not an extrapolation, below the lowest row', () => {
    // The published tables stop at 10 (Academic) and 15 (GT). Everything below
    // reports the floor rather than inventing a band 2.5 nobody published.
    expect(rawToBand(0, 'academic')).toBe(4.0)
    expect(rawToBand(9, 'academic')).toBe(4.0)
    expect(rawToBand(0, 'general')).toBe(4.0)
    expect(rawToBand(14, 'general')).toBe(4.0)
  })

  it('survives a non-finite score', () => {
    expect(rawToBand(Number.NaN, 'academic')).toBe(4.0)
    expect(rawToBand(Number.POSITIVE_INFINITY, 'academic')).toBe(4.0)
    expect(rawToBand(Number.NEGATIVE_INFINITY, 'general')).toBe(4.0)
  })

  it('rounds a fractional score to the nearest whole mark', () => {
    expect(rawToBand(29.6, 'academic')).toBe(7.0)
    expect(rawToBand(29.4, 'academic')).toBe(6.5)
  })
})

/* ---------------------------- table data integrity ---------------------------- */

describe('table data', () => {
  it('holds eleven rows per module, one per band from 4.0 to 9.0', () => {
    for (const [module, table] of Object.entries(READING_BAND_TABLES)) {
      expect(table, `${module} row count`).toHaveLength(11)
      expect(table.map((row) => row.band)).toEqual([9.0, 8.5, 8.0, 7.5, 7.0, 6.5, 6.0, 5.5, 5.0, 4.5, 4.0])
    }
  })

  it('is authored in descending order with no gaps or overlaps', () => {
    for (const [module, table] of Object.entries(READING_BAND_TABLES)) {
      expect(table[0].max, `${module} top of table`).toBe(READING_MAX_RAW)

      table.forEach((row, i) => {
        expect(row.min, `${module} row ${i} bounds`).toBeLessThanOrEqual(row.max)
        if (i > 0) {
          // Each row starts exactly one mark below the row above it.
          expect(row.max, `${module} row ${i} continuity`).toBe(table[i - 1].min - 1)
        }
      })
    }
  })

  it('pins the two published tables verbatim', () => {
    expect(ACADEMIC_READING_BANDS.map((r) => [r.min, r.max, r.band])).toEqual([
      [39, 40, 9.0],
      [37, 38, 8.5],
      [35, 36, 8.0],
      [33, 34, 7.5],
      [30, 32, 7.0],
      [27, 29, 6.5],
      [23, 26, 6.0],
      [19, 22, 5.5],
      [15, 18, 5.0],
      [13, 14, 4.5],
      [10, 12, 4.0],
    ])

    expect(GENERAL_READING_BANDS.map((r) => [r.min, r.max, r.band])).toEqual([
      [40, 40, 9.0],
      [39, 39, 8.5],
      [37, 38, 8.0],
      [36, 36, 7.5],
      [34, 35, 7.0],
      [32, 33, 6.5],
      [30, 31, 6.0],
      [27, 29, 5.5],
      [23, 26, 5.0],
      [19, 22, 4.5],
      [15, 18, 4.0],
    ])
  })
})
