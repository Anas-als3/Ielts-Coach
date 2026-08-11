/**
 * A full mock sitting: Listening, then Reading, then Writing Task 2, sat back
 * to back under exam conditions, with one combined report at the end.
 * Implements plan 013.
 *
 * This component draws exactly THREE screens of its own — choosing the two
 * papers, the self-paced pause between legs, and the combined summary — and
 * nothing else. It never renders a Listening or Reading runner, and it never
 * renders the writing desk: those are `App`'s job, exactly as they are for a
 * solo sitting, because plan 013's binding constraint is that a mock REUSES
 * the existing runners and marking rather than forking a duplicate. `App`
 * calls `onStart` / `onContinue` to open each leg through the ordinary
 * `startListeningTest` / `startReadingTest` / "start the clock" code paths,
 * and each leg still saves through the ordinary `saveSession` on submit — this
 * component only ever sees the finished records, handed back in `attempt`.
 *
 * No persistence of its own: `attempt` is scratch state owned by `App` and
 * lost on reload (see `MockAttempt`'s doc comment in `types.ts` for why that
 * is a deliberate, narrow gap rather than data loss).
 */
import { useState } from 'react'
import type { ListeningTest } from '../listening/types'
import { LISTENING_MINUTES, LISTENING_TRANSFER_MINUTES } from '../listening/types'
import type { ReadingTest } from '../reading/types'
import { READING_MINUTES } from '../reading/types'
import type { MockAttempt, MockSection, MockTestProps } from '../types'
import { MODULE_META, TASK_CONSTANTS } from '../meta'
import { mockBandsFor } from '../analysis/mockBand'
import './MockTest.css'

const WRITING_MINUTES = TASK_CONSTANTS.task2.examDurationSec / 60

const SECTION_LABEL: Record<MockSection, string> = {
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing (Task 2)',
}

const SECTION_BLURB: Record<MockSection, string> = {
  listening: `${LISTENING_MINUTES} minutes, 40 questions, plus a ${LISTENING_TRANSFER_MINUTES}-minute checking window.`,
  reading: `${READING_MINUTES} minutes, 40 questions, no extra transfer time.`,
  writing: `${WRITING_MINUTES} minutes, one essay. The clock starts the moment you continue.`,
}

function formatBand(n: number): string {
  return n.toFixed(1)
}

/* --------------------------------- setup ------------------------------------ */

