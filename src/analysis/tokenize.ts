/**
 * Tokenizer for IELTS Coach — turns raw essay text into the `TokenizedDoc`
 * every analysis rule consumes. Implements the canonical constants from
 * SPEC.md exactly: word regex, paragraph split/merge, and protected-token
 * sentence splitting. All spans carry absolute character offsets into the
 * ORIGINAL text, because inline highlights index into it directly.
 */

import type { ParagraphSpan, SentenceSpan, Token, TokenizedDoc } from '../types'

/** Canonical word matcher (SPEC.md): letters incl. Latin-1/Extended, apostrophes, hyphens. */
const WORD_RE = /[A-Za-zÀ-ɏ'’-]+/g

/** A match must contain at least one letter to count as a word. */
const HAS_LETTER_RE = /[A-Za-zÀ-ɏ]/

/** A run of sentence-final punctuation — candidate sentence boundary. */
const PUNCT_RUN_RE_SOURCE = /[.!?]+/g

/** A run of 2+ dots is an ellipsis — never a sentence boundary. */
const ELLIPSIS_RE = /^\.{2,}$/

/** Uppercase letter (any script TS/ES2020 knows) — drives the ".Word" typo boundary. */
const UPPER_RE = /\p{Lu}/u

/** Characters that can belong to a dotted abbreviation token (e.g., "e.g.", "U.S."). */
const ABBREV_CHAR_RE = /[A-Za-zÀ-ɏ.]/

const WHITESPACE_RE = /\s/

/** A span must contain at least one letter or digit to count as a sentence. */
const HAS_CONTENT_RE = /[A-Za-zÀ-ɏ0-9]/

/** Fragments under this many words merge into a neighbouring paragraph (SPEC.md). */
const MIN_PARAGRAPH_WORDS = 5

/**
 * Protected abbreviations (SPEC.md), lowercase, each including its final dot.
 * A '.' that is part of one of these tokens never ends a sentence.
 */
const PROTECTED_ABBREVIATIONS: readonly string[] = [
  'e.g.',
  'i.e.',
  'etc.',
  'dr.',
  'mr.',
  'mrs.',
  'ms.',
  'prof.',
  'u.s.',
  'u.k.',
  'approx.',
  'no.',
  'vs.',
]

/**
 * Count word tokens fully contained in [start, end).
 * Binary-searches the (sorted, non-overlapping) token list, so it is safe and
 * cheap to call repeatedly. Word tokens never contain newlines or sentence
 * punctuation, so they can never straddle a paragraph or sentence boundary.
 */
function countWordsWithin(words: Token[], start: number, end: number): number {
  let lo = 0
  let hi = words.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (words[mid].start < start) lo = mid + 1
    else hi = mid
  }
  let count = 0
  for (let i = lo; i < words.length && words[i].start < end; i++) {
    if (words[i].end <= end) count++
  }
  return count
}

/**
 * Is the '.' at `dotIndex` part of a protected abbreviation?
 *
 * Expands left from the dot over letters/dots to get the dotted chunk ending
 * at this dot (e.g. for the 2nd dot of "U.S." the chunk is "u.s.", for the
 * 1st it is "u."). Protected when the chunk IS an abbreviation, or is a
 * prefix of one whose remaining characters follow in the text (so interior
 * dots of "e.g." / "U.K." are protected too).
 */
function isAbbreviationDot(text: string, dotIndex: number): boolean {
  let chunkStart = dotIndex
  while (chunkStart > 0 && ABBREV_CHAR_RE.test(text.charAt(chunkStart - 1))) {
    chunkStart--
  }
  const chunk = text.slice(chunkStart, dotIndex + 1).toLowerCase()
  for (const abbr of PROTECTED_ABBREVIATIONS) {
    if (chunk === abbr) return true
    if (abbr.length > chunk.length && abbr.startsWith(chunk)) {
      const rest = abbr.slice(chunk.length)
      const after = text.slice(dotIndex + 1, dotIndex + 1 + rest.length).toLowerCase()
      if (after === rest) return true
    }
  }
  return false
}

