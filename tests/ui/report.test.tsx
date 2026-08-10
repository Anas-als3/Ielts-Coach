/**
 * The band hero and criterion tiles on the writing report — the number the
 * whole product exists to produce.
 *
 * No file in `tests/ui/` renders `Report` before this one (`Report` is only
 * reached incidentally, via App's "New essay" button). Nothing here asserted a
 * writing band: `Report.tsx:437` can be bumped a full point high and
 * `Report.tsx:522` can make every criterion tile print the overall instead of
 * its own value, and 944 tests at plan 021's baseline stayed green either way.
 * If this file is deleted, that regresses silently again.
 *
 * Renders `Report` DIRECTLY rather than through `renderApp()`. The
 * `renderApp` rule (`tests/ui/renderApp.tsx:1-22`) exists because `<App/>`
 * draws a random prompt on every unseeded render; a component test that hands
 * `Report` a fixed session and fixed props involves no draw, so the rule does
 * not apply here.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Report from '../../src/components/Report'
import type { BandEstimate, EssayStats, ErrorProfile, WritingSessionRecord } from '../../src/types'

/* --------------------------------- fixture --------------------------------- */

// Four DIFFERENT bands, none equal to the overall, so a tile that prints the
// overall instead of its own criterion is visibly wrong.
const BAND = {
  overall: 7,
  byCriterion: { TR: 6, CC: 6.5, LR: 8, GRA: 5.5 },
  rationale: { TR: [], CC: [], LR: [], GRA: [] },
} satisfies BandEstimate

const STATS: EssayStats = {
  wordCount: 260,
  sentenceCount: 14,
  paragraphCount: 4,
  avgSentenceLength: 18.6,
  sentenceLengthStdDev: 3.9,
  typeTokenRatio: 0.58,
  linkingDeviceCount: 6,
}

const SESSION: WritingSessionRecord = {
  section: 'writing',
  id: 'r1',
  dateISO: '2026-03-01T10:00:00.000Z',
  mode: 'coach',
  task: 'task2',
  module: 'academic',
  promptId: null,
  promptText: 'Some people think that schools should teach practical skills.',
  questionType: 'opinion',
  essayText: 'A short essay body. It has two sentences so the report has something to render.',
  // Coach-mode session; exam-only fields persist as null.
  durationSec: null,
  pacing: null,
  pasteAttempts: null,
  analysis: {
    issues: [],
    paragraphs: [],
    structure: [],
    stats: STATS,
    band: BAND,
  },
}

const PROFILE: ErrorProfile = { totalSessions: 1, categories: {}, focusCategories: [] }

function renderReport(): void {
  render(
    <Report
      session={SESSION}
      previousSession={null}
      profile={PROFILE}
      onRedraft={() => {}}
      onNewEssay={() => {}}
      onViewDashboard={() => {}}
    />,
  )
}

describe('the band hero', () => {
  it('prints the band range around the overall estimate, not around some other number', () => {
    renderReport()

    // Overall is 7, so the hero range is [6.5, 7.5] — 0.5 either side, clamped
    // to [4, 9]. A literal en dash, per Report.tsx:473; reading the DOM rather
    // than typing the character again is what keeps this test honest about it.
    expect(document.querySelector('.rp-band-range')?.textContent).toBe('6.5–7.5')
  })

  it('names the same range and the same four criterion bands in the band-scale aria-label', () => {
    renderReport()

    // The accessible surface for the same numbers — a screen-reader user never
    // sees the visible hero text, only this aria-label. CRITERIA order is
    // TR, CC, LR, GRA (Report.tsx:15); task2 short labels come from
    // CRITERION_META in src/meta.ts.
    const scale = screen.getByRole('img', { name: /Band scale/ })
    expect(scale).toHaveAccessibleName(
      'Band scale 4 to 9: estimated range 6.5 to 7.5. Task 6.0, Coherence 6.5, Vocabulary 8.0, Grammar 5.5.',
    )
  })
})

describe('the criterion tiles', () => {
  it('gives each criterion tile its own band, not the overall', () => {
    renderReport()

    const tileBands = Array.from(document.querySelectorAll('.rp-tile-band')).map(
      (el) => el.textContent,
    )
    expect(tileBands).toEqual(['6.0', '6.5', '8.0', '5.5'])
  })
})
