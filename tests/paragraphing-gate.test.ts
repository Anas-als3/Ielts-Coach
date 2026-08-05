/**
 * Paragraphing gates (SPEC.md "Canonical constants → Paragraphing gates").
 *
 * Regression suite for the bug where the `paragraphing` issue judged block
 * shape from the first keystroke: a learner 40 words into their introduction
 * has exactly ONE paragraph, and was told the essay "is a single block" that
 * "caps Coherence near Band 5" before they had any chance to press Enter.
 *
 * Every case runs through the REAL pipeline (`analyzeEssay`), so these tests
 * also pin the gate against the tokenizer's paragraph merging.
 */
import { describe, expect, it } from 'vitest'
import { analyzeEssay } from '../src/analysis/engine'
import type { Analysis, Issue } from '../src/types'

/* --------------------------------- helpers ---------------------------------- */

function analyze(text: string): Analysis {
  return analyzeEssay(text, null)
}

function paragraphing(analysis: Analysis): Issue[] {
  return analysis.issues.filter((i) => i.category === 'paragraphing')
}

/**
 * A paragraph of exactly `words` words, distinct from every other generated
 * paragraph (so the tokenizer never merges two of them and the word counts in
 * these tests are exact).
 */
function para(words: number, seed: string): string {
  const out: string[] = []
  for (let i = 0; i < words; i++) out.push(`${seed}${i}`)
  return `${out.join(' ')}.`
}

function wordCount(analysis: Analysis): number {
  return analysis.stats.wordCount
}

/* ----------------------------- 1 block (error) ------------------------------ */

describe('paragraphing — single block', () => {
  it('stays silent while the writer is still inside the introduction (< 100 words)', () => {
    for (const words of [1, 12, 40, 60, 99]) {
      const analysis = analyze(para(words, 'alpha'))
      expect(wordCount(analysis)).toBe(words)
      expect(analysis.stats.paragraphCount).toBe(1)
      expect(paragraphing(analysis)).toHaveLength(0)
    }
  })

  it('fires the band-capping error once the essay reaches 100 words in one block', () => {
    const analysis = analyze(para(100, 'alpha'))
    expect(wordCount(analysis)).toBe(100)
    const hits = paragraphing(analysis)
    expect(hits).toHaveLength(1)
    expect(hits[0].severity).toBe('error')
    expect(hits[0].message).toContain('single block')
  })

  it('keeps firing as the single block grows', () => {
    const hits = paragraphing(analyze(para(280, 'alpha')))
    expect(hits).toHaveLength(1)
    expect(hits[0].severity).toBe('error')
  })
})

/* --------------------------- 2–3 paragraphs (warning) ----------------------- */

describe('paragraphing — 2–3 paragraphs', () => {
  it('does not flag intro + body 1 while the essay is short (< 200 words)', () => {
    // 120 words across two paragraphs: exactly the right shape at this length.
    const text = [para(45, 'alpha'), para(75, 'beta')].join('\n\n')
    const analysis = analyze(text)
    expect(wordCount(analysis)).toBe(120)
    expect(analysis.stats.paragraphCount).toBe(2)
    expect(paragraphing(analysis)).toHaveLength(0)
  })

  it('does not flag intro + 2 bodies at 199 words', () => {
    const text = [para(45, 'alpha'), para(77, 'beta'), para(77, 'gamma')].join('\n\n')
    const analysis = analyze(text)
    expect(wordCount(analysis)).toBe(199)
    expect(paragraphing(analysis)).toHaveLength(0)
  })

  it('warns about the 4–5 shape once the essay is near full length (>= 200 words)', () => {
    const text = [para(60, 'alpha'), para(140, 'beta')].join('\n\n')
    const analysis = analyze(text)
    expect(wordCount(analysis)).toBe(200)
    const hits = paragraphing(analysis)
    expect(hits).toHaveLength(1)
    expect(hits[0].severity).toBe('warning')
    expect(hits[0].message).toContain('2 paragraphs so far')
  })
})

/* ---------------------------- 6+ paragraphs (warning) ----------------------- */

describe('paragraphing — 6+ fragments', () => {
  it('stays silent below 100 words even when the text is heavily fragmented', () => {
    const seeds = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta']
    const text = seeds.map((s) => para(10, s)).join('\n\n')
    const analysis = analyze(text)
    expect(wordCount(analysis)).toBe(60)
    expect(analysis.stats.paragraphCount).toBe(6)
    expect(paragraphing(analysis)).toHaveLength(0)
  })

  it('warns about fragmentation once past 100 words', () => {
    const seeds = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta']
    const text = seeds.map((s) => para(20, s)).join('\n\n')
    const analysis = analyze(text)
    expect(wordCount(analysis)).toBe(120)
    expect(analysis.stats.paragraphCount).toBe(6)
    const hits = paragraphing(analysis)
    expect(hits).toHaveLength(1)
    expect(hits[0].severity).toBe('warning')
    expect(hits[0].message).toContain('6 paragraphs')
  })
})

/* --------------------------------- 4–5 = good -------------------------------- */

describe('paragraphing — the target shape', () => {
  it('never fires for a full-length 4-paragraph essay', () => {
    const text = [para(50, 'alpha'), para(90, 'beta'), para(90, 'gamma'), para(40, 'delta')].join(
      '\n\n',
    )
    const analysis = analyze(text)
    expect(wordCount(analysis)).toBe(270)
    expect(paragraphing(analysis)).toHaveLength(0)
  })
})
