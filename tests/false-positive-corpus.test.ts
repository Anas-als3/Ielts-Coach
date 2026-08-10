/**
 * The golden corpus: sentences that are CORRECT English and must therefore
 * raise nothing above `info`.
 *
 * The rule set's own stated policy (`analysis/rules/accuracy.ts:11`, SPEC.md)
 * is that a false positive costs more than a miss — a coaching product that
 * hands a learner a wrong "fix" is worse than one that stays silent. This file
 * is where that policy is enforced. Five reproduced failures started it: the
 * engine told learners to write "can reduces", "a reduce crime" and
 * "every 10 year", called "However, it is clear that…" a comma splice, and told
 * a writer that "If a country invests in education it will prosper." has no
 * main clause.
 *
 * **Every future false-positive report belongs here FIRST**, as a failing
 * entry, before the rule that caused it is touched.
 *
 * ## Why each entry is a BARE sentence, not a padded essay
 *
 * The corpus asserts "zero non-`info` issues", so the harness must not
 * manufacture issues of its own. Padding an entry out to a realistic essay
 * length does exactly that: a letters-only pad is one enormous lowercase
 * sentence, which draws `capitalisation`, `long-sentence` and (under 250 words)
 * `word-count` — and padding past 250 words instead draws `paragraphing` and
 * `linking-underuse`. None of that says anything about the sentence under test.
 *
 * A bare sentence is under the 50-word floor that silences `word-count` and the
 * 150-word floor that silences the essay-level rules, while every rule this
 * file guards — the whole of `accuracy.ts` plus the comma-splice patterns — is
 * span-level and live from the first word. The `true positives still fire`
 * block below proves that: it runs genuine errors through the same one-sentence
 * harness and requires each to be caught, so a corpus that goes green because
 * the harness stopped reaching the rules would fail there instead.
 */
import { describe, expect, it } from 'vitest'
import { analyzeEssay, analyzeLetter, analyzeTask1 } from '../src/analysis/engine'
import { LETTER_ONLY_CATEGORIES, TASK1_ONLY_CATEGORIES } from '../src/meta'
import { LETTER_PROMPTS } from '../src/prompts/letterBank'
import { TASK1_PROMPTS } from '../src/prompts/task1Bank'
import type { Issue, IssueCategory } from '../src/types'

/** Everything the learner would actually see: `info` is advisory, not an accusation. */
function accusations(text: string): Issue[] {
  return analyzeEssay(text, null).issues.filter((i) => i.severity !== 'info')
}

/** Readable failure output: "category: message", never a raw object dump. */
function describeIssues(text: string): string[] {
  return accusations(text).map((i) => `${i.category}: ${i.message}`)
}

/* ------------------------------ the corpus ---------------------------------- */

