/**
 * The Listening section: picker, runner and report, plus the registry lookup
 * and the speech driver's fallback construction that used to sit at module
 * scope in `App.tsx`. Implements plan 023. See `ReadingSection`'s doc comment
 * for the shape this mirrors and why the section's state cannot move here.
 */
import { useMemo } from 'react'
import type { ListeningAnswers } from '../listening/types'
import type { ListeningSectionProps, ListeningSessionRecord } from '../types'
import { LISTENING_TESTS, listeningTestById } from '../listening/tests'
import { createSpeechDriver } from '../listening/speech'
import { markListening } from '../listening/mark'
import { makeId } from '../ids'
import ListeningRunner from './ListeningRunner'
import ListeningReport from './ListeningReport'
import ListeningPicker from './ListeningPicker'

export default function ListeningSection({
  stage,
  onStageChange,
  onExit,
  testId,
  onStart,
  practice,
  history,
  session,
  onOpenSession,
  onSubmit,
  driver,
}: ListeningSectionProps) {
  const test = useMemo(() => (testId === null ? null : listeningTestById(testId)), [testId])
  // The browser's synthesiser where there is one, the paced transcript where
  // there is not, and generated audio files ahead of either when the
  // SELECTED test has a manifest (plan 032 Prong B) — `createSpeechDriver`
  // decides the preference order and reads the learner's preferred-voice URI
  // itself. `driver` short-circuits this entirely, so tests injecting
  // `FakeSpeechDriver` through `AppProps` never touch any of it.
  const speechDriver = useMemo(
    () =>
      driver ??
      createSpeechDriver({
        manifestUrl: testId === null ? undefined : `/audio/${testId}/manifest.json`,
      }),
    [driver, testId],
  )

  /**
   * Persist a sat paper. The container marks; `App`'s `onSubmit` stores the
   * record and handles the mock hand-off — see `ListeningSectionProps.onSubmit`.
   *
   * `practiceUsed` is taken from the RUNNER, not from the `practice` prop, so
   * the record keeps the conditions the paper was actually sat under even if
   * the app's own state has since moved on.
   */
  function handleSubmit(answers: ListeningAnswers, durationSec: number, practiceUsed: boolean) {
    if (test === null) {
      onStageChange('picker')
      return
    }
    const record: ListeningSessionRecord = {
      section: 'listening',
      id: makeId(),
      dateISO: new Date().toISOString(),
      testId: test.id,
      testTitle: test.title,
      answers,
      result: markListening(test, answers),
      durationSec,
      practice: practiceUsed,
    }
    onSubmit(record)
  }

  if (stage === 'running' && test !== null) {
    return (
      <main className="listening-main">
        <ListeningRunner
          test={test}
          practice={practice}
          driver={speechDriver}
          onSubmit={handleSubmit}
          onExit={onExit}
        />
      </main>
    )
  }

  if (stage === 'report' && session !== null) {
    return (
      <main className="page">
        <ListeningReport
          session={session}
          test={listeningTestById(session.testId)}
          onRetake={() =>
            // The same conditions as last time — turning a practice run into
            // an exam run behind the learner's back would relabel a band they
            // did not earn that way.
            onStart(session.testId, session.practice)
          }
          onPickAnother={() => onStageChange('picker')}
        />
      </main>
    )
  }

  return (
    <main className="page">
      <ListeningPicker
        tests={[...LISTENING_TESTS]}
        history={history}
        driverKind={speechDriver.kind}
        onStart={onStart}
        onOpen={onOpenSession}
      />
    </main>
  )
}
