/**
 * Prompt bank: 40 realistic IELTS Writing Task 2 prompts, 8 per question type,
 * topics spread across education, technology, environment, health, society,
 * work, government, culture, transport, media.
 *
 * Every `keywords` entry is a lowercase single content word: the content words
 * actually present in the prompt text, widened with topical synonyms, hyponyms
 * and actor nouns a good paraphrasing answer would plausibly use — the analysis
 * rules use them for prompt-echo, off-topic and question-coverage detection.
 *
 * ## The tagging rule for `modules`
 *
 * Task 2 is MARKED identically in Academic and General Training — same criteria,
 * same 250 words, same 40 minutes. What differs is the topic: General Training
 * asks about matters of everyday general interest, Academic is free to ask about
 * abstract, policy and research-flavoured ones. So the tag is a statement about
 * the QUESTION, never about the engine.
 *
 * Tag a prompt `['academic', 'general']` when an ordinary adult could answer it
 * from lived experience: school, work, family, health, transport, shopping,
 * everyday technology, the local environment.
 *
 * Tag it `['academic']` only when answering it well needs a specialist or
 * theoretical frame that General Training does not ask for — economic policy,
 * demography, redistribution and taxation theory, arts funding policy, platform
 * and data regulation, biodiversity science, political participation,
 * globalisation. When in doubt, tag BOTH: over-restricting the General pool
 * silently narrows a learner's practice, which is the worse failure.
 *
 * 12 of the 40 are Academic-only on this rule, leaving 28 for General Training.
 */
import type { Module, PromptSpec } from '../types'

/** Standard Task 2 instruction — every prompt text ends with this, verbatim. */
const STANDARD =
  'Give reasons for your answer and include any relevant examples from your own knowledge or experience. Write at least 250 words.'

