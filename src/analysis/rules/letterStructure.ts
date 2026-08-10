/**
 * Paragraph roles, Structure Rail checks and structural issues for General
 * Training Writing Task 1 — the letter.
 * Implements SPEC.md "General Training Task 1 (letters)".
 *
 * The letter shape is greeting · purpose · one paragraph per bullet point ·
 * close · sign-off. **There is no conclusion** — the sign-off is a closing
 * formula, not a paragraph that sums up an argument, and calling it one would
 * put a Conclusion group in the rail that no letter can ever tick.
 * `ParagraphRole` is unchanged, so paragraph 0 is the `introduction` (greeting
 * plus purpose) and everything after it is a `body`; `'conclusion'` is never
 * assigned here.
 *
 * Defensive by design, mirroring `rules/structure.ts` and `rules/task1Structure.ts`:
 * an empty answer yields no paragraphs, a STABLE set of unsatisfied checks and
 * no issues, so the rail never jumps around as the learner types.
 */
import type {
  Issue,
  IssueCategory,
  LetterPromptSpec,
  ParagraphInfo,
  ParagraphRole,
  Severity,
  StructureCheck,
  TokenizedDoc,
} from '../../types'
import { CATEGORY_META } from '../../meta'
import { countRailMarkers } from '../complexity'
import {
  bulletCoverage,
  hasPurposeStatement,
  readLetterParts,
  signoffCorrectlyPaired,
} from './letterAchievement'

/* -------------------------------- constants --------------------------------- */

/**
 * Complex-sentence target, reused verbatim from Task 2 and Academic Task 1
 * (SPEC.md Patch v2 C5).
 *
 * Unlike Academic Task 1 this check does NOT additionally demand one marker per
 * paragraph. A letter's closing paragraph is legitimately a single short request
 * ("I look forward to hearing from you"), and requiring a subordinate clause
 * there would leave the check permanently unsatisfiable for a correctly shaped
 * letter.
 */
const COMPLEX_TARGET = 4

/**
 * Paragraph balance is judged against the whole letter, never a paragraph in
 * progress — the same reasoning as SPEC.md's paragraphing gates.
 */
const BALANCE_GATE_WORDS = 150

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

/* ------------------------------ paragraph roles ------------------------------ */

