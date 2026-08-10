/**
 * Answer-key marking. Implements plan 010 "Marking".
 *
 * This lives in `src/marking/` rather than `src/reading/` on purpose: Listening
 * (plan 011) is the same problem — a fixed key, a raw score, a conversion table
 * — and will mark against this function with its own table. Nothing here knows
 * what a passage is; it takes a list of questions with accepted answers and a
 * band function.
 *
 * **What the marker does NOT do is as important as what it does.** It never
 * guesses at equivalence. British and American spellings, plurals and genuine
 * synonyms are accepted because the answer key LISTS them, not because this
 * file transforms them — an automatic -ise/-ize rewrite would be a rule the
 * item-writer cannot see, and the first time it accepted something the real
 * exam rejects, the app's band would stop meaning what it claims to mean.
 *
 * The leniencies it does apply are the ones a human marker applies without
 * thinking, and each is visible in the result:
 *
 *  - case is ignored;
 *  - leading/trailing space and internal whitespace runs are normalised;
 *  - edge punctuation and typographic quotes are normalised away;
 *  - a leading article is optional on COMPLETION answers only — it may be
 *    omitted or added, never swapped for a different one.
 *
 * And two things are unconditional, because they are how the real exam marks:
 *
 *  - **a blank is never correct**, whatever the key says;
 *  - **over the word limit is wrong**, even when the content is right.
 */
import { rawToBand } from '../reading/bandTable'
import type {
  ReadingModule,
  ReadingQuestionType,
  ReadingResult,
  ReadingQuestionResult,
  ReadingTypeAccuracy,
} from '../reading/types'

/* ---------------------------------- inputs ---------------------------------- */

/**
 * The minimum a question must expose to be marked. `ReadingTest`'s questions
 * satisfy this structurally, and a future `ListeningQuestion` will too.
 */
export interface MarkableQuestion {
  id: string
  /** 1-based number as printed. */
  number: number
  type: ReadingQuestionType
  /** Accepted answers, canonical key first. */
  answers: string[]
  /** Printed word limit, when the question has one. */
  maxWords?: number
}

/** The minimum a test must expose to be marked. */
export interface MarkableTest {
  id: string
  module: ReadingModule
  questions: readonly MarkableQuestion[]
}

/** Submitted answers keyed by question id. A missing key means "left blank". */
export type SubmittedAnswers = Record<string, string | undefined>

/** Raw score → band. Defaults to Reading's table; Listening will pass its own. */
export type BandFn = (raw: number, module: ReadingModule) => number

/* ------------------------------- normalisation ------------------------------ */

/** Characters stripped from the edges of a token. Inner ones are kept: "don't". */
const EDGE_PUNCTUATION = /^[.,;:!?"'`´()[\]{}]+|[.,;:!?"'`´()[\]{}]+$/g

/** Typographic characters a keyboard or a paste can introduce. */
const TYPOGRAPHIC: Array<[RegExp, string]> = [
  [/[‘’‛]/g, "'"],
  [/[“”]/g, '"'],
  [/[‐‑‒–—]/g, '-'],
  [/ /g, ' '],
]

/**
 * Reduce an answer to the form the marker compares.
 *
 * Applied identically to the learner's answer AND to every entry in the key,
 * which is the property that matters: the key is authored in natural casing
 * ("NOT GIVEN", "The Bronze Age") and still matches what a learner types.
 *
 * @example
 * normaliseAnswer('  The   GREENHOUSE effect. ') // 'the greenhouse effect'
 */
export function normaliseAnswer(raw: string | undefined | null): string {
  if (typeof raw !== 'string') return ''

  let text = raw
  for (const [pattern, replacement] of TYPOGRAPHIC) text = text.replace(pattern, replacement)

  return text
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(EDGE_PUNCTUATION, ''))
    .filter((token) => token.length > 0)
    .join(' ')
}

/**
 * Words in a normalised answer, counted the way IELTS counts them: whitespace
 * separates words, so a hyphenated compound ("well-being") and a number
 * ("1,500") are each ONE word.
 */
export function countWords(normalised: string): number {
  if (normalised === '') return 0
  return normalised.split(' ').length
}

/** Drop one leading article. Completion answers only — see `isAccepted`. */
function stripLeadingArticle(normalised: string): string {
  return normalised.replace(/^(?:a|an|the) /, '')
}

