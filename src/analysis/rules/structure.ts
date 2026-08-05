/**
 * rules/structure.ts — paragraph role assignment, the Structure Rail checks
 * and structural issues. Implements SPEC.md "analysis/rules/structure.ts".
 *
 * Defensive by design: an empty essay yields no paragraphs, a stable set of
 * unsatisfied ("hollow") checks and no issues — nothing here divides or
 * indexes into an empty array.
 */
import type {
  Issue,
  IssueCategory,
  ParagraphInfo,
  ParagraphRole,
  ParagraphSpan,
  PromptSpec,
  QuestionType,
  Severity,
  StructureCheck,
  TokenizedDoc,
} from '../../types'
import { CATEGORY_META, QUESTION_TYPE_META } from '../../meta'

/* -------------------------------- word lists -------------------------------- */

/** Stance markers (SPEC verbatim). Any hit in intro or conclusion = position stated. */
const STANCE_REGEXES: readonly RegExp[] = [
  /\bI (strongly |firmly |partly |largely )?(agree|disagree|believe|think|argue|contend|maintain)\b/i,
  /\bin my (opinion|view)\b/i,
  /\bmy view is\b/i,
  /\bI am (convinced|of the opinion)\b/i,
  /\bthis essay (will )?(argues?|agrees?|disagrees?)\b/i,
  /\b(advantages|benefits|drawbacks|disadvantages) (clearly |far )?outweigh\b/i,
  /\bit seems to me\b/i,
]

const CONCLUSION_SIGNAL = /^\s*(in conclusion|to conclude|to sum up|in summary|overall|on balance)\b/i

/**
 * Example markers (Patch v2 C1) — the full list, shared by the body-support
 * checks, the topic-sentence "example-first" test and the intro/conclusion
 * example warnings. Order puts longer phrases first so alternation can never
 * shadow them.
 */
const EXAMPLE_MARKERS: readonly string[] = [
  'a clear example of this is',
  'one illustration of this is',
  'to take one example',
  'consider the case of',
  'this can be seen in',
  'take the case of',
  'a case in point is',
  'for example',
  'for instance',
  'such as',
]
const EXAMPLE_ANYWHERE = new RegExp(`\\b(${EXAMPLE_MARKERS.join('|')})\\b`, 'i')
const EXAMPLE_AT_START = new RegExp(`^\\s*(${EXAMPLE_MARKERS.join('|')})\\b`, 'i')
const FIGURE = /\d|%|\bpercent\b/i

/**
 * Complexity markers (Patch v2 C5): subordinators and relative pronouns that
 * signal a complex sentence. 'that' is deliberately excluded — it is too
 * ambiguous (demonstrative, complementiser) to count reliably.
 */
const COMPLEXITY_MARKER =
  /\b(?:although|even though|though|whereas|while|unless|if|because|since|when|after|before|which|whose|who)\b/gi
const MODAL_OBLIGATION = /\b(should|must|ought to|need to|have to)\b/i
const EVALUATIVE_ADVERB = /\b(clearly|certainly|undoubtedly|obviously|surely|definitely|unquestionably|arguably)\b/i

/** Question types that require an explicit position. */
const OPINION_FAMILY: readonly QuestionType[] = ['opinion', 'advantages-disadvantages', 'discussion']

/**
 * Paragraphing gates (SPEC.md canonical constants).
 *
 * Paragraph shape is a judgement about the essay, not about the sentence being
 * typed. A learner mid-introduction legitimately has ONE paragraph, so firing
 * the "single block" error at 40 words is noise, not feedback — the writer has
 * not yet had the chance to press Enter.
 *
 * - `PARAGRAPHING_MIN_WORDS` — below this, say nothing about block shape at
 *   all. 100 words is past the 30–60-word intro norm, so by then a second
 *   paragraph should exist and its absence is real.
 * - `FULL_SHAPE_MIN_WORDS` — the "4–5 paragraphs is the standard shape" nudge
 *   only makes sense once the essay is near full length; at 120 words
 *   intro + body 1 is exactly right and must not be flagged.
 */
