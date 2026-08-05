/**
 * Band-model calibration (SPEC.md "analysis/bandEstimate.ts").
 *
 * Every criterion starts at 7.0. Before the reward paths existed, the only two
 * upward moves in the whole model were a TR +0.5 and a GRA +0.5, so the best
 * score any essay could reach was (7.5 + 7 + 7 + 7.5) / 4 = 7.25, which the
 * conservative rounding took down to 7.0. Bands 8 and 9 were unreachable by
 * construction — a flawless answer and a merely adequate one both landed on 7.
 *
 * These tests hold the two ends apart: a genuine high-band answer must reach 8,
 * and a weak-but-not-broken answer must stay well below it. The rewards are
 * deliberately evidence-based rather than absence-based, so an unambitious
 * essay that the rule set happens not to catch cannot drift upward on silence.
 */
import { describe, expect, it } from 'vitest'
import { analyzeEssay } from '../src/analysis/engine'
import { PROMPTS } from '../src/prompts/bank'
import type { Analysis, Criterion, PromptSpec } from '../src/types'

const OP05: PromptSpec = PROMPTS.find((p) => p.id === 'op-05')!
const CRITERIA: Criterion[] = ['TR', 'CC', 'LR', 'GRA']

/** The reported Band 8–9 answer to op-05. */
const STRONG = `When choosing a career, people often have to decide whether to prioritise financial rewards or personal fulfilment. Although a high salary can provide security and a comfortable lifestyle, I largely agree that job satisfaction is more important, provided that a person earns enough to meet their essential needs.

The main reason is that work has a significant effect on a person's overall well-being. Most full-time employees spend a considerable proportion of their lives at work. If they find their responsibilities meaningful and suited to their abilities, they are more likely to remain motivated, productive and emotionally healthy. In contrast, someone who dislikes their job may experience constant stress and eventually suffer from burnout, regardless of how much they earn. A generous salary may make an unpleasant position tolerable temporarily, but it rarely compensates for years of daily dissatisfaction.

Furthermore, job satisfaction can contribute to professional development and ultimately lead to higher earnings. Employees who enjoy their work are generally more willing to improve their skills, accept new responsibilities and solve difficult problems. For example, a software developer who chooses a moderately paid position offering strong mentorship, autonomy and interesting projects may progress faster than one who accepts a repetitive but better-paid role. As the first developer gains valuable experience, their market value and future earning potential are also likely to increase. Therefore, satisfaction and financial success are not necessarily opposing goals.

Nevertheless, salary should not be ignored. People with dependants, debts or high living expenses need a reliable income, and serious financial pressure can itself destroy job satisfaction. Choosing enjoyable work that cannot support a reasonable standard of living would therefore be impractical. Ideally, individuals should establish the minimum salary they require and then compare suitable careers according to factors such as purpose, working conditions and opportunities for growth.

In conclusion, I believe job satisfaction should take priority once a person's basic financial requirements have been met. While money improves living standards, fulfilling and sustainable work has a greater influence on long-term happiness, performance and career success.`

/**
 * A weak-but-not-broken answer to the same prompt: on topic, correctly
 * paragraphed, over 250 words, and free of the errors the rule set hunts for —
 * but narrow in vocabulary, flat in sentence shape and thin in development.
 * This is the essay the reward paths must NOT lift.
 */
const WEAK = `Nowadays many people think about job when they choose a career. Some people want money and some people want to be happy in their job. I want to talk about this topic in my essay and give my opinion about it.

Money is very important for people. People need money to buy food and to pay for house. If a person has a lot of money, the person can buy many things. A lot of people work in a job they do not like because the money is good. This is a normal thing in many countries today.

But job satisfaction is also important for people. If a person likes the job, the person is happy every day. A happy worker is a good worker and the company gets good results. Many people say that money is not everything in life. I think this is true for most people in the world.

Another point is about the family of the worker. If a worker is not happy, the worker brings the bad mood to the home. The family of the worker can feel this bad mood every day. So the job of a person is not only about the person. It is about all the family of the person and also the friends of the person in many cases.

In conclusion, I think job satisfaction is more important than money for most people. But people also need enough money to live. So both things are important and people must find a good balance between them in their career.`

const strong: Analysis = analyzeEssay(STRONG, OP05)
const weak: Analysis = analyzeEssay(WEAK, OP05)

describe('a high-band essay reaches the high bands', () => {
  it('scores at least 8.0 overall', () => {
    expect(strong.band.overall).toBeGreaterThanOrEqual(8)
  })

  it('scores at least 8.0 on every criterion', () => {
    for (const c of CRITERIA) {
      expect(strong.band.byCriterion[c], c).toBeGreaterThanOrEqual(8)
    }
  })

  it('proves the top reward step is reachable', () => {
    // 7.0 base + three 0.5 rewards. If this drops, a criterion lost a path up.
    expect(Math.max(...CRITERIA.map((c) => strong.band.byCriterion[c]))).toBe(8.5)
  })

  it('explains the score with the rewards it actually earned', () => {
    expect(strong.band.rationale.LR.join(' ')).toContain('(+0.5)')
    expect(strong.band.rationale.CC.join(' ')).toContain('linking devices')
  })
})

describe('a weak essay stays where it belongs', () => {
  it('scores no higher than 6.5 overall', () => {
    expect(weak.band.overall).toBeLessThanOrEqual(6.5)
  })

  it('sits at least a full band below the strong essay', () => {
    expect(strong.band.overall - weak.band.overall).toBeGreaterThanOrEqual(1)
  })

  it('earns no reward for range it does not demonstrate', () => {
    // Narrow vocabulary and flat sentences: neither the LR range steps nor the
    // GRA range steps may fire, whatever else the rules did or did not detect.
    expect(weak.stats.typeTokenRatio).toBeLessThan(0.65)
    expect(weak.band.rationale.LR.join(' ')).not.toContain('Wide vocabulary range')
    expect(weak.band.rationale.GRA.join(' ')).not.toContain('Wide mix of sentence lengths')
  })
})

describe('rewards are evidence-based, not absence-based', () => {
  /* A short, clean, utterly plain essay: the rule set finds little to say, but
     it demonstrates no range either, so the range rewards must stay shut. */
  const PLAIN = [
    'Some people prefer a career that pays well. Others prefer a career they enjoy. This essay looks at both sides of the question before reaching a view.',
    'A high salary helps a worker plan for the years ahead. It pays for housing and for the education of children. For example, a well paid engineer can save for a deposit within a few years. Money therefore buys a measure of security that few workers would give up lightly.',
    'Enjoyment matters as well. A worker who likes the daily tasks will stay in post for longer. For instance, a nurse who values the work will keep learning and will serve patients better. That steady commitment is worth a great deal to any employer.',
    'In conclusion, both pay and enjoyment shape a good career. The balance between them depends on the stage a worker has reached.',
  ].join('\n\n')

  const plain = analyzeEssay(PLAIN, OP05)

  it('does not hand a plain essay the vocabulary-range rewards on silence alone', () => {
    if (plain.stats.typeTokenRatio < 0.75) {
      expect(plain.band.rationale.LR.join(' ')).not.toContain('Content words are rarely reused')
    }
  })

  it('keeps a plain essay below the strong one', () => {
    expect(plain.band.overall).toBeLessThan(strong.band.overall)
  })
})
