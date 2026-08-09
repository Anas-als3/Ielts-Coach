/**
 * Complexity-marker definitions — the single source of truth for "what counts
 * as a complex sentence" anywhere in the app.
 *
 * There are deliberately TWO lists, because SPEC.md specifies two:
 *
 * - `GRA_SUBORDINATORS` (SPEC.md "rules/grammarRange.ts → sentence-variety")
 *   drives the Grammatical Range criterion and the band estimate. It includes
 *   `despite`, `so that`, `provided that`, `in spite of`, and pairs with a
 *   participial-opener test.
 * - `RAIL_MARKERS` (SPEC.md "Patch v2 → structure C5") drives the Structure
 *   Rail's `complex-count` check. It includes `after` and `before`, excludes
 *   the four phrases above, and has no participial test.
 *
 * They are not the same list and are not interchangeable. Before changing
 * either, note that `tests/band-rewards.test.ts` pins band calibration anchors
 * that depend on the GRA list, and the rail check's satisfied/unsatisfied
 * behaviour depends on the rail list.
 *
 * Both alternations carry a NEGATIVE LOOKAHEAD FOR A HYPHEN. A word boundary
 * sits between `after` and `-`, so an unguarded `\bafter\b` matches the
 * `after` inside `after-school` and credits a hyphenated compound modifier as
 * a subordinate clause. `(?!-)` suppresses that without affecting any genuine
 * clause, since a real subordinator is always followed by whitespace.
 */

/**
 * Subordinators for Grammatical Range (SPEC.md rules/grammarRange.ts).
 * Multi-word phrases first so the alternation prefers them over their prefixes.
 */
export const GRA_SUBORDINATORS: readonly string[] = [
  'provided that',
  'in spite of',
  'even though',
  'so that',
  'although',
  'though',
  'whereas',
  'while',
  'because',
  'since',
  'unless',
  'if',
  'when',
  'despite',
]

/**
 * Structure Rail markers (SPEC.md Patch v2 structure C5). 'that' is
 * deliberately excluded — it is too ambiguous (demonstrative, complementiser)
 * to count reliably.
 */
export const RAIL_MARKERS: readonly string[] = [
  'although',
  'even though',
  'though',
  'whereas',
  'while',
  'unless',
  'if',
  'because',
  'since',
  'when',
  'after',
  'before',
  'which',
  'whose',
  'who',
]

/** Relative pronouns, shared by both definitions. */
export const RELATIVE_PRONOUNS: readonly string[] = ['which', 'whose', 'who']

/** Participial opener, applied to sentence text: "Considering, …" / "Faced, …". (GRA only.) */
export const PARTICIPIAL_OPENER_RE = /^[A-Z][a-z]+(ing|ed),/

/**
 * Build a fresh global alternation over `words`, hyphen-guarded.
 *
 * A NEW RegExp per call, never a shared module constant: a `/g` regex carries
 * `lastIndex` state, and sharing one across call sites is the footgun
 * `tokenize.ts` already documents. Callers using `String.prototype.match` are
 * safe either way; callers using `.exec`/`.matchAll` are not.
 */
export function markerRegex(words: readonly string[]): RegExp {
  return new RegExp(`\\b(${words.join('|')})\\b(?!-)`, 'gi')
}

/**
 * GRA markers in one stretch of text: subordinators + relative pronouns.
 * The participial-opener test is the caller's job, because it is anchored to
 * the start of a SENTENCE and this function accepts any stretch of text.
 */
export function countGraMarkers(text: string): { total: number; because: number } {
  const subs = text.match(markerRegex(GRA_SUBORDINATORS)) ?? []
  let because = 0
  for (const m of subs) if (m.toLowerCase() === 'because') because += 1
  const relatives = text.match(markerRegex(RELATIVE_PRONOUNS)) ?? []
  return { total: subs.length + relatives.length, because }
}

/** Structure Rail marker count for one stretch of text (SPEC.md Patch v2 C5). */
export function countRailMarkers(text: string): number {
  return (text.match(markerRegex(RAIL_MARKERS)) ?? []).length
}
