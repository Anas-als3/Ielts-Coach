/**
 * Listening Test 2 — four sections, forty questions, thirty minutes.
 * The second authored paper; format validated by test 1 (plan 011).
 *
 * ## Copyright and provenance
 *
 * | Section | Material | Source | Licence |
 * |---|---|---|---|
 * | 1 | Westbrook Ice Arena party booking call | Original script written for this project | Original work of this project |
 * | 2 | Millbrook Playhouse volunteer induction | Original script written for this project | Original work of this project |
 * | 3 | Market oral-history project tutorial | Original script written for this project | Original work of this project |
 * | 4 | Lecture: the urban heat island | Original script written for this project | Original work of this project |
 *
 * **Nothing in this file is reproduced from any IELTS publisher.** Real exam
 * recordings, transcripts and question sets are University of Cambridge (UCLES)
 * copyright and cannot ship in an outward-facing app. The FORMAT is not
 * copyrightable, so this test follows the real paper's structure — four
 * sections, forty questions, a rising difficulty curve, the exam's own question
 * types — with every word of script and every item written from scratch for
 * this project. Places, people, prices and institutions are invented; the
 * factual content of Section 4 is general knowledge about urban climate stated
 * in this project's own words, with figures kept round (Luke Howard's London
 * measurements are a matter of historical record; the ten-degree night-time
 * difference is the round figure the literature quotes for large cities under
 * calm, clear conditions).
 *
 * ## Structure
 *
 * | Section | Context | Questions | Formats |
 * |---|---|---|---|
 * | 1 | Two speakers, everyday transaction | 1–10 | form completion ×7, short answer ×3 |
 * | 2 | Monologue, everyday social | 11–20 | multiple choice ×5, plan labelling ×5 |
 * | 3 | Three speakers, education | 21–30 | matching ×6, multiple choice ×4 |
 * | 4 | Monologue, academic lecture | 31–40 | note completion ×10 |
 *
 * A deliberately different mix from test 1 (which runs form ×8 / MC ×9 /
 * plan ×6 / matching ×5 / short answer ×2 / note ×10), while still covering
 * every format the plan asks Listening to cover. Difficulty rises the way the
 * real paper's does: Section 1 answers arrive in the order the form asks for
 * them, Section 2 requires holding five positions against a bank of eight while
 * three heard positions are wrong, Section 3 requires tracking who took which
 * task when both students volunteer for the same ones, and Section 4 is
 * uninterrupted academic prose in which the notes reorder and reword what the
 * lecturer says, so copying the next noun does not work.
 *
 * ## Item-writing rules obeyed here
 *
 *  - No answer appears elsewhere in its own question block. The Section 4
 *    notes say "warmth" where the lecture says "heat" specifically to keep
 *    Q35's answer out of the block that asks for it, and avoid the word
 *    "night" everywhere outside the gap that wants it.
 *  - Every multiple-choice, matching and plan-labelling key is one of its own
 *    options, and every completion key fits its own word limit.
 *  - Every distractor is heard in the recording. The ninth of June, the
 *    fourteen invitations, the Blades package at sixteen pounds, the ticket
 *    printer's room, the flooded basement and the locked roof terrace all
 *    exist and are all wrong; Dr Voss rules the market hall and the university
 *    out in so many words.
 *  - **Every key is complete in the renderings of its own answer.** The marker
 *    never guesses at equivalence, so anything an examiner would accept has to
 *    be written down here: a number in figures and in words, and — where the
 *    paper preprints a unit or a currency symbol beside the gap — the answer
 *    with that unit repeated and without it. A form is listed only if it stays
 *    inside the question's own word limit.
 *
 * `tests/listening-marking.test.ts` enforces the mechanical half of that list,
 * and `tests/answer-key-lint.test.ts` runs the completeness lint over every
 * completion key below.
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
    id: 'leonie',
    label: 'LEONIE',
    description: 'the ice rink’s bookings assistant',
    voice: { gender: 'female', accent: 'en-AU' },
  },
  {
    id: 'stefan',
    label: 'STEFAN',
    description: 'the caller',
    voice: { gender: 'male', accent: 'en-GB' },
  },
]

/* ================================ section 2 ================================= */

const S2_SPEAKERS: ListeningSpeaker[] = [
  NARRATOR,
  {
    id: 'martin',
    label: 'MARTIN',
    description: 'the theatre’s volunteer coordinator',
    voice: { gender: 'male', accent: 'en-NZ' },
  },
]

/**
 * The described plan for questions 16–20.
 *
 * The app ships no images, so the plan is described in words rather than drawn
 * — the same honest text-only rendering test 1 uses, and the UI says so.
 * Letters are the array positions, A–H.
 *
 * Eight positions, five of them used. B, E and H are all heard in the talk and
 * are all wrong: B is the ticket printer's room, E is where the volunteers'
 * room used to be before the river flooded it, and H is locked until the
 * railing is repaired. That is what makes the bank do any work.
 */
const S2_PLAN: string[] = [
  'immediately inside the main entrance, on the left',
  'behind the box office, at the foot of the stairs',
  'on the first floor at the front, overlooking the street',
  'on the first floor at the back, beside the fire escape',
  'in the basement, directly under the stage',
  'across the courtyard, in the old stable block',
  'at the end of the corridor past the dressing rooms',
  'on the roof terrace',
]

/* ================================ section 3 ================================= */

const S3_SPEAKERS: ListeningSpeaker[] = [
  NARRATOR,
  {
    id: 'voss',
    label: 'DR VOSS',
    description: 'the tutor',
    voice: { gender: 'male', accent: 'en-US' },
  },
  {
    id: 'marta',
    label: 'MARTA',
    description: 'a student',
    voice: { gender: 'female', accent: 'en-GB' },
  },
  {
    id: 'callum',
    label: 'CALLUM',
    description: 'a student',
    voice: { gender: 'male', accent: 'en-GB' },
  },
]

/**
 * The people bank for questions 21–26. Three options, each usable more than
 * once — the printed instruction says so. The misdirection is that both
 * students offer to take tasks they do not end up with: Marta starts to
 * volunteer for the equipment and is talked out of it, and Callum turns the
 * transcription down after it is dangled at him, so a learner following
 * first mentions rather than decisions is caught.
 */
const S3_PEOPLE: string[] = ['Marta', 'Callum', 'both Marta and Callum']

/* ================================ section 4 ================================= */

const S4_SPEAKERS: ListeningSpeaker[] = [
  NARRATOR,
  {
    id: 'lecturer',
    label: 'LECTURER',
    description: 'the lecturer',
    voice: { gender: 'female', accent: 'en-GB', rate: 0.97 },
  },
]

/* =================================== test =================================== */

