/**
 * The Reading section's front door: which papers exist for the active exam,
 * what sitting one involves, and what the learner has scored before.
 *
 * The list is scoped to ONE module and says so. That is not tidiness: the two
 * exams' Reading papers are structured differently — General Training Section 1
 * is two or three short notices where an Academic passage is one long text —
 * and, more seriously, they convert through different tables. A General
 * Training candidate handed the Academic paper would be told 30/40 is a band
 * 7.0 when their own table says 6.0.
 */
import { useMemo } from 'react'
import type { ReadingPickerProps } from '../types'
import type { ReadingQuestionType, ReadingTest } from '../reading/types'
import { READING_MINUTES } from '../reading/types'
import { MODULE_META, READING_TYPE_META } from '../meta'
import './ReadingPicker.css'

/** Question types present in a paper, in first-appearance order, with counts. */
function typeBreakdown(test: ReadingTest): Array<{ type: ReadingQuestionType; count: number }> {
  const order: ReadingQuestionType[] = []
  const counts = new Map<ReadingQuestionType, number>()
  for (const question of test.questions) {
    if (!counts.has(question.type)) order.push(question.type)
    counts.set(question.type, (counts.get(question.type) ?? 0) + 1)
  }
  return order.map((type) => ({ type, count: counts.get(type) ?? 0 }))
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ReadingPicker({
  module,
  tests,
  history,
  onStart,
  onOpen,
}: ReadingPickerProps) {
  const moduleLabel = MODULE_META[module].label
  const breakdowns = useMemo(() => new Map(tests.map((t) => [t.id, typeBreakdown(t)])), [tests])

  return (
    <div className="rdp">
      <header className="rdp-head">
        <h1 className="rdp-title">Reading</h1>
        <p className="rdp-lead">
          {READING_MINUTES} minutes, 40 questions, no extra time to transfer answers. The clock
          starts the moment the paper opens and submits for you when it runs out.
        </p>
        <p className="rdp-exact">
          Reading is the one section this app can score <strong>exactly</strong>. It is an answer
          key and a published conversion table — there is no estimate and no hedging, unlike the
          form-only band the writing engine reports.
        </p>
      </header>

      <section className="rdp-list" aria-label={`${moduleLabel} Reading papers`}>
        <p className="eyebrow rdp-scope">
          {moduleLabel} papers · marked with the {moduleLabel} conversion table
        </p>
        {tests.length === 0 ? (
          <p className="rdp-empty card">
            No {moduleLabel} Reading paper has been authored yet. Switch exam type in the header to
            see what is available — a paper from the other exam is not offered here, because it is
            built differently and would be marked against the wrong table.
          </p>
        ) : (
          <ul className="rdp-tests">
            {tests.map((test) => (
              <li key={test.id} className="rdp-test card">
                <div className="rdp-test-body">
                  <h2 className="rdp-test-title">{test.title}</h2>
                  <p className="rdp-test-meta mono">
                    {test.passages.length} sections · {test.questions.length} questions ·{' '}
                    {READING_MINUTES} minutes
                  </p>
                  <ul className="rdp-types">
                    {(breakdowns.get(test.id) ?? []).map(({ type, count }) => (
                      <li key={type}>
                        {READING_TYPE_META[type].report}
                        <span className="rdp-type-count mono"> {count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button className="btn btn-primary" onClick={() => onStart(test.id)}>
                  Start this paper
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {history.length > 0 && (
        <section className="rdp-history card" aria-label="Your Reading results">
          <h2 className="eyebrow">Your {moduleLabel} Reading results</h2>
          <ul className="rdp-history-list">
            {history.map((session) => (
              <li key={session.id} className="rdp-history-row">
                <span className="rdp-history-band mono">{session.result.band.toFixed(1)}</span>
                <span className="rdp-history-raw mono">
                  {session.result.raw}/{session.result.total}
                </span>
                <span className="rdp-history-title">{session.testTitle}</span>
                <span className="rdp-history-date">{formatDate(session.dateISO)}</span>
                <button className="btn" onClick={() => onOpen(session)}>
                  Review
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
