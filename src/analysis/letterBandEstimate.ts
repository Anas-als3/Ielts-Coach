/**
 * Heuristic band estimate for General Training Writing Task 1 — the letter.
 * Implements SPEC.md "General Training Task 1 (letters)".
 *
 * Same machinery as `bandEstimate.ts` and `task1BandEstimate.ts` — each
 * criterion starts at 7.0, takes deductions and caps, then rewards that need
 * POSITIVE evidence; caps win; clamp 4.0–9.0; snap to 0.5. The shared helpers
 * are imported rather than copied so the three estimators cannot drift apart
 * arithmetically.
 *
 * CC, LR and GRA are scored as Academic Task 1 is, with the one difference that
 * falls out of a letter having no fixed paragraph count: the CC shape reward
 * targets 3–5 paragraphs (three bullets can be answered in three paragraphs or
 * folded into two, and both are good letters). TA occupies the `TR` slot (see
 * meta.ts → criterionLabel).
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

/** Below this a letter is too short to assess — the same floor as Academic Task 1. */
const ASSESSABLE_MIN_WORDS = 100

function countComplexityMarkers(doc: TokenizedDoc): number {
  let markers = 0
  for (const s of doc.sentences) {
    markers += countGraMarkers(s.text).total
    if (PARTICIPIAL_OPENER_RE.test(s.text.trimStart())) markers += 1
  }
  return markers
}