const PARAGRAPHING_MIN_WORDS = 100
const FULL_SHAPE_MIN_WORDS = 200

/* ------------------------------ small helpers ------------------------------- */

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

function excerptOf(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ')
  return t.length > 60 ? `${t.slice(0, 57)}…` : t
}

/** Number of complexity markers in a stretch of text (Patch v2 C5). */
function complexityCount(text: string): number {
  return (text.match(COMPLEXITY_MARKER) ?? []).length
}

/** Learner-facing paragraph names by role: 'the introduction', 'Body 1', … */
function paragraphNames(infos: ParagraphInfo[]): string[] {
  let bodyNumber = 0
  return infos.map((info) => {
    if (info.role === 'introduction') return 'the introduction'
    if (info.role === 'conclusion') return 'the conclusion'
    bodyNumber += 1
    return `Body ${bodyNumber}`
  })
}

/** "A", "A or B", "A, B or C" — for naming paragraphs in check details. */
function orJoin(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`
}

type TopicProblem =
  | { kind: 'example-first' }
  | { kind: 'dangling'; word: string }
  | { kind: 'question' }
  | { kind: 'overlong'; words: number }

/** Why a body paragraph's first sentence fails as a topic sentence, or null if it passes. */
function topicProblem(p: ParagraphSpan): TopicProblem | null {
  const first = p.sentences.length > 0 ? p.sentences[0] : undefined
  if (!first) return null
  if (EXAMPLE_AT_START.test(first.text)) return { kind: 'example-first' }
  const firstWord = /[A-Za-z']+/.exec(first.text)?.[0] ?? ''
  const lower = firstWord.toLowerCase()
  if (lower === 'this' || lower === 'it' || lower === 'they') return { kind: 'dangling', word: firstWord }
  if (/\?\s*$/.test(first.text)) return { kind: 'question' }
  if (first.wordCount > 35) return { kind: 'overlong', words: first.wordCount }
  return null
}

/* ------------------------------ paragraph roles ----------------------------- */

/**
 * First paragraph = introduction; last = conclusion only once >= 3 paragraphs
 * exist. While the essay is shorter, the last paragraph stays a body
 * ("in progress") and the conclusion check reports that state instead.
 */
function assignRoles(doc: TokenizedDoc): ParagraphInfo[] {
  const n = doc.paragraphs.length
  return doc.paragraphs.map((p, i) => {
    const role: ParagraphRole =
      i === 0 ? 'introduction' : n >= 3 && i === n - 1 ? 'conclusion' : 'body'
    const info: ParagraphInfo = {
      index: i,
      start: p.start,
      end: p.end,
      role,
      wordCount: p.wordCount,
      sentenceCount: p.sentences.length,
    }
    if (role === 'body') {
      info.hasTopicSentence = p.sentences.length > 0 && topicProblem(p) === null
    }
    return info
  })
}

/** Where a stance marker was found, if anywhere the examiner would look. */
function stanceLocation(doc: TokenizedDoc): 'introduction' | 'conclusion' | null {
  const n = doc.paragraphs.length
  if (n === 0) return null
  if (STANCE_REGEXES.some((r) => r.test(doc.paragraphs[0].text))) return 'introduction'
  if (n >= 3 && STANCE_REGEXES.some((r) => r.test(doc.paragraphs[n - 1].text))) return 'conclusion'
  return null
}

/* --------------------------------- checks ----------------------------------- */

function positionLabel(prompt: PromptSpec | null): string {
  if (prompt === null) return 'Position stated'
  switch (prompt.type) {
    case 'opinion':
      return QUESTION_TYPE_META.opinion.mustAddress[0] ?? 'Position stated'
    case 'discussion':
      return QUESTION_TYPE_META.discussion.mustAddress[2] ?? 'Position stated'
    case 'advantages-disadvantages':
      return QUESTION_TYPE_META['advantages-disadvantages'].mustAddress[2] ?? 'Position stated'
    default:
      return 'Position stated'
  }
}

function positionHint(prompt: PromptSpec | null): string {
  const type = prompt?.type
  if (type === 'discussion') {
    return "Both views also need your own view — add 'In my opinion …' to the introduction or conclusion."
  }
  if (type === 'advantages-disadvantages') {
    return "No verdict yet — say which side is stronger, e.g. 'the advantages clearly outweigh the drawbacks'."
  }
  return "No position yet — state your view in one sentence, e.g. 'I firmly believe …', in the introduction."
}

function topicCheckDetail(k: number, problem: TopicProblem): string {
  switch (problem.kind) {
    case 'example-first':
      return `Body ${k} opens with an example — state the main idea first, then illustrate it.`
    case 'dangling':
      return `Body ${k} opens with '${problem.word}' — start with the paragraph's own idea instead.`
    case 'question':
      return `Body ${k} opens with a question — turn it into a statement of your point.`
    case 'overlong':
      return `Body ${k}'s opening sentence is ${problem.words} words — state the idea in one short sentence.`
  }
}

