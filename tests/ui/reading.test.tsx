/**
 * The Reading section, rendered (plan 010, steps 6–9).
 *
 * Four guarantees, in the order they would hurt a learner if they broke:
 *
 * 1. **A learner is never offered the other exam's paper.** The two modules'
 *    papers are built differently AND converted by different tables, so an
 *    Academic paper handed to a General Training candidate reports a band that
 *    is not theirs — 30/40 is a 7.0 in one table and a 6.0 in the other.
 * 2. **All six question types are answerable.** A type that renders but cannot
 *    be answered is a guaranteed wrong mark on every paper containing it.
 * 3. **The band is stated as exact.** Every writing band in this app is hedged
 *    as a form-only estimate; Reading is an answer key, and saying so is the
 *    whole reason the section is worth having.
 * 4. **A Reading paper is not a writing session.** It carries no issues, so
 *    counting it in the error profile would read as a clean essay.
 *
 * Everything drives the real <App /> through `renderApp()`, which pins the
 * prompt draw — an unseeded render reintroduces the flake plan 007 removed.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'
import { ACADEMIC_TEST_01 } from '../../src/reading/tests'
import type { ReadingQuestion } from '../../src/reading/types'

/* --------------------------------- helpers ---------------------------------- */

type User = ReturnType<typeof userEvent.setup>

const ACADEMIC_PAPER = 'Academic Reading Test 1'
const GENERAL_PAPER = 'General Training Reading Test 1'
const ACADEMIC_PAPER_2 = 'Academic Reading Test 2'
const GENERAL_PAPER_2 = 'General Training Reading Test 2'

/** The "Start this paper" button on one paper's card. Each module now lists
 * more than one paper, so the button has to be found through its own card. */
function startButtonFor(title: string): HTMLElement {
  const card = screen.getByText(title).closest('.rdp-test') as HTMLElement
  return within(card).getByRole('button', { name: 'Start this paper' })
}

function navLink(name: string): HTMLElement {
  return within(document.querySelector('.nav') as HTMLElement).getByText(name)
}

function moduleButton(name: 'Academic' | 'General'): HTMLElement {
  return within(screen.getByRole('group', { name: 'IELTS exam type' })).getByRole('button', { name })
}

/** Passage 1 questions, in printed order: 6 headings, 3 gaps, 4 True/False. */
const PASSAGE_1 = ACADEMIC_TEST_01.questions.filter((q) => q.passageIndex === 0)

function questionsOfType(type: ReadingQuestion['type']): ReadingQuestion[] {
  return ACADEMIC_TEST_01.questions.filter((q) => q.type === type)
}

/** Submit the given answer to one question through its real widget. */
async function answer(user: User, question: ReadingQuestion, value: string): Promise<void> {
  if (question.type === 'completion') {
    const input = document.getElementById(`rr-input-${question.id}`) as HTMLInputElement
    await user.clear(input)
    await user.type(input, value)
    return
  }
  if (question.type === 'matching-headings' || question.type === 'matching-information') {
    const select = document.getElementById(`rr-select-${question.id}`) as HTMLSelectElement
    await user.selectOptions(select, value)
    return
  }
  // The three radio types. Matched on the input's value rather than on its
  // label, because a multiple-choice option's text is a whole sentence.
  const radios = Array.from(
    document.querySelectorAll<HTMLInputElement>(`input[name="q-${question.id}"]`),
  )
  const radio = radios.find((r) => r.value === value)
  if (radio === undefined) throw new Error(`no choice "${value}" for ${question.id}`)
  await user.click(radio)
}

/** The canonical key for a question — what a learner who read well would write. */
async function answerCorrectly(user: User, question: ReadingQuestion): Promise<void> {
  await answer(user, question, question.answers[0])
}

/** Open the Reading section and start the first Academic paper. */
async function startAcademicPaper(user: User): Promise<void> {
  await user.click(navLink('Reading'))
  await user.click(startButtonFor(ACADEMIC_PAPER))
  await screen.findByRole('tab', { name: /Reading Passage 1/ })
}

function passageTab(name: string): HTMLElement {
  return screen.getByRole('tab', { name: new RegExp(name) })
}

/* ------------------------------ paper selection ----------------------------- */

