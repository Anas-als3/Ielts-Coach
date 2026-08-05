/**
 * Patch v2 regression suite (SPEC.md "Patch v2", Part D).
 *
 * Every case runs through the REAL pipeline (`analyzeEssay`) — no rule module
 * is imported directly. Each failing input from the calibration essay is
 * spliced into a small but VALID 4-paragraph scaffold (~160 words) so that
 * word-count / paragraph-count gates (e.g. position-consistency needs >= 150
 * words and >= 3 paragraphs) are open. The scaffold itself is engineered to
 * trigger NONE of the patch categories, so a category hit in a test can only
 * come from the spliced trigger sentence.
 */
import { describe, expect, it } from 'vitest'
import { analyzeEssay } from '../src/analysis/engine'
import type { Analysis, Issue, IssueCategory, StructureCheck } from '../src/types'

/* ------------------------------ clean scaffold ------------------------------ */
/*
 * Constraints baked into these paragraphs:
 *  - every fronted connector carries its comma (no A2 hit), no space-before-comma
 *  - every sentence starts uppercase, no standalone "i" (no A3 hit)
 *  - no dependent-opener sentence without a comma (no A4 hit)
 *  - no bare singular noun from the A5 COUNTABLE set (no article hit)
 *  - no A6/B1/B3 agreement patterns, no "person-noun + that" (no B2 hit)
 *  - no meanwhile/in other side/... (no B4), no wrong-preposition pair (no B5)
 *  - no comma splice (", then he …", ", it is …", ", however …")
 *  - intro is 2 sentences / 30 words; conclusion is exactly 2 sentences with an
 *    "In conclusion" signal; both stance sentences are neither ABSOLUTE nor
 *    HEDGED so C4 stays quiet.
 */
const INTRO =
  'In my opinion, governments should invest more in public transport because it reduces traffic in many crowded cities. Reliable buses and trains also make daily travel cheaper for ordinary families.'

const BODY1 =
  'One clear benefit is lower congestion on busy roads. Fewer private cars mean shorter queues and cleaner air for residents. For example, several European capitals have reduced rush-hour delays by adding dedicated bus lanes. Local councils can then spend the savings on road repairs. Cleaner streets also make walking safer and more pleasant for pedestrians.'

const BODY2 =
  'Public transport also helps older residents remain independent. Many of them cannot drive, and affordable buses give them easy access to markets and clinics. For instance, free travel passes in Britain encourage pensioners to stay active. Such schemes reduce loneliness and pressure on health services. They also cut waiting queues at local surgeries.'

const CONCLUSION =
  'In conclusion, I believe public transport deserves greater investment from national budgets. Better networks would improve daily life for commuters in every busy region.'

interface EssayParts {
  intro?: string
  body1?: string
  body2?: string
  conclusion?: string
}

function essay(parts: EssayParts = {}): string {
  return [
    parts.intro ?? INTRO,
    parts.body1 ?? BODY1,
    parts.body2 ?? BODY2,
    parts.conclusion ?? CONCLUSION,
  ].join('\n\n')
}

/* --------------------------------- helpers ---------------------------------- */

function analyze(text: string): Analysis {
  return analyzeEssay(text, null)
}

function byCategory(analysis: Analysis, category: IssueCategory): Issue[] {
  return analysis.issues.filter((i) => i.category === category)
}

/**
 * Issues of `category` whose inline span overlaps the (unique) occurrence of
 * `snippet` in `text`. Spans must index the ORIGINAL text, so a hit here also
 * proves the offsets are real.
 */
function overlapping(
  analysis: Analysis,
  text: string,
  snippet: string,
  category: IssueCategory,
): Issue[] {
  const at = text.indexOf(snippet)
  if (at === -1) throw new Error(`test bug — snippet not found in essay: "${snippet}"`)
  const end = at + snippet.length
  return byCategory(analysis, category).filter(
    (i) => i.start !== null && i.end !== null && i.start < end && i.end > at,
  )
}

function check(analysis: Analysis, id: string): StructureCheck | undefined {
  return analysis.structure.find((c) => c.id === id)
}

/* --------------------------- Part A: accuracy core --------------------------- */

