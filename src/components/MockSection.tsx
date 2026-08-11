/**
 * The Mock test view's own registry lookup, split out for the same reason as
 * `ReadingSection`/`ListeningSection` — plan 023, extended beyond the plan as
 * written to cover plan 013's mock test mode, which landed after 023 was
 * authored.
 *
 * `MockTest` itself only ever draws three screens (setup, interstitial,
 * summary) and never a runner — see its own doc comment — but its setup
 * screen needs the FULL paper lists to populate two `<select>`s, and that is
 * exactly the registry access this plan moves out of the entry chunk. `App`
 * still owns the sitting's own state (`mockAttempt`, `mockStage`,
 * `mockNextSection` — see `MockSectionProps` in `types.ts`) and the two ids
 * inside `attempt`; this component's only job is turning `module` into a
 * paper LIST, the same division of labour `ReadingSection` uses for its
 * picker.
 */
import { useMemo } from 'react'
import type { MockSectionProps } from '../types'
import { readingTestsForModule } from '../reading/tests'
import { LISTENING_TESTS } from '../listening/tests'
import MockTest from './MockTest'

export default function MockSection({
  stage,
  module,
  attempt,
  nextSection,
  onStart,
  onContinue,
  onExit,
  onRestart,
  onViewDashboard,
}: MockSectionProps) {
  const readingTests = useMemo(() => readingTestsForModule(module), [module])

  return (
    <main className="page">
      <MockTest
        stage={stage}
        module={module}
        readingTests={readingTests}
        listeningTests={[...LISTENING_TESTS]}
        attempt={attempt}
        nextSection={nextSection}
        onStart={onStart}
        onContinue={onContinue}
        onExit={onExit}
        onRestart={onRestart}
        onViewDashboard={onViewDashboard}
      />
    </main>
  )
}
