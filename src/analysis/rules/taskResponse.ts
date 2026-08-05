/**
 * rules/taskResponse.ts — Task Response rules: word count (effective, after
 * prompt-echo deduction), prompt-echo highlighting, question coverage,
 * off-topic, overgeneralisation and personal anecdotes.
 * Implements SPEC.md "analysis/rules/taskResponse.ts".
 *
 * Defensive by design: empty text, zero sentences and zero paragraphs all
 * produce an empty issue list without throwing.
 */
import type {
  Issue,
  IssueCategory,
  ParagraphSpan,
  PromptSpec,
  RuleFn,
  Severity,
  Token,
  TokenizedDoc,
} from '../../types'
import { CATEGORY_META } from '../../meta'

/* -------------------------------- word lists -------------------------------- */

/** Compact English function-word list (~120 words) for content-word tests. */
const STOPWORDS: ReadonlySet<string> = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
  'any', 'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below',
  'between', 'both', 'but', 'by', 'can', 'could', 'did', 'do', 'does', 'doing',
  'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has',
  'have', 'having', 'he', 'her', 'here', 'hers', 'him', 'his', 'how', 'i', 'if',
  'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'may', 'me', 'might',
  'more', 'most', 'must', 'my', 'no', 'nor', 'not', 'of', 'off', 'on', 'once',
  'only', 'or', 'other', 'our', 'ours', 'out', 'over', 'own', 'same', 'shall',
  'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their',
  'theirs', 'them', 'then', 'there', 'these', 'they', 'this', 'those',
  'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were',
  'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will',
  'with', 'would', 'you', 'your', 'yours',
])

/** Absolutes that trigger overgeneralisation, as normalised token sequences. */
const ABSOLUTES: ReadonlyArray<readonly string[]> = [
  ['all', 'people'],
  ['everyone'],
  ['everybody'],
  ['no', 'one'],
  ['nobody'],
  ['always'],
  ['never'],
  ['every', 'single'],
  ['without', 'exception'],
  ['undoubtedly'],
  ['obviously'],
  ['certainly'],
  ['definitely'],
  ['it', 'is', 'a', 'fact'],
]

const HEDGE =
  /\b(may|might|could|often|sometimes|usually|generally|tends? to|arguably|in many cases|to some extent|likely|largely|most|many)\b/i

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
  return t.length > 80 ? `${t.slice(0, 77)}…` : t
}

/** Lowercase and strip everything but letters/digits — the comparison form. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Sibilant-aware suffix-strip stem, applied identically to both sides of a
 * comparison so base and inflected forms unify ('cause'/'causes', 'city'/'cities').
 */
function stem(w: string): string {
  if (w.length >= 5 && w.endsWith('ies')) return w.slice(0, -3) + 'y'
  if (w.length >= 5 && /(?:ches|shes|sses|xes|zes)$/.test(w)) return w.slice(0, -2)
  if (w.length >= 4 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) return w.slice(0, -1)
  if (w.length >= 5 && w.endsWith('ed')) return w.slice(0, -2)
  if (w.length >= 6 && w.endsWith('ing')) return w.slice(0, -3)
  if (w.length >= 5 && w.endsWith('ly')) return w.slice(0, -2)
  return w
}

/**
 * Split a raw token on hyphens/apostrophes and normalise each sub-word, so
 * compounds like 'low-income' contribute both 'low' and 'income' to keyword
 * matching. Each sub-word is stemmed separately by the callers.
 */
