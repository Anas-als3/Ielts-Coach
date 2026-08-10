/**
 * The band estimate's "unlock" hint and its gate must agree (SPEC.md, panel
 * section). `FeedbackPanel` used to print "estimates unlock at {N} words"
 * while gating the estimate at a hardcoded 150 regardless of `N` — a Task 1
 * learner at 120 words saw "Too short to estimate" printed alongside an
 * unlock number they had already passed. This pins the fix: the gate and the
 * copy read the SAME variable, `minWordsForEstimate`.
 *
 * Rendered directly, not through `renderApp()` — the precedent is
 * `tests/ui/reading-word-limits.test.tsx`, which renders `ReadingRunner`
 * directly. Determinism comes from fixed word counts built with the real
 * analyzers, not from `renderApp()`'s pinned prompts, so the lighter render is
 * enough here.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import FeedbackPanel from '../../src/components/FeedbackPanel'
import { analyzeEssay, analyzeLetter, analyzeTask1 } from '../../src/analysis/engine'
import { PROMPTS } from '../../src/prompts/bank'
import { TASK1_PROMPTS } from '../../src/prompts/task1Bank'
import { LETTER_PROMPTS } from '../../src/prompts/letterBank'

/** n distinct letter-only words, so every tokenizer counts exactly n. */
function wordsOf(n: number): string {
  return Array.from({ length: n }, (_, i) => {
    const suffix = String(i)
      .split('')
      .map((d) => 'abcdefghij'[Number(d)])
      .join('')
    return `pad${suffix}`
  }).join(' ')
}

const op01 = PROMPTS.find((p) => p.id === 'op-01')!
const t1 = TASK1_PROMPTS.find((p) => p.id === 't1-01')!
const gt01 = LETTER_PROMPTS.find((p) => p.id === 'gt-01')!

describe('the band-estimate unlock hint matches the panel gate', () => {
  it('Task 1 at 120 words shows an estimate, not "Too short to estimate"', () => {
    const analysis = analyzeTask1(wordsOf(120), t1)
    expect(analysis.stats.wordCount).toBe(120)

    render(
      <FeedbackPanel analysis={analysis} profile={null} onSelectIssue={() => {}} task="task1" />,
    )

    expect(screen.queryByText('Too short to estimate')).not.toBeInTheDocument()
    expect(screen.getByText(/^\d\.\d–\d\.\d$/)).toBeInTheDocument()
  })

  it('Task 1 at 99 words shows the unlock line naming 100', () => {
    const analysis = analyzeTask1(wordsOf(99), t1)
    expect(analysis.stats.wordCount).toBe(99)

    render(
      <FeedbackPanel analysis={analysis} profile={null} onSelectIssue={() => {}} task="task1" />,
    )

    expect(screen.getByText('Too short to estimate')).toBeInTheDocument()
    expect(screen.getByText('(estimates unlock at 100 words)')).toBeInTheDocument()
  })

  it('a letter at 120 words shows an estimate (the letter floor is also 100)', () => {
    const analysis = analyzeLetter(wordsOf(120), gt01)
    expect(analysis.stats.wordCount).toBe(120)

    render(
      <FeedbackPanel analysis={analysis} profile={null} onSelectIssue={() => {}} task="task1" />,
    )

    expect(screen.queryByText('Too short to estimate')).not.toBeInTheDocument()
  })

  it('Task 2 at 149 words still locks at 150', () => {
    const analysis = analyzeEssay(wordsOf(149), op01)
    expect(analysis.stats.wordCount).toBe(149)

    render(
      <FeedbackPanel analysis={analysis} profile={null} onSelectIssue={() => {}} task="task2" />,
    )

    expect(screen.getByText('(estimates unlock at 150 words)')).toBeInTheDocument()
  })
})
