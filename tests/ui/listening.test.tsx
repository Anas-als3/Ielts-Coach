/**
 * The Listening section, rendered (plan 011, the runner/report/integration half).
 *
 * Five guarantees, in the order they would hurt a learner if they broke:
 *
 * 1. **The recording plays once, in order.** A practice that quietly allows a
 *    second listen reports a band the learner will not reproduce on the day.
 *    Practice mode lifts the rule explicitly and the attempt is labelled.
 * 2. **The UI says the voice is synthetic.** The app speaks with the browser's
 *    engine and the real exam uses recorded actors with varied accents.
 *    Presenting the first as the second misrepresents the practice.
 * 3. **Every question format is answerable.** A format that renders but cannot
 *    be answered is a guaranteed wrong mark on every paper containing it.
 * 4. **The band is stated as exact, and broken down by FORMAT.** Matching and
 *    plan labelling both MARK as multiple choice; a type-keyed breakdown would
 *    bury exactly the thing worth coaching.
 * 5. **A Listening paper is not a writing session.** It carries no issues, so
 *    counting it in the error profile would read as a clean essay.
 *
 * Everything drives the real <App /> through `renderApp()`, which pins the
 * prompt draw and the speech driver. No test here touches `speechSynthesis`:
 * jsdom has none, and `FakeSpeechDriver` is deterministic and timer-free.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'
import { LISTENING_TEST_01, LISTENING_TESTS } from '../../src/listening/tests'
import { FakeSpeechDriver, TranscriptPaceDriver } from '../../src/listening/speech'
import type { ListeningQuestion } from '../../src/listening/types'
import { LISTENING_FORMAT_META } from '../../src/meta'

/* --------------------------------- helpers ---------------------------------- */

type User = ReturnType<typeof userEvent.setup>

/**
 * The real fallback driver on a clock that fires at once.
 *
 * `TranscriptPaceDriver` takes its scheduler by injection precisely so it can
 * be driven without waiting 130 words per minute of wall-clock time. This is
 * the genuine option-C code path, not a stand-in for it — which is what makes
 * the `TRANSCRIPT_FALLBACK_NOTICE` assertions worth having.
 */
function transcriptDriver(): TranscriptPaceDriver {
  return new TranscriptPaceDriver({
    after: (_ms, fn) => {
      fn()
      return () => {}
    },
  })
}

function navLink(name: string): HTMLElement {
  return within(document.querySelector('.nav') as HTMLElement).getByText(name)
}

/**
 * The picker card for one paper. The picker lists EVERY authored paper and
 * each card carries its own "Sit under exam conditions" / "Practice mode"
 * pair, so any query for those buttons must be scoped to a card — an unscoped
 * `getByRole` matched exactly one element only while one paper existed.
 */
function paperCard(title: string): HTMLElement {
  return screen.getByRole('heading', { name: title }).closest('.lsp-test') as HTMLElement
}

function sectionTab(name: string): HTMLElement {
  return screen.getByRole('tab', { name: new RegExp(name) })
}

function playButton(): HTMLButtonElement {
  return document.querySelector('.lr-play') as HTMLButtonElement
}

function questionsOfFormat(format: ListeningQuestion['format']): ListeningQuestion[] {
  return LISTENING_TEST_01.questions.filter((q) => q.format === format)
}

function questionByNumber(n: number): ListeningQuestion {
  const q = LISTENING_TEST_01.questions.find((x) => x.number === n)
  if (q === undefined) throw new Error(`no question ${n}`)
  return q
}

/** Submit one answer through its real widget, chosen by FORMAT as the UI is. */
async function answer(user: User, question: ListeningQuestion, value: string): Promise<void> {
  if (question.type === 'completion') {
    const input = document.getElementById(`lr-input-${question.id}`) as HTMLInputElement
    await user.clear(input)
    await user.type(input, value)
    return
  }
  if (LISTENING_FORMAT_META[question.format].widget === 'bank') {
    const select = document.getElementById(`lr-select-${question.id}`) as HTMLSelectElement
    await user.selectOptions(select, value)
    return
  }
  // Matched on the input's VALUE rather than its label: a multiple-choice
  // option is a whole sentence.
  const radios = Array.from(
    document.querySelectorAll<HTMLInputElement>(`input[name="q-${question.id}"]`),
  )
  const radio = radios.find((r) => r.value === value)
  if (radio === undefined) throw new Error(`no choice "${value}" for ${question.id}`)
  await user.click(radio)
}

