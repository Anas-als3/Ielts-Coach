/**
 * Reading contracts. Implements plan 010 "Types".
 *
 * Reading is the one section of this app that can be EXACTLY right rather than
 * approximately right: a Reading test is an answer key, and a raw score becomes
 * a band by table lookup. Nothing here is heuristic, so nothing here needs the
 * "estimate" hedging the writing engine carries.
 *
 * These types live beside the Reading code rather than in `src/types.ts`
 * because plan 010 shipped the engine first and the UI/persistence wiring
 * second; `src/types.ts` now carries the Reading `SessionRecord` variant, and
 * this file is what it codes against.
 */
import type { Module } from '../types'

/**
 * Which IELTS exam a Reading test belongs to.
 *
 * This is an ALIAS of `Module` in `src/types.ts`, not a second declaration of
 * the same union. It was declared locally while the Reading engine shipped
 * ahead of the app shell; the aliasing this file always anticipated has now
 * happened, so there is exactly ONE concept of "which exam" in the codebase and
 * a `Module` from the app shell can be handed straight to `rawToBand`.
 *
 * The name survives the aliasing on purpose. Reading code keeps reading in its
 * own vocabulary, and the import is TYPE-ONLY — erased at compile time — so the
 * Reading engine still has no runtime dependency on the app shell and
 * `src/reading/` stays independently testable.
 *
 * The distinction the type expresses is load-bearing for Reading in a way it is
 * not for Task 2 marking: the two exams use DIFFERENT raw-score conversion
 * tables, and General Training is markedly stricter. See `bandTable.ts`.
 */
export type ReadingModule = Module

/* --------------------------------- passages --------------------------------- */

/**
 * Where a passage's text came from. Every authored passage must carry one, and
 * `tests/reading-marking.test.ts` fails the build if any is missing or blank.
 *
 * This is a legal contract, not documentation. Real IELTS passages are
 * University of Cambridge (UCLES) copyright and cannot ship in an
 * outward-facing app; every passage in this repo is therefore either prose
 * written for this project or material under a licence that permits reuse,
 * recorded here so the claim is auditable.
 */
export interface ReadingPassageSource {
  /** Plain-language description of the origin, e.g. 'Original prose written for this project'. */
  description: string
  /** Licence the text is used under, e.g. 'Original work, © this project', 'CC BY-SA 4.0', 'Public domain'. */
  licence: string
  /** Source URL. Omitted only when the text is original to this project. */
  url?: string
  /** Attribution line a licence requires (CC BY / CC BY-SA). Omitted otherwise. */
  attribution?: string
}

/**
 * One paragraph of a passage.
 *
 * `label` is the letter printed beside the paragraph on the exam paper (A, B,
 * C …). It exists only when a question set needs to point at paragraphs —
 * matching headings and matching information — and is omitted otherwise,
 * because an unlabelled paragraph must not render a phantom letter.
 */
export interface ReadingParagraph {
  label?: string
  text: string
}

/**
 * One printed text. Academic passages hold exactly one; General Training
 * Sections 1 and 2 hold two or three short ones (adverts, notices, a job ad
 * plus a handbook extract), which is the structural difference between the two
 * exams' Reading papers.
 */
export interface ReadingText {
  /** Heading as printed above the text. */
  title: string
  /** Standfirst or italic lead-in, when the paper prints one. */
  subtitle?: string
  paragraphs: ReadingParagraph[]
}

/**
 * One section of the paper — "Reading Passage 1" in Academic, "Section 1" in
 * General Training.
 */
export interface ReadingPassage {
  id: string
  /** 1-based section number as printed. */
  number: number
  /** Section heading, e.g. 'Reading Passage 1' or 'Section 1'. */
  heading: string
  /** One text in Academic; two or three in General Training Sections 1 and 2. */
  texts: ReadingText[]
  source: ReadingPassageSource
}

/* --------------------------------- questions -------------------------------- */

/** The six question types supported in v1. They cover ~80% of a real paper. */
export type ReadingQuestionType =
  | 'true-false-notgiven'
  | 'yes-no-notgiven'
  | 'multiple-choice'
  | 'completion'
  | 'matching-headings'
  | 'matching-information'

/** One heading in a matching-headings bank. `id` is the printed roman numeral. */
export interface ReadingHeading {
  id: string
  text: string
}

/**
 * Fields every question carries, whatever its type.
 *
 * `answers` is the accepted set, never empty, with the canonical key first. The
 * marker compares against every entry, which is how British/American spellings
 * and genuine synonyms are handled — the key LISTS them rather than the marker
 * guessing them. See `src/marking/markAnswerKey.ts`.
 */
interface ReadingQuestionBase {
  id: string
  /** 1-based number as printed, running 1–40 across the whole test. */
  number: number
  /** Index into `ReadingTest.passages` of the passage this is answered from. */
  passageIndex: number
  /** The statement, question or gapped sentence shown to the learner. */
  prompt: string
  /** Accepted answers, canonical key first. Never empty. */
  answers: string[]
  /** Where the answer is found, shown in the report after submission. */
  explanation?: string
}