/**
 * Paragraph 0 is the greeting plus the purpose statement (`introduction`);
 * everything else is a `body`. A letter has no conclusion, so that role is never
 * assigned — asserted directly in `tests/letters.test.ts`.
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

function buildChecks(doc: TokenizedDoc, prompt: LetterPromptSpec): StructureCheck[] {
  const checks: StructureCheck[] = []
  const started = doc.wordCount > 0
  const parts = readLetterParts(doc)

  /* gt-salutation — the greeting, and whether it suits the reader */
  const salutation = parts.salutation
  const salutationToneOk = salutation !== null && salutation.form.tones.includes(prompt.tone)
  let salutationDetail: string
  if (!started) {
    salutationDetail = `Not started — open with a greeting to ${prompt.recipient}.`
  } else if (!salutation) {
    salutationDetail = "No greeting found on the first line — start with 'Dear …,'."
  } else if (!salutationToneOk) {
    salutationDetail = `'${salutation.form.label}' is the wrong level of formality for a ${prompt.tone} letter.`
  } else {
    salutationDetail = `Greeting written: ${salutation.text}`
  }
  checks.push({
    id: 'gt-salutation',
    label: 'Greeting',
    satisfied: salutationToneOk,
    detail: salutationDetail,
  })

  /* gt-purpose — why the letter is being written, stated up front */
  const purposeFound = started && hasPurposeStatement(parts)
  checks.push({
    id: 'gt-purpose',
    label: 'Purpose stated',
    satisfied: purposeFound,
    detail: !started
      ? "Not started — the opening should say why you are writing: 'I am writing to …'."
      : purposeFound
        ? 'The opening says why you are writing.'
        : "Not yet — say why you are writing in the first paragraph: 'I am writing to …'.",
  })

  /* gt-bullet-N — one node per bullet the task supplies */
  const covered = bulletCoverage(parts, prompt)
  prompt.bullets.forEach((bullet, i) => {
    const done = started && covered[i] === true
    checks.push({
      id: `gt-bullet-${i + 1}`,
      label: `Bullet ${i + 1} covered`,
      satisfied: done,
      detail: done
        ? `Covered: "${bullet}"`
        : !started
          ? `Not started — "${bullet}"`
          : `Not yet — "${bullet}". Give it a sentence or two of its own.`,
    })
  })

  /* gt-signoff — present AND correctly paired with the greeting */
  const signoff = parts.signoff
  const paired = signoffCorrectlyPaired(parts)
  let signoffDetail: string
  if (!started) {
    signoffDetail = "Not started — letters close with 'Yours faithfully', 'Yours sincerely' or 'Best wishes'."
  } else if (!signoff) {
    signoffDetail = 'No sign-off yet — close the letter and write your name underneath.'
  } else if (!salutation) {
    // The pairing is unknowable without both halves, so the check says what is
    // missing rather than implying the sign-off itself is wrong.
    signoffDetail = `'${signoff.form.label}' is written, but there is no greeting to pair it with.`
  } else if (!paired) {
    signoffDetail = `'${signoff.form.label}' does not pair with '${salutation.form.label}' — see the note in the feedback panel.`
  } else {
    signoffDetail = `Signed off '${signoff.form.label}', which matches your greeting.`
  }
  checks.push({
    id: 'gt-signoff',
    label: 'Sign-off',
    satisfied: paired,
    detail: signoffDetail,
  })

  /* complex-count — reused verbatim from Task 2 (SPEC.md Patch v2 C5) */
  const complexTotal = doc.paragraphs.reduce((sum, p) => sum + countRailMarkers(p.text), 0)
  checks.push({
    id: 'complex-count',
    label: 'Complex sentences',
    satisfied: complexTotal >= COMPLEX_TARGET,
    detail: !started
      ? "Not started — complex sentences ('although …', 'because …', 'which …') show grammatical range; aim for four."
      : complexTotal >= COMPLEX_TARGET
        ? `${complexTotal} complex sentences — comfortably past the target of ${COMPLEX_TARGET}.`
        : `${complexTotal} of ${COMPLEX_TARGET} target — add another subordinate clause ('although …', 'which …').`,
  })

  return checks
}

/* --------------------------------- issues ----------------------------------- */

/**
 * The only structural issue letters raise is the REUSED `paragraph-balance`.
 * There is no letter-specific shape category, because a letter has no single
 * correct paragraph count: three bullets can be answered in three paragraphs or
 * folded into two, and both are good letters.
 *
 * The paragraphs compared are those carrying neither the greeting nor the
 * sign-off. The tokenizer merges any fragment under five words into its
 * neighbour, so "Dear Anna," lands inside the first paragraph and "Best
 * wishes," plus the signature land inside the last. Measuring a 60-word middle
 * paragraph against a closing line plus a two-word name would flag the correct
 * letter shape as unbalanced.
 */
function buildIssues(doc: TokenizedDoc): Issue[] {
  const issues: Issue[] = []
  if (doc.wordCount < BALANCE_GATE_WORDS || doc.paragraphs.length === 0) return issues

  const parts = readLetterParts(doc)
  const middle = doc.paragraphs.filter((p) => {
    if (parts.salutation && parts.salutation.start >= p.start && parts.salutation.start < p.end) return false
    if (parts.signoff && parts.signoff.start >= p.start && parts.signoff.start < p.end) return false
    return true
  })
  if (middle.length < 2) return issues

  const sorted = [...middle].sort((a, b) => a.wordCount - b.wordCount)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  if (min.wordCount > 0 && max.wordCount > 2 * min.wordCount) {
    issues.push(
      mk(
        'paragraph-balance',
        'warning',
        `One paragraph (${max.wordCount} words) is more than twice the length of another (${min.wordCount}) — give each bullet point a similar amount of space.`,
      ),
    )
  }

  return issues
}

/* --------------------------------- exports ---------------------------------- */

export function buildLetterStructure(
  doc: TokenizedDoc,
  prompt: LetterPromptSpec,
): { paragraphs: ParagraphInfo[]; checks: StructureCheck[]; issues: Issue[] } {
  return {
    paragraphs: assignRoles(doc),
    checks: buildChecks(doc, prompt),
    issues: buildIssues(doc),
  }
}
