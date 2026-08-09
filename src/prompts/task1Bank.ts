/**
 * Task 1 prompt bank: 12 IELTS Academic Writing Task 1 questions —
 * 4 line graphs, 3 bar charts, 2 pie charts, 2 tables, 1 process diagram.
 * Topics spread across technology, environment, culture, transport, education,
 * spending, waste, energy, water, employment and manufacturing.
 *
 * **The numbers in this file are the source of truth for the factual-accuracy
 * rules.** `t1-invented-figure` reports a learner error whenever they cite a
 * value that is not in `Task1ChartFacts.values`, so a typo here becomes a false
 * accusation shown to a correct learner. Every percentage set that should sum
 * to 100 does; `tests/task1-chart.test.ts` pins that and the index alignment
 * between each series and `categories`.
 *
 * Every `keywords` entry is a lowercase single content word: the content words
 * present in the prompt text, chart title, series names and category labels,
 * widened with the synonyms a good paraphrase would reach for — the analysis
 * rules use them for prompt-echo and relevance detection.
 */
import type { Task1PromptSpec } from '../types'

/** Standard Task 1 instruction — every prompt text ends with this, verbatim. */
const STANDARD_T1 =
  'Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.'

/** The three parts every data-chart answer must cover. */
const CORE_PARTS = [
  'Paraphrase the chart title in your own words',
  'State an overview of the main trend or the biggest difference',
  'Support the overview with specific figures from the chart',
]

/** Added when the chart carries two or more series. */
const COMPARE_PART = 'Compare the series directly rather than describing each in isolation'

