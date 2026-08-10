/**
 * The authored Listening tests, and the lookup the app needs.
 *
 * One complete test ships in this plan, deliberately: a Listening test costs
 * more to write than a Reading one — four scripts, forty items and a difficulty
 * curve — and plan 011 says to validate the format before authoring more.
 * Adding a test means adding a file here and one entry to `LISTENING_TESTS`;
 * nothing else in the Listening code counts or names them.
 *
 * There is no `listeningTestsForModule`. Academic and General Training
 * candidates sit the same Listening paper, so there is nothing to filter on and
 * a filter would only invite a caller to believe otherwise.
 */
import type { ListeningTest } from '../types'
import { LISTENING_TEST_01 } from './test01'

export { LISTENING_TEST_01 } from './test01'

/** Every authored test, in the order they should be offered. */
export const LISTENING_TESTS: readonly ListeningTest[] = [LISTENING_TEST_01]

/** Look a test up by id. Returns null rather than throwing on an unknown id. */
export function listeningTestById(id: string): ListeningTest | null {
  return LISTENING_TESTS.find((test) => test.id === id) ?? null
}
