/**
 * Two of the three CC linker rules — `linking-overuse` and `linking-underuse`
 * — asserted by nothing before this file. `grep -rn "linking-overuse\|linking-
 * underuse" tests/` returned exactly one hit at plan 021's baseline: a comment
 * in `tests/false-positive-corpus.test.ts` explaining why corpus entries stay
 * short enough to AVOID triggering them. That is the opposite of coverage.
 *
 * Both feed the Coherence & Cohesion band and the learner-facing feedback
 * panel. Three mutations survived at the baseline: `> 0.5` to `> 0.99` and
 * `>= 8` to `>= 800` both silence `linking-overuse` outright, and `>= 200` to
 * `>= 20000` disables `linking-underuse` for every essay a human will ever
 * write.
 *
 * Drives the real `analyzeEssay` (`import { analyzeEssay } from
 * '../src/analysis/engine'`), never `cohesionRules` in isolation —
 * `tests/paragraphing-gate.test.ts:9-11` states the house reason: driving the
 * real pipeline pins the rule AND its interaction with the tokenizer.
 */
import { describe, expect, it } from 'vitest'
import { analyzeEssay } from '../src/analysis/engine'
import type { Analysis, IssueCategory } from '../src/types'

function messagesFor(a: Analysis, category: IssueCategory): string[] {
  return a.issues.filter((i) => i.category === category).map((i) => i.message)
}

/**
 * A paragraph of `words` distinct-looking tokens, mirroring
 * `tests/paragraphing-gate.test.ts:31-34`. `WORD_RE` has no digit class, so
 * "alpha0" tokenizes to exactly one word, "alpha" — the count is exact, but
 * every token is the SAME word by lowercase form. That is fine here: these
 * fixtures only assert on `linking-overuse`/`linking-underuse`, which filter
 * by category, and the filler's job is purely to hit an exact word count.
 */
function para(words: number, seed: string): string {
  const out: string[] = []
  for (let i = 0; i < words; i++) out.push(`${seed}${i}`)
  return `${out.join(' ')}.`
}

describe('linking-overuse', () => {
  it('flags mechanical signposting when more than half the sentences open with a linker', () => {
    // 8 sentences, 5 linker-opened (1, 3, 5, 7, 8 — 0.625), never three in a
    // row: the run of linker-initial sentences is at most 2 (indices 6-7 of
    // 0-based positions {0,2,4,6,7}). Distinct devices, so linking-repetition
    // stays out of the way too.
    const text = [
      'However, remote work reshaped daily routines for millions of employees worldwide.',
      'Many companies adapted their offices to support flexible schedules for staff.',
      'Moreover, new tools made virtual meetings simple and efficient for teams everywhere.',
      'Employees reported feeling more productive under flexible working conditions overall.',
      'Therefore, businesses began investing heavily in digital infrastructure across departments.',
      'Not every industry adapted at the same speed during this shift.',
      'Finally, governments started drafting new labour policies for remote workers.',
      'Consequently, the traditional office model may never fully return again.',
    ].join(' ')

    const a = analyzeEssay(text, null)
    const messages = messagesFor(a, 'linking-overuse')
    expect(messages.some((m) => /More than half of your sentences open with a linking word/.test(m))).toBe(
      true,
    )
    // The two triggers stay separable: no message from the OTHER trigger.
    expect(messages.some((m) => /third sentence in a row/.test(m))).toBe(false)
  })

  it('stays silent when under half of them do', () => {
    // 9 sentences, 4 linker-opened (1, 3, 6, 9 — 0.444), never adjacent.
    // Without this true-negative half, the case above would pass for a rule
    // that fires unconditionally.
    const text = [
      'However, urban populations continue to grow faster than rural areas worldwide.',
      'This trend affects housing markets and public transport systems significantly.',
      'Moreover, city planners face growing pressure to build sustainable infrastructure quickly.',
      'Traffic congestion remains a persistent problem in many expanding cities.',
      'Local governments have proposed various solutions to ease commuter pressure.',
      'Therefore, investment in public transport has become a policy priority nationwide.',
      'Some residents remain skeptical about the pace of these proposed changes.',
      'Community groups continue to debate the fairness of new zoning laws.',
      'Finally, experts agree that coordinated regional planning will be essential going forward.',
    ].join(' ')

    const a = analyzeEssay(text, null)
    expect(messagesFor(a, 'linking-overuse')).toEqual([])
  })

  it('does not judge signposting density on a draft too short to have a pattern', () => {
    // 7 sentences (below the sentenceCount >= 8 floor), 5 linker-opened
    // (1, 2, 4, 5, 7 — 0.714, well over the ratio), never three in a row
    // (runs of at most 2 at positions {0,1} and {3,4}). Kills `>= 8 => >= 7`
    // and, with the first case, pins the floor from both sides.
    const text = [
      'However, exam scores have risen steadily across many secondary schools recently.',
      'Moreover, teachers report higher engagement levels among students in classrooms.',
      'Parents have welcomed these improvements with cautious optimism about the future.',
      'Therefore, education boards plan to expand the programme to more schools.',
      'Consequently, funding requests for similar initiatives have increased substantially this year.',
      'Some critics argue that results vary too much between different regions.',
      "Finally, independent researchers will review the programme's long-term effectiveness carefully.",
    ].join(' ')

    const a = analyzeEssay(text, null)
    expect(messagesFor(a, 'linking-overuse')).toEqual([])
  })
})

describe('linking-underuse', () => {
  // A single linker sentence, then filler padded to an exact total word
  // count. WORD_RE has no digit class, so "however"/"this"/... plus the
  // digit-suffixed filler tokens each contribute exactly one word.
  // "overall" is itself a linking device (LEXICON.conclusion), so it is
  // avoided here — the point of this sentence is exactly ONE distinct device.
  const LINKER_SENTENCE =
    'However, this point matters a great deal for the argument itself.'
  const LINKER_WORDS = 11 // However, this, point, matters, a, great, deal, for, the, argument, itself

  it('asks for more signposting once the essay is long enough to need it', () => {
    // Exactly 200 words total, exactly one distinct linking device ("however").
    // Kills `>= 200 => >= 20000`.
    const text = `${LINKER_SENTENCE}\n\n${para(200 - LINKER_WORDS, 'alpha')}`
    const a = analyzeEssay(text, null)

    // Pinned ON the boundary: case below is this essay minus one word, so the
    // pair only proves the gate if this one truly sits at 200.
    expect(a.stats.wordCount).toBe(200)

    const messages = messagesFor(a, 'linking-underuse')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatch(/only 1 distinct linking device/)
  })

  it('stays silent one word below the gate', () => {
    // Same essay, one word shorter. Kills `>= 200 => >= 201` and documents the
    // boundary as behaviour rather than as a literal.
    const text = `${LINKER_SENTENCE}\n\n${para(199 - LINKER_WORDS, 'alpha')}`
    const a = analyzeEssay(text, null)

    expect(a.stats.wordCount).toBe(199)
    expect(messagesFor(a, 'linking-underuse')).toEqual([])
  })
})
