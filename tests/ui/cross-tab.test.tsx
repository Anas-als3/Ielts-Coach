/**
 * Plan 031's cross-tab refresh (`onExternalStoreChange`, `src/App.tsx`).
 *
 * The browser's `storage` event fires only in OTHER same-origin tabs — never
 * in the tab that wrote — and jsdom does not fire it for real writes at all,
 * so a `StorageEvent` is dispatched by hand to simulate "another tab wrote".
 * A write made directly through the store API in THIS document (as the
 * fixture calls below do) never fires the event either, matching every real
 * browser, which is what the second case below pins.
 *
 * Everything drives the real <App /> through `renderApp()` — see
 * `tests/ui/renderApp.tsx` for why an unseeded render reintroduces the
 * prompt-draw flake plan 007 removed.
 */
import { describe, expect, it } from 'vitest'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'
import { saveSession } from '../../src/profile/store'
import type { WritingSessionRecord } from '../../src/types'

const STORAGE_KEY = 'ielts-coach.v1'

function navLink(name: string): HTMLElement {
  return within(document.querySelector('.nav') as HTMLElement).getByText(name)
}

/**
 * A minimal, fully-typed writing session — the same current-shape fixture
 * `tests/store.test.ts`'s `newRecord` builds (plan-024-proof: no `any`, no
 * missing required fields).
 */
function writingSession(id: string, dateISO: string): WritingSessionRecord {
  return {
    section: 'writing',
    id,
    dateISO,
    mode: 'coach',
    task: 'task2',
    module: 'academic',
    promptId: 'op-01',
    promptText: 'Some prompt text.',
    questionType: 'opinion',
    essayText: 'An essay.',
    durationSec: null,
    pacing: null,
    pasteAttempts: null,
    analysis: {
      issues: [],
      paragraphs: [],
      structure: [],
      stats: {
        wordCount: 260,
        sentenceCount: 12,
        paragraphCount: 4,
        avgSentenceLength: 21.6,
        sentenceLengthStdDev: 6.1,
        typeTokenRatio: 0.62,
        linkingDeviceCount: 9,
      },
      band: {
        overall: 7,
        byCriterion: { TR: 7, CC: 7, LR: 7, GRA: 7 },
        rationale: { TR: ['ok'], CC: ['ok'], LR: ['ok'], GRA: ['ok'] },
      },
    },
  }
}

describe('cross-tab refresh', () => {
  it('starts from the empty state with nothing saved', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(navLink('Progress'))

    expect(await screen.findByText('No essays yet')).toBeInTheDocument()
  })

  it('a write made directly through the store (simulating another tab) does NOT refresh on its own', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(navLink('Progress'))
    await screen.findByText('No essays yet')

    // No `storage` event fires for this — same-tab writes never generate
    // one, in jsdom or any real browser — so the page must still show the
    // empty state until an event actually arrives.
    saveSession(writingSession('a', '2026-01-01T10:00:00.000Z'))

    expect(screen.getByText('No essays yet')).toBeInTheDocument()
  })

  it('a dispatched storage event for the store key refreshes the page', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(navLink('Progress'))
    await screen.findByText('No essays yet')

    saveSession(writingSession('a', '2026-01-01T10:00:00.000Z'))

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
    })

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.queryByText('No essays yet')).toBeNull()
  })

  it('a storage event for an unrelated key is ignored, even when the underlying data changed', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(navLink('Progress'))
    await screen.findByText('No essays yet')

    saveSession(writingSession('a', '2026-01-01T10:00:00.000Z'))
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
    })
    await screen.findByRole('table')

    // Remove the record straight out of localStorage, bypassing the store's
    // own API — a refresh WOULD now show the empty state again. Dispatching
    // an UNRELATED key must not trigger that refresh: the essay row staying
    // put is what proves the filter is doing something, not a coincidence
    // of nothing having changed.
    localStorage.removeItem(STORAGE_KEY)
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated-key' }))
    })

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.queryByText('No essays yet')).toBeNull()
  })
})
