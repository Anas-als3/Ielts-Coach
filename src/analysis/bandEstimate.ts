/**
 * Heuristic band estimate per SPEC.md ("analysis/bandEstimate.ts").
 *
 * Each criterion starts at 7.0; deductions and caps are derived by scanning
 * issue categories, stats and structure checks; scores are clamped to
 * 4.0–9.0 and snapped to 0.5 steps. Rationale bullets name the actual
 * drivers — deductions applied and strengths observed.
 */
import type {
  BandEstimate,
  Criterion,
  EssayStats,
  Issue,
  IssueCategory,
  ParagraphInfo,
  StructureCheck,
  TokenizedDoc,
} from '../types'
import { PARTICIPIAL_OPENER_RE, countGraMarkers } from './complexity'

/* ------------------------- complexity markers (GRA) ------------------------- */

/** Total GRA complexity markers across the document (SPEC.md rules/grammarRange.ts). */
function countComplexityMarkers(doc: TokenizedDoc): number {
  let markers = 0
  for (const s of doc.sentences) {
    markers += countGraMarkers(s.text).total
    if (PARTICIPIAL_OPENER_RE.test(s.text.trimStart())) markers += 1
  }
  return markers
}

/* --------------------------------- helpers --------------------------------- */

export function count(issues: Issue[], category: IssueCategory): number {
  let n = 0
  for (const issue of issues) if (issue.category === category) n += 1
  return n
}

export function hasError(issues: Issue[], category: IssueCategory): boolean {
  return issues.some((i) => i.category === category && i.severity === 'error')
}

export function hasWarning(issues: Issue[], category: IssueCategory): boolean {
  return issues.some((i) => i.category === category && i.severity === 'warning')
}

/**
 * No error or warning anywhere in this criterion — the "clean sweep" every
 * reward path starts from. `info` issues are advisory by SPEC's own severity
 * model (topic sentences, hedging, passive balance are low-precision
 * heuristics), so they never block a reward.
 */
export function isClean(issues: Issue[], criterion: Criterion): boolean {
  return !issues.some((i) => i.criterion === criterion && i.severity !== 'info')
}

/** Clamp to 4.0–9.0, apply caps, snap to 0.5 steps. */
export function finishScore(raw: number, caps: number[]): number {
  const capped = caps.reduce((acc, c) => Math.min(acc, c), raw)
  const clamped = Math.min(9, Math.max(4, capped))
  return Math.round(clamped * 2) / 2
}

/** Round to the nearest 0.5 step, with .25/.75 rounding DOWN (conservative). */
export function roundOverallHalfDown(x: number): number {
  return Math.ceil(x * 2 - 0.5) / 2
}

/**
 * 2–4 bullets: problems (deductions/caps/bonuses) first, then strengths to
 * round the picture out. Never more than 4, never fewer than 2 in practice
 * because every problem has a paired strength.
 */
export function composeBullets(problems: string[], strengths: string[]): string[] {
  const out = problems.slice(0, 3)
  const maxLen = out.length === 0 ? 3 : 4
  for (const s of strengths) {
    if (out.length >= maxLen) break
    out.push(s)
  }
  if (out.length === 0) out.push('No strong signals either way yet — keep writing.')
  return out
}

/* ---------------------------------- main ----------------------------------- */

