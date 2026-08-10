/**
 * False-positive regression suite, built from a real high-band answer to the
 * bank prompt `op-05` (job satisfaction vs salary).
 *
 * The essay below is examiner-clean: it was reported as Band 8–9 work, and the
 * engine flagged 2 errors and 7 warnings against it. Every one was a detector
 * defect, not a fault in the writing:
 *
 *  - `article` fired three times on 'job satisfaction', where 'job' is the
 *    MODIFIER of a compound and takes no determiner of its own;
 *  - one of those three walked left across half a clause and suggested writing
 *    "an and serious financial pressure can itself destroy job";
 *  - `repetition` emitted the SAME essay-level sentence four times for one
 *    stem, at a flat count threshold that ignores essay length;
 *  - `prompt-echo` called "when choosing a career" copying, though no answer to
 *    this question can avoid naming its subject.
 *
 * Everything here runs through the REAL pipeline (`analyzeEssay`) with the real
 * bank prompt, so a regression in any rule module surfaces.
 */
import { describe, expect, it } from 'vitest'
import { analyzeEssay } from '../src/analysis/engine'
import { PROMPTS } from '../src/prompts/bank'
import type { Analysis, IssueCategory, PromptSpec } from '../src/types'

const OP05: PromptSpec = PROMPTS.find((p) => p.id === 'op-05')!

const CLEAN_ESSAY = `When choosing a career, people often have to decide whether to prioritise financial rewards or personal fulfilment. Although a high salary can provide security and a comfortable lifestyle, I largely agree that job satisfaction is more important, provided that a person earns enough to meet their essential needs.

The main reason is that work has a significant effect on a person's overall well-being. Most full-time employees spend a considerable proportion of their lives at work. If they find their responsibilities meaningful and suited to their abilities, they are more likely to remain motivated, productive and emotionally healthy. In contrast, someone who dislikes their job may experience constant stress and eventually suffer from burnout, regardless of how much they earn. A generous salary may make an unpleasant position tolerable temporarily, but it rarely compensates for years of daily dissatisfaction.

Furthermore, job satisfaction can contribute to professional development and ultimately lead to higher earnings. Employees who enjoy their work are generally more willing to improve their skills, accept new responsibilities and solve difficult problems. For example, a software developer who chooses a moderately paid position offering strong mentorship, autonomy and interesting projects may progress faster than one who accepts a repetitive but better-paid role. As the first developer gains valuable experience, their market value and future earning potential are also likely to increase. Therefore, satisfaction and financial success are not necessarily opposing goals.

Nevertheless, salary should not be ignored. People with dependants, debts or high living expenses need a reliable income, and serious financial pressure can itself destroy job satisfaction. Choosing enjoyable work that cannot support a reasonable standard of living would therefore be impractical. Ideally, individuals should establish the minimum salary they require and then compare suitable careers according to factors such as purpose, working conditions and opportunities for growth.

In conclusion, I believe job satisfaction should take priority once a person's basic financial requirements have been met. While money improves living standards, fulfilling and sustainable work has a greater influence on long-term happiness, performance and career success.`

function analyze(text: string, prompt: PromptSpec | null = OP05): Analysis {
  return analyzeEssay(text, prompt)
}

function categoryOf(analysis: Analysis, category: IssueCategory) {
  return analysis.issues.filter((i) => i.category === category)
}

/** The words a span actually covers — used to prove a highlight stayed local. */
function spanWords(text: string, start: number, end: number): string[] {
  return text.slice(start, end).split(/\s+/).filter(Boolean)
}

/* ------------------------- the essay as a whole ----------------------------- */

describe('a clean high-band essay', () => {
  const analysis = analyze(CLEAN_ESSAY)

  it('is the essay the suite thinks it is', () => {
    expect(analysis.stats.wordCount).toBe(337)
    expect(analysis.stats.paragraphCount).toBe(5)
  })

  it('raises no errors at all', () => {
    expect(analysis.issues.filter((i) => i.severity === 'error')).toEqual([])
  })

  it('raises no warnings at all', () => {
    expect(analysis.issues.filter((i) => i.severity === 'warning')).toEqual([])
  })
})

/* ------------------------------- article ------------------------------------ */

