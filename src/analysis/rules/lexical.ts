/**
 * Lexical Resource rules (SPEC.md `analysis/rules/lexical.ts`):
 * `contraction`, `informal-register`, `vague-quantifier`, `weak-vocabulary`,
 * `repetition`, `memorised-phrase`.
 *
 * Every regex is precompiled at module scope. Because global regexes carry
 * `lastIndex` state, all matching goes through `findAll`, which resets the
 * regex before scanning — analyses can never leak state into each other.
 * Contractions are matched from an explicit list only, so a bare possessive
 * apostrophe-s ("the government's plan") is never flagged.
 */

import type { Issue, LetterTone, PromptSpec, RuleFn, TaskKind, Token, TokenizedDoc } from '../../types'

/* ------------------------------ shared helpers ----------------------------- */

interface Found {
  start: number
  end: number
  text: string
  groups: Array<string | undefined>
}

/** Exec-loop over a precompiled /g/ regex with lastIndex reset + zero-length guard. */
function findAll(re: RegExp, text: string): Found[] {
  const out: Found[] = []
  if (!text) return out
  re.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      text: m[0],
      groups: m.slice(1),
    })
    if (m[0].length === 0) re.lastIndex += 1 // defensive: never spin
  }
  return out
}

function issue(
  category: Issue['category'],
  severity: Issue['severity'],
  message: string,
  start: number | null,
  end: number | null,
  doc: TokenizedDoc,
): Issue {
  const base: Issue = {
    id: '', // engine assigns final ids
    category,
    criterion: 'LR',
    severity,
    message,
    start,
    end,
  }
  if (start !== null && end !== null) {
    base.excerpt = doc.text.slice(start, end)
  }
  return base
}

/* -------------------------------- contraction ------------------------------ */

/** Explicit contraction list (~40 forms) with full-form expansions. */
const CONTRACTION_EXPANSIONS: Record<string, string> = {
  "don't": 'do not',
  "doesn't": 'does not',
  "didn't": 'did not',
  "can't": 'cannot',
  "couldn't": 'could not',
  "won't": 'will not',
  "wouldn't": 'would not',
  "shouldn't": 'should not',
  "shan't": 'shall not',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "hasn't": 'has not',
  "haven't": 'have not',
  "hadn't": 'had not',
  "mustn't": 'must not',
  "mightn't": 'might not',
  "needn't": 'need not',
  "it's": 'it is',
  "that's": 'that is',
  "there's": 'there is',
  "here's": 'here is',
  "what's": 'what is',
  "who's": 'who is',
  "let's": 'let us',
  "i'm": 'I am',
  "i've": 'I have',
  "i'll": 'I will',
  "i'd": 'I would',
  "you're": 'you are',
  "you've": 'you have',
  "you'll": 'you will',
  "you'd": 'you would',
  "we're": 'we are',
  "we've": 'we have',
  "we'll": 'we will',
  "we'd": 'we would',
  "they're": 'they are',
  "they've": 'they have',
  "they'll": 'they will',
  "they'd": 'they would',
  "he's": 'he is',
  "she's": 'she is',
  "would've": 'would have',
  "could've": 'could have',
  "should've": 'should have',
  "might've": 'might have',
}

/** List-match only, both apostrophe variants (' and ’), word-bounded. */
const CONTRACTION_RE = new RegExp(
  `\\b(?:${Object.keys(CONTRACTION_EXPANSIONS)
    .sort((a, b) => b.length - a.length)
    .map((form) => form.replace(/'/g, "['’]"))
    .join('|')})\\b`,
  'gi',
)

