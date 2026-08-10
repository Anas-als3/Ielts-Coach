/**
 * Task Achievement rules for IELTS General Training Writing Task 1 — the letter.
 * Implements SPEC.md "General Training Task 1 (letters)".
 *
 * These occupy the `TR` criterion slot, which the report labels "Task
 * Achievement" for Task 1 (see `meta.ts → criterionLabel`). The signature takes
 * a `LetterPromptSpec` and is therefore NOT a `RuleFn`, for the same reason
 * `task1AchievementRules` is not: `RuleFn` keeps its `(doc, PromptSpec | null)`
 * shape so the shared rule modules never had to learn about the other tasks.
 *
 * **Why letters suit a deterministic engine better than anything else here.**
 * Letter conventions are formulaic and externally fixed. A candidate loses real
 * marks for things a regex can see with certainty — which greeting goes with
 * which sign-off, whether the purpose was stated, whether all three bullets were
 * answered. None of that needs to understand meaning, and all of it is worth
 * marks.
 *
 * Defensive by design: an empty answer yields no issues, and every rule that
 * could accuse a learner of failing the task is gated so it stays silent when it
 * cannot be sure. A false accusation is worse than a miss, and under-detecting
 * bullet coverage — telling a learner who plainly answered the point that they
 * did not — is the worst thing this app can say.
 */
import type {
  Issue,
  IssueCategory,
  LetterPromptSpec,
  LetterTone,
  Severity,
  TokenizedDoc,
} from '../../types'
import { CATEGORY_META } from '../../meta'

/* ------------------------------ canonical gates ----------------------------- */

/** Letter word-count thresholds — the same numbers as Academic Task 1. */
const MIN_WORDS = 150
const CLOSE_WORDS = 160
const OVER_WORDS = 220

/**
 * Word-count gates. Below these a rule stays silent because the learner has not
 * yet had the chance to do the thing being checked — the same reasoning as the
 * Paragraphing gates in SPEC.md's canonical constants.
 *
 * The greeting gate is low (40) because a greeting is the FIRST thing written:
 * by 40 words a letter that still has no "Dear …" has genuinely skipped it. The
 * sign-off, the bullets and the purpose statement are all judged against a
 * letter in progress, so they wait for 100 words.
 */
const SALUTATION_GATE_WORDS = 40
const LETTER_GATE_WORDS = 100

/**
 * Distinct keywords from one bullet that must appear before the point counts as
 * covered. TWO, never one: a single common word ("time", "work") is not evidence
 * that the learner addressed the bullet, and one accidental hit would let a
 * genuinely unanswered point pass silently.
 */
const BULLET_KEYWORDS_REQUIRED = 2

/**
 * Words of body text scanned for the purpose statement.
 *
 * Deliberately generous. The rule wants "did you say why you are writing near
 * the top", and a letter whose greeting sits on its own line, followed by a
 * short scene-setting sentence, can legitimately reach word 40 before "I am
 * writing to …". Sixty words covers every well-formed opening; anything later
 * than that has genuinely buried the purpose.
 */
const PURPOSE_SCAN_WORDS = 60

/** A sign-off line carries the closing plus, at most, a signature. */
const SIGNOFF_TRAILING_WORDS_MAX = 4

/**
 * The sign-off search window, in non-empty lines counted back from the end.
 *
 * TWO is the standard shape — the closing, then the signature — and it is the
 * window every letter gets for free. Keeping it tight is what stops a mid-letter
 * "regards" or "love" from being mistaken for the closing.
 *
 * `MAX` is how far the window may be EXTENDED backwards, and it exists because
 * standard business layout puts more than a name under the closing:
 *
 *     Yours faithfully,
 *     Daniel Whitfield
 *     Order reference 44718
 *
 * The extension is only ever taken across lines short enough to be part of that
 * tail (`SIGNOFF_TAIL_WORDS_MAX`) — never across prose — so the window cannot
 * reach into the body however many lines `MAX` allows.
 */
const SIGNOFF_TAIL_LINES_MIN = 2
const SIGNOFF_TAIL_LINES_MAX = 4

/**
 * A trailing line this short is a signature, a reference number or an enclosure
 * note, never a paragraph. It is the test the window extension is gated on.
 */
const SIGNOFF_TAIL_WORDS_MAX = 4

/** How far into the first line a comma can sit and still end the greeting. */
const SALUTATION_COMMA_WINDOW = 45

/* -------------------------- the salutation/sign-off table ------------------- */

/**
 * Salutation forms, and what each licenses as a sign-off.
 *
 * The pairing rule is fixed English letter convention and is worth real marks:
 * "Yours faithfully" belongs ONLY with an unnamed recipient, "Yours sincerely"
 * ONLY with a named one. Reversing them is one of the most common marks lost in
 * General Training Task 1, and it is a pure lookup — exactly the kind of thing
 * this engine should catch with certainty.
 *
 * It is encoded as DATA rather than as branching on purpose. A false positive is
 * then fixed by ADDING a row (a greeting or closing form the table did not know
 * about), never by weakening the rule, which is the most valuable deterministic
 * check in the whole letter module.
 */