export function estimateLetterBand(
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

  if (hasError(issues, 'gt-word-count')) {
    taCaps.push(5)
    taProblems.push('Under the 150-word minimum — Task Achievement is capped at 5.0.')
  }
  const uncoveredBullets = count(issues, 'gt-bullet-uncovered')
  if (uncoveredBullets >= 1) {
    // An uncovered bullet is an unanswered part of the task, and carries exactly
    // the weight `question-coverage` carries in Task 2.
    taCaps.push(5.5)
    taProblems.push(
      `${uncoveredBullets} bullet point${uncoveredBullets === 1 ? '' : 's'} not answered — capped at 5.5. Every bullet in the task must be covered.`,
    )
  }
  if (count(issues, 'gt-salutation-missing') > 0) {
    ta -= 0.5
    taProblems.push("No greeting (−0.5) — every letter opens 'Dear …,'.")
  }
  if (count(issues, 'gt-signoff-missing') > 0) {
    ta -= 0.5
    taProblems.push('No sign-off (−0.5) — close the letter and add your name.')
  }
  if (count(issues, 'gt-signoff-pairing') > 0) {
    ta -= 0.5
    taProblems.push(
      "Greeting and sign-off do not pair (−0.5) — 'Yours faithfully' goes with 'Dear Sir or Madam', 'Yours sincerely' with a name.",
    )
  }
  if (count(issues, 'gt-purpose-missing') > 0) {
    ta -= 0.5
    taProblems.push("The opening never says why you are writing (−0.5) — 'I am writing to …'.")
  }
  const toneCount = count(issues, 'gt-tone-mismatch')
  if (toneCount >= 2) {
    ta -= 0.5
    taProblems.push(`${toneCount} words sit at the wrong level of formality (−0.5) — hold one register throughout.`)
  }
  if (count(issues, 'gt-salutation-tone') > 0) {
    ta -= 0.5
    taProblems.push('The greeting does not match the reader (−0.5) — match the formality to who you are writing to.')
  }

  const allChecksSatisfied = structure.length > 0 && structure.every((c) => c.satisfied)
  const bulletChecks = structure.filter((c) => c.id.startsWith('gt-bullet-'))
  const allBulletsCovered = bulletChecks.length > 0 && bulletChecks.every((c) => c.satisfied)
  const toneConsistent = toneCount === 0 && count(issues, 'gt-salutation-tone') === 0
  if (isClean(issues, 'TR')) {
    ta += 0.5
    taProblems.push('The task is answered cleanly — no task-achievement faults (+0.5).')
  }
  if (allBulletsCovered && toneConsistent) {
    ta += 0.5
    taProblems.push('Every bullet point is covered and the register never slips (+0.5).')
  }
  if (allChecksSatisfied) {
    ta += 0.5
    taProblems.push('Every structure check is satisfied (+0.5).')
  }

  const taStrengths: string[] = []
  if (allBulletsCovered) taStrengths.push('All the bullet points in the task are addressed.')
  if (structure.find((c) => c.id === 'gt-signoff')?.satisfied) {
    taStrengths.push('Greeting and sign-off match each other.')
  }
  if (structure.find((c) => c.id === 'gt-purpose')?.satisfied) {
    taStrengths.push('The purpose of the letter is stated up front.')
  }
  if (count(issues, 'gt-word-count') === 0) taStrengths.push('Word count in the safe zone.')

  /* --------------------------- Coherence & Cohesion ------------------------- */
  let cc = 7
  const ccCaps: number[] = []
  const ccProblems: string[] = []

  if (hasError(issues, 'paragraphing')) {
    ccCaps.push(5)
    ccProblems.push('The letter is a single block — capped at 5.0. Give each bullet point its own paragraph.')
  }
  if (count(issues, 'linking-underuse') > 0) {
    cc -= 0.5
    ccProblems.push('Too few linking devices (−0.5) — signal contrast, sequence and consequence.')
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
    ccProblems.push('One paragraph is much longer than another (−0.5) — give each bullet similar space.')
  }
  if (count(issues, 'connector-misuse') >= 2) {
    cc -= 0.5
    ccProblems.push('Connectors used with the wrong meaning (−0.5) — check what each one signals.')
  }

  const linkingIssueCount =
    count(issues, 'linking-underuse') + count(issues, 'linking-overuse') + count(issues, 'linking-repetition')
  // A letter has no single correct paragraph count: three bullets can be
  // answered in three paragraphs or folded into two, and either is good.
  const shapeOnTarget = stats.paragraphCount >= 3 && stats.paragraphCount <= 5
  if (isClean(issues, 'CC')) {
    cc += 0.5
    ccProblems.push('Organisation holds together — no coherence faults (+0.5).')
  }
  if (shapeOnTarget) {
    cc += 0.5
    ccProblems.push(`${stats.paragraphCount} paragraphs — a clear letter shape (+0.5).`)
  }
  if (linkingIssueCount === 0 && stats.linkingDeviceCount >= 6) {
    cc += 0.5
    ccProblems.push(`${stats.linkingDeviceCount} linking devices, none overused (+0.5).`)
  }

  const ccStrengths: string[] = []
  if (shapeOnTarget) ccStrengths.push(`Clear ${stats.paragraphCount}-paragraph letter.`)
  if (linkingIssueCount === 0 && stats.linkingDeviceCount > 0) {
    ccStrengths.push(`Linking devices used naturally (${stats.linkingDeviceCount} found).`)
  }
  if (count(issues, 'paragraph-balance') === 0) ccStrengths.push('Paragraphs are evenly developed.')

  /* ------------------------------ Lexical Resource -------------------------- */
  let lr = 7
  const lrProblems: string[] = []
  const ttr = stats.typeTokenRatio

  if (ttr > 0 && ttr < 0.45) {
    lr -= 1
    lrProblems.push(`Low vocabulary variety (TTR ${ttr.toFixed(2)}) (−1.0) — vary your verbs and noun phrases.`)
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
  // The register faults a letter can commit run in BOTH directions, so the
  // count is of `gt-tone-mismatch` alongside the shared register categories —
  // an informal letter written like a legal notice is exactly as wrong as a
  // formal letter full of slang.
  const registerCount = count(issues, 'informal-register') + count(issues, 'contraction') + toneCount
  if (registerCount >= 3) {
    lr -= 0.5
    lrProblems.push(`${registerCount} words sit outside the letter's register (−0.5) — hold one level of formality.`)
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
  if (registerCount === 0) lrStrengths.push('The register never slips.')
  if (collocationCount === 0) lrStrengths.push('No wrong collocations found.')

  /* ---------------------- Grammatical Range & Accuracy ---------------------- */
  let gra = 7
  const graCaps: number[] = []
  const graProblems: string[] = []

  const varietyWarning = hasWarning(issues, 'sentence-variety')
  if (varietyWarning) {
    graCaps.push(6)
    graProblems.push("Few complex structures — capped at 6.0. Add clauses like 'which arrived late', 'although I asked twice'.")
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