function contractionIssues(doc: TokenizedDoc, issues: Issue[], tone?: LetterTone): void {
  // STAND-DOWN — contractions, for EVERY letter tone. Two directions, both wrong
  // to report here:
  //  - INFORMAL: "I can't wait to see you" is correct English at that register.
  //  - FORMAL / SEMI-FORMAL: it really is wrong, and `gt-tone-mismatch` already
  //    says so — inline, on the SAME span, with the SAME fix ("write the full
  //    form"), and naming the register THIS letter must hold. Both firing showed
  //    one mistake as two in the panel and charged it twice to the LR register
  //    count, which sums `informal-register`, `contraction` and
  //    `gt-tone-mismatch` (letterBandEstimate.ts:219). This message is also
  //    about ACADEMIC writing, a genre the learner was not asked to produce.
  //    The severity drops from error to warning-only inside a letter; that is
  //    the same trade '!' already took, and it is recorded in SPEC.md.
  if (tone !== undefined) return

  for (const f of findAll(CONTRACTION_RE, doc.text)) {
    const key = f.text.toLowerCase().replace(/’/g, "'")
    const expansion = CONTRACTION_EXPANSIONS[key]
    if (!expansion) continue // defensive: regex is built from the map keys
    const cased =
      f.text[0] === f.text[0]?.toUpperCase() && key !== "i'm" && key !== "i've" && key !== "i'll" && key !== "i'd"
        ? expansion.charAt(0).toUpperCase() + expansion.slice(1)
        : expansion
    issues.push(
      issue(
        'contraction',
        'error',
        `Contractions are not used in academic writing — write the full form: ${f.text} → ${cased}.`,
        f.start,
        f.end,
        doc,
      ),
    )
  }
}

/* ----------------------------- informal-register --------------------------- */

const GET_ADJ_RE =
  /\b(?:get|gets|getting|got)\s+(?:(?:much|far|even)\s+)?(healthier|stronger|younger|worried|stressed|involved|popular|famous|smaller|cheaper|weaker|better|easier|harder|bigger|larger|higher|lower|faster|slower|richer|poorer|older|busier|angry|tired|healthy|bored|worse|sick|rich|poor|old|young|busy|fat|thin|ill)\b/gi

const BIG_ABSTRACT_RE =
  /\bbig\s+((?:problem|issue|impact|effect|influence|change|difference|role|advantage|disadvantage|benefit|challenge|opportunity|improvement|increase|decrease|amount|number|factor|concern|risk|pressure|responsibility)s?)\b/gi

interface RegisterEntry {
  re: RegExp
  message: (f: Found) => string
  /**
   * Marks the second-person clause — the only LEXICON entry a letter has to
   * stand down. (The exclamation and rhetorical-question clauses stand down too,
   * but they live outside this table.) See the tone guard in `registerIssues`.
   */
  addressesReader?: true
  /**
   * Marks an entry whose span `gt-tone-mismatch` also covers in a letter
   * (`letterAchievement.ts` FORMAL_VIOLATION_MARKERS carries `guys` and
   * `gonna`/`wanna`). One mistake, one issue — see the tone guard in
   * `registerIssues`.
   */
  ownedByToneRule?: true
}

