/**
 * Listening Test 1 — four sections, forty questions, thirty minutes.
 * Implements plan 011 step 4.
 *
 * ## Copyright and provenance
 *
 * | Section | Material | Source | Licence |
 * |---|---|---|---|
 * | 1 | Harbour View Cottages booking call | Original script written for this project | Original work of this project |
 * | 2 | Ashcombe Reservoir welcome talk | Original script written for this project | Original work of this project |
 * | 3 | Food-waste project tutorial | Original script written for this project | Original work of this project |
 * | 4 | Lecture: the deep sound channel | Original script written for this project | Original work of this project |
 *
 * **Nothing in this file is reproduced from any IELTS publisher.** Real exam
 * recordings, transcripts and question sets are University of Cambridge (UCLES)
 * copyright and cannot ship in an outward-facing app. The FORMAT is not
 * copyrightable, so this test follows the real paper's structure — four
 * sections, forty questions, a rising difficulty curve, the exam's own question
 * types — with every word of script and every item written from scratch for
 * this project. Places, people, prices and telephone details are invented; the
 * factual content of Section 4 is general knowledge about ocean acoustics
 * stated in this project's own words, with figures kept round and the one
 * genuinely contested claim (the historical range of whale calls) flagged as
 * contested inside the lecture itself.
 *
 * ## Structure
 *
 * | Section | Context | Questions | Formats |
 * |---|---|---|---|
 * | 1 | Two speakers, everyday transaction | 1–10 | form completion ×8, multiple choice ×2 |
 * | 2 | Monologue, everyday social | 11–20 | multiple choice ×4, plan labelling ×6 |
 * | 3 | Three speakers, education | 21–30 | matching ×5, multiple choice ×3, short answer ×2 |
 * | 4 | Monologue, academic lecture | 31–40 | note completion ×10 |
 *
 * Difficulty rises the way the real paper's does, and not by making the words
 * harder: Section 1 answers arrive in the order the form asks for them, Section
 * 2 requires holding six positions against a bank of eight, Section 3 requires
 * tracking who said what about which part of a report while two distractor
 * options are explicitly ruled out, and Section 4 is uninterrupted academic
 * prose in which the notes deliberately reorder and reword what the lecturer
 * says, so copying the next noun does not work.
 *
 * ## Item-writing rules obeyed here
 *
 *  - No answer appears elsewhere in its own question block. Section 4's notes
 *    were reworded specifically to keep the word "pressure" out of the block
 *    that asks for it.
 *  - Every multiple-choice, matching and plan-labelling key is one of its own
 *    options, and every completion key fits its own word limit.
 *  - Every distractor is heard in the recording. Curlew's price, the cot
 *    charge, the recycling point and the café terrace all exist and are all
 *    wrong; the two unused matching options are ruled out in so many words.
 *
 * `tests/listening-marking.test.ts` enforces the mechanical half of that list.
 */
import type { ListeningSpeaker, ListeningTest } from '../types'

/** Join authored lines into one spoken turn. Keeps prose readable in source. */
const line = (...parts: string[]): string => parts.join(' ')

/** Provenance shared by all four sections. */
const ORIGINAL = {
  description: 'Original script written for this project',
  licence: 'Original work of this project',
} as const

/** The narrator is the same voice throughout the paper, as in the real exam. */
const NARRATOR: ListeningSpeaker = {
  id: 'narrator',
  label: 'NARRATOR',
  description: 'the exam narrator',
  voice: { gender: 'female', accent: 'en-GB', rate: 0.95 },
}

/* ================================ section 1 ================================= */

const S1_SPEAKERS: ListeningSpeaker[] = [
  NARRATOR,
  {
    id: 'ross',
    label: 'ROSS',
    description: 'the booking agent',
    voice: { gender: 'male', accent: 'en-GB' },
  },
  {
    id: 'petra',
    label: 'PETRA',
    description: 'the caller',
    voice: { gender: 'female', accent: 'en-GB' },
  },
]

/* ================================ section 2 ================================= */

const S2_SPEAKERS: ListeningSpeaker[] = [
  NARRATOR,
  {
    id: 'deborah',
    label: 'DEBORAH',
    description: 'a reservoir warden',
    voice: { gender: 'female', accent: 'en-GB' },
  },
]

/**
 * The described plan for questions 15–20.
 *
 * The app ships no images, so the plan is described in words rather than drawn.
 * That is the honest text-only rendering of a plan-labelling task: the skill
 * being tested — holding a spatial description while a monologue moves on — is
 * intact, and the UI says the plan is described rather than pictured. Letters
 * are the array positions, A–H, exactly as Reading's multiple choice does it.
 *
 * Eight positions, six of them used. B and H are heard in the talk and are
 * wrong, which is what makes the bank do any work.
 */
const S2_PLAN: string[] = [
  'beside the entrance barrier, at the top of the car park',
  'at the far end of the car park, by the recycling point',
  'on the dam wall, at its eastern end',
  'on the grass between the visitor centre and the boat house',
  'on the island, across the footbridge',
  'at the southern end of the lake, beyond the reed beds',
  'in the woodland, off the yellow trail',
  'on the terrace beside the café, facing the water',
]

/* ================================ section 3 ================================= */

const S3_SPEAKERS: ListeningSpeaker[] = [
  NARRATOR,
  {
    id: 'awan',
    label: 'DR AWAN',
    description: 'the tutor',
    voice: { gender: 'female', accent: 'en-GB' },
  },
  {
    id: 'rafi',
    label: 'RAFI',
    description: 'a student',
    voice: { gender: 'male', accent: 'en-GB' },
  },
  {
    id: 'joanna',
    label: 'JOANNA',
    description: 'a student',
    voice: { gender: 'female', accent: 'en-AU' },
  },
]

/**
 * The comment bank for questions 21–25. Seven options, five used, each used
 * once. The two spare options are not decoration — Dr Awan rules both of them
 * out explicitly, so a learner who guesses from plausibility rather than from
 * the recording is caught.
 */
const S3_COMMENTS: string[] = [
  'It is too long for what it says.',
  'It needs a clearer link to the research question.',
  'The evidence in it is out of date.',
  'It should be moved to an appendix.',
  'It is the strongest part of the draft.',
  'It repeats material that belongs in another section.',
  'It relies too heavily on a single source.',
]

/* ================================ section 4 ================================= */

const S4_SPEAKERS: ListeningSpeaker[] = [
  NARRATOR,
  {
    id: 'lecturer',
    label: 'LECTURER',
    description: 'the lecturer',
    voice: { gender: 'male', accent: 'en-GB', rate: 0.97 },
  },
]

/* =================================== test =================================== */

