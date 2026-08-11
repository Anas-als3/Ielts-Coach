/**
 * TemplatePanel — the coach panel's "Template" tab. Plan 033 shipped section
 * descriptions with a couple of reworded openers; plan 034 rebuilt every
 * section as complete sentence frames, slots written `[like this]`.
 *
 * A learner staring at a blank sheet knows WHAT the question asks but not what
 * shape the answer should take. This panel offers a concrete, paragraph-by-
 * paragraph skeleton to follow WHILE writing — sentence frames with slots to
 * fill in the learner's own words — picked from `templatesFor` for the exact
 * desk on screen (task, letter tone or Task 2 question type), and tracks
 * which paragraph the learner is on against the live typed-paragraph count.
 *
 * Coach mode only, same as the cheat sheet and model answer — `App` gates the
 * whole panel-zone on `mode === 'coach'`. The template is a reference pane,
 * never inserted into the essay: pasted scaffolding would be analysed as the
 * learner's own words and flagged, and the exam bans it anyway.
 */
import type { ReactNode } from 'react'
import { useState } from 'react'
import type { TemplatePanelProps, WritingTemplate } from '../types'
import { templatesFor } from '../templates/bank'
import './TemplatePanel.css'

/**
 * `tp-done` when the learner has already finished this section's paragraph,
 * `tp-current` on the one they are on now (clamped to the last section when
 * they have written more paragraphs than the template has sections), plain
 * otherwise.
 */
function sectionClass(index: number, paragraphCount: number, total: number): string {
  if (index < paragraphCount) return 'tp-done'
  const current = Math.min(paragraphCount, total - 1)
  return index === current ? 'tp-current' : ''
}

/** Matches one `[bracketed]` slot. A frame never nests brackets. */
const SLOT_RE = /\[([^\]]+)\]/g

/**
 * Splits a frame on its `[slot]` markers and wraps each slot in a
 * `tp-slot` span, so the learner sees the sentence and its blanks at a
 * glance rather than a wall of undifferentiated text.
 */
function renderFrame(frame: string): ReactNode[] {
  const parts: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  SLOT_RE.lastIndex = 0
  while ((match = SLOT_RE.exec(frame)) !== null) {
    if (match.index > lastIndex) parts.push(frame.slice(lastIndex, match.index))
    parts.push(
      <span key={match.index} className="tp-slot">
        {match[1]}
      </span>,
    )
    lastIndex = SLOT_RE.lastIndex
  }
  if (lastIndex < frame.length) parts.push(frame.slice(lastIndex))
  return parts
}

export default function TemplatePanel({
  task,
  isLetter,
  questionType,
  tone,
  paragraphCount,
}: TemplatePanelProps) {
  const templates = templatesFor(task, isLetter, questionType ?? undefined, tone ?? undefined)
  const [selectedId, setSelectedId] = useState<string>(templates[0]?.id ?? '')
  const active: WritingTemplate | undefined = templates.find((t) => t.id === selectedId) ?? templates[0]

  if (!active) {
    return (
      <div className="tp-panel card">
        <div className="tp-empty">
          <p className="eyebrow">Template</p>
          <p className="tp-empty-text">No template is available for this question yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="tp-panel card">
      <div className="tp-head">
        <p className="eyebrow">Template</p>
        <span className="tp-select-shell">
          <select
            className="tp-select"
            aria-label="Choose a template"
            value={active.id}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </span>
      </div>

      {active.note && <p className="tp-note">{active.note}</p>}

      <p className="tp-legend">
        Sections you have written are marked done; the one you are on now is highlighted.
      </p>

      <ol className="tp-sections">
        {active.paragraphs.map((sectionSpec, i) => {
          const cls = sectionClass(i, paragraphCount, active.paragraphs.length)
          return (
            <li key={sectionSpec.title} className={`tp-section${cls ? ` ${cls}` : ''}`}>
              <p className="tp-section-title">
                <span className="tp-section-num mono">{i + 1}</span>
                {sectionSpec.title}
              </p>
              <p className="tp-section-guidance">{sectionSpec.guidance}</p>
              {sectionSpec.frames.length > 0 && (
                <div className="tp-frames">
                  {sectionSpec.frames.map((frame, frameIndex) => (
                    <p key={frameIndex} className="tp-frame">
                      {renderFrame(frame)}
                    </p>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ol>

      <p className="tp-warning">
        Frames are scaffolding. Fill every slot in your own words, and swap the connectors for
        ones you'd naturally use — examiners discount sentences they have read a thousand times,
        and every candidate using a template unchanged writes the same essay.
      </p>
    </div>
  )
}
