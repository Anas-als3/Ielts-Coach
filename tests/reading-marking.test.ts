/**
 * Answer-key marking and authored-content integrity (plan 010, steps 3–5).
 *
 * Two jobs in one file, guarding the same contract from both ends:
 *
 * 1. `markAnswerKey` must apply exactly the leniencies a real examiner applies
 *    and no others. The dangerous direction is generosity: a marker that
 *    quietly accepts an over-length answer or an unlisted synonym reports a
 *    band the learner will not reproduce on exam day, which is worse than no
 *    band at all.
 * 2. The authored tests must be answerable. A key that is blank, a
 *    multiple-choice key that is not one of its own options, or a completion
 *    key longer than its own word limit is a question no learner can get right
 *    however well they read — the content equivalent of a false accusation.
 */
import { describe, expect, it } from 'vitest'
import {
  countWords,
  markAnswerKey,
  normaliseAnswer,
  type MarkableQuestion,
  type MarkableTest,
  type SubmittedAnswers,
} from '../src/marking/markAnswerKey'
import { ACADEMIC_TEST_01, GENERAL_TEST_01, READING_TESTS, readingTestById, readingTestsForModule } from '../src/reading/tests'
import type { ReadingQuestionType, ReadingTest } from '../src/reading/types'

/* --------------------------------- helpers ---------------------------------- */

/** A one-question test, marked. Everything the normalisation cases need. */
function markOne(question: Omit<MarkableQuestion, 'id' | 'number'>, given: string | undefined) {
  const test: MarkableTest = {
    id: 'fixture',
    module: 'academic',
    questions: [{ id: 'q1', number: 1, ...question }],
  }
  return markAnswerKey(test, { q1: given }).questions[0]
}

/** A completion question with a word limit. */
const completion = (answers: string[], maxWords = 2): Omit<MarkableQuestion, 'id' | 'number'> => ({
  type: 'completion',
  answers,
  maxWords,
})

/** The canonical key for the first `n` questions; the rest left blank. */
function answerFirst(test: ReadingTest, n: number): SubmittedAnswers {
  const answers: SubmittedAnswers = {}
  test.questions.slice(0, n).forEach((q) => {
    answers[q.id] = q.answers[0]
  })
  return answers
}

/** The whole key, submitted in deliberately untidy form. */
function answerAllMessily(test: ReadingTest): SubmittedAnswers {
  const answers: SubmittedAnswers = {}
  test.questions.forEach((q, i) => {
    const key = q.answers[0]
    answers[q.id] = i % 2 === 0 ? `  ${key.toUpperCase()}  ` : `\t${key.toLowerCase()}\n`
  })
  return answers
}

/**
 * Every registered paper, not a hand-written list of the two that exist today.
 *
 * `src/reading/tests/index.ts` says a paper is added by putting one entry in
 * `READING_TESTS` and that "nothing else in the Reading code counts or names
 * them" — which was true of src/ and false here. A hand-written array means a
 * third paper ships with none of the fifteen integrity checks below: no
 * guarantee it has forty questions, no guarantee its multiple-choice keys are
 * among their own options, no guarantee a completion key fits its own word
 * limit. Listening already spreads its registry; this matches it.
 */
const AUTHORED: ReadingTest[] = [...READING_TESTS]

const V1_TYPES: ReadingQuestionType[] = [
  'true-false-notgiven',
  'yes-no-notgiven',
  'multiple-choice',
  'completion',
  'matching-headings',
  'matching-information',
]

/* ------------------------------ normalisation ------------------------------- */