/**
 * Split one paragraph range [pStart, pEnd) into sentence spans.
 *
 * Boundary = a run of [.!?]+ followed by whitespace or the paragraph end,
 * PLUS the typo case where '.' is directly followed by an uppercase letter
 * ("late.He") — but never inside a protected token:
 *  - abbreviations from PROTECTED_ABBREVIATIONS ("Dr. Smith" stays whole),
 *  - decimals ("3.5" — the dot is followed by a digit, so it can never
 *    satisfy the whitespace/uppercase condition),
 *  - ellipses ("..." never splits).
 * The end of the paragraph is an implicit sentence boundary.
 */
function splitSentences(
  text: string,
  words: Token[],
  pStart: number,
  pEnd: number,
  paragraphIndex: number,
): SentenceSpan[] {
  const sentences: SentenceSpan[] = []

  const pushSpan = (rawStart: number, rawEnd: number): void => {
    // Trim whitespace off both ends while keeping offsets absolute.
    let s = rawStart
    let e = rawEnd
    while (s < e && WHITESPACE_RE.test(text.charAt(s))) s++
    while (e > s && WHITESPACE_RE.test(text.charAt(e - 1))) e--
    if (s >= e) return
    const spanText = text.slice(s, e)
    if (!HAS_CONTENT_RE.test(spanText)) return // punctuation-only fragment, not a sentence
    sentences.push({
      text: spanText,
      start: s,
      end: e,
      wordCount: countWordsWithin(words, s, e),
      paragraphIndex,
    })
  }

  // Fresh regex per call: module-level lastIndex state would be a footgun.
  const punctRun = new RegExp(PUNCT_RUN_RE_SOURCE.source, 'g')
  punctRun.lastIndex = pStart
  let cursor = pStart
  let match: RegExpExecArray | null
  while ((match = punctRun.exec(text)) !== null) {
    if (match.index >= pEnd) break
    const run = match[0]
    // The paragraph end is trimmed (next char is whitespace or EOF), so a run
    // starting inside the paragraph cannot extend past pEnd; clamp defensively.
    const runEnd = Math.min(match.index + run.length, pEnd)

    if (ELLIPSIS_RE.test(run)) continue // ellipsis — protected

    const next = runEnd < pEnd ? text.charAt(runEnd) : ''
    const atEnd = next === ''
    const beforeWhitespace = !atEnd && WHITESPACE_RE.test(next)
    // Typo case: '.' glued to an uppercase letter ("late.He").
    const beforeUppercase = !atEnd && run.endsWith('.') && UPPER_RE.test(next)
    if (!atEnd && !beforeWhitespace && !beforeUppercase) continue // e.g. "3.5", "word.com"

    // Single '.' may belong to a protected abbreviation ("Dr.", "e.g.", "U.S.").
    if (run === '.' && isAbbreviationDot(text, match.index)) continue

    pushSpan(cursor, runEnd)
    cursor = runEnd
  }

  // Implicit boundary at paragraph end: whatever remains is the last sentence.
  if (cursor < pEnd) pushSpan(cursor, pEnd)

  return sentences
}

/**
 * Tokenize raw essay text into words, sentences, and paragraphs with exact
 * absolute character offsets into the original string.
 *
 * Behaviour (canonical, per SPEC.md):
 *
 * - **Words** — every match of `/[A-Za-zÀ-ɏ'’-]+/g` over the raw text becomes
 *   a `Token { text, lower, start, end }`; `wordCount` is the number of tokens.
 *   Punctuation and standalone digits are not words (so "3.5" adds nothing).
 *
 * - **Paragraphs** — the text splits on runs of newlines (`/\n+/`). Each
 *   fragment is trimmed of surrounding whitespace (offsets stay absolute);
 *   whitespace-only fragments are dropped. Any fragment under 5 words is
 *   merged into the PREVIOUS paragraph — or into the NEXT one when it is the
 *   first — so stray headings or one-liners do not distort structure checks.
 *   A merged paragraph is a single contiguous span of the original text and
 *   may therefore contain interior newlines.
 *
 * - **Sentences** — found within each paragraph by splitting on `[.!?]+`
 *   followed by whitespace or paragraph end, plus the typo case where `.` is
 *   directly followed by an uppercase letter ("late.He"). Protected tokens
 *   never split: the abbreviations e.g., i.e., etc., Dr., Mr., Mrs., Ms.,
 *   Prof., U.S., U.K., approx., No., vs.; decimal numbers (3.5); and
 *   ellipses (...). The end of a paragraph is always an implicit boundary.
 *   Each `SentenceSpan` records trimmed text, absolute [start, end) offsets,
 *   its word count, and the index of its paragraph.
 *
 * - **Offsets** — every span's `[start, end)` indexes into the ORIGINAL text
 *   exactly (`text.slice(start, end) === span.text`); inline highlights in
 *   the editor depend on this invariant.
 *
 * - **Defensive** — empty or whitespace-only input returns an empty doc
 *   (`words: [], sentences: [], paragraphs: [], wordCount: 0`); no input can
 *   make this function throw.
 *
 * @param text Raw essay text exactly as typed (returned untouched in `.text`).
 * @returns The fully tokenized document.
 *
 * @example
 * const doc = tokenize('Dr. Smith arrived. He was late.\n\nSecondly, costs rose by 3.5 per cent!')
 * // doc.paragraphs.length === 2, doc.sentences.length === 3, doc.wordCount === 12
 * // doc.sentences[0].text === 'Dr. Smith arrived.'  ("Dr." did not split)
 */
