/**
 * Grammatical Range & Accuracy rules.
 *
 * Categories emitted: long-sentence, short-sentence-run, sentence-variety,
 * comma-splice, first-person-overuse, missing-hedging. Thresholds and word
 * lists follow SPEC.md ("rules/grammarRange.ts") exactly.
 */
import type { Issue, IssueCategory, RuleFn, Severity, SentenceSpan, TokenizedDoc } from '../../types'

/* ------------------------------- word lists -------------------------------- */

/** Subordinators from SPEC — multi-word phrases first so alternation prefers them. */
const SUBORDINATORS = [
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

const SUBORDINATOR_RE = new RegExp(`\\b(${SUBORDINATORS.join('|')})\\b`, 'gi')
const OPENS_WITH_SUBORDINATOR_RE = new RegExp(`^\\s*(${SUBORDINATORS.join('|')})\\b`, 'i')
const RELATIVE_RE = /\b(which|whose|who)\b/gi
/** Participial opener, applied to the sentence text: "Considering, …" / "Faced, …". */
const PARTICIPIAL_OPENER_RE = /^[A-Z][a-z]+(ing|ed),/

/** Comma splice pattern A: comma + pronoun + auxiliary/verb. */
const SPLICE_PRONOUN_RE =
  /,\s*(it|this|they|he|she|we|I|there)\s+(is|are|was|were|has|have|had|can|will|would|should|do|does|did)\b/gi
/**
 * Comma splice pattern B (narrowed in Patch v2): conjunctive adverb in
 * parenthetical shape but followed by a clause start — "…, however, he kept…".
 * A true parenthetical ("The plan, however, failed.") resumes the SAME clause,
 * so the word after the second comma is not a subject/determiner and this
 * pattern stays silent. Pattern D covers the no-second-comma case.
 */
const SPLICE_ADVERB_RE =
  /,\s*(however|therefore|moreover|nevertheless|consequently|furthermore|thus)\s*,\s*(he|she|it|they|we|I|the|a|an|this|that|there)\b/gi
/** Comma splice pattern C (Patch v2): always-splice adverb + clause start — "…, then he…". */
const SPLICE_ALWAYS_ADVERB_RE =
  /,\s+(then|after that|instead|otherwise|meanwhile|next)\s+(he|she|it|they|we|I|the|a|an|this|that|there)\b/gi
/**
 * Comma splice pattern D (Patch v2): conjunctive adverb NOT set off by a second
 * comma — "…, however he kept writing". The lookahead leaves concessive phrases
 * alone ("…, however strong it seems, …").
 */
const SPLICE_ADVERB_NO_COMMA_RE =
  /,\s+(however|therefore|thus|moreover|consequently|furthermore|nevertheless)\s+(?![^,]{0,20},)\w+\s+\w+/gi
/** Guard: a coordinator immediately before the comma means it is not a splice. */
const COORDINATOR_BEFORE_COMMA_RE = /\b(and|but|or|so|yet)\s*$/i
/**
 * Guard: an auxiliary/copula right before the comma means the adverb merely
 * interrupts one clause ("This is, however, a problem") — not a splice.
 */
const AUX_BEFORE_COMMA_RE =
  /\b(is|are|was|were|be|been|being|has|have|had|will|would|shall|should|can|could|may|might|must|do|does|did)\s*$/i
/** Guard: "If it rains, then we stay home" is a correct correlative pair, not a splice. */
const CORRELATIVE_BEFORE_THEN_RE = /\b(if|when|whenever|once|unless)\b/i

const FIRST_PERSON_RE = /\bI\b|\b[Mm][ye]\b/

/** Absolute + hedge lists embedded from SPEC's overgeneralisation rule. */
const ABSOLUTE_RE =
  /\b(all people|everyone|everybody|no one|nobody|always|never|every single|without exception|undoubtedly|obviously|certainly|definitely|it is a fact)\b/gi
const HEDGE_RE =
  /\b(may|might|could|often|sometimes|usually|generally|tends? to|arguably|in many cases|to some extent|likely|largely|most|many)\b/i

/* --------------------------------- helpers --------------------------------- */

function makeIssue(
  category: IssueCategory,
  severity: Severity,
  message: string,
  start: number | null,
  end: number | null,
  excerpt?: string,
): Issue {
  const issue: Issue = { id: '', category, criterion: 'GRA', severity, message, start, end }
  if (excerpt) issue.excerpt = excerpt
  return issue
}

/** Short quote of a span, with a little context, for inline issues. */
function excerptAround(text: string, start: number, end: number): string {
  const from = Math.max(0, start - 15)
  const to = Math.min(text.length, end + 15)
  const prefix = from > 0 ? '…' : ''
  const suffix = to < text.length ? '…' : ''
  return `${prefix}${text.slice(from, to).trim()}${suffix}`
}

function trimExcerpt(text: string): string {
  const t = text.trim()
  return t.length <= 60 ? t : `${t.slice(0, 60).trimEnd()}…`
}

/** Count complexity markers in one sentence: subordinators + relative pronouns + participial opener. */
function countSentenceMarkers(text: string): { total: number; because: number } {
  const subs = text.match(SUBORDINATOR_RE) ?? []
  let because = 0
  for (const m of subs) if (m.toLowerCase() === 'because') because += 1
  let total = subs.length + (text.match(RELATIVE_RE) ?? []).length
  if (PARTICIPIAL_OPENER_RE.test(text.trimStart())) total += 1
  return { total, because }
}

/* ---------------------------------- rules ---------------------------------- */

/** Sentences > 45 words → warning; wording escalates at >= 4 commas. */
function longSentences(doc: TokenizedDoc, out: Issue[]): void {
  for (const s of doc.sentences) {
    if (s.wordCount <= 45) continue
    const commas = (s.text.match(/,/g) ?? []).length
    const message =
      commas >= 4
        ? `This sentence runs ${s.wordCount} words with ${commas} commas — it has very likely lost grammatical control. Break it into two or three shorter sentences, each with one main idea.`
        : `This sentence is ${s.wordCount} words long — likely a run-on. Split it at a natural break so each part carries one clear idea.`
    out.push(makeIssue('long-sentence', 'warning', message, s.start, s.end, trimExcerpt(s.text)))
  }
}

/** 3+ consecutive sentences under 8 words (within one paragraph) → one info on the run. */
function shortSentenceRuns(doc: TokenizedDoc, out: Issue[]): void {
  let run: SentenceSpan[] = []

  const flush = (): void => {
    if (run.length >= 3) {
      const first = run[0]
      const last = run[run.length - 1]
      out.push(
        makeIssue(
          'short-sentence-run',
          'info',
          `${run.length} sentences in a row are under 8 words, which reads as choppy. Combine two of them with 'although', 'which' or 'because' to show a complex structure.`,
          first.start,
          last.end,
          trimExcerpt(doc.text.slice(first.start, last.end)),
        ),
      )
    }
    run = []
  }

  for (const s of doc.sentences) {
    const prev = run.length > 0 ? run[run.length - 1] : null
    const continues = s.wordCount < 8 && (prev === null || prev.paragraphIndex === s.paragraphIndex)
    if (continues) {
      run.push(s)
    } else {
      flush()
      if (s.wordCount < 8) run.push(s)
    }
  }
  flush()
}

/** Essay-level sentence-variety checks, only once there are >= 10 sentences. */
function sentenceVariety(doc: TokenizedDoc, out: Issue[]): void {
  const sentences = doc.sentences
  if (sentences.length < 10) return

  let markers = 0
  let because = 0
  for (const s of sentences) {
    const counts = countSentenceMarkers(s.text)
    markers += counts.total
    because += counts.because
  }

  const lengths = sentences.map((s) => s.wordCount)
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length
  const variance = lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length
  const stdDev = Math.sqrt(variance)

  if (markers < 3) {
    out.push(
      makeIssue(
        'sentence-variety',
        'warning',
        `${markers === 0 ? 'No complex structures' : markers === 1 ? 'Only one complex structure' : `Only ${markers} complex structures`} found in the whole essay — few complex structures cap GRA near Band 6. Add subordinate clauses ('although…', 'whereas…') and relative clauses ('…, which…').`,
        null,
        null,
      ),
    )
  } else if (stdDev < 4 && mean >= 8 && mean <= 16) {
    out.push(
      makeIssue(
        'sentence-variety',
        'warning',
        `Your sentences are all about the same length (average ${Math.round(mean)} words) — uniform simple sentences limit grammatical range. Combine some sentences and shorten others to vary the rhythm.`,
        null,
        null,
      ),
    )
  }

  if (markers >= 3 && because / markers > 0.6) {
    out.push(
      makeIssue(
        'sentence-variety',
        'info',
        `'Because' provides ${because} of your ${markers} complex structures — one-trick subordination. Swap a few for 'since', 'although' or a '…, which…' clause to widen your range.`,
        null,
        null,
      ),
    )
  }
}

/**
 * All comma-splice patterns, with the SPEC guard conditions, per sentence.
 * Patterns run most-specific first, and each stretch of text produces at most
 * ONE issue: a match whose span overlaps an already-claimed span is dropped.
 */
function commaSplices(doc: TokenizedDoc, out: Issue[]): void {
  for (const s of doc.sentences) {
    const claimed: Array<[number, number]> = []
    const overlaps = (start: number, end: number): boolean =>
      claimed.some(([a, b]) => start < b && a < end)
    const claim = (start: number, end: number, message: string): void => {
      claimed.push([start, end])
      out.push(
        makeIssue(
          'comma-splice',
          'warning',
          message,
          s.start + start,
          s.start + end,
          excerptAround(s.text, start, end),
        ),
      )
    }
    /** Coordinator or auxiliary right before the comma → not a splice at idx. */
    const guardedBeforeComma = (idx: number): boolean => {
      const before = s.text.slice(0, idx)
      return COORDINATOR_BEFORE_COMMA_RE.test(before) || AUX_BEFORE_COMMA_RE.test(before)
    }

    // Pattern C (Patch v2): ", then he …" — these adverbs never join clauses.
    for (const m of s.text.matchAll(SPLICE_ALWAYS_ADVERB_RE)) {
      const idx = m.index ?? 0
      const adverb = m[1].toLowerCase()
      if (guardedBeforeComma(idx)) continue
      // "If it rains, then we stay home" is a correct correlative, not a splice.
      if (adverb === 'then' && CORRELATIVE_BEFORE_THEN_RE.test(s.text.slice(0, idx))) continue
      if (overlaps(idx, idx + m[0].length)) continue
      claim(
        idx,
        idx + m[0].length,
        `'${adverb}' is not a joining word — use a full stop, or 'and ${adverb}'.`,
      )
    }

    // Pattern B: ", however, he …" — parenthetical shape but a new clause follows.
    for (const m of s.text.matchAll(SPLICE_ADVERB_RE)) {
      const idx = m.index ?? 0
      const adverb = m[1].toLowerCase()
      if (guardedBeforeComma(idx)) continue
      if (overlaps(idx, idx + m[0].length)) continue
      claim(
        idx,
        idx + m[0].length,
        `Check: are these two complete sentences? If so, use a semicolon or a full stop before '${adverb}' — a comma alone cannot join them.`,
      )
    }

    // Pattern D (Patch v2): ", however he …" — no parenthetical comma; this
    // complements pattern B, and the overlap check keeps one occurrence to one issue.
    for (const m of s.text.matchAll(SPLICE_ADVERB_NO_COMMA_RE)) {
      const idx = m.index ?? 0
      const adverb = m[1].toLowerCase()
      if (guardedBeforeComma(idx)) continue
      if (overlaps(idx, idx + m[0].length)) continue
      claim(
        idx,
        idx + m[0].length,
        `Check: are these two complete sentences? If so, use a semicolon or a full stop before '${adverb}' — a comma alone cannot join them.`,
      )
    }

    // Pattern A: ", it is …" — skipped when the sentence opens with a
    // subordinator (the comma then closes a legitimate subordinate clause).
    if (OPENS_WITH_SUBORDINATOR_RE.test(s.text)) continue
    for (const m of s.text.matchAll(SPLICE_PRONOUN_RE)) {
      const idx = m.index ?? 0
      // Skip when a coordinator sits right before the comma ("…and, it is…").
      if (COORDINATOR_BEFORE_COMMA_RE.test(s.text.slice(0, idx))) continue
      if (overlaps(idx, idx + m[0].length)) continue
      claim(
        idx,
        idx + m[0].length,
        "A comma may be joining two full sentences here — check: are these two complete sentences? If they are, use a full stop, a semicolon, or add a conjunction like 'and' or 'but'.",
      )
    }
  }
}

/**
 * Body paragraphs with more than one first-person sentence → info.
 * Roles recomputed positionally, mirroring structure: with >= 3 paragraphs the
 * first is the introduction, the last the conclusion, the rest bodies. With
 * fewer than 3 paragraphs there are no confirmed bodies, so nothing fires.
 */
function firstPersonOveruse(doc: TokenizedDoc, out: Issue[]): void {
  const paragraphs = doc.paragraphs
  if (paragraphs.length < 3) return

  for (let i = 1; i < paragraphs.length - 1; i++) {
    const p = paragraphs[i]
    const hits = p.sentences.filter((s) => FIRST_PERSON_RE.test(s.text))
    if (hits.length > 1) {
      out.push(
        makeIssue(
          'first-person-overuse',
          'info',
          `This body paragraph uses 'I', 'my' or 'me' in ${hits.length} sentences. Keep first person for stating your position; argue body points impersonally — for example, 'It can be argued that…'.`,
          p.start,
          p.end,
          trimExcerpt(hits[0].text),
        ),
      )
    }
  }
}

/** Zero hedges plus 3+ absolutes anywhere in the essay → essay-level info. */
function missingHedging(doc: TokenizedDoc, out: Issue[]): void {
  if (!doc.text) return
  const absolutes = doc.text.match(ABSOLUTE_RE) ?? []
  const example = absolutes[0]
  if (absolutes.length < 3 || !example) return
  if (HEDGE_RE.test(doc.text)) return
  out.push(
    makeIssue(
      'missing-hedging',
      'info',
      `The essay makes ${absolutes.length} absolute claims (e.g. '${example.toLowerCase()}') and never softens one — the tone reads overgeneralised. Hedge a few claims with 'may', 'tends to' or 'in many cases'.`,
      null,
      null,
    ),
  )
}

/* --------------------------------- export ---------------------------------- */

export const grammarRangeRules: RuleFn = (doc) => {
  const issues: Issue[] = []
  longSentences(doc, issues)
  shortSentenceRuns(doc, issues)
  sentenceVariety(doc, issues)
  commaSplices(doc, issues)
  firstPersonOveruse(doc, issues)
  missingHedging(doc, issues)
  return issues
}