export type SalutationKind = 'unnamed' | 'named-formal' | 'named-informal'

interface SalutationForm {
  /** Anchored at the start of the greeting candidate; case-insensitive. */
  re: RegExp
  kind: SalutationKind
  /** Tones this greeting suits. A greeting outside them is `gt-salutation-tone`. */
  tones: readonly LetterTone[]
  /** How the greeting is named back to the learner. */
  label: string
}

/**
 * Ordered — the FIRST match wins, so the specific unnamed forms must precede the
 * bare-name pattern. "Dear Sir" has to read as `unnamed`, not as a letter to
 * somebody called Sir.
 */
const SALUTATION_FORMS: readonly SalutationForm[] = [
  {
    re: /^dear\s+sir\s+or\s+madam[,.:!]?$/i,
    kind: 'unnamed',
    tones: ['formal'],
    label: 'Dear Sir or Madam',
  },
  {
    re: /^dear\s+sir\s*\/\s*madam[,.:!]?$/i,
    kind: 'unnamed',
    tones: ['formal'],
    label: 'Dear Sir/Madam',
  },
  {
    re: /^dear\s+(?:sir|sirs|madam|madams)[,.:!]?$/i,
    kind: 'unnamed',
    tones: ['formal'],
    label: 'Dear Sir',
  },
  {
    re: /^to\s+whom\s+it\s+may\s+concern[,.:!]?$/i,
    kind: 'unnamed',
    tones: ['formal'],
    label: 'To whom it may concern',
  },
  {
    // "Dear Sir and Madam" — the `and` variant of the row above. It sits here,
    // ABOVE the two-name rows, because "Sir" and "Madam" are not names: read as
    // `named-*` it would license "Yours sincerely" and reject the "Yours
    // faithfully" this greeting actually calls for, turning a correct letter
    // into a `gt-signoff-pairing` ERROR.
    re: /^dear\s+sirs?\s+and\s+madams?[,.:!]?$/i,
    kind: 'unnamed',
    tones: ['formal'],
    label: 'Dear Sir and Madam',
  },
  {
    // A title plus a surname: "Dear Mr Hughes", "Dear Dr. Ali", "Dear Ms Chen".
    re: /^dear\s+(?:mr|mrs|ms|miss|dr|prof|professor)\.?\s+[a-zà-ÿ][a-zà-ÿ'’-]*(?:\s+[a-zà-ÿ][a-zà-ÿ'’-]*)?[,.:!]?$/i,
    kind: 'named-formal',
    tones: ['formal', 'semi-formal'],
    label: 'Dear Mr/Ms + surname',
  },
  {
    // TWO titles sharing a surname: "Dear Mr and Mrs Hughes". A letter to a
    // couple is ordinary General Training material (landlords, hosts, the
    // neighbours you kept awake), and the single-title row above cannot match it
    // — so without this row a learner who plainly wrote a greeting was told, by
    // an ERROR, that they had not. Same kind and same tones as one title.
    re: /^dear\s+(?:mr|mrs|ms|miss|dr|prof|professor)\.?\s+and\s+(?:mr|mrs|ms|miss|dr|prof|professor)\.?\s+[a-zà-ÿ][a-zà-ÿ'’-]*(?:\s+[a-zà-ÿ][a-zà-ÿ'’-]*)?[,.:!]?$/i,
    kind: 'named-formal',
    tones: ['formal', 'semi-formal'],
    label: 'Dear Mr/Ms + surname',
  },
  {
    // A bare given name: "Dear Anna", "Dear Anna Petrova".
    re: /^dear\s+[a-zà-ÿ][a-zà-ÿ'’-]*(?:\s+[a-zà-ÿ][a-zà-ÿ'’-]*)?[,.:!]?$/i,
    kind: 'named-informal',
    tones: ['semi-formal', 'informal'],
    label: 'Dear + first name',
  },
  {
    // TWO given names: "Dear Anna and Tom". The bare-name row above allows at
    // most two tokens and no conjunction, so it read a perfectly good greeting to
    // a couple as no greeting at all. Placed AFTER the bare-name row so nothing
    // it already matched changes hands, and after the unnamed rows so "Dear Sir
    // and Madam" is still `unnamed`.
    re: /^dear\s+[a-zà-ÿ][a-zà-ÿ'’-]*\s+and\s+[a-zà-ÿ][a-zà-ÿ'’-]*[,.:!]?$/i,
    kind: 'named-informal',
    tones: ['semi-formal', 'informal'],
    label: 'Dear + first name',
  },
  {
    re: /^(?:hi|hello|hey)\s+[a-zà-ÿ][a-zà-ÿ'’-]*[,.:!]?$/i,
    kind: 'named-informal',
    tones: ['informal'],
    label: 'Hi/Hello + first name',
  },
  {
    // "Hi Anna and Tom" — the two-name variant of the row above, for the same
    // reason and with the same kind and tones.
    re: /^(?:hi|hello|hey)\s+[a-zà-ÿ][a-zà-ÿ'’-]*\s+and\s+[a-zà-ÿ][a-zà-ÿ'’-]*[,.:!]?$/i,
    kind: 'named-informal',
    tones: ['informal'],
    label: 'Hi/Hello + first name',
  },
]