describe('normaliseAnswer', () => {
  it('lowercases, trims and collapses whitespace', () => {
    expect(normaliseAnswer('  The   GREENHOUSE\teffect ')).toBe('the greenhouse effect')
  })

  it('strips punctuation from the edges but not the middle', () => {
    expect(normaliseAnswer('"tidal friction."')).toBe('tidal friction')
    expect(normaliseAnswer("don't")).toBe("don't")
    expect(normaliseAnswer('18:15')).toBe('18:15')
    expect(normaliseAnswer('3.5')).toBe('3.5')
  })

  it('folds typographic quotes and dashes onto their plain equivalents', () => {
    expect(normaliseAnswer('don’t')).toBe("don't")
    expect(normaliseAnswer('thin–walled')).toBe('thin-walled')
    expect(normaliseAnswer('“not given”')).toBe('not given')
  })

  it('drops a trailing possessive apostrophe, from the key as well as the answer', () => {
    // The key is normalised by the same function, so both sides land on the
    // same string and the learner is never failed for a curly apostrophe.
    expect(normaliseAnswer('miners’ tools')).toBe('miners tools')
    expect(normaliseAnswer("miners' tools")).toBe('miners tools')
  })

  it('treats a missing answer as blank', () => {
    expect(normaliseAnswer(undefined)).toBe('')
    expect(normaliseAnswer(null)).toBe('')
    expect(normaliseAnswer('   ')).toBe('')
  })
})

describe('countWords', () => {
  it('counts whitespace-separated words', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('library')).toBe(1)
    expect(countWords('chemical plants')).toBe(2)
  })

  it('counts a hyphenated compound and a number as one word, as IELTS does', () => {
    expect(countWords(normaliseAnswer('thin-walled'))).toBe(1)
    expect(countWords(normaliseAnswer('1,500'))).toBe(1)
  })
})

/* --------------------------------- marking ---------------------------------- */

