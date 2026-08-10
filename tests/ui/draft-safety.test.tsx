/**
 * Draft safety (plan 025 / SPEC.md "profile/" — the draft subsection).
 *
 * Four defects, one promise: work in progress is either on disk, or the
 * learner explicitly consented to losing it.
 *
 *  - the essay is written to `ielts-coach.draft.v1`, debounced, and offered
 *    back on the next mount — never applied silently;
 *  - `beforeunload` warns exactly for the windows a draft cannot cover: a
 *    Reading/Listening paper mid-run, or the ≤400ms debounce window before a
 *    fresh keystroke reaches disk;
 *  - an expired exam draft restores its TEXT into coach mode with a notice
 *    and is never auto-submitted;
 *  - a running exam that reaches zero seconds on a BLANK sheet is returned to
 *    exam-idle rather than saved as a session nobody wrote.
 *
 * Everything drives the real <App /> through `renderApp()`, matching every
 * other UI suite in this repo.
 */
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'
import { DRAFT_KEY, type WritingDraft } from '../../src/profile/draft'

/* --------------------------------- helpers ---------------------------------- */

type User = ReturnType<typeof userEvent.setup>

function sheet(): HTMLTextAreaElement {
  return screen.getByRole('textbox') as HTMLTextAreaElement
}

async function type(user: User, text: string): Promise<void> {
  const box = sheet()
  box.focus()
  // paste, not keystrokes: 100+ words one key at a time is far too slow.
  await user.paste(text)
}

/** The analysis and the draft effect are both debounced 400ms; give them
 * time to catch up. */
async function settled(): Promise<void> {
  await new Promise((r) => setTimeout(r, 550))
}

function navLink(name: string): HTMLElement {
  return within(document.querySelector('.nav') as HTMLElement).getByText(name)
}

/** A submittable Task 2 essay: the section's 250-word minimum plus margin. */
const PADDING = Array.from({ length: 260 }, (_, i) => {
  const suffix = String(i)
    .split('')
    .map((d) => 'abcdefghij'[Number(d)])
    .join('')
  return `pad${suffix}`
}).join(' ')

/**
 * Writes a complete, correctly-typed draft directly to the draft key, as if
 * an earlier tab had left it there. `op-01` is `renderApp()`'s pinned prompt
 * (`EXACT_PROMPT`), so a Task 2 / Academic draft restores onto the SAME
 * question already on screen.
 */
function seedDraft(overrides: Partial<WritingDraft> = {}): WritingDraft {
  const draft: WritingDraft = {
    task: 'task2',
    module: 'academic',
    promptId: 'op-01',
    essayText: 'A draft essay written before the tab closed.',
    mode: 'coach',
    examDeadlineEpochMs: null,
    savedAtISO: '2026-08-10T12:00:00.000Z',
    ...overrides,
  }
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  return draft
}

function fireBeforeUnload(): boolean {
  const e = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(e)
  return e.defaultPrevented
}

/* ---------------------------------- tests ----------------------------------- */

describe('minting and clearing the draft', () => {
  it('typing mints a draft after the debounce', async () => {
    const user = userEvent.setup()
    renderApp()

    await type(user, 'An essay just starting to take shape.')

    await waitFor(() => {
      const raw = localStorage.getItem(DRAFT_KEY)
      expect(raw).not.toBeNull()
      const draft = JSON.parse(raw as string) as WritingDraft
      expect(draft.essayText).toBe(sheet().value)
    })
  })

  it('submitting clears the draft', async () => {
    const user = userEvent.setup()
    renderApp()

    await type(user, `${PADDING}.`)
    await settled()
    await user.click(screen.getByRole('button', { name: 'Finish & review' }))
    await screen.findByRole('button', { name: 'New essay' })

    expect(localStorage.getItem(DRAFT_KEY)).toBeNull()
  })
})

