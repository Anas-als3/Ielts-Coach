/**
 * Letter prompt bank: 15 IELTS General Training Writing Task 1 questions —
 * 5 formal, 5 semi-formal, 5 informal. Scenarios are the ones the exam actually
 * sets: complaints, requests, apologies, applications, invitations and thanks.
 *
 * **`bulletKeywords` is the part to get right.** It is the ONLY evidence
 * `gt-bullet-uncovered` has that a learner addressed a bullet point, and that
 * rule is an ERROR that caps Task Achievement at 5.5. Telling somebody who
 * plainly answered the point that they did not is the worst thing this app can
 * output, so every list is deliberately WIDE: the obvious word, the words a
 * competent answer would reach for instead, and the near-synonyms a good one
 * would. Coverage needs two DISTINCT hits from the list, and matching is by word
 * prefix, so "repair" already covers repairs, repaired and repairing — the lists
 * carry meanings, not inflections.
 *
 * `tone` is fixed by the scenario and drives three separate checks: which
 * greeting is acceptable (`gt-salutation-tone`), which sign-off pairs with it
 * (`gt-signoff-pairing`), and whether contractions are correct English here at
 * all (the tone guard in `analysis/rules/lexical.ts`).
 */
import type { LetterPromptSpec } from '../types'

/**
 * Standard General Training Task 1 instruction — every prompt text ends with
 * this, verbatim.
 */
const STANDARD_GT =
  'Write at least 150 words. You do NOT need to write any addresses. Begin your letter as follows: Dear ...,'

