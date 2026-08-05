/**
 * Accuracy rules (SPEC.md "Patch v2") — the form errors that separated a real
 * human-marked Band-6 essay from the engine's 6.0–7.0 estimate: fronted
 * connectors without commas, capitalisation slips, sentence fragments,
 * missing articles, agreement errors, 'that' used for people, misused
 * connectors, and wrong-preposition collocations.
 *
 * Categories emitted: connector-comma, capitalisation, fragment, article,
 * agreement, who-for-people (GRA); connector-misuse (CC); collocation (LR).
 * Every issue is span-level and its offsets index the ORIGINAL text. Guards
 * err on the side of silence — a false positive costs more than a miss.
 */
import type { Criterion, Issue, IssueCategory, Severity, RuleFn, Token, TokenizedDoc } from '../../types'

/* --------------------------------- helpers --------------------------------- */

function makeIssue(
  category: IssueCategory,
  criterion: Criterion,
  severity: Severity,
  message: string,
  start: number,
  end: number,
  excerpt?: string,
): Issue {
  const issue: Issue = { id: '', category, criterion, severity, message, start, end }
  if (excerpt) issue.excerpt = excerpt
  return issue
}

/** Short quote of a span with a little context, for inline issues. */
function excerptAround(text: string, start: number, end: number): string {
  const from = Math.max(0, start - 15)
  const to = Math.min(text.length, end + 15)
  const prefix = from > 0 ? '…' : ''
  const suffix = to < text.length ? '…' : ''
  return `${prefix}${text.slice(from, to).trim()}${suffix}`
}

function trimExcerpt(text: string): string {
  const t = text.trim()
  return t.length <= 60 ? t : `${t.slice(0, 60).trimEnd()}…`
}