describe('the Reading section offers only the active exam', () => {
  it('lists the Academic papers and not the General Training ones', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(navLink('Reading'))

    expect(screen.getByText(ACADEMIC_PAPER)).toBeInTheDocument()
    expect(screen.getByText(ACADEMIC_PAPER_2)).toBeInTheDocument()
    expect(screen.queryByText(GENERAL_PAPER)).not.toBeInTheDocument()
    expect(screen.queryByText(GENERAL_PAPER_2)).not.toBeInTheDocument()
  })

  it('swaps the papers when the learner switches exam type', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(navLink('Reading'))

    await user.click(moduleButton('General'))

    expect(screen.getByText(GENERAL_PAPER)).toBeInTheDocument()
    expect(screen.getByText(GENERAL_PAPER_2)).toBeInTheDocument()
    // The Academic papers are structured differently and convert through a
    // different table; offering one here would report the wrong band.
    expect(screen.queryByText(ACADEMIC_PAPER)).not.toBeInTheDocument()
    expect(screen.queryByText(ACADEMIC_PAPER_2)).not.toBeInTheDocument()
  })

  it('does not destroy an essay in progress when the exam type changes', async () => {
    const user = userEvent.setup()
    renderApp()

    const sheet = screen.getByRole('textbox') as HTMLTextAreaElement
    sheet.focus()
    await user.paste('An Academic Task 2 essay in progress.')
    expect(sheet.value).not.toBe('')

    await user.click(navLink('Reading'))
    await user.click(moduleButton('General'))
    await user.click(navLink('Write'))

    // Switching exam FROM the writing desk clears the sheet on purpose. Doing
    // it from the Reading section must not, because the learner is not looking
    // at the sheet and never agreed to lose it.
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'An Academic Task 2 essay in progress.',
    )
  })
})

/* --------------------------------- the runner ------------------------------- */

describe('sitting a Reading paper', () => {
  it('opens the passage, its questions and a sixty-minute clock', async () => {
    const user = userEvent.setup()
    renderApp()
    await startAcademicPaper(user)

    // The passage.
    expect(screen.getByText('The Salt Roads')).toBeInTheDocument()

    // The clock. Asserted as a RANGE, not as the literal 60:00: the countdown
    // is running while the test runs, and pinning the digit would make this
    // suite fail on a slow machine.
    const timer = screen.getByRole('timer')
    const [mm, ss] = (timer.textContent ?? '').split(':').map(Number)
    const left = mm * 60 + ss
    expect(left).toBeLessThanOrEqual(60 * 60)
    expect(left).toBeGreaterThan(59 * 60)

    // Passage 1's thirteen questions, and none from another passage.
    expect(screen.getByText(/^Questions 1–6$/)).toBeInTheDocument()
    expect(document.querySelectorAll('.rr-q')).toHaveLength(PASSAGE_1.length)
  })

  it('clears the desk: no navigation while the clock runs', async () => {
    const user = userEvent.setup()
    renderApp()
    await startAcademicPaper(user)

    expect(document.querySelector('.nav')).toBeNull()
    expect(screen.queryByRole('group', { name: 'IELTS exam type' })).not.toBeInTheDocument()
  })

  it('makes all six question types answerable', async () => {
    const user = userEvent.setup()
    renderApp()
    await startAcademicPaper(user)

    // Passage 1: matching headings, completion, true/false/not given.
    const heading = questionsOfType('matching-headings')[0]
    const gap = questionsOfType('completion')[0]
    const tfng = questionsOfType('true-false-notgiven')[0]
    await answerCorrectly(user, heading)
    await answerCorrectly(user, gap)
    await answerCorrectly(user, tfng)

    expect((document.getElementById(`rr-select-${heading.id}`) as HTMLSelectElement).value).toBe(
      heading.answers[0],
    )
    expect((document.getElementById(`rr-input-${gap.id}`) as HTMLInputElement).value).toBe(
      gap.answers[0],
    )
    expect(
      document.querySelector<HTMLInputElement>(`input[name="q-${tfng.id}"]:checked`)?.value,
    ).toBe(tfng.answers[0])

    // Passage 2: multiple choice.
    await user.click(passageTab('Reading Passage 2'))
    const mcq = questionsOfType('multiple-choice')[0]
    await answerCorrectly(user, mcq)
    expect(
      document.querySelector<HTMLInputElement>(`input[name="q-${mcq.id}"]:checked`)?.value,
    ).toBe(mcq.answers[0])

    // Passage 3: matching information, yes/no/not given.
    await user.click(passageTab('Reading Passage 3'))
    const info = questionsOfType('matching-information')[0]
    const ynng = questionsOfType('yes-no-notgiven')[0]
    await answerCorrectly(user, info)
    await answerCorrectly(user, ynng)
    expect((document.getElementById(`rr-select-${info.id}`) as HTMLSelectElement).value).toBe(
      info.answers[0],
    )
    expect(
      document.querySelector<HTMLInputElement>(`input[name="q-${ynng.id}"]:checked`)?.value,
    ).toBe(ynng.answers[0])

    // Answers survive moving between passages — the sheet is one sheet.
    await user.click(passageTab('Reading Passage 1'))
    expect((document.getElementById(`rr-input-${gap.id}`) as HTMLInputElement).value).toBe(
      gap.answers[0],
    )
  })

  it('prints the word limit on a completion question', async () => {
    const user = userEvent.setup()
    renderApp()
    await startAcademicPaper(user)

    // Passage 1's gaps allow two words. A learner who cannot see the limit can
    // lose a mark they had already earned.
    expect(screen.getAllByText('NO MORE THAN TWO WORDS').length).toBeGreaterThan(0)
  })

  it('warns when an answer goes over its word limit', async () => {
    const user = userEvent.setup()
    renderApp()
    await startAcademicPaper(user)

    const gap = questionsOfType('completion')[0]
    await answer(user, gap, 'far too many words here')

    expect(screen.getByText(/over the limit, this will be marked wrong/i)).toBeInTheDocument()
  })

  it('saves nothing when the attempt is abandoned', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderApp()
    await startAcademicPaper(user)

    await answerCorrectly(user, PASSAGE_1[0])
    await user.click(screen.getByRole('button', { name: 'Leave test' }))

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(confirmSpy.mock.calls[0][0]).toMatch(/will not be saved/i)
    // Back at the picker — one start button per Academic paper — with no
    // result in the history list.
    expect(screen.getAllByRole('button', { name: 'Start this paper' })).toHaveLength(2)
    expect(screen.queryByText(/Your Academic Reading results/i)).not.toBeInTheDocument()
  })
})