export const PROMPTS: PromptSpec[] = [
  /* ------------------------------- opinion -------------------------------- */
  {
    id: 'op-01',
    type: 'opinion',
    topic: 'education',
    text: `Some people believe that university education should be free for all students, regardless of their financial background. To what extent do you agree or disagree? ${STANDARD}`,
    parts: [
      'State clearly how far you agree that university education should be free',
      'Give reasons that deal with cost, access or fairness',
      'Restate your position in the conclusion',
    ],
    keywords: ['university', 'education', 'free', 'students', 'financial', 'background', 'tuition', 'fees', 'scholarships', 'degree', 'graduates', 'funding', 'taxpayers', 'affordable'],
    modules: ['academic', 'general'],
  },
  {
    id: 'op-02',
    type: 'opinion',
    topic: 'technology',
    text: `Some people argue that children under sixteen should not own smartphones because these devices damage concentration and social development. To what extent do you agree or disagree? ${STANDARD}`,
    parts: [
      'Take a clear position on whether young people should own smartphones',
      'Explain the effects on concentration and social development as you see them',
      'Answer the strongest argument from the other side',
    ],
    keywords: ['children', 'sixteen', 'smartphones', 'devices', 'damage', 'concentration', 'social', 'development', 'phones', 'screens', 'teenagers', 'addiction', 'distraction', 'apps', 'parents'],
    modules: ['academic', 'general'],
  },
  {
    id: 'op-03',
    type: 'opinion',
    topic: 'environment',
    text: `Some people say that individuals can do very little to protect the environment, and that only governments and large companies can make a real difference. To what extent do you agree or disagree? ${STANDARD}`,
    parts: [
      'State how far you agree that only governments and companies can help',
      'Weigh individual actions against large-scale action',
      'Keep one consistent position from introduction to conclusion',
    ],
    keywords: ['individuals', 'protect', 'environment', 'governments', 'companies', 'difference', 'recycling', 'pollution', 'emissions', 'climate', 'plastic', 'corporations', 'carbon'],
    modules: ['academic', 'general'],
  },
  {
    id: 'op-04',
    type: 'opinion',
    topic: 'health',
    text: `Some people believe that the money governments spend on treating illness would be better spent on preventing it through health education and early checks. To what extent do you agree or disagree? ${STANDARD}`,
    parts: [
      'State whether prevention deserves more funding than treatment',
      'Support your view with reasons about costs and outcomes',
      'Acknowledge what would be lost on the other side',
    ],
    keywords: ['money', 'governments', 'treating', 'illness', 'preventing', 'health', 'education', 'prevention', 'hospitals', 'doctors', 'vaccination', 'screening', 'exercise', 'disease'],
    modules: ['academic', 'general'],
  },
  {
    id: 'op-05',
    type: 'opinion',
    topic: 'work',
    text: `Some people think that job satisfaction is more important than a high salary when choosing a career. To what extent do you agree or disagree? ${STANDARD}`,
    parts: [
      'State whether satisfaction or salary matters more, and how strongly',
      'Give reasons drawn from working life, not just theory',
      'Restate your view clearly in the conclusion',
    ],
    keywords: ['job', 'satisfaction', 'important', 'salary', 'choosing', 'career', 'work', 'wages', 'income', 'pay', 'fulfilment', 'motivation', 'workplace', 'passion'],
    modules: ['academic', 'general'],
  },
  {
    id: 'op-06',
    type: 'opinion',
    topic: 'government',
    text: `Some people believe that governments should tax the wealthiest citizens at a much higher rate in order to reduce inequality. To what extent do you agree or disagree? ${STANDARD}`,
    parts: [
      'Take a clear position on higher taxes for the wealthiest',
      'Explain the effect you expect on inequality',
      'Deal with one strong objection to your view',
    ],
    keywords: ['governments', 'tax', 'wealthiest', 'citizens', 'higher', 'rate', 'reduce', 'inequality', 'taxation', 'wealth', 'rich', 'poor', 'redistribution', 'revenue', 'billionaires'],
    modules: ['academic'],
  },
  {
    id: 'op-07',
    type: 'opinion',
    topic: 'media',
    text: `Advertising strongly influences what people choose to buy. Some people argue that all advertising aimed at young children should therefore be banned. To what extent do you agree or disagree? ${STANDARD}`,
    parts: [
      'State how far you agree with a ban on advertising to children',
      'Explain how advertising affects children, with examples',
      'Consider whether a full ban is practical',
    ],
    keywords: ['advertising', 'influences', 'buy', 'young', 'children', 'banned', 'adverts', 'commercials', 'marketing', 'brands', 'toys', 'consumers', 'regulation'],
    modules: ['academic', 'general'],
  },
  {
    id: 'op-08',
    type: 'opinion',
    topic: 'transport',
    text: `Some people think that governments should spend money on improving public transport rather than on building new roads for private cars. To what extent do you agree or disagree? ${STANDARD}`,
    parts: [
      'State whether public transport or new roads should come first',
      'Compare the two options: cost, congestion, fairness',
      'Hold one position throughout the essay',
    ],
    keywords: ['governments', 'money', 'public', 'transport', 'building', 'roads', 'cars', 'buses', 'trains', 'metro', 'congestion', 'commuters', 'traffic', 'infrastructure'],
    modules: ['academic', 'general'],
  },

  /* ------------------------------ discussion ------------------------------ */
  {
    id: 'di-01',
    type: 'discussion',
    topic: 'education',
    text: `Some people think that children should begin formal education as early as possible, while others believe formal lessons should not start before the age of seven. Discuss both these views and give your own opinion. ${STANDARD}`,
    parts: [
      'Discuss the case for an early start to formal education',
      'Discuss the case for waiting until age seven',
      'State your own opinion clearly, not just both sides',
    ],
    keywords: ['children', 'formal', 'education', 'early', 'lessons', 'start', 'age', 'seven', 'kindergarten', 'play', 'schooling', 'pupils', 'literacy', 'childhood', 'curriculum'],
    modules: ['academic', 'general'],
  },
  {
    id: 'di-02',
    type: 'discussion',
    topic: 'technology',
    text: `Some people believe that social media helps people stay connected and share ideas, while others argue that it leaves individuals more isolated and anxious. Discuss both these views and give your own opinion. ${STANDARD}`,
    parts: [
      'Discuss how social media connects people',
      'Discuss how it can isolate people',
      'Give your own verdict and support it',
    ],
    keywords: ['social', 'media', 'connected', 'share', 'ideas', 'individuals', 'isolated', 'anxious', 'networks', 'online', 'platforms', 'loneliness', 'friendship', 'communication', 'screens'],
    modules: ['academic', 'general'],
  },
  {
    id: 'di-03',
    type: 'discussion',
    topic: 'environment',
    text: `Some people argue that continued economic growth is the only way to end poverty, while others believe that growth is damaging the environment and must be slowed. Discuss both these views and give your own opinion. ${STANDARD}`,
    parts: [
      'Discuss growth as a route out of poverty',
      'Discuss the environmental cost of growth',
      'State which argument you find stronger and why',
    ],
    keywords: ['economic', 'growth', 'poverty', 'environment', 'damaging', 'slowed', 'pollution', 'emissions', 'industry', 'sustainability', 'resources', 'climate', 'factories'],
    modules: ['academic'],
  },
  {
    id: 'di-04',
    type: 'discussion',
    topic: 'health',
    text: `Some people think that public money for health should go into treating people who are already ill, while others believe it should fund campaigns that promote healthy lifestyles. Discuss both these views and give your own opinion. ${STANDARD}`,
    parts: [
      'Discuss the case for spending on treatment',
      'Discuss the case for promoting healthy lifestyles',
      'Give your own opinion on the balance',
    ],
    keywords: ['public', 'money', 'health', 'treating', 'ill', 'campaigns', 'promote', 'healthy', 'lifestyles', 'prevention', 'hospitals', 'exercise', 'diet', 'smoking', 'obesity', 'awareness'],
    modules: ['academic', 'general'],
  },
  {
    id: 'di-05',
    type: 'discussion',
    topic: 'work',
    text: `Some people believe that employees work best from home, while others maintain that a shared office is essential for teamwork and productivity. Discuss both these views and give your own opinion. ${STANDARD}`,
    parts: [
      'Discuss the benefits of working from home',
      'Discuss what a shared office provides',
      'State your own opinion with a clear reason',
    ],
    keywords: ['employees', 'work', 'home', 'shared', 'office', 'teamwork', 'productivity', 'remote', 'commuting', 'collaboration', 'colleagues', 'flexibility', 'meetings', 'workplace'],
    modules: ['academic', 'general'],
  },
  {
    id: 'di-06',
    type: 'discussion',
    topic: 'culture',
    text: `Some people think that governments should fund museums, theatres and orchestras, while others believe the arts should survive on ticket sales and private donations. Discuss both these views and give your own opinion. ${STANDARD}`,
    parts: [
      'Discuss the case for public funding of the arts',
      'Discuss the case for private funding',
      'Give your own opinion and defend it',
    ],
    keywords: ['governments', 'fund', 'museums', 'theatres', 'orchestras', 'arts', 'ticket', 'sales', 'private', 'donations', 'culture', 'subsidies', 'artists', 'galleries', 'concerts', 'heritage', 'audiences'],
    modules: ['academic'],
  },
  {
    id: 'di-07',
    type: 'discussion',
    topic: 'society',
    text: `Some people believe that long prison sentences are the best response to serious crime, while others think that education and community programmes do more to prevent reoffending. Discuss both these views and give your own opinion. ${STANDARD}`,
    parts: [
      'Discuss the argument for long prison sentences',
      'Discuss education and community programmes as alternatives',
      'State your own opinion on what works best',
    ],
    keywords: ['prison', 'sentences', 'crime', 'education', 'community', 'programmes', 'prevent', 'reoffending', 'offenders', 'punishment', 'rehabilitation', 'custody', 'deterrent', 'criminals', 'jail', 'justice'],
    modules: ['academic', 'general'],
  },
  {
    id: 'di-08',
    type: 'discussion',
    topic: 'transport',
    text: `Some people think that private cars should be banned from busy city centres, while others believe drivers should be free to travel wherever they choose. Discuss both these views and give your own opinion. ${STANDARD}`,
    parts: [
      'Discuss the case for banning cars from city centres',
      "Discuss the case for drivers' freedom",
      'Give your own opinion and justify it',
    ],
    keywords: ['private', 'cars', 'banned', 'busy', 'city', 'centres', 'drivers', 'travel', 'pollution', 'congestion', 'pedestrians', 'cycling', 'buses', 'emissions', 'parking'],
    modules: ['academic', 'general'],
  },

  /* --------------------------- problem / solution -------------------------- */
  {
    id: 'ps-01',
    type: 'problem-solution',
    topic: 'environment',
    text: `In many countries, the amount of household rubbish and plastic waste grows every year. What problems does this cause? What measures could be taken to reduce the waste we produce? ${STANDARD}`,
    parts: [
      'Name specific problems caused by growing waste',
      'Propose realistic measures to reduce it',
      'Connect each measure to a problem it solves',
    ],
    keywords: ['household', 'rubbish', 'plastic', 'waste', 'grows', 'reduce', 'produce', 'recycling', 'landfill', 'pollution', 'packaging', 'litter', 'bins', 'disposal'],
    modules: ['academic', 'general'],
  },
  {
    id: 'ps-02',
    type: 'problem-solution',
    topic: 'transport',
    text: `Traffic congestion in large cities is becoming more severe, and many commuters lose hours every week on crowded roads. What problems does this cause? What measures could governments take to improve the situation? ${STANDARD}`,
    parts: [
      'Describe the problems congestion causes for people and the economy',
      'Propose measures a government could actually take',
      'Show how your measures would ease the problems',
    ],
    keywords: ['traffic', 'congestion', 'cities', 'severe', 'commuters', 'crowded', 'roads', 'governments', 'cars', 'vehicles', 'transport', 'buses', 'pollution', 'tolls', 'cycling'],
    modules: ['academic', 'general'],
  },
  {
    id: 'ps-03',
    type: 'problem-solution',
    topic: 'education',
    text: `In some countries, many young people leave school without the ability to read, write or handle numbers confidently. What problems does this cause? What measures could be taken to improve basic skills? ${STANDARD}`,
    parts: [
      'Explain the problems weak basic skills cause for individuals and society',
      'Suggest measures schools or governments could take',
    ],
    keywords: ['young', 'school', 'read', 'write', 'numbers', 'basic', 'skills', 'literacy', 'numeracy', 'illiteracy', 'teachers', 'pupils', 'education', 'employment'],
    modules: ['academic', 'general'],
  },
  {
    id: 'ps-04',
    type: 'problem-solution',
    topic: 'health',
    text: `Rates of obesity are rising in many parts of the world, among children as well as adults, placing growing pressure on health services. What problems does this cause? What measures could be taken to tackle it? ${STANDARD}`,
    parts: [
      'Identify the problems rising obesity creates',
      'Propose measures for individuals, schools or governments',
      'Link each measure to the problem it addresses',
    ],
    keywords: ['obesity', 'rising', 'children', 'adults', 'pressure', 'health', 'services', 'tackle', 'overweight', 'diet', 'exercise', 'junk', 'sugar', 'weight', 'fitness'],
    modules: ['academic', 'general'],
  },
  {
    id: 'ps-05',
    type: 'problem-solution',
    topic: 'society',
    text: `In many cities, the cost of housing has risen much faster than average incomes, and many families cannot afford a decent home. What problems does this cause? What measures could governments take to make housing affordable? ${STANDARD}`,
    parts: [
      'Describe the problems unaffordable housing causes',
      'Propose measures governments could take',
    ],
    keywords: ['cities', 'cost', 'housing', 'risen', 'incomes', 'families', 'afford', 'home', 'affordable', 'governments', 'rent', 'prices', 'mortgages', 'property', 'apartments', 'homelessness', 'landlords', 'construction'],
    modules: ['academic', 'general'],
  },
  {
    id: 'ps-06',
    type: 'problem-solution',
    topic: 'work',
    text: `Many employees today report high levels of stress at work and struggle to balance their jobs with family life. What problems does this cause? What measures could employers and governments take to help? ${STANDARD}`,
    parts: [
      'Explain the problems workplace stress causes',
      'Suggest measures employers could take',
      'Suggest what governments could add',
    ],
    keywords: ['employees', 'stress', 'work', 'balance', 'jobs', 'family', 'employers', 'governments', 'burnout', 'overtime', 'wellbeing', 'anxiety', 'workload', 'flexibility', 'exhaustion'],
    modules: ['academic', 'general'],
  },
  {
    id: 'ps-07',
    type: 'problem-solution',
    topic: 'technology',
    text: `Enormous amounts of personal information about ordinary people are now collected and stored online. What problems does this cause? What measures could be taken to protect people's privacy? ${STANDARD}`,
    parts: [
      'Identify the problems created by mass data collection',
      'Propose measures to protect privacy',
    ],
    keywords: ['personal', 'information', 'collected', 'stored', 'online', 'protect', 'privacy', 'data', 'surveillance', 'hacking', 'breaches', 'companies', 'security', 'consent', 'regulation'],
    modules: ['academic'],
  },
  {
    id: 'ps-08',
    type: 'problem-solution',
    topic: 'media',
    text: `False and misleading stories spread quickly on the internet and are often shared more widely than accurate reporting. What problems does this cause? What measures could be taken to limit the spread of false information? ${STANDARD}`,
    parts: [
      'Describe the problems false information causes',
      'Propose measures to limit its spread',
      'Consider who should act: platforms, governments or readers',
    ],
    keywords: ['false', 'misleading', 'stories', 'internet', 'shared', 'accurate', 'reporting', 'spread', 'information', 'misinformation', 'disinformation', 'fake', 'news', 'platforms', 'journalists', 'verification'],
    modules: ['academic'],
  },

  /* ---------------------- advantages / disadvantages ----------------------- */
  {
    id: 'ad-01',
    type: 'advantages-disadvantages',
    topic: 'education',
    text: `Every year, more university students choose to spend part or all of their degree studying abroad. Do the advantages of this trend outweigh the disadvantages? ${STANDARD}`,
    parts: [
      'Cover the advantages of studying abroad',
      'Cover the disadvantages honestly',
      'Give a clear verdict on which side outweighs the other',
    ],
    keywords: ['university', 'students', 'degree', 'studying', 'abroad', 'trend', 'overseas', 'international', 'culture', 'language', 'homesickness', 'tuition', 'exchange'],
    modules: ['academic'],
  },
  {
    id: 'ad-02',
    type: 'advantages-disadvantages',
    topic: 'technology',
    text: `Machines and computer programs can now carry out many jobs that were once done by people. Do the advantages of this development outweigh the disadvantages? ${STANDARD}`,
    parts: [
      'Cover the advantages of automation',
      'Cover the disadvantages for workers and society',
      'State whether the advantages outweigh the disadvantages',
    ],
    keywords: ['machines', 'computer', 'programs', 'jobs', 'people', 'development', 'automation', 'robots', 'technology', 'unemployment', 'workers', 'efficiency', 'retraining', 'factories'],
    modules: ['academic', 'general'],
  },
  {
    id: 'ad-03',
    type: 'advantages-disadvantages',
    topic: 'culture',
    text: `International tourism has become the largest source of income in many countries and regions. Do the advantages of mass tourism outweigh the disadvantages for the places that receive visitors? ${STANDARD}`,
    parts: [
      'Cover what tourism brings to host communities',
      'Cover the damage or pressure it can cause',
      'Deliver a weighed verdict',
    ],
    keywords: ['international', 'tourism', 'income', 'countries', 'regions', 'mass', 'places', 'visitors', 'tourists', 'travellers', 'hotels', 'economy', 'heritage', 'overcrowding', 'jobs'],
    modules: ['academic'],
  },
  {
    id: 'ad-04',
    type: 'advantages-disadvantages',
    topic: 'health',
    text: `Thanks to better medicine and living conditions, people in most countries are living much longer than before. Do the advantages of an ageing population outweigh the disadvantages? ${STANDARD}`,
    parts: [
      'Cover the advantages of longer lives and an older population',
      'Cover the pressures an ageing population brings',
      'Say clearly which side outweighs the other',
    ],
    keywords: ['medicine', 'living', 'conditions', 'countries', 'longer', 'ageing', 'population', 'elderly', 'retirement', 'pensions', 'lifespan', 'healthcare', 'workforce', 'longevity'],
    modules: ['academic'],
  },
  {
    id: 'ad-05',
    type: 'advantages-disadvantages',
    topic: 'work',
    text: `In many workplaces, employees are now expected to answer phone calls and emails outside their normal working hours. Do the advantages of this constant availability outweigh the disadvantages? ${STANDARD}`,
    parts: [
      'Cover the advantages of being always reachable',
      'Cover the costs to rest and family life',
      'Give a verdict on the balance',
    ],
    keywords: ['workplaces', 'employees', 'phone', 'calls', 'emails', 'working', 'hours', 'availability', 'overtime', 'burnout', 'boundaries', 'rest', 'messages', 'technology', 'leisure'],
    modules: ['academic', 'general'],
  },
  {
    id: 'ad-06',
    type: 'advantages-disadvantages',
    topic: 'transport',
    text: `Low-cost airlines have made flying affordable for millions of people who could never travel by air before. Do the advantages of cheap flights outweigh the disadvantages? ${STANDARD}`,
    parts: [
      'Cover the advantages of affordable air travel',
      'Cover the disadvantages, including the environmental cost',
      'State whether the advantages outweigh the disadvantages',
    ],
    keywords: ['airlines', 'flying', 'affordable', 'millions', 'travel', 'air', 'cheap', 'flights', 'aviation', 'planes', 'tourism', 'emissions', 'holidays', 'budget', 'airports', 'carbon'],
    modules: ['academic', 'general'],
  },
  {
    id: 'ad-07',
    type: 'advantages-disadvantages',
    topic: 'media',
    text: `Children today spend much of their free time watching streaming services and online videos. Do the advantages of this kind of entertainment outweigh the disadvantages? ${STANDARD}`,
    parts: [
      'Cover what children gain from streaming and online video',
      'Cover the risks and what this viewing replaces',
      'Give a clear verdict',
    ],
    keywords: ['children', 'free', 'time', 'watching', 'streaming', 'online', 'videos', 'entertainment', 'television', 'screens', 'shows', 'cartoons', 'educational', 'exercise', 'attention', 'platforms'],
    modules: ['academic', 'general'],
  },
  {
    id: 'ad-08',
    type: 'advantages-disadvantages',
    topic: 'society',
    text: `More and more people are leaving the countryside to live and work in large cities. Do the advantages of this movement outweigh the disadvantages? ${STANDARD}`,
    parts: [
      'Cover the advantages of moving to cities',
      'Cover the disadvantages for migrants and for rural areas',
      'State which side outweighs the other',
    ],
    keywords: ['people', 'leaving', 'countryside', 'live', 'work', 'cities', 'movement', 'urbanisation', 'migration', 'rural', 'urban', 'jobs', 'villages', 'opportunities', 'overcrowding'],
    modules: ['academic'],
  },

  /* ----------------------------- double question --------------------------- */
  {
    id: 'dq-01',
    type: 'double-question',
    topic: 'education',
    text: `In many countries, fewer school leavers are choosing to train as teachers. Why is this happening? What could be done to encourage more people to join the profession? ${STANDARD}`,
    parts: [
      'Answer the first question: why fewer people train as teachers',
      'Answer the second question: how to encourage more into the profession',
    ],
    keywords: ['school', 'leavers', 'choosing', 'train', 'teachers', 'encourage', 'profession', 'teaching', 'salaries', 'classrooms', 'workload', 'respect', 'pay', 'recruitment', 'status'],
    modules: ['academic', 'general'],
  },
  {
    id: 'dq-02',
    type: 'double-question',
    topic: 'technology',
    text: `Many young children now spend hours each day playing games on screens rather than playing outside. Why has this change happened? Is it a positive or negative development? ${STANDARD}`,
    parts: [
      'Answer the first question: explain the causes of the change',
      'Answer the second question: judge whether it is positive or negative',
    ],
    keywords: ['children', 'playing', 'games', 'screens', 'outside', 'change', 'development', 'gaming', 'outdoor', 'exercise', 'technology', 'obesity', 'parents', 'devices'],
    modules: ['academic', 'general'],
  },
  {
    id: 'dq-03',
    type: 'double-question',
    topic: 'environment',
    text: `Many species of plants and animals are disappearing at an alarming rate. Why is this loss happening? What could be done to protect endangered species? ${STANDARD}`,
    parts: [
      'Answer the first question: explain why species are disappearing',
      'Answer the second question: propose ways to protect them',
    ],
    keywords: ['species', 'plants', 'animals', 'disappearing', 'loss', 'protect', 'endangered', 'extinction', 'habitat', 'biodiversity', 'wildlife', 'conservation', 'deforestation', 'hunting', 'pollution'],
    modules: ['academic'],
  },
  {
    id: 'dq-04',
    type: 'double-question',
    topic: 'health',
    text: `In many countries, people are sleeping less than they did a generation ago. Why is this happening? What effects does a lack of sleep have on individuals and society? ${STANDARD}`,
    parts: [
      'Answer the first question: explain why people sleep less',
      'Answer the second question: describe the effects on individuals and society',
    ],
    keywords: ['sleeping', 'generation', 'effects', 'lack', 'sleep', 'individuals', 'society', 'rest', 'tired', 'insomnia', 'bedtime', 'fatigue', 'screens', 'health', 'productivity'],
    modules: ['academic', 'general'],
  },
  {
    id: 'dq-05',
    type: 'double-question',
    topic: 'work',
    text: `Fewer young people are choosing careers in skilled trades such as plumbing, carpentry and electrical work. Why is this the case? What could be done to change the situation? ${STANDARD}`,
    parts: [
      'Answer the first question: why skilled trades attract fewer young people',
      'Answer the second question: how to change the situation',
    ],
    keywords: ['young', 'careers', 'skilled', 'trades', 'plumbing', 'carpentry', 'electrical', 'work', 'apprenticeships', 'vocational', 'plumbers', 'electricians', 'builders', 'university', 'manual', 'wages'],
    modules: ['academic', 'general'],
  },
  {
    id: 'dq-06',
    type: 'double-question',
    topic: 'culture',
    text: `In many parts of the world, traditional festivals and customs are becoming less popular. Why is this happening? What could be done to keep traditions alive? ${STANDARD}`,
    parts: [
      'Answer the first question: why traditions are fading',
      'Answer the second question: how to keep them alive',
    ],
    keywords: ['traditional', 'festivals', 'customs', 'popular', 'traditions', 'alive', 'globalisation', 'heritage', 'celebrations', 'ceremonies', 'generations', 'identity', 'rituals'],
    modules: ['academic'],
  },
  {
    id: 'dq-07',
    type: 'double-question',
    topic: 'government',
    text: `In some countries, the number of people who vote in elections is falling steadily. Why do fewer people vote? What could governments do to encourage participation? ${STANDARD}`,
    parts: [
      'Answer the first question: explain why fewer people vote',
      'Answer the second question: propose ways to raise participation',
    ],
    keywords: ['people', 'vote', 'elections', 'falling', 'governments', 'encourage', 'participation', 'voters', 'turnout', 'democracy', 'politicians', 'apathy', 'ballot', 'campaigns'],
    modules: ['academic'],
  },
  {
    id: 'dq-08',
    type: 'double-question',
    topic: 'media',
    text: `People increasingly get their news from social media rather than from newspapers or television. Why has this change taken place? Is it a positive or negative development? ${STANDARD}`,
    parts: [
      'Answer the first question: explain the causes of the shift',
      'Answer the second question: judge whether it is positive or negative',
    ],
    keywords: ['news', 'social', 'media', 'newspapers', 'television', 'change', 'development', 'journalism', 'platforms', 'online', 'misinformation', 'articles', 'broadcasters', 'feeds', 'digital'],
    modules: ['academic', 'general'],
  },
]

