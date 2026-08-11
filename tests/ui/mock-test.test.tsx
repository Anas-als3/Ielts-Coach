/**
 * Plan 013: a full mock sitting — Listening, then Reading, then Writing
 * Task 2, sat back to back and reusing the ordinary runners, marking and
 * `saveSession` path throughout, never a forked copy of any of them. Four
 * guarantees, in the order they would hurt a learner if they broke:
 *
 * 1. **The real order.** Listening first, Reading second, Writing last —
 *    never any other order, and never a leg skipped.
 * 2. **Each leg is an ORDINARY session.** It saves through the same
 *    `saveSession` a solo sitting uses and shows up in that section's own
 *    history and in Progress — a mock does not invent a fourth store shape.
 * 3. **Exam discipline holds through all three legs.** No navigation while a
 *    leg is running, and leaving mid-mock always asks first — either the
 *    running leg's OWN guard, or, at the pause between legs, the mock's own.
 * 4. **The summary is honest.** Three bands, told apart as exact (Listening,
 *    Reading) or estimated (Writing), and an overall explicitly labelled a
 *    three-section estimate — never a fourth, invented Speaking number.
 *
 * Everything drives the real <App /> through `renderApp()`. Every runner in
 * this app confirms an unanswered-question submit through `window.confirm`,
 * so most tests stub it `true` for the whole flow; the "leaving mid-mock"
 * block stubs it more precisely where the decline path itself is the point.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'
import { ACADEMIC_TEST_01, ACADEMIC_TEST_02 } from '../../src/reading/tests'
import { LISTENING_TEST_01, LISTENING_TEST_02 } from '../../src/listening/tests'
import MockTest from '../../src/components/MockTest'
import type { MockAttempt } from '../../src/types'

type User = ReturnType<typeof userEvent.setup>

/* --------------------------------- helpers ---------------------------------- */

function navLink(name: string): HTMLElement {
  return within(document.querySelector('.nav') as HTMLElement).getByText(name)
}

async function openMockSetup(user: User): Promise<void> {
  await user.click(navLink('Mock test'))
  await screen.findByRole('heading', { name: 'Mock test', level: 1 })
}

/** Start the mock with whatever papers are already selected — the defaults,
 *  unless a test changed them — and wait for Listening to open. */
async function startMock(user: User): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Start the mock test' }))
  await screen.findByRole('tab', { name: /Section 1/ })
}

/** Submit whichever runner (Listening or Reading) is on screen, blank.
 *  `window.confirm` must already be stubbed to accept the "still blank"
 *  warning both runners raise on an unanswered submit. */
async function submitRunner(user: User): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Submit answers' }))
}

/** Continue from an interstitial to the section named. */
async function continueTo(user: User, label: string): Promise<void> {
  await user.click(screen.getByRole('button', { name: `Continue to ${label}` }))
}

async function sitListeningLeg(user: User): Promise<void> {
  await submitRunner(user)
  await screen.findByText(/Up next: Reading/)
}

async function sitReadingLeg(user: User): Promise<void> {
  await continueTo(user, 'Reading')
  await screen.findByRole('tab', { name: /Reading Passage 1/ })
  await submitRunner(user)
  await screen.findByText(/Up next: Writing/)
}

async function sitWritingLeg(user: User): Promise<void> {
  await continueTo(user, 'Writing (Task 2)')
  const sheet = (await screen.findByRole('textbox')) as HTMLTextAreaElement
  // `fireEvent.change`, not `user.paste` / `user.type`: exam mode blocks
  // paste (`blockPaste={inExam}` in App.tsx) exactly as the real exam
  // hall does, and `Editor`'s mirror overlay makes a full `user.type` slow
  // over real sentences. A direct value change is what the blank-expiry exam
  // tests in `draft-safety.test.tsx` already use for the same reason.
  fireEvent.change(sheet, {
    target: {
      value:
        'The chart shows a clear overall pattern across the period under review, rising steadily ' +
        'before levelling off towards the end — enough words for the mock summary to have a band ' +
        'to show, which is all this fixture needs to prove.',
    },
  })
  await user.click(screen.getByRole('button', { name: 'Submit' }))
  await screen.findByRole('heading', { name: 'Your mock result' })
}

/* ------------------------------ the entry point ------------------------------ */

