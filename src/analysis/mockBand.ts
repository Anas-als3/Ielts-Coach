/**
 * The mock sitting's combined result: the mean of its three section bands,
 * rounded to the nearest half band with the OFFICIAL IELTS tie-break — a
 * quarter band rounds UP, not down. Implements plan 013's "Overall shown as
 * the mean of the three section bands rounded to nearest 0.5".
 *
 * `bandEstimate.ts`'s `roundOverallHalfDown` exists for the opposite reason:
 * the Writing engine's own overall is an unproven heuristic, so a tie there is
 * resolved AGAINST the learner on purpose (never round an estimate in the
 * learner's favour). The mock's overall is not that kind of number — Listening
 * and Reading are exact, and the published IELTS rule is the one every real
 * candidate's overall is rounded by — so reusing the conservative function
 * here would be quietly WRONG, not merely different. Plan 013 says so
 * explicitly: "do not reuse roundOverallHalfDown here."
 */
import type { MockAttempt } from '../types'

/**
 * Round to the nearest 0.5, ties (an exact quarter — x.25 or x.75) rounding
 * UP. `Math.round` already rounds an exact .5 towards +Infinity for a
 * non-negative input, so doubling first and halving after reuses that
 * behaviour rather than reimplementing it: `roundOverallHalfUp(6.25)` doubles
 * to 12.5, `Math.round` takes it to 13, halved back to 6.5 — up, not down.
 */
export function roundOverallHalfUp(x: number): number {
  return Math.round(x * 2) / 2
}

/**
 * One completed mock sitting's three section bands and the rounded overall.
 */
export interface MockBands {
  listening: number
  reading: number
  writing: number
  overall: number
}

/**
 * `MockBands` for a sitting, or `null` while any of its three legs has not
 * produced a result yet.
 *
 * That null case is not a formality. `attempt.writingRecord` (and its two
 * siblings) is typed `| null` precisely because the sitting IS incomplete for
 * most of its own lifetime, and a function that silently treated a missing leg
 * as a zero — or divided by however many happen to be present — would show a
 * confident three-section overall built from two sections: worse than no
 * overall at all, because a band that low is exactly the number someone acts
 * on (`reading/bandTable.ts` states the identical policy for its own floor
 * case). `MockTest`'s summary screen calls this and renders an honest
 * "not complete" message on `null` rather than ever reaching the arithmetic
 * below with a gap in it.
 */
export function mockBandsFor(attempt: MockAttempt): MockBands | null {
  const { listeningRecord, readingRecord, writingRecord } = attempt
  if (listeningRecord === null || readingRecord === null || writingRecord === null) return null
  const listening = listeningRecord.result.band
  const reading = readingRecord.result.band
  const writing = writingRecord.analysis.band.overall
  return {
    listening,
    reading,
    writing,
    overall: roundOverallHalfUp((listening + reading + writing) / 3),
  }
}
