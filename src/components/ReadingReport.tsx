/**
 * The Reading review screen. Implements plan 010 "Report".
 *
 * Three things, in the order they earn their place:
 *
 * 1. **The band, stated as EXACT.** Every Writing band in this app is labelled a
 *    form-only estimate, because a heuristic engine cannot see meaning. Reading
 *    is an answer key and a published conversion table, so the band here is not
 *    an approximation of the real one — it IS the real one. Saying so is the
 *    point: a learner who has been told "estimate" on every previous screen
 *    will otherwise discount this number too, and it is the only score in the
 *    app they can plan around.
 * 2. **Per-question-type accuracy.** The coaching value, per plan 010: "you
 *    lose Not Given, you are fine on matching headings" is actionable in a way
 *    an overall band is not. Weakest type first, because that is the one worth
 *    reading.
 * 3. **Every question against the key**, with the explanation of where the
 *    answer was found — including why an over-length answer scored nothing,
 *    which is otherwise the most baffling way to lose a mark.
 */
import { useMemo, useState } from 'react'
import type { ReadingReportProps } from '../types'
import type {
  ReadingModule,
  ReadingQuestion,
  ReadingQuestionResult,
  ReadingTypeAccuracy,
} from '../reading/types'
import { READING_BAND_TABLES, rawToBand } from '../reading/bandTable'
import { MODULE_META, READING_TYPE_META, wordLimitLabel } from '../meta'
import './ReadingReport.css'

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
function bandRowFor(raw: number, module: ReadingModule) {
  return READING_BAND_TABLES[module].find((row) => raw >= row.min && raw <= row.max) ?? null
}

/**
 * How many more correct answers the next band up would have needed.
 *
 * Concrete and small is the point: "two more" is a target a learner can hold in
 * their head next time, where "band 6.5" is only a wish. Returns null at band
 * 9.0, where there is no next band.
 */
function nextBandStep(
  raw: number,
  module: ReadingModule,
): { needed: number; band: number } | null {
  const current = rawToBand(raw, module)
  for (let candidate = raw + 1; candidate <= 40; candidate++) {
    const band = rawToBand(candidate, module)
    if (band > current) return { needed: candidate - raw, band }
  }
  return null
}

/**
 * Per-type accuracy, weakest first.
 *
 * Ties break on the order the types appear in the paper, so the list is stable
 * across renders and across two learners with the same profile. Types with
 * fewer than three questions are ranked last however badly they went: one wrong
 * out of two is noise, and leading the coaching with noise is how a learner
 * ends up drilling the wrong thing.
 */
const MIN_MEANINGFUL = 3

