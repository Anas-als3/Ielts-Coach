/**
 * 016-c's UI half: a failed save must not end on a blank page.
 *
 * `App.tsx`'s report view used to have no fallback branch — unlike Reading and
 * Listening, which both fall back to their picker when the session is null.
 * A failed `saveSession` still navigated to `view: 'report'`, `reportSession`
 * resolved to `null`, and the learner got a header with nothing else after
 * finishing a 40-minute essay. Must render through `renderApp()`: an unseeded
 * `render(<App />)` draws a random prompt from 40 and fails roughly three runs
 * in ten (see renderApp.tsx).
 */
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'

const STORAGE_KEY = 'ielts-coach.v1'
const PADDING = Array.from({ length: 130 }, (_, i) => `point number ${i}`).join(', ')

/**
 * Make every write to the live store key throw a quota error; other keys are
 * unaffected.
 *
 * Spies on `Storage.prototype.setItem`, not the `window.localStorage`
 * INSTANCE: jsdom implements `Storage` as a WebIDL legacy platform object,
 * where defining an own property on the instance (which is what
 * `vi.spyOn(window.localStorage, 'setItem')` does) is redirected into an
 * actual stored key named "setItem" rather than shadowing the method — the
 * spy silently never fires. The prototype has no such interception.
 */
function failStoreWrites(): void {
  const real = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
    this: Storage,
    key: string,
    value: string,
  ) {
    if (key === STORAGE_KEY) {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    }
    real.call(this, key, value)
  })
}

/** Type a submittable essay and click Finish & review. */
async function writeAndSubmit(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const sheet = screen.getByRole('textbox') as HTMLTextAreaElement
  sheet.focus()
  await user.paste(`I firmly believe the first thing. ${PADDING}.`)
  await user.click(screen.getByRole('button', { name: 'Finish & review' }))
}

describe('a failed save shows a banner instead of a blank report', () => {
  it('shows a persistent alert and a non-empty page when the write fails', async () => {
    const user = userEvent.setup()
    failStoreWrites()
    renderApp()

    await writeAndSubmit(user)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent?.length ?? 0).toBeGreaterThan(0)
    // The page is not blank: the fallback card explains what happened.
    expect(screen.getByRole('heading', { name: /could not be loaded/i })).toBeInTheDocument()
    // The alert stays until dismissed — it must still be there after a render
    // driven by something else, not just immediately after the submit.
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
  })

  it('renders the report with no alert when the write succeeds', async () => {
    const user = userEvent.setup()
    renderApp()

    await writeAndSubmit(user)

    await screen.findByRole('button', { name: 'New essay' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
