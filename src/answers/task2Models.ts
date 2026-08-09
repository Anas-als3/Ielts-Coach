/**
 * Worked Task 2 answers, one per question type.
 *
 * Task 1 answers are generated from the chart's own numbers. Task 2 cannot be:
 * an argument is not derivable from a prompt, and anything a template produced
 * would be exactly the vacant, rehearsed prose SPEC.md penalises under
 * `memorised-phrase`. So these are written by hand.
 *
 * Five, not forty. A worked answer to a DIFFERENT question of the same type is
 * still worth reading — the shape, the ordering and the moves transfer even
 * though the content does not — and the UI says plainly when that is what the
 * learner is looking at. Forty hand-written essays would be forty chances for
 * one of them to be quietly wrong.
 *
 * Every answer here is graded by the app's own engine in
 * `tests/model-answers.test.ts`: each must satisfy every structure check and
 * score in the target band. If a rule changes and an example stops passing,
 * that test fails rather than the learner being shown something the app would
 * mark down.
 */
import type { PromptSpec, QuestionType } from '../types'

/** Model answers keyed by the prompt they answer. */
export const TASK2_MODELS: Readonly<Record<string, string>> = {
  /* ------------------------------- opinion -------------------------------- */
  'op-01': `Many people argue that higher education ought to be funded entirely by the state, whatever a student's means. Although free tuition would undoubtedly widen access, I largely disagree with the proposal, since the cost falls on taxpayers who never attend a university themselves. A targeted system of grants serves poorer students better than blanket funding.

The strongest argument against universal free tuition is that it transfers money from the general population to a comparatively advantaged group. Graduates earn substantially more across a working life than those who never enrol, which means a blanket subsidy asks lower earners to fund the training of people who will out-earn them. For example, a plumber paying income tax would contribute to the education of a corporate lawyer whose salary overtakes their own within a decade. Public spending achieves more when it is directed at the point where need is greatest.

A second concern is that removing fees entirely tends to strain capacity rather than raise quality. When places cost nothing, demand rises faster than institutions can recruit staff or expand their buildings, and the result is crowded lecture halls with far less individual attention. For instance, several countries that abolished tuition have since introduced strict entry caps, which restrict exactly the access the policy was intended to widen. Support tied to household income avoids that pressure while still protecting the students who genuinely cannot pay.

In conclusion, although the principle of free university education is attractive, I believe means-tested support achieves the same aim at a fraction of the cost. Directing help towards those who need it matters far more than removing fees for everybody.`,

  /* ------------------------------ discussion ------------------------------ */
  'di-01': `Opinion is divided over when a child should first enter a classroom, with some favouring an early start and others preferring to wait until around the age of seven. Both positions rest on genuine evidence about how young children develop. In my opinion, a later start produces better long-term results, provided that structured play is available beforehand.

Those who favour early schooling point to the speed at which young children absorb language and number. A child of four learns pronunciation and vocabulary far more readily than a teenager, which suggests that formal instruction should begin while that window remains open. For instance, countries that introduce a second language during the earliest years routinely produce more confident speakers than those which delay it. Supporters also note that reliable attendance frees parents to return to work, so the benefit extends beyond the child.

Those on the other side argue that formal lessons at four or five suit the institution rather than the child. Young children learn through movement, imitation and unstructured play, and seating them at desks too early can produce anxiety rather than progress. For example, Finland begins formal teaching at seven and still records consistently strong literacy outcomes, which suggests that very little is lost by waiting. Its pupils arrive ready to concentrate, so the later years advance rapidly.

In conclusion, while an early start offers real advantages in language acquisition, I believe the evidence favours delaying formal lessons until a child is developmentally ready. What matters is not the age at which teaching begins but the quality of everything that precedes it.`,

  /* --------------------------- problem-solution --------------------------- */
  'ps-01': `The volume of rubbish leaving the average home, particularly packaging made of plastic, increases steadily year after year. This trend creates serious difficulties for the natural environment and for public budgets alike. In my view, the problem can only be reduced through a combination of regulation and genuine changes to how households behave.

The most immediate problem is environmental. Plastic that escapes collection does not break down, so it accumulates in rivers and oceans where it harms marine life and eventually enters the food chain. Landfill sites, which are expensive to build and unpopular with nearby residents, fill far more quickly than councils can replace them. For instance, several coastal cities now spend more on clearing waste from their beaches than on maintaining them, a cost that ultimately falls on residents through local taxation.

Two measures would make a substantial difference. Governments should require manufacturers to take financial responsibility for the packaging they produce, which gives them a direct reason to use less of it and to design whatever remains for recycling. Alongside this, deposit-return schemes offer households a small payment for each container brought back. For example, countries such as Norway and Germany recover the great majority of their bottles through exactly this mechanism, and their recycling rates are among the highest recorded anywhere. Such a scheme changes behaviour without lecturing anyone, since returning a container becomes worth the small effort involved.

In conclusion, growing household waste damages the environment and drains public money, although neither consequence is inevitable. Making producers responsible for their packaging and rewarding households for returning it would cut the volume substantially within a few years.`,

  /* ----------------------- advantages-disadvantages ----------------------- */
  'ad-01': `An increasing number of undergraduates now spend a semester, a year or an entire degree at a foreign institution. This shift brings clear gains in independence and employability, though it also carries real costs. On balance, I believe the advantages of studying abroad clearly outweigh the drawbacks for most young people.

The principal benefit is the range of skills that living independently in an unfamiliar country develops. A student who must arrange accommodation, manage money and study in a second language acquires a self-reliance that a degree taken at home rarely demands. Employers recognise this, which is why graduates with international experience are often shortlisted ahead of equally qualified peers. For example, multinational firms routinely favour applicants who have already demonstrated that they can work across cultures without close supervision.

The disadvantages are nonetheless genuine. Studying overseas is markedly more expensive once travel, visas and higher tuition are counted, which puts it beyond the reach of anyone without family support. Isolation is a further risk, since a young person living far from home may struggle academically for months before anybody notices. For instance, universities that run exchange programmes report that withdrawal rates are highest among students who arrive without an established network. These costs fall unevenly, and they fall hardest on precisely the people who would gain most from the opportunity.

In conclusion, although the expense and the isolation are serious objections, the independence and employability that studying abroad develops are worth more across a career. The sensible response is to widen access through scholarships rather than to discourage the trend.`,

  /* --------------------------- double-question ---------------------------- */
  'dq-01': `Fewer school leavers in many countries now consider teaching as a career, and the shortfall of new entrants widens every year. The causes lie mainly in pay and workload, while the remedies must address both if recruitment is to recover. This essay examines why the decline is happening and what could realistically reverse it.

The first cause is straightforward financial comparison. A graduate weighing teaching against law, engineering or technology sees a salary that starts lower and rises more slowly, which makes the profession difficult to justify to a graduate still repaying the cost of their own degree. Workload compounds the problem, since planning, marking and administration extend the working day well beyond the hours pupils are present. For example, surveys of newly qualified teachers repeatedly find that unpaid evening work, rather than the classroom itself, drives them out within five years.

Two measures would encourage more people to join the profession. Targeted bursaries for shortage subjects such as physics and mathematics reduce the financial gap at the point where the decision is actually made, and countries that offer them recruit noticeably better teachers in those subjects. Reducing administrative demands would encourage experienced teachers to remain in the profession, which in turn makes the job credible to the graduates considering whether to join it. Retention and recruitment are ultimately the same problem viewed from opposite ends, and a policy that ignores either one will not close the gap.

In conclusion, teaching is losing candidates chiefly because pay compares poorly and the workload is unsustainable. Bursaries aimed at shortage subjects, combined with a genuine reduction in administrative burden, would encourage far more people to join the profession again.`,
}

