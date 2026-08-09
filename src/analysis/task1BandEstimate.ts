/**
 * Heuristic band estimate for Task 1. Implements SPEC.md "Task 1 (v2) →
 * analysis/task1BandEstimate.ts".
 *
 * Same machinery as `bandEstimate.ts` — each criterion starts at 7.0, takes
 * deductions and caps, then rewards that need POSITIVE evidence; caps win;
 * clamp 4.0–9.0; snap to 0.5. The shared helpers are imported rather than
 * copied so the two estimators cannot drift apart arithmetically.
 *
 * CC, LR and GRA are scored exactly as Task 2, with two differences that fall
 * out of Task 1 having no conclusion: the shape reward targets 3–4 paragraphs
 * and drops the conclusion requirement, and the `no-conclusion` cap does not
 * exist. TA occupies the `TR` slot (see meta.ts → criterionLabel).
 */
import type {
  BandEstimate,
  Criterion,
  EssayStats,
  Issue,
  ParagraphInfo,
  StructureCheck,
  TokenizedDoc,
} from '../types'
import {
  composeBullets,
  count,
  finishScore,
  hasError,
  hasWarning,
  isClean,
  roundOverallHalfDown,
} from './bandEstimate'
import { PARTICIPIAL_OPENER_RE, countGraMarkers } from './complexity'

/** Below this a Task 1 answer is too short to assess. Task 2's floor is 150. */
const ASSESSABLE_MIN_WORDS = 100

function countComplexityMarkers(doc: TokenizedDoc): number {
  let markers = 0
  for (const s of doc.sentences) {
    markers += countGraMarkers(s.text).total
    if (PARTICIPIAL_OPENER_RE.test(s.text.trimStart())) markers += 1
  }
  return markers
}

