/**
 * The worked-answer panel.
 *
 * Shows an example answer to the question on screen, together with the band the
 * app's OWN engine gives it and the structure checks it satisfies. Running the
 * example back through the real analyser is the point: the learner can see that
 * the target is the same target the rail has been asking them to hit, rather
 * than taking the app's word for it.
 *
 * Coach mode only. Handing a learner a finished answer during a timed exam
 * would defeat the exercise, so `App` never renders this under exam conditions.
 */
import { useMemo } from 'react'
import type { ModelAnswerProps } from '../types'
import { analyzeEssay, analyzeTask1 } from '../analysis/engine'
import { buildTask1ModelAnswer } from '../answers/task1Model'
import { task2ModelFor } from '../answers/task2Models'
import { criterionLabel } from '../meta'
import { PROMPTS } from '../prompts/bank'
import type { Criterion } from '../types'
import './ModelAnswer.css'

const CRITERIA: Criterion[] = ['TR', 'CC', 'LR', 'GRA']

function formatBand(v: number): string {
  return v.toFixed(1)
}

export default function ModelAnswer({ task, prompt, task1Prompt }: ModelAnswerProps) {
  const model = useMemo(() => {
    if (task === 'task1') {
      if (!task1Prompt) return null
      return {
        text: buildTask1ModelAnswer(task1Prompt),
        exact: true,
        // Generated from this very chart, so the source is always the prompt
        // on screen.
        sourcePrompt: null,
        sourceLabel: task1Prompt.chart.title,
      }
    }
    const m = task2ModelFor(prompt)
    if (!m) return null
    // The prompt the answer was WRITTEN for, which is not always the one on
    // screen — see `sourcePrompt` below.
    const sourcePrompt = PROMPTS.find((p) => p.id === m.sourcePromptId) ?? prompt
    return { text: m.text, exact: m.exact, sourcePrompt, sourceLabel: m.sourcePromptId }
  }, [task, prompt, task1Prompt])

  const analysis = useMemo(() => {
    if (!model) return null
    if (task === 'task1' && task1Prompt) return analyzeTask1(model.text, task1Prompt)
    // Graded against the prompt the answer was written for, never the one on
    // screen. A fallback answer legitimately does not address the learner's
    // question, and scoring it against that question made the app mark its own
    // exemplar down on 14 of the 40 prompts — the exact failure SPEC.md's
    // worked-answer section promises cannot happen.
    return analyzeEssay(model.text, model.sourcePrompt)
  }, [model, task, prompt, task1Prompt])

  if (!model || !analysis) {
    return (
      <div className="ma-root">
        <p className="ma-empty">No worked answer is available for this question yet.</p>
      </div>
    )
  }

  const paragraphs = model.text.split(/\n{2,}/)
  const satisfied = analysis.structure.filter((c) => c.satisfied).length

  return (
    <div className="ma-root">
      <p className="eyebrow">A worked answer</p>

      {!model.exact && (
        <p className="ma-notice">
          This answers a different question of the same type. Study the shape and the order of the
          moves — the content will not fit your question.
        </p>
      )}

      {/* The app grading its own example, so the target is verifiable rather
          than asserted. */}
      <div className="ma-scorecard">
        <div className="ma-scorecard-head">
          <span className="ma-band mono">{formatBand(analysis.band.overall)}</span>
          <span className="ma-scorecard-note">
            scored by this app&rsquo;s own engine · {satisfied} of {analysis.structure.length}{' '}
            structure checks met
          </span>
        </div>
        <ul className="ma-criteria">
          {CRITERIA.map((c) => (
            <li key={c}>
              <span className="ma-crit-label">{criterionLabel(c, task).short}</span>
              <span className="ma-crit-value mono">{formatBand(analysis.band.byCriterion[c])}</span>
            </li>
          ))}
        </ul>
      </div>

      <article className="ma-text">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </article>

      <p className="ma-warning">
        Read it for the method, not the wording. Examiners recognise memorised phrasing and discount
        it, so reuse the structure and write the sentences yourself.
      </p>
    </div>
  )
}
