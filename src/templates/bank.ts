/**
 * Writing templates: fifteen paragraph-by-paragraph skeletons the learner can
 * follow WHILE writing — two per Task 2 question type, two chart-kind-agnostic
 * Academic Task 1 shapes, one per General Training letter tone. Implements
 * plan 033.
 *
 * ## Copyright and provenance
 *
 * **Nothing in this file is reproduced from any IELTS publisher or prep
 * site.** Every guidance sentence and every starter phrase is original prose
 * written for this project. The FORMAT — paragraph-by-paragraph skeletons —
 * is not copyrightable and every serious IELTS course teaches by template;
 * the wording here is this project's own.
 *
 * ## What a template teaches, and what it does not
 *
 * Every Task 2 body paragraph instructs an example, because the engine's
 * `EXAMPLE_MARKERS` check (`analysis/rules/structure.ts`) rewards exactly
 * that. Every letter opens with a greeting, states its purpose early, gives
 * one paragraph per bullet, and closes with a sign-off that PAIRS with the
 * greeting — the same pairing `analysis/rules/letterAchievement.ts` marks.
 * Starters are openers to reword, never to paste: the memorisation warning
 * below matches `ModelAnswer.tsx`'s voice. A template never gets pasted into
 * the essay sheet (see plan 033's "out of scope" — inserted scaffolding would
 * be analysed as the learner's own words and flagged, and the exam bans it
 * anyway); it is a reference pane the learner reads, not a text generator.
 *
 * The two letters with no starters at all (`tpl-lt-formal`'s bullets and the
 * whole of `tpl-lt-informal`) are deliberate, not an oversight: a formal
 * purpose statement is already a fixed formula ("I am writing to…", given as
 * the template's one starter on its opening paragraph) with nothing further
 * to script, and prescribing canned informal phrasing would contradict
 * `tpl-lt-informal`'s own note — informal is a register, not an excuse to
 * sound scripted.
 */
import type { LetterTone, QuestionType, TaskKind, TemplateSection, WritingTemplate } from '../types'

/* --------------------------------- helpers ---------------------------------- */