async function answerCorrectly(user: User, question: ListeningQuestion): Promise<void> {
  await answer(user, question, question.answers[0])
}

/** Open the Listening section and start TEST 1 under the given conditions. */
async function startPaper(user: User, mode: 'exam' | 'practice' = 'exam'): Promise<void> {
  await user.click(navLink('Listening'))
  await user.click(
    within(paperCard(LISTENING_TEST_01.title)).getByRole('button', {
      name: mode === 'exam' ? 'Sit under exam conditions' : 'Practice mode',
    }),
  )
  await screen.findByRole('tab', { name: /Section 1/ })
}

/**
 * Play the active section and wait for playback to finish.
 *
 * The wait is on the TRANSPORT READOUT rather than on the button, because the
 * button's label never says "Playing…" — an earlier version of this helper
 * waited on the label and so waited for nothing at all. The readout is what
 * actually changes, so this is a real barrier.
 */
async function play(user: User): Promise<void> {
  await user.click(playButton())
  await waitFor(() =>
    expect(document.querySelector('.lr-transport-state')?.textContent).not.toBe('Playing…'),
  )
}

/* ------------------------------ the front door ------------------------------ */

describe('the Listening section front door', () => {
  it('is reachable and lists every authored paper', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(navLink('Listening'))

    expect(screen.getByRole('heading', { name: 'Listening', level: 1 })).toBeInTheDocument()
    // Every registered paper gets a card with its own pair of start buttons —
    // not just the first: a paper that registers but does not render is
    // content nobody can sit.
    for (const test of LISTENING_TESTS) {
      expect(within(paperCard(test.title)).getByText(test.title)).toBeInTheDocument()
    }
    expect(screen.getAllByRole('button', { name: 'Sit under exam conditions' })).toHaveLength(
      LISTENING_TESTS.length,
    )
  })

  it('offers NO exam type, because Listening is identical in both exams', async () => {
    const user = userEvent.setup()
    renderApp()

    // The Reading section shows this control, because the two exams' papers are
    // different objects marked by different tables. Listening is one paper and
    // one table, so a control that changed nothing would teach the learner that
    // the choice matters.
    await user.click(navLink('Reading'))
    expect(screen.getByRole('group', { name: 'IELTS exam type' })).toBeInTheDocument()

    await user.click(navLink('Listening'))
    expect(screen.queryByRole('group', { name: 'IELTS exam type' })).not.toBeInTheDocument()
    expect(screen.getByText(/identical/i)).toBeInTheDocument()
  })

  it('says the voice is synthetic before the learner commits to a paper', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(navLink('Listening'))

    // The exact exported sentence, not a paraphrase: it is exported as a
    // constant precisely so it cannot quietly go missing or get softened.
    expect(screen.getByText(/generated by your browser, not a recording/i)).toBeInTheDocument()
    expect(screen.getByText(/British, Australian/i)).toBeInTheDocument()
  })

  it('shows the OTHER notice when the browser has no voice at all', async () => {
    const user = userEvent.setup()
    // What a browser without a usable voice actually gets: the paced transcript
    // driver. It is a different exercise and the UI has to say so, or a learner
    // will report a Listening band they earned by reading.
    renderApp({ listeningDriver: transcriptDriver() })
    await user.click(navLink('Listening'))

    expect(screen.getByText(/revealed line by line at speaking pace/i)).toBeInTheDocument()
    expect(screen.getByText(/a reading exercise with a clock on it/i)).toBeInTheDocument()
    expect(screen.queryByText(/generated by your browser/i)).not.toBeInTheDocument()
  })

  it('spells out the difference between exam conditions and practice', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(navLink('Listening'))

    expect(screen.getByText(/The two ways to sit it/i)).toBeInTheDocument()
    expect(screen.getByText(/never again/i)).toBeInTheDocument()
    expect(screen.getByText(/not the band you would get on the day/i)).toBeInTheDocument()
  })
})

