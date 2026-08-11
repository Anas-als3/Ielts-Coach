/**
 * Writing templates: fifteen paragraph-by-paragraph skeletons the learner can
 * follow WHILE writing — two per Task 2 question type, two chart-kind-agnostic
 * Academic Task 1 shapes, one per General Training letter tone. Originally
 * plan 033 (section descriptions with a couple of reworded openers per
 * paragraph); plan 034 rebuilt every section as complete sentence frames with
 * `[bracketed]` slots; plan 035 rebuilt every section again as ONE flowing
 * paragraph skeleton (`frame`) plus a filled worked version (`example`)
 * beneath it, with a per-template running topic (`exampleTopic`) that every
 * worked version in that template answers.
 *
 * ## Copyright and provenance
 *
 * **Nothing in this file is reproduced from any IELTS publisher or prep
 * site.** Every guidance sentence, every skeleton and every worked version is
 * original prose written for this project. The FORMAT — a paragraph skeleton
 * with a worked answer beneath it — is not copyrightable and every serious
 * IELTS course teaches by template; the wording here is this project's own.
 * Facts and figures in the worked versions are invented, and the panel labels
 * them as examples. Each question type's two templates use different
 * connective sets and different skeleton phrasings on purpose: two learners
 * drilling the same question type should not end up writing the same essay.
 *
 * ## What a template teaches, and what it does not
 *
 * Every Task 2 body paragraph's skeleton carries an example-type phrase in
 * its fixed prose, because the engine's `EXAMPLE_MARKERS` check
 * (`analysis/rules/structure.ts`) rewards exactly that, and the worked
 * version inherits the phrase verbatim. Every letter opens with a greeting,
 * states its purpose in the first sentence, gives one paragraph per bullet,
 * and closes with a sign-off that PAIRS with the greeting — the same pairing
 * `analysis/rules/letterAchievement.ts` marks. A skeleton is meant to be
 * filled in the learner's own words and reworded, never pasted: the
 * memorisation warning below covers both halves — the skeleton AND the
 * worked version beneath it — precisely because a completed answer is the
 * thing most tempting to copy outright. A template never gets pasted into the
 * essay sheet (see plan 033's "out of scope" — inserted scaffolding would be
 * analysed as the learner's own words and flagged, and the exam bans it
 * anyway); it is a reference pane the learner reads, not a text generator.
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
    exampleTopic: 'Some people think all children should learn a foreign language from primary school.',
    paragraphs: [
      {
        title: 'Introduction',
        guidance:
          'Paraphrase the statement, then state your position outright. This shape only works when you hold that position all the way through.',
        frame:
          "It is increasingly common to hear that [paraphrase the statement in your own words]. Although some would push back against the idea, I fully [agree / disagree], because [your position in one clause].",
        example:
          "It is increasingly common to hear that every child should begin a second language in their first years of school. Although some would push back against the idea, I fully agree, because early exposure produces fluency that later study rarely matches.",
      },
      {
        title: 'Strongest reason',
        guidance: 'Give your strongest reason for holding this position, then support it with a concrete example.',
        frame:
          "The strongest reason to [agree / disagree] is that [your first reason, stated as a full claim]. Put simply, when [restate the situation in plain terms], the result is [the consequence you are pointing to]. A case in point is [a country, a study, or a workplace], where [what happened there] — precisely because [tie the example back to your reason].",
        example:
          "The strongest reason to agree is that young children absorb languages far faster than teenagers. Put simply, when a child meets a second language before the age of ten, the result is near-native pronunciation and effortless recall. A case in point is Switzerland, where most pupils begin French or German at seven and routinely leave school fluent — precisely because the language arrived while their minds were still built for it.",
      },
      {
        title: 'Second reason',
        guidance: 'Add a second reason and its own example, or use this paragraph to rebut the opposite view.',
        frame:
          "Beyond that first point, there is a second argument: [your second reason, as a full claim]. This matters because [the consequence if it is ignored], and it reaches beyond [the immediate setting] into [the wider sphere it touches]. Consider the case of [a school, a company, or a policy], which [what it did or showed], and the point becomes hard to dismiss.",
        example:
          "Beyond that first point, there is a second argument: a language opens a culture, and children who receive one early grow up more curious about the world. This matters because tolerance is easier to plant than to repair, and it reaches beyond the classroom into how a whole generation treats its neighbours. Consider the case of bilingual schools in Canada, which report fewer playground divisions between language communities, and the point becomes hard to dismiss.",
      },
      {
        title: 'Conclusion',
        guidance: "Restate your position in fresh words — don't just repeat the introduction's sentence.",
        frame:
          "In conclusion, I firmly believe that [your position, in fresh words rather than the introduction's]. If anything, [a closing thought that extends the argument, not repeats it].",
        example:
          "In conclusion, I firmly believe that a second language belongs at the very start of schooling, not the end. If anything, the real question is why so many systems still wait until the habit-forming years are gone.",
      },
    ],
  },

  {
    id: 'tpl-op-balanced',
    label: 'Balanced (partly agree)',
    kind: 'task2',
    questionTypes: ['opinion'],
    exampleTopic: 'Some people think all children should learn a foreign language from primary school.',
    paragraphs: [
      {
        title: 'Introduction',
        guidance: 'Paraphrase the statement, then signal at once that the essay is balanced, not undecided.',
        frame:
          "That [paraphrase the statement in your own words] is a claim with real force, though it is not the whole story. I largely agree, yet with one reservation: [name the reservation in a short clause].",
        example:
          "That every schoolchild should meet a foreign language from the first year is a claim with real force, though it is not the whole story. I largely agree, yet with one reservation: an early start only pays off where schools can actually staff it.",
      },
      {
        title: 'The part you accept',
        guidance: 'Explain the part of the statement you accept, and support it with a concrete example.',
        frame:
          "Where the claim convinces me is [the part you accept, stated fully]. In practice, [how it plays out day to day], so that [the benefit that follows]. To take one example, [a country, a school, or a family] has [what it achieved] — and few would call that an accident.",
        example:
          "Where the claim convinces me is in what young ears can do that older ones cannot. In practice, a seven-year-old treats a new language as play rather than as homework, so that pronunciation and confidence arrive before self-consciousness does. To take one example, the Netherlands has built English into its primary classrooms through songs and games — and few would call that an accident.",
      },
      {
        title: 'Your reservation',
        guidance: 'Explain your reservation and give it its own example.',
        frame:
          "My reservation concerns [the limit you want to draw]. However enthusiastic the policy, [why the limit is real], and where that condition is missing, [what actually happens]. For instance, [a programme where the promise broke down] ended with [what learners were left with], largely because [the missing condition].",
        example:
          "My reservation concerns the classrooms that the argument quietly assumes. However enthusiastic the policy, a language lesson is only as good as the teacher giving it, and where that condition is missing, an early start delivers little more than mispronounced vocabulary lists. For instance, rural schools that adopted compulsory English without a single fluent speaker ended with pupils drilling the same greetings for years, largely because nobody could take them further.",
      },
      {
        title: 'Conclusion',
        guidance: 'Weigh the two paragraphs against each other and land clearly on your side.',
        frame:
          "On balance, then, the claim survives with an amendment: [restate your mostly-yes position together with its condition]. In my view, [the priority that follows from the amendment].",
        example:
          "On balance, then, the claim survives with an amendment: start languages early wherever a school can teach them well, and fix the staffing first everywhere else. In my view, sequencing the investment this way honours the idea rather than betraying it.",
      },
    ],
  },

  {
    id: 'tpl-di-both-then-view',
    label: 'Both views, then yours',
    kind: 'task2',
    questionTypes: ['discussion'],
    exampleTopic:
      'Some believe university education should be free for everyone; others think students should pay for it.',
    paragraphs: [
      {
        title: 'Introduction',
        guidance: 'Paraphrase both views named in the question, then promise that your own opinion is coming.',
        frame:
          "Few questions divide opinion as sharply as whether [the issue, paraphrased]. Some believe that [the first view in a full clause], while others insist that [the second view in a full clause]. Both cases deserve a fair hearing before I give my own verdict, which favours [the side you will take].",
        example:
          "Few questions divide opinion as sharply as whether a university degree should cost its student nothing. Some believe that free study is the mark of a fair society, while others insist that those who profit from a degree should carry its cost. Both cases deserve a fair hearing before I give my own verdict, which favours free education.",
      },
      {
        title: 'First view',
        guidance:
          'Present the first view fairly: explain why its holders believe it, grounded in a concrete example.',
        frame:
          "Those who favour [the first view, named briefly] rest their case on [its main ground]. From their standpoint, [unpack the argument in plain prose], which is why [the conclusion they draw]. A clear example of this is [a country or system that embodies the view], where [what it looks like in practice].",
        example:
          "Those who favour free university rest their case on fairness: talent is spread across every income bracket, but fees are not. From their standpoint, a bright student who declines a degree for fear of debt is a loss to the whole society, which is why education should be treated like schooling rather than shopping. A clear example of this is Germany, where public universities charge no tuition and lecture halls stay open to rich and poor alike.",
      },
      {
        title: 'Second view',
        guidance: 'Present the second view and its case, with an example of its own.',
        frame:
          "The opposing camp answers that [the second view's main ground]. On their reading, [unpack the argument], and it is graduates themselves who [what the second camp says graduates should do]. Take the case of [a country or policy that embodies this view], where [what it looks like and what it achieves].",
        example:
          "The opposing camp answers that a degree is a private investment which pays its owner back throughout a working life. On their reading, asking taxi drivers and shop assistants to fund future lawyers is fairness inverted, and it is graduates themselves who should repay the cost once their salaries allow. Take the case of England, where income-contingent loans collect nothing from graduates until their earnings pass a set threshold.",
      },
      {
        title: 'Conclusion',
        guidance: 'Give your verdict and the reason it wins.',
        frame:
          "On balance, having heard both sides, my verdict stays with [your side]. In my opinion, [the deciding reason, stated as the thing the other side cannot answer].",
        example:
          "On balance, having heard both sides, my verdict stays with free university education. In my opinion, a society that meets its future doctors, engineers and teachers at the lecture-hall door with an invoice is taxing the very people it most needs to encourage.",
      },
    ],
  },

  {
    id: 'tpl-di-view-throughout',
    label: 'Your view throughout',
    kind: 'task2',
    questionTypes: ['discussion'],
    note: 'Stronger position focus, harder to keep fair — the task still requires BOTH views discussed.',
    exampleTopic:
      'Some believe university education should be free for everyone; others think students should pay for it.',
    paragraphs: [
      {
        title: 'Introduction',
        guidance: 'Name both views, then declare your side at once.',
        frame:
          "Debates about [the issue, paraphrased] are usually framed as a choice between [view A, compressed] and [view B, compressed]. From the outset my view is that [your side, stated plainly], although the opposing case deserves a genuine answer rather than a caricature.",
        example:
          "Debates about who should pay for university are usually framed as a choice between free study for all and full fees for each student. From the outset my view is that graduates should shoulder a fair share of the cost, although the opposing case deserves a genuine answer rather than a caricature.",
      },
      {
        title: "Your side's case",
        guidance: "Make your side's case and support it with a concrete example.",
        frame:
          "The decisive consideration is [your main ground, as a full claim]. In other words, [restate the mechanism in plain terms], which means that [the consequence for policy or fairness]. This can be seen in [a system that works this way], where [what happens there] without [the harm opponents predict].",
        example:
          "The decisive consideration is that a degree delivers most of its rewards to the person holding it, in higher pay and wider choices. In other words, the graduate premium is private property, which means that asking the public to fund all of it transfers money from the less educated to the more fortunate. This can be seen in Australia, where graduates repay tuition gradually through the tax system without the collapse in enrolments opponents predict.",
      },
      {
        title: 'The other view, acknowledged',
        guidance: 'Acknowledge the other view with an example of its own, then answer it.',
        frame:
          "Admittedly, those who argue for [the other view] have a point about [their strongest ground], and it deserves to be taken seriously. For instance, [the scenario or evidence their point rests on] is real enough. Yet the answer is [the targeted fix], not [the other side's blanket remedy] — the objection identifies a problem without proving [what it would need to prove].",
        example:
          "Admittedly, those who argue for free university have a point about deterrence, and it deserves to be taken seriously. For instance, the fear that debt frightens poorer teenagers away from applying is real enough. Yet the answer is generous grants and repayment thresholds for low earners, not free degrees for future bankers — the objection identifies a problem without proving that universal subsidy is the only cure.",
      },
      {
        title: 'Conclusion',
        guidance: 'Restate your position.',
        frame:
          "In conclusion, both positions were worth weighing, but [your side] carries the day. It seems to me that [the one-clause reason that survives the other side's best objection].",
        example:
          "In conclusion, both positions were worth weighing, but shared payment carries the day. It seems to me that a system in which graduates repay what their degrees earn them, while grants protect the poorest, is fairer than one in which everyone pays for the few.",
      },
    ],
  },

  {
    id: 'tpl-ps-paired',
    label: 'Problem–solution pairs',
    kind: 'task2',
    questionTypes: ['problem-solution'],
    exampleTopic:
      'More and more large cities suffer from serious traffic congestion. What problems does this cause, and what measures could reduce them?',
    paragraphs: [
      {
        title: 'Introduction',
        guidance: 'Restate the situation, then promise that both problems and remedies are coming.',
        frame:
          "In many parts of the world, [the situation, paraphrased] has grown from an irritation into a threat to [what it now threatens]. Two problems stand out, and each of them has a workable remedy.",
        example:
          "In many parts of the world, city traffic has grown from an irritation into a threat to the health and productivity of everyone who lives there. Two problems stand out, and each of them has a workable remedy.",
      },
      {
        title: 'First problem and solution',
        guidance:
          'Give the first problem, then the solution that directly answers it, with a concrete example.',
        frame:
          "The most pressing difficulty is [problem one, stated as a full claim]. Day to day, this shows up as [the visible consequence], and over time as [the slower, deeper cost]. The direct answer is to [solution one] — for example, [a city or country that tried it] has [what it did], and [what followed].",
        example:
          "The most pressing difficulty is that road space is finite while car ownership is not, so demand simply outgrows the streets. Day to day, this shows up as hours idling in queues, and over time as asthma clinics filling along the busiest corridors. The direct answer is to make drivers pay for the space they occupy — for example, London has charged vehicles entering its centre since 2003, and traffic inside the zone fell within a year.",
      },
      {
        title: 'Second problem and solution',
        guidance: 'Give the second problem-and-solution pair the same way.',
        frame:
          "A second, related problem is [problem two, as a full claim]. Left alone, it feeds [the consequence], because [the mechanism that links them]. Here the remedy is [solution two], and cities such as [a city that invested this way] show the pattern: [what improved once they did].",
        example:
          "A second, related problem is that most alternatives to driving are too slow or too unpleasant to tempt anyone from a car. Left alone, it feeds the first problem, because every unreliable bus route recruits new drivers for the queues. Here the remedy is investment that makes the alternative genuinely faster, and cities such as Copenhagen show the pattern: once protected bike lanes and frequent trains outpaced rush-hour driving, commuters switched in their thousands.",
      },
      {
        title: 'Conclusion',
        guidance: 'Say which remedy matters most.',
        frame:
          "In conclusion, neither remedy is free, but together they [what the pair achieves]. If only one can come first, it should be [the remedy to prioritise], because [the reason it unlocks the other].",
        example:
          "In conclusion, neither remedy is free, but together they attack both the supply of road space and the demand for it. If only one can come first, it should be the charge, because it raises the very money the better buses and bike lanes require.",
      },
    ],
  },

  {
    id: 'tpl-ps-split',
    label: 'Problems first, then solutions',
    kind: 'task2',
    questionTypes: ['problem-solution'],
    note: 'Pick when problems share one root; the mapping-back sentence is what keeps cohesion.',
    exampleTopic:
      'More and more large cities suffer from serious traffic congestion. What problems does this cause, and what measures could reduce them?',
    paragraphs: [
      {
        title: 'Introduction',
        guidance: 'Restate the situation, then promise that both problems and remedies are coming.',
        frame:
          "It is hard to name a large city that has escaped [the situation, paraphrased]. The problems it causes are connected, and because they are connected, they are best solved together.",
        example:
          "It is hard to name a large city that has escaped the daily gridlock of too many cars on too little road. The problems it causes are connected, and because they are connected, they are best solved together.",
      },
      {
        title: 'The problems',
        guidance:
          'Lay out the problems, connected to each other, each illustrated with an example or figure.',
        frame:
          "The first casualty is [problem one, felt in daily life], felt most sharply by [who bears it]. Behind it sits [problem two], which [how it compounds the first]. One illustration of this is [a scene that shows both problems at once]: [what it shows].",
        example:
          "The first casualty is time, since commutes that should take twenty minutes routinely swallow an hour, felt most sharply by workers who cannot choose their hours. Behind it sits pollution, which turns the wasted hour into a health bill as engines idle outside schools and hospitals. One illustration of this is the morning school run in any major city: thousands of cars, each carrying one child, creeping past the very playgrounds their exhaust settles on.",
      },
      {
        title: 'The solutions',
        guidance: 'Map each solution back to a named problem, with one worked instance.',
        frame:
          "Because both problems trace back to [the shared root], the solutions must attack that root rather than its symptoms. The first step is to [solution one], which relieves [problem one] directly; the second is to [solution two], which answers [problem two] by [its mechanism]. Cities that tried them together, such as [a city], found that [the combined result].",
        example:
          "Because both problems trace back to streets designed around the private car, the solutions must attack that root rather than its symptoms. The first step is to move rush-hour journeys onto high-frequency public transport, which relieves lost time directly; the second is to electrify what traffic remains, which answers pollution by removing the exhaust rather than the driver. Cities that tried them together, such as Oslo, found that emptier, quieter streets made the next reform easier to sell.",
      },
      {
        title: 'Conclusion',
        guidance: 'Close the essay.',
        frame:
          "To sum up, problems that are solved separately tend to return, because [why piecemeal fixes fail here]. Addressed at [the root, named again], they need not come back at all.",
        example:
          "To sum up, problems that are solved separately tend to return, because a city that only builds trains while its streets still favour cars invites the traffic straight back. Addressed at their common root, the design of the street itself, they need not come back at all.",
      },
    ],
  },

  {
    id: 'tpl-ad-outweigh',
    label: 'One side outweighs',
    kind: 'task2',
    questionTypes: ['advantages-disadvantages'],
    exampleTopic:
      'In many companies, employees can now work from home for most of the week. Do the advantages of this development outweigh its disadvantages?',
    paragraphs: [
      {
        title: 'Introduction',
        guidance: 'Name the development, then state which side wins.',
        frame:
          "Over the past few years, [the development, paraphrased] has moved from the margins to the mainstream, bringing costs as well as benefits. The balance, however, is not close: in my view the [advantages / disadvantages] clearly outweigh the [disadvantages / advantages].",
        example:
          "Over the past few years, working from home has moved from the margins to the mainstream, bringing costs as well as benefits. The balance, however, is not close: in my view the advantages clearly outweigh the disadvantages.",
      },
      {
        title: 'The winning side',
        guidance: 'Give the winning side two benefits or costs, plus a concrete example.',
        frame:
          "The first major benefit is [the strongest advantage, as a full claim]. For instance, [a person or group it changes]: [what it looks like in practice]. Just as weighty is [the second advantage], because [why it matters at scale].",
        example:
          "The first major benefit is time, the one resource no salary can buy back. For instance, an office worker who stops commuting ninety minutes a day recovers almost a full working day every week: hours that reappear as sleep, exercise and family dinners. Just as weighty is access, because jobs that once demanded a move to an expensive capital can now be done from a small town or from a wheelchair-friendly home.",
      },
      {
        title: 'The other side, conceded',
        guidance: 'Concede the other side with a concrete example, then show why it is smaller.',
        frame:
          "Against this stands [the other side's strongest point], and it would be dishonest to pretend otherwise. A clear example of this is [where the cost shows up], where [what happens]. Real, then — but limited: [why the cost weighs less, or who can fix it and how].",
        example:
          "Against this stands isolation, and it would be dishonest to pretend otherwise. A clear example of this is the first year of a career, where a new hire learns mostly by overhearing better people, and a bedroom desk offers nothing to overhear. Real, then — but limited: hybrid weeks and deliberate mentoring recover most of what the corridor once taught, while the recovered commuting hours have no substitute at all.",
      },
      {
        title: 'Conclusion',
        guidance: 'Restate the verdict.',
        frame:
          "On balance, the gains dominate: [restate the winning side's core, in fresh words]. The task for [who must act] is therefore to [manage the residue], not to [the overreaction to avoid].",
        example:
          "On balance, the gains dominate: work that fits around life serves more people, more fairly, than life bent around an office. The task for employers is therefore to design deliberately for connection, not to march everyone back to the desks the argument has already left.",
      },
    ],
  },

  {
    id: 'tpl-ad-survey',
    label: 'Even-handed survey',
    kind: 'task2',
    questionTypes: ['advantages-disadvantages'],
    exampleTopic:
      'In many companies, employees can now work from home for most of the week. Discuss the advantages and disadvantages of this development.',
    paragraphs: [
      {
        title: 'Introduction',
        guidance: 'Name the development, then promise that both sides are coming.',
        frame:
          "Few recent changes have spread as quickly as [the development, paraphrased], and few reward a more careful audit. Its ledger carries genuine entries on both sides, and each column deserves to be read before anyone totals it.",
        example:
          "Few recent changes have spread as quickly as the shift to working from home, and few reward a more careful audit. Its ledger carries genuine entries on both sides, and each column deserves to be read before anyone totals it.",
      },
      {
        title: 'Advantages',
        guidance: 'Cover the advantages, with a concrete example.',
        frame:
          "On the positive side, the clearest gain is [advantage one, stated fully]. A further entry is [advantage two], which [how it compounds the first]. Organisations such as [a company or sector that shows both] have found that [what the gains look like in practice].",
        example:
          "On the positive side, the clearest gain is autonomy: people schedule their sharpest hours for their hardest work instead of donating them to a commute. A further entry is reach, which widens hiring from one city to a whole country and lets parents and carers stay in careers they once had to leave. Organisations such as fully remote software firms have found that autonomy and reach together cut both turnover and office rent.",
      },
      {
        title: 'Disadvantages',
        guidance: 'Cover the disadvantages, with a concrete example.',
        frame:
          "The opposite column is just as real. Its heaviest entry is [disadvantage one, stated fully] — for example, [where or for whom it bites hardest]. Below it sits [disadvantage two], which [the quieter, longer-term damage it does].",
        example:
          "The opposite column is just as real. Its heaviest entry is the slow starvation of the informal contact that turns colleagues into teams — for example, the throwaway question after a meeting that solves a problem nobody had scheduled. Below it sits invisibility, which quietly steers promotions towards the people a manager still happens to see.",
      },
      {
        title: 'Conclusion',
        guidance: 'Say, on balance, which side wins and why — the task asks you to land somewhere.',
        frame:
          "On balance, I judge the [side you land on] the weightier column, chiefly because [the deciding reason]. In my opinion, the sensible course is [what follows: keep which gains, repair which costs].",
        example:
          "On balance, I judge the advantages the weightier column, chiefly because time and access improve whole lives while the costs mostly injure routines that firms can redesign. In my opinion, the sensible course is a hybrid week that keeps the freedom and schedules the serendipity.",
      },
    ],
  },

  {
    id: 'tpl-dq-two-para',
    label: 'One question per paragraph',
    kind: 'task2',
    questionTypes: ['double-question'],
    note: "The safest double-question shape — the rail's question-coverage check wants BOTH answered visibly.",
    exampleTopic:
      'In many countries, more people are choosing to live alone than ever before. Why might this be? Is it a positive or negative development?',
    paragraphs: [
      {
        title: 'Introduction',
        guidance: 'Paraphrase the topic, then promise that both questions will be answered.',
        frame:
          "Across much of the world, [the trend, paraphrased], and the shift raises two questions at once: [question one, compressed] and [question two, compressed]. I will take each in turn.",
        example:
          "Across much of the world, more adults than ever are setting up homes entirely on their own, and the shift raises two questions at once: what is driving it, and whether it should be welcomed. I will take each in turn.",
      },
      {
        title: 'First question',
        guidance: 'Answer the first question fully, with a concrete example.',
        frame:
          "On the first question, the main driver is [your primary cause, as a full claim]. Behind it stands [a second cause], since [how it enables or amplifies the first]. This can be seen in [where the causes are most visible], where [what the pattern looks like].",
        example:
          "On the first question, the main driver is prosperity: living alone is expensive, and for the first time in history millions can afford the privacy their grandparents could not. Behind it stands changing family life, since later marriage and easier divorce leave long stretches of adulthood with no household to share. This can be seen in wealthy capitals, where studio apartments multiply fastest among well-paid professionals in their thirties.",
      },
      {
        title: 'Second question',
        guidance: 'Answer the second question, with its own example.',
        frame:
          "As to whether this is [the second question's framing], my answer is [your answer, stated plainly]. The decisive point is [the ground for it], because [the consequence that follows]. For instance, [a concrete situation that shows your answer in action]: [what it shows].",
        example:
          "As to whether this is a positive or a negative development, my answer is that it is broadly positive with one sharp edge. The decisive point is choice, because a household of one is now something people select rather than something widowhood imposes. For instance, a divorced teacher who keeps her own flat between chapters of life is exercising a freedom her mother never had: the same solitude that once signalled misfortune now often signals control.",
      },
      {
        title: 'Conclusion',
        guidance: 'Give both answers again, one sentence each.',
        frame:
          "In conclusion, the answers belong together: [answer one, in one clause], and [answer two, in one clause]. What matters now is [the forward-looking closing thought].",
        example:
          "In conclusion, the answers belong together: people live alone because they finally can, and a freedom people choose is hard to call a decline. What matters now is building cities where a household of one is never a synonym for loneliness.",
      },
    ],
  },

  {
    id: 'tpl-dq-woven',
    label: 'Woven answers',
    kind: 'task2',
    questionTypes: ['double-question'],
    note: 'Only when the two questions genuinely share one answer; otherwise use the two-paragraph shape.',
    exampleTopic:
      'In many countries, more people are choosing to live alone than ever before. Why might this be? Is it a positive or negative development?',
    paragraphs: [
      {
        title: 'Introduction',
        guidance: 'Name both questions, then give one thesis that links them.',
        frame:
          "The two questions posed here — [question one, compressed] and [question two, compressed] — turn out to share a single answer: [the linking thesis, stated in one clause].",
        example:
          "The two questions posed here — why so many people now live alone, and whether the trend is to be welcomed — turn out to share a single answer: solo living is what rising independence looks like when it comes home.",
      },
      {
        title: 'First strand',
        guidance: 'Develop the first strand of the thesis, touching both questions, with an example.',
        frame:
          "The first strand of that answer is [first aspect of the thesis]. It speaks to both questions at once: [how it explains the cause], and equally [how it colours the verdict]. Take the case of [an example that shows both faces], where [what it shows].",
        example:
          "The first strand of that answer is economic: independence must be affordable before it can be chosen. It speaks to both questions at once: incomes rose until private space came within ordinary reach, and equally a trend rooted in affluence reads more like a graduation than a decline. Take the case of Scandinavia, where the highest rates of solo living sit beside some of the highest levels of reported life satisfaction.",
      },
      {
        title: 'Second strand',
        guidance: 'Develop the second strand, with its own example.',
        frame:
          "The second strand is [second aspect of the thesis], which completes the picture. Where the first strand explains [what it explained], this one shows [what the second adds], because [the mechanism]. A case in point is [a second example], where [what it shows].",
        example:
          "The second strand is cultural: independence has become respectable, which completes the picture. Where the first strand explains who can live alone, this one shows why they want to, because a single household no longer invites pity or suspicion. A case in point is the ordinary dinner party, where 'I live by myself' now lands as information rather than as confession.",
      },
      {
        title: 'Conclusion',
        guidance: 'Close the essay.',
        frame:
          "In conclusion, one thesis has answered two questions: [restate the link in fresh words]. Read that way, [the closing judgement the thesis licenses].",
        example:
          "In conclusion, one thesis has answered two questions: people live alone because independence has become both affordable and admired. Read that way, the rise of the single household is less a social problem than a signature of societies rich and free enough to permit it.",
      },
    ],
  },

  /* ============================= academic task 1 ============================= */

  {
    id: 'tpl-t1-trends',
    label: 'Overview first, grouped by trend',
    kind: 'chart',
    note: "The default shape; the overview paragraph is what the rail's overview check looks for.",
    exampleTopic:
      'The line graph shows average coffee consumption per person, in kilograms per year, in Finland, Italy and Japan between 2000 and 2020. (An invented chart — the figures in these examples are its own.)',
    paragraphs: [
      {
        title: 'Paraphrase',
        guidance: 'Rewrite the title sentence in your own words: what the chart shows, where, and when.',
        frame:
          "The [chart or graph] shows [what is measured, in your own words], in [the units], in [the places named], between [the period].",
        example:
          "The line graph shows how much coffee people drank per person each year, in kilograms, in Finland, Italy and Japan, between 2000 and 2020.",
      },
      {
        title: 'Overview',
        guidance:
          'Give the two biggest movements or contrasts — no numbers here. This is the single largest mark in Task 1.',
        frame:
          "Overall, the most striking feature is [the biggest movement or contrast — no figures here], while [the second feature, also figure-free].",
        example:
          "Overall, the most striking feature is Japan's dramatic climb from near the bottom of the range, while Finland remains the heaviest consumer throughout and Italy barely moves.",
      },
      {
        title: 'First group (the risers)',
        guidance: 'Cover the first group — for example the risers — with selected figures.',
        frame:
          "Looking first at the risers, [the fastest riser] [describe its movement] from [starting figure] to [closing figure]. [The second riser] followed a gentler path, [its movement, with figures], leaving it [where that leaves it relative to the rest].",
        example:
          "Looking first at the risers, Japan trebled its intake, climbing steadily from 1.5 kilograms per person in 2000 to 4.5 kilograms in 2020, the steepest climb on the chart. Finland followed a gentler path, edging up from 10 kilograms to 12 kilograms across the same two decades, leaving it comfortably clear of the other two throughout.",
      },
      {
        title: 'Second group (the fallers)',
        guidance: 'Cover the second group — the fallers or the outliers — with figures.',
        frame:
          "[The flat or falling series], by contrast, [describe how little it moves, or how it falls] from [figure] to [figure]. The gap between [the leader] and [the laggard] therefore [narrowed or widened] from roughly [figure] to [figure].",
        example:
          "Italy, by contrast, barely moved at all, drifting from 5.8 kilograms to 6.1 kilograms in twenty years. The gap between Finland and Japan therefore narrowed from roughly 8.5 kilograms to 7.5 kilograms, even though the order of the three countries never changed, with Finland first, Italy second and Japan third at every point measured.",
      },
    ],
  },

  {
    id: 'tpl-t1-compare',
    label: 'Comparison-led',
    kind: 'chart',
    note: "Pick for static comparisons (tables, pies, grouped bars) where 'trend' language has nothing to move.",
    exampleTopic:
      'The table shows the share of household energy drawn from four sources — gas, electricity, renewables and solid fuels — in France, Poland, Spain and Sweden. (An invented table — the figures in these examples are its own.)',
    paragraphs: [
      {
        title: 'Paraphrase',
        guidance: "Paraphrase the chart's title sentence.",
        frame:
          "The [chart or table] compares [what is measured, in your own words], broken down by [the categories], across [the places named].",
        example:
          "The table compares the share of household energy that homes draw from each major source, broken down by gas, electricity, renewables and solid fuels, across France, Poland, Spain and Sweden, expressed as a proportion of each country's total consumption.",
      },
      {
        title: 'Overview',
        guidance:
          'Give the overview of the comparison: which category dominates, and where the categories converge.',
        frame:
          "Overall, [the dominant pattern — no figures], while [the exception or second pattern, also figure-free].",
        example:
          "Overall, a single source supplies at least half of all household energy in three of the four countries, while Spain alone divides its consumption almost evenly between its two leading fuels.",
      },
      {
        title: 'The dominant category',
        guidance: 'Set the dominant category against the rest, with figures.',
        frame:
          "In [the countries where one source towers over the rest], the leading source is unmistakable: [source] supplies [figure] of household energy in [country], [source] [figure] in [country], and [source] [figure] in [country].",
        example:
          "In three of the four countries, the leading source is unmistakable: electricity supplies 65 per cent of household energy in France, renewables 60 per cent in Sweden, and solid fuels 55 per cent in Poland.",
      },
      {
        title: 'Exceptions and crossovers',
        guidance: 'Cover the exceptions and crossovers.',
        frame:
          "The exception is [the country that breaks the pattern], where no single source dominates: [source] at [figure] sits almost level with [source] at [figure], a spread of only [the small gap] compared with [the gap everywhere else].",
        example:
          "The exception is Spain, where no single source dominates: gas at 45 per cent sits almost level with electricity at 40 per cent, a spread of only five points compared with a gap of 25 points or more everywhere else, making the Spanish market the only genuinely mixed one in the table.",
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
    exampleTopic:
      "A washing machine you bought recently has broken down twice. Write a letter to the shop's manager: say what you bought and when, describe what has gone wrong, and say what you want the shop to do.",
    paragraphs: [
      {
        title: 'Greeting and purpose',
        guidance:
          'Open with the greeting that matches what you know about the reader, then state your purpose in the first sentence.',
        frame:
          "Dear [Sir or Madam — or Mr or Ms and their surname if you know it],\nI am writing to [complain about, request, or inform you of] [the matter, in one clause], and to ask that [the outcome you want, in brief].",
        example:
          "Dear Sir or Madam,\nI am writing to complain about a washing machine bought from your Mill Road branch, and to ask that the matter now be settled with a full refund.",
      },
      {
        title: 'Bullet 1',
        guidance: 'Develop the first bullet point fully, with a concrete detail. No contractions.',
        frame:
          "To explain the background: [what you bought, where and when, with the price]. Specifically, [the exact references — a model, a date, an order number].",
        example:
          "To explain the background: on 14 June I bought a KleenWash 700 washing machine from your Mill Road branch, paying 429 pounds. Specifically, the order number is KW-88231, and the machine was delivered and installed on 21 June.",
      },
      {
        title: 'Bullet 2',
        guidance: 'Develop the second bullet point fully, with a concrete detail. No contractions.',
        frame:
          "What concerns me most is [what has gone wrong, stated plainly]. I have already [what you have done about it], yet [why the problem still stands]. As a result, [the consequence you are living with].",
        example:
          "What concerns me most is that the machine has now failed three times in eight weeks, most recently flooding the kitchen floor. I have already returned it to the branch twice for repair, yet the same fault reappeared within days on both occasions. As a result, my family has spent much of the summer carrying laundry to a launderette.",
      },
      {
        title: 'Bullet 3',
        guidance:
          'Develop the third bullet point, then request the action you want. Close with the sign-off that pairs with your greeting.',
        frame:
          "I would therefore ask that [the action you want, stated precisely]. I would appreciate a written reply within [a timeframe], and I can be contacted at [how you can be reached].\n[the sign-off that pairs with your greeting — Yours faithfully after Sir or Madam, Yours sincerely after a name],\n[your full name]",
        example:
          "I would therefore ask that the machine be collected and the full purchase price refunded. I would appreciate a written reply within fourteen days, and I can be contacted at the address above or on 07700 900123.\nYours faithfully,\nAmira Hassan",
      },
    ],
  },

  {
    id: 'tpl-lt-semiformal',
    label: 'Known name, serious matter',
    kind: 'letter',
    tones: ['semi-formal'],
    exampleTopic:
      'The heating in your rented flat is not working properly. Write a letter to your landlord, Mr Harris: remind him how you reported the problem before, describe the situation now, and ask for it to be fixed before winter.',
    paragraphs: [
      {
        title: 'Greeting and purpose',
        guidance: "Open with the reader's name, then a friendly line before you state the purpose.",
        frame:
          "Dear [Mr or Ms and their surname],\nI hope you are well. I am writing about [the matter], which I think needs attention before [what makes it urgent].",
        example:
          "Dear Mr Harris,\nI hope you are well. I am writing about the heating in the flat, which I think needs attention before the cold weather truly arrives.",
      },
      {
        title: 'Bullet 1',
        guidance: 'Develop the first bullet point, polite but warm, with a specific detail.',
        frame:
          "You may remember that [the shared history — what was said or done before]. Since then, [what has changed or continued].",
        example:
          "You may remember that I mentioned the boiler when you visited in September, and that it was serviced soon afterwards. Since then, the radiators in both bedrooms have stopped warming up at all.",
      },
      {
        title: 'Bullet 2',
        guidance: 'Develop the second bullet point the same way.',
        frame:
          "The difficulty now is [the problem as it stands today], which means [the consequence for daily life]. I am also a little concerned that [the risk if it waits], which [why that risk touches the property itself].",
        example:
          "The difficulty now is that the boiler cuts out every few hours and the flat rarely rises above fifteen degrees in the evening, which means we are relying on costly electric heaters. I am also a little concerned that a hard frost could burst the older pipes, which would damage the property far more than an early repair would cost.",
      },
      {
        title: 'Bullet 3',
        guidance:
          'Develop the third bullet point, then close with appreciation and the sign-off that pairs with your greeting.',
        frame:
          "Would it be possible to [the action you are asking for] before [the date or season that matters]? It would make a real difference to [what it would help], and I would of course [what you offer to make it easy].\nYours sincerely,\n[your first name and surname]",
        example:
          "Would it be possible to send a heating engineer before the end of November? It would make a real difference to how liveable the flat is this winter, and I would of course stay in for whichever morning suits the engineer best.\nYours sincerely,\nDaniel Okafor",
      },
    ],
  },

  {
    id: 'tpl-lt-informal',
    label: 'A friend',
    kind: 'letter',
    tones: ['informal'],
    note: 'Informal is a register, not an excuse — the bullets still all get covered.',
    exampleTopic:
      'You have moved to a new flat. Write a letter to your friend Sam: tell them your news, explain why next month is a good time to visit, and suggest a plan for the visit.',
    paragraphs: [
      {
        title: 'Greeting and purpose',
        guidance: "Open with a warm greeting, then say why you're writing — casually. Contractions welcome.",
        frame:
          "Dear [their first name],\nIt's been far too long since we caught up! I am writing because [your purpose, said the way you would say it aloud].",
        example:
          "Dear Sam,\nIt's been far too long since we caught up! I am writing because I have finally got a place with a spare room, and I want you in it next month.",
      },
      {
        title: 'Bullet 1',
        guidance: "Cover the first bullet point as you'd say it aloud, with a real detail.",
        frame:
          "You won't believe [your news, told exactly as you would tell it face to face] — [the detail that makes it real]. Honestly, [your reaction, in one casual clause].",
        example:
          "You won't believe it — I've finally escaped that shoebox by the station, and the new flat has an actual spare room with a bed in it. Honestly, I keep opening the door just to admire it.",
      },
      {
        title: 'Bullet 2',
        guidance: 'Cover the second bullet point the same way.',
        frame:
          "The thing is, [why the timing is right] — [the detail that clinches it]. So it'd be perfect if [what you are hoping they will do].",
        example:
          "The thing is, next month couldn't be better — I'm off work for the middle two weeks, and the street-food festival we keep talking about runs right through them. So it'd be perfect if you came up while it's all on.",
      },
      {
        title: 'Bullet 3',
        guidance: 'Cover the third bullet point, then close warmly with the sign-off that fits.',
        frame:
          "So here's the plan: [when to come, how to get here, and what the two of you will do]. What do you think — can you make it?\nTake care,\n[your name]",
        example:
          "So here's the plan: hop on the Friday train on the 12th, I'll meet you at the station, and we'll spend the whole weekend eating our way through that festival. What do you think — can you make it?\nTake care,\nMaya",
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
