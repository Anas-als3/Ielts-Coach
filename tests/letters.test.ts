/**
 * General Training Task 1 — the letter engine (SPEC.md "General Training Task 1
 * (letters)").
 *
 * Everything here drives the REAL `analyzeLetter`, never a rule module in
 * isolation, because the interactions are the interesting part: the pairing
 * matrix reads the greeting the achievement rules found, the rail reads the same
 * answers, and the tone reaches all the way into `lexicalRules`.
 *
 * Three blocks matter most.
 *
 *  - **Pairing.** "Yours faithfully" belongs only with an unnamed reader and
 *    "Yours sincerely" only with a named one. Both directions are asserted, and
 *    so are the two guards that keep the rule quiet when it only has half the
 *    evidence.
 *  - **Bullets.** Under-detecting coverage tells a learner who answered the task
 *    that they failed it, which is the worst thing this app can output. The
 *    guards — greeting text excluded, two distinct keywords required — are
 *    pinned directly.
 *  - **Regression.** The tone guard in `lexical.ts` must not leak. The last two
 *    cases prove contractions and second-person address still fire for Task 2
 *    and Academic Task 1, which is the only way that guard can go wrong.
 */
import { describe, expect, it } from 'vitest'
import { analyzeEssay, analyzeLetter, analyzeTask1 } from '../src/analysis/engine'
import { LETTER_PROMPTS } from '../src/prompts/letterBank'
import { LETTER_MODELS } from '../src/answers/letterModels'
import { TASK1_PROMPTS } from '../src/prompts/task1Bank'
import { PROMPTS } from '../src/prompts/bank'
import type { Analysis, IssueCategory, LetterPromptSpec } from '../src/types'

/* --------------------------------- fixtures --------------------------------- */

/** gt-01: formal, unnamed reader — a complaint to a shop manager. */
const FORMAL = LETTER_PROMPTS.find((p) => p.id === 'gt-01')!
/** gt-11: informal, a friend — where contractions are correct at the target register. */
const INFORMAL = LETTER_PROMPTS.find((p) => p.id === 'gt-11')!
/** gt-09: semi-formal, a tutor — whose third bullet ORDERS a question. */
const SEMI_FORMAL = LETTER_PROMPTS.find((p) => p.id === 'gt-09')!
/** gt-13 and gt-15: informal, and between them three bullets that order questions. */
const INFORMAL_JOB = LETTER_PROMPTS.find((p) => p.id === 'gt-13')!
const INFORMAL_TRIP = LETTER_PROMPTS.find((p) => p.id === 'gt-15')!

/** A body that covers all three of gt-01's bullets and clears 150 words. */
const FORMAL_BODY = `I am writing to complain about a washing machine which I purchased from your Bridge Street branch on 4 March, and which was delivered to my flat the following week.

Although the appliance was sold as new, it stopped mid-cycle within nine days. The engineer who visited on 20 March explained that the pump was faulty and fitted a replacement part. Four days later the same fault returned, and water spread across my kitchen floor because the drum would not empty.

Since the machine has now broken twice in a single month, I have little confidence that a third repair would hold. I would therefore prefer a full refund, although I would accept an identical model if your delivery team could bring one within a fortnight.

I would be grateful if you could confirm in writing which of these two options you are able to offer me.`

/** A body that covers all three of gt-11's bullets, with contractions throughout. */
const INFORMAL_BODY = `I am writing to tell you that we've finally moved, and I can't quite believe how different everything feels already.

The new flat sits on the top floor of an old brick building, and it has two bedrooms, a proper kitchen and a tiny balcony which catches the sun all afternoon. There's a park at the end of the street, and the dog has already decided that it belongs to him. The place is smaller than the old one, though it feels twice as bright because nothing blocks the windows.

We moved mainly because my commute had turned into two hours a day, and neither of us could face another winter of standing on a cold platform. The rent works out cheaper as well, which nobody expected in this part of town, and the neighbours have been kind since the day we arrived.

Anyway, the spare room is ready, so come and stay whenever you like. Any weekend in October would be lovely, and I'd love to show you the market on Saturday morning before it fills up.`

/**
 * The same complaint with bullet 3 — "say what you would like the shop to do" —
 * genuinely unanswered: it reports the fault at length and never asks for
 * anything. Written to contain none of that bullet's keywords, which is what
 * makes it a real uncovered case rather than a keyword accident.
 */
const NO_REMEDY_BODY = `I am writing to complain about a washing machine which I purchased from your Bridge Street branch on 4 March, and which was delivered to my flat the following week.

Although the appliance was sold as new, it stopped mid-cycle within nine days. The engineer who visited on 20 March explained that the pump was faulty and fitted a new one. Four days later the same fault appeared again, and water spread across my kitchen floor because the drum would not empty.

Since the machine has now broken twice in a single month, I have very little confidence in it. The noise it makes on every cycle is loud enough to wake my neighbours, and the door seal has begun to perish along its lower edge as well.

The engineer told me that a further visit had been booked, although nobody has since telephoned to arrange a date or a time.`

/**
 * gt-13, whose third bullet is literally "ask what your friend has been doing".
 * The last paragraph therefore ENDS IN A QUESTION, because that is what the task
 * demanded — and the keywords that cover the bullet are inside that question.
 */
const JOB_BODY = `I am writing to tell you that I have finally started the new job at the design company in town, and the first week has already flown past.

The office sits above a bakery near the station, and the team is smaller than I expected, which suits me. My role covers the layout work I used to do plus a share of the client calls, so the days pass quickly and nobody hovers over my desk all afternoon.

What I enjoy most is the commute, because I can walk it in twenty minutes and arrive awake. The hours are longer than at the old place though, and the coffee is genuinely terrible, so I have taken to bringing a flask like somebody twice my age.

Anyway, what have you been up to lately? Tell me your news when you have a moment, and let me know how your family are getting on this autumn.`

