/**
 * Raw-score → band conversion for IELTS Reading. Implements plan 010 "Band
 * tables".
 *
 * **These tables are canonical data.** They are the published conversions, not
 * an approximation, and they are the reason Reading can report an exact band
 * where the writing engine can only estimate one. If IELTS revises them, this
 * file is the single place to change.
 *
 * The two modules are NOT the same table, and the difference is large enough to
 * mislead a learner about their readiness if it is got wrong: General Training
 * needs roughly four more correct answers for the same band. A candidate on
 * 30/40 is a 7.0 in Academic and a 6.0 in General Training.
 *
 * | Band | Academic | General Training |
 * |------|----------|------------------|
 * | 9.0  | 39–40    | 40               |
 * | 8.5  | 37–38    | 39               |
 * | 8.0  | 35–36    | 37–38            |
 * | 7.5  | 33–34    | 36               |
 * | 7.0  | 30–32    | 34–35            |
 * | 6.5  | 27–29    | 32–33            |
 * | 6.0  | 23–26    | 30–31            |
 * | 5.5  | 19–22    | 27–29            |
 * | 5.0  | 15–18    | 23–26            |
 * | 4.5  | 13–14    | 19–22            |
 * | 4.0  | 10–12    | 15–18            |
 *
 * Sources: https://www.ielts.org/take-a-test/your-results/ielts-scoring-in-detail
 * and the published raw-score conversion tables reproduced at
 * https://typogrammar.com/ielts/ielts-reading-raw-score-to-band-conversion/
 *
 * Pure, data-driven and total: every input from -Infinity to +Infinity returns
 * a band from the table. `tests/reading-bands.test.ts` walks all 41 raw scores
 * in both modules.
 */
import type { ReadingModule } from './types'

/** One printed row: a closed raw-score range and the band it converts to. */
export interface ReadingBandRow {
  /** Inclusive lower bound of the raw score range. */
  min: number
  /** Inclusive upper bound. */
  max: number
  band: number
}

/**
 * Academic Reading, in descending band order.
 *
 * The published table stops at band 4.0 / 10 correct. Below that the exam
 * reports bands the public tables do not enumerate, so this app does not invent
 * them: see `FLOOR_BEHAVIOUR` on `rawToBand`.
 */
export const ACADEMIC_READING_BANDS: readonly ReadingBandRow[] = [
  { min: 39, max: 40, band: 9.0 },
  { min: 37, max: 38, band: 8.5 },
  { min: 35, max: 36, band: 8.0 },
  { min: 33, max: 34, band: 7.5 },
  { min: 30, max: 32, band: 7.0 },
  { min: 27, max: 29, band: 6.5 },
  { min: 23, max: 26, band: 6.0 },
  { min: 19, max: 22, band: 5.5 },
  { min: 15, max: 18, band: 5.0 },
  { min: 13, max: 14, band: 4.5 },
  { min: 10, max: 12, band: 4.0 },
]

/** General Training Reading, in descending band order. Stricter throughout. */
export const GENERAL_READING_BANDS: readonly ReadingBandRow[] = [
  { min: 40, max: 40, band: 9.0 },
  { min: 39, max: 39, band: 8.5 },
  { min: 37, max: 38, band: 8.0 },
  { min: 36, max: 36, band: 7.5 },
  { min: 34, max: 35, band: 7.0 },
  { min: 32, max: 33, band: 6.5 },
  { min: 30, max: 31, band: 6.0 },
  { min: 27, max: 29, band: 5.5 },
  { min: 23, max: 26, band: 5.0 },
  { min: 19, max: 22, band: 4.5 },
  { min: 15, max: 18, band: 4.0 },
]

/** The two tables, by module. */
export const READING_BAND_TABLES: Record<ReadingModule, readonly ReadingBandRow[]> = {
  academic: ACADEMIC_READING_BANDS,
  general: GENERAL_READING_BANDS,
}

/**
 * The table for a module, for callers that cannot prove the module is one.
 *
 * `READING_BAND_TABLES[module]` is a total lookup only while `module` really is
 * a `ReadingModule`. Values arriving from localStorage or from an imported file
 * are `unknown` no matter what the type says, and a stored record carrying
 * `module: 'speaking'` used to return `undefined` here, throw "table is not
 * iterable" out of a `for...of` inside a render, and take the WHOLE app down
 * behind the error boundary — a total blank screen because one saved record was
 * mistyped.
 *
 * Falls back to ACADEMIC, which is the same default every other unknown-module
 * path in this codebase picks: the v2 -> v3 migration stamps `academic` on
 * records that predate the field, and `categoryAppliesTo` reads a missing module
 * as Academic. Returning the floor band instead would be worse than a possibly
 * wrong table — it would report a confident 4.0 to a learner who may have
 * scored 39, and a band that low is exactly the number someone acts on.
 *
 * It warns rather than falling back in silence, because a wrong table is a
 * band out by up to a whole point and that must be visible to whoever is
 * looking. `src/profile/store.ts` now rejects such a record on read, so this is
 * the second line of defence and should never fire in a healthy build.
 */
export function readingBandTable(module: ReadingModule): readonly ReadingBandRow[] {
  const table = READING_BAND_TABLES[module]
  if (table !== undefined) return table
  console.warn(
    `IELTS Coach: unknown Reading module "${String(module)}" — ` +
      'scoring it with the Academic table. The band shown may not be the one for this exam.',
  )
  return ACADEMIC_READING_BANDS
}

/** Highest raw score obtainable — every IELTS Reading paper is 40 questions. */
export const READING_MAX_RAW = 40

/**
 * Convert a raw score to a band for one module.
 *
 * `FLOOR_BEHAVIOUR`: a raw score below the lowest printed row returns that
 * row's band — the FLOOR, not an extrapolation. Extrapolating would report a
 * band 2.5 that the published table never states, dressing a guess up as the
 * same authoritative number the rest of this table earns. A learner on 4/40
 * Academic is told 4.0 and the report's job is to make the raw score, which is
 * the honest signal at that level, impossible to miss.
 *
 * The raw score is clamped to 0–40 and rounded, so a caller cannot produce a
 * band from a count it could not have scored. A non-finite input is treated
 * as 0. An unrecognised MODULE is scored with the Academic table rather than
 * throwing — see `readingBandTable` for why this function must be total in its
 * second argument as well as its first.
 *
 * @param raw Correct answers out of 40.
 * @param module Which exam's table to use.
 * @returns A band in 0.5 steps. Never NaN, never undefined, never throws.
 *
 * @example
 * rawToBand(30, 'academic') // 7.0
 * rawToBand(30, 'general')  // 6.0 — four more correct needed for the same band
 * rawToBand(3, 'academic')  // 4.0 — the floor band, not an extrapolation
 */
export function rawToBand(raw: number, module: ReadingModule): number {
  const table = readingBandTable(module)
  const safe = Number.isFinite(raw) ? Math.round(raw) : 0
  const clamped = Math.max(0, Math.min(READING_MAX_RAW, safe))

  for (const row of table) {
    if (clamped >= row.min && clamped <= row.max) return row.band
  }

  // Below the lowest printed row. The table is authored in descending order, so
  // the last row is the floor.
  return table[table.length - 1].band
}