describe('Patch v2 — Part A (accuracy core)', () => {
  it('A1 comma-splice: "…in the street, then he got sentenced…"', () => {
    const trigger =
      'Last year a young man attacked a tourist in the street, then he got sentenced to a long term in prison.'
    const text = essay({ body1: `${BODY1} ${trigger}` })
    const analysis = analyze(text)
    const hits = overlapping(analysis, text, ', then he got sentenced', 'comma-splice')
    expect(hits.length).toBeGreaterThan(0)
  })

  it('A2 connector-comma: fronted connector missing its comma at sentence and paragraph starts', () => {
    const sentenceStart = 'Therefore long time sentences would have saved them.'
    const paragraphStart = 'As a result we now have safer streets in many towns.'
    const text = essay({
      body1: `${BODY1} ${sentenceStart}`,
      body2: `${paragraphStart} ${BODY2}`,
    })
    const analysis = analyze(text)
    const atSentence = overlapping(analysis, text, 'Therefore long time', 'connector-comma')
    const atParagraph = overlapping(analysis, text, 'As a result we now', 'connector-comma')
    expect(atSentence.length).toBeGreaterThan(0)
    expect(atParagraph.length).toBeGreaterThan(0)
    expect([...atSentence, ...atParagraph].every((i) => i.severity === 'warning')).toBe(true)
  })

  it('A3 capitalisation: essay starting lowercase', () => {
    const text = essay({ intro: `${INTRO.charAt(0).toLowerCase()}${INTRO.slice(1)}` })
    const analysis = analyze(text)
    const hits = byCategory(analysis, 'capitalisation')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.some((i) => i.severity === 'error')).toBe(true)
  })

  it('A4 fragment: "For example, if someone murdered someone for any reason."', () => {
    const trigger = 'For example, if someone murdered someone for any reason.'
    const text = essay({ body1: `${BODY1} ${trigger}` })
    const analysis = analyze(text)
    const hits = overlapping(analysis, text, 'if someone murdered someone', 'fragment')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((i) => i.severity === 'warning')).toBe(true)
  })

  it('A5 article: "due to new prison system" and "must face serious response"', () => {
    const t1 = 'The crime rate fell due to new prison system in recent years.'
    const t2 = 'Serious offenders must face serious response from the courts.'
    const text = essay({ body1: `${BODY1} ${t1} ${t2}` })
    const analysis = analyze(text)
    const onSystem = overlapping(analysis, text, 'new prison system', 'article')
    const onResponse = overlapping(analysis, text, 'face serious response', 'article')
    expect(onSystem.length).toBeGreaterThan(0)
    expect(onResponse.length).toBeGreaterThan(0)
    expect([...onSystem, ...onResponse].every((i) => i.severity === 'warning')).toBe(true)
  })

  it('A6 agreement: "so punishing them for longer period make them lose life time"', () => {
    const trigger =
      'Some judges want harsher terms, so punishing them for longer period make them lose life time.'
    const text = essay({ body2: `${BODY2} ${trigger}` })
    const analysis = analyze(text)
    const hits = overlapping(analysis, text, 'punishing them for longer period make', 'agreement')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((i) => i.severity === 'warning')).toBe(true)
  })
})

/* -------------------- Part B: agreement, pronouns, wording ------------------- */

describe('Patch v2 — Part B (agreement, pronouns, wording)', () => {
  it('B1 agreement: "a random women in the street"', () => {
    const trigger = 'One day a criminal attacked a random women in the street.'
    const text = essay({ body1: `${BODY1} ${trigger}` })
    const analysis = analyze(text)
    const hits = overlapping(analysis, text, 'a random women', 'agreement')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((i) => i.severity === 'warning')).toBe(true)
  })

  it('B2 who-for-people: "a normal citizen that stole from a shop"', () => {
    const trigger = 'Think about a normal citizen that stole from a shop under pressure.'
    const text = essay({ body1: `${BODY1} ${trigger}` })
    const analysis = analyze(text)
    const hits = overlapping(analysis, text, 'citizen that stole', 'who-for-people')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((i) => i.severity === 'warning')).toBe(true)
  })

  it('B3 agreement: "prisoners are human being"', () => {
    const trigger = 'Many people forget that prisoners are human being with real feelings.'
    const text = essay({ body2: `${BODY2} ${trigger}` })
    const analysis = analyze(text)
    const hits = overlapping(analysis, text, 'are human being', 'agreement')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((i) => i.severity === 'warning')).toBe(true)
  })

  it('B4 connector-misuse: ", meanwhile others believe that education is the key"', () => {
    const trigger =
      'Some people support longer sentences, meanwhile others believe that education is the key.'
    const text = essay({ body2: `${BODY2} ${trigger}` })
    const analysis = analyze(text)
    const hits = overlapping(analysis, text, ', meanwhile others believe', 'connector-misuse')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((i) => i.severity === 'warning')).toBe(true)
  })

  it('B5 collocation: "education is the key for preventing this act"', () => {
    const trigger = 'Some argue that education is the key for preventing this act.'
    const text = essay({ body2: `${BODY2} ${trigger}` })
    const analysis = analyze(text)
    const hits = overlapping(analysis, text, 'key for preventing', 'collocation')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((i) => i.severity === 'warning')).toBe(true)
  })
})

/* ---------------------- Part C: structure & task response -------------------- */

