/**
 * Plan 014: the drill loop. `computeProfile` names a learner's top-three
 * weaknesses (`focusCategories`) and the Dashboard showed them — but its
 * "practise" affordance, `handleStartPractice`, took a `focus: IssueCategory
 * | null` argument and discarded it (`_focus`), so every "practise" click,
 * named category or not, handed back the same blank essay.
 *
 * This suite pins the two halves the fix had to close:
 *
 * 1. `Dashboard.tsx` must actually CALL `onStartPractice` with the category
 *    the learner clicked, not `null` — the per-card "Practise this" button.
 * 2. `App.tsx`'s `handleStartPractice` must actually USE that argument: the
 *    desk retargets to a task/prompt suited to drilling the category where
 *    the bank supports it (`meta.ts`'s `LETTER_ONLY_CATEGORIES` /
 *    `TASK1_ONLY_CATEGORIES` / `TASK2_ONLY_CATEGORIES`), and a dismissible
 *    "Drilling: <category>" banner names it and its hint. A category neither
 *    set claims (most GRA/LR faults — they fire on either task, so the bank
 *    has nothing more specific to offer) leaves the desk exactly as a plain
 *    "Start practice" would, and still shows the banner.
 *
 * Part 2's App-level cases seed `localStorage` directly with hand-built
 * `WritingSessionRecord`s rather than typing essays through the real rule
 * engine: `computeProfile`'s focus-category maths is already covered
 * elsewhere (`tests/profile-scoping.test.ts`), so a fixture only needs to
 * name the category, the task and the module a learner's history shares that
 * category's real scope in (see `meta.ts`'s `categoryAppliesTo`) — the same
 * pattern `tests/profile-scoping.test.ts`'s `session`/`fakeAnalysis` use.
 * `renderApp()` draws its OWN random prompts for whatever task ends up on the
 * desk (`randomTask1Prompt` / `randomLetterPrompt` / `randomPrompt`, exactly
 * like production), so nothing here may assert on which exact prompt landed
 * — only on the task/module family, per `tests/ui/renderApp.tsx`'s rule.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dashboard from '../../src/components/Dashboard'
import { CATEGORY_META } from '../../src/meta'
import { renderApp } from './renderApp'
import type {
  Analysis,
  ErrorProfile,
  ImportSummary,
  IssueCategory,
  Module,
  TaskKind,
  WritingSessionRecord,
} from '../../src/types'

const STORAGE_KEY = 'ielts-coach.v1'

/* --------------------------------- fixtures --------------------------------- */

/** An analysis carrying exactly one issue of `category`, over 250 words —
 *  mirrors `tests/profile-scoping.test.ts`'s `fakeAnalysis`. */
function fakeAnalysis(category: IssueCategory): Analysis {
  return {
    issues: [
      {
        id: 'i0',
        category,
        criterion: CATEGORY_META[category].criterion,
        severity: 'error',
        message: 'x',
        start: null,
        end: null,
      },
    ],
    paragraphs: [],
    structure: [],
    stats: {
      wordCount: 250,
      sentenceCount: 12,
      paragraphCount: 4,
      avgSentenceLength: 20,
      sentenceLengthStdDev: 4,
      typeTokenRatio: 0.6,
      linkingDeviceCount: 5,
    },
    band: {
      overall: 6,
      byCriterion: { TR: 6, CC: 6, LR: 6, GRA: 6 },
      rationale: { TR: [], CC: [], LR: [], GRA: [] },
    },
  }
}

function writingSession(
  id: string,
  dateISO: string,
  task: TaskKind,
  module: Module,
  category: IssueCategory,
): WritingSessionRecord {
  return {
    section: 'writing',
    id,
    dateISO,
    mode: 'coach',
    task,
    module,
    promptId: null,
    promptText: '',
    questionType: null,
    essayText: 'placeholder essay text',
    durationSec: null,
    pacing: null,
    pasteAttempts: null,
    analysis: fakeAnalysis(category),
  }
}

