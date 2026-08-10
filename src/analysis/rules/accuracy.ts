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

/**
 * Auxiliaries, modals and copulas. Each one heads a finite verb group on its
 * own, and none of them can be anything else — no noun, no adjective.
 */
const FINITE_AUXILIARIES = new Set([
  'is', 'are', 'was', 'were', 'am', 'be', 'been', 'being', 'has', 'have', 'had', 'will', 'would',
  'can', 'could', 'may', 'might', 'must', 'shall', 'should', 'do', 'does', 'did',
])

/**
 * Frequent lexical verbs in their base and -s forms. Curated rather than
 * morphological because `\w+s$` matches far more plural nouns than verbs, and
 * a plural noun read as a verb would silence a genuine fragment.
 */
const FINITE_LEXICAL_VERBS = new Set([
  'accept', 'accepts', 'achieve', 'achieves', 'act', 'acts', 'add', 'adds', 'affect', 'affects',
  'agree', 'agrees', 'aim', 'aims', 'allow', 'allows', 'appear', 'appears', 'apply', 'applies',
  'argue', 'argues', 'avoid', 'avoids', 'become', 'becomes', 'begin', 'begins', 'believe',
  'believes', 'benefit', 'benefits', 'bring', 'brings', 'build', 'builds', 'buy', 'buys', 'carry',
  'carries', 'cause', 'causes', 'choose', 'chooses', 'claim', 'claims', 'come', 'comes', 'compare',
  'compares', 'consider', 'considers', 'continue', 'continues', 'cost', 'costs', 'create',
  'creates', 'decide', 'decides', 'depend', 'depends', 'describe', 'describes', 'destroy',
  'destroys', 'develop', 'develops', 'disagree', 'disagrees', 'discuss', 'discusses', 'earn',
  'earns', 'encourage', 'encourages', 'enjoy', 'enjoys', 'ensure', 'ensures', 'exist', 'exists',
  'expect', 'expects', 'explain', 'explains', 'face', 'faces', 'fail', 'fails', 'fall', 'falls',
  'feel', 'feels', 'find', 'finds', 'focus', 'focuses', 'follow', 'follows', 'gain', 'gains',
  'get', 'gets', 'give', 'gives', 'go', 'goes', 'grow', 'grows', 'happen', 'happens', 'harm',
  'harms', 'help', 'helps', 'hold', 'holds', 'improve', 'improves', 'include', 'includes',
  'increase', 'increases', 'influence', 'influences', 'invest', 'invests', 'involve', 'involves',
  'keep', 'keeps', 'know', 'knows', 'lack', 'lacks', 'lead', 'leads', 'learn', 'learns', 'leave',
  'leaves', 'like', 'likes', 'limit', 'limits', 'live', 'lives', 'look', 'looks', 'lose', 'loses',
  'make', 'makes', 'mean', 'means', 'meet', 'meets', 'move', 'moves', 'need', 'needs', 'offer',
  'offers', 'pay', 'pays', 'perform', 'performs', 'play', 'plays', 'prefer', 'prefers', 'prevent',
  'prevents', 'produce', 'produces', 'promote', 'promotes', 'prosper', 'prospers', 'protect',
  'protects', 'prove', 'proves', 'provide', 'provides', 'raise', 'raises', 'reach', 'reaches',
  'receive', 'receives', 'reduce', 'reduces', 'remain', 'remains', 'remember', 'remembers',
  'require', 'requires', 'rise', 'rises', 'run', 'runs', 'save', 'saves', 'say', 'says', 'see',
  'sees', 'seem', 'seems', 'sell', 'sells', 'send', 'sends', 'serve', 'serves', 'share', 'shares',
  'show', 'shows', 'solve', 'solves', 'spend', 'spends', 'stand', 'stands', 'start', 'starts',
  'stay', 'stays', 'stop', 'stops', 'study', 'studies', 'suffer', 'suffers', 'suggest', 'suggests',
  'support', 'supports', 'survive', 'survives', 'take', 'takes', 'teach', 'teaches', 'tell',
  'tells', 'tend', 'tends', 'think', 'thinks', 'threaten', 'threatens', 'travel', 'travels',
  'treat', 'treats', 'try', 'tries', 'turn', 'turns', 'understand', 'understands', 'use', 'uses',
  // 'view' is absent on purpose: in IELTS writing it is overwhelmingly a noun
  // ('in my view', 'this view'), and reading it as a verb silenced the genuine
  // fragment "While others disagree with this view."
  'value', 'values', 'visit', 'visits', 'wait', 'waits', 'walk', 'walks', 'want',
  'wants', 'waste', 'wastes', 'watch', 'watches', 'wear', 'wears', 'win', 'wins', 'work', 'works',
  'worry', 'worries', 'write', 'writes',
  // Irregular pasts, which no -ed test can reach.
  'ate', 'became', 'began', 'bought', 'brought', 'built', 'came', 'chose', 'drove', 'fell', 'felt',
  'fought', 'found', 'gave', 'got', 'grew', 'heard', 'held', 'kept', 'knew', 'led', 'left', 'lost',
  'made', 'meant', 'met', 'paid', 'ran', 'rose', 'said', 'saw', 'sent', 'sold', 'sought', 'spent',
  'spoke', 'stood', 'taught', 'thought', 'told', 'took', 'understood', 'went', 'won', 'wore',
  'wrote',
])