/* --------------------------------- playback --------------------------------- */

describe('the play-once rule', () => {
  it('speaks a section in order, through the driver', async () => {
    const driver = new FakeSpeechDriver()
    const user = userEvent.setup()
    renderApp({ listeningDriver: driver })
    await startPaper(user)

    await play(user)

    // Every cue of section 1, in the order the transcript declares them.
    const expected = LISTENING_TEST_01.sections[0].transcript.cues.map((c) => c.id)
    expect(driver.queues).toEqual([expected])
    expect(driver.outcomes).toEqual(['completed'])
    expect(driver.spoken).toHaveLength(expected.length)
  })

  it('refuses a second listen, and says why', async () => {
    const user = userEvent.setup()
    renderApp()
    await startPaper(user)

    await play(user)

    expect(playButton()).toBeDisabled()
    expect(screen.getByText(/Played\. It does not play again\./)).toBeInTheDocument()
    expect(screen.getByText(/plays the recording once and does not repeat it/i)).toBeInTheDocument()
  })

  it('refuses to skip ahead to a later section', async () => {
    const driver = new FakeSpeechDriver()
    const user = userEvent.setup()
    renderApp({ listeningDriver: driver })
    await startPaper(user)

    await user.click(sectionTab('Section 3'))

    expect(playButton()).toBeDisabled()
    expect(screen.getByText(/Sections play in order\. Section 1 is next\./)).toBeInTheDocument()
    // Nothing was spoken: the refusal is a returned value, not an exception,
    // and no audio leaked out before it.
    expect(driver.spoken).toEqual([])
  })

  it('never prints the words while a voice is speaking', async () => {
    const user = userEvent.setup()
    renderApp()
    await startPaper(user)
    await play(user)

    // A subtitled listening test is a reading test. Under a speaking driver the
    // stage shows who spoke and nothing else, so no line of the script reaches
    // the DOM.
    const firstCue = LISTENING_TEST_01.sections[0].transcript.cues[0]
    expect(document.body.textContent).not.toContain(firstCue.text)
  })

  it('DOES print the words when there is no voice, and only then', async () => {
    const user = userEvent.setup()
    renderApp({ listeningDriver: transcriptDriver() })
    await startPaper(user)

    await play(user)

    // Option C: with nothing to listen to, the transcript revealed at speaking
    // pace is the exercise. The previous case is the same assertion inverted —
    // together they pin that the reveal is conditional on there being no voice,
    // rather than on a flag somebody could flip.
    const firstCue = LISTENING_TEST_01.sections[0].transcript.cues[0]
    expect(screen.getByText(firstCue.text)).toBeInTheDocument()
    // And the section is still spent: no voice does not mean a free replay.
    expect(playButton()).toBeDisabled()
  })

  it('lets practice mode replay a section, and labels the attempt', async () => {
    const driver = new FakeSpeechDriver()
    const user = userEvent.setup()
    renderApp({ listeningDriver: driver })
    await startPaper(user, 'practice')

    await play(user)
    expect(playButton()).toBeEnabled()
    expect(playButton().textContent).toBe('Play again')

    await play(user)

    // Two full playbacks of the same section — the thing exam conditions forbid.
    expect(driver.outcomes).toEqual(['completed', 'completed'])
    // Flagged in the toolbar for the whole sitting, so a learner can never be
    // unsure which kind of attempt they are in.
    expect(document.querySelector('.lr-practice-flag')?.textContent).toMatch(/practice mode/i)
  })
})

/* ------------------------------ answering the paper ------------------------- */

