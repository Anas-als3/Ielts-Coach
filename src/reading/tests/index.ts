/**
 * The authored Reading tests, and the two lookups the app needs.
 *
 * One complete test per module ships in v1, which is deliberate: plan 010
 * budgets 4–6 hours of item-writing per passage and says to validate the format
 * before authoring more. Adding a test means adding a file here and one entry
 * to `READING_TESTS`; nothing else in the Reading code counts or names them.
 */
import type { ReadingModule, ReadingTest } from '../types'
import { ACADEMIC_TEST_01 } from './academicTest01'
import { GENERAL_TEST_01 } from './generalTest01'

export { ACADEMIC_TEST_01 } from './academicTest01'
export { GENERAL_TEST_01 } from './generalTest01'

/** Every authored test, in the order they should be offered. */
export const READING_TESTS: readonly ReadingTest[] = [ACADEMIC_TEST_01, GENERAL_TEST_01]

/**
 * Tests for one exam. A learner must never be offered the other module's paper:
 * the passages are structured differently AND it would be marked against the
 * wrong conversion table.
 */
export function readingTestsForModule(module: ReadingModule): ReadingTest[] {
  return READING_TESTS.filter((test) => test.module === module)
}

/** Look a test up by id. Returns null rather than throwing on an unknown id. */
export function readingTestById(id: string): ReadingTest | null {
  return READING_TESTS.find((test) => test.id === id) ?? null
}
