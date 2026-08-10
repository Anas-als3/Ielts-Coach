/**
 * Listening marking, authored-content integrity and section playback
 * (plan 011 steps 4, 5 and 7).
 *
 * Three jobs in one file, guarding the same contract from three ends:
 *
 * 1. **The marker is Reading's, not a copy.** Plan 011 requires the marking
 *    module to be shared. That is asserted directly — `markAnswerKey` is spied
 *    on and must actually be the function `markListening` calls, with the
 *    Listening band table handed to it — rather than inferred from behaviour
 *    that a duplicate would also pass.
 * 2. **The authored test must be answerable.** Forty questions, unique ids,
 *    numbered 1–40, every key non-empty, every choice key one of its own
 *    options, every completion key inside its own word limit, every cue spoken
 *    by a declared speaker. A key no learner can satisfy is the content
 *    equivalent of a false accusation.
 * 3. **Playback obeys the exam.** Sections play in order, once, and report
 *    completion — driven by a deterministic fake, because `speechSynthesis`
 *    exists in no test environment this suite runs in and none of these rules
 *    has anything to do with a speech engine.
 */
import { describe, expect, it, vi } from 'vitest'

// Spy on the SHARED marker without changing it. `markListening` must reach this
// exact function; if anybody ever inlines a private copy, the assertions in
// "the shared marker" below stop passing.
vi.mock('../src/marking/markAnswerKey', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/marking/markAnswerKey')>()
  return { ...actual, markAnswerKey: vi.fn(actual.markAnswerKey) }
})

import { markAnswerKey, type SubmittedAnswers } from '../src/marking/markAnswerKey'
import { listeningRawToBand } from '../src/listening/bandTable'
import { markListening } from '../src/listening/mark'
import { ListeningPlayer } from '../src/listening/player'
import {
  FakeSpeechDriver,
  TranscriptPaceDriver,
  browserSpeechEngine,
  createSpeechDriver,
  cueDurationMs,
  noticeFor,
  sectionCues,
  SYNTHETIC_VOICE_NOTICE,
  TRANSCRIPT_FALLBACK_NOTICE,
  type SpeechScheduler,
} from '../src/listening/speech'
import { LISTENING_TEST_01, LISTENING_TESTS, listeningTestById } from '../src/listening/tests'
import {
  LISTENING_QUESTION_COUNT,
  LISTENING_SECTION_COUNT,
  type ListeningContext,
  type ListeningTest,
} from '../src/listening/types'

/* --------------------------------- helpers ---------------------------------- */

/** The canonical key for every question. */
function answerAll(test: ListeningTest): SubmittedAnswers {
  const answers: SubmittedAnswers = {}
  test.questions.forEach((q) => {
    answers[q.id] = q.answers[0]
  })
  return answers
}

/** The canonical key for the first `n` questions; the rest left blank. */
function answerFirst(test: ListeningTest, n: number): SubmittedAnswers {
  const answers: SubmittedAnswers = {}
  test.questions.slice(0, n).forEach((q) => {
    answers[q.id] = q.answers[0]
  })
  return answers
}

const AUTHORED: ListeningTest[] = [...LISTENING_TESTS]

/** The four section contexts, in the order the exam fixes them. */
const CONTEXTS: ListeningContext[] = [
  'social-transactional',
  'social-monologue',
  'educational-conversation',
  'academic-monologue',
]

/* ============================== authored content ============================= */

