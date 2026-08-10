/**
 * Answer-key completeness lint. Implements SPEC.md "The other half of that rule:
 * keys must be COMPLETE".
 *
 * `markAnswerKey` never guesses at equivalence — see its header — so every
 * rendering a real examiner accepts has to be written into `question.answers`
 * by hand. That is the right design and this file does not change it. What it
 * does is tell the ITEM-WRITER which renderings they still owe, at test time,
 * by generating the forms SPEC's table implies and asking the real marker
 * whether the key already accepts each one.
 *
 * **This module is test/build-time only.** It is not imported by
 * `markAnswerKey.ts` and must never be. A lint is visible to the author, who
 * decides whether the exam really accepts a form and writes it into the key; a
 * runtime transform is invisible to everyone, makes `answers` no longer the
 * truth about what is marked right, and turns the `accepted` list the report
 * shows a learner into a lie.
 *
 * **It covers three of SPEC's four classes and no more.** Numbers, preprinted
 * units and symbols, and times are closed transformations of a value and can be
 * enumerated completely. "Every spelling variant the exam accepts" is not a
 * function of the answer string — `metres/meters` is a lookup, `cross-dating /
 * cross dating / crossdating` is a judgement about one compound — and guessing
 * there would make keys accept forms the real exam rejects, which is the
 * OVER-scoring direction and worse than the gap it would close. A clean lint
 * therefore does not mean a complete key: it says nothing about the spelling
 * and hyphenation class, which stays the item-writer's judgement.
 */
import type { ReadingQuestionType } from '../reading/types'
import { markAnswerKey, normaliseAnswer } from './markAnswerKey'

/* ---------------------------------- inputs ---------------------------------- */

/**
 * The minimum a question must expose to be linted. Both `CompletionQuestion`
 * (Reading) and `ListeningCompletionQuestion` satisfy it structurally — the
 * Listening variant is the Reading one minus `passageIndex` — so one function
 * covers both papers without either module importing the other.
 */
export interface LintableQuestion {
  id: string
  number: number
  /** Only 'completion' is linted; anything else returns []. */
  type: ReadingQuestionType
  /** The gapped sentence as printed, gap marked by a run of underscores. */
  prompt: string
  /** Absent on the non-completion types, exactly as in `MarkableQuestion`. */
  maxWords?: number
  answers: string[]
}

export type KeyLintClass = 'number' | 'unit' | 'time'

export interface KeyLintFinding {
  questionId: string
  questionNumber: number
  klass: KeyLintClass
  /** The rendering the key does not accept. */
  missing: string
  /** Which listed answer implied it, so the author can see the derivation. */
  from: string
  /** One sentence for the item-writer, quoting the SPEC class. */
  reason: string
}

/**
 * Every rendering SPEC's numbers/units/times classes imply for `question` that
 * the key does not already accept. Non-completion questions always return [].
 *
 * Findings are de-duplicated by the rendering itself: the three classes are
 * generated independently and can propose the same missing string from
 * different listed answers (the bare figure of a unit-attached key, say), and
 * reporting the same fix twice would be the "Hi Dave" mistake this codebase
 * elsewhere calls out by name.
 */
export function keyLint(question: LintableQuestion): KeyLintFinding[] {
  if (question.type !== 'completion') return []

  const consumedByTime = new Set<string>()
  const raw = [
    ...timeFindings(question, consumedByTime),
    ...numberFindings(question, consumedByTime),
    ...unitFindings(question),
  ]

  const seen = new Set<string>()
  const findings: KeyLintFinding[] = []
  for (const finding of raw) {
    if (seen.has(finding.missing)) continue
    seen.add(finding.missing)
    findings.push(finding)
  }
  return findings
}

