/**
 * Task 1 analysis pipeline (SPEC.md "Task 1 (v2)").
 *
 * Everything runs through the REAL pipeline (`analyzeTask1`) against a fixture
 * chart whose numbers are known exactly, so the factual assertions are precise.
 *
 * The most important cases in this file are the last two. Adding Task 1 touched
 * `types.ts`, `meta.ts`, `bandEstimate.ts` and `engine.ts` — all shared — so the
 * regression block proves Task 2 came through unchanged.
 */
import { describe, expect, it } from 'vitest'
import { analyzeEssay, analyzeTask1 } from '../src/analysis/engine'
import { deriveChartFacts } from '../src/analysis/chartFacts'
import { TASK1_PROMPTS } from '../src/prompts/task1Bank'
import { PROMPTS } from '../src/prompts/bank'
import type { Analysis, IssueCategory, Task1PromptSpec } from '../src/types'

/* --------------------------------- fixtures --------------------------------- */

/** Two series, four years, values chosen so every assertion below is exact. */
const FIXTURE: Task1PromptSpec = {
  id: 't1-fixture',
  task: 'task1',
  topic: 'technology',
  text: 'The graph below shows the percentage of homes with broadband in two cities between 1990 and 2020. Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.',
  chart: {
    kind: 'line',
    title: 'Homes with broadband, 1990-2020',
    unit: '%',
    categories: ['1990', '2000', '2010', '2020'],
    series: [
      { name: 'Northtown', values: [10, 25, 60, 88] },
      { name: 'Southport', values: [4, 12, 30, 52] },
    ],
    steps: [],
  },
  parts: ['Paraphrase the chart title', 'State an overview', 'Support with figures'],
  keywords: ['homes', 'broadband', 'cities', 'northtown', 'southport', 'percentage', 'access', 'rose', 'internet', 'connections'],
}

/** A single-series chart, so `comparative` is false. */
const SOLO: Task1PromptSpec = {
  ...FIXTURE,
  id: 't1-solo',
  chart: { ...FIXTURE.chart, series: [{ name: 'Northtown', values: [10, 25, 60, 88] }] },
}

const PROCESS: Task1PromptSpec = TASK1_PROMPTS.find((p) => p.chart.kind === 'process')!

function t1(text: string, prompt: Task1PromptSpec = FIXTURE): Analysis {
  return analyzeTask1(text, prompt)
}

function categoryOf(analysis: Analysis, category: IssueCategory) {
  return analysis.issues.filter((i) => i.category === category)
}

function check(analysis: Analysis, id: string) {
  return analysis.structure.find((c) => c.id === id)
}

/**
 * Pad an answer past a word-count gate without adding numbers or markers.
 *
 * Letters only, deliberately: a digit anywhere in the padding would register as
 * a quoted figure and silence the very rules these fixtures exist to trigger.
 */
function pad(words: number): string {
  const letter = 'abcdefghij'
  return (
    Array.from({ length: words }, (_, i) => {
      const suffix = String(i)
        .split('')
        .map((d) => letter[Number(d)])
        .join('')
      return `pad${suffix}`
    }).join(' ') + '.'
  )
}

/** A competent answer to FIXTURE: paraphrase, overview, two detail paragraphs. */
const MODEL_ANSWER = `The line graph compares the proportion of homes connected to broadband in two towns, Northtown and Southport, which were surveyed at regular intervals across three decades.

Overall, both towns saw sustained growth throughout the period, although Northtown remained consistently ahead of Southport at every point that was measured.

In 1990 only 10 per cent of Northtown homes had a connection, while Southport stood at just 4 per cent. Both towns then climbed steadily through the following two decades, adding roughly fifteen points every ten years. By 2010 Northtown had reached 60 per cent, which was exactly double the 30 per cent recorded in its neighbour, so the two towns moved broadly in parallel over this stretch.

The distance between them widened towards the end of the period. Northtown finished at 88 per cent, whereas Southport reached 52 per cent, leaving a difference of 36 percentage points. Although Southport had more than quadrupled its own starting position by the final year, it never closed that distance in absolute terms, and the two lines remained clearly separated from beginning to end.`

/* --------------------------------- overview ---------------------------------- */

describe('overview', () => {
  it('stays silent while the answer is too short to have one', () => {
    expect(categoryOf(t1(pad(60)), 't1-overview-missing')).toEqual([])
  })

  it('is an error once the answer is long enough', () => {
    const issues = categoryOf(t1(pad(140)), 't1-overview-missing')
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('error')
  })

  for (const marker of ['Overall, both rose.', 'In general, both rose.', 'It is clear that both rose.']) {
    it(`is satisfied by "${marker}"`, () => {
      expect(categoryOf(t1(`${pad(140)} ${marker}`), 't1-overview-missing')).toEqual([])
    })
  }

  it('keeps the rail check and the issue in agreement', () => {
    const without = t1(pad(140))
    const withOverview = t1(`${pad(140)} Overall, both rose.`)

    expect(check(without, 't1-overview')?.satisfied).toBe(false)
    expect(categoryOf(without, 't1-overview-missing')).toHaveLength(1)
    expect(check(withOverview, 't1-overview')?.satisfied).toBe(true)
    expect(categoryOf(withOverview, 't1-overview-missing')).toEqual([])
  })
})