describe('markAnswerKey', () => {
  it('ignores case', () => {
    expect(markOne({ type: 'true-false-notgiven', answers: ['NOT GIVEN'] }, 'not given').correct).toBe(true)
    expect(markOne({ type: 'true-false-notgiven', answers: ['NOT GIVEN'] }, 'Not Given').correct).toBe(true)
  })

  it('ignores surrounding and repeated whitespace', () => {
    expect(markOne(completion(['chemical plants']), '  chemical   plants  ').correct).toBe(true)
  })

  it('accepts any alternative the key lists', () => {
    expect(markOne(completion(['wood', 'timber']), 'timber').correct).toBe(true)
    expect(markOne(completion(['wood', 'timber']), 'WOOD').correct).toBe(true)
  })

  it('accepts a British or American spelling only when the key lists it', () => {
    const key = completion(['colour', 'color'])
    expect(markOne(key, 'color').correct).toBe(true)
    expect(markOne(key, 'colour').correct).toBe(true)
    // No automatic transformation: an unlisted variant is not invented for the learner.
    expect(markOne(completion(['analyse']), 'analyze').correct).toBe(false)
  })

  it('marks an answer over the word limit wrong even when the content is right', () => {
    const result = markOne(completion(['solar panels'], 2), 'solar panels are cheaper now')

    expect(result.overWordLimit).toBe(true)
    expect(result.correct).toBe(false)
  })

  it('does not apply a word limit to questions that have none', () => {
    const result = markOne({ type: 'multiple-choice', answers: ['a very long option indeed'] }, 'a very long option indeed')

    expect(result.overWordLimit).toBe(false)
    expect(result.correct).toBe(true)
  })

  it('allows a leading article on a completion answer, within the limit', () => {
    // The gap's own sentence usually supplies the article, so an examiner does
    // not fail "greenhouse effect" against a key of "the greenhouse effect".
    expect(markOne(completion(['the greenhouse effect'], 3), 'greenhouse effect').correct).toBe(true)
    expect(markOne(completion(['greenhouse effect'], 3), 'the greenhouse effect').correct).toBe(true)
  })

  it('does not let the article leniency rescue an over-length answer', () => {
    // Three words are three words even when one of them is "the".
    const result = markOne(completion(['solar panels'], 2), 'the solar panels')
    expect(result.correct).toBe(false)
    expect(result.overWordLimit).toBe(true)
  })

  it('does not strip articles for question types that are not completion', () => {
    expect(markOne({ type: 'multiple-choice', answers: ['the harbour office'] }, 'harbour office').correct).toBe(false)
  })

  it('lets a completion article be omitted or added, but never swapped', () => {
    // "Optional" sanctions leaving the key's article out, and putting one in
    // where the key prints none. It does not sanction substituting one for
    // another: "a sun" is not "the sun". Stripping the article from BOTH sides
    // before comparing makes it a free variable and accepts the substitution,
    // which is a wrong answer marked right.
    expect(markOne(completion(['the sun']), 'the sun').correct).toBe(true)
    expect(markOne(completion(['the sun']), 'sun').correct).toBe(true)
    expect(markOne(completion(['sun']), 'the sun').correct).toBe(true)
    expect(markOne(completion(['sun']), 'a sun').correct).toBe(true)

    expect(markOne(completion(['the sun']), 'a sun').correct).toBe(false)
    expect(markOne(completion(['a sun']), 'the sun').correct).toBe(false)
    expect(markOne(completion(['an orbit']), 'the orbit').correct).toBe(false)

    // A key that lists both forms still accepts all three determiners, because
    // the bare form is there to have an article added to it.
    expect(markOne(completion(['the sun', 'sun']), 'a sun').correct).toBe(true)
  })

  it('never marks a blank correct', () => {
    for (const given of ['', '   ', undefined]) {
      const result = markOne(completion(['library']), given)
      expect(result.blank).toBe(true)
      expect(result.correct).toBe(false)
    }
  })

  it('never marks a blank correct even against a key that contains an empty string', () => {
    const result = markOne(completion(['', 'library']), '')

    expect(result.blank).toBe(true)
    expect(result.correct).toBe(false)
  })

  it('marks a wrong answer wrong without any penalty', () => {
    const test: MarkableTest = {
      id: 'fixture',
      module: 'academic',
      questions: [
        { id: 'a', number: 1, type: 'true-false-notgiven', answers: ['TRUE'] },
        { id: 'b', number: 2, type: 'true-false-notgiven', answers: ['FALSE'] },
        { id: 'c', number: 3, type: 'true-false-notgiven', answers: ['NOT GIVEN'] },
      ],
    }

    const guessed = markAnswerKey(test, { a: 'TRUE', b: 'TRUE', c: 'TRUE' })
    const blank = markAnswerKey(test, { a: 'TRUE' })

    // A wrong guess costs nothing: both submissions score the one correct answer.
    expect(guessed.raw).toBe(1)
    expect(blank.raw).toBe(1)
  })

  it('reports the given text untouched alongside the normalised form', () => {
    const result = markOne(completion(['library']), '  Library. ')

    expect(result.given).toBe('  Library. ')
    expect(result.normalised).toBe('library')
    expect(result.expected).toBe('library')
    expect(result.accepted).toEqual(['library'])
  })

  it('ignores submitted answers for questions that do not exist', () => {
    const result = markOne(completion(['library']), 'library')
    expect(result.correct).toBe(true)

    const test: MarkableTest = { id: 'fixture', module: 'academic', questions: [] }
    const empty = markAnswerKey(test, { ghost: 'library' })

    expect(empty.raw).toBe(0)
    expect(empty.total).toBe(0)
    expect(empty.questions).toEqual([])
    expect(empty.byType).toEqual([])
  })

  it('takes the band from the module’s own table', () => {
    const questions: MarkableQuestion[] = Array.from({ length: 40 }, (_, i) => ({
      id: `q${i}`,
      number: i + 1,
      type: 'true-false-notgiven' as const,
      answers: ['TRUE'],
    }))
    const answers: SubmittedAnswers = {}
    for (let i = 0; i < 30; i++) answers[`q${i}`] = 'TRUE'

    expect(markAnswerKey({ id: 'a', module: 'academic', questions }, answers).band).toBe(7.0)
    expect(markAnswerKey({ id: 'g', module: 'general', questions }, answers).band).toBe(6.0)
  })

  it('accepts an injected band function, which is how Listening will share this', () => {
    const test: MarkableTest = {
      id: 'fixture',
      module: 'academic',
      questions: [{ id: 'a', number: 1, type: 'completion', answers: ['x'], maxWords: 1 }],
    }

    const result = markAnswerKey(test, { a: 'x' }, () => 5.5)
    expect(result.band).toBe(5.5)
  })
})

/* ---------------------------- per-type breakdown ----------------------------- */