/**
 * Is this prompt one the given exam would ask? An absent `modules` means both,
 * so a prompt added without the tag stays visible everywhere rather than
 * silently vanishing from one exam.
 */
export function suitsModule(prompt: PromptSpec, module: Module): boolean {
  return prompt.modules === undefined || prompt.modules.includes(module)
}

/** The prompts one exam would ask, in bank order. */
export function promptsForModule(module: Module): PromptSpec[] {
  return PROMPTS.filter((p) => suitsModule(p, module))
}

/**
 * A uniformly random prompt from the bank, restricted to one exam's pool when a
 * module is given. The pool is never empty — every question type keeps General
 * Training entries — but the fallback guards a future mis-tagging rather than
 * handing back `undefined`.
 *
 * `exclude` drops one prompt from the draw, for callers replacing the question
 * on screen. Without it a redraw can hand back the prompt the learner is already
 * looking at, and a control that visibly does nothing reads as broken — the
 * exact failure the exam-type toggle had. `PromptPicker.handleShuffle` applies
 * the same rule to its own pool. If excluding would empty the draw, the
 * exclusion is dropped rather than returning `undefined`.
 */
export function randomPrompt(module?: Module, exclude?: PromptSpec | null): PromptSpec {
  const pool = module ? promptsForModule(module) : PROMPTS
  const base = pool.length > 0 ? pool : PROMPTS
  const withoutCurrent = exclude ? base.filter((p) => p.id !== exclude.id) : base
  const from = withoutCurrent.length > 0 ? withoutCurrent : base
  const index = Math.floor(Math.random() * from.length)
  return from[index] ?? from[0]
}
