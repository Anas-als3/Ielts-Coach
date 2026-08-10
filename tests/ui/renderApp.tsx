/**
 * Deterministic render helper. EVERY UI test must use this.
 *
 * `App` seeds its prompts from `randomPrompt()` / `randomTask1Prompt()`, so an
 * unseeded `render(<App />)` draws a different question each run. Assertions
 * that happened to hold for some draws failed for others, and the suite failed
 * roughly three runs in ten. Production keeps the random draw; only tests pin it.
 *
 * `op-01`, `t1-01` and `gt-01` are chosen deliberately: op-01 has an EXACT
 * worked answer, which makes the exact-vs-fallback assertions decidable, t1-01
 * is a multi-series line chart with numbers, so figure checking has data to work
 * on, and gt-01 is a FORMAL letter with a hand-written worked answer, so the
 * greeting/sign-off pairing has a known-correct case to assert against.
 */
import { render } from '@testing-library/react'
import App from '../../src/App'
import { PROMPTS } from '../../src/prompts/bank'
import { TASK1_PROMPTS } from '../../src/prompts/task1Bank'
import { LETTER_PROMPTS } from '../../src/prompts/letterBank'
import type { AppProps } from '../../src/types'

/** A Task 2 prompt that HAS a hand-written worked answer. */
export const EXACT_PROMPT = PROMPTS.find((p) => p.id === 'op-01')!
/** A Task 2 prompt that does NOT, so the fallback notice is expected. */
export const FALLBACK_PROMPT = PROMPTS.find((p) => p.id === 'op-05')!
export const LINE_CHART_PROMPT = TASK1_PROMPTS.find((p) => p.id === 't1-01')!
/** A formal letter prompt that HAS a hand-written worked answer. */
export const LETTER_PROMPT = LETTER_PROMPTS.find((p) => p.id === 'gt-01')!
/** An informal letter prompt, where contractions are correct at the target register. */
export const INFORMAL_LETTER_PROMPT = LETTER_PROMPTS.find((p) => p.id === 'gt-11')!

export function renderApp(overrides: Partial<AppProps> = {}) {
  return render(
    <App
      initialPrompt={EXACT_PROMPT}
      initialTask1Prompt={LINE_CHART_PROMPT}
      initialLetterPrompt={LETTER_PROMPT}
      {...overrides}
    />,
  )
}
