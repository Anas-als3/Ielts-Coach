/**
 * The worked-answer panel, rendered.
 *
 * The engine-side guarantees live in `tests/model-answers.test.ts`. What this
 * file checks is the part a learner actually meets: that the tab exists in
 * coach mode, disappears under exam conditions, shows the right example for the
 * task on screen, and is honest when the example answers a different question.
 */
import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../src/App'
import { TASK1_PROMPTS } from '../../src/prompts/task1Bank'

function taskButton(name: 'Task 1' | 'Task 2'): HTMLElement {
  return within(screen.getByRole('group', { name: 'IELTS task' })).getByRole('button', { name })
}

function modeButton(name: 'Coach' | 'Exam'): HTMLElement {
  return within(screen.getByRole('group', { name: 'Writing mode' })).getByRole('button', { name })
}

async function openModelTab(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('tab', { name: 'Model answer' }))
}

describe('the model answer tab', () => {
  it('is offered in coach mode for both tasks', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('tab', { name: 'Model answer' })).toBeInTheDocument()

    await user.click(taskButton('Task 1'))
    expect(screen.getByRole('tab', { name: 'Model answer' })).toBeInTheDocument()
  })

  it('is not reachable under exam conditions', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(modeButton('Exam'))
    // Handing over a finished answer mid-exam would defeat the exercise.
    expect(screen.queryByRole('tab', { name: 'Model answer' })).not.toBeInTheDocument()
  })

  it('shows a Task 2 answer with the band the app itself gives it', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openModelTab(user)

    expect(screen.getByText('A worked answer')).toBeInTheDocument()
    // The panel renders a curly apostrophe, so match around it.
    expect(screen.getByText(/scored by this app.s own engine/i)).toBeInTheDocument()
    // Every stored answer is pinned at 8.0+ by tests/model-answers.test.ts.
    expect(screen.getByText('8.0')).toBeInTheDocument()
  })

  it('quotes real figures from the chart the learner is looking at', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(taskButton('Task 1'))
    await user.selectOptions(screen.getByLabelText('Task 1 question'), 't1-01')
    await openModelTab(user)

    const chart = TASK1_PROMPTS.find((p) => p.id === 't1-01')!.chart
    const highest = Math.max(
      ...chart.series.flatMap((s) => s.values.filter((v): v is number => typeof v === 'number')),
    )
    await waitFor(() =>
      expect(screen.getByText(new RegExp(String(highest)))).toBeInTheDocument(),
    )
  })

  it('regenerates when the learner picks a different chart', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(taskButton('Task 1'))
    await user.selectOptions(screen.getByLabelText('Task 1 question'), 't1-01')
    await openModelTab(user)
    const first = document.querySelector('.ma-text')?.textContent ?? ''

    await user.click(screen.getByRole('tab', { name: 'Feedback' }))
    await user.selectOptions(screen.getByLabelText('Task 1 question'), 't1-08')
    await openModelTab(user)
    const second = document.querySelector('.ma-text')?.textContent ?? ''

    expect(first).not.toBe('')
    expect(second).not.toBe(first)
  })

  it('warns against reusing the wording', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openModelTab(user)
    expect(screen.getByText(/Read it for the method, not the wording/i)).toBeInTheDocument()
  })

  it('says so when the example answers a different question of the same type', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openModelTab(user)

    // The app opens on a random Task 2 prompt. Only op-01 has an exact answer,
    // so the notice must appear for every other opinion prompt and never when
    // the match is exact.
    const notice = screen.queryByText(/answers a different question of the same type/i)
    const isExactPrompt = document.body.textContent?.includes('university education should be free')
    if (isExactPrompt) expect(notice).toBeNull()
    else expect(notice).toBeInTheDocument()
  })

  it('drops the cheat sheet tab but keeps the model tab in Task 1', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('tab', { name: 'Cheat sheet' }))
    await user.click(taskButton('Task 1'))

    expect(screen.queryByRole('tab', { name: 'Cheat sheet' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Model answer' })).toBeInTheDocument()
    // Switching away from a tab that no longer exists must not blank the panel.
    expect(screen.getByRole('tab', { name: 'Feedback' })).toHaveAttribute('aria-selected', 'true')
  })
})
