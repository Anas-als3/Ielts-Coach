/**
 * The General Training letter flow, rendered (SPEC.md "General Training Task 1
 * (letters)").
 *
 * The engine-side guarantees live in `tests/letters.test.ts`. What this file
 * checks is the part a learner actually meets: that choosing General + Task 1
 * puts a LETTER on the desk rather than a chart, that the three bullet points
 * are visible (they are the task — a candidate who cannot see them cannot
 * answer them), that the rail asks for a greeting and a sign-off and never
 * shows a Conclusion group, and that switching back to Academic returns the
 * chart.
 *
 * Everything drives the real <App /> through `renderApp()`, which pins the
 * prompt draw. An unseeded render would draw a different letter each run and
 * reintroduce the flake plan 007 removed.
 */
import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { INFORMAL_LETTER_PROMPT, LETTER_PROMPT, renderApp } from './renderApp'

/* --------------------------------- helpers ---------------------------------- */

/** The analysis is debounced 400ms; give the rail time to catch up. */
async function settled(): Promise<void> {
  await new Promise((r) => setTimeout(r, 550))
}

function moduleButton(name: 'Academic' | 'General'): HTMLElement {
  return within(screen.getByRole('group', { name: 'IELTS exam type' })).getByRole('button', { name })
}

function taskButton(name: 'Task 1' | 'Task 2'): HTMLElement {
  return within(screen.getByRole('group', { name: 'IELTS task' })).getByRole('button', { name })
}

function sheet(): HTMLTextAreaElement {
  return screen.getByRole('textbox') as HTMLTextAreaElement
}

/** Open General Training Task 1 — the letter sheet. */
async function openLetters(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(moduleButton('General'))
  await user.click(taskButton('Task 1'))
}

async function type(user: ReturnType<typeof userEvent.setup>, text: string): Promise<void> {
  const box = sheet()
  box.focus()
  // paste, not keystrokes: 180 words one key at a time is far too slow.
  await user.paste(text)
  await settled()
}

/** A correct formal letter answering gt-01 — greeting and sign-off paired. */
const GOOD_LETTER = `Dear Sir or Madam,

I am writing to complain about a washing machine which I purchased from your Bridge Street branch on 4 March, and which was delivered to my flat the following week.

Although the appliance was sold as new, it stopped mid-cycle within nine days. The engineer who visited on 20 March explained that the pump was faulty and fitted a replacement part. Four days later the same fault returned, and water spread across my kitchen floor because the drum would not empty.

Since the machine has now broken twice in a single month, I would prefer a full refund rather than a third repair, although I would accept an identical model if your delivery team could bring one within a fortnight.

Yours faithfully,

Daniel Whitfield`

/** The same letter closed the wrong way for its greeting. */
const CLASHING_LETTER = GOOD_LETTER.replace('Yours faithfully', 'Yours sincerely')

/* ------------------------------ the letter sheet ----------------------------- */

describe('General Training Task 1 puts a letter on the desk', () => {
  it('shows the task, its three bullets, and somewhere to write', async () => {
    const user = userEvent.setup()
    renderApp()
    await openLetters(user)

    // The chart engine is nowhere near this sheet.
    expect(document.querySelectorAll('.chart')).toHaveLength(0)
    expect(sheet()).toBeInTheDocument()

    // The bullets ARE the task: all three must be covered to answer it.
    const bullets = Array.from(document.querySelectorAll('.gt-bullets li')).map(
      (li) => li.textContent,
    )
    expect(bullets).toEqual(LETTER_PROMPT.bullets)

    // The tone is stated, because it decides which greeting and sign-off are
    // correct — the learner cannot pick them without it.
    expect(screen.getByText(new RegExp(`${LETTER_PROMPT.tone} letter`, 'i'))).toBeInTheDocument()
    // Task 1 constants are unchanged between the exams: 150 words, 20 minutes.
    expect(screen.getByTitle('Minimum 150 words')).toBeInTheDocument()
  })

  it('lets the learner choose a different letter', async () => {
    const user = userEvent.setup()
    renderApp()
    await openLetters(user)

    const picker = screen.getByLabelText('Task 1 letter') as HTMLSelectElement
    expect(picker.value).toBe(LETTER_PROMPT.id)

    await user.selectOptions(picker, INFORMAL_LETTER_PROMPT.id)
    const bullets = Array.from(document.querySelectorAll('.gt-bullets li')).map(
      (li) => li.textContent,
    )
    expect(bullets).toEqual(INFORMAL_LETTER_PROMPT.bullets)
  })

  it('gives Academic Task 1 its chart back when the learner switches exam', async () => {
    const user = userEvent.setup()
    renderApp()
    await openLetters(user)
    expect(document.querySelectorAll('.chart')).toHaveLength(0)

    await user.click(moduleButton('Academic'))
    expect(document.querySelectorAll('.chart')).toHaveLength(1)
    // And the chart rail is back with it, asking for an overview rather than a
    // greeting.
    expect(screen.queryByText('Greeting')).not.toBeInTheDocument()
    expect(screen.getByText('Overview')).toBeInTheDocument()
  })
})

