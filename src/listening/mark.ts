/**
 * Marking a Listening paper. Implements plan 011 "Reuse markReading".
 *
 * There is no marking logic in this file, and that is the whole point. Plan 011
 * requires the marker to be **shared with Reading, not duplicated**, and
 * `src/marking/markAnswerKey.ts` was written to structural inputs and an
 * injectable band function precisely so this file could be an adapter: it hands
 * over the questions, hands over `listeningRawToBand`, and reshapes the result.
 *
 * Two small pieces of impedance matching happen here, both documented where
 * they occur:
 *
 *  - the shared marker's `MarkableTest` requires a `module`, which Listening
 *    does not have. A placeholder goes in and is stripped back out, so the
 *    distinction never reaches a caller who might branch on it;
 *  - `byFormat` is computed here rather than in the shared marker, because
 *    `ListeningFormat` is a Listening concept and the marker must stay ignorant
 *    of both sections' vocabularies.
 */
import { markAnswerKey, type SubmittedAnswers } from '../marking/markAnswerKey'
import type { ReadingModule } from '../reading/types'
import { listeningRawToBand } from './bandTable'
import type {
  ListeningFormat,
  ListeningFormatAccuracy,
  ListeningQuestion,
  ListeningResult,
  ListeningTest,
} from './types'

/**
 * The module handed to the shared marker.
 *
 * Listening has none — both exams sit the same paper. The shared marker needs
 * the field to satisfy `MarkableTest`, and `listeningRawToBand` ignores the
 * argument entirely, so this value cannot affect a band. It is stripped from
 * the result before anything sees it.
 */
const MARKING_MODULE_PLACEHOLDER: ReadingModule = 'academic'

/** Accuracy per presentation format, in first-appearance order. */
function accuracyByFormat(
  questions: readonly ListeningQuestion[],
  correctByQuestionId: ReadonlyMap<string, boolean>,
): ListeningFormatAccuracy[] {
  const order: ListeningFormat[] = []
  const tally = new Map<ListeningFormat, { total: number; correct: number }>()

  for (const question of questions) {
    let entry = tally.get(question.format)
    if (entry === undefined) {
      entry = { total: 0, correct: 0 }
      tally.set(question.format, entry)
      order.push(question.format)
    }
    entry.total += 1
    if (correctByQuestionId.get(question.id) === true) entry.correct += 1
  }

  return order.map((format) => {
    const entry = tally.get(format)!
    return {
      format,
      total: entry.total,
      correct: entry.correct,
      // Guarded rather than assumed: a format only reaches this map with
      // total >= 1, but a zero here would be NaN in the report.
      accuracy: entry.total === 0 ? 0 : entry.correct / entry.total,
    }
  })
}

/**
 * Mark a submission against a Listening test's answer key.
 *
 * Every leniency and every refusal is the shared marker's — case folding,
 * whitespace and punctuation normalisation, the optional leading article on
 * completion answers, a blank never counting, and an over-length answer being
 * wrong however right its content. Listening supplies only the conversion
 * table.
 *
 * @param test The test, with its questions and accepted answers.
 * @param answers What the learner submitted, keyed by question id.
 * @returns Per-question results, the raw score, the band, per-type accuracy and
 *   per-format accuracy. Never throws.
 *
 * @example
 * markListening(LISTENING_TEST_01, { 'ls1-q01': 'Lindqvist' }).raw // 1
 */
export function markListening(test: ListeningTest, answers: SubmittedAnswers): ListeningResult {
  const marked = markAnswerKey(
    {
      id: test.id,
      module: MARKING_MODULE_PLACEHOLDER,
      questions: test.questions,
    },
    answers,
    listeningRawToBand,
  )

  // Drop the placeholder module. Listening has no Academic/General split and a
  // result that carried one would invite a caller to branch on nothing.
  const { module: _placeholder, ...result } = marked

  const correctByQuestionId = new Map(marked.questions.map((q) => [q.questionId, q.correct]))

  return { ...result, byFormat: accuracyByFormat(test.questions, correctByQuestionId) }
}