function subWords(raw: string): string[] {
  return raw
    .split(/[-'’]/)
    .map(norm)
    .filter((t) => t.length > 0)
}

/** Word tokens lying inside a [start, end) char span. */
function wordsIn(doc: TokenizedDoc, start: number, end: number): Token[] {
  return doc.words.filter((w) => w.start >= start && w.end <= end)
}

/**
 * Body paragraphs by the canonical role rule (first = intro, last = conclusion
 * only when >= 3 paragraphs). Empty when the essay has < 2 paragraphs.
 */
function bodyParagraphs(doc: TokenizedDoc): ParagraphSpan[] {
  const n = doc.paragraphs.length
  if (n >= 3) return doc.paragraphs.slice(1, n - 1)
  if (n === 2) return doc.paragraphs.slice(1)
  return []
}

/* ------------------------- prompt-echo run detection ------------------------- */

interface EchoRun {
  /** Index into doc.words of the first word of the run. */
  startWord: number
  /** Exclusive end index into doc.words. */
  endWord: number
}

/**
 * A run must be a lifted CLAUSE, not a shared collocation, before it counts as
 * copying. At 4 words the rule fired on wording no answer can avoid — "when
 * choosing a career", "that job satisfaction is more important" — because
 * every essay on a prompt has to name the prompt's own subject. Eight
 * consecutive verbatim words is the point where the writer is reproducing the
 * question rather than answering it.
 */
const MIN_ECHO_RUN = 8

/**
 * Maximal runs of >= MIN_ECHO_RUN consecutive essay words copied verbatim from
 * the prompt (lowercase, punctuation-stripped comparison), each containing
 * >= 2 content words. Shared by the word-count deduction and the prompt-echo
 * highlights.
 */
function findPromptEchoRuns(doc: TokenizedDoc, prompt: PromptSpec | null): EchoRun[] {
  if (prompt === null || doc.words.length === 0) return []
  const promptTokens = prompt.text
    .toLowerCase()
    .split(/\s+/)
    .map(norm)
    .filter((t) => t.length > 0)
  if (promptTokens.length < MIN_ECHO_RUN) return []

  const positions = new Map<string, number[]>()
  promptTokens.forEach((t, i) => {
    const arr = positions.get(t)
    if (arr) arr.push(i)
    else positions.set(t, [i])
  })

  const essay = doc.words.map((w) => norm(w.lower))
  const runs: EchoRun[] = []
  let i = 0
  while (i < essay.length) {
    const tok = essay[i]
    const starts = tok.length > 0 ? positions.get(tok) : undefined
    if (!starts) {
      i++
      continue
    }
    let best = 0
    for (const p of starts) {
      let len = 0
      while (
        i + len < essay.length &&
        p + len < promptTokens.length &&
        essay[i + len].length > 0 &&
        essay[i + len] === promptTokens[p + len]
      ) {
        len++
      }
      if (len > best) best = len
    }
    if (best >= MIN_ECHO_RUN) {
      const slice = essay.slice(i, i + best)
      const contentWords = slice.filter((t) => t.length > 0 && !STOPWORDS.has(t)).length
      if (contentWords >= 2) {
        runs.push({ startWord: i, endWord: i + best })
      }
      i += best
    } else {
      i++
    }
  }
  return runs
}

/* ---------------------------------- rules ----------------------------------- */

/** Word count against the canonical thresholds, using the effective count. */
function wordCountIssue(doc: TokenizedDoc, copied: number, issues: Issue[]): void {
  const total = doc.wordCount
  if (total < 50) return // the learner has only just started — stay quiet
  const effective = Math.max(0, total - copied)
  const label =
    copied > 0
      ? `${effective} effective words (${total} written minus ${copied} copied from the question)`
      : `${effective} words`
  if (effective < 250) {
    issues.push(
      mk(
        'word-count',
        'error',
        `${label} — Task 2 requires at least 250, and under-length essays are penalised. Add another developed point or example.`,
      ),
    )
  } else if (effective <= 259) {
    issues.push(
      mk(
        'word-count',
        'warning',
        `${label} — dangerously close to the 250 minimum. Write a few more sentences for a safe margin.`,
      ),
    )
  } else if (effective > 340) {
    issues.push(
      mk(
        'word-count',
        'warning',
        `${label} — over-length. Extra words cost checking time and invite errors; aim for 260–330.`,
      ),
    )
  }
}

/** One inline error per copied-run occurrence, matching the word-count deduction. */
function promptEchoIssues(doc: TokenizedDoc, runs: EchoRun[], issues: Issue[]): void {
  for (const run of runs) {
    const start = doc.words[run.startWord].start
    const end = doc.words[run.endWord - 1].end
    issues.push(
      mk(
        'prompt-echo',
        'error',
        'Copied from the question — examiners exclude this from your word count. Paraphrase.',
        start,
        end,
        excerptOf(doc.text.slice(start, end)),
      ),
    )
  }
}

const OTHER_SIDE =
  /\b(on the other hand|others (?:argue|believe)|some people|proponents|opponents|those who|advocates|critics)\b/i
const PROBLEM_LEXIS = /\b(problems?|issues?|causes?|consequences?|leads? to|led to|results? in|resulted in)\b/i
const SOLUTION_LEXIS =
  /\b(solutions?|solves?|solved|solving|tackles?|tackled|tackling|address(?:es|ed|ing)?|measures?|should|introduces?|introduced|introducing|implements?|implemented|implementing|invests?|invested|investing|bans?|banned|banning)\b/i
const VERDICT = /\b(outweigh\w*|greater than|more significant)\b/i

/** Question coverage by prompt type — essay-level errors naming the missing half. */
function questionCoverage(doc: TokenizedDoc, prompt: PromptSpec, issues: Issue[]): void {
  if (doc.wordCount < 150) return
  const bodies = bodyParagraphs(doc)
  // In a one-block essay there are no formal bodies yet — search everything
  // rather than falsely reporting nothing covered.
  const searchParas = bodies.length > 0 ? bodies : doc.paragraphs
  const searchText = searchParas.map((p) => p.text).join('\n')

  switch (prompt.type) {
    case 'discussion': {
      if (!searchParas.some((p) => OTHER_SIDE.test(p.text))) {
        issues.push(
          mk(
            'question-coverage',
            'error',
            "Only one side of the discussion is visible — the question asks for both views. Add a body paragraph for the other side, e.g. 'On the other hand, some people argue …'.",
          ),
        )
      }
      break
    }
    case 'problem-solution': {
      const hasProblem = PROBLEM_LEXIS.test(searchText)
      const hasSolution = SOLUTION_LEXIS.test(searchText)
      if (!hasProblem && !hasSolution) {
        issues.push(
          mk(
            'question-coverage',
            'error',
            'Neither the problems nor the solutions are developed yet — the question asks for both. Give each its own body paragraph.',
          ),
        )
      } else if (!hasProblem) {
        issues.push(
          mk(
            'question-coverage',
            'error',
            'The solutions are there, but the problems are never named — add a body paragraph identifying the problems before you solve them.',
          ),
        )
      } else if (!hasSolution) {
        issues.push(
          mk(
            'question-coverage',
            'error',
            "The problems are described, but no solutions yet — the question asks for both. Add a body proposing measures, e.g. 'governments should introduce …'.",
          ),
        )
      }
      break
    }
    case 'double-question': {
      const missing: string[] = []
      for (const part of prompt.parts) {
        const partStems = new Set(
          part
            .toLowerCase()
            .split(/\s+/)
            .flatMap(subWords)
            .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
            .map(stem),
        )
        if (partStems.size === 0) continue
        const covered = searchParas.some((p) => {
          let hits = 0
          for (const w of wordsIn(doc, p.start, p.end)) {
            for (const t of subWords(w.lower)) {
              if (partStems.has(stem(t))) hits++
              if (hits >= 2) return true
            }
          }
          return false
        })
        if (!covered) missing.push(part)
      }
      if (missing.length > 0) {
        const list = missing.map((m) => `"${m}"`).join(' and ')
        issues.push(
          mk(
            'question-coverage',
            'error',
            `Part of the question is not clearly answered yet: ${list}. Give each question its own body paragraph.`,
          ),
        )
      }
      break
    }
    case 'advantages-disadvantages': {
      if (/outweigh/i.test(prompt.text) && !VERDICT.test(doc.text)) {
        issues.push(
          mk(
            'question-coverage',
            'error',
            "The question asks whether one side outweighs the other, but no verdict is given — state it plainly, e.g. 'the advantages clearly outweigh the drawbacks', in your introduction or conclusion.",
          ),
        )
      }
      break
    }
    case 'opinion':
      break
  }
}

/** Stemmed content-word overlap between body text and prompt keywords. */
function offTopicIssue(doc: TokenizedDoc, prompt: PromptSpec, issues: Issue[]): void {
  if (doc.wordCount < 150 || prompt.keywords.length === 0) return
  const bodies = bodyParagraphs(doc)
  const searchParas = bodies.length > 0 ? bodies : doc.paragraphs
  const bodyStems = new Set<string>()
  for (const p of searchParas) {
    for (const w of wordsIn(doc, p.start, p.end)) {
      for (const t of subWords(w.lower)) {
        if (t.length >= 3 && !STOPWORDS.has(t)) bodyStems.add(stem(t))
      }
    }
  }
  const seen = new Set<string>()
  let hits = 0
  for (const kw of prompt.keywords) {
    const stems = subWords(kw).map(stem)
    const key = stems.join(' ')
    if (key.length === 0 || seen.has(key)) continue
    if (stems.some((s) => bodyStems.has(s))) {
      seen.add(key)
      hits++
    }
  }
  if (hits < 2) {
    issues.push(
      mk(
        'off-topic',
        'warning',
        'Your body paragraphs barely reference the question topic — check you are answering THIS question.',
      ),
    )
  }
}

/** Absolute claim in a sentence's first 6 word tokens with no hedge — inline warning. */
function overgeneralisationIssues(doc: TokenizedDoc, issues: Issue[]): void {
  for (const s of doc.sentences) {
    const toks = wordsIn(doc, s.start, s.end)
    if (toks.length === 0) continue
    const limit = Math.min(6, toks.length)
    let found: { start: number; end: number } | null = null
    outer: for (let p = 0; p < limit; p++) {
      for (const seq of ABSOLUTES) {
        if (p + seq.length > toks.length) continue
        let matches = true
        for (let j = 0; j < seq.length; j++) {
          if (norm(toks[p + j].lower) !== seq[j]) {
            matches = false
            break
          }
        }
        if (matches) {
          found = { start: toks[p].start, end: toks[p + seq.length - 1].end }
          break outer
        }
      }
    }
    if (found === null) continue
    if (HEDGE.test(s.text)) continue
    const term = doc.text.slice(found.start, found.end)
    issues.push(
      mk(
        'overgeneralisation',
        'warning',
        `'${term}' is an absolute claim — one counter-example defeats it. Soften it with 'many', 'often' or 'tends to'.`,
        found.start,
        found.end,
        term,
      ),
    )
  }
}

/* ---------------------- position consistency (Patch v2 C4) ------------------- */

/** Stance-sentence marker, shared shape with structure's stance detection. */
const STANCE_SENTENCE =
  /\b(?:I believe|I agree|I disagree|in my opinion|in my view|my view is|I would argue|I am convinced|this essay (?:will )?argue)/i

/** A stance phrased with no room for exceptions. */
const ABSOLUTE_STANCE =
  /\b(must|only|always|never|the only|no exception|entirely|execute|abolish|ban)\b/i

/** A stance that qualifies, balances or limits itself. */
const HEDGED_STANCE =
  /\b(both|balance|some cases|specific cases|to some extent|a mix|depends|in certain)\b/i

/** First `n` whitespace-separated words of a sentence, for quoting in messages. */
function firstWords(text: string, n = 8): string {
  return text.trim().split(/\s+/).slice(0, n).join(' ')
}

/**
 * C4: the intro stance and the conclusion stance must sit on the same side.
 * Fires only when one stance sentence is cleanly absolute (and not hedged)
 * while the other is cleanly hedged (and not absolute) — a sentence that
 * carries both signals is treated as balanced, never flagged. One warning,
 * anchored to the conclusion's stance sentence.
 */
function positionConsistencyIssue(doc: TokenizedDoc, issues: Issue[]): void {
  if (doc.wordCount < 150) return
  const n = doc.paragraphs.length
  if (n < 3) return // no separate conclusion paragraph to compare against

  const intro = doc.paragraphs[0]
  const conclusion = doc.paragraphs[n - 1]
  const introStance = intro.sentences.find((s) => STANCE_SENTENCE.test(s.text))
  const conclStance = conclusion.sentences.find((s) => STANCE_SENTENCE.test(s.text))
  if (introStance === undefined || conclStance === undefined) return

  // The committed side must be purely absolute; the hedged side counts as
  // hedged even when an absolute word appears alongside ("… is a must for
  // specific cases" IS the flip we're hunting — the hedge is what matters).
  const introCommits = ABSOLUTE_STANCE.test(introStance.text) && !HEDGED_STANCE.test(introStance.text)
  const introHedges = HEDGED_STANCE.test(introStance.text)
  const conclCommits = ABSOLUTE_STANCE.test(conclStance.text) && !HEDGED_STANCE.test(conclStance.text)
  const conclHedges = HEDGED_STANCE.test(conclStance.text)

  let message: string
  if (introCommits && conclHedges) {
    message = `Your introduction says one thing ('${firstWords(introStance.text)}…') but your conclusion hedges ('${firstWords(conclStance.text)}…') — pick one position and hold it.`
  } else if (introHedges && conclCommits) {
    message = `Your conclusion says one thing ('${firstWords(conclStance.text)}…') but your introduction hedges ('${firstWords(introStance.text)}…') — pick one position and hold it.`
  } else {
    return
  }

  issues.push(
    mk(
      'position-consistency',
      'warning',
      message,
      conclStance.start,
      conclStance.end,
      excerptOf(conclStance.text),
    ),
  )
}

/** Personal anecdotes: 1 hit = info, 2+ = warning, each highlighted inline. */
function personalAnecdoteIssues(doc: TokenizedDoc, issues: Issue[]): void {
  const re =
    /\bmy (?:friend|cousin|uncle|aunt|brother|sister|mother|father|neighbour|colleague|classmate)\b|\bin my experience\b|\bfor (?:example|instance), I\b|\bwhen I was\b|\bI once\b/gi
  const matches = [...doc.text.matchAll(re)]
  if (matches.length === 0) return
  const severity: Severity = matches.length >= 2 ? 'warning' : 'info'
  for (const m of matches) {
    const start = m.index ?? 0
    const end = start + m[0].length
    issues.push(
      mk(
        'personal-anecdote',
        severity,
        "Personal stories carry little weight in Task 2 — replace this with a general example or a typical case ('many working parents …').",
        start,
        end,
        m[0],
      ),
    )
  }
}

/* --------------------------------- exports ---------------------------------- */

export const taskResponseRules: RuleFn = (doc, prompt) => {
  const issues: Issue[] = []
  const runs = findPromptEchoRuns(doc, prompt)
  const copied = runs.reduce((sum, r) => sum + (r.endWord - r.startWord), 0)

  wordCountIssue(doc, copied, issues)
  promptEchoIssues(doc, runs, issues)
  if (prompt !== null) {
    questionCoverage(doc, prompt, issues)
    offTopicIssue(doc, prompt, issues)
  }
  positionConsistencyIssue(doc, issues)
  overgeneralisationIssues(doc, issues)
  personalAnecdoteIssues(doc, issues)

  return issues
}
