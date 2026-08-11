/**
 * Plan 031's three-way import choice (Merge / Replace / Cancel), which
 * replaced the old binary `window.confirm` — `window.confirm` could not
 * offer three options, so `Dashboard.tsx` now offers an inline card instead
 * and never imports on file pick alone.
 *
 * Everything drives the real <App /> through `renderApp()` — see
 * `tests/ui/renderApp.tsx` for why an unseeded render reintroduces the
 * prompt-draw flake plan 007 removed.
 *
 * An eviction-disclosure UI case (200+ jsdom records) is deliberately NOT
 * covered here — `tests/store.test.ts`'s "031: merge-import" describe block
 * pins `ImportSummary.evictedCount` at the engine level, and this file only
 * needs to prove the status line renders whatever the summary says, which
 * the merge/replace count assertions below already do.
 */
import { describe, expect, it } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'
import { loadSessions, saveSession } from '../../src/profile/store'
import type { WritingSessionRecord } from '../../src/types'

type User = ReturnType<typeof userEvent.setup>

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

function fileFor(session: WritingSessionRecord): File {
  return new File(
    [JSON.stringify({ schemaVersion: 6, sessions: [session] })],
    'ielts-coach-data-2026-01-01.json',
    { type: 'application/json' },
  )
}

/** Navigate to Progress and pick `file` — asserts the choice card appears,
 *  but does NOT click Merge/Replace/Cancel. */
async function pickFile(user: User, file: File): Promise<void> {
  await user.click(navLink('Progress'))
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })
  await screen.findByText('Import this file?')
}

describe('the import choice card', () => {
  it('surfaces Merge / Replace / Cancel and does not import until one is chosen', async () => {
    const user = userEvent.setup()
    renderApp()

    await pickFile(user, fileFor(writingSession('theirs', '2026-01-02T10:00:00.000Z')))

    expect(screen.getByRole('button', { name: 'Merge (recommended)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Replace everything' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    // Nothing imported yet — the store is still empty.
    expect(loadSessions()).toEqual([])
  })

  it('Cancel dismisses the card and leaves the store untouched', async () => {
    const user = userEvent.setup()
    renderApp()

    await pickFile(user, fileFor(writingSession('theirs', '2026-01-02T10:00:00.000Z')))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Import this file?')).toBeNull()
    expect(loadSessions()).toEqual([])
  })

  it('Merge keeps both histories and the status line reports the merged count', async () => {
    saveSession(writingSession('mine', '2026-01-01T10:00:00.000Z'))
    const user = userEvent.setup()
    renderApp()

    await pickFile(user, fileFor(writingSession('theirs', '2026-01-02T10:00:00.000Z')))
    await user.click(screen.getByRole('button', { name: 'Merge (recommended)' }))

    expect(loadSessions().map((s) => s.id).sort()).toEqual(['mine', 'theirs'])

    const status = await screen.findByRole('status')
    expect(status.textContent).toMatch(/Merged.*2 sessions/)

    // Both sessions render in the history table (header row + 2 body rows).
    const table = await screen.findByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(3)
  })

  it('Replace keeps only the file’s session', async () => {
    saveSession(writingSession('mine', '2026-01-01T10:00:00.000Z'))
    const user = userEvent.setup()
    renderApp()

    await pickFile(user, fileFor(writingSession('theirs', '2026-01-02T10:00:00.000Z')))
    await user.click(screen.getByRole('button', { name: 'Replace everything' }))

    expect(loadSessions().map((s) => s.id)).toEqual(['theirs'])

    const status = await screen.findByRole('status')
    expect(status.textContent).toMatch(/Replaced.*1 session/)
  })
})
