/**
 * Writing templates: fifteen paragraph-by-paragraph skeletons the learner can
 * follow WHILE writing — two per Task 2 question type, two chart-kind-agnostic
 * Academic Task 1 shapes, one per General Training letter tone. Originally
 * plan 033 (section descriptions with a couple of reworded openers per
 * paragraph); plan 034 rebuilt every section as complete sentence frames with
 * `[bracketed]` slots, followed sentence by sentence while writing.
 *
 * ## Copyright and provenance
 *
 * **Nothing in this file is reproduced from any IELTS publisher or prep
 * site.** Every guidance sentence and every frame is original prose written
 * for this project. The FORMAT — paragraph-by-paragraph sentence frames — is
 * not copyrightable and every serious IELTS course teaches by template; the
 * wording here is this project's own. Each question type's two templates use
 * different connective sets and different frame phrasings on purpose: two
 * learners drilling the same question type should not end up writing the same
 * essay.
 *
 * ## What a template teaches, and what it does not
 *
 * Every Task 2 body paragraph's frames carry an example-type slot, because
 * the engine's `EXAMPLE_MARKERS` check (`analysis/rules/structure.ts`)
 * rewards exactly that. Every letter opens with a greeting, states its
 * purpose in the first frame, gives one paragraph per bullet, and closes with
 * a sign-off that PAIRS with the greeting — the same pairing
 * `analysis/rules/letterAchievement.ts` marks. Frames are sentences to fill
 * in the learner's own words and reword, never to paste: the memorisation
 * warning below is sharper than plan 033's, precisely because a fill-in
 * sentence is closer to something a learner could paste unchanged. A template
 * never gets pasted into the essay sheet (see plan 033's "out of scope" —
 * inserted scaffolding would be analysed as the learner's own words and
 * flagged, and the exam bans it anyway); it is a reference pane the learner
 * reads, not a text generator.
 */
import type { LetterTone, QuestionType, TaskKind, WritingTemplate } from '../types'

/* ------------------------------------ bank ----------------------------------- */

