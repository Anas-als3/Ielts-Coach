/**
 * General Training Reading Test 2 — three sections, forty questions, sixty
 * minutes. The second General Training paper, following the format plan 010
 * validated with `generalTest01.ts`.
 *
 * ## Sources and licences
 *
 * | Section | Text | Source | Licence |
 * |---|---|---|---|
 * | 1 | Fairfield Lido: summer season | Original prose written for this project | Original work of this project |
 * | 1 | Westgate Library: new opening arrangements | Original prose written for this project | Original work of this project |
 * | 1 | CityWheels cycle hire: how the scheme works | Original prose written for this project | Original work of this project |
 * | 2 | Starting work at Meadowcroft Garden Centre | Original prose written for this project | Original work of this project |
 * | 2 | Claiming travel and expenses | Original prose written for this project | Original work of this project |
 * | 3 | Mending Things | Original prose written for this project | Original work of this project |
 *
 * **No text in this file is reproduced from any IELTS publisher.** Every
 * organisation named here — Fairfield Lido, Westgate Library, CityWheels,
 * Meadowcroft Garden Centre — is invented for this test, as are the prices,
 * timetables and conditions.
 *
 * Structure follows the real General Training paper, as `generalTest01.ts`
 * explains at length: Section 1 is two or three short social-survival texts,
 * Section 2 is two workplace texts, Section 3 is one long general-interest
 * text — which is why `ReadingPassage.texts` is a list.
 *
 * ## Question distribution
 *
 * matching information 5 · true/false/not given 7 · completion 11 ·
 * multiple choice 7 · matching headings 5 · yes/no/not given 5 = 40.
 *
 * Deliberately a different balance from Test 1 (completion 10, TFNG 8,
 * matching information 6, matching headings 6, MCQ 6, YNNG 4): real papers
 * vary the mix between sittings.
 */
import type { ReadingHeading, ReadingTest } from '../types'

/** Join authored lines into one paragraph. Keeps prose readable in source. */
const prose = (...lines: string[]): string => lines.join(' ')

/** Section 1 labels every paragraph across all three texts, A–H. */
const S1_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

const S3_HEADINGS: ReadingHeading[] = [
  { id: 'i', text: 'Why throwing away came to make financial sense' },
  { id: 'ii', text: 'An afternoon among the menders' },
  { id: 'iii', text: 'Skills that are quietly disappearing' },
  { id: 'iv', text: 'The law starts to take repair’s side' },
  { id: 'v', text: 'What a hall full of volunteers cannot change' },
  { id: 'vi', text: 'More lesson than workshop' },
  { id: 'vii', text: 'The companies that profit from early failure' },
  { id: 'viii', text: 'A movement measured in habits, not tonnes' },
]

