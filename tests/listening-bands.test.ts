/**
 * Listening raw-score → band conversion (plan 011 step 3).
 *
 * The expectations below are written out RAW SCORE BY RAW SCORE rather than
 * derived from the table in `src/listening/bandTable.ts`. That is the whole
 * point: a test that recomputes the lookup from the same data proves only that
 * the loop works, whereas an independent restatement of all 41 rows catches a
 * mistyped boundary — the one bug in this module that would silently mislead
 * every learner who uses it.
 *
 * The table was verified against three published reproductions before it was
 * committed; the sources, and the one disagreement between them, are recorded
 * in the module's own header.
 */
import { describe, expect, it } from 'vitest'
import {
  LISTENING_BANDS,
  LISTENING_MAX_RAW,
  listeningRawToBand,
} from '../src/listening/bandTable'
import { rawToBand } from '../src/reading/bandTable'

/* ------------------------------ the expectations ----------------------------- */

/**
 * Listening, indexed by raw score 0–40.
 *
 * 39–40 → 9.0 · 37–38 → 8.5 · 35–36 → 8.0 · 32–34 → 7.5 · 30–31 → 7.0 ·
 * 26–29 → 6.5 · 23–25 → 6.0 · 18–22 → 5.5 · 16–17 → 5.0 · 13–15 → 4.5 ·
 * 11–12 → 4.0, and below 11 the floor band of 4.0.
 */
const EXPECTED: number[] = [
  4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, //  0–10  below the table: floor
  4.0, 4.0, //                                                11–12
  4.5, 4.5, 4.5, //                                           13–15
  5.0, 5.0, //                                                16–17
  5.5, 5.5, 5.5, 5.5, 5.5, //                                 18–22
  6.0, 6.0, 6.0, //                                           23–25
  6.5, 6.5, 6.5, 6.5, //                                      26–29
  7.0, 7.0, //                                                30–31
  7.5, 7.5, 7.5, //                                           32–34
  8.0, 8.0, //                                                35–36
  8.5, 8.5, //                                                37–38
  9.0, 9.0, //                                                39–40
]

const RAW_SCORES = Array.from({ length: LISTENING_MAX_RAW + 1 }, (_, raw) => raw)

/* --------------------------------- the table --------------------------------- */

describe('listening band table', () => {
  it('covers every raw score from 0 to 40 in the expectations', () => {
    expect(EXPECTED).toHaveLength(41)
  })

  it.each(RAW_SCORES)('converts %i correctly', (raw) => {
    expect(listeningRawToBand(raw)).toBe(EXPECTED[raw])
  })
})

/* -------------------------------- the anchor --------------------------------- */

describe('published anchors', () => {
  it('puts 30/40 at band 7.0', () => {
    expect(listeningRawToBand(30)).toBe(7.0)
  })

  it('needs 30 correct for a 7.0 and 39 for a 9.0', () => {
    const lowestFor = (band: number): number =>
      RAW_SCORES.find((raw) => listeningRawToBand(raw) >= band) ?? -1

    expect(lowestFor(7.0)).toBe(30)
    expect(lowestFor(9.0)).toBe(39)
  })
})

/* ------------------------- not a copy of Reading's --------------------------- */

describe('the Listening table is its own table', () => {
  it('is not derived from either Reading table', () => {
    // Listening shares Academic Reading's 7.0 boundary and almost nothing else.
    // If somebody ever "simplifies" this module by reusing rawToBand, these
    // three fail immediately.
    expect(listeningRawToBand(30)).toBe(rawToBand(30, 'academic'))
    expect(listeningRawToBand(23)).toBe(6.0)
    expect(rawToBand(23, 'academic')).toBe(6.0)
    expect(listeningRawToBand(18)).toBe(5.5)
    expect(rawToBand(18, 'academic')).toBe(5.0)
    expect(rawToBand(18, 'general')).toBe(4.0)
  })

  it('disagrees with Academic Reading at four boundaries', () => {
    // The two tables agree over most of the range and part company at exactly
    // these four marks. Pinning them means a future edit to either file has to
    // be deliberate about the relationship rather than accidental.
    const differing = RAW_SCORES.filter((raw) => listeningRawToBand(raw) !== rawToBand(raw, 'academic'))
    expect(differing).toEqual([15, 18, 26, 32])
  })
})

/* -------------------------------- robustness --------------------------------- */

describe('listeningRawToBand input handling', () => {
  it('clamps a score above 40 to the top of the table', () => {
    expect(listeningRawToBand(41)).toBe(9.0)
    expect(listeningRawToBand(1000)).toBe(9.0)
  })

  it('clamps a negative score to the floor band', () => {
    expect(listeningRawToBand(-1)).toBe(4.0)
    expect(listeningRawToBand(-1000)).toBe(4.0)
  })

  it('returns the floor band, not an extrapolation, below the lowest row', () => {
    // The published table stops at 11. Everything below reports the floor
    // rather than inventing a band 2.5 nobody published.
    expect(listeningRawToBand(0)).toBe(4.0)
    expect(listeningRawToBand(10)).toBe(4.0)
  })

  it('survives a non-finite score', () => {
    expect(listeningRawToBand(Number.NaN)).toBe(4.0)
    expect(listeningRawToBand(Number.POSITIVE_INFINITY)).toBe(4.0)
    expect(listeningRawToBand(Number.NEGATIVE_INFINITY)).toBe(4.0)
  })

  it('rounds a fractional score to the nearest whole mark', () => {
    expect(listeningRawToBand(29.6)).toBe(7.0)
    expect(listeningRawToBand(29.4)).toBe(6.5)
  })

  it('ignores the module argument the shared marker passes it', () => {
    // Listening is the same paper for both exams. The parameter exists only so
    // the function satisfies the marker's `BandFn` signature.
    expect(listeningRawToBand(30, 'academic')).toBe(7.0)
    expect(listeningRawToBand(30, 'general')).toBe(7.0)
  })
})

/* ---------------------------- table data integrity ---------------------------- */

describe('table data', () => {
  it('holds eleven rows, one per band from 4.0 to 9.0', () => {
    expect(LISTENING_BANDS).toHaveLength(11)
    expect(LISTENING_BANDS.map((row) => row.band)).toEqual([
      9.0, 8.5, 8.0, 7.5, 7.0, 6.5, 6.0, 5.5, 5.0, 4.5, 4.0,
    ])
  })

  it('is authored in descending order with no gaps or overlaps', () => {
    expect(LISTENING_BANDS[0].max).toBe(LISTENING_MAX_RAW)

    LISTENING_BANDS.forEach((row, i) => {
      expect(row.min, `row ${i} bounds`).toBeLessThanOrEqual(row.max)
      if (i > 0) {
        // Each row starts exactly one mark below the row above it.
        expect(row.max, `row ${i} continuity`).toBe(LISTENING_BANDS[i - 1].min - 1)
      }
    })
  })

  it('pins the published table verbatim', () => {
    expect(LISTENING_BANDS.map((r) => [r.min, r.max, r.band])).toEqual([
      [39, 40, 9.0],
      [37, 38, 8.5],
      [35, 36, 8.0],
      [32, 34, 7.5],
      [30, 31, 7.0],
      [26, 29, 6.5],
      [23, 25, 6.0],
      [18, 22, 5.5],
      [16, 17, 5.0],
      [13, 15, 4.5],
      [11, 12, 4.0],
    ])
  })
})
