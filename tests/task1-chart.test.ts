/**
 * Task 1 chart facts and prompt-bank integrity (SPEC.md "Task 1 (v2)").
 *
 * Two jobs in one file, because they guard the same contract from both ends:
 *
 * 1. `deriveChartFacts` must be TOTAL — a process diagram, an all-null series,
 *    a single data point and a gap mid-series must all produce a well-formed
 *    result rather than throwing or inventing a step across a hole.
 * 2. The authored numbers in `prompts/task1Bank.ts` must be internally
 *    consistent. The `t1-invented-figure` rule reports a learner error for any
 *    figure not present in `facts.values`, so a typo in the bank becomes a
 *    false accusation shown to a correct learner. These cases are the guard.
 */
import { describe, expect, it } from 'vitest'
import { deriveChartFacts } from '../src/analysis/chartFacts'
import { TASK1_PROMPTS, randomTask1Prompt } from '../src/prompts/task1Bank'
import type { Task1Chart, Task1Series } from '../src/types'

/* --------------------------------- helpers ---------------------------------- */

const STANDARD_T1 =
  'Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.'

/** A line chart over `categories` with the given series. */
function chartOf(categories: string[], series: Task1Series[], kind: Task1Chart['kind'] = 'line'): Task1Chart {
  return { kind, title: 'Test chart', unit: '%', categories, series, steps: [] }
}

/* ----------------------------- deriveChartFacts ------------------------------ */

describe('deriveChartFacts', () => {
  it('finds the peak and trough with their series and category', () => {
    const facts = deriveChartFacts(
      chartOf(
        ['1990', '2000', '2010'],
        [
          { name: 'Urban', values: [20, 35, 60] },
          { name: 'Rural', values: [12, 9, 24] },
        ],
      ),
    )

    expect(facts.peak).toEqual({ series: 'Urban', category: '2010', value: 60 })
    expect(facts.trough).toEqual({ series: 'Rural', category: '2000', value: 9 })
  })

  it('resolves a tied peak to the first occurrence in series then category order', () => {
    const facts = deriveChartFacts(
      chartOf(
        ['A', 'B'],
        [
          { name: 'First', values: [50, 50] },
          { name: 'Second', values: [50, 50] },
        ],
      ),
    )

    expect(facts.peak).toEqual({ series: 'First', category: 'A', value: 50 })
    expect(facts.trough).toEqual({ series: 'First', category: 'A', value: 50 })
  })

  it('steps across a null instead of inventing a break at zero', () => {
    const facts = deriveChartFacts(
      chartOf(['2010', '2011', '2012'], [{ name: 'Line', values: [10, null, 40] }]),
    )

    // One real step, from the last non-null point to the next one.
    expect(facts.biggestRise).toEqual({ series: 'Line', from: '2010', to: '2012', delta: 30 })
    expect(facts.biggestFall).toBeNull()
    expect(facts.values).toEqual([10, 40])
  })

  it('reports the biggest fall as a positive magnitude', () => {
    const facts = deriveChartFacts(
      chartOf(['A', 'B', 'C'], [{ name: 'Line', values: [100, 40, 35] }]),
    )

    expect(facts.biggestFall).toEqual({ series: 'Line', from: 'A', to: 'B', delta: 60 })
    expect(facts.biggestRise).toBeNull()
  })

  it('has no steps for a single-point series', () => {
    const facts = deriveChartFacts(chartOf(['2020'], [{ name: 'Line', values: [42] }]))

    expect(facts.biggestRise).toBeNull()
    expect(facts.biggestFall).toBeNull()
    expect(facts.peak).toEqual({ series: 'Line', category: '2020', value: 42 })
  })

  it('returns empty facts for an all-null series', () => {
    const facts = deriveChartFacts(
      chartOf(['A', 'B'], [{ name: 'Line', values: [null, null] }]),
    )

    expect(facts.values).toEqual([])
    expect(facts.peak).toBeNull()
    expect(facts.trough).toBeNull()
    expect(facts.biggestRise).toBeNull()
    expect(facts.biggestFall).toBeNull()
  })

  it('survives a process chart with no series or categories', () => {
    const facts = deriveChartFacts({
      kind: 'process',
      title: 'A process',
      unit: '',
      categories: [],
      series: [],
      steps: ['One', 'Two'],
    })

    expect(facts.values).toEqual([])
    expect(facts.peak).toBeNull()
    expect(facts.comparative).toBe(false)
  })

  it('ignores values that run past the category list', () => {
    const facts = deriveChartFacts(chartOf(['A'], [{ name: 'Line', values: [5, 999] }]))

    // 999 has no category to belong to, so it is not a fact about this chart.
    expect(facts.values).toEqual([5])
    expect(facts.peak).toEqual({ series: 'Line', category: 'A', value: 5 })
  })

  it('deduplicates and sorts values ascending', () => {
    const facts = deriveChartFacts(
      chartOf(
        ['A', 'B', 'C'],
        [
          { name: 'One', values: [30, 10, 30] },
          { name: 'Two', values: [10, 20, 30] },
        ],
      ),
    )

    expect(facts.values).toEqual([10, 20, 30])
  })

  it('sets comparative from the series count', () => {
    const single = deriveChartFacts(chartOf(['A'], [{ name: 'Only', values: [1] }]))
    const double = deriveChartFacts(
      chartOf(['A'], [{ name: 'One', values: [1] }, { name: 'Two', values: [2] }]),
    )

    expect(single.comparative).toBe(false)
    expect(double.comparative).toBe(true)
  })
})