interface SignoffForm {
  /** Anchored at the start of a closing line; case-insensitive. */
  re: RegExp
  /** Salutation kinds this closing may follow. Violating it is `gt-signoff-pairing`. */
  licenses: readonly SalutationKind[]
  label: string
}

/**
 * Ordered longest-first so "Yours faithfully" is never read as a bare "Yours",
 * and "Best regards" never as "Regards".
 *
 * The `licenses` column IS the pairing matrix:
 *   faithfully  → unnamed only
 *   sincerely   → named only (either kind)
 *   regards / best wishes → named only (they are warm; an unnamed formal letter
 *                            has not earned warmth)
 *   love / take care / all the best → an informally-named reader only
 */
const SIGNOFF_FORMS: readonly SignoffForm[] = [
  { re: /^yours\s+faithfully\b/i, licenses: ['unnamed'], label: 'Yours faithfully' },
  { re: /^yours\s+sincerely\b/i, licenses: ['named-formal', 'named-informal'], label: 'Yours sincerely' },
  { re: /^yours\s+truly\b/i, licenses: ['named-formal', 'named-informal'], label: 'Yours truly' },
  { re: /^sincerely\s+yours\b/i, licenses: ['named-formal', 'named-informal'], label: 'Sincerely yours' },
  { re: /^kind(?:est)?\s+regards\b/i, licenses: ['named-formal', 'named-informal'], label: 'Kind regards' },
  { re: /^warm(?:est)?\s+regards\b/i, licenses: ['named-formal', 'named-informal'], label: 'Warm regards' },
  { re: /^best\s+regards\b/i, licenses: ['named-formal', 'named-informal'], label: 'Best regards' },
  { re: /^best\s+wishes\b/i, licenses: ['named-formal', 'named-informal'], label: 'Best wishes' },
  { re: /^all\s+the\s+best\b/i, licenses: ['named-informal'], label: 'All the best' },
  { re: /^see\s+you\s+soon\b/i, licenses: ['named-informal'], label: 'See you soon' },
  { re: /^take\s+care\b/i, licenses: ['named-informal'], label: 'Take care' },
  { re: /^regards\b/i, licenses: ['named-formal', 'named-informal'], label: 'Regards' },
  { re: /^love\b/i, licenses: ['named-informal'], label: 'Love' },
]

/**
 * The closing each greeting kind asks for, named in the `gt-signoff-pairing`
 * message so the fix is stated rather than implied.
 */
const PAIRING_FIX: Record<SalutationKind, string> = {
  unnamed: "'Yours faithfully'",
  'named-formal': "'Yours sincerely'",
  'named-informal': "'Yours sincerely' (or 'Best wishes' if you are close to them)",
}

/** How the greeting kind is described back to the learner in a pairing message. */
const SALUTATION_KIND_DESCRIPTION: Record<SalutationKind, string> = {
  unnamed: 'you did not use the reader’s name',
  'named-formal': 'you used the reader’s name',
  'named-informal': 'you used the reader’s name',
}

/* --------------------------------- word lists -------------------------------- */

/**
 * Purpose markers. A strong letter states why it is being written in the opening
 * paragraph, and the phrasings that do it are a short closed set.
 */
const PURPOSE_MARKERS: readonly string[] = [
  'i am writing to',
  "i'm writing to",
  'i’m writing to',
  'i am writing regarding',
  'i am writing in connection with',
  'i am writing with regard to',
  'i am writing about',
  'i am writing because',
  'i would like to',
  "i'd like to",
  'i’d like to',
  'i wish to',
  'this letter is to',
  'the purpose of this letter',
  'i am contacting you',
]

/**
 * Purpose markers accepted ONLY in an informal letter.
 *
 * A letter to a friend announces its news rather than declaring an intention:
 * "You will never guess what has happened" is exactly as clear about why the
 * letter exists as "I am writing to inform you", and it is what the register
 * asks for. Warning about a missing purpose there marks natural, correct English
 * down for not sounding like a bank letter.
 *
 * Kept SEPARATE from the shared list rather than merged into it, because none of
 * these states a purpose in a formal letter — a complaint to a shop that opens
 * "Guess what" has not stated why it is writing, and `gt-purpose-missing` should
 * still say so.
 */
const INFORMAL_PURPOSE_MARKERS: readonly string[] = [
  'you will never guess',
  "you'll never guess",
  'you’ll never guess',
  'guess what',
  'i have some news',
  'i have big news',
  "i've got some news",
  'i’ve got some news',
  'i have to tell you',
  'i must tell you',
  'i had to tell you',
  'let me tell you',
  'i have news',
]

function purposeRe(markers: readonly string[]): RegExp {
  return new RegExp(`(${markers.map(escapeRegExp).join('|')})`, 'i')
}

const PURPOSE_RE = purposeRe(PURPOSE_MARKERS)
const INFORMAL_PURPOSE_RE = purposeRe([...PURPOSE_MARKERS, ...INFORMAL_PURPOSE_MARKERS])