/* ----------------------------- invented figures ------------------------------ */

describe('invented figures', () => {
  it('accepts a value that is in the chart', () => {
    expect(categoryOf(t1('Northtown reached 60 per cent.'), 't1-invented-figure')).toEqual([])
  })

  it('flags a value that is not, with a span on the number', () => {
    const analysis = t1('Northtown reached 47 per cent.')
    const issues = categoryOf(analysis, 't1-invented-figure')
    expect(issues).toHaveLength(1)
    expect(issues[0].excerpt).toBe('47')
    expect(analysis.issues[0].severity).toBe('error')
  })

  it('never flags a year from the category labels', () => {
    expect(categoryOf(t1('Between 1990 and 2020 the figure rose.'), 't1-invented-figure')).toEqual([])
  })

  it('accepts a round-number approximation within 5%', () => {
    // The real value is 52; "roughly 50 per cent" is correct IELTS practice.
    expect(categoryOf(t1('Southport ended at roughly 50 per cent.'), 't1-invented-figure')).toEqual([])
  })

  it('accepts a difference between two chart values', () => {
    // 88 - 52 = 36, a legitimate "gap of 36 points".
    expect(categoryOf(t1('The gap reached 36 percentage points.'), 't1-invented-figure')).toEqual([])
  })

  it('accepts a sum of two chart values', () => {
    // 60 + 30 = 90, a legitimate "a combined 90 per cent".
    expect(categoryOf(t1('Together they accounted for a combined 90 per cent.'), 't1-invented-figure')).toEqual([])
  })

  it('stays silent for a process diagram with no numbers', () => {
    const analysis = t1('The process has 7 stages and takes 999 hours.', PROCESS)
    expect(categoryOf(analysis, 't1-invented-figure')).toEqual([])
  })
})

/* -------------------------- comparison and data use -------------------------- */

describe('comparison and figures', () => {
  it('asks for a comparison only when the chart has two series', () => {
    const two = t1(`${pad(140)} Overall, both rose. Northtown reached 60.`)
    const one = t1(`${pad(140)} Overall, it rose. Northtown reached 60.`, SOLO)

    expect(categoryOf(two, 't1-no-comparison')).toHaveLength(1)
    expect(categoryOf(one, 't1-no-comparison')).toEqual([])
  })

  it('is cleared by a comparison marker', () => {
    const text = `${pad(140)} Overall, both rose. Northtown at 60 was higher than Southport at 30.`
    expect(categoryOf(t1(text), 't1-no-comparison')).toEqual([])
  })

  it('flags an answer that quotes no figures at all', () => {
    expect(categoryOf(t1(`${pad(140)} Overall, both rose steadily.`), 't1-no-data-cited')).toHaveLength(1)
  })

  it('stays silent about figures while the answer is short', () => {
    expect(categoryOf(t1('Overall, both rose steadily.'), 't1-no-data-cited')).toEqual([])
  })

  it('omits the comparison check entirely for a single-series chart', () => {
    expect(check(t1(MODEL_ANSWER, SOLO), 't1-comparison')).toBeUndefined()
    expect(check(t1(MODEL_ANSWER), 't1-comparison')).toBeDefined()
  })
})

/* ------------------------------- prohibitions -------------------------------- */

describe('Task 1 prohibitions', () => {
  it('flags an explanation of causes', () => {
    const issues = categoryOf(t1('Northtown reached 60 per cent because incomes were higher.'), 't1-explains-causes')
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('warning')
  })

  it('flags a prediction', () => {
    expect(categoryOf(t1('The figure will continue to climb after 2020.'), 't1-explains-causes')).toHaveLength(1)
  })

  it('flags an opinion', () => {
    expect(categoryOf(t1('In my opinion the growth in Northtown is impressive.'), 't1-opinion')).toHaveLength(1)
  })

  it('leaves a clean descriptive answer alone', () => {
    const analysis = t1(MODEL_ANSWER)
    expect(categoryOf(analysis, 't1-explains-causes')).toEqual([])
    expect(categoryOf(analysis, 't1-opinion')).toEqual([])
    expect(categoryOf(analysis, 't1-invented-figure')).toEqual([])
  })
})

/* --------------------------------- structure --------------------------------- */

