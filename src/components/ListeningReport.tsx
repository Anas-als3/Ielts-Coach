/**
 * The Listening review screen. Implements plan 011 "Report".
 *
 * `ReadingReport`'s sibling, and it makes the same central claim for the same
 * reason: **the band is exact, not an estimate.** Every Writing band in this
 * app is labelled a form-only estimate because a heuristic engine cannot see
 * meaning. Listening is an answer key and a published conversion table, so the
 * band here is not an approximation of the real one — it IS the real one, and
 * saying so is the point. A learner told "estimate" on every previous screen
 * will otherwise discount this number too.
 *
 * Two differences from Reading, both structural:
 *
 * 1. **There is no exam type.** Academic and General Training convert through
 *    the identical Listening table, so this screen names no module and offers
 *    no comparison between two of them. Reading's report has to say "Academic
 *    table" because the other table would give a different band; here there is
 *    only one table and saying so is more honest than implying a choice.
 * 2. **The breakdown is by FORMAT, not by marking type.** Matching and plan
 *    labelling both mark as `multiple-choice`, so a type-keyed breakdown would
 *    report "multiple choice 18/23" and bury the fact that plan labelling is
 *    where the marks went. `byFormat` is the axis a learner can practise along.
 */
import { useMemo, useState } from 'react'
import type { ListeningReportProps } from '../types'
import type {
  ListeningFormat,
  ListeningFormatAccuracy,
  ListeningQuestion,
} from '../listening/types'
import type { ReadingQuestionResult } from '../reading/types'
import { LISTENING_BANDS, listeningRawToBand } from '../listening/bandTable'
import { LISTENING_FORMAT_META, wordLimitLabel } from '../meta'
import './ListeningReport.css'

/* --------------------------------- helpers --------------------------------- */

const SCALE_TICKS = [4, 5, 6, 7, 8, 9]

/** Position of a band on the 4-to-9 scale, as a 0–100 percentage. */
function bandPct(band: number): number {
  const clamped = Math.min(9, Math.max(4, Number.isFinite(band) ? band : 4))
  return ((clamped - 4) / 5) * 100
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDuration(totalSec: number | null): string | null {
  if (totalSec === null || !Number.isFinite(totalSec)) return null
  const s = Math.max(0, Math.floor(totalSec))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** The printed table row this raw score fell in, or null when below the table. */
function bandRowFor(raw: number) {
  return LISTENING_BANDS.find((row) => raw >= row.min && raw <= row.max) ?? null
}

/**
 * How many more correct answers the next band up would have needed.
 *
 * Concrete and small is the point: "two more" is a target a learner can hold in
 * their head next time, where "band 6.5" is only a wish. Returns null at band
 * 9.0, where there is no next band.
 */
function nextBandStep(raw: number): { needed: number; band: number } | null {
  const current = listeningRawToBand(raw)
  for (let candidate = raw + 1; candidate <= 40; candidate++) {
    const band = listeningRawToBand(candidate)
    if (band > current) return { needed: candidate - raw, band }
  }
  return null
}

/**
 * Per-format accuracy, weakest first.
 *
 * Ties break on the order the formats appear in the paper, so the list is
 * stable across renders and across two learners with the same profile. Formats
 * with fewer than three questions are ranked last however badly they went: one
 * wrong out of two is noise, and leading the coaching with noise is how a
 * learner ends up drilling the wrong thing. Same rule as Reading's.
 */
const MIN_MEANINGFUL = 3

function rankByWeakness(byFormat: ListeningFormatAccuracy[]): ListeningFormatAccuracy[] {
  return byFormat
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const aThin = a.entry.total < MIN_MEANINGFUL
      const bThin = b.entry.total < MIN_MEANINGFUL
      if (aThin !== bThin) return aThin ? 1 : -1
      if (a.entry.accuracy !== b.entry.accuracy) return a.entry.accuracy - b.entry.accuracy
      return a.index - b.index
    })
    .map((x) => x.entry)
}

function percent(fraction: number): number {
  return Math.round((Number.isFinite(fraction) ? fraction : 0) * 100)
}

/* -------------------------------- component -------------------------------- */

type Filter = 'all' | 'wrong'

