/**
 * The Template tab (plan 033), rendered.
 *
 * The engine-side guarantees — the bank's shape and `templatesFor`'s
 * filtering — live in `tests/templates.test.ts`. What this file checks is the
 * part a learner actually meets: the tab shows up beside Feedback, Cheat
 * sheet and Model answer on every desk, the offered templates match the
 * question on screen, switching templates swaps the visible skeleton,
 * progress through it tracks the live paragraph count, the worked examples
 * render beneath their skeletons and can be hidden with the panel's toggle
 * (plan 035), the memorisation warning is on screen, and the whole tab
 * disappears under exam conditions exactly as the rest of the coach panel
 * does.
 *
 * Everything drives the real <App /> through `renderApp()`, which pins the
 * prompt draw — an unseeded render reintroduces the flake plan 007 removed.
 */
import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
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

async function openTemplateTab(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('tab', { name: 'Template' }))
}

function templateSelect(): HTMLSelectElement {
  return screen.getByLabelText('Choose a template') as HTMLSelectElement
}

/** The labels currently offered by the template picker, in order. */
function offeredLabels(): string[] {
  return Array.from(templateSelect().options).map((o) => o.textContent ?? '')
}

async function type(user: ReturnType<typeof userEvent.setup>, text: string): Promise<void> {
  const box = sheet()
  box.focus()
  await user.paste(text)
  await settled()
}

/* ---------------------------------- tests ----------------------------------- */

describe('the Template tab is offered on every desk', () => {
  it('offers the two opinion templates on a Task 2 opinion desk, and nothing else', async () => {
    const user = userEvent.setup()
    renderApp()
    await openTemplateTab(user)

    // The seeded prompt (op-01, via renderApp) is an opinion question.
    expect(offeredLabels()).toEqual(['Full agreement (or disagreement)', 'Balanced (partly agree)'])
  })

  it('offers the two chart templates on an Academic Task 1 desk, and nothing else', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(taskButton('Task 1'))
    await openTemplateTab(user)

    expect(offeredLabels()).toEqual(['Overview first, grouped by trend', 'Comparison-led'])
  })

  it('offers exactly the formal letter template on a General Training Task 1 desk', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(moduleButton('General'))
    await user.click(taskButton('Task 1'))
    await openTemplateTab(user)

    // renderApp seeds the formal gt-01 letter prompt.
    expect(offeredLabels()).toEqual(['To a stranger with a title'])
  })
})