describe('per-question-type accuracy', () => {
  const test: MarkableTest = {
    id: 'fixture',
    module: 'academic',
    questions: [
      { id: 'a', number: 1, type: 'true-false-notgiven', answers: ['TRUE'] },
      { id: 'b', number: 2, type: 'true-false-notgiven', answers: ['FALSE'] },
      { id: 'c', number: 3, type: 'completion', answers: ['library'], maxWords: 1 },
      { id: 'd', number: 4, type: 'matching-headings', answers: ['iv'] },
      { id: 'e', number: 5, type: 'true-false-notgiven', answers: ['NOT GIVEN'] },
    ],
  }

  it('reports one entry per type present, in first-appearance order', () => {
    const result = markAnswerKey(test, { a: 'TRUE', b: 'TRUE', c: 'library', d: 'iv', e: '' })

    expect(result.byType.map((t) => t.type)).toEqual([
      'true-false-notgiven',
      'completion',
      'matching-headings',
    ])
  })

  it('counts correct against total per type', () => {
    const result = markAnswerKey(test, { a: 'TRUE', b: 'TRUE', c: 'library', d: 'iv', e: '' })
    const byType = Object.fromEntries(result.byType.map((t) => [t.type, t]))

    expect(byType['true-false-notgiven']).toEqual({
      type: 'true-false-notgiven',
      total: 3,
      correct: 1,
      accuracy: 1 / 3,
    })
    expect(byType['completion'].accuracy).toBe(1)
    expect(byType['matching-headings'].accuracy).toBe(1)
  })

  it('reports zero accuracy rather than NaN when a type is entirely missed', () => {
    const result = markAnswerKey(test, {})

    for (const entry of result.byType) {
      expect(entry.correct).toBe(0)
      expect(entry.accuracy).toBe(0)
      expect(Number.isNaN(entry.accuracy)).toBe(false)
    }
  })

  it('never omits a type the test contains', () => {
    const result = markAnswerKey(test, {})
    const totalCounted = result.byType.reduce((sum, t) => sum + t.total, 0)

    expect(totalCounted).toBe(test.questions.length)
  })
})

/* -------------------------- authored content integrity ----------------------- */