const CORPUS: readonly string[] = [
  /* --- comma-splice pattern A: a fronted adverbial before a pronoun subject --- */
  // comma-splice: reproduced failure — the commonest opening in IELTS writing
  'However, it is clear that the government should invest far more in education.',
  // comma-splice: fronted 'Therefore' + pronoun subject
  'Therefore, it is essential to invest in renewable sources of energy.',
  // comma-splice: fronted 'Moreover' + pronoun subject
  'Moreover, they have argued for much stricter limits on industrial emissions.',
  // comma-splice: fronted 'In addition' + pronoun subject
  'In addition, it is likely that traffic congestion will continue to grow.',
  // comma-splice: fronted 'For example' + pronoun subject
  'For example, they are often required to work unusually long hours.',
  // comma-splice: fronted 'For instance' + pronoun subject
  'For instance, it was the smallest schools that closed first.',
  // comma-splice: fronted 'In my opinion' + demonstrative subject
  'In my opinion, this is the strongest argument in favour of the change.',
  // comma-splice: fronted 'On the other hand' + pronoun subject
  'On the other hand, it can be argued that tourism brings real benefits.',
  // comma-splice: fronted 'As a result' + pronoun subject
  'As a result, they have become far more cautious about borrowing money.',
  // comma-splice: fronted 'Nevertheless' + pronoun subject
  'Nevertheless, it is worth remembering that natural resources are limited.',
  // comma-splice: fronted 'Overall' + pronoun subject
  'Overall, it is the poorest households that suffer most from rising prices.',
  // comma-splice: fronted ordinal 'Firstly' + pronoun subject
  'Firstly, they are cheaper to build and much quicker to maintain.',
  // comma-splice: fronted 'Finally' + pronoun subject
  'Finally, we should remember that education is a long-term investment.',
  // comma-splice: fronted 'Furthermore' + existential 'there'
  'Furthermore, there is little evidence that longer sentences deter offenders.',
  // comma-splice: fronted 'Consequently' + pronoun subject
  'Consequently, he was unable to complete the course within three years.',
  // comma-splice: fronted 'Indeed' + pronoun subject
  'Indeed, she has published widely on the subject of urban planning.',
  // comma-splice: coordinator before the comma (pre-existing guard)
  'The reform was overdue but, it has to be said, poorly explained.',
  // comma-splice pattern B: a true parenthetical after a copula (pre-existing guard)
  'The proposal is, however, far more expensive than it first appeared.',
  // comma-splice pattern C: 'if … then' is a correlative pair (pre-existing guard)
  'If it rains, then we stay at home and read.',

  /* ------- article: mass-sense nouns as the bare object of a verb ------------- */
  // article: reproduced failure — the walk crossed 'reduce' and quoted it back
  'Governments must act to reduce crime in the largest cities of the world.',
  // article: bare 'crime' after a crossed verb
  'Strict laws help reduce crime without increasing the prison population.',
  // article: bare 'crime' straight after a stop-set verb
  'Young offenders who commit crime often come from unstable backgrounds.',
  // article: bare 'crime' after a crossed verb behind a modal
  'Better street lighting can prevent crime in poorly served neighbourhoods.',
  // article: bare 'crime' after a to-infinitive
  'The charity works to fight crime through education and mentoring.',
  // article: bare 'time' as the object of a verb
  'Flexible hours help employees save time on the daily commute.',
  // article: 'the world' already carries its determiner
  'Cheap flights have made it easy to travel the world.',
  // article: uncountables are never candidates
  'Society benefits from education more than from punishment.',
  // article: zero-article fixed phrase 'at home'
  'Many employees now work at home for part of the week.',
  // article: zero-article fixed phrase 'to school'
  'Children who walk to school arrive more alert and more ready to learn.',
  // article: zero-article fixed phrase 'on time'
  'She finished the report on time despite the unexpected delays.',
  // article: 'information' is uncountable and outside COUNTABLE
  'Schools must provide information about healthy eating to every family.',
  // article: compound modifier — 'time' heads nothing, 'management' does
  'Good time management helps every employee meet a deadline.',
  // article: compound modifier — 'job security'
  'Strong job security matters to most workers in this sector.',
  // article: compound modifier — 'city development'
  'Modern city development affects families who live nearby.',
  // article: compound modifier — 'school attendance'
  'Poor school attendance worries teachers across the country.',
  // article: quantifier 'less' licenses a bare noun just as a determiner does
  'Less contact time with tutors makes independent study much harder.',
  // article: quantifier 'such' before the determiner
  'Several countries have adopted such a system with great success.',
  // article: quantifier 'few' + plural, never a candidate
  'Few problems are solved by simply spending more public money.',
  // article: the walk finds 'the' two words to the left
  'The plan depends on funding from the central government.',

  /* ------ agreement A6: a modal or auxiliary governs the verb, not the -ing ---- */
  // agreement: reproduced failure — the engine suggested 'can reduces'
  'Working from home can reduce commuting costs for many employees today.',
  // agreement: modal 'can' before the verb
  'Studying abroad can improve a student’s confidence and independence.',
  // agreement: modal 'will' before the verb
  'Learning a second language will help young people find better work.',
  // agreement: modal 'may' before the verb
  'Teaching children to cook may reduce reliance on processed meals.',
  // agreement: modal 'should' before the verb
  'Reading widely should improve a candidate’s vocabulary over time.',
  // agreement: modal 'would' before the verb
  'Making public transport cheaper would help reduce urban congestion.',
  // agreement: negated auxiliary 'does not' before the verb
  'Working from home does not reduce the need for good management.',
  // agreement: the gerund subject really does take the -s form here
  'Working from home reduces commuting costs for many employees today.',
  // agreement: 'helps' takes a bare infinitive, so 'reduce' is not the agreeing verb
  'Travelling by train helps reduce carbon emissions considerably.',
  // agreement: 'help create' — bare infinitive after a bare-infinitive verb
  'Wearing a uniform can help create a sense of belonging at school.',

  /* ---- fragment: a subordinate opener whose main clause needs no comma ------- */
  // fragment: reproduced failure — the main clause is 'it will prosper'
  'If a country invests in education it will prosper.',
  // fragment: 'When' opener, main clause 'they achieve far more'
  'When students feel supported they achieve far more at school.',
  // fragment: 'Although' opener, main clause 'it delivered real benefits'
  'Although the scheme was expensive it delivered real benefits.',
  // fragment: 'Because' opener, main clause 'many commuters worked from home'
  'Because the roads were closed many commuters worked from home.',
  // fragment: 'While' opener, main clause 'others enjoy village life'
  'While some people prefer cities others enjoy village life.',
  // fragment: 'Unless' opener, main clause 'the situation will become much worse'
  'Unless governments act quickly the situation will become much worse.',
  // fragment: 'Since' opener, main clause 'waiting times have fallen sharply'
  'Since the reform began waiting times have fallen sharply.',
  // fragment: 'Whereas' opener, main clause 'younger workers value flexibility'
  'Whereas older workers value security younger workers value flexibility.',
  // fragment: the comma form of the same structure (pre-existing guard)
  'If people recycle more, less waste reaches landfill sites.',
  // fragment: 'Although' with the comma the rule was written to look for
  'Although the government invested heavily, the results were disappointing.',

  /* ------------- agreement B1: a numeral makes the plural correct ------------- */
  // agreement: reproduced failure — the engine suggested 'every 10 year'
  'Governments inspect factories every 10 years to ensure that standards are met.',
  // agreement: 'every 10 years' after a passive
  'The census is carried out every 10 years in most European countries.',
  // agreement: 'a further 20 years' — determiner, modifier, numeral, plural
  'A further 20 years passed before the bridge was finally rebuilt.',
  // agreement: sentence-initial 'Every 25 years'
  'Every 25 years the population of the city has roughly doubled.',
  // agreement: 'every 5 years' with a single-digit numeral
  'The survey is repeated every 5 years by an independent body.',
  // agreement: the spelled-out numeral was already allowed
  'The report is published every ten years without fail.',
  // agreement B3: the possessive lookahead keeps a singular complement legal
  'Teachers are a student’s most important resource in the early years.',

  /* ------------------------- other pre-existing guards ------------------------ */
  // who-for-people: 'told … that' is a reported clause, not a relative pronoun
  'The head teacher told the students that they had passed.',
  // connector-comma: the fronted connector carries its comma
  'In conclusion, the benefits of the scheme outweigh its costs.',
]