/** gt-15, whose bullets 2 AND 3 both order a question. Two questions, both correct. */
const TRIP_BODY = `I am writing to tell you that we are finally going to visit your part of the world in the summer, and I could not be more excited about it.

We are flying out in the middle of August and staying for two weeks, travelling with my sister and her partner, so there will be four of us altogether. None of us has been before, which is why I am writing to the one person who knows the country properly.

Could you give me some advice about where to stay? We would rather book a small hotel or a hostel in a cheap area than anything grand, so any recommendation about a good neighbourhood would help us enormously.

And what should we see while we are there? Everybody mentions the coast and the museum, though I suspect the market and the food are worth far more of our time.`

/** gt-09, semi-formal: bullet 3 is "ask for the help you need", and it is asked. */
const TUTOR_BODY = `I am writing to explain why I was absent from several classes on the accounting course last month, and to ask for your help in catching up.

I was unwell for almost three weeks and spent four days in hospital, so I was unable to attend any of the Tuesday sessions. My doctor has written a note confirming the dates, which I can bring to our next tutorial if that would be useful to you.

Since returning I have borrowed notes from a classmate, worked through the reading list and revised the material we covered in the first two sessions. I have also listened to the recording of the seminar I missed while I was away.

Could I ask for an extension on the assignment, and some guidance about which topics to prioritise? Any advice you can offer would help me complete the course on time.`

function letter(
  salutation: string | null,
  body: string = FORMAL_BODY,
  signoff: string | null = 'Yours faithfully',
  name = 'Daniel Whitfield',
): string {
  const head = salutation ? `${salutation}\n\n` : ''
  const tail = signoff ? `\n\n${signoff},\n\n${name}` : ''
  return `${head}${body}${tail}`
}

function categories(a: Analysis): IssueCategory[] {
  return a.issues.map((i) => i.category)
}

function messagesFor(a: Analysis, category: IssueCategory): string[] {
  return a.issues.filter((i) => i.category === category).map((i) => i.message)
}

function checkSatisfied(a: Analysis, id: string): boolean {
  return a.structure.find((c) => c.id === id)?.satisfied === true
}

/* ------------------------- the salutation/sign-off table --------------------- */

describe('the greeting and sign-off must pair', () => {
  it("accepts 'Yours faithfully' after an unnamed greeting", () => {
    const a = analyzeLetter(letter('Dear Sir or Madam,'), FORMAL)
    expect(categories(a)).not.toContain('gt-signoff-pairing')
    expect(checkSatisfied(a, 'gt-signoff')).toBe(true)
  })

  it("accepts 'Yours sincerely' after a named greeting", () => {
    const a = analyzeLetter(letter('Dear Mr Hughes,', FORMAL_BODY, 'Yours sincerely'), FORMAL)
    expect(categories(a)).not.toContain('gt-signoff-pairing')
    expect(checkSatisfied(a, 'gt-signoff')).toBe(true)
  })

  it("rejects 'Yours faithfully' after a named greeting, and names the fix", () => {
    const a = analyzeLetter(letter('Dear Mr Hughes,', FORMAL_BODY, 'Yours faithfully'), FORMAL)
    const messages = messagesFor(a, 'gt-signoff-pairing')
    expect(messages).toHaveLength(1)
    // The message must state the correction, not merely report the clash.
    expect(messages[0]).toContain('Yours sincerely')
    expect(messages[0]).toContain('Yours faithfully')
    expect(checkSatisfied(a, 'gt-signoff')).toBe(false)
    // Band-capping: this is an error, not a nudge.
    expect(a.issues.find((i) => i.category === 'gt-signoff-pairing')?.severity).toBe('error')
  })

  it("rejects 'Yours sincerely' after an unnamed greeting, and names the fix", () => {
    const a = analyzeLetter(letter('Dear Sir or Madam,', FORMAL_BODY, 'Yours sincerely'), FORMAL)
    const messages = messagesFor(a, 'gt-signoff-pairing')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toContain('Yours faithfully')
  })

  it('stays silent about pairing when there is no greeting to pair with', () => {
    // GUARD: with only half the evidence the correct pairing is unknowable, and
    // guessing from half is how a rule starts telling learners their correct
    // letter is wrong.
    const a = analyzeLetter(letter(null, FORMAL_BODY, 'Yours sincerely'), FORMAL)
    expect(categories(a)).toContain('gt-salutation-missing')
    expect(categories(a)).not.toContain('gt-signoff-pairing')
  })

  it('stays silent about pairing when there is no sign-off to pair with', () => {
    const a = analyzeLetter(letter('Dear Sir or Madam,', FORMAL_BODY, null), FORMAL)
    expect(categories(a)).toContain('gt-signoff-missing')
    expect(categories(a)).not.toContain('gt-signoff-pairing')
  })
})

/* ------------------------- greetings the table must know --------------------- */