describe('article — compound modifiers', () => {
  it("does not ask for a determiner before 'job' in 'job satisfaction'", () => {
    expect(categoryOf(analyze(CLEAN_ESSAY), 'article')).toEqual([])
  })

  it('leaves other compounds whose head is an abstract noun alone', () => {
    const compounds = [
      'Good time management helps every employee.',
      'Strong job security matters to most workers.',
      'Modern city development affects everyone.',
      'Poor school attendance worries teachers.',
      'Real job opportunities appear every year.',
    ]
    for (const sentence of compounds) {
      expect(categoryOf(analyze(sentence, null), 'article'), sentence).toEqual([])
    }
  })

  it('leaves compounds whose head is a plain noun alone', () => {
    for (const sentence of ['The job market is difficult.', 'Job seekers face real problems.']) {
      expect(categoryOf(analyze(sentence, null), 'article'), sentence).toEqual([])
    }
  })

  it('still flags a bare countable noun that is genuinely missing its article', () => {
    // Punctuation, not whitespace, separates the pair — not a compound, so the
    // bare 'job' after a preposition is still a real missing article.
    const withComma = analyze('Without job, satisfaction means very little indeed.', null)
    expect(categoryOf(withComma, 'article').length).toBeGreaterThan(0)

    const lost = analyze('He lost job last year and never recovered.', null)
    expect(categoryOf(lost, 'article').length).toBeGreaterThan(0)

    // A following -s word is a VERB, so the guard must not swallow this one.
    const student = analyze('Student needs a good teacher to make progress.', null)
    expect(categoryOf(student, 'article').length).toBeGreaterThan(0)
  })
})

describe('article — the leftward walk', () => {
  it('stays silent instead of reporting a phrase that spans half a clause', () => {
    const runaway =
      'People need a reliable income, and serious financial pressure can itself destroy job security.'
    expect(categoryOf(analyze(runaway, null), 'article')).toEqual([])
  })

  /**
   * The cap itself, pinned.
   *
   * This block used to be vacuous: its fixtures all stopped on a determiner or
   * a stop-set verb within two steps, so `MAX_MODIFIER_WALK` could be raised
   * from 3 to 99 with the whole suite still green — the constant it claimed to
   * hold was not held by anything.
   *
   * Each sentence below puts FOUR or more crossable words between the countable
   * noun and the nearest stop ("…pressure can itself undermine system"): none
   * is a determiner, a preposition, a stop-set verb or a comma, so only the cap
   * ends the walk. At 3 the rule gives up and says nothing, which is correct —
   * there is no noun phrase here to name. Raise the constant and all three
   * report one, which is how this test now fails if the cap goes.
   */
  it('gives up rather than walk further than a real adjective stack', () => {
    const beyondTheCap = [
      'Local councils spent carefully but sustained financial pressure can itself undermine system.',
      'Ministers argued endlessly and repeated public consultation cannot quickly change result.',
      'Students revised carefully but limited classroom support will not improve chance.',
    ]
    for (const text of beyondTheCap) {
      expect(categoryOf(analyze(text, null), 'article'), text).toEqual([])
    }
  })

  it('never highlights more than a short noun phrase', () => {
    // 'find' and 'believe' are outside the walk's verb stop-set, so without the
    // cap the walk escapes leftward and drags the whole clause into the span.
    const texts = [
      'The crime rate fell due to new prison system in recent years.',
      'After the reform, I believe result was better for everyone involved.',
      'Many observers find situation difficult to explain in simple terms.',
    ]
    for (const text of texts) {
      for (const issue of categoryOf(analyze(text, null), 'article')) {
        const words = spanWords(text, issue.start!, issue.end!)
        expect(words.length, `${text} → ${words.join(' ')}`).toBeLessThanOrEqual(4)
        // The suggestion quotes the span, so a sane span means a sane message.
        expect(issue.message).not.toMatch(/\b(can|itself|believe|find)\b/)
      }
    }
  })

  it('still names the adjective stack when it really is one', () => {
    const text = 'The crime rate fell due to new prison system in recent years.'
    const hits = categoryOf(analyze(text, null), 'article')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].message).toContain('a new prison system')
  })
})

/* ------------------------------ repetition ---------------------------------- */

