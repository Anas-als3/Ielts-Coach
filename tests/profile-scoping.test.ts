/**
 * Task scoping of the error profile (SPEC.md "profile/").
 *
 * Regression suite for the defect where a category's per-100-words rate averaged
 * over EVERY session, including ones whose task could never have produced it.
 * A learner who wrote five Task 2 essays and then switched to Task 1 saw their
 * `no-position` rate fall towards zero and drop out of their focus list —
 * not because they had fixed anything, but because Task 1 does not evaluate
 * that rule at all.
 *
 * The second block is the important one: it pins `TASK1_ONLY_CATEGORIES` and
 * `TASK2_ONLY_CATEGORIES` against what the two pipelines ACTUALLY emit, so the
 * declared sets cannot silently drift away from the code.
 */
import { describe, expect, it } from 'vitest'
import { analyzeEssay, analyzeTask1 } from '../src/analysis/engine'
import { computeProfile, computeTrends } from '../src/profile/profile'
import {
  TASK1_ONLY_CATEGORIES,
  TASK2_ONLY_CATEGORIES,
  categoryAppliesTo,
} from '../src/meta'
import { PROMPTS } from '../src/prompts/bank'
import { TASK1_PROMPTS } from '../src/prompts/task1Bank'
import type { Analysis, IssueCategory, SessionRecord, TaskKind } from '../src/types'

/* --------------------------------- helpers ---------------------------------- */

function session(
  id: string,
  dateISO: string,
  task: TaskKind,
  analysis: Analysis,
): SessionRecord {
  return {
    id,
    dateISO,
    mode: 'coach',
    task,
    promptId: null,
    promptText: '',
    questionType: null,
    essayText: '',
    durationSec: null,
    pacing: null,
    pasteAttempts: null,
    analysis,
  }
}

/** An analysis carrying exactly the issues named, over `words` words. */
function fakeAnalysis(categories: IssueCategory[], words: number): Analysis {
  return {
    issues: categories.map((category, i) => ({
      id: `i${i}`,
      category,
      criterion: 'TR' as const,
      severity: 'error' as const,
      message: 'x',
      start: null,
      end: null,
    })),
    paragraphs: [],
    structure: [],
    stats: {
      wordCount: words,
      sentenceCount: 10,
      paragraphCount: 4,
      avgSentenceLength: words / 10,
      sentenceLengthStdDev: 5,
      typeTokenRatio: 0.6,
      linkingDeviceCount: 6,
    },
    band: {
      overall: 6,
      byCriterion: { TR: 6, CC: 6, LR: 6, GRA: 6 },
      rationale: { TR: [], CC: [], LR: [], GRA: [] },
    },
  }
}

/* ------------------------------ rate scoping -------------------------------- */