export default function ListeningReport({
  session,
  test,
  onRetake,
  onPickAnother,
}: ListeningReportProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const { result } = session

  /** Question id → the authored question, for the prompt and the format. */
  const questionById = useMemo(() => {
    const map = new Map<string, ListeningQuestion>()
    for (const question of test?.questions ?? []) map.set(question.id, question)
    return map
  }, [test])

  const ranked = useMemo(() => rankByWeakness(result.byFormat), [result.byFormat])
  const wrongCount = result.questions.filter((q) => !q.correct).length
  const shown = filter === 'wrong' ? result.questions.filter((q) => !q.correct) : result.questions

  const row = bandRowFor(result.raw)
  const step = nextBandStep(result.raw)
  const duration = formatDuration(session.durationSec)

  // Worth naming only when there is a real spread to name: with one format, or
  // with everything at the same accuracy, "your weakest is X" says nothing.
  const meaningful = ranked.filter((entry) => entry.total >= MIN_MEANINGFUL)
  const weakest = meaningful[0] ?? null
  const strongest = meaningful.length > 1 ? meaningful[meaningful.length - 1] : null
  const hasSpread =
    weakest !== null && strongest !== null && strongest.accuracy - weakest.accuracy >= 0.2

  return (
    <div className="lr-report">
      {/* 1 — header row */}
      <header className="lrp-header">
        <p className="eyebrow">
          Listening · {session.testTitle} · {formatDate(session.dateISO)}
          {duration !== null && ` · ${duration}`}
          {session.practice && ' · practice mode'}
        </p>
        <div className="lrp-actions">
          <button className="btn" onClick={onRetake}>
            Sit this paper again
          </button>
          <button className="btn" onClick={onPickAnother}>
            Another paper
          </button>
        </div>
      </header>

      {/*
        A practice run is marked before the band is read, not after. The number
        below is arithmetically correct either way, but a paper whose sections
        could be replayed does not measure the thing the exam measures, and a
        learner comparing it with an exam-condition attempt would be comparing
        two different exercises.
      */}
      {session.practice && (
        <p className="lrp-practice card" role="note">
          <strong>Practice mode.</strong> Sections could be replayed and played out of order, so
          this band is not comparable with an exam-condition attempt — the real test plays each
          section once, in order, and never again. Sit it under exam conditions for a score you can
          plan around.
        </p>
      )}

      {/* 2 — the band, and the claim that it is exact */}
      <section className="lrp-hero card" aria-label="Listening band">
        <div className="lrp-hero-figures">
          <p className="lrp-band mono">{result.band.toFixed(1)}</p>
          <p className="lrp-raw mono">
            {result.raw} / {result.total}
          </p>
        </div>
        <div className="lrp-hero-copy">
          <p className="lrp-exact">This band is exact, not an estimate.</p>
          <p className="lrp-exact-why">
            Listening is marked from an answer key and converted by the published table, so this is
            the band this paper is worth — the same number the real exam would give for the same
            answers. The Writing bands in this app are form-only estimates because no rule engine
            can judge an argument. This one is not an estimate at all. One table serves both exams:
            Academic and General Training candidates sit the identical Listening paper and convert
            identically, so there is no second table this score could have been read from.
          </p>
          <p className="lrp-table-row">
            {row !== null ? (
              <>
                Listening table:{' '}
                <span className="mono">
                  {row.min === row.max ? row.min : `${row.min}–${row.max}`}
                </span>{' '}
                correct → band <span className="mono">{row.band.toFixed(1)}</span>.
              </>
            ) : (
              <>
                {result.raw} correct is below the lowest row the published table prints, so the
                floor band is reported rather than a guess. The raw score is the honest signal at
                this level.
              </>
            )}
            {step !== null && (
              <>
                {' '}
                {step.needed} more correct {step.needed === 1 ? 'answer' : 'answers'} would have
                been band <span className="mono">{step.band.toFixed(1)}</span>.
              </>
            )}
          </p>
          <div
            className="lrp-scale"
            role="img"
            aria-label={`Band scale 4 to 9. This paper: band ${result.band.toFixed(1)}.`}
          >
            <div className="lrp-scale-track">
              <span className="lrp-scale-marker" style={{ left: `${bandPct(result.band)}%` }} />
            </div>
            <div className="lrp-scale-ticks mono" aria-hidden="true">
              {SCALE_TICKS.map((tick) => (
                <span key={tick} style={{ left: `${bandPct(tick)}%` }}>
                  {tick}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3 — per-format accuracy */}
      <section className="lrp-formats card" aria-label="Accuracy by question format">
        <h2 className="eyebrow">Accuracy by question format</h2>
        {hasSpread && weakest !== null && strongest !== null ? (
          <p className="lrp-formats-lead">
            You lose marks on <strong>{LISTENING_FORMAT_META[weakest.format].report}</strong> (
            {weakest.correct} of {weakest.total}) and hold up on{' '}
            <strong>{LISTENING_FORMAT_META[strongest.format].report}</strong> ({strongest.correct}{' '}
            of {strongest.total}). Practise the first; the second is not what is costing you.
          </p>
        ) : (
          <p className="lrp-formats-lead">
            Weakest format first. This is the part worth acting on — an overall band tells you
            where you are, and this tells you what to practise.
          </p>
        )}
        <ul className="lrp-format-list">
          {ranked.map((entry) => (
            <li key={entry.format} className="lrp-format">
              <span className="lrp-format-label">{LISTENING_FORMAT_META[entry.format].report}</span>
              <span className="lrp-format-bar" aria-hidden="true">
                <span
                  className="lrp-format-fill"
                  style={{ width: `${percent(entry.accuracy)}%` }}
                />
              </span>
              <span className="lrp-format-score mono">
                {entry.correct}/{entry.total}
              </span>
              <span className="lrp-format-pct mono">{percent(entry.accuracy)}%</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 4 — every question against the key */}
      <section className="lrp-review card" aria-label="Answer review">
        <div className="lrp-review-head">
          <h2 className="eyebrow">Answer review</h2>
          {/* Toggle buttons, for the reason the Reading report gives at its
              copy of this control. */}
          <div className="lrp-filter" role="group" aria-label="Filter answers">
            <button
              className={filter === 'all' ? 'mode-btn active' : 'mode-btn'}
              aria-pressed={filter === 'all'}
              onClick={() => setFilter('all')}
            >
              All {result.total}
            </button>
            <button
              className={filter === 'wrong' ? 'mode-btn active' : 'mode-btn'}
              aria-pressed={filter === 'wrong'}
              onClick={() => setFilter('wrong')}
            >
              Wrong {wrongCount}
            </button>
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="lrp-muted">
            Nothing wrong on this paper — every one of the {result.total} questions is correct.
          </p>
        ) : (
          <ol className="lrp-answers">
            {shown.map((answer) => (
              <AnswerRow
                key={answer.questionId}
                answer={answer}
                question={questionById.get(answer.questionId) ?? null}
              />
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

/* -------------------------------- answer row -------------------------------- */

function AnswerRow({
  answer,
  question,
}: {
  answer: ReadingQuestionResult
  question: ListeningQuestion | null
}) {
  // Every accepted answer is shown, not just the canonical one: a learner who
  // wrote "14th" against a key of "14" needs to see that both were on the list,
  // or they will conclude the marker is arbitrary.
  const alternatives = answer.accepted.slice(1)
  // The FORMAT, not the marking type — the type would print "multiple choice"
  // over a plan-labelling item. Absent only when this build no longer ships the
  // test, in which case nothing is printed rather than something wrong.
  const format: ListeningFormat | null = question?.format ?? null

  return (
    <li className={answer.correct ? 'lrp-answer lrp-answer-right' : 'lrp-answer lrp-answer-wrong'}>
      <div className="lrp-answer-head">
        <span className="lrp-answer-num mono">{answer.number}</span>
        <span className="lrp-answer-mark" aria-hidden="true">
          {answer.correct ? '✓' : '✗'}
        </span>
        <span className="lrp-sr">{answer.correct ? 'Correct.' : 'Incorrect.'}</span>
        {format !== null && (
          <span className="lrp-answer-format">{LISTENING_FORMAT_META[format].report}</span>
        )}
      </div>

      {question !== null && <p className="lrp-answer-prompt">{question.prompt}</p>}

      <div className="lrp-answer-grid">
        <span className="lrp-answer-key">You wrote</span>
        <span className="lrp-answer-value">
          {answer.blank ? <em className="lrp-blank">left blank</em> : answer.given}
        </span>
        <span className="lrp-answer-key">Answer</span>
        <span className="lrp-answer-value">
          {answer.expected}
          {alternatives.length > 0 && (
            <span className="lrp-alt"> (also accepted: {alternatives.join(', ')})</span>
          )}
        </span>
      </div>

      {answer.overWordLimit && question !== null && question.type === 'completion' && (
        <p className="lrp-answer-note lrp-answer-note-limit">
          Over the word limit — the question asked for {wordLimitLabel(question.maxWords)}, so this
          scores nothing even though the content may be right. The real exam marks it the same way.
        </p>
      )}

      {/* Where the answer went past in the recording. The single most useful
          line on this screen for Listening specifically: a learner who cannot
          replay the audio otherwise has no way to find out what they missed. */}
      {question?.explanation !== undefined && (
        <p className="lrp-answer-note">{question.explanation}</p>
      )}
    </li>
  )
}
