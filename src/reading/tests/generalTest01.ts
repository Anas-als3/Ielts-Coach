/**
 * General Training Reading Test 1 — three sections, forty questions, sixty
 * minutes. Implements plan 010 "Content: one General Training test".
 *
 * ## Sources and licences
 *
 * | Section | Text | Source | Licence |
 * |---|---|---|---|
 * | 1 | Riverbank Community Centre: autumn courses | Original prose written for this project | Original work of this project |
 * | 1 | Notice to residents: kerbside collections | Original prose written for this project | Original work of this project |
 * | 1 | Northline Ferry: winter service | Original prose written for this project | Original work of this project |
 * | 2 | Assistant Harbour Coordinator (job advertisement) | Original prose written for this project | Original work of this project |
 * | 2 | Staff handbook: hours, leave and overtime | Original prose written for this project | Original work of this project |
 * | 3 | The Return of the Night Train | Original prose written for this project | Original work of this project |
 *
 * **No text in this file is reproduced from any IELTS publisher.** Every
 * organisation named here — Riverbank Community Centre, Northline Ferry,
 * Kestrel Bay Harbour Trust — is invented for this test, as are the prices,
 * timetables and conditions.
 *
 * ## Why this is shaped differently from the Academic test
 *
 * General Training Reading is not "Academic with easier passages". The paper
 * has a different structure, and the app has to author to it:
 *
 *  - **Section 1 — social survival**: two or three SHORT texts, the kind a
 *    person reads to get through a week: adverts, notices, a timetable.
 *  - **Section 2 — workplace**: two texts about employment, here a job
 *    advertisement and an extract from a staff handbook.
 *  - **Section 3 — general interest**: one longer continuous text, the only
 *    part that resembles an Academic passage.
 *
 * That is why `ReadingPassage.texts` is a list: an Academic passage holds one
 * text, a General Training section holds up to three.
 *
 * ## Question distribution
 *
 * completion 10 · true/false/not given 8 · matching information 6 ·
 * matching headings 6 · multiple choice 6 · yes/no/not given 4 = 40.
 */
import type { ReadingHeading, ReadingTest } from '../types'

/** Join authored lines into one paragraph. Keeps prose readable in source. */
const prose = (...lines: string[]): string => lines.join(' ')

/** Section 1 labels every paragraph across all three texts, A–H. */
const S1_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

const S3_HEADINGS: ReadingHeading[] = [
  { id: 'i', text: 'Competing with a hotel as well as an airline' },
  { id: 'ii', text: 'Why the trains disappeared' },
  { id: 'iii', text: 'The obstacles that borders still create' },
  { id: 'iv', text: 'An unexpected reversal of fortune' },
  { id: 'v', text: 'Designing for sleep rather than for capacity' },
  { id: 'vi', text: 'Where night trains make sense, and where they do not' },
  { id: 'vii', text: 'The environmental case against flying' },
  { id: 'viii', text: 'Timetables built around business travellers' },
  { id: 'ix', text: 'How fares are calculated' },
]