// 'a lot of' / 'lots of' are handled by the vague-quantifier rule only, so one
// span never carries two warnings.
const REGISTER_LEXICON: RegisterEntry[] = [
  {
    re: /\bkids?\b/gi,
    message: (f) =>
      `'${f.text.toLowerCase()}' is informal — write '${f.text.toLowerCase() === 'kid' ? 'child' : 'children'}'.`,
  },
  {
    re: /\bstuff\b/gi,
    message: () => `'stuff' is informal and vague — name what you mean: 'factors' or 'aspects'.`,
  },
  {
    re: GET_ADJ_RE,
    message: (f) =>
      `'${f.text}' is conversational — write 'become ${(f.groups[0] ?? '').toLowerCase()}' (use 'obtain' when something is acquired).`,
  },
  {
    re: /\b(?:gonna|wanna)\b/gi,
    message: (f) =>
      `'${f.text.toLowerCase()}' is spoken English — write '${f.text.toLowerCase() === 'gonna' ? 'going to' : 'want to'}'.`,
    ownedByToneRule: true,
  },
  {
    re: /\bguys\b/gi,
    message: () => `'guys' is informal — use 'people' or 'individuals'.`,
    ownedByToneRule: true,
  },
  {
    re: /\bok(?:ay)?\b/gi,
    message: (f) => `'${f.text.toLowerCase()}' is informal — use 'acceptable' or 'satisfactory'.`,
  },
  {
    re: /\b(?:kind|sort) of\b/gi,
    message: (f) => `'${f.text.toLowerCase()}' softens your point informally — delete it or use 'somewhat'.`,
  },
  {
    re: /\betc\b\.?/gi,
    message: () => `'etc.' leaves the list unfinished — name the remaining items instead.`,
  },
  {
    re: /\band so on\b/gi,
    message: () => `'and so on' leaves the list unfinished — name the items you mean.`,
  },
  {
    re: /\breally\b/gi,
    message: () => `'really' adds emphasis without precision — delete it, or use 'considerably'.`,
  },
  {
    re: /\btotally\b/gi,
    message: () => `'totally' is conversational — use 'completely', or delete it.`,
  },
  {
    re: /\bbasically\b/gi,
    message: () => `'basically' is filler in academic writing — delete it.`,
  },
  {
    re: /\bhuge\b/gi,
    message: () => `'huge' is informal — use 'substantial' or 'considerable'.`,
  },
  {
    re: BIG_ABSTRACT_RE,
    message: (f) =>
      `'big ${(f.groups[0] ?? '').toLowerCase()}' is conversational — write 'significant ${(f.groups[0] ?? '').toLowerCase()}'.`,
  },
  {
    // Lookahead skips "you're"/"you've" etc. — those are flagged as contractions.
    re: /\b(?:you|your)\b(?!['’])/gi,
    message: (f) => `Avoid addressing the reader as '${f.text.toLowerCase()}' — write about 'people' or 'individuals'.`,
    addressesReader: true,
  },
]

const EXCLAMATION_RE = /!+/g
const QUESTION_RE = /\?+/g

function registerIssues(doc: TokenizedDoc, issues: Issue[], tone?: LetterTone): void {
  // `tone` is supplied ONLY by `analyzeLetter`, so its mere presence — at ANY
  // register — is the signal "this answer is a letter, not an essay". Four
  // clauses below stand down on it: two because the Task 2 rule gives actively
  // wrong advice about a letter (second-person address, rhetorical questions),
  // and two because `gt-tone-mismatch` already owns the same span with the same
  // fix (the exclamation clause below, and `guys`/`gonna`/`wanna` in the table
  // above). See SPEC.md "The `lexical.ts` tone guard".
  const isLetter = tone !== undefined

  for (const entry of REGISTER_LEXICON) {
    // STAND-DOWN 1 — the second-person clause, for EVERY letter tone.
    // A LETTER addresses its reader; that is what a letter is for. The
    // second-person clause exists because a Task 2 essay must argue
    // impersonally, and its fix ("write about 'people' or 'individuals'") is
    // actively wrong advice inside "I would be grateful if you could confirm".
    // Left in place it accuses a correct formal letter once per sentence, so it
    // stands down for every letter tone, not only the informal one.
    if (entry.addressesReader && isLetter) continue

    // STAND-DOWN — entries `gt-tone-mismatch` already covers, for EVERY letter
    // tone. `letterAchievement.ts` FORMAL_VIOLATION_MARKERS carries `guys` and
    // `gonna`/`wanna` too, on the SAME span with the SAME fix. Left in place
    // both fired, reporting one mistake as two and charging it twice to the LR
    // register count (letterBandEstimate.ts:219).
    if (entry.ownedByToneRule && isLetter) continue

    for (const f of findAll(entry.re, doc.text)) {
      issues.push(issue('informal-register', 'warning', entry.message(f), f.start, f.end, doc))
    }
  }

  // '!' anywhere (one issue per run of !).
  //
  // STAND-DOWN 2 — the exclamation clause, for EVERY letter tone. Two separate
  // reasons, one per direction of the tone system, and both are false accusations:
  //
  //  - INFORMAL: '!' is correct English in a letter to a friend. "The spare room
  //    is ready — come whenever you like!" is exactly the register the task asks
  //    for, and this message ("No exclamation marks in ACADEMIC writing") is
  //    about a genre the learner was not asked to write.
  //  - FORMAL / SEMI-FORMAL: '!' really is wrong there, and `gt-tone-mismatch`
  //    in `letterAchievement.ts` already says so — inline, on the same span,
  //    with the same fix ("end the sentence with a full stop"), and naming the
  //    register this particular letter has to hold. Leaving both in place
  //    reported ONE mistake as TWO in the feedback panel and charged it twice in
  //    the band estimate, where `letterBandEstimate.ts` counts `informal-register`
  //    and `gt-tone-mismatch` into the same register total. That is the policy
  //    `letterAchievement.ts` already states for "Hi Dave": one mistake, one
  //    issue. `gt-tone-mismatch` owns '!' inside a letter because it is the rule
  //    that knows which register this letter is being marked against.
  if (!isLetter) {
    for (const f of findAll(EXCLAMATION_RE, doc.text)) {
      issues.push(
        issue(
          'informal-register',
          'warning',
          'No exclamation marks in academic writing — end the sentence with a full stop.',
          f.start,
          f.end,
          doc,
        ),
      )
    }
  }

  // '?' outside the first paragraph reads as a rhetorical question.
  //
  // STAND-DOWN 3 — the rhetorical-question clause, for EVERY letter tone. This
  // is the one that mattered most, because the engine was penalising exactly
  // what the task ORDERED. General Training bullets routinely say "ask what your
  // friend has been doing" (gt-13), "ask for advice about where to stay" and
  // "ask what you should see" (gt-15), "ask for the help you need" (gt-09) — and
  // a formal letter asks too ("Could you confirm which option you can offer?").
  // A learner who complied was told to turn the question into a statement; a
  // learner who then complied with THAT lost the bullet to `gt-bullet-uncovered`,
  // an ERROR that caps Task Achievement at 5.5. There is no narrower guard
  // available: nothing here can tell a rhetorical question from the one the task
  // demanded, and in a letter the demanded one is the common case. So the clause
  // stands down for letters entirely and keeps its full force for Task 2 and
  // Academic Task 1, where questions genuinely are rhetorical.
  if (isLetter) return
  const firstParagraphEnd =
    doc.paragraphs.length > 0 ? doc.paragraphs[0].end : Number.POSITIVE_INFINITY
  for (const f of findAll(QUESTION_RE, doc.text)) {
    if (f.start < firstParagraphEnd) continue
    issues.push(
      issue(
        'informal-register',
        'warning',
        'Rhetorical questions weaken academic tone — turn this question into a statement.',
        f.start,
        f.end,
        doc,
      ),
    )
  }
}

/* ----------------------------- vague-quantifier ---------------------------- */

const VAGUE_QUANTIFIERS: Array<{ re: RegExp; message: string }> = [
  {
    re: /\ba lot of\b/gi,
    message: `'a lot of' is vague — how many? Use 'many', 'much', or 'a great deal of'.`,
  },
  {
    re: /\blots of\b/gi,
    message: `'lots of' is vague — how many? Use 'many', 'much', or 'a great deal of'.`,
  },
  {
    re: /\bplenty of\b/gi,
    message: `'plenty of' is informal and vague — use 'many' or 'considerable'.`,
  },
  {
    re: /\ba couple of\b/gi,
    message: `'a couple of' is conversational — state the number, or use 'several'.`,
  },
]

const VERY_ADJ_RE = /\bvery\s+([a-z]+)\b/gi

function vagueQuantifierIssues(doc: TokenizedDoc, issues: Issue[]): void {
  for (const q of VAGUE_QUANTIFIERS) {
    for (const f of findAll(q.re, doc.text)) {
      issues.push(issue('vague-quantifier', 'warning', q.message, f.start, f.end, doc))
    }
  }

  // 'very + adjective' becomes an issue from the 3rd 'very' onwards.
  const veryHits = findAll(VERY_ADJ_RE, doc.text)
  if (veryHits.length >= 3) {
    for (let i = 2; i < veryHits.length; i += 1) {
      const f = veryHits[i]
      issues.push(
        issue(
          'vague-quantifier',
          'warning',
          `'very' appears ${veryHits.length} times — replace 'very + adjective' with one precise word: very important → crucial, very common → widespread, very serious → significant.`,
          f.start,
          f.end,
          doc,
        ),
      )
    }
  }
}

/* ----------------------------- weak-vocabulary ----------------------------- */

const WEAK_GROUPS: Array<{ forms: string[]; swaps: string }> = [
  { forms: ['good'], swaps: `'beneficial', 'valuable' or 'effective'` },
  { forms: ['bad'], swaps: `'detrimental', 'harmful' or 'damaging'` },
  { forms: ['nice'], swaps: `'favourable' or 'appealing'` },
  { forms: ['thing', 'things'], swaps: `'factors', 'aspects' or 'issues'` },
]

function weakVocabularyIssues(doc: TokenizedDoc, issues: Issue[]): void {
  for (const group of WEAK_GROUPS) {
    const formSet = new Set(group.forms)
    const hits = doc.words.filter((w) => formSet.has(w.lower))
    if (hits.length <= 2) continue
    // Flag occurrences beyond the 2nd.
    for (let i = 2; i < hits.length; i += 1) {
      const t = hits[i]
      issues.push(
        issue(
          'weak-vocabulary',
          'info',
          `'${t.lower}' appears ${hits.length} times — from the third use it reads as limited vocabulary. Try ${group.swaps}.`,
          t.start,
          t.end,
          doc,
        ),
      )
    }
  }
}

/* -------------------------------- repetition ------------------------------- */

/**
 * Compact stopword list (~170 words) skipped by the repetition rule. Words
 * under 4 characters are never counted, so the list only carries longer forms
 * (plus base stems the stemmer reduces to). 'people' is deliberately absent —
 * it has its own dedicated repetition message. good/bad/nice/thing/stuff are
 * here because weak-vocabulary and informal-register already own them, and the
 * common linkers because cohesion's linking-repetition already owns those.
 */
const STOPWORDS = new Set(
  `this that these those itself himself hers herself they them their themselves
   ours ourselves mine myself your yours yourself whom whose which what someone
   anyone everyone nothing something anything everything were been being have
   having does doing cannot could might must shall should will would need come
   make take give want seem keep goes going made making takes taken taking
   given used uses using says said know about above across after against along
   among around because before below between both down during either from into
   neither onto over since than through toward under unless until upon while
   with within without whether though although again almost already also always
   enough especially even ever every further hence here however indeed instead
   just least less like likely little long many more moreover most much never
   nevertheless next often once only other otherwise perhaps quite rather
   really same several some sometimes still such then there therefore thus very
   well when where first second good nice thing stuff time year days ways lots
   furthermore finally firstly secondly overall`
    .trim()
    .split(/\s+/),
)

/** Undouble a final geminate consonant after stripping -ed/-ing (plan[n], stop[p]…). */
function undouble(w: string): string {
  const n = w.length
  if (n >= 4 && w[n - 1] === w[n - 2] && /[bcdfgmnprt]/.test(w[n - 1])) {
    return w.slice(0, -1)
  }
  return w
}

/** Naive one-suffix stem: -ies→y, -es, -s, -ed, -ing, -ly with basic consonant handling. */
function stemWord(w: string): string {
  if (w.length >= 5 && w.endsWith('ies')) return w.slice(0, -3) + 'y'
  if (w.length >= 5 && /(?:ches|shes|sses|xes|zes)$/.test(w)) return w.slice(0, -2)
  if (w.length >= 4 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) {
    return w.slice(0, -1)
  }
  if (w.length >= 5 && w.endsWith('ed')) return undouble(w.slice(0, -2))
  if (w.length >= 6 && w.endsWith('ing')) return undouble(w.slice(0, -3))
  if (w.length >= 5 && w.endsWith('ly')) return undouble(w.slice(0, -2))
  return w
}

const ALPHA_RE = /^[a-z]+$/

function repetitionIssues(doc: TokenizedDoc, prompt: PromptSpec | null, issues: Issue[]): void {
  // Prompt keywords and their stems are legitimate topic vocabulary — skip them.
  const keywordSet = new Set<string>()
  for (const kw of prompt?.keywords ?? []) {
    const lower = kw.toLowerCase()
    keywordSet.add(lower)
    keywordSet.add(stemWord(lower))
  }

  const groups = new Map<string, Token[]>()
  for (const token of doc.words) {
    const lower = token.lower
    if (lower.length < 4 || !ALPHA_RE.test(lower)) continue
    const stem = stemWord(lower)
    // 'people' keeps its dedicated check even when it is a prompt keyword —
    // the fix (individuals, citizens) applies regardless of the topic.
    if (stem !== 'people') {
      if (STOPWORDS.has(lower) || STOPWORDS.has(stem)) continue
      if (keywordSet.has(lower) || keywordSet.has(stem)) continue
    }
    const list = groups.get(stem)
    if (list) list.push(token)
    else groups.set(stem, [token])
  }

  // Repetition is a DENSITY, not a raw count: six uses of a topic noun across
  // 340 words is ordinary topic vocabulary, the same six across 250 words is a
  // narrow range. 2% of the essay, floored at the old flat 5 so a
  // minimum-length essay keeps its original calibration.
  const baseThreshold = Math.max(5, Math.ceil(doc.wordCount / 50))

  for (const [stem, tokens] of groups) {
    const isPeople = stem === 'people'
    const threshold = isPeople ? baseThreshold + 1 : baseThreshold
    if (tokens.length < threshold) continue

    // Name the most frequent surface form in the message.
    const formCounts = new Map<string, number>()
    for (const t of tokens) {
      formCounts.set(t.lower, (formCounts.get(t.lower) ?? 0) + 1)
    }
    let surface = tokens[0].lower
    let best = 0
    for (const [form, count] of formCounts) {
      if (count > best) {
        best = count
        surface = form
      }
    }

    const message = isPeople
      ? `'people' appears ${tokens.length} times — swap some uses for 'individuals', 'citizens', or 'members of the public'.`
      : `'${surface}' appears ${tokens.length} times — repeating one content word reads as a narrow range. Swap in a synonym or rephrase the sentence.`

    // ONE issue per over-used stem. The message is essay-level ("appears N
    // times"), so emitting it per occurrence stacked the same sentence four
    // times in the feedback panel and let a single repeated word trip the
    // "content words repeat often" band penalty on its own. Anchor it on the
    // 3rd use — the first that is arguably one too many.
    const anchor = tokens[2]
    issues.push(issue('repetition', 'warning', message, anchor.start, anchor.end, doc))
  }
}

/* ----------------------------- memorised-phrase ---------------------------- */

/**
 * ~30-entry cliché bank as tolerant regex sources (optional determiners and
 * inflections; single spaces are compiled to \s+). 'nowadays' is handled
 * separately — it is only a problem from its 2nd use.
 */
const MEMORISED_BANK_SOURCES: string[] = [
  'every coin has two sides',
  '(?:a |the )?double[-\\s]edged sword',
  'in a nutshell',
  'last but not (?:the )?least',
  'as we all know',
  'as is known to all',
  'it goes without saying',
  'with the (?:rapid |fast |continuous )?(?:development|advancement|progress|growth) of (?:society|technology|science and technology|modern society|the internet|the economy)',
  'in this day and age',
  'since the dawn of time',
  'in the modern era',
  '(?:a |the )?hotly[-\\s]debated (?:topic|issue|subject)',
  'play(?:s|ed|ing)? an? (?:indispensable|vital) role in our (?:daily )?(?:life|lives)',
  'this essay will discuss both views and give my own opinion',
  'there (?:are|is) a (?:wide |great )?variety of reasons',
  "in today['’]s (?:modern )?(?:world|society)",
  'it is universally acknowledged(?: that)?',
  'it is common knowledge that',
  'as the (?:old )?saying goes',
  '(?:all|every) walks? of life',
  'with each passing day',
  'where there is a will,? there is a way',
  'actions speak louder than words',
  'time and tide waits? for no (?:man|one)',
  'kill(?:s|ing)? two birds with one stone',
  'at the end of the day',
  'needless to say',
  'the icing on the cake',
  'there is no denying(?: that)?',
  'it cannot be denied(?: that)?',
]

const MEMORISED_BANK: RegExp[] = MEMORISED_BANK_SOURCES.map(
  (src) => new RegExp(`\\b${src.replace(/ /g, '\\s+')}\\b`, 'gi'),
)

const NOWADAYS_RE = /\bnowadays\b/gi

function memorisedPhraseIssues(doc: TokenizedDoc, issues: Issue[]): void {
  let totalHits = 0

  for (const re of MEMORISED_BANK) {
    const hits = findAll(re, doc.text)
    if (hits.length === 0) continue
    totalHits += hits.length
    for (const f of hits) {
      issues.push(
        issue(
          'memorised-phrase',
          'warning',
          `'${f.text.replace(/\s+/g, ' ')}' is a memorised phrase examiners recognise and discount — make the point in your own words.`,
          f.start,
          f.end,
          doc,
        ),
      )
    }
  }

  // 'nowadays' is fine once; from the 2nd use it reads as a template opener.
  const nowadays = findAll(NOWADAYS_RE, doc.text)
  if (nowadays.length >= 2) {
    totalHits += nowadays.length - 1
    for (let i = 1; i < nowadays.length; i += 1) {
      const f = nowadays[i]
      issues.push(
        issue(
          'memorised-phrase',
          'warning',
          `'Nowadays' appears ${nowadays.length} times — repeated, it reads as a memorised opener. Vary the time reference ('in recent years') or cut it.`,
          f.start,
          f.end,
          doc,
        ),
      )
    }
  }

  if (totalHits >= 3) {
    issues.push(
      issue(
        'memorised-phrase',
        'error',
        'Template writing risks a Lexical Resource penalty — examiners discount memorised language.',
        null,
        null,
        doc,
      ),
    )
  }
}

/* --------------------------------- rule fn --------------------------------- */

/**
 * `tone` is the letter register, supplied ONLY by `analyzeLetter`. It is the
 * single tone-dependent branch in the rule engine, and it is here because
 * register is the one thing General Training Task 1 changes about what counts as
 * correct English: "I can't wait to see you" is right in a letter to a friend
 * and wrong in a letter to a bank.
 *
 * `analyzeEssay` and `analyzeTask1` pass no tone and reach exactly the code they
 * reached before — the existing suites prove it. If a SECOND rule module ever
 * needs tone, pass a small context object rather than growing this list further.
 */
export const lexicalRules: RuleFn = (
  doc: TokenizedDoc,
  prompt: PromptSpec | null,
  task?: TaskKind,
  tone?: LetterTone,
): Issue[] => {
  void task // accepted for RuleFn compatibility; lexical rules are task-blind
  const issues: Issue[] = []
  contractionIssues(doc, issues, tone)
  registerIssues(doc, issues, tone)
  vagueQuantifierIssues(doc, issues)
  weakVocabularyIssues(doc, issues)
  repetitionIssues(doc, prompt, issues)
  memorisedPhraseIssues(doc, issues)
  return issues
}
