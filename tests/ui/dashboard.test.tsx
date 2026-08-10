/**
 * The Progress page's two band readouts and its chart/table order — the same
 * number the report shows, reappearing in the chart's latest-value label, in
 * the history table's Band column, and in the chart's own left-to-right axis.
 *
 * `Dashboard` is reached by three existing UI tests (clicking through to the
 * Progress link), but none of them asserts a band it prints. Three surviving
 * mutations proved it at plan 021's baseline: `Dashboard.tsx:135` can add a
 * full point to the chart's latest-value text, `Dashboard.tsx:432` can do the
 * same to every history row, and `Dashboard.tsx:227` can reverse the sort so
 * an improving learner is shown a declining line — and 944 tests stayed green
 * through all three. If this file is deleted, that regresses silently again.
 *
 * Renders `Dashboard` DIRECTLY rather than through `renderApp()`, for the same
 * reason as `tests/ui/report.test.tsx`: a fixed `sessions` prop involves no
 * random prompt draw, so the `renderApp` rule (`tests/ui/renderApp.tsx:1-22`)
 * does not apply.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Dashboard from '../../src/components/Dashboard'
import type { ErrorProfile, WritingSessionRecord } from '../../src/types'

/* --------------------------------- fixture --------------------------------- */

/**
 * One persisted writing session with a chosen band. Every field of
 * `WritingSessionRecord` is required; the ones this test does not assert on are
 * still spelled out because omitting them does not typecheck.
 */
function session(id: string, dateISO: string, overall: number): WritingSessionRecord {
  return {
    section: 'writing',
    id,
    dateISO,
    mode: 'coach',
    task: 'task2',
    // Load-bearing, not filler: the history table reads MODULE_META[s.module]
    // at Dashboard.tsx:406, and an undefined module falls through to the
    // `academic` fallback rather than throwing — which would hide a real bug.
    module: 'academic',
    promptId: null,
    promptText: 'Some people think that schools should teach practical skills.',
    questionType: 'opinion',
    essayText: 'A short body. It exists only so the record is well formed.',
    // Exam-mode-only fields; `coach` sessions persist them as null.
    durationSec: null,
    pacing: null,
    pasteAttempts: null,
    analysis: {
      issues: [],
      paragraphs: [],
      structure: [],
      // All seven EssayStats fields are required. `wordCount` is the only one
      // the Dashboard prints (the Words column, Dashboard.tsx:430); the rest
      // exist so the record typechecks.
      stats: {
        wordCount: 250,
        sentenceCount: 12,
        paragraphCount: 4,
        avgSentenceLength: 20.8,
        sentenceLengthStdDev: 4.2,
        typeTokenRatio: 0.62,
        linkingDeviceCount: 5,
      },
      band: {
        overall,
        byCriterion: { TR: overall, CC: overall, LR: overall, GRA: overall },
        rationale: { TR: [], CC: [], LR: [], GRA: [] },
      },
    },
  }
}

// Deliberately NOT in date order: `Dashboard` is responsible for sorting, and a
// fixture already sorted would pass whichever direction it sorted in.
const SESSIONS = [
  session('mid', '2026-02-15T10:00:00.000Z', 6.5),
  session('oldest', '2026-01-05T10:00:00.000Z', 5.5),
  session('newest', '2026-03-20T10:00:00.000Z', 7.5),
]

const PROFILE: ErrorProfile = { totalSessions: 3, categories: {}, focusCategories: [] }

/** Mirrors Dashboard.tsx's chart-axis date format (no year). */
function chartDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** Mirrors Dashboard.tsx's history-table date format (with year, `fmtDate(iso, true)`). */
function tableDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function renderDashboard(): void {
  render(
    <Dashboard
      sessions={SESSIONS}
      profile={PROFILE}
      trends={[]}
      onOpenSession={() => {}}
      onStartPractice={() => {}}
      onDeleteSession={() => {}}
      onExport={() => {}}
      onImport={() => {}}
    />,
  )
}

describe('the trend chart', () => {
  it("labels the trend line with the newest session's band", () => {
    renderDashboard()

    expect(document.querySelector('.db-last-label')?.textContent).toBe('7.5')
  })

  it('plots the chart oldest to newest', () => {
    renderDashboard()

    const chart = screen.getByRole('img', { name: /Overall band estimate per session/ })
    const label = chart.getAttribute('aria-label') ?? ''
    const janIndex = label.indexOf(chartDate('2026-01-05T10:00:00.000Z'))
    const marIndex = label.indexOf(chartDate('2026-03-20T10:00:00.000Z'))
    expect(janIndex).toBeGreaterThan(-1)
    expect(marIndex).toBeGreaterThan(-1)
    // Oldest date named before newest, and the latest estimate is the newest
    // session's band — both would flip under Dashboard.tsx:227's mutation.
    expect(janIndex).toBeLessThan(marIndex)
    expect(label.endsWith('Latest estimate: 7.5.')).toBe(true)

    // The two visible axis labels, in DOCUMENT order, must read oldest then
    // newest too — `db-axis-date` is two fixed JSX positions (first point,
    // last point), so a sort reversal swaps which date lands in which one.
    const axisDates = Array.from(document.querySelectorAll('.db-axis-date')).map(
      (el) => el.textContent,
    )
    expect(axisDates).toEqual([
      chartDate('2026-01-05T10:00:00.000Z'),
      chartDate('2026-03-20T10:00:00.000Z'),
    ])
  })
})

describe('the history table', () => {
  it("prints each session's own band in the history table", () => {
    renderDashboard()

    const table = screen.getByRole('table')
    const headers = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent)
    // The Words and Band cells share the class `mono db-td-num`, so a
    // class selector picks up both. Resolve the column by its heading instead.
    const bandCol = headers.indexOf('Band (est.)')
    expect(bandCol).toBeGreaterThan(-1)
    const bands = Array.from(table.querySelectorAll('tbody tr')).map(
      (row) => (row as HTMLTableRowElement).cells[bandCol].textContent,
    )
    expect(bands).toEqual(['7.5', '6.5', '5.5'])
  })

  it('orders the history newest first', () => {
    renderDashboard()

    const table = screen.getByRole('table')
    const firstRow = table.querySelectorAll('tbody tr')[0] as HTMLTableRowElement
    expect(firstRow.cells[0].textContent).toBe(tableDate('2026-03-20T10:00:00.000Z'))
  })
})
