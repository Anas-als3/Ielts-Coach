/**
 * Academic Reading Test 2 — three passages, forty questions, sixty minutes.
 * The second Academic paper, following the format plan 010 validated with
 * `academicTest01.ts`.
 *
 * ## Sources and licences
 *
 * | Passage | Text | Source | Licence |
 * |---|---|---|---|
 * | 1 | The Concrete That Outlived an Empire | Original prose written for this project | Original work of this project |
 * | 2 | The Box That Moved the World | Original prose written for this project | Original work of this project |
 * | 3 | In Defence of Boredom | Original prose written for this project | Original work of this project |
 *
 * **No text in this file is reproduced from any IELTS publisher.** Real exam
 * passages and question sets are University of Cambridge (UCLES) copyright and
 * cannot ship in an outward-facing app; the format is not copyrightable, so
 * this test follows the real paper's structure — 3 passages, 40 questions, a
 * rising difficulty curve — with prose and questions written from scratch. The
 * factual content is general knowledge (Roman building methods, the history of
 * container shipping, published research on attention and mind-wandering)
 * stated in this project's own words; where a passage cites a figure it is one
 * that is widely published and stable, such as the 43-metre span of the
 * Pantheon's dome or the 1956 sailing of the first container ship.
 *
 * ## Question distribution
 *
 * true/false/not given 6 · completion 12 · matching headings 5 ·
 * matching information 4 · multiple choice 8 · yes/no/not given 5 = 40.
 *
 * Deliberately a different balance from Test 1 (which ran 6 headings, 9 TFNG,
 * 9 completion, 6 MCQ, 5 matching information, 5 YNNG): real papers vary the
 * mix between sittings, and a learner drilling two papers should meet two
 * different weightings of the same six types.
 */
import type { ReadingHeading, ReadingTest } from '../types'

/** Join authored lines into one paragraph. Keeps prose readable in source. */
const prose = (...lines: string[]): string => lines.join(' ')

/* ------------------------------- passage 2 ---------------------------------- */

const P2_HEADINGS: ReadingHeading[] = [
  { id: 'i', text: 'A design agreed by everyone, or useful to no one' },
  { id: 'ii', text: 'When loading a ship cost more than sailing it' },
  { id: 'iii', text: 'Ports remade, and work that disappeared' },
  { id: 'iv', text: 'An outsider’s idea of what shipping was for' },
  { id: 'v', text: 'Weak points in a system built on sameness' },
  { id: 'vi', text: 'Why factories stopped caring where they stood' },
  { id: 'vii', text: 'The largest ships ever to carry cargo' },
  { id: 'viii', text: 'A price the passenger lines refused to pay' },
]

const P2_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

/* ---------------------------------- test ------------------------------------ */