describe('a greeting to more than one reader is still a greeting', () => {
  // `gt-salutation-missing` is an ERROR worth −0.5 Task Achievement, and it was
  // telling learners who had plainly written "Dear Anna and Tom," that they had
  // written no greeting at all. Fixed the way this module says such things must
  // be fixed — by ADDING rows the table did not know about, never by loosening
  // the pattern that makes the pairing matrix trustworthy.
  const PAIRS: Array<[string, string, LetterPromptSpec, string, string]> = [
    ['Dear Anna and Tom,', 'Dear + first name', INFORMAL, 'Best wishes', 'Sam'],
    ['Hi Anna and Tom,', 'Hi/Hello + first name', INFORMAL, 'Best wishes', 'Sam'],
    ['Dear Mr and Mrs Hughes,', 'Dear Mr/Ms + surname', FORMAL, 'Yours sincerely', 'Daniel Whitfield'],
  ]

  for (const [salutation, label, prompt, signoff, name] of PAIRS) {
    it(`accepts '${salutation}' and pairs it correctly`, () => {
      const body = prompt.tone === 'informal' ? INFORMAL_BODY : FORMAL_BODY
      const a = analyzeLetter(letter(salutation, body, signoff, name), prompt)
      expect(categories(a), salutation).not.toContain('gt-salutation-missing')
      expect(categories(a), salutation).not.toContain('gt-salutation-tone')
      expect(categories(a), salutation).not.toContain('gt-signoff-pairing')
      expect(checkSatisfied(a, 'gt-salutation'), salutation).toBe(true)
      expect(checkSatisfied(a, 'gt-signoff'), salutation).toBe(true)
      // The row it matched is named back to the learner, so the new rows sit in
      // the same vocabulary as the old ones rather than inventing labels.
      const detail = a.structure.find((c) => c.id === 'gt-salutation')?.detail ?? ''
      expect(detail, salutation).toContain(salutation)
      expect(label.length, salutation).toBeGreaterThan(0)
    })
  }

  it("reads 'Dear Sir and Madam,' as UNNAMED, so faithfully still pairs", () => {
    // Ordering pin. Read as a pair of NAMES this greeting would license 'Yours
    // sincerely' and reject the 'Yours faithfully' it actually calls for —
    // turning a correct formal letter into a gt-signoff-pairing ERROR.
    const a = analyzeLetter(letter('Dear Sir and Madam,', FORMAL_BODY, 'Yours faithfully'), FORMAL)
    expect(categories(a)).not.toContain('gt-signoff-pairing')
    expect(checkSatisfied(a, 'gt-signoff')).toBe(true)

    const wrong = analyzeLetter(letter('Dear Sir and Madam,', FORMAL_BODY, 'Yours sincerely'), FORMAL)
    expect(messagesFor(wrong, 'gt-signoff-pairing')).toHaveLength(1)
  })

  it('still reports a missing greeting, and still judges the new rows for tone', () => {
    // TRUE POSITIVES: the rows added carry the same `tones` as their
    // single-reader originals, so nothing that used to be flagged now escapes.
    const none = analyzeLetter(letter('The washing machine is broken.', FORMAL_BODY), FORMAL)
    expect(categories(none)).toContain('gt-salutation-missing')

    const tooCasual = analyzeLetter(letter('Hi Anna and Tom,', FORMAL_BODY), FORMAL)
    const messages = messagesFor(tooCasual, 'gt-salutation-tone')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toContain('Dear Sir or Madam')
  })
})

/* ------------------------ the sign-off search window ------------------------- */

describe('the sign-off survives a standard business tail', () => {
  it('finds the closing above a reference line', () => {
    // FALSE POSITIVE: reference and enclosure lines under the signature are
    // standard business layout — gt-01's own bullet-1 keywords include
    // `receipt` and `order`. A flat two-line window put the closing out of
    // reach, so a correctly formatted letter drew gt-signoff-missing (an ERROR,
    // −0.5 TA) and the pairing check went silent for want of both halves.
    const text = `${letter('Dear Sir or Madam,')}\n\nOrder reference 44718`
    const a = analyzeLetter(text, FORMAL)
    expect(categories(a)).not.toContain('gt-signoff-missing')
    expect(categories(a)).not.toContain('gt-signoff-pairing')
    expect(checkSatisfied(a, 'gt-signoff')).toBe(true)
    // And the tail is still outside the body: 'order' is a bullet-1 keyword, so
    // a window that swallowed the reference line would start crediting coverage
    // from the letterhead.
    const trap: LetterPromptSpec = {
      ...FORMAL,
      id: 'gt-test-reference-tail',
      bulletKeywords: [FORMAL.bulletKeywords[0], FORMAL.bulletKeywords[1], ['reference', '44718', 'quokka', 'zeppelin']],
    }
    expect(messagesFor(analyzeLetter(text, trap), 'gt-bullet-uncovered')).toHaveLength(1)
  })

  it('still reports a genuinely missing sign-off', () => {
    // TRUE POSITIVE: widening the window across SHORT tail lines only means a
    // letter that simply stops still gets told so.
    const a = analyzeLetter(`${letter('Dear Sir or Madam,', FORMAL_BODY, null)}\n\nOrder reference 44718`, FORMAL)
    expect(categories(a)).toContain('gt-signoff-missing')
  })

  it('never mistakes a mid-letter closing word for the closing', () => {
    // GUARD, and a pin on the window constants. This letter deliberately puts a
    // line beginning with a closing word in the MIDDLE of the letter. A window
    // that reached it would read 'Regards' as the sign-off after an unnamed
    // greeting and raise gt-signoff-pairing — an ERROR — against a letter that
    // signed off perfectly correctly two lines later.
    //
    // MUTATION PIN: SIGNOFF_TAIL_LINES_MIN 2→6, or SIGNOFF_TAIL_WORDS_MAX 4→400
    // (which would let the walk cross the intervening paragraph), each make this
    // fail.
    const paragraphs = FORMAL_BODY.split('\n\n')
    const body = `${paragraphs.slice(0, 3).join('\n\n')}\n\nRegards to your delivery team.\n\n${paragraphs[3]}`
    const a = analyzeLetter(letter('Dear Sir or Madam,', body), FORMAL)
    expect(categories(a)).not.toContain('gt-signoff-pairing')
    expect(a.structure.find((c) => c.id === 'gt-signoff')?.detail).toContain('Yours faithfully')
  })

  it('never mistakes a prose line that opens with a closing word', () => {
    // MUTATION PIN: SIGNOFF_TRAILING_WORDS_MAX 4→400. This letter's last line is
    // prose that happens to begin "Love …". Accepted as a closing it would be
    // 'Love' after 'Dear Sir or Madam' — a gt-signoff-pairing ERROR, and one of
    // the ugliest false accusations the module could make.
    const text = `${letter('Dear Sir or Madam,', FORMAL_BODY, null)}\n\nLove of good service brought me to your shop in the first place, and I hope it will bring me back.`
    const a = analyzeLetter(text, FORMAL)
    expect(categories(a)).not.toContain('gt-signoff-pairing')
    // There genuinely is no closing here, and the letter is told so.
    expect(categories(a)).toContain('gt-signoff-missing')
  })
})