export const WRITING_TEMPLATES: readonly WritingTemplate[] = [
  /* ================================= task 2 ================================= */

  {
    id: 'tpl-op-onesided',
    label: 'Full agreement (or disagreement)',
    kind: 'task2',
    questionTypes: ['opinion'],
    note:
      'Pick when your view is genuinely firm — a hedged essay written on a one-sided skeleton reads as contradiction.',
    paragraphs: [
      {
        title: 'Introduction',
        guidance:
          'Paraphrase the statement, then state your position outright. This shape only works when you hold that position all the way through.',
        frames: [
          'It is increasingly common to hear that [paraphrase the statement].',
          'Although some would push back, I fully [agree/disagree]: [your position in one clause].',
        ],
      },
      {
        title: 'Strongest reason',
        guidance: 'Give your strongest reason for holding this position, then support it with a concrete example.',
        frames: [
          'The strongest reason is that [your first reason].',
          'Put simply, [explain it in different words].',
          '[A concrete example — a country, a study, a workplace] shows this clearly: [what happened].',
        ],
      },
      {
        title: 'Second reason',
        guidance: 'Add a second reason and its own example, or use this paragraph to rebut the opposite view.',
        frames: [
          'Beyond that, [your second reason].',
          'This matters because [the consequence].',
          'Consider [a second example]: [what it demonstrates].',
        ],
      },
      {
        title: 'Conclusion',
        guidance: "Restate your position in fresh words — don't just repeat the introduction's sentence.",
        frames: [
          'For these reasons I remain convinced that [your position, reworded].',
          'If anything, [a closing thought that extends, not repeats].',
        ],
      },
    ],
  },
  {
    id: 'tpl-op-balanced',
    label: 'Balanced (partly agree)',
    kind: 'task2',
    questionTypes: ['opinion'],
    paragraphs: [
      {
        title: 'Introduction',
        guidance: 'Paraphrase the statement, then signal at once that the essay is balanced, not undecided.',
        frames: [
          '[Paraphrase the statement] — a claim with real force, though not the whole story.',
          'I largely agree, with one reservation: [name it].',
        ],
      },
      {
        title: 'The part you accept',
        guidance: 'Explain the part of the statement you accept, and support it with a concrete example.',
        frames: [
          'Where the claim convinces is [the part you accept].',
          'In practice, [explanation].',
          '[An example] makes the point: [what it shows].',
        ],
      },
      {
        title: 'Your reservation',
        guidance: 'Explain your reservation and give it its own example.',
        frames: [
          'The reservation is [your caveat].',
          'That is, [explain the limit].',
          '[A counter-example] illustrates why: [what it shows].',
        ],
      },
      {
        title: 'Conclusion',
        guidance: 'Weigh the two paragraphs against each other and land clearly on your side.',
        frames: [
          'On balance, [restate: mostly agree, minus the caveat].',
          'The claim holds — provided [the condition].',
        ],
      },
    ],
  },
  {
    id: 'tpl-di-both-then-view',
    label: 'Both views, then yours',
    kind: 'task2',
    questionTypes: ['discussion'],
    paragraphs: [
      {
        title: 'Introduction',
        guidance: 'Paraphrase both views named in the question, then promise that your own opinion is coming.',
        frames: [
          'Whether [the issue, paraphrased] divides opinion sharply.',
          'Some hold that [first view]; others counter that [second view].',
          'Both deserve a hearing before I give my own verdict.',
        ],
      },
      {
        title: 'First view',
        guidance:
          'Present the first view fairly: explain why its holders believe it, grounded in a concrete example.',
        frames: [
          'Those who [favour the first view] point to [their main ground].',
          'From their standpoint, [explanation].',
          '[An example] supports them: [what it shows].',
        ],
      },
      {
        title: 'Second view',
        guidance: 'Present the second view and its case, with an example of its own.',
        frames: [
          "The opposing camp answers that [second view's ground].",
          'Their case rests on [explanation].',
          '[A different example] backs this: [what it shows].',
        ],
      },
      {
        title: 'Conclusion',
        guidance: 'Give your verdict and the reason it wins.',
        frames: ['Weighing the two, I side with [your view] because [the deciding reason].'],
      },
    ],
  },
  {
    id: 'tpl-di-view-throughout',
    label: 'Your view throughout',
    kind: 'task2',
    questionTypes: ['discussion'],
    note: 'Stronger position focus, harder to keep fair — the task still requires BOTH views discussed.',
    paragraphs: [
      {
        title: 'Introduction',
        guidance: 'Name both views, then declare your side at once.',
        frames: [
          '[The issue, paraphrased] is often framed as a choice between [view A] and [view B].',
          'From the outset, my position is that [your side], though the other view merits attention.',
        ],
      },
      {
        title: "Your side's case",
        guidance: "Make your side's case and support it with a concrete example.",
        frames: [
          'The decisive consideration is [your main ground].',
          'In other words, [explanation].',
          '[An example]: [what it shows].',
        ],
      },
      {
        title: 'The other view, acknowledged',
        guidance: 'Acknowledge the other view with an example of its own, then answer it.',
        frames: [
          'Admittedly, those who argue [the other view] have a point about [their strongest ground], as [their example] shows.',
          'Yet this overlooks [the flaw], which is why the argument ultimately fails.',
        ],
      },
      {
        title: 'Conclusion',
        guidance: 'Restate your position.',
        frames: ['Both positions were worth weighing, but [your side] carries the day: [one-clause reason].'],
      },
    ],
  },
  {
    id: 'tpl-ps-paired',
    label: 'Problem–solution pairs',
    kind: 'task2',
    questionTypes: ['problem-solution'],
    paragraphs: [
      {
        title: 'Introduction',
        guidance: 'Restate the situation, then promise that both problems and remedies are coming.',
        frames: [
          '[The situation, paraphrased] brings problems that are serious but not unanswerable.',
          'Two stand out, and each has a workable remedy.',
        ],
      },
      {
        title: 'First problem and solution',
        guidance:
          'Give the first problem, then the solution that directly answers it, with a concrete example.',
        frames: [
          'The most pressing difficulty is [problem one].',
          'Its effects show up as [consequence].',
          'The direct answer is to [solution one], as [an example — a city, a policy, a company] has already shown by [what they did].',
        ],
      },
      {
        title: 'Second problem and solution',
        guidance: 'Give the second problem-and-solution pair the same way.',
        frames: [
          'A second, related problem is [problem two].',
          'Left alone, it leads to [consequence].',
          'Here the remedy is [solution two]; [an example or figure] suggests it works because [why].',
        ],
      },
      {
        title: 'Conclusion',
        guidance: 'Say which remedy matters most.',
        frames: ['Neither remedy is costless, but [the one that matters most] deserves priority because [reason].'],
      },
    ],
  },
  {
    id: 'tpl-ps-split',
    label: 'Problems first, then solutions',
    kind: 'task2',
    questionTypes: ['problem-solution'],
    note: 'Pick when problems share one root; the mapping-back sentence is what keeps cohesion.',
    paragraphs: [
      {
        title: 'Introduction',
        guidance: 'Restate the situation, then promise that both problems and remedies are coming.',
        frames: ['[The situation, paraphrased] raises connected problems that are best solved together.'],
      },
      {
        title: 'The problems',
        guidance:
          'Lay out the problems, connected to each other, each illustrated with an example or figure.',
        frames: [
          'The first is [problem one], visible in [an example or figure].',
          'Feeding into it is [problem two]: [one-sentence explanation].',
          'Together they [the shared root or combined effect].',
        ],
      },
      {
        title: 'The solutions',
        guidance: 'Map each solution back to a named problem, with one worked instance.',
        frames: [
          'Because the problems share [the root], the answers must too.',
          '[Solution one] tackles [problem one] directly; [an example — a city, a policy, a company] shows how.',
          '[Solution two] then addresses [problem two] by [mechanism].',
        ],
      },
      {
        title: 'Conclusion',
        guidance: 'Close the essay.',
        frames: ['Solved separately these problems return; addressed at [the root], they need not.'],
      },
    ],
  },
  {
    id: 'tpl-ad-outweigh',
    label: 'One side outweighs',
    kind: 'task2',
    questionTypes: ['advantages-disadvantages'],
    paragraphs: [
      {
        title: 'Introduction',
        guidance: 'Name the development, then state which side wins.',
        frames: [
          '[The development, paraphrased] has costs as well as benefits, but the balance is not close.',
          'In my view the [advantages/disadvantages] clearly outweigh.',
        ],
      },
      {
        title: 'The winning side',
        guidance: 'Give the winning side two benefits or costs, plus a concrete example.',
        frames: [
          'The first major [benefit/cost] is [point one]; [an example] bears this out: [what happened].',
          'Just as weighty, [point two], because [explanation].',
        ],
      },
      {
        title: 'The other side, conceded',
        guidance: 'Concede the other side with a concrete example, then show why it is smaller.',
        frames: [
          "Against this stand [the other side's strongest point], and [a concrete example] shows it is real.",
          'Real — but limited: [why it weighs less].',
        ],
      },
      {
        title: 'Conclusion',
        guidance: 'Restate the verdict.',
        frames: ['Set side by side, the [winning side] dominates, and [one-clause final reason].'],
      },
    ],
  },
  {
    id: 'tpl-ad-survey',
    label: 'Even-handed survey',
    kind: 'task2',
    questionTypes: ['advantages-disadvantages'],
    paragraphs: [
      {
        title: 'Introduction',
        guidance: 'Name the development, then promise that both sides are coming.',
        frames: ['[The development, paraphrased] rewards a careful look at both columns of the ledger.'],
      },
      {
        title: 'Advantages',
        guidance: 'Cover the advantages, with a concrete example.',
        frames: [
          'On the positive side, [advantage one]; [an example]: [what it shows].',
          'A further gain is [advantage two], since [explanation].',
        ],
      },
      {
        title: 'Disadvantages',
        guidance: 'Cover the disadvantages, with a concrete example.',
        frames: [
          'The drawbacks are just as concrete.',
          '[Disadvantage one] — as [an example] demonstrates — [its effect].',
          'There is also [disadvantage two], which [explanation].',
        ],
      },
      {
        title: 'Conclusion',
        guidance: 'Say, on balance, which side wins and why — the task asks you to land somewhere.',
        frames: ['On balance I judge the [side you land on] weightier, chiefly because [the deciding reason].'],
      },
    ],
  },
  {
    id: 'tpl-dq-two-para',
    label: 'One question per paragraph',
    kind: 'task2',
    questionTypes: ['double-question'],
    note: "The safest double-question shape — the rail's question-coverage check wants BOTH answered visibly.",
    paragraphs: [
      {
        title: 'Introduction',
        guidance: 'Paraphrase the topic, then promise that both questions will be answered.',
        frames: [
          '[The topic, paraphrased] raises two questions: [question one, compressed] and [question two, compressed].',
          'I take each in turn.',
        ],
      },
      {
        title: 'First question',
        guidance: 'Answer the first question fully, with a concrete example.',
        frames: [
          'On the first, [your answer].',
          'The main reason is [ground], which [explanation].',
          '[An example]: [what it shows].',
        ],
      },
      {
        title: 'Second question',
        guidance: 'Answer the second question, with its own example.',
        frames: [
          'As to the second, [your answer].',
          'This follows because [ground].',
          '[An example or consequence] makes it concrete: [what it shows].',
        ],
      },
      {
        title: 'Conclusion',
        guidance: 'Give both answers again, one sentence each.',
        frames: ['In short: [answer one, one clause], and [answer two, one clause].'],
      },
    ],
  },
  {
    id: 'tpl-dq-woven',
    label: 'Woven answers',
    kind: 'task2',
    questionTypes: ['double-question'],
    note: 'Only when the two questions genuinely share one answer; otherwise use the two-paragraph shape.',
    paragraphs: [
      {
        title: 'Introduction',
        guidance: 'Name both questions, then give one thesis that links them.',
        frames: [
          'The two questions here — [question one] and [question two] — share one answer: [the linking thesis].',
        ],
      },
      {
        title: 'First strand',
        guidance: 'Develop the first strand of the thesis, touching both questions, with an example.',
        frames: [
          '[First aspect of the thesis] speaks to both: [how it answers question one], and equally [how it bears on question two].',
          '[An example] shows both at once: [what it shows].',
        ],
      },
      {
        title: 'Second strand',
        guidance: 'Develop the second strand, with its own example.',
        frames: [
          '[Second aspect] completes the picture: [explanation touching both questions].',
          'Here [a second example] is telling: [what it shows].',
        ],
      },
      {
        title: 'Conclusion',
        guidance: 'Close the essay.',
        frames: ['One thesis, two questions answered: [restate the link in fresh words].'],
      },
    ],
  },

  /* ============================= academic task 1 ============================= */

  {
    id: 'tpl-t1-trends',
    label: 'Overview first, grouped by trend',
    kind: 'chart',
    note: "The default shape; the overview paragraph is what the rail's overview check looks for.",
    paragraphs: [
      {
        title: 'Paraphrase',
        guidance: 'Rewrite the title sentence in your own words: what the chart shows, where, and when.',
        frames: ['The [chart/graph/table] shows [what], in [where/units], between [period].'],
      },
      {
        title: 'Overview',
        guidance:
          'Give the two biggest movements or contrasts — no numbers here. This is the single largest mark in Task 1.',
        frames: ['Overall, the most striking feature is [the biggest movement or contrast], while [the second feature].'],
      },
      {
        title: 'First group (the risers)',
        guidance: 'Cover the first group — for example the risers — with selected figures.',
        frames: [
          'Looking first at [the risers / the larger categories], [category] [rose/led] from [figure] to [figure], and [second category] followed, [movement + figure].',
        ],
      },
      {
        title: 'Second group (the fallers)',
        guidance: 'Cover the second group — the fallers or the outliers — with figures.',
        frames: [
          '[The fallers / the outliers] tell the opposite story: [category] [fell/lagged] to [figure], while [category] [movement + figure].',
        ],
      },
    ],
  },
  {
    id: 'tpl-t1-compare',
    label: 'Comparison-led',
    kind: 'chart',
    note: "Pick for static comparisons (tables, pies, grouped bars) where 'trend' language has nothing to move.",
    paragraphs: [
      {
        title: 'Paraphrase',
        guidance: "Paraphrase the chart's title sentence.",
        frames: ['The [chart/table] compares [categories] by [measure] in [context/period].'],
      },
      {
        title: 'Overview',
        guidance:
          'Give the overview of the comparison: which category dominates, and where the categories converge.',
        frames: ['Overall, [the dominant category] leads throughout, and the gap [narrows/widens/holds] [where].'],
      },
      {
        title: 'The dominant category',
        guidance: 'Set the dominant category against the rest, with figures.',
        frames: [
          '[Dominant category] accounts for [figure], roughly [multiple/fraction] of [comparison], with [second category] at [figure].',
        ],
      },
      {
        title: 'Exceptions and crossovers',
        guidance: 'Cover the exceptions and crossovers.',
        frames: [
          'The pattern breaks at [the exception]: [category] [what it does + figure], the only case where [what makes it exceptional].',
        ],
      },
    ],
  },

  /* ================================ gt letters ================================ */

  {
    id: 'tpl-lt-formal',
    label: 'To a stranger with a title',
    kind: 'letter',
    tones: ['formal'],
    note: "The sign-off pairing is the engine's rule too — the template and the marker agree.",
    paragraphs: [
      {
        title: 'Greeting and purpose',
        guidance:
          'Open with the greeting that matches what you know about the reader, then state your purpose in the first sentence.',
        frames: [
          'Dear [Mr/Ms + surname, or Sir or Madam],',
          'I am writing to [your purpose — complain about / request / inform you of] [the matter].',
        ],
      },
      {
        title: 'Bullet 1',
        guidance: 'Develop the first bullet point fully, with a concrete detail. No contractions.',
        frames: [
          'To explain the background: [bullet one, developed].',
          'Specifically, [a concrete detail — date, place, reference].',
        ],
      },
      {
        title: 'Bullet 2',
        guidance: 'Develop the second bullet point fully, with a concrete detail. No contractions.',
        frames: ['What concerns me most is [bullet two, developed].', 'As a result, [the consequence for you].'],
      },
      {
        title: 'Bullet 3',
        guidance:
          'Develop the third bullet point, then request the action you want. Close with the sign-off that pairs with your greeting.',
        frames: [
          'I would therefore ask that [bullet three / the action you want].',
          'I would appreciate a reply by [timeframe].',
          'Yours sincerely, (if you named them) / Yours faithfully, (if you wrote Sir or Madam)',
          '[your full name]',
        ],
      },
    ],
  },
  {
    id: 'tpl-lt-semiformal',
    label: 'Known name, serious matter',
    kind: 'letter',
    tones: ['semi-formal'],
    paragraphs: [
      {
        title: 'Greeting and purpose',
        guidance: "Open with the reader's name, then a friendly line before you state the purpose.",
        frames: [
          'Dear [Mr/Ms + surname],',
          'I hope this letter finds you well.',
          'I wanted to write about [your purpose].',
        ],
      },
      {
        title: 'Bullet 1',
        guidance: 'Develop the first bullet point, polite but warm, with a specific detail.',
        frames: ['You may remember that [bullet one, with the shared context].'],
      },
      {
        title: 'Bullet 2',
        guidance: 'Develop the second bullet point the same way.',
        frames: ['The difficulty now is [bullet two], which means [consequence].'],
      },
      {
        title: 'Bullet 3',
        guidance:
          'Develop the third bullet point, then close with appreciation and the sign-off that pairs with your greeting.',
        frames: [
          'Would it be possible to [bullet three / the request]?',
          'It would make a real difference because [reason].',
          'Yours sincerely, / Best regards,',
          '[Your name]',
        ],
      },
    ],
  },
  {
    id: 'tpl-lt-informal',
    label: 'A friend',
    kind: 'letter',
    tones: ['informal'],
    note: 'Informal is a register, not an excuse — the bullets still all get covered.',
    paragraphs: [
      {
        title: 'Greeting and purpose',
        guidance: "Open with a warm greeting, then say why you're writing — casually. Contractions welcome.",
        frames: ['Dear [first name],', "It's been too long! I am writing because [your purpose, casually]."],
      },
      {
        title: 'Bullet 1',
        guidance: "Cover the first bullet point as you'd say it aloud, with a real detail.",
        frames: ["You won't believe [bullet one, told as you'd say it]."],
      },
      {
        title: 'Bullet 2',
        guidance: 'Cover the second bullet point the same way.',
        frames: ['The thing is, [bullet two] — [a real detail].'],
      },
      {
        title: 'Bullet 3',
        guidance: 'Cover the third bullet point, then close warmly with the sign-off that fits.',
        frames: [
          "So here's my idea: [bullet three / the plan]. What do you think?",
          'Best wishes, / Take care,',
          '[Your name]',
        ],
      },
    ],
  },
]

/**
 * The templates that suit one desk: the active task, whether it is a General
 * Training letter, and (task-appropriate) the Task 2 question type or letter
 * tone. Order follows the bank, so the two templates for one question type or
 * the single template for one tone always appear in the order written above.
 */
export function templatesFor(
  task: TaskKind,
  isLetter: boolean,
  questionType?: QuestionType,
  tone?: LetterTone,
): WritingTemplate[] {
  if (isLetter) {
    return WRITING_TEMPLATES.filter(
      (t) => t.kind === 'letter' && (tone === undefined || (t.tones?.includes(tone) ?? false)),
    )
  }
  if (task === 'task1') {
    return WRITING_TEMPLATES.filter((t) => t.kind === 'chart')
  }
  return WRITING_TEMPLATES.filter(
    (t) => t.kind === 'task2' && (questionType === undefined || (t.questionTypes?.includes(questionType) ?? false)),
  )
}
