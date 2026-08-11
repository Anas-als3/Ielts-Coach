/**
 * Plan 017's S slice: Progress is a writing-only view, but two of its
 * controls act on the WHOLE session store, not the writing-only list it
 * renders.
 *
 * A learner who has sat Reading or Listening papers but written no essays
 * sees the Dashboard's empty state. That state offered "Restore from a
 * backup file" — which routes to `importData` and REPLACES the whole
 * store — but not "Export data", so the one page that can wipe a complete
 * Reading and Listening history would not let the learner copy it first.
 * The confirm made it worse: it counted `sessions.length`, the writing-only
 * list, so it read "(0 essays)" one click before destroying everything.
 *
 * Everything drives the real <App /> through `renderApp()` — see
 * `tests/ui/renderApp.tsx` for why an unseeded render is never used.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'

type User = ReturnType<typeof userEvent.setup>

function navLink(name: string): HTMLElement {
  return within(document.querySelector('.nav') as HTMLElement).getByText(name)
}

/**
 * The "Start this paper" button on one paper's card. Each module lists more
 * than one paper (see tests/ui/reading.test.tsx's `startButtonFor`), so the
 * button has to be found through its own card rather than by role alone.
 *
 * Async: the picker is rendered by the lazily-loaded `ReadingSection` (plan
 * 023), so the title lookup is the first query against section content.
 */
async function startButtonFor(title: string): Promise<HTMLElement> {
  const card = (await screen.findByText(title)).closest('.rdp-test') as HTMLElement
  return within(card).getByRole('button', { name: 'Start this paper' })
}

/**
 * Sit and submit the first Academic Reading paper, answering nothing. The
 * submit button has no answered-count gate — only a confirm for blank
 * answers, mocked true here — so an unanswered paper is a valid, saved
 * session; only the fact that ONE was saved matters to these tests.
 */
async function sitReadingPaper(user: User): Promise<void> {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  await user.click(navLink('Reading'))
  await user.click(await startButtonFor('Academic Reading Test 1'))
  await screen.findByRole('tab', { name: /Reading Passage 1/ })
  await user.click(screen.getByRole('button', { name: 'Submit answers' }))
  await screen.findByText(/This band is exact/i)
}

describe('Progress surfaces Export and counts every section, not only essays', () => {
  it('offers Export data in the empty state once a Reading paper is saved', async () => {
    const user = userEvent.setup()
    renderApp()
    await sitReadingPaper(user)

    await user.click(navLink('Progress'))

    // Fails today: Export exists only in the populated header (the non-empty
    // branch of Dashboard.tsx), which a learner with no essays never reaches.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Export data' })).toBeInTheDocument(),
    )
    // Still the writing record: no essay has been written, and the page still
    // says so — this slice does not touch that line.
    expect(
      screen.getByText('Write your first essay and your profile starts here.'),
    ).toBeInTheDocument()
  })

  it('counts every saved section in the import choice card, not the filtered essay list', async () => {
    // Plan 031 replaced the binary `window.confirm` with an inline three-way
    // Merge/Replace/Cancel card, but the truth-telling property this test
    // pins is unchanged: the copy must count every saved SECTION, not only
    // the writing-only `sessions` list Progress renders.
    const user = userEvent.setup()
    renderApp()
    await sitReadingPaper(user)

    await user.click(navLink('Progress'))
    await screen.findByText('Write your first essay and your profile starts here.')

    const file = new File(['{"schemaVersion":5,"sessions":[]}'], 'ielts-coach-data.json', {
      type: 'application/json',
    })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, file)

    const card = await screen.findByRole('region', { name: 'Import this file?' })
    const body = within(card).getByText(/Replace throws away your current history/)
    // Fails today: the message would read `sessions.length`, the
    // writing-only list, so it would say "(0 essays)" immediately before
    // replacing a complete Reading history.
    expect(body.textContent).toMatch(/Reading paper/)
    expect(body.textContent).not.toMatch(/0 essays/)

    // Cancel, so the import never actually runs — this test is about what
    // the card SAYS, not about a real replace happening.
    await user.click(within(card).getByRole('button', { name: 'Cancel' }))
  })
})