/**
 * Stable check list: intro, position (opinion-family or unknown prompt),
 * body-count, then topic+support per body slot (always 2 slots, 3 when a third
 * body exists), then conclusion. All present from the first keystroke so the
 * Structure Rail never jumps around.
 */
function buildChecks(doc: TokenizedDoc, infos: ParagraphInfo[], prompt: PromptSpec | null): StructureCheck[] {
  const checks: StructureCheck[] = []
  const n = doc.paragraphs.length
  const intro = n > 0 ? doc.paragraphs[0] : undefined
  const bodies = doc.paragraphs.filter((_, i) => infos[i].role === 'body')

  // intro-present
  let introDetail: string
  if (!intro || intro.wordCount === 0) {
    introDetail = 'Not started — open with two or three sentences introducing the topic and your angle on it.'
  } else if (intro.wordCount < 30) {
    introDetail = `Introduction: ${intro.wordCount} words — under the 30-word norm. Add a line of background or your position.`
  } else if (intro.wordCount > 60) {
    introDetail = `Introduction: ${intro.wordCount} words — over the 60-word norm; it counts, but consider trimming.`
  } else {
    introDetail = `Introduction: ${intro.wordCount} words — within the 30–60 word norm.`
  }
  if (intro && intro.wordCount > 0 && intro.sentences.length > 3) {
    introDetail += ` ${intro.sentences.length} sentences — three is the shape: topic, the two views, your opinion.`
  }
  checks.push({
    id: 'intro-present',
    label: 'Introduction',
    satisfied: intro !== undefined && intro.wordCount >= 30,
    detail: introDetail,
  })

  // position-stated — opinion-family prompts, plus unknown (null) prompts since
  // most Task 2 questions need a position.
  if (prompt === null || OPINION_FAMILY.includes(prompt.type)) {
    const where = stanceLocation(doc)
    checks.push({
      id: 'position-stated',
      label: positionLabel(prompt),
      satisfied: where !== null,
      detail: where !== null ? `Position found in the ${where}.` : positionHint(prompt),
    })
  }

  // body-count
  const bc = bodies.length
  const firstThin = bodies.findIndex((b) => b.wordCount < 60)
  const thinNote =
    firstThin >= 0 && bc <= 3
      ? ` Body ${firstThin + 1}: ${bodies[firstThin].wordCount} words — under the 60-word minimum.`
      : ''
  let bcDetail: string
  if (bc === 0) bcDetail = 'No body paragraphs yet — plan two or three, one idea each.'
  else if (bc === 1) bcDetail = `1 body paragraph so far — add a second developed point.${thinNote}`
  else if (bc <= 3) bcDetail = `${bc} body paragraphs — on target.${thinNote}`
  else bcDetail = `${bc} body paragraphs — merge related points into 2–3 developed ones.`
  checks.push({
    id: 'body-count',
    label: '2–3 body paragraphs',
    satisfied: bc >= 2 && bc <= 3,
    detail: bcDetail,
  })

  // per-body topic + support slots
  const slots = Math.min(3, Math.max(2, bc))
  for (let k = 1; k <= slots; k++) {
    const body = k <= bc ? bodies[k - 1] : undefined

    let topicSatisfied = false
    let topicDetail: string
    if (!body) {
      topicDetail = `Body ${k}: not written yet.`
    } else if (body.sentences.length === 0) {
      topicDetail = `Body ${k}: just started — open with its main idea in one sentence.`
    } else {
      const problem = topicProblem(body)
      if (problem === null) {
        topicSatisfied = true
        topicDetail = `Body ${k} opens with a clear topic sentence.`
      } else {
        topicDetail = topicCheckDetail(k, problem)
      }
    }
    checks.push({
      id: `body-${k}-topic`,
      label: `Body ${k}: topic sentence`,
      satisfied: topicSatisfied,
      detail: topicDetail,
    })

    let supportSatisfied = false
    let supportDetail: string
    if (!body) {
      supportDetail = `Body ${k}: not written yet.`
    } else {
      const marker = EXAMPLE_ANYWHERE.exec(body.text)
      if (marker) {
        supportSatisfied = true
        supportDetail = `Body ${k}: example signalled ('${marker[1].toLowerCase()}').`
      } else if (FIGURE.test(body.text)) {
        supportSatisfied = true
        supportDetail = `Body ${k}: figures used as evidence.`
      } else {
        supportDetail = `Body ${k}: no example or figure yet — add 'for example …' or a statistic.`
      }
    }
    checks.push({
      id: `body-${k}-support`,
      label: `Body ${k}: example or evidence`,
      satisfied: supportSatisfied,
      detail: supportDetail,
    })
  }

  // conclusion-present
  let conclSatisfied = false
  let conclDetail: string
  if (n === 0) {
    conclDetail = 'Not started.'
  } else if (n < 3) {
    conclDetail = "In progress — finish the body paragraphs, then close with 'In conclusion …'."
  } else {
    const last = doc.paragraphs[n - 1]
    const m = CONCLUSION_SIGNAL.exec(last.text)
    if (m) {
      conclSatisfied = true
      const normNote = last.wordCount < 25 || last.wordCount > 60 ? ' — outside the 25–60 word norm' : ''
      conclDetail = `Conclusion: ${last.wordCount} words, opens with '${m[1]}'${normNote}.`
    } else {
      conclDetail = "Final paragraph has no conclusion signal — begin it 'In conclusion' or 'Overall'."
    }
  }
  checks.push({
    id: 'conclusion-present',
    label: 'Conclusion',
    satisfied: conclSatisfied,
    detail: conclDetail,
  })

  // complex-count (Patch v2 C5) — subordinate/relative clauses, target 4 with
  // at least one in every paragraph. Always last so the rail order is stable.
  const perParagraph = doc.paragraphs.map((p) => complexityCount(p.text))
  const complexTotal = perParagraph.reduce((sum, c) => sum + c, 0)
  const names = paragraphNames(infos)
  const zeroNames = names.filter((_, i) => perParagraph[i] === 0)
  let complexDetail: string
  if (n === 0) {
    complexDetail =
      "Not started — complex sentences ('although …', 'because …', 'which …') show grammatical range; aim for one per paragraph."
  } else if (zeroNames.length > 0) {
    complexDetail = `${complexTotal} of 4 target — none in ${orJoin(zeroNames)}.`
  } else if (complexTotal < 4) {
    complexDetail = `${complexTotal} of 4 target — add another subordinate clause ('although …', 'because …', 'which …').`
  } else {
    complexDetail = `${complexTotal} complex sentences — at least one in every paragraph.`
  }
  checks.push({
    id: 'complex-count',
    label: 'Complex sentences',
    satisfied: complexTotal >= 4 && n > 0 && zeroNames.length === 0,
    detail: complexDetail,
  })

  return checks
}

