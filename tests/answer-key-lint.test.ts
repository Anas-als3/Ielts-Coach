/**
 * Answer-key completeness lint, run over every registered paper (plan 022-b).
 *
 * `keyLint` never re-implements what `markAnswerKey` already does — it asks
 * the real marker whether a generated rendering is already accepted. This file
 * has two jobs: prove the generator agrees with the by-hand blocks in
 * `tests/reading-marking.test.ts` and `tests/listening-marking.test.ts` on the
 * specific questions those blocks already pin, and then run it over every
 * completion question of every registered paper, so a new paper inherits the
 * check instead of needing a new hand-written block.
 */
import { describe, expect, it } from 'vitest'
import { GENERAL_TEST_01, READING_TESTS } from '../src/reading/tests'
import { LISTENING_TEST_01, LISTENING_TESTS } from '../src/listening/tests'
import { keyLint, type LintableQuestion } from '../src/marking/keyLint'

/* ------------------------------- fixtures ------------------------------- */

const GT1_Q11 = GENERAL_TEST_01.questions.find((q) => q.id === 'gt1-q11')!
const GT1_Q14 = GENERAL_TEST_01.questions.find((q) => q.id === 'gt1-q14')!
const GT1_Q16 = GENERAL_TEST_01.questions.find((q) => q.id === 'gt1-q16')!
const GT1_Q17 = GENERAL_TEST_01.questions.find((q) => q.id === 'gt1-q17')!
const GT1_Q19 = GENERAL_TEST_01.questions.find((q) => q.id === 'gt1-q19')!
const LS_Q03 = LISTENING_TEST_01.questions.find((q) => q.id === 'ls-q03')!
const LS_Q07 = LISTENING_TEST_01.questions.find((q) => q.id === 'ls-q07')!
const LS_Q08 = LISTENING_TEST_01.questions.find((q) => q.id === 'ls-q08')!
const LS_Q29 = LISTENING_TEST_01.questions.find((q) => q.id === 'ls-q29')!
const LS_Q30 = LISTENING_TEST_01.questions.find((q) => q.id === 'ls-q30')!
const LS_Q33 = LISTENING_TEST_01.questions.find((q) => q.id === 'ls-q33')!
const LS_Q38 = LISTENING_TEST_01.questions.find((q) => q.id === 'ls-q38')!

/* ----------------------------- the time class ---------------------------- */

describe('the time class', () => {
  it('finds nothing in the ferry key: it already lists all ten forms', () => {
    expect(keyLint(GT1_Q14)).toEqual([])
  })

  it('demands the other nine forms when only one is listed', () => {
    const findings = keyLint({ ...GT1_Q14, answers: ['18:15'] })
    expect(findings.every((f) => f.klass === 'time')).toBe(true)
    expect(findings.map((f) => f.missing).sort()).toEqual(
      [
        '18.15',
        '6.15pm',
        '6:15pm',
        '6.15 pm',
        '6:15 pm',
        '6.15p.m.',
        '6:15p.m.',
        '6.15 p.m.',
        '6:15 p.m.',
      ].sort(),
    )
  })

  it('may not guess an ambiguous clock reading', () => {
    // "6.15" alone does not say which half of the day it is, and inventing
    // "18:15" for it would put a wrong answer in the key.
    expect(keyLint({ ...GT1_Q14, answers: ['6.15'] })).toEqual([])
  })
})

/* ---------------------------- the number class ---------------------------- */

describe('the number class', () => {
  it('finds nothing in the four numeric pairs the by-hand block already pins', () => {
    expect(keyLint(GT1_Q11)).toEqual([])
    expect(keyLint(GT1_Q16)).toEqual([])
    expect(keyLint(GT1_Q17)).toEqual([])
    expect(keyLint(GT1_Q19)).toEqual([])
  })

  it('has teeth: a figure-only key is missing its word form', () => {
    const findings = keyLint({ ...GT1_Q11, answers: ['8'] })
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ klass: 'number', missing: 'eight' })
  })

  it('does not fire on a time', () => {
    // gt1-q14's key contains the digit runs 18, 15 and 6. A number generator
    // that tokenised across ':' or '.' would demand "eighteen"/"fifteen".
    expect(keyLint(GT1_Q14)).toEqual([])
  })

  it('takes the ordinal in a date gap, never the cardinal word', () => {
    expect(keyLint(LS_Q03)).toEqual([])

    const findings = keyLint({ ...LS_Q03, answers: ['14'] })
    const missing = findings.map((f) => f.missing)
    expect(missing).toContain('14th')
    expect(missing).toContain('fourteenth')
    expect(missing).not.toContain('fourteen')
  })

  it('does not offer an ordinal outside a date gap', () => {
    // gt1-q11's prompt names no month: "8" must generate "eight", never "8th".
    const findings = keyLint({ ...GT1_Q11, answers: ['8'] })
    expect(findings.map((f) => f.missing)).not.toContain('8th')
  })

  it('does not treat a number word inside a compound as a count token', () => {
    // 'one-page plan' is a single normalised token; 'one page plan' is three.
    // A naive substitution would emit '1-page plan' / '1 page plan'.
    expect(keyLint(LS_Q30)).toEqual([])
  })
})