describe('offering a draft back', () => {
  it('is offered, never applied silently', async () => {
    const user = userEvent.setup()
    const draft = seedDraft()
    renderApp()

    expect(sheet().value).toBe('')
    expect(screen.getByRole('button', { name: 'Restore draft' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Restore draft' }))

    expect(sheet().value).toBe(draft.essayText)
    expect(screen.queryByRole('button', { name: 'Restore draft' })).not.toBeInTheDocument()
  })

  it('Discard removes the draft', async () => {
    const user = userEvent.setup()
    seedDraft()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Discard draft' }))

    expect(localStorage.getItem(DRAFT_KEY)).toBeNull()
    expect(sheet().value).toBe('')
    expect(screen.queryByRole('button', { name: 'Restore draft' })).not.toBeInTheDocument()
  })

  it('an unclaimed draft survives the debounce window', async () => {
    seedDraft()
    renderApp()

    // Past the 400ms debounce, with the offer still undecided.
    await new Promise((r) => setTimeout(r, 600))

    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Restore draft' })).toBeInTheDocument()
  })

  it('an expired exam draft restores to coach with a notice and never auto-submits', async () => {
    const user = userEvent.setup()
    const draft = seedDraft({
      mode: 'exam',
      examDeadlineEpochMs: Date.now() - 1000,
      essayText: 'An essay written before the clock ran out.',
    })
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Restore draft' }))

    expect(sheet().value).toBe(draft.essayText)
    // Coach mode: the "Submit" exam button is gone, "Finish & review" is back.
    expect(screen.getByRole('button', { name: 'Finish & review' })).toBeInTheDocument()
    const notice = screen.getByText(/clock ran out/i, { selector: 'p' })
    expect(notice.closest('[role="status"]')).not.toBeNull()
    // Nothing was submitted on the learner's behalf.
    expect(localStorage.getItem('ielts-coach.v1')).toBeNull()
  })

  it('a live exam draft resumes the clock from the absolute deadline', async () => {
    const user = userEvent.setup()
    seedDraft({
      mode: 'exam',
      examDeadlineEpochMs: Date.now() + 600_000,
      essayText: 'An essay written before the tab closed.',
    })
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Restore draft' }))

    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument()
    expect(screen.getByText(/^(09:5[0-9]|10:00)$/)).toBeInTheDocument()
  })
})

describe('the beforeunload guard', () => {
  it('warns only while the draft is stale', async () => {
    const user = userEvent.setup()
    renderApp()

    await type(user, 'Some brand new words on the sheet.')
    // Immediately — before the 400ms debounce has written anything to disk.
    expect(fireBeforeUnload()).toBe(true)

    await waitFor(() => {
      const raw = localStorage.getItem(DRAFT_KEY)
      expect(raw).not.toBeNull()
      expect((JSON.parse(raw as string) as WritingDraft).essayText).toBe(sheet().value)
    })
    // Once the draft is on disk, closing the tab loses nothing.
    expect(fireBeforeUnload()).toBe(false)
  })

  it('warns while a Reading paper is running', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(navLink('Reading'))
    // At the picker, nothing running yet — nothing to warn about.
    expect(fireBeforeUnload()).toBe(false)

    await user.click(screen.getAllByRole('button', { name: 'Start this paper' })[0])
    await screen.findByRole('tab', { name: /Reading Passage 1/ })

    expect(fireBeforeUnload()).toBe(true)
  })
})

describe('the blank-expiry guard', () => {
  // `userEvent` hangs under `vi.useFakeTimers()` in this stack (its internal
  // async waits never resolve even with `advanceTimers` wired up), so these
  // two cases drive the DOM through `fireEvent` instead — synchronous, and
  // exactly what a real click/keystroke does to the underlying element.
  it('returns a blank exam at zero seconds instead of marking it', async () => {
    vi.useFakeTimers()
    try {
      renderApp()

      fireEvent.click(screen.getByRole('button', { name: 'Exam' }))
      fireEvent.click(screen.getByRole('button', { name: 'Start the clock' }))

      await act(async () => {
        vi.advanceTimersByTime(40 * 60 * 1000)
      })

      expect(screen.getByRole('button', { name: 'Start the clock' })).toBeInTheDocument()
      const notice = screen.getByText(/blank answer sheet/i, { selector: 'p' })
      expect(notice.closest('[role="status"]')).not.toBeNull()
      expect(localStorage.getItem('ielts-coach.v1')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('still submits when the sheet has words at expiry', async () => {
    vi.useFakeTimers()
    try {
      renderApp()

      fireEvent.click(screen.getByRole('button', { name: 'Exam' }))
      fireEvent.click(screen.getByRole('button', { name: 'Start the clock' }))
      fireEvent.change(sheet(), { target: { value: `${PADDING}.` } })

      await act(async () => {
        vi.advanceTimersByTime(40 * 60 * 1000)
      })

      // Synchronous, not `findByRole`: `waitFor`'s own polling is a
      // `setTimeout` too, and it would need real time — or another fake
      // advance — to ever resolve. `advanceTimersByTime` inside `act` already
      // flushes every state update and effect the expiry triggers, so the
      // report is on screen by the time `act` returns.
      expect(screen.getByRole('button', { name: 'New essay' })).toBeInTheDocument()
      const raw = localStorage.getItem('ielts-coach.v1')
      expect(raw).not.toBeNull()
      const stored = JSON.parse(raw as string) as { sessions: unknown[] }
      expect(stored.sessions).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
