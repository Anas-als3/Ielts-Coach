/**
 * The state a sighted learner reads off a colour, read back through the
 * accessibility tree instead.
 *
 * An adversarial review found two whole classes of control in this app whose
 * state existed ONLY as a CSS class — both WCAG 2.1 4.1.2 "Name, Role, Value"
 * (Level A), and both invisible to anybody not looking at the navy fill:
 *
 * 1. **Tabs that controlled nothing.** `role="tablist"` and `role="tab"` were
 *    used at three sites with no `role="tabpanel"` and no `aria-controls`
 *    anywhere in `src/`. A screen reader announced "tab, selected" and the
 *    listener had no way to know what had changed.
 * 2. **Toggles that were never pressed.** `aria-pressed` appeared nowhere. A
 *    non-sighted learner could not tell which exam they were about to sit or
 *    which half of an answer review they were reading.
 *
 * The tab assertions are written as ONE invariant applied to all three strips
 * rather than three hand-written checks: a fourth tab strip should either
 * satisfy the pattern or fail this file, and a per-site assertion would simply
 * not notice it. Everything drives the real <App /> through `renderApp()`,
 * which pins the prompt draw — an unseeded render reintroduces the flake plan
 * 007 removed.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'
import { FakeSpeechDriver } from '../../src/listening/speech'
import { LISTENING_TEST_01 } from '../../src/listening/tests'
import { loadSessions } from '../../src/profile/store'

/* --------------------------------- helpers ---------------------------------- */

type User = ReturnType<typeof userEvent.setup>

function navLink(name: string): HTMLElement {
  return within(document.querySelector('.nav') as HTMLElement).getByText(name)
}

function toggle(groupName: string, buttonName: string | RegExp): HTMLElement {
  return within(screen.getByRole('group', { name: groupName })).getByRole('button', {
    name: buttonName,
  })
}

/** Which button in a `role="group"` of toggles reports itself as pressed. */
function pressed(groupName: string): string[] {
  return within(screen.getByRole('group', { name: groupName }))
    .getAllByRole('button')
    .filter((b) => b.getAttribute('aria-pressed') === 'true')
    .map((b) => b.textContent ?? '')
}

/**
 * The whole ARIA tab contract, asserted against one strip.
 *
 * Returns the live panel so a caller can go on to prove that the panel named
 * here is genuinely the thing the tab swapped — an `aria-controls` that points
 * at the wrong element would satisfy every check below and still be a lie.
 */
function assertTabPattern(tablistName: string): HTMLElement {
  const tablist = screen.getByRole('tablist', { name: tablistName })
  const tabs = within(tablist).getAllByRole('tab')
  expect(tabs.length).toBeGreaterThan(1)

  for (const tab of tabs) {
    // Every tab names the panel it controls, and that panel is really there.
    const controls = tab.getAttribute('aria-controls')
    expect(controls, `${tablistName}: tab "${tab.textContent}" controls nothing`).toBeTruthy()
    const panel = document.getElementById(controls as string)
    expect(panel, `${tablistName}: aria-controls points at no element`).not.toBeNull()
    expect(panel).toHaveAttribute('role', 'tabpanel')
    // A panel can only point back at a tab that has an id.
    expect(tab.id).not.toBe('')
    // Roving tabindex: the strip is ONE tab stop.
    expect(tab).toHaveAttribute('tabindex', tab.getAttribute('aria-selected') === 'true' ? '0' : '-1')
  }

  const selected = tabs.filter((t) => t.getAttribute('aria-selected') === 'true')
  expect(selected, `${tablistName}: exactly one tab is selected`).toHaveLength(1)

  const panel = document.getElementById(selected[0].getAttribute('aria-controls') as string)
  expect(panel).not.toBeNull()
  // …and the panel names the tab that labels it, which is the half that was
  // missing: without it "selected" is announced against nothing.
  expect(panel).toHaveAttribute('aria-labelledby', selected[0].id)
  return panel as HTMLElement
}

async function startReadingPaper(user: User): Promise<void> {
  await user.click(navLink('Reading'))
  // Each module now lists more than one paper, so the start button is found
  // through the first paper's own card. The picker is rendered by the
  // lazily-loaded `ReadingSection` (plan 023), so this lookup — the first
  // query against section content — awaits the chunk.
  const card = (await screen.findByText('Academic Reading Test 1')).closest('.rdp-test') as HTMLElement
  await user.click(within(card).getByRole('button', { name: 'Start this paper' }))
  await screen.findByRole('tab', { name: /Reading Passage 1/ })
}

async function startListeningPaper(user: User): Promise<void> {
  await user.click(navLink('Listening'))
  // Scoped to test 1's card: the picker lists every authored paper, and each
  // card carries its own pair of start buttons. `ListeningSection` is lazy
  // (plan 023) too, so this first lookup awaits the chunk.
  const card = (
    await screen.findByRole('heading', { name: LISTENING_TEST_01.title })
  ).closest('.lsp-test') as HTMLElement
  await user.click(within(card).getByRole('button', { name: 'Sit under exam conditions' }))
  await screen.findByRole('tab', { name: /Section 1/ })
}

