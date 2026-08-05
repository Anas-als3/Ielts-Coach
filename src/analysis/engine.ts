import type { Analysis, EssayStats, Issue, PromptSpec, TokenizedDoc } from '../types'
import { tokenize } from './tokenize'
import { buildStructure } from './rules/structure'
import { taskResponseRules } from './rules/taskResponse'
import { cohesionRules, countLinkingDevices } from './rules/cohesion'
import { lexicalRules } from './rules/lexical'
import { grammarRangeRules } from './rules/grammarRange'
import { accuracyRules } from './rules/accuracy'
import { estimateBand } from './bandEstimate'

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 } as const

function computeStats(doc: TokenizedDoc): EssayStats {
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