export function estimateBand(
  partial: { issues: Issue[]; paragraphs: ParagraphInfo[]; structure: StructureCheck[]; stats: EssayStats },
  doc: TokenizedDoc,
): BandEstimate {
  const { issues, structure, stats } = partial

  // Too short to assess at all.
  if (stats.wordCount < 150) {
    const bullets = [
      'Under 150 words — too short to assess.',
      'Write at least 250 words so every criterion can be scored.',
    ]
    return {
      overall: 4,
      byCriterion: { TR: 4, CC: 4, LR: 4, GRA: 4 },
      rationale: { TR: [...bullets], CC: [...bullets], LR: [...bullets], GRA: [...bullets] },
    }
  }

  /* ------------------------------ Task Response ----------------------------- */
  let tr = 7
  const trCaps: number[] = []
  const trProblems: string[] = []

  if (hasError(issues, 'word-count')) {
    trCaps.push(5)
    trProblems.push('Under the 250-word minimum — Task Response is capped at 5.0.')
  }
  if (hasError(issues, 'no-position')) {
    trCaps.push(5.5)
    trProblems.push('No clear position found — capped at 5.5. State your view plainly in the introduction.')
  }
  if (hasError(issues, 'question-coverage')) {
    trCaps.push(5.5)
    trProblems.push('Part of the question goes unanswered — capped at 5.5. Cover every part.')
  }
  const positionConsistencyCount = count(issues, 'position-consistency')
  if (positionConsistencyCount > 0) {
    trCaps.push(6)
    trProblems.push('Introduction and conclusion take different positions — capped at 6.0 until your position is consistent.')
  }
  if (count(issues, 'prompt-echo') > 0) {
    tr -= 0.5
    trProblems.push('Wording copied from the question (−0.5) — paraphrase it in your own words.')
  }
  if (count(issues, 'off-topic') > 0) {
    tr -= 1
    trProblems.push('Body paragraphs drift from the question topic (−1.0).')
  }
  const overgen = count(issues, 'overgeneralisation')
  if (overgen >= 3) {
    tr -= 0.5
    trProblems.push(`${overgen} sweeping claims without hedging (−0.5).`)
  }
  if (count(issues, 'personal-anecdote') > 0) {
    tr -= 0.5
    trProblems.push('Personal anecdotes used as evidence (−0.5) — prefer general examples.')
  }

  /*
   * TR rewards. Every criterion starts at 7.0 and used to have almost no way
   * up — the model's ceiling was 7.25, so Bands 8 and 9 were unreachable by
   * construction however good the essay was. Each reward below needs POSITIVE
   * evidence, not merely the absence of a detection, so an unambitious essay
   * the rules happen not to catch cannot drift upward on silence alone.
   * Caps still win: finishScore applies them after the rewards.
   */
  const allChecksSatisfied = structure.length > 0 && structure.every((c) => c.satisfied)
  // The safe zone is anything the word-count rule does not complain about:
  // 331–340 is not over-length, so it should not miss the reward either.
  const wordCountGood = stats.wordCount >= 260 && count(issues, 'word-count') === 0
  if (isClean(issues, 'TR')) {
    tr += 0.5
    trProblems.push('The question is answered cleanly — no task-response faults (+0.5).')
  }
  if (wordCountGood) {
    tr += 0.5
    trProblems.push(`${stats.wordCount} words — a fully developed answer (+0.5).`)
  }
  if (allChecksSatisfied) {
    tr += 0.5
    trProblems.push('Every structure check is satisfied (+0.5).')
  }

  const trStrengths: string[] = []
  const positionCheck = structure.find((c) => c.id === 'position-stated')
  if (positionCheck?.satisfied && positionConsistencyCount === 0) trStrengths.push('Clear position maintained.')
  if (count(issues, 'question-coverage') === 0) trStrengths.push('All parts of the question addressed.')
  if (count(issues, 'word-count') === 0) trStrengths.push('Word count in the safe zone.')
  if (positionConsistencyCount === 0) trStrengths.push('Position consistent from introduction to conclusion.')

  /* --------------------------- Coherence & Cohesion ------------------------- */
  let cc = 7
  const ccCaps: number[] = []
  const ccProblems: string[] = []

  if (hasError(issues, 'paragraphing')) {
    ccCaps.push(5)
    ccProblems.push('The essay is a single block — capped at 5.0. Split it into introduction, bodies and conclusion.')
  }
  if (count(issues, 'no-conclusion') > 0) {
    ccCaps.push(6)
    ccProblems.push("No conclusion found — capped at 6.0. Close with a one-sentence summary ('In conclusion, …').")
  }
  if (count(issues, 'linking-underuse') > 0) {
    cc -= 0.5
    ccProblems.push('Too few linking devices (−0.5) — signal contrast, cause and examples.')
  }
  if (count(issues, 'linking-overuse') > 0) {
    cc -= 0.5
    ccProblems.push('Linkers open too many sentences (−0.5) — it reads as mechanical.')
  }
  if (count(issues, 'linking-repetition') >= 2) {
    cc -= 0.5
    ccProblems.push('The same linking device is leant on repeatedly (−0.5) — vary your cohesion.')
  }
  const topicSentenceIssues = count(issues, 'topic-sentence')
  if (topicSentenceIssues >= 2) {
    cc -= 0.5
    ccProblems.push(`${topicSentenceIssues} body paragraphs lack a clear topic sentence (−0.5).`)
  }
  if (count(issues, 'paragraph-balance') > 0) {
    cc -= 0.5
    ccProblems.push('One body paragraph is much longer than another (−0.5) — balance their development.')
  }
  const connectorMisuseCount = count(issues, 'connector-misuse')
  if (connectorMisuseCount >= 2) {
    cc -= 0.5
    ccProblems.push(
      `${connectorMisuseCount} connectors used with the wrong meaning (−0.5) — check what each one signals ('however' = contrast, 'meanwhile' = time).`,
    )
  }
  const shapeIssueCount = count(issues, 'intro-shape') + count(issues, 'conclusion-shape')
  if (shapeIssueCount >= 2) {
    cc -= 0.5
    ccProblems.push(
      'Introduction/conclusion shape (−0.5) — keep the introduction short, close with exactly two sentences, and put examples in the body only.',
    )
  }

  /*
   * CC rewards. Organisation is the criterion a rule engine can see most
   * directly, so the evidence here is concrete: the target paragraph shape, a
   * signalled conclusion, and cohesion that is present without being
   * mechanical.
   */
  const linkingIssueCount =
    count(issues, 'linking-underuse') + count(issues, 'linking-overuse') + count(issues, 'linking-repetition')
  const conclusionSignalled = structure.find((c) => c.id === 'conclusion-present')?.satisfied === true
  const shapeOnTarget = stats.paragraphCount >= 4 && stats.paragraphCount <= 5 && conclusionSignalled
  if (isClean(issues, 'CC')) {
    cc += 0.5
    ccProblems.push('Organisation holds together — no coherence faults (+0.5).')
  }
  if (shapeOnTarget) {
    cc += 0.5
    ccProblems.push(`${stats.paragraphCount} paragraphs with a signalled conclusion (+0.5).`)
  }
  if (linkingIssueCount === 0 && stats.linkingDeviceCount >= 8) {
    cc += 0.5
    ccProblems.push(`${stats.linkingDeviceCount} linking devices, none overused (+0.5).`)
  }

  const ccStrengths: string[] = []
  // `paragraphing` is length-gated (SPEC "Paragraphing gates"), so its absence
  // no longer proves good shape — a 160-word draft with two paragraphs is not
  // yet at fault, but it has not earned the compliment either. Only the target
  // 4–5 shape does, which is exactly what an ungated absence used to mean.
  if (count(issues, 'paragraphing') === 0 && stats.paragraphCount >= 4 && stats.paragraphCount <= 5) {
    ccStrengths.push(`Clear ${stats.paragraphCount}-paragraph structure.`)
  }
  if (count(issues, 'no-conclusion') === 0 && stats.paragraphCount >= 3) ccStrengths.push('Conclusion present.')
  if (linkingIssueCount === 0 && stats.linkingDeviceCount > 0) {
    ccStrengths.push(`Linking devices used naturally (${stats.linkingDeviceCount} found).`)
  }
  if (topicSentenceIssues === 0) ccStrengths.push('Body paragraphs open with clear topic sentences.')
  if (connectorMisuseCount === 0) ccStrengths.push('Connectors carry their intended meanings.')
  if (shapeIssueCount === 0) ccStrengths.push('Introduction and conclusion are well shaped.')

  /* ------------------------------ Lexical Resource -------------------------- */
  let lr = 7
  const lrProblems: string[] = []
  const ttr = stats.typeTokenRatio

  if (ttr > 0 && ttr < 0.45) {
    lr -= 1
    lrProblems.push(`Low vocabulary variety (TTR ${ttr.toFixed(2)}) (−1.0) — swap repeated words for synonyms.`)
  } else if (ttr > 0 && ttr < 0.55) {
    lr -= 0.5
    lrProblems.push(`Modest vocabulary variety (TTR ${ttr.toFixed(2)}) (−0.5) — vary your content words.`)
  }
  if (count(issues, 'memorised-phrase') >= 1) {
    lr -= 0.5
    lrProblems.push('Memorised template phrases detected (−0.5) — examiners discount them.')
  }
  if (count(issues, 'repetition') >= 2) {
    lr -= 0.5
    lrProblems.push('The same content words repeat often (−0.5) — use synonyms or rephrase.')
  }
  const informalCount = count(issues, 'informal-register') + count(issues, 'contraction')
  if (informalCount >= 3) {
    lr -= 0.5
    lrProblems.push(`${informalCount} informal words or contractions (−0.5) — keep the register formal.`)
  }
  const collocationCount = count(issues, 'collocation')
  if (collocationCount >= 2) {
    lr -= 0.5
    lrProblems.push(
      `${collocationCount} wrong word partnerships (−0.5) — learn the fixed pairings ('key to', 'depend on', 'responsible for').`,
    )
  }

  /*
   * LR rewards. Type-token ratio is the one direct measurement of lexical
   * range available without a dictionary, so it carries two of the three
   * steps. It is only meaningful once computeStats has 50+ content words —
   * below that it is reported as 0 and no reward can fire.
   */
  if (isClean(issues, 'LR')) {
    lr += 0.5
    lrProblems.push('Word choice is clean throughout — no lexical faults (+0.5).')
  }
  if (ttr >= 0.65) {
    lr += 0.5
    lrProblems.push(`Wide vocabulary range (TTR ${ttr.toFixed(2)}) (+0.5).`)
  }
  if (ttr >= 0.75) {
    lr += 0.5
    lrProblems.push('Content words are rarely reused (+0.5).')
  }

  const lrStrengths: string[] = []
  if (ttr >= 0.55) lrStrengths.push(`Good vocabulary variety (TTR ${ttr.toFixed(2)}).`)
  if (count(issues, 'memorised-phrase') === 0) lrStrengths.push('No template phrases detected.')
  if (informalCount === 0) lrStrengths.push('Formal register maintained.')
  if (collocationCount === 0) lrStrengths.push('No wrong collocations found.')

  /* ---------------------- Grammatical Range & Accuracy ---------------------- */
  let gra = 7
  const graCaps: number[] = []
  const graProblems: string[] = []

  const varietyWarning = hasWarning(issues, 'sentence-variety')
  if (varietyWarning) {
    graCaps.push(6)
    graProblems.push("Few complex structures — capped at 6.0. Add subordinate ('although…') and relative ('…, which…') clauses.")
  }
  const spliceCount = count(issues, 'comma-splice')
  if (spliceCount >= 2) {
    gra -= 0.5
    graProblems.push(`${spliceCount} possible comma splices (−0.5) — use a full stop or semicolon between complete sentences.`)
  }
  const longSentenceCount = count(issues, 'long-sentence')
  if (longSentenceCount >= 2) {
    gra -= 0.5
    graProblems.push(`${longSentenceCount} overlong sentences (−0.5) — split them so each carries one idea.`)
  }
  const capitalisationCount = count(issues, 'capitalisation')
  if (capitalisationCount >= 2) {
    gra -= 0.5
    graProblems.push(
      `${capitalisationCount} sentence capitalisation slips (−0.5) — start every sentence, and the pronoun 'I', with a capital letter.`,
    )
  }
  const articleAgreementCount = count(issues, 'article') + count(issues, 'agreement')
  if (articleAgreementCount >= 3) {
    gra -= 0.5
    graProblems.push(
      `${articleAgreementCount} accuracy errors: articles/agreement (−0.5) — the main GRA driver; check 'a/the' before singular nouns and match subjects to verbs.`,
    )
  }
  const fragmentCount = count(issues, 'fragment')
  if (fragmentCount >= 1) {
    gra -= 0.5
    graProblems.push('A sentence fragment was found (−0.5) — attach the dependent clause to a complete sentence.')
  }
  /*
   * GRA rewards. Accuracy and range are separate halves of this criterion, so
   * they are rewarded separately: a clean sweep covers accuracy, the marker
   * counts cover range. The two range steps are cumulative — an essay with
   * both varied sentence lengths and 10+ complex structures earns each.
   */
  const markers = countComplexityMarkers(doc)
  if (isClean(issues, 'GRA')) {
    gra += 0.5
    graProblems.push('No grammar or accuracy faults found (+0.5).')
  }
  if (stats.sentenceLengthStdDev >= 6 && markers >= 7) {
    gra += 0.5
    graProblems.push('Wide mix of sentence lengths and complex structures (+0.5).')
  }
  if (!varietyWarning && markers >= 10) {
    gra += 0.5
    graProblems.push(`${markers} complex structures in use (+0.5).`)
  }

  const graStrengths: string[] = []
  if (!varietyWarning && markers >= 3) graStrengths.push(`Complex structures in use (${markers} found).`)
  if (spliceCount === 0) graStrengths.push('No comma splices detected.')
  if (longSentenceCount === 0) graStrengths.push('Sentence length under control.')
  if (capitalisationCount === 0 && articleAgreementCount === 0) {
    graStrengths.push('No accuracy slips found (articles, agreement, capitalisation).')
  }
  if (fragmentCount === 0) graStrengths.push('No sentence fragments detected.')

  /* --------------------------------- assemble -------------------------------- */

  const byCriterion: Record<Criterion, number> = {
    TR: finishScore(tr, trCaps),
    CC: finishScore(cc, ccCaps),
    LR: finishScore(lr, []),
    GRA: finishScore(gra, graCaps),
  }

  const mean = (byCriterion.TR + byCriterion.CC + byCriterion.LR + byCriterion.GRA) / 4
  const overall = Math.min(9, Math.max(4, roundOverallHalfDown(mean)))

  return {
    overall,
    byCriterion,
    rationale: {
      TR: composeBullets(trProblems, trStrengths),
      CC: composeBullets(ccProblems, ccStrengths),
      LR: composeBullets(lrProblems, lrStrengths),
      GRA: composeBullets(graProblems, graStrengths),
    },
  }
}
