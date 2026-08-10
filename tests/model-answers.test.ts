/**
 * The app grades its own worked answers.
 *
 * A model answer that the engine would mark down is worse than no model answer:
 * the learner is shown a target, follows it, and is then penalised for the very
 * thing the example did. So every example — the twelve generated Task 1 answers
 * and the five hand-written Task 2 ones — is run back through the real analyser
 * here and has to come out clean.
 *
 * This is also the drift alarm. If a rule is tightened later and an example
 * stops passing, this file fails rather than the learner finding out.
 */
import { describe, expect, it } from 'vitest'
import { analyzeEssay, analyzeTask1 } from '../src/analysis/engine'
import { buildTask1ModelAnswer } from '../src/answers/task1Model'
import { TASK2_MODELS, task2ModelFor } from '../src/answers/task2Models'
import { TASK1_PROMPTS } from '../src/prompts/task1Bank'
import { PROMPTS } from '../src/prompts/bank'
import type { Analysis } from '../src/types'

/* --------------------------------- helpers ---------------------------------- */

/** Everything the app would show a learner as a fault. `info` is advisory. */
function faults(a: Analysis): string[] {
  return a.issues.filter((i) => i.severity !== 'info').map((i) => `${i.severity}:${i.category}`)
}

function unmetChecks(a: Analysis): string[] {
  return a.structure.filter((c) => !c.satisfied).map((c) => c.id)
}

/* ------------------------------ Task 1 answers ------------------------------- */

describe('every generated Task 1 answer passes the app that generated it', () => {
  for (const prompt of TASK1_PROMPTS) {
    describe(`${prompt.id} (${prompt.chart.kind})`, () => {
      const text = buildTask1ModelAnswer(prompt)
      const analysis = analyzeTask1(text, prompt)

      it('raises no errors or warnings', () => {
        expect(faults(analysis)).toEqual([])
      })

      it('satisfies every structure check', () => {
        expect(unmetChecks(analysis)).toEqual([])
      })

      it('scores at least 8.0 overall', () => {
        expect(analysis.band.overall).toBeGreaterThanOrEqual(8)
      })

      it('sits inside the Task 1 word-count target', () => {
        expect(analysis.stats.wordCount).toBeGreaterThanOrEqual(160)
        expect(analysis.stats.wordCount).toBeLessThanOrEqual(220)
      })

      it('quotes no figure the chart does not contain', () => {
        expect(analysis.issues.filter((i) => i.category === 't1-invented-figure')).toEqual([])
      })

      it('never assigns a conclusion paragraph', () => {
        expect(analysis.paragraphs.map((p) => p.role)).not.toContain('conclusion')
      })
    })
  }

  it('is deterministic — the same prompt always yields the same answer', () => {
    for (const prompt of TASK1_PROMPTS) {
      expect(buildTask1ModelAnswer(prompt)).toBe(buildTask1ModelAnswer(prompt))
    }
  })

  it('paraphrases rather than copying the chart title', () => {
    for (const prompt of TASK1_PROMPTS) {
      const analysis = analyzeTask1(buildTask1ModelAnswer(prompt), prompt)
      expect(analysis.issues.filter((i) => i.category === 't1-prompt-echo'), prompt.id).toEqual([])
    }
  })
})

/* ------------------------------ Task 2 answers ------------------------------- */

describe('every hand-written Task 2 answer passes the same engine', () => {
  for (const [promptId, text] of Object.entries(TASK2_MODELS)) {
    describe(promptId, () => {
      const prompt = PROMPTS.find((p) => p.id === promptId)
      const analysis = analyzeEssay(text, prompt ?? null)

      it('answers a prompt that exists in the bank', () => {
        expect(prompt, `${promptId} is not in PROMPTS`).toBeDefined()
      })

      it('raises no errors or warnings', () => {
        expect(faults(analysis)).toEqual([])
      })

      it('satisfies every structure check', () => {
        expect(unmetChecks(analysis)).toEqual([])
      })

      it('scores at least 8.0 overall', () => {
        expect(analysis.band.overall).toBeGreaterThanOrEqual(8)
      })

      it('clears the 250-word minimum with a safe margin', () => {
        expect(analysis.stats.wordCount).toBeGreaterThanOrEqual(260)
        expect(analysis.stats.wordCount).toBeLessThanOrEqual(330)
      })
    })
  }

  it('shows an answer scoring 8.0+ for EVERY prompt in the bank', () => {
    // The panel offers a worked answer for all 40 prompts, falling back to the
    // representative answer for the question type. Each must be graded against
    // the prompt it was WRITTEN for — grading it against the learner's prompt
    // marked the app's own exemplar down on 14 of 40. SPEC.md promises this
    // cannot happen; until now nothing asserted it.
    for (const prompt of PROMPTS) {
      const m = task2ModelFor(prompt)
      expect(m, prompt.id).not.toBeNull()
      const source = PROMPTS.find((p) => p.id === m!.sourcePromptId)!
      const analysis = analyzeEssay(m!.text, source)
      expect(
        analysis.band.overall,
        `${prompt.id} -> ${m!.sourcePromptId}`,
      ).toBeGreaterThanOrEqual(8)
      expect(faults(analysis), `${prompt.id} -> ${m!.sourcePromptId}`).toEqual([])
    }
  })

  it('covers all five question types', () => {
    const covered = new Set(
      Object.keys(TASK2_MODELS).map((id) => PROMPTS.find((p) => p.id === id)?.type),
    )
    expect(covered).toEqual(
      new Set(['opinion', 'discussion', 'problem-solution', 'advantages-disadvantages', 'double-question']),
    )
  })
})

/* -------------------------------- the lookup --------------------------------- */

describe('task2ModelFor', () => {
  it('returns the exact answer when one exists for that prompt', () => {
    const prompt = PROMPTS.find((p) => p.id === 'op-01')!
    const model = task2ModelFor(prompt)
    expect(model?.exact).toBe(true)
    expect(model?.sourcePromptId).toBe('op-01')
  })

  it('falls back to the same question type, and says it is not exact', () => {
    const prompt = PROMPTS.find((p) => p.id === 'op-05')!
    const model = task2ModelFor(prompt)
    expect(model?.exact).toBe(false)
    expect(model?.sourcePromptId).toBe('op-01')
  })

  it('offers an answer for every prompt in the bank', () => {
    for (const prompt of PROMPTS) {
      expect(task2ModelFor(prompt), prompt.id).not.toBeNull()
    }
  })

  it('returns null rather than guessing when there is no prompt', () => {
    expect(task2ModelFor(null)).toBeNull()
  })
})