describe('golden corpus — correct English raises no accusation', () => {
  it('holds enough sentences to be worth trusting', () => {
    expect(CORPUS.length).toBeGreaterThanOrEqual(55)
  })

  it.each(CORPUS)('is clean: %s', (sentence) => {
    expect(describeIssues(sentence)).toEqual([])
  })
})

/* --------------------- the harness must have teeth -------------------------- */

/**
 * One genuine error per rule this plan touched, with the EXACT message the rule
 * emitted before the guards were added.
 *
 * Two jobs. It proves the guards are narrow — each still catches the error it
 * was calibrated on, and still words the correction the same way. And it proves
 * the corpus above is not green by accident: these run through the identical
 * one-sentence harness, so if that harness ever stopped reaching the rules,
 * this block would go red before the corpus went quietly green.
 */
const TRUE_POSITIVES: ReadonlyArray<{ rule: string; text: string; category: IssueCategory; message: string }> = [
  {
    rule: 'agreement A6 — -ing subject with a bare plural verb',
    text: 'Working from home reduce costs for many employees today.',
    category: 'agreement',
    message: "An -ing subject is one thing — the verb takes s: 'reduce' → 'reduces'.",
  },
  {
    rule: 'agreement B1 — singular determiner with a plural noun',
    text: 'A random women walked into the shop and asked for help.',
    category: 'agreement',
    message: "'a … women' does not agree — a/one/each need a singular noun: women → woman.",
  },
  {
    rule: 'fragment — a subordinate clause standing alone',
    text: 'Although the government invested heavily.',
    category: 'fragment',
    message:
      "This starts with 'Although' but a main clause never arrives — check: is this a complete sentence? Add the main clause after a comma ('Although …, …') or join it to the sentence beside it.",
  },
  {
    rule: 'comma-splice pattern A — comma joining two full sentences',
    text: 'The plan failed, it was too expensive.',
    category: 'comma-splice',
    message:
      "A comma may be joining two full sentences here — check: are these two complete sentences? If they are, use a full stop, a semicolon, or add a conjunction like 'and' or 'but'.",
  },
  {
    rule: 'article — a bare singular countable noun',
    text: 'He lost job last year and never recovered.',
    category: 'article',
    message: "'job' is a singular countable noun and needs a determiner — write 'a job' or 'the job'.",
  },
]