function rankByWeakness(byType: ReadingTypeAccuracy[]): ReadingTypeAccuracy[] {
  return byType
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

export default function ReadingReport({
  session,
  test,
  onRetake,
  onPickAnother,
}: ReadingReportProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const { result, module } = session

  /** Question id → the authored question, for prompts the result does not carry. */
  const questionById = useMemo(() => {
    const map = new Map<string, ReadingQuestion>()
    for (const question of test?.questions ?? []) map.set(question.id, question)
    return map
  }, [test])

  const ranked = useMemo(() => rankByWeakness(result.byType), [result.byType])
  const wrongCount = result.questions.filter((q) => !q.correct).length
  const shown = filter === 'wrong' ? result.questions.filter((q) => !q.correct) : result.questions

  const row = bandRowFor(result.raw, module)
  const step = nextBandStep(result.raw, module)
  const duration = formatDuration(session.durationSec)
  const moduleLabel = MODULE_META[module].label

  // Worth naming only when there is a real spread to name: with one type, or
  // with everything at the same accuracy, "your weakest is X" says nothing.
  const meaningful = ranked.filter((entry) => entry.total >= MIN_MEANINGFUL)
  const weakest = meaningful[0] ?? null
  const strongest = meaningful.length > 1 ? meaningful[meaningful.length - 1] : null
  const hasSpread =
    weakest !== null && strongest !== null && strongest.accuracy - weakest.accuracy >= 0.2

  return (
    <div className="rr-report">
      {/* 1 — header row */}
      <header className="rrp-header">
        <p className="eyebrow">
          Reading · {moduleLabel} · {session.testTitle} · {formatDate(session.dateISO)}
          {duration !== null && ` · ${duration}`}
        </p>
        <div className="rrp-actions">
          <button className="btn" onClick={onRetake}>
            Sit this paper again
          </button>
          <button className="btn" onClick={onPickAnother}>
            Another paper
          </button>
        </div>
      </header>

      {/* 2 — the band, and the claim that it is exact */}
      <section className="rrp-hero card" aria-label="Reading band">
        <div className="rrp-hero-figures">
          <p className="rrp-band mono">{result.band.toFixed(1)}</p>
          <p className="rrp-raw mono">
            {result.raw} / {result.total}
          </p>
        </div>
        <div className="rrp-hero-copy">
          <p className="rrp-exact">This band is exact, not an estimate.</p>
          <p className="rrp-exact-why">
            Reading is marked from an answer key and converted by the published {moduleLabel}{' '}
            table, so this is the band this paper is worth — the same number the real exam would
            give for the same answers. The Writing bands in this app are form-only estimates
            because no rule engine can judge an argument. This one is not an estimate at all.
          </p>
          <p className="rrp-table-row">
            {row !== null ? (
              <>
                {moduleLabel} table:{' '}
                <span className="mono">
                  {row.min === row.max ? row.min : `${row.min}–${row.max}`}
                </span>{' '}
                correct → band <span className="mono">{row.band.toFixed(1)}</span>.
              </>
            ) : (
              <>
                {result.raw} correct is below the lowest row the published {moduleLabel} table
                prints, so the floor band is reported rather than a guess. The raw score is the
                honest signal at this level.
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
            className="rrp-scale"
            role="img"
            aria-label={`Band scale 4 to 9. This paper: band ${result.band.toFixed(1)}.`}
          >
            <div className="rrp-scale-track">
              <span className="rrp-scale-marker" style={{ left: `${bandPct(result.band)}%` }} />
            </div>
            <div className="rrp-scale-ticks mono" aria-hidden="true">
              {SCALE_TICKS.map((tick) => (
                <span key={tick} style={{ left: `${bandPct(tick)}%` }}>
                  {tick}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3 — per-question-type accuracy */}
      <section className="rrp-types card" aria-label="Accuracy by question type">
        <h2 className="eyebrow">Accuracy by question type</h2>
        {hasSpread && weakest !== null && strongest !== null ? (
          <p className="rrp-types-lead">
            You lose marks on <strong>{READING_TYPE_META[weakest.type].report}</strong> (
            {weakest.correct} of {weakest.total}) and hold up on{' '}
            <strong>{READING_TYPE_META[strongest.type].report}</strong> ({strongest.correct} of{' '}
            {strongest.total}). Practise the first; the second is not what is costing you.
          </p>
        ) : (
          <p className="rrp-types-lead">
            Weakest question type first. This is the part worth acting on — an overall band tells
            you where you are, and this tells you what to practise.
          </p>
        )}
        <ul className="rrp-type-list">
          {ranked.map((entry) => (
            <li key={entry.type} className="rrp-type">
              <span className="rrp-type-label">{READING_TYPE_META[entry.type].report}</span>
              <span className="rrp-type-bar" aria-hidden="true">
                <span className="rrp-type-fill" style={{ width: `${percent(entry.accuracy)}%` }} />
              </span>
              <span className="rrp-type-score mono">
                {entry.correct}/{entry.total}
              </span>
              <span className="rrp-type-pct mono">{percent(entry.accuracy)}%</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 4 — every question against the key */}
      <section className="rrp-review card" aria-label="Answer review">
        <div className="rrp-review-head">
          <h2 className="eyebrow">Answer review</h2>
          <div className="rrp-filter" role="group" aria-label="Filter answers">
            <button
              className={filter === 'all' ? 'mode-btn active' : 'mode-btn'}
              onClick={() => setFilter('all')}
            >
              All {result.total}
            </button>
            <button
              className={filter === 'wrong' ? 'mode-btn active' : 'mode-btn'}
              onClick={() => setFilter('wrong')}
            >
              Wrong {wrongCount}
            </button>
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="rrp-muted">
            Nothing wrong on this paper — every one of the {result.total} questions is correct.
          </p>
        ) : (
          <ol className="rrp-answers">
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
  question: ReadingQuestion | null
}) {
  // Every accepted answer is shown, not just the canonical one: a learner who
  // wrote "automobile" against a key of "car" needs to see that both were on
  // the list, or they will conclude the marker is arbitrary.
  const alternatives = answer.accepted.slice(1)

  return (
    <li className={answer.correct ? 'rrp-answer rrp-answer-right' : 'rrp-answer rrp-answer-wrong'}>
      <div className="rrp-answer-head">
        <span className="rrp-answer-num mono">{answer.number}</span>
        <span className="rrp-answer-mark" aria-hidden="true">
          {answer.correct ? '✓' : '✗'}
        </span>
        <span className="rrp-sr">{answer.correct ? 'Correct.' : 'Incorrect.'}</span>
        <span className="rrp-answer-type">{READING_TYPE_META[answer.type].report}</span>
      </div>

      {question !== null && <p className="rrp-answer-prompt">{question.prompt}</p>}

      <div className="rrp-answer-grid">
        <span className="rrp-answer-key">You wrote</span>
        <span className="rrp-answer-value">
          {answer.blank ? <em className="rrp-blank">left blank</em> : answer.given}
        </span>
        <span className="rrp-answer-key">Answer</span>
        <span className="rrp-answer-value">
          {answer.expected}
          {alternatives.length > 0 && (
            <span className="rrp-alt"> (also accepted: {alternatives.join(', ')})</span>
          )}
        </span>
      </div>

      {answer.overWordLimit && question !== null && question.type === 'completion' && (
        <p className="rrp-answer-note rrp-answer-note-limit">
          Over the word limit — the question asked for {wordLimitLabel(question.maxWords)}, so this
          scores nothing even though the content may be right. The real exam marks it the same way.
        </p>
      )}

      {question?.explanation !== undefined && (
        <p className="rrp-answer-note">{question.explanation}</p>
      )}
    </li>
  )
}