describe('a category only averages over sessions that could produce it', () => {
  it('does not let Task 1 sessions dilute a Task 2 weakness', () => {
    // Two Task 2 essays with the fault, then three Task 1 answers that cannot
    // possibly contain it. The learner has fixed nothing.
    const sessions: SessionRecord[] = [
      session('a', '2026-01-01T00:00:00Z', 'task2', fakeAnalysis(['no-position'], 250)),
      session('b', '2026-01-02T00:00:00Z', 'task2', fakeAnalysis(['no-position'], 250)),
      session('c', '2026-01-03T00:00:00Z', 'task1', fakeAnalysis([], 180)),
      session('d', '2026-01-04T00:00:00Z', 'task1', fakeAnalysis([], 180)),
      session('e', '2026-01-05T00:00:00Z', 'task1', fakeAnalysis([], 180)),
    ]

    const stat = computeProfile(sessions).categories['no-position']
    expect(stat).toBeDefined()
    // Rate reflects the two Task 2 essays only: 1 issue per 250 words = 0.4.
    expect(stat?.recentRate).toBeCloseTo(0.4, 5)
    expect(stat?.trend).toBe('flat')
    expect(stat?.total).toBe(2)
  })

  it('still counts a task-agnostic category across both tasks', () => {
    const sessions: SessionRecord[] = [
      session('a', '2026-01-01T00:00:00Z', 'task2', fakeAnalysis(['article'], 250)),
      session('b', '2026-01-02T00:00:00Z', 'task1', fakeAnalysis(['article'], 250)),
    ]

    const stat = computeProfile(sessions).categories['article']
    expect(stat?.total).toBe(2)
    expect(stat?.recentRate).toBeCloseTo(0.4, 5)
  })

  it('keeps a Task 2 weakness in the focus list after a run of Task 1 practice', () => {
    const sessions: SessionRecord[] = [
      session('a', '2026-01-01T00:00:00Z', 'task2', fakeAnalysis(['no-position'], 250)),
      session('b', '2026-01-02T00:00:00Z', 'task2', fakeAnalysis(['no-position'], 250)),
      ...Array.from({ length: 6 }, (_, i) =>
        session(`t${i}`, `2026-02-0${i + 1}T00:00:00Z`, 'task1', fakeAnalysis([], 180)),
      ),
    ]

    expect(computeProfile(sessions).focusCategories).toContain('no-position')
  })

  it('omits inapplicable sessions from a trend series', () => {
    const sessions: SessionRecord[] = [
      session('a', '2026-01-01T00:00:00Z', 'task2', fakeAnalysis(['no-position'], 250)),
      session('b', '2026-01-02T00:00:00Z', 'task1', fakeAnalysis(['t1-overview-missing'], 180)),
    ]

    const trends = computeTrends(sessions)
    const noPosition = trends.find((t) => t.category === 'no-position')
    const overview = trends.find((t) => t.category === 't1-overview-missing')

    expect(noPosition?.perSession.map((p) => p.sessionId)).toEqual(['a'])
    expect(overview?.perSession.map((p) => p.sessionId)).toEqual(['b'])
  })

  it('never divides by zero when a category applies to no stored session', () => {
    const sessions = [session('a', '2026-01-01T00:00:00Z', 'task1', fakeAnalysis([], 180))]
    expect(() => computeProfile(sessions)).not.toThrow()
    expect(computeProfile(sessions).categories['no-position']).toBeUndefined()
  })
})

/* --------------------- the sets match what the code emits -------------------- */

describe('the declared category-task sets match the real pipelines', () => {
  /** Every category either pipeline emits across a broad sample of inputs. */
  function emitted(run: (text: string) => Analysis, texts: string[]): Set<IssueCategory> {
    const out = new Set<IssueCategory>()
    for (const t of texts) for (const i of run(t).issues) out.add(i.category)
    return out
  }

  // Deliberately faulty answers, chosen to light up as many rules as possible.
  const MESSY = `i dont think this is a good thing. Every coin has two sides, and lots of stuff is bad to people.

Because the government should act. However it is clear, they cant. A random women who steal is a human being, the key for success depend of hard work in home.

Kids get a lot of things, they are nice. Things are good. Things are bad. Stuff is fine.

In my opinion the reason of this problem is 47 per cent of people, therefore it will continue to rise in the future.`

  const texts = [
    '',
    'Short.',
    MESSY,
    `${MESSY}\n\n${MESSY}`,
  ]

  it('emits no Task-1-only category from the Task 2 pipeline', () => {
    for (const prompt of PROMPTS.slice(0, 5)) {
      const fired = emitted((t) => analyzeEssay(t, prompt), texts)
      for (const c of fired) {
        expect(TASK1_ONLY_CATEGORIES.has(c), `${prompt.id} emitted Task-1-only "${c}"`).toBe(false)
        expect(categoryAppliesTo(c, 'task2'), `"${c}" should apply to task2`).toBe(true)
      }
    }
  })

  it('emits no Task-2-only category from the Task 1 pipeline', () => {
    for (const prompt of TASK1_PROMPTS.slice(0, 5)) {
      const fired = emitted((t) => analyzeTask1(t, prompt), texts)
      for (const c of fired) {
        expect(TASK2_ONLY_CATEGORIES.has(c), `${prompt.id} emitted Task-2-only "${c}"`).toBe(false)
        expect(categoryAppliesTo(c, 'task1'), `"${c}" should apply to task1`).toBe(true)
      }
    }
  })

  it('declares the two sets as disjoint', () => {
    for (const c of TASK1_ONLY_CATEGORIES) {
      expect(TASK2_ONLY_CATEGORIES.has(c), `"${c}" is in both sets`).toBe(false)
    }
  })
})
