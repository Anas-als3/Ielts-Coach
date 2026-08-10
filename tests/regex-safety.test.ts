/**
 * The analysis engine must stay LINEAR in document length.
 *
 * This is not a micro-benchmark and it is not here to chase milliseconds. It
 * pins one specific defect class: a backtracking regex on the keystroke path.
 * Analysis runs inside a `useMemo` during render (src/App.tsx:163-169) off a
 * 400ms debounce, so a quadratic scan is not a slow app — it is a frozen tab,
 * with React blocked mid-render. Coach mode does not block paste
 * (`blockPaste={inExam}`, src/App.tsx:969), and `handleRedraft` feeds a stored
 * or IMPORTED essay to the same path, so "no learner would type that" is not a
 * defence.
 */
import { describe, expect, it } from 'vitest'
import { analyzeEssay } from '../src/analysis/engine'

/** A whitespace blob with no comma anywhere — the worst case for `\s+,`. */
function whitespaceBlob(spaces: number): string {
  return `a${' '.repeat(spaces)}b`
}

describe('the engine stays linear on pathological whitespace', () => {
  it('analyses a 40,000-character whitespace blob well under a frozen frame', () => {
    // Warm the JIT on a realistic document first, so the measurement is of the
    // scan and not of first-call compilation.
    analyzeEssay('Some people believe that governments should invest in transport.', null)

    const doc = whitespaceBlob(40_000)
    const t0 = performance.now()
    analyzeEssay(doc, null)
    const elapsed = performance.now() - t0

    // Measured on the reference machine (Node v24.18.0): 543.9 ms before the
    // fix, 1.38 ms after. 100 ms sits ~72x above the fixed cost and ~5x below
    // the broken cost, so it is neither flaky on a slow CI runner nor able to
    // pass with the quadratic regex restored.
    expect(elapsed).toBeLessThan(100)
  })
})