describe.each(AUTHORED)('$title integrity', (test) => {
  it('has exactly 40 questions, numbered 1 to 40 with unique ids', () => {
    expect(test.questions).toHaveLength(40)
    expect(test.questions.map((q) => q.number)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1))
    expect(new Set(test.questions.map((q) => q.id)).size).toBe(40)
  })

  it('uses all six v1 question types', () => {
    const used = new Set(test.questions.map((q) => q.type))
    for (const type of V1_TYPES) expect(used.has(type), `missing ${type}`).toBe(true)
  })

  it('gives every question a non-empty answer key', () => {
    for (const q of test.questions) {
      expect(q.answers.length, `${q.id} has no key`).toBeGreaterThan(0)
      for (const answer of q.answers) {
        expect(normaliseAnswer(answer), `${q.id} has a blank accepted answer`).not.toBe('')
      }
      expect(new Set(q.answers.map(normaliseAnswer)).size, `${q.id} duplicate answers`).toBe(q.answers.length)
    }
  })

  it('points every question at a passage that exists', () => {
    for (const q of test.questions) {
      expect(q.passageIndex, `${q.id} passageIndex`).toBeGreaterThanOrEqual(0)
      expect(q.passageIndex, `${q.id} passageIndex`).toBeLessThan(test.passages.length)
    }
  })

  it('makes every multiple-choice key one of its own options', () => {
    const mcqs = test.questions.filter((q) => q.type === 'multiple-choice')
    expect(mcqs.length).toBeGreaterThan(0)

    for (const q of mcqs) {
      if (q.type !== 'multiple-choice') continue
      expect(q.options.length, `${q.id} option count`).toBe(4)
      expect(new Set(q.options.map(normaliseAnswer)).size, `${q.id} duplicate options`).toBe(4)

      const options = q.options.map(normaliseAnswer)
      for (const answer of q.answers) {
        expect(options, `${q.id} key "${answer}" is not one of its options`).toContain(normaliseAnswer(answer))
      }
    }
  })

  it('keeps every accepted completion answer inside its own word limit', () => {
    const completions = test.questions.filter((q) => q.type === 'completion')
    expect(completions.length).toBeGreaterThan(0)

    for (const q of completions) {
      if (q.type !== 'completion') continue
      expect(q.maxWords, `${q.id} word limit`).toBeGreaterThanOrEqual(1)
      for (const answer of q.answers) {
        expect(
          countWords(normaliseAnswer(answer)),
          `${q.id} key "${answer}" breaks its own ${q.maxWords}-word limit`,
        ).toBeLessThanOrEqual(q.maxWords)
      }
    }
  })

  it('restricts true/false and yes/no keys to the three permitted responses', () => {
    for (const q of test.questions) {
      if (q.type === 'true-false-notgiven') {
        expect(['true', 'false', 'not given'], `${q.id}`).toContain(normaliseAnswer(q.answers[0]))
      }
      if (q.type === 'yes-no-notgiven') {
        expect(['yes', 'no', 'not given'], `${q.id}`).toContain(normaliseAnswer(q.answers[0]))
      }
    }
  })

  it('uses all three responses across each true/false and yes/no set', () => {
    const tfng = new Set(
      test.questions.filter((q) => q.type === 'true-false-notgiven').map((q) => normaliseAnswer(q.answers[0])),
    )
    const ynng = new Set(
      test.questions.filter((q) => q.type === 'yes-no-notgiven').map((q) => normaliseAnswer(q.answers[0])),
    )

    expect([...tfng].sort()).toEqual(['false', 'not given', 'true'])
    expect([...ynng].sort()).toEqual(['no', 'not given', 'yes'])
  })

  it('answers every matching-headings question with a heading from its own bank', () => {
    for (const q of test.questions) {
      if (q.type !== 'matching-headings') continue
      const ids = q.headings.map((h) => h.id)

      expect(new Set(ids).size, `${q.id} duplicate heading ids`).toBe(ids.length)
      expect(ids, `${q.id} key "${q.answers[0]}" is not in the heading bank`).toContain(q.answers[0])
    }
  })

  it('offers more headings than paragraphs, so the set cannot be solved by elimination', () => {
    const headingQuestions = test.questions.filter((q) => q.type === 'matching-headings')
    expect(headingQuestions.length).toBeGreaterThan(0)

    for (const q of headingQuestions) {
      if (q.type !== 'matching-headings') continue
      expect(q.headings.length, `${q.id} heading bank`).toBeGreaterThan(headingQuestions.length)
    }
  })

  it('gives each matching-headings set a distinct heading per paragraph', () => {
    const used = test.questions.filter((q) => q.type === 'matching-headings').map((q) => q.answers[0])
    expect(new Set(used).size).toBe(used.length)
  })

  it('answers every matching-information question with a real paragraph label', () => {
    for (const q of test.questions) {
      if (q.type !== 'matching-information') continue

      const passage = test.passages[q.passageIndex]
      const realLabels = passage.texts.flatMap((t) => t.paragraphs.map((p) => p.label))

      expect(q.paragraphLabels, `${q.id} key`).toContain(q.answers[0])
      expect(realLabels, `${q.id} label "${q.answers[0]}" is not a paragraph in passage ${q.passageIndex + 1}`).toContain(
        q.answers[0],
      )
    }
  })

  it('labels paragraphs uniquely within a passage', () => {
    for (const passage of test.passages) {
      const labels = passage.texts.flatMap((t) => t.paragraphs.map((p) => p.label)).filter((l) => l !== undefined)
      expect(new Set(labels).size, `${passage.id} duplicate paragraph labels`).toBe(labels.length)
    }
  })

  it('records a source and a licence for every passage', () => {
    expect(test.passages).toHaveLength(3)

    for (const passage of test.passages) {
      expect(passage.source.description.trim().length, `${passage.id} source`).toBeGreaterThan(0)
      expect(passage.source.licence.trim().length, `${passage.id} licence`).toBeGreaterThan(0)
      expect(passage.texts.length, `${passage.id} texts`).toBeGreaterThan(0)
      for (const text of passage.texts) {
        expect(text.title.trim().length, `${passage.id} text title`).toBeGreaterThan(0)
        expect(text.paragraphs.length, `${passage.id} paragraphs`).toBeGreaterThan(0)
      }
    }
  })

  it('reproduces no text from an IELTS publisher', () => {
    const everything = JSON.stringify(test).toLowerCase()
    for (const forbidden of ['ieltsonlinetests', 'cambridge ielts', 'ucles']) {
      expect(everything, `mentions ${forbidden}`).not.toContain(forbidden)
    }
  })
})

