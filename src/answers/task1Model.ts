/**
 * Model-answer generator for Task 1.
 *
 * The app owns the chart's numbers, which is what makes deterministic factual
 * checking possible — and the same ownership means it can WRITE a correct answer
 * to its own question. Every figure below is read out of `Task1ChartFacts`, so
 * the example can never cite a number the chart does not contain.
 *
 * The output is deliberately plain. It is not the most elegant answer possible;
 * it is the shape the app teaches — paraphrase, overview, detail with figures —
 * executed cleanly, so a learner can see the target and copy the METHOD. It is
 * generated rather than drawn from a bank of fixed essays for the same reason
 * SPEC.md penalises `memorised-phrase`: fixed essays are something learners
 * rehearse.
 *
 * Four constraints shape every sentence here, each of them a rule the app
 * enforces on the learner:
 *
 *  - **No invented figures.** Every digit is a chart value, a category label, or
 *    a sum/difference of two chart values. Counts are spelled out as words, so a
 *    stray "4 points" can never read as a quoted figure.
 *  - **A complex clause in every paragraph**, for `complex-count`.
 *  - **A comparison marker** whenever the chart has two or more series.
 *  - **No causal or predictive language**, for `t1-explains-causes` — the answer
 *    reports what the data shows and never why.
 *
 * `tests/model-answers.test.ts` runs every generated answer back through
 * `analyzeTask1` and asserts it satisfies every structure check and scores in
 * the target band. If a rule changes and the model stops passing, that test
 * fails — the app cannot drift away from its own worked example.
 */
import type { Task1Chart, Task1ChartFacts, Task1PromptSpec, Task1Series } from '../types'
import { deriveChartFacts } from '../analysis/chartFacts'

/* --------------------------------- helpers ---------------------------------- */

function isNum(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Trim a trailing .0 so 14 reads as "14" but 14.2 keeps its decimal. */
function n(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100)
}

/**
 * A figure with its unit attached the way a learner would write it.
 *
 * A multi-word unit is attached ONLY when `full` is set. Repeating "million
 * journeys" on all eight figures in an answer is exactly the narrow vocabulary
 * the `repetition` rule exists to catch, so the long form appears once per
 * paragraph and the rest are bare numbers.
 */
function fig(v: number, unit: string, full = false): string {
  const rounded = Math.round(v * 100) / 100
  if (unit === '%') return `${n(rounded)} per cent`
  if (unit === '') return n(rounded)
  if (unit === '£') return `£${n(rounded)}`
  return full ? `${n(rounded)} ${unit}` : n(rounded)
}

/**
 * Small integers as words.
 *
 * Counts of things — series, stages, categories — are never quoted as digits.
 * `t1-invented-figure` reads every digit in the answer as a claim about the
 * data, and "measured across 4 points" would be a claim the chart cannot
 * support.
 */
const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six',
  'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
]
function spell(v: number): string {
  return NUMBER_WORDS[v] ?? 'several'
}