function MockSetup({
  module,
  readingTests,
  listeningTests,
  onStart,
}: {
  module: MockTestProps['module']
  readingTests: ReadingTest[]
  listeningTests: ListeningTest[]
  onStart: (readingTestId: string, listeningTestId: string) => void
}) {
  // Defaults to the FIRST of each list, per plan 013 — the learner can change
  // either before starting, but never has to.
  const [listeningTestId, setListeningTestId] = useState(() => listeningTests[0]?.id ?? '')
  const [readingTestId, setReadingTestId] = useState(() => readingTests[0]?.id ?? '')
  const moduleLabel = MODULE_META[module].label

  return (
    <div className="mck-setup">
      <header className="mck-head">
        <h1 className="mck-title">Mock test</h1>
        <p className="mck-lead">
          The real order and timing: Listening ({LISTENING_MINUTES} + {LISTENING_TRANSFER_MINUTES}{' '}
          min), then Reading ({READING_MINUTES} min), then Writing Task 2 ({WRITING_MINUTES} min) —
          sat back to back under exam conditions. There is a short, self-paced pause between
          sections, exactly like putting your pen down before the next one is handed out; nothing
          is timed during it.
        </p>
        <p className="mck-lead">
          Sitting the {moduleLabel} exam. Each section saves to your history exactly as it would if
          you sat it on its own — this screen only combines the three bands at the end.
        </p>
        <p className="mck-honest">
          Speaking is not part of this app, so a mock here can only ever be a{' '}
          <strong>three-section estimate</strong>, never a full four-skill IELTS overall. The
          summary says so plainly rather than inventing a fourth number.
        </p>
      </header>

      <section className="mck-picks card" aria-label="Choose your papers">
        <div className="mck-pick">
          <label htmlFor="mck-listening-select">Listening paper</label>
          <select
            id="mck-listening-select"
            value={listeningTestId}
            onChange={(e) => setListeningTestId(e.target.value)}
          >
            {listeningTests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
        <div className="mck-pick">
          <label htmlFor="mck-reading-select">Reading paper ({moduleLabel})</label>
          <select
            id="mck-reading-select"
            value={readingTestId}
            onChange={(e) => setReadingTestId(e.target.value)}
          >
            {readingTests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
      </section>

      <button
        className="btn btn-primary mck-start"
        disabled={readingTestId === '' || listeningTestId === ''}
        onClick={() => onStart(readingTestId, listeningTestId)}
      >
        Start the mock test
      </button>
    </div>
  )
}

/* ------------------------------ interstitial --------------------------------- */

function MockInterstitial({
  next,
  onContinue,
  onExit,
}: {
  next: MockSection
  onContinue: () => void
  onExit: () => void
}) {
  return (
    <div className="mck-interstitial card">
      <h2>Section complete</h2>
      <p>
        Up next: {SECTION_LABEL[next]}. {SECTION_BLURB[next]}
      </p>
      <div className="mck-actions">
        <button className="btn btn-primary" onClick={onContinue}>
          Continue to {SECTION_LABEL[next]}
        </button>
        {/* The "mock-level" exit guard plan 013 asks for, distinct from each
            running section's OWN leave control — there is no runner on screen
            here to ask its own question, so this asks one instead. */}
        <button className="btn" onClick={onExit}>
          Exit mock test
        </button>
      </div>
    </div>
  )
}

/* --------------------------------- summary ------------------------------------ */

function MockSummary({
  attempt,
  onRestart,
  onViewDashboard,
}: {
  attempt: MockAttempt
  onRestart: () => void
  onViewDashboard: () => void
}) {
  const bands = mockBandsFor(attempt)

  // Defensive, not decorative: `mockBandsFor` returns null while any leg is
  // still missing, and this screen must never fall back to computing a mean
  // over whichever two happen to be present. See `mockBandsFor`'s own doc
  // comment for why that specific silent failure is the one worth guarding.
  if (bands === null) {
    return (
      <div className="mck-interstitial card">
        <h2>This sitting is not complete</h2>
        <p>
          Not every section has a result yet, so there is nothing to combine into an overall band.
        </p>
        <div className="mck-actions">
          <button className="btn btn-primary" onClick={onRestart}>
            Start a new mock test
          </button>
          <button className="btn" onClick={onViewDashboard}>
            View progress
          </button>
        </div>
      </div>
    )
  }

  const moduleLabel = MODULE_META[attempt.module].label

  return (
    <div className="mck-summary">
      <header className="mck-head">
        <h1 className="mck-title">Your mock result</h1>
        <p className="mck-lead">
          {moduleLabel} · Listening, Reading and Writing, sat back to back under exam conditions.
        </p>
      </header>

      <section className="mck-hero card" aria-label="Overall band">
        <p className="mck-overall mono">{formatBand(bands.overall)}</p>
        <p className="mck-overall-caption">
          Three-section estimate (no Speaking) — the mean of Listening, Reading and Writing,
          rounded to the nearest half band.
        </p>
      </section>

      <ul className="mck-sections">
        <li className="mck-section card">
          <p className="eyebrow">Listening</p>
          <p className="mck-band mono">{formatBand(bands.listening)}</p>
          <p className="mck-hedge">This band is exact, not an estimate.</p>
        </li>
        <li className="mck-section card">
          <p className="eyebrow">Reading</p>
          <p className="mck-band mono">{formatBand(bands.reading)}</p>
          <p className="mck-hedge">This band is exact, not an estimate.</p>
        </li>
        <li className="mck-section card">
          <p className="eyebrow">Writing (Task 2)</p>
          <p className="mck-band mono">{formatBand(bands.writing)}</p>
          <p className="mck-hedge">Form-only estimate — your real band is likely this or lower.</p>
        </li>
      </ul>

      <p className="mck-speaking-note">
        Speaking is not sat in this app, so this cannot be a full four-skill IELTS overall — treat
        it as a three-section estimate, not a prediction of your real one.
      </p>

      <div className="mck-actions">
        <button className="btn btn-primary" onClick={onRestart}>
          Sit another mock test
        </button>
        <button className="btn" onClick={onViewDashboard}>
          View progress
        </button>
      </div>
    </div>
  )
}

/* ---------------------------------- root -------------------------------------- */

export default function MockTest({
  stage,
  module,
  readingTests,
  listeningTests,
  attempt,
  nextSection,
  onStart,
  onContinue,
  onExit,
  onRestart,
  onViewDashboard,
}: MockTestProps) {
  if (stage === 'summary') {
    // Reachable in principle if a caller ever navigates here with no attempt
    // at all (there should be none such today) — same honest "not complete"
    // fallback `MockSummary` already renders for a partial one, rather than a
    // second, differently-worded dead end.
    if (attempt === null) {
      return (
        <MockSummary
          attempt={{
            module,
            listeningTestId: '',
            readingTestId: '',
            listeningRecord: null,
            readingRecord: null,
            writingRecord: null,
          }}
          onRestart={onRestart}
          onViewDashboard={onViewDashboard}
        />
      )
    }
    return <MockSummary attempt={attempt} onRestart={onRestart} onViewDashboard={onViewDashboard} />
  }

  if (stage === 'interstitial') {
    return <MockInterstitial next={nextSection} onContinue={onContinue} onExit={onExit} />
  }

  return <MockSetup module={module} readingTests={readingTests} listeningTests={listeningTests} onStart={onStart} />
}
