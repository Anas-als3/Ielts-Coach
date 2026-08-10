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
    // GUARD: a name in the greeting is not coverage. Both 'hughes' and
    // 'whitfield' are present in this letter — one in the greeting, one in the
    // signature — and neither is inside the body.
    const trap: LetterPromptSpec = {
      ...FORMAL,
      id: 'gt-test-name-trap',
      bullets: [...FORMAL.bullets.slice(0, 2), 'greet the reader by name'],
      bulletKeywords: [
        FORMAL.bulletKeywords[0],
        FORMAL.bulletKeywords[1],
        ['hughes', 'whitfield', 'madam', 'sincerely'],
      ],
    }
    const text = letter('Dear Mr Hughes,', FORMAL_BODY, 'Yours sincerely')
    expect(text).toContain('Hughes')
    expect(text).toContain('Whitfield')

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

/* ------------------------- the tone guard must not leak ----------------------- */

describe('the lexical tone guard is confined to letters', () => {
  // Both rules the guard touches, in one fixed input. If the guard ever leaked
  // into a caller that passes no tone, these are the two cases that catch it.
  const ESSAY = `Many people believe that governments don't do enough about traffic. In my opinion this is correct, and you can see the effect in any large city at eight in the morning.

Firstly, road pricing works. Cities which charge drivers to enter the centre report lower congestion, because the price changes behaviour in a way that appeals never do. You would notice the difference within a week.

Secondly, public transport must be funded properly. A bus that arrives every twenty minutes cannot compete with a car, and it isn't reasonable to expect commuters to wait in the rain for the sake of principle.

In conclusion, governments should price roads and fund buses. Your journey to work would be shorter, and the air would be cleaner for everyone.`

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