describe('sitting a Listening paper', () => {
  it('clears the desk: no navigation while the clock runs', async () => {
    const user = userEvent.setup()
    renderApp()
    await startPaper(user)

    expect(document.querySelector('.nav')).toBeNull()
    expect(screen.queryByRole('group', { name: 'IELTS exam type' })).not.toBeInTheDocument()
  })

  it('opens on section 1 with a thirty-minute clock', async () => {
    const user = userEvent.setup()
    renderApp()
    await startPaper(user)

    // Asserted as a RANGE, not the literal 30:00: the countdown is running
    // while the test runs, and pinning the digit would fail on a slow machine.
    const timer = screen.getByRole('timer')
    const [mm, ss] = (timer.textContent ?? '').split(':').map(Number)
    const left = mm * 60 + ss
    expect(left).toBeLessThanOrEqual(30 * 60)
    expect(left).toBeGreaterThan(29 * 60)

    expect(screen.getByText('Recording and answering')).toBeInTheDocument()
    expect(screen.getByText(/^Questions 1–8$/)).toBeInTheDocument()
  })

  it('makes all five question formats answerable', async () => {
    const user = userEvent.setup()
    renderApp()
    await startPaper(user)

    // Section 1: form completion and multiple choice.
    const form = questionsOfFormat('form-completion')[0]
    const mcq = questionsOfFormat('multiple-choice')[0]
    await answerCorrectly(user, form)
    await answerCorrectly(user, mcq)
    expect((document.getElementById(`lr-input-${form.id}`) as HTMLInputElement).value).toBe(
      form.answers[0],
    )
    expect(
      document.querySelector<HTMLInputElement>(`input[name="q-${mcq.id}"]:checked`)?.value,
    ).toBe(mcq.answers[0])

    // Section 2: plan labelling, off a bank printed once above the set.
    await user.click(sectionTab('Section 2'))
    const plan = questionsOfFormat('map-labelling')[0]
    await answerCorrectly(user, plan)
    expect((document.getElementById(`lr-select-${plan.id}`) as HTMLSelectElement).value).toBe(
      plan.answers[0],
    )

    // Section 3: matching, and short answer.
    await user.click(sectionTab('Section 3'))
    const match = questionsOfFormat('matching')[0]
    const short = questionsOfFormat('short-answer')[0]
    await answerCorrectly(user, match)
    await answerCorrectly(user, short)
    expect((document.getElementById(`lr-select-${match.id}`) as HTMLSelectElement).value).toBe(
      match.answers[0],
    )
    expect((document.getElementById(`lr-input-${short.id}`) as HTMLInputElement).value).toBe(
      short.answers[0],
    )

    // Section 4: note completion.
    await user.click(sectionTab('Section 4'))
    const note = questionsOfFormat('note-completion')[0]
    await answerCorrectly(user, note)
    expect((document.getElementById(`lr-input-${note.id}`) as HTMLInputElement).value).toBe(
      note.answers[0],
    )

    // Answers survive moving between sections — the sheet is one sheet.
    await user.click(sectionTab('Section 1'))
    expect((document.getElementById(`lr-input-${form.id}`) as HTMLInputElement).value).toBe(
      form.answers[0],
    )
  })

  it('renders matching and plan labelling differently from multiple choice', async () => {
    const user = userEvent.setup()
    renderApp()
    await startPaper(user)
    await user.click(sectionTab('Section 2'))

    // All three MARK as `multiple-choice`. The exam presents them differently,
    // and the runner renders by `format` so that difference survives.
    const mcq = questionByNumber(11)
    const plan = questionByNumber(15)
    expect(mcq.type).toBe('multiple-choice')
    expect(plan.type).toBe('multiple-choice')

    expect(document.querySelectorAll(`input[name="q-${mcq.id}"]`).length).toBeGreaterThan(0)
    expect(document.getElementById(`lr-select-${mcq.id}`)).toBeNull()
    expect(document.getElementById(`lr-select-${plan.id}`)).not.toBeNull()
    // The shared bank is printed ONCE above the set, as the paper prints it.
    expect(document.querySelectorAll('.lr-bank')).toHaveLength(1)
  })

  it('prints the word limit and warns when an answer goes over it', async () => {
    const user = userEvent.setup()
    renderApp()
    await startPaper(user)

    expect(screen.getAllByText('NO MORE THAN TWO WORDS').length).toBeGreaterThan(0)

    await answer(user, questionsOfFormat('form-completion')[0], 'far too many words here')
    expect(screen.getByText(/over the limit, this will be marked wrong/i)).toBeInTheDocument()
  })

  it('opens the checking window once the last section has played', async () => {
    const user = userEvent.setup()
    renderApp()
    await startPaper(user)

    for (const n of [1, 2, 3, 4]) {
      await user.click(sectionTab(`Section ${n}`))
      await play(user)
    }

    // The recording is over, so the extra time starts here rather than at a
    // fixed point on the clock — which is what the real exam does.
    expect(screen.getByText('Checking time')).toBeInTheDocument()
    expect(screen.getByText(/nothing to copy/i)).toBeInTheDocument()
    // Re-clocked to the transfer period, not left running down the first one.
    const timer = screen.getByRole('timer')
    const [mm, ss] = (timer.textContent ?? '').split(':').map(Number)
    expect(mm * 60 + ss).toBeLessThanOrEqual(10 * 60)
    expect(mm * 60 + ss).toBeGreaterThan(9 * 60)
  })

  it('saves nothing when the attempt is abandoned', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderApp()
    await startPaper(user)

    await answerCorrectly(user, questionsOfFormat('form-completion')[0])
    await user.click(screen.getByRole('button', { name: 'Leave test' }))

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(confirmSpy.mock.calls[0][0]).toMatch(/will not be saved/i)
    // Back on the picker: one start button per authored paper, and no history.
    expect(screen.getAllByRole('button', { name: 'Sit under exam conditions' })).toHaveLength(
      LISTENING_TESTS.length,
    )
    expect(screen.queryByText(/Your Listening results/i)).not.toBeInTheDocument()
  })
})

