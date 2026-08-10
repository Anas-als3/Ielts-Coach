/**
 * The authored Listening tests, and the lookup the app needs.
 *
 * Test 1 shipped alone under plan 011, deliberately: a Listening test costs
 * more to write than a Reading one — four scripts, forty items and a difficulty
 * curve — and the plan said to validate the format before authoring more. The
 * format held, and test 2 is the first paper written against it. Adding a test
 * means adding a file here and one entry to `LISTENING_TESTS`; nothing else in
 * the Listening code counts or names them.
 *
 * There is no `listeningTestsForModule`. Academic and General Training
 * candidates sit the same Listening paper, so there is nothing to filter on and
 * a filter would only invite a caller to believe otherwise.
 */
import type { ListeningTest } from '../types'
import { LISTENING_TEST_01 } from './test01'
import { LISTENING_TEST_02 } from './test02'

export { LISTENING_TEST_01 } from './test01'
export { LISTENING_TEST_02 } from './test02'

/** Every authored test, in the order they should be offered. */
export const LISTENING_TESTS: readonly ListeningTest[] = [LISTENING_TEST_01, LISTENING_TEST_02]

/** Look a test up by id. Returns null rather than throwing on an unknown id. */
export function listeningTestById(id: string): ListeningTest | null {
  return LISTENING_TESTS.find((test) => test.id === id) ?? null
}
