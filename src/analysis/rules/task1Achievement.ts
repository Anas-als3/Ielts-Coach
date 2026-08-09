/**
 * Task Achievement rules for IELTS Academic Writing Task 1.
 * Implements SPEC.md "Task 1 (v2) → analysis/rules/task1Achievement.ts".
 *
 * These occupy the `TR` criterion slot, which the report labels "Task
 * Achievement" for Task 1 (see `meta.ts → criterionLabel`).
 *
 * The signature takes `Task1ChartFacts` and is therefore NOT a `RuleFn` —
 * `RuleFn` keeps its `(doc, PromptSpec | null)` shape so the six Task 2 rule
 * modules never had to learn about Task 1.
 *
 * Defensive by design: an empty answer yields no issues, and every rule that
 * could accuse a learner of a factual error is gated so it stays silent when
 * it cannot be sure.
 */
import type { Issue, IssueCategory, Severity, Task1ChartFacts, Task1PromptSpec, TokenizedDoc } from '../../types'
import { CATEGORY_META } from '../../meta'

/* -------------------------------- word lists -------------------------------- */

/**
 * Overview markers, in two tiers.
 *
 * An overview — one sentence naming the overall trend or the biggest
 * difference — is the single largest scoring lever in Task 1, so detection has
 * to be accurate in BOTH directions. Missing one costs the learner a 5.5 cap
 * they did not earn; inventing one is worse, because the app then stays quiet
 * about the very thing that will cost them marks in the exam.
 *
 * `OVERVIEW_ANYWHERE` holds phrases that cannot mean anything else.
 * `OVERVIEW_SENTENCE_INITIAL` holds bare adverbs that are only an overview when
 * they FRONT a sentence: "Broadly, the two lines converged" is an overview,
 * "the two lines moved broadly in parallel" is a detail sentence.
 */
const OVERVIEW_ANYWHERE_MARKERS: readonly string[] = [
  'the most striking feature',
  'the most noticeable',
  'the clearest trend',
  'taken as a whole',
  'it is clear that',
  'the general trend',
  'the overall trend',
  'in general',
  'in summary',
  'overall',
]
const OVERVIEW_ANYWHERE = new RegExp(`\\b(${OVERVIEW_ANYWHERE_MARKERS.join('|')})\\b`, 'i')

const OVERVIEW_SENTENCE_INITIAL_MARKERS: readonly string[] = ['generally', 'broadly']
const OVERVIEW_AT_START = new RegExp(
  `^\\s*(${OVERVIEW_SENTENCE_INITIAL_MARKERS.join('|')})\\b`,
  'i',
)

/** Comparison markers — expected whenever the chart carries two or more series. */
const COMPARISON_MARKERS: readonly string[] = [
  'compared with',
  'compared to',
  'in comparison',
  'by contrast',
  'in contrast',
  'higher than',
  'lower than',
  'greater than',
  'more than',
  'less than',
  'the same as',
  'outnumbered',
  'similarly',
  'exceeded',
  'whereas',
  'while',
  'twice',
  'half',
]
const COMPARISON_RE = new RegExp(`\\b(${COMPARISON_MARKERS.join('|')})\\b`, 'i')

/**
 * Causal and predictive language. Task 1 reports what the data SHOWS — it never
 * explains why and never forecasts. Phrased as a check rather than an
 * accusation in the message, because "because" occasionally appears in a
 * legitimate within-data statement.
 */
const CAUSAL_MARKERS: readonly string[] = [
  'as a result of',
  'the reason for this',
  'probably because',
  'may be caused by',
  'will continue to',
  'is likely to rise',
  'is likely to fall',
  'in the future',
  'this is why',
  'owing to',
  'due to',
  'because',
  'i expect',
]
const CAUSAL_RE = new RegExp(`\\b(${CAUSAL_MARKERS.join('|')})\\b`, 'gi')

/** Stance markers (SPEC.md verbatim). Any hit in a Task 1 answer is wrong. */
const STANCE_REGEXES: readonly RegExp[] = [
  /\bI (strongly |firmly |partly |largely )?(agree|disagree|believe|think|argue|contend|maintain)\b/i,
  /\bin my (opinion|view)\b/i,
  /\bmy view is\b/i,
  /\bI am (convinced|of the opinion)\b/i,
  /\bit seems to me\b/i,
]

/** Any number the learner wrote: 47, 4.5, 1,500 — with its span. */
const NUMBER_RE = /\d[\d,]*(?:\.\d+)?/g

/** Words that carry meaning, for the prompt-echo run test. */
const ECHO_STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or', 'but', 'is', 'are', 'was',
  'were', 'be', 'been', 'by', 'with', 'that', 'this', 'these', 'those', 'it', 'as', 'from',
])

/* ------------------------------ canonical gates ------------------------------ */

/**
 * Word-count gates. Below these the rule stays silent, because the learner has
 * not yet had the chance to do the thing being checked — the same reasoning as
 * the Paragraphing gates in SPEC.md's canonical constants.
 */