/* --------------------------------- issues ----------------------------------- */

function topicIssueMessage(problem: TopicProblem): string {
  switch (problem.kind) {
    case 'example-first':
      return 'This paragraph opens with an example — start with the point the example proves, then illustrate it.'
    case 'dangling':
      return `Opening with '${problem.word}' leans on the previous paragraph — open with this paragraph's own main idea so it stands alone.`
    case 'question':
      return 'This body paragraph opens with a question — examiners look for a stated idea. Rewrite it as a statement.'
    case 'overlong':
      return `A ${problem.words}-word opening sentence buries the main idea — state the paragraph's point in one short sentence first.`
  }
}

function buildIssues(doc: TokenizedDoc, infos: ParagraphInfo[], prompt: PromptSpec | null): Issue[] {
  const issues: Issue[] = []
  const n = doc.paragraphs.length

  const bodies: Array<{ span: ParagraphSpan; bodyNumber: number; paragraphIndex: number }> = []
  doc.paragraphs.forEach((p, i) => {
    if (infos[i].role === 'body') {
      bodies.push({ span: p, bodyNumber: bodies.length + 1, paragraphIndex: i })
    }
  })

  // paragraphing: 1 block = error, 2–3 or 6+ = warning, 4–5 = good.
  // Gated on length: an essay too short to have needed a paragraph break yet
  // cannot be failing at paragraphing (see PARAGRAPHING_MIN_WORDS).
  const paragraphingOpen = doc.wordCount >= PARAGRAPHING_MIN_WORDS
  if (n === 1 && paragraphingOpen) {
    issues.push(
      mk(
        'paragraphing',
        'error',
        'The essay is a single block — examiners cannot see any organisation, which caps Coherence near Band 5. Break it into an introduction, 2–3 body paragraphs and a conclusion.',
      ),
    )
  } else if ((n === 2 || n === 3) && doc.wordCount >= FULL_SHAPE_MIN_WORDS) {
    issues.push(
      mk(
        'paragraphing',
        'warning',
        `${n} paragraphs so far — the standard Task 2 shape is 4–5: introduction, 2–3 bodies, conclusion. Add or split paragraphs as you go.`,
      ),
    )
  } else if (n >= 6 && paragraphingOpen) {
    issues.push(
      mk(
        'paragraphing',
        'warning',
        `${n} paragraphs — many short paragraphs fragment the argument. Merge related ideas into 2–3 developed bodies.`,
      ),
    )
  }

  // Body length norms (60–120; error < 40, warning < 50 or > 140).
  // The essay's final paragraph is exempt — it is still being written.
  for (const b of bodies) {
    if (b.paragraphIndex === n - 1) continue
    const wc = b.span.wordCount
    if (wc < 40) {
      issues.push(
        mk(
          'paragraph-balance',
          'error',
          `Body ${b.bodyNumber} is only ${wc} words — too thin to count as a developed point. Grow it to 60+ words with an explanation and an example.`,
        ),
      )
    } else if (wc < 50) {
      issues.push(
        mk(
          'paragraph-balance',
          'warning',
          `Body ${b.bodyNumber} is ${wc} words — a little thin. Add an explanation or example to reach the 60-word norm.`,
        ),
      )
    } else if (wc > 140) {
      issues.push(
        mk(
          'paragraph-balance',
          'warning',
          `Body ${b.bodyNumber} is ${wc} words — paragraphs over 140 words usually hold two ideas. Split it.`,
        ),
      )
    }
  }

  // Two bodies differing by more than 2:1
  if (bodies.length >= 2) {
    let minB = bodies[0]
    let maxB = bodies[0]
    for (const b of bodies) {
      if (b.span.wordCount < minB.span.wordCount) minB = b
      if (b.span.wordCount > maxB.span.wordCount) maxB = b
    }
    if (maxB.span.wordCount > 2 * minB.span.wordCount) {
      issues.push(
        mk(
          'paragraph-balance',
          'warning',
          `Body ${maxB.bodyNumber} (${maxB.span.wordCount} words) is more than twice the length of Body ${minB.bodyNumber} (${minB.span.wordCount}) — develop the short one or move a point across.`,
        ),
      )
    }
  }

  // no-conclusion: essay >= 200 words, >= 3 paragraphs, final paragraph has no
  // signal and is > 100 words (i.e. it reads as another body)
  if (doc.wordCount >= 200 && n >= 3) {
    const last = doc.paragraphs[n - 1]
    if (!CONCLUSION_SIGNAL.test(last.text) && last.wordCount > 100) {
      issues.push(
        mk(
          'no-conclusion',
          'error',
          `The final paragraph (${last.wordCount} words) reads as another body paragraph — the essay has no conclusion. Close with a short paragraph beginning 'In conclusion …' restating your position.`,
        ),
      )
    }
  }

  // intro-shape (Patch v2 C2). Guard: only once a second paragraph exists —
  // while the essay is a single block the first paragraph is not yet an
  // introduction distinct from the rest (paragraphing already flags that).
  if (n >= 2) {
    const intro = doc.paragraphs[0]
    if (intro.sentences.length > 3) {
      issues.push(
        mk(
          'intro-shape',
          'warning',
          `Your introduction is ${intro.sentences.length} sentences — three is the shape: topic in your words, the two views, your opinion.`,
        ),
      )
    }
    const introMarker = EXAMPLE_ANYWHERE.exec(intro.text)
    if (introMarker) {
      issues.push(
        mk(
          'intro-shape',
          'warning',
          'Examples belong in the body, not the introduction.',
          intro.start + introMarker.index,
          intro.start + introMarker.index + introMarker[0].length,
          excerptOf(introMarker[0]),
        ),
      )
    }
  }

  // conclusion-shape (Patch v2 C3). Guard: only when the final paragraph is a
  // conclusion (>= 3 paragraphs) AND it signals itself as one — an unsignalled
  // final paragraph may still be a body in progress.
  if (n >= 3) {
    const last = doc.paragraphs[n - 1]
    if (CONCLUSION_SIGNAL.test(last.text)) {
      const sc = last.sentences.length
      if (sc === 1) {
        issues.push(
          mk(
            'conclusion-shape',
            'warning',
            'Your conclusion is a single sentence — add one sentence saying why your position matters.',
          ),
        )
      } else if (sc >= 3) {
        issues.push(
          mk(
            'conclusion-shape',
            'warning',
            `Your conclusion is ${sc} sentences — cut to two sentences: your opinion, then why it matters.`,
          ),
        )
      }
      const conclMarker = EXAMPLE_ANYWHERE.exec(last.text)
      if (conclMarker) {
        issues.push(
          mk(
            'conclusion-shape',
            'warning',
            'No new examples in the conclusion.',
            last.start + conclMarker.index,
            last.start + conclMarker.index + conclMarker[0].length,
            excerptOf(conclMarker[0]),
          ),
        )
      }
    }
  }

  // topic-sentence (info, inline on the body's first sentence)
  for (const b of bodies) {
    const first = b.span.sentences.length > 0 ? b.span.sentences[0] : undefined
    if (!first) continue
    const problem = topicProblem(b.span)
    if (problem === null) continue
    issues.push(mk('topic-sentence', 'info', topicIssueMessage(problem), first.start, first.end, excerptOf(first.text)))
  }

  // no-position: opinion-family prompts, once the essay is substantial
  if (prompt !== null && OPINION_FAMILY.includes(prompt.type) && doc.wordCount >= 150 && n > 0) {
    if (stanceLocation(doc) === null) {
      const searchText = `${doc.paragraphs[0].text}\n${n >= 3 ? doc.paragraphs[n - 1].text : ''}`
      if (MODAL_OBLIGATION.test(searchText) && EVALUATIVE_ADVERB.test(searchText)) {
        issues.push(
          mk(
            'no-position',
            'info',
            "Your position is only implied through words like 'should' and 'clearly' — make it explicit: 'I believe …' in the introduction or conclusion.",
          ),
        )
      } else {
        issues.push(
          mk(
            'no-position',
            'error',
            "No clear position in the introduction or conclusion — this question asks for your view. State it in one sentence ('I firmly believe …') and keep it consistent.",
          ),
        )
      }
    }
  }

  return issues
}

/* --------------------------------- exports ---------------------------------- */

export function buildStructure(
  doc: TokenizedDoc,
  prompt: PromptSpec | null,
): { paragraphs: ParagraphInfo[]; checks: StructureCheck[]; issues: Issue[] } {
  const paragraphs = assignRoles(doc)
  return {
    paragraphs,
    checks: buildChecks(doc, paragraphs, prompt),
    issues: buildIssues(doc, paragraphs, prompt),
  }
}