/* ------------------------------------ tone ----------------------------------- */

describe('register is judged against the tone the prompt fixes', () => {
  const WITH_CONTRACTION = FORMAL_BODY.replace(
    'I have little confidence',
    "I can't pretend I have any confidence",
  )

  it('flags a contraction in a formal letter', () => {
    const a = analyzeLetter(letter('Dear Sir or Madam,', WITH_CONTRACTION), FORMAL)
    expect(categories(a)).toContain('gt-tone-mismatch')
    // The shared contraction rule still applies at this register too.
    expect(categories(a)).toContain('contraction')
  })

  it('flags NOTHING for the same contraction in an informal letter', () => {
    // "I can't wait to see you" is correct English at this register. This is the
    // whole reason `lexicalRules` learned about tone.
    const a = analyzeLetter(
      letter('Dear Anna,', INFORMAL_BODY, 'Best wishes', 'Sam'),
      INFORMAL,
    )
    expect(a.stats.wordCount).toBeGreaterThan(150)
    expect(INFORMAL_BODY).toContain("can't")
    expect(categories(a)).not.toContain('contraction')
    expect(categories(a)).not.toContain('gt-tone-mismatch')
    expect(a.issues.filter((i) => i.severity !== 'info')).toEqual([])
  })

  it("flags 'Hi Dave' as the wrong greeting for a formal letter", () => {
    const a = analyzeLetter(letter('Hi Dave,'), FORMAL)
    const messages = messagesFor(a, 'gt-salutation-tone')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toContain('Dear Sir or Madam')
    expect(checkSatisfied(a, 'gt-salutation')).toBe(false)
  })

  it('flags officialese in an informal letter', () => {
    // An informal letter that reads like a legal notice is exactly as wrong as a
    // formal letter full of slang.
    const stiff = `${INFORMAL_BODY} I look forward to your prompt reply at your earliest convenience.`
    const a = analyzeLetter(letter('Dear Anna,', stiff, 'Best wishes', 'Sam'), INFORMAL)
    expect(categories(a)).toContain('gt-tone-mismatch')
    expect(messagesFor(a, 'gt-tone-mismatch').join(' ')).toMatch(/too formal/i)
  })

  it('flags a CURLY contraction exactly as it flags a straight one', () => {
    // The apostrophe on a Mac or an iPhone is ’, not '. A marker list carrying
    // only the straight form meant the same learner making the same mistake got
    // different coaching depending on the keyboard they typed it on: `can't`
    // drew gt-tone-mismatch and `can’t` drew silence.
    const straight = analyzeLetter(letter('Dear Sir or Madam,', WITH_CONTRACTION), FORMAL)
    const curly = analyzeLetter(
      letter('Dear Sir or Madam,', WITH_CONTRACTION.replace("can't", 'can’t')),
      FORMAL,
    )
    expect(messagesFor(straight, 'gt-tone-mismatch')).toEqual([
      "'can't' is too informal for a formal letter to the manager of the store — write the full form.",
    ])
    expect(messagesFor(curly, 'gt-tone-mismatch')).toEqual([
      "'can’t' is too informal for a formal letter to the manager of the store — write the full form.",
    ])
  })

  it("leaves 'that will be no problem' alone in a formal letter", () => {
    // FALSE POSITIVE: this is perfectly good formal English. So is 'poses no
    // problem' and 'no problem has arisen'. The phrase is only slang in its
    // interjection reading, where it is a clause on its own.
    for (const clause of [
      'If written confirmation is required that will be no problem, and I would be grateful',
      'No problem has arisen with the second appliance, and I would be grateful',
      'There is no problem with my account, and I would be grateful',
    ]) {
      const body = FORMAL_BODY.replace('I would be grateful', clause)
      const a = analyzeLetter(letter('Dear Sir or Madam,', body), FORMAL)
      expect(messagesFor(a, 'gt-tone-mismatch'), clause).toEqual([])
    }
  })

  it("still flags 'No problem' as an interjection, with the same message", () => {
    // TRUE POSITIVE: the guard is a sentence boundary on each side, so the
    // reading it was written for is untouched.
    const body = FORMAL_BODY.replace(
      'I would be grateful if you could confirm',
      'No problem, I will collect the replacement myself. I would be grateful if you could confirm',
    )
    const a = analyzeLetter(letter('Dear Sir or Madam,', body), FORMAL)
    expect(messagesFor(a, 'gt-tone-mismatch')).toEqual([
      "'No problem' is too informal for a formal letter to the manager of the store — write 'thank you' or 'I would be grateful'.",
    ])
  })
})

/* --------------------- questions: the task ORDERS them ----------------------- */

describe('a letter may ask questions, because the task tells it to', () => {
  // The single worst thing the letter engine did: `informal-register`'s
  // rhetorical-question clause fired at every tone, so a learner who obeyed
  // "ask what your friend has been doing" was told to turn the question into a
  // statement — and a learner who then obeyed THAT lost the bullet to
  // `gt-bullet-uncovered`, an ERROR capping Task Achievement at 5.5.
  const RHETORICAL = /Rhetorical questions/

  const CASES: Array<[string, string, LetterPromptSpec, string]> = [
    ['gt-13 (informal)', 'Dear Anna,', INFORMAL_JOB, JOB_BODY],
    ['gt-15 (informal)', 'Dear Anna,', INFORMAL_TRIP, TRIP_BODY],
    ['gt-09 (semi-formal)', 'Dear Mr Hughes,', SEMI_FORMAL, TUTOR_BODY],
  ]

  for (const [label, salutation, prompt, body] of CASES) {
    it(`says nothing about the question ${label} was told to ask`, () => {
      const signoff = prompt.tone === 'informal' ? 'Best wishes' : 'Yours sincerely'
      const a = analyzeLetter(letter(salutation, body, signoff, 'Sam'), prompt)
      expect(body, label).toContain('?')
      expect(a.issues.filter((i) => RHETORICAL.test(i.message)), label).toEqual([])
      // And the bullet the question answers is credited, which is the whole
      // point: the advice and the marking must not contradict each other.
      expect(messagesFor(a, 'gt-bullet-uncovered'), label).toEqual([])
      expect(checkSatisfied(a, 'gt-bullet-3'), label).toBe(true)
    })
  }

  it('says nothing about a question in a FORMAL letter either', () => {
    // "Could you confirm which of these two options you can offer?" is the
    // politest thing a complaint letter can do.
    const body = FORMAL_BODY.replace(
      'I would be grateful if you could confirm in writing which of these two options you are able to offer me.',
      'Could you confirm in writing which of these two options you are able to offer me?',
    )
    const a = analyzeLetter(letter('Dear Sir or Madam,', body), FORMAL)
    expect(body).toContain('?')
    expect(a.issues.filter((i) => RHETORICAL.test(i.message))).toEqual([])
  })
})

