/**
 * The first-run intro card (SPEC.md "Preferences … & first-run intro"): the
 * three ideas a new learner must hold — the module toggle picks the exam,
 * Coach vs Exam, and the estimates are honest form-only numbers — stated once,
 * dismissible, and never confusable with anything a learner could lose by
 * missing it.
 *
 * Drives the real `<App />` through `renderApp()`, per every UI test's
 * convention. The card's placement inside the coach `aside` is structural
 * (only renders in coach mode, only on the write view), so cases 4 and 5 pin
 * that structure rather than trust a comment.
 */
import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'

const PREFS_KEY = 'ielts-coach.prefs.v1'

function modeButton(name: 'Coach' | 'Exam'): HTMLElement {
  return within(screen.getByRole('group', { name: 'Writing mode' })).getByRole('button', { name })
}

function introCard(): HTMLElement | null {
  return screen.queryByRole('region', { name: 'How IELTS Coach works' })
}

describe('the first-run intro card', () => {
  it('shows on first run', () => {
    renderApp()

    expect(introCard()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument()
  })

  it('dismissal persists across a remount', async () => {
    const user = userEvent.setup()
    const { unmount } = renderApp()

    await user.click(screen.getByRole('button', { name: 'Got it' }))
    expect(introCard()).not.toBeInTheDocument()

    const stored = JSON.parse(localStorage.getItem(PREFS_KEY)!) as { introDismissedAtISO: string }
    expect(typeof stored.introDismissedAtISO).toBe('string')

    // setup.ts clears storage BETWEEN tests, so the remount has to happen
    // inside this same `it` to prove persistence rather than a clean slate.
    unmount()
    renderApp()
    expect(introCard()).not.toBeInTheDocument()
  })

  it('a seeded dismissal hides the card from the first render', () => {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ introDismissedAtISO: '2026-08-10T00:00:00.000Z' }),
    )

    renderApp()

    expect(introCard()).not.toBeInTheDocument()
  })

  it('is never shown in exam mode, and returns in coach mode', async () => {
    const user = userEvent.setup()
    renderApp()
    expect(introCard()).toBeInTheDocument()

    // The clock is idle, so switchMode's confirm() never fires.
    await user.click(modeButton('Exam'))
    expect(introCard()).not.toBeInTheDocument()

    await user.click(modeButton('Coach'))
    expect(introCard()).toBeInTheDocument()
  })

  it('is never shown off the write view', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Progress' }))
    expect(introCard()).not.toBeInTheDocument()
  })

  it('a malformed prefs blob is discarded, not crashed on', () => {
    localStorage.setItem(PREFS_KEY, '{not json')

    expect(() => renderApp()).not.toThrow()
    expect(introCard()).toBeInTheDocument()
  })

  it('the mode toggle explains itself', () => {
    renderApp()

    expect(modeButton('Coach')).toHaveAttribute(
      'title',
      'Live feedback as you write: highlights, structure rail, band estimate.',
    )
    expect(modeButton('Exam')).toHaveAttribute(
      'title',
      'The real thing: a countdown, no feedback, paste blocked. Full report at submit.',
    )
  })
})