describe.each(AUTHORED)('$id is a complete, answerable paper', (test) => {
  it('has exactly forty questions', () => {
    expect(test.questions).toHaveLength(LISTENING_QUESTION_COUNT)
  })

  it('numbers them 1 to 40 in order, with no gaps and no repeats', () => {
    expect(test.questions.map((q) => q.number)).toEqual(
      Array.from({ length: LISTENING_QUESTION_COUNT }, (_, i) => i + 1),
    )
  })

  it('gives every question a unique id', () => {
    const ids = test.questions.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has exactly four sections, numbered and typed in the exam’s order', () => {
    expect(test.sections).toHaveLength(LISTENING_SECTION_COUNT)
    expect(test.sections.map((s) => s.number)).toEqual([1, 2, 3, 4])
    expect(test.sections.map((s) => s.context)).toEqual(CONTEXTS)
  })

  it('puts ten questions in each section, and points each at a real one', () => {
    const perSection = test.sections.map(
      (_, index) => test.questions.filter((q) => q.sectionIndex === index).length,
    )
    expect(perSection).toEqual([10, 10, 10, 10])
  })

  it('gives every question a non-empty answer key', () => {
    for (const question of test.questions) {
      expect(question.answers.length, `Q${question.number} has no key`).toBeGreaterThan(0)
      for (const answer of question.answers) {
        expect(answer.trim(), `Q${question.number} has a blank key entry`).not.toBe('')
      }
    }
  })

  it('keeps every choice key among its own options', () => {
    for (const question of test.questions) {
      if (question.type !== 'multiple-choice') continue
      expect(question.options.length, `Q${question.number} option count`).toBeGreaterThanOrEqual(3)
      expect(new Set(question.options).size, `Q${question.number} duplicate options`).toBe(
        question.options.length,
      )
      for (const answer of question.answers) {
        expect(question.options, `Q${question.number} key is not an option`).toContain(answer)
      }
    }
  })

  it('keeps every completion key inside its own word limit', () => {
    for (const question of test.questions) {
      if (question.type !== 'completion') continue
      for (const answer of question.answers) {
        const words = answer.trim().split(/\s+/).length
        expect(words, `Q${question.number} key "${answer}" breaks its own limit`).toBeLessThanOrEqual(
          question.maxWords,
        )
      }
    }
  })

  it('never prints the answer inside the question that asks for it', () => {
    for (const question of test.questions) {
      if (question.type !== 'completion') continue
      const prompt = question.prompt.toLowerCase()
      for (const answer of question.answers) {
        expect(prompt, `Q${question.number} leaks its own answer`).not.toContain(
          answer.toLowerCase(),
        )
      }
    }
  })

  it('tiles questions 1 to 40 with instruction groups', () => {
    const covered = new Map<number, string>()
    for (const group of test.groups) {
      expect(group.from, `${group.id} bounds`).toBeLessThanOrEqual(group.to)
      for (let number = group.from; number <= group.to; number += 1) {
        expect(covered.has(number), `Q${number} is in two groups`).toBe(false)
        covered.set(number, group.id)
      }
    }

    for (const question of test.questions) {
      const groupId = covered.get(question.number)
      expect(groupId, `Q${question.number} has no instruction group`).toBeDefined()
      const group = test.groups.find((g) => g.id === groupId)!
      expect(group.format, `Q${question.number} format disagrees with its group`).toBe(question.format)
      expect(group.sectionIndex, `Q${question.number} section disagrees with its group`).toBe(
        question.sectionIndex,
      )
    }

    expect(covered.size).toBe(LISTENING_QUESTION_COUNT)
  })

  it('uses every question format the plan asks Listening to cover', () => {
    const formats = new Set(test.questions.map((q) => q.format))
    expect(formats).toContain('form-completion')
    expect(formats).toContain('note-completion')
    expect(formats).toContain('short-answer')
    expect(formats).toContain('multiple-choice')
    expect(formats).toContain('matching')
    expect(formats).toContain('map-labelling')
  })

  it('has a transcript in which every cue is spoken by a declared speaker', () => {
    for (const section of test.sections) {
      const declared = new Set(section.transcript.speakers.map((s) => s.id))
      expect(section.transcript.cues.length, `${section.id} has no cues`).toBeGreaterThan(0)

      for (const cue of section.transcript.cues) {
        expect(declared, `${cue.id} names an undeclared speaker`).toContain(cue.speakerId)
        expect(cue.text.trim(), `${cue.id} is silent`).not.toBe('')
      }
    }
  })

  it('gives every cue an id unique across the whole test', () => {
    const ids = test.sections.flatMap((s) => s.transcript.cues.map((c) => c.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('only ever cross-references real question numbers from its cues', () => {
    const numbers = new Set(test.questions.map((q) => q.number))
    for (const section of test.sections) {
      for (const cue of section.transcript.cues) {
        for (const number of cue.answersQuestions ?? []) {
          expect(numbers, `${cue.id} points at Q${number}`).toContain(number)
        }
      }
    }
  })

  it('records that every section is original work of this project', () => {
    for (const section of test.sections) {
      expect(section.source.description.trim()).not.toBe('')
      expect(section.source.licence.trim()).not.toBe('')
      expect(section.source.licence).toContain('Original work')
    }
  })
})

describe('the test index', () => {
  it('finds a test by id and returns null for an unknown one', () => {
    expect(listeningTestById('listening-01')).toBe(LISTENING_TEST_01)
    expect(listeningTestById('no-such-test')).toBeNull()
  })
})

/* ============================== the shared marker ============================ */

describe('the shared marker', () => {
  it('is the one Reading uses, called with the Listening band table', () => {
    vi.mocked(markAnswerKey).mockClear()

    markListening(LISTENING_TEST_01, {})

    expect(markAnswerKey).toHaveBeenCalledTimes(1)
    const [markable, , toBand] = vi.mocked(markAnswerKey).mock.calls[0]
    expect(markable.id).toBe(LISTENING_TEST_01.id)
    expect(markable.questions).toBe(LISTENING_TEST_01.questions)
    // Not "a function that happens to agree" — the Listening table itself.
    expect(toBand).toBe(listeningRawToBand)
  })

  it('reports no module, because Listening has no Academic/General split', () => {
    const result = markListening(LISTENING_TEST_01, {}) as Record<string, unknown>
    expect('module' in result).toBe(false)
  })
})

/* ================================== marking ================================== */

describe('marking a Listening paper', () => {
  it('scores a perfect paper 40 out of 40, band 9', () => {
    const result = markListening(LISTENING_TEST_01, answerAll(LISTENING_TEST_01))

    expect(result.raw).toBe(40)
    expect(result.total).toBe(40)
    expect(result.band).toBe(9.0)
    expect(result.questions.every((q) => q.correct)).toBe(true)
    expect(result.questions.some((q) => q.blank)).toBe(false)
  })

  it('scores an all-blank paper zero, and every question as blank', () => {
    const result = markListening(LISTENING_TEST_01, {})

    expect(result.raw).toBe(0)
    expect(result.total).toBe(40)
    expect(result.questions).toHaveLength(40)
    expect(result.questions.every((q) => q.blank)).toBe(true)
    expect(result.questions.every((q) => !q.correct)).toBe(true)
    // The floor band, not an extrapolation. The raw score carries the signal.
    expect(result.band).toBe(4.0)
  })

  it('accepts every alternative key the item-writer listed', () => {
    for (const question of LISTENING_TEST_01.questions) {
      for (const answer of question.answers) {
        const result = markListening(LISTENING_TEST_01, { [question.id]: answer })
        expect(result.raw, `Q${question.number} rejects its own key "${answer}"`).toBe(1)
      }
    }
  })

  it('converts a part-finished paper through the Listening table, not Reading’s', () => {
    // 18/40 is band 5.5 in Listening and 5.0 in Academic Reading. This is the
    // assertion that fails if the wrong table is ever wired in.
    const result = markListening(LISTENING_TEST_01, answerFirst(LISTENING_TEST_01, 18))
    expect(result.raw).toBe(18)
    expect(result.band).toBe(5.5)
  })

  it('applies the shared marker’s leniencies and no others', () => {
    const messy: SubmittedAnswers = {}
    LISTENING_TEST_01.questions.forEach((q, i) => {
      const key = q.answers[0]
      messy[q.id] = i % 2 === 0 ? `  ${key.toUpperCase()}  ` : `\t${key.toLowerCase()}\n`
    })

    expect(markListening(LISTENING_TEST_01, messy).raw).toBe(40)
  })

  it('marks an over-length completion answer wrong however right its content', () => {
    // Q31's limit is two words; "more than four times" is right and too long.
    const result = markListening(LISTENING_TEST_01, { 'ls-q31': 'more than four times' })
    const q31 = result.questions.find((q) => q.number === 31)!

    expect(q31.overWordLimit).toBe(true)
    expect(q31.correct).toBe(false)
    expect(result.raw).toBe(0)
  })

  it('breaks accuracy down by presentation format, in first-appearance order', () => {
    const result = markListening(LISTENING_TEST_01, answerAll(LISTENING_TEST_01))

    expect(result.byFormat.map((f) => f.format)).toEqual([
      'form-completion',
      'multiple-choice',
      'map-labelling',
      'matching',
      'short-answer',
      'note-completion',
    ])
    expect(result.byFormat.reduce((total, f) => total + f.total, 0)).toBe(40)
    expect(result.byFormat.every((f) => f.accuracy === 1)).toBe(true)
  })

  it('reports a zero-accuracy format as 0, never NaN', () => {
    const result = markListening(LISTENING_TEST_01, {})
    for (const format of result.byFormat) {
      expect(format.accuracy).toBe(0)
      expect(Number.isNaN(format.accuracy)).toBe(false)
    }
  })

  it('ignores submitted answers for questions that do not exist', () => {
    const result = markListening(LISTENING_TEST_01, { 'not-a-question': 'anything' })
    expect(result.raw).toBe(0)
    expect(result.questions).toHaveLength(40)
  })
})

/* ================================== playback ================================= */

describe('speech drivers do not need a speech engine', () => {
  it('finds no browser engine in this environment, and does not throw looking', () => {
    // The whole reason `SpeechDriver` exists. If this ever starts returning an
    // engine, the suite is no longer proving what it claims to prove.
    expect(browserSpeechEngine()).toBeNull()
  })

  it('falls back to the paced transcript when there is no engine', () => {
    const driver = createSpeechDriver({ engine: null })
    expect(driver.kind).toBe('transcript-pace')
    expect(driver.available()).toBe(true)
    expect(noticeFor(driver.kind)).toBe(TRANSCRIPT_FALLBACK_NOTICE)
  })

  it('names the synthetic voice honestly when there is one', () => {
    expect(noticeFor('speech-synthesis')).toBe(SYNTHETIC_VOICE_NOTICE)
    expect(SYNTHETIC_VOICE_NOTICE).toContain('not a recording')
  })

  it('paces the transcript at a speaking rate', () => {
    // 130 words per minute: 130 words is a minute, 13 words is six seconds.
    expect(cueDurationMs('one two three four five six seven eight nine ten eleven twelve thirteen')).toBe(6000)
    expect(cueDurationMs('   ')).toBe(0)
  })

  it('plays a whole section through the paced fallback', async () => {
    // A scheduler that fires immediately: deterministic, and no real seconds.
    const immediate: SpeechScheduler = {
      after: (_ms, fn) => {
        fn()
        return () => {}
      },
    }
    const driver = new TranscriptPaceDriver(immediate)
    const started: string[] = []

    const outcome = await driver.play(sectionCues(LISTENING_TEST_01.sections[0]), {
      onCueStart: (cue) => started.push(cue.id),
    })

    expect(outcome).toBe('completed')
    expect(started).toEqual(LISTENING_TEST_01.sections[0].transcript.cues.map((c) => c.id))
  })
})

describe('sectionCues', () => {
  it('resolves each cue to its speaker’s printed label and voice', () => {
    const cues = sectionCues(LISTENING_TEST_01.sections[0])
    expect(cues[0].speaker).toBe('NARRATOR')
    expect(cues[0].voice?.accent).toBe('en-GB')
    expect(new Set(cues.map((c) => c.speaker))).toEqual(new Set(['NARRATOR', 'ROSS', 'PETRA']))
  })
})

describe('the player', () => {
  it('plays the four sections in order and reports completion for each', async () => {
    const driver = new FakeSpeechDriver()
    const player = new ListeningPlayer(LISTENING_TEST_01, driver)

    expect(player.nextSectionIndex).toBe(0)

    for (let index = 0; index < LISTENING_SECTION_COUNT; index += 1) {
      expect(player.canPlay(index)).toBe(true)
      expect(await player.play(index)).toBe('completed')
    }

    expect(driver.outcomes).toEqual(['completed', 'completed', 'completed', 'completed'])
    expect(player.played()).toEqual([0, 1, 2, 3])
    expect(player.complete).toBe(true)
    expect(player.nextSectionIndex).toBeNull()

    // Every cue of every section, in paper order, once.
    expect(driver.spoken.map((cue) => cue.id)).toEqual(
      LISTENING_TEST_01.sections.flatMap((s) => s.transcript.cues.map((c) => c.id)),
    )
    expect(driver.queues).toHaveLength(4)
  })

  it('reports each cue as it starts and ends', async () => {
    const driver = new FakeSpeechDriver()
    const player = new ListeningPlayer(LISTENING_TEST_01, driver)
    const events: string[] = []

    await player.play(0, {
      onCueStart: (cue) => events.push(`start:${cue.id}`),
      onCueEnd: (cue) => events.push(`end:${cue.id}`),
      onOutcome: (outcome) => events.push(`outcome:${outcome}`),
    })

    const first = LISTENING_TEST_01.sections[0].transcript.cues[0].id
    expect(events[0]).toBe(`start:${first}`)
    expect(events[1]).toBe(`end:${first}`)
    expect(events[events.length - 1]).toBe('outcome:completed')
  })

  it('refuses a replay: the exam does not play a section twice', async () => {
    const driver = new FakeSpeechDriver()
    const player = new ListeningPlayer(LISTENING_TEST_01, driver)

    expect(await player.play(0)).toBe('completed')
    expect(player.canPlay(0)).toBe(false)
    expect(player.refusalFor(0)).toBe('already-played')
    expect(await player.play(0)).toBe('refused')

    // Nothing extra was spoken.
    expect(driver.queues).toHaveLength(1)
  })

  it('refuses to skip ahead to a later section', async () => {
    const driver = new FakeSpeechDriver()
    const player = new ListeningPlayer(LISTENING_TEST_01, driver)

    expect(player.refusalFor(3)).toBe('out-of-order')
    expect(await player.play(3)).toBe('refused')
    expect(driver.queues).toHaveLength(0)
    expect(player.played()).toEqual([])
  })

  it('refuses a section that does not exist', async () => {
    const player = new ListeningPlayer(LISTENING_TEST_01, new FakeSpeechDriver())
    expect(player.refusalFor(4)).toBe('no-such-section')
    expect(player.refusalFor(-1)).toBe('no-such-section')
    expect(await player.play(99)).toBe('refused')
  })

  it('allows replays and any order in practice mode, and says that it is one', async () => {
    const driver = new FakeSpeechDriver()
    const player = new ListeningPlayer(LISTENING_TEST_01, driver, { practice: true })

    expect(player.practice).toBe(true)
    expect(await player.play(3)).toBe('completed')
    expect(await player.play(3)).toBe('completed')
    expect(await player.play(0)).toBe('completed')
    expect(driver.queues).toHaveLength(3)
  })

  it('does not count a cancelled section as heard', async () => {
    const driver = new FakeSpeechDriver({ cancelAfterCues: 3 })
    const player = new ListeningPlayer(LISTENING_TEST_01, driver)

    expect(await player.play(0)).toBe('cancelled')
    expect(player.hasPlayed(0)).toBe(false)
    expect(player.canPlay(0)).toBe(true)
    expect(driver.spoken).toHaveLength(3)
  })

  it('does not count a section against a driver that cannot speak', async () => {
    const driver = new FakeSpeechDriver({ available: false })
    const player = new ListeningPlayer(LISTENING_TEST_01, driver)

    expect(await player.play(0)).toBe('unavailable')
    expect(player.hasPlayed(0)).toBe(false)
    expect(driver.spoken).toHaveLength(0)
  })
})