/* --------------------------- answer-key completeness ------------------------- */

/**
 * The integrity block above walks `q.answers`, so it passes however much of a
 * key you delete: it proves a key is self-consistent, never that it is
 * complete. These write the learner's forms out by hand instead, and fail the
 * moment the paper loses one.
 *
 * They are the counterpart of the marker's "never guess at equivalence" rule.
 * The marker will not invent "6.15 pm" from "6.15pm", so the KEY has to say it.
 */
describe('authored answer keys are complete in their own renderings', () => {
  const FERRY_TIME = 'gt1-q14'

  it('accepts every ordinary way of writing the ferry’s departure time', () => {
    const forms = [
      '18:15',
      '18.15',
      '6.15pm',
      '6:15pm',
      '6.15 pm',
      '6:15 pm',
      '6.15p.m.',
      '6:15p.m.',
      '6.15 p.m.',
      '6:15 p.m.',
      // Case and stray space are the marker's job, not the key's.
      '6.15 PM',
      '  6:15 p.m. ',
    ]

    for (const given of forms) {
      const result = markAnswerKey(GENERAL_TEST_01, { [FERRY_TIME]: given })
      expect(result.raw, `Q14 rejects "${given}"`).toBe(1)
    }
  })

  it('still marks a different time wrong', () => {
    for (const given of ['18:50', '6.15am', '8.15pm', '6.15']) {
      expect(markAnswerKey(GENERAL_TEST_01, { [FERRY_TIME]: given }).raw, `Q14 accepts "${given}"`).toBe(0)
    }
  })

  it('gives both the numeral and the word form of every number a learner writes', () => {
    const numeric: Array<[string, string[]]> = [
      ['gt1-q11', ['8', 'eight']],
      ['gt1-q16', ['six months', '6 months']],
      ['gt1-q17', ['two', '2']],
      ['gt1-q19', ['three months', '3 months']],
    ]

    for (const [id, forms] of numeric) {
      for (const given of forms) {
        expect(markAnswerKey(GENERAL_TEST_01, { [id]: given }).raw, `${id} rejects "${given}"`).toBe(1)
      }
    }
  })
})

/* ------------------------------ structure by module -------------------------- */

describe('authored test structure', () => {
  it('gives the Academic test three single-text passages of 700–900 words', () => {
    expect(ACADEMIC_TEST_01.module).toBe('academic')

    for (const passage of ACADEMIC_TEST_01.passages) {
      expect(passage.texts, `${passage.id} should hold one continuous text`).toHaveLength(1)

      const words = passage.texts[0].paragraphs.reduce((sum, p) => sum + countWords(normaliseAnswer(p.text)), 0)
      expect(words, `${passage.id} is ${words} words`).toBeGreaterThanOrEqual(700)
      expect(words, `${passage.id} is ${words} words`).toBeLessThanOrEqual(900)
    }
  })

  it('gives General Training the short-text Section 1 and two-text Section 2 the real paper has', () => {
    expect(GENERAL_TEST_01.module).toBe('general')

    const [section1, section2, section3] = GENERAL_TEST_01.passages
    expect(section1.texts.length).toBeGreaterThanOrEqual(2)
    expect(section2.texts).toHaveLength(2)
    expect(section3.texts).toHaveLength(1)
  })

  it('offers each module only its own test', () => {
    expect(readingTestsForModule('academic')).toEqual([ACADEMIC_TEST_01])
    expect(readingTestsForModule('general')).toEqual([GENERAL_TEST_01])
    expect(READING_TESTS).toHaveLength(2)
  })

  it('offers every registered paper to exactly one module', () => {
    // A paper whose `module` is neither value is registered, marked, and never
    // shown to anyone — the pickers only ever list `readingTestsForModule`.
    const offered = [...readingTestsForModule('academic'), ...readingTestsForModule('general')]
    expect(offered.map((t) => t.id).sort()).toEqual(READING_TESTS.map((t) => t.id).sort())
  })

  it('looks a test up by id and returns null for an unknown one', () => {
    expect(readingTestById('reading-academic-01')).toBe(ACADEMIC_TEST_01)
    expect(readingTestById('reading-listening-99')).toBeNull()
  })
})

