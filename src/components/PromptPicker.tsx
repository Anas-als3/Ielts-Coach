import { useMemo, useState } from 'react'
import type { PromptPickerProps, QuestionType } from '../types'
import { QUESTION_TYPE_META } from '../meta'
import './PromptPicker.css'

const TYPE_ORDER: QuestionType[] = [
  'opinion',
  'discussion',
  'problem-solution',
  'advantages-disadvantages',
  'double-question',
]

type TypeFilter = QuestionType | 'all'

/** Collapse whitespace and clip to a readable dropdown label. */
function truncateLabel(text: string, max = 48): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1).trimEnd()}…`
}

/** Chevron glyph for the styled select shells — decorative only. */
function SelectChevron() {
  return (
    <svg
      className="pp-select-chevron"
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 3.5 5 6.5 8 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function PromptPicker({ prompts, current, onPick }: PromptPickerProps) {
  const [filter, setFilter] = useState<TypeFilter>('all')

  const matching = useMemo(
    () => (filter === 'all' ? prompts : prompts.filter((p) => p.type === filter)),
    [prompts, filter],
  )

  function handleShuffle() {
    const pool = matching.length > 0 ? matching : prompts
    if (pool.length === 0) return
    // Never re-deal the prompt already on the desk when an alternative exists.
    const alternatives = current ? pool.filter((p) => p.id !== current.id) : pool
    const pickFrom = alternatives.length > 0 ? alternatives : pool
    const next = pickFrom[Math.floor(Math.random() * pickFrom.length)]
    if (next) onPick(next)
  }

  function handleSelect(id: string) {
    const next = prompts.find((p) => p.id === id)
    if (next) onPick(next)
  }

  const selectValue = current && matching.some((p) => p.id === current.id) ? current.id : ''

  return (
    <section className="pp-card card" aria-label="Essay prompt">
      <div className="pp-head">
        <p className="eyebrow pp-eyebrow">
          {current ? (
            <>
              <span className="pp-type-chip">{QUESTION_TYPE_META[current.type].label}</span>
              <span className="pp-eyebrow-topic">{current.topic}</span>
            </>
          ) : (
            'Task 2 · no prompt selected'
          )}
        </p>
        <div className="pp-controls">
          <span className="pp-select-shell">
            <select
              className="pp-select"
              aria-label="Filter prompts by question type"
              value={filter}
              onChange={(e) => setFilter(e.target.value as TypeFilter)}
            >
              <option value="all">All types</option>
              {TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {QUESTION_TYPE_META[t].label}
                </option>
              ))}
            </select>
            <SelectChevron />
          </span>
          <span className="pp-select-shell pp-select-shell-prompt">
            <select
              className="pp-select pp-select-prompt"
              aria-label="Choose a prompt"
              value={selectValue}
              onChange={(e) => handleSelect(e.target.value)}
            >
              <option value="" disabled>
                {matching.length === 0
                  ? 'No prompts of this type'
                  : `Choose from ${matching.length}…`}
              </option>
              {matching.map((p) => (
                <option key={p.id} value={p.id}>
                  {truncateLabel(`${p.topic} — ${p.text}`)}
                </option>
              ))}
            </select>
            <SelectChevron />
          </span>
          <button
            type="button"
            className="btn pp-shuffle"
            onClick={handleShuffle}
            disabled={prompts.length === 0}
          >
            <svg
              className="pp-shuffle-icon"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="16 3 21 3 21 8" />
              <line x1="4" y1="20" x2="21" y2="3" />
              <polyline points="21 16 21 21 16 21" />
              <line x1="15" y1="15" x2="21" y2="21" />
              <line x1="4" y1="4" x2="9" y2="9" />
            </svg>
            New prompt
          </button>
        </div>
      </div>

      {current ? (
        <>
          <p className="pp-text">{current.text}</p>
          {current.parts.length > 0 && (
            <details className="pp-parts">
              <summary className="pp-parts-summary">
                <svg
                  className="pp-parts-caret"
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3.5 2 6.5 5 3.5 8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                What to cover ({current.parts.length})
              </summary>
              <ul className="pp-parts-list">
                {current.parts.map((part) => (
                  <li key={part}>{part}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      ) : (
        <p className="pp-empty">
          Pick a prompt to start writing — press “New prompt” or choose one from the list.
        </p>
      )}
    </section>
  )
}