describe('true positives still fire, with an unchanged message', () => {
  it.each(TRUE_POSITIVES)('$rule', ({ text, category, message }) => {
    const hits = accusations(text).filter((i) => i.category === category)
    expect(hits.length, describeIssues(text).join(' | ')).toBeGreaterThan(0)
    expect(hits[0].message).toBe(message)
    expect(hits[0].severity).toBe('warning')
  })
})

/**
 * The three fragments the fragment guard must keep catching beyond its own
 * calibration case — a subordinate opener with a long tail, one with no finite
 * verb at all, and the negated-auxiliary shape, which is the closest a real
 * fragment gets to looking like a two-clause sentence.
 */
describe('fragment — the guard did not gut the rule', () => {
  it.each([
    'Although the government invested heavily in schools and hospitals.',
    'Because of the high cost of living in major cities.',
    'If the government does not act.',
    'Even though the results were disappointing.',
    'While others disagree with this view.',
    'For example, if someone murdered someone for any reason.',
  ])('still flags: %s', (text) => {
    expect(accusations(text).filter((i) => i.category === 'fragment').length).toBeGreaterThan(0)
  })
})

/* ------------- the corpus guards one pipeline of three — run the other two --- */

/**
 * The corpus above guards ONE of the three pipelines.
 *
 * `analyzeLetter` and `analyzeTask1` run the same accuracy, grammar-range,
 * lexical and cohesion modules — but not identically: Task 1 passes
 * `task: 'task1'` into `cohesionRules` and a synthesised prompt into
 * `lexicalRules`, and letters drive `lexicalRules` with a target tone. A shared
 * rule can therefore accuse correct English in one pipeline and stay quiet in
 * another, which is exactly the failure this corpus exists to prevent — and
 * letters are the pipeline that has produced false accusations twice.
 *
 * `tests/model-answers.test.ts` already runs every model answer through all
 * three pipelines. That proves polished prose written to pass does pass. This
 * proves the SIXTY SENTENCES THAT HAVE ACTUALLY BROKEN A RULE do not break one
 * here either — different evidence, deliberately.
 *
 * Each pipeline's own whole-answer categories are filtered out, because a bare
 * sentence legitimately has no greeting, no sign-off, no overview and no
 * bullets. Everything else must be silent. If a category outside the filter
 * fires, do NOT widen the filter — that is a false positive, and it belongs in
 * a fix, not in an allowlist.
 */
const PIPELINES = [
  {
    name: 'analyzeLetter (General Training Task 1)',
    analyse: (text: string) => analyzeLetter(text, LETTER_PROMPTS.find((p) => p.id === 'gt-01')!),
    structural: LETTER_ONLY_CATEGORIES,
  },
  {
    name: 'analyzeTask1 (Academic Task 1)',
    analyse: (text: string) => analyzeTask1(text, TASK1_PROMPTS.find((p) => p.id === 't1-01')!),
    structural: TASK1_ONLY_CATEGORIES,
  },
] as const

describe('golden corpus — the other two pipelines stay quiet too', () => {
  for (const { name, analyse, structural } of PIPELINES) {
    describe(name, () => {
      it.each(CORPUS)('is clean: %s', (sentence) => {
        const hits = analyse(sentence)
          .issues.filter((i) => i.severity !== 'info')
          .filter((i) => !structural.has(i.category))
        // Readable failure output, matching describeIssues above: "category: message".
        expect(hits.map((i) => `${i.category}: ${i.message}`)).toEqual([])
      })
    })
  }
})