describe('structure', () => {
  it('never assigns the conclusion role', () => {
    const analysis = t1(MODEL_ANSWER)
    expect(analysis.paragraphs.map((p) => p.role)).not.toContain('conclusion')
    expect(analysis.paragraphs[0].role).toBe('introduction')
  })

  it('flags a Task 2 style conclusion', () => {
    const withConclusion = `${MODEL_ANSWER}\n\nIn conclusion, broadband access grew in both towns over the period shown.`
    const issues = categoryOf(t1(withConclusion), 't1-shape')
    expect(issues.length).toBeGreaterThanOrEqual(1)
    expect(issues.some((i) => i.message.includes('no conclusion'))).toBe(true)
  })

  it('keeps the check list stable from empty text to a full answer', () => {
    const emptyIds = t1('').structure.map((c) => c.id)
    const fullIds = t1(MODEL_ANSWER).structure.map((c) => c.id)
    expect(emptyIds).toEqual(fullIds)
    expect(emptyIds).toEqual([
      't1-paraphrase',
      't1-overview',
      't1-detail-1',
      't1-detail-2',
      't1-figures',
      't1-comparison',
      'complex-count',
    ])
  })

  it('satisfies every check for the model answer', () => {
    const unsatisfied = t1(MODEL_ANSWER).structure.filter((c) => !c.satisfied)
    expect(unsatisfied.map((c) => c.id)).toEqual([])
  })
})

/* ----------------------------------- band ------------------------------------ */

describe('band estimate', () => {
  it('scores an answer under 100 words as 4.0 across the board', () => {
    const band = t1('Broadband rose in both towns.').band
    expect(band.byCriterion).toEqual({ TR: 4, CC: 4, LR: 4, GRA: 4 })
    expect(band.overall).toBe(4)
  })

  it('caps Task Achievement at 5.5 when the overview is missing', () => {
    const noOverview = MODEL_ANSWER.replace(
      'Overall, both towns saw sustained growth throughout the period, although',
      'Both towns saw sustained growth throughout the period, and',
    )
    const analysis = t1(noOverview)
    expect(check(analysis, 't1-overview')?.satisfied).toBe(false)
    expect(analysis.band.byCriterion.TR).toBeLessThanOrEqual(5.5)
  })

  it('is the Task 1 calibration anchor: a model answer scores 7.0+ on every criterion', () => {
    const band = t1(MODEL_ANSWER).band
    for (const c of ['TR', 'CC', 'LR', 'GRA'] as const) {
      expect(band.byCriterion[c], `${c} on the model answer`).toBeGreaterThanOrEqual(7)
    }
    expect(band.overall).toBeGreaterThanOrEqual(7)
  })
})

/* ------------------------------- Task 2 regression ---------------------------- */

describe('Task 2 is unchanged by the Task 1 work', () => {
  const OP05 = PROMPTS.find((p) => p.id === 'op-05')!
  const ESSAY = `Some people believe money matters most when choosing a career, while others prioritise enjoyment. Although a high salary provides security, I firmly believe that job satisfaction matters more, provided that basic needs are met.

Work occupies a large share of adult life, which means its quality shapes overall well-being. Employees who find their responsibilities meaningful stay motivated and productive. For example, a teacher who values their subject will invest far more effort than one who is merely well paid.

Satisfaction also tends to raise earnings over time. Because engaged workers develop their skills faster, they are promoted sooner. A developer who accepts a moderately paid role with strong mentorship often overtakes a peer who chose a repetitive but better paid position.

In conclusion, satisfaction should take priority once financial needs are covered. Money raises living standards, but fulfilling work has a greater effect on long-term happiness and success.`

  it('produces no Task 1 category on a Task 2 essay', () => {
    const analysis = analyzeEssay(ESSAY, OP05)
    expect(analysis.issues.filter((i) => i.category.startsWith('t1-'))).toEqual([])
  })

  it('still labels every Task 2 issue with one of the four criteria', () => {
    const analysis = analyzeEssay(ESSAY, OP05)
    for (const issue of analysis.issues) {
      expect(['TR', 'CC', 'LR', 'GRA']).toContain(issue.criterion)
    }
    expect(Object.keys(analysis.band.byCriterion).sort()).toEqual(['CC', 'GRA', 'LR', 'TR'])
  })

  it('gives the shared rule modules the same verdict through either entry point', () => {
    // The same text, analysed as Task 2 and as Task 1: the four shared modules
    // must agree, since none of them contains a Task-specific branch.
    const shared: IssueCategory[] = ['contraction', 'comma-splice', 'article', 'agreement', 'long-sentence']
    const viaTask2 = analyzeEssay(ESSAY, null)
    const viaTask1 = analyzeTask1(ESSAY, FIXTURE)

    for (const c of shared) {
      expect(categoryOf(viaTask1, c).length, `${c}`).toBe(categoryOf(viaTask2, c).length)
    }
  })

  it('derives facts for every bank prompt through the real Task 1 pipeline', () => {
    for (const p of TASK1_PROMPTS) {
      expect(() => analyzeTask1(MODEL_ANSWER, p), p.id).not.toThrow()
      expect(deriveChartFacts(p.chart).comparative).toBe(p.chart.series.length >= 2)
    }
  })
})