describe('switching templates swaps the rendered sections', () => {
  it('replaces the first template\'s sections with the second\'s', async () => {
    const user = userEvent.setup()
    renderApp()
    await openTemplateTab(user)

    // Default = bank order's first match: tpl-op-onesided.
    expect(screen.getByText('Strongest reason')).toBeInTheDocument()
    expect(screen.queryByText('The part you accept')).not.toBeInTheDocument()

    await user.selectOptions(templateSelect(), 'Balanced (partly agree)')

    expect(screen.queryByText('Strongest reason')).not.toBeInTheDocument()
    expect(screen.getByText('The part you accept')).toBeInTheDocument()
  })

  it('replaces the first template\'s frames with the second\'s', async () => {
    const user = userEvent.setup()
    renderApp()
    await openTemplateTab(user)

    // tpl-op-onesided's "Strongest reason" frame vs tpl-op-balanced's "The
    // part you accept" frame — scoped to `.tp-frame` so the match cannot
    // land on an ancestor `<li>`/`<ol>` whose text also contains it.
    expect(screen.getByText(/the strongest reason to/i, { selector: '.tp-frame' })).toBeInTheDocument()
    expect(
      screen.queryByText(/where the claim convinces me is/i, { selector: '.tp-frame' }),
    ).not.toBeInTheDocument()

    await user.selectOptions(templateSelect(), 'Balanced (partly agree)')

    expect(
      screen.queryByText(/the strongest reason to/i, { selector: '.tp-frame' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/where the claim convinces me is/i, { selector: '.tp-frame' })).toBeInTheDocument()
  })
})

describe('frame slots render as styled spans', () => {
  it('renders a known slot from the default template as a `tp-slot` span', async () => {
    const user = userEvent.setup()
    renderApp()
    await openTemplateTab(user)

    // op-01 (the seeded opinion prompt) defaults to tpl-op-onesided, whose
    // introduction frame reads "...hear that [paraphrase the statement in
    // your own words]."
    const slot = screen.getByText('paraphrase the statement in your own words')
    expect(slot).toHaveClass('tp-slot')
  })
})

describe('worked examples render beneath their frames', () => {
  it('shows the default template\'s example text under its frame, and the running topic line', async () => {
    const user = userEvent.setup()
    renderApp()
    await openTemplateTab(user)

    // tpl-op-onesided's Introduction example, filled from the template's
    // exampleTopic.
    expect(
      screen.getByText(/every child should begin a second language/i, { selector: '.tp-example' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/worked example answers:/i)).toBeInTheDocument()
  })
})

describe('the "Hide worked examples" toggle', () => {
  it('is unchecked by default, hides every .tp-example on check, and restores them on uncheck', async () => {
    const user = userEvent.setup()
    renderApp()
    await openTemplateTab(user)

    const toggle = screen.getByLabelText('Hide worked examples') as HTMLInputElement
    expect(toggle).not.toBeChecked()
    const sectionCount = document.querySelectorAll('.tp-example').length
    expect(sectionCount).toBeGreaterThanOrEqual(4)

    await user.click(toggle)

    expect(toggle).toBeChecked()
    expect(document.querySelectorAll('.tp-example')).toHaveLength(0)
    expect(screen.queryByText(/worked example answers:/i)).not.toBeInTheDocument()

    await user.click(toggle)

    expect(toggle).not.toBeChecked()
    expect(document.querySelectorAll('.tp-example')).toHaveLength(sectionCount)
  })
})

describe('progress tracks the live paragraph count', () => {
  // Section `i` is `tp-done` when `i < paragraphCount` and `tp-current` at
  // `i === paragraphCount` (clamped to the last section) — so two complete
  // paragraphs mark BOTH sections 1 and 2 done, with section 3 current: the
  // count is how many paragraphs exist, not how many are "finished", and the
  // learner is taken to be starting the paragraph after the last one typed.
  it('marks two sections done and the third current once two paragraphs are written', async () => {
    const user = userEvent.setup()
    renderApp()
    await openTemplateTab(user)

    const sections = () => Array.from(document.querySelectorAll('.tp-section'))
    // Nothing written yet: the first section is the current one.
    expect(sections()[0]).toHaveClass('tp-current')
    expect(sections()[0]).not.toHaveClass('tp-done')

    await type(
      user,
      'This is the first paragraph and it easily clears the five word merge threshold.\n\n' +
        'This is the second paragraph and it also easily clears the five word merge threshold.',
    )

    const after = sections()
    expect(after[0]).toHaveClass('tp-done')
    expect(after[0]).not.toHaveClass('tp-current')
    expect(after[1]).toHaveClass('tp-done')
    expect(after[1]).not.toHaveClass('tp-current')
    expect(after[2]).toHaveClass('tp-current')
    expect(after[2]).not.toHaveClass('tp-done')
    expect(after[3]).not.toHaveClass('tp-done')
    expect(after[3]).not.toHaveClass('tp-current')
  })
})

describe('the memorisation warning', () => {
  it('is visible on the template panel, and covers both the frame and the worked example', async () => {
    const user = userEvent.setup()
    renderApp()
    await openTemplateTab(user)

    expect(screen.getByText(/examiners discount sentences they have read a thousand times/i)).toBeInTheDocument()
    expect(
      screen.getByText(/copying an example into your essay is the same trap as copying the frame/i),
    ).toBeInTheDocument()
  })
})

describe('exam mode', () => {
  it('hides the Template tab along with the rest of the coach panel', async () => {
    const user = userEvent.setup()
    renderApp()
    await openTemplateTab(user)
    expect(templateSelect()).toBeInTheDocument()

    await user.click(modeButton('Exam'))

    expect(screen.queryByRole('tab', { name: 'Template' })).not.toBeInTheDocument()
    expect(document.querySelector('.panel-zone')).toBeNull()
    expect(screen.queryByLabelText('Choose a template')).not.toBeInTheDocument()
  })
})