/**
 * Purpose markers accepted only at a SENTENCE START.
 *
 * These say "why I am writing" when they open a sentence — "I wanted to enquire
 * about the charge on my statement" — and say nothing at all in the middle of
 * one: "When I bought a washing machine last month I wanted to have a reliable
 * appliance" is a narrative clause, and an unanchored substring match read it as
 * a stated purpose, silenced gt-purpose-missing and ticked the rail's gt-purpose
 * check GREEN on a formal letter that never says why it exists.
 *
 * They stay accepted (rather than moving to the informal list) because
 * OVERFORMAL_MARKERS tells an informal writer to replace "I am writing to
 * express" with exactly "I wanted to tell you" — two rules must never point in
 * opposite directions.
 */
const SENTENCE_INITIAL_PURPOSE_MARKERS: readonly string[] = [
  'i wanted to',
  'i just wanted to',
  'i thought i would',
  "i thought i'd",
  'i thought i’d',
]

const SENTENCE_INITIAL_PURPOSE_RE = new RegExp(
  `(?:^|[.!?]["'”’)\\]]?\\s|\\n\\s*)(?:${SENTENCE_INITIAL_PURPOSE_MARKERS.map(escapeRegExp).join('|')})`,
  'i',
)

/**
 * The contraction forms that are wrong in a formal or semi-formal letter.
 *
 * Written with a straight apostrophe and compiled with `['’]` in its place, the
 * way `lexical.ts` builds its own contraction regex. A hard-coded `'` matched
 * `can't` and missed `can’t` — and the curly form is what macOS and iOS type by
 * default, so the same learner making the same mistake on a different keyboard
 * got different coaching. Longest-first so no form is swallowed by a shorter one.
 */
const FORMAL_CONTRACTIONS: readonly string[] = [
  "can't", "cannot've", "don't", "doesn't", "didn't", "won't", "wouldn't", "shouldn't",
  "couldn't", "isn't", "aren't", "wasn't", "weren't", "hasn't", "haven't", "hadn't",
  "i'm", "i've", "i'll", "i'd", "you're", "you've", "you'll", "you'd",
  "we're", "we've", "we'll", "it's", "that's", "there's", "let's",
]

const CONTRACTION_RE = new RegExp(
  `\\b(?:${[...FORMAL_CONTRACTIONS]
    .sort((a, b) => b.length - a.length)
    .map((form) => escapeRegExp(form).replace(/'/g, "['’]"))
    .join('|')})\\b`,
  'gi',
)

/**
 * Register markers that are wrong in a FORMAL or SEMI-FORMAL letter.
 *
 * Contractions are included even though `lexical.ts` also reports them here. The
 * overlap is deliberate: the two say different things. `contraction` teaches the
 * full form ("can't → cannot"); `gt-tone-mismatch` teaches that this particular
 * letter has a register to hold, which is the thing being marked in General
 * Training Task 1. In an INFORMAL letter neither fires — see the tone guard in
 * `lexical.ts` and the tone switch below.
 *
 * Exclamation marks are here and NOWHERE else. `informal-register` in
 * `lexical.ts` used to report them too, on the same span with the same fix; it
 * now stands down for every letter tone, so a single '!' is one issue and costs
 * the band estimate once. See SPEC.md "The `lexical.ts` tone guard".
 */