describe('the Mock test entry point', () => {
  it('is reachable from the nav and defaults to the first paper of each', async () => {
    const user = userEvent.setup()
    renderApp()

    await openMockSetup(user)

    expect((screen.getByLabelText('Listening paper') as HTMLSelectElement).value).toBe(
      LISTENING_TEST_01.id,
    )
    expect((screen.getByLabelText(/Reading paper/) as HTMLSelectElement).value).toBe(
      ACADEMIC_TEST_01.id,
    )
  })

  it('lets the learner pick a different paper of each before starting', async () => {
    const user = userEvent.setup()
    renderApp()
    await openMockSetup(user)

    await user.selectOptions(screen.getByLabelText('Listening paper'), LISTENING_TEST_02.id)
    await user.selectOptions(screen.getByLabelText(/Reading paper/), ACADEMIC_TEST_02.id)

    expect((screen.getByLabelText('Listening paper') as HTMLSelectElement).value).toBe(
      LISTENING_TEST_02.id,
    )
    expect((screen.getByLabelText(/Reading paper/) as HTMLSelectElement).value).toBe(
      ACADEMIC_TEST_02.id,
    )
  })

  it('says plainly that a mock here is a three-section estimate, not a full IELTS overall', async () => {
    const user = userEvent.setup()
    renderApp()
    await openMockSetup(user)

    expect(screen.getByText(/three-section estimate/i)).toBeInTheDocument()
    expect(screen.getByText(/Speaking is not part of this app/i)).toBeInTheDocument()
  })
})

/* --------------------------------- the sitting -------------------------------- */

describe('sitting a full mock', () => {
  it('walks Listening, then Reading, then Writing, in that order and no other', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderApp()
    await openMockSetup(user)
    await startMock(user)

    // Listening first, clearing the desk exactly as the standalone section does.
    expect(document.querySelector('.nav')).toBeNull()
    await sitListeningLeg(user)

    // The interstitial names Reading next, never Writing — order is not
    // reachable out of sequence.
    expect(screen.getByText(/Up next: Reading/)).toBeInTheDocument()
    expect(screen.queryByText(/Up next: Writing/)).not.toBeInTheDocument()

    await sitReadingLeg(user)
    expect(document.querySelector('.nav')).toBeNull()
    expect(screen.getByText(/Up next: Writing/)).toBeInTheDocument()

    await sitWritingLeg(user)

    // The combined summary, not the ordinary single-essay report.
    expect(screen.getByRole('heading', { name: 'Your mock result' })).toBeInTheDocument()
    expect(screen.queryByText('Redraft this essay')).not.toBeInTheDocument()
  })

  it('clears the desk through the Writing leg too, and names it as the mock', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderApp()
    await openMockSetup(user)
    await startMock(user)
    await sitListeningLeg(user)
    await sitReadingLeg(user)
    await continueTo(user, 'Writing (Task 2)')
    await screen.findByRole('textbox')

    expect(document.querySelector('.nav')).toBeNull()
    expect(screen.getByRole('timer')).toBeInTheDocument()
    expect(screen.getByText(/Mock test · Task 2/)).toBeInTheDocument()
  })

  it('reports three bands, told apart as exact or estimated, and an honestly labelled overall', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderApp()
    await openMockSetup(user)
    await startMock(user)
    await sitListeningLeg(user)
    await sitReadingLeg(user)
    await sitWritingLeg(user)

    // Listening and Reading say "exact"; Writing never does.
    expect(screen.getAllByText('This band is exact, not an estimate.')).toHaveLength(2)
    expect(
      screen.getByText('Form-only estimate — your real band is likely this or lower.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Three-section estimate \(no Speaking\)/)).toBeInTheDocument()

    // An overall band, rounded to a half step, is on screen.
    const overallText = document.querySelector('.mck-overall')?.textContent ?? ''
    expect(overallText).toMatch(/^\d\.[05]$/)
  })

  it('saves each leg as an ordinary session, visible in its own section and in Progress', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderApp()
    await openMockSetup(user)
    await startMock(user)
    await sitListeningLeg(user)
    await sitReadingLeg(user)
    await sitWritingLeg(user)

    await user.click(navLink('Progress'))
    // Not the "write your first essay" empty state: a Reading, a Listening and
    // a Writing session have each already been saved, exactly as a solo
    // sitting of each would have saved one.
    await waitFor(() =>
      expect(
        screen.queryByText('Write your first essay and your profile starts here.'),
      ).not.toBeInTheDocument(),
    )

    await user.click(navLink('Reading'))
    expect(screen.getByText(/Your Academic Reading results/i)).toBeInTheDocument()

    await user.click(navLink('Listening'))
    expect(screen.getByText(/Your Listening results/i)).toBeInTheDocument()
  })
})

/* ----------------------------- leaving mid-mock ------------------------------- */

