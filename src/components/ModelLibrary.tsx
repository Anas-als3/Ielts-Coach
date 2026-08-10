/**
 * The model-answer library.
 *
 * The coach panel's "Model answer" tab only ever shows the answer for the
 * prompt currently on the writing desk — studying the worked-answer system as
 * a whole (reading several essays back to back, comparing letter tones,
 * seeing which prompts have an exact hand-written answer) meant drawing
 * prompts one at a time and reopening the tab each time. This view lists
 * every prompt in all three banks and, for whichever entry is open, renders
 * the SAME `ModelAnswer` component the coach panel uses. That is deliberate:
 * the scorecard, the fallback honesty notice and the memorisation warning are
 * `ModelAnswer`'s own render, so the library shows exactly what the panel
 * shows and can never quietly drift from it.
 *
 * Badges are computed from `task2ModelFor` / `letterModelFor` — the SAME
 * functions `ModelAnswer` itself calls — never a re-implementation of the
 * exact/fallback rule.
 *
 * Only the OPEN entry renders `ModelAnswer`. Grading is real engine work
 * (`analyzeEssay` / `analyzeLetter` / `analyzeTask1`, run inside `ModelAnswer`'s
 * own `useMemo`), and running it for all 67 entries on mount would burn cycles
 * nobody asked for — the closed list only ever shows data already in memory.
 */
import { useState } from 'react'
import type { LibrarySelection, ModelLibraryProps } from '../types'
import ModelAnswer from './ModelAnswer'
import { PROMPTS } from '../prompts/bank'
import { LETTER_PROMPTS } from '../prompts/letterBank'
import { TASK1_PROMPTS } from '../prompts/task1Bank'
import { task2ModelFor } from '../answers/task2Models'
import { letterModelFor } from '../answers/letterModels'
import { QUESTION_TYPE_META } from '../meta'
import './ModelLibrary.css'

export default function ModelLibrary({ onPractise }: ModelLibraryProps) {
  // Namespaced by group even though the three banks' id prefixes (op-/di-/…,
  // gt-, t1-) do not currently collide — a future bank should not be able to
  // make two unrelated entries expand together by accident.
  const [openId, setOpenId] = useState<string | null>(null)

  function toggle(entryId: string) {
    setOpenId((cur) => (cur === entryId ? null : entryId))
  }

  return (
    <div className="mlib-root">
      <p className="eyebrow">Model-answer library</p>
      <h2>Every worked answer, in one place</h2>
      <p className="mlib-intro">
        Every prompt in the three banks, with the same worked answer, engine-graded scorecard and
        memorisation warning the coach panel shows for the question on your desk. Open a prompt to
        read it — &ldquo;Practise this prompt&rdquo; puts the same question on a blank answer sheet.
      </p>

      <section className="mlib-group" aria-labelledby="mlib-task2-heading">
        <h3 id="mlib-task2-heading">Task 2 essays</h3>
        <ul className="mlib-list">
          {PROMPTS.map((p) => {
            const entryId = `task2-${p.id}`
            const exact = task2ModelFor(p)?.exact === true
            const open = openId === entryId
            const panelId = `mlib-panel-${entryId}`
            const selection: LibrarySelection = { kind: 'task2', prompt: p }
            return (
              <li key={entryId} className="mlib-entry">
                <button
                  type="button"
                  className="mlib-entry-header"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => toggle(entryId)}
                >
                  <span className="mlib-entry-top">
                    <span className="mlib-entry-id mono">{p.id}</span>
                    <span className="mlib-entry-meta">
                      {QUESTION_TYPE_META[p.type].label} &middot; {p.topic}
                    </span>
                    <span className={exact ? 'mlib-badge mlib-badge-exact' : 'mlib-badge'}>
                      {exact
                        ? 'Worked answer for this exact question'
                        : `Type example — a worked answer to a different ${QUESTION_TYPE_META[p.type].label.toLowerCase()} question`}
                    </span>
                  </span>
                  <span className="mlib-entry-text">{p.text}</span>
                </button>
                {open && (
                  <div id={panelId} className="mlib-panel">
                    <ModelAnswer task="task2" prompt={p} task1Prompt={null} />
                    <button
                      type="button"
                      className="btn btn-primary mlib-practise"
                      onClick={() => onPractise(selection)}
                    >
                      Practise this prompt
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="mlib-group" aria-labelledby="mlib-letters-heading">
        <h3 id="mlib-letters-heading">General Training letters</h3>
        <ul className="mlib-list">
          {LETTER_PROMPTS.map((p) => {
            const entryId = `letter-${p.id}`
            const exact = letterModelFor(p)?.exact === true
            const open = openId === entryId
            const panelId = `mlib-panel-${entryId}`
            const selection: LibrarySelection = { kind: 'letter', prompt: p }
            return (
              <li key={entryId} className="mlib-entry">
                <button
                  type="button"
                  className="mlib-entry-header"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => toggle(entryId)}
                >
                  <span className="mlib-entry-top">
                    <span className="mlib-entry-id mono">{p.id}</span>
                    <span className="mlib-entry-meta">
                      {p.tone} &middot; {p.recipient}
                    </span>
                    <span className={exact ? 'mlib-badge mlib-badge-exact' : 'mlib-badge'}>
                      {exact
                        ? 'Worked answer for this exact question'
                        : `Type example — a worked answer to a different ${p.tone} letter`}
                    </span>
                  </span>
                  <span className="mlib-entry-text">{p.text}</span>
                </button>
                {open && (
                  <div id={panelId} className="mlib-panel">
                    <ModelAnswer task="task1" prompt={null} task1Prompt={null} letterPrompt={p} />
                    <button
                      type="button"
                      className="btn btn-primary mlib-practise"
                      onClick={() => onPractise(selection)}
                    >
                      Practise this prompt
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="mlib-group" aria-labelledby="mlib-task1-heading">
        <h3 id="mlib-task1-heading">Academic Task 1</h3>
        <ul className="mlib-list">
          {TASK1_PROMPTS.map((p) => {
            const entryId = `chart-${p.id}`
            const open = openId === entryId
            const panelId = `mlib-panel-${entryId}`
            const selection: LibrarySelection = { kind: 'chart', prompt: p }
            return (
              <li key={entryId} className="mlib-entry">
                <button
                  type="button"
                  className="mlib-entry-header"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => toggle(entryId)}
                >
                  <span className="mlib-entry-top">
                    <span className="mlib-entry-id mono">{p.id}</span>
                    <span className="mlib-entry-meta">{p.chart.title}</span>
                    <span className="mlib-badge mlib-badge-exact">
                      Generated from this chart&rsquo;s own numbers
                    </span>
                  </span>
                </button>
                {open && (
                  <div id={panelId} className="mlib-panel">
                    <ModelAnswer task="task1" prompt={null} task1Prompt={p} />
                    <button
                      type="button"
                      className="btn btn-primary mlib-practise"
                      onClick={() => onPractise(selection)}
                    >
                      Practise this prompt
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
