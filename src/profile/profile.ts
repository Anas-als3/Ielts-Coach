/**
 * Personal error-profile computation across saved sessions.
 *
 * Pure functions over SessionRecord[] — no storage access, no memoization.
 * All maths guard against empty inputs and zero word counts.
 *
 * Canonical constants (SPEC.md "profile/"):
 *   EWMA alpha = 0.35 over per-session per-100-words rates, chronological order.
 *   Trend = least-squares slope over the last 6 sessions' rates
 *           (improving < -0.05, worsening > 0.05, else flat).
 *   focusCategories = top 3 by EWMA x severity weight (error 3, warning 2, info 1),
 *           EWMA > 0 only, and only once 2+ sessions exist.
 *
 * TASK SCOPING: every rate is averaged only over sessions where the category
 * COULD have fired (see meta.ts -> categoryAppliesTo). A Task 1 session is not
 * evidence that a learner has stopped losing marks for `no-position` — Task 1
 * never evaluates that rule. Counting it as a clean run reads as improvement
 * the learner did not earn, and drags a real weakness out of their focus list.
 * The scope is (task, MODULE): General Training Task 1 is a letter and Academic
 * Task 1 is a chart description, so the two share a `TaskKind` while sharing
 * almost no rules.
 *
 * SECTION SCOPING is the same argument taken one step further, and it is
 * absolute rather than per-category. A READING session produces no
 * `IssueCategory` at all — it is an answer key, not an analysis — so every
 * category would count it as a session that could have fired and did not. Five
 * Reading papers would read as five clean essays and pull every writing rate
 * towards zero. Reading sessions are therefore dropped before any maths runs,
 * by BOTH exported functions; `tests/profile-scoping.test.ts` pins it.
 */

import type {
  CategoryStat,
  CategoryTrend,
  ErrorProfile,
  Issue,
  IssueCategory,
  SessionRecord,
  Severity,
  WritingSessionRecord,
} from '../types'
import { isWritingSession } from '../types'
import { categoryAppliesTo } from '../meta'

const EWMA_ALPHA = 0.35
const TREND_WINDOW = 6
const RECENT_WINDOW = 5
const IMPROVING_SLOPE = -0.05
const WORSENING_SLOPE = 0.05
const FOCUS_LIMIT = 3

const SEVERITY_WEIGHT: Record<Severity, number> = { error: 3, warning: 2, info: 1 }

type CategoryCounts = Partial<Record<IssueCategory, number>>

/**
 * The writing sessions, in input order. Everything below runs over this list
 * and never over the raw one.
 *
 * A Reading session carries no issues and no word count, so leaving it in
 * would contribute a zero-issue, zero-word row to every category's series —
 * arithmetically a clean essay. See the section-scoping note at the top.
 */
function writingOnly(sessions: SessionRecord[]): WritingSessionRecord[] {
  return sessions.filter(isWritingSession)
}

/** Defensive: imported data may be missing pieces despite validation. */
function sessionIssues(s: WritingSessionRecord): Issue[] {
  const issues = s.analysis?.issues
  return Array.isArray(issues) ? issues : []
}

/** Effective word count for rate maths; 0 when absent or non-positive. */
function sessionWordCount(s: WritingSessionRecord): number {
  const n = s.analysis?.stats?.wordCount
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0
}

/** Issues per 100 words; 0 when the word count is 0 (never divides by zero). */
function per100Words(count: number, words: number): number {
  return words > 0 ? (count / words) * 100 : 0
}

/** Oldest first. ISO-8601 date strings sort correctly as text. */
function sortChronological(sessions: WritingSessionRecord[]): WritingSessionRecord[] {
  return sessions.slice().sort((a, b) => a.dateISO.localeCompare(b.dateISO))
}

/** Per-session issue counts per category, aligned with the given session order. */
function countsBySession(sessions: WritingSessionRecord[]): CategoryCounts[] {
  return sessions.map((s) => {
    const counts: CategoryCounts = {}
    for (const issue of sessionIssues(s)) {
      counts[issue.category] = (counts[issue.category] ?? 0) + 1
    }
    return counts
  })
}

/** Slope of the least-squares line through (0, y0)...(n-1, yn-1); 0 when n < 2. */
function leastSquaresSlope(values: number[]): number {
  const n = values.length
  if (n < 2) return 0
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += values[i]
    sumXY += i * values[i]
    sumXX += i * i
  }
  const denominator = n * sumXX - sumX * sumX
  if (denominator === 0) return 0
  return (n * sumXY - sumX * sumY) / denominator
}