describe('repetition', () => {
  it('does not fire on 6 uses of a topic stem across 337 words', () => {
    expect(categoryOf(analyze(CLEAN_ESSAY), 'repetition')).toEqual([])
  })

  it('emits ONE issue per over-used stem, not one per occurrence', () => {
    // 'burden' x8 with no prompt to exempt it; 2% of ~290 words is 6.
    const sentence = 'The burden is real.'
    const text = [
      `Many families carry a heavy burden every single day of the year. ${sentence.repeat(1)}`,
      `A financial burden grows when wages stay flat, and that burden falls hardest on the young. This burden is not shared fairly at all.`,
      `Another burden appears whenever housing costs rise sharply. The burden of rent is the clearest burden of them all, and no burden is heavier.`,
    ].join('\n\n')
    const analysis = analyze(text, null)
    const hits = categoryOf(analysis, 'repetition')
    expect(hits).toHaveLength(1)
    expect(hits[0].message).toContain('burden')
    expect(hits[0].message).toMatch(/appears \d+ times/)
  })

  it('scales its threshold with essay length', () => {
    const filler = (n: number, seed: string) =>
      Array.from({ length: n }, (_, i) => `${seed}${i}`).join(' ')
    // Six uses of 'burden' — over the floor of 5, under 2% of a long essay.
    const six = 'A burden appears. The burden grows. Another burden arrives. Each burden costs. Every burden hurts. No burden helps.'
    const short = `${six} ${filler(120, 'w')}.`
    const long = `${six} ${filler(340, 'w')}.`
    expect(categoryOf(analyze(short, null), 'repetition')).toHaveLength(1)
    expect(categoryOf(analyze(long, null), 'repetition')).toEqual([])
  })
})

/* ----------------------------- prompt-echo ---------------------------------- */

describe('prompt-echo', () => {
  it('does not call unavoidable shared wording copying', () => {
    expect(categoryOf(analyze(CLEAN_ESSAY), 'prompt-echo')).toEqual([])
  })

  it('leaves the writer free to name the proposition they are agreeing with', () => {
    const text = 'I largely agree that job satisfaction is more important, provided that a person earns enough to live on.'
    expect(categoryOf(analyze(text), 'prompt-echo')).toEqual([])
  })

  it('still flags a clause lifted wholesale from the question', () => {
    const text =
      'Some people think that job satisfaction is more important than a high salary when choosing a career. I agree with this idea completely.'
    const hits = categoryOf(analyze(text), 'prompt-echo')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].severity).toBe('error')
    const lifted = text.slice(hits[0].start!, hits[0].end!)
    expect(lifted.split(/\s+/).length).toBeGreaterThanOrEqual(8)
  })

  it('deducts the lifted words from the effective word count', () => {
    const lift = 'Some people think that job satisfaction is more important than a high salary when choosing a career.'
    const body = Array.from({ length: 240 }, (_, i) => `point${i}`).join(' ')
    const analysis = analyze(`${lift} ${body}.`)
    const wc = categoryOf(analysis, 'word-count')
    expect(wc.length).toBeGreaterThan(0)
    expect(wc[0].message).toContain('copied from the question')
  })
})

/* --------------------------- hyphenated compounds ---------------------------- */

/**
 * A word boundary sits between `after` and `-`, so an unguarded `\bafter\b`
 * matches the `after` inside `after-school` and credits a compound MODIFIER as
 * a subordinate clause. Real learner text hit this: "offering enjoyable
 * after-school sports" scored a complex-sentence marker it had not earned.
 *
 * `analysis/complexity.ts` guards every marker alternation with `(?!-)`. These
 * cases pin the guard from both sides — it must suppress the compound and
 * nothing else.
 */
describe('hyphenated compounds are not complex markers', () => {
  /** The rail's complex-count detail, which names the running total. */
  function complexDetail(text: string): string {
    const check = analyze(text, null).structure.find((c) => c.id === 'complex-count')
    return check?.detail ?? ''
  }

  it('does not count the "after" inside "after-school"', () => {
    expect(complexDetail('Schools should offer enjoyable after-school sports for every pupil.')).toContain(
      '0 of 4',
    )
  })

  it('still counts "after" when it genuinely opens a clause', () => {
    expect(complexDetail('Pupils relax after school sports finish for the day.')).toContain('1 of 4')
  })

  it('does not count the "before" inside "before-tax"', () => {
    expect(complexDetail('The report listed a before-tax figure for every department.')).toContain(
      '0 of 4',
    )
  })

  it('does not suppress a real marker merely because a hyphen appears elsewhere', () => {
    // 'well-known' is hyphenated but is not a marker; 'which' must still count.
    expect(complexDetail('This is a well-known problem, which many councils now face.')).toContain(
      '1 of 4',
    )
  })

  it('leaves the GRA marker count unaffected by hyphenated compounds', () => {
    // sentence-variety needs >= 10 sentences before it speaks, so assert on the
    // clean essay staying clean rather than on a short fixture.
    const withCompounds = CLEAN_ESSAY.replace(
      'Employees who enjoy their work',
      'Employees in after-school programmes who enjoy their work',
    )
    expect(categoryOf(analyze(withCompounds), 'sentence-variety')).toEqual([])
  })
})
