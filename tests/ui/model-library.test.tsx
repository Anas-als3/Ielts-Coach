/**
 * The model-answer library, rendered.
 *
 * The engine-side guarantees live in `tests/model-answers.test.ts`, and the
 * coach-panel tab's own behaviour is `model-answer.test.tsx`'s business. What
 * this file checks is the part unique to the library: that every prompt in
 * all three banks is listed, that the exact/fallback badges match the SAME
 * rule the coach panel uses (never a re-implementation), that opening an
 * entry renders the real `ModelAnswer` component (scorecard and
 * memorisation warning included), that "Practise this prompt" lands the
 * chosen question on a blank desk (asking the same consent
 * `switchTask`/`switchModule` ask before it discards one in progress — see
 * `module-switch.test.tsx` for the sibling pattern this mirrors), and that
 * the library is unreachable under exam conditions like the rest of the nav.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EXACT_PROMPT, FALLBACK_PROMPT, renderApp } from './renderApp'
import { PROMPTS } from '../../src/prompts/bank'
import { LETTER_PROMPTS } from '../../src/prompts/letterBank'
import { TASK1_PROMPTS } from '../../src/prompts/task1Bank'

function modeButton(name: 'Coach' | 'Exam'): HTMLElement {
  return within(screen.getByRole('group', { name: 'Writing mode' })).getByRole('button', { name })
}

function sheet(): HTMLTextAreaElement {
  return screen.getByRole('textbox') as HTMLTextAreaElement
}

async function openLibrary(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Models' }))
}

/**
 * The group's `<section>`, found via its heading rather than the
 * section-to-"region" ARIA mapping — not every query stack computes that
 * mapping the same way, and the heading is unambiguous either way.
 */
function groupSection(heading: string): HTMLElement {
  const section = screen.getByRole('heading', { name: heading, level: 3 }).closest('section')
  if (!section) throw new Error(`No <section> ancestor for heading "${heading}"`)
  return section as HTMLElement
}

/** Opens the one entry whose id is `id` — every bank's ids are unique across the library. */
async function openEntry(user: ReturnType<typeof userEvent.setup>, id: string): Promise<void> {
  const header = screen.getByText(id).closest('button')
  if (!header) throw new Error(`No entry header button for id "${id}"`)
  await user.click(header)
}

describe('the model-answer library', () => {
  it('opens from the nav and marks itself current', async () => {
    const user = userEvent.setup()
    renderApp()
    await openLibrary(user)

    expect(
      screen.getByRole('heading', { name: 'Every worked answer, in one place' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Models' })).toHaveAttribute('aria-current', 'page')
  })

  it('lists every prompt in all three banks', async () => {
    const user = userEvent.setup()
    renderApp()
    await openLibrary(user)

    // Pin both directions: the banks themselves, and the library's count of them.
    expect(PROMPTS).toHaveLength(40)
    expect(LETTER_PROMPTS).toHaveLength(15)
    expect(TASK1_PROMPTS).toHaveLength(12)

    expect(within(groupSection('Task 2 essays')).getAllByRole('listitem')).toHaveLength(
      PROMPTS.length,
    )
    expect(
      within(groupSection('General Training letters')).getAllByRole('listitem'),
    ).toHaveLength(LETTER_PROMPTS.length)
    expect(within(groupSection('Academic Task 1')).getAllByRole('listitem')).toHaveLength(
      TASK1_PROMPTS.length,
    )
  })

  it('badges exactly the five Task 2 prompts with a hand-written answer', async () => {
    const user = userEvent.setup()
    renderApp()
    await openLibrary(user)

    const badges = within(groupSection('Task 2 essays')).getAllByText(
      'Worked answer for this exact question',
    )
    expect(badges).toHaveLength(5)
    const ids = badges
      .map((b) => b.closest('.mlib-entry')?.querySelector('.mlib-entry-id')?.textContent)
      .sort()
    expect(ids).toEqual(['ad-01', 'di-01', 'dq-01', 'op-01', 'ps-01'])
  })

  it('badges exactly the three letters with a hand-written answer, and every chart as generated', async () => {
    const user = userEvent.setup()
    renderApp()
    await openLibrary(user)

    const letterBadges = within(groupSection('General Training letters')).getAllByText(
      'Worked answer for this exact question',
    )
    expect(letterBadges).toHaveLength(3)
    const ids = letterBadges
      .map((b) => b.closest('.mlib-entry')?.querySelector('.mlib-entry-id')?.textContent)
      .sort()
    expect(ids).toEqual(['gt-01', 'gt-07', 'gt-11'])

    expect(
      within(groupSection('Academic Task 1')).getAllByText(
        /Generated from this chart.s own numbers/i,
      ),
    ).toHaveLength(12)
  })

  it("shows the engine's scorecard when an entry is opened", async () => {
    const user = userEvent.setup()
    renderApp()
    await openLibrary(user)
    await openEntry(user, EXACT_PROMPT.id)

    // The panel renders a curly apostrophe, so match around it — same as
    // model-answer.test.tsx.
    expect(screen.getByText(/scored by this app.s own engine/i)).toBeInTheDocument()
  })

  it('keeps the memorisation warning visible on an open entry', async () => {
    const user = userEvent.setup()
    renderApp()
    await openLibrary(user)
    await openEntry(user, EXACT_PROMPT.id)

    expect(screen.getByText(/Read it for the method, not the wording/i)).toBeInTheDocument()
  })

  it('lands the picked prompt on a blank desk in the write view', async () => {
    const user = userEvent.setup()
    renderApp()
    await openLibrary(user)
    await openEntry(user, FALLBACK_PROMPT.id)
    await user.click(screen.getByRole('button', { name: 'Practise this prompt' }))

    expect(screen.getByRole('button', { name: 'Write' })).toHaveAttribute('aria-current', 'page')
    // A substring, not the full text — the desk may split it across markup.
    // The opening sentence (up to the first full stop) is unique per prompt.
    const distinctive = FALLBACK_PROMPT.text.split('.')[0]
    expect(document.querySelector('.pp-text')?.textContent).toContain(distinctive)
  })

  it('is not reachable under exam conditions', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(modeButton('Exam'))

    // The whole nav disappears with the cleared desk — same gate Progress uses.
    expect(screen.queryByRole('button', { name: 'Models' })).not.toBeInTheDocument()
  })

  // A ninth case, beyond the plan's eight: `handlePractiseFromLibrary` asks
  // the same consent `switchTask`/`switchModule` ask before discarding a
  // non-empty essay (see `module-switch.test.tsx`'s "clears the answer sheet"
  // / "refuses to clear ... without consent" pair, which this mirrors) — a
  // behaviour this plan's own handler sketch predates, so it needs its own
  // coverage rather than riding along on an assertion written for something
  // else.
  it('asks before discarding an essay in progress, and obeys a refusal', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderApp()

    sheet().focus()
    await user.paste('An essay already in progress on the desk.')
    await openLibrary(user)
    await openEntry(user, FALLBACK_PROMPT.id)
    await user.click(screen.getByRole('button', { name: 'Practise this prompt' }))

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(confirmSpy.mock.calls[0][0]).toMatch(/discards the essay in progress/i)
    // Refused: still in the library, nothing practised yet.
    expect(
      screen.getByRole('heading', { name: 'Every worked answer, in one place' }),
    ).toBeInTheDocument()

    confirmSpy.mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: 'Practise this prompt' }))
    expect(screen.getByRole('button', { name: 'Write' })).toHaveAttribute('aria-current', 'page')
  })
})