export const GENERAL_TEST_01: ReadingTest = {
  id: 'reading-general-01',
  module: 'general',
  title: 'General Training Reading Test 1',
  passages: [
    /* --------------------------------- section 1 -------------------------------- */
    {
      id: 'reading-general-01-s1',
      number: 1,
      heading: 'Section 1',
      source: {
        description: 'Original prose written for this project. All organisations, prices and timetables are invented.',
        licence: 'Original work of this project',
      },
      texts: [
        {
          title: 'Riverbank Community Centre — Autumn Courses',
          subtitle: 'Booking opens 1 September at reception or by telephone.',
          paragraphs: [
            {
              label: 'A',
              text: prose(
                'Beginners’ Woodwork. Tuesdays, 7.00–9.00pm, eight weeks from 24 September. £60,',
                'which includes all materials; hand tools are provided and do not need to be',
                'bought. No previous experience is expected. For safety reasons this course is',
                'open only to those aged 16 and over.',
              ),
            },
            {
              label: 'B',
              text: prose(
                'Conversational Spanish. Wednesdays, 6.30–8.00pm, ten weeks from 25 September.',
                '£75. Taught entirely in Spanish by a native speaker. This is not a beginners’',
                'class: you should have studied the language for at least a year, or be able to',
                'hold a simple conversation. Group size is limited to 8.',
              ),
            },
            {
              label: 'C',
              text: prose(
                'Digital Photography Walks. Saturdays, 10.00am–1.00pm, six sessions from 28',
                'September. £48. Bring a camera or a phone — either is fine. Sessions take place',
                'outdoors and go ahead in all weather, so dress for the conditions. We meet at the',
                'centre gate, not in reception.',
              ),
            },
            {
              label: 'D',
              text: prose(
                'Chair-Based Exercise. Mondays and Thursdays, 11.00am–12.00 noon, all term. Free',
                'to anyone aged 65 or over; £3 a session for everyone else. No need to book — just',
                'come along. Wear comfortable clothing and bring a bottle of water.',
              ),
            },
            {
              label: 'E',
              text: prose(
                'Choir for All. Thursdays, 7.30–9.00pm, term fee £30. There is no audition and no',
                'need to read music; sheet music is provided and lent for the term. The choir gives',
                'a public concert in the hall on the last Thursday of term. Singers under 14 must be',
                'accompanied by an adult.',
              ),
            },
          ],
        },
        {
          title: 'Notice to Residents — Changes to Kerbside Collections',
          paragraphs: [
            {
              label: 'F',
              text: prose(
                'From 1 October, general waste will be collected fortnightly, on Wednesdays,',
                'instead of every week. Recycling will continue to be collected every week, also on',
                'Wednesdays. Please place bins at the kerb by 6.30am on collection day. Bins must be',
                'returned to your property by 8.00pm and may not be left on the pavement overnight.',
              ),
            },
            {
              label: 'G',
              text: prose(
                'Garden waste is a subscription service costing £45 a year; collections are',
                'suspended from December to February inclusive and resume in March. Food waste',
                'caddies are collected every week throughout the year, including over the winter.',
                'Free caddy liners are available from the library.',
              ),
            },
          ],
        },
        {
          title: 'Northline Ferry — Winter Service',
          paragraphs: [
            {
              label: 'H',
              text: prose(
                'Between 1 November and 31 March the ferry runs four sailings a day rather than',
                'six, and the last sailing of the day leaves at 18:15. The 07:00 sailing carries',
                'foot passengers only; the vehicle deck is closed on that crossing for loading.',
                'Tickets bought on board cost £2 more than tickets bought online in advance.',
                'Bicycles are carried free of charge. Dogs are welcome but must be kept on a lead.',
              ),
            },
          ],
        },
      ],
    },

    /* --------------------------------- section 2 -------------------------------- */
    {
      id: 'reading-general-01-s2',
      number: 2,
      heading: 'Section 2',
      source: {
        description: 'Original prose written for this project. The employer, salary and conditions are invented.',
        licence: 'Original work of this project',
      },
      texts: [
        {
          title: 'Assistant Harbour Coordinator — Kestrel Bay Harbour Trust',
          paragraphs: [
            {
              label: 'A',
              text: prose(
                'The role. You will support the Harbour Master in allocating berths, managing',
                'visitor moorings and keeping the radio watch during opening hours. The post is 37',
                'hours a week, averaged over the year, and includes weekend and early-morning work',
                'on a rota. You will be based at the Harbour Office.',
              ),
            },
            {
              label: 'B',
              text: prose(
                'What you need. Essential: a VHF radio operator’s certificate, the ability to swim',
                '100 metres unaided, and a full driving licence. Desirable: experience of handling',
                'small boats, and a current first-aid certificate. The Trust will fund a first-aid',
                'certificate for the successful candidate if they do not already hold one.',
              ),
            },
            {
              label: 'C',
              text: prose(
                'Pay and conditions. The salary is £26,400, rising to £28,900 on completion of a',
                'probationary period of six months. Annual leave is 25 days plus public holidays.',
                'Uniform and protective clothing are supplied. The Trust matches pension',
                'contributions up to 6% of salary.',
              ),
            },
            {
              label: 'D',
              text: prose(
                'How to apply. Complete the online application form; curriculum vitae sent on their',
                'own cannot be considered. The closing date is 14 March and interviews will be held',
                'in the week beginning 24 March. You will be asked for the details of two referees,',
                'one of whom must be your current or most recent employer. The appointment is',
                'subject to a medical examination.',
              ),
            },
          ],
        },
        {
          title: 'Staff Handbook — Hours, Leave and Overtime',
          paragraphs: [
            {
              label: 'E',
              text: prose(
                'Working hours. Core hours are 10.00 to 15.00, during which all staff are expected',
                'to be available. You may start at any time between 07.30 and 10.00. Hours are',
                'recorded in the online system and you must enter your own; a manager cannot enter',
                'them on your behalf.',
              ),
            },
            {
              label: 'F',
              text: prose(
                'Overtime. All overtime must be approved by your line manager before it is worked.',
                'Extra hours worked without approval are not paid. Approved overtime is paid at',
                'plain time for the first four hours in a week and at time and a half beyond that.',
                'You may take time off in lieu instead of payment, but it must be taken within three',
                'months of the week in which it was earned.',
              ),
            },
            {
              label: 'G',
              text: prose(
                'Annual leave. The allowance is 25 days plus public holidays. After five years’',
                'service the allowance rises by one day for each further year, to a maximum of 30',
                'days. Up to five days may be carried into the next leave year, and carried-over',
                'days must be used by 31 March or they are lost.',
              ),
            },
            {
              label: 'H',
              text: prose(
                'Sickness absence. Telephone your line manager by 09.30 on the first day of',
                'absence; a text message or an email is not sufficient. For an absence of up to',
                'seven calendar days you must complete a self-certification on your return. From',
                'the eighth day a note from a doctor is required instead. A return-to-work',
                'discussion is held after every absence, however short.',
              ),
            },
            {
              label: 'I',
              text: prose(
                'Requesting leave. Give at least two weeks’ notice for any absence of three days or',
                'more. No more than two members of the same team may be on leave at the same time.',
                'Requests for leave in December are decided by ballot, drawn in October, because',
                'demand for that month is always greater than the team can release.',
              ),
            },
          ],
        },
      ],
    },

    /* --------------------------------- section 3 -------------------------------- */
    {
      id: 'reading-general-01-s3',
      number: 3,
      heading: 'Section 3',
      source: {
        description: 'Original prose written for this project',
        licence: 'Original work of this project',
      },
      texts: [
        {
          title: 'The Return of the Night Train',
          paragraphs: [
            {
              label: 'A',
              text: prose(
                'For twenty years the sleeper network of Europe did nothing but shrink. Budget',
                'airlines took the long weekend traffic, high-speed day trains took the business',
                'traffic, and route after route was quietly withdrawn until, in 2016, the German',
                'national operator announced that it was leaving the business altogether. The',
                'reasons were not sentimental. A sleeping car carries a fraction of the passengers',
                'that a seated coach of the same length carries. It needs staff on board all night,',
                'and bedding, and cleaning between journeys. Worst of all, it earns nothing at all',
                'between the morning it arrives and the evening it sets off again, while an ordinary',
                'coach is working all day.',
              ),
            },
            {
              label: 'B',
              text: prose(
                'What happened next surprised nearly everybody. The Austrian operator bought the',
                'withdrawn carriages, refurbished them, and expanded the network instead of',
                'retreating from it. Occupancy rose. New routes opened, and other operators followed.',
                'The revival is usually credited to concern about the climate and to the Swedish word',
                'flygskam, or flight shame, and that is certainly part of the story. But the larger',
                'reason is less romantic. Someone was prepared to buy serviceable rolling stock at',
                'close to scrap value, and to run a connected network rather than a handful of',
                'isolated routes — and a network fills beds that isolated routes leave empty.',
              ),
            },
            {
              label: 'C',
              text: prose(
                'The economics of a bed are not the economics of a seat. A night train sells space',
                'and time together, and it competes with two purchases at once: the air fare and the',
                'hotel bill. A traveller who would pay ninety euros to fly, and a hundred and forty',
                'for a room by the station, is not weighing ninety against two hundred and thirty.',
                'They are weighing two hundred and thirty against whatever the sleeper costs. That',
                'is the sum passengers actually do, and it is why a berth at a hundred and sixty',
                'euros can look like a bargain while a reclining seat at forty looks like a wasted',
                'night.',
              ),
            },
            {
              label: 'D',
              text: prose(
                'Crossing a border remains the hardest part of the job. A train travelling across',
                'Europe meets several electrification systems and several signalling systems.',
                'Locomotives that can handle all of them exist but are expensive, and where they are',
                'not available the locomotive must be changed, which costs time in the middle of the',
                'night. Drivers must be qualified for each country they enter, and the national rules',
                'for sleeping cars differ in details as fine as the fitting of door locks. New',
                'carriages are no quick answer either: a sleeping car costs several times what a day',
                'coach costs, and the queue at the factories is measured in years.',
              ),
            },
            {
              label: 'E',
              text: prose(
                'What passengers want from a night train is not luxury. It is sleep, and sleep is',
                'easily destroyed — by noise, by rough shunting at two in the morning, and by an',
                'arrival timed for ten to six. The newest designs abandon the open six-berth',
                'couchette in favour of small private cabins, some of them barely wider than the bed',
                'they contain. Capacity falls when they do this, and revenue for each passenger',
                'rises. Operators have been slow to accept that trade, and they go on underestimating',
                'how much a traveller will pay for a door that locks.',
              ),
            },
            {
              label: 'F',
              text: prose(
                'It is worth being honest about the limits. Night trains work best over roughly 800',
                'to 1,500 kilometres: far enough that the journey fills a night, close enough that it',
                'does not fill two. Below that a day train is quicker, and above it the sleeper',
                'arrives too late in the day to be useful. They will not replace short-haul flying',
                'wholesale, and pretending otherwise invites the disappointment that follows every',
                'overstated promise. What would help is duller than enthusiasm: track access charges',
                'that do not punish a train for standing still, a booking system that sells one bed',
                'across three operators in one transaction, and public money spent with the patience',
                'that ordering rolling stock demands. That is a modest future. It is also a real one,',
                'and it is worth paying for.',
              ),
            },
          ],
        },
      ],
    },
  ],

  questions: [
    /* ------------------ section 1: Q1–6 matching information ------------------ */
    {
      id: 'gt1-q01',
      number: 1,
      passageIndex: 0,
      type: 'matching-information',
      paragraphLabels: S1_LABELS,
      prompt: 'an activity whose cost depends on the participant’s age',
      answers: ['D'],
      explanation: 'Chair-Based Exercise is free to anyone aged 65 or over and £3 a session for everyone else.',
    },
    {
      id: 'gt1-q02',
      number: 2,
      passageIndex: 0,
      type: 'matching-information',
      paragraphLabels: S1_LABELS,
      prompt: 'a requirement that younger participants be supervised by an adult',
      answers: ['E'],
      explanation: 'Singers under 14 must be accompanied by an adult.',
    },
    {
      id: 'gt1-q03',
      number: 3,
      passageIndex: 0,
      type: 'matching-information',
      paragraphLabels: S1_LABELS,
      prompt: 'a service that costs more if you do not pay in advance',
      answers: ['H'],
      explanation: 'Ferry tickets bought on board cost £2 more than tickets bought online.',
    },
    {
      id: 'gt1-q04',
      number: 4,
      passageIndex: 0,
      type: 'matching-information',
      paragraphLabels: S1_LABELS,
      prompt: 'an activity that takes place whatever the weather',
      answers: ['C'],
      explanation: 'The photography walks are outdoors and go ahead in all weather.',
    },
    {
      id: 'gt1-q05',
      number: 5,
      passageIndex: 0,
      type: 'matching-information',
      paragraphLabels: S1_LABELS,
      prompt: 'a collection that is suspended for part of the year',
      answers: ['G'],
      explanation: 'Garden waste collections are suspended from December to February.',
    },
    {
      id: 'gt1-q06',
      number: 6,
      passageIndex: 0,
      type: 'matching-information',
      paragraphLabels: S1_LABELS,
      prompt: 'a deadline by which containers must be put out',
      answers: ['F'],
      explanation: 'Bins must be at the kerb by 6.30am on collection day.',
    },

    /* ---------------------- section 1: Q7–10 true/false ---------------------- */
    {
      id: 'gt1-q07',
      number: 7,
      passageIndex: 0,
      type: 'true-false-notgiven',
      prompt: 'The woodwork course accepts anyone aged 14 or over.',
      answers: ['FALSE'],
      explanation: 'It is open only to those aged 16 and over.',
    },
    {
      id: 'gt1-q08',
      number: 8,
      passageIndex: 0,
      type: 'true-false-notgiven',
      prompt: 'Complete beginners may join the conversational Spanish class.',
      answers: ['FALSE'],
      explanation: 'It is not a beginners’ class; at least a year of study is expected.',
    },
    {
      id: 'gt1-q09',
      number: 9,
      passageIndex: 0,
      type: 'true-false-notgiven',
      prompt: 'Cyclists pay nothing extra to take a bicycle on the ferry.',
      answers: ['TRUE'],
      explanation: 'Bicycles are carried free of charge.',
    },
    {
      id: 'gt1-q10',
      number: 10,
      passageIndex: 0,
      type: 'true-false-notgiven',
      prompt: 'There is a car park for people attending courses at the community centre.',
      answers: ['NOT GIVEN'],
      explanation: 'Parking at the centre is never mentioned.',
    },

    /* ---------------------- section 1: Q11–14 completion --------------------- */
    {
      id: 'gt1-q11',
      number: 11,
      passageIndex: 0,
      type: 'completion',
      maxWords: 2,
      prompt: 'The Spanish class takes no more than ______ students.',
      answers: ['8', 'eight'],
      explanation: 'Group size is limited to 8.',
    },
    {
      id: 'gt1-q12',
      number: 12,
      passageIndex: 0,
      type: 'completion',
      maxWords: 2,
      prompt: 'From 1 October general waste will be collected ______ rather than weekly.',
      answers: ['fortnightly', 'every fortnight'],
      explanation: 'General waste moves to a fortnightly Wednesday collection.',
    },
    {
      id: 'gt1-q13',
      number: 13,
      passageIndex: 0,
      type: 'completion',
      maxWords: 2,
      prompt: 'Caddy liners can be collected free from the ______.',
      answers: ['library'],
      explanation: 'Free caddy liners are available from the library.',
    },
    {
      id: 'gt1-q14',
      number: 14,
      passageIndex: 0,
      type: 'completion',
      maxWords: 2,
      prompt: 'In winter the last ferry of the day sails at ______.',
      // One time, ten renderings. Both separators (colon and point), both
      // clocks, and — the omission this list was written to close — "pm" spaced
      // as well as closed up, and pointed as well as bare. Nothing here is a
      // different answer; they are the same sailing written the way a learner
      // was taught to write it. "Quarter past six" is not listed: three words
      // against a two-word limit.
      answers: [
        '18:15',
        '18.15',
        '6.15pm',
        '6:15pm',
        '6.15 pm',
        '6:15 pm',
        '6.15p.m.',
        '6:15p.m.',
        '6.15 p.m.',
        '6:15 p.m.',
      ],
      explanation: 'Between 1 November and 31 March the last sailing leaves at 18:15.',
    },

    /* ---------------------- section 2: Q15–20 completion --------------------- */
    {
      id: 'gt1-q15',
      number: 15,
      passageIndex: 1,
      type: 'completion',
      maxWords: 3,
      prompt: 'The Trust will pay for the successful candidate to gain a ______.',
      answers: ['first-aid certificate', 'first aid certificate'],
      explanation: 'The Trust funds a first-aid certificate if the candidate does not already hold one.',
    },
    {
      id: 'gt1-q16',
      number: 16,
      passageIndex: 1,
      type: 'completion',
      maxWords: 3,
      prompt: 'The salary rises on completion of a probationary period of ______.',
      answers: ['six months', '6 months'],
      explanation: 'The salary rises from £26,400 to £28,900 after six months.',
    },
    {
      id: 'gt1-q17',
      number: 17,
      passageIndex: 1,
      type: 'completion',
      maxWords: 3,
      prompt: 'Applicants must give the details of ______ referees.',
      answers: ['two', '2'],
      explanation: 'Two referees are required, one of them the current or most recent employer.',
    },
    {
      id: 'gt1-q18',
      number: 18,
      passageIndex: 1,
      type: 'completion',
      maxWords: 3,
      prompt: 'Staff must record their own hours in the ______.',
      answers: ['online system'],
      explanation: 'A manager cannot enter hours on an employee’s behalf.',
    },
    {
      id: 'gt1-q19',
      number: 19,
      passageIndex: 1,
      type: 'completion',
      maxWords: 3,
      prompt: 'Time off in lieu must be taken within ______ of the week it was earned.',
      answers: ['three months', '3 months'],
      explanation: 'Overtime taken as time off in lieu expires after three months.',
    },
    {
      id: 'gt1-q20',
      number: 20,
      passageIndex: 1,
      type: 'completion',
      maxWords: 3,
      prompt: 'Leave in December is allocated by a ______ held in October.',
      answers: ['ballot'],
      explanation: 'December demand always exceeds what the team can release, so a ballot is drawn.',
    },

    /* --------------------- section 2: Q21–24 true/false ---------------------- */
    {
      id: 'gt1-q21',
      number: 21,
      passageIndex: 1,
      type: 'true-false-notgiven',
      prompt: 'Candidates may apply by sending a curriculum vitae instead of the form.',
      answers: ['FALSE'],
      explanation: 'A curriculum vitae sent on its own cannot be considered.',
    },
    {
      id: 'gt1-q22',
      number: 22,
      passageIndex: 1,
      type: 'true-false-notgiven',
      prompt: 'Overtime worked without prior approval is paid at plain time.',
      answers: ['FALSE'],
      explanation: 'Extra hours worked without approval are not paid at all.',
    },
    {
      id: 'gt1-q23',
      number: 23,
      passageIndex: 1,
      type: 'true-false-notgiven',
      prompt: 'Most staff choose time off in lieu rather than payment for overtime.',
      answers: ['NOT GIVEN'],
      explanation: 'Both options are described; which one staff prefer is never stated.',
    },
    {
      id: 'gt1-q24',
      number: 24,
      passageIndex: 1,
      type: 'true-false-notgiven',
      prompt: 'However long an employee has worked for the organisation, the leave allowance stops at 30 days.',
      answers: ['TRUE'],
      explanation: 'The allowance rises by one day a year after five years’ service, to a maximum of 30 days.',
    },

    /* ------------------------- section 2: Q25–27 MCQ ------------------------- */
    {
      id: 'gt1-q25',
      number: 25,
      passageIndex: 1,
      type: 'multiple-choice',
      prompt: 'Which of the following is essential for the Assistant Harbour Coordinator post?',
      options: [
        'experience of handling small boats',
        'a current first-aid certificate',
        'a VHF radio operator’s certificate',
        'a recognised lifeguard qualification',
      ],
      answers: ['a VHF radio operator’s certificate'],
      explanation: 'Small-boat experience and first aid are listed as desirable, not essential.',
    },
    {
      id: 'gt1-q26',
      number: 26,
      passageIndex: 1,
      type: 'multiple-choice',
      prompt: 'An employee who is ill for five days must',
      options: [
        'obtain a note from a doctor.',
        'complete a self-certification.',
        'take the days as annual leave.',
        'arrange a medical examination.',
      ],
      answers: ['complete a self-certification.'],
      explanation: 'Self-certification covers up to seven calendar days; a doctor’s note is needed from the eighth.',
    },
    {
      id: 'gt1-q27',
      number: 27,
      passageIndex: 1,
      type: 'multiple-choice',
      prompt: 'A member of staff who wants four days’ leave must give notice of at least',
      options: ['three days.', 'one week.', 'two weeks.', 'one month.'],
      answers: ['two weeks.'],
      explanation: 'At least two weeks’ notice is required for any absence of three days or more.',
    },

    /* -------------------- section 3: Q28–33 matching headings ---------------- */
    {
      id: 'gt1-q28',
      number: 28,
      passageIndex: 2,
      type: 'matching-headings',
      paragraph: 'A',
      headings: S3_HEADINGS,
      prompt: 'Paragraph A',
      answers: ['ii'],
      explanation: 'Paragraph A gives the competitive and cost reasons the sleeper network shrank.',
    },
    {
      id: 'gt1-q29',
      number: 29,
      passageIndex: 2,
      type: 'matching-headings',
      paragraph: 'B',
      headings: S3_HEADINGS,
      prompt: 'Paragraph B',
      answers: ['iv'],
      explanation: 'Paragraph B credits cheap second-hand stock and network thinking over flight shame.',
    },
    {
      id: 'gt1-q30',
      number: 30,
      passageIndex: 2,
      type: 'matching-headings',
      paragraph: 'C',
      headings: S3_HEADINGS,
      prompt: 'Paragraph C',
      answers: ['i'],
      explanation: 'Paragraph C sets the berth against the air fare and the hotel bill together.',
    },
    {
      id: 'gt1-q31',
      number: 31,
      passageIndex: 2,
      type: 'matching-headings',
      paragraph: 'D',
      headings: S3_HEADINGS,
      prompt: 'Paragraph D',
      answers: ['iii'],
      explanation: 'Paragraph D is about voltages, signalling, driver qualifications and national rules.',
    },
    {
      id: 'gt1-q32',
      number: 32,
      passageIndex: 2,
      type: 'matching-headings',
      paragraph: 'E',
      headings: S3_HEADINGS,
      prompt: 'Paragraph E',
      answers: ['v'],
      explanation: 'Paragraph E trades capacity for private cabins in order to protect sleep.',
    },
    {
      id: 'gt1-q33',
      number: 33,
      passageIndex: 2,
      type: 'matching-headings',
      paragraph: 'F',
      headings: S3_HEADINGS,
      prompt: 'Paragraph F',
      answers: ['vi'],
      explanation: 'Paragraph F names the distance band where night trains work and admits what they cannot do.',
    },

    /* -------------------------- section 3: Q34–37 YNNG ----------------------- */
    {
      id: 'gt1-q34',
      number: 34,
      passageIndex: 2,
      type: 'yes-no-notgiven',
      prompt: 'Concern about the climate was the main reason the night train returned.',
      answers: ['NO'],
      explanation: 'The writer calls flight shame part of the story but says the larger reason is cheap stock run as a network.',
    },
    {
      id: 'gt1-q35',
      number: 35,
      passageIndex: 2,
      type: 'yes-no-notgiven',
      prompt: 'Operators undervalue how much passengers will pay for privacy.',
      answers: ['YES'],
      explanation: 'They go on underestimating how much a traveller will pay for a door that locks.',
    },
    {
      id: 'gt1-q36',
      number: 36,
      passageIndex: 2,
      type: 'yes-no-notgiven',
      prompt: 'Night trains could take the place of most short-haul flights.',
      answers: ['NO'],
      explanation: 'They will not replace short-haul flying wholesale, and pretending otherwise invites disappointment.',
    },
    {
      id: 'gt1-q37',
      number: 37,
      passageIndex: 2,
      type: 'yes-no-notgiven',
      prompt: 'Railway staff would rather work on night services than on daytime ones.',
      answers: ['NOT GIVEN'],
      explanation: 'Staffing costs are mentioned; what the staff themselves prefer is not.',
    },

    /* -------------------------- section 3: Q38–40 MCQ ------------------------ */
    {
      id: 'gt1-q38',
      number: 38,
      passageIndex: 2,
      type: 'multiple-choice',
      prompt: 'Which cost does the writer treat as peculiar to sleeper trains?',
      options: [
        'the fuel used on a long overnight journey',
        'carriages that earn nothing during the day',
        'higher insurance for services run at night',
        'the fee charged for using a station after midnight',
      ],
      answers: ['carriages that earn nothing during the day'],
      explanation: 'Paragraph A: a sleeping car earns nothing between arrival in the morning and departure at night.',
    },
    {
      id: 'gt1-q39',
      number: 39,
      passageIndex: 2,
      type: 'multiple-choice',
      prompt: 'What does the writer say happens when a multi-system locomotive is not available?',
      options: [
        'Passengers have to change trains at the border.',
        'The locomotive is changed, which costs time at night.',
        'The service is diverted onto a slower route.',
        'The train waits until a driver can be found.',
      ],
      answers: ['The locomotive is changed, which costs time at night.'],
      explanation: 'Paragraph D: locomotives able to handle every system exist but are expensive.',
    },
    {
      id: 'gt1-q40',
      number: 40,
      passageIndex: 2,
      type: 'multiple-choice',
      prompt: 'Which change does the writer call for?',
      options: [
        'faster locomotives on the busiest routes',
        'track access charges that do not penalise a stationary train',
        'a single European operator for all night services',
        'lower fares outside the summer season',
      ],
      answers: ['track access charges that do not penalise a stationary train'],
      explanation: 'Paragraph F: what would help is duller than enthusiasm — charges, through-ticketing and patient public money.',
    },
  ],
}