/* ------------------------------ 1. the tab pattern -------------------------- */

describe('every tab strip is a complete ARIA tab pattern', () => {
  it('holds for the coach panel, and the panel follows the selection', async () => {
    const user = userEvent.setup()
    renderApp()

    const onFeedback = assertTabPattern('Coach panel')
    expect(onFeedback.querySelector('.fb-panel')).not.toBeNull()

    await user.click(screen.getByRole('tab', { name: 'Model answer' }))

    const onModel = assertTabPattern('Coach panel')
    // The SAME panel element, relabelled — which is the point of naming one
    // panel rather than three: only the chosen tab's content is ever mounted.
    expect(onModel).toBe(onFeedback)
    expect(onModel.querySelector('.ma-root')).not.toBeNull()
    expect(onModel.querySelector('.fb-panel')).toBeNull()
  })

  it('holds for the Reading passages, and the panel is what the tab swapped', async () => {
    const user = userEvent.setup()
    renderApp()
    await startReadingPaper(user)

    const panel = assertTabPattern('Reading passages')
    expect(within(panel).getByText('The Salt Roads')).toBeInTheDocument()
    expect(within(panel).getByText(/^Questions 1–6$/)).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Reading Passage 2/ }))

    const next = assertTabPattern('Reading passages')
    expect(next).toBe(panel)
    // Passage 1's questions are gone and passage 2's are here: the element the
    // tabs claim to control really is the one that changed.
    expect(within(next).queryByText(/^Questions 1–6$/)).not.toBeInTheDocument()
    expect(
      next.getAttribute('aria-labelledby'),
    ).toBe(screen.getByRole('tab', { name: /Reading Passage 2/ }).id)
  })

  it('holds for the Listening sections', async () => {
    const user = userEvent.setup()
    renderApp({ listeningDriver: new FakeSpeechDriver() })
    await startListeningPaper(user)

    const panel = assertTabPattern('Listening sections')
    expect(within(panel).getByRole('article', { name: 'Section 1 recording' })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Section 2/ }))

    const next = assertTabPattern('Listening sections')
    expect(next).toBe(panel)
    expect(within(next).getByRole('article', { name: 'Section 2 recording' })).toBeInTheDocument()
  })
})

/* ------------------------- 2. keyboard operability -------------------------- */

describe('a tab strip is one tab stop the arrow keys move within', () => {
  it('moves the coach panel with the arrows, and focus goes with it', async () => {
    const user = userEvent.setup()
    renderApp()

    const feedback = screen.getByRole('tab', { name: 'Feedback' })
    feedback.focus()
    expect(feedback).toHaveFocus()

    // Order is Feedback, Template, Cheat sheet, Model answer (plan 033 inserts
    // Template second) — one ArrowRight from Feedback lands on Template.
    await user.keyboard('{ArrowRight}')
    const template = screen.getByRole('tab', { name: 'Template' })
    expect(template).toHaveAttribute('aria-selected', 'true')
    // Focus follows the selection, or the next arrow press would be read by a
    // tab that is no longer the live one.
    expect(template).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    const cheatSheet = screen.getByRole('tab', { name: 'Cheat sheet' })
    expect(cheatSheet).toHaveAttribute('aria-selected', 'true')
    expect(cheatSheet).toHaveFocus()

    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Model answer' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Feedback' })).toHaveFocus()
    // Wrapping: left from the first lands on the last.
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Model answer' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('moves the Reading passages with the arrows', async () => {
    const user = userEvent.setup()
    renderApp()
    await startReadingPaper(user)

    screen.getByRole('tab', { name: /Reading Passage 1/ }).focus()
    await user.keyboard('{ArrowRight}')

    const second = screen.getByRole('tab', { name: /Reading Passage 2/ })
    expect(second).toHaveFocus()
    expect(second).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText(/^Questions 1–6$/)).not.toBeInTheDocument()
  })

  it('moves the Listening sections with the arrows', async () => {
    const user = userEvent.setup()
    renderApp({ listeningDriver: new FakeSpeechDriver() })
    await startListeningPaper(user)

    screen.getByRole('tab', { name: /Section 1/ }).focus()
    await user.keyboard('{ArrowRight}')

    const second = screen.getByRole('tab', { name: /Section 2/ })
    expect(second).toHaveFocus()
    expect(second).toHaveAttribute('aria-selected', 'true')
  })

  it('gives the Reading passage itself a tab stop, so it can be scrolled', async () => {
    const user = userEvent.setup()
    renderApp()
    await startReadingPaper(user)

    // The passage pane is a scroll container holding nothing focusable. Without
    // a stop of its own a keyboard-only learner cannot scroll a 2,200-word
    // passage at all, and would be answering questions on text they cannot read.
    const passage = screen.getByRole('article', { name: 'Reading Passage 1' })
    expect(passage).toHaveAttribute('tabindex', '0')
    passage.focus()
    expect(passage).toHaveFocus()
  })
})