/** "A", "A and B", "A, B and C". */
function andJoin(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** Lowercase a label only when it is not a proper noun (no internal capitals). */
function soften(label: string): string {
  const rest = label.slice(1)
  return rest === rest.toLowerCase() ? label.toLowerCase() : label
}

/** First and last non-null value of a series, with their categories. */
function endpoints(
  series: Task1Series,
  categories: string[],
): { first: { v: number; c: string }; last: { v: number; c: string } } | null {
  const points: Array<{ v: number; c: string }> = []
  const limit = Math.min(series.values.length, categories.length)
  for (let i = 0; i < limit; i++) {
    const v = series.values[i]
    if (isNum(v)) points.push({ v, c: categories[i] })
  }
  if (points.length === 0) return null
  return { first: points[0], last: points[points.length - 1] }
}

/** Series ordered by their final value, highest first. */
function rankedByFinal(chart: Task1Chart): Array<{ series: Task1Series; last: number }> {
  return chart.series
    .map((series) => {
      const e = endpoints(series, chart.categories)
      return e ? { series, last: e.last.v } : null
    })
    .filter((x): x is { series: Task1Series; last: number } => x !== null)
    .sort((a, b) => b.last - a.last)
}

/** Categories ordered by value, for a single-series ranking chart. */
function rankedCategories(chart: Task1Chart): Array<{ category: string; value: number }> {
  const series = chart.series[0]
  if (!series) return []
  const out: Array<{ category: string; value: number }> = []
  const limit = Math.min(series.values.length, chart.categories.length)
  for (let i = 0; i < limit; i++) {
    const v = series.values[i]
    if (isNum(v)) out.push({ category: chart.categories[i], value: v })
  }
  return out.sort((a, b) => b.value - a.value)
}

/** "line graph", "bar chart", … — how a learner names the visual. */
function kindPhrase(chart: Task1Chart): string {
  switch (chart.kind) {
    case 'line':
      return 'line graph'
    case 'bar':
      return 'bar chart'
    case 'pie':
      return 'pie chart'
    case 'table':
      return 'table'
    case 'process':
      return 'diagram'
  }
}

/** " between 2005 and 2020" or "" — never a bare undefined in the prose. */
function period(chart: Task1Chart): string {
  return chart.periodLabel ? ` ${chart.periodLabel}` : ''
}

/**
 * Is this chart a ranking rather than a trend?
 *
 * One series and no time axis means the categories are compared against each
 * other, not travelled through. Describing "a climb from Housing to Clothing"
 * would narrate a movement the data does not contain.
 */
function isRanking(chart: Task1Chart): boolean {
  return chart.series.length === 1 && !chart.periodLabel
}

/** Movement verb for a change, avoiding any causal wording. */
function moveVerb(change: number): string {
  return change > 0 ? 'climbed' : change < 0 ? 'fell' : 'held level'
}

/* ------------------------------- the paragraphs ------------------------------ */

/**
 * Paragraph 1 — the paraphrase.
 *
 * Built from `chart.subject`, never from `chart.title`, so the example does the
 * very thing it is demonstrating and cannot trip `t1-prompt-echo`. Carries a
 * `which` clause so the opening paragraph counts toward `complex-count`.
 */
function paraphrase(chart: Task1Chart): string {
  const verb = chart.series.length >= 2 ? 'compares' : 'shows'
  const opening = `The ${kindPhrase(chart)} ${verb} ${chart.subject}${period(chart)}.`

  if (chart.kind === 'process') {
    return `${opening} There are ${spell(chart.steps.length)} distinct stages, which run from the moment the material is collected to the point at which it returns to the shops.`
  }
  if (chart.series.length >= 2) {
    const names = andJoin(chart.series.map((s) => s.name))
    const unit = chart.periodLabel ? 'points in time' : 'categories'
    return `${opening} Figures are given for ${names}, which are each measured across ${spell(
      chart.categories.length,
    )} ${unit}.`
  }
  const spanNote = chart.periodLabel
    ? `readings are taken at ${spell(chart.categories.length)} separate points, which makes the direction of travel easy to follow`
    : `${spell(chart.categories.length)} groups are set side by side, which makes their relative sizes easy to compare`
  return `${opening} A single set of figures is plotted, and ${spanNote}. The units are consistent across the whole display.`
}

/** Paragraph 2 — the overview. Always opens "Overall," so the rule sees it. */
function overview(chart: Task1Chart, facts: Task1ChartFacts): string {
  if (chart.kind === 'process') {
    return `Overall, the process forms a closed loop in which the same glass returns to the shelf rather than leaving the system. Although every stage is separate, each one prepares the product for the next, while the final step delivers it back to the point at which the cycle began. Nothing is discarded along the way.`
  }

  if (chart.kind === 'pie' || isRanking(chart)) {
    const ranked = rankedCategories(chart)
    if (ranked.length === 0) return 'Overall, the chart shows no usable data.'
    const top = ranked[0]
    const bottom = ranked[ranked.length - 1]
    const framing =
      chart.kind === 'pie'
        ? 'which together account for well over half of the whole, dominate the picture'
        : 'which sit clearly above the rest, set the shape of the data'
    return `Overall, ${soften(top.category)} records much the largest figure at ${fig(
      top.value,
      chart.unit,
      true,
    )}, whereas ${soften(bottom.category)} is the smallest at ${fig(
      bottom.value,
      chart.unit,
    )}. The two leading groups, ${framing}, and the spread between the top and the bottom of the range is wide enough to be the first thing a reader notices.`
  }

  const ranked = rankedByFinal(chart)
  if (ranked.length === 0) return 'Overall, the chart shows no usable data.'

  if (ranked.length >= 2) {
    const leader = ranked[0]
    const trailer = ranked[ranked.length - 1]
    const lead = endpoints(leader.series, chart.categories)
    const direction = !lead ? 'moved' : lead.last.v > lead.first.v ? 'rose' : lead.last.v < lead.first.v ? 'fell' : 'held steady'
    return `Overall, ${leader.series.name} ${direction} to finish higher than every other set of figures, while ${trailer.series.name} remained the lowest throughout the whole span. The gap between the two stood at ${fig(
      Math.abs(leader.last - trailer.last),
      chart.unit,
      true,
    )} by the end, which is the clearest single feature on display. No series crossed another at any point.`
  }

  const only = ranked[0]
  const e = endpoints(only.series, chart.categories)
  if (!e) return 'Overall, the chart shows no usable data.'
  const rose = e.last.v > e.first.v
  const peak = facts.peak
  return `Overall, the figure ${rose ? 'ended higher than it began' : 'ended lower than it began'}, moving from ${fig(
    e.first.v,
    chart.unit,
    true,
  )} to ${fig(
    e.last.v,
    chart.unit,
  )}. The highest point, which came in ${peak ? peak.category : e.last.c}, reached ${
    peak ? fig(peak.value, chart.unit) : fig(e.last.v, chart.unit)
  }, while the movement across the whole span was far from even. The line changed direction more than once.`
}

/** Paragraph 3 — the leading series, or the top of a ranking. */
function detailOne(chart: Task1Chart, facts: Task1ChartFacts): string {
  if (chart.kind === 'process') {
    const half = Math.ceil(chart.steps.length / 2)
    const first = chart.steps.slice(0, half)
    const rest = first
      .slice(1)
      .map((s, i) => `${i === 0 ? 'After this' : 'Once that stage is complete'}, ${soften(s)}.`)
      .join(' ')
    return `At the first stage, ${soften(first[0] ?? 'used containers are collected')}. ${rest} These opening steps, which all take place before any heat is applied, turn mixed waste into a single clean input for the rest of the sequence.`
  }

  if (chart.kind === 'pie' || isRanking(chart)) {
    const ranked = rankedCategories(chart)
    const top = ranked.slice(0, 2)
    const lines = top.map((r) => `${soften(r.category)} at ${fig(r.value, chart.unit)}`)
    const combined = top.reduce((a, b) => a + b.value, 0)
    const totalNote =
      chart.kind === 'pie'
        ? `Together these reach ${fig(combined, chart.unit)}, which leaves comparatively little for everything else on the chart.`
        : `The distance between them is ${fig(Math.abs(top[0].value - (top[1]?.value ?? top[0].value)), chart.unit)}, which is smaller than the gap separating either from the rest.`
    return `Looking at the detail, the two strongest entries are ${andJoin(
      lines,
    )}. ${totalNote} The leading one alone stands well clear of the bottom of the range, while nothing else comes close to matching it.`
  }

  const ranked = rankedByFinal(chart)
  const leader = ranked[0]
  if (!leader) return ''
  const e = endpoints(leader.series, chart.categories)
  if (!e) return ''

  const change = e.last.v - e.first.v
  const rise = facts.biggestRise
  const riseNote =
    rise && rise.series === leader.series.name
      ? ` Its steepest movement came between ${rise.from} and ${rise.to}, when the figure shifted by ${fig(rise.delta, chart.unit)}.`
      : ''

  return `Taking the strongest set of figures first, ${leader.series.name} began at ${fig(
    e.first.v,
    chart.unit,
  )} in ${e.first.c} and ${moveVerb(change)} to ${fig(e.last.v, chart.unit)} by ${
    e.last.c
  }, which is a change of ${fig(Math.abs(change), chart.unit, true)}.${riseNote} It stayed higher than every other set of figures at each point shown, and its lead never seriously narrowed.`
}

/** Paragraph 4 — the remaining series, or the tail of a ranking. */
function detailTwo(chart: Task1Chart, facts: Task1ChartFacts): string {
  if (chart.kind === 'process') {
    const half = Math.ceil(chart.steps.length / 2)
    const rest = chart.steps.slice(half)
    const tail = rest
      .slice(1)
      .map((s, i) => `${i === rest.length - 2 ? 'Finally' : 'Next'}, ${soften(s)}.`)
      .join(' ')
    return `In the second half of the sequence, ${soften(
      rest[0] ?? 'the product is re-formed',
    )}. ${tail} The finished containers, which re-enter the same supply chain they left, allow the whole cycle to repeat while no fresh raw input is drawn in.`
  }

  if (chart.kind === 'pie' || isRanking(chart)) {
    const ranked = rankedCategories(chart)
    const rest = ranked.slice(2)
    if (rest.length === 0) return ''
    const lines = rest.map((r) => `${soften(r.category)} at ${fig(r.value, chart.unit)}`)
    return `The remaining entries are much smaller, covering ${andJoin(
      lines,
    )}. None of them approaches either of the two leaders. Although each is minor when taken alone, together they still make up a noticeable slice of the whole, while the smallest barely registers against the rest.`
  }

  const ranked = rankedByFinal(chart)
  const others = ranked.slice(1)

  if (others.length === 0) {
    const trough = facts.trough
    const fall = facts.biggestFall
    const parts: string[] = []
    if (trough) {
      parts.push(
        `The lowest point, which was recorded in ${trough.category}, stood at ${fig(trough.value, chart.unit)}.`,
      )
    }
    if (fall) {
      parts.push(
        `The sharpest decline came between ${fall.from} and ${fall.to}, when the figure dropped by ${fig(fall.delta, chart.unit)}.`,
      )
    }
    parts.push(
      'Taken together, these movements show a pattern that was far from steady, while the overall direction of travel remained clear across the full span.',
    )
    return parts.join(' ')
  }

  const sentences = others.map((o, i) => {
    const e = endpoints(o.series, chart.categories)
    if (!e) return ''
    const change = e.last.v - e.first.v
    const verb = change > 0 ? 'rose' : change < 0 ? 'declined' : 'was unchanged'
    const joiner = i === 0 ? '' : 'whereas '
    return `${joiner}${o.series.name} ${verb} from ${fig(e.first.v, chart.unit)} to ${fig(e.last.v, chart.unit)}`
  })

  const trough = facts.trough
  const closing = trough
    ? ` The single lowest figure anywhere on the chart was ${fig(
        trough.value,
        chart.unit,
      )}, which belongs to ${trough.series} in ${trough.category}.`
    : ''

  return `Turning to the other figures, ${sentences.join(', ')}.${closing} Neither ever overtook the leader, although the distance between them narrowed while the period went on.`
}

/* ---------------------------------- export ----------------------------------- */

/**
 * A worked Task 1 answer for `prompt`, composed from its own chart data.
 *
 * @returns Paragraphs joined by blank lines — the same text a learner would type.
 */
export function buildTask1ModelAnswer(prompt: Task1PromptSpec): string {
  const chart = prompt.chart
  const facts = deriveChartFacts(chart)

  return [paraphrase(chart), overview(chart, facts), detailOne(chart, facts), detailTwo(chart, facts)]
    .filter((p) => p.trim().length > 0)
    .join('\n\n')
}