/* --------------------------------- the report ------------------------------- */

describe('the Reading report', () => {
  /**
   * Answer passage 1 correctly and submit. 13 of 40 correct is band 4.5 on the
   * Academic table — a number chosen because it exercises a real table row
   * rather than the floor.
   */
  async function sitPassageOne(user: User): Promise<void> {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await startAcademicPaper(user)
    for (const question of PASSAGE_1) await answerCorrectly(user, question)
    await user.click(screen.getByRole('button', { name: 'Submit answers' }))
    await screen.findByText(/This band is exact/i)
  }

  it('reports the raw score and the band from the module table', async () => {
    const user = userEvent.setup()
    renderApp()
    await sitPassageOne(user)

    // Scoped to the hero: 4.5 legitimately appears twice, once as the band and
    // once inside the table row that produced it.
    expect(document.querySelector('.rrp-band')?.textContent).toBe('4.5')
    expect(document.querySelector('.rrp-raw')?.textContent).toBe('13 / 40')
    // The published row is quoted, so the number is auditable rather than magic.
    expect(screen.getByText(/Academic table:/)).toBeInTheDocument()
    expect(screen.getByText('13–14')).toBeInTheDocument()
  })

  it('says plainly that the band is exact, not an estimate', async () => {
    const user = userEvent.setup()
    renderApp()
    await sitPassageOne(user)

    expect(screen.getByText('This band is exact, not an estimate.')).toBeInTheDocument()
    expect(screen.getByText(/form-only estimates/i)).toBeInTheDocument()
  })

  it('breaks accuracy down by question type, weakest first', async () => {
    const user = userEvent.setup()
    renderApp()
    await sitPassageOne(user)

    const list = document.querySelectorAll('.rrp-type-label')
    const order = Array.from(list).map((el) => el.textContent)
    // Everything unanswered scored zero; matching headings, the only set fully
    // answered, comes last. That ordering IS the coaching: the top of this list
    // is what to practise.
    expect(order[order.length - 1]).toBe('Matching headings')
    expect(order).toHaveLength(6)

    const scores = Array.from(document.querySelectorAll('.rrp-type-score')).map(
      (el) => el.textContent,
    )
    expect(scores).toContain('6/6')
    expect(scores).toContain('0/6')
  })

  it('shows every question against the key, and can hide the ones that were right', async () => {
    const user = userEvent.setup()
    renderApp()
    await sitPassageOne(user)

    expect(document.querySelectorAll('.rrp-answer')).toHaveLength(40)

    await user.click(screen.getByRole('button', { name: 'Wrong 27' }))
    expect(document.querySelectorAll('.rrp-answer')).toHaveLength(27)
    expect(document.querySelectorAll('.rrp-answer-right')).toHaveLength(0)
  })

  it('keeps the result in the Reading history and out of writing progress', async () => {
    const user = userEvent.setup()
    renderApp()
    await sitPassageOne(user)

    await user.click(screen.getByRole('button', { name: 'Another paper' }))
    expect(screen.getByText(/Your Academic Reading results/i)).toBeInTheDocument()
    expect(screen.getByText('13/40')).toBeInTheDocument()

    // A Reading paper produces no writing issues, so counting it in the error
    // profile would read as a flawless essay. The dashboard has never seen it.
    await user.click(navLink('Progress'))
    await waitFor(() =>
      expect(screen.getByText('Write your first essay and your profile starts here.')).toBeInTheDocument(),
    )
  })
})
