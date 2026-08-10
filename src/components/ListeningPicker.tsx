/**
 * The Listening section's front door: which papers exist, what sitting one
 * involves, what the audio actually is, and what the learner has scored before.
 *
 * `ReadingPicker`'s sibling with one deliberate omission and one deliberate
 * addition.
 *
 * **The omission: no exam type.** Reading's picker is scoped to one module and
 * says so at length, because the two exams' papers are built differently and
 * convert through different tables. Listening has neither problem — Academic
 * and General Training sit the identical paper and convert identically — so
 * this screen has no module prop, no filter and no scope line, and instead says
 * in one sentence that the distinction does not exist. Plan 011: "Listening
 * needs no Academic/General branching. Resist any abstraction that implies
 * otherwise."
 *
 * **The addition: the choice between exam conditions and practice.** It is made
 * HERE, before the clock starts, because it is the difference between a score
 * that means something and an exercise that does not, and offering it as a
 * mid-paper toggle would let a learner reach for a replay the moment they
 * missed an answer — which is precisely the habit the real exam punishes.
 */
import { useMemo } from 'react'
import type { ListeningPickerProps } from '../types'
import type { ListeningFormat, ListeningTest } from '../listening/types'
import { LISTENING_MINUTES, LISTENING_TRANSFER_MINUTES } from '../listening/types'
import { noticeFor } from '../listening/speech'
import { LISTENING_FORMAT_META } from '../meta'
import './ListeningPicker.css'

/** Formats present in a paper, in first-appearance order, with counts. */
function formatBreakdown(test: ListeningTest): Array<{ format: ListeningFormat; count: number }> {
  const order: ListeningFormat[] = []
  const counts = new Map<ListeningFormat, number>()
  for (const question of test.questions) {
    if (!counts.has(question.format)) order.push(question.format)
    counts.set(question.format, (counts.get(question.format) ?? 0) + 1)
  }
  return order.map((format) => ({ format, count: counts.get(format) ?? 0 }))
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ListeningPicker({
  tests,
  history,
  driverKind,
  onStart,
  onOpen,
}: ListeningPickerProps) {
  const breakdowns = useMemo(() => new Map(tests.map((t) => [t.id, formatBreakdown(t)])), [tests])

  return (
    <div className="lsp">
      <header className="lsp-head">
        <h1 className="lsp-title">Listening</h1>
        <p className="lsp-lead">
          {LISTENING_MINUTES} minutes, 40 questions, four sections that get harder as they go, plus
          a {LISTENING_TRANSFER_MINUTES}-minute checking window at the end. The clock starts the
          moment the paper opens and submits for you when it runs out.
        </p>
        <p className="lsp-same">
          One paper for both exams. Listening is <strong>identical</strong> in Academic and General
          Training — same sections, same timing, same conversion table — so there is no exam type to
          choose here and the score means the same thing whichever you are sitting.
        </p>
        <p className="lsp-exact">
          Like Reading, Listening is scored <strong>exactly</strong>. It is an answer key and a
          published conversion table — there is no estimate and no hedging, unlike the form-only
          band the writing engine reports.
        </p>
      </header>

      {/*
        The audio, stated before the learner commits 40 minutes to it. This is
        the honesty half of plan 011's audio decision and it is not optional
        copy: a synthetic voice presented as though it were the exam's recorded
        actors would misrepresent how much of the real difficulty this practice
        reproduces.
      */}
      <section className="lsp-audio card" aria-label="About the audio">
        <h2 className="eyebrow">About the audio</h2>
        <p className="lsp-audio-notice">{noticeFor(driverKind)}</p>
        <p className="lsp-audio-why">
          This app has no server and no runtime dependency beyond React, and a set of real
          recordings would add roughly 25–30 MB per test to a 371 kB app. Your browser's own speech
          engine costs nothing to ship and works offline, which is the trade that was made —
          knowingly, and with this notice as the other half of it. Accents are part of what the real
          test examines, and this practice cannot examine them.
        </p>
      </section>

      <section className="lsp-list" aria-label="Listening papers">
        {tests.length === 0 ? (
          <p className="lsp-empty card">No Listening paper has been authored yet.</p>
        ) : (
          <ul className="lsp-tests">
            {tests.map((test) => (
              <li key={test.id} className="lsp-test card">
                <div className="lsp-test-body">
                  <h2 className="lsp-test-title">{test.title}</h2>
                  <p className="lsp-test-meta mono">
                    {test.sections.length} sections · {test.questions.length} questions ·{' '}
                    {LISTENING_MINUTES} + {LISTENING_TRANSFER_MINUTES} minutes
                  </p>
                  <ul className="lsp-formats">
                    {(breakdowns.get(test.id) ?? []).map(({ format, count }) => (
                      <li key={format}>
                        {LISTENING_FORMAT_META[format].report}
                        <span className="lsp-format-count mono"> {count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="lsp-test-actions">
                  <button className="btn btn-primary" onClick={() => onStart(test.id, false)}>
                    Sit under exam conditions
                  </button>
                  <button className="btn" onClick={() => onStart(test.id, true)}>
                    Practice mode
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* The two modes, told apart in as many words. A learner who does not know
          which one they are in cannot know what their band is worth. */}
      <section className="lsp-modes card" aria-label="Exam conditions and practice mode">
        <h2 className="eyebrow">The two ways to sit it</h2>
        <dl className="lsp-mode-list">
          <dt>Exam conditions</dt>
          <dd>
            Each section plays <strong>once</strong>, in order, and never again. That is what the
            real test does — there is no replay, no pause and no going back — so this is the only
            setting that produces a band you can plan around.
          </dd>
          <dt>Practice mode</dt>
          <dd>
            Sections can be replayed and played in any order. Useful for learning what a format
            sounds like or for checking what you missed, and useless as a score: the paper is
            marked and saved, but it is labelled a practice run in your history and in the report,
            because a band earned with replays is not the band you would get on the day.
          </dd>
        </dl>
      </section>

      {history.length > 0 && (
        <section className="lsp-history card" aria-label="Your Listening results">
          <h2 className="eyebrow">Your Listening results</h2>
          <ul className="lsp-history-list">
            {history.map((session) => (
              <li key={session.id} className="lsp-history-row">
                <span className="lsp-history-band mono">{session.result.band.toFixed(1)}</span>
                <span className="lsp-history-raw mono">
                  {session.result.raw}/{session.result.total}
                </span>
                <span className="lsp-history-title">
                  {session.testTitle}
                  {session.practice && <span className="lsp-history-practice"> · practice</span>}
                </span>
                <span className="lsp-history-date">{formatDate(session.dateISO)}</span>
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