const OVERVIEW_GATE_WORDS = 100
const SUPPORT_GATE_WORDS = 120

/** Task 1 word-count thresholds (SPEC.md "Task 1 (v2)"). */
const MIN_WORDS = 150
const CLOSE_WORDS = 160
const OVER_WORDS = 220

/* -------------------------------- small helpers ------------------------------ */

function mk(
  category: IssueCategory,
  severity: Severity,
  message: string,
  start: number | null = null,
  end: number | null = null,
  excerpt?: string,
): Issue {
  const out: Issue = {
    id: 'x', // placeholder — the engine reassigns ids
    category,
    criterion: CATEGORY_META[category].criterion,
    severity,
    message,
    start,
    end,
  }
  if (excerpt !== undefined) out.excerpt = excerpt
  return out
}

/** True when any sentence in the document states an overview. */
export function hasOverview(doc: TokenizedDoc): boolean {
  if (OVERVIEW_ANYWHERE.test(doc.text)) return true
  return doc.sentences.some((s) => OVERVIEW_AT_START.test(s.text))
}

/** True when the answer compares its series rather than listing them. */
export function hasComparison(doc: TokenizedDoc): boolean {
  return COMPARISON_RE.test(doc.text)
}

/** Every number the learner wrote, parsed, with its span in the original text. */
export function writtenNumbers(text: string): Array<{ value: number; start: number; end: number; raw: string }> {
  const out: Array<{ value: number; start: number; end: number; raw: string }> = []
  const re = new RegExp(NUMBER_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const value = Number(m[0].replace(/,/g, ''))
    if (!Number.isFinite(value)) continue
    out.push({ value, start: m.index, end: m.index + m[0].length, raw: m[0] })
  }
  return out
}

/** Lowercased, punctuation-stripped word list — for the verbatim-run comparison. */
function normalisedWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/* --------------------------- invented-figure guards -------------------------- */

/**
 * Values a learner may legitimately write even though they are not cells in the
 * chart: pairwise sums and absolute differences. "A combined 65%" and "a gap of
 * 12 points" are correct Task 1 practice.
 *
 * Quadratic in the number of distinct values, which for an authored chart is at
 * most a few dozen — computed once per analysis.
 */
function derivedValues(values: number[]): Set<number> {
  const out = new Set<number>()
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      out.add(values[i] + values[j])
      out.add(Math.abs(values[i] - values[j]))
    }
  }
  return out
}

/**
 * Is `written` a defensible reference to some real value in the chart?
 *
 * Every clause here exists because of a specific way a CORRECT answer can look
 * wrong, and a false accusation is worse than a miss:
 *
 *  - exact match, or within 0.5 — covers reading a value off a gridline;
 *  - a round number within 5% of a real value — "roughly 40%" for a real 39 is
 *    correct IELTS practice and must never be flagged;
 *  - a pairwise sum or difference — "a combined 65%", "a gap of 12 points";
 *  - anything appearing in the category labels — years are labels, not values.
 */
function isDefensible(
  written: number,
  values: number[],
  derived: Set<number>,
  categoryNumbers: Set<number>,
): boolean {
  if (categoryNumbers.has(written)) return true
  if (derived.has(written)) return true

  for (const v of values) {
    if (Math.abs(written - v) <= 0.5) return true
    // Round-number approximation: only for values the learner plausibly rounded.
    const isRound = written % 5 === 0 || written % 10 === 0
    if (isRound && v !== 0 && Math.abs(written - v) / Math.abs(v) <= 0.05) return true
  }
  return false
}

/* ----------------------------------- rules ----------------------------------- */

function wordCount(doc: TokenizedDoc, out: Issue[]): void {
  const wc = doc.wordCount
  if (wc === 0) return
  if (wc < MIN_WORDS) {
    out.push(
      mk(
        't1-word-count',
        'error',
        `${wc} words — Task 1 asks for at least ${MIN_WORDS}. Add a detail sentence with figures from the chart.`,
      ),
    )
  } else if (wc < CLOSE_WORDS) {
    out.push(
      mk(
        't1-word-count',
        'warning',
        `${wc} words — dangerously close to the ${MIN_WORDS}-word minimum. Aim for 170–200 so a miscount cannot cost you the mark.`,
      ),
    )
  } else if (wc > OVER_WORDS) {
    out.push(
      mk(
        't1-word-count',
        'warning',
        `${wc} words — long for the 20 minutes Task 1 allows, and the extra length earns nothing. Cut detail that repeats the overview.`,
      ),
    )
  }
}

function overview(doc: TokenizedDoc, out: Issue[]): void {
  if (doc.wordCount < OVERVIEW_GATE_WORDS) return
  if (hasOverview(doc)) return
  out.push(
    mk(
      't1-overview-missing',
      'error',
      "No overview yet — this is the biggest single mark in Task 1. Add one sentence naming the overall pattern, starting 'Overall, …'.",
    ),
  )
}