/**
 * Would the marker accept `candidate` for this question, as the key stands?
 *
 * Goes through `markAnswerKey`, which is not a preference but the only option:
 * `isAccepted` and `stripLeadingArticle` are module-private in
 * `markAnswerKey.ts` and cannot be imported. It is also the right option. The
 * marker folds case, strips edge punctuation, normalises typographic quotes and
 * dashes, and treats a leading article as optional on completion answers. A
 * linter that re-derived any of that would eventually disagree with it, and
 * would then demand renderings the marker already accepts — noise, which is how
 * an author learns to ignore a lint.
 *
 * The word limit is read off the result rather than re-checked, because SPEC is
 * explicit that an over-limit form "stays out however right it sounds".
 */
function verdict(question: LintableQuestion, candidate: string): 'accepted' | 'missing' | 'over-limit' {
  const result = markAnswerKey(
    // `module` only selects a band table, and the band is discarded here, so
    // the value is arbitrary. `id` is never read back either.
    { id: 'lint', module: 'academic', questions: [question] },
    { [question.id]: candidate },
  )
  const marked = result.questions[0]
  // Check overWordLimit FIRST: markAnswerKey already makes an over-limit answer
  // `correct: false`, so testing `correct` first would report an over-limit
  // form as a missing key entry, which SPEC says must never reach a finding.
  if (marked.overWordLimit) return 'over-limit'
  return marked.correct ? 'accepted' : 'missing'
}

/* ----------------------------------- time ------------------------------------ */

/** Anchored at both ends, and run over `normaliseAnswer(answer)`. */
const TIME = /^(\d{1,2})[.:]([0-5]\d)(?:\s?(a\.?m|p\.?m))?$/

interface ParsedTime {
  hour: number
  minute: string
  meridiem?: 'am' | 'pm'
}

function parseTime(normalised: string): ParsedTime | null {
  const m = TIME.exec(normalised)
  if (m === null) return null
  const meridiemRaw = m[3]
  const meridiem = meridiemRaw === undefined ? undefined : (meridiemRaw.replace(/\./g, '') as 'am' | 'pm')
  return { hour: Number(m[1]), minute: m[2], meridiem }
}

/**
 * The 24-hour hour a reading unambiguously names, or null when it does not —
 * a bare `6.15` with no am/pm and an hour of 1–11 could be either half of the
 * day, and the linter may not guess which.
 */
function unambiguousHour24(t: ParsedTime): number | null {
  if (t.meridiem === undefined) {
    if (t.hour >= 13 || t.hour === 12 || t.hour === 0) return t.hour
    return null
  }
  const base = t.hour % 12
  return t.meridiem === 'pm' ? base + 12 : base
}

const TIME_REASON =
  'SPEC\'s "times" class: both separators and both clocks, "pm" spaced and closed up, pointed and bare — ten forms for one sailing.'

function timeFindings(question: LintableQuestion, consumed: Set<string>): KeyLintFinding[] {
  // The time class wins over the number class: any answer TIME matches is
  // consumed here and the number class never sees it, whether or not this
  // class ends up generating from it (see the ambiguous-clock case below).
  let canonical: { hour24: number; minute: string; from: string } | null = null

  for (const answer of question.answers) {
    const parsed = parseTime(normaliseAnswer(answer))
    if (parsed === null) continue
    consumed.add(answer)
    if (canonical !== null) continue
    const hour24 = unambiguousHour24(parsed)
    if (hour24 !== null) canonical = { hour24, minute: parsed.minute, from: answer }
  }

  // No listed form was unambiguous — a key listing only "6.15" does not say
  // which half of the day it means, and the linter must not invent one.
  if (canonical === null) return []

  const { hour24, minute, from } = canonical
  const HH = String(hour24).padStart(2, '0')
  const h12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  const meridiemLetter: 'am' | 'pm' = hour24 < 12 ? 'am' : 'pm'
  const meridiemDotted = `${meridiemLetter[0]}.${meridiemLetter[1]}.`

  const candidates = [
    `${HH}:${minute}`,
    `${HH}.${minute}`,
    `${h12}:${minute}${meridiemLetter}`,
    `${h12}.${minute}${meridiemLetter}`,
    `${h12}:${minute} ${meridiemLetter}`,
    `${h12}.${minute} ${meridiemLetter}`,
    `${h12}:${minute}${meridiemDotted}`,
    `${h12}.${minute}${meridiemDotted}`,
    `${h12}:${minute} ${meridiemDotted}`,
    `${h12}.${minute} ${meridiemDotted}`,
  ]

  const findings: KeyLintFinding[] = []
  for (const candidate of candidates) {
    if (verdict(question, candidate) !== 'missing') continue
    findings.push({
      questionId: question.id,
      questionNumber: question.number,
      klass: 'time',
      missing: candidate,
      from,
      reason: TIME_REASON,
    })
  }
  return findings
}