/* --------------------------------- the rail ---------------------------------- */

describe('the structure rail describes a letter', () => {
  it('asks for a greeting, a purpose, three bullets and a sign-off', async () => {
    const user = userEvent.setup()
    renderApp()
    await openLetters(user)

    for (const label of [
      'Greeting',
      'Purpose stated',
      'Bullet 1 covered',
      'Bullet 2 covered',
      'Bullet 3 covered',
      'Sign-off',
    ]) {
      expect(screen.getByText(label), label).toBeInTheDocument()
    }
  })

  it('shows no Conclusion group, because a sign-off is not a conclusion', async () => {
    const user = userEvent.setup()
    renderApp()
    await openLetters(user)
    await type(user, GOOD_LETTER)

    const rail = document.querySelector('.rail-root') as HTMLElement
    const headings = Array.from(rail.querySelectorAll('.rail-group-label-text')).map(
      (el) => el.textContent,
    )
    expect(headings).toContain('Introduction')
    expect(headings).toContain('Body paragraphs')
    expect(headings).not.toContain('Conclusion')
  })

  it('fills the greeting and sign-off nodes once a correct letter is written', async () => {
    const user = userEvent.setup()
    renderApp()
    await openLetters(user)
    await type(user, GOOD_LETTER)

    const rail = document.querySelector('.rail-root') as HTMLElement
    const nodeFor = (label: string): HTMLElement =>
      within(rail).getByText(label).closest('.rail-node') as HTMLElement

    expect(nodeFor('Greeting')).toHaveClass('rail-done')
    expect(nodeFor('Sign-off')).toHaveClass('rail-done')
    expect(nodeFor('Bullet 3 covered')).toHaveClass('rail-done')
  })
})

/* ------------------------------ the pairing check ---------------------------- */

describe('the greeting and sign-off pairing reaches the learner', () => {
  it('says so in the feedback panel when the two clash', async () => {
    const user = userEvent.setup()
    renderApp()
    await openLetters(user)
    await type(user, CLASHING_LETTER)

    const panel = document.querySelector('.panel-zone') as HTMLElement
    expect(within(panel).getByText('Greeting and sign-off clash')).toBeInTheDocument()
    // The fix is named, not merely the fault.
    expect(within(panel).getByText(/Yours faithfully/)).toBeInTheDocument()

    const rail = document.querySelector('.rail-root') as HTMLElement
    expect(within(rail).getByText('Sign-off').closest('.rail-node')).not.toHaveClass('rail-done')
  })

  it('says nothing when the two match', async () => {
    const user = userEvent.setup()
    renderApp()
    await openLetters(user)
    await type(user, GOOD_LETTER)

    const panel = document.querySelector('.panel-zone') as HTMLElement
    expect(within(panel).queryByText('Greeting and sign-off clash')).not.toBeInTheDocument()
  })
})

/* ------------------------------- the model answer ---------------------------- */

describe('the worked letter', () => {
  it('is offered for the letter on screen, with the band the app gives it', async () => {
    const user = userEvent.setup()
    renderApp()
    await openLetters(user)
    await user.click(screen.getByRole('tab', { name: 'Model answer' }))

    expect(screen.getByText('A worked answer')).toBeInTheDocument()
    // Scoped to the band element: a criterion tile can carry the same number.
    const band = Number(document.querySelector('.ma-band')?.textContent)
    expect(band).toBeGreaterThanOrEqual(8)
  })
})

/* ---------------------------------- the report -------------------------------- */

describe('the report for a letter', () => {
  it('names Task Achievement, omits the position check, and records the exam', async () => {
    const user = userEvent.setup()
    renderApp()
    await openLetters(user)
    await type(user, GOOD_LETTER)

    await user.click(screen.getByRole('button', { name: 'Finish & review' }))

    expect(screen.getAllByText('Task Achievement').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Position check/i)).not.toBeInTheDocument()
    expect(screen.getByText('Sign-off')).toBeInTheDocument()
  })
})
