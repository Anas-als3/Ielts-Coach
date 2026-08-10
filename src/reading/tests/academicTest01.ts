/**
 * Academic Reading Test 1 — three passages, forty questions, sixty minutes.
 * Implements plan 010 "Content: one Academic test".
 *
 * ## Sources and licences
 *
 * | Passage | Text | Source | Licence |
 * |---|---|---|---|
 * | 1 | The Salt Roads | Original prose written for this project | Original work of this project |
 * | 2 | Reading the Rings | Original prose written for this project | Original work of this project |
 * | 3 | The Measure of a Second | Original prose written for this project | Original work of this project |
 *
 * **No text in this file is reproduced from any IELTS publisher.** Real exam
 * passages and question sets are University of Cambridge (UCLES) copyright and
 * cannot ship in an outward-facing app; the format is not copyrightable, so
 * this test follows the real paper's structure — 3 passages, 40 questions, a
 * rising difficulty curve — with prose and questions written from scratch. The
 * factual content is general knowledge (the salt trade, dendrochronology, the
 * definition of the SI second) stated in this project's own words; where a
 * passage cites a figure it is one that is widely published and stable, such as
 * the caesium-133 transition frequency that defines the second.
 *
 * ## Question distribution
 *
 * matching headings 6 · true/false/not given 9 · completion 9 ·
 * multiple choice 6 · matching information 5 · yes/no/not given 5 = 40.
 *
 * `tests/reading-marking.test.ts` pins the count at 40, checks every answer key
 * is non-empty, every multiple-choice key is one of its own options, and every
 * completion key fits its own word limit — the failure mode that matters here
 * is a key the learner cannot possibly satisfy.
 */
import type { ReadingHeading, ReadingTest } from '../types'

/** Join authored lines into one paragraph. Keeps prose readable in source. */
const prose = (...lines: string[]): string => lines.join(' ')

/* ------------------------------- passage 1 ---------------------------------- */

const P1_HEADINGS: ReadingHeading[] = [
  { id: 'i', text: 'Preserving food so that it could travel' },
  { id: 'ii', text: 'Why grain-eating societies needed salt' },
  { id: 'iii', text: 'The mines that were never exhausted' },
  { id: 'iv', text: 'A purchase no household could avoid' },
  { id: 'v', text: 'Three methods, three different costs' },
  { id: 'vi', text: 'Measuring distance in days of travel' },
  { id: 'vii', text: 'From treasure to bulk commodity' },
  { id: 'viii', text: 'Routes made valuable by a heavy cargo' },
  { id: 'ix', text: 'The health risks of eating too much salt' },
]

/* ------------------------------- passage 3 ---------------------------------- */

const P3_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

/* ---------------------------------- test ------------------------------------ */