describe('leaving mid-mock', () => {
  it("asks through the running leg's OWN guard, and ends the mock if confirmed", async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderApp()
    await openMockSetup(user)
    await startMock(user)

    await user.click(screen.getByRole('button', { name: 'Leave test' }))

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringMatching(/will not be saved/i))
    // Back at the Listening picker (mock aborted), nav visible again.
    expect(document.querySelector('.nav')).not.toBeNull()

    // The mock itself is gone: reopening it lands on setup, not an interstitial.
    await user.click(navLink('Mock test'))
    await screen.findByRole('heading', { name: 'Mock test', level: 1 })
    expect(screen.getByRole('button', { name: 'Start the mock test' })).toBeInTheDocument()
  })

  it("declining the running leg's guard leaves the mock exactly where it was", async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    renderApp()
    await openMockSetup(user)
    await startMock(user)

    await user.click(screen.getByRole('button', { name: 'Leave test' }))

    expect(confirmSpy).toHaveBeenCalled()
    // Still sitting Listening: the desk is still clear and the tab is intact.
    expect(document.querySelector('.nav')).toBeNull()
    expect(screen.getByRole('tab', { name: /Section 1/ })).toBeInTheDocument()
  })

  it("asks through its OWN confirm at the interstitial, distinct from a running leg's", async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderApp()
    await openMockSetup(user)
    await startMock(user)
    await sitListeningLeg(user)

    await user.click(screen.getByRole('button', { name: 'Exit mock test' }))

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringMatching(/combined mock report/i))
    // Landed away from the mock; nav is back.
    expect(document.querySelector('.nav')).not.toBeNull()

    // Listening's own record is still saved even though the mock was abandoned.
    await user.click(navLink('Listening'))
    expect(screen.getByText(/Your Listening results/i)).toBeInTheDocument()

    // Reopening Mock test starts fresh rather than resuming.
    await user.click(navLink('Mock test'))
    expect(screen.getByRole('button', { name: 'Start the mock test' })).toBeInTheDocument()
  })

  it('declining the interstitial confirm keeps the mock at that pause screen', async () => {
    // Accept the Listening runner's own "still blank" submit-confirm (the
    // first call), then decline specifically the interstitial's exit
    // confirm (the next one) — two different questions, two different
    // answers, which `window.confirm` returning one fixed value cannot tell
    // apart on its own.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderApp()
    await openMockSetup(user)
    await startMock(user)
    await sitListeningLeg(user)

    confirmSpy.mockReturnValueOnce(false)
    await user.click(screen.getByRole('button', { name: 'Exit mock test' }))

    expect(confirmSpy).toHaveBeenCalled()
    expect(screen.getByText(/Up next: Reading/)).toBeInTheDocument()
  })

  it('abandons the mock when the Writing leg is left through the mode toggle, keeping the two finished legs', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderApp()
    await openMockSetup(user)
    await startMock(user)
    await sitListeningLeg(user)
    await sitReadingLeg(user)
    await continueTo(user, 'Writing (Task 2)')
    await screen.findByRole('textbox')

    await user.click(
      within(screen.getByRole('group', { name: 'Writing mode' })).getByRole('button', {
        name: 'Coach',
      }),
    )

    // Back on an ordinary coach-mode desk, nav visible — the mock is over.
    expect(document.querySelector('.nav')).not.toBeNull()
    await user.click(navLink('Mock test'))
    expect(screen.getByRole('button', { name: 'Start the mock test' })).toBeInTheDocument()

    // Listening and Reading are still saved; there is no orphaned Writing
    // session from the abandoned leg.
    await user.click(navLink('Listening'))
    expect(screen.getByText(/Your Listening results/i)).toBeInTheDocument()
  })

  /**
   * `abandonMockIfActive` is called from THREE guarded call sites in
   * `App.tsx` — `switchMode`, `switchTask` and `switchModule` — because all
   * three toggles stay reachable on the Writing desk during exam mode (the
   * same as a solo exam sitting). The mode toggle is covered above; these two
   * pin the other two so a mutant that dropped the call from just one of
   * them would still be caught.
   */
  it('abandons the mock when the Writing leg is left through the task toggle', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderApp()
    await openMockSetup(user)
    await startMock(user)
    await sitListeningLeg(user)
    await sitReadingLeg(user)
    await continueTo(user, 'Writing (Task 2)')
    await screen.findByRole('textbox')

    await user.click(
      within(screen.getByRole('group', { name: 'IELTS task' })).getByRole('button', {
        name: 'Task 1',
      }),
    )

    // Switching TASK stays inside exam mode (it resets the clock rather than
    // leaving exam mode outright, same as a solo sitting) — the idle
    // "Exam conditions" card for the new task proves the abandon ran and the
    // mock's Writing leg is over, before nav is even back on screen.
    expect(screen.getByRole('button', { name: 'Start the clock' })).toBeInTheDocument()

    // Leaving exam mode entirely brings the nav back, and reopening Mock
    // test proves the sitting itself is gone, not just this leg's clock: it
    // lands on a fresh setup screen rather than resuming an interstitial.
    await user.click(
      within(screen.getByRole('group', { name: 'Writing mode' })).getByRole('button', {
        name: 'Coach',
      }),
    )
    expect(document.querySelector('.nav')).not.toBeNull()
    await user.click(navLink('Mock test'))
    expect(screen.getByRole('button', { name: 'Start the mock test' })).toBeInTheDocument()
    await user.click(navLink('Reading'))
    expect(screen.getByText(/Your Academic Reading results/i)).toBeInTheDocument()
  })

  it('abandons the mock when the Writing leg is left through the exam-type toggle', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderApp()
    await openMockSetup(user)
    await startMock(user)
    await sitListeningLeg(user)
    await sitReadingLeg(user)
    await continueTo(user, 'Writing (Task 2)')
    await screen.findByRole('textbox')

    await user.click(
      within(screen.getByRole('group', { name: 'IELTS exam type' })).getByRole('button', {
        name: 'General',
      }),
    )

    // Switching the EXAM TYPE stays inside exam mode too — same reasoning as
    // the task toggle above.
    expect(screen.getByRole('button', { name: 'Start the clock' })).toBeInTheDocument()

    await user.click(
      within(screen.getByRole('group', { name: 'Writing mode' })).getByRole('button', {
        name: 'Coach',
      }),
    )
    expect(document.querySelector('.nav')).not.toBeNull()
    await user.click(navLink('Mock test'))
    expect(screen.getByRole('button', { name: 'Start the mock test' })).toBeInTheDocument()

    // The two finished legs are still saved — checked through Progress rather
    // than through Reading's own history list, since the exam-type switch
    // just moved to General and the mock's Reading paper was sat as Academic.
    // Progress still shows "no essays" here (Writing was the leg abandoned,
    // not one of the two that finished), so the Reading/Listening counter
    // line is the fact worth asserting, not the essay-specific empty state.
    await user.click(navLink('Progress'))
    await waitFor(() =>
      expect(screen.getByText(/1 Reading paper and 1 Listening paper/)).toBeInTheDocument(),
    )
  })
})

