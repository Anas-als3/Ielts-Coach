/**
 * Listening contracts. Implements plan 011 "Scope".
 *
 * Listening is Reading's sibling, and this file is deliberately thin because of
 * it. A Listening paper is an answer key plus a recording; the key is marked by
 * the SAME function Reading uses (`src/marking/markAnswerKey.ts`) and the raw
 * score is converted by a table (`./bandTable.ts`). Nothing about the marking is
 * heuristic, so nothing here hedges.
 *
 * Two decisions are load-bearing and are stated here rather than left implicit:
 *
 * 1. **There is no Academic/General distinction.** Both exams sit the identical
 *    Listening paper and are converted by the identical table, so `ListeningTest`
 *    has no `module` field and `ListeningResult` does not report one. Plan 011
 *    says in terms: "resist any abstraction that implies otherwise." The shared
 *    marker structurally requires a module; `./mark.ts` supplies a placeholder
 *    and strips it back off, so the meaningless field never reaches a caller.
 *
 * 2. **Question shapes are REUSED from Reading, not redeclared.** A Listening
 *    completion item and a Reading completion item are the same object with a
 *    different pointer to the source material, so this file imports
 *    `CompletionQuestion` and `MultipleChoiceQuestion` and swaps `passageIndex`
 *    for `sectionIndex`. The presentation differences the exam does care about —
 *    a form, a plan, a matching bank — are carried by `format`, which is a
 *    display and reporting axis, NOT a marking axis. See `ListeningFormat`.
 *
 * ## Copyright
 *
 * Every transcript and question shipped under `src/listening/` is original work
 * of this project. No text is reproduced from Cambridge/UCLES, from any IELTS
 * publisher, or from any online test bank.
 */
import type {
  CompletionQuestion,
  MultipleChoiceQuestion,
  ReadingPassageSource,
  ReadingResult,
} from '../reading/types'

/* --------------------------------- constants -------------------------------- */

/** Every IELTS Listening paper is 40 questions, both exams, every version. */
export const LISTENING_QUESTION_COUNT = 40

/** Four sections, ten questions each, in rising order of difficulty. */
export const LISTENING_SECTION_COUNT = 4

/** Minutes of audio and answering. The recording plays once and does not stop. */
export const LISTENING_MINUTES = 30

/**
 * Extra minutes to copy answers onto the answer sheet.
 *
 * This exists on the paper-based exam only; the computer-delivered test gives
 * two minutes to check instead, because there is nothing to transfer. This app
 * is screen-based, so the runner has no sheet to copy onto — but the period is
 * modelled anyway and used as a review window, because a learner who practises
 * with 30 minutes and sits a paper exam with 40 has mis-rehearsed the ending.
 */
export const LISTENING_TRANSFER_MINUTES = 10

/* --------------------------------- transcript ------------------------------- */

/**
 * Provenance for a section's transcript. The same contract Reading uses for its
 * passages, imported rather than restated: the legal claim is identical and it
 * must not be possible for the two to drift apart.
 */
export type ListeningSource = ReadingPassageSource

/**
 * How a speaker should sound.
 *
 * This is a HINT, not a guarantee. The real exam uses recorded actors with
 * British, Australian, North American and New Zealand accents, and a synthetic
 * voice will not reproduce that. `accent` records what the recording would be
 * so the UI can say what it is standing in for, and so a driver can prefer a
 * matching voice when the platform happens to offer one.
 */
export interface ListeningVoiceHint {
  /** Perceived gender of the speaker the synthetic voice stands in for. */
  gender: 'female' | 'male'
  /** BCP 47 tag the real recording would use, e.g. 'en-GB', 'en-AU'. */
  accent: string
  /** Speaking rate relative to the driver's default. 1 leaves it alone. */
  rate?: number
  /** Pitch relative to the driver's default. 1 leaves it alone. */
  pitch?: number
}

/** One voice in a section: a narrator, or a person in the scene. */
export interface ListeningSpeaker {
  /** Stable id referenced by every cue, e.g. 'agent'. Unique within a section. */
  id: string
  /** Label printed beside the speaker's lines, e.g. 'ROSS' or 'NARRATOR'. */
  label: string
  /** How the rubric describes them, e.g. 'the booking agent'. */
  description?: string
  voice: ListeningVoiceHint
}

/**
 * One continuous turn of speech.
 *
 * Cues are ORDERED and played in order; the array position is the timeline.
 * There are no absolute timestamps, because there is no recording to align to —
 * a synthetic voice takes as long as it takes, and pinning a cue to 00:41 would
 * be a number that means nothing on the learner's machine.
 */
export interface ListeningCue {
  /** Stable id, unique within the test. */
  id: string
  /** A `ListeningSpeaker.id` declared by this section's transcript. */
  speakerId: string
  /** What is said, as one turn. */
  text: string
  /**
   * Silence before this cue, in seconds. The exam's reading and checking
   * pauses ("you now have half a minute to look at questions 11 to 14").
   */
  pauseBeforeSec?: number
  /**
   * Question numbers whose answer is spoken in this cue. Review-screen only —
   * it lets the report show the learner exactly where the answer went past.
   * Never consulted when marking.
   */
  answersQuestions?: number[]
}

/** A section's script: who speaks, and what they say, in order. */
export interface ListeningTranscript {
  speakers: ListeningSpeaker[]
  cues: ListeningCue[]
}

/* ---------------------------------- sections -------------------------------- */

/**
 * The four fixed section contexts, in the order the exam uses them. They are
 * not decoration: they are what makes the paper get harder, and a section that
 * does not match its slot is a mis-built test.
 */