export const ACADEMIC_TEST_02: ReadingTest = {
  id: 'reading-academic-02',
  module: 'academic',
  title: 'Academic Reading Test 2',
  passages: [
    {
      id: 'reading-academic-02-p1',
      number: 1,
      heading: 'Reading Passage 1',
      source: {
        description: 'Original prose written for this project',
        licence: 'Original work of this project',
      },
      texts: [
        {
          title: 'The Concrete That Outlived an Empire',
          subtitle: 'What Roman builders knew, what was forgotten, and what chemists have lately rediscovered',
          paragraphs: [
            {
              text: prose(
                'Builders were binding stone with lime mortar long before Rome existed: burnt',
                'limestone, slaked in water, makes a paste that hardens between blocks and holds',
                'them fast. What the Romans did was turn that paste from a glue into a building',
                'material in its own right. By stirring fist-sized pieces of rubble into wet',
                'mortar they produced opus caementicium — concrete — a substance that could be',
                'poured, shaped and left to harden into artificial rock. Walls no longer had to',
                'be assembled from carefully cut blocks by skilled masons; they could be raised',
                'by gangs of labourers filling timber shuttering, layer upon layer. It was',
                'cheap, it was fast, and in one crucial respect it was better than anything',
                'anyone had built with before.',
              ),
            },
            {
              text: prose(
                'That respect was water. Ordinary lime mortar hardens by slowly drawing carbon',
                'dioxide out of the air, which means it cures over months and will not set at',
                'all where air cannot reach it — under water, an ordinary mortar simply stays',
                'soft. The Roman advance was an ingredient: a reddish volcanic ash dug from the',
                'fields around Puteoli, the modern Pozzuoli, on the Bay of Naples. Mixed with',
                'lime and water, the ash — pozzolana, as it is still called — reacts chemically',
                'to form a mineral binder that needs no air whatever. A pozzolana concrete',
                'will set in the rain, in the mud of a riverbed, even on the open seafloor.',
                'Roman writers knew how remarkable this was: Vitruvius, the empire’s great',
                'engineering author, described the powder as producing astonishing results by',
                'nature alone.',
              ),
            },
            {
              text: prose(
                'The results are still standing. The Pantheon in Rome, completed under the',
                'emperor Hadrian around AD 128, is roofed by a poured concrete dome spanning',
                '43 metres — after nearly nineteen centuries, still the widest dome of',
                'unreinforced concrete anywhere on earth. Its builders understood their',
                'material with complete practical confidence: the mix changes as the dome',
                'rises, with heavy basalt in the aggregate at the base giving way to light,',
                'airy pumice near the opening at the crown, so that the structure grows lighter',
                'exactly where weight would be most dangerous. At the harbour of Caesarea, on',
                'the coast of what is now Israel, engineers sank huge wooden forms filled with',
                'the wet mixture straight into the sea, where it hardened into breakwaters that',
                'survive as reefs today.',
              ),
            },
            {
              text: prose(
                'Then the knowledge slipped away. As the western empire dissolved, the demand',
                'for vast poured structures went with it, and the crafts that fed them —',
                'burning lime in quantity, shipping the right ash — withered. Medieval masons',
                'built superbly in cut stone, often quarried from Roman ruins, but they poured',
                'nothing like the Pantheon. Concrete returned to European building only in',
                'modern times, and its familiar modern form arrived in 1824, when Joseph',
                'Aspdin, a bricklayer from Leeds, patented what he called Portland cement —',
                'named not after any place connected with its invention, but because the set',
                'material reminded him of the pale limestone quarried at Portland on the',
                'English south coast.',
              ),
            },
            {
              text: prose(
                'For a long time the endurance of Roman marine concrete was simply a curiosity.',
                'Modern harbour walls, built of steel-reinforced Portland concrete, can need',
                'replacement within decades; Roman breakwaters have sat in the surf for two',
                'thousand years. Chemists who finally examined the ancient material closely',
                'found part of the answer in the sea itself: seawater seeping through the',
                'concrete never stopped reacting with the ash and lime, growing rare',
                'interlocking minerals inside pores and fractures, so that the structure',
                'genuinely strengthened with age. A second discovery concerned the small white',
                'lumps of lime scattered through Roman concrete, long dismissed as evidence of',
                'careless mixing. They now look deliberate: relics of mixing at high',
                'temperature with quicklime. When a crack opens and lets water reach one of',
                'these fragments, the lime dissolves, flows into the crack and re-sets —',
                'sealing the very cracks that would destroy a modern wall. The material, in a',
                'limited but real sense, heals itself.',
              ),
            },
            {
              text: prose(
                'None of this makes Roman concrete a recipe modern builders can simply adopt.',
                'It gains strength far too slowly for construction schedules measured in weeks,',
                'and it was never asked to do what modern concrete does: Roman engineers used',
                'it in compression, in arches, vaults and domes, and never around steel',
                'reinforcement, whose rusting is the main reason modern concrete fails. But the',
                'lesson is pointed all the same. Making cement accounts for roughly eight per',
                'cent of the carbon dioxide humanity emits, and most of what is built with it',
                'will be demolished within a lifetime. A structure that stands for two',
                'millennia spreads the cost of its making, in money and in carbon, across',
                'eighty generations. The Romans, who never heard of either problem, left',
                'behind one answer to both.',
              ),
            },
          ],
        },
      ],
    },
    {
      id: 'reading-academic-02-p2',
      number: 2,
      heading: 'Reading Passage 2',
      source: {
        description: 'Original prose written for this project',
        licence: 'Original work of this project',
      },
      texts: [
        {
          title: 'The Box That Moved the World',
          subtitle: 'How a steel container rebuilt ports, trade and the geography of work',
          paragraphs: [
            {
              label: 'A',
              text: prose(
                'Until the middle of the twentieth century, almost everything that crossed an',
                'ocean was handled the same way it had been handled for centuries: piece by',
                'piece. Sacks, barrels, crates and bales were carried up gangways or swung',
                'aboard in nets, stowed by hand in the hold, and unloaded the same way at the',
                'other end. The work took armies of dockers and astonishing amounts of time — a',
                'ship could easily spend as long tied up in port as it spent at sea — and a',
                'certain amount of the cargo reliably vanished along the way, since goods that',
                'pass through many hands leave some of them holding souvenirs. By the 1950s,',
                'moving freight onto and off ships accounted for a larger share of the cost of',
                'sea transport than the sea voyage itself.',
              ),
            },
            {
              label: 'B',
              text: prose(
                'The man who changed this was not a shipping man at all. Malcom McLean ran a',
                'trucking company in North Carolina, and he saw the problem from the road: what',
                'his customers paid for was getting goods from one place to another, and the',
                'ships, cranes and warehouses in between were merely obstacles that charged',
                'rent. His answer was to stop handling goods and start handling boxes. In',
                'April 1956 a converted wartime tanker, the Ideal X, sailed from Newark to',
                'Houston carrying 58 aluminium containers that had been lifted straight off',
                'truck trailers. Loading her had cost a fraction of loading a conventional',
                'ship. The point was never the vessel; it was that the box, sealed at the',
                'factory and opened at its destination, made everything between the two a',
                'single mechanical process.',
              ),
            },
            {
              label: 'C',
              text: prose(
                'A box, however, is only as useful as the things that can lift it. For a',
                'decade, rival operators built containers to their own sizes, with their own',
                'fittings, handled by their own cranes — which meant each company’s boxes were',
                'trapped inside its own network. The dull-sounding work that unlocked the',
                'system was standardisation: through the 1960s, international committees',
                'argued lengths, strengths and, above all, the corner castings by which a',
                'container is gripped, lifted and locked to a ship, a lorry or a railway',
                'wagon. Once those agreements were in place, any standard box could travel on',
                'any standard vehicle between any two equipped ports on earth without anyone',
                'opening it. Only then did the container stop being one firm’s clever idea and',
                'become infrastructure.',
              ),
            },
            {
              label: 'D',
              text: prose(
                'The ports felt it first. Container cranes need deep water, long quays and',
                'acres of flat storage, which the old city-centre docks — built for ships that',
                'were unloaded by hand into warehouses — could not provide. Trade abandoned',
                'them within a generation: London’s upstream docks, for centuries the busiest',
                'in the world, closed one after another through the 1960s and 1970s, while an',
                'obscure Suffolk port with room to grow, Felixstowe, became Britain’s',
                'container gateway, and Rotterdam built terminals on land reclaimed from the',
                'sea. The human change was harsher still. A gang of dozens was replaced by a',
                'crane driver and a planner with a manifest, and the dockside neighbourhoods',
                'that had lived on that work lost their reason to exist.',
              ),
            },
            {
              label: 'E',
              text: prose(
                'The deeper effect took longer to see. Once a box could move from an inland',
                'factory to an inland customer on another continent for a few hundred dollars,',
                'the cost of distance nearly fell out of manufacturers’ arithmetic. Firms',
                'stopped needing to make things near the people who would buy them, and',
                'production scattered to wherever it was cheapest, with components sometimes',
                'crossing oceans several times before the finished article crossed one more.',
                'Retailers learned to treat a container ship three weeks from port as a',
                'floating warehouse and cut their stockrooms accordingly. Economists who look',
                'for the origins of modern globalisation in trade treaties, some historians',
                'now argue, are looking in the wrong place: tariffs fell by percentages, but',
                'the box cut the cost of carrying a tonne of goods by something closer to a',
                'factor of ten.',
              ),
            },
            {
              label: 'F',
              text: prose(
                'A system built on uniformity has uniform weaknesses. Trade is lopsided, so',
                'boxes pile up where imports arrive and run short where exports load, and a',
                'noticeable share of all container traffic is empty boxes being repositioned —',
                'movement that burns fuel and earns nothing. Ships grew to carry more than',
                'twenty thousand boxes because a bigger hull is cheaper per box, but each',
                'giant can only dock at a handful of ports, so ever more cargo squeezes',
                'through ever fewer channels. The world was reminded of this in 2021, when a',
                'single ship wedged across the Suez Canal held up hundreds of vessels and',
                'billions of dollars of goods for six days. Efficiency and fragility, it turns',
                'out, are close relatives.',
              ),
            },
            {
              label: 'G',
              text: prose(
                'The best measure of the container’s success is that nobody looks at it. The',
                'consumer who tracks a parcel across the Pacific never wonders how a mattress,',
                'a motorcycle and ten thousand toothbrushes share a vehicle. The box did not',
                'shrink the world’s distances; it shrank the price of them, which for trade',
                'amounts to the same thing. Some historians now rank it with the trade',
                'agreements of the twentieth century as a cause of globalisation — an odd',
                'legacy for an object with no moving parts, designed to be ignored, and',
                'succeeding at precisely that.',
              ),
            },
          ],
        },
      ],
    },
    {
      id: 'reading-academic-02-p3',
      number: 3,
      heading: 'Reading Passage 3',
      source: {
        description: 'Original prose written for this project',
        licence: 'Original work of this project',
      },
      texts: [
        {
          title: 'In Defence of Boredom',
          subtitle: 'Why an unpleasant feeling may be doing necessary work',
          paragraphs: [
            {
              text: prose(
                'There was, until recently, a small but dependable supply of boredom in every',
                'life: the bus stop, the waiting room, the queue, the lecture that had another',
                'twenty minutes to run. These pockets of dead time were not enjoyed, exactly,',
                'but they were endured, and what filled them was whatever the mind produced on',
                'its own. The smartphone has closed nearly all of them. It is not that the',
                'phone entertains us badly; it is that it entertains us instantly, so the',
                'moment in which boredom used to begin — the reach for nothing and the finding',
                'of nothing — no longer occurs. An experience that every human being since the',
                'first campfire has known in quantity has become, in one generation, something',
                'close to optional.',
              ),
            },
            {
              text: prose(
                'Before deciding this is progress, it is worth asking what boredom is for.',
                'Psychologists who study it describe it not as an empty state but as a signal:',
                'an uncomfortable message that the current activity has lost its value and that',
                'attention should be spent elsewhere. In this it resembles pain, which is also',
                'unpleasant and also indispensable. People born unable to feel pain injure',
                'themselves constantly, not because their bodies are fragile but because',
                'nothing tells them to stop. A life engineered so that the signal of boredom',
                'can never sound may turn out to have a similar shape: nothing hurts, and',
                'nothing changes.',
              ),
            },
            {
              text: prose(
                'What an unoccupied mind does with itself turns out to be far from nothing.',
                'When people lie in brain scanners with no task at all, activity does not',
                'subside; it moves, into a web of regions that neuroscientists call the',
                'default mode network, which busies itself with memory, imagined futures and',
                'other people’s points of view. This is the machinery of daydreaming, and',
                'there is steady evidence that it earns its keep. In studies of creative',
                'problem-solving, people who put a problem aside and let their minds wander',
                'reliably return with more solutions than people who grind at it without a',
                'break. Researchers call the interval incubation, and its most familiar fruit',
                'is the good idea that arrives in the shower, on the walk, anywhere but at',
                'the desk.',
              ),
            },
            {
              text: prose(
                'None of this happens by appointment. The mind wanders when it is left',
                'unattended, and it is left unattended precisely in the dull intervals the',
                'phone now fills. This is why the phone is not one distraction among many but',
                'something structurally new. Earlier escapes from boredom — the novel, the',
                'radio, even television — had edges: the chapter ended, the programme',
                'finished. The feed does not end, because it is not a programme but a',
                'marketplace. In what has come to be called the attention economy, spare',
                'attention is raw material, gathered and sold, and a moment of mind-wandering',
                'is, from the seller’s side of the counter, simply stock walking out of the',
                'shop.',
              ),
            },
            {
              text: prose(
                'An honest defence of boredom has to concede what it is not defending. The',
                'passing boredom of a quiet afternoon and the settled boredom of a person',
                'whose circumstances offer nothing are different conditions, and only the',
                'first is any kind of gift. Chronic boredom — the kind reported by people in',
                'monotonous jobs, or trapped in institutions with nothing to do — is',
                'associated with anxiety, depression and risk-taking, and no one who studies',
                'it romanticises it. The signal is useful the way a fire alarm is useful: as',
                'an interruption. An alarm that never sounds protects nothing, but an alarm',
                'that sounds all day, in a building nobody can leave, is not protection',
                'either. It is a description of misery.',
              ),
            },
            {
              text: prose(
                'The same distinction should govern how adults treat children’s time. The',
                'instinct to schedule every hour — lessons, clubs, supervised enrichment —',
                'comes from love, but it quietly teaches a child that stimulation is something',
                'other people provide. A child left, within reason, to be bored is being left',
                'to discover the alternative: that a stick is a sword, that an afternoon has',
                'an architecture, that the inside of one’s own head is inhabitable. Complaints',
                'of boredom, one researcher has remarked, are requests for help that are best',
                'declined slowly. The point is not neglect. It is that the capacity to',
                'generate one’s own occupation is learned, and it is only learned where there',
                'is something to escape from.',
              ),
            },
            {
              text: prose(
                'It would be tidy to end with a programme — digital sabbaths, phone-free',
                'carriages, boredom drills before breakfast — but the argument does not really',
                'call for one. It calls for a revaluation. Boredom is not an ornament of',
                'simpler times to be curated back into life; it is information, and the',
                'question is whether we are still willing to receive it. A person who never',
                'feels it has not transcended it. They have merely sold, minute by minute and',
                'for very little, the only time in which they might have heard themselves',
                'think.',
              ),
            },
          ],
        },
      ],
    },
  ],
  questions: [
    /* ------------------------- passage 1: Q1–6 TFNG -------------------------- */
    {
      id: 'ac2-q01',
      number: 1,
      passageIndex: 0,
      type: 'true-false-notgiven',
      prompt: 'The Romans were the first people to bind stone with lime mortar.',
      answers: ['FALSE'],
      explanation: 'The opening sentence: builders were binding stone with lime mortar long before Rome existed.',
    },
    {
      id: 'ac2-q02',
      number: 2,
      passageIndex: 0,
      type: 'true-false-notgiven',
      prompt: 'Ordinary lime mortar will harden where no air can reach it.',
      answers: ['FALSE'],
      explanation: 'It hardens by drawing carbon dioxide from the air, and under water it simply stays soft.',
    },
    {
      id: 'ac2-q03',
      number: 3,
      passageIndex: 0,
      type: 'true-false-notgiven',
      prompt: 'The materials in the Pantheon’s dome become lighter towards its top.',
      answers: ['TRUE'],
      explanation: 'Heavy basalt at the base gives way to light pumice near the crown.',
    },
    {
      id: 'ac2-q04',
      number: 4,
      passageIndex: 0,
      type: 'true-false-notgiven',
      prompt: 'The Pantheon took longer to complete than any other Roman building.',
      answers: ['NOT GIVEN'],
      explanation: 'The passage dates its completion but says nothing about how long any building took.',
    },
    {
      id: 'ac2-q05',
      number: 5,
      passageIndex: 0,
      type: 'true-false-notgiven',
      prompt: 'Portland cement was named after the place where it was invented.',
      answers: ['FALSE'],
      explanation: 'It was named for the set material’s resemblance to the limestone quarried at Portland, not for any place connected with its invention.',
    },
    {
      id: 'ac2-q06',
      number: 6,
      passageIndex: 0,
      type: 'true-false-notgiven',
      prompt: 'Roman harbour structures were formed inside wooden containers lowered into the sea.',
      answers: ['TRUE'],
      explanation: 'At Caesarea, engineers sank huge wooden forms filled with the wet mixture straight into the sea.',
    },

    /* ---------------------- passage 1: Q7–13 completion ---------------------- */
    {
      id: 'ac2-q07',
      number: 7,
      passageIndex: 0,
      type: 'completion',
      maxWords: 2,
      prompt: 'Roman concrete was made by stirring pieces of ______ into wet mortar.',
      answers: ['rubble'],
      explanation: 'Fist-sized pieces of rubble turned the mortar from a glue into a material in its own right.',
    },
    {
      id: 'ac2-q08',
      number: 8,
      passageIndex: 0,
      type: 'completion',
      maxWords: 2,
      prompt: 'Unlike plain lime mortar, a pozzolana mixture will set even under ______.',
      answers: ['water'],
      explanation: 'The ash forms a mineral binder that needs no air: it sets on a riverbed or the open seafloor.',
    },
    {
      id: 'ac2-q09',
      number: 9,
      passageIndex: 0,
      type: 'completion',
      maxWords: 2,
      prompt: 'At the base of the Pantheon’s dome the aggregate contains heavy ______.',
      answers: ['basalt'],
      explanation: 'The mix changes as the dome rises, with heavy basalt at the base and pumice near the crown.',
    },
    {
      id: 'ac2-q10',
      number: 10,
      passageIndex: 0,
      type: 'completion',
      maxWords: 2,
      // A distance answer: the figure and the word form, in both spellings of
      // the unit. "Forty three metres" (space form) is three words against the
      // two-word limit and stays out, as the linter itself would agree.
      prompt: 'The dome of the Pantheon spans ______.',
      answers: ['43 metres', '43 meters', 'forty-three metres', 'forty-three meters'],
      explanation: 'A poured concrete dome spanning 43 metres — still the widest unreinforced concrete dome on earth.',
    },
    {
      id: 'ac2-q11',
      number: 11,
      passageIndex: 0,
      type: 'completion',
      maxWords: 2,
      prompt: 'To build breakwaters, engineers filled huge ______ with concrete and sank them.',
      answers: ['wooden forms', 'forms'],
      explanation: 'At Caesarea, wooden forms filled with the wet mixture were sunk straight into the sea.',
    },
    {
      id: 'ac2-q12',
      number: 12,
      passageIndex: 0,
      type: 'completion',
      maxWords: 2,
      prompt: 'Aspdin’s cement owes its name to a pale ______ from the English south coast.',
      answers: ['limestone'],
      explanation: 'The set material reminded him of the limestone quarried at Portland.',
    },
    {
      id: 'ac2-q13',
      number: 13,
      passageIndex: 0,
      type: 'completion',
      maxWords: 2,
      prompt: 'Dissolving fragments of lime allow Roman concrete to seal its own ______.',
      answers: ['cracks'],
      explanation: 'When a crack lets water reach a lime fragment, the lime dissolves, flows into the crack and re-sets.',
    },

    /* ------------------ passage 2: Q14–18 matching headings ------------------- */
    {
      id: 'ac2-q14',
      number: 14,
      passageIndex: 1,
      type: 'matching-headings',
      paragraph: 'A',
      headings: P2_HEADINGS,
      prompt: 'Paragraph A',
      answers: ['ii'],
      explanation: 'Paragraph A: by the 1950s, moving freight on and off ships cost more than the voyage itself.',
    },
    {
      id: 'ac2-q15',
      number: 15,
      passageIndex: 1,
      type: 'matching-headings',
      paragraph: 'B',
      headings: P2_HEADINGS,
      prompt: 'Paragraph B',
      answers: ['iv'],
      explanation: 'Paragraph B: McLean was a trucker, not a shipping man, and saw the business as moving goods.',
    },
    {
      id: 'ac2-q16',
      number: 16,
      passageIndex: 1,
      type: 'matching-headings',
      paragraph: 'C',
      headings: P2_HEADINGS,
      prompt: 'Paragraph C',
      answers: ['i'],
      explanation: 'Paragraph C: without agreed sizes and corner fittings, each company’s boxes were trapped in its own network.',
    },
    {
      id: 'ac2-q17',
      number: 17,
      passageIndex: 1,
      type: 'matching-headings',
      paragraph: 'D',
      headings: P2_HEADINGS,
      prompt: 'Paragraph D',
      answers: ['iii'],
      explanation: 'Paragraph D: old city docks closed, new deep-water ports rose, and dockside work vanished.',
    },
    {
      id: 'ac2-q18',
      number: 18,
      passageIndex: 1,
      type: 'matching-headings',
      paragraph: 'F',
      headings: P2_HEADINGS,
      prompt: 'Paragraph F',
      answers: ['v'],
      explanation: 'Paragraph F: empty repositioning, giant ships, few ports — uniform weaknesses of a uniform system.',
    },

    /* ---------------- passage 2: Q19–22 matching information ------------------ */
    {
      id: 'ac2-q19',
      number: 19,
      passageIndex: 1,
      type: 'matching-information',
      paragraphLabels: P2_LABELS,
      prompt: 'a reference to cargo being stolen during handling',
      answers: ['A'],
      explanation: 'Paragraph A: goods that pass through many hands leave some of them holding souvenirs.',
    },
    {
      id: 'ac2-q20',
      number: 20,
      passageIndex: 1,
      type: 'matching-information',
      paragraphLabels: P2_LABELS,
      prompt: 'examples of ports that grew because they could accommodate container ships',
      answers: ['D'],
      explanation: 'Paragraph D: Felixstowe became Britain’s container gateway and Rotterdam built terminals on reclaimed land.',
    },
    {
      id: 'ac2-q21',
      number: 21,
      passageIndex: 1,
      type: 'matching-information',
      paragraphLabels: P2_LABELS,
      prompt: 'a mention of containers being transported with nothing inside them',
      answers: ['F'],
      explanation: 'Paragraph F: a noticeable share of all container traffic is empty boxes being repositioned.',
    },
    {
      id: 'ac2-q22',
      number: 22,
      passageIndex: 1,
      type: 'matching-information',
      paragraphLabels: P2_LABELS,
      prompt: 'a comparison between the container and international trade agreements',
      answers: ['G'],
      explanation: 'Paragraph G: some historians rank the box with the trade agreements of the twentieth century.',
    },

    /* ------------------------- passage 2: Q23–26 MCQ ------------------------- */
    {
      id: 'ac2-q23',
      number: 23,
      passageIndex: 1,
      type: 'multiple-choice',
      prompt: 'According to the writer, McLean’s essential insight was that',
      options: [
        'ships needed to be faster to compete with road transport.',
        'his business was moving goods, not operating ships.',
        'aluminium containers were stronger than wooden crates.',
        'ports charged too much for the use of their cranes.',
      ],
      answers: ['his business was moving goods, not operating ships.'],
      explanation: 'What customers paid for was getting goods from place to place; everything in between was an obstacle charging rent.',
    },
    {
      id: 'ac2-q24',
      number: 24,
      passageIndex: 1,
      type: 'multiple-choice',
      prompt: 'Why does the writer regard the standards agreed in the 1960s as decisive?',
      options: [
        'They made containers much cheaper to manufacture.',
        'They allowed any standard box to travel on any standard vehicle.',
        'They forced rival shipping companies to merge their fleets.',
        'They were the first international rules ever applied to shipping.',
      ],
      answers: ['They allowed any standard box to travel on any standard vehicle.'],
      explanation: 'Once sizes and corner castings were agreed, a box could move between any two equipped ports without being opened.',
    },
    {
      id: 'ac2-q25',
      number: 25,
      passageIndex: 1,
      type: 'multiple-choice',
      prompt: 'What does the writer say happened to long-established city docks?',
      options: [
        'They were rebuilt to handle container traffic.',
        'They survived by specialising in passenger ships.',
        'Trade left them for deep-water sites within a generation.',
        'They closed because their warehouses burned down.',
      ],
      answers: ['Trade left them for deep-water sites within a generation.'],
      explanation: 'Container cranes need deep water and space the old docks could not provide; London’s docks closed while Felixstowe grew.',
    },
    {
      id: 'ac2-q26',
      number: 26,
      passageIndex: 1,
      type: 'multiple-choice',
      prompt: 'The writer mentions the ship wedged across the Suez Canal in 2021 in order to',
      options: [
        'show how much trade now depends on a small number of channels.',
        'argue that container ships have grown too large to steer safely.',
        'illustrate the skill required to navigate modern waterways.',
        'explain why insurance costs have risen for shipping companies.',
      ],
      answers: ['show how much trade now depends on a small number of channels.'],
      explanation: 'Ever more cargo squeezes through ever fewer channels — efficiency and fragility are close relatives.',
    },

    /* ------------------------- passage 3: Q27–31 YNNG ------------------------ */
    {
      id: 'ac2-q27',
      number: 27,
      passageIndex: 2,
      type: 'yes-no-notgiven',
      prompt: 'The discomfort of boredom serves a useful purpose.',
      answers: ['YES'],
      explanation: 'The writer compares it to pain: an unpleasant but indispensable signal that attention should move.',
    },
    {
      id: 'ac2-q28',
      number: 28,
      passageIndex: 2,
      type: 'yes-no-notgiven',
      prompt: 'App designers are chiefly responsible for the rise in anxiety among young people.',
      answers: ['NOT GIVEN'],
      explanation: 'The attention economy is described, but no claim is made about who is responsible for anxiety among the young.',
    },
    {
      id: 'ac2-q29',
      number: 29,
      passageIndex: 2,
      type: 'yes-no-notgiven',
      prompt: 'Every kind of boredom is worth preserving.',
      answers: ['NO'],
      explanation: 'The writer concedes that chronic boredom is associated with real harm and is no kind of gift.',
    },
    {
      id: 'ac2-q30',
      number: 30,
      passageIndex: 2,
      type: 'yes-no-notgiven',
      prompt: 'Parents should fill as much of a child’s day as possible with organised activity.',
      answers: ['NO'],
      explanation: 'Scheduling every hour teaches a child that stimulation is something other people provide.',
    },
    {
      id: 'ac2-q31',
      number: 31,
      passageIndex: 2,
      type: 'yes-no-notgiven',
      prompt: 'An idle mind can accomplish things that deliberate effort cannot.',
      answers: ['YES'],
      explanation: 'People who let a problem incubate return with more solutions than those who grind at it without a break.',
    },

    /* ------------------------- passage 3: Q32–35 MCQ ------------------------- */
    {
      id: 'ac2-q32',
      number: 32,
      passageIndex: 2,
      type: 'multiple-choice',
      prompt: 'What point does the writer make about the smartphone in the opening paragraph?',
      options: [
        'It entertains people less well than books once did.',
        'It removes the moments in which boredom used to begin.',
        'It has made waiting rooms and queues unnecessary.',
        'It is used most heavily by people who are already bored.',
      ],
      answers: ['It removes the moments in which boredom used to begin.'],
      explanation: 'The phone entertains instantly, so the reach for nothing and the finding of nothing no longer occurs.',
    },
    {
      id: 'ac2-q33',
      number: 33,
      passageIndex: 2,
      type: 'multiple-choice',
      prompt: 'The writer describes brain-scanning research in order to suggest that',
      options: [
        'an unoccupied mind may be doing valuable work.',
        'daydreaming uses more energy than concentration.',
        'scanners cannot detect the activity of a resting brain.',
        'memory is stored in a single region of the brain.',
      ],
      answers: ['an unoccupied mind may be doing valuable work.'],
      explanation: 'With no task at all, activity moves into the default mode network — the machinery of daydreaming.',
    },
    {
      id: 'ac2-q34',
      number: 34,
      passageIndex: 2,
      type: 'multiple-choice',
      prompt: 'In what way does the writer say the feed differs from earlier entertainments?',
      options: [
        'It is cheaper than the novel, the radio or television.',
        'It has no natural stopping point.',
        'It requires less concentration than television.',
        'It is produced by its own audience.',
      ],
      answers: ['It has no natural stopping point.'],
      explanation: 'Earlier escapes had edges — the chapter ended, the programme finished — but the feed does not end.',
    },
    {
      id: 'ac2-q35',
      number: 35,
      passageIndex: 2,
      type: 'multiple-choice',
      prompt: 'Which of the following best states the writer’s conclusion?',
      options: [
        'Boredom should be reintroduced through organised digital breaks.',
        'Boredom is information, and the question is whether we still receive it.',
        'Boredom was never as common in the past as people believe.',
        'Boredom will disappear entirely within a generation.',
      ],
      answers: ['Boredom is information, and the question is whether we still receive it.'],
      explanation: 'The final paragraph rejects a programme in favour of a revaluation: boredom is information.',
    },

    /* ---------------------- passage 3: Q36–40 completion --------------------- */
    {
      id: 'ac2-q36',
      number: 36,
      passageIndex: 2,
      type: 'completion',
      maxWords: 2,
      prompt: 'Psychologists treat boredom as a ______ that an activity has lost its value.',
      answers: ['signal', 'message'],
      explanation: 'Not an empty state but a signal — an uncomfortable message that attention should be spent elsewhere.',
    },
    {
      id: 'ac2-q37',
      number: 37,
      passageIndex: 2,
      type: 'completion',
      maxWords: 3,
      prompt: 'A resting brain shifts its activity into what is called the ______ network.',
      answers: ['default mode'],
      explanation: 'The web of regions that busies itself with memory, imagined futures and other minds.',
    },
    {
      id: 'ac2-q38',
      number: 38,
      passageIndex: 2,
      type: 'completion',
      maxWords: 2,
      prompt: 'Researchers use the word ______ for the interval in which a set-aside problem ripens.',
      answers: ['incubation'],
      explanation: 'Its most familiar fruit is the good idea that arrives anywhere but at the desk.',
    },
    {
      id: 'ac2-q39',
      number: 39,
      passageIndex: 2,
      type: 'completion',
      maxWords: 2,
      prompt: 'In the ______ , spare attention is treated as raw material to be gathered and sold.',
      answers: ['attention economy'],
      explanation: 'A moment of mind-wandering is, from the seller’s side of the counter, stock walking out of the shop.',
    },
    {
      id: 'ac2-q40',
      number: 40,
      passageIndex: 2,
      type: 'completion',
      maxWords: 2,
      prompt: 'Chronic boredom is reported by people whose jobs are ______.',
      answers: ['monotonous'],
      explanation: 'The settled boredom of monotonous jobs is associated with anxiety, depression and risk-taking.',
    },
  ],
}