export interface TrueFalseNotGivenQuestion extends ReadingQuestionBase {
  type: 'true-false-notgiven'
}

export interface YesNoNotGivenQuestion extends ReadingQuestionBase {
  type: 'yes-no-notgiven'
}

/**
 * Single-answer multiple choice.
 *
 * The accepted answer is the OPTION TEXT, not its letter: the runner submits
 * the text of the chosen option, so marking never depends on option order and
 * the answer key stays readable. `tests/reading-marking.test.ts` pins that
 * every accepted answer is one of the options.
 */
export interface MultipleChoiceQuestion extends ReadingQuestionBase {
  type: 'multiple-choice'
  /** Rendered as A, B, C, D in order. Four in this app's authored tests. */
  options: string[]
}

/**
 * Sentence, summary, note or table completion.
 *
 * `maxWords` is the printed limit ("NO MORE THAN TWO WORDS"). It is enforced
 * against what the learner actually wrote: an answer over the limit is WRONG
 * even when its content is right, exactly as in the real exam.
 */
export interface CompletionQuestion extends ReadingQuestionBase {
  type: 'completion'
  maxWords: number
}

/**
 * One paragraph of a matching-headings set. Every question in a set shares the
 * same `headings` bank — the content files define it once and reference it.
 */
export interface MatchingHeadingsQuestion extends ReadingQuestionBase {
  type: 'matching-headings'
  /** Paragraph label this question asks about, e.g. 'B'. */
  paragraph: string
  /** The shared heading bank, always longer than the number of paragraphs asked. */
  headings: ReadingHeading[]
}

/** "Which paragraph contains the following information?" */
export interface MatchingInformationQuestion extends ReadingQuestionBase {
  type: 'matching-information'
  /** Paragraph labels the learner may choose from, e.g. ['A', 'B', 'C']. */
  paragraphLabels: string[]
}

/**
 * A Reading question, discriminated on `type` — the same shape `Task1Chart`
 * uses for `kind`, so a `switch (q.type)` narrows to the variant's own fields
 * and the compiler catches a missing case.
 */
export type ReadingQuestion =
  | TrueFalseNotGivenQuestion
  | YesNoNotGivenQuestion
  | MultipleChoiceQuestion
  | CompletionQuestion
  | MatchingHeadingsQuestion
  | MatchingInformationQuestion

/* ----------------------------------- test ----------------------------------- */

/** Every IELTS Reading paper is 40 questions in 60 minutes, both modules. */
export const READING_QUESTION_COUNT = 40

/** Minutes allowed. Reading has no transfer time, unlike Listening. */
export const READING_MINUTES = 60

export interface ReadingTest {
  id: string
  module: ReadingModule
  title: string
  passages: ReadingPassage[]
  /** Flat and ordered by `number`, 1–40. Each carries its own `passageIndex`. */
  questions: ReadingQuestion[]
}

/* ------------------------------ attempt & result ---------------------------- */

/**
 * What the learner typed or selected, keyed by `ReadingQuestion.id`. A missing
 * key and an empty string both mean "left blank", and a blank is never correct.
 */
export type ReadingAnswers = Record<string, string>

/** A learner's run at a test, as persisted. */
export interface ReadingAttempt {
  id: string
  testId: string
  module: ReadingModule
  dateISO: string
  answers: ReadingAnswers
  /** Seconds spent. null when the attempt was untimed. */
  durationSec: number | null
}

/** How one question was marked. Everything the review screen needs. */
export interface ReadingQuestionResult {
  questionId: string
  number: number
  type: ReadingQuestionType
  /** Exactly what the learner submitted, untouched, for display. */
  given: string
  /** The form actually compared against the key — lowercased, whitespace collapsed. */
  normalised: string
  correct: boolean
  /** True when nothing was submitted. Blank is never correct. */
  blank: boolean
  /**
   * True when the answer broke its word limit. Such an answer is wrong even if
   * the content was right, and the report says so rather than leaving the
   * learner to wonder why a correct-looking answer scored nothing.
   */
  overWordLimit: boolean
  /** The canonical key — `answers[0]`. */
  expected: string
  /** Every accepted answer, for the review screen. */
  accepted: string[]
}

/** Accuracy for one question type. The coaching value: "you lose Not Given". */
export interface ReadingTypeAccuracy {
  type: ReadingQuestionType
  total: number
  correct: number
  /** 0–1. Zero when `total` is zero, never NaN. */
  accuracy: number
}

export interface ReadingResult {
  testId: string
  module: ReadingModule
  /** Correct answers. */
  raw: number
  /** Questions asked — 40 for a complete test. */
  total: number
  /** Band from the module's conversion table. Exact, not an estimate. */
  band: number
  questions: ReadingQuestionResult[]
  /** One entry per type PRESENT in the test, in first-appearance order. */
  byType: ReadingTypeAccuracy[]
}
