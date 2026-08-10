/**
 * Task 1 / Task 2 switching, rendered (SPEC.md "Task 1 (v2) → UI").
 *
 * This is the checklist that used to be run by hand in a browser against a live
 * dev server. Ten manual steps do not survive a third task, so they live here
 * instead: same assertions, no server, and they fail in CI rather than in
 * somebody's memory.
 *
 * Everything drives the real <App />, so a regression anywhere between the
 * engine and the rendered rail surfaces.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FALLBACK_PROMPT, LINE_CHART_PROMPT, renderApp } from './renderApp'
import { TASK1_PROMPTS } from '../../src/prompts/task1Bank'

/* --------------------------------- helpers ---------------------------------- */

/** The analysis is debounced 400ms; give the rail time to catch up. */
async function settled(): Promise<void> {
  await new Promise((r) => setTimeout(r, 550))
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

/** A rail node by its check label, or undefined when that check is absent. */
function railNode(label: string): HTMLElement | undefined {
  return screen
    .queryAllByRole('listitem')
    .find((li) => li.querySelector('.rail-node-label')?.textContent === label)
}

function isSatisfied(node: HTMLElement | undefined): boolean {
  return node?.className.includes('rail-done') ?? false
}

async function type(user: ReturnType<typeof userEvent.setup>, text: string): Promise<void> {
  const box = sheet()
  box.focus()
  // paste, not keystrokes: 150+ words one key at a time is far too slow.
  await user.paste(text)
  await settled()
}

/** A line-graph prompt, so figure checking has numbers to work with. */
const LINE_PROMPT = TASK1_PROMPTS.find((p) => p.id === 't1-01')!

const PADDING = Array.from({ length: 130 }, (_, i) => {
  const suffix = String(i)
    .split('')
    .map((d) => 'abcdefghij'[Number(d)])
    .join('')
  return `pad${suffix}`
}).join(' ')

/* ---------------------------------- tests ----------------------------------- */

describe('the app opens on Task 2', () => {
  it('marks Task 2 active and keeps the 250-word target', () => {
    renderApp()
    expect(taskButton('Task 2')).toHaveClass('active')
    expect(taskButton('Task 1')).not.toHaveClass('active')
    expect(screen.getByTitle('Minimum 250 words')).toBeInTheDocument()
  })

  it('shows the Task 2 cheat sheet tab', () => {
    renderApp()
    expect(screen.getByRole('tab', { name: 'Cheat sheet' })).toBeInTheDocument()
  })
})

describe('switching to Task 1', () => {
  it('renders the chart, retargets the word count and clears the sheet', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderApp()

    await type(user, 'A Task 2 essay in progress.')
    expect(sheet().value).not.toBe('')

    await user.click(taskButton('Task 1'))

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(confirmSpy.mock.calls[0][0]).toMatch(/clears the answer sheet/i)
    expect(screen.getByTitle('Minimum 150 words')).toBeInTheDocument()
    expect(document.querySelectorAll('.chart')).toHaveLength(1)
    // A Task 2 essay scored by Task 1 rules would produce confident nonsense.
    expect(sheet().value).toBe('')
  })

  it('refuses to clear a coach-mode draft without consent', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderApp()

    await type(user, 'A Task 2 essay in progress.')
    await user.click(taskButton('Task 1'))

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    // Refused: the sheet keeps its text and the toggle has not moved.
    expect(sheet().value).toBe('A Task 2 essay in progress.')
    expect(taskButton('Task 2')).toHaveClass('active')
    expect(taskButton('Task 1')).not.toHaveClass('active')
  })

  it('switching with an empty sheet asks nothing', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderApp()

    await user.click(taskButton('Task 1'))

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(taskButton('Task 1')).toHaveClass('active')
  })

  it('swaps the sheet to the chart one in Task 1', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(taskButton('Task 1'))
    expect(screen.getByRole('tab', { name: 'Cheat sheet' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Cheat sheet' }))
    expect(screen.getByText('IELTS Task 1 — Charts, One Page')).toBeInTheDocument()
    expect(screen.queryByText('IELTS Task 2 — One Page')).not.toBeInTheDocument()
  })

  it('shows no Conclusion group, because Task 1 has no conclusion', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(taskButton('Task 1'))
    await settled()

    const groups = Array.from(document.querySelectorAll('.rail-group-label-text')).map(
      (el) => el.textContent,
    )
    expect(groups).toContain('Introduction')
    expect(groups).not.toContain('Conclusion')
  })
})