/**
 * Two sessions bearing exactly one category, in the task/module that
 * category actually fires in — enough for `computeProfile` to put it alone at
 * the top of `focusCategories` (2+ sessions, EWMA > 0, nothing else to rank
 * against). Written straight to storage rather than typed through the engine:
 * this suite is about what "practise" DOES with a focus category, not about
 * which essays produce one.
 */
function seedFocusCategory(category: IssueCategory, task: TaskKind, module: Module): void {
  const sessions = [
    writingSession('s1', '2026-01-01T00:00:00.000Z', task, module, category),
    writingSession('s2', '2026-01-02T00:00:00.000Z', task, module, category),
  ]
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6, sessions, deletedIds: [] }))
}

/* ----------------------------------- helpers --------------------------------- */

function taskButton(name: 'Task 1' | 'Task 2'): HTMLElement {
  return within(screen.getByRole('group', { name: 'IELTS task' })).getByRole('button', { name })
}

function moduleButton(name: 'Academic' | 'General'): HTMLElement {
  return within(screen.getByRole('group', { name: 'IELTS exam type' })).getByRole('button', {
    name,
  })
}

async function goToProgress(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(within(document.querySelector('.nav') as HTMLElement).getByText('Progress'))
}

/** The "Practise this" button on the focus card named `label`. */
function drillButton(label: string): HTMLElement {
  return screen.getByRole('button', { name: `Practise ${label}` })
}

/**
 * Waits for a category's focus card to render. `findByText` alone is
 * ambiguous once the session table below also renders — its "Top issue"
 * column repeats the same label per row — so this resolves the card's own
 * `<h3 class="db-focus-label">` heading specifically.
 */
function waitForFocusCard(label: string): Promise<HTMLElement> {
  return screen.findByRole('heading', { level: 3, name: label })
}

/* ============================================================================
 * 1. Dashboard: the per-category button actually names its category
 * ============================================================================ */

describe('Dashboard: each focus card practises ITS OWN category', () => {
  const PROFILE: ErrorProfile = {
    totalSessions: 2,
    categories: {
      'comma-splice': { total: 2, recentRate: 0.8, trend: 'flat', lastSeenISO: '2026-01-02T00:00:00.000Z' },
      article: { total: 2, recentRate: 0.8, trend: 'flat', lastSeenISO: '2026-01-02T00:00:00.000Z' },
    },
    focusCategories: ['comma-splice', 'article'],
  }

  function noopImport(): ImportSummary {
    return { mode: 'replace', sessionCount: 0, evictedCount: 0 }
  }

  function renderDashboardWithFocus(onStartPractice: (focus: IssueCategory | null) => void) {
    const session: WritingSessionRecord = writingSession(
      'x',
      '2026-01-02T00:00:00.000Z',
      'task2',
      'academic',
      'comma-splice',
    )
    render(
      <Dashboard
        sessions={[session]}
        allSessions={[session]}
        profile={PROFILE}
        trends={[]}
        onOpenSession={() => {}}
        onStartPractice={onStartPractice}
        onDeleteSession={() => {}}
        onExport={() => {}}
        onImport={noopImport}
        prefs={{}}
        latestBandBySection={{}}
        onUpdatePrefs={() => {}}
        module="academic"
        onSwitchModule={() => {}}
      />,
    )
  }

  it('the header "Start practice" button still passes null', async () => {
    const user = userEvent.setup()
    const onStartPractice = vi.fn()
    renderDashboardWithFocus(onStartPractice)

    await user.click(screen.getByRole('button', { name: 'Start practice' }))

    expect(onStartPractice).toHaveBeenCalledWith(null)
  })

  it('clicking the comma-splice card practises comma-splice, not article', async () => {
    const user = userEvent.setup()
    const onStartPractice = vi.fn()
    renderDashboardWithFocus(onStartPractice)

    await user.click(drillButton(CATEGORY_META['comma-splice'].label))

    expect(onStartPractice).toHaveBeenCalledTimes(1)
    expect(onStartPractice).toHaveBeenCalledWith('comma-splice')
  })

  it('clicking the article card practises article, not comma-splice', async () => {
    const user = userEvent.setup()
    const onStartPractice = vi.fn()
    renderDashboardWithFocus(onStartPractice)

    await user.click(drillButton(CATEGORY_META['article'].label))

    expect(onStartPractice).toHaveBeenCalledTimes(1)
    expect(onStartPractice).toHaveBeenCalledWith('article')
  })
})

