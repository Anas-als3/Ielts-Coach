/**
 * Original paraphrases of what separates the IELTS writing bands, per
 * criterion, bands 5–8.
 *
 * COPYRIGHT: the official band descriptors are published by the IELTS partners
 * and remain their copyright. Every string in this file is an original
 * paraphrase written for this app — never replace one with wording from the
 * official tables or from prep sites. See SPEC.md "Teaching content".
 *
 * `task2` is the default wording, as everywhere in `meta.ts`; `task1` rewords
 * the same band for the report/letter task. The `TR` slot is labelled "Task
 * Response" for Task 2 and "Task Achievement" for Task 1 by `criterionLabel`
 * (`meta.ts:36-39`) — one slot, two names, which is why `Criterion` stays four
 * members.
 */
import type { Criterion, TaskKind } from '../types'

/** The bands the report can teach toward. Below 5 the advice is band 5's. */
export type DescriptorBand = 5 | 6 | 7 | 8

export interface DescriptorEntry {
  task2: string
  task1: string
}

export const BAND_DESCRIPTORS: Record<Criterion, Record<DescriptorBand, DescriptorEntry>> = {
  TR: {
    5: {
      task2:
        'The essay engages the topic but answers only part of the question; ideas are announced rather than developed, and the writer’s position drifts or has to be inferred.',
      task1:
        'The response works through details without the task’s shape: a chart answer with no overview sentence, or a letter that skips or barely touches one of its bullet points.',
    },
    6: {
      task2:
        'Every part of the question is answered and a position is visible, but development is uneven — some ideas are left as bare claims, abandoned before an example or a consequence supports them.',
      task1:
        'Everything the task asks for is at least present — an overview or a stated purpose, every bullet or data series mentioned — but selection is weak, so minor details take as much space as the main feature.',
    },
    7: {
      task2:
        'One clear position runs from the first paragraph to the last, and each main idea is extended: stated, explained, and backed with something concrete before the next idea begins.',
      task1:
        'The response opens with a clear overview (or purpose), selects the features that matter most, and covers every part of the task, quoting figures or details to support each key point rather than listing everything.',
    },
    8: {
      task2:
        'Every strand of the question is handled fully and in proportion; ideas are followed through to their consequences, and no sentence works against the stated position.',
      task1:
        'All the requirements are met fully and in proportion: the main trends or points are foregrounded, support is chosen rather than exhaustive, and no part of the task is left thin.',
    },
  },
  CC: {
    5: {
      task2:
        'Paragraphs exist but do not each own one idea; linking words appear, yet the reader still has to work out how one sentence follows from the previous one.',
      task1:
        'Information appears in the order it was noticed rather than grouped: comparisons are scattered across the answer, and the reader has to assemble the structure themselves.',
    },
    6: {
      task2:
        'The essay moves in a clear overall direction and uses connectives throughout, but mechanically — some links are faulty or overused, and referencing with ‘this’ and ‘such’ is thin.',
      task1:
        'Information is grouped logically — overview then detail, or one bullet point per paragraph — but the transitions between groups are abrupt or rely on the same formula each time.',
    },
    7: {
      task2:
        'Each paragraph is built around one central idea with a recognisable topic sentence, and the cohesion is mostly invisible: sentences connect through logic and referencing rather than through connector words alone.',
      task1:
        'The answer has a clean information plan: the overview comes first, detail paragraphs group related features, and each comparison is signalled just before the reader needs it.',
    },
    8: {
      task2:
        'The sequence of ideas feels inevitable — every paragraph advances the argument, cohesive devices vary and never draw attention to themselves, and paragraphing carries part of the meaning.',
      task1:
        'The organisation itself does the explaining: grouping, ordering and referencing make the pattern of the data (or the letter’s flow of requests) obvious without a single wasted signpost.',
    },
  },
  LR: {
    5: {
      task2:
        'The vocabulary is enough to carry the message but repeats itself; word choice is sometimes visibly wrong, and precision gives way to fillers such as ‘good’, ‘bad’ and ‘thing’.',
      task1:
        'The same few describing words carry the whole answer — ‘increase’ and ‘decrease’ on repeat — or the letter’s phrasing wobbles between formal and chatty from one sentence to the next.',
    },
    6: {
      task2:
        'The range is adequate and some less common words appear, but with noticeable errors of word form or collocation — the ambition outruns the control.',
      task1:
        'There is enough range to vary the description — rise, grow, climb — but strength and pace are missing from it, and a few choices sit at the wrong level of formality for the reader.',
    },
    7: {
      task2:
        'Less common words and natural collocations appear with only occasional slips; the writer paraphrases instead of repeating, and the register never wavers.',
      task1:
        'The language of change (or of the letter’s register) is varied and exact: verbs pair with precise adverbs, approximation is handled cleanly (‘just under a third’), and the tone never slips.',
    },
    8: {
      task2:
        'Word choice is precise and flexible: meanings are conveyed exactly, pairings are idiomatic, and the rare slip reads as a typo rather than a gap in knowledge.',
      task1:
        'Description is exact and economical: every figure or feature gets the word that fits it best, and in a letter the register reads as chosen for the reader rather than defaulted to.',
    },
  },
  GRA: {
    5: {
      task2:
        'Sentences are mostly simple or chained with ‘and’ and ‘but’; attempts at complex structures usually bring an error with them, and some errors make the reader re-read.',
      task1:
        'The grammar a report needs — comparatives, tenses that match the period, prepositions with figures — is attempted but often wrong, and the same sentence pattern repeats.',
    },
    6: {
      task2:
        'Simple and complex sentences mix, but errors are frequent enough to notice — spliced commas, dropped articles — even though the meaning survives them.',
      task1:
        'Sentence structure varies and the tense usually matches the time on the chart (or the letter’s timeline), but small errors recur: ‘increased of’, missing articles, agreement slips.',
    },
    7: {
      task2:
        'Complex sentences are frequent and usually clean; the majority of sentences carry no error at all, and the mistakes that remain never slow the reader down.',
      task1:
        'The structures a description depends on — comparisons, relative clauses, a passive where the doer is irrelevant — appear accurately, and most sentences are error-free.',
    },
    8: {
      task2:
        'A wide range of structures appears because the argument needs them, not for display; error-free sentences are the norm, and the slips are rare and trivial.',
      task1:
        'The grammar is wide-ranging and nearly invisible: time is handled consistently across the answer, comparisons are exact, and a reader must hunt to find an error.',
    },
  },
}

/**
 * The band the disclosure teaches toward: one above the learner’s floor,
 * clamped into [5, 8]. A 6.5 learner is taught band 7; below 5 the first
 * rung is 5; at 8 or above the ceiling entry (8) is shown — there is no
 * band-9 paraphrase because “what moves 8 → 9” is not something a form-only
 * engine should claim to know.
 */
export function nextDescriptorBand(band: number): DescriptorBand {
  const floor = Number.isFinite(band) ? Math.floor(band) : 4
  const next = floor + 1
  return Math.min(8, Math.max(5, next)) as DescriptorBand
}

/** The paraphrase to show for a criterion at the learner’s current band. */
export function descriptorFor(
  criterion: Criterion,
  band: number,
  task: TaskKind,
): { targetBand: DescriptorBand; text: string } {
  const targetBand = nextDescriptorBand(band)
  const entry = BAND_DESCRIPTORS[criterion][targetBand]
  const text = task === 'task1' ? entry.task1 : entry.task2
  return { targetBand, text }
}