/** EWMA over chronological rates, seeded with the first value; 0 for an empty series. */
function ewma(rates: number[]): number {
  if (rates.length === 0) return 0
  let value = rates[0]
  for (let i = 1; i < rates.length; i++) {
    value = EWMA_ALPHA * rates[i] + (1 - EWMA_ALPHA) * value
  }
  return value
}

/**
 * Severity weight for a category, taken from its most recent occurrence
 * (highest-severity issue within the latest session where the category fired).
 */
function latestSeverityWeight(
  orderedSessions: WritingSessionRecord[],
  category: IssueCategory,
): number {
  for (let i = orderedSessions.length - 1; i >= 0; i--) {
    let best = 0
    for (const issue of sessionIssues(orderedSessions[i])) {
      if (issue.category === category) {
        const w = SEVERITY_WEIGHT[issue.severity] ?? 1
        if (w > best) best = w
      }
    }
    if (best > 0) return best
  }
  return 1
}

export function computeProfile(sessions: SessionRecord[]): ErrorProfile {
  // Reading first, before anything is counted — including `totalSessions`,
  // which gates the focus list. A learner is not two sessions into their
  // writing practice because they sat two Reading papers.
  const ordered = sortChronological(writingOnly(sessions))
  const totalSessions = ordered.length
  const counts = countsBySession(ordered)

  const fired = new Set<IssueCategory>()
  for (const c of counts) {
    for (const key of Object.keys(c) as IssueCategory[]) fired.add(key)
  }

  const categories: Partial<Record<IssueCategory, CategoryStat>> = {}
  const scored: Array<{ category: IssueCategory; score: number }> = []

  for (const category of fired) {
    // Only sessions whose task could have produced this category. Everything
    // below — rates, trend, recentRate, EWMA — runs over this subset.
    const applicable: number[] = []
    for (let i = 0; i < ordered.length; i++) {
      if (categoryAppliesTo(category, ordered[i].task, ordered[i].module)) applicable.push(i)
    }

    // Per-session per-100-words rates, chronological (0 where it did not fire).
    const rates = applicable.map((i) => per100Words(counts[i][category] ?? 0, sessionWordCount(ordered[i])))

    // Trend: least-squares slope over the last 6 sessions' rates.
    const slope = leastSquaresSlope(rates.slice(-TREND_WINDOW))
    const trend: CategoryStat['trend'] =
      slope < IMPROVING_SLOPE ? 'improving' : slope > WORSENING_SLOPE ? 'worsening' : 'flat'

    // Totals and last sighting.
    let total = 0
    let lastSeenISO: string | null = null
    for (const i of applicable) {
      const count = counts[i][category] ?? 0
      total += count
      if (count > 0) lastSeenISO = ordered[i].dateISO
    }

    // recentRate: issues per 100 words aggregated over the last 5 sessions (per CategoryStat contract).
    let recentIssues = 0
    let recentWords = 0
    for (const i of applicable.slice(-RECENT_WINDOW)) {
      recentIssues += counts[i][category] ?? 0
      recentWords += sessionWordCount(ordered[i])
    }
    const recentRate = per100Words(recentIssues, recentWords)

    categories[category] = { total, recentRate, trend, lastSeenISO }

    // Focus score: EWMA rate x severity weight of the most recent occurrence.
    const smoothed = ewma(rates)
    if (smoothed > 0) {
      scored.push({ category, score: smoothed * latestSeverityWeight(ordered, category) })
    }
  }

  const focusCategories: IssueCategory[] =
    totalSessions >= 2
      ? scored
          .sort((a, b) => b.score - a.score || a.category.localeCompare(b.category))
          .slice(0, FOCUS_LIMIT)
          .map((entry) => entry.category)
      : []

  return { totalSessions, categories, focusCategories }
}

export function computeTrends(sessions: SessionRecord[]): CategoryTrend[] {
  // Same exclusion as computeProfile: a Reading paper is not a point on a
  // writing-error sparkline.
  const ordered = sortChronological(writingOnly(sessions))
  const counts = countsBySession(ordered)

  const fired = new Set<IssueCategory>()
  for (const c of counts) {
    for (const key of Object.keys(c) as IssueCategory[]) fired.add(key)
  }

  const orderedCategories = Array.from(fired).sort((a, b) => a.localeCompare(b))

  return orderedCategories.map((category) => ({
    category,
    // 0-count sessions are included so trend lines stay continuous, but only
    // for sessions whose task could have produced this category — a sparkline
    // must never plot a zero the learner could not have avoided.
    perSession: ordered.flatMap((s, i) => {
      if (!categoryAppliesTo(category, s.task, s.module)) return []
      const count = counts[i][category] ?? 0
      return [
        {
          sessionId: s.id,
          dateISO: s.dateISO,
          count,
          per100Words: per100Words(count, sessionWordCount(s)),
        },
      ]
    }),
  }))
}
