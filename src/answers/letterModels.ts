/**
 * Worked General Training Task 1 answers — one letter per tone.
 *
 * **Letters have no generator.** Academic Task 1 model answers are composed from
 * the chart's own numbers, which is what guarantees they cannot cite a figure
 * the chart lacks. A letter has no equivalent source: there is nothing to
 * compose "I am writing to complain about a washing machine" from. So these
 * three are hand-written and must be maintained by hand.
 *
 * Three, not fifteen, and deliberately so. What a learner needs from a worked
 * letter is the SHAPE and the REGISTER — how formal to be, where the purpose
 * statement goes, which sign-off matches which greeting — and those are
 * properties of the tone, not of the scenario. A learner on a different prompt
 * of the same tone is shown the closest model with `exact: false`, exactly as
 * `task2ModelFor` does.
 *
 * Every one is graded by the app's own engine in `tests/model-answers.test.ts`:
 * no error or warning, every structure check satisfied, band ≥ 8.0. A model
 * answer the engine would mark down is worse than none — the learner follows it
 * and is then penalised for what it did.
 */
import type { LetterPromptSpec, LetterTone } from '../types'

export interface LetterModel {
  /** The prompt this letter was WRITTEN for. Grade it against this, never the one on screen. */
  sourcePromptId: string
  tone: LetterTone
  text: string
}

/**
 * FORMAL — an unnamed reader, so "Dear Sir or Madam" pairs with "Yours
 * faithfully". Note what the letter does NOT do: no contractions, no
 * exclamation marks, and no anger. The complaint is carried by the sequence of
 * facts, which is what earns marks.
 */
const FORMAL_MODEL = `Dear Sir or Madam,

I am writing to complain about a washing machine which I purchased from your Bridge Street branch on 4 March, and which was delivered to my flat the following week.

Although the appliance was sold as new, it stopped mid-cycle within nine days. The engineer who visited on 20 March explained that the pump was faulty and fitted a replacement part. Four days later the same fault returned, and water spread across my kitchen floor because the drum would not empty. A second visit was arranged, but the technician failed to arrive.

Since the machine has now broken twice in a single month, I have little confidence that a third repair would hold. I would therefore prefer a full refund, although I would accept an identical model if your delivery team could bring one within a fortnight. The original order number appears on the receipt enclosed with this letter.

I would be grateful if you could confirm in writing which of these two options you are able to offer me.

Yours faithfully,

Daniel Whitfield`

/**
 * SEMI-FORMAL — a named reader the writer has a standing relationship with, so
 * "Dear Mr Hughes" pairs with "Yours sincerely". Warmer than the formal model
 * and still contraction-free: semi-formal means polite, not casual.
 */
const SEMI_FORMAL_MODEL = `Dear Mr Hughes,

I am writing to report a problem with the heating in the flat at 14 Beckett Road, which I have rented from you since last September.

The boiler stopped producing hot water about three weeks ago. Although it fires briefly when I reset the switch, the radiators in both bedrooms stay cold, and the pressure gauge drops back to zero within a day. A neighbour who had the same model replaced last winter tells me that the expansion vessel is usually the cause.

While the weather stayed mild the fault was merely inconvenient, but the rooms are genuinely cold in the evenings now, and my daughter has taken to sleeping beside the fire. Damp has begun to show on the bedroom wall, which I would rather not allow to spread any further.

I would be grateful if you could arrange for an engineer to visit. Because I work from home on Tuesdays and Fridays, either of those mornings would suit me, and I am happy to leave a key with the caretaker if that proves simpler for the plumber.

Yours sincerely,

Alina Petrova`

/**
 * INFORMAL — a friend, so a first name pairs with "Best wishes", and the
 * CONTRACTIONS are correct English here. That is the whole point of the tone
 * guard in `analysis/rules/lexical.ts`: "we've finally moved" would be an error
 * in either letter above and is right in this one.
 */
const INFORMAL_MODEL = `Dear Anna,

I am writing to tell you that we've finally moved, and I can't quite believe how different everything feels already.

The new flat sits on the top floor of an old brick building, and it has two bedrooms, a proper kitchen and a tiny balcony which catches the sun all afternoon. There's a park at the end of the street, and the dog has already decided that it belongs to him. The place is smaller than the old one, though it feels twice as bright because nothing blocks the windows.

We moved mainly because my commute had turned into two hours a day, and neither of us could face another winter of standing on a cold platform. The rent works out cheaper as well, which nobody expected in this part of town, and the neighbours have been kind since the day we arrived.

Anyway, the spare room is ready, so come and stay whenever you like. Any weekend in October would be lovely, and I'd love to show you the market on Saturday morning before it fills up.

Best wishes,

Sam`

/** One model per tone, keyed by the prompt each was written for. */
export const LETTER_MODELS: readonly LetterModel[] = [
  { sourcePromptId: 'gt-01', tone: 'formal', text: FORMAL_MODEL },
  { sourcePromptId: 'gt-07', tone: 'semi-formal', text: SEMI_FORMAL_MODEL },
  { sourcePromptId: 'gt-11', tone: 'informal', text: INFORMAL_MODEL },
]

/**
 * The worked letter to show for `prompt`.
 *
 * `exact` is true only when the model was written for this very prompt.
 * Otherwise the model for the same TONE is offered and the UI says plainly that
 * the content will not fit — the same contract, and the same honesty, as
 * `task2ModelFor`.
 */
export function letterModelFor(
  prompt: LetterPromptSpec | null,
): { text: string; exact: boolean; sourcePromptId: string } | null {
  if (!prompt) return null
  const exact = LETTER_MODELS.find((m) => m.sourcePromptId === prompt.id)
  if (exact) return { text: exact.text, exact: true, sourcePromptId: exact.sourcePromptId }
  const sameTone = LETTER_MODELS.find((m) => m.tone === prompt.tone)
  if (!sameTone) return null
  return { text: sameTone.text, exact: false, sourcePromptId: sameTone.sourcePromptId }
}
