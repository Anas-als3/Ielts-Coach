/**
 * The tokenizer's offset invariant, defended by a property test.
 *
 * `tokenize.ts:204-206` documents a promise every inline highlight depends
 * on: every span's `[start, end)` indexes into the ORIGINAL text exactly
 * (`text.slice(start, end) === span.text`). `Report.tsx` slices the essay by
 * those offsets to draw inline highlights, so a broken invariant misplaces
 * every mark from that point onward. `tokenize`'s only importer anywhere in
 * this repo is `src/analysis/engine.ts`, and nothing that imports it asserts
 * offsets — `tests/paragraphing-gate.test.ts`, the closest thing to tokenizer
 * coverage, checks paragraph and sentence COUNTS, never positions.
 *
 * The invariant is TRUE TODAY — an adversarial sweep of 50,000 generated
 * strings at plan 021's baseline found zero violations. This file is
 * protection, not a regression suite: it exists so the invariant keeps
 * holding, not because it has ever broken.
 */
import { describe, expect, it } from 'vitest'
import { tokenize } from '../src/analysis/tokenize'

/* ------------------------------- seeded PRNG -------------------------------- */

/**
 * mulberry32 — 32 bits of state, four lines, deterministic.
 *
 * A fixed seed rather than `Math.random()` on purpose: a property test that
 * draws fresh inputs every run is a flaky test that fails on somebody else's
 * machine with a string nobody can reproduce. Change SEED by hand to sweep
 * different ground, and paste the failing input into a fixed case when one is
 * ever found.
 */
const SEED = 0x5eed1e5
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* --------------------------------- fragment pool ----------------------------- */

// Ordinary words, including accented ones (WORD_RE covers À-ɏ) and
// apostrophes/hyphens.
const WORDS = [
  'the',
  'quick',
  'brown',
  'fox',
  'jumps',
  "don't",
  'well-being',
  'café',
  'naïve',
  'élan',
  'façade',
  'résumé',
  "o'clock",
  'co-operate',
  'Straße',
  'Ötzi',
  'Ångström',
]

// The protected abbreviations named at tokenize.ts:198-199.
const ABBREVIATIONS = [
  'e.g.',
  'i.e.',
  'etc.',
  'Dr.',
  'Mr.',
  'Mrs.',
  'Ms.',
  'Prof.',
  'U.S.',
  'U.K.',
  'approx.',
  'No.',
  'vs.',
]

// Decimals and bare digit runs.
const NUMBERS = ['3.5', '1.25', '0.5', '10.0', '123', '2024', '7', '0']

// Ellipses and punctuation runs.
const PUNCT_RUNS = ['...', '. . .', '?!', '!!!', '.', '!', '?', '??', '?!?!']

// The glued-uppercase typo case (tokenize.ts:160-161).
const TYPOS = ['late.He', 'stop.Go', 'Tired.She', 'Done.Now', 'Wait.OK']

// Whitespace of every kind.
const WHITESPACE = [' ', '  ', '   ', '\t', '\n', '\n\n', '\n \n', ' \n ', '\n\t\n']

const POOL: readonly string[] = [
  ...WORDS,
  ...WORDS, // weighted so ordinary prose dominates, as real essays do
  ...ABBREVIATIONS,
  ...NUMBERS,
  ...PUNCT_RUNS,
  ...TYPOS,
  ...WHITESPACE,
]

// Fixed edge cases, always included ahead of the random sweep: empty and
// whitespace-only strings, and strings that are pure punctuation.
const EDGE_CASES: readonly string[] = [
  '',
  ' ',
  '\n',
  '\n\n',
  '   ',
  '\t\t',
  '...',
  '?!?!',
  '!!!',
  '.',
  '  \n  \t  ',
]

/** One random input: 5-40 fragments from POOL, joined with an occasional space. */
function buildCase(rand: () => number): string {
  const fragCount = 5 + Math.floor(rand() * 36) // 5..40
  const parts: string[] = []
  for (let i = 0; i < fragCount; i++) {
    parts.push(POOL[Math.floor(rand() * POOL.length)])
    if (rand() < 0.7) parts.push(' ') // not always — glued fragments matter too
  }
  let s = parts.join('')
  if (rand() < 0.2) s = ` ${s}`
  if (rand() < 0.2) s = `${s} `
  if (rand() < 0.1) s = `\n${s}`
  if (rand() < 0.1) s = `${s}\n`
  return s
}

const CASE_COUNT = 2000

function buildCases(): string[] {
  const rand = rng(SEED)
  const cases: string[] = [...EDGE_CASES]
  while (cases.length < CASE_COUNT) cases.push(buildCase(rand))
  return cases
}

/* ----------------------------------- test ------------------------------------ */

describe('tokenize offset invariant', () => {
  it('keeps every span offset consistent with the original text, across 2000 generated inputs', () => {
    const cases = buildCases()

    for (const input of cases) {
      const label = JSON.stringify(input)

      let doc
      try {
        doc = tokenize(input)
      } catch (err) {
        // Never throws: any input reaching this catch is itself the failure.
        throw new Error(`tokenize threw on input ${label}: ${err}`)
      }

      expect(doc.text, label).toBe(input)
      expect(doc.wordCount, label).toBe(doc.words.length)

      for (const w of doc.words) {
        expect(input.slice(w.start, w.end), `${label} word ${JSON.stringify(w)}`).toBe(w.text)
      }

      for (const p of doc.paragraphs) {
        expect(input.slice(p.start, p.end), `${label} paragraph ${JSON.stringify(p)}`).toBe(
          p.text,
        )

        for (const s of p.sentences) {
          expect(input.slice(s.start, s.end), `${label} sentence ${JSON.stringify(s)}`).toBe(
            s.text,
          )
          // Paragraph containment: every sentence sits fully inside its paragraph.
          expect(
            p.start <= s.start && s.end <= p.end,
            `${label} sentence ${JSON.stringify(s)} not contained in paragraph ${JSON.stringify(p)}`,
          ).toBe(true)
        }

        // Sentences ordered and non-overlapping within the paragraph.
        for (let i = 0; i < p.sentences.length - 1; i++) {
          expect(
            p.sentences[i].end <= p.sentences[i + 1].start,
            `${label} sentences ${i} and ${i + 1} of paragraph ${p.index} overlap or are out of order`,
          ).toBe(true)
        }
      }

      // Paragraphs ordered and non-overlapping.
      for (let i = 0; i < doc.paragraphs.length - 1; i++) {
        expect(
          doc.paragraphs[i].end <= doc.paragraphs[i + 1].start,
          `${label} paragraphs ${i} and ${i + 1} overlap or are out of order`,
        ).toBe(true)
      }

      // The flat sentence list is exactly the concatenation of each
      // paragraph's own sentences, in order.
      const flattened = doc.paragraphs.flatMap((p) => p.sentences)
      expect(doc.sentences, label).toEqual(flattened)
    }
  })
})
