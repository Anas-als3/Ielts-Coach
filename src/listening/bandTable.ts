/**
 * Raw-score → band conversion for IELTS Listening. Implements plan 011 step 3.
 *
 * **One table, not two.** Academic and General Training candidates sit the same
 * Listening paper and are converted by the same numbers, so unlike
 * `src/reading/bandTable.ts` this file exposes a single row set and
 * `listeningRawToBand` takes no module argument. Plan 011: "Listening needs no
 * Academic/General branching. Resist any abstraction that implies otherwise."
 *
 * | Band | Raw score /40 |
 * |------|---------------|
 * | 9.0  | 39–40 |
 * | 8.5  | 37–38 |
 * | 8.0  | 35–36 |
 * | 7.5  | 32–34 |
 * | 7.0  | 30–31 |
 * | 6.5  | 26–29 |
 * | 6.0  | 23–25 |
 * | 5.5  | 18–22 |
 * | 5.0  | 16–17 |
 * | 4.5  | 13–15 |
 * | 4.0  | 11–12 |
 *
 * ## Verification
 *
 * Checked against three independently published reproductions of the table
 * before it was committed:
 *
 *  - IDP IELTS India (a co-owner of the test),
 *    https://ieltsidpindia.com/information/ielts-band-scores/listening — agrees
 *    with every row above, including 11–12 → 4.0.
 *  - https://ieltstutors.org/listening-band-scores/ — agrees with every row
 *    except the last, which it gives as 10–12 → 4.0.
 *  - https://edubenchmark.com/blog/ielts-listening-score-chart-band-scores-out-of-40/
 *    — likewise agrees except the last row, also 10–12 → 4.0.
 *
 * The one disagreement is the bottom row and it is **not observable through
 * this function**: 10 correct falls below the lowest row either way, and
 * `FLOOR_BEHAVIOUR` returns the floor band 4.0 for anything below the table, so
 * `listeningRawToBand(10)` is 4.0 under both readings. The co-owner's figure is
 * used for the stored data. If IELTS revises the table, this file is the single
 * place to change.
 *
 * Note the shape is genuinely different from Reading's, not a copy with the
 * numbers nudged: Listening's 7.0 needs 30 (as Academic Reading does) but its
 * 6.0 needs only 23 and its 5.5 band is five marks wide. Deriving one table
 * from the other would have been wrong at nearly every boundary.
 *
 * Pure, data-driven and total: every input from -Infinity to +Infinity returns
 * a band from the table. `tests/listening-bands.test.ts` walks all 41 raw
 * scores.
 */

/** One printed row: a closed raw-score range and the band it converts to. */
export interface ListeningBandRow {
  /** Inclusive lower bound of the raw score range. */
  min: number
  /** Inclusive upper bound. */
  max: number
  band: number
}

/**
 * The published Listening table, in descending band order.
 *
 * It stops at band 4.0. Below that the exam reports bands the public tables do
 * not enumerate, so this app does not invent them — see `FLOOR_BEHAVIOUR` on
 * `listeningRawToBand`.
 */
export const LISTENING_BANDS: readonly ListeningBandRow[] = [
  { min: 39, max: 40, band: 9.0 },
  { min: 37, max: 38, band: 8.5 },
  { min: 35, max: 36, band: 8.0 },
  { min: 32, max: 34, band: 7.5 },
  { min: 30, max: 31, band: 7.0 },
  { min: 26, max: 29, band: 6.5 },
  { min: 23, max: 25, band: 6.0 },
  { min: 18, max: 22, band: 5.5 },
  { min: 16, max: 17, band: 5.0 },
  { min: 13, max: 15, band: 4.5 },
  { min: 11, max: 12, band: 4.0 },
]

/** Highest raw score obtainable — every IELTS Listening paper is 40 questions. */
export const LISTENING_MAX_RAW = 40

/**
 * Convert a Listening raw score to a band.
 *
 * `FLOOR_BEHAVIOUR`: a raw score below the lowest printed row returns that
 * row's band — the FLOOR, not an extrapolation. Extrapolating would report a
 * band 2.5 the published table never states, dressing a guess up as the same
 * authoritative number the rest of this table earns. A learner on 4/40 is told
 * 4.0, and the report's job is to make the raw score, which is the honest
 * signal at that level, impossible to miss.
 *
 * The raw score is clamped to 0–40 and rounded, so a caller cannot produce a
 * band from a count it could not have scored. A non-finite input is treated
 * as 0.
 *
 * The optional second parameter exists only so this function satisfies the
 * shared marker's `BandFn` signature without a wrapper; it is ignored, because
 * Listening has no module distinction to ignore it for.
 *
 * @param raw Correct answers out of 40.
 * @returns A band in 0.5 steps. Never NaN, never undefined.
 *
 * @example
 * listeningRawToBand(30) // 7.0 — the published anchor
 * listeningRawToBand(23) // 6.0 — three marks cheaper than Academic Reading's
 * listeningRawToBand(2)  // 4.0 — the floor band, not an extrapolation
 */
export function listeningRawToBand(raw: number, _ignoredModule?: unknown): number {
  const safe = Number.isFinite(raw) ? Math.round(raw) : 0
  const clamped = Math.max(0, Math.min(LISTENING_MAX_RAW, safe))

  for (const row of LISTENING_BANDS) {
    if (clamped >= row.min && clamped <= row.max) return row.band
  }

  // Below the lowest printed row. The table is authored in descending order, so
  // the last row is the floor.
  return LISTENING_BANDS[LISTENING_BANDS.length - 1].band
}