describe('the overview check', () => {
  it('stays hollow without an overview and fills once one is written', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(taskButton('Task 1'))

    await type(user, `${PADDING}.`)
    expect(isSatisfied(railNode('Overview'))).toBe(false)

    await user.clear(sheet())
    await type(user, `${PADDING}. Overall, both figures rose.`)
    await waitFor(() => expect(isSatisfied(railNode('Overview'))).toBe(true))
  })
})

describe('factual checking against the chart', () => {
  it('flags a figure the chart does not contain, and leaves a real one alone', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(taskButton('Task 1'))

    // Pin a data chart: the bank opens on a random prompt and the process
    // diagram has no numbers to check, by design.
    await user.selectOptions(screen.getByLabelText('Task 1 question'), LINE_PROMPT.id)
    await settled()

    await type(user, 'The figure reached 99999 per cent by the end of the period.')
    await waitFor(() => expect(screen.getByText(/no value of 99999/i)).toBeInTheDocument())

    await user.clear(sheet())
    await type(user, 'In Japan the figure reached 91 per cent by the end of the period.')
    await waitFor(() => expect(screen.queryByText(/no value of/i)).not.toBeInTheDocument())
  })
})

describe('exam mode', () => {
  it('keeps the chart visible, because the chart is the question', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(taskButton('Task 1'))
    await user.click(modeButton('Exam'))

    expect(document.querySelectorAll('.chart')).toHaveLength(1)
    expect(document.querySelector('.panel-zone')).toBeNull()
  })

  it('offers 20 minutes for Task 1 and 40 for Task 2', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(modeButton('Exam'))
    expect(screen.getByText(/40 minutes, no feedback/)).toBeInTheDocument()

    await user.click(taskButton('Task 1'))
    expect(screen.getByText(/20 minutes, no feedback/)).toBeInTheDocument()
  })

  it('starts the Task 1 clock at 20:00', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(taskButton('Task 1'))
    await user.click(modeButton('Exam'))
    await user.click(screen.getByRole('button', { name: 'Start the clock' }))

    await waitFor(() => expect(screen.getByText('20:00')).toBeInTheDocument())
  })
})

describe('the report', () => {
  it('names Task Achievement and omits the position check', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(taskButton('Task 1'))
    await type(user, `The chart shows information. Overall, values rose. ${PADDING}.`)

    await user.click(screen.getByRole('button', { name: 'Finish & review' }))
    // The criterion name appears in both the tile and the notes list.
    await waitFor(() => expect(screen.getAllByText('Task Achievement').length).toBeGreaterThan(0))

    expect(screen.queryAllByText('Task Response')).toHaveLength(0)
    expect(screen.queryByLabelText('Position check')).not.toBeInTheDocument()
  })

  it('names Task Response for a Task 2 essay', async () => {
    const user = userEvent.setup()
    renderApp()
    await type(user, `I firmly believe this. ${PADDING}.`)

    await user.click(screen.getByRole('button', { name: 'Finish & review' }))
    await waitFor(() => expect(screen.getAllByText('Task Response').length).toBeGreaterThan(0))
    expect(screen.queryAllByText('Task Achievement')).toHaveLength(0)
  })
})

describe('the progress table', () => {
  it('records which task each session answered', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(taskButton('Task 1'))
    await type(user, `The chart shows information. Overall, values rose. ${PADDING}.`)
    await user.click(screen.getByRole('button', { name: 'Finish & review' }))
    await waitFor(() => expect(screen.getAllByText('Task Achievement').length).toBeGreaterThan(0))

    await user.click(within(document.querySelector('.nav') as HTMLElement).getByText('Progress'))

    const table = await screen.findByRole('table')
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent?.trim())
    expect(headers).toContain('Task')

    const firstRow = within(table).getAllByRole('row')[1]
    expect(within(firstRow).getByText('Task 1')).toBeInTheDocument()
  })
})