/* --------------------------------- end to end -------------------------------- */

describe('end to end', () => {
  it('scores the Academic test at band 7.0 for 30 correct', () => {
    const result = markAnswerKey(ACADEMIC_TEST_01, answerFirst(ACADEMIC_TEST_01, 30))

    expect(result.raw).toBe(30)
    expect(result.total).toBe(40)
    expect(result.band).toBe(7.0)
    expect(result.module).toBe('academic')
    expect(result.testId).toBe('reading-academic-01')
    expect(result.questions.filter((q) => q.blank)).toHaveLength(10)
  })

  it('scores the General Training test at band 7.0 only at 34 correct', () => {
    const at34 = markAnswerKey(GENERAL_TEST_01, answerFirst(GENERAL_TEST_01, 34))
    const at33 = markAnswerKey(GENERAL_TEST_01, answerFirst(GENERAL_TEST_01, 33))

    expect(at34.raw).toBe(34)
    expect(at34.band).toBe(7.0)
    // The same paper, one mark fewer: General Training drops half a band here.
    expect(at33.raw).toBe(33)
    expect(at33.band).toBe(6.5)
  })

  it('scores the same 30 correct differently in each module', () => {
    const academic = markAnswerKey(ACADEMIC_TEST_01, answerFirst(ACADEMIC_TEST_01, 30))
    const general = markAnswerKey(GENERAL_TEST_01, answerFirst(GENERAL_TEST_01, 30))

    expect(academic.raw).toBe(general.raw)
    expect(academic.band).toBe(7.0)
    expect(general.band).toBe(6.0)
  })

  it.each(AUTHORED)('marks a messily typed complete key on $title as 40/40, band 9.0', (test) => {
    const result = markAnswerKey(test, answerAllMessily(test))

    const wrong = result.questions.filter((q) => !q.correct).map((q) => `${q.number}: "${q.given}"`)
    expect(wrong).toEqual([])
    expect(result.raw).toBe(40)
    expect(result.band).toBe(9.0)
    expect(result.byType.reduce((sum, t) => sum + t.total, 0)).toBe(40)
    for (const entry of result.byType) expect(entry.accuracy).toBe(1)
  })

  it.each(AUTHORED)('scores an empty submission on $title at 0/40 and the floor band', (test) => {
    const result = markAnswerKey(test, {})

    expect(result.raw).toBe(0)
    expect(result.band).toBe(4.0)
    expect(result.questions.every((q) => q.blank && !q.correct)).toBe(true)
  })

  it('breaks the Academic score down by question type', () => {
    // Answer only the matching-headings set: the report must say so plainly.
    const answers: SubmittedAnswers = {}
    for (const q of ACADEMIC_TEST_01.questions) {
      if (q.type === 'matching-headings') answers[q.id] = q.answers[0]
    }

    const result = markAnswerKey(ACADEMIC_TEST_01, answers)
    const byType = Object.fromEntries(result.byType.map((t) => [t.type, t]))

    expect(result.raw).toBe(6)
    expect(byType['matching-headings']).toEqual({
      type: 'matching-headings',
      total: 6,
      correct: 6,
      accuracy: 1,
    })
    for (const type of V1_TYPES) {
      if (type === 'matching-headings') continue
      expect(byType[type].correct, `${type} should be unanswered`).toBe(0)
    }
  })

  it('flags an over-length completion answer on a real question', () => {
    const question = ACADEMIC_TEST_01.questions.find((q) => q.type === 'completion')!
    const result = markAnswerKey(ACADEMIC_TEST_01, {
      [question.id]: 'a very large quantity of seasoned firewood indeed',
    })

    const marked = result.questions.find((q) => q.questionId === question.id)!
    expect(marked.overWordLimit).toBe(true)
    expect(marked.correct).toBe(false)
    expect(result.raw).toBe(0)
  })
})
