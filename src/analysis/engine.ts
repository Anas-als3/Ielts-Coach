import type { Analysis, EssayStats, Issue, PromptSpec, Task1PromptSpec, TokenizedDoc } from '../types'
import { tokenize } from './tokenize'
import { buildStructure } from './rules/structure'
import { taskResponseRules } from './rules/taskResponse'
import { cohesionRules, countLinkingDevices } from './rules/cohesion'
import { lexicalRules } from './rules/lexical'
import { grammarRangeRules } from './rules/grammarRange'
import { accuracyRules } from './rules/accuracy'
import { task1AchievementRules } from './rules/task1Achievement'
import { buildTask1Structure } from './rules/task1Structure'
import { deriveChartFacts } from './chartFacts'
import { estimateBand } from './bandEstimate'
import { estimateTask1Band } from './task1BandEstimate'

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 } as const

export function computeStats(doc: TokenizedDoc): EssayStats {
  const lengths = doc.sentences.map((s) => s.wordCount)
  const avg = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0
  const variance = lengths.length
    ? lengths.reduce((a, b) => a + (b - avg) ** 2, 0) / lengths.length
    : 0

  const content = doc.words.filter((w) => w.lower.length >= 4).map((w) => w.lower)
  const ttr = content.length >= 50 ? new Set(content).size / content.length : 0

  return {
    wordCount: doc.wordCount,
    sentenceCount: doc.sentences.length,
    paragraphCount: doc.paragraphs.length,
    avgSentenceLength: Math.round(avg * 10) / 10,
    sentenceLengthStdDev: Math.round(Math.sqrt(variance) * 10) / 10,
    typeTokenRatio: Math.round(ttr * 100) / 100,
    linkingDeviceCount: countLinkingDevices(doc),
  }
}

/**
 * Full essay analysis: tokenize, run every rule family, derive structure,
 * stats and the heuristic band estimate. Pure and synchronous — safe to call
 * debounced on every keystroke.
 */
export function analyzeEssay(text: string, prompt: PromptSpec | null): Analysis {
  const doc = tokenize(text)
  const { paragraphs, checks, issues: structureIssues } = buildStructure(doc, prompt)

  const issues: Issue[] = [
    ...structureIssues,
    ...taskResponseRules(doc, prompt),
    ...cohesionRules(doc, prompt),
    ...lexicalRules(doc, prompt),
    ...grammarRangeRules(doc, prompt),
    ...accuracyRules(doc, prompt),
  ]

  issues.sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (sev !== 0) return sev
    return (a.start ?? -1) - (b.start ?? -1)
  })
  // Engine owns id uniqueness so rule modules never collide.
  issues.forEach((issue, i) => {
    issue.id = `i${i}`
  })

  const stats = computeStats(doc)
  const partial = { issues, paragraphs, structure: checks, stats }
  const band = estimateBand(partial, doc)

  return { ...partial, band }
}

/**
 * Topic-vocabulary context for the four shared rule modules when analysing
 * Task 1.
 *
 * Those modules read exactly two things off a prompt: `keywords`, which
 * `lexical.ts` excludes from repetition counting, and `type`, which
 * `cohesion.ts` checks only for `'discussion'`. Passing `null` would compile
 * and run, but it would strip the keyword exclusion — and a Task 1 answer MUST
 * repeat the chart's subject nouns, its category labels and its trend verbs.
 * The repetition rule would then flag a learner for doing the task correctly.
 *
 * So Task 1 supplies its own keywords through the shape those modules already
 * understand. The `type` is a placeholder: any value other than `'discussion'`
 * leaves every Task 2 branch dormant, which is what Task 1 needs.
 */
function topicContext(prompt: Task1PromptSpec): PromptSpec {
  return {
    id: prompt.id,
    type: 'problem-solution', // inert here — only 'discussion' triggers a branch
    text: prompt.text,
    topic: prompt.topic,
    parts: prompt.parts,
    keywords: [...prompt.keywords, ...TASK1_MEASUREMENT_VOCABULARY],
  }
}

/**
 * Measurement vocabulary no Task 1 answer can avoid repeating.
 *
 * The repetition rule flags a content lemma used more than ~2% of the time, and
 * excludes prompt keywords because topic vocabulary is unavoidable. In Task 1
 * that exclusion has to stretch further: a 180-word chart description says "per
 * cent" five or six times because there is no synonym for it, and the answer is
 * CORRECT for doing so. Without these, the engine penalises a learner for
 * describing a percentage chart in percentages.
 *
 * This is topic vocabulary in the sense the rule already understands, so it
 * travels through the existing keyword channel rather than a Task 1 branch
 * inside `lexical.ts`.
 */
const TASK1_MEASUREMENT_VOCABULARY: readonly string[] = [
  'cent',
  'percent',
  'percentage',
  'proportion',
  'figure',
  'figures',
  'number',
  'numbers',
  'chart',
  'graph',
  'table',
  'diagram',
  'period',
  'year',
  'years',
  'total',
]

/**
 * Full Task 1 analysis. Same contract as `analyzeEssay`: pure, synchronous,
 * safe to call debounced on every keystroke.
 *
 * Four of the five Task 2 rule families apply unchanged — cohesion, lexical,
 * grammatical range and accuracy contain no Task 2 concepts. Only task
 * achievement and structure are Task 1 specific.
 */
export function analyzeTask1(text: string, prompt: Task1PromptSpec): Analysis {
  const doc = tokenize(text)
  const facts = deriveChartFacts(prompt.chart)
  const context = topicContext(prompt)

  // Achievement runs first: the structure checks read its prompt-echo spans to
  // decide whether the opening genuinely paraphrases the title.
  const achievementIssues = task1AchievementRules(doc, prompt, facts)
  const { paragraphs, checks, issues: structureIssues } = buildTask1Structure(
    doc,
    prompt,
    facts,
    achievementIssues,
  )

  const issues: Issue[] = [
    ...structureIssues,
    ...achievementIssues,
    ...cohesionRules(doc, context),
    ...lexicalRules(doc, context),
    ...grammarRangeRules(doc, context),
    ...accuracyRules(doc, context),
  ]

  // Duplicated from analyzeEssay rather than factored out: analyzeEssay must
  // stay byte-identical so the Task 2 regression tests mean what they say.
  issues.sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (sev !== 0) return sev
    return (a.start ?? -1) - (b.start ?? -1)
  })
  issues.forEach((issue, i) => {
    issue.id = `i${i}`
  })

  const stats = computeStats(doc)
  const partial = { issues, paragraphs, structure: checks, stats }
  const band = estimateTask1Band(partial, doc)

  return { ...partial, band }
}