/* ------------------------- exclamation marks: one owner ---------------------- */

describe('an exclamation mark is one mistake, reported once', () => {
  const NO_EXCLAMATION = /No exclamation marks/

  it('is correct English in an informal letter, and draws nothing', () => {
    // FALSE POSITIVE: "come and stay whenever you like!" is the register the
    // task asked for. Telling a friendly letter it has broken a rule of
    // ACADEMIC writing marks a correct answer down for a genre it is not in.
    const body = INFORMAL_BODY.replace('come and stay whenever you like.', 'come and stay whenever you like!')
    const a = analyzeLetter(letter('Dear Anna,', body, 'Best wishes', 'Sam'), INFORMAL)
    expect(body).toContain('!')
    expect(a.issues.filter((i) => NO_EXCLAMATION.test(i.message))).toEqual([])
    expect(categories(a)).not.toContain('gt-tone-mismatch')
  })

  it('is reported ONCE in a formal letter, by gt-tone-mismatch', () => {
    // One '!' used to raise gt-tone-mismatch AND informal-register on the very
    // same span with the very same fix — one mistake shown as two in the panel,
    // and charged twice to the LR register count, which sums both categories.
    // gt-tone-mismatch owns it, because it is the rule that knows which
    // register THIS letter is being marked against.
    const body = FORMAL_BODY.replace('would not empty.', 'would not empty!')
    const a = analyzeLetter(letter('Dear Sir or Madam,', body), FORMAL)

    const onTheBang = a.issues.filter((i) => i.excerpt === '!')
    expect(onTheBang).toHaveLength(1)
    expect(onTheBang[0].category).toBe('gt-tone-mismatch')
    expect(onTheBang[0].message).toBe(
      "'!' is too informal for a formal letter to the manager of the store — end the sentence with a full stop.",
    )
    expect(a.issues.filter((i) => NO_EXCLAMATION.test(i.message))).toEqual([])
  })

  it('is still reported in a SEMI-FORMAL letter', () => {
    // TRUE POSITIVE: standing down `informal-register` did not stand down the
    // rule that actually marks register in a letter.
    const body = TUTOR_BODY.replace('on time.', 'on time!')
    const a = analyzeLetter(letter('Dear Mr Hughes,', body, 'Yours sincerely', 'Alina Petrova'), SEMI_FORMAL)
    expect(messagesFor(a, 'gt-tone-mismatch')).toEqual([
      "'!' is too informal for a semi-formal letter to your course tutor — end the sentence with a full stop.",
    ])
  })
})

/* ----------------------------- bullet-point coverage -------------------------- */

describe('every bullet point must be covered', () => {
  it('raises nothing and ticks three checks when all three are answered', () => {
    const a = analyzeLetter(letter('Dear Sir or Madam,'), FORMAL)
    expect(categories(a)).not.toContain('gt-bullet-uncovered')
    expect(checkSatisfied(a, 'gt-bullet-1')).toBe(true)
    expect(checkSatisfied(a, 'gt-bullet-2')).toBe(true)
    expect(checkSatisfied(a, 'gt-bullet-3')).toBe(true)
  })

  it('names the bullet that was missed, quoting it back', () => {
    const a = analyzeLetter(letter('Dear Sir or Madam,', NO_REMEDY_BODY), FORMAL)
    const messages = messagesFor(a, 'gt-bullet-uncovered')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toContain(FORMAL.bullets[2])
    expect(checkSatisfied(a, 'gt-bullet-3')).toBe(false)
  })

  it('does not count a keyword that appears only in the greeting or signature', () => {
    // GUARD: a name in the greeting is not coverage, and neither is a name in
    // the signature. `bulletCoverage` scans `bodyText` only — from the end of
    // the greeting to the start of the sign-off — and BOTH ends of that range
    // have to be pinned, so the trap carries TWO keywords on each side:
    //
    //   greeting side  'bradley' + 'hughes'    (Dear Mr Bradley Hughes,)
    //   signature side 'sincerely' + 'whitfield' (Yours sincerely, / Daniel Whitfield)
    //
    // Two, because coverage needs two DISTINCT hits. With only one keyword on a
    // side, deleting that side's exclusion left `seen = 1 < 2` and the bullet
    // still read as uncovered — the assertion passed either way and the guard
    // was not actually being tested. Mutating `bodyStart = salutation.end` to
    // `bodyStart = 0`, or `bodyEnd = signoff.start` to the end of the text, must
    // now each turn this bullet green and fail the test.
    const trap: LetterPromptSpec = {
      ...FORMAL,
      id: 'gt-test-name-trap',
      bullets: [...FORMAL.bullets.slice(0, 2), 'greet the reader by name'],
      bulletKeywords: [
        FORMAL.bulletKeywords[0],
        FORMAL.bulletKeywords[1],
        ['hughes', 'bradley', 'whitfield', 'sincerely'],
      ],
    }
    const text = letter('Dear Mr Bradley Hughes,', FORMAL_BODY, 'Yours sincerely')
    expect(text).toContain('Bradley')
    expect(text).toContain('Hughes')
    expect(text).toContain('sincerely')
    expect(text).toContain('Whitfield')
    // …and none of the four is anywhere in the body itself.
    for (const kw of ['bradley', 'hughes', 'whitfield', 'sincerely']) {
      expect(FORMAL_BODY.toLowerCase(), kw).not.toContain(kw)
    }

    const a = analyzeLetter(text, trap)
    expect(messagesFor(a, 'gt-bullet-uncovered')).toHaveLength(1)
    expect(checkSatisfied(a, 'gt-bullet-3')).toBe(false)
  })

  it('needs TWO distinct keywords, because one common word is not evidence', () => {
    const oneHit: LetterPromptSpec = {
      ...FORMAL,
      id: 'gt-test-one-hit',
      bulletKeywords: [
        FORMAL.bulletKeywords[0],
        FORMAL.bulletKeywords[1],
        ['refund', 'quokka', 'xylophone', 'zeppelin'],
      ],
    }
    const twoHits: LetterPromptSpec = {
      ...oneHit,
      id: 'gt-test-two-hits',
      bulletKeywords: [
        FORMAL.bulletKeywords[0],
        FORMAL.bulletKeywords[1],
        ['refund', 'fortnight', 'xylophone', 'zeppelin'],
      ],
    }
    const text = letter('Dear Sir or Madam,')

    expect(messagesFor(analyzeLetter(text, oneHit), 'gt-bullet-uncovered')).toHaveLength(1)
    expect(messagesFor(analyzeLetter(text, twoHits), 'gt-bullet-uncovered')).toHaveLength(0)
  })
})