/* ---------------------------------- number ------------------------------------ */

const ONES_CARDINAL = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
]
const ONES_ORDINAL = [
  'zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
  'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth',
  'nineteenth', 'twentieth',
]
const TENS_CARDINAL: Record<number, string> = {
  20: 'twenty', 30: 'thirty', 40: 'forty', 50: 'fifty', 60: 'sixty', 70: 'seventy', 80: 'eighty', 90: 'ninety',
}
const TENS_ORDINAL: Record<number, string> = {
  20: 'twentieth', 30: 'thirtieth', 40: 'fortieth', 50: 'fiftieth', 60: 'sixtieth', 70: 'seventieth',
  80: 'eightieth', 90: 'ninetieth',
}

/**
 * Cardinal word forms for a bounded set of values: 0–20 by name, the tens
 * 30–90, composition for 21–99 (both the hyphen and the space form — the
 * marker treats them as different strings), 100 and 1,000. Nothing above that:
 * no candidate writes "twenty-six thousand four hundred" into a two-word gap,
 * and the word limit would reject it anyway.
 */
function cardinalWords(value: number): string[] {
  if (value >= 0 && value <= 20) return [ONES_CARDINAL[value]]
  if (value % 10 === 0 && TENS_CARDINAL[value] !== undefined) return [TENS_CARDINAL[value]]
  if (value > 20 && value < 100) {
    const tensWord = TENS_CARDINAL[Math.floor(value / 10) * 10]
    if (tensWord === undefined) return []
    const onesWord = ONES_CARDINAL[value % 10]
    return [`${tensWord}-${onesWord}`, `${tensWord} ${onesWord}`]
  }
  if (value === 100) return ['one hundred']
  if (value === 1000) return ['one thousand']
  return []
}

/** Ordinal word forms, same bounds as `cardinalWords`. Date-gap carve-out only. */
function ordinalWords(value: number): string[] {
  if (value >= 1 && value <= 20) return [ONES_ORDINAL[value]]
  if (value % 10 === 0 && TENS_ORDINAL[value] !== undefined) return [TENS_ORDINAL[value]]
  if (value > 20 && value < 100) {
    const tensWord = TENS_CARDINAL[Math.floor(value / 10) * 10]
    if (tensWord === undefined) return []
    const onesWord = ONES_ORDINAL[value % 10]
    return [`${tensWord}-${onesWord}`, `${tensWord} ${onesWord}`]
  }
  return []
}

/** The bare figure, and — for a four-digit value — the comma-grouped pair too. */
function figureForms(value: number): string[] {
  if (value < 0 || value > 9999) return []
  const bare = String(value)
  if (value < 1000) return [bare]
  const grouped = bare.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return grouped === bare ? [bare] : [bare, grouped]
}

/** '14' -> '14th'. Date-gap carve-out only; an ordinary completion never gets one. */
function ordinalFigure(value: number): string | null {
  if (value < 1 || value > 9999) return null
  const lastTwo = value % 100
  const lastOne = value % 10
  const suffix =
    lastTwo >= 11 && lastTwo <= 13 ? 'th' : lastOne === 1 ? 'st' : lastOne === 2 ? 'nd' : lastOne === 3 ? 'rd' : 'th'
  return `${value}${suffix}`
}