const FORMAL_VIOLATION_MARKERS: readonly { re: RegExp; fix: string }[] = [
  { re: CONTRACTION_RE, fix: 'write the full form' },
  { re: /\b(?:hey|yo)\b/gi, fix: "start with 'Dear …'" },
  { re: /\b(?:guys|mate|mates|folks|buddy|pal)\b/gi, fix: "name the reader properly, or write 'colleagues'" },
  { re: /\b(?:wanna|gonna|gotta|kinda|sorta)\b/gi, fix: 'write it out in full' },
  { re: /\b(?:cheers|thanks a lot|thanks a million|no worries)\b/gi, fix: "write 'thank you' or 'I would be grateful'" },
  {
    // 'no problem' is flagged ONLY in its INTERJECTION reading — a whole clause
    // on its own, "No problem. I will arrange it." Everywhere else it is
    // perfectly good formal English: "that will be no problem", "the delay poses
    // no problem", "no problem has arisen with the replacement". Telling a
    // learner that their correct formal sentence is slang is exactly the false
    // accusation this module exists to avoid.
    //
    // Two boundaries do the work, because the set of words that may
    // legitimately surround the noun-phrase reading is open-ended and a word
    // list would never be complete:
    //   - lookBEHIND: it must OPEN a sentence, so "that will be no problem" is
    //     out of reach;
    //   - lookAHEAD: it must END the sentence there, so the noun phrase — "no
    //     problem arises", "no problem with the account" — is out of reach too.
    // Both are zero-width, so the highlighted span stays on the phrase itself.
    //
    // The lookahead admits '.', '!' and '?' ONLY — not ',', ';', ':' or a dash.
    // Both readings survive a comma or a semicolon: "No problem, however, has
    // arisen with the delivery" and "No problem; the refund was issued in full"
    // are the noun phrase, but "No problem, I will arrange it." is genuinely the
    // interjection. Nothing available here tells the two apart — it would need
    // to know whether what follows the comma opens a new clause — so this is a
    // DELIBERATE false negative: "No problem, I will arrange it." is now silent.
    // A false negative here costs nothing; a false accusation costs trust.
    re: /(?<=^|[.!?]["'”’)\]]?\s)no problem(?=\s*[.!?]|$)/gim,
    fix: "write 'thank you' or 'I would be grateful'",
  },
  { re: /\b(?:awesome|cool|great stuff|super)\b/gi, fix: "use 'excellent' or 'very welcome'" },
  { re: /\b(?:fed up|sick of|a bit of a|pretty much|loads of|tons of)\b/gi, fix: 'state it plainly and formally' },
  { re: /\b(?:sort out|sort it out|check out|put up with)\b/gi, fix: "use a single formal verb ('resolve', 'examine', 'tolerate')" },
  { re: /!+/g, fix: 'end the sentence with a full stop' },
]

/**
 * Register markers that are wrong in an INFORMAL letter.
 *
 * An informal letter that reads like a legal notice is exactly as wrong as a
 * formal letter full of slang, and learners drilled on complaint letters
 * routinely make this mistake. The markers are unambiguous officialese — nothing
 * here has a natural informal reading.
 */
const OVERFORMAL_MARKERS: readonly { re: RegExp; fix: string }[] = [
  { re: /\b(?:henceforth|heretofore|hereby|herewith|aforementioned|undersigned|notwithstanding)\b/gi, fix: 'this is legal wording — say it the way you would say it out loud' },
  { re: /\bpursuant to\b/gi, fix: "write 'about' or 'after'" },
  { re: /\bin accordance with\b/gi, fix: "write 'following' or 'as'" },
  { re: /\bat your earliest convenience\b/gi, fix: "write 'when you get a chance'" },
  { re: /\bprofound dissatisfaction\b/gi, fix: "write 'I was really unhappy'" },
  { re: /\bi look forward to your (?:prompt |early )?(?:reply|response)\b/gi, fix: "write 'let me know what you think'" },
  { re: /\bi would be grateful if you would be so kind as to\b/gi, fix: "write 'could you'" },
  { re: /\bi am writing to express\b/gi, fix: "write 'I wanted to tell you'" },
  { re: /\byours faithfully\b/gi, fix: "close with 'Best wishes' or 'Love'" },
  { re: /\bto whom it may concern\b/gi, fix: 'greet your reader by name' },
]

/* -------------------------------- small helpers ------------------------------ */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

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

interface Line {
  text: string
  start: number
  end: number
}

/**
 * Non-empty lines with ABSOLUTE offsets into the original text.
 *
 * Letters are read line by line rather than paragraph by paragraph, because the
 * tokenizer merges any fragment under five words into its neighbour — and
 * "Dear Anna," and "Yours faithfully," are exactly such fragments. By the time
 * the paragraph list exists the greeting and the sign-off have been absorbed
 * into the body, which is right for paragraph balance and useless for finding
 * them.
 */
function textLines(text: string): Line[] {
  const out: Line[] = []
  const re = /[^\n]+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    let s = m.index
    let e = m.index + m[0].length
    while (s < e && /\s/.test(text.charAt(s))) s++
    while (e > s && /\s/.test(text.charAt(e - 1))) e--
    if (s < e) out.push({ text: text.slice(s, e), start: s, end: e })
  }
  return out
}

function wordsIn(text: string): number {
  const m = text.match(/[A-Za-zÀ-ɏ'’-]+/g)
  return m ? m.length : 0
}

/* ------------------------------- letter parts -------------------------------- */

export interface FoundSalutation {
  form: SalutationForm
  start: number
  end: number
  text: string
}

export interface FoundSignoff {
  form: SignoffForm
  start: number
  end: number
  text: string
}

export interface LetterParts {
  salutation: FoundSalutation | null
  signoff: FoundSignoff | null
  /** Absolute range of the letter BODY: after the greeting, before the sign-off. */
  bodyStart: number
  bodyEnd: number
  /** `text.slice(bodyStart, bodyEnd)` — cached, since three rules scan it. */
  bodyText: string
}

/**
 * The greeting candidate on the first line.
 *
 * A correctly formatted letter puts the greeting on its own line, and that is
 * what the app teaches. But a learner who writes "Dear Sir or Madam, I am
 * writing to complain…" as one run-on line has still written a greeting, and
 * reporting `gt-salutation-missing` — an ERROR — for a formatting habit would be
 * a false accusation. So the first line is tried twice: as a whole, and clipped
 * at its first comma when that comma is close enough to the start to be ending a
 * greeting rather than separating clauses.
 */
function salutationCandidates(line: Line): Line[] {
  const out: Line[] = [line]
  const comma = line.text.indexOf(',')
  if (comma > 0 && comma < SALUTATION_COMMA_WINDOW && comma < line.text.length - 1) {
    out.unshift({
      text: line.text.slice(0, comma + 1),
      start: line.start,
      end: line.start + comma + 1,
    })
  }
  return out
}

function matchSalutation(line: Line): FoundSalutation | null {
  for (const candidate of salutationCandidates(line)) {
    for (const form of SALUTATION_FORMS) {
      if (form.re.test(candidate.text)) {
        return { form, start: candidate.start, end: candidate.end, text: candidate.text }
      }
    }
  }
  return null
}

/**
 * The lines the sign-off may be hiding in: the last two, extended backwards
 * across any further SHORT trailing lines.
 *
 * Two lines is the standard shape — "Yours faithfully," then the signature — and
 * keeping the window tight is what stops a mid-letter "regards" or "love" from
 * being mistaken for the closing.
 *
 * But two lines is not the whole of standard business layout, which puts a
 * reference or an enclosure note under the signature:
 *
 *     Yours faithfully,
 *     Daniel Whitfield
 *     Order reference 44718
 *
 * With a flat two-line window the closing fell outside it, and a correctly
 * formatted business letter was told by an ERROR (−0.5 Task Achievement) that it
 * had no sign-off — while the pairing check, which needs both halves, went
 * silent. It is not a rare shape either: gt-01's own bullet-1 keywords include
 * `receipt` and `order`.
 *
 * The extension is deliberately not "look at more lines". It is taken ONLY
 * across a line short enough to be part of the tail, so the walk stops dead at
 * the first paragraph and the window can never reach the body — the tight-window
 * guarantee is kept, and only the signature block is admitted.
 */

/**
 * Is this line a closing line — a SIGNOFF_FORM at its start with, at most, a
 * name after it?
 *
 * Shared by the window and the matcher on purpose. When only `matchSignoff`
 * knew what a closing looked like, `signoffCandidates` happily extended the
 * window PAST one, and the first match walking forward was then a short body
 * line above the real sign-off: "Best wishes to you." two lines above "Yours
 * faithfully," raised gt-signoff-pairing — an ERROR, −0.5 TA — against a letter
 * that had closed perfectly correctly.
 */
function isClosingLine(line: Line): SignoffForm | null {
  for (const form of SIGNOFF_FORMS) {
    const m = form.re.exec(line.text)
    if (!m) continue
    const trailing = line.text.slice(m[0].length).replace(/^[\s,.:;!-]+/, '')
    if (wordsIn(trailing) > SIGNOFF_TRAILING_WORDS_MAX) continue
    return form
  }
  return null
}

function signoffCandidates(lines: Line[]): Line[] {
  let first = Math.max(0, lines.length - SIGNOFF_TAIL_LINES_MIN)
  // Stop as soon as the window CONTAINS a closing. Extending past one is what
  // let a short body line outrank the real sign-off; the reference/enclosure
  // tail this extension exists for always sits BELOW the closing, never above.
  while (
    first > 0 &&
    !lines.slice(first).some((l) => isClosingLine(l) !== null) &&
    lines.length - first < SIGNOFF_TAIL_LINES_MAX &&
    wordsIn(lines[first - 1].text) <= SIGNOFF_TAIL_WORDS_MAX
  ) {
    first -= 1
  }
  return lines.slice(first)
}

/**
 * The sign-off, searched in the window above.
 *
 * The second guard is length: a closing line carries the closing and at most a
 * name, so a line with more than four words left over after the match is prose,
 * not a sign-off.
 */
function matchSignoff(lines: Line[], salutation: FoundSalutation | null): FoundSignoff | null {
  const candidates = signoffCandidates(lines)
  for (const line of candidates) {
    // The greeting is never also the sign-off. In a two-line draft ("Dear Anna,"
    // / "…") the greeting would otherwise fall inside the search window.
    if (salutation && line.start <= salutation.start && line.end >= salutation.end) continue
    const form = isClosingLine(line)
    if (!form) continue
    const m = form.re.exec(line.text)!
    return {
      form,
      start: line.start + m.index,
      end: line.start + m.index + m[0].length,
      text: m[0],
    }
  }
  return null
}

/**
 * Locate the greeting and the sign-off, and derive the body range between them.
 *
 * Exported because `letterStructure.ts` needs the same answers for the Structure
 * Rail, and re-deriving them there would let the rail and the feedback panel
 * disagree about whether a greeting exists.
 */
export function readLetterParts(doc: TokenizedDoc): LetterParts {
  const lines = textLines(doc.text)
  if (lines.length === 0) {
    return { salutation: null, signoff: null, bodyStart: 0, bodyEnd: 0, bodyText: '' }
  }

  const salutation = matchSalutation(lines[0])
  const signoff = matchSignoff(lines, salutation)

  // The body starts after the greeting and ends where the sign-off begins. A
  // name in the greeting is not bullet coverage, and neither is the signature.
  const bodyStart = salutation ? salutation.end : 0
  const bodyEnd = signoff ? Math.max(bodyStart, signoff.start) : doc.text.length

  return {
    salutation,
    signoff,
    bodyStart,
    bodyEnd,
    bodyText: doc.text.slice(bodyStart, bodyEnd),
  }
}

/* ------------------------------ bullet coverage ------------------------------ */

/**
 * Does `keyword` appear in `lowerBody`?
 *
 * Matched as a PREFIX at a word boundary, so "repair" covers repairs, repaired
 * and repairing without the module carrying a stemmer. The bias is deliberate:
 * a prefix match occasionally counts a word the learner did not quite mean, and
 * the cost of that is silence. The opposite error — failing to see that a
 * learner covered a bullet — tells someone who answered the task correctly that
 * they failed it, which is the single worst thing this app can output.
 */
function keywordPresent(lowerBody: string, keyword: string): boolean {
  const k = keyword.trim().toLowerCase()
  if (k.length === 0) return false
  return new RegExp(`(?:^|[^a-zà-ÿ])${escapeRegExp(k)}`, 'i').test(lowerBody)
}

/**
 * Per-bullet coverage: true when at least two DISTINCT keywords for that bullet
 * appear in the body.
 *
 * A bullet whose keyword list is too short to ever reach the threshold is
 * reported as covered rather than as failed. An unsatisfiable check is a bank
 * authoring bug, and the learner must never pay for it.
 */
export function bulletCoverage(parts: LetterParts, prompt: LetterPromptSpec): boolean[] {
  const lowerBody = parts.bodyText.toLowerCase()
  return prompt.bullets.map((_, i) => {
    const keywords = prompt.bulletKeywords[i] ?? []
    if (keywords.length < BULLET_KEYWORDS_REQUIRED) return true
    const seen = new Set<string>()
    for (const kw of keywords) {
      if (keywordPresent(lowerBody, kw)) seen.add(kw.trim().toLowerCase())
      if (seen.size >= BULLET_KEYWORDS_REQUIRED) return true
    }
    return false
  })
}

/* ------------------------------ purpose statement ---------------------------- */

/** The first `PURPOSE_SCAN_WORDS` words of the body — the letter's opening. */
function openingText(parts: LetterParts): string {
  const words = [...parts.bodyText.matchAll(/[A-Za-zÀ-ɏ'’-]+/g)]
  if (words.length <= PURPOSE_SCAN_WORDS) return parts.bodyText
  const cut = words[PURPOSE_SCAN_WORDS]
  return parts.bodyText.slice(0, cut.index)
}

/**
 * True when the opening says why the letter is being written.
 *
 * `tone` widens the accepted phrasings for an informal letter only — see
 * `INFORMAL_PURPOSE_MARKERS`. It is optional so a caller that has no tone to
 * hand gets exactly the formal set, which is the stricter of the two.
 *
 * `SENTENCE_INITIAL_PURPOSE_RE` is checked in addition, at every tone — it is
 * anchored, so unlike the two lists above it cannot match inside a narrative
 * clause and therefore needs no tone-specific widening.
 */
export function hasPurposeStatement(parts: LetterParts, tone?: LetterTone): boolean {
  const re = tone === 'informal' ? INFORMAL_PURPOSE_RE : PURPOSE_RE
  const opening = openingText(parts)
  return re.test(opening) || SENTENCE_INITIAL_PURPOSE_RE.test(opening)
}

/** True when a greeting and a sign-off were both found AND they pair correctly. */
export function signoffCorrectlyPaired(parts: LetterParts): boolean {
  const { salutation, signoff } = parts
  if (!salutation || !signoff) return false
  return signoff.form.licenses.includes(salutation.form.kind)
}

/* ----------------------------------- rules ----------------------------------- */

function wordCount(doc: TokenizedDoc, out: Issue[]): void {
  const wc = doc.wordCount
  if (wc === 0) return
  if (wc < MIN_WORDS) {
    out.push(
      mk(
        'gt-word-count',
        'error',
        `${wc} words — a Task 1 letter asks for at least ${MIN_WORDS}. Develop whichever bullet point you have said least about.`,
      ),
    )
  } else if (wc < CLOSE_WORDS) {
    out.push(
      mk(
        'gt-word-count',
        'warning',
        `${wc} words — dangerously close to the ${MIN_WORDS}-word minimum. Aim for 170–200 so a miscount cannot cost you the mark.`,
      ),
    )
  } else if (wc > OVER_WORDS) {
    out.push(
      mk(
        'gt-word-count',
        'warning',
        `${wc} words — long for the 20 minutes Task 1 allows, and the extra length earns nothing. Cut detail that does not answer a bullet point.`,
      ),
    )
  }
}

function salutationRules(doc: TokenizedDoc, prompt: LetterPromptSpec, parts: LetterParts, out: Issue[]): void {
  if (!parts.salutation) {
    if (doc.wordCount < SALUTATION_GATE_WORDS) return
    out.push(
      mk(
        'gt-salutation-missing',
        'error',
        `Start with a greeting on its own line. Writing to ${prompt.recipient}, that is ${expectedGreeting(prompt.tone)}.`,
      ),
    )
    return
  }

  const { form, start, end, text } = parts.salutation
  if (form.tones.includes(prompt.tone)) return
  out.push(
    mk(
      'gt-salutation-tone',
      'warning',
      `'${form.label}' does not match a ${prompt.tone} letter to ${prompt.recipient} — open with ${expectedGreeting(prompt.tone)} instead.`,
      start,
      end,
      text,
    ),
  )
}

/** The greeting the prompt's tone asks for, named in both greeting messages. */
function expectedGreeting(tone: LetterTone): string {
  if (tone === 'formal') return "'Dear Sir or Madam,' — or 'Dear Mr/Ms' plus their surname if you know it"
  if (tone === 'semi-formal') return "'Dear' plus their name, for example 'Dear Mr Hughes,' or 'Dear Anna,'"
  return "'Dear' or 'Hi' plus their first name, for example 'Dear Anna,'"
}

function signoffRules(doc: TokenizedDoc, parts: LetterParts, out: Issue[]): void {
  if (!parts.signoff) {
    if (doc.wordCount < LETTER_GATE_WORDS) return
    out.push(
      mk(
        'gt-signoff-missing',
        'error',
        'The letter has no sign-off. Close it on its own line — ‘Yours faithfully’, ‘Yours sincerely’ or ‘Best wishes’ — and write your name underneath.',
      ),
    )
    return
  }

  // The pairing check needs BOTH halves. With only one, the correct pairing is
  // unknowable, and guessing from half the evidence is how a rule starts telling
  // learners their correct letter is wrong.
  if (!parts.salutation) return
  const { salutation, signoff } = parts
  if (signoff.form.licenses.includes(salutation.form.kind)) return

  out.push(
    mk(
      'gt-signoff-pairing',
      'error',
      `'${signoff.form.label}' does not go with '${salutation.form.label}'. You opened '${salutation.text.replace(/[,:]$/, '')}', so ${SALUTATION_KIND_DESCRIPTION[salutation.form.kind]} — close with ${PAIRING_FIX[salutation.form.kind]}.`,
      signoff.start,
      signoff.end,
      signoff.text,
    ),
  )
}

function bulletRules(doc: TokenizedDoc, prompt: LetterPromptSpec, parts: LetterParts, out: Issue[]): void {
  if (doc.wordCount < LETTER_GATE_WORDS) return
  if (prompt.bullets.length === 0) return

  const covered = bulletCoverage(parts, prompt)
  covered.forEach((isCovered, i) => {
    if (isCovered) return
    out.push(
      mk(
        'gt-bullet-uncovered',
        'error',
        `Bullet ${i + 1} is not answered yet — "${prompt.bullets[i]}". All three bullet points must be covered, or the task is only partly done.`,
      ),
    )
  })
}

function purposeRules(doc: TokenizedDoc, prompt: LetterPromptSpec, parts: LetterParts, out: Issue[]): void {
  if (doc.wordCount < LETTER_GATE_WORDS) return
  if (hasPurposeStatement(parts, prompt.tone)) return
  out.push(
    mk(
      'gt-purpose-missing',
      'warning',
      "Say why you are writing in the first paragraph — 'I am writing to …'. A reader should know the point of the letter before the second sentence.",
    ),
  )
}

/**
 * Register faults, chosen by the prompt's tone.
 *
 * Scanned over the BODY only. The greeting and the sign-off have their own rules
 * and their own messages, and flagging "Hi Dave" twice — once as the wrong
 * greeting, once as slang — would report one mistake as two.
 */
function toneRules(prompt: LetterPromptSpec, parts: LetterParts, out: Issue[]): void {
  const markers = prompt.tone === 'informal' ? OVERFORMAL_MARKERS : FORMAL_VIOLATION_MARKERS
  const direction =
    prompt.tone === 'informal'
      ? 'too formal for a letter to someone you know'
      : `too informal for a ${prompt.tone} letter to ${prompt.recipient}`

  for (const marker of markers) {
    const re = new RegExp(marker.re.source, marker.re.flags.includes('g') ? marker.re.flags : `${marker.re.flags}g`)
    let m: RegExpExecArray | null
    while ((m = re.exec(parts.bodyText)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex += 1
        continue
      }
      const start = parts.bodyStart + m.index
      out.push(
        mk(
          'gt-tone-mismatch',
          'warning',
          `'${m[0]}' is ${direction} — ${marker.fix}.`,
          start,
          start + m[0].length,
          m[0],
        ),
      )
    }
  }
}

/* ---------------------------------- export ----------------------------------- */

export function letterAchievementRules(doc: TokenizedDoc, prompt: LetterPromptSpec): Issue[] {
  const issues: Issue[] = []
  // Nothing to say about an empty sheet, and every helper below would be
  // reasoning about a document with no lines.
  if (doc.wordCount === 0) return issues

  const parts = readLetterParts(doc)
  wordCount(doc, issues)
  salutationRules(doc, prompt, parts, issues)
  signoffRules(doc, parts, issues)
  bulletRules(doc, prompt, parts, issues)
  purposeRules(doc, prompt, parts, issues)
  toneRules(prompt, parts, issues)
  return issues
}
