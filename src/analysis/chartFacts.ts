/**
 * Derived facts about a Task 1 chart — the evidence the Task 1 rules reason
 * over. Implements SPEC.md "Task 1 (v2) → analysis/chartFacts.ts".
 *
 * This module is the reason deterministic Task 1 coaching is possible at all.
 * A rule engine cannot read a chart image, but the prompt bank authors the
 * chart as NUMBERS, so the engine can check a learner's claims against them:
 * whether a cited figure exists, what the real maximum is, where the steepest
 * change happened.
 *
 * Defensive by design, in the same spirit as `rules/structure.ts`: an empty
 * chart, an all-null series, a single data point and a series longer than
 * `categories` all yield a well-formed result. Nothing here indexes past an
 * array end and nothing divides.
 */
import type { Task1Chart, Task1ChartFacts } from '../types'

/** One numeric cell, located. Internal to this module. */
interface Cell {
  series: string
  category: string
  value: number
  /** Index within the series, used for the consecutive-step scan. */
  index: number
}

/**
 * Every numeric cell in the chart, in series-then-category order.
 *
 * Cells beyond `categories.length` are skipped rather than labelled with an
 * undefined category — a mis-authored series must not produce a fact naming a
 * category that does not exist.
 */
function collectCells(chart: Task1Chart): Cell[] {
  const cells: Cell[] = []
  for (const series of chart.series) {
    const limit = Math.min(series.values.length, chart.categories.length)
    for (let i = 0; i < limit; i++) {
      const value = series.values[i]
      if (typeof value !== 'number' || !Number.isFinite(value)) continue
      cells.push({ series: series.name, category: chart.categories[i], value, index: i })
    }
  }
  return cells
}

/**
 * Largest consecutive step in each direction, scanning each series
 * independently.
 *
 * Only NON-NULL neighbours are compared: a gap in the data must not invent a
 * step. A series `[10, null, 40]` therefore yields one step of +30 spanning
 * the two real points, not two smaller ones.
 *
 * Both deltas come back as positive magnitudes — `biggestRise` and
 * `biggestFall` already carry the direction in their names.
 */
function findExtremeSteps(chart: Task1Chart): Pick<Task1ChartFacts, 'biggestRise' | 'biggestFall'> {
  let biggestRise: Task1ChartFacts['biggestRise'] = null
  let biggestFall: Task1ChartFacts['biggestFall'] = null

  for (const series of chart.series) {
    const limit = Math.min(series.values.length, chart.categories.length)
    let prev: { index: number; value: number } | null = null

    for (let i = 0; i < limit; i++) {
      const value = series.values[i]
      if (typeof value !== 'number' || !Number.isFinite(value)) continue

      if (prev !== null) {
        const delta = value - prev.value
        const step = {
          series: series.name,
          from: chart.categories[prev.index],
          to: chart.categories[i],
          delta: Math.abs(delta),
        }
        // Strict > keeps the FIRST occurrence of a tied extreme, so the result
        // is stable for a given chart.
        if (delta > 0 && (biggestRise === null || step.delta > biggestRise.delta)) {
          biggestRise = step
        } else if (delta < 0 && (biggestFall === null || step.delta > biggestFall.delta)) {
          biggestFall = step
        }
      }
      prev = { index: i, value }
    }
  }

  return { biggestRise, biggestFall }
}

/**
 * Reduce a Task 1 chart to the facts its analysis rules need.
 *
 * Ties in `peak`/`trough` resolve to the FIRST occurrence in series order then
 * category order, so repeated calls on the same chart always agree.
 *
 * @param chart The authored chart data from a `Task1PromptSpec`.
 * @returns Facts about the chart. Never throws; every field is null or empty
 *   when the chart carries no numbers (a `process` chart, or an all-null series).
 *
 * @example
 * const facts = deriveChartFacts({
 *   kind: 'line', title: 'Car ownership', unit: '%',
 *   categories: ['1990', '2000', '2010'],
 *   series: [{ name: 'Urban', values: [20, 35, 60] }],
 *   steps: [],
 * })
 * // facts.values          === [20, 35, 60]
 * // facts.peak            === { series: 'Urban', category: '2010', value: 60 }
 * // facts.biggestRise     === { series: 'Urban', from: '2000', to: '2010', delta: 25 }
 * // facts.comparative     === false
 */
export function deriveChartFacts(chart: Task1Chart): Task1ChartFacts {
  const cells = collectCells(chart)

  let peak: Task1ChartFacts['peak'] = null
  let trough: Task1ChartFacts['trough'] = null
  for (const cell of cells) {
    const located = { series: cell.series, category: cell.category, value: cell.value }
    if (peak === null || cell.value > peak.value) peak = located
    if (trough === null || cell.value < trough.value) trough = located
  }

  const values = Array.from(new Set(cells.map((c) => c.value))).sort((a, b) => a - b)
  const { biggestRise, biggestFall } = findExtremeSteps(chart)

  return {
    values,
    peak,
    trough,
    biggestRise,
    biggestFall,
    comparative: chart.series.length >= 2,
  }
}