const CARDINAL_WORD_TO_VALUE = new Map<string, number>()
for (let n = 0; n <= 20; n++) CARDINAL_WORD_TO_VALUE.set(ONES_CARDINAL[n], n)
for (const [tensKey, word] of Object.entries(TENS_CARDINAL)) CARDINAL_WORD_TO_VALUE.set(word, Number(tensKey))
for (let n = 21; n < 100; n++) {
  if (n % 10 === 0) continue
  const tensWord = TENS_CARDINAL[Math.floor(n / 10) * 10]
  const onesWord = ONES_CARDINAL[n % 10]
  CARDINAL_WORD_TO_VALUE.set(`${tensWord}-${onesWord}`, n)
  CARDINAL_WORD_TO_VALUE.set(`${tensWord} ${onesWord}`, n)
}
CARDINAL_WORD_TO_VALUE.set('one hundred', 100)
CARDINAL_WORD_TO_VALUE.set('one thousand', 1000)

const ORDINAL_WORD_TO_VALUE = new Map<string, number>()
for (let n = 1; n <= 20; n++) ORDINAL_WORD_TO_VALUE.set(ONES_ORDINAL[n], n)
for (const [tensKey, word] of Object.entries(TENS_ORDINAL)) ORDINAL_WORD_TO_VALUE.set(word, Number(tensKey))
for (let n = 21; n < 100; n++) {
  if (n % 10 === 0) continue
  const tensWord = TENS_CARDINAL[Math.floor(n / 10) * 10]
  if (tensWord === undefined) continue
  const onesWord = ONES_ORDINAL[n % 10]
  ORDINAL_WORD_TO_VALUE.set(`${tensWord}-${onesWord}`, n)
  ORDINAL_WORD_TO_VALUE.set(`${tensWord} ${onesWord}`, n)
}

/**
 * A whitespace-guarded figure: `18:15`, `18.15`, `0.9` and `14th` all fail this
 * on purpose, because every digit in them is adjacent to a `:`, `.` or a
 * trailing letter — that adjacency is what keeps the number class out of the
 * time class's territory and out of a decimal or an ordinal it does not own.
 */
const FIGURE_WHOLE = /^(?:\d{1,3}(?:,\d{3})+|\d{1,4})$/

/** An ordinal figure such as `14th`. Recognised only inside a date gap. */
const ORDINAL_FIGURE_WHOLE = /^\d{1,4}(?:st|nd|rd|th)$/

function figureValue(token: string): number | null {
  if (!FIGURE_WHOLE.test(token)) return null
  return Number(token.replace(/,/g, ''))
}

/** The cardinal value of a normalised string, when the WHOLE string is a count token. */
function cardinalValue(normalised: string): number | null {
  const figure = figureValue(normalised)
  if (figure !== null) return figure
  return CARDINAL_WORD_TO_VALUE.get(normalised) ?? null
}

/** The cardinal value implied by an ordinal figure or ordinal word. */
function dateOrdinalValue(normalised: string): number | null {
  if (ORDINAL_FIGURE_WHOLE.test(normalised)) {
    const value = Number(normalised.replace(/(?:st|nd|rd|th)$/, ''))
    return Number.isNaN(value) ? null : value
  }
  return ORDINAL_WORD_TO_VALUE.get(normalised) ?? null
}

/**
 * The count-token value of a whole normalised answer, in the sense step 5
 * defines: a figure, a cardinal word name — or, only when `dateGap` is true, an
 * ordinal figure or ordinal word, each mapped to its cardinal (`14th` and
 * `fourteenth` both give 14). Outside a date gap an ordinal is never a count
 * token at all.
 */
function wholeAnswerValue(normalised: string, dateGap: boolean): number | null {
  const cardinal = cardinalValue(normalised)
  if (cardinal !== null) return cardinal
  if (dateGap) return dateOrdinalValue(normalised)
  return null
}

