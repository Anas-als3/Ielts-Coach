/**
 * Plan 027: goals & readiness — the app learns the exam date, the target
 * band and the preferred exam, and shows the gap (SPEC.md "Preferences").
 *
 * No forecast anywhere: these cases pin DISTANCE (a gap line, a days-left
 * count) rather than an arrival date, and every gap display keeps the
 * form-only hedge beside it. Everything drives the real `<App />` through
 * `renderApp()` (`tests/ui/renderApp.tsx:41-54`) — an unseeded render
 * reintroduces the flake plan 007 removed. `setup.ts` clears storage in both
 * `beforeEach` and `afterEach`, so seeded prefs are written in the TEST BODY,
 * after the clear and before `renderApp()`.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'

const PREFS_KEY = 'ielts-coach.prefs.v1'

/* --------------------------------- helpers ---------------------------------- */

function moduleButton(name: 'Academic' | 'General'): HTMLElement {
  return within(screen.getByRole('group', { name: 'IELTS exam type' })).getByRole('button', {
    name,
  })
}

function readPrefs(): Record<string, unknown> {
  const raw = localStorage.getItem(PREFS_KEY)
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
}

/** Today + `n` calendar days, as 'YYYY-MM-DD' from LOCAL date parts — the
 *  same clock `daysUntil` compares against, so the round number is exact. */
function isoInDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const PADDING = Array.from({ length: 130 }, (_, i) => `point number ${i}`).join(', ')

/** Write and submit one essay, landing on its report — the pattern
 *  tests/ui/a11y.test.tsx:334-340 uses. */
async function writeOne(user: ReturnType<typeof userEvent.setup>, opening: string): Promise<void> {
  const sheet = screen.getByRole('textbox') as HTMLTextAreaElement
  sheet.focus()
  await user.paste(`${opening} ${PADDING}.`)
  await user.click(screen.getByRole('button', { name: 'Finish & review' }))
  await screen.findByRole('button', { name: 'New essay' })
}

/* ---------------------------------- tests ----------------------------------- */

describe('1. the persisted module survives a fresh mount', () => {
  it('a seeded module renders General active, not Academic', () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ module: 'general' }))

    renderApp()

    expect(moduleButton('General')).toHaveClass('active')
    expect(moduleButton('Academic')).not.toHaveClass('active')
  })
})

describe('2. switching writes the pref', () => {
  it('clicking General persists it before any reload', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(moduleButton('General'))

    expect(readPrefs().module).toBe('general')
  })
})

describe('3. exam date shows the days remaining', () => {
  it('setting the date shows "Exam in 10 days" and saves the pref', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Progress' }))

    const iso = isoInDays(10)
    fireEvent.change(screen.getByLabelText('Exam date'), { target: { value: iso } })

    expect(screen.getByText('Exam in 10 days')).toBeInTheDocument()
    expect(readPrefs().examDateISO).toBe(iso)
  })
})

describe('4. the target chip on the report', () => {
  it('shows the target band beside the estimate, alongside the existing hedge', async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ targetOverall: 7 }))
    const user = userEvent.setup()
    renderApp()

    await writeOne(user, 'I firmly believe this is a good idea.')

    expect(screen.getByText(/Target 7\.0/)).toBeInTheDocument()
    expect(
      screen.getByText('Form-only estimate — your real band is likely this or lower.'),
    ).toBeInTheDocument()
  })
})

describe('5. no target, no chip', () => {
  it('renders nothing target-shaped when no target is set', async () => {
    const user = userEvent.setup()
    renderApp()

    await writeOne(user, 'I firmly believe this is a good idea.')

    expect(screen.queryByText(/Target \d\.\d/)).toBeNull()
  })
})

describe('6. the dashboard gap line', () => {
  it('shows the latest band against the target, hedged', async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ targetBySection: { writing: 7 } }))
    const user = userEvent.setup()
    renderApp()

    await writeOne(user, 'I firmly believe this is a good idea.')
    await user.click(screen.getByRole('button', { name: 'View progress' }))

    expect(screen.getByText(/Writing: latest \d\.\d vs target 7\.0/)).toBeInTheDocument()
    expect(
      screen.getByText(
        'Bands here are form-only estimates — your real band is likely at or below them, so treat any gap as a hint, not a measurement.',
      ),
    ).toBeInTheDocument()
  })
})

describe('7. import restores prefs, including the module', () => {
  it('a file carrying prefs restores them through switchModule', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Progress' }))

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(
      [
        JSON.stringify({
          schemaVersion: 5,
          sessions: [],
          prefs: { module: 'general', targetOverall: 7 },
        }),
      ],
      'ielts-coach-data.json',
      { type: 'application/json' },
    )
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => expect(readPrefs().module).toBe('general'))

    await user.click(within(document.querySelector('.nav') as HTMLElement).getByText('Write'))
    expect(moduleButton('General')).toHaveClass('active')
  })
})