const LETTER_RE = /[A-Za-zÀ-ɏ]/
const WORD_CHUNK_RE = /^[A-Za-zÀ-ɏ'’-]+/

/* ------------------- A2: fronted connector missing comma ------------------- */

const CONNECTORS =
  'However|Therefore|Moreover|Furthermore|In addition|For example|For instance|In my opinion|In my view|In this sense|On the other hand|As a result|Consequently|In conclusion|Ultimately|On balance|Admittedly|Nevertheless'

/**
 * SPEC A2 anchor: document start, sentence start (after .!? plus an optional
 * closing quote/bracket), or paragraph start. The trailing \b stops partial
 * matches inside longer words ("In additional cases…").
 */
const FRONTED_CONNECTOR_RE = new RegExp(`(^\\s*|[.!?]["')\\]]?\\s+|\\n\\s*)(${CONNECTORS})\\b(?!,)`, 'g')

const SPACE_BEFORE_COMMA_RE = /\s+,/g

/** "However hard they try…" is a concession opener, not a fronted connector. */
const HOWEVER_ADVERB_RE =
  /^\s+(hard|much|many|long|far|well|often|good|great|small|big|high|low|strong|difficult|quickly)\b/i

function connectorComma(doc: TokenizedDoc, out: Issue[]): void {
  for (const m of doc.text.matchAll(FRONTED_CONNECTOR_RE)) {
    const start = (m.index ?? 0) + m[1].length
    const connector = m[2]
    const end = start + connector.length
    const after = doc.text.slice(end)
    // Guards: the comma is present but spaced ("Therefore ,"); the connector
    // continues into a longer phrase ("As a result of…", "In addition to…");
    // "However" + adverb concession; or different punctuation follows.
    if (/^\s+,/.test(after)) continue
    if ((connector === 'As a result' || connector === 'In addition') && /^\s*(of|to)\b/i.test(after)) continue
    if (connector === 'However' && HOWEVER_ADVERB_RE.test(after)) continue
    if (/^[:;.!?—–-]/.test(after)) continue
    out.push(
      makeIssue(
        'connector-comma',
        'GRA',
        'warning',
        `'${connector}' fronts the sentence, so it takes a comma: write '${connector},' before the sentence continues.`,
        start,
        end,
        excerptAround(doc.text, start, end),
      ),
    )
  }

  for (const m of doc.text.matchAll(SPACE_BEFORE_COMMA_RE)) {
    const start = m.index ?? 0
    const end = start + m[0].length
    out.push(
      makeIssue(
        'connector-comma',
        'GRA',
        'warning',
        "Remove the space before this comma — the comma sticks to the word before it: 'word, …' not 'word , …'.",
        start,
        end,
        excerptAround(doc.text, start, end),
      ),
    )
  }
}

/* --------------------------- A3: capitalisation ---------------------------- */

/** Standalone lowercase 'i' — case-sensitive on purpose. */
const PRONOUN_I_RE = /\bi\b/g

/** Sentence starts we never flag: dotted abbreviations that are valid in lowercase. */
const PROTECTED_START_RE = /^(e\.g\.|i\.e\.)/i

/** Leading characters allowed before the "first letter" of a sentence. */
const OPENING_PUNCT_RE = /["'‘’“”(\[]/

/** Find the first letter of a sentence, skipping opening quotes/brackets. */
function firstLetter(text: string): { offset: number; ch: string } | null {
  for (let k = 0; k < text.length; k++) {
    const ch = text.charAt(k)
    if (LETTER_RE.test(ch)) return { offset: k, ch }
    if (!OPENING_PUNCT_RE.test(ch)) return null // digits, dashes… — not a capitalisation case
  }
  return null
}

function capitalisation(doc: TokenizedDoc, out: Issue[]): void {
  /** Absolute offsets already flagged as lowercase sentence starts (dedupes the 'i' check). */
  const flaggedStarts = new Set<number>()

  doc.sentences.forEach((s, sentenceIndex) => {
    if (PROTECTED_START_RE.test(s.text)) return
    const first = firstLetter(s.text)
    if (!first) return
    const isLower = first.ch === first.ch.toLowerCase() && first.ch !== first.ch.toUpperCase()
    if (!isLower) return
    const rest = s.text.slice(first.offset)
    const word = WORD_CHUNK_RE.exec(rest)?.[0] ?? first.ch
    const fixed = word.charAt(0).toUpperCase() + word.slice(1)
    const start = s.start + first.offset
    const end = start + word.length
    flaggedStarts.add(start)
    const message =
      sentenceIndex === 0
        ? `The essay's first word needs a capital letter: write '${fixed}', not '${word}'.`
        : `Every sentence starts with a capital letter: write '${fixed}', not '${word}'.`
    out.push(makeIssue('capitalisation', 'GRA', 'error', message, start, end, excerptAround(doc.text, start, end)))
  })

  for (const m of doc.text.matchAll(PRONOUN_I_RE)) {
    const idx = m.index ?? 0
    if (doc.text.slice(idx, idx + 4).toLowerCase() === 'i.e.') continue // part of "i.e."
    const prev = idx > 0 ? doc.text.charAt(idx - 1) : ''
    if (prev === '(' && doc.text.charAt(idx + 1) === ')') continue // list marker "(i)"
    if (flaggedStarts.has(idx)) continue // already flagged as a lowercase sentence start
    out.push(
      makeIssue(
        'capitalisation',
        'GRA',
        'error',
        "The pronoun 'I' is always a capital letter — write 'I', not 'i'.",
        idx,
        idx + 1,
        excerptAround(doc.text, idx, idx + 1),
      ),
    )
  }
}

/* ------------------------------ A4: fragments ------------------------------ */

/**
 * SPEC A4: a dependent opener (optionally after a discourse marker) that never
 * reaches a comma before the full stop — run against each sentence's text.
 */
const FRAGMENT_RE =
  /^(?:(?:For example|For instance|In addition|Moreover),\s+)?(If|When|Whenever|While|Because|Although|Even though|Unless|Whereas|Since|Unlike|Which)\b[^,.]*\.$/i

function fragments(doc: TokenizedDoc, out: Issue[]): void {
  for (const s of doc.sentences) {
    const m = FRAGMENT_RE.exec(s.text)
    if (!m) continue
    const opener = m[1]
    out.push(
      makeIssue(
        'fragment',
        'GRA',
        'warning',
        `This starts with '${opener}' but a main clause never arrives — check: is this a complete sentence? Add the main clause after a comma ('${opener} …, …') or join it to the sentence beside it.`,
        s.start,
        s.end,
        trimExcerpt(s.text),
      ),
    )
  }
}

/* --------------------------- A5: missing articles --------------------------- */

/** SPEC A5 countable-noun set (singular forms only — plurals never match). */
const COUNTABLE = new Set([
  'period', 'term', 'system', 'situation', 'response', 'reaction', 'chance', 'result', 'sentence',
  'crime', 'citizen', 'shop', 'group', 'trip', 'future', 'world', 'environment', 'government',
  'company', 'city', 'country', 'school', 'reason', 'problem', 'student', 'child', 'traveller',
  'traveler', 'uniform', 'job', 'home', 'time', 'way', 'person', 'man', 'woman', 'solution',
  'decision', 'choice',
])

const DETERMINERS = new Set([
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'my', 'his', 'her', 'its', 'their', 'our',
  'your', 'every', 'each', 'one', 'no', 'any', 'some', 'another',
])

/** Small preposition stop-set for the leftward walk. */
const WALK_PREPOSITIONS = new Set([
  'of', 'in', 'on', 'at', 'by', 'for', 'from', 'with', 'without', 'to', 'into', 'onto', 'over',
  'under', 'about', 'above', 'after', 'before', 'during', 'through', 'throughout', 'between',
  'among', 'against', 'as', 'than', 'upon', 'within', 'toward', 'towards', 'per', 'despite', 'via',
])

/** Small verb stop-set for the leftward walk. */
const WALK_VERBS = new Set([
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
  'did', 'make', 'makes', 'made', 'face', 'faces', 'faced', 'get', 'gets', 'got', 'take', 'takes',
  'took', 'taken', 'give', 'gives', 'gave', 'given', 'need', 'needs', 'needed', 'want', 'wants',
  'wanted', 'become', 'becomes', 'became', 'spend', 'spends', 'spent', 'serve', 'serves', 'served',
  'commit', 'commits', 'committed', 'receive', 'receives', 'received', 'require', 'requires',
  'required', 'deserve', 'deserves', 'deserved', 'lose', 'loses', 'lost', 'find', 'finds', 'found',
  'provide', 'provides', 'provided', 'offer', 'offers', 'offered', 'create', 'creates', 'created',
  'build', 'builds', 'built', 'buy', 'buys', 'bought', 'wear', 'wears', 'wore', 'worn', 'attend',
  'attends', 'attended', 'cause', 'causes', 'caused', 'remain', 'remains', 'remained',
])

/**
 * Adjacent "previous word + noun" pairs that legitimately take no article
 * (fixed and zero-article phrases). 'by the way' / 'all the time' need no
 * entry — the walk finds 'the'. Uncountables (society, education, freedom,
 * advice, money, research, information, nature) are never candidates because
 * they are absent from COUNTABLE.
 */
const ZERO_ARTICLE_PAIRS = new Set([
  'at home', 'from home',
  'go home', 'goes home', 'going home', 'went home', 'gone home',
  'return home', 'returns home', 'returned home', 'returning home',
  'stay home', 'stays home', 'stayed home', 'staying home',
  'come home', 'comes home', 'coming home', 'came home',
  'arrive home', 'arrives home', 'arrived home', 'arriving home',
  'get home', 'gets home', 'got home', 'getting home',
  'leave home', 'leaves home', 'left home', 'leaving home',
  'back home', 'way home',
  'in time', 'on time', 'over time', 'with time', 'through time',
  'at school', 'to school', 'in school', 'from school', 'after school', 'before school',
])

/** Words the walk crossed that cannot join the suggested noun phrase (pronouns, likely plurals). */
const NOT_A_MODIFIER = new Set([
  'them', 'him', 'us', 'me', 'it', 'you', 'they', 'we', 'who', 'i', 'people', 'children', 'men',
  'women', 'everyone', 'everybody', 'someone', 'somebody', 'anyone', 'anybody',
])

/**
 * Nominal suffixes. A word carrying one of these is a noun, which makes a
 * COUNTABLE word sitting directly in front of it a MODIFIER rather than the
 * head — 'job satisfaction', 'time management', 'job opportunities' need no
 * article on 'job'/'time'. Verb forms cannot match: 'needs', 'requires' and
 * 'destroys' end in -s, which appears in none of these endings, so genuine
 * "bare noun + verb" errors are still caught.
 *
 * The length floor keeps short lookalikes out: 'city'/'unity' (-ity),
 * 'sure'/'pure'/'cure' (-ure).
 */
const NOMINAL_SUFFIX_RE =
  /(?:tions?|sions?|ments?|nesses|ness|ities|ity|ances?|ences?|ships?|isms?|hoods?|acies|acy|ures?|ologies|ology)$/
const NOMINAL_SUFFIX_MIN_LENGTH = 6

/**
 * Compound heads the suffix test cannot reach — ordinary nouns that routinely
 * head a compound whose modifier is one of the COUNTABLE words ('job market',
 * 'job seekers', 'school fees', 'world war', 'city centre').
 */
const COMPOUND_HEADS = new Set([
  'market', 'markets', 'seeker', 'seekers', 'hunting', 'title', 'titles', 'offer', 'offers',
  'interview', 'interviews', 'losses', 'cuts', 'prospects', 'ads', 'advert', 'adverts',
  'fees', 'bus', 'buses', 'run', 'trip', 'trips', 'holidays', 'leavers',
  'war', 'wars', 'leaders', 'leader', 'peace', 'trade', 'centre', 'center', 'council', 'councils',
  'dwellers', 'planning', 'limits', 'limit', 'frame', 'zone', 'zones', 'span', 'scale', 'lag',
  'load', 'loads', 'hours', 'week', 'weeks', 'life', 'lives', 'stress', 'levels', 'level',
  'rate', 'rates', 'skills', 'skill', 'goals', 'goal', 'path', 'paths', 'ladder', 'change',
  'owner', 'owners', 'page', 'town', 'work', 'sharing', 'care',
])

/**
 * Is `lower` a plausible noun HEAD standing directly after a countable
 * candidate? True → the candidate is a modifier in a compound and takes no
 * article of its own.
 */
function isCompoundHead(lower: string): boolean {
  if (COUNTABLE.has(lower)) return true
  if (lower.endsWith('s') && COUNTABLE.has(lower.slice(0, -1))) return true
  if (COMPOUND_HEADS.has(lower)) return true
  return lower.length >= NOMINAL_SUFFIX_MIN_LENGTH && NOMINAL_SUFFIX_RE.test(lower)
}

/**
 * How many words the leftward walk may cross before we stop trusting it.
 * Real adjective stacks are short ('a new prison system' = 2). A walk that
 * runs further has escaped into the clause — "…income, and serious financial
 * pressure can itself destroy job" is not a noun phrase — so it must produce
 * silence, not a flag with a nonsense span.
 */
const MAX_MODIFIER_WALK = 3

function looksPlural(lower: string): boolean {
  return lower.endsWith('s') && !/(ss|us|is|os)$/.test(lower)
}

function articles(doc: TokenizedDoc, out: Issue[]): void {
  const words = doc.words
  let w = 0
  for (const s of doc.sentences) {
    while (w < words.length && words[w].start < s.start) w++
    const first = w
    let last = w
    while (last < words.length && words[last].start < s.end) last++
    w = last

    for (let i = first; i < last; i++) {
      const noun = words[i]
      if (!COUNTABLE.has(noun.lower)) continue
      // Proper-noun guard: capitalised mid-sentence ("New York City").
      if (i > first && noun.text.charAt(0) !== noun.text.charAt(0).toLowerCase()) continue
      // Compound guard: a countable directly before another noun is a modifier,
      // not the head — "long time sentences", "school uniform", "job
      // satisfaction". Only an unbroken run of whitespace makes a compound, so
      // "for this job, satisfaction matters" is still a candidate.
      if (i + 1 < last && /^\s*$/.test(doc.text.slice(noun.end, words[i + 1].start))) {
        if (isCompoundHead(words[i + 1].lower)) continue
      }
      // Fixed-phrase guard: "at home", "on time", "at school", "go home", …
      if (i > first && ZERO_ARTICLE_PAIRS.has(`${words[i - 1].lower} ${noun.lower}`)) continue

      // Walk LEFT over adjectives/unknown words until a determiner (OK) or a
      // preposition/verb/comma/sentence start (FLAG). The walk is capped: the
      // stop-sets cannot list every English verb, so an uncapped walk crosses
      // whole clauses and reports a noun phrase that was never there.
      let j = i
      let flagged = false
      for (;;) {
        if (j === first) {
          flagged = true // sentence start reached with no determiner
          break
        }
        const left = words[j - 1]
        const between = doc.text.slice(left.end, words[j].start)
        if (/[,;:]/.test(between)) {
          flagged = true // crossed a clause boundary
          break
        }
        if (DETERMINERS.has(left.lower)) break // determiner found — correct as written
        if (WALK_PREPOSITIONS.has(left.lower) || WALK_VERBS.has(left.lower)) {
          flagged = true
          break
        }
        if (i - j >= MAX_MODIFIER_WALK) break // walked past any real adjective stack — stay silent
        j-- // adjective or unknown word — keep walking
      }
      if (!flagged) continue

      // Only quote (and highlight) the modifiers when they can genuinely belong
      // to the noun phrase; otherwise the noun alone is the honest span.
      const modifiers: Token[] = words.slice(j, i)
      const usePhrase = modifiers.every((t) => !looksPlural(t.lower) && !NOT_A_MODIFIER.has(t.lower))
      const spanStart = usePhrase ? words[j].start : noun.start
      const phrase = doc.text.slice(spanStart, noun.end).toLowerCase()
      const article = /^[aeiou]/.test(phrase) ? 'an' : 'a'
      out.push(
        makeIssue(
          'article',
          'GRA',
          'warning',
          `'${noun.lower}' is a singular countable noun and needs a determiner — write '${article} ${phrase}' or 'the ${phrase}'.`,
          spanStart,
          noun.end,
          excerptAround(doc.text, spanStart, noun.end),
        ),
      )
    }
  }
}

/* ------------------- A6 + B1 + B3: agreement (three patterns) ------------------- */

/** A6: an -ing subject followed by a bare plural verb, anywhere in the sentence. */
const ING_SUBJECT_VERB_RE =
  /\b(having|working|travell?ing|wearing|playing|making|learning|studying|shopping|punishing|educating|giving|teaching|reading|watching|buying|renting)\s+[^.,;]{0,60}?\s(add|make|unite|help|give|allow|cause|lead|reduce|improve|require|need|create|bring|save|cost|take)\b/gi

/**
 * Words before the -ing that turn it into a tense or a noun modifier rather
 * than a gerund subject ("are working…", "parents working long hours need…").
 * Any word ending in -s (a likely plural noun) also skips.
 */
const ING_PRECEDING_SKIP = new Set([
  'is', 'are', 'was', 'were', 'am', 'be', 'been', 'being',
  'by', 'while', 'when', 'than', 'of', 'for', 'from', 'after', 'before', 'without', 'in', 'on',
  'at', 'into', 'about', 'against',
  'keep', 'kept', 'start', 'started', 'stop', 'stopped', 'avoid', 'avoided', 'enjoy', 'enjoyed',
  'consider', 'considered', 'suggest', 'suggested', 'recommend', 'recommended',
  'people', 'children', 'men', 'women', 'they', 'we', 'who', 'i', 'you', 'he', 'she', 'it',
  'those', 'anyone', 'everyone', 'someone',
])

/** B1: singular determiner + (up to two words) + plural noun. */
const SINGULAR_DET_PLURAL_RE =
  /\b(a|an|one|each|every|another)\s+((?:\w+\s+){0,2})(women|men|children|people|persons|criminals|killers|prisoners|students|employees|citizens|teachers|workers|parents|years|skills)\b/gi

/** Middles that make B1 correct as written: "one of the children", "a few years". */
const QUANTITY_MIDDLE_RE =
  /\b(of|few|couple|dozen|hundred|thousand|million|several|many|number|lot|group|majority|minority|pair|team|series|range|variety|two|three|four|five|six|seven|eight|nine|ten|twelve|twenty|thirty|forty|fifty)\b/i

const SINGULAR_OF: Record<string, string> = {
  women: 'woman', men: 'man', children: 'child', people: 'person', persons: 'person',
  criminals: 'criminal', killers: 'killer', prisoners: 'prisoner', students: 'student',
  employees: 'employee', citizens: 'citizen', teachers: 'teacher', workers: 'worker',
  parents: 'parent', years: 'year', skills: 'skill',
}

/** B3: plural be-verb + singular complement. The lookahead also skips possessives ("are a parent's…"). */
const PLURAL_SINGULAR_COMPLEMENT_RE =
  /\b(are|were)\s+(a\s+)?(human being|citizen|student|employee|travell?er|criminal|teacher|worker|parent|adult)\b(?![s'’])/gi

function agreement(doc: TokenizedDoc, out: Issue[]): void {
  // A6 — per sentence, so the 60-char window never crosses a sentence boundary.
  for (const s of doc.sentences) {
    for (const m of s.text.matchAll(ING_SUBJECT_VERB_RE)) {
      const idx = m.index ?? 0
      const beforeMatch = /([A-Za-zÀ-ɏ'’-]+)\s*$/.exec(s.text.slice(0, idx))
      const prevWord = beforeMatch?.[1]?.toLowerCase()
      if (prevWord && (ING_PRECEDING_SKIP.has(prevWord) || prevWord.endsWith('s'))) continue
      const verb = m[2].toLowerCase()
      out.push(
        makeIssue(
          'agreement',
          'GRA',
          'warning',
          `An -ing subject is one thing — the verb takes s: '${verb}' → '${verb}s'.`,
          s.start + idx,
          s.start + idx + m[0].length,
          excerptAround(s.text, idx, idx + m[0].length),
        ),
      )
    }
  }

  // B1 — singular determiner with a plural noun.
  for (const m of doc.text.matchAll(SINGULAR_DET_PLURAL_RE)) {
    const middle = m[2] ?? ''
    if (QUANTITY_MIDDLE_RE.test(middle)) continue // "one of the children", "a few years" are correct
    const idx = m.index ?? 0
    const det = m[1].toLowerCase()
    const plural = m[3].toLowerCase()
    const singular = SINGULAR_OF[plural] ?? plural.replace(/s$/, '')
    out.push(
      makeIssue(
        'agreement',
        'GRA',
        'warning',
        `'${det} … ${plural}' does not agree — a/one/each need a singular noun: ${plural} → ${singular}.`,
        idx,
        idx + m[0].length,
        excerptAround(doc.text, idx, idx + m[0].length),
      ),
    )
  }

  // B3 — plural subject with a singular complement.
  for (const m of doc.text.matchAll(PLURAL_SINGULAR_COMPLEMENT_RE)) {
    const idx = m.index ?? 0
    const verb = m[1].toLowerCase()
    const noun = m[3].toLowerCase()
    const dropA = m[2] ? " — and drop the 'a'" : ''
    out.push(
      makeIssue(
        'agreement',
        'GRA',
        'warning',
        `A plural subject needs a plural complement: '${verb} ${noun}s'${dropA}.`,
        idx,
        idx + m[0].length,
        excerptAround(doc.text, idx, idx + m[0].length),
      ),
    )
  }
}

/* --------------------------- B2: 'who' for people --------------------------- */

const PERSON_THAT_RE =
  /\b((?:person|people|citizen|man|woman|child|children|student|employee|travell?er|killer|prisoner|teacher|worker|friend|parent|shopper)s?)\s+that\b/gi

/** "told the students that they…" — 'that' is a reported clause, not a relative. */
const REPORTING_VERB_BEFORE_RE =
  /\b(tell|tells|told|telling|inform|informs|informed|informing|convince|convinces|convinced|convincing|remind|reminds|reminded|reminding|assure|assures|assured|assuring|show|shows|showed|shown|showing|teach|teaches|taught|teaching|warn|warns|warned|warning|promise|promises|promised|promising|persuade|persuades|persuaded|persuading)\s+(?:\w+\s+)?$/i

function whoForPeople(doc: TokenizedDoc, out: Issue[]): void {
  for (const m of doc.text.matchAll(PERSON_THAT_RE)) {
    const idx = m.index ?? 0
    if (REPORTING_VERB_BEFORE_RE.test(doc.text.slice(Math.max(0, idx - 30), idx))) continue
    const noun = m[1].toLowerCase()
    out.push(
      makeIssue(
        'who-for-people',
        'GRA',
        'warning',
        `Use 'who' for people and 'that' for things: write '${noun} who …', not '${noun} that …'.`,
        idx,
        idx + m[0].length,
        excerptAround(doc.text, idx, idx + m[0].length),
      ),
    )
  }
}

/* --------------------------- B4: connector misuse --------------------------- */

/** ", meanwhile others believe" — meanwhile used for contrast. */
const MEANWHILE_CONTRAST_RE = /,\s*meanwhile\b(?=[\s,]+\w)/gi

const CONNECTOR_MISUSE_PHRASES: ReadonlyArray<{ re: RegExp; message: (found: string) => string }> = [
  {
    re: /\bin\s+other\s+side\b/gi,
    message: (found) => `'${found}' is not an English connector — write 'on the other hand'.`,
  },
  {
    re: /\bfrom\s+other\s+side\b/gi,
    message: (found) => `'${found}' is not an English connector — write 'on the other hand'.`,
  },
  {
    re: /\bin\s+the\s+other\s+hand\b/gi,
    message: () => "The fixed phrase is 'on the other hand', not 'in the other hand'.",
  },
  {
    re: /\bon\s+the\s+contrary\s+of\b/gi,
    message: () => "'on the contrary of X' is not English — write 'contrary to X' or 'unlike X'.",
  },
]

function connectorMisuse(doc: TokenizedDoc, out: Issue[]): void {
  for (const m of doc.text.matchAll(MEANWHILE_CONTRAST_RE)) {
    const idx = m.index ?? 0
    out.push(
      makeIssue(
        'connector-misuse',
        'CC',
        'warning',
        "'meanwhile' means 'at the same time' — for contrast write '…, whereas others …' or start a new sentence with 'However,'.",
        idx,
        idx + m[0].length,
        excerptAround(doc.text, idx, idx + m[0].length),
      ),
    )
  }

  for (const { re, message } of CONNECTOR_MISUSE_PHRASES) {
    for (const m of doc.text.matchAll(re)) {
      const idx = m.index ?? 0
      out.push(
        makeIssue(
          'connector-misuse',
          'CC',
          'warning',
          message(m[0].toLowerCase()),
          idx,
          idx + m[0].length,
          excerptAround(doc.text, idx, idx + m[0].length),
        ),
      )
    }
  }
}

/* ------------------------ B5: collocation (fixed pairs) ---------------------- */

/**
 * Hand-checked wrong→right pairs ONLY — correct forms ('consist of',
 * 'suffer from') can never match these patterns.
 */
const COLLOCATION_PAIRS: ReadonlyArray<{ re: RegExp; fix: (m: RegExpMatchArray) => string }> = [
  { re: /\bkey\s+for\b/gi, fix: () => 'key to' },
  { re: /\bbad\s+to\s+(someone|people|employees|students)\b/gi, fix: (m) => `bad for ${(m[1] ?? '').toLowerCase()}` },
  { re: /\bin\s+home\b/gi, fix: () => 'at home' },
  { re: /\bresponsible\s+of\b/gi, fix: () => 'responsible for' },
  { re: /\bdepend(s|ed|ing)?\s+of\b/gi, fix: (m) => `depend${(m[1] ?? '').toLowerCase()} on` },
  { re: /\bfocus(es|ed|ing)?\s+in\b/gi, fix: (m) => `focus${(m[1] ?? '').toLowerCase()} on` },
  { re: /\binterfer(e|es|ed|ing)\s+in\b/gi, fix: (m) => `interfer${(m[1] ?? 'e').toLowerCase()} with` },
  { re: /\breason\s+of\b/gi, fix: () => 'reason for' },
  { re: /\bafraid\s+from\b/gi, fix: () => 'afraid of' },
]

function collocations(doc: TokenizedDoc, out: Issue[]): void {
  for (const { re, fix } of COLLOCATION_PAIRS) {
    for (const m of doc.text.matchAll(re)) {
      const idx = m.index ?? 0
      out.push(
        makeIssue(
          'collocation',
          'LR',
          'warning',
          `Wrong preposition: '${m[0].toLowerCase()}' → write '${fix(m)}'.`,
          idx,
          idx + m[0].length,
          excerptAround(doc.text, idx, idx + m[0].length),
        ),
      )
    }
  }
}

/* ---------------------------------- export ---------------------------------- */

export const accuracyRules: RuleFn = (doc) => {
  const issues: Issue[] = []
  if (!doc.text) return issues
  connectorComma(doc, issues)
  capitalisation(doc, issues)
  fragments(doc, issues)
  articles(doc, issues)
  agreement(doc, issues)
  whoForPeople(doc, issues)
  connectorMisuse(doc, issues)
  collocations(doc, issues)
  return issues
}