/* ---------------------- the incomplete-attempt guard, directly -------------------- */

/**
 * `App`'s own logic can never REACH `stage === 'summary'` with a gap in
 * `attempt` — `submitInner`'s mock branch sets `mockStage('summary')` in the
 * same call that fills `writingRecord`, the last of the three. That is
 * exactly why this guard is worth pinning at the COMPONENT boundary rather
 * than trusting the full-app flow to exercise it: the type of `attempt`
 * (`MockAttempt`, whose three record fields are each `| null`) allows the gap
 * structurally, and `MockTest` is the thing that has to refuse to compute a
 * confident overall from it regardless of how it got here. Rendered directly
 * — not through `renderApp()` — so a two-out-of-three attempt reaches the
 * component the way a future caller easily could, without needing App's own
 * orchestration to cooperate.
 */
describe('the incomplete-attempt guard, at the component boundary', () => {
  const partialAttempt: MockAttempt = {
    module: 'academic',
    listeningTestId: LISTENING_TEST_01.id,
    readingTestId: ACADEMIC_TEST_01.id,
    listeningRecord: null,
    readingRecord: null,
    writingRecord: null,
  }

  it('never shows a fabricated overall for a summary reached with a leg still missing', () => {
    render(
      <MockTest
        stage="summary"
        module="academic"
        readingTests={[]}
        listeningTests={[]}
        attempt={partialAttempt}
        nextSection="writing"
        onStart={() => {}}
        onContinue={() => {}}
        onExit={() => {}}
        onRestart={() => {}}
        onViewDashboard={() => {}}
      />,
    )

    expect(screen.getByText('This sitting is not complete')).toBeInTheDocument()
    // No band anywhere on this screen — a mutant that computed a mean over
    // whichever two of three records happen to be present would print one.
    expect(document.querySelector('.mck-overall')).toBeNull()
    expect(screen.queryByText(/Three-section estimate/)).not.toBeInTheDocument()
  })

  it('never shows a fabricated overall when `attempt` itself is null at summary', () => {
    render(
      <MockTest
        stage="summary"
        module="academic"
        readingTests={[]}
        listeningTests={[]}
        attempt={null}
        nextSection="writing"
        onStart={() => {}}
        onContinue={() => {}}
        onExit={() => {}}
        onRestart={() => {}}
        onViewDashboard={() => {}}
      />,
    )

    expect(screen.getByText('This sitting is not complete')).toBeInTheDocument()
    expect(document.querySelector('.mck-overall')).toBeNull()
  })
})