/** The closed list of preprinted units the `unit` class (and form (b) here) recognise. */
const UNIT_WORDS = new Set([
  'metres', 'meters', 'kilometres', 'kilometers', 'km', 'm', 'kg',
  'hertz', 'hz', 'pounds', 'dollars', 'euros', 'per cent', 'percent',
  'minutes', 'hours', 'days', 'weeks', 'months', 'years',
])

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]
const MONTH_RE = new RegExp(`\\b(?:${MONTH_NAMES.join('|')})\\b`, 'i')

/** A gap is a date gap when its prompt names a month — SPEC's own worked example is Q3's "____________ September". */
function isDateGap(prompt: string): boolean {
  return MONTH_RE.test(prompt)
}

function numberReason(dateGap: boolean): string {
  return dateGap
    ? 'SPEC\'s "numbers" class: the ordinal where the gap is a date, e.g. [\'14\', \'14th\', \'fourteenth\'].'
    : 'SPEC\'s "numbers" class: figures and words — every number is written out both ways.'
}

/**
 * Candidates for one count-token source: the ordinal pair inside a date gap
 * (never the bare cardinal word — see the carve-out), or the figure and word
 * forms otherwise. `unit`, when given, is appended to every candidate — used
 * only by form (b) below, never by the date-gap branch (dates do not carry a
 * unit word).
 */
function numberCandidatesFor(value: number, dateGap: boolean, unit?: string): string[] {
  const base: string[] = dateGap
    ? [...(ordinalFigure(value) === null ? [] : [ordinalFigure(value)!]), ...ordinalWords(value)]
    : [...figureForms(value), ...cardinalWords(value)]
  return unit === undefined ? base : base.map((c) => `${c} ${unit}`)
}

function numberFindings(question: LintableQuestion, consumedByTime: Set<string>): KeyLintFinding[] {
  const dateGap = isDateGap(question.prompt)
  const findings: KeyLintFinding[] = []

  for (const answer of question.answers) {
    if (consumedByTime.has(answer)) continue
    const normalised = normaliseAnswer(answer)
    if (normalised === '') continue

    // Form (a): the entire answer is a count token.
    const whole = wholeAnswerValue(normalised, dateGap)
    if (whole !== null) {
      for (const candidate of numberCandidatesFor(whole, dateGap)) {
        if (verdict(question, candidate) !== 'missing') continue
        findings.push({
          questionId: question.id,
          questionNumber: question.number,
          klass: 'number',
          missing: candidate,
          from: answer,
          reason: numberReason(dateGap),
        })
      }
      continue
    }

    // Form (b): the first of exactly two tokens, the second a unit word.
    // Never combined with the date-gap ordinal — a date does not carry a unit.
    const tokens = normalised.split(' ')
    if (tokens.length !== 2 || !UNIT_WORDS.has(tokens[1])) continue
    const firstValue = cardinalValue(tokens[0])
    if (firstValue === null) continue
    for (const candidate of numberCandidatesFor(firstValue, false, tokens[1])) {
      if (verdict(question, candidate) !== 'missing') continue
      findings.push({
        questionId: question.id,
        questionNumber: question.number,
        klass: 'number',
        missing: candidate,
        from: answer,
        reason: numberReason(false),
      })
    }
  }

  return findings
}

/* ----------------------------------- unit ------------------------------------- */

const CURRENCY_SYMBOLS = ['£', '$', '€', '¥']
/** Spelled-out unit for a symbol. `¥` has none in this closed list — no word form is generated for it. */
const CURRENCY_WORDS: Record<string, string> = { '£': 'pounds', '$': 'dollars', '€': 'euros' }

interface GapContext {
  /** A currency symbol immediately before the gap, or null. */
  beforeSymbol: string | null
  /** A unit word immediately after the gap, or null. */
  afterUnit: string | null
}

