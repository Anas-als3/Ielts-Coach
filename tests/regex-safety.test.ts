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

  it('stays linear at 60,000 characters — no other rule is quadratic', () => {
    analyzeEssay('Warm up.', null)
    const t0 = performance.now()
    analyzeEssay(whitespaceBlob(60_000), null)
    const elapsed = performance.now() - t0
    // 1250.6 ms before the fix, 2.24 ms after, on the reference machine. If
    // some future rule reintroduces a backtracking scan, this is where it
    // surfaces: a quadratic path shows up here long before anyone reports a
    // frozen tab.
    expect(elapsed).toBeLessThan(150)
  })
})

/** The `connector-comma` issues a document produces, as `start-end` strings. */
function spaceBeforeCommaSpans(text: string): string[] {
  return analyzeEssay(text, null)
    .issues.filter((i) => i.category === 'connector-comma')
    .map((i) => `${i.start}-${i.end}`)
}

describe('bounding the quantifier changed no issue anyone will see', () => {
  it.each([
    ['The plan is good , but costly.', ['16-18']],
    ['The plan is good     , but costly.', ['16-22']],
    ['The plan is good, but costly.', []],
    ['One idea.\n\n , Another.', ['9-13']],
    ['x  ,  y ,z', ['1-4', '7-9']],
  ])('%j still yields %j', (text, expected) => {
    expect(spaceBeforeCommaSpans(text as string)).toEqual(expected)
  })

  it('clamps the highlight to the last 12 characters of an absurd run, and still flags it once', () => {
    // The ONE documented behaviour difference. 30 spaces before the comma: the
    // issue is still emitted exactly once and still ends at the comma, but the
    // underline starts 12 characters back instead of 30. Nothing a learner
    // types produces this; paste and import do.
    const text = `A${' '.repeat(30)}, b`
    expect(spaceBeforeCommaSpans(text)).toEqual(['19-32'])
  })
})