export const ACADEMIC_TEST_01: ReadingTest = {
  id: 'reading-academic-01',
  module: 'academic',
  title: 'Academic Reading Test 1',
  passages: [
    {
      id: 'reading-academic-01-p1',
      number: 1,
      heading: 'Reading Passage 1',
      source: {
        description: 'Original prose written for this project',
        licence: 'Original work of this project',
      },
      texts: [
        {
          title: 'The Salt Roads',
          subtitle: 'How a cheap mineral organised trade, taxation and diet for three thousand years',
          paragraphs: [
            {
              label: 'A',
              text: prose(
                'Sodium is not optional. The human body loses it in sweat and urine and cannot',
                'manufacture a replacement, so every population has had to find a supply from',
                'somewhere. For hunters and herders the problem barely existed: meat, blood and',
                'milk carry enough sodium to keep a person alive without any deliberate effort.',
                'It was farming that created the shortage. A diet built on wheat, rice, maize or',
                'millet is poor in sodium and rich in potassium, which the body excretes together',
                'with sodium, so a village living on grain needs salt in a way that a village',
                'living on its herds does not. The spread of agriculture therefore produced,',
                'almost as a by-product, the first large and permanent demand for a mineral, and',
                'the first people willing to travel a very long way to obtain one.',
              ),
            },
            {
              label: 'B',
              text: prose(
                'There were only three ways to meet that demand, and each carried a different',
                'cost. Where ancient seas had dried out and left beds of rock salt underground,',
                'it could be cut like stone; the mines at Hallstatt in Austria were worked from',
                'at least 1000 BC, and the miners’ clothing and tools have survived in the',
                'workings because salt preserves almost everything it touches. Where the coast',
                'was hot, dry and windy, seawater could be led into shallow pans and left to the',
                'sun, which cost nothing but land and patience. Everywhere else, brine from',
                'inland springs had to be boiled over a fire, and there the arithmetic was',
                'brutal: producing a tonne of salt could consume several times its weight in',
                'wood. Inland producers were, in effect, selling their forests. When the timber',
                'near a spring ran out the works closed, whatever the demand.',
              ),
            },
            {
              label: 'C',
              text: prose(
                'Because salt is heavy and cheap in relation to its bulk, transport rather than',
                'production set its price, and the routes that carried it became some of the most',
                'valuable roads in the world. In West Africa, slabs cut at Taghaza in the Sahara',
                'were loaded onto camels and carried south to Timbuktu, where they met gold coming',
                'north; the rate of exchange was never the equal weights of legend, but it was',
                'close enough to make the crossing worth its considerable risk. In Italy, the Via',
                'Salaria ran inland from the Adriatic pans towards Rome. In northern Europe, the',
                'salt of Lüneburg travelled to Lübeck and from there into the whole Baltic trade.',
                'These roads were not built for salt alone, but salt was what justified maintaining',
                'them, and the towns along them grew rich on tolls rather than on the cargo itself.',
              ),
            },
            {
              label: 'D',
              text: prose(
                'A commodity that everyone must buy, and which is produced at a small number of',
                'identifiable places, is the easiest thing in the world to tax. States worked this',
                'out early. China operated a salt monopoly from the seventh century BC, and the',
                'revenue it produced at times exceeded half the imperial budget. In France, the',
                'gabelle obliged households in some provinces to buy a fixed quantity of salt each',
                'year at a price the crown set, while neighbouring provinces paid a fraction as',
                'much — an arrangement that created a smuggling industry and a body of resentment',
                'that outlived the tax itself. In India, a colonial salt tax and the prohibition on',
                'making salt privately gave Gandhi the target for the march to Dandi in 1930. In',
                'each case the grievance was not really about seasoning. It was about a government',
                'reaching into the one purchase nobody could refuse to make.',
              ),
            },
            {
              label: 'E',
              text: prose(
                'Salt’s other role was preservation, and this mattered far more than flavour.',
                'Meat and fish packed in salt lose the water that bacteria need, and can then be',
                'stored and moved. The consequence was that a catch could be eaten hundreds of',
                'kilometres from where it was landed, months after it was taken. Baltic herring,',
                'salted at sea and again in port, fed much of medieval northern Europe through the',
                'winter and through the long Church calendar of fast days. Salt cod from',
                'Newfoundland crossed the Atlantic in the other direction. Navies and armies ate',
                'salted provisions because nothing else kept, and the range of a fleet was in',
                'practice a question of how much preserved food it could load. Refrigeration has',
                'made all this invisible, but for most of recorded history the reach of a state’s',
                'power was limited by the reach of its salt barrel.',
              ),
            },
            {
              label: 'F',
              text: prose(
                'What ended the salt roads was not a change in appetite but a change in cost.',
                'Steam pumps and mechanised cutting made mining cheap in the nineteenth century;',
                'industrial chemistry then turned salt into a raw material for soda ash, chlorine',
                'and caustic soda, and the volumes involved dwarfed anything the dinner table had',
                'ever demanded. Today most salt produced never reaches food at all: it goes to',
                'chemical plants and, in cold countries, onto winter roads. Salt has become one of',
                'the cheapest bulk commodities on earth, which is precisely why its history is so',
                'easy to underestimate. The evidence is still in the map — in the English place',
                'names ending in -wich and the central European ones containing -hall, both of',
                'which mark places where brine was once boiled, and in roads that go where no',
                'modern traffic needs to go.',
              ),
            },
          ],
        },
      ],
    },
    {
      id: 'reading-academic-01-p2',
      number: 2,
      heading: 'Reading Passage 2',
      source: {
        description: 'Original prose written for this project',
        licence: 'Original work of this project',
      },
      texts: [
        {
          title: 'Reading the Rings',
          subtitle: 'Dendrochronology, and why counting is the least of it',
          paragraphs: [
            {
              text: prose(
                'In any climate with a marked growing season, a tree adds a layer of wood to its',
                'circumference each year. The wood formed in spring, when water is plentiful, is',
                'made of cells that are large and thin-walled, and it looks pale. The wood formed',
                'as the season closes is denser, its cells smaller and thicker-walled, and it looks',
                'dark. The boundary between one year’s dark wood and the next year’s pale wood is',
                'the line we call a ring. How wide that ring is depends on how good the year was,',
                'and — this is the point on which the whole discipline rests — what counts as a',
                'good year is much the same for every tree in a region.',
              ),
            },
            {
              text: prose(
                'The insight was made by Andrew Ellicott Douglass, an astronomer who began looking',
                'at tree rings in the first decade of the twentieth century in the hope of finding',
                'the sunspot cycle recorded in them. He did not settle that question, but he',
                'noticed something more useful: the sequence of wide and narrow rings in a living',
                'tree is a distinctive pattern, like a barcode, and the same pattern appears in',
                'timber cut nearby at any date the two lifespans overlap. A beam felled in 1650',
                'can therefore be matched to the outer rings of a tree that was alive in 1650 and',
                'is standing today, and the beam’s inner rings then reach further back, to be',
                'matched in turn against something older still. This overlapping procedure, called',
                'cross-dating, is what turns a stack of samples into a continuous calendar.',
              ),
            },
            {
              text: prose(
                'Cross-dating is also the reason that simply counting rings is not dating. A tree',
                'under severe stress may lay down no measurable ring at all in a given year, so a',
                'count comes out short. A tree whose growth pauses and restarts within one season',
                'may lay down a false ring, so a count comes out long. Neither error announces',
                'itself in a single sample. Only the failure of one sample’s pattern to fit the',
                'regional pattern reveals it, which is why a date derived from one piece of wood,',
                'however carefully counted, is not regarded as a date at all.',
              ),
            },
            {
              text: prose(
                'What the method buys is worth the trouble. Roof beams have dated cathedrals and',
                'farmhouses to the year, and sometimes to the season, of felling. Ships buried in',
                'Scandinavian harbours, panels behind Renaissance paintings and the timbers of',
                'stringed instruments have all been placed in time this way. The largest',
                'contribution, though, is to another method entirely: radiocarbon dating assumes a',
                'known concentration of carbon-14 in the atmosphere, and that concentration has in',
                'fact varied with solar activity and with the earth’s magnetic field. Wood of',
                'known calendar age, from chronologies built on bristlecone pines in the western',
                'United States and on oaks preserved in European river gravels which now extend',
                'back more than twelve thousand years, supplies the correction curve that turns a',
                'radiocarbon measurement into a date.',
              ),
            },
            {
              text: prose(
                'Rings can also be read as climate. Width is the crude signal; wood density,',
                'measured by X-ray, and the ratios of oxygen and carbon isotopes locked into the',
                'cellulose are finer ones. But a ring records the factor that limited growth, and',
                'nothing else. A tree on a dry slope is limited by rainfall and its rings are a',
                'record of drought; a tree at the cold treeline is limited by warmth and its rings',
                'are a record of summer temperature. Choosing where to take a core is therefore',
                'choosing which signal to receive, and a chronology assembled from the wrong sites',
                'will answer a question nobody asked.',
              ),
            },
            {
              text: prose(
                'The limits are real. The method needs a marked annual pause in growth, and many',
                'tropical species simply do not pause, so vast regions of the world are poorly',
                'served. Old wood survives only where it was kept dry, waterlogged or frozen, so',
                'the record is biased towards the places that preserve timber rather than the',
                'places that matter. And since about 1960 the ring widths of some high-latitude',
                'sites have stopped tracking rising summer temperature as they had for centuries',
                '— the so-called divergence problem. Several explanations have been offered, from',
                'drought stress to industrial pollution to a fault in the way the data are',
                'standardised, and none commands general agreement.',
              ),
            },
            {
              text: prose(
                'For all that, dendrochronology retains a property that is rare among the ways we',
                'date the past. Radiocarbon returns a probability distribution; luminescence and',
                'potassium-argon return a range with an error term attached. A cross-dated ring',
                'returns a calendar year, and if the bark is still on the sample it returns the',
                'year, and often the season, in which the axe went in.',
              ),
            },
          ],
        },
      ],
    },
    {
      id: 'reading-academic-01-p3',
      number: 3,
      heading: 'Reading Passage 3',
      source: {
        description: 'Original prose written for this project',
        licence: 'Original work of this project',
      },
      texts: [
        {
          title: 'The Measure of a Second',
          subtitle: 'Why the world’s most precise unit is also a negotiated one',
          paragraphs: [
            {
              label: 'A',
              text: prose(
                'Until the middle of the twentieth century the second was an astronomical',
                'quantity: one 86,400th part of a mean solar day. The definition had the great',
                'virtue of being available to anyone with a telescope, a clear sky and patience,',
                'and it tied the unit to the most conspicuous regularity in human experience. It',
                'was a sensible definition for as long as the turning earth was the steadiest',
                'clock anyone had, and for almost all of recorded history it was exactly that.',
              ),
            },
            {
              label: 'B',
              text: prose(
                'The earth, it turns out, is a mediocre clock. Tidal friction — the drag of the',
                'moon on the oceans — is lengthening the day by a couple of milliseconds a',
                'century, and shorter-term wobbles of a millisecond or so come from the seasonal',
                'exchange of angular momentum with the atmosphere and from slower motions in the',
                'liquid core. None of this was suspected while the planet was the reference,',
                'because a clock cannot be caught running slow by itself. It was the quartz',
                'oscillator, developed through the 1930s, that first kept time more steadily than',
                'the earth did; when quartz and the sky disagreed it gradually became clear that',
                'the fault lay with the sky.',
              ),
            },
            {
              label: 'C',
              text: prose(
                'Two redefinitions followed. In 1956 the second was pinned to a fraction of the',
                'tropical year 1900, a quantity that was stable but that took years of observation',
                'to realise in practice. In 1967 it was redefined again, this time as 9,192,631,770',
                'periods of the radiation emitted by a hyperfine transition in an atom of',
                'caesium-133 — a definition any properly built laboratory could realise in an',
                'afternoon. That number looks arbitrary, and it is not: it was chosen so that the',
                'new second matched the old one as closely as measurement then allowed. A',
                'redefinition is not meant to change the size of a unit. It changes only how the',
                'unit is realised, and the whole art of it lies in the continuity.',
              ),
            },
            {
              label: 'D',
              text: prose(
                'What the world was left with was two time scales that drift apart. UT1 follows',
                'the rotating earth; International Atomic Time does not, and by construction never',
                'will. Civil time, UTC, is the compromise between them: atomic in its rate, but',
                'stepped by a whole second whenever it threatens to stray more than 0.9 seconds',
                'from UT1. Those steps are leap seconds, and since the arrangement began in 1972',
                'twenty-seven of them have been inserted and none has ever been removed.',
              ),
            },
            {
              label: 'E',
              text: prose(
                'The case against leap seconds is practical rather than philosophical. A leap',
                'second cannot be calculated in advance, because the earth’s behaviour cannot be',
                'predicted; it is announced roughly six months ahead in a bulletin, which is an',
                'awkward amount of notice for systems built to run for decades. Software that',
                'assumes every minute contains sixty seconds misbehaves when one contains',
                'sixty-one, and outages at large online services in 2012 and again in 2015 were',
                'traced to exactly that assumption. The workarounds, such as spreading the extra',
                'second thinly across a whole day, are ingenious and mean that machines which are',
                'supposed to agree on the time do not. In 2022 the General Conference on Weights',
                'and Measures resolved to stop inserting leap seconds by 2035, and it was right',
                'to do so.',
              ),
            },
            {
              label: 'F',
              text: prose(
                'The objection is that the drift will accumulate. Left uncorrected, atomic time',
                'and solar time part company by a minute or so every few centuries, and eventually',
                'civil noon and the sun overhead will be visibly different events; astronomers and',
                'several national delegations have said so with feeling. The complaint is weaker',
                'than it sounds, because civil time gave up on the sun long ago. A time zone is a',
                'fiction an hour wide, and a person living at its western edge already eats lunch',
                'well before the sun is overhead; daylight saving then moves an entire country an',
                'hour away from the sun twice a year, on purpose, and nobody calls it a scandal. A',
                'minute of accumulated drift over five hundred years is a smaller untruth than the',
                'one most countries tell every summer.',
              ),
            },
            {
              label: 'G',
              text: prose(
                'The next redefinition is already visible. Optical clocks, in which strontium or',
                'ytterbium atoms are held in a lattice of laser light and interrogated at optical',
                'rather than microwave frequencies, are roughly a hundred times more stable than',
                'the caesium standard, and a new definition of the second built on one of them is',
                'expected some time in the 2030s. The interesting question it raises is not about',
                'precision. It is about authority: which laboratories will realise the new second,',
                'how their results will be combined, and who will be entitled to say that a clock',
                'is wrong. The second is maintained by a treaty organisation and a network of',
                'national laboratories that agree, month by month, on what time it is. It is a',
                'standard, and a standard is a social object that happens to be made of physics.',
              ),
            },
          ],
        },
      ],
    },
  ],
  questions: [
    /* ------------------------ passage 1: Q1–6 headings ----------------------- */
    {
      id: 'ac1-q01',
      number: 1,
      passageIndex: 0,
      type: 'matching-headings',
      paragraph: 'A',
      headings: P1_HEADINGS,
      prompt: 'Paragraph A',
      answers: ['ii'],
      explanation: 'Paragraph A explains that a grain diet, unlike a herding diet, leaves people short of sodium.',
    },
    {
      id: 'ac1-q02',
      number: 2,
      passageIndex: 0,
      type: 'matching-headings',
      paragraph: 'B',
      headings: P1_HEADINGS,
      prompt: 'Paragraph B',
      answers: ['v'],
      explanation: 'Paragraph B sets out mining, solar evaporation and boiling, and what each one costs.',
    },
    {
      id: 'ac1-q03',
      number: 3,
      passageIndex: 0,
      type: 'matching-headings',
      paragraph: 'C',
      headings: P1_HEADINGS,
      prompt: 'Paragraph C',
      answers: ['viii'],
      explanation: 'Paragraph C is about the trade routes and why a heavy, cheap cargo made them valuable.',
    },
    {
      id: 'ac1-q04',
      number: 4,
      passageIndex: 0,
      type: 'matching-headings',
      paragraph: 'D',
      headings: P1_HEADINGS,
      prompt: 'Paragraph D',
      answers: ['iv'],
      explanation: 'Paragraph D is about salt taxes and monopolies imposed on a purchase nobody could avoid.',
    },
    {
      id: 'ac1-q05',
      number: 5,
      passageIndex: 0,
      type: 'matching-headings',
      paragraph: 'E',
      headings: P1_HEADINGS,
      prompt: 'Paragraph E',
      answers: ['i'],
      explanation: 'Paragraph E is about salting fish and meat so that food could be stored and moved.',
    },
    {
      id: 'ac1-q06',
      number: 6,
      passageIndex: 0,
      type: 'matching-headings',
      paragraph: 'F',
      headings: P1_HEADINGS,
      prompt: 'Paragraph F',
      answers: ['vii'],
      explanation: 'Paragraph F traces salt from a precious substance to one of the cheapest bulk commodities.',
    },

    /* ----------------------- passage 1: Q7–9 completion ---------------------- */
    {
      id: 'ac1-q07',
      number: 7,
      passageIndex: 0,
      type: 'completion',
      maxWords: 2,
      prompt: 'Producers who boiled brine inland were limited above all by their supply of ______.',
      answers: ['wood', 'timber'],
      explanation: 'Paragraph B: a tonne of salt could consume several times its weight in wood, and works closed when the timber ran out.',
    },
    {
      id: 'ac1-q08',
      number: 8,
      passageIndex: 0,
      type: 'completion',
      maxWords: 2,
      prompt: 'Salt cut at Taghaza was carried south to Timbuktu by ______.',
      answers: ['camels', 'camel'],
      explanation: 'Paragraph C: slabs cut at Taghaza were loaded onto camels and carried south.',
    },
    {
      id: 'ac1-q09',
      number: 9,
      passageIndex: 0,
      type: 'completion',
      maxWords: 2,
      prompt: 'Most salt produced today goes to ______ or onto roads in winter.',
      answers: ['chemical plants'],
      explanation: 'Paragraph F: it goes to chemical plants and, in cold countries, onto winter roads.',
    },

    /* ------------------------- passage 1: Q10–13 TFNG ------------------------ */
    {
      id: 'ac1-q10',
      number: 10,
      passageIndex: 0,
      type: 'true-false-notgiven',
      prompt: 'Herding peoples had to work harder than farming peoples to obtain enough sodium.',
      answers: ['FALSE'],
      explanation: 'Paragraph A says the opposite: for herders the problem barely existed, and farming created the shortage.',
    },
    {
      id: 'ac1-q11',
      number: 11,
      passageIndex: 0,
      type: 'true-false-notgiven',
      prompt: 'Belongings of the miners at Hallstatt have been recovered from the workings.',
      answers: ['TRUE'],
      explanation: 'Paragraph B: the miners’ clothing and tools have survived in the workings.',
    },
    {
      id: 'ac1-q12',
      number: 12,
      passageIndex: 0,
      type: 'true-false-notgiven',
      prompt: 'At Timbuktu salt was traded for gold weight for weight.',
      answers: ['FALSE'],
      explanation: 'Paragraph C: the rate of exchange was never the equal weights of legend.',
    },
    {
      id: 'ac1-q13',
      number: 13,
      passageIndex: 0,
      type: 'true-false-notgiven',
      prompt: 'The Chinese salt monopoly raised more revenue than the French gabelle did.',
      answers: ['NOT GIVEN'],
      explanation: 'Paragraph D describes both, but never compares what they raised.',
    },

    /* ------------------------- passage 2: Q14–18 TFNG ------------------------ */
    {
      id: 'ac1-q14',
      number: 14,
      passageIndex: 1,
      type: 'true-false-notgiven',
      prompt: 'Douglass first studied tree rings in order to date wooden buildings.',
      answers: ['FALSE'],
      explanation: 'He was an astronomer hoping to find the sunspot cycle recorded in the rings.',
    },
    {
      id: 'ac1-q15',
      number: 15,
      passageIndex: 1,
      type: 'true-false-notgiven',
      prompt: 'Every year of a tree’s life leaves exactly one ring.',
      answers: ['FALSE'],
      explanation: 'A stressed tree may add no measurable ring, and an interrupted season may add a false one.',
    },
    {
      id: 'ac1-q16',
      number: 16,
      passageIndex: 1,
      type: 'true-false-notgiven',
      prompt: 'European oak chronologies reach further back in time than bristlecone pine chronologies.',
      answers: ['NOT GIVEN'],
      explanation: 'The passage gives a combined figure for both and never compares the two.',
    },
    {
      id: 'ac1-q17',
      number: 17,
      passageIndex: 1,
      type: 'true-false-notgiven',
      prompt: 'Radiocarbon dates need correction because atmospheric carbon-14 has not been constant.',
      answers: ['TRUE'],
      explanation: 'The concentration has varied with solar activity and the earth’s magnetic field.',
    },
    {
      id: 'ac1-q18',
      number: 18,
      passageIndex: 1,
      type: 'true-false-notgiven',
      prompt: 'Researchers now agree on the cause of the divergence problem.',
      answers: ['FALSE'],
      explanation: 'Several explanations have been offered and none commands general agreement.',
    },

    /* ---------------------- passage 2: Q19–22 completion --------------------- */
    {
      id: 'ac1-q19',
      number: 19,
      passageIndex: 1,
      type: 'completion',
      maxWords: 3,
      prompt: 'Wood formed in spring is pale because its cells are large and ______.',
      answers: ['thin-walled', 'thin walled'],
      explanation: 'Paragraph 1: cells that are large and thin-walled, and it looks pale.',
    },
    {
      id: 'ac1-q20',
      number: 20,
      passageIndex: 1,
      type: 'completion',
      maxWords: 3,
      prompt: 'Matching the ring pattern of one sample against another is called ______.',
      answers: ['cross-dating', 'cross dating', 'crossdating'],
      explanation: 'The overlapping procedure that turns samples into a continuous calendar.',
    },
    {
      id: 'ac1-q21',
      number: 21,
      passageIndex: 1,
      type: 'completion',
      maxWords: 3,
      prompt: 'The rings of a tree growing at the cold treeline record summer ______.',
      answers: ['temperature', 'temperatures'],
      explanation: 'A ring records whatever limited growth; at the treeline that is warmth.',
    },
    {
      id: 'ac1-q22',
      number: 22,
      passageIndex: 1,
      type: 'completion',
      maxWords: 3,
      prompt: 'Wood of known calendar age supplies the ______ that turns a radiocarbon measurement into a date.',
      answers: ['correction curve'],
      explanation: 'Paragraph 4: the correction curve is the largest contribution the method makes to another discipline.',
    },

    /* ------------------------- passage 2: Q23–26 MCQ ------------------------- */
    {
      id: 'ac1-q23',
      number: 23,
      passageIndex: 1,
      type: 'multiple-choice',
      prompt: 'What does the writer identify as the central weakness of dating a sample by counting its rings?',
      options: [
        'Rings cannot be seen without a microscope.',
        'A tree may add no measurable ring in a bad year.',
        'The bark is usually missing from old timber.',
        'Rings grow narrower as a tree ages.',
      ],
      answers: ['A tree may add no measurable ring in a bad year.'],
      explanation: 'Missing and false rings make a raw count unreliable; only cross-dating exposes them.',
    },
    {
      id: 'ac1-q24',
      number: 24,
      passageIndex: 1,
      type: 'multiple-choice',
      prompt: 'According to the passage, the choice of sampling site determines',
      options: [
        'how far back the chronology can reach.',
        'which climate signal the rings record.',
        'how many samples will be needed.',
        'whether cross-dating is possible at all.',
      ],
      answers: ['which climate signal the rings record.'],
      explanation: 'A ring records the limiting factor, so a dry slope gives rainfall and a treeline gives temperature.',
    },
    {
      id: 'ac1-q25',
      number: 25,
      passageIndex: 1,
      type: 'multiple-choice',
      prompt: 'Why is the method of limited use across much of the tropics?',
      options: [
        'Few tropical trees live long enough to be useful.',
        'Tropical timber decays before it can be sampled.',
        'Many tropical species grow without an annual pause.',
        'Tropical rainfall varies too little from year to year.',
      ],
      answers: ['Many tropical species grow without an annual pause.'],
      explanation: 'The method needs a marked annual pause in growth, and many tropical species do not pause.',
    },
    {
      id: 'ac1-q26',
      number: 26,
      passageIndex: 1,
      type: 'multiple-choice',
      prompt: 'What does the writer present as unusual about dendrochronology among dating methods?',
      options: [
        'It is much cheaper than the alternatives.',
        'It can always be checked against written records.',
        'It returns a single calendar year rather than a range.',
        'It can be applied to materials other than wood.',
      ],
      answers: ['It returns a single calendar year rather than a range.'],
      explanation: 'Radiocarbon returns a distribution; a cross-dated ring returns the year itself.',
    },

    /* ------------------ passage 3: Q27–31 matching information ---------------- */
    {
      id: 'ac1-q27',
      number: 27,
      passageIndex: 2,
      type: 'matching-information',
      paragraphLabels: P3_LABELS,
      prompt: 'a reference to how much warning is given before a leap second is added',
      answers: ['E'],
      explanation: 'Paragraph E: it is announced roughly six months ahead in a bulletin.',
    },
    {
      id: 'ac1-q28',
      number: 28,
      passageIndex: 2,
      type: 'matching-information',
      paragraphLabels: P3_LABELS,
      prompt: 'an explanation of why a redefinition was designed not to alter the length of the unit',
      answers: ['C'],
      explanation: 'Paragraph C: the number was chosen so the new second matched the old one.',
    },
    {
      id: 'ac1-q29',
      number: 29,
      passageIndex: 2,
      type: 'matching-information',
      paragraphLabels: P3_LABELS,
      prompt: 'an account of how the unevenness of the earth’s rotation came to be detected',
      answers: ['B'],
      explanation: 'Paragraph B: quartz oscillators kept time more steadily than the earth did.',
    },
    {
      id: 'ac1-q30',
      number: 30,
      passageIndex: 2,
      type: 'matching-information',
      paragraphLabels: P3_LABELS,
      prompt: 'a comparison between two ways in which civil time is already detached from the sun',
      answers: ['F'],
      explanation: 'Paragraph F: time zones an hour wide, and daylight saving.',
    },
    {
      id: 'ac1-q31',
      number: 31,
      passageIndex: 2,
      type: 'matching-information',
      paragraphLabels: P3_LABELS,
      prompt: 'a technology expected to prompt a further redefinition of the second',
      answers: ['G'],
      explanation: 'Paragraph G: optical clocks using strontium or ytterbium.',
    },

    /* ------------------------- passage 3: Q32–36 YNNG ------------------------ */
    {
      id: 'ac1-q32',
      number: 32,
      passageIndex: 2,
      type: 'yes-no-notgiven',
      prompt: 'Defining the second by the rotation of the earth was a mistake from the outset.',
      answers: ['NO'],
      explanation: 'Paragraph A calls it a sensible definition for as long as the earth was the steadiest clock available.',
    },
    {
      id: 'ac1-q33',
      number: 33,
      passageIndex: 2,
      type: 'yes-no-notgiven',
      prompt: 'The decision to stop inserting leap seconds was correct.',
      answers: ['YES'],
      explanation: 'Paragraph E: it was right to do so.',
    },
    {
      id: 'ac1-q34',
      number: 34,
      passageIndex: 2,
      type: 'yes-no-notgiven',
      prompt: 'The objections to abolishing leap seconds carry less force than they appear to.',
      answers: ['YES'],
      explanation: 'Paragraph F: the complaint is weaker than it sounds.',
    },
    {
      id: 'ac1-q35',
      number: 35,
      passageIndex: 2,
      type: 'yes-no-notgiven',
      prompt: 'Optical clocks will cost more to operate than the caesium standards they replace.',
      answers: ['NOT GIVEN'],
      explanation: 'Paragraph G discusses their stability and the authority question, never their running costs.',
    },
    {
      id: 'ac1-q36',
      number: 36,
      passageIndex: 2,
      type: 'yes-no-notgiven',
      prompt: 'What counts as a second is settled in the end by agreement rather than by nature.',
      answers: ['YES'],
      explanation: 'Paragraph G: a standard is a social object that happens to be made of physics.',
    },

    /* ------------------------- passage 3: Q37–38 MCQ ------------------------- */
    {
      id: 'ac1-q37',
      number: 37,
      passageIndex: 2,
      type: 'multiple-choice',
      prompt: 'What changed in 1972?',
      options: [
        'Caesium clocks replaced quartz clocks in laboratories.',
        'Civil time began to be adjusted in whole-second steps.',
        'The second was first defined by the tropical year.',
        'The rotation of the earth began to slow.',
      ],
      answers: ['Civil time began to be adjusted in whole-second steps.'],
      explanation: 'Paragraph D: since the arrangement began in 1972, twenty-seven leap seconds have been inserted.',
    },
    {
      id: 'ac1-q38',
      number: 38,
      passageIndex: 2,
      type: 'multiple-choice',
      prompt: 'The writer says the main practical difficulty with leap seconds is that',
      options: [
        'they are too small to be measured reliably.',
        'they cannot be scheduled far in advance.',
        'different countries apply them on different dates.',
        'they interfere with astronomical observation.',
      ],
      answers: ['they cannot be scheduled far in advance.'],
      explanation: 'Paragraph E: a leap second cannot be calculated in advance and is announced about six months ahead.',
    },

    /* ---------------------- passage 3: Q39–40 completion --------------------- */
    {
      id: 'ac1-q39',
      number: 39,
      passageIndex: 2,
      type: 'completion',
      maxWords: 2,
      prompt: 'The long-term lengthening of the day is caused mainly by ______.',
      answers: ['tidal friction'],
      explanation: 'Paragraph B: tidal friction, the drag of the moon on the oceans.',
    },
    {
      id: 'ac1-q40',
      number: 40,
      passageIndex: 2,
      type: 'completion',
      maxWords: 2,
      prompt: 'UTC is never allowed to stray from UT1 by more than ______.',
      answers: ['0.9 seconds', '0.9 second'],
      explanation: 'Paragraph D: stepped by a whole second whenever it threatens to stray more than 0.9 seconds from UT1.',
    },
  ],
}