export type ListeningContext =
  /** Section 1 — a transaction between two speakers in an everyday context. */
  | 'social-transactional'
  /** Section 2 — one speaker, everyday context: a talk, a tour, an announcement. */
  | 'social-monologue'
  /** Section 3 — up to four speakers, education or training. */
  | 'educational-conversation'
  /** Section 4 — one speaker, academic: a lecture. */
  | 'academic-monologue'

export interface ListeningSection {
  id: string
  /** 1-based section number as printed, 1–4. */
  number: number
  /** Heading as printed, e.g. 'Section 1'. */
  heading: string
  /** The rubric read aloud, e.g. 'You will hear a telephone conversation …'. */
  rubric: string
  context: ListeningContext
  transcript: ListeningTranscript
  source: ListeningSource
}

/* --------------------------------- questions -------------------------------- */

/**
 * How an item is PRESENTED and reported. This is the axis a learner improves
 * along ("I lose plan labelling"), and it is deliberately separate from the
 * marking `type`, which only says how a submitted string is compared.
 *
 * Matching and plan/map/diagram labelling both mark as `multiple-choice`,
 * because that is exactly what they are once the paper is off the desk: pick
 * one entry from a shared bank. Splitting them at the marking layer would have
 * meant a second copy of the marker for no behavioural difference.
 */
export type ListeningFormat =
  | 'form-completion'
  | 'note-completion'
  | 'table-completion'
  | 'short-answer'
  | 'multiple-choice'
  | 'matching'
  | 'map-labelling'

/** What a Listening item adds to the Reading question shape it reuses. */
interface ListeningItemFields {
  /** Index into `ListeningTest.sections` of the section this is answered from. */
  sectionIndex: number
  format: ListeningFormat
}

/**
 * Form, note, table, sentence and short-answer items.
 *
 * `maxWords` is the printed limit and is enforced against what the learner
 * wrote, so an over-length answer is wrong even when its content is right —
 * exactly as in the real exam. See `src/marking/markAnswerKey.ts`.
 */
export type ListeningCompletionQuestion = Omit<CompletionQuestion, 'passageIndex'> &
  ListeningItemFields

/**
 * Single-answer selection: true multiple choice, matching from a bank, and
 * plan/map/diagram labelling.
 *
 * `options` is the bank. Letters are NOT stored — they are the array positions,
 * rendered A, B, C … in order, the same convention Reading uses. The accepted
 * answer is the option TEXT, so marking never depends on option order.
 *
 * For `map-labelling`, each option describes a position on the plan in words.
 * The app ships no images, so a described plan is what an honest text-only
 * rendering of this task type looks like; the UI says so.
 */
export type ListeningChoiceQuestion = Omit<MultipleChoiceQuestion, 'passageIndex'> &
  ListeningItemFields

/** A Listening item, discriminated on `type` exactly as Reading's union is. */
export type ListeningQuestion = ListeningCompletionQuestion | ListeningChoiceQuestion

/**
 * The printed instruction block above a run of questions.
 *
 * Groups tile the paper: every number from 1 to 40 belongs to exactly one, and
 * `tests/listening-marking.test.ts` fails if they do not. Without this the
 * runner has nowhere to put "Choose ONE WORD AND/OR A NUMBER for each answer",
 * which is part of the question — a learner who does not see the word limit
 * cannot obey it.
 */
export interface ListeningQuestionGroup {
  id: string
  sectionIndex: number
  /** First question number in the group, inclusive. */
  from: number
  /** Last question number in the group, inclusive. */
  to: number
  format: ListeningFormat
  /** The rubric, e.g. 'Write NO MORE THAN TWO WORDS AND/OR A NUMBER …'. */
  instruction: string
  /** Heading printed above the block, e.g. 'BOOKING ENQUIRY FORM'. */
  heading?: string
}

/* ----------------------------------- test ----------------------------------- */

export interface ListeningTest {
  id: string
  title: string
  /** Exactly four, in printed order. */
  sections: ListeningSection[]
  /** Flat and ordered by `number`, 1–40. Each carries its own `sectionIndex`. */
  questions: ListeningQuestion[]
  /** Printed instruction blocks, tiling 1–40. */
  groups: ListeningQuestionGroup[]
}

/* ------------------------------ attempt & result ---------------------------- */

/** What the learner typed or selected, keyed by `ListeningQuestion.id`. */
export type ListeningAnswers = Record<string, string>

/** A learner's run at a test, as persisted. */
export interface ListeningAttempt {
  id: string
  testId: string
  dateISO: string
  answers: ListeningAnswers
  /** Seconds spent. null when the attempt was untimed. */
  durationSec: number | null
  /**
   * True when the learner replayed any section. A replayed paper is still worth
   * marking, but its band is not comparable to an exam-condition run, and the
   * report must not pretend otherwise.
   */
  practice: boolean
}

/** Accuracy for one presentation format — the axis worth coaching against. */
export interface ListeningFormatAccuracy {
  format: ListeningFormat
  total: number
  correct: number
  /** 0–1. Zero when `total` is zero, never NaN. */
  accuracy: number
}

/**
 * A marked Listening paper.
 *
 * `ReadingResult` minus `module`, plus `byFormat`. Dropping `module` is the
 * point: there is no Academic/General split in Listening, and a result object
 * carrying one would invite a caller to branch on a distinction that does not
 * exist. `byType` is inherited and survives, but it only ever holds two buckets
 * here — `byFormat` is the breakdown a Listening learner can act on.
 */
export interface ListeningResult extends Omit<ReadingResult, 'module'> {
  byFormat: ListeningFormatAccuracy[]
}
