/**
 * Deterministic render helper. EVERY UI test must use this.
 *
 * `App` seeds its prompts from `randomPrompt()` / `randomTask1Prompt()`, so an
 * unseeded `render(<App />)` draws a different question each run. Assertions
 * that happened to hold for some draws failed for others, and the suite failed
 * roughly three runs in ten. Production keeps the random draw; only tests pin it.
 *
 * `op-01` and `t1-01` are chosen deliberately: op-01 has an EXACT worked answer,
 * which makes the exact-vs-fallback assertions decidable, and t1-01 is a
 * multi-series line chart with numbers, so figure checking has data to work on.
 */
import { render } from '@testing-library/react'
import App from '../../src/App'
import { PROMPTS } from '../../src/prompts/bank'
import { TASK1_PROMPTS } from '../../src/prompts/task1Bank'
import type { AppProps } from '../../src/types'

/** A Task 2 prompt that HAS a hand-written worked answer. */
export const EXACT_PROMPT = PROMPTS.find((p) => p.id === 'op-01')!
/** A Task 2 prompt that does NOT, so the fallback notice is expected. */
export const FALLBACK_PROMPT = PROMPTS.find((p) => p.id === 'op-05')!
export const LINE_CHART_PROMPT = TASK1_PROMPTS.find((p) => p.id === 't1-01')!

export function renderApp(overrides: Partial<AppProps> = {}) {
  return render(
    <App initialPrompt={EXACT_PROMPT} initialTask1Prompt={LINE_CHART_PROMPT} {...overrides} />,
  )
}
