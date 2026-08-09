import type { Criterion, IssueCategory, QuestionType, TaskKind } from './types'

/** Display metadata for the four IELTS band criteria. Task 2 wording is the default. */
export const CRITERION_META: Record<Criterion, { label: string; short: string }> = {
  TR: { label: 'Task Response', short: 'Task' },
  CC: { label: 'Coherence & Cohesion', short: 'Coherence' },
  LR: { label: 'Lexical Resource', short: 'Vocabulary' },
  GRA: { label: 'Grammatical Range & Accuracy', short: 'Grammar' },
}

/**
 * Criterion display name for a given task.
 *
 * IELTS marks the same first slot as "Task Response" in Task 2 and "Task
 * Achievement" in Task 1 — ONE slot, two names. That is why `Criterion` stays
 * four members: a fifth would force `Partial<Record<Criterion, …>>` through the
 * band estimator and every view that renders it, to express a key that is
 * always absent for one task.
 */
export function criterionLabel(criterion: Criterion, task: TaskKind): { label: string; short: string } {
  if (criterion === 'TR' && task === 'task1') return { label: 'Task Achievement', short: 'Task' }
  return CRITERION_META[criterion]
}

/** Learner-facing names and one-line explanations per error category. */
export const CATEGORY_META: Record<IssueCategory, { label: string; criterion: Criterion; hint: string }> = {
  'word-count': { label: 'Word count', criterion: 'TR', hint: 'Task 2 requires at least 250 words; under-length essays are penalised.' },
  'question-coverage': { label: 'Question coverage', criterion: 'TR', hint: 'Every part of the question must be addressed.' },
  'prompt-echo': { label: 'Copied prompt wording', criterion: 'TR', hint: 'Copying the question verbatim is excluded from your word count — paraphrase it.' },
  'no-position': { label: 'Position not stated', criterion: 'TR', hint: 'Opinion essays need a clear position, stated in the introduction and maintained.' },
  'position-consistency': { label: 'Position consistency', criterion: 'TR', hint: 'Your opinion in the introduction and the conclusion must say the same thing.' },
  'off-topic': { label: 'Off topic', criterion: 'TR', hint: 'Body paragraphs must engage with the specific question, not a nearby topic.' },
  'overgeneralisation': { label: 'Overgeneralisation', criterion: 'TR', hint: 'Sweeping claims without hedging weaken your argument.' },
  'personal-anecdote': { label: 'Personal anecdote', criterion: 'TR', hint: 'Task 2 asks for argument and evidence, not personal stories.' },
  'paragraphing': { label: 'Paragraphing', criterion: 'CC', hint: 'Aim for 4–5 paragraphs: introduction, 2–3 bodies, conclusion.' },
  'no-conclusion': { label: 'Conclusion', criterion: 'CC', hint: 'An essay without a conclusion caps Task Response at band 5.' },
  'topic-sentence': { label: 'Topic sentences', criterion: 'CC', hint: 'Each body paragraph should open with a clear central idea.' },
  'intro-shape': { label: 'Introduction shape', criterion: 'CC', hint: 'Three sentences: topic in your words, the two views, your opinion. Examples belong in the body.' },
  'conclusion-shape': { label: 'Conclusion shape', criterion: 'CC', hint: 'Two sentences: restate your opinion, then why it matters. Never a new example.' },
  'linking-overuse': { label: 'Linker overuse', criterion: 'CC', hint: 'Mechanical linking in every sentence reads as memorised — use cohesion naturally.' },
  'linking-underuse': { label: 'Too few linkers', criterion: 'CC', hint: 'Ideas need signposting: contrast, cause, example, conclusion.' },
  'linking-repetition': { label: 'Repeated linkers', criterion: 'CC', hint: 'Vary your cohesive devices instead of reusing the same one.' },
  'connector-misuse': { label: 'Connector misuse', criterion: 'CC', hint: "Some connectors mean something else: 'meanwhile' is temporal — for contrast use 'whereas'." },
  'paragraph-balance': { label: 'Paragraph balance', criterion: 'CC', hint: 'Very short or very long paragraphs suggest undeveloped or unfocused ideas.' },
  'informal-register': { label: 'Informal language', criterion: 'LR', hint: 'Task 2 requires a formal academic register.' },
  'contraction': { label: 'Contractions', criterion: 'LR', hint: "Write the full forms: 'do not', not 'don't'." },
  'repetition': { label: 'Word repetition', criterion: 'LR', hint: 'Repeating the same content word suggests a narrow vocabulary range.' },
  'weak-vocabulary': { label: 'Weak vocabulary', criterion: 'LR', hint: 'Vague words (good, bad, thing, stuff) lower lexical resource.' },
  'memorised-phrase': { label: 'Memorised phrases', criterion: 'LR', hint: 'Examiners recognise rehearsed templates and discount them.' },
  'vague-quantifier': { label: 'Vague quantifiers', criterion: 'LR', hint: "'A lot of' and 'lots of' are informal — use 'many', 'a great deal of'." },
  'collocation': { label: 'Wrong preposition', criterion: 'LR', hint: "Some pairs are fixed: 'key to', 'responsible for', 'depend on', 'reason for'." },
  'sentence-variety': { label: 'Sentence variety', criterion: 'GRA', hint: 'Mix simple, compound and complex sentences to show grammatical range.' },
  'long-sentence': { label: 'Overlong sentences', criterion: 'GRA', hint: 'Sentences over ~40 words usually lose control — split them.' },
  'short-sentence-run': { label: 'Choppy sentences', criterion: 'GRA', hint: 'Several very short sentences in a row read as limited range.' },
  'comma-splice': { label: 'Comma splice', criterion: 'GRA', hint: "Two complete sentences need a semicolon, full stop, or conjunction — not a comma ('…; however, …')." },
  'capitalisation': { label: 'Capitalisation', criterion: 'GRA', hint: 'Every sentence starts with a capital letter, and I is always capital.' },
  'fragment': { label: 'Sentence fragment', criterion: 'GRA', hint: "An 'if/because/although' clause alone is not a sentence — it needs a main clause after a comma." },
  'article': { label: 'Missing article', criterion: 'GRA', hint: "Every singular countable noun needs a determiner: 'a longer period', 'the new system'." },
  'agreement': { label: 'Agreement', criterion: 'GRA', hint: "Match number: 'a woman' not 'a women'; one thing → verb + s; 'they are human beings'." },
  'who-for-people': { label: "'who' for people", criterion: 'GRA', hint: "Use 'who' for people and 'that' for things: 'a citizen who stole'." },
  'connector-comma': { label: 'Connector commas', criterion: 'GRA', hint: "Fronted connectors take a comma: 'Therefore, …' — and no space before any comma." },
  'first-person-overuse': { label: 'First-person overuse', criterion: 'GRA', hint: "Use 'I' for your position only; argue impersonally elsewhere." },
  'missing-hedging': { label: 'Hedging', criterion: 'GRA', hint: 'Academic claims are qualified: may, tends to, is likely to.' },
  't1-word-count': { label: 'Word count', criterion: 'TR', hint: 'Task 1 requires at least 150 words; under-length answers are penalised.' },
  't1-overview-missing': { label: 'Overview missing', criterion: 'TR', hint: 'Task 1 needs one sentence naming the overall trend or the biggest difference — it is the largest single scoring lever.' },
  't1-invented-figure': { label: 'Figure not in the chart', criterion: 'TR', hint: 'Every number you quote must appear in the data you were given.' },
  't1-no-data-cited': { label: 'No figures cited', criterion: 'TR', hint: 'Support each main feature with a specific figure from the chart.' },
  't1-no-comparison': { label: 'No comparison made', criterion: 'TR', hint: 'When the chart shows two or more series, compare them directly.' },
  't1-explains-causes': { label: 'Explaining causes', criterion: 'TR', hint: 'Task 1 reports what the data shows — it never explains why, and never predicts.' },
  't1-opinion': { label: 'Opinion in Task 1', criterion: 'TR', hint: 'Task 1 has no opinion. Describe the data, do not evaluate it.' },
  't1-prompt-echo': { label: 'Copied chart title', criterion: 'TR', hint: 'Paraphrase the chart title in your own words — copied wording is excluded from your word count.' },
  't1-shape': { label: 'Answer shape', criterion: 'CC', hint: 'Task 1 shape: paraphrase, overview, one or two detail paragraphs. No conclusion is needed.' },
}

export const QUESTION_TYPE_META: Record<QuestionType, { label: string; mustAddress: string[] }> = {
  opinion: {
    label: 'Opinion (agree/disagree)',
    mustAddress: ['A clear position, held throughout', 'Reasons supporting your position', 'A conclusion restating your view'],
  },
  discussion: {
    label: 'Discussion (both views)',
    mustAddress: ['View A discussed', 'View B discussed', 'Your own opinion stated'],
  },
  'problem-solution': {
    label: 'Problem / solution',
    mustAddress: ['Problems identified', 'Solutions proposed', 'Link between each solution and its problem'],
  },
  'advantages-disadvantages': {
    label: 'Advantages / disadvantages',
    mustAddress: ['Advantages covered', 'Disadvantages covered', 'A weighed judgement (if asked)'],
  },
  'double-question': {
    label: 'Double question',
    mustAddress: ['First question answered', 'Second question answered'],
  },
}

export const EXAM_DURATION_SEC = 40 * 60
export const MIN_WORDS = 250
export const TARGET_WORDS = 280
