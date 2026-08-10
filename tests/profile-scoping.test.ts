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
 *
 * The third block extends both halves to the LETTER pipeline, which needed the
 * scope to grow a module dimension: Academic Task 1 (a chart) and General
 * Training Task 1 (a letter) share the id `'task1'` and share almost no rules,
 * so `TaskKind` alone cannot say which of them a category belongs to.
 */
import { describe, expect, it } from 'vitest'
import { analyzeEssay, analyzeLetter, analyzeTask1 } from '../src/analysis/engine'
import { computeProfile, computeTrends } from '../src/profile/profile'
import {
  LETTER_ONLY_CATEGORIES,
  TASK1_ONLY_CATEGORIES,
  TASK2_ONLY_CATEGORIES,
  categoryAppliesTo,
} from '../src/meta'
import { PROMPTS } from '../src/prompts/bank'
import { TASK1_PROMPTS } from '../src/prompts/task1Bank'
import { LETTER_PROMPTS } from '../src/prompts/letterBank'
import type { Analysis, IssueCategory, Module, SessionRecord, TaskKind } from '../src/types'

/* --------------------------------- helpers ---------------------------------- */

function session(
  id: string,
  dateISO: string,
  task: TaskKind,
  analysis: Analysis,
  // Optional and defaulted, so every existing case below keeps meaning exactly
  // what it meant before letters existed: Academic was the only exam whose
  // Task 1 the app implemented.
  module: Module = 'academic',
): SessionRecord {
  return {
    id,
    dateISO,
    mode: 'coach',
    task,
    module,
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

/* ------------------- the letter pipeline, scoped by MODULE ------------------- */

describe('letter categories are scoped to General Training Task 1', () => {
  /** Every category the letter pipeline emits across a broad sample of inputs. */
  function emittedByLetters(texts: string[]): Set<IssueCategory> {
    const out = new Set<IssueCategory>()
    for (const prompt of LETTER_PROMPTS.slice(0, 5)) {
      for (const t of texts) for (const i of analyzeLetter(t, prompt).issues) out.add(i.category)
    }
    return out
  }

  // Deliberately bad letters: no greeting, the wrong sign-off for the greeting,
  // slang in a formal letter, bullets left unanswered.
  const CLASHING = `Hi Dave,

hey mate, i wanted to say that the thing you sold me is rubbish and i cant use it. it stopped working and thats not ok. loads of my friends said the same.

Yours faithfully,

Sam`
  const NO_GREETING = `The washing machine I bought has broken twice, and nobody has come to look at it. The engineer promised a visit and never arrived, which is not acceptable at all. I have been without a machine for three weeks now, and the shop has not replied to either of my messages.`

  const texts = ['', 'Short.', CLASHING, NO_GREETING, `${NO_GREETING}\n\n${NO_GREETING}`]

  it('emits no Task-2-only category from the letter pipeline', () => {
    for (const c of emittedByLetters(texts)) {
      expect(TASK2_ONLY_CATEGORIES.has(c), `letters emitted Task-2-only "${c}"`).toBe(false)
    }
  })

  it('emits no Academic-Task-1-only category from the letter pipeline', () => {
    // A letter has no chart, so nothing in the t1-* family can apply to it.
    for (const c of emittedByLetters(texts)) {
      expect(TASK1_ONLY_CATEGORIES.has(c), `letters emitted chart-only "${c}"`).toBe(false)
    }
  })

  it('every letter-only category it emits is declared letter-only', () => {
    for (const c of emittedByLetters(texts)) {
      if (!c.startsWith('gt-')) continue
      expect(LETTER_ONLY_CATEGORIES.has(c), `"${c}" is emitted but not declared`).toBe(true)
      expect(categoryAppliesTo(c, 'task1', 'general')).toBe(true)
      expect(categoryAppliesTo(c, 'task1', 'academic')).toBe(false)
      expect(categoryAppliesTo(c, 'task2', 'general')).toBe(false)
    }
  })

  it('emits no letter-only category from either Academic pipeline', () => {
    for (const prompt of PROMPTS.slice(0, 5)) {
      for (const i of analyzeEssay(CLASHING, prompt).issues) {
        expect(LETTER_ONLY_CATEGORIES.has(i.category), `essay emitted "${i.category}"`).toBe(false)
      }
    }
    for (const prompt of TASK1_PROMPTS.slice(0, 5)) {
      for (const i of analyzeTask1(CLASHING, prompt).issues) {
        expect(LETTER_ONLY_CATEGORIES.has(i.category), `chart emitted "${i.category}"`).toBe(false)
      }
    }
  })

  it('declares the three sets as pairwise disjoint', () => {
    for (const c of LETTER_ONLY_CATEGORIES) {
      expect(TASK1_ONLY_CATEGORIES.has(c), `"${c}" is in two sets`).toBe(false)
      expect(TASK2_ONLY_CATEGORIES.has(c), `"${c}" is in two sets`).toBe(false)
    }
  })

  it('keeps a chart category out of a General Training Task 1 session', () => {
    // The two tasks share the id 'task1'. Without the module dimension, a
    // learner who moved from Academic chart practice to General Training letters
    // would see their `t1-overview-missing` rate fall towards zero and drop out
    // of their focus list — not because they had fixed anything, but because a
    // letter never evaluates that rule at all.
    const sessions: SessionRecord[] = [
      session('a', '2026-01-01T00:00:00Z', 'task1', fakeAnalysis(['t1-overview-missing'], 180)),
      session('b', '2026-01-02T00:00:00Z', 'task1', fakeAnalysis(['t1-overview-missing'], 180)),
      ...Array.from({ length: 4 }, (_, i) =>
        session(`g${i}`, `2026-02-0${i + 1}T00:00:00Z`, 'task1', fakeAnalysis([], 180), 'general'),
      ),
    ]

    const stat = computeProfile(sessions).categories['t1-overview-missing']
    // Averaged over the two Academic sessions only: 1 issue per 180 words.
    expect(stat?.recentRate).toBeCloseTo((1 / 180) * 100, 5)
    expect(stat?.total).toBe(2)
  })

  it('scopes a letter weakness to the letters, not to every Task 1 session', () => {
    const sessions: SessionRecord[] = [
      session('a', '2026-01-01T00:00:00Z', 'task1', fakeAnalysis(['gt-signoff-pairing'], 180), 'general'),
      session('b', '2026-01-02T00:00:00Z', 'task1', fakeAnalysis(['gt-signoff-pairing'], 180), 'general'),
      ...Array.from({ length: 4 }, (_, i) =>
        session(`t${i}`, `2026-02-0${i + 1}T00:00:00Z`, 'task1', fakeAnalysis([], 180)),
      ),
    ]

    const stat = computeProfile(sessions).categories['gt-signoff-pairing']
    expect(stat?.total).toBe(2)
    expect(stat?.recentRate).toBeCloseTo((1 / 180) * 100, 5)
    expect(computeProfile(sessions).focusCategories).toContain('gt-signoff-pairing')

    // And the trend series plots only the sessions that could have produced it.
    const trend = computeTrends(sessions).find((t) => t.category === 'gt-signoff-pairing')
    expect(trend?.perSession.map((p) => p.sessionId)).toEqual(['a', 'b'])
  })
})
