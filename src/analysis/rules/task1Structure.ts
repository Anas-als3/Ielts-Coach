/**
 * Paragraph roles, Structure Rail checks and structural issues for Task 1.
 * Implements SPEC.md "Task 1 (v2) → analysis/rules/task1Structure.ts".
 *
 * The Task 1 shape is paraphrase · overview · one or two detail paragraphs.
 * **There is no conclusion** — a Task 1 conclusion only repeats the overview
 * and spends words the 20 minutes cannot spare. `ParagraphRole` is unchanged,
 * so paragraph 0 is the `introduction` (the paraphrase) and everything after
 * it is a `body`; `'conclusion'` is never assigned here.
 *
 * Defensive by design, mirroring `rules/structure.ts`: an empty answer yields
 * no paragraphs, a STABLE set of unsatisfied checks and no issues, so the rail
 * never jumps around as the learner types.
 */
import type {
  Issue,
  IssueCategory,
  ParagraphInfo,
  ParagraphRole,
  ParagraphSpan,
  Severity,
  StructureCheck,
  Task1ChartFacts,
  Task1PromptSpec,
  TokenizedDoc,
} from '../../types'
import { CATEGORY_META } from '../../meta'
import { countRailMarkers } from '../complexity'
import { hasComparison, hasOverview, writtenNumbers } from './task1Achievement'

/* -------------------------------- constants --------------------------------- */

/** A Task 2 conclusion signal. In Task 1 its presence is the fault, not its absence. */
const CONCLUSION_SIGNAL = /^\s*(in conclusion|to conclude|to sum up|in summary)\b/i

/** Paragraph word-count norms for Task 1 (SPEC.md "Task 1 (v2)"). */
const PARAPHRASE_MIN_WORDS = 15
const DETAIL_MIN_WORDS = 40

/** Shape is judged against the whole answer, never a sentence in progress. */
const SHAPE_GATE_WORDS = 150

/** Distinct chart figures that count as "supported with data". */
const FIGURES_TARGET = 2

/** Complex-sentence target, reused verbatim from Task 2 (SPEC.md Patch v2 C5). */
const COMPLEX_TARGET = 4

/* ------------------------------ small helpers ------------------------------- */

function mk(
  category: IssueCategory,
  severity: Severity,
  message: string,
  start: number | null = null,
  end: number | null = null,
): Issue {
  return {
    id: 'x', // placeholder — the engine reassigns ids
    category,
    criterion: CATEGORY_META[category].criterion,
    severity,
    message,
    start,
    end,
  }
}