/**
 * Words ending in -ed that are NOT verb forms, so the -ed test below cannot
 * invent a verb group out of them.
 */
const NOT_A_PAST_FORM = new Set([
  'need', 'indeed', 'speed', 'succeed', 'exceed', 'proceed', 'breed', 'freed', 'greed', 'deed',
  'feed', 'seed', 'weed', 'creed', 'steed', 'embed', 'inbred', 'hatred', 'sacred', 'bed', 'red',
])

/** Adverbials that sit INSIDE a verb group ("has recently increased", "will not act"). */
const INSIDE_VERB_GROUP = new Set(['not', 'never', 'also', 'still', 'always', 'often', 'already'])

/**
 * How many finite verb GROUPS a sentence contains.
 *
 * Groups, not verbs, because "does not act" and "will get" are each ONE finite
 * verb — counting them as two would silence a genuine fragment ("If the
 * government does not act."). An adverb between the auxiliary and its verb
 * keeps the group open, so "has recently increased" also counts once.
 */
function countFiniteVerbGroups(text: string): number {
  const tokens = text.toLowerCase().match(/[a-zà-ɏ'’-]+/g) ?? []
  let groups = 0
  let inGroup = false
  for (const token of tokens) {
    if (INSIDE_VERB_GROUP.has(token) || (token.endsWith('ly') && token.length > 3)) continue
    const isPastForm = token.length >= 5 && token.endsWith('ed') && !NOT_A_PAST_FORM.has(token)
    if (!FINITE_AUXILIARIES.has(token) && !FINITE_LEXICAL_VERBS.has(token) && !isPastForm) {
      inGroup = false
      continue
    }
    if (!inGroup) groups++
    inGroup = true
  }
  return groups
}

/**
 * Did a main clause actually arrive after the subordinate opener?
 *
 * The rule used to ASSERT "a main clause never arrives" on the strength of a
 * regex that had only checked for a comma — so "If a country invests in
 * education it will prosper." was called incomplete when it plainly is not.
 * A subordinate clause carries ONE finite verb group, so a second one is the
 * main clause. Where the count is uncertain the arithmetic runs high, which
 * produces silence: the safe direction for a rule that otherwise accuses
 * correct writing.
 */
function hasMainClause(sentenceText: string): boolean {
  return countFiniteVerbGroups(sentenceText) >= 2
}

function fragments(doc: TokenizedDoc, out: Issue[]): void {
  for (const s of doc.sentences) {
    const m = FRAGMENT_RE.exec(s.text)
    if (!m) continue
    // A main clause can follow without a comma — the regex never checked.
    if (hasMainClause(s.text)) continue
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
  // Quantifiers license a bare noun just as a determiner does: "less contact
  // time", "more effort", "much debate" are all correct, and flagging them told
  // learners to write "a less contact time".
  'less', 'more', 'fewer', 'much', 'many', 'several', 'most', 'such', 'enough', 'little', 'few',
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
  // Educational stages are used without an article in the same way.
  'primary school', 'secondary school', 'high school', 'grammar school', 'boarding school',
  'start school', 'starts school', 'started school', 'starting school',
  'leave school', 'leaves school', 'left school', 'leaving school',
  'finish school', 'finishes school', 'finished school', 'finishing school',
])

/** Words the walk crossed that cannot join the suggested noun phrase (pronouns, likely plurals). */
const NOT_A_MODIFIER = new Set([
  'them', 'him', 'us', 'me', 'it', 'you', 'they', 'we', 'who', 'i', 'people', 'children', 'men',
  'women', 'everyone', 'everybody', 'someone', 'somebody', 'anyone', 'anybody',
])

/**
 * Nouns in COUNTABLE that are MASS nouns in their commonest IELTS sense.
 *
 * "reduce crime", "commit crime", "save time", "leave home" all take no article
 * on the bare reading, and the rule told learners otherwise — worse, it told
 * one to write "a reduce crime", because the leftward walk had crossed the verb
 * and quoted it back as part of the noun phrase.
 *
 * They stay in COUNTABLE because "a crime was committed" and "a better way" are
 * equally valid, so the escape is CONTEXTUAL: it applies only where the noun is
 * the bare direct object of a verb, which is exactly the mass reading. A bare
 * "…to shop" or "…lost job" is untouched, because those nouns are not here.
 *
 * The cost is a real one and worth naming: "protect environment" and "find way"
 * are errors this now stays silent about. That is the trade the module's own
 * policy asks for — a false positive costs more than a miss.
 */
const MASS_SENSE = new Set(['crime', 'time', 'future', 'world', 'environment', 'home', 'way', 'government'])

/**
 * Verbs the walk can CROSS. `WALK_VERBS` holds the ones that STOP it, so by
 * construction a crossed verb is never in that set — yet crossing one is the
 * clearest possible evidence that the span is no longer a noun phrase.
 *
 * Two uses, both of which only ever make the rule quieter: a crossed verb
 * blocks the flag entirely on a `MASS_SENSE` noun ("Governments … reduce
 * crime"), and everywhere else it shrinks the quoted span back to the bare noun
 * so the suggestion cannot be "a reduce crime".
 */
const WALK_CROSSABLE_VERBS = new Set([
  'reduce', 'reduces', 'reducing', 'prevent', 'prevents', 'preventing', 'fight', 'fights',
  'fighting', 'tackle', 'tackles', 'tackling', 'combat', 'combats', 'protect', 'protects',
  'protecting', 'save', 'saves', 'saving', 'waste', 'wastes', 'wasting', 'improve', 'improves',
  'improving', 'increase', 'increases', 'increasing', 'destroy', 'destroys', 'destroying',
  'avoid', 'avoids', 'avoiding', 'reach', 'reaches', 'reaching', 'affect', 'affects', 'affecting',
  'support', 'supports', 'supporting', 'control', 'controls', 'controlling', 'enter', 'enters',
  'entering', 'join', 'joins', 'joining', 'help', 'helps', 'helping', 'stop', 'stops', 'stopping',
  'change', 'changes', 'changing', 'solve', 'solves', 'solving', 'shape', 'shapes', 'shaping',
  'harm', 'harms', 'harming', 'damage', 'damages', 'damaging', 'ignore', 'ignores', 'ignoring',
  'punish', 'punishes', 'punishing', 'deter', 'deters', 'deterring', 'run', 'runs', 'running',
  'leave', 'leaves', 'leaving', 'visit', 'visits', 'visiting', 'shape', 'reform', 'reforms',
])

/**
 * Words after which the next token can only be a VERB. Modals and `do` take a
 * bare infinitive, so this reaches verbs `WALK_CROSSABLE_VERBS` cannot list,
 * without a dictionary.
 *
 * `to` is deliberately absent: it is an infinitive marker in "act to reduce
 * crime" but a plain preposition in "due to new prison system", and treating it
 * as a verb signal would shrink that suggestion from 'a new prison system' to
 * 'a system' — a real loss for a real error.
 */
const VERB_ONLY_AFTER = new Set([
  'can', 'could', 'may', 'might', 'must', 'shall', 'should', 'will', 'would', 'do', 'does',
  'did', 'not', 'never',
])

/**
 * Does the word at `k` look like a VERB rather than a modifier? Either it is a
 * known crossable verb, or the word in front of it admits nothing else.
 */
function isVerbToken(words: readonly Token[], k: number, first: number): boolean {
  const lower = words[k].lower
  if (WALK_CROSSABLE_VERBS.has(lower) || WALK_VERBS.has(lower)) return true
  return k > first && VERB_ONLY_AFTER.has(words[k - 1].lower)
}

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
      let stoppedAtVerb = false
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
          stoppedAtVerb = WALK_VERBS.has(left.lower)
          break
        }
        if (i - j >= MAX_MODIFIER_WALK) break // walked past any real adjective stack — stay silent
        j-- // adjective or unknown word — keep walking
      }
      if (!flagged) continue

      const modifiers: Token[] = words.slice(j, i)
      const crossedVerb = modifiers.some((_, n) => isVerbToken(words, j + n, first))

      // Mass-sense escape: a MASS_SENSE noun standing as the bare object of a
      // verb is the mass reading, which takes no article. "…act to reduce
      // crime", "…who commit crime", "…save time" are all correct, and the rule
      // was telling learners to write "a reduce crime".
      if (MASS_SENSE.has(noun.lower) && (stoppedAtVerb || crossedVerb)) continue

      // Only quote (and highlight) the modifiers when they can genuinely belong
      // to the noun phrase; otherwise the noun alone is the honest span. A
      // crossed VERB disqualifies the span the same way the walk cap does: the
      // suggestion must never be a phrase the walk invented.
      const usePhrase =
        !crossedVerb && modifiers.every((t) => !looksPlural(t.lower) && !NOT_A_MODIFIER.has(t.lower))
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

/**
 * A modal takes the BARE infinitive, so the verb after one is never the place
 * subject-verb agreement shows up. "Working from home can reduce commuting
 * costs" is correct English, and the rule was answering it with "can reduces".
 *
 * The same holds for a negated auxiliary ("does not reduce") and for the verbs
 * that themselves govern a bare infinitive ("helps reduce", "let it happen") —
 * in every one of them the agreement, if any, sits on the word BEFORE, which
 * this rule is not looking at.
 *
 * Tested against the span between the -ing word and the matched verb, so a
 * gerund subject governing the verb directly ("Working from home reduce costs")
 * is still caught.
 */
const MODAL_BEFORE_VERB_RE =
  /\b(can|could|may|might|must|shall|should|will|would|do|does|did|to|help|helps|helped|let|lets|make|makes|made)\b(\s+(not|never))?\s+$/i

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
      // The verb has to be the one the gerund subject governs. A modal or a
      // bare-infinitive verb in between means it governs this one instead.
      const between = m[0].slice(m[1].length, m[0].length - m[2].length)
      if (MODAL_BEFORE_VERB_RE.test(between)) continue
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