export function estimateTask1Band(
  partial: { issues: Issue[]; paragraphs: ParagraphInfo[]; structure: StructureCheck[]; stats: EssayStats },
  doc: TokenizedDoc,
): BandEstimate {
  const { issues, structure, stats } = partial

  if (stats.wordCount < ASSESSABLE_MIN_WORDS) {
    const bullets = [
      `Under ${ASSESSABLE_MIN_WORDS} words — too short to assess.`,
      'Write at least 150 words so every criterion can be scored.',
    ]
    return {
      overall: 4,
      byCriterion: { TR: 4, CC: 4, LR: 4, GRA: 4 },
      rationale: { TR: [...bullets], CC: [...bullets], LR: [...bullets], GRA: [...bullets] },
    }
  }

  /* ---------------------------- Task Achievement ---------------------------- */
  let ta = 7
  const taCaps: number[] = []
  const taProblems: string[] = []

  if (hasError(issues, 't1-word-count')) {
    taCaps.push(5)
    taProblems.push('Under the 150-word minimum — Task Achievement is capped at 5.0.')
  }
  if (hasError(issues, 't1-overview-missing')) {
    taCaps.push(5.5)
    taProblems.push(
      'No overview — capped at 5.5. One sentence naming the overall pattern is the biggest single mark in Task 1.',
    )
  }
  const inventedCount = count(issues, 't1-invented-figure')
  if (inventedCount >= 3) {
    taCaps.push(6)
    taProblems.push(`${inventedCount} figures do not appear in the chart — capped at 6.0. Check every number.`)
  } else if (inventedCount >= 1) {
    ta -= 0.5
    taProblems.push(`${inventedCount} figure not found in the chart (−0.5) — examiners treat this as a factual error.`)
  }
  if (count(issues, 't1-no-data-cited') > 0) {
    ta -= 1
    taProblems.push('No figures quoted from the chart (−1.0) — every main feature needs a number.')
  }
  if (count(issues, 't1-no-comparison') > 0) {
    ta -= 0.5
    taProblems.push('The data sets are never compared (−0.5) — Task 1 asks for comparisons where relevant.')
  }
  const causesCount = count(issues, 't1-explains-causes')
  if (causesCount >= 2) {
    ta -= 0.5
    taProblems.push(`${causesCount} sentences explain or predict (−0.5) — Task 1 reports what the data shows.`)
  }
  if (count(issues, 't1-opinion') >= 1) {
    ta -= 0.5
    taProblems.push('An opinion appears in the answer (−0.5) — Task 1 describes, it never evaluates.')
  }
  if (count(issues, 't1-prompt-echo') >= 1) {
    ta -= 0.5
    taProblems.push('Wording copied from the question (−0.5) — paraphrase the chart title.')
  }

  const allChecksSatisfied = structure.length > 0 && structure.every((c) => c.satisfied)
  const figuresCheck = structure.find((c) => c.id === 't1-figures')
  const overviewCheck = structure.find((c) => c.id === 't1-overview')
  if (isClean(issues, 'TR')) {
    ta += 0.5
    taProblems.push('The chart is reported cleanly — no task-achievement faults (+0.5).')
  }
  if (overviewCheck?.satisfied && figuresCheck?.satisfied) {
    ta += 0.5
    taProblems.push('An overview supported by specific figures (+0.5) — the Task 1 shape examiners look for.')
  }
  if (allChecksSatisfied) {
    ta += 0.5
    taProblems.push('Every structure check is satisfied (+0.5).')
  }

  const taStrengths: string[] = []
  if (overviewCheck?.satisfied) taStrengths.push('Overview clearly stated.')
  if (inventedCount === 0) taStrengths.push('Every figure quoted appears in the chart.')
  if (count(issues, 't1-word-count') === 0) taStrengths.push('Word count in the safe zone.')
  if (count(issues, 't1-opinion') === 0 && causesCount === 0) {
    taStrengths.push('Reports the data without explaining or evaluating it.')
  }

  /* --------------------------- Coherence & Cohesion ------------------------- */
  let cc = 7
  const ccCaps: number[] = []
  const ccProblems: string[] = []

  if (hasError(issues, 'paragraphing')) {
    ccCaps.push(5)
    ccProblems.push('The answer is a single block — capped at 5.0. Separate the overview from the detail.')
  }
  if (count(issues, 't1-shape') > 0) {
    cc -= 0.5
    ccProblems.push('The answer is not in the Task 1 shape (−0.5) — paraphrase, overview, one or two detail paragraphs.')
  }
  if (count(issues, 'linking-underuse') > 0) {
    cc -= 0.5
    ccProblems.push('Too few linking devices (−0.5) — signal contrast, sequence and comparison.')
  }
  if (count(issues, 'linking-overuse') > 0) {
    cc -= 0.5
    ccProblems.push('Linkers open too many sentences (−0.5) — it reads as mechanical.')
  }
  if (count(issues, 'linking-repetition') >= 2) {
    cc -= 0.5
    ccProblems.push('The same linking device is leant on repeatedly (−0.5) — vary your cohesion.')
  }
  if (count(issues, 'paragraph-balance') > 0) {
    cc -= 0.5
    ccProblems.push('One paragraph is much longer than another (−0.5) — spread the detail evenly.')
  }
  if (count(issues, 'connector-misuse') >= 2) {
    cc -= 0.5
    ccProblems.push('Connectors used with the wrong meaning (−0.5) — check what each one signals.')
  }

  const linkingIssueCount =
    count(issues, 'linking-underuse') + count(issues, 'linking-overuse') + count(issues, 'linking-repetition')
  // Task 1 shape is 3–4 paragraphs and has NO conclusion, so unlike Task 2 this
  // reward neither expects five paragraphs nor a conclusion signal.
  const shapeOnTarget = stats.paragraphCount >= 3 && stats.paragraphCount <= 4
  if (isClean(issues, 'CC')) {
    cc += 0.5
    ccProblems.push('Organisation holds together — no coherence faults (+0.5).')
  }
  if (shapeOnTarget) {
    cc += 0.5
    ccProblems.push(`${stats.paragraphCount} paragraphs — the Task 1 shape (+0.5).`)
  }
  if (linkingIssueCount === 0 && stats.linkingDeviceCount >= 6) {
    cc += 0.5
    ccProblems.push(`${stats.linkingDeviceCount} linking devices, none overused (+0.5).`)
  }

  const ccStrengths: string[] = []
  if (shapeOnTarget) ccStrengths.push(`Clear ${stats.paragraphCount}-paragraph structure.`)
  if (linkingIssueCount === 0 && stats.linkingDeviceCount > 0) {
    ccStrengths.push(`Linking devices used naturally (${stats.linkingDeviceCount} found).`)
  }
  if (count(issues, 't1-shape') === 0) ccStrengths.push('The answer follows the Task 1 shape.')

  /* ------------------------------ Lexical Resource -------------------------- */
  let lr = 7
  const lrProblems: string[] = []
  const ttr = stats.typeTokenRatio

  if (ttr > 0 && ttr < 0.45) {
    lr -= 1
    lrProblems.push(`Low vocabulary variety (TTR ${ttr.toFixed(2)}) (−1.0) — vary your trend verbs and quantifiers.`)
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
    lrProblems.push('The same content words repeat often (−0.5) — vary the trend and comparison language.')
  }
  const informalCount = count(issues, 'informal-register') + count(issues, 'contraction')
  if (informalCount >= 3) {
    lr -= 0.5
    lrProblems.push(`${informalCount} informal words or contractions (−0.5) — keep the register formal.`)
  }
  const collocationCount = count(issues, 'collocation')
  if (collocationCount >= 2) {
    lr -= 0.5
    lrProblems.push(`${collocationCount} wrong word partnerships (−0.5) — learn the fixed pairings.`)
  }

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
  if (informalCount === 0) lrStrengths.push('Formal register maintained.')
  if (collocationCount === 0) lrStrengths.push('No wrong collocations found.')

  /* ---------------------- Grammatical Range & Accuracy ---------------------- */
  let gra = 7
  const graCaps: number[] = []
  const graProblems: string[] = []

  const varietyWarning = hasWarning(issues, 'sentence-variety')
  if (varietyWarning) {
    graCaps.push(6)
    graProblems.push("Few complex structures — capped at 6.0. Add clauses like 'which rose to …', 'while … fell'.")
  }
  const spliceCount = count(issues, 'comma-splice')
  if (spliceCount >= 2) {
    gra -= 0.5
    graProblems.push(`${spliceCount} possible comma splices (−0.5) — use a full stop or semicolon.`)
  }
  const longSentenceCount = count(issues, 'long-sentence')
  if (longSentenceCount >= 2) {
    gra -= 0.5
    graProblems.push(`${longSentenceCount} overlong sentences (−0.5) — split them so each carries one idea.`)
  }
  const capitalisationCount = count(issues, 'capitalisation')
  if (capitalisationCount >= 2) {
    gra -= 0.5
    graProblems.push(`${capitalisationCount} sentence capitalisation slips (−0.5).`)
  }
  const articleAgreementCount = count(issues, 'article') + count(issues, 'agreement')
  if (articleAgreementCount >= 3) {
    gra -= 0.5
    graProblems.push(`${articleAgreementCount} accuracy errors: articles/agreement (−0.5) — the main GRA driver.`)
  }
  if (count(issues, 'fragment') >= 1) {
    gra -= 0.5
    graProblems.push('A sentence fragment was found (−0.5) — attach the clause to a complete sentence.')
  }

  const markers = countComplexityMarkers(doc)
  if (isClean(issues, 'GRA')) {
    gra += 0.5
    graProblems.push('No grammar or accuracy faults found (+0.5).')
  }
  if (stats.sentenceLengthStdDev >= 6 && markers >= 5) {
    gra += 0.5
    graProblems.push('Wide mix of sentence lengths and complex structures (+0.5).')
  }
  if (!varietyWarning && markers >= 8) {
    gra += 0.5
    graProblems.push(`${markers} complex structures in use (+0.5).`)
  }

  const graStrengths: string[] = []
  if (!varietyWarning && markers >= 3) graStrengths.push(`Complex structures in use (${markers} found).`)
  if (spliceCount === 0) graStrengths.push('No comma splices detected.')
  if (capitalisationCount === 0 && articleAgreementCount === 0) {
    graStrengths.push('No accuracy slips found (articles, agreement, capitalisation).')
  }

  /* --------------------------------- assemble -------------------------------- */

  const byCriterion: Record<Criterion, number> = {
    TR: finishScore(ta, taCaps),
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
      TR: composeBullets(taProblems, taStrengths),
      CC: composeBullets(ccProblems, ccStrengths),
      LR: composeBullets(lrProblems, lrStrengths),
      GRA: composeBullets(graProblems, graStrengths),
    },
  }
}