/* --------------------------------- the report ------------------------------- */

describe('the Listening report', () => {
  /**
   * Answer section 1 and questions 11–14 correctly, then submit.
   *
   * 14 of 40 is band 4.5 — a real row of the published table rather than the
   * floor — and it leaves a deliberate spread across formats: form completion
   * perfect, multiple choice partial, plan labelling and matching at zero. That
   * spread is what makes the per-format assertions decidable.
   */
  const CORRECT = [...LISTENING_TEST_01.questions.filter((q) => q.sectionIndex === 0)].concat(
    [11, 12, 13, 14].map(questionByNumber),
  )

  async function sitPaper(user: User, mode: 'exam' | 'practice' = 'exam'): Promise<void> {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await startPaper(user, mode)
    for (const question of CORRECT.filter((q) => q.sectionIndex === 0)) {
      await answerCorrectly(user, question)
    }
    await user.click(sectionTab('Section 2'))
    for (const question of CORRECT.filter((q) => q.sectionIndex === 1)) {
      await answerCorrectly(user, question)
    }
    await user.click(screen.getByRole('button', { name: 'Submit answers' }))
    await screen.findByText(/This band is exact/i)
  }

  it('reports the raw score and the band from the one published table', async () => {
    const user = userEvent.setup()
    renderApp()
    await sitPaper(user)

    expect(document.querySelector('.lrp-band')?.textContent).toBe('4.5')
    expect(document.querySelector('.lrp-raw')?.textContent).toBe('14 / 40')
    // The published row is quoted, so the number is auditable rather than magic.
    expect(screen.getByText(/Listening table:/)).toBeInTheDocument()
    expect(screen.getByText('13–15')).toBeInTheDocument()
  })

  it('says plainly that the band is exact, and that one table serves both exams', async () => {
    const user = userEvent.setup()
    renderApp()
    await sitPaper(user)

    expect(screen.getByText('This band is exact, not an estimate.')).toBeInTheDocument()
    expect(screen.getByText(/form-only estimates/i)).toBeInTheDocument()
    expect(screen.getByText(/One table serves both exams/i)).toBeInTheDocument()
  })

  it('breaks accuracy down by FORMAT, weakest first', async () => {
    const user = userEvent.setup()
    renderApp()
    await sitPaper(user)

    const order = Array.from(document.querySelectorAll('.lrp-format-label')).map(
      (el) => el.textContent,
    )
    expect(order).toEqual([
      'Plan / map labelling',
      'Matching',
      'Note completion',
      'Multiple choice',
      'Form completion',
      'Short answer',
    ])

    const scores = Array.from(document.querySelectorAll('.lrp-format-score')).map(
      (el) => el.textContent,
    )
    // The claim this breakdown exists to make: plan labelling and matching mark
    // as `multiple-choice`, so a type-keyed report would have printed one
    // "multiple choice 6/23" row and hidden both. Here they are three rows.
    expect(scores).toEqual(['0/6', '0/5', '0/10', '6/9', '8/8', '0/2'])
  })

  it('shows every question against the key, and can hide the ones that were right', async () => {
    const user = userEvent.setup()
    renderApp()
    await sitPaper(user)

    expect(document.querySelectorAll('.lrp-answer')).toHaveLength(40)

    await user.click(screen.getByRole('button', { name: 'Wrong 26' }))
    expect(document.querySelectorAll('.lrp-answer')).toHaveLength(26)
    expect(document.querySelectorAll('.lrp-answer-right')).toHaveLength(0)
  })

  it('tells the learner where the answer went past in the recording', async () => {
    const user = userEvent.setup()
    renderApp()
    await sitPaper(user)

    // The most useful line on this screen for Listening specifically: a learner
    // who cannot replay the audio has no other way to find out what they missed.
    const explanation = questionByNumber(1).explanation
    expect(explanation).toBeDefined()
    expect(screen.getByText(explanation as string)).toBeInTheDocument()
  })

  it('marks a practice run as not comparable', async () => {
    const user = userEvent.setup()
    renderApp()
    await sitPaper(user, 'practice')

    expect(screen.getByText(/not comparable with an exam-condition attempt/i)).toBeInTheDocument()
  })

  it('keeps the result in the Listening history and out of writing progress', async () => {
    const user = userEvent.setup()
    renderApp()
    await sitPaper(user)

    await user.click(screen.getByRole('button', { name: 'Another paper' }))
    expect(screen.getByText(/Your Listening results/i)).toBeInTheDocument()
    expect(screen.getByText('14/40')).toBeInTheDocument()

    // A Listening paper produces no writing issues, so counting it in the error
    // profile would read as a flawless essay. The dashboard has never seen it.
    await user.click(navLink('Progress'))
    await waitFor(() =>
      expect(
        screen.getByText('Write your first essay and your profile starts here.'),
      ).toBeInTheDocument(),
    )
  })

  it('does not show the result in the Reading history either', async () => {
    const user = userEvent.setup()
    renderApp()
    await sitPaper(user)

    await user.click(screen.getByRole('button', { name: 'Another paper' }))
    await user.click(navLink('Reading'))

    expect(screen.queryByText(/Your Academic Reading results/i)).not.toBeInTheDocument()
  })

  it('ships the tapescript per section, collapsed, below the review', async () => {
    const user = userEvent.setup()
    renderApp()
    await sitPaper(user)

    const details = document.querySelectorAll<HTMLDetailsElement>('details.lrp-tapescript')
    expect(details).toHaveLength(4)
    for (const d of details) expect(d.open).toBe(false)

    // Content inside a closed <details> is still in the DOM — jest-dom's
    // visibility assertion is what actually pins "collapsed", not presence.
    expect(
      screen.getByText('Good morning, Harbour View Cottages, Ross speaking.'),
    ).not.toBeVisible()

    // Below the review: the tapescript is back-matter, not competing with it.
    const review = document.querySelector('.lrp-review')
    const tape = document.querySelector('.lrp-tapescripts')
    expect(
      review!.compareDocumentPosition(tape!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('expanding a tapescript section reveals the authored script', async () => {
    const user = userEvent.setup()
    renderApp()
    await sitPaper(user)

    await user.click(document.querySelector('.lrp-tapescript-summary') as HTMLElement)

    expect(document.querySelector<HTMLDetailsElement>('details.lrp-tapescript')!.open).toBe(true)
    expect(
      screen.getByText('Good morning, Harbour View Cottages, Ross speaking.'),
    ).toBeVisible()
    // ROSS speaks many cues in section 1, so this must be getAllByText.
    expect(screen.getAllByText('ROSS').length).toBeGreaterThan(0)
  })
})