/**
 * Does `given` match any accepted answer?
 *
 * For COMPLETION questions a leading article is OPTIONAL. The gap's own
 * sentence usually supplies "the", so an examiner does not fail "greenhouse
 * effect" against a key of "the greenhouse effect", nor "the greenhouse effect"
 * against a key of "greenhouse effect".
 *
 * **Optional is not interchangeable, and that distinction is the whole of this
 * function.** Stripping the article from BOTH sides before comparing would make
 * the article a free variable: a key of "the sun" would accept "a sun", which is
 * a different answer and one the real exam marks wrong. So the article may be
 * dropped from the KEY (the learner omitted it) or dropped from the ANSWER (the
 * learner supplied one the key does not print) — never from both at once.
 *
 * The leniency is applied AFTER the word limit is checked, so it can never
 * rescue an answer that was too long — three words are three words even if one
 * of them is "the".
 */
function isAccepted(given: string, question: MarkableQuestion): boolean {
  if (given === '') return false

  const accepted = question.answers.map(normaliseAnswer).filter((a) => a !== '')
  if (accepted.includes(given)) return true

  if (question.type === 'completion') {
    const givenWithoutArticle = stripLeadingArticle(given)
    return accepted.some((a) => stripLeadingArticle(a) === given || a === givenWithoutArticle)
  }

  return false
}

/* ---------------------------------- marking --------------------------------- */

/** Accuracy per question type, in the order the types first appear in the test. */
function accuracyByType(results: ReadingQuestionResult[]): ReadingTypeAccuracy[] {
  const order: ReadingQuestionType[] = []
  const tally = new Map<ReadingQuestionType, { total: number; correct: number }>()

  for (const result of results) {
    let entry = tally.get(result.type)
    if (entry === undefined) {
      entry = { total: 0, correct: 0 }
      tally.set(result.type, entry)
      order.push(result.type)
    }
    entry.total += 1
    if (result.correct) entry.correct += 1
  }

  return order.map((type) => {
    const entry = tally.get(type)!
    return {
      type,
      total: entry.total,
      correct: entry.correct,
      // Guarded rather than assumed: a type can only reach this map with
      // total >= 1, but a zero here would be NaN in the report.
      accuracy: entry.total === 0 ? 0 : entry.correct / entry.total,
    }
  })
}

/**
 * Mark a submission against a test's answer key.
 *
 * No partial credit and no penalty for a wrong answer: every question is worth
 * one mark or nothing, so a guess costs a learner nothing and the raw score is
 * simply the number correct.
 *
 * @param test The test, with its questions and accepted answers.
 * @param answers What the learner submitted, keyed by question id. Keys with no
 *   matching question are ignored; questions with no key are marked blank.
 * @param toBand Raw → band conversion. Defaults to the Reading tables.
 * @returns Per-question results, the raw score, the band, and per-type accuracy.
 *   Never throws; a test with no questions scores 0 and the floor band.
 *
 * @example
 * markAnswerKey(ACADEMIC_TEST_01, { 'ac1-q1': 'TRUE', 'ac1-q2': ' the  Sun ' })
 */
export function markAnswerKey(
  test: MarkableTest,
  answers: SubmittedAnswers,
  toBand: BandFn = rawToBand,
): ReadingResult {
  const questions: ReadingQuestionResult[] = test.questions.map((question) => {
    const given = answers[question.id] ?? ''
    const normalised = normaliseAnswer(given)
    const blank = normalised === ''

    const limit = question.maxWords
    const overWordLimit =
      typeof limit === 'number' && limit > 0 && !blank && countWords(normalised) > limit

    return {
      questionId: question.id,
      number: question.number,
      type: question.type,
      given,
      normalised,
      // Order matters: a blank is never correct, and an over-length answer is
      // wrong before its content is ever compared.
      correct: !blank && !overWordLimit && isAccepted(normalised, question),
      blank,
      overWordLimit,
      expected: question.answers[0] ?? '',
      accepted: [...question.answers],
    }
  })

  const raw = questions.filter((q) => q.correct).length

  return {
    testId: test.id,
    module: test.module,
    raw,
    total: questions.length,
    band: toBand(raw, test.module),
    questions,
    byType: accuracyByType(questions),
  }
}
