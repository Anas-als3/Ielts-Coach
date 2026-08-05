/**
 * Cohesion rules: linking-device detection plus the three CC linker rules
 * (`linking-overuse`, `linking-underuse`, `linking-repetition`) from SPEC.md.
 *
 * A single precompiled longest-first alternation regex finds every linking
 * device; because alternatives are sorted longest-first and global matching
 * resumes after each match, overlapping phrases ("in spite of" vs "while",
 * "despite this" vs "despite") are never double-counted.
 */

import type { Issue, PromptSpec, RuleFn, TokenizedDoc } from '../../types'

type LinkFunction =
  | 'addition'
  | 'contrast'
  | 'cause'
  | 'example'
  | 'sequence'
  | 'concession'
  | 'conclusion'

/** ~90 linking devices, canonical lowercase, tagged by discourse function. */
const LEXICON: Record<LinkFunction, string[]> = {
  addition: [
    'furthermore',
    'moreover',
    'in addition',
    'additionally',
    'what is more',
    'besides',
    'also',
    'as well as',
    'similarly',
    'likewise',
    'equally',
    'on top of that',
    'coupled with',
    'not only that',
  ],
  contrast: [
    'however',
    'nevertheless',
    'nonetheless',
    'on the other hand',
    'on the one hand',
    'in contrast',
    'conversely',
    'whereas',
    'while',
    'although',
    'despite',
    'in spite of',
    'by contrast',
    'even though',
    'though',
    'on the contrary',
    'alternatively',
    'instead',
  ],
  cause: [
    'therefore',
    'thus',
    'hence',
    'consequently',
    'as a result',
    'as a consequence',
    'for this reason',
    'owing to',
    'due to',
    'because of',
    'accordingly',
    'thereby',
    'as such',
  ],
  example: [
    'for example',
    'for instance',
    'such as',
    'to illustrate',
    'namely',
    'a case in point',
    'in particular',
    'particularly',
    'specifically',
    'as an illustration',
    'notably',
    'to give an example',
  ],
  sequence: [
    'firstly',
    'secondly',
    'thirdly',
    'finally',
    'to begin with',
    'first of all',
    'subsequently',
    'meanwhile',
    'lastly',
    'afterwards',
    'eventually',
    'in the first place',
    'at the same time',
    'following this',
    'initially',
  ],
  concession: [
    'admittedly',
    'granted',
    'of course',
    'even so',
    'that said',
    'it is true that',
    'to be fair',
    'having said that',
    'despite this',
    'albeit',
    'notwithstanding',
    'while it is true that',
  ],
  conclusion: [
    'in conclusion',
    'to conclude',
    'to sum up',
    'in summary',
    'overall',
    'on balance',
    'all things considered',
    'in short',
    'to summarise',
    'to summarize',
    'ultimately',
    'in brief',
    'taking everything into account',
  ],
}

/** Canonical device → its discourse function. */
const DEVICE_FUNCTION = new Map<string, LinkFunction>()
for (const fn of Object.keys(LEXICON) as LinkFunction[]) {
  for (const phrase of LEXICON[fn]) {
    DEVICE_FUNCTION.set(phrase, fn)
  }
}

function escapePhrase(phrase: string): string {
  // Escape regex metacharacters, then let any whitespace run stand in for a space.
  return phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')
}

/** ONE precompiled longest-first alternation, word-bounded, case-insensitive. */
const LINKER_REGEX = new RegExp(
  `\\b(?:${[...DEVICE_FUNCTION.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escapePhrase)
    .join('|')})\\b`,
  'gi',
)

interface LinkMatch {
  /** Canonical lowercase form from the lexicon. */
  device: string
  fn: LinkFunction
  start: number
  end: number
  /** Index into doc.sentences, or -1 when the match sits outside every sentence. */
  sentenceIndex: number
  /** True when the match begins at the first non-space position of its sentence. */
  sentenceInitial: boolean
}

function findLinkMatches(doc: TokenizedDoc): LinkMatch[] {
  const matches: LinkMatch[] = []
  if (!doc.text) return matches

  let sentencePointer = 0
  for (const m of doc.text.matchAll(LINKER_REGEX)) {
    const start = m.index ?? -1
    if (start < 0) continue
    const end = start + m[0].length
    const device = m[0].toLowerCase().replace(/\s+/g, ' ')
    const fn = DEVICE_FUNCTION.get(device)
    if (!fn) continue // defensive: canonical form should always be in the map

    // Matches arrive in order, so a forward-only pointer finds the sentence.
    while (
      sentencePointer < doc.sentences.length &&
      doc.sentences[sentencePointer].end <= start
    ) {
      sentencePointer += 1
    }
    const sentence = doc.sentences[sentencePointer]
    const inSentence =
      sentence !== undefined && sentence.start <= start && start < sentence.end

    let sentenceInitial = false
    if (inSentence) {
      const lead = sentence.text.length - sentence.text.trimStart().length
      sentenceInitial = start === sentence.start + lead
    }

    matches.push({
      device,
      fn,
      start,
      end,
      sentenceIndex: inSentence ? sentencePointer : -1,
      sentenceInitial,
    })
  }
  return matches
}