export function tokenize(text: string): TokenizedDoc {
  /* ------------------------------- words ------------------------------- */
  const words: Token[] = []
  const wordRe = new RegExp(WORD_RE.source, 'g')
  let wordMatch: RegExpExecArray | null
  while ((wordMatch = wordRe.exec(text)) !== null) {
    const w = wordMatch[0]
    if (w.length === 0) break // cannot happen with this pattern; guards infinite loop
    if (!HAS_LETTER_RE.test(w)) continue // punctuation-only run is not a word
    words.push({
      text: w,
      lower: w.toLowerCase(),
      start: wordMatch.index,
      end: wordMatch.index + w.length,
    })
  }

  /* ------------------- paragraph fragments (split on \n+) ------------------- */
  interface Range {
    start: number
    end: number
  }
  const fragments: Range[] = []
  const pushFragment = (rawStart: number, rawEnd: number): void => {
    let s = rawStart
    let e = rawEnd
    while (s < e && WHITESPACE_RE.test(text.charAt(s))) s++
    while (e > s && WHITESPACE_RE.test(text.charAt(e - 1))) e--
    if (s < e) fragments.push({ start: s, end: e }) // skip whitespace-only fragments
  }
  const newlineRun = /\n+/g
  let fragCursor = 0
  let nlMatch: RegExpExecArray | null
  while ((nlMatch = newlineRun.exec(text)) !== null) {
    pushFragment(fragCursor, nlMatch.index)
    fragCursor = nlMatch.index + nlMatch[0].length
  }
  pushFragment(fragCursor, text.length)

  /* --------------- merge fragments under MIN_PARAGRAPH_WORDS --------------- */
  const ranges: Range[] = []
  let pendingStart: number | null = null // a leading tiny fragment waiting to join the NEXT one
  for (let i = 0; i < fragments.length; i++) {
    const start: number = pendingStart ?? fragments[i].start
    pendingStart = null
    const end = fragments[i].end
    const wc = countWordsWithin(words, start, end)
    if (wc >= MIN_PARAGRAPH_WORDS) {
      ranges.push({ start, end })
    } else if (ranges.length > 0) {
      ranges[ranges.length - 1].end = end // merge into the previous paragraph
    } else if (i < fragments.length - 1) {
      pendingStart = start // first fragment is tiny: merge into the next one
    } else {
      ranges.push({ start, end }) // the whole text is one tiny fragment — keep it
    }
  }

  /* ----------------------- paragraph + sentence spans ----------------------- */
  const paragraphs: ParagraphSpan[] = ranges.map((r, index) => ({
    index,
    text: text.slice(r.start, r.end),
    start: r.start,
    end: r.end,
    wordCount: countWordsWithin(words, r.start, r.end),
    sentences: splitSentences(text, words, r.start, r.end, index),
  }))

  const sentences: SentenceSpan[] = []
  for (const p of paragraphs) sentences.push(...p.sentences)

  return { text, words, sentences, paragraphs, wordCount: words.length }
}