/** "A", "A or B", "A, B or C" — for naming paragraphs in check details. */
function orJoin(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`
}

/** Learner-facing paragraph names: 'the opening', 'Paragraph 2', … */
function paragraphNames(count: number): string[] {
  return Array.from({ length: count }, (_, i) => (i === 0 ? 'the opening' : `paragraph ${i + 1}`))
}

/** Distinct chart values the learner actually quoted. */
function citedFigureCount(doc: TokenizedDoc, facts: Task1ChartFacts): number {
  if (facts.values.length === 0) return 0
  const real = new Set(facts.values)
  const cited = new Set<number>()
  for (const n of writtenNumbers(doc.text)) {
    if (real.has(n.value)) cited.add(n.value)
  }
  return cited.size
}

/**
 * A body paragraph counts as a detail paragraph when it is developed and, where
 * the chart HAS figures, quantified.
 *
 * The figure requirement is dropped for a chart with no numbers — a process
 * diagram has none to quote, and demanding one would leave the check
 * permanently unsatisfiable however well the learner described the stages.
 */
function isDetailParagraph(p: ParagraphSpan, chartHasFigures: boolean): boolean {
  if (p.wordCount < DETAIL_MIN_WORDS) return false
  return !chartHasFigures || writtenNumbers(p.text).length > 0
}

/* ------------------------------ paragraph roles ------------------------------ */

/**
 * Paragraph 0 is the paraphrase (`introduction`); everything else is a `body`.
 * Task 1 has no conclusion, so that role is never assigned.
 */
function assignRoles(doc: TokenizedDoc): ParagraphInfo[] {
  return doc.paragraphs.map((p, i) => {
    const role: ParagraphRole = i === 0 ? 'introduction' : 'body'
    const info: ParagraphInfo = {
      index: i,
      start: p.start,
      end: p.end,
      role,
      wordCount: p.wordCount,
      sentenceCount: p.sentences.length,
    }
    if (role === 'body') info.hasTopicSentence = p.sentences.length > 0
    return info
  })
}

/* --------------------------------- checks ----------------------------------- */

function buildChecks(
  doc: TokenizedDoc,
  prompt: Task1PromptSpec,
  facts: Task1ChartFacts,
  issues: Issue[],
): StructureCheck[] {
  const checks: StructureCheck[] = []
  const n = doc.paragraphs.length
  const opening = n > 0 ? doc.paragraphs[0] : undefined
  const bodies = doc.paragraphs.slice(1)

  /* t1-paraphrase */
  const echoedInOpening =
    opening !== undefined &&
    issues.some(
      (i) => i.category === 't1-prompt-echo' && i.start !== null && i.start < opening.end,
    )
  let paraphraseDetail: string
  if (!opening || opening.wordCount === 0) {
    paraphraseDetail = 'Not started — open by restating the chart title in your own words.'
  } else if (opening.wordCount < PARAPHRASE_MIN_WORDS) {
    paraphraseDetail = `Opening: ${opening.wordCount} words — too short to have restated the title. Name what the chart shows, and over what period.`
  } else if (echoedInOpening) {
    paraphraseDetail = 'The opening copies the question wording — reword it using your own synonyms.'
  } else {
    paraphraseDetail = `Opening: ${opening.wordCount} words, in your own wording.`
  }
  checks.push({
    id: 't1-paraphrase',
    label: 'Title paraphrased',
    satisfied: opening !== undefined && opening.wordCount >= PARAPHRASE_MIN_WORDS && !echoedInOpening,
    detail: paraphraseDetail,
  })

  /* t1-overview */
  const overviewFound = hasOverview(doc)
  checks.push({
    id: 't1-overview',
    label: 'Overview',
    satisfied: overviewFound,
    detail: overviewFound
      ? 'Overview stated — the biggest single mark in Task 1.'
      : "No overview yet — add one sentence naming the overall pattern, starting 'Overall, …'. This is the largest single mark in Task 1.",
  })

  /* t1-detail-1 and t1-detail-2 */
  const chartHasFigures = facts.values.length > 0
  const details = bodies.filter((b) => isDetailParagraph(b, chartHasFigures))
  for (let k = 1; k <= 2; k++) {
    const found = details.length >= k
    let detail: string
    if (found) {
      detail = `Detail paragraph ${k}: ${details[k - 1].wordCount} words with figures from the chart.`
    } else if (bodies.length >= k) {
      detail = chartHasFigures
        ? `Paragraph ${k + 1} is not yet a developed detail paragraph — grow it past ${DETAIL_MIN_WORDS} words and quote a figure.`
        : `Paragraph ${k + 1} is not yet a developed detail paragraph — grow it past ${DETAIL_MIN_WORDS} words.`
    } else {
      detail = `Detail paragraph ${k}: not written yet.`
    }
    checks.push({ id: `t1-detail-${k}`, label: `Detail paragraph ${k}`, satisfied: found, detail })
  }

  /* t1-figures */
  const cited = citedFigureCount(doc, facts)
  const figuresPossible = facts.values.length > 0
  checks.push({
    id: 't1-figures',
    label: 'Figures cited',
    satisfied: !figuresPossible || cited >= FIGURES_TARGET,
    detail: !figuresPossible
      ? 'This diagram has no figures — describe the stages in order instead.'
      : cited === 0
        ? 'No figures from the chart quoted yet — support each feature with a specific number.'
        : `${cited} of ${FIGURES_TARGET} chart figures quoted.`,
  })

  /* t1-comparison — only when the chart actually has something to compare */
  if (facts.comparative) {
    const compared = hasComparison(doc)
    checks.push({
      id: 't1-comparison',
      label: 'Comparison made',
      satisfied: compared,
      detail: compared
        ? 'The two sets of data are compared directly.'
        : "Not yet — compare the series against each other ('higher than', 'twice as many as', 'whereas').",
    })
  }

  /* complex-count — reused verbatim from Task 2 (SPEC.md Patch v2 C5) */
  const perParagraph = doc.paragraphs.map((p) => countRailMarkers(p.text))
  const complexTotal = perParagraph.reduce((sum, c) => sum + c, 0)
  const names = paragraphNames(n)
  const zeroNames = names.filter((_, i) => perParagraph[i] === 0)
  let complexDetail: string
  if (n === 0) {
    complexDetail =
      "Not started — complex sentences ('although …', 'because …', 'which …') show grammatical range; aim for one per paragraph."
  } else if (zeroNames.length > 0) {
    complexDetail = `${complexTotal} of ${COMPLEX_TARGET} target — none in ${orJoin(zeroNames)}.`
  } else if (complexTotal < COMPLEX_TARGET) {
    complexDetail = `${complexTotal} of ${COMPLEX_TARGET} target — add another subordinate clause ('although …', 'which …').`
  } else {
    complexDetail = `${complexTotal} complex sentences — at least one in every paragraph.`
  }
  checks.push({
    id: 'complex-count',
    label: 'Complex sentences',
    satisfied: complexTotal >= COMPLEX_TARGET && n > 0 && zeroNames.length === 0,
    detail: complexDetail,
  })

  // `prompt` is part of the signature for symmetry with buildStructure and for
  // future per-prompt checks; the echo evidence it would supply already arrives
  // via `issues`.
  void prompt
  return checks
}

/* --------------------------------- issues ----------------------------------- */

function buildIssues(doc: TokenizedDoc): Issue[] {
  const issues: Issue[] = []
  const n = doc.paragraphs.length
  if (doc.wordCount < SHAPE_GATE_WORDS || n === 0) return issues

  if (n < 3) {
    issues.push(
      mk(
        't1-shape',
        'warning',
        `${n} paragraph${n === 1 ? '' : 's'} — Task 1 wants three or four: a paraphrase, an overview, then one or two detail paragraphs.`,
      ),
    )
  } else if (n > 4) {
    issues.push(
      mk(
        't1-shape',
        'warning',
        `${n} paragraphs — Task 1 fragments easily. Merge the detail into one or two paragraphs grouped by what the data does.`,
      ),
    )
  }

  const last = doc.paragraphs[n - 1]
  if (CONCLUSION_SIGNAL.test(last.text)) {
    issues.push(
      mk(
        't1-shape',
        'warning',
        'Task 1 needs no conclusion — it only repeats the overview. Spend those words on a figure instead.',
        last.start,
        last.end,
      ),
    )
  }

  // Paragraph balance: reuse the Task 2 category, but compare DETAIL paragraphs
  // only. Paragraph 1 is the overview, which is meant to be a single short
  // sentence — measuring it against a 60-word detail paragraph would flag the
  // correct Task 1 shape as unbalanced.
  const details = doc.paragraphs.slice(2)
  if (details.length >= 2) {
    const sorted = [...details].sort((a, b) => a.wordCount - b.wordCount)
    const min = sorted[0]
    const max = sorted[sorted.length - 1]
    if (min.wordCount > 0 && max.wordCount > 2 * min.wordCount) {
      issues.push(
        mk(
          'paragraph-balance',
          'warning',
          `One paragraph (${max.wordCount} words) is more than twice the length of another (${min.wordCount}) — spread the detail more evenly.`,
        ),
      )
    }
  }

  return issues
}

/* --------------------------------- exports ---------------------------------- */

export function buildTask1Structure(
  doc: TokenizedDoc,
  prompt: Task1PromptSpec,
  facts: Task1ChartFacts,
  achievementIssues: Issue[],
): { paragraphs: ParagraphInfo[]; checks: StructureCheck[]; issues: Issue[] } {
  return {
    paragraphs: assignRoles(doc),
    checks: buildChecks(doc, prompt, facts, achievementIssues),
    issues: buildIssues(doc),
  }
}