export const LISTENING_TEST_02: ListeningTest = {
  id: 'listening-02',
  title: 'Listening Test 2',

  /* ------------------------------- sections -------------------------------- */

  sections: [
    {
      id: 'listening-02-s1',
      number: 1,
      heading: 'Section 1',
      rubric:
        'You will hear a man telephoning an ice rink to arrange a birthday party for his daughter.',
      context: 'social-transactional',
      source: ORIGINAL,
      transcript: {
        speakers: S1_SPEAKERS,
        cues: [
          {
            id: 'lt2s1-c01',
            speakerId: 'narrator',
            text: line(
              'Section One. You will hear a man telephoning an ice rink to arrange a birthday',
              'party for his daughter. First, you have some time to look at questions one to ten.',
            ),
          },
          {
            id: 'lt2s1-c02',
            speakerId: 'leonie',
            pauseBeforeSec: 30,
            text: 'Westbrook Ice Arena, good afternoon — Leonie speaking.',
          },
          {
            id: 'lt2s1-c03',
            speakerId: 'stefan',
            text: line(
              'Oh, hello. I’d like to book a children’s birthday party, please. My daughter has',
              'been to two parties at your rink this spring, and apparently nowhere else will do',
              'now.',
            ),
          },
          {
            id: 'lt2s1-c04',
            speakerId: 'leonie',
            text: 'That’s usually how it starts. I’ll take the details now, shall I? Your name first.',
          },
          { id: 'lt2s1-c05', speakerId: 'stefan', text: 'Yes — Stefan Adeyemi.' },
          { id: 'lt2s1-c06', speakerId: 'leonie', text: 'Would you spell the surname for me?' },
          {
            id: 'lt2s1-c07',
            speakerId: 'stefan',
            answersQuestions: [1],
            text: line(
              'A - D - E - Y - E - M - I. People always want to put a J in the middle of it,',
              'but it’s a Y.',
            ),
          },
          {
            id: 'lt2s1-c08',
            speakerId: 'leonie',
            text: 'A - D - E - Y - E - M - I, with a Y. Thank you. And what date did you have in mind?',
          },
          {
            id: 'lt2s1-c09',
            speakerId: 'stefan',
            answersQuestions: [2],
            text: line(
              'Her actual birthday is the ninth of June, but that’s a school day, so we’d like',
              'the Saturday afterwards — the twelfth.',
            ),
          },
          {
            id: 'lt2s1-c10',
            speakerId: 'leonie',
            text: 'The twelfth of June… yes, the afternoon slot is still free, two o’clock until four.',
          },
          { id: 'lt2s1-c11', speakerId: 'stefan', text: 'That’s the one.' },
          {
            id: 'lt2s1-c12',
            speakerId: 'leonie',
            text: 'How many children will be coming? We do need at least eight to make up a party.',
          },
          {
            id: 'lt2s1-c13',
            speakerId: 'stefan',
            answersQuestions: [3],
            text: 'Invitations went out to fourteen, three have already said no, so let’s say eleven.',
          },
          {
            id: 'lt2s1-c14',
            speakerId: 'leonie',
            text: line(
              'Eleven. If it moves by one or two on the day, nobody minds. Now, food. Each party',
              'gets the rink-side room for tea afterwards. It used to be a choice of hot dogs or',
              'pizza, but I’m afraid the hot dogs are finished — the machine broke in February',
              'and nobody grieved.',
            ),
          },
          { id: 'lt2s1-c15', speakerId: 'stefan', text: 'Pizza is safer anyway.' },
          {
            id: 'lt2s1-c16',
            speakerId: 'leonie',
            answersQuestions: [4],
            text: line(
              'Pizza for everyone, then — and afterwards they all get ice cream. We serve it in a',
              'little plastic skating boot, which the children find far funnier than it deserves.',
            ),
          },
          {
            id: 'lt2s1-c17',
            speakerId: 'stefan',
            text: 'They’ll love that. Now, I was told there’s more than one kind of party?',
          },
          {
            id: 'lt2s1-c18',
            speakerId: 'leonie',
            text: line(
              'Two packages. The Blades package is for confident skaters — it includes a',
              'half-hour lesson with one of our coaches, and it’s sixteen pounds a child. For',
              'six- and seven-year-olds, though, I’d steer you towards the Penguin package: they',
              'each get one of the plastic penguins to push around the ice, which is easier and,',
              'frankly, funnier.',
            ),
          },
          {
            id: 'lt2s1-c19',
            speakerId: 'stefan',
            answersQuestions: [5],
            text: 'Oh, the penguins, no question. She’d take a penguin over a lesson every time.',
          },
          {
            id: 'lt2s1-c20',
            speakerId: 'leonie',
            answersQuestions: [6],
            text: 'The Penguin package it is. That one’s thirteen pounds a child, and the food is all included.',
          },
          { id: 'lt2s1-c21', speakerId: 'stefan', text: 'Good. Do you need money now?' },
          {
            id: 'lt2s1-c22',
            speakerId: 'leonie',
            answersQuestions: [7],
            text: line(
              'A deposit of forty pounds holds the date, and you settle the rest on the day',
              'itself, once we know the final number of children.',
            ),
          },
          { id: 'lt2s1-c23', speakerId: 'stefan', text: 'Fine — I can do that by card now.' },
          {
            id: 'lt2s1-c24',
            speakerId: 'leonie',
            text: line(
              'In a moment, yes. First, three things worth putting on the invitations, because',
              'they save tears at the door.',
            ),
          },
          {
            id: 'lt2s1-c25',
            speakerId: 'leonie',
            answersQuestions: [8],
            text: line(
              'The big one is gloves. Nobody goes on the ice without gloves — any gloves, woolly',
              'ones are fine — and there is always one child who arrives without them. We do',
              'sell them at the desk for three pounds, but it’s a silly way to spend three',
              'pounds.',
            ),
          },
          { id: 'lt2s1-c26', speakerId: 'stefan', text: 'Capital letters on the invitation. Understood.' },
          {
            id: 'lt2s1-c27',
            speakerId: 'leonie',
            answersQuestions: [9],
            text: line(
              'Second, the grown-ups. Parents are very welcome to stay, and they don’t pay — but',
              'we don’t let them crowd along the barrier, because it blocks the exits. There’s a',
              'balcony running right round above the ice, and you can see everything from up',
              'there. Between us, the coffee machine on the balcony is also the good one.',
            ),
          },
          { id: 'lt2s1-c28', speakerId: 'stefan', text: 'Even better.' },
          {
            id: 'lt2s1-c29',
            speakerId: 'leonie',
            answersQuestions: [10],
            text: line(
              'And a nice thing to finish on: at the end of the session our coach gathers the',
              'whole party together on the ice for a photograph, and we print a copy for the',
              'birthday child to take home. That one costs nothing — it comes with the package.',
            ),
          },
          {
            id: 'lt2s1-c30',
            speakerId: 'stefan',
            text: 'She’ll have it framed by teatime. Right — shall I read you the card number?',
          },
          { id: 'lt2s1-c31', speakerId: 'leonie', text: 'Go ahead whenever you’re ready.' },
          {
            id: 'lt2s1-c32',
            speakerId: 'narrator',
            pauseBeforeSec: 2,
            text: 'That is the end of Section One. You now have half a minute to check your answers.',
          },
        ],
      },
    },

    {
      id: 'listening-02-s2',
      number: 2,
      heading: 'Section 2',
      rubric:
        'You will hear the volunteer coordinator at a theatre welcoming a group of new volunteers.',
      context: 'social-monologue',
      source: ORIGINAL,
      transcript: {
        speakers: S2_SPEAKERS,
        cues: [
          {
            id: 'lt2s2-c01',
            speakerId: 'narrator',
            pauseBeforeSec: 30,
            text: line(
              'Section Two. You will hear the volunteer coordinator at a theatre welcoming a',
              'group of new volunteers. First, you have some time to look at questions eleven to',
              'fifteen.',
            ),
          },
          {
            id: 'lt2s2-c02',
            speakerId: 'martin',
            pauseBeforeSec: 30,
            text: line(
              'Good evening, everyone, and welcome to the Millbrook Playhouse. I’m Martin, I',
              'look after the volunteers here, and by the end of tonight you’ll know this',
              'building better than most of the actors do.',
            ),
          },
          {
            id: 'lt2s2-c03',
            speakerId: 'martin',
            answersQuestions: [11],
            text: line(
              'A little history first, because audiences ask and it’s embarrassing to be caught',
              'out. Everyone assumes the Playhouse was built as a theatre. It was not. It opened',
              'in nineteen thirty-one as a cinema, and it showed films for more than forty years',
              'before the theatre company moved in. And the dances people’s grandmothers talk',
              'about were never held here either — those were in the assembly rooms next door,',
              'which, confusingly, is the building everyone now swears was the cinema.',
            ),
          },
          {
            id: 'lt2s2-c04',
            speakerId: 'martin',
            answersQuestions: [12],
            text: line(
              'Now, what we need you for. We always want people behind the bar, and the box',
              'office can use help on busy Saturdays. But I’ll be straight with you: bar shifts',
              'fill up in an afternoon, because everybody fancies them. What we are short of —',
              'every night, all season — is ushers. People to welcome the audience, check',
              'tickets and walk them to their seats. If you volunteer for nothing else,',
              'volunteer for that.',
            ),
          },
          {
            id: 'lt2s2-c05',
            speakerId: 'martin',
            answersQuestions: [13],
            text: line(
              'You’ll hear about the big change this season, so let me say it properly: after',
              'two years of raising the money, there is at last a lift running up to the circle.',
              'Until March, anyone who couldn’t manage the stairs was stuck in the stalls. Not',
              'any more. Before you ask — no, the seats have not been replaced; they’re the',
              'originals, everyone complains about them, and they are staying. And the café is',
              'exactly where it has always been, whatever the posters imply.',
            ),
          },
          {
            id: 'lt2s2-c06',
            speakerId: 'martin',
            answersQuestions: [14],
            text: line(
              'What do you get in return? Every shift you work, you see the show — a free',
              'ticket, best unsold seat in the house. What you can’t do is turn up on a night',
              'you’re not working and wave your volunteer badge at the door; it’s been tried,',
              'and it didn’t end well. And no, the free ticket doesn’t stretch to the last-night',
              'party either — that one you buy like everybody else.',
            ),
          },
          {
            id: 'lt2s2-c07',
            speakerId: 'martin',
            answersQuestions: [15],
            text: line(
              'One rule I do enforce. If you can’t make a shift, please don’t ring the office —',
              'the office goes home at five, and the message reaches me the following week. And',
              'please don’t just mention it to whoever’s on duty that evening, because it never',
              'reaches the rota at all. Go to the rota website — every one of you gets a login',
              'tonight. Two clicks, offer the shift up, somebody else takes it. It genuinely',
              'takes a minute.',
            ),
          },
          {
            id: 'lt2s2-c08',
            speakerId: 'narrator',
            pauseBeforeSec: 5,
            text: line(
              'Before you hear the rest of the talk, you have some time to look at questions',
              'sixteen to twenty.',
            ),
          },
          {
            id: 'lt2s2-c09',
            speakerId: 'martin',
            pauseBeforeSec: 30,
            text: line(
              'Right — the tour, without leaving our chairs. You’ve each got the plan of the',
              'building; the letters on it mark the places I’m about to name.',
            ),
          },
          {
            id: 'lt2s2-c10',
            speakerId: 'martin',
            answersQuestions: [16],
            text: line(
              'The cloakroom. Straight through the main entrance and it is immediately on your',
              'left — you cannot miss it, and yet everyone does, because they see the stairs and',
              'assume the cloakroom is tucked in behind the box office. It isn’t: that little',
              'room behind the box office, at the foot of the stairs, is where the ticket',
              'printer lives.',
            ),
          },
          {
            id: 'lt2s2-c11',
            speakerId: 'martin',
            answersQuestions: [17],
            text: line(
              'Your room — the volunteers’ room, where you sign in, leave your bags and drink',
              'heroic quantities of tea — is on the first floor at the back, right beside the',
              'fire escape. It used to be in the basement, directly under the stage, but the',
              'river came in two winters running, so upstairs we went.',
            ),
          },
          {
            id: 'lt2s2-c12',
            speakerId: 'martin',
            answersQuestions: [18],
            text: line(
              'The costume store. When the lift was built we lost the old wardrobe space, so all',
              'the costumes now live across the courtyard, in the old stable block. If a',
              'designer sends you over there, take a coat — it’s beautiful and it’s freezing.',
            ),
          },
          {
            id: 'lt2s2-c13',
            speakerId: 'martin',
            answersQuestions: [19],
            text: line(
              'The rehearsal room is on the first floor at the front, overlooking the street.',
              'You’ll hear it before you find it — when the window’s open, the whole street gets',
              'the sword fights for free.',
            ),
          },
          {
            id: 'lt2s2-c14',
            speakerId: 'martin',
            answersQuestions: [20],
            text: line(
              'And please fix this one in your memory: the first-aid room. Along the corridor',
              'past the dressing rooms, right at the end. Nobody needs it for months, and then',
              'somebody needs it in a hurry.',
            ),
          },
          {
            id: 'lt2s2-c15',
            speakerId: 'martin',
            text: line(
              'The roof terrace, I’m afraid, stays locked until the railing is repaired — so if',
              'a member of the audience asks, the answer is no, however charming they are.',
              'Right: tea, forms, and I’ll see you all on Friday.',
            ),
          },
          {
            id: 'lt2s2-c16',
            speakerId: 'narrator',
            pauseBeforeSec: 2,
            text: 'That is the end of Section Two. You now have half a minute to check your answers.',
          },
        ],
      },
    },

    {
      id: 'listening-02-s3',
      number: 3,
      heading: 'Section 3',
      rubric:
        'You will hear two students, Marta and Callum, planning an oral history project with their tutor, Dr Voss.',
      context: 'educational-conversation',
      source: ORIGINAL,
      transcript: {
        speakers: S3_SPEAKERS,
        cues: [
          {
            id: 'lt2s3-c01',
            speakerId: 'narrator',
            pauseBeforeSec: 30,
            text: line(
              'Section Three. You will hear two students, Marta and Callum, planning an oral',
              'history project with their tutor, Doctor Voss. First, you have some time to look',
              'at questions twenty-one to twenty-six.',
            ),
          },
          {
            id: 'lt2s3-c02',
            speakerId: 'voss',
            pauseBeforeSec: 30,
            text: line(
              'So — the market project. The traders’ hall closes for rebuilding in the autumn,',
              'which gives you one term to record the people who have worked there all their',
              'lives. That is a real deadline, so today we divide the work. Nothing leaves this',
              'room unassigned.',
            ),
          },
          { id: 'lt2s3-c03', speakerId: 'marta', text: 'Suits me. I made a list on the bus.' },
          {
            id: 'lt2s3-c04',
            speakerId: 'voss',
            text: line(
              'Of course you did. First: recorders. The department has four decent ones, and',
              'everybody wants them in the last month of term.',
            ),
          },
          {
            id: 'lt2s3-c05',
            speakerId: 'callum',
            answersQuestions: [21],
            text: 'I’ll book those. I’m in the building on Monday mornings anyway, and the loans desk knows me.',
          },
          { id: 'lt2s3-c06', speakerId: 'marta', text: 'I could—' },
          {
            id: 'lt2s3-c07',
            speakerId: 'callum',
            text: line(
              'You booked them for the museum module and they gave you the one that eats',
              'batteries. The kit is mine.',
            ),
          },
          {
            id: 'lt2s3-c08',
            speakerId: 'voss',
            text: line(
              'Settled. Second: consent. There is a departmental template, but it doesn’t cover',
              'recordings that might go into a public archive, and yours might. It needs',
              'rewriting, not just a new heading.',
            ),
          },
          {
            id: 'lt2s3-c09',
            speakerId: 'marta',
            answersQuestions: [22],
            text: line(
              'I rewrote one last year for the museum interviews — the archivist walked me',
              'through what has to be in it. I’ll draft it this week.',
            ),
          },
          {
            id: 'lt2s3-c10',
            speakerId: 'voss',
            text: line(
              'Good. Show me before anyone signs it. Third: getting the traders to talk to you',
              'at all. There’s a residents’ association that meets over coffee on Thursday',
              'mornings, and half the retired stallholders are in it.',
            ),
          },
          { id: 'lt2s3-c11', speakerId: 'callum', text: 'Shall one of us go along?' },
          {
            id: 'lt2s3-c12',
            speakerId: 'voss',
            answersQuestions: [23],
            text: line(
              'Both of you, together. One student with a clipboard looks like somebody’s',
              'homework; two students who keep coming back looks like the project matters. Go',
              'this Thursday, buy the biscuits, and don’t mention recorders for at least two',
              'visits.',
            ),
          },
          {
            id: 'lt2s3-c13',
            speakerId: 'marta',
            text: 'Understood. And the pilot interview — who writes it up?',
          },
          {
            id: 'lt2s3-c14',
            speakerId: 'voss',
            text: line(
              'Writing up comes later. First somebody has to transcribe it, word for word,',
              'hesitations included.',
            ),
          },
          {
            id: 'lt2s3-c15',
            speakerId: 'callum',
            text: 'I type with two fingers, and one of them is unreliable.',
          },
          {
            id: 'lt2s3-c16',
            speakerId: 'marta',
            answersQuestions: [24],
            text: line(
              'Give it to me. I transcribed for a law firm two summers running — but I’m doing',
              'the pilot only, and after that we split the rest down the middle.',
            ),
          },
          { id: 'lt2s3-c17', speakerId: 'callum', text: 'Agreed. In writing, if you like.' },
          {
            id: 'lt2s3-c18',
            speakerId: 'voss',
            text: line(
              'There’s one job neither of you has thought of. The hall itself is loud — a fish',
              'stall on one side, a man who sharpens knives on the other. If any interviews',
              'happen in there, I want to know the worst case before it ruins a recording.',
            ),
          },
          {
            id: 'lt2s3-c19',
            speakerId: 'callum',
            answersQuestions: [25],
            text: line(
              'I’ll take a recorder down on Saturday morning, when it’s busiest, and capture ten',
              'minutes from a few different corners. If it’s hopeless we’ll know by lunchtime.',
            ),
          },
          {
            id: 'lt2s3-c20',
            speakerId: 'voss',
            answersQuestions: [26],
            text: line(
              'Perfect. Last thing: the project diary. Every pair keeps one, and every year one',
              'student writes the whole thing the night before I collect it. Not this time.',
              'You will each keep your own entries, written separately, and you don’t read each',
              'other’s until the term ends. The disagreements are the most useful part.',
            ),
          },
          {
            id: 'lt2s3-c21',
            speakerId: 'narrator',
            pauseBeforeSec: 5,
            text: 'Now look at questions twenty-seven to thirty.',
          },
          {
            id: 'lt2s3-c22',
            speakerId: 'marta',
            pauseBeforeSec: 30,
            text: line(
              'Can I ask something about technique? I’ve read the handbook chapter, but reading',
              'isn’t doing.',
            ),
          },
          {
            id: 'lt2s3-c23',
            speakerId: 'voss',
            answersQuestions: [27],
            text: line(
              'The handbook is full of warnings about equipment, and the equipment is the least',
              'of it. The real mistake isn’t bad questions either — it’s what students do with',
              'silence. Your interviewee stops talking, and you panic, and you jump straight in',
              'with the next question. Don’t. Count five in your head before you say anything.',
              'The thing they were deciding whether to tell you arrives in that pause, and it is',
              'nearly always the best thing on the tape.',
            ),
          },
          { id: 'lt2s3-c24', speakerId: 'callum', text: 'That’s going to feel like an hour.' },
          { id: 'lt2s3-c25', speakerId: 'voss', text: 'It feels like a week. Do it anyway.' },
          {
            id: 'lt2s3-c26',
            speakerId: 'marta',
            text: 'And is the pilot mostly about checking the recorder settings?',
          },
          {
            id: 'lt2s3-c27',
            speakerId: 'voss',
            answersQuestions: [28],
            text: line(
              'Everyone thinks so, and no. The equipment will behave — it nearly always does.',
              'You’ll reorder your questions afterwards, of course, but that isn’t the point of',
              'it either. What the pilot actually teaches you is arithmetic: one hour of',
              'interview is roughly six hours of transcribing, and no student believes that',
              'number until they have lived it. Once you know your own speed, you can decide',
              'how many interviews you can honestly afford.',
            ),
          },
          {
            id: 'lt2s3-c28',
            speakerId: 'callum',
            text: 'Six hours. Right. And where do we actually hold the interviews — in the hall, with the knife man?',
          },
          {
            id: 'lt2s3-c29',
            speakerId: 'voss',
            answersQuestions: [29],
            text: line(
              'Not the hall — you’d fight the noise all day. And not the university either: sit',
              'a seventy-year-old greengrocer in a seminar room and you’ll get an hour of best',
              'behaviour and nothing worth keeping. Go to them. People talk differently at their',
              'own kitchen table, with their own tea, and their photographs within reach.',
            ),
          },
          { id: 'lt2s3-c30', speakerId: 'marta', text: 'Their home ground.' },
          {
            id: 'lt2s3-c31',
            speakerId: 'voss',
            answersQuestions: [30],
            text: line(
              'Exactly. Right — before we meet next week, one task. Interview each other. Twenty',
              'minutes each way, recorded properly, pauses and all. And what you hand me is the',
              'recordings themselves — not your questions, and not a summary. I want to hear the',
              'pair of you learning to shut up.',
            ),
          },
          { id: 'lt2s3-c32', speakerId: 'callum', text: 'That’s fair. Painful, but fair.' },
          {
            id: 'lt2s3-c33',
            speakerId: 'narrator',
            pauseBeforeSec: 2,
            text: 'That is the end of Section Three. You now have half a minute to check your answers.',
          },
        ],
      },
    },

    {
      id: 'listening-02-s4',
      number: 4,
      heading: 'Section 4',
      rubric: 'You will hear part of a lecture about the urban heat island effect.',
      context: 'academic-monologue',
      source: ORIGINAL,
      transcript: {
        speakers: S4_SPEAKERS,
        cues: [
          {
            id: 'lt2s4-c01',
            speakerId: 'narrator',
            pauseBeforeSec: 30,
            text: line(
              'Section Four. You will hear part of a lecture about the urban heat island effect.',
              'First, you have some time to look at questions thirty-one to forty.',
            ),
          },
          {
            id: 'lt2s4-c02',
            speakerId: 'lecturer',
            pauseBeforeSec: 45,
            text: line(
              'Good morning. Drive out of any large city on a summer evening, and somewhere past',
              'the last of the suburbs you will feel the air change. Step out of the car and it',
              'is unmistakable: the fields are cooler than the streets you left behind. The',
              'thermometer agrees with you, and the difference has a name — the urban heat',
              'island. A city, in effect, manufactures its own climate. This morning I want to',
              'look at how we know the effect is real, what causes it, and what can sensibly be',
              'done about it.',
            ),
          },
          {
            id: 'lt2s4-c03',
            speakerId: 'lecturer',
            answersQuestions: [31, 32],
            text: line(
              'The discovery is older than you might expect. In the eighteen-twenties, an',
              'amateur meteorologist named Luke Howard — a pharmaceutical chemist by trade, and',
              'incidentally the man who gave the clouds the names we still use — set',
              'thermometers up inside London and compared their readings, year after year, with',
              'instruments kept in the open country beyond the edge of the city. London came out',
              'warmer, and it came out warmer consistently. And he noticed the detail that still',
              'organises the whole subject: the difference was modest by day and at its largest',
              'at night. Nearly everything discovered since is a footnote to that observation.',
            ),
          },
          {
            id: 'lt2s4-c04',
            speakerId: 'lecturer',
            answersQuestions: [33],
            text: line(
              'So what causes it? Begin underfoot. Asphalt — that near-black material we surface',
              'our roads with — reflects almost none of the sunlight that falls on it. Through',
              'the day it drinks heat in, and after sunset it spends hours paying that heat back',
              'out into the streets. A meadow hands its warmth back quickly and is cool soon',
              'after midnight; a car park is still warm at dawn.',
            ),
          },
          {
            id: 'lt2s4-c05',
            speakerId: 'lecturer',
            answersQuestions: [34],
            text: line(
              'Second, geometry. The ground cools at night by radiating its heat to the sky.',
              'Stand in an open field and the whole dome of the sky is above you. Stand at the',
              'bottom of a street of six-storey buildings and you can see only a narrow ribbon',
              'of it; the walls block the escape route, and much of what one wall radiates is',
              'simply caught by the wall opposite and handed straight back.',
            ),
          },
          {
            id: 'lt2s4-c06',
            speakerId: 'lecturer',
            answersQuestions: [35],
            text: line(
              'Third, we warm the place ourselves. Every engine, every boiler, every air',
              'conditioner pumps waste heat into the streets — and the air conditioner is the',
              'ironic case, because the cooler we insist on being indoors, the more heat the',
              'machines throw out of the back of the building.',
            ),
          },
          {
            id: 'lt2s4-c07',
            speakerId: 'lecturer',
            answersQuestions: [36],
            text: line(
              'And fourth, what a city lacks: plants. A tree does something a lamp post cannot',
              'do. It lifts water out of the soil and releases it from its leaves, and that',
              'evaporation carries heat away with it — precisely what sweating does for the',
              'human body. Pave over the gardens, and you have, in effect, switched off the',
              'city’s perspiration.',
            ),
          },
          {
            id: 'lt2s4-c08',
            speakerId: 'lecturer',
            answersQuestions: [37],
            text: line(
              'Put the four together, and how large is the effect? On a windy or an overcast',
              'night, close to nothing. But when the air is still and the sky is clear, the',
              'centre of a big city can run something like ten degrees warmer than the fields',
              'beyond it — and gaps of that size are measured, not imagined.',
            ),
          },
          {
            id: 'lt2s4-c09',
            speakerId: 'lecturer',
            answersQuestions: [38],
            text: line(
              'Does it matter? In a heatwave it becomes a matter of life and death, and the',
              'reason is the nights. A healthy body will tolerate a hot afternoon provided the',
              'temperature falls after dark, because that is when it recovers. In the middle of',
              'a city, that relief may simply never arrive — the roads and the walls go on',
              'releasing their stored heat until morning — and this is why deaths in a heatwave',
              'pile up so disproportionately in city centres, and among the elderly most of all.',
            ),
          },
          {
            id: 'lt2s4-c10',
            speakerId: 'lecturer',
            answersQuestions: [39, 40],
            text: line(
              'So what can be done? More than you would think, and the first item on the list is',
              'almost embarrassingly cheap: paint. Turn a black roof white, and it reflects most',
              'of the sunshine that would otherwise have been stored — the rooms below it need',
              'noticeably less cooling. Vegetation works at every scale: a line of street trees',
              'shades the road surface by day and quietly sweats for the city all summer. And a',
              'large park does something better still. Cross into one on a hot evening and you',
              'can feel the boundary on your skin: meteorologists call it a cool island — the',
              'heat island’s mirror image, sitting in the middle of the warm city. None of this',
              'is free — trees, notoriously, need watering in exactly the seasons when water is',
              'scarce — but compared with the cost of cooling a hot city by machine, paint and',
              'parks are a bargain.',
            ),
          },
          {
            id: 'lt2s4-c11',
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
      id: 'lt2-g1',
      sectionIndex: 0,
      from: 1,
      to: 7,
      format: 'form-completion',
      heading: 'WESTBROOK ICE ARENA — CHILDREN’S PARTY BOOKING',
      instruction: 'Complete the form below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.',
    },
    {
      id: 'lt2-g2',
      sectionIndex: 0,
      from: 8,
      to: 10,
      format: 'short-answer',
      instruction: 'Answer the questions below. Write NO MORE THAN TWO WORDS for each answer.',
    },
    {
      id: 'lt2-g3',
      sectionIndex: 1,
      from: 11,
      to: 15,
      format: 'multiple-choice',
      instruction: 'Choose the correct answer.',
    },
    {
      id: 'lt2-g4',
      sectionIndex: 1,
      from: 16,
      to: 20,
      format: 'map-labelling',
      heading: 'PLAN OF THE MILLBROOK PLAYHOUSE — described positions A–H',
      instruction:
        'Label the plan below. Choose the correct position from the list and write the correct letter, A–H, for each answer. Positions are described in words because this app ships no images.',
    },
    {
      id: 'lt2-g5',
      sectionIndex: 2,
      from: 21,
      to: 26,
      format: 'matching',
      heading: 'Who will carry out each task?',
      instruction:
        'Who will carry out each of the following tasks? Choose the correct answer from the list, A–C. You may choose any letter more than once.',
    },
    {
      id: 'lt2-g6',
      sectionIndex: 2,
      from: 27,
      to: 30,
      format: 'multiple-choice',
      instruction: 'Choose the correct answer.',
    },
    {
      id: 'lt2-g7',
      sectionIndex: 3,
      from: 31,
      to: 40,
      format: 'note-completion',
      heading: 'THE URBAN HEAT ISLAND',
      instruction: 'Complete the notes below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.',
    },
  ],

  /* -------------------------------- questions ------------------------------- */

  questions: [
    /* ---------------------- section 1: Q1–7 form completion ---------------------- */
    {
      id: 'lt2-q01',
      number: 1,
      sectionIndex: 0,
      type: 'completion',
      format: 'form-completion',
      maxWords: 2,
      prompt: 'Name: Stefan ____________',
      answers: ['Adeyemi'],
      explanation: 'Stefan spells the surname out: A-D-E-Y-E-M-I — a Y in the middle, not a J.',
    },
    {
      id: 'lt2-q02',
      number: 2,
      sectionIndex: 0,
      type: 'completion',
      format: 'form-completion',
      maxWords: 2,
      prompt: 'Date of party: ____________ June',
      answers: ['12', '12th', 'twelfth'],
      explanation:
        'Her birthday is the ninth, a school day, so the party is the Saturday afterwards — the twelfth.',
    },
    {
      id: 'lt2-q03',
      number: 3,
      sectionIndex: 0,
      type: 'completion',
      format: 'form-completion',
      maxWords: 2,
      prompt: 'Number of children: ____________',
      answers: ['11', 'eleven'],
      explanation:
        'Fourteen invitations went out and three children cannot come, so eleven are expected.',
    },
    {
      id: 'lt2-q04',
      number: 4,
      sectionIndex: 0,
      type: 'completion',
      format: 'form-completion',
      maxWords: 2,
      prompt: 'Food: pizza, followed by ____________',
      answers: ['ice cream'],
      explanation:
        'Hot dogs are no longer available; after the pizza the children all get ice cream, served in a plastic skating boot.',
    },
    {
      id: 'lt2-q05',
      number: 5,
      sectionIndex: 0,
      type: 'completion',
      format: 'form-completion',
      maxWords: 2,
      prompt: 'Party package: the ____________ package',
      answers: ['Penguin'],
      explanation:
        'Stefan chooses the Penguin package, with the plastic skating aids. The Blades package, with the lesson, is the one he turns down.',
    },
    {
      id: 'lt2-q06',
      number: 6,
      sectionIndex: 0,
      type: 'completion',
      format: 'form-completion',
      maxWords: 2,
      prompt: 'Cost per child: £ ____________',
      // The form preprints the £, so the learner may or may not write it again,
      // and may spell the unit instead of using the symbol. All are the same
      // quantity and an examiner accepts them all.
      answers: ['13', 'thirteen', '£13', '£ 13', '13 pounds', 'thirteen pounds'],
      explanation:
        'The Penguin package is £13 a child, food included. £16 is the Blades package, which he does not take.',
    },
    {
      id: 'lt2-q07',
      number: 7,
      sectionIndex: 0,
      type: 'completion',
      format: 'form-completion',
      maxWords: 2,
      prompt: 'Deposit payable now: £ ____________',
      // As Q6: numeral and word form, each with the preprinted £ repeated or
      // the unit spelled out.
      answers: ['40', 'forty', '£40', '£ 40', '40 pounds', 'forty pounds'],
      explanation:
        '“A deposit of forty pounds holds the date.” The rest is settled on the day; the £3 is what gloves cost at the desk.',
    },

    /* --------------------- section 1: Q8–10 short answer ---------------------- */
    {
      id: 'lt2-q08',
      number: 8,
      sectionIndex: 0,
      type: 'completion',
      format: 'short-answer',
      maxWords: 2,
      prompt: 'What must every child wear on the ice?',
      answers: ['gloves'],
      explanation: '“Nobody goes on the ice without gloves — any gloves, woolly ones are fine.”',
    },
    {
      id: 'lt2-q09',
      number: 9,
      sectionIndex: 0,
      type: 'completion',
      format: 'short-answer',
      maxWords: 2,
      prompt: 'Where can parents watch the skating from?',
      answers: ['the balcony', 'balcony'],
      explanation:
        'Parents may not crowd the barrier; the balcony runs right round above the ice and has the better coffee machine.',
    },
    {
      id: 'lt2-q10',
      number: 10,
      sectionIndex: 0,
      type: 'completion',
      format: 'short-answer',
      maxWords: 2,
      prompt: 'What free gift will the birthday child take home?',
      answers: ['a photograph', 'photograph', 'a photo', 'photo'],
      explanation:
        'The coach gathers the party on the ice for a photograph and a printed copy goes home with the birthday child, at no charge.',
    },

    /* ------------------- section 2: Q11–15 multiple choice -------------------- */
    {
      id: 'lt2-q11',
      number: 11,
      sectionIndex: 1,
      type: 'multiple-choice',
      format: 'multiple-choice',
      prompt: 'The Playhouse building was first used as',
      options: ['a cinema', 'a dance hall', 'a theatre'],
      answers: ['a cinema'],
      explanation:
        'It opened in 1931 as a cinema. Everyone assumes it was built as a theatre, and the dances were held in the assembly rooms next door.',
    },
    {
      id: 'lt2-q12',
      number: 12,
      sectionIndex: 1,
      type: 'multiple-choice',
      format: 'multiple-choice',
      prompt: 'The theatre most needs volunteers who will',
      options: ['work behind the bar', 'help in the box office', 'show the audience to their seats'],
      answers: ['show the audience to their seats'],
      explanation:
        'Bar shifts fill up in an afternoon and the box office only needs help on Saturdays; ushers are what the theatre is short of every night.',
    },
    {
      id: 'lt2-q13',
      number: 13,
      sectionIndex: 1,
      type: 'multiple-choice',
      format: 'multiple-choice',
      prompt: 'What is new at the theatre this season?',
      options: ['New seats have been fitted.', 'A lift has been installed.', 'The café has moved.'],
      answers: ['A lift has been installed.'],
      explanation:
        'After two years of fundraising there is a lift up to the circle. The seats are the complained-about originals, and the café has not moved.',
    },
    {
      id: 'lt2-q14',
      number: 14,
      sectionIndex: 1,
      type: 'multiple-choice',
      format: 'multiple-choice',
      prompt: 'Volunteers receive a free ticket for',
      options: [
        'each performance they work at',
        'any performance they choose',
        'the last night of every production',
      ],
      answers: ['each performance they work at'],
      explanation:
        'Every shift worked comes with the show and the best unsold seat. Turning up with a badge on other nights has been tried, and the last-night party is not included.',
    },
    {
      id: 'lt2-q15',
      number: 15,
      sectionIndex: 1,
      type: 'multiple-choice',
      format: 'multiple-choice',
      prompt: 'A volunteer who cannot attend a shift should',
      options: [
        'telephone the theatre office',
        'offer the shift on the rota website',
        'tell whoever is on duty that evening',
      ],
      answers: ['offer the shift on the rota website'],
      explanation:
        'Ringing the office reaches Martin a week late, and telling the person on duty never reaches the rota; two clicks on the website and someone else takes the shift.',
    },

    /* -------------------- section 2: Q16–20 plan labelling -------------------- */
    {
      id: 'lt2-q16',
      number: 16,
      sectionIndex: 1,
      type: 'multiple-choice',
      format: 'map-labelling',
      prompt: 'The cloakroom',
      options: S2_PLAN,
      answers: ['immediately inside the main entrance, on the left'],
      explanation:
        'Straight through the main entrance, immediately on the left. The room behind the box office is the ticket printer’s.',
    },
    {
      id: 'lt2-q17',
      number: 17,
      sectionIndex: 1,
      type: 'multiple-choice',
      format: 'map-labelling',
      prompt: 'The volunteers’ room',
      options: S2_PLAN,
      answers: ['on the first floor at the back, beside the fire escape'],
      explanation:
        'First floor at the back, beside the fire escape. The basement under the stage is where it used to be before the river flooded it.',
    },
    {
      id: 'lt2-q18',
      number: 18,
      sectionIndex: 1,
      type: 'multiple-choice',
      format: 'map-labelling',
      prompt: 'The costume store',
      options: S2_PLAN,
      answers: ['across the courtyard, in the old stable block'],
      explanation: 'The costumes moved to the stable block across the courtyard when the lift was built.',
    },
    {
      id: 'lt2-q19',
      number: 19,
      sectionIndex: 1,
      type: 'multiple-choice',
      format: 'map-labelling',
      prompt: 'The rehearsal room',
      options: S2_PLAN,
      answers: ['on the first floor at the front, overlooking the street'],
      explanation: 'First floor at the front, overlooking the street — audible before it is visible.',
    },
    {
      id: 'lt2-q20',
      number: 20,
      sectionIndex: 1,
      type: 'multiple-choice',
      format: 'map-labelling',
      prompt: 'The first-aid room',
      options: S2_PLAN,
      answers: ['at the end of the corridor past the dressing rooms'],
      explanation: 'Along the corridor past the dressing rooms, right at the end.',
    },

    /* ---------------------- section 3: Q21–26 matching ------------------------ */
    {
      id: 'lt2-q21',
      number: 21,
      sectionIndex: 2,
      type: 'multiple-choice',
      format: 'matching',
      prompt: 'book the recording equipment',
      options: S3_PEOPLE,
      answers: ['Callum'],
      explanation:
        'Callum takes the recorders — he is in the building on Mondays and the loans desk knows him. Marta starts to offer and is talked out of it.',
    },
    {
      id: 'lt2-q22',
      number: 22,
      sectionIndex: 2,
      type: 'multiple-choice',
      format: 'matching',
      prompt: 'prepare the consent form',
      options: S3_PEOPLE,
      answers: ['Marta'],
      explanation:
        'Marta rewrote a consent form for the museum interviews last year, so she drafts this one for Dr Voss to check.',
    },
    {
      id: 'lt2-q23',
      number: 23,
      sectionIndex: 2,
      type: 'multiple-choice',
      format: 'matching',
      prompt: 'visit the residents’ association',
      options: S3_PEOPLE,
      answers: ['both Marta and Callum'],
      explanation:
        '“Both of you, together” — one student looks like homework, two who keep coming back look like the project matters.',
    },
    {
      id: 'lt2-q24',
      number: 24,
      sectionIndex: 2,
      type: 'multiple-choice',
      format: 'matching',
      prompt: 'transcribe the pilot interview',
      options: S3_PEOPLE,
      answers: ['Marta'],
      explanation:
        'Callum types with two fingers; Marta transcribed for a law firm and takes the pilot — the pilot only.',
    },
    {
      id: 'lt2-q25',
      number: 25,
      sectionIndex: 2,
      type: 'multiple-choice',
      format: 'matching',
      prompt: 'make a test recording in the market hall',
      options: S3_PEOPLE,
      answers: ['Callum'],
      explanation:
        'Callum will take a recorder to the hall on Saturday morning, at its busiest, and record from several corners.',
    },
    {
      id: 'lt2-q26',
      number: 26,
      sectionIndex: 2,
      type: 'multiple-choice',
      format: 'matching',
      prompt: 'keep a project diary',
      options: S3_PEOPLE,
      answers: ['both Marta and Callum'],
      explanation:
        'Each student keeps their own entries, written separately and unread by the other until the term ends.',
    },

    /* ------------------- section 3: Q27–30 multiple choice -------------------- */
    {
      id: 'lt2-q27',
      number: 27,
      sectionIndex: 2,
      type: 'multiple-choice',
      format: 'multiple-choice',
      prompt: 'According to Dr Voss, the commonest mistake in a first interview is',
      options: [
        'asking unsuitable questions',
        'rushing to fill a silence',
        'forgetting to check the equipment',
      ],
      answers: ['rushing to fill a silence'],
      explanation:
        'Not the equipment and not bad questions: students panic when the interviewee stops and jump straight in. Count five — the best material arrives in the pause.',
    },
    {
      id: 'lt2-q28',
      number: 28,
      sectionIndex: 2,
      type: 'multiple-choice',
      format: 'multiple-choice',
      prompt: 'Dr Voss says the real value of a pilot interview is finding out',
      options: [
        'whether the recorder settings are right',
        'which questions need reordering',
        'how long transcription really takes',
      ],
      answers: ['how long transcription really takes'],
      explanation:
        'The equipment will behave and the question order gets fixed anyway; the pilot teaches the arithmetic — one hour of interview is about six hours of transcribing.',
    },
    {
      id: 'lt2-q29',
      number: 29,
      sectionIndex: 2,
      type: 'multiple-choice',
      format: 'multiple-choice',
      prompt: 'Where does Dr Voss say the interviews should take place?',
      options: [
        'in the interviewees’ own homes',
        'in the market hall',
        'at the university',
      ],
      answers: ['in the interviewees’ own homes'],
      explanation:
        'The hall is ruled out for noise and the university for stiffness; people talk differently at their own kitchen table.',
    },
    {
      id: 'lt2-q30',
      number: 30,
      sectionIndex: 2,
      type: 'multiple-choice',
      format: 'multiple-choice',
      prompt: 'Before the next meeting, the students must give Dr Voss',
      options: [
        'a set of interview questions',
        'recordings of a practice interview',
        'a written summary of the handbook chapter',
      ],
      answers: ['recordings of a practice interview'],
      explanation:
        'They interview each other, twenty minutes each way, and hand in the recordings themselves — not the questions and not a summary.',
    },

    /* ------------------- section 4: Q31–40 note completion -------------------- */
    {
      id: 'lt2-q31',
      number: 31,
      sectionIndex: 3,
      type: 'completion',
      format: 'note-completion',
      maxWords: 2,
      prompt: 'In the 1820s, Luke Howard’s thermometer readings showed ____________ to be warmer than the open country nearby.',
      answers: ['London'],
      explanation:
        'Howard set thermometers inside London and compared them, year after year, with instruments in the open country beyond the city.',
    },
    {
      id: 'lt2-q32',
      number: 32,
      sectionIndex: 3,
      type: 'completion',
      format: 'note-completion',
      maxWords: 2,
      prompt: 'The gap between town and country temperatures is widest at ____________, not in the middle of the day.',
      answers: ['night', 'night-time', 'night time', 'nighttime'],
      explanation:
        'Howard’s still-organising detail: the difference was modest by day and at its largest at night.',
    },
    {
      id: 'lt2-q33',
      number: 33,
      sectionIndex: 3,
      type: 'completion',
      format: 'note-completion',
      maxWords: 2,
      prompt: 'Dark materials such as ____________ soak up sunshine by day and give it back after dark.',
      answers: ['asphalt'],
      explanation:
        'Asphalt reflects almost none of the sunlight that falls on it, then spends hours after sunset paying the stored heat back out.',
    },
    {
      id: 'lt2-q34',
      number: 34,
      sectionIndex: 3,
      type: 'completion',
      format: 'note-completion',
      maxWords: 2,
      prompt: 'From a narrow street only a small strip of ____________ can be seen, so warmth drains away slowly after dark.',
      answers: ['sky', 'the sky'],
      explanation:
        'The ground cools by radiating to the sky; between tall buildings only a narrow ribbon of it is visible and the walls hand the warmth back.',
    },
    {
      id: 'lt2-q35',
      number: 35,
      sectionIndex: 3,
      type: 'completion',
      format: 'note-completion',
      maxWords: 2,
      prompt: 'Vehicles, factories and air conditioners release ____________ of their own into the streets.',
      answers: ['waste heat', 'heat'],
      explanation:
        'Every engine, boiler and air conditioner pumps waste heat into the streets — the air conditioner being the ironic case.',
    },
    {
      id: 'lt2-q36',
      number: 36,
      sectionIndex: 3,
      type: 'completion',
      format: 'note-completion',
      maxWords: 2,
      prompt: 'Through evaporation, a plant cools the air around it just as ____________ cools human skin.',
      answers: ['sweating', 'sweat', 'perspiration'],
      explanation:
        'A tree lifts water from the soil and releases it from its leaves; the evaporation carries heat away, precisely as sweating does for the body.',
    },
    {
      id: 'lt2-q37',
      number: 37,
      sectionIndex: 3,
      type: 'completion',
      format: 'note-completion',
      maxWords: 2,
      // "degrees" is printed next to the gap, so a learner may repeat it; both
      // forms stay inside the two-word limit and are listed.
      prompt: 'In calm, clear weather the difference can reach roughly ____________ degrees.',
      answers: ['10', 'ten', '10 degrees', 'ten degrees'],
      explanation:
        'On a still, clear night a big city centre can run something like ten degrees warmer than the fields beyond it.',
    },
    {
      id: 'lt2-q38',
      number: 38,
      sectionIndex: 3,
      type: 'completion',
      format: 'note-completion',
      maxWords: 2,
      prompt: 'Where the streets stay warm until morning, the body gets no chance to ____________.',
      answers: ['recover'],
      explanation:
        'A body tolerates a hot afternoon provided the temperature falls after dark — that is when it recovers, and in a city centre the relief may never arrive.',
    },
    {
      id: 'lt2-q39',
      number: 39,
      sectionIndex: 3,
      type: 'completion',
      format: 'note-completion',
      maxWords: 2,
      prompt: 'A cheap remedy: giving a roof a ____________ surface so that sunshine is reflected, not stored.',
      answers: ['white'],
      explanation:
        'The first item on the list is paint: a black roof turned white reflects most of the sunshine and the rooms below need less cooling.',
    },
    {
      id: 'lt2-q40',
      number: 40,
      sectionIndex: 3,
      type: 'completion',
      format: 'note-completion',
      maxWords: 2,
      prompt: 'A big park creates a cool ____________ of its own inside the city.',
      answers: ['island'],
      explanation:
        'Meteorologists call it a cool island — the heat island’s mirror image, and you can feel its boundary on a hot evening.',
    },
  ],
}