export const LETTER_PROMPTS: LetterPromptSpec[] = [
  /* --------------------------------- formal --------------------------------- */
  {
    id: 'gt-01',
    task: 'letter',
    tone: 'formal',
    topic: 'shopping',
    recipient: 'the manager of the store',
    text: `You recently bought a large household appliance from a shop, and it has developed a fault. Write a letter to the manager of the shop. In your letter, describe what you bought and when, explain what has gone wrong with it, and say what you would like the shop to do. ${STANDARD_GT}`,
    bullets: [
      'describe what you bought and when',
      'explain what has gone wrong with it',
      'say what you would like the shop to do',
    ],
    bulletKeywords: [
      ['bought', 'purchas', 'appliance', 'machine', 'delivered', 'receipt', 'model', 'store', 'shop', 'order'],
      ['fault', 'broke', 'broken', 'stopped', 'leak', 'failed', 'failure', 'damage', 'engineer', 'repair', 'defect'],
      ['refund', 'replace', 'replacement', 'compensat', 'exchange', 'resolve', 'return', 'reimburse'],
    ],
    keywords: ['appliance', 'machine', 'shop', 'manager', 'fault', 'refund', 'purchase', 'delivery', 'warranty', 'guarantee'],
  },
  {
    id: 'gt-02',
    task: 'letter',
    tone: 'formal',
    topic: 'housing',
    recipient: 'the local council',
    text: `Building work near your home is causing serious disturbance. Write a letter to your local council. In your letter, explain where you live and what the building work is, describe how it is affecting you, and suggest what the council could do about it. ${STANDARD_GT}`,
    bullets: [
      'explain where you live and what the building work is',
      'describe how the work is affecting you',
      'suggest what the council could do about it',
    ],
    bulletKeywords: [
      ['live', 'street', 'road', 'flat', 'house', 'neighbourhood', 'building', 'construction', 'site', 'development'],
      ['noise', 'dust', 'sleep', 'disturb', 'vibration', 'affect', 'disrupt', 'unable', 'windows', 'health'],
      ['council', 'restrict', 'hours', 'inspect', 'enforce', 'limit', 'suggest', 'propose', 'measure', 'action'],
    ],
    keywords: ['council', 'building', 'construction', 'noise', 'residents', 'street', 'permission', 'hours', 'disturbance'],
  },
  {
    id: 'gt-03',
    task: 'letter',
    tone: 'formal',
    topic: 'travel',
    recipient: 'the airline',
    text: `An airline lost your luggage on a recent flight. Write a letter to the airline. In your letter, give the details of your flight, describe the luggage and what was inside it, and explain what you want the airline to do. ${STANDARD_GT}`,
    bullets: [
      'give the details of your flight',
      'describe the luggage and what was inside it',
      'explain what you want the airline to do',
    ],
    bulletKeywords: [
      ['flight', 'booking', 'reference', 'departed', 'arriv', 'airport', 'boarding', 'seat', 'ticket', 'number'],
      ['suitcase', 'luggage', 'baggage', 'case', 'clothes', 'contain', 'inside', 'label', 'black', 'contents'],
      ['trace', 'locate', 'compensat', 'refund', 'reimburse', 'deliver', 'urgent', 'confirm', 'claim', 'return'],
    ],
    keywords: ['airline', 'flight', 'luggage', 'suitcase', 'baggage', 'airport', 'compensation', 'claim', 'delay'],
  },
  {
    id: 'gt-04',
    task: 'letter',
    tone: 'formal',
    topic: 'finance',
    recipient: 'the bank',
    text: `You have noticed a charge on your bank statement that you did not expect. Write a letter to your bank. In your letter, explain which charge you are querying, say why you believe it is wrong, and ask the bank what it intends to do. ${STANDARD_GT}`,
    bullets: [
      'explain which charge you are querying',
      'say why you believe the charge is wrong',
      'ask the bank what it intends to do',
    ],
    bulletKeywords: [
      ['charge', 'statement', 'account', 'fee', 'transaction', 'debited', 'amount', 'dated', 'appear', 'payment'],
      ['wrong', 'incorrect', 'error', 'never', 'authoris', 'agree', 'unaware', 'mistake', 'unexpected', 'evidence'],
      ['refund', 'investigate', 'explain', 'confirm', 'reverse', 'correct', 'respond', 'writing', 'intend', 'action'],
    ],
    keywords: ['bank', 'account', 'charge', 'statement', 'transaction', 'refund', 'customer', 'branch', 'fee'],
  },
  {
    id: 'gt-05',
    task: 'letter',
    tone: 'formal',
    topic: 'education',
    recipient: 'the college admissions office',
    text: `You would like to study a part-time course at a local college. Write a letter to the admissions office. In your letter, say which course interests you and why, describe your current qualifications and experience, and ask for the information you still need. ${STANDARD_GT}`,
    bullets: [
      'say which course interests you and why',
      'describe your current qualifications and experience',
      'ask for the information you still need',
    ],
    bulletKeywords: [
      ['course', 'programme', 'study', 'interest', 'evening', 'part-time', 'subject', 'accounting', 'career', 'enrol'],
      ['qualification', 'degree', 'diploma', 'certificate', 'experience', 'worked', 'employ', 'background', 'graduated', 'training'],
      ['information', 'timetable', 'fees', 'deadline', 'entry', 'requirement', 'apply', 'application', 'prospectus', 'brochure'],
    ],
    keywords: ['college', 'course', 'admissions', 'qualification', 'experience', 'fees', 'timetable', 'application', 'study'],
  },

  /* ------------------------------- semi-formal ------------------------------- */
  {
    id: 'gt-06',
    task: 'letter',
    tone: 'semi-formal',
    topic: 'work',
    recipient: 'your manager',
    text: `You would like to change your working hours. Write a letter to your manager. In your letter, explain what change you are asking for, give your reasons for wanting it, and describe how your work would still be covered. ${STANDARD_GT}`,
    bullets: [
      'explain what change to your hours you are asking for',
      'give your reasons for wanting the change',
      'describe how your work would still be covered',
    ],
    bulletKeywords: [
      ['hours', 'shift', 'schedule', 'start', 'finish', 'earlier', 'later', 'request', 'change', 'arrangement'],
      ['because', 'reason', 'childcare', 'commute', 'family', 'study', 'travel', 'health', 'distance', 'evening'],
      ['cover', 'colleague', 'deadline', 'remotely', 'handover', 'responsibilit', 'workload', 'ensure', 'team', 'unaffected'],
    ],
    keywords: ['manager', 'hours', 'shift', 'schedule', 'work', 'team', 'colleagues', 'request', 'arrangement'],
  },
  {
    id: 'gt-07',
    task: 'letter',
    tone: 'semi-formal',
    topic: 'housing',
    recipient: 'your landlord',
    text: `Something in the flat you rent needs repairing. Write a letter to your landlord. In your letter, describe the problem and how long it has existed, explain the difficulties it is causing, and say when it would suit you to have the repair done. ${STANDARD_GT}`,
    bullets: [
      'describe the problem and how long it has existed',
      'explain the difficulties it is causing',
      'say when it would suit you to have the repair done',
    ],
    bulletKeywords: [
      ['heating', 'boiler', 'leak', 'window', 'broke', 'problem', 'fault', 'weeks', 'since', 'stopped'],
      ['cold', 'difficult', 'damp', 'unable', 'sleep', 'expense', 'affect', 'inconvenien', 'damage', 'struggl'],
      ['repair', 'visit', 'plumber', 'engineer', 'available', 'weekend', 'morning', 'suit', 'arrange', 'access'],
    ],
    keywords: ['landlord', 'flat', 'repair', 'heating', 'tenant', 'plumber', 'rent', 'property', 'maintenance'],
  },
  {
    id: 'gt-08',
    task: 'letter',
    tone: 'semi-formal',
    topic: 'community',
    recipient: 'your neighbour',
    text: `You held a party at your home that disturbed your neighbour. Write a letter to your neighbour. In your letter, apologise for the disturbance, explain why the party went on so long, and say what you will do to prevent it happening again. ${STANDARD_GT}`,
    bullets: [
      'apologise for the disturbance',
      'explain why the party went on so long',
      'say what you will do to prevent it happening again',
    ],
    bulletKeywords: [
      ['apolog', 'sorry', 'regret', 'disturb', 'noise', 'late', 'kept', 'awake', 'inconvenien', 'unacceptable'],
      ['party', 'birthday', 'guests', 'celebrat', 'friends', 'overran', 'later', 'because', 'music', 'reason'],
      ['promise', 'ensure', 'future', 'earlier', 'warn', 'advance', 'indoors', 'prevent', 'volume', 'again'],
    ],
    keywords: ['neighbour', 'party', 'noise', 'apology', 'guests', 'evening', 'music', 'flat', 'disturbance'],
  },
  {
    id: 'gt-09',
    task: 'letter',
    tone: 'semi-formal',
    topic: 'education',
    recipient: 'your course tutor',
    text: `You missed several classes on a course you are taking. Write a letter to your tutor. In your letter, explain why you were absent, describe what you have done to catch up, and ask for the help you need to complete the course. ${STANDARD_GT}`,
    bullets: [
      'explain why you were absent',
      'describe what you have done to catch up',
      'ask for the help you need to complete the course',
    ],
    bulletKeywords: [
      ['absent', 'missed', 'illness', 'unwell', 'hospital', 'family', 'unable', 'attend', 'reason', 'weeks'],
      ['notes', 'borrow', 'reading', 'caught', 'classmate', 'recording', 'studied', 'revised', 'material', 'coursework'],
      ['help', 'extension', 'tutorial', 'deadline', 'assignment', 'advice', 'meet', 'support', 'complete', 'guidance'],
    ],
    keywords: ['tutor', 'course', 'classes', 'absence', 'assignment', 'notes', 'deadline', 'coursework', 'student'],
  },
  {
    id: 'gt-10',
    task: 'letter',
    tone: 'semi-formal',
    topic: 'work',
    recipient: 'your team leader',
    text: `You believe the rota at your workplace could be organised better. Write a letter to your team leader. In your letter, explain what problem the current rota causes, describe the change you are proposing, and say how the team would benefit. ${STANDARD_GT}`,
    bullets: [
      'explain what problem the current rota causes',
      'describe the change you are proposing',
      'say how the team would benefit',
    ],
    bulletKeywords: [
      ['rota', 'current', 'problem', 'weekend', 'shift', 'clash', 'short-staffed', 'unfair', 'overlap', 'busiest'],
      ['propose', 'suggest', 'change', 'rotate', 'swap', 'monthly', 'system', 'alternat', 'trial', 'timetable'],
      ['benefit', 'team', 'morale', 'cover', 'fairer', 'productiv', 'absence', 'reduce', 'improve', 'colleague'],
    ],
    keywords: ['rota', 'team', 'shift', 'leader', 'workplace', 'colleagues', 'weekend', 'staff', 'schedule'],
  },

  /* -------------------------------- informal --------------------------------- */
  {
    id: 'gt-11',
    task: 'letter',
    tone: 'informal',
    topic: 'social',
    recipient: 'a friend',
    text: `You have moved into a new home. Write a letter to a friend. In your letter, describe the new place, explain why you moved, and invite your friend to come and stay. ${STANDARD_GT}`,
    bullets: ['describe your new home', 'explain why you moved', 'invite your friend to come and stay'],
    bulletKeywords: [
      ['flat', 'house', 'garden', 'kitchen', 'rooms', 'bedroom', 'bright', 'balcony', 'street', 'view'],
      ['moved', 'because', 'rent', 'closer', 'job', 'space', 'cheaper', 'noisy', 'reason', 'commute'],
      ['visit', 'stay', 'come', 'weekend', 'invit', 'spare', 'welcome', 'over', 'guest', 'show'],
    ],
    keywords: ['flat', 'house', 'moved', 'friend', 'garden', 'visit', 'weekend', 'neighbourhood', 'home'],
  },
  {
    id: 'gt-12',
    task: 'letter',
    tone: 'informal',
    topic: 'social',
    recipient: 'a friend',
    text: `A friend looked after your home while you were away. Write a letter to that friend. In your letter, thank them for what they did, describe how your trip went, and suggest a way of repaying them. ${STANDARD_GT}`,
    bullets: [
      'thank your friend for what they did',
      'describe how your trip went',
      'suggest a way of repaying them',
    ],
    bulletKeywords: [
      ['thank', 'grateful', 'looked', 'watered', 'plants', 'post', 'keys', 'cat', 'kind', 'trouble'],
      ['trip', 'holiday', 'travel', 'weather', 'beach', 'mountains', 'food', 'week', 'flight', 'enjoy'],
      ['repay', 'dinner', 'cook', 'treat', 'return', 'favour', 'owe', 'buy', 'meal', 'lunch'],
    ],
    keywords: ['friend', 'thank', 'holiday', 'trip', 'plants', 'flat', 'dinner', 'favour', 'keys'],
  },
  {
    id: 'gt-13',
    task: 'letter',
    tone: 'informal',
    topic: 'work',
    recipient: 'a friend',
    text: `You have just started a new job. Write a letter to a friend. In your letter, tell them about the job, explain what you like and dislike about it so far, and ask about what they have been doing. ${STANDARD_GT}`,
    bullets: [
      'tell your friend about the new job',
      'explain what you like and dislike about it so far',
      'ask what your friend has been doing',
    ],
    bulletKeywords: [
      ['job', 'started', 'company', 'office', 'role', 'team', 'work', 'position', 'week', 'hired'],
      ['like', 'enjoy', 'dislike', 'hate', 'colleague', 'commute', 'hours', 'boring', 'interesting', 'busy'],
      // Deliberately NOT 'you' or 'how': a letter says both in every paragraph,
      // and a keyword the answer cannot avoid is not evidence of anything.
      ['your news', 'yourself', 'lately', 'been up to', 'how are you', 'tell me', 'hear from you', 'what have you', 'your family', 'your plans'],
    ],
    keywords: ['job', 'friend', 'office', 'colleagues', 'work', 'commute', 'team', 'news', 'week'],
  },
  {
    id: 'gt-14',
    task: 'letter',
    tone: 'informal',
    topic: 'social',
    recipient: 'a friend',
    text: `You were unable to attend a friend's birthday celebration. Write a letter to that friend. In your letter, apologise for missing it, explain what happened, and suggest doing something together soon. ${STANDARD_GT}`,
    bullets: [
      'apologise for missing the celebration',
      'explain what happened',
      'suggest doing something together soon',
    ],
    bulletKeywords: [
      ['sorry', 'apolog', 'missed', 'birthday', 'party', 'celebrat', 'terrible', 'bad', 'gutted', 'wish'],
      ['happened', 'because', 'train', 'work', 'ill', 'stuck', 'late', 'delayed', 'emergency', 'car'],
      ['soon', 'meet', 'dinner', 'weekend', 'cinema', 'together', 'suggest', 'free', 'catch', 'plan'],
    ],
    keywords: ['friend', 'birthday', 'party', 'sorry', 'weekend', 'dinner', 'train', 'celebration', 'meet'],
  },
  {
    id: 'gt-15',
    task: 'letter',
    tone: 'informal',
    topic: 'travel',
    recipient: 'a friend',
    text: `You are planning a holiday in a country your friend knows well. Write a letter to that friend. In your letter, say when you are going and who with, ask for advice about where to stay, and ask what you should see while you are there. ${STANDARD_GT}`,
    bullets: [
      'say when you are going and who with',
      'ask for advice about where to stay',
      'ask what you should see while you are there',
    ],
    bulletKeywords: [
      ['going', 'travel', 'flying', 'august', 'summer', 'weeks', 'sister', 'brother', 'partner', 'together'],
      ['stay', 'hotel', 'hostel', 'advice', 'recommend', 'cheap', 'area', 'book', 'accommodation', 'neighbourhood'],
      ['see', 'visit', 'museum', 'coast', 'food', 'market', 'worth', 'suggest', 'places', 'trip'],
    ],
    keywords: ['friend', 'holiday', 'travel', 'advice', 'hotel', 'visit', 'country', 'trip', 'summer'],
  },
]

/** A random letter prompt. Production draws; tests pin (see tests/ui/renderApp.tsx). */
export function randomLetterPrompt(): LetterPromptSpec {
  return LETTER_PROMPTS[Math.floor(Math.random() * LETTER_PROMPTS.length)]
}

/** Letter prompts of one tone, for a picker grouped by formality. */
export function letterPromptsForTone(tone: LetterPromptSpec['tone']): LetterPromptSpec[] {
  return LETTER_PROMPTS.filter((p) => p.tone === tone)
}