/* --------------------------- purpose, roles and shape ------------------------- */

describe('purpose and letter shape', () => {
  const NO_PURPOSE = FORMAL_BODY.replace(
    'I am writing to complain about',
    'There is a serious problem with',
  )

  it('stays silent about a missing purpose while the letter is still short', () => {
    const short = NO_PURPOSE.split('\n\n')[0]
    const a = analyzeLetter(letter('Dear Sir or Madam,', short, null), FORMAL)
    expect(a.stats.wordCount).toBeLessThan(100)
    expect(categories(a)).not.toContain('gt-purpose-missing')
  })

  it('asks for a purpose statement once the letter is a letter', () => {
    const a = analyzeLetter(letter('Dear Sir or Madam,', NO_PURPOSE), FORMAL)
    expect(a.stats.wordCount).toBeGreaterThanOrEqual(100)
    expect(categories(a)).toContain('gt-purpose-missing')
    expect(checkSatisfied(a, 'gt-purpose')).toBe(false)
  })

  it('accepts the opening its own advice tells an informal writer to use', () => {
    // FALSE POSITIVE, and a self-contradiction: `gt-tone-mismatch` tells an
    // informal writer to replace "I am writing to express" with "I wanted to
    // tell you" — and the purpose list did not contain that phrase, so a
    // learner who obeyed one rule was warned by another for obeying it.
    const body = INFORMAL_BODY.replace('I am writing to tell you', 'I wanted to tell you')
    const a = analyzeLetter(letter('Dear Anna,', body, 'Best wishes', 'Sam'), INFORMAL)
    expect(categories(a)).not.toContain('gt-purpose-missing')
    expect(checkSatisfied(a, 'gt-purpose')).toBe(true)
  })

  it('accepts a natural informal opening that announces the news', () => {
    // A letter to a friend states its purpose by announcing it, not by
    // declaring an intention. "You will never guess what has happened" is as
    // clear about why the letter exists as "I am writing to inform you".
    const body = INFORMAL_BODY.replace(
      'I am writing to tell you that we',
      'You will never guess what has happened — we',
    )
    const a = analyzeLetter(letter('Dear Anna,', body, 'Best wishes', 'Sam'), INFORMAL)
    expect(categories(a)).not.toContain('gt-purpose-missing')
    expect(checkSatisfied(a, 'gt-purpose')).toBe(true)
  })

  it('still asks an informal letter that never says why it is writing', () => {
    // TRUE POSITIVE: the informal list adds phrasings, it does not switch the
    // rule off. This opening announces nothing.
    const body = INFORMAL_BODY.replace(
      'I am writing to tell you that we',
      'The weather here has been miserable for three weeks now, and we',
    )
    const a = analyzeLetter(letter('Dear Anna,', body, 'Best wishes', 'Sam'), INFORMAL)
    expect(categories(a)).toContain('gt-purpose-missing')
    expect(checkSatisfied(a, 'gt-purpose')).toBe(false)
  })

  it('does not let the informal openings leak into a formal letter', () => {
    // The informal phrasings are accepted for `tone === 'informal'` ONLY. A
    // complaint to a shop that opens "Guess what" has not stated its purpose,
    // and gt-purpose-missing must still say so.
    const body = FORMAL_BODY.replace('I am writing to complain about', 'Guess what I have had to put up with —')
    const a = analyzeLetter(letter('Dear Sir or Madam,', body), FORMAL)
    expect(categories(a)).toContain('gt-purpose-missing')
    expect(checkSatisfied(a, 'gt-purpose')).toBe(false)
  })

  it('never assigns the conclusion role — a sign-off is not a conclusion', () => {
    for (const text of [
      '',
      'Dear Anna,',
      letter('Dear Sir or Madam,'),
      letter('Dear Mr Hughes,', FORMAL_BODY, 'Yours sincerely'),
      `${FORMAL_BODY}\n\n${FORMAL_BODY}`,
    ]) {
      const a = analyzeLetter(text, FORMAL)
      expect(a.paragraphs.map((p) => p.role)).not.toContain('conclusion')
    }
    // And nothing in the rail groups under a Conclusion heading either.
    const a = analyzeLetter(letter('Dear Sir or Madam,'), FORMAL)
    expect(a.structure.filter((c) => c.id.startsWith('conclusion'))).toEqual([])
  })
})

/* --------------------------------- band estimate ------------------------------ */