/** Total linking-device occurrences in the essay (all positions). */
export function countLinkingDevices(doc: TokenizedDoc): number {
  return findLinkMatches(doc).length
}

/** Two same-function alternatives to `device`, for the repetition message. */
function alternativesFor(device: string, fn: LinkFunction): string[] {
  return LEXICON[fn].filter((p) => p !== device).slice(0, 2)
}

function issue(
  category: Issue['category'],
  message: string,
  start: number | null,
  end: number | null,
  doc: TokenizedDoc,
): Issue {
  const base: Issue = {
    id: '', // engine assigns final ids
    category,
    criterion: 'CC',
    severity: 'warning',
    message,
    start,
    end,
  }
  if (start !== null && end !== null) {
    base.excerpt = doc.text.slice(start, end)
  }
  return base
}

export const cohesionRules: RuleFn = (
  doc: TokenizedDoc,
  prompt: PromptSpec | null,
): Issue[] => {
  const issues: Issue[] = []
  const matches = findLinkMatches(doc)

  /* ------------------------- linking-overuse ------------------------- */

  // First sentence-initial device per sentence index.
  const initialBySentence = new Map<number, LinkMatch>()
  for (const m of matches) {
    if (m.sentenceInitial && m.sentenceIndex >= 0 && !initialBySentence.has(m.sentenceIndex)) {
      initialBySentence.set(m.sentenceIndex, m)
    }
  }

  const sentenceCount = doc.sentences.length
  if (sentenceCount >= 8 && initialBySentence.size / sentenceCount > 0.5) {
    issues.push(
      issue(
        'linking-overuse',
        'More than half of your sentences open with a linking word, which reads as mechanical. Keep linkers for real turns in the argument and let some sentences start with the idea itself.',
        null,
        null,
        doc,
      ),
    )
  }

  // 3 consecutive linker-initial sentences → inline warning on the third's device span.
  let run = 0
  for (let i = 0; i < sentenceCount; i += 1) {
    const initial = initialBySentence.get(i)
    if (initial) {
      run += 1
      if (run === 3) {
        issues.push(
          issue(
            'linking-overuse',
            `This is the third sentence in a row that opens with a linker ('${initial.device}'). Start this one with its subject instead — cohesion can come from the ideas, not only from connectors.`,
            initial.start,
            initial.end,
            doc,
          ),
        )
      }
    } else {
      run = 0
    }
  }

  /* ------------------------ linking-underuse ------------------------- */

  if (doc.wordCount >= 200) {
    const distinct = new Set(matches.map((m) => m.device))
    const hasContrast = matches.some((m) => m.fn === 'contrast')
    const hasExample = matches.some((m) => m.fn === 'example')

    const missing: string[] = []
    if (distinct.size < 3) {
      missing.push(
        `only ${distinct.size} distinct linking ${distinct.size === 1 ? 'device' : 'devices'} — aim for a range across contrast, cause and example`,
      )
    }
    if (prompt?.type === 'discussion' && !hasContrast) {
      missing.push(
        "no contrast linkers ('however', 'on the other hand') — a discussion essay needs them to move between the two views",
      )
    }
    if (!hasExample) {
      missing.push(
        "no example linkers ('for example', 'for instance', 'such as') to introduce your supporting evidence",
      )
    }

    if (missing.length > 0) {
      issues.push(
        issue(
          'linking-underuse',
          `Your essay is light on signposting: ${missing.join('; ')}. Adding these makes your argument easier to follow.`,
          null,
          null,
          doc,
        ),
      )
    }
  }

  /* ----------------------- linking-repetition ----------------------- */

  const byDevice = new Map<string, LinkMatch[]>()
  for (const m of matches) {
    const list = byDevice.get(m.device)
    if (list) list.push(m)
    else byDevice.set(m.device, [m])
  }

  for (const [device, occurrences] of byDevice) {
    if (occurrences.length < 3) continue
    const alts = alternativesFor(device, occurrences[0].fn)
    const altText =
      alts.length >= 2
        ? `'${alts[0]}' or '${alts[1]}'`
        : alts.length === 1
          ? `'${alts[0]}'`
          : 'a different connector'
    for (let i = 2; i < occurrences.length; i += 1) {
      const m = occurrences[i]
      issues.push(
        issue(
          'linking-repetition',
          `'${device}' appears ${occurrences.length} times in this essay. Swap some uses for a same-purpose alternative such as ${altText}.`,
          m.start,
          m.end,
          doc,
        ),
      )
    }
  }

  return issues
}
