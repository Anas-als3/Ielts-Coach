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
 *
 * The fourth and fifth blocks are the same defect one step further out. A
 * READING or LISTENING session produces no `IssueCategory` at all, so neither
 * is "inapplicable to some categories" — each is inapplicable to every one of
 * them, and the profile drops it entirely rather than counting it as a clean
 * essay. The Listening block asserts on the WHOLE profile object rather than on
 * one category, because there is no category a Listening paper could legitimately
 * move and a byte-identical profile is the strongest way to say so.
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
    section: 'writing',
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

/**
 * Strips `section` from an otherwise-valid session, producing the RAW wire
 * shape a pre-v4 record actually had — `section` did not exist yet, so it is
 * absent from the payload rather than present-and-wrong. Declared `unknown`,
 * not `Partial<SessionRecord>`, because typing it as a session (even a partial
 * one) would have the compiler assert the very field being removed; this
 * mirrors `makeSession`'s `unknown` return type in `tests/store.test.ts`,
 * which feeds the same pre-migration shape to the real migration ladder.
 */
function withoutSection(s: SessionRecord): unknown {
  const copy: Record<string, unknown> = { ...s }
  delete copy.section
  return copy
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

/* ------------------- Reading sessions are not writing sessions -------------- */

describe('a Reading session never dilutes a writing weakness', () => {
  /**
   * A sat Reading paper, as `App.tsx` persists one.
   *
   * It carries no `Analysis` and no word count, which is exactly the danger: to
   * arithmetic that averages "issues per 100 words" over every session, a
   * record with zero issues is indistinguishable from a flawless essay.
   */
  function readingSession(id: string, dateISO: string, module: Module = 'academic'): SessionRecord {
    return {
      section: 'reading',
      id,
      dateISO,
      module,
      testId: 'reading-academic-01',
      testTitle: 'Academic Reading Test 1',
      answers: {},
      durationSec: 3600,
      result: {
        testId: 'reading-academic-01',
        module,
        raw: 30,
        total: 40,
        band: 7,
        questions: [],
        byType: [],
      },
    }
  }

  /** Three Task 2 essays, each losing a mark for the same thing. */
  const ESSAYS: SessionRecord[] = [
    session('e1', '2026-01-01T00:00:00Z', 'task2', fakeAnalysis(['no-position'], 250)),
    session('e2', '2026-01-02T00:00:00Z', 'task2', fakeAnalysis(['no-position'], 250)),
    session('e3', '2026-01-03T00:00:00Z', 'task2', fakeAnalysis(['no-position'], 250)),
  ]

  /** The same learner, who then sat five Reading papers instead of writing. */
  const WITH_READING: SessionRecord[] = [
    ...ESSAYS,
    ...Array.from({ length: 5 }, (_, i) =>
      readingSession(`r${i}`, `2026-02-0${i + 1}T00:00:00Z`),
    ),
  ]

  it('leaves the no-position rate exactly where the essays put it', () => {
    const before = computeProfile(ESSAYS).categories['no-position']
    const after = computeProfile(WITH_READING).categories['no-position']

    expect(before).toBeDefined()
    // Not merely "close" — identical. The Reading papers are dropped before any
    // arithmetic runs, so there is nothing for them to move.
    expect(after).toEqual(before)
    // 1 issue per 250 words = 0.4 per 100 words, over the three essays only.
    expect(after?.recentRate).toBeCloseTo(0.4, 5)
    expect(after?.total).toBe(3)
    expect(after?.trend).toBe('flat')
  })

  it('does not count Reading papers towards the session total', () => {
    expect(computeProfile(WITH_READING).totalSessions).toBe(3)
  })

  it('keeps the weakness in the focus list after a run of Reading practice', () => {
    expect(computeProfile(WITH_READING).focusCategories).toContain('no-position')
  })

  it('plots no Reading paper on a writing trend line', () => {
    const trend = computeTrends(WITH_READING).find((t) => t.category === 'no-position')
    expect(trend?.perSession.map((p) => p.sessionId)).toEqual(['e1', 'e2', 'e3'])
  })

  it('drops Reading papers from BOTH exams, not just the active one', () => {
    const mixed: SessionRecord[] = [
      ...ESSAYS,
      readingSession('ra', '2026-02-01T00:00:00Z', 'academic'),
      readingSession('rg', '2026-02-02T00:00:00Z', 'general'),
    ]

    expect(computeProfile(mixed).totalSessions).toBe(3)
    expect(computeProfile(mixed).categories['no-position']).toEqual(
      computeProfile(ESSAYS).categories['no-position'],
    )
  })

  it('produces no profile at all from Reading papers alone', () => {
    const readingOnly = Array.from({ length: 4 }, (_, i) =>
      readingSession(`r${i}`, `2026-03-0${i + 1}T00:00:00Z`),
    )

    const profile = computeProfile(readingOnly)
    expect(profile.totalSessions).toBe(0)
    expect(profile.categories).toEqual({})
    expect(profile.focusCategories).toEqual([])
    expect(computeTrends(readingOnly)).toEqual([])
  })

  it('still counts a record written before `section` existed as writing', () => {
    // The migration stamps `section: 'writing'` on pre-v4 data, but the guards
    // default to writing anyway — a record that reaches the profile without the
    // field must keep counting exactly as it did before Reading shipped, which
    // is what every case above this block relies on.
    const preV4 = ESSAYS.map((s) => withoutSection(s) as SessionRecord)

    expect(computeProfile(preV4).totalSessions).toBe(3)
    expect(computeProfile(preV4).categories['no-position']?.total).toBe(3)
  })
})

/* ------------------ Listening sessions are not writing sessions ------------- */

describe('a Listening session never dilutes a writing weakness', () => {
  /**
   * A sat Listening paper, as `App.tsx` persists one.
   *
   * The same danger as a Reading paper and one extra trap: it carries no
   * `module` either, so a guard written as "not writing means it has a module"
   * would have let it through. The only thing that identifies it is `section`,
   * which is why `isWritingSession` names every answer-key section explicitly
   * rather than inferring.
   */
  function listeningSession(id: string, dateISO: string, practice = false): SessionRecord {
    return {
      section: 'listening',
      id,
      dateISO,
      testId: 'listening-01',
      testTitle: 'Listening Test 1',
      answers: {},
      durationSec: 1800,
      practice,
      result: {
        testId: 'listening-01',
        raw: 30,
        total: 40,
        band: 7,
        questions: [],
        byType: [],
        byFormat: [],
      },
    }
  }

  /** Three Task 2 essays, each losing a mark for the same thing. */
  const ESSAYS: SessionRecord[] = [
    session('e1', '2026-01-01T00:00:00Z', 'task2', fakeAnalysis(['no-position'], 250)),
    session('e2', '2026-01-02T00:00:00Z', 'task2', fakeAnalysis(['no-position'], 250)),
    session('e3', '2026-01-03T00:00:00Z', 'task2', fakeAnalysis(['no-position'], 250)),
  ]

  /** The same learner, who then sat five Listening papers instead of writing. */
  const WITH_LISTENING: SessionRecord[] = [
    ...ESSAYS,
    ...Array.from({ length: 5 }, (_, i) =>
      listeningSession(`l${i}`, `2026-02-0${i + 1}T00:00:00Z`),
    ),
  ]

  it('leaves the writing profile byte-identical', () => {
    const before = computeProfile(ESSAYS)
    const after = computeProfile(WITH_LISTENING)

    // Not merely "close", and not merely one category: the WHOLE profile is
    // unchanged. The Listening papers are dropped before any arithmetic runs,
    // so there is nothing anywhere for them to move.
    expect(after).toEqual(before)
    expect(after.categories['no-position']?.recentRate).toBeCloseTo(0.4, 5)
    expect(after.categories['no-position']?.total).toBe(3)
    expect(after.categories['no-position']?.trend).toBe('flat')
  })

  it('leaves every writing trend line byte-identical', () => {
    expect(computeTrends(WITH_LISTENING)).toEqual(computeTrends(ESSAYS))
  })

  it('does not count Listening papers towards the session total', () => {
    expect(computeProfile(WITH_LISTENING).totalSessions).toBe(3)
  })

  it('keeps the weakness in the focus list after a run of Listening practice', () => {
    expect(computeProfile(WITH_LISTENING).focusCategories).toContain('no-position')
  })

  it('drops practice-mode papers too', () => {
    const practised: SessionRecord[] = [
      ...ESSAYS,
      listeningSession('lp', '2026-02-01T00:00:00Z', true),
    ]

    expect(computeProfile(practised)).toEqual(computeProfile(ESSAYS))
  })

  it('produces no profile at all from Listening papers alone', () => {
    const listeningOnly = Array.from({ length: 4 }, (_, i) =>
      listeningSession(`l${i}`, `2026-03-0${i + 1}T00:00:00Z`),
    )

    const profile = computeProfile(listeningOnly)
    expect(profile.totalSessions).toBe(0)
    expect(profile.categories).toEqual({})
    expect(profile.focusCategories).toEqual([])
    expect(computeTrends(listeningOnly)).toEqual([])
  })

  it('drops Reading and Listening papers together, in any order', () => {
    const everything: SessionRecord[] = [
      ESSAYS[0],
      listeningSession('l1', '2026-01-05T00:00:00Z'),
      ESSAYS[1],
      {
        section: 'reading',
        id: 'r1',
        dateISO: '2026-01-06T00:00:00Z',
        module: 'academic',
        testId: 'reading-academic-01',
        testTitle: 'Academic Reading Test 1',
        answers: {},
        durationSec: 3600,
        result: {
          testId: 'reading-academic-01',
          module: 'academic',
          raw: 30,
          total: 40,
          band: 7,
          questions: [],
          byType: [],
        },
      },
      ESSAYS[2],
    ]

    expect(computeProfile(everything)).toEqual(computeProfile(ESSAYS))
    expect(computeProfile(everything).totalSessions).toBe(3)
  })
})

/* ---------------- an unrecognised section is not an essay ------------------- */

describe('the writing guard names every section explicitly', () => {
  const ESSAYS: SessionRecord[] = [
    session('e1', '2026-01-01T00:00:00Z', 'task2', fakeAnalysis(['no-position'], 250)),
    session('e2', '2026-01-02T00:00:00Z', 'task2', fakeAnalysis(['no-position'], 250)),
    session('e3', '2026-01-03T00:00:00Z', 'task2', fakeAnalysis(['no-position'], 250)),
  ]

  /** A record from a build that ships a section this one has never heard of. */
  function unknownSection(id: string, dateISO: string): SessionRecord {
    return { ...ESSAYS[0], id, dateISO, section: 'speaking' } as unknown as SessionRecord
  }

  it('does not count a section it has never heard of as a writing session', () => {
    // The guard used to be written as a fallthrough — "not reading and not
    // listening means writing" — so the FIRST unlisted section to ship counted
    // as an essay. An answer-key paper with no issues and no words is
    // arithmetically a flawless essay: it inflates `totalSessions` and drags
    // every error rate towards zero.
    const withSpeaking = [...ESSAYS, unknownSection('sp1', '2026-02-01T00:00:00Z')]

    expect(computeProfile(withSpeaking).totalSessions).toBe(3)
  })

  it('leaves the whole profile byte-identical, exactly as Listening does', () => {
    const withSpeaking = [
      ...ESSAYS,
      unknownSection('sp1', '2026-02-01T00:00:00Z'),
      unknownSection('sp2', '2026-02-02T00:00:00Z'),
      unknownSection('sp3', '2026-02-03T00:00:00Z'),
    ]

    expect(computeProfile(withSpeaking)).toEqual(computeProfile(ESSAYS))
    expect(computeTrends(withSpeaking)).toEqual(computeTrends(ESSAYS))
  })

  it('does not report an unearned improvement in a real weakness', () => {
    // The measured consequence, stated as the learner would see it: three
    // answer-key papers after three faulty essays used to bend the slope
    // downwards and flip the trend to `improving`, so the Dashboard said
    // "fewer errors" about a fault the learner had not touched.
    const withSpeaking = [
      ...ESSAYS,
      unknownSection('sp1', '2026-02-01T00:00:00Z'),
      unknownSection('sp2', '2026-02-02T00:00:00Z'),
      unknownSection('sp3', '2026-02-03T00:00:00Z'),
    ]

    expect(computeProfile(withSpeaking).categories['no-position']?.trend).toBe('flat')
  })

  it('still treats a record with NO section as writing', () => {
    // The documented default, unchanged: an absent field predates every
    // section, so it can only be an essay. Only a present-but-unknown VALUE is
    // treated as an answer key.
    const preV4 = ESSAYS.map((s) => withoutSection(s) as SessionRecord)

    expect(computeProfile(preV4).totalSessions).toBe(3)
  })
})

/* --------------------- calibration: the canonical constants ----------------- */

/**
 * The numbers in `profile.ts` that SPEC.md calls canonical, pinned by
 * behaviour.
 *
 * Every one of these survived being mutated with the whole suite green — EWMA
 * alpha 0.35 -> 0.9, the trend window 6 -> 2, the recent window 5 -> 1, the
 * focus limit 3 -> 1, and the two-session gate -> no gate — which means the
 * focus list, the app's main coaching signal, was not tested at all. A constant
 * nobody can change without a test failing is the only kind that stays
 * canonical.
 *
 * Each case below is built so that ONE constant decides the assertion, and the
 * comment on it says which other values it rules out.
 */
describe('the canonical profile constants are pinned', () => {
  /**
   * A session carrying `counts` issues per category over exactly 100 words, so
   * a count reads directly as a per-100-words rate and the arithmetic below can
   * be checked by hand.
   */
  function rated(
    id: string,
    dateISO: string,
    counts: Partial<Record<IssueCategory, number>>,
  ): SessionRecord {
    const categories: IssueCategory[] = []
    for (const [category, n] of Object.entries(counts) as Array<[IssueCategory, number]>) {
      for (let i = 0; i < n; i++) categories.push(category)
    }
    return session(id, dateISO, 'task2', fakeAnalysis(categories, 100))
  }

  /** Day `n` of January 2026, so a series stays in chronological order. */
  function day(n: number): string {
    return `2026-01-${String(n).padStart(2, '0')}T00:00:00Z`
  }

  it('smooths with EWMA alpha 0.35, not a recency-dominated one', () => {
    // Two faults, ranked by EWMA x severity (equal severity, so by EWMA).
    //   comma-splice: 4, 4, 4, 0, 0  — heavy, then apparently fixed
    //   article:      1, 1, 1, 2, 2  — mild, but getting worse
    // At alpha 0.35 the history still counts: comma-splice 1.690 beats article
    // 1.578, so it stays top of the focus list. The two curves cross at
    // alpha ~= 0.3675, so ANY larger alpha (0.4, the 0.9 the mutation used)
    // flips the order and fails this case. History is what makes the focus list
    // a coaching signal rather than a report on the last essay.
    const sessions = [
      rated('s1', day(1), { 'comma-splice': 4, article: 1 }),
      rated('s2', day(2), { 'comma-splice': 4, article: 1 }),
      rated('s3', day(3), { 'comma-splice': 4, article: 1 }),
      rated('s4', day(4), { article: 2 }),
      rated('s5', day(5), { article: 2 }),
    ]

    expect(computeProfile(sessions).focusCategories).toEqual(['comma-splice', 'article'])
  })

  it('reads the trend over the last 6 sessions', () => {
    // Rates: 0, 0, 6, 5, 4, 3, 2, 2.
    // Over the last 6 the slope is -0.857 — clearly improving, which is the
    // truth: the learner has cut this fault from 6 to 2. A window of 2 sees
    // only [2, 2], slope 0, and reports `flat`; a window of 8 picks up the two
    // zero-rate sessions from before the fault appeared, slope +0.167, and
    // reports `worsening` at a learner who is getting better.
    const rates = [0, 0, 6, 5, 4, 3, 2, 2]
    const sessions = rates.map((n, i) => rated(`s${i}`, day(i + 1), { 'comma-splice': n }))

    expect(computeProfile(sessions).categories['comma-splice']?.trend).toBe('improving')
  })

  it('aggregates recentRate over the last 5 sessions', () => {
    // Rates 0, 4, 3, 2, 1, 0 over 100 words each. The last 5 hold 10 issues
    // across 500 words = 2.0 per 100. Every other window gives a different
    // number — 1 -> 0, 2 -> 0.5, 3 -> 1.0, 4 -> 1.5, 6 -> 1.667 — so this one
    // assertion pins the window to exactly 5.
    const rates = [0, 4, 3, 2, 1, 0]
    const sessions = rates.map((n, i) => rated(`s${i}`, day(i + 1), { article: n }))

    expect(computeProfile(sessions).categories['article']?.recentRate).toBeCloseTo(2.0, 10)
    expect(computeProfile(sessions).categories['article']?.total).toBe(10)
  })

  it('focuses on exactly 3 categories, the worst 3', () => {
    // Four faults at four clearly different rates. Three is the number a
    // learner can hold in their head while writing; one is not a profile and
    // four is a list nobody acts on.
    const sessions = [
      rated('s1', day(1), { 'comma-splice': 4, article: 3, agreement: 2, fragment: 1 }),
      rated('s2', day(2), { 'comma-splice': 4, article: 3, agreement: 2, fragment: 1 }),
      rated('s3', day(3), { 'comma-splice': 4, article: 3, agreement: 2, fragment: 1 }),
    ]

    const focus = computeProfile(sessions).focusCategories
    expect(focus).toHaveLength(3)
    expect(focus).toEqual(['comma-splice', 'article', 'agreement'])
    expect(focus).not.toContain('fragment')
  })

  it('offers no focus list until a second session exists', () => {
    // `ErrorProfile.focusCategories` is documented "Empty until 2+ sessions
    // exist", and the reason is honesty: one essay is one topic on one day, and
    // ranking weaknesses from it would send a learner off to drill a fault they
    // may not actually have.
    const one = [rated('s1', day(1), { 'comma-splice': 4, article: 3 })]

    const profile = computeProfile(one)
    expect(profile.totalSessions).toBe(1)
    // The categories are still measured — only the RANKING waits.
    expect(profile.categories['comma-splice']).toBeDefined()
    expect(profile.focusCategories).toEqual([])
  })

  it('offers one as soon as the second session lands', () => {
    // The other side of the gate: 2 is the threshold, not 3 or more.
    const two = [
      rated('s1', day(1), { 'comma-splice': 4, article: 3 }),
      rated('s2', day(2), { 'comma-splice': 4, article: 3 }),
    ]

    expect(computeProfile(two).totalSessions).toBe(2)
    expect(computeProfile(two).focusCategories).toEqual(['comma-splice', 'article'])
  })

  it('counts only writing sessions towards that two-session gate', () => {
    // The gate and the section scoping meet here: one essay plus a Reading
    // paper is not two sessions of writing practice.
    const mixed: SessionRecord[] = [
      rated('s1', day(1), { 'comma-splice': 4 }),
      {
        section: 'reading',
        id: 'r1',
        dateISO: day(2),
        module: 'academic',
        testId: 'reading-academic-01',
        testTitle: 'Academic Reading Test 1',
        answers: {},
        durationSec: 3600,
        result: {
          testId: 'reading-academic-01',
          module: 'academic',
          raw: 30,
          total: 40,
          band: 7,
          questions: [],
          byType: [],
        },
      },
    ]

    expect(computeProfile(mixed).focusCategories).toEqual([])
  })
})