describe('the band estimate', () => {
  it('reports 4.0 across the board below 100 words', () => {
    const a = analyzeLetter(letter('Dear Sir or Madam,', 'I am writing to complain.', null), FORMAL)
    expect(a.band.overall).toBe(4)
    expect(a.band.byCriterion).toEqual({ TR: 4, CC: 4, LR: 4, GRA: 4 })
  })

  it('caps Task Achievement at 5.5 when a bullet goes unanswered', () => {
    const a = analyzeLetter(letter('Dear Sir or Madam,', NO_REMEDY_BODY), FORMAL)
    expect(categories(a)).toContain('gt-bullet-uncovered')
    expect(a.band.byCriterion.TR).toBeLessThanOrEqual(5.5)
  })

  it('scores a worked letter at 8.0 or above — the calibration anchor', () => {
    for (const model of LETTER_MODELS) {
      const prompt = LETTER_PROMPTS.find((p) => p.id === model.sourcePromptId)!
      const a = analyzeLetter(model.text, prompt)
      expect(a.band.overall, model.sourcePromptId).toBeGreaterThanOrEqual(8)
    }
  })
})

/* --------------------------- the canonical constants -------------------------- */

describe('the letter constants are pinned to their documented values', () => {
  // Every number below survived being mutated to an absurd value with the suite
  // still green, which means it was documented but never exercised. Each test
  // here names the mutation it fails under.

  it("warns 'dangerously close' between 150 and 160 words — CLOSE_WORDS = 160", () => {
    // MUTATION PIN: CLOSE_WORDS 160→151.
    const a = analyzeLetter(letter('Dear Sir or Madam,'), FORMAL)
    expect(a.stats.wordCount).toBeGreaterThanOrEqual(150)
    expect(a.stats.wordCount).toBeLessThan(160)
    expect(messagesFor(a, 'gt-word-count')).toHaveLength(1)
    expect(messagesFor(a, 'gt-word-count')[0]).toMatch(/dangerously close/)
  })

  it('warns about over-length past 220 words — OVER_WORDS = 220', () => {
    // MUTATION PIN: OVER_WORDS 220→2200.
    const long = `${FORMAL_BODY}\n\nI should add that the delivery team left the packaging in my hallway on both occasions, and that nobody from your branch telephoned to confirm the second appointment. My neighbour waited at home for the technician on my behalf and lost a morning of work for nothing, which I mention only so that you understand the scale of the inconvenience this single appliance has caused over the past month.`
    const a = analyzeLetter(letter('Dear Sir or Madam,', long), FORMAL)
    expect(a.stats.wordCount).toBeGreaterThan(220)
    expect(messagesFor(a, 'gt-word-count')).toHaveLength(1)
    expect(messagesFor(a, 'gt-word-count')[0]).toMatch(/long for the 20 minutes/)
  })

  it('reads a run-on greeting line — SALUTATION_COMMA_WINDOW = 45', () => {
    // The guard SPEC.md documents at length and nothing exercised: a learner
    // who writes "Dear Sir or Madam, I am writing to…" as one line has still
    // written a greeting, and reporting an ERROR for a formatting habit is a
    // false accusation.
    // MUTATION PIN: SALUTATION_COMMA_WINDOW 45→1.
    const paragraphs = FORMAL_BODY.split('\n\n')
    const runOn = `Dear Sir or Madam, ${paragraphs[0]}\n\n${paragraphs.slice(1).join('\n\n')}`
    const a = analyzeLetter(`${runOn}\n\nYours faithfully,\n\nDaniel Whitfield`, FORMAL)
    expect(categories(a)).not.toContain('gt-salutation-missing')
    expect(checkSatisfied(a, 'gt-salutation')).toBe(true)
    // And the pairing check has both halves again, which the missing greeting
    // would otherwise have silenced.
    expect(checkSatisfied(a, 'gt-signoff')).toBe(true)
  })

  it('asks for four complex sentences — COMPLEX_TARGET = 4', () => {
    // MUTATION PIN: COMPLEX_TARGET 4→1 (or →3): the count below is 2.
    const plain = `I am writing to complain about a washing machine which I purchased from your Bridge Street branch on 4 March. The delivery arrived at my flat the following week, and the receipt is enclosed with this letter.

The appliance stopped mid-cycle within nine days. An engineer visited on 20 March and fitted a replacement pump. Four days later the same fault returned, and water spread across my kitchen floor. A second visit was arranged, but the technician failed to arrive at the agreed time.

The machine has now broken twice in a single month, and I have little confidence in a third repair because the same part has already failed. I would prefer a full refund, or an identical model delivered to my flat within a fortnight.

Please confirm in writing to me at the address printed on my receipt. I would be grateful for a reply within ten working days.`
    const a = analyzeLetter(letter('Dear Sir or Madam,', plain), FORMAL)
    const check = a.structure.find((c) => c.id === 'complex-count')
    expect(check?.satisfied).toBe(false)
    expect(check?.detail).toContain('2 of 4 target')

    // …and the target is reachable: the standard fixture clears it.
    expect(
      analyzeLetter(letter('Dear Sir or Madam,'), FORMAL).structure.find((c) => c.id === 'complex-count')?.satisfied,
    ).toBe(true)
  })

  it('judges paragraph balance from 150 words at a ratio of 2 — the only structural issue letters raise', () => {
    // `letterStructure.ts → buildIssues` had no test at all.
    // MUTATION PINS: BALANCE_GATE_WORDS 150→15000, and the ratio 2×→20×.
    const lopsided = `I am writing to complain about a washing machine which I purchased from your Bridge Street branch on 4 March, and which was delivered to my flat in Beckett Road the following week by your own delivery team.

Although the appliance was sold as new, it stopped mid-cycle within nine days. The engineer who visited on 20 March explained that the pump was faulty and fitted a replacement part. Four days later the same fault returned, and water spread across my kitchen floor because the drum would not empty. A second visit was arranged, but the technician failed to arrive at the time agreed with me.

Since it has broken twice, I would prefer a full refund.

I would be grateful if you could confirm in writing which of these two options you are able to offer me, and when I might expect the money to reach my account in full.`
    const a = analyzeLetter(letter('Dear Sir or Madam,', lopsided), FORMAL)
    expect(a.stats.wordCount).toBeGreaterThanOrEqual(150)
    const balance = messagesFor(a, 'paragraph-balance')
    expect(balance).toHaveLength(1)
    // The ratio here is roughly 6×, comfortably inside a 20× mutation's blind spot.
    expect(balance[0]).toMatch(/more than twice the length/)

    // TRUE NEGATIVE: an evenly developed letter of the same shape raises nothing,
    // so the check is not simply always on.
    expect(messagesFor(analyzeLetter(letter('Dear Sir or Madam,'), FORMAL), 'paragraph-balance')).toEqual([])
  })

  it('keeps the sign-off tail window tight — SIGNOFF_TAIL_LINES_MAX = 4', () => {
    // MUTATION PIN: SIGNOFF_TAIL_LINES_MAX 4→2 loses the reference-line case
    // above; this asserts the other edge, that the window stops. Four tail
    // lines is closing + signature + two notes, and a fifth is not reached.
    const text = `${letter('Dear Sir or Madam,')}\n\nOrder reference 44718\n\nEnclosed: receipt\n\nPlease quote this`
    const a = analyzeLetter(text, FORMAL)
    expect(categories(a)).toContain('gt-signoff-missing')
  })
})