/* ---------------------------- prompt bank integrity --------------------------- */

describe('TASK1_PROMPTS bank integrity', () => {
  it('holds exactly 12 prompts with unique sequential ids', () => {
    expect(TASK1_PROMPTS).toHaveLength(12)

    const ids = TASK1_PROMPTS.map((p) => p.id)
    expect(new Set(ids).size).toBe(12)
    expect(ids).toEqual(Array.from({ length: 12 }, (_, i) => `t1-${String(i + 1).padStart(2, '0')}`))
  })

  it('ends every prompt text with the standard Task 1 instruction', () => {
    for (const p of TASK1_PROMPTS) {
      expect(p.text.endsWith(STANDARD_T1), `${p.id} instruction`).toBe(true)
      expect(p.task).toBe('task1')
      expect(p.parts.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('gives every prompt 10-16 unique lowercase keywords', () => {
    for (const p of TASK1_PROMPTS) {
      expect(p.keywords.length, `${p.id} keyword count`).toBeGreaterThanOrEqual(10)
      expect(p.keywords.length, `${p.id} keyword count`).toBeLessThanOrEqual(16)
      expect(new Set(p.keywords).size, `${p.id} duplicate keywords`).toBe(p.keywords.length)
      for (const k of p.keywords) {
        expect(k, `${p.id} keyword "${k}"`).toBe(k.toLowerCase())
        expect(k.includes(' '), `${p.id} keyword "${k}" is multi-word`).toBe(false)
      }
    }
  })

  it('index-aligns every series with its categories', () => {
    for (const p of TASK1_PROMPTS) {
      if (p.chart.kind === 'process') continue
      expect(p.chart.series.length, `${p.id} series count`).toBeGreaterThanOrEqual(1)
      for (const s of p.chart.series) {
        expect(s.values.length, `${p.id} series "${s.name}" alignment`).toBe(p.chart.categories.length)
      }
    }
  })

  it('has every pie chart summing to 100%', () => {
    const pies = TASK1_PROMPTS.filter((p) => p.chart.kind === 'pie')
    expect(pies.length).toBeGreaterThan(0)

    for (const p of pies) {
      expect(p.chart.series.length, `${p.id} pie series count`).toBe(1)
      expect(p.chart.unit).toBe('%')
      const total = p.chart.series[0].values
        .filter((v): v is number => typeof v === 'number')
        .reduce((a, b) => a + b, 0)
      expect(total, `${p.id} pie total`).toBeCloseTo(100, 2)
    }
  })

  it('has every percentage table row summing to 100%', () => {
    for (const p of TASK1_PROMPTS) {
      if (p.chart.kind !== 'table' || p.chart.unit !== '%') continue
      for (const s of p.chart.series) {
        const total = s.values
          .filter((v): v is number => typeof v === 'number')
          .reduce((a, b) => a + b, 0)
        expect(total, `${p.id} row "${s.name}"`).toBeCloseTo(100, 2)
      }
    }
  })

  it('gives the process chart steps and no numeric data', () => {
    const process = TASK1_PROMPTS.filter((p) => p.chart.kind === 'process')
    expect(process).toHaveLength(1)

    const chart = process[0].chart
    expect(chart.series).toEqual([])
    expect(chart.categories).toEqual([])
    expect(chart.steps.length).toBeGreaterThanOrEqual(3)
  })

  it('derives facts for every prompt without throwing', () => {
    for (const p of TASK1_PROMPTS) {
      expect(() => deriveChartFacts(p.chart), `${p.id}`).not.toThrow()
      const facts = deriveChartFacts(p.chart)
      expect(facts.comparative).toBe(p.chart.series.length >= 2)
      // Only the process chart legitimately has no numbers to cite.
      if (p.chart.kind !== 'process') expect(facts.values.length, `${p.id} values`).toBeGreaterThan(0)
    }
  })

  it('matches the planned kind distribution', () => {
    const counts = TASK1_PROMPTS.reduce<Record<string, number>>((acc, p) => {
      acc[p.chart.kind] = (acc[p.chart.kind] ?? 0) + 1
      return acc
    }, {})

    expect(counts).toEqual({ line: 4, bar: 3, pie: 2, table: 2, process: 1 })
  })

  it('returns a prompt from the bank on every randomTask1Prompt call', () => {
    for (let i = 0; i < 50; i++) {
      expect(TASK1_PROMPTS).toContain(randomTask1Prompt())
    }
  })
})
