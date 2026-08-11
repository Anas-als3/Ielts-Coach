/**
 * The Reading section: picker, runner and report, plus the registry lookups
 * that used to sit at module scope in `App.tsx`. Implements plan 023.
 *
 * `App` owns every atom of section STATE (`readingStage`, `readingTestId`,
 * `readingSessionId` — see `ReadingSectionProps` in `types.ts` for why none of
 * it can move here) and hands it down as props; this component owns only
 * rendering and the two registry lookups (`readingTestsForModule`,
 * `readingTestById`). That split is what lets `App.tsx` stop importing
 * `src/reading/tests` at module scope — the whole point of the plan — while
 * `openReading`/`startReadingTest` keep working from the topbar at a moment
 * this component is not even mounted.
 */
import { useMemo } from 'react'
import type { ReadingAnswers } from '../reading/types'
import type { ReadingSectionProps, ReadingSessionRecord } from '../types'
import { readingTestById, readingTestsForModule } from '../reading/tests'
import { markAnswerKey } from '../marking/markAnswerKey'
import { makeId } from '../App'
import ReadingRunner from './ReadingRunner'
import ReadingReport from './ReadingReport'
import ReadingPicker from './ReadingPicker'

export default function ReadingSection({
  module,
  stage,
  onStageChange,
  onExit,
  testId,
  onStart,
  history,
  session,
  onOpenSession,
  onSubmit,
}: ReadingSectionProps) {
  const tests = useMemo(() => readingTestsForModule(module), [module])
  const test = useMemo(() => (testId === null ? null : readingTestById(testId)), [testId])

  /**
   * Persist a sat paper. The container marks; `App`'s `onSubmit` stores the
   * record and handles the mock hand-off — see `ReadingSectionProps.onSubmit`.
   */
  function handleSubmit(answers: ReadingAnswers, durationSec: number) {
    if (test === null) {
      onStageChange('picker')
      return
    }
    const record: ReadingSessionRecord = {
      section: 'reading',
      id: makeId(),
      dateISO: new Date().toISOString(),
      // Taken from the TEST, not the module toggle: the paper was marked
      // against its own module's table, so a later toggle flip must not
      // relabel a band that has already been earned.
      module: test.module,
      testId: test.id,
      testTitle: test.title,
      answers,
      result: markAnswerKey(test, answers),
      durationSec,
    }
    onSubmit(record)
  }

  if (stage === 'running' && test !== null) {
    return (
      <main className="reading-main">
        <ReadingRunner test={test} onSubmit={handleSubmit} onExit={onExit} />
      </main>
    )
  }

  if (stage === 'report' && session !== null) {
    return (
      <main className="page">
        <ReadingReport
          session={session}
          test={readingTestById(session.testId)}
          onRetake={() => onStart(session.testId)}
          onPickAnother={() => onStageChange('picker')}
        />
      </main>
    )
  }

  return (
    <main className="page">
      <ReadingPicker module={module} tests={tests} history={history} onStart={onStart} onOpen={onOpenSession} />
    </main>
  )
}