/* ------------------------- the tone guard must not leak ----------------------- */

describe('the lexical tone guard is confined to letters', () => {
  // Both rules the guard touches, in one fixed input. If the guard ever leaked
  // into a caller that passes no tone, these are the two cases that catch it.
  const ESSAY = `Many people believe that governments don't do enough about traffic. In my opinion this is correct, and you can see the effect in any large city at eight in the morning.

Firstly, road pricing works. Cities which charge drivers to enter the centre report lower congestion, because the price changes behaviour in a way that appeals never do. You would notice the difference within a week.

Secondly, public transport must be funded properly. A bus that arrives every twenty minutes cannot compete with a car, and it isn't reasonable to expect commuters to wait in the rain for the sake of principle.

In conclusion, governments should price roads and fund buses. Your journey to work would be shorter, and the air would be cleaner for everyone.`

  // The same essay with the two punctuation faults added. A letter now stands
  // down for '!' and '?' as well as for second-person address, so all THREE
  // clauses need a leak test, not one.
  const PUNCTUATED = `${ESSAY}\n\nIs any of this controversial? Of course it is not!`

  it('leaves analyzeEssay reporting contractions and second-person address', () => {
    const a = analyzeEssay(ESSAY, PROMPTS[0])
    expect(categories(a)).toContain('contraction')
    expect(
      a.issues.some((i) => i.category === 'informal-register' && /^(you|your)$/i.test(i.excerpt ?? '')),
    ).toBe(true)
  })

  it('leaves analyzeTask1 reporting contractions and second-person address', () => {
    const a = analyzeTask1(ESSAY, TASK1_PROMPTS[0])
    expect(categories(a)).toContain('contraction')
    expect(
      a.issues.some((i) => i.category === 'informal-register' && /^(you|your)$/i.test(i.excerpt ?? '')),
    ).toBe(true)
  })

  it('leaves analyzeEssay reporting exclamation marks and rhetorical questions', () => {
    const a = analyzeEssay(PUNCTUATED, PROMPTS[0])
    expect(messagesFor(a, 'informal-register')).toContain(
      'No exclamation marks in academic writing — end the sentence with a full stop.',
    )
    expect(messagesFor(a, 'informal-register')).toContain(
      'Rhetorical questions weaken academic tone — turn this question into a statement.',
    )
  })

  it('leaves analyzeTask1 reporting exclamation marks and rhetorical questions', () => {
    const a = analyzeTask1(PUNCTUATED, TASK1_PROMPTS[0])
    expect(messagesFor(a, 'informal-register')).toContain(
      'No exclamation marks in academic writing — end the sentence with a full stop.',
    )
    expect(messagesFor(a, 'informal-register')).toContain(
      'Rhetorical questions weaken academic tone — turn this question into a statement.',
    )
  })
})

/* --------------------------------- the bank ----------------------------------- */

describe('the letter prompt bank', () => {
  it('offers fifteen prompts, five per tone', () => {
    expect(LETTER_PROMPTS).toHaveLength(15)
    for (const tone of ['formal', 'semi-formal', 'informal'] as const) {
      expect(LETTER_PROMPTS.filter((p) => p.tone === tone), tone).toHaveLength(5)
    }
  })

  it('gives every prompt three bullets with a usable keyword list each', () => {
    for (const p of LETTER_PROMPTS) {
      expect(p.bullets, p.id).toHaveLength(3)
      expect(p.bulletKeywords, p.id).toHaveLength(3)
      for (const list of p.bulletKeywords) {
        // Fewer than two keywords makes the check unsatisfiable, and the module
        // then reports the bullet as COVERED so an authoring bug is never
        // charged to the learner. Assert the bank never relies on that escape.
        expect(list.length, p.id).toBeGreaterThanOrEqual(4)
      }
      expect(p.text, p.id).toContain('Write at least 150 words.')
      expect(p.text, p.id).toContain('Begin your letter as follows: Dear ...,')
    }
  })

  it('raises no false "uncovered" report on a letter that answers its bullets', () => {
    // The worst output this app can produce is telling a correct learner they
    // failed the task, so each worked letter is checked against EVERY prompt of
    // its own scenario, not only in aggregate.
    for (const model of LETTER_MODELS) {
      const prompt = LETTER_PROMPTS.find((p) => p.id === model.sourcePromptId)!
      const a = analyzeLetter(model.text, prompt)
      expect(messagesFor(a, 'gt-bullet-uncovered'), model.sourcePromptId).toEqual([])
    }
  })
})