/** Locates the gap (`/_{2,}/`) and reads the tokens either side of it. Null when the prompt has no such gap at all — the short-answer format. */
function gapContext(prompt: string): GapContext | null {
  const gap = /_{2,}/.exec(prompt)
  if (gap === null) return null

  const before = prompt.slice(0, gap.index)
  const after = prompt.slice(gap.index + gap[0].length)

  let beforeSymbol: string | null = null
  for (const symbol of CURRENCY_SYMBOLS) {
    if (new RegExp(`\\${symbol}\\s?$`).test(before)) {
      beforeSymbol = symbol
      break
    }
  }

  let afterUnit: string | null = null
  const afterMatch = /^\s*([a-zA-Z]+)(?:\s([a-zA-Z]+))?/.exec(after)
  if (afterMatch !== null) {
    const twoWord = afterMatch[2] === undefined ? null : `${afterMatch[1].toLowerCase()} ${afterMatch[2].toLowerCase()}`
    if (twoWord !== null && UNIT_WORDS.has(twoWord)) afterUnit = twoWord
    else if (UNIT_WORDS.has(afterMatch[1].toLowerCase())) afterUnit = afterMatch[1].toLowerCase()
  }

  return { beforeSymbol, afterUnit }
}

/**
 * Strips the gap's own preprinted symbol/unit from a normalised listed answer,
 * so what remains can be tested as a bare count token. Returns the answer
 * unchanged when neither is present — the answer may already be bare.
 */
function coreNumericToken(normalised: string, ctx: GapContext): string {
  if (ctx.beforeSymbol !== null) {
    if (normalised.startsWith(`${ctx.beforeSymbol} `)) return normalised.slice(ctx.beforeSymbol.length + 1)
    if (normalised.startsWith(ctx.beforeSymbol)) return normalised.slice(ctx.beforeSymbol.length)
  }
  if (ctx.afterUnit !== null && normalised.endsWith(` ${ctx.afterUnit}`)) {
    return normalised.slice(0, -(ctx.afterUnit.length + 1))
  }
  return normalised
}

const UNIT_REASON =
  'SPEC\'s "unit or currency symbol preprinted beside the gap" class: written with it repeated and without it.'

function unitFindings(question: LintableQuestion): KeyLintFinding[] {
  const ctx = gapContext(question.prompt)
  if (ctx === null) return []
  if (ctx.beforeSymbol === null && ctx.afterUnit === null) return []

  const findings: KeyLintFinding[] = []

  for (const answer of question.answers) {
    const normalised = normaliseAnswer(answer)
    if (normalised === '') continue

    const core = coreNumericToken(normalised, ctx)
    const value = cardinalValue(core)
    if (value === null) continue

    const bareFigures = figureForms(value)
    const bareWords = cardinalWords(value)
    const targets = new Set<string>([...bareFigures, ...bareWords])

    if (ctx.beforeSymbol !== null) {
      // Symbol-attached forms are generated ONLY from a figure, never a number
      // name — "£fifteen" is not a form anyone writes (see ls-q08's own key).
      for (const figure of bareFigures) {
        targets.add(`${ctx.beforeSymbol}${figure}`)
        targets.add(`${ctx.beforeSymbol} ${figure}`)
      }
      const word = CURRENCY_WORDS[ctx.beforeSymbol]
      if (word !== undefined) {
        for (const figure of bareFigures) targets.add(`${figure} ${word}`)
        for (const cardinal of bareWords) targets.add(`${cardinal} ${word}`)
      }
    }

    if (ctx.afterUnit !== null) {
      for (const figure of bareFigures) targets.add(`${figure} ${ctx.afterUnit}`)
      for (const cardinal of bareWords) targets.add(`${cardinal} ${ctx.afterUnit}`)
    }

    for (const candidate of targets) {
      if (verdict(question, candidate) !== 'missing') continue
      findings.push({
        questionId: question.id,
        questionNumber: question.number,
        klass: 'unit',
        missing: candidate,
        from: answer,
        reason: UNIT_REASON,
      })
    }
  }

  return findings
}
