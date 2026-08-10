/**
 * The Task 1 study sheets, rendered (plan 030 Phase B, SPEC.md "Task 1 study
 * sheets").
 *
 * Every task now has a one-page sheet under the (unchanged) 'Cheat sheet'
 * tab: Task 2 keeps the original cheat sheet, Academic Task 1 gets the chart
 * sheet, and General Training Task 1 gets the letter sheet. What this file
 * checks is the part a learner actually meets: the right sheet is on screen
 * for the module/task combination, its pinned content renders, and the sheet
 * swaps correctly when the learner changes module or task.
 *
 * Drives the real <App /> through `renderApp()`, which pins the prompt draw.
 */
import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'

function moduleButton(name: 'Academic' | 'General'): HTMLElement {
  return within(screen.getByRole('group', { name: 'IELTS exam type' })).getByRole('button', {
    name,
  })
}

function taskButton(name: 'Task 1' | 'Task 2'): HTMLElement {
  return within(screen.getByRole('group', { name: 'IELTS task' })).getByRole('button', { name })
}

async function openSheet(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('tab', { name: 'Cheat sheet' }))
}

describe('the Task 1 study sheets', () => {
  it('leaves the Task 2 sheet unchanged', async () => {
    const user = userEvent.setup()
    renderApp()
    await openSheet(user)

    expect(screen.getByText('IELTS Task 2 — One Page')).toBeInTheDocument()
  })

  it('shows the chart sheet for Academic Task 1', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(taskButton('Task 1'))
    await openSheet(user)

    expect(
      screen.getByText(/A percentage can fall while the number behind it rises/),
    ).toBeInTheDocument()
  })

  it('shows the letter sheet for General Training Task 1', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(moduleButton('General'))
    await user.click(taskButton('Task 1'))
    await openSheet(user)

    // Flexible matcher: the pinned sentence carries a straight apostrophe.
    expect(
      screen.getByText(/goes only to a reader you did not name/),
    ).toBeInTheDocument()
    expect(screen.getByText(/caps Task Achievement at 5\.5/)).toBeInTheDocument()
  })

  it('swaps the sheet with the module', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(moduleButton('General'))
    await user.click(taskButton('Task 1'))
    await openSheet(user)
    expect(screen.getByText('IELTS Letters — One Page')).toBeInTheDocument()

    await user.click(moduleButton('Academic'))

    expect(screen.getByText('IELTS Task 1 — Charts, One Page')).toBeInTheDocument()
    expect(screen.queryByText('IELTS Letters — One Page')).not.toBeInTheDocument()
  })
})