/* --------------------------- 3. toggles say pressed ------------------------- */

describe('every toggle reports its state, not just its colour', () => {
  it('says which exam is selected, on the writing desk', async () => {
    const user = userEvent.setup()
    renderApp()

    expect(pressed('IELTS exam type')).toEqual(['Academic'])
    expect(toggle('IELTS exam type', 'General')).toHaveAttribute('aria-pressed', 'false')

    await user.click(toggle('IELTS exam type', 'General'))

    expect(pressed('IELTS exam type')).toEqual(['General'])
    expect(toggle('IELTS exam type', 'Academic')).toHaveAttribute('aria-pressed', 'false')
  })

  it('says which exam is selected in the Reading section, where it picks the paper', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(navLink('Reading'))

    expect(pressed('IELTS exam type')).toEqual(['Academic'])
    await user.click(toggle('IELTS exam type', 'General'))
    expect(pressed('IELTS exam type')).toEqual(['General'])
  })

  it('says which task and which mode are selected', async () => {
    const user = userEvent.setup()
    renderApp()

    expect(pressed('IELTS task')).toEqual(['Task 2'])
    expect(pressed('Writing mode')).toEqual(['Coach'])

    await user.click(toggle('IELTS task', 'Task 1'))
    expect(pressed('IELTS task')).toEqual(['Task 1'])

    await user.click(toggle('Writing mode', 'Exam'))
    expect(pressed('Writing mode')).toEqual(['Exam'])
  })

  it('says which half of the Reading answer review is on screen', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderApp()
    await startReadingPaper(user)
    await user.click(screen.getByRole('button', { name: 'Submit answers' }))
    await screen.findByText(/This band is exact/i)

    expect(pressed('Filter answers')).toEqual(['All 40'])

    await user.click(toggle('Filter answers', /^Wrong/))

    expect(pressed('Filter answers')).toEqual(['Wrong 40'])
    expect(toggle('Filter answers', /^All/)).toHaveAttribute('aria-pressed', 'false')
  })

  it('says which half of the Listening answer review is on screen', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderApp({ listeningDriver: new FakeSpeechDriver() })
    await startListeningPaper(user)
    await user.click(screen.getByRole('button', { name: 'Submit answers' }))
    await screen.findByText(/This band is exact/i)

    expect(pressed('Filter answers')).toEqual(['All 40'])
    await user.click(toggle('Filter answers', /^Wrong/))
    expect(pressed('Filter answers')).toEqual(['Wrong 40'])
  })

  it('marks the section the learner is in, as navigation rather than a toggle', async () => {
    const user = userEvent.setup()
    renderApp()

    const nav = document.querySelector('.nav') as HTMLElement
    const current = () =>
      within(nav)
        .getAllByRole('button')
        .filter((b) => b.getAttribute('aria-current') === 'page')
        .map((b) => b.textContent)

    expect(current()).toEqual(['Write'])
    await user.click(navLink('Reading'))
    expect(current()).toEqual(['Reading'])
    // Not `aria-pressed`: these move the learner between sections, they do not
    // hold a pressed state, and "current page" is what a screen reader wants.
    expect(navLink('Reading')).not.toHaveAttribute('aria-pressed')
  })
})

/* ----------------------- 4. delete re-reads the store ----------------------- */

describe('deleting a session re-reads the store', () => {
  const PADDING = Array.from({ length: 130 }, (_, i) => `point number ${i}`).join(', ')

  /** Write and submit one essay, landing on its report. */
  async function writeOne(user: User, opening: string): Promise<void> {
    const sheet = screen.getByRole('textbox') as HTMLTextAreaElement
    sheet.focus()
    await user.paste(`${opening} ${PADDING}.`)
    await user.click(screen.getByRole('button', { name: 'Finish & review' }))
    await screen.findByRole('button', { name: 'New essay' })
  }

  it('shows what is in storage afterwards, not what was in memory before', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderApp()

    await writeOne(user, 'I firmly believe the first thing.')
    await user.click(screen.getByRole('button', { name: 'New essay' }))
    await writeOne(user, 'I firmly believe the second thing.')

    await user.click(navLink('Progress'))
    const table = await screen.findByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(3) // header + two

    // Something outside this component changes the store — a second tab, an
    // import, the 200-session cap. The three other mutations in App re-read
    // after writing and would show it; this one filtered its own stale copy,
    // so it would report one surviving essay that storage no longer holds.
    localStorage.setItem('ielts-coach.v1', JSON.stringify({ schemaVersion: 5, sessions: [] }))

    await user.click(screen.getAllByRole('button', { name: /^Delete the / })[0])

    await waitFor(() =>
      expect(
        screen.getByText('Write your first essay and your profile starts here.'),
      ).toBeInTheDocument(),
    )
    expect(loadSessions()).toHaveLength(0)
  })
})