/** One representative prompt id per question type, used as the fallback example. */
const REPRESENTATIVE: Readonly<Record<QuestionType, string>> = {
  opinion: 'op-01',
  discussion: 'di-01',
  'problem-solution': 'ps-01',
  'advantages-disadvantages': 'ad-01',
  'double-question': 'dq-01',
}

export interface Task2ModelAnswer {
  /** The worked answer itself. */
  text: string
  /** Id of the prompt it actually answers. */
  sourcePromptId: string
  /**
   * False when the example answers a DIFFERENT question of the same type. The
   * UI must say so — the shape transfers, the content does not.
   */
  exact: boolean
}

/**
 * The best available worked answer for `prompt`.
 *
 * Prefers an exact match; otherwise falls back to the representative answer for
 * the same question type. Returns null only when the prompt is null or its type
 * has no representative — never a silently wrong example.
 */
export function task2ModelFor(prompt: PromptSpec | null): Task2ModelAnswer | null {
  if (!prompt) return null

  const exactText = TASK2_MODELS[prompt.id]
  if (exactText) return { text: exactText, sourcePromptId: prompt.id, exact: true }

  const fallbackId = REPRESENTATIVE[prompt.type]
  const fallbackText = fallbackId ? TASK2_MODELS[fallbackId] : undefined
  if (!fallbackText || !fallbackId) return null

  return { text: fallbackText, sourcePromptId: fallbackId, exact: false }
}
