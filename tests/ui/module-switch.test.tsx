/**
 * Academic / General Training switching, rendered (SPEC.md "Modules").
 *
 * IELTS is two exams sharing a name. The point of these cases is that the app
 * never confuses them: switching exam type clears the desk, General Training
 * Task 1 opens the LETTER sheet rather than the chart, and every saved session
 * records which exam it was written for.
 *
 * Everything drives the real <App /> through `renderApp()`, which pins the
 * prompt draw — an unseeded render reintroduces the flake plan 007 removed.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'

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

function modeButton(name: 'Coach' | 'Exam'): HTMLElement {
  return within(screen.getByRole('group', { name: 'Writing mode' })).getByRole('button', { name })
}

function sheet(): HTMLTextAreaElement {
  return screen.getByRole('textbox') as HTMLTextAreaElement
}

async function type(user: ReturnType<typeof userEvent.setup>, text: string): Promise<void> {
  const box = sheet()
  box.focus()
  // paste, not keystrokes: 250+ words one key at a time is far too slow.
  await user.paste(text)
  await settled()
}

const PADDING = Array.from({ length: 260 }, (_, i) => {
  const suffix = String(i)
    .split('')
    .map((d) => 'abcdefghij'[Number(d)])
    .join('')
  return `pad${suffix}`
}).join(' ')

/* ---------------------------------- tests ----------------------------------- */

describe('the app opens on Academic', () => {
  it('marks Academic active and offers General beside it', () => {
    renderApp()
    expect(moduleButton('Academic')).toHaveClass('active')
    expect(moduleButton('General')).not.toHaveClass('active')
    // Never disabled: a learner is entitled to see what their exam contains.
    expect(moduleButton('General')).toBeEnabled()
  })
})

describe('switching to General Training', () => {
  it('clears the answer sheet', async () => {
    const user = userEvent.setup()
    renderApp()

    await type(user, 'An Academic Task 2 essay in progress.')
    expect(sheet().value).not.toBe('')

    await user.click(moduleButton('General'))

    expect(moduleButton('General')).toHaveClass('active')
    expect(moduleButton('Academic')).not.toHaveClass('active')
    expect(sheet().value).toBe('')
  })

  it('keeps Task 2 fully usable, because it is marked identically in both', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(moduleButton('General'))

    expect(taskButton('Task 2')).toHaveClass('active')
    expect(sheet()).toBeInTheDocument()
    expect(document.querySelector('.rail-zone')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Finish & review' })).toBeInTheDocument()
    // Still 250 words and 40 minutes — Task 2 does not change between exams.
    expect(screen.getByTitle('Minimum 250 words')).toBeInTheDocument()
  })
})

describe('General Training Task 1', () => {
  it('opens the letter sheet instead of marking a letter against chart rules', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(moduleButton('General'))
    await user.click(taskButton('Task 1'))

    // The guarantee this case has always protected: the Academic chart engine
    // must never mark a letter, because it would produce a confident band from
    // rules meant for another task. Until plan 009 that was kept by showing a
    // "letters are not ready yet" card; now it is kept by running the LETTER
    // engine instead, so the assertion moved from the placeholder to its
    // successor while the guarantee did not change.
    expect(document.querySelectorAll('.chart')).toHaveLength(0)
    expect(screen.queryByText(/overview/i)).not.toBeInTheDocument()

    // What is on screen is the letter sheet: a letter picker, the task's three
    // bullet points, a rail asking for a greeting, and somewhere to write.
    expect(sheet()).toBeInTheDocument()
    expect(screen.getByLabelText('Task 1 letter')).toBeInTheDocument()
    expect(screen.getByText('Greeting')).toBeInTheDocument()
    expect(document.querySelectorAll('.gt-bullets li')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Finish & review' })).toBeInTheDocument()
  })

  it('gives Academic Task 1 back its chart when the learner switches back', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(taskButton('Task 1'))
    expect(document.querySelectorAll('.chart')).toHaveLength(1)

    await user.click(moduleButton('General'))
    expect(document.querySelectorAll('.chart')).toHaveLength(0)

    await user.click(moduleButton('Academic'))
    expect(document.querySelectorAll('.chart')).toHaveLength(1)
  })
})

describe('switching exam type mid-exam', () => {
  it('asks before abandoning a running attempt, and obeys a refusal', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderApp()

    await user.click(modeButton('Exam'))
    await user.click(screen.getByRole('button', { name: 'Start the clock' }))
    await waitFor(() => expect(screen.getByText('40:00')).toBeInTheDocument())

    await user.click(moduleButton('General'))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(confirmSpy.mock.calls[0][0]).toMatch(/exam clock is running/i)
    // Refused: the attempt stands and the exam type has not moved.
    expect(moduleButton('Academic')).toHaveClass('active')

    confirmSpy.mockReturnValue(true)
    await user.click(moduleButton('General'))
    expect(moduleButton('General')).toHaveClass('active')
  })
})

describe('the progress table', () => {
  it('records which exam each session was written for', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(moduleButton('General'))
    await type(user, `I firmly believe this. ${PADDING}.`)

    await user.click(screen.getByRole('button', { name: 'Finish & review' }))
    await waitFor(() => expect(screen.getAllByText('Task Response').length).toBeGreaterThan(0))

    await user.click(within(document.querySelector('.nav') as HTMLElement).getByText('Progress'))

    const table = await screen.findByRole('table')
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent?.trim())
    expect(headers).toContain('Exam')

    const firstRow = within(table).getAllByRole('row')[1]
    expect(within(firstRow).getByText('General')).toBeInTheDocument()
  })
})