function section(title: string, guidance: string, starters: readonly string[] = []): TemplateSection {
  return { title, guidance, starters }
}

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
      section(
        'Introduction',
        'Paraphrase the statement in your own words, then state your position outright — for example, "I fully agree that…". This shape only works when you hold that position all the way through.',
        ['It is often argued that…'],
      ),
      section(
        'Strongest reason',
        'Give your strongest reason for holding this position, then support it with a concrete example.',
        ['The clearest reason is that…'],
      ),
      section(
        'Second reason',
        'Add a second reason and its own example, or use this paragraph to rebut the opposite view.',
      ),
      section('Conclusion', "Restate your position in fresh words — don't just repeat the introduction's sentence."),
    ],
  },
  {
    id: 'tpl-op-balanced',
    label: 'Balanced (partly agree)',
    kind: 'task2',
    questionTypes: ['opinion'],
    paragraphs: [
      section(
        'Introduction',
        'Paraphrase the statement, then say "I largely agree, with one reservation." That signals from paragraph one that the essay is balanced, not undecided.',
        ['There is much truth in the claim that…'],
      ),
      section(
        'The part you accept',
        'Explain the part of the statement you accept, and support it with a concrete example.',
      ),
      section('Your reservation', 'Explain your reservation and give it its own example.', ['That said, …']),
      section('Conclusion', 'Weigh the two paragraphs against each other and land clearly on your side.'),
    ],
  },
  {
    id: 'tpl-di-both-then-view',
    label: 'Both views, then yours',
    kind: 'task2',
    questionTypes: ['discussion'],
    paragraphs: [
      section(
        'Introduction',
        'Paraphrase both views named in the question, then promise that your own opinion is coming.',
      ),
      section(
        'First view',
        'Present the first view fairly: explain why its holders believe it, grounded in a concrete example.',
        ['Those who favour… point out that…'],
      ),
      section(
        'Second view',
        'Present the second view and its case, with an example of its own.',
        ['Supporters of the second view respond that…'],
      ),
      section('Conclusion', 'Give your verdict and the reason it wins.'),
    ],
  },
  {
    id: 'tpl-di-view-throughout',
    label: 'Your view throughout',
    kind: 'task2',
    questionTypes: ['discussion'],
    note: 'Stronger position focus, harder to keep fair — the task still requires BOTH views discussed.',
    paragraphs: [
      section(
        'Introduction',
        'Name both views, then declare your side at once.',
        ['While some maintain that…, the stronger case is that…'],
      ),
      section("Your side's case", "Make your side's case and support it with a concrete example."),
      section(
        'The other view, acknowledged',
        'Acknowledge the other view with an example of its own, then answer it.',
      ),
      section('Conclusion', 'Restate your position.'),
    ],
  },
  {
    id: 'tpl-ps-paired',
    label: 'Problem–solution pairs',
    kind: 'task2',
    questionTypes: ['problem-solution'],
    paragraphs: [
      section('Introduction', 'Restate the situation, then promise that both problems and remedies are coming.'),
      section(
        'First problem and solution',
        'Give the first problem, then the solution that directly answers it, with a concrete example.',
        ['The most pressing difficulty is…', 'The most direct answer is to…'],
      ),
      section('Second problem and solution', 'Give the second problem-and-solution pair the same way.'),
      section('Conclusion', 'Say which remedy matters most.'),
    ],
  },
  {
    id: 'tpl-ps-split',
    label: 'Problems first, then solutions',
    kind: 'task2',
    questionTypes: ['problem-solution'],
    note: 'Pick when problems share one root; the mapping-back sentence is what keeps cohesion.',
    paragraphs: [
      section('Introduction', 'Restate the situation, then promise that both problems and remedies are coming.'),
      section(
        'The problems',
        'Lay out the problems, connected to each other, each illustrated with an example or figure.',
        ['Two related problems stand out…'],
      ),
      section(
        'The solutions',
        'Map each solution back to a named problem, with one worked instance.',
        ['Each of these can be met…'],
      ),
      section('Conclusion', 'Close the essay.'),
    ],
  },
  {
    id: 'tpl-ad-outweigh',
    label: 'One side outweighs',
    kind: 'task2',
    questionTypes: ['advantages-disadvantages'],
    paragraphs: [
      section('Introduction', 'Name the development, then state which side wins.'),
      section(
        'The winning side',
        'Give the winning side two benefits or costs, plus a concrete example.',
        ['The benefits are considerable…'],
      ),
      section(
        'The other side, conceded',
        'Concede the other side with a concrete example, then show why it is smaller.',
        ['Admittedly…, yet…'],
      ),
      section('Conclusion', 'Restate the verdict.'),
    ],
  },
  {
    id: 'tpl-ad-survey',
    label: 'Even-handed survey',
    kind: 'task2',
    questionTypes: ['advantages-disadvantages'],
    paragraphs: [
      section('Introduction', 'Name the development, then promise that both sides are coming.'),
      section('Advantages', 'Cover the advantages, with a concrete example.', ['On the positive side…']),
      section('Disadvantages', 'Cover the disadvantages, with a concrete example.', ['Against this…']),
      section('Conclusion', 'Say, on balance, which side wins and why — the task asks you to land somewhere.'),
    ],
  },
  {
    id: 'tpl-dq-two-para',
    label: 'One question per paragraph',
    kind: 'task2',
    questionTypes: ['double-question'],
    note: "The safest double-question shape — the rail's question-coverage check wants BOTH answered visibly.",
    paragraphs: [
      section('Introduction', 'Paraphrase the topic, then promise that both questions will be answered.'),
      section('First question', 'Answer the first question fully, with a concrete example.', ['The main cause is…']),
      section(
        'Second question',
        'Answer the second question, with its own example.',
        ['As for what should be done…'],
      ),
      section('Conclusion', 'Give both answers again, one sentence each.'),
    ],
  },
  {
    id: 'tpl-dq-woven',
    label: 'Woven answers',
    kind: 'task2',
    questionTypes: ['double-question'],
    note: 'Only when the two questions genuinely share one answer; otherwise use the two-paragraph shape.',
    paragraphs: [
      section(
        'Introduction',
        'Name both questions, then give one thesis that links them.',
        ['These two questions share one answer…'],
      ),
      section('First strand', 'Develop the first strand of the thesis, touching both questions, with an example.'),
      section('Second strand', 'Develop the second strand, with its own example.'),
      section('Conclusion', 'Close the essay.'),
    ],
  },

  /* ============================= academic task 1 ============================= */

  {
    id: 'tpl-t1-trends',
    label: 'Overview first, grouped by trend',
    kind: 'chart',
    note: "The default shape; the overview paragraph is what the rail's overview check looks for.",
    paragraphs: [
      section('Paraphrase', 'Rewrite the title sentence in your own words: what the chart shows, where, and when.'),
      section(
        'Overview',
        'Give the two biggest movements or contrasts — no numbers here. This is the single largest mark in Task 1.',
        ['Overall, the most striking feature is…'],
      ),
      section(
        'First group (the risers)',
        'Cover the first group — for example the risers — with selected figures.',
        ['Turning to the detail…'],
      ),
      section('Second group (the fallers)', 'Cover the second group — the fallers or the outliers — with figures.'),
    ],
  },
  {
    id: 'tpl-t1-compare',
    label: 'Comparison-led',
    kind: 'chart',
    note: "Pick for static comparisons (tables, pies, grouped bars) where 'trend' language has nothing to move.",
    paragraphs: [
      section('Paraphrase', "Paraphrase the chart's title sentence."),
      section(
        'Overview',
        'Give the overview of the comparison: which category dominates, and where the categories converge.',
      ),
      section(
        'The dominant category',
        'Set the dominant category against the rest, with figures.',
        ['By far the largest share belongs to…'],
      ),
      section('Exceptions and crossovers', 'Cover the exceptions and crossovers.', ['The gap narrows when…']),
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
      section(
        'Greeting and purpose',
        'Open with "Dear Mr/Ms ‹name›," when you know who you are writing to, or "Dear Sir or Madam," when you do not. State your purpose in the first sentence.',
        ['I am writing to…'],
      ),
      section('Bullet 1', 'Develop the first bullet point fully, with a concrete detail. No contractions.'),
      section('Bullet 2', 'Develop the second bullet point fully, with a concrete detail. No contractions.'),
      section(
        'Bullet 3',
        'Develop the third bullet point, then request the action you want. Close with "Yours sincerely," if you named the reader, or "Yours faithfully," if you did not.',
      ),
    ],
  },
  {
    id: 'tpl-lt-semiformal',
    label: 'Known name, serious matter',
    kind: 'letter',
    tones: ['semi-formal'],
    paragraphs: [
      section(
        'Greeting and purpose',
        'Open with "Dear Mr/Ms ‹surname›," then a friendly line before you state the purpose.',
        ['I hope this finds you well.', 'I wanted to raise…'],
      ),
      section('Bullet 1', 'Develop the first bullet point, polite but warm, with a specific detail.'),
      section('Bullet 2', 'Develop the second bullet point the same way.'),
      section(
        'Bullet 3',
        'Develop the third bullet point, then close with appreciation and "Yours sincerely," or "Best regards,".',
      ),
    ],
  },
  {
    id: 'tpl-lt-informal',
    label: 'A friend',
    kind: 'letter',
    tones: ['informal'],
    note: 'Informal is a register, not an excuse — the bullets still all get covered.',
    paragraphs: [
      section(
        'Greeting and purpose',
        'Open with "Dear ‹first name›," then a warm opening before you say why you\'re writing. Contractions welcome.',
      ),
      section('Bullet 1', "Cover the first bullet point as you'd say it aloud, with a real detail."),
      section('Bullet 2', 'Cover the second bullet point the same way.'),
      section('Bullet 3', 'Cover the third bullet point, then close warmly with "Best wishes," or "Take care,".'),
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