export const GENERAL_TEST_02: ReadingTest = {
  id: 'reading-general-02',
  module: 'general',
  title: 'General Training Reading Test 2',
  passages: [
    /* --------------------------------- section 1 -------------------------------- */
    {
      id: 'reading-general-02-s1',
      number: 1,
      heading: 'Section 1',
      source: {
        description: 'Original prose written for this project. All organisations, prices and timetables are invented.',
        licence: 'Original work of this project',
      },
      texts: [
        {
          title: 'Fairfield Lido — Summer Season',
          subtitle: 'The outdoor pool is open every day from 1 June to 14 September.',
          paragraphs: [
            {
              label: 'A',
              text: prose(
                'Opening hours. The lido opens at 6.00am for lane swimming and stays open',
                'until 8.45pm. Last entry is one hour before closing. The pool is open every',
                'day of the week throughout the season, including public holidays. Lifeguards',
                'are on duty at all times when the pool is open.',
              ),
            },
            {
              label: 'B',
              text: prose(
                'Prices. Adults £6, children £3.50, children under five free. Swimmers who',
                'arrive before 9.00am pay the early rate of £4 (adults only). A season ticket',
                'costs £90 for an adult and £45 for a child, and can be bought at the kiosk or',
                'on our website. Season tickets are not refundable once the season has begun.',
              ),
            },
            {
              label: 'C',
              text: prose(
                'Lessons. Children’s swimming lessons run on Saturday mornings in six-week',
                'blocks. Places must be booked online; the kiosk cannot take lesson bookings.',
                'A block costs £42. Fees are refunded only when a place is cancelled at least',
                '48 hours before the first lesson of the block.',
              ),
            },
            {
              label: 'D',
              text: prose(
                'Pool rules. Inflatables are allowed only during designated family sessions',
                'and will be removed by lifeguards when the pool is busy. Lockers take a £1',
                'coin, which is returned when the key is handed back. Glass of any kind is not',
                'permitted anywhere on the site.',
              ),
            },
          ],
        },
        {
          title: 'Westgate Library — New Opening Arrangements',
          paragraphs: [
            {
              label: 'E',
              text: prose(
                'From next month the library will open on Sundays for the first time, from',
                '11.00am to 4.00pm. In exchange, the library will be closed all day on Mondays.',
                'Hours on other days are unchanged. Self-service kiosks allow borrowing and',
                'returning without staff help, and card payments have replaced cash at the',
                'desk.',
              ),
            },
            {
              label: 'F',
              text: prose(
                'The returns chute beside the main entrance is available 24 hours a day, every',
                'day, and items posted into it are checked in the following morning. Reserved',
                'items are kept on the collection shelf for 10 days and then returned to',
                'general lending. Study rooms are free to book and can be reserved for up to',
                'two hours at a time.',
              ),
            },
          ],
        },
        {
          title: 'CityWheels Cycle Hire — How the Scheme Works',
          paragraphs: [
            {
              label: 'G',
              text: prose(
                'Register once in the CityWheels app, then unlock any bike by scanning the',
                'code on its handlebars. The first 30 minutes of every journey are free; after',
                'that you pay £1 for each further half hour. A bike can be kept out for a',
                'maximum of four hours at a time, after which a late fee applies.',
              ),
            },
            {
              label: 'H',
              text: prose(
                'Return your bike to any docking station in the city — it does not have to be',
                'the one you started from. If a bike is damaged or will not ride properly,',
                'press the fault button on the dock when you return it and the cost of that',
                'journey will be credited back to your account. Helmets are not provided, and',
                'riders are encouraged to bring their own. Electric bikes carry an extra',
                'charge, shown in the app before you unlock.',
              ),
            },
          ],
        },
      ],
    },

    /* --------------------------------- section 2 -------------------------------- */
    {
      id: 'reading-general-02-s2',
      number: 2,
      heading: 'Section 2',
      source: {
        description: 'Original prose written for this project. The employer, rates and conditions are invented.',
        licence: 'Original work of this project',
      },
      texts: [
        {
          title: 'Starting Work at Meadowcroft Garden Centre — Seasonal Staff',
          paragraphs: [
            {
              label: 'A',
              text: prose(
                'Rotas. Seasonal staff are employed from March to September. Rotas are posted',
                'on the staff noticeboard two weeks before they take effect, and shift swaps',
                'are allowed provided the duty manager approves them in advance. Weekend work',
                'is shared equally across the team.',
              ),
            },
            {
              label: 'B',
              text: prose(
                'Uniform. The centre provides two polo shirts and a fleece; you supply your',
                'own plain black trousers. Safety boots are required in the yard and the',
                'plant nursery. A pair is issued on your first day and remains the property',
                'of the centre — hand them in when you leave.',
              ),
            },
            {
              label: 'C',
              text: prose(
                'Training. Everyone completes manual-handling training on their first morning,',
                'before starting any other work. Till training happens during your first week.',
                'Forklifts are driven only by staff who hold a licence and have written',
                'authorisation from the site manager; no other member of staff should touch',
                'them, even to move one a short distance.',
              ),
            },
            {
              label: 'D',
              text: prose(
                'Pay and breaks. Wages are paid weekly, one week in arrears. A shift of six',
                'hours or more includes an unpaid lunch break of 30 minutes and two paid',
                '15-minute breaks. Staff receive a discount of 20% on plants and tools,',
                'which cannot be used on items already reduced in the seasonal sale.',
              ),
            },
          ],
        },
        {
          title: 'Claiming Travel and Expenses',
          paragraphs: [
            {
              label: 'E',
              text: prose(
                'What can be claimed. Travel between our sites during the working day is',
                'claimable, as are journeys to training courses and to supplier visits',
                'arranged by a manager. Ordinary travel between home and your usual place of',
                'work is not an expense and cannot be claimed in any circumstances.',
              ),
            },
            {
              label: 'F',
              text: prose(
                'How to claim. All claims go through the online portal: photograph each',
                'receipt and attach it to the claim. Paper forms were withdrawn last year and',
                'are no longer accepted. Claims must be submitted within 60 days of the',
                'spending; older claims are returned unpaid, whatever the reason for the',
                'delay.',
              ),
            },
            {
              label: 'G',
              text: prose(
                'Rates. Car mileage is paid at the approved rate per mile shown in the portal.',
                'Rail travel is reimbursed at standard class only, and tickets should be',
                'bought in advance where possible. Taxis are claimable only for journeys',
                'after 10.00pm or when heavy equipment is being carried.',
              ),
            },
            {
              label: 'H',
              text: prose(
                'Approval and payment. Your line manager approves each claim, and approved',
                'amounts are paid with your next salary. Any single claim over £200 needs a',
                'second signature from the finance office before it can be paid.',
              ),
            },
          ],
        },
      ],
    },

    /* --------------------------------- section 3 -------------------------------- */
    {
      id: 'reading-general-02-s3',
      number: 3,
      heading: 'Section 3',
      source: {
        description: 'Original prose written for this project',
        licence: 'Original work of this project',
      },
      texts: [
        {
          title: 'Mending Things',
          paragraphs: [
            {
              label: 'A',
              text: prose(
                'On the third Saturday of every month, a church hall in an ordinary suburb',
                'fills with the broken possessions of strangers: toasters that no longer pop,',
                'lamps that flicker, trousers with failed zips, a laptop that will not charge.',
                'Behind trestle tables sit volunteers with screwdrivers, sewing machines and',
                'soldering irons. This is a repair café, one of thousands that have appeared',
                'around the world since the first opened in Amsterdam in 2009, and for a few',
                'hours it reverses the ordinary direction of modern ownership: things arrive',
                'broken and leave working.',
              ),
            },
            {
              label: 'B',
              text: prose(
                'That this should feel remarkable is itself the story. Within living memory,',
                'repair was simply what one did: shoes were resoled, radios revalved, sheets',
                'turned edge to edge. What changed was arithmetic. The price of new goods fell',
                'and fell while the price of an hour of skilled labour rose, until paying a',
                'person to open a £30 kettle became absurd. Manufacturers followed the logic',
                'to its end, designing products that were glued shut rather than screwed',
                'together, and withholding the spare parts and service manuals that repair',
                'depends on. Households were not being lazy when they threw things away; they',
                'were being rational.',
              ),
            },
            {
              label: 'C',
              text: prose(
                'A repair café does not really compete with the repair trades that remain —',
                'and it is careful not to try, since a hall of volunteers undercutting the',
                'last professional menders in town would be a strange kind of progress. The',
                'distinctive rule is that owners do not drop things off and collect them',
                'later. You sit with the volunteer, hold the torch, and where possible do',
                'part of the work yourself. Well over half of the objects brought in leave',
                'working, but organisers insist the repairs are almost the lesser product:',
                'what the afternoon really manufactures is the knowledge that repair is',
                'possible, and a pot of tea with the neighbours while it happens.',
              ),
            },
            {
              label: 'D',
              text: prose(
                'Look around a repair café, though, and a quieter problem is visible: the',
                'people doing the fixing are mostly grey-haired. Many are retired engineers,',
                'electricians and dressmakers, and the skills at the tables — reading a',
                'circuit, cutting a patch, knowing which screw hides under which label — were',
                'learned in workplaces and school workshops that have largely gone. Schools',
                'dropped repair-adjacent subjects a generation ago, and the manuals that once',
                'shipped in every box are now locked behind service agreements. The movement',
                'runs, in effect, on a stock of knowledge that is no longer being replaced at',
                'the rate it is retiring.',
              ),
            },
            {
              label: 'E',
              text: prose(
                'The law has begun, slowly, to lean the other way. Recent European rules',
                'require the makers of some household appliances to keep spare parts',
                'available for years after a product is sold, and to supply them within a',
                'reasonable time; similar right-to-repair proposals are being argued over',
                'elsewhere. Manufacturers have objected, citing safety and the protection of',
                'their designs, and the rules remain full of exemptions. But the direction of',
                'travel matters: for the first time in decades, repairability is being',
                'treated as a public interest rather than a private inconvenience.',
              ),
            },
            {
              label: 'F',
              text: prose(
                'Honesty requires saying what a monthly afternoon in a church hall cannot do.',
                'The tonnage a repair café diverts from landfill is, by any national measure,',
                'tiny. Some modern devices are genuinely uneconomic to mend, their components',
                'miniaturised past the reach of any volunteer’s soldering iron. And a fixed',
                'toaster does not unmake the system that produced a throwaway toaster in the',
                'first place. Anyone who presents repair cafés as a solution to the waste',
                'problem is setting them up to fail; they are a correction to a habit of',
                'mind, not to a waste stream.',
              ),
            },
            {
              label: 'G',
              text: prose(
                'That may be exactly why they matter. Markets read behaviour, and a public',
                'that queues to mend its belongings is legible to any manufacturer paying',
                'attention: repairability has started appearing in advertising, and products',
                'are once again being scored and sold on how easily they open. The people in',
                'the church hall are not just fixing kettles. They are voting, cheaply and',
                'visibly and in company, for a different idea of what owning something means',
                '— and unlike most votes, this one comes with tea.',
              ),
            },
          ],
        },
      ],
    },
  ],

  questions: [
    /* ------------------ section 1: Q1–5 matching information ------------------ */
    {
      id: 'gt2-q01',
      number: 1,
      passageIndex: 0,
      type: 'matching-information',
      paragraphLabels: S1_LABELS,
      prompt: 'a way of getting your money back when equipment does not work properly',
      answers: ['H'],
      explanation: 'Press the fault button on the dock and the cost of that journey is credited back.',
    },
    {
      id: 'gt2-q02',
      number: 2,
      passageIndex: 0,
      type: 'matching-information',
      paragraphLabels: S1_LABELS,
      prompt: 'a charge that the youngest visitors do not pay',
      answers: ['B'],
      explanation: 'Children under five swim free at the lido.',
    },
    {
      id: 'gt2-q03',
      number: 3,
      passageIndex: 0,
      type: 'matching-information',
      paragraphLabels: S1_LABELS,
      prompt: 'a facility that can be used at any hour of the day or night',
      answers: ['F'],
      explanation: 'The returns chute beside the main entrance is available 24 hours a day, every day.',
    },
    {
      id: 'gt2-q04',
      number: 4,
      passageIndex: 0,
      type: 'matching-information',
      paragraphLabels: S1_LABELS,
      prompt: 'the day of the week on which a service will no longer be available',
      answers: ['E'],
      explanation: 'In exchange for Sunday opening, the library will be closed all day on Mondays.',
    },
    {
      id: 'gt2-q05',
      number: 5,
      passageIndex: 0,
      type: 'matching-information',
      paragraphLabels: S1_LABELS,
      prompt: 'a condition for having the cost of lessons returned',
      answers: ['C'],
      explanation: 'Fees are refunded only when a place is cancelled at least 48 hours before the first lesson.',
    },

    /* ----------------------- section 1: Q6–9 true/false ---------------------- */
    {
      id: 'gt2-q06',
      number: 6,
      passageIndex: 0,
      type: 'true-false-notgiven',
      prompt: 'Children under five are admitted to the lido without charge.',
      answers: ['TRUE'],
      explanation: 'Adults £6, children £3.50, children under five free.',
    },
    {
      id: 'gt2-q07',
      number: 7,
      passageIndex: 0,
      type: 'true-false-notgiven',
      prompt: 'The lido closes one day each week during the season.',
      answers: ['FALSE'],
      explanation: 'It is open every day of the week throughout the season, including public holidays.',
    },
    {
      id: 'gt2-q08',
      number: 8,
      passageIndex: 0,
      type: 'true-false-notgiven',
      prompt: 'The water in the lido is heated.',
      answers: ['NOT GIVEN'],
      explanation: 'The notice covers hours, prices, lessons and rules; the water temperature is never mentioned.',
    },
    {
      id: 'gt2-q09',
      number: 9,
      passageIndex: 0,
      type: 'true-false-notgiven',
      prompt: 'CityWheels supplies a helmet with every bike.',
      answers: ['FALSE'],
      explanation: 'Helmets are not provided, and riders are encouraged to bring their own.',
    },

    /* ---------------------- section 1: Q10–14 completion --------------------- */
    {
      id: 'gt2-q10',
      number: 10,
      passageIndex: 0,
      type: 'completion',
      maxWords: 2,
      prompt: 'In summer the lido stays open until ______.',
      // One time, ten renderings, exactly as gt1-q14 sets out: both separators
      // and both clocks, "pm" spaced and closed up, pointed and bare. The
      // passage prints "8.45pm", so that form is canonical.
      answers: [
        '8.45pm',
        '8:45pm',
        '8.45 pm',
        '8:45 pm',
        '8.45p.m.',
        '8:45p.m.',
        '8.45 p.m.',
        '8:45 p.m.',
        '20:45',
        '20.45',
      ],
      explanation: 'The lido opens at 6.00am and stays open until 8.45pm.',
    },
    {
      id: 'gt2-q11',
      number: 11,
      passageIndex: 0,
      type: 'completion',
      maxWords: 2,
      prompt: 'An adult season ticket costs £ ______.',
      // The £ is preprinted, so the learner writes the figure bare, repeats the
      // symbol, or spells the unit — and the figure has a one-word name, so the
      // word forms are listed too, exactly as ls-q08's key reasons.
      answers: ['90', '£90', '£ 90', '90 pounds', 'ninety', 'ninety pounds'],
      explanation: 'A season ticket costs £90 for an adult and £45 for a child.',
    },
    {
      id: 'gt2-q12',
      number: 12,
      passageIndex: 0,
      type: 'completion',
      maxWords: 2,
      prompt: 'Reserved library items wait on the collection shelf for ______.',
      answers: ['10 days', 'ten days'],
      explanation: 'Reserved items are kept for 10 days and then returned to general lending.',
    },
    {
      id: 'gt2-q13',
      number: 13,
      passageIndex: 0,
      type: 'completion',
      maxWords: 2,
      prompt: 'The first ______ of each bike journey cost nothing.',
      answers: ['30 minutes', 'thirty minutes'],
      explanation: 'The first 30 minutes of every journey are free; after that each half hour costs £1.',
    },
    {
      id: 'gt2-q14',
      number: 14,
      passageIndex: 0,
      type: 'completion',
      maxWords: 2,
      prompt: 'A hired bike must be docked again within ______.',
      answers: ['four hours', '4 hours'],
      explanation: 'A bike can be kept out for a maximum of four hours at a time before a late fee applies.',
    },

    /* ---------------------- section 2: Q15–20 completion --------------------- */
    {
      id: 'gt2-q15',
      number: 15,
      passageIndex: 1,
      type: 'completion',
      maxWords: 2,
      prompt: 'New staff are given two ______ and a fleece to wear at work.',
      answers: ['polo shirts'],
      explanation: 'The centre provides two polo shirts and a fleece; trousers are the employee’s own.',
    },
    {
      id: 'gt2-q16',
      number: 16,
      passageIndex: 1,
      type: 'completion',
      maxWords: 2,
      prompt: 'Rotas go up on the noticeboard ______ before they start.',
      answers: ['two weeks', '2 weeks'],
      explanation: 'Rotas are posted two weeks before they take effect.',
    },
    {
      id: 'gt2-q17',
      number: 17,
      passageIndex: 1,
      type: 'completion',
      maxWords: 2,
      prompt: 'Driving a forklift requires a licence and written ______.',
      answers: ['authorisation', 'authorization'],
      explanation: 'Only staff with a licence and written authorisation from the site manager drive forklifts.',
    },
    {
      id: 'gt2-q18',
      number: 18,
      passageIndex: 1,
      type: 'completion',
      maxWords: 2,
      prompt: 'On a long shift the unpaid lunch break lasts ______.',
      answers: ['30 minutes', 'thirty minutes'],
      explanation: 'A shift of six hours or more includes an unpaid lunch break of 30 minutes.',
    },
    {
      id: 'gt2-q19',
      number: 19,
      passageIndex: 1,
      type: 'completion',
      maxWords: 2,
      prompt: 'Expense claims are rejected when submitted more than ______ after the spending.',
      answers: ['60 days', 'sixty days'],
      explanation: 'Claims must be submitted within 60 days; older claims are returned unpaid.',
    },
    {
      id: 'gt2-q20',
      number: 20,
      passageIndex: 1,
      type: 'completion',
      maxWords: 2,
      prompt: 'Receipts are photographed and attached to each claim in the online ______.',
      answers: ['portal'],
      explanation: 'All claims go through the online portal; paper forms are no longer accepted.',
    },

    /* --------------------- section 2: Q21–23 true/false ---------------------- */
    {
      id: 'gt2-q21',
      number: 21,
      passageIndex: 1,
      type: 'true-false-notgiven',
      prompt: 'Staff can claim the cost of travelling from home to their usual workplace.',
      answers: ['FALSE'],
      explanation: 'Ordinary travel between home and the usual place of work cannot be claimed in any circumstances.',
    },
    {
      id: 'gt2-q22',
      number: 22,
      passageIndex: 1,
      type: 'true-false-notgiven',
      prompt: 'A taxi fare can be claimed for a journey late at night.',
      answers: ['TRUE'],
      explanation: 'Taxis are claimable for journeys after 10.00pm, or when heavy equipment is carried.',
    },
    {
      id: 'gt2-q23',
      number: 23,
      passageIndex: 1,
      type: 'true-false-notgiven',
      prompt: 'Most staff submit their expense claims on time.',
      answers: ['NOT GIVEN'],
      explanation: 'The rules state a deadline; how many staff meet it is never said.',
    },

    /* ------------------------- section 2: Q24–26 MCQ ------------------------- */
    {
      id: 'gt2-q24',
      number: 24,
      passageIndex: 1,
      type: 'multiple-choice',
      prompt: 'Which item of work clothing must seasonal staff provide for themselves?',
      options: ['a polo shirt', 'a fleece', 'black trousers', 'safety boots'],
      answers: ['black trousers'],
      explanation: 'Shirts, fleece and boots are issued by the centre; the plain black trousers are the employee’s own.',
    },
    {
      id: 'gt2-q25',
      number: 25,
      passageIndex: 1,
      type: 'multiple-choice',
      prompt: 'A single expense claim of more than £200',
      options: [
        'is paid separately from salary.',
        'needs a second signature before payment.',
        'must be submitted on a paper form.',
        'is automatically refused.',
      ],
      answers: ['needs a second signature before payment.'],
      explanation: 'Any single claim over £200 needs a second signature from the finance office.',
    },
    {
      id: 'gt2-q26',
      number: 26,
      passageIndex: 1,
      type: 'multiple-choice',
      prompt: 'For rail travel, staff are reimbursed for',
      options: [
        'a standard-class ticket only.',
        'any ticket bought on the day.',
        'first-class travel on long journeys.',
        'half the cost of a season ticket.',
      ],
      answers: ['a standard-class ticket only.'],
      explanation: 'Rail travel is reimbursed at standard class only, bought in advance where possible.',
    },

    /* -------------------- section 3: Q27–31 matching headings ---------------- */
    {
      id: 'gt2-q27',
      number: 27,
      passageIndex: 2,
      type: 'matching-headings',
      paragraph: 'A',
      headings: S3_HEADINGS,
      prompt: 'Paragraph A',
      answers: ['ii'],
      explanation: 'Paragraph A sets the scene: a church hall, volunteers, and broken things leaving mended.',
    },
    {
      id: 'gt2-q28',
      number: 28,
      passageIndex: 2,
      type: 'matching-headings',
      paragraph: 'B',
      headings: S3_HEADINGS,
      prompt: 'Paragraph B',
      answers: ['i'],
      explanation: 'Paragraph B: cheap goods and dear labour made replacing rational, and design followed.',
    },
    {
      id: 'gt2-q29',
      number: 29,
      passageIndex: 2,
      type: 'matching-headings',
      paragraph: 'D',
      headings: S3_HEADINGS,
      prompt: 'Paragraph D',
      answers: ['iii'],
      explanation: 'Paragraph D: the fixers are mostly retired, and the knowledge is not being replaced.',
    },
    {
      id: 'gt2-q30',
      number: 30,
      passageIndex: 2,
      type: 'matching-headings',
      paragraph: 'E',
      headings: S3_HEADINGS,
      prompt: 'Paragraph E',
      answers: ['iv'],
      explanation: 'Paragraph E: European spare-parts rules and right-to-repair proposals.',
    },
    {
      id: 'gt2-q31',
      number: 31,
      passageIndex: 2,
      type: 'matching-headings',
      paragraph: 'F',
      headings: S3_HEADINGS,
      prompt: 'Paragraph F',
      answers: ['v'],
      explanation: 'Paragraph F is honest about scale: tiny tonnage, some devices beyond mending.',
    },

    /* -------------------------- section 3: Q32–36 YNNG ----------------------- */
    {
      id: 'gt2-q32',
      number: 32,
      passageIndex: 2,
      type: 'yes-no-notgiven',
      prompt: 'Repair cafés aim to take business away from professional repairers.',
      answers: ['NO'],
      explanation: 'A repair café does not really compete with the repair trades, and is careful not to try.',
    },
    {
      id: 'gt2-q33',
      number: 33,
      passageIndex: 2,
      type: 'yes-no-notgiven',
      prompt: 'It was reasonable for households to replace goods rather than repair them.',
      answers: ['YES'],
      explanation: 'Households were not being lazy when they threw things away; they were being rational.',
    },
    {
      id: 'gt2-q34',
      number: 34,
      passageIndex: 2,
      type: 'yes-no-notgiven',
      prompt: 'Manufacturers’ safety objections to the new rules are insincere.',
      answers: ['NOT GIVEN'],
      explanation: 'The objections are reported, but the writer never judges whether they are genuine.',
    },
    {
      id: 'gt2-q35',
      number: 35,
      passageIndex: 2,
      type: 'yes-no-notgiven',
      prompt: 'Repair cafés will solve the waste problem on their own.',
      answers: ['NO'],
      explanation: 'Anyone who presents them as a solution to the waste problem is setting them up to fail.',
    },
    {
      id: 'gt2-q36',
      number: 36,
      passageIndex: 2,
      type: 'yes-no-notgiven',
      prompt: 'Public enthusiasm for repair may influence how products are designed.',
      answers: ['YES'],
      explanation: 'A public that queues to mend is legible to manufacturers, and repairability is appearing in advertising.',
    },

    /* -------------------------- section 3: Q37–40 MCQ ------------------------ */
    {
      id: 'gt2-q37',
      number: 37,
      passageIndex: 2,
      type: 'multiple-choice',
      prompt: 'What makes a repair café different from an ordinary repair shop?',
      options: [
        'Owners take part in mending their own belongings.',
        'All the repairs it attempts are successful.',
        'It charges only for the parts it uses.',
        'It accepts electrical goods that shops refuse.',
      ],
      answers: ['Owners take part in mending their own belongings.'],
      explanation: 'The distinctive rule: you sit with the volunteer, hold the torch, and do part of the work yourself.',
    },
    {
      id: 'gt2-q38',
      number: 38,
      passageIndex: 2,
      type: 'multiple-choice',
      prompt: 'The writer mentions retired engineers and dressmakers in order to show',
      options: [
        'where the remaining repair skills are concentrated.',
        'that older people have more free time to volunteer.',
        'that modern products are easier to fix than old ones.',
        'why repair cafés open only once a month.',
      ],
      answers: ['where the remaining repair skills are concentrated.'],
      explanation: 'The skills at the tables were learned in workplaces and school workshops that have largely gone.',
    },
    {
      id: 'gt2-q39',
      number: 39,
      passageIndex: 2,
      type: 'multiple-choice',
      prompt: 'According to the passage, recent European rules require some manufacturers to',
      options: [
        'keep spare parts available for years after a product is sold.',
        'repair any product free of charge within ten years.',
        'publish the prices of all their spare parts.',
        'design every appliance so that it can be opened with a screwdriver.',
      ],
      answers: ['keep spare parts available for years after a product is sold.'],
      explanation: 'The rules cover spare-part availability and supply within a reasonable time, with many exemptions.',
    },
    {
      id: 'gt2-q40',
      number: 40,
      passageIndex: 2,
      type: 'multiple-choice',
      prompt: 'Which sentence best sums up the writer’s conclusion?',
      options: [
        'Repair cafés matter because they change attitudes, not because of what they divert from landfill.',
        'Repair cafés would succeed if governments funded them properly.',
        'Repair cafés show that most modern products could last for decades.',
        'Repair cafés are a pleasant social occasion with no wider significance.',
      ],
      answers: ['Repair cafés matter because they change attitudes, not because of what they divert from landfill.'],
      explanation: 'They are a correction to a habit of mind — a visible vote for a different idea of ownership.',
    },
  ],
}