/* ============================================================================
 * 2. App: the desk actually retargets, and the banner actually names it
 * ============================================================================ */

describe('App: practising a named weakness targets the desk', () => {
  it('a category both tasks can fire leaves the desk alone, and still bannered', async () => {
    // 'article' is claimed by neither TASK1_ONLY_CATEGORIES, TASK2_ONLY_CATEGORIES
    // nor LETTER_ONLY_CATEGORIES — categoryAppliesTo's fallthrough — so the bank
    // has no task/module signal to retarget with.
    seedFocusCategory('article', 'task2', 'academic')
    const user = userEvent.setup()
    renderApp()

    await goToProgress(user)
    await waitForFocusCard(CATEGORY_META['article'].label)
    await user.click(drillButton(CATEGORY_META['article'].label))

    // Desk left exactly as a plain "Start practice" would: still Task 2.
    expect(taskButton('Task 2')).toHaveClass('active')
    expect(screen.getByText(`Drilling: ${CATEGORY_META['article'].label}`)).toBeInTheDocument()
    expect(screen.getByText(CATEGORY_META['article'].hint)).toBeInTheDocument()
    // A fresh, blank essay — not the old one reappearing.
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('')
  })

  it('a task-agnostic category discards an essay in progress without asking, exactly like the plain "Start practice" button does', async () => {
    // Deliberate: this branch behaves exactly like `onStartPractice(null)`
    // always has (see the "the header 'Start practice' button" case above and
    // `handleStartPractice`'s `selection === null` branch) — no task/module
    // retargeting happens, so nothing MORE disruptive is happening than the
    // plain button already did without asking. Only the branches that
    // actually retarget the desk (Task 1 chart / GT letter / forced Task 2)
    // ask consent, because only THOSE branches introduce new destructive
    // behaviour beyond what "Start practice" already did silently.
    seedFocusCategory('article', 'task2', 'academic')
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm')
    renderApp()

    const sheet = screen.getByRole('textbox') as HTMLTextAreaElement
    sheet.focus()
    await user.paste('An essay already in progress.')

    await goToProgress(user)
    await waitForFocusCard(CATEGORY_META['article'].label)
    await user.click(drillButton(CATEGORY_META['article'].label))

    expect(confirmSpy).not.toHaveBeenCalled()
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('')
    expect(screen.getByText(`Drilling: ${CATEGORY_META['article'].label}`)).toBeInTheDocument()
  })

  it('a Task 1 chart-only category switches the desk to Task 1 / Academic', async () => {
    seedFocusCategory('t1-invented-figure', 'task1', 'academic')
    const user = userEvent.setup()
    renderApp()

    await goToProgress(user)
    await waitForFocusCard(CATEGORY_META['t1-invented-figure'].label)
    await user.click(drillButton(CATEGORY_META['t1-invented-figure'].label))

    expect(taskButton('Task 1')).toHaveClass('active')
    expect(moduleButton('Academic')).toHaveClass('active')
    // The chart sheet, not the letter one — Academic Task 1.
    expect(document.querySelectorAll('.chart')).toHaveLength(1)
    expect(
      screen.getByText(`Drilling: ${CATEGORY_META['t1-invented-figure'].label}`),
    ).toBeInTheDocument()
  })

  it('a General Training letter-only category switches the desk to Task 1 / General', async () => {
    seedFocusCategory('gt-signoff-pairing', 'task1', 'general')
    const user = userEvent.setup()
    renderApp()

    await goToProgress(user)
    await waitForFocusCard(CATEGORY_META['gt-signoff-pairing'].label)
    await user.click(drillButton(CATEGORY_META['gt-signoff-pairing'].label))

    expect(taskButton('Task 1')).toHaveClass('active')
    expect(moduleButton('General')).toHaveClass('active')
    // The letter's bullet points, not a chart.
    expect(document.querySelector('.gt-bullets')).toBeInTheDocument()
    expect(document.querySelectorAll('.chart')).toHaveLength(0)
    expect(
      screen.getByText(`Drilling: ${CATEGORY_META['gt-signoff-pairing'].label}`),
    ).toBeInTheDocument()
  })

  it('a Task 2-only category pulls the desk back from Task 1 to Task 2', async () => {
    seedFocusCategory('off-topic', 'task2', 'academic')
    const user = userEvent.setup()
    renderApp()
    // Move the desk onto Task 1 first — an empty sheet asks no confirm — so
    // this case actually exercises the switch, not merely "stays on Task 2".
    await user.click(taskButton('Task 1'))
    expect(taskButton('Task 1')).toHaveClass('active')

    await goToProgress(user)
    await waitForFocusCard(CATEGORY_META['off-topic'].label)
    await user.click(drillButton(CATEGORY_META['off-topic'].label))

    expect(taskButton('Task 2')).toHaveClass('active')
    expect(screen.getByText(`Drilling: ${CATEGORY_META['off-topic'].label}`)).toBeInTheDocument()
  })

  it('the banner dismisses independently of the essay', async () => {
    seedFocusCategory('article', 'task2', 'academic')
    const user = userEvent.setup()
    renderApp()

    await goToProgress(user)
    await waitForFocusCard(CATEGORY_META['article'].label)
    await user.click(drillButton(CATEGORY_META['article'].label))
    await screen.findByText(`Drilling: ${CATEGORY_META['article'].label}`)

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(screen.queryByText(`Drilling: ${CATEGORY_META['article'].label}`)).not.toBeInTheDocument()
    // Dismissing the banner is not abandoning the essay.
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('retargeting a real essay in progress asks first, and declining changes nothing', async () => {
    seedFocusCategory('t1-invented-figure', 'task1', 'academic')
    const user = userEvent.setup()
    renderApp()

    const sheet = screen.getByRole('textbox') as HTMLTextAreaElement
    sheet.focus()
    await user.paste('An essay already in progress on the Task 2 desk.')

    await goToProgress(user)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await waitForFocusCard(CATEGORY_META['t1-invented-figure'].label)
    await user.click(drillButton(CATEGORY_META['t1-invented-figure'].label))

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(confirmSpy.mock.calls[0][0]).toMatch(/clears the answer sheet/i)
    // Declined: still on Progress, nothing retargeted or cleared.
    expect(screen.getByText('Writing record')).toBeInTheDocument()

    await user.click(within(document.querySelector('.nav') as HTMLElement).getByText('Write'))
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'An essay already in progress on the Task 2 desk.',
    )
    expect(taskButton('Task 2')).toHaveClass('active')
    expect(screen.queryByText(/^Drilling:/)).not.toBeInTheDocument()
  })

  it('starting a plain new essay afterwards clears a leftover drill banner', async () => {
    seedFocusCategory('article', 'task2', 'academic')
    const user = userEvent.setup()
    renderApp()

    await goToProgress(user)
    await waitForFocusCard(CATEGORY_META['article'].label)
    await user.click(drillButton(CATEGORY_META['article'].label))
    await screen.findByText(`Drilling: ${CATEGORY_META['article'].label}`)

    // Back to Progress for the header's plain (focus-less) "Start practice".
    await goToProgress(user)
    await user.click(screen.getByRole('button', { name: 'Start practice' }))

    await waitFor(() =>
      expect(screen.queryByText(`Drilling: ${CATEGORY_META['article'].label}`)).not.toBeInTheDocument(),
    )
  })
})