function inventedFigures(doc: TokenizedDoc, prompt: Task1PromptSpec, facts: Task1ChartFacts, out: Issue[]): void {
  // A process diagram carries no numbers, so nothing here can be checked.
  if (facts.values.length === 0) return

  const derived = derivedValues(facts.values)
  const categoryNumbers = new Set<number>()
  for (const c of prompt.chart.categories) {
    for (const n of writtenNumbers(c)) categoryNumbers.add(n.value)
  }

  for (const n of writtenNumbers(doc.text)) {
    if (isDefensible(n.value, facts.values, derived, categoryNumbers)) continue
    out.push(
      mk(
        't1-invented-figure',
        'error',
        `The chart has no value of ${n.raw}. Check this figure against the data — examiners treat an invented number as a factual error.`,
        n.start,
        n.end,
        n.raw,
      ),
    )
  }
}

function dataCited(doc: TokenizedDoc, facts: Task1ChartFacts, out: Issue[]): void {
  if (doc.wordCount < SUPPORT_GATE_WORDS) return
  if (facts.values.length === 0) return
  if (writtenNumbers(doc.text).length > 0) return
  out.push(
    mk(
      't1-no-data-cited',
      'warning',
      'No figures quoted yet — Task 1 wants each main feature supported with a specific number from the chart.',
    ),
  )
}

function comparison(doc: TokenizedDoc, facts: Task1ChartFacts, out: Issue[]): void {
  if (doc.wordCount < SUPPORT_GATE_WORDS) return
  if (!facts.comparative) return
  if (hasComparison(doc)) return
  out.push(
    mk(
      't1-no-comparison',
      'warning',
      "This chart shows more than one set of data, so compare them directly — 'higher than', 'twice as many as', 'whereas'.",
    ),
  )
}

function explainsCauses(doc: TokenizedDoc, out: Issue[]): void {
  for (const s of doc.sentences) {
    const re = new RegExp(CAUSAL_RE.source, 'gi')
    const m = re.exec(s.text)
    if (!m) continue
    out.push(
      mk(
        't1-explains-causes',
        'warning',
        `Check this sentence is not explaining WHY: Task 1 reports what the data shows and never gives causes or predictions. Describe the figure instead.`,
        s.start + m.index,
        s.start + m.index + m[0].length,
        m[0],
      ),
    )
  }
}

function opinion(doc: TokenizedDoc, out: Issue[]): void {
  for (const s of doc.sentences) {
    for (const re of STANCE_REGEXES) {
      const m = re.exec(s.text)
      if (!m) continue
      out.push(
        mk(
          't1-opinion',
          'warning',
          'Task 1 has no opinion — describe what the chart shows rather than what you think of it.',
          s.start + m.index,
          s.start + m.index + m[0].length,
          m[0],
        ),
      )
      break // one opinion issue per sentence
    }
  }
}

/**
 * Runs of >= 8 consecutive words shared verbatim with the chart title or the
 * task text, requiring >= 2 content words.
 *
 * Eight, not four — SPEC.md's Task 2 `prompt-echo` records why: at four words
 * the rule fired on wording no answer can avoid, because every answer has to
 * name its own subject. Eight verbatim words is where the writer is copying
 * instead of paraphrasing.
 */
function promptEcho(doc: TokenizedDoc, prompt: Task1PromptSpec, out: Issue[]): void {
  const RUN = 8
  const source = new Set<string>()
  const sourceWords = [...normalisedWords(prompt.chart.title), ...normalisedWords(prompt.text)]
  // Index every 8-gram of the source for O(1) lookup.
  for (let i = 0; i + RUN <= sourceWords.length; i++) {
    source.add(sourceWords.slice(i, i + RUN).join(' '))
  }
  if (source.size === 0) return

  const words = doc.words
  for (let i = 0; i + RUN <= words.length; i++) {
    const slice = words.slice(i, i + RUN)
    const key = slice.map((w) => w.lower.replace(/[^a-z0-9]/g, '')).join(' ')
    if (!source.has(key)) continue
    const contentWords = slice.filter((w) => !ECHO_STOPWORDS.has(w.lower)).length
    if (contentWords < 2) continue

    const start = slice[0].start
    const end = slice[slice.length - 1].end
    out.push(
      mk(
        't1-prompt-echo',
        'warning',
        'Copied from the question — examiners exclude this from your word count. Paraphrase the chart title in your own words.',
        start,
        end,
        doc.text.slice(start, end),
      ),
    )
    i += RUN - 1 // one issue per run, not one per overlapping window
  }
}

/* ---------------------------------- export ----------------------------------- */

export function task1AchievementRules(
  doc: TokenizedDoc,
  prompt: Task1PromptSpec,
  facts: Task1ChartFacts,
): Issue[] {
  const issues: Issue[] = []
  wordCount(doc, issues)
  overview(doc, issues)
  inventedFigures(doc, prompt, facts, issues)
  dataCited(doc, facts, issues)
  comparison(doc, facts, issues)
  explainsCauses(doc, issues)
  opinion(doc, issues)
  promptEcho(doc, prompt, issues)
  return issues
}