export const TASK1_PROMPTS: Task1PromptSpec[] = [
  /* --------------------------------- line ---------------------------------- */
  {
    id: 't1-01',
    task: 'task1',
    topic: 'technology',
    text: `The graph below shows the percentage of households with internet access in three countries between 2005 and 2020. ${STANDARD_T1}`,
    chart: {
      kind: 'line',
      title: 'Households with internet access, 2005–2020',
      unit: '%',
      categories: ['2005', '2010', '2015', '2020'],
      series: [
        { name: 'Japan', values: [45, 68, 83, 91] },
        { name: 'Brazil', values: [12, 31, 54, 78] },
        { name: 'Nigeria', values: [4, 11, 26, 49] },
      ],
      subject: 'the share of households with an internet connection',
      periodLabel: 'between 2005 and 2020',
      steps: [],
      xLabel: 'Year',
      yLabel: 'Households (%)',
    },
    parts: [...CORE_PARTS, COMPARE_PART],
    keywords: ['households', 'internet', 'access', 'percentage', 'japan', 'brazil', 'nigeria', 'connectivity', 'broadband', 'growth', 'rose', 'gap', 'countries', 'homes'],
  },
  {
    id: 't1-02',
    task: 'task1',
    topic: 'environment',
    text: `The graph below shows carbon dioxide emissions per person in Canada and Sweden between 2000 and 2020. ${STANDARD_T1}`,
    chart: {
      kind: 'line',
      title: 'Carbon dioxide emissions per person, 2000–2020',
      unit: 'tonnes',
      categories: ['2000', '2005', '2010', '2015', '2020'],
      series: [
        { name: 'Canada', values: [17.2, 17.8, 16.1, 15.4, 14.2] },
        { name: 'Sweden', values: [6.1, 5.8, 5.2, 4.4, 3.8] },
      ],
      subject: 'carbon dioxide output per head of population',
      periodLabel: 'between 2000 and 2020',
      steps: [],
      xLabel: 'Year',
      yLabel: 'Tonnes per person',
    },
    parts: [...CORE_PARTS, COMPARE_PART],
    keywords: ['carbon', 'dioxide', 'emissions', 'person', 'canada', 'sweden', 'tonnes', 'pollution', 'fell', 'declined', 'capita', 'environment', 'climate'],
  },
  {
    id: 't1-03',
    task: 'task1',
    topic: 'culture',
    text: `The graph below shows cinema admissions in one European country between 1995 and 2020. ${STANDARD_T1}`,
    chart: {
      kind: 'line',
      title: 'Cinema admissions, 1995–2020',
      unit: 'million admissions',
      categories: ['1995', '2000', '2005', '2010', '2015', '2020'],
      series: [{ name: 'Admissions', values: [114, 143, 165, 169, 172, 44] }],
      subject: 'the number of cinema tickets sold',
      periodLabel: 'between 1995 and 2020',
      steps: [],
      xLabel: 'Year',
      yLabel: 'Admissions (millions)',
    },
    parts: CORE_PARTS,
    keywords: ['cinema', 'admissions', 'attendance', 'audiences', 'millions', 'films', 'peaked', 'collapsed', 'plateau', 'decline', 'viewers', 'tickets'],
  },
  {
    id: 't1-04',
    task: 'task1',
    topic: 'transport',
    text: `The graph below shows passenger journeys on two railway lines between 2010 and 2014. Figures for the Northern line in 2012 were not recorded. ${STANDARD_T1}`,
    chart: {
      kind: 'line',
      title: 'Rail passenger journeys by line, 2010–2014',
      unit: 'million journeys',
      categories: ['2010', '2011', '2012', '2013', '2014'],
      series: [
        { name: 'Northern line', values: [82, 90, null, 105, 118] },
        { name: 'Coastal line', values: [64, 61, 58, 52, 47] },
      ],
      subject: 'passenger journeys on two railway lines',
      periodLabel: 'between 2010 and 2014',
      steps: [],
      xLabel: 'Year',
      yLabel: 'Journeys (millions)',
    },
    parts: [...CORE_PARTS, COMPARE_PART],
    keywords: ['passenger', 'journeys', 'railway', 'lines', 'northern', 'coastal', 'commuters', 'rose', 'fell', 'diverged', 'trains', 'travel', 'unrecorded'],
  },

  /* ---------------------------------- bar ---------------------------------- */
  {
    id: 't1-05',
    task: 'task1',
    topic: 'education',
    text: `The chart below shows the main reason domestic and international students gave for choosing a university. ${STANDARD_T1}`,
    chart: {
      kind: 'bar',
      title: 'Main reason for choosing a university, by student group',
      unit: '%',
      categories: ['Course content', 'Reputation', 'Cost', 'Location', 'Facilities'],
      series: [
        { name: 'Domestic students', values: [38, 24, 19, 12, 7] },
        { name: 'International students', values: [31, 41, 9, 11, 8] },
      ],
      subject: 'the main reason students gave for picking a university',
      steps: [],
      xLabel: 'Reason given',
      yLabel: 'Respondents (%)',
    },
    parts: [...CORE_PARTS, COMPARE_PART],
    keywords: ['students', 'university', 'reason', 'domestic', 'international', 'course', 'content', 'reputation', 'cost', 'location', 'facilities', 'choosing', 'respondents'],
  },
  {
    id: 't1-06',
    task: 'task1',
    topic: 'spending',
    text: `The chart below shows average weekly household spending by category in one country. ${STANDARD_T1}`,
    chart: {
      kind: 'bar',
      title: 'Average weekly household spending by category',
      unit: '£',
      categories: ['Housing', 'Food', 'Transport', 'Leisure', 'Clothing'],
      series: [{ name: 'Weekly spending', values: [148, 96, 74, 58, 31] }],
      subject: 'what a typical household spends each week',
      steps: [],
      xLabel: 'Category',
      yLabel: 'Spending (£ per week)',
    },
    parts: CORE_PARTS,
    keywords: ['average', 'weekly', 'household', 'spending', 'expenditure', 'housing', 'food', 'transport', 'leisure', 'clothing', 'budget', 'category'],
  },
  {
    id: 't1-07',
    task: 'task1',
    topic: 'waste',
    text: `The chart below shows the proportion of household waste recycled in five European cities. ${STANDARD_T1}`,
    chart: {
      kind: 'bar',
      title: 'Household waste recycled, five European cities',
      unit: '%',
      categories: ['Oslo', 'Vienna', 'Munich', 'Cardiff', 'Naples'],
      series: [{ name: 'Waste recycled', values: [62, 58, 55, 51, 33] }],
      subject: 'the share of household rubbish that is recycled',
      steps: [],
      xLabel: 'City',
      yLabel: 'Waste recycled (%)',
    },
    parts: CORE_PARTS,
    keywords: ['household', 'waste', 'recycled', 'proportion', 'cities', 'oslo', 'vienna', 'munich', 'cardiff', 'naples', 'rates', 'rubbish', 'european'],
  },

  /* ---------------------------------- pie ---------------------------------- */
  {
    id: 't1-08',
    task: 'task1',
    topic: 'energy',
    text: `The chart below shows how energy is used in an average household in one country. ${STANDARD_T1}`,
    chart: {
      kind: 'pie',
      title: 'Household energy use by purpose',
      unit: '%',
      categories: ['Space heating', 'Water heating', 'Appliances', 'Lighting', 'Cooking'],
      series: [{ name: 'Share of energy use', values: [52, 19, 15, 8, 6] }],
      subject: 'how a typical home uses its energy',
      steps: [],
    },
    parts: CORE_PARTS,
    keywords: ['energy', 'household', 'heating', 'water', 'appliances', 'lighting', 'cooking', 'share', 'proportion', 'consumption', 'electricity', 'average'],
  },
  {
    id: 't1-09',
    task: 'task1',
    topic: 'education',
    text: `The chart below shows what school leavers in one region did in the year after finishing school. ${STANDARD_T1}`,
    chart: {
      kind: 'pie',
      title: 'Destinations of school leavers one year after leaving',
      unit: '%',
      categories: ['University', 'Employment', 'Vocational training', 'Gap year', 'Unemployed'],
      series: [{ name: 'Share of leavers', values: [44, 27, 16, 9, 4] }],
      subject: 'what school leavers did in the year after leaving',
      steps: [],
    },
    parts: CORE_PARTS,
    keywords: ['school', 'leavers', 'destinations', 'university', 'employment', 'vocational', 'training', 'unemployed', 'region', 'proportion', 'graduates', 'work'],
  },

  /* --------------------------------- table --------------------------------- */
  {
    id: 't1-10',
    task: 'task1',
    topic: 'water',
    text: `The table below shows how water is used across three sectors in three world regions. ${STANDARD_T1}`,
    chart: {
      kind: 'table',
      title: 'Water use by sector and region',
      unit: '%',
      categories: ['Agriculture', 'Industry', 'Domestic'],
      series: [
        { name: 'South Asia', values: [88, 5, 7] },
        { name: 'Europe', values: [32, 53, 15] },
        { name: 'North America', values: [39, 48, 13] },
      ],
      subject: 'how water is divided between three sectors',
      steps: [],
      xLabel: 'Sector',
    },
    parts: [...CORE_PARTS, COMPARE_PART],
    keywords: ['water', 'sectors', 'regions', 'agriculture', 'industry', 'domestic', 'asia', 'europe', 'america', 'irrigation', 'consumption', 'share', 'usage'],
  },
  {
    id: 't1-11',
    task: 'task1',
    topic: 'employment',
    text: `The table below shows the share of workers employed in three sectors in one country in 1990 and 2020. ${STANDARD_T1}`,
    chart: {
      kind: 'table',
      title: 'Share of workers by sector, 1990 and 2020',
      unit: '%',
      categories: ['Agriculture', 'Manufacturing', 'Services'],
      series: [
        { name: '1990', values: [22, 34, 44] },
        { name: '2020', values: [8, 21, 71] },
      ],
      subject: 'the share of workers in each part of the economy',
      periodLabel: 'in 1990 and 2020',
      steps: [],
      xLabel: 'Sector',
    },
    parts: [...CORE_PARTS, COMPARE_PART],
    keywords: ['workers', 'employed', 'sectors', 'agriculture', 'manufacturing', 'services', 'workforce', 'share', 'shifted', 'employment', 'labour', 'economy'],
  },

  /* -------------------------------- process -------------------------------- */
  {
    id: 't1-12',
    task: 'task1',
    topic: 'manufacturing',
    text: `The diagram below shows how glass bottles are recycled and returned to shops. ${STANDARD_T1}`,
    chart: {
      kind: 'process',
      title: 'The glass bottle recycling process',
      unit: '',
      categories: [],
      series: [],
      subject: 'how used glass bottles are turned back into new ones',
      steps: [
        'Used bottles are collected from homes and bottle banks',
        'Glass is sorted by colour and washed',
        'Clean glass is crushed into small pieces called cullet',
        'Cullet is melted in a furnace at 1,500 degrees Celsius',
        'Molten glass is moulded into new bottles and jars',
        'New bottles are filled, labelled and delivered to shops',
      ],
    },
    parts: [
      'Paraphrase the diagram title in your own words',
      'State an overview: how many stages there are and where the process begins and ends',
      'Describe the stages in order, using sequencing language',
    ],
    keywords: ['glass', 'bottles', 'recycled', 'process', 'stages', 'collected', 'sorted', 'washed', 'crushed', 'cullet', 'melted', 'furnace', 'moulded', 'shops'],
  },
]

/** A random Task 1 prompt. Mirrors `randomPrompt()` in `prompts/bank.ts`. */
export function randomTask1Prompt(): Task1PromptSpec {
  const index = Math.floor(Math.random() * TASK1_PROMPTS.length)
  return TASK1_PROMPTS[index] ?? TASK1_PROMPTS[0]
}