export const LISTENING_TEST_01: ListeningTest = {
  id: 'listening-01',
  title: 'Listening Test 1',

  /* ------------------------------- sections -------------------------------- */

  sections: [
    {
      id: 'listening-01-s1',
      number: 1,
      heading: 'Section 1',
      rubric:
        'You will hear a telephone conversation between a woman and the agent who takes bookings for a group of holiday cottages.',
      context: 'social-transactional',
      source: ORIGINAL,
      transcript: {
        speakers: S1_SPEAKERS,
        cues: [
          {
            id: 'ls1-c01',
            speakerId: 'narrator',
            text: line(
              'Section One. You will hear a telephone conversation between a woman and the agent',
              'who takes bookings for a group of holiday cottages. First, you have some time to',
              'look at questions one to ten.',
            ),
          },
          {
            id: 'ls1-c02',
            speakerId: 'ross',
            pauseBeforeSec: 30,
            text: 'Good morning, Harbour View Cottages, Ross speaking.',
          },
          {
            id: 'ls1-c03',
            speakerId: 'petra',
            text: line(
              'Oh, good morning. I’m hoping you might still have something free for a few nights',
              'in September.',
            ),
          },
          {
            id: 'ls1-c04',
            speakerId: 'ross',
            text: line(
              'Quite possibly. Let me take your details first and then I’ll look. Can I start with',
              'your name?',
            ),
          },
          { id: 'ls1-c05', speakerId: 'petra', text: 'Yes, it’s Petra Lindqvist.' },
          { id: 'ls1-c06', speakerId: 'ross', text: 'And how do you spell the surname?' },
          {
            id: 'ls1-c07',
            speakerId: 'petra',
            answersQuestions: [1],
            text: line(
              'L - I - N - D - Q - V - I - S - T. There’s no U after the Q. That’s the bit',
              'everybody gets wrong.',
            ),
          },
          {
            id: 'ls1-c08',
            speakerId: 'ross',
            text: line(
              'L - I - N - D - Q - V - I - S - T. Thank you. And an email address, so I can send',
              'the confirmation?',
            ),
          },
          {
            id: 'ls1-c09',
            speakerId: 'petra',
            text: 'It’s petra dot lindqvist, all one word, at brookmill dot co dot uk.',
          },
          { id: 'ls1-c10', speakerId: 'ross', text: 'Brookmill — is that spelled as it sounds?' },
          {
            id: 'ls1-c11',
            speakerId: 'petra',
            answersQuestions: [2],
            text: 'B - R - O - O - K - M - I - L - L. It’s the school I teach at.',
          },
          {
            id: 'ls1-c12',
            speakerId: 'ross',
            text: 'Lovely. Now, which dates were you thinking of?',
          },
          {
            id: 'ls1-c13',
            speakerId: 'petra',
            answersQuestions: [3],
            text: 'We’d come down on the fourteenth of September.',
          },
          { id: 'ls1-c14', speakerId: 'ross', text: 'The fourteenth. And staying how long? A week?' },
          {
            id: 'ls1-c15',
            speakerId: 'petra',
            answersQuestions: [4],
            text: line(
              'That was the plan, but my husband can’t get away until the Wednesday, so it’ll be',
              'five nights now rather than seven.',
            ),
          },
          {
            id: 'ls1-c16',
            speakerId: 'ross',
            text: 'Five nights from the fourteenth. Fine. And how many of you altogether?',
          },
          { id: 'ls1-c17', speakerId: 'petra', text: 'Four adults and one child.' },
          {
            id: 'ls1-c18',
            speakerId: 'ross',
            text: 'And how old is the child? I only ask because of the beds.',
          },
          {
            id: 'ls1-c19',
            speakerId: 'petra',
            answersQuestions: [5],
            text: 'She’s six. She’s happy anywhere as long as there’s a window.',
          },
          {
            id: 'ls1-c20',
            speakerId: 'ross',
            text: line(
              'Six. Right. So there are two cottages free that week. Sanderling sleeps six, and',
              'Curlew sleeps five but has much the better view — it looks straight down the',
              'harbour.',
            ),
          },
          { id: 'ls1-c21', speakerId: 'petra', text: 'And what do they cost?' },
          {
            id: 'ls1-c22',
            speakerId: 'ross',
            answersQuestions: [7],
            text: line(
              'Curlew is seven hundred and forty-five pounds for the five nights. Sanderling is',
              'six hundred and eighty.',
            ),
          },
          {
            id: 'ls1-c23',
            speakerId: 'petra',
            text: 'Then we’ll take the cheaper one and put the bags on the spare bed.',
          },
          {
            id: 'ls1-c24',
            speakerId: 'ross',
            answersQuestions: [6],
            text: line(
              'Sanderling it is. That’s S - A - N - D - E - R - L - I - N - G, after the little',
              'bird that runs about at the water’s edge.',
            ),
          },
          {
            id: 'ls1-c25',
            speakerId: 'ross',
            text: line(
              'A few things I should mention. The cottage is right at the top of the village, so',
              'it’s a steep walk down to the harbour — about ten minutes, and not a route for a',
              'wheelchair or a pushchair.',
            ),
          },
          {
            id: 'ls1-c26',
            speakerId: 'petra',
            text: 'That’s no problem. Nobody in our party needs one.',
          },
          {
            id: 'ls1-c27',
            speakerId: 'ross',
            text: line(
              'Good. There’s one parking space at the cottage itself, and a free car park for',
              'visitors beside the church, two minutes away. Bed linen and tea towels are',
              'provided; beach towels you’d need to bring yourselves. And is there a dog?',
            ),
          },
          { id: 'ls1-c28', speakerId: 'petra', text: 'There is. A large and extremely muddy one.' },
          {
            id: 'ls1-c29',
            speakerId: 'ross',
            answersQuestions: [8],
            text: line(
              'Sanderling does take dogs. It’s fifteen pounds per dog for the stay, and we only',
              'ask that he isn’t left in the cottage on his own.',
            ),
          },
          {
            id: 'ls1-c30',
            speakerId: 'petra',
            text: line(
              'He wouldn’t stand for it in any case. What about a cot — no, ignore that, she’s',
              'long out of a cot.',
            ),
          },
          {
            id: 'ls1-c31',
            speakerId: 'ross',
            text: 'The cot is eight pounds for the stay, if you ever need one.',
          },
          { id: 'ls1-c32', speakerId: 'petra', text: 'Noted. And how do we pay?' },
          {
            id: 'ls1-c33',
            speakerId: 'ross',
            answersQuestions: [9],
            text: line(
              'Twenty-five per cent today to hold the booking, and the rest six weeks before you',
              'arrive. I’ll email you a payment link this afternoon.',
            ),
          },
          { id: 'ls1-c34', speakerId: 'petra', text: 'Easy enough. And what time can we get in?' },
          {
            id: 'ls1-c35',
            speakerId: 'ross',
            text: line(
              'From four o’clock, and out by ten on the morning you leave. The key’s in a box by',
              'the front door and I’ll text you the code the day before.',
            ),
          },
          {
            id: 'ls1-c36',
            speakerId: 'petra',
            text: line(
              'Wonderful. Oh — one more thing. A friend of mine stayed at Curlew two years ago',
              'and she would not stop going on about the bread.',
            ),
          },
          {
            id: 'ls1-c37',
            speakerId: 'ross',
            answersQuestions: [10],
            text: line(
              'That’ll be the bakery on Fore Street. Worth knowing: they open at seven, and by',
              'about nine on a good day there is nothing left but a few rolls. So it’s an early',
              'walk if you want a loaf.',
            ),
          },
          { id: 'ls1-c38', speakerId: 'petra', text: 'I’ll set an alarm. Thank you very much.' },
          {
            id: 'ls1-c39',
            speakerId: 'ross',
            text: 'My pleasure. The confirmation will be with you by five.',
          },
          {
            id: 'ls1-c40',
            speakerId: 'narrator',
            pauseBeforeSec: 2,
            text: 'That is the end of Section One. You now have half a minute to check your answers.',
          },
        ],
      },
    },

    {
      id: 'listening-01-s2',
      number: 2,
      heading: 'Section 2',
      rubric:
        'You will hear a warden welcoming a group of visitors to Ashcombe Reservoir and nature reserve.',
      context: 'social-monologue',
      source: ORIGINAL,
      transcript: {
        speakers: S2_SPEAKERS,
        cues: [
          {
            id: 'ls2-c01',
            speakerId: 'narrator',
            pauseBeforeSec: 30,
            text: line(
              'Section Two. You will hear a warden welcoming a group of visitors to a reservoir',
              'and nature reserve. First, you have some time to look at questions eleven to',
              'fourteen.',
            ),
          },
          {
            id: 'ls2-c02',
            speakerId: 'deborah',
            pauseBeforeSec: 30,
            text: line(
              'Good morning everyone, and welcome to Ashcombe Reservoir. My name’s Deborah and',
              'I’m one of the two wardens here. I’ll keep this short, because it is a great deal',
              'nicer outside than it is in this room.',
            ),
          },
          {
            id: 'ls2-c03',
            speakerId: 'deborah',
            answersQuestions: [11],
            text: line(
              'A word first about what this place actually is, because people are often',
              'surprised. Ashcombe was not dug for the ducks. It was built in nineteen-oh-four',
              'to supply drinking water to Marsden, the town ten miles east of here, which had',
              'grown a good deal faster than its wells could cope with. The wildlife arrived',
              'afterwards, and it arrived by accident. And we still send water to Marsden, so',
              'the reservoir is not an ornament.',
            ),
          },
          {
            id: 'ls2-c04',
            speakerId: 'deborah',
            answersQuestions: [12],
            text: line(
              'The main change this year, and the one I most need you to remember, is about dogs.',
              'The whole of the northern shore is now closed to dogs from the first of March to',
              'the end of July. That is not us being difficult. Three species nest on the ground',
              'along there, and a dog running through the grass does not have to catch anything',
              'to destroy a season’s nests. Dogs are welcome everywhere else on the site, on a',
              'lead.',
            ),
          },
          {
            id: 'ls2-c05',
            speakerId: 'deborah',
            answersQuestions: [13],
            text: line(
              'Next, the water itself. Every summer somebody asks whether they may swim, and',
              'every summer the answer is no. It is not about pollution — the water is clean, it',
              'has to be. It is that the sides shelve away almost vertically about a metre from',
              'the edge, and below the first foot or so it is startlingly cold, even in August.',
              'People get into difficulty in seconds rather than minutes.',
            ),
          },
          {
            id: 'ls2-c06',
            speakerId: 'deborah',
            answersQuestions: [14],
            text: line(
              'And if you find a bird that is clearly injured — and sooner or later you will —',
              'please do not pick it up. Handling does more damage than the original injury nine',
              'times out of ten. There is a telephone number printed on all the green signs',
              'around the site. Ring that, tell us where you are, and one of us will come out to',
              'you.',
            ),
          },
          {
            id: 'ls2-c07',
            speakerId: 'narrator',
            pauseBeforeSec: 5,
            text: line(
              'Before you hear the rest of the talk, you have some time to look at questions',
              'fifteen to twenty.',
            ),
          },
          {
            id: 'ls2-c08',
            speakerId: 'deborah',
            pauseBeforeSec: 30,
            text: line(
              'Right — the plan in your hand. Let me tell you where six things are, because the',
              'plan we print does not name them and people wander about for hours.',
            ),
          },
          {
            id: 'ls2-c09',
            speakerId: 'deborah',
            answersQuestions: [15],
            text: line(
              'Start with the bird hide, since that is what most of you came for. Go out of the',
              'door behind me, turn right, and you will see the boat house down at the water’s',
              'edge. The hide is the low wooden building standing on the grass between this',
              'centre and the boat house. It has no windows on the side facing you, which is why',
              'people walk straight past it.',
            ),
          },
          {
            id: 'ls2-c10',
            speakerId: 'deborah',
            answersQuestions: [16],
            text: line(
              'If you have brought children, the play area is at the very top of the car park,',
              'immediately beside the barrier you drove in through. That is deliberate — you can',
              'sit in the car with a flask and still see them. Do not confuse it with the far end',
              'of the car park; that is the recycling point, and there is nothing there for',
              'anybody.',
            ),
          },
          {
            id: 'ls2-c11',
            speakerId: 'deborah',
            answersQuestions: [17],
            text: line(
              'The sailing club has the use of the dam wall, and their jetty is at the eastern end',
              'of it. They race on Sunday mornings, and they would very much rather you watched',
              'from the wall than from the water.',
            ),
          },
          {
            id: 'ls2-c12',
            speakerId: 'deborah',
            answersQuestions: [18],
            text: line(
              'For lunch there is the terrace beside the café, facing the water, which is the',
              'civilised option. If you would rather be out of earshot of other people, the picnic',
              'meadow is right down at the southern end of the lake, past the reed beds. It is',
              'twenty minutes on foot and there are no bins down there, so whatever you carry',
              'down you carry back.',
            ),
          },
          {
            id: 'ls2-c13',
            speakerId: 'deborah',
            answersQuestions: [19],
            text: line(
              'The wildlife pond is a quite different thing from the reservoir — it is a small',
              'pond we dug for amphibians. You will find it in the woodland, just off the yellow',
              'trail. Go slowly and look at the edges. In April there is so much frogspawn you',
              'can hear it.',
            ),
          },
          {
            id: 'ls2-c14',
            speakerId: 'deborah',
            answersQuestions: [20],
            text: line(
              'And last, the memorial stone. Take the footbridge across to the island; the stone',
              'is there, on the far side, facing the dam. It carries the names of the eleven men',
              'who died building this place, which is worth a minute of anybody’s morning.',
            ),
          },
          {
            id: 'ls2-c15',
            speakerId: 'deborah',
            text: line(
              'That is everything. The toilets are through the double doors, the café takes cards,',
              'and if it starts raining hard please come back here rather than sheltering under',
              'the trees.',
            ),
          },
          {
            id: 'ls2-c16',
            speakerId: 'narrator',
            pauseBeforeSec: 2,
            text: 'That is the end of Section Two. You now have half a minute to check your answers.',
          },
        ],
      },
    },

    {
      id: 'listening-01-s3',
      number: 3,
      heading: 'Section 3',
      rubric:
        'You will hear two students, Rafi and Joanna, discussing a draft research report with their tutor, Dr Awan.',
      context: 'educational-conversation',
      source: ORIGINAL,
      transcript: {
        speakers: S3_SPEAKERS,
        cues: [
          {
            id: 'ls3-c01',
            speakerId: 'narrator',
            pauseBeforeSec: 30,
            text: line(
              'Section Three. You will hear two students, Rafi and Joanna, discussing a draft',
              'research report with their tutor, Doctor Awan. First, you have some time to look',
              'at questions twenty-one to twenty-five.',
            ),
          },
          {
            id: 'ls3-c02',
            speakerId: 'awan',
            pauseBeforeSec: 30,
            text: line(
              'Come in, both of you. I have read the draft twice, and I want to go through it',
              'section by section, because the problem is a different one in each.',
            ),
          },
          { id: 'ls3-c03', speakerId: 'rafi', text: 'That sounds ominous.' },
          {
            id: 'ls3-c04',
            speakerId: 'awan',
            answersQuestions: [21],
            text: line(
              'It shouldn’t. There is a good project in here. Let’s start at the front. Your',
              'introduction runs to three pages, and when I reached the end of it I could',
              'summarise the whole thing in one sentence: universities throw away a great deal of',
              'food. Three pages to say that is three pages I did not spend on your findings.',
              'Bring it down to one.',
            ),
          },
          { id: 'ls3-c05', speakerId: 'joanna', text: 'We did wonder about that.' },
          {
            id: 'ls3-c06',
            speakerId: 'awan',
            answersQuestions: [22],
            text: line(
              'Then trust the wondering. The literature review is a different problem altogether.',
              'It is well organised and it reads well — but look at your dates. The most recent',
              'work you cite is from twenty-fourteen. There have been two large national studies',
              'since then, and they do not entirely agree with the picture you have painted.',
            ),
          },
          {
            id: 'ls3-c07',
            speakerId: 'rafi',
            text: 'I have both of those. I just hadn’t read them properly.',
          },
          {
            id: 'ls3-c08',
            speakerId: 'awan',
            answersQuestions: [23],
            text: line(
              'Then read them properly. Now, the methods section. I want to be clear about this',
              'one: it is the part I would show to next year’s students as an example. You',
              'explain the bin audit step by step, you say how often you weighed, and — this is',
              'the bit people always leave out — you say what you could not weigh, and why.',
            ),
          },
          { id: 'ls3-c09', speakerId: 'joanna', text: 'That was Rafi being obsessive.' },
          { id: 'ls3-c10', speakerId: 'rafi', text: 'It was.' },
          {
            id: 'ls3-c11',
            speakerId: 'awan',
            answersQuestions: [24],
            text: line(
              'Keep being obsessive. The results section is where I began to lose patience, and',
              'it is not because the numbers are bad. Every time you give a figure you then spend',
              'a paragraph explaining what it means — and then you explain it all over again',
              'twenty pages later. Give me the numbers in the results. Nothing else.',
            ),
          },
          { id: 'ls3-c12', speakerId: 'joanna', text: 'So all the interpretation moves back.' },
          {
            id: 'ls3-c13',
            speakerId: 'awan',
            answersQuestions: [25],
            text: line(
              'It moves back — and that brings me to the discussion, which is genuinely',
              'interesting and which I could not follow. You asked one thing: does portion size',
              'predict plate waste in catered halls? By page four of the discussion you are',
              'writing about supermarket packaging. Every paragraph has to point back at what you',
              'asked, or it is not a discussion, it is an essay.',
            ),
          },
          {
            id: 'ls3-c14',
            speakerId: 'awan',
            text: line(
              'Two things I am not asking for, before you go away and worry about them. The raw',
              'weight tables are already in an appendix, which is exactly where they belong, and',
              'nothing else should follow them back there. And your national figures come from',
              'three separate sources, which is more than most people manage, so nobody is going',
              'to accuse you of leaning on one paper.',
            ),
          },
          {
            id: 'ls3-c15',
            speakerId: 'narrator',
            pauseBeforeSec: 5,
            text: 'Now look at questions twenty-six to thirty.',
          },
          {
            id: 'ls3-c16',
            speakerId: 'rafi',
            pauseBeforeSec: 30,
            text: line(
              'Can I ask about the data? I keep thinking the sample is too small. I would like to',
              'run a second week of measurements.',
            ),
          },
          { id: 'ls3-c17', speakerId: 'awan', text: 'When would you do it?' },
          { id: 'ls3-c18', speakerId: 'rafi', text: 'Well — term ends on the fifth.' },
          {
            id: 'ls3-c19',
            speakerId: 'joanna',
            text: line(
              'And the halls empty out the week before that, so a second week would be measuring',
              'an empty building.',
            ),
          },
          {
            id: 'ls3-c20',
            speakerId: 'awan',
            answersQuestions: [26],
            text: line(
              'Joanna is right. A second week in a half-empty hall would make your data worse,',
              'not better. What would help is breadth rather than length. You measured one hall.',
              'Measure one more, over the same three days, and you can at least say whether what',
              'you found is a property of catering or a property of that building.',
            ),
          },
          {
            id: 'ls3-c21',
            speakerId: 'joanna',
            answersQuestions: [27],
            text: line(
              'That is doable. Though I should say the first week was not clean either. On the',
              'Wednesday the kitchen team emptied the plate-scrape bin before we had weighed it.',
              'They were not being obstructive — nobody had told the evening shift we existed —',
              'but we lost the whole dinner service.',
            ),
          },
          {
            id: 'ls3-c22',
            speakerId: 'awan',
            text: line(
              'Then say so in the methods. A missing evening honestly reported is worth more than',
              'a full week nobody believes.',
            ),
          },
          {
            id: 'ls3-c23',
            speakerId: 'awan',
            answersQuestions: [28],
            text: line(
              'Rafi, before we meet again — those two national studies. Read them, and bring me a',
              'paragraph on where they contradict your literature review.',
            ),
          },
          { id: 'ls3-c24', speakerId: 'rafi', text: 'Not the introduction?' },
          {
            id: 'ls3-c25',
            speakerId: 'awan',
            text: line(
              'The introduction is a morning’s work with a red pen. The reading is the part that',
              'changes what you think.',
            ),
          },
          {
            id: 'ls3-c26',
            speakerId: 'awan',
            answersQuestions: [29],
            text: line(
              'Two last things, and they are small. Every graph in the report needs the sample',
              'size on it. Every single one. A bar chart without an n is a picture, not evidence.',
            ),
          },
          { id: 'ls3-c27', speakerId: 'joanna', text: 'On the graph itself, or in the caption?' },
          {
            id: 'ls3-c28',
            speakerId: 'awan',
            answersQuestions: [30],
            text: line(
              'In the caption is fine. And for next week I would like a one-page plan — just the',
              'section headings, with one line under each saying what goes in it. If you cannot',
              'write that page, the report is not ready to be rewritten.',
            ),
          },
          {
            id: 'ls3-c29',
            speakerId: 'narrator',
            pauseBeforeSec: 2,
            text: 'That is the end of Section Three. You now have half a minute to check your answers.',
          },
        ],
      },
    },

    {
      id: 'listening-01-s4',
      number: 4,
      heading: 'Section 4',
      rubric: 'You will hear part of a lecture about the deep sound channel in the ocean.',
      context: 'academic-monologue',
      source: ORIGINAL,
      transcript: {
        speakers: S4_SPEAKERS,
        cues: [
          {
            id: 'ls4-c01',
            speakerId: 'narrator',
            pauseBeforeSec: 30,
            text: line(
              'Section Four. You will hear part of a lecture about the deep sound channel in the',
              'ocean. First, you have some time to look at questions thirty-one to forty.',
            ),
          },
          {
            id: 'ls4-c02',
            speakerId: 'lecturer',
            pauseBeforeSec: 45,
            text: line(
              'Good afternoon. Today I want to talk about a layer of the ocean that you cannot',
              'see, could not comfortably dive to, and would never guess was there — and which,',
              'for about eighty years, has been one of the most useful features of the sea. It is',
              'called the deep sound channel. To understand why it exists at all, we have to',
              'start with how fast sound travels in water.',
            ),
          },
          {
            id: 'ls4-c03',
            speakerId: 'lecturer',
            answersQuestions: [31, 32],
            text: line(
              'In air, sound moves at roughly three hundred and forty metres a second. In',
              'seawater it moves at about one thousand five hundred metres a second — more than',
              'four times as fast. That figure is not fixed, though, and the way it varies is the',
              'whole of the story. Three things push the speed up: temperature, salinity and',
              'pressure. Of the three, temperature and pressure do very nearly all the work in',
              'the open ocean; salinity varies too little to matter except near river mouths and',
              'melting ice.',
            ),
          },
          {
            id: 'ls4-c04',
            speakerId: 'lecturer',
            answersQuestions: [33],
            text: line(
              'Now picture a column of water running from the surface downwards. At the top it is',
              'warm, so sound travels quickly. As you descend, the temperature falls away',
              'sharply, and the speed of sound falls with it. But temperature can only fall so',
              'far: below a certain depth the water is uniformly cold, close to freezing, and',
              'stops getting colder. The weight of water overhead, on the other hand, goes on',
              'increasing all the way to the sea floor, so below that depth the speed begins to',
              'climb again. What you have, therefore, is a minimum — a depth at which sound',
              'travels more slowly than it does anywhere above or below it. In the middle',
              'latitudes that minimum sits at roughly one thousand metres down.',
            ),
          },
          {
            id: 'ls4-c05',
            speakerId: 'lecturer',
            answersQuestions: [34],
            text: line(
              'And here is the useful part. Sound refracts towards whatever is slower. A ray that',
              'strays upwards out of the minimum enters faster water and is bent back down; a ray',
              'that strays downwards enters faster water and is bent back up. The result is that',
              'sound put into that layer is trapped inside it. Instead of spreading out in three',
              'dimensions and fading, it spreads in two, rather like ripples in a pipe, and it',
              'can travel for thousands of kilometres.',
            ),
          },
          {
            id: 'ls4-c06',
            speakerId: 'lecturer',
            answersQuestions: [35, 36, 37],
            text: line(
              'This was worked out in the nineteen-forties. The name most associated with it is',
              'the American geophysicist Maurice Ewing, who proposed the channel and then, with',
              'colleagues, demonstrated it experimentally during the Second World War. The system',
              'built on it was called SOFAR, which stands for Sound Fixing and Ranging. The idea',
              'was simple and rather brilliant. A pilot forced down at sea carried a small',
              'explosive charge, set to detonate at the depth of the channel. Listening stations',
              'on opposite sides of an ocean would each note the moment the sound arrived, and',
              'from those arrival times the pilot’s position could be calculated.',
            ),
          },
          {
            id: 'ls4-c07',
            speakerId: 'lecturer',
            answersQuestions: [38, 39],
            text: line(
              'The animals, of course, had got there a very long time earlier. Fin whales and blue',
              'whales produce calls at around twenty hertz — right at the bottom edge of human',
              'hearing, and low enough to travel a very long way with little loss. In the',
              'nineteen-seventies it was suggested that before industrial shipping these calls',
              'might have crossed an entire ocean basin, so that a whale off Newfoundland could',
              'in principle be heard off Ireland. I should be careful here. Whether whales ever',
              'did communicate at those ranges is still disputed, and the honest answer is that',
              'we do not know what an animal was doing with a signal we can measure but cannot',
              'interpret.',
            ),
          },
          {
            id: 'ls4-c08',
            speakerId: 'lecturer',
            answersQuestions: [40],
            text: line(
              'What is not disputed is what has happened to the channel since. The background',
              'level in exactly the band those calls occupy has been raised by shipping. Propeller',
              'noise sits in the same low frequencies, and there are now something like a hundred',
              'thousand large vessels at sea at any moment.',
            ),
          },
          {
            id: 'ls4-c09',
            speakerId: 'lecturer',
            text: line(
              'And one last complication worth remembering: the channel is not everywhere. At',
              'high latitudes, where the surface water is already close to freezing, there is no',
              'warm layer sitting above the minimum. The minimum rises to the surface, and the',
              'channel as I have described it effectively disappears.',
            ),
          },
          {
            id: 'ls4-c10',
            speakerId: 'narrator',
            pauseBeforeSec: 2,
            text: line(
              'That is the end of Section Four. You now have ten minutes to check your answers',
              'and transfer them to the answer sheet.',
            ),
          },
        ],
      },
    },
  ],

  /* ----------------------------- question groups ---------------------------- */

  groups: [
    {
      id: 'ls-g1',
      sectionIndex: 0,
      from: 1,
      to: 8,
      format: 'form-completion',
      heading: 'HARBOUR VIEW COTTAGES — BOOKING ENQUIRY',
      instruction: 'Complete the form below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.',
    },
    {
      id: 'ls-g2',
      sectionIndex: 0,
      from: 9,
      to: 10,
      format: 'multiple-choice',
      instruction: 'Choose the correct answer.',
    },
    {
      id: 'ls-g3',
      sectionIndex: 1,
      from: 11,
      to: 14,
      format: 'multiple-choice',
      instruction: 'Choose the correct answer.',
    },
    {
      id: 'ls-g4',
      sectionIndex: 1,
      from: 15,
      to: 20,
      format: 'map-labelling',
      heading: 'PLAN OF ASHCOMBE RESERVOIR — described positions A–H',
      instruction:
        'Label the plan below. Choose the correct position from the list and write the correct letter, A–H, for each answer. Positions are described in words because this app ships no images.',
    },
    {
      id: 'ls-g5',
      sectionIndex: 2,
      from: 21,
      to: 25,
      format: 'matching',
      heading: 'Dr Awan’s comment on each section of the draft',
      instruction:
        'What comment does Dr Awan make about each section of the draft report? Choose the correct comment from the list, A–G. You may use each comment once only.',
    },
    {
      id: 'ls-g6',
      sectionIndex: 2,
      from: 26,
      to: 28,
      format: 'multiple-choice',
      instruction: 'Choose the correct answer.',
    },
    {
      id: 'ls-g7',
      sectionIndex: 2,
      from: 29,
      to: 30,
      format: 'short-answer',
      instruction: 'Answer the questions below. Write NO MORE THAN THREE WORDS for each answer.',
    },
    {
      id: 'ls-g8',
      sectionIndex: 3,
      from: 31,
      to: 40,
      format: 'note-completion',
      heading: 'THE DEEP SOUND CHANNEL',
      instruction: 'Complete the notes below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.',
    },
  ],

  /* -------------------------------- questions ------------------------------- */

  questions: [
    /* ---------------------- section 1: Q1–8 form completion ---------------------- */
    {
      id: 'ls-q01',
      number: 1,
      sectionIndex: 0,
      type: 'completion',
      format: 'form-completion',
      maxWords: 2,
      prompt: 'Name: Petra ____________',
      answers: ['Lindqvist'],
      explanation: 'Petra spells the surname out: L-I-N-D-Q-V-I-S-T, with no U after the Q.',
    },
    {
      id: 'ls-q02',
      number: 2,
      sectionIndex: 0,
      type: 'completion',
      format: 'form-completion',
      maxWords: 2,
      prompt: 'Email: petra.lindqvist@ ____________ .co.uk',
      answers: ['brookmill'],
      explanation: 'She spells the domain: B-R-O-O-K-M-I-L-L, the school she teaches at.',
    },
    {
      id: 'ls-q03',
      number: 3,
      sectionIndex: 0,
      type: 'completion',
      format: 'form-completion',
      maxWords: 2,
      prompt: 'Arrival date: ____________ September',
      answers: ['14', '14th', 'fourteenth'],
      explanation: '“We’d come down on the fourteenth of September.”',
    },
    {
      id: 'ls-q04',
      number: 4,
      sectionIndex: 0,
      type: 'completion',
      format: 'form-completion',
      maxWords: 2,
      prompt: 'Number of nights: ____________',
      answers: ['5', 'five'],
      explanation:
        'The original plan was a week, but her husband cannot travel until the Wednesday, so it is five nights, not seven.',
    },
    {
      id: 'ls-q05',
      number: 5,
      sectionIndex: 0,
      type: 'completion',
      format: 'form-completion',
      maxWords: 2,
      prompt: 'Party: 4 adults and 1 child aged ____________',
      answers: ['6', 'six'],
      explanation: '“She’s six. She’s happy anywhere as long as there’s a window.”',
    },
    {
      id: 'ls-q06',
      number: 6,
      sectionIndex: 0,
      type: 'completion',
      format: 'form-completion',
      maxWords: 2,
      prompt: 'Cottage booked: ____________',
      answers: ['Sanderling'],
      explanation:
        'She takes the cheaper of the two, and Ross spells it: S-A-N-D-E-R-L-I-N-G. Curlew is the one with the better view.',
    },
    {
      id: 'ls-q07',
      number: 7,
      sectionIndex: 0,
      type: 'completion',
      format: 'form-completion',
      maxWords: 2,
      prompt: 'Total cost of the stay: £ ____________',
      answers: ['680'],
      explanation:
        'Sanderling is £680 for the five nights. £745 is Curlew, which she does not take.',
    },
    {
      id: 'ls-q08',
      number: 8,
      sectionIndex: 0,
      type: 'completion',
      format: 'form-completion',
      maxWords: 2,
      prompt: 'Extra charge per dog: £ ____________',
      answers: ['15', 'fifteen'],
      explanation: '“Fifteen pounds per dog for the stay.” The £8 is the cot, which she declines.',
    },

    /* ------------------- section 1: Q9–10 multiple choice --------------------- */
    {
      id: 'ls-q09',
      number: 9,
      sectionIndex: 0,
      type: 'multiple-choice',
      format: 'multiple-choice',
      prompt: 'To hold the booking today, Petra must pay',
      options: [
        'the full cost of the stay',
        'a quarter of the cost of the stay',
        'nothing until six weeks before she arrives',
        'a fixed deposit of one hundred pounds',
      ],
      answers: ['a quarter of the cost of the stay'],
      explanation:
        '“Twenty-five per cent today to hold the booking, and the rest six weeks before you arrive.”',
    },
    {
      id: 'ls-q10',
      number: 10,
      sectionIndex: 0,
      type: 'multiple-choice',
      format: 'multiple-choice',
      prompt: 'What does Ross say about the bakery on Fore Street?',
      options: [
        'It is closed early in the week.',
        'It has usually sold out by mid-morning.',
        'It is a long drive from the cottage.',
        'It does not open until nine.',
      ],
      answers: ['It has usually sold out by mid-morning.'],
      explanation:
        'It opens at seven and by about nine there is nothing left but a few rolls — so nine is the selling-out time, not the opening time.',
    },

    /* ------------------- section 2: Q11–14 multiple choice -------------------- */
    {
      id: 'ls-q11',
      number: 11,
      sectionIndex: 1,
      type: 'multiple-choice',
      format: 'multiple-choice',
      prompt: 'Why was Ashcombe Reservoir originally built?',
      options: [
        'to supply drinking water to a nearby town',
        'to drive the machinery of local mills',
        'to reduce flooding in the valley',
        'to create a place for the public to visit',
      ],
      answers: ['to supply drinking water to a nearby town'],
      explanation:
        'Built in 1904 for Marsden, ten miles east. The wildlife — and the visitors — came afterwards and by accident.',
    },
    {
      id: 'ls-q12',
      number: 12,
      sectionIndex: 1,
      type: 'multiple-choice',
      format: 'multiple-choice',
      prompt: 'What has changed at the reservoir this year?',
      options: [
        'A footpath now runs all the way round the lake.',
        'Dogs are banned from one part of the site in spring and summer.',
        'The charge for parking has been removed.',
        'The visitor centre now opens seven days a week.',
      ],
      answers: ['Dogs are banned from one part of the site in spring and summer.'],
      explanation:
        'The northern shore is closed to dogs from 1 March to the end of July, because three species nest on the ground there.',
    },
    {
      id: 'ls-q13',
      number: 13,
      sectionIndex: 1,
      type: 'multiple-choice',
      format: 'multiple-choice',
      prompt: 'Why does Deborah tell visitors not to swim?',
      options: [
        'The water is polluted.',
        'There are strong currents near the dam.',
        'The water is very cold and gets deep immediately.',
        'Swimming disturbs the nesting birds.',
      ],
      answers: ['The water is very cold and gets deep immediately.'],
      explanation:
        'She rules pollution out in terms — the water is clean. The danger is the vertical shelf a metre from the edge and the cold below it.',
    },
    {
      id: 'ls-q14',
      number: 14,
      sectionIndex: 1,
      type: 'multiple-choice',
      format: 'multiple-choice',
      prompt: 'What should a visitor do on finding an injured bird?',
      options: [
        'carry it to the visitor centre',
        'telephone the number shown on the green signs',
        'leave that part of the site at once',
        'report it to a member of the café staff',
      ],
      answers: ['telephone the number shown on the green signs'],
      explanation: 'Handling does more damage than the injury; ring the number and a warden comes out.',
    },

    /* -------------------- section 2: Q15–20 plan labelling -------------------- */
    {
      id: 'ls-q15',
      number: 15,
      sectionIndex: 1,
      type: 'multiple-choice',
      format: 'map-labelling',
      prompt: 'The bird hide',
      options: S2_PLAN,
      answers: ['on the grass between the visitor centre and the boat house'],
      explanation: 'The low wooden building with no windows on the side facing the centre.',
    },
    {
      id: 'ls-q16',
      number: 16,
      sectionIndex: 1,
      type: 'multiple-choice',
      format: 'map-labelling',
      prompt: 'The children’s play area',
      options: S2_PLAN,
      answers: ['beside the entrance barrier, at the top of the car park'],
      explanation:
        'At the top of the car park, by the barrier. The far end of the car park is the recycling point.',
    },
    {
      id: 'ls-q17',
      number: 17,
      sectionIndex: 1,
      type: 'multiple-choice',
      format: 'map-labelling',
      prompt: 'The sailing club’s jetty',
      options: S2_PLAN,
      answers: ['on the dam wall, at its eastern end'],
      explanation: 'The club has the use of the dam wall; the jetty is at its eastern end.',
    },
    {
      id: 'ls-q18',
      number: 18,
      sectionIndex: 1,
      type: 'multiple-choice',
      format: 'map-labelling',
      prompt: 'The picnic meadow',
      options: S2_PLAN,
      answers: ['at the southern end of the lake, beyond the reed beds'],
      explanation: 'Twenty minutes on foot, past the reed beds. The café terrace is the nearer option.',
    },
    {
      id: 'ls-q19',
      number: 19,
      sectionIndex: 1,
      type: 'multiple-choice',
      format: 'map-labelling',
      prompt: 'The wildlife pond',
      options: S2_PLAN,
      answers: ['in the woodland, off the yellow trail'],
      explanation: 'A small pond dug for amphibians — not the reservoir itself.',
    },
    {
      id: 'ls-q20',
      number: 20,
      sectionIndex: 1,
      type: 'multiple-choice',
      format: 'map-labelling',
      prompt: 'The memorial stone',
      options: S2_PLAN,
      answers: ['on the island, across the footbridge'],
      explanation: 'Over the footbridge, on the far side of the island, facing the dam.',
    },

    /* ---------------------- section 3: Q21–25 matching ------------------------ */
    {
      id: 'ls-q21',
      number: 21,
      sectionIndex: 2,
      type: 'multiple-choice',
      format: 'matching',
      prompt: 'The introduction',
      options: S3_COMMENTS,
      answers: ['It is too long for what it says.'],
      explanation: 'Three pages that can be summarised in one sentence. Cut to one page.',
    },
    {
      id: 'ls-q22',
      number: 22,
      sectionIndex: 2,
      type: 'multiple-choice',
      format: 'matching',
      prompt: 'The literature review',
      options: S3_COMMENTS,
      answers: ['The evidence in it is out of date.'],
      explanation:
        'Well organised, but nothing cited after 2014, and two large national studies have appeared since.',
    },
    {
      id: 'ls-q23',
      number: 23,
      sectionIndex: 2,
      type: 'multiple-choice',
      format: 'matching',
      prompt: 'The methods section',
      options: S3_COMMENTS,
      answers: ['It is the strongest part of the draft.'],
      explanation: 'The part she would show next year’s students, because it says what could not be weighed.',
    },
    {
      id: 'ls-q24',
      number: 24,
      sectionIndex: 2,
      type: 'multiple-choice',
      format: 'matching',
      prompt: 'The results section',
      options: S3_COMMENTS,
      answers: ['It repeats material that belongs in another section.'],
      explanation: 'Every figure is interpreted here and then interpreted again in the discussion.',
    },
    {
      id: 'ls-q25',
      number: 25,
      sectionIndex: 2,
      type: 'multiple-choice',
      format: 'matching',
      prompt: 'The discussion',
      options: S3_COMMENTS,
      answers: ['It needs a clearer link to the research question.'],
      explanation:
        'Interesting but unfollowable: by page four it is about supermarket packaging rather than portion size and plate waste.',
    },

    /* ------------------- section 3: Q26–28 multiple choice -------------------- */
    {
      id: 'ls-q26',
      number: 26,
      sectionIndex: 2,
      type: 'multiple-choice',
      format: 'multiple-choice',
      prompt: 'What does Dr Awan suggest the students do to improve their data?',
      options: [
        'collect measurements for a second week',
        'include one more hall of residence',
        'repeat the whole study next term',
        'ask students about their eating habits',
      ],
      answers: ['include one more hall of residence'],
      explanation:
        'She rejects the second week — the halls are empty by then — and asks for breadth instead: one more hall over the same three days.',
    },
    {
      id: 'ls-q27',
      number: 27,
      sectionIndex: 2,
      type: 'multiple-choice',
      format: 'multiple-choice',
      prompt: 'What went wrong during the first week of measurements?',
      options: [
        'The kitchen staff refused to take part.',
        'A bin was moved to a different room.',
        'A bin was emptied before it could be weighed.',
        'The scales gave inconsistent readings.',
      ],
      answers: ['A bin was emptied before it could be weighed.'],
      explanation:
        'The evening shift emptied the plate-scrape bin on the Wednesday. Joanna says explicitly that they were not being obstructive.',
    },
    {
      id: 'ls-q28',
      number: 28,
      sectionIndex: 2,
      type: 'multiple-choice',
      format: 'multiple-choice',
      prompt: 'What must Rafi do before the next meeting?',
      options: [
        'rewrite the introduction',
        'redraw the graphs',
        'contact the catering manager',
        'read the two recent national studies',
      ],
      answers: ['read the two recent national studies'],
      explanation:
        'The introduction is “a morning’s work with a red pen”; the reading is the part that changes what he thinks.',
    },

    /* --------------------- section 3: Q29–30 short answer --------------------- */
    {
      id: 'ls-q29',
      number: 29,
      sectionIndex: 2,
      type: 'completion',
      format: 'short-answer',
      maxWords: 3,
      prompt: 'What must the students add to every graph in the report?',
      answers: ['the sample size', 'sample size', 'sample sizes'],
      explanation: '“A bar chart without an n is a picture, not evidence.” The caption is an acceptable place for it.',
    },
    {
      id: 'ls-q30',
      number: 30,
      sectionIndex: 2,
      type: 'completion',
      format: 'short-answer',
      maxWords: 3,
      prompt: 'What does Dr Awan ask the students to bring to the next meeting?',
      answers: ['a one-page plan', 'one-page plan', 'one page plan'],
      explanation: 'Section headings with one line under each saying what goes in it.',
    },

    /* ------------------- section 4: Q31–40 note completion -------------------- */
    {
      id: 'ls-q31',
      number: 31,
      sectionIndex: 3,
      type: 'completion',
      format: 'note-completion',
      maxWords: 2,
      prompt: 'Sound in seawater travels at about 1,500 m/s — more than ____________ times as fast as in air.',
      answers: ['four', '4'],
      explanation: 'About 1,500 m/s in seawater against roughly 340 m/s in air.',
    },
    {
      id: 'ls-q32',
      number: 32,
      sectionIndex: 3,
      type: 'completion',
      format: 'note-completion',
      maxWords: 2,
      prompt: 'The speed is increased by temperature, ____________ and salinity.',
      answers: ['pressure'],
      explanation:
        'The lecturer lists temperature, salinity and pressure; the notes reorder them, so copying the next word heard does not work.',
    },
    {
      id: 'ls-q33',
      number: 33,
      sectionIndex: 3,
      type: 'completion',
      format: 'note-completion',
      maxWords: 2,
      prompt: 'In the middle latitudes the sound-speed minimum lies about ____________ metres down.',
      answers: ['1,000', '1000', 'one thousand'],
      explanation: 'Below it the water stops getting colder while the weight of water above keeps rising.',
    },
    {
      id: 'ls-q34',
      number: 34,
      sectionIndex: 3,
      type: 'completion',
      format: 'note-completion',
      maxWords: 2,
      prompt: 'Because sound bends towards slower water, sound in the channel is ____________.',
      answers: ['trapped'],
      explanation: 'Rays straying up or down enter faster water and are bent back, so the sound spreads in two dimensions.',
    },
    {
      id: 'ls-q35',
      number: 35,
      sectionIndex: 3,
      type: 'completion',
      format: 'note-completion',
      maxWords: 2,
      prompt: 'Proposed in the 1940s by the American geophysicist Maurice ____________.',
      answers: ['Ewing'],
      explanation: 'Ewing proposed the channel and demonstrated it with colleagues during the Second World War.',
    },
    {
      id: 'ls-q36',
      number: 36,
      sectionIndex: 3,
      type: 'completion',
      format: 'note-completion',
      maxWords: 2,
      prompt: 'The system was named SOFAR — Sound Fixing and ____________.',
      answers: ['Ranging'],
      explanation: 'Spelled out in the lecture as Sound Fixing and Ranging.',
    },
    {
      id: 'ls-q37',
      number: 37,
      sectionIndex: 3,
      type: 'completion',
      format: 'note-completion',
      maxWords: 2,
      prompt: 'A pilot down at sea carried a small ____________, set to go off at the depth of the channel.',
      answers: ['explosive charge', 'charge'],
      explanation: 'Listening stations on either side of the ocean timed its arrival to fix the pilot’s position.',
    },
    {
      id: 'ls-q38',
      number: 38,
      sectionIndex: 3,
      type: 'completion',
      format: 'note-completion',
      maxWords: 2,
      prompt: 'Fin whales and blue whales call at around ____________ hertz.',
      answers: ['20', 'twenty'],
      explanation: 'At the bottom edge of human hearing, and low enough to carry a long way.',
    },
    {
      id: 'ls-q39',
      number: 39,
      sectionIndex: 3,
      type: 'completion',
      format: 'note-completion',
      maxWords: 2,
      prompt: 'Whether such calls ever crossed a whole ocean basin is still ____________.',
      answers: ['disputed'],
      explanation:
        'The lecturer flags this as the one contested claim: the signal can be measured but not interpreted.',
    },
    {
      id: 'ls-q40',
      number: 40,
      sectionIndex: 3,
      type: 'completion',
      format: 'note-completion',
      maxWords: 2,
      prompt: 'The background level in that frequency band has been raised by ____________.',
      answers: ['shipping', 'ships'],
      explanation: 'Propeller noise sits in the same low frequencies, and there are around 100,000 large vessels at sea.',
    },
  ],
}
