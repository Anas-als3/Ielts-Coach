/**
 * The authored Reading tests, and the two lookups the app needs.
 *
 * v1 shipped one complete test per module, deliberately: plan 010 budgets 4–6
 * hours of item-writing per passage and says to validate the format before
 * authoring more. The format having held, each module now carries a second
 * paper. Adding a test means adding a file here and one entry to
 * `READING_TESTS`; nothing else in the Reading code counts or names them.
 */
import type { ReadingModule, ReadingTest } from '../types'
import { ACADEMIC_TEST_01 } from './academicTest01'
import { ACADEMIC_TEST_02 } from './academicTest02'
import { GENERAL_TEST_01 } from './generalTest01'
import { GENERAL_TEST_02 } from './generalTest02'

export { ACADEMIC_TEST_01 } from './academicTest01'
export { ACADEMIC_TEST_02 } from './academicTest02'
export { GENERAL_TEST_01 } from './generalTest01'
export { GENERAL_TEST_02 } from './generalTest02'

/** Every authored test, in the order they should be offered. */
export const READING_TESTS: readonly ReadingTest[] = [
  ACADEMIC_TEST_01,
  ACADEMIC_TEST_02,
  GENERAL_TEST_01,
  GENERAL_TEST_02,
]

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