describe('Patch v2 — Part C (structure and task response)', () => {
  it('C1 body-support: "Consider the case of …" counts as an example marker', () => {
    // No "for example"/"such as"/digit anywhere in this body — only the new
    // marker can satisfy the support check.
    const body1 =
      'Consider the case of a normal citizen who stole from a shop. Poverty pushed him toward the theft, and a fair court weighed his background. Short training programmes gave him a second chance to rebuild an honest career. Judges in similar cases now favour that mixed approach.'
    const analysis = analyze(essay({ body1 }))
    const support = check(analysis, 'body-1-support')
    expect(support).toBeDefined()
    expect(support?.satisfied).toBe(true)
  })

  it('C2 intro-shape: 5-sentence introduction containing "For example,"', () => {
    const intro =
      'Many countries debate how to punish offenders. Some favour long prison terms. Others prefer education inside prisons. For example, Norway runs short sentences with training. In my opinion, both sides deserve a fair hearing.'
    const analysis = analyze(essay({ intro }))
    const hits = byCategory(analysis, 'intro-shape')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((i) => i.severity === 'warning')).toBe(true)
  })

  it('C3 conclusion-shape: 1-sentence conclusion', () => {
    const conclusion =
      'In conclusion, I believe cities should keep investing in affordable public transport for the future.'
    const analysis = analyze(essay({ conclusion }))
    expect(byCategory(analysis, 'conclusion-shape').length).toBeGreaterThan(0)
  })

  it('C4 position-consistency: absolute introduction vs hedged conclusion', () => {
    const intro =
      'Rising offences worry many citizens and governments across modern societies today. Newspapers report violent incidents almost daily in large capitals. In my opinion, serious crimes must face serious response.'
    const conclusion =
      'In conclusion, I believe long sentences are needed for specific cases. Judges should weigh each situation with care.'
    const analysis = analyze(essay({ intro, conclusion }))
    const hits = byCategory(analysis, 'position-consistency')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((i) => i.severity === 'warning')).toBe(true)
  })

  it("C4 position-consistency: fires when the hedged conclusion also contains an absolute ('is a must')", () => {
    // The exact flip from the calibration essay: the conclusion hedges with
    // 'specific cases' while still containing 'must' — the hedge wins.
    const intro =
      'Rising offences worry many citizens and governments across modern societies today. Newspapers report violent incidents almost daily in large capitals. In my opinion, serious crimes must face serious response.'
    const conclusion =
      'In conclusion, I believe long sentences are needed for specific cases, and educating the prisoners is a must for the society. Judges should weigh each situation with care.'
    const analysis = analyze(essay({ intro, conclusion }))
    expect(byCategory(analysis, 'position-consistency').length).toBeGreaterThan(0)
  })

  it('C5 complex-count: only 2 complex structures leaves the check unsatisfied', () => {
    // Exactly two subordinator/relative markers in the whole essay:
    // "because" (body 1) and "who" (body 2). Intro and conclusion have none.
    const text = [
      'In my opinion, governments should spend more money on public transport. Buses and trains carry large numbers of passengers at a low price. This investment also cuts pollution in crowded areas.',
      'Cheap tickets encourage drivers to leave their cars at home, because fewer cars mean shorter queues on busy roads. For example, several European capitals have cut rush-hour delays with better bus lanes. The savings also allow local councils to repair roads more often. Cleaner air is a welcome bonus for residents too.',
      'Public transport also supports older residents in their daily routines. Many pensioners who no longer drive still need to reach markets and clinics. For instance, free travel passes in Britain help them stay active and connected. Such schemes also ease pressure on crowded hospitals. The policy costs little and delivers real social value.',
      'In conclusion, I believe public transport deserves greater support from national budgets. The benefits reach drivers and passengers alike across the country.',
    ].join('\n\n')
    const analysis = analyze(text)
    const complexCount = check(analysis, 'complex-count')
    expect(complexCount).toBeDefined()
    expect(complexCount?.satisfied).toBe(false)
  })
})

/* ------------------------- negative cases (guards) --------------------------- */

describe('Patch v2 — negative cases (false-positive guards)', () => {
  it('a clean two-sentence conclusion yields no fragment / connector-comma / comma-splice', () => {
    const conclusion =
      'In conclusion, although uniforms limit self-expression, I believe schools should require them. They remove a daily source of comparison between students, and that matters more at school than personal style does.'
    const analysis = analyze(essay({ conclusion }))
    expect(byCategory(analysis, 'fragment')).toEqual([])
    expect(byCategory(analysis, 'connector-comma')).toEqual([])
    expect(byCategory(analysis, 'comma-splice')).toEqual([])
  })

  it('"Society benefits from education." yields no article issue (uncountables)', () => {
    const text = essay({ body2: `${BODY2} Society benefits from education.` })
    const analysis = analyze(text)
    expect(byCategory(analysis, 'article')).toEqual([])
  })
})