/* ----------------------------- the unit class ------------------------------ */

describe('the unit class', () => {
  it('finds nothing in the preprinted-unit keys the by-hand block already pins', () => {
    expect(keyLint(LS_Q07)).toEqual([])
    expect(keyLint(LS_Q08)).toEqual([])
    expect(keyLint(LS_Q33)).toEqual([])
    expect(keyLint(LS_Q38)).toEqual([])
  })

  it('has teeth: a bare figure is missing the symbol-attached and spelled-unit forms', () => {
    const findings = keyLint({ ...LS_Q07, answers: ['680'] })
    expect(findings.map((f) => f.missing).sort()).toEqual(['680 pounds', '£680', '£ 680'].sort())
    // Never a word form: 680 has no name in the bounded number table.
    expect(findings.map((f) => f.missing)).not.toContain('six hundred and eighty')
  })

  it('never demands "£fifteen": the symbol-attached form comes from a figure only', () => {
    expect(keyLint(LS_Q08).map((f) => f.missing)).not.toContain('£fifteen')
  })

  it('generates nothing for a preprinted word that is not a unit', () => {
    // "students" follows the gap in gt1-q11's prompt and is content, not a unit.
    expect(keyLint(GT1_Q11)).toEqual([])
  })

  it('generates nothing for a prompt with no gap at all', () => {
    // ls-q29 is the short-answer format: no `_{2,}` run to anchor a unit to.
    expect(keyLint(LS_Q29)).toEqual([])
  })

  it('drops a candidate that breaks the word limit instead of reporting it', () => {
    const findings = keyLint({ ...LS_Q33, answers: ['1,000', 'one thousand'] })
    const missing = findings.map((f) => f.missing)
    // "one thousand metres" is three words against maxWords: 2 — verdict must
    // classify it over-limit and the class must drop it, not report it.
    expect(missing).not.toContain('one thousand metres')
    expect(missing).toContain('1000')
    expect(missing).toContain('1,000 metres')
  })
})

/* -------------------------- non-completion types --------------------------- */

it('returns nothing for a non-completion question', () => {
  const multipleChoice = GENERAL_TEST_01.questions.find((q) => q.type === 'multiple-choice')!
  expect(keyLint(multipleChoice)).toEqual([])
})

/* ------------------------- every registered paper --------------------------- */

interface LintablePaper {
  id: string
  questions: readonly LintableQuestion[]
}

const PAPERS: LintablePaper[] = [...READING_TESTS, ...LISTENING_TESTS]

const COMPLETION_QUESTIONS = PAPERS.flatMap((paper) =>
  paper.questions
    .filter((question) => question.type === 'completion')
    .map((question) => ({ paperId: paper.id, questionId: question.id, question })),
)

it.each(COMPLETION_QUESTIONS)('$paperId $questionId lists every rendering SPEC requires', ({ question }) => {
  const findings = keyLint(question)
  expect(
    findings.map((f) => `${f.klass}: "${f.missing}" (from "${f.from}") — ${f.reason}`),
  ).toEqual([])
})

it('is actually looking at some questions', () => {
  // A filter bug that matched nothing would make every assertion above vacuous
  // — the exact failure mode plan 021 exists to stop repeating.
  expect(COMPLETION_QUESTIONS.length).toBeGreaterThanOrEqual(20)
})

it('covers every registered paper', () => {
  const covered = new Set(COMPLETION_QUESTIONS.map((c) => c.paperId))
  expect(covered.size).toBe(READING_TESTS.length + LISTENING_TESTS.length)
})
