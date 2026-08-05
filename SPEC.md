# IELTS Coach — Build Spec (v1)

Canonical decisions for every module. Where research lenses disagreed, THIS file wins.
Contracts live in `src/types.ts` and `src/meta.ts` — code against them exactly.

## Product

Single-page React+TS app, one learner, IELTS Academic Writing Task 2 only. Pure client-side,
localStorage persistence, deterministic rule-based analysis (regex + word lists + arithmetic —
no LLM, no server). Two modes: **Coach** (live inline feedback + structure rail + feedback panel)
and **Exam** (40:00 countdown, zero feedback, paste blocked, full report at submit).
The moat: IELTS-specific structural rules + a personal error profile tracked across sessions.

## Canonical constants (single source of truth — no module invents its own)

- **Word count** (effective = total minus words inside 4+-word verbatim prompt copies):
  < 250 → error · 250–259 → warning "dangerously close" · 260–330 → good · > 340 → warning "over-length".
- **Paragraph split**: `/\n+/` (any newline run), then merge any fragment < 5 words into the previous paragraph.
- **Paragraph roles**: first = introduction, last = conclusion (only when ≥ 3 paragraphs), middle = body.
  While the essay is short (< 3 paragraphs) treat the last as "in progress", not a failed conclusion.
- **Paragraphing gates**: paragraph SHAPE is judged against the essay, never against a sentence in progress.
  The single-block error and the 6+-fragments warning stay silent below **100 words** (a writer still inside
  the 30–60-word intro legitimately has one paragraph); the "standard shape is 4–5" warning for 2–3
  paragraphs stays silent below **200 words** (at 120 words intro + body 1 is correct, not a fault).
- **Paragraph norms**: intro 30–60 words · body 60–120 (error < 40, warning < 50 or > 140) · conclusion 25–60.
  Two bodies differing by more than 2:1 → `paragraph-balance` warning.
- **Sentence split**: on `[.!?]+` followed by whitespace/end or newline; protect abbreviations
  (e.g., i.e., etc., Dr., Mr., Mrs., U.S., approx., No.), decimals (3.5), ellipses. Also split when `.`
  is directly followed by an uppercase letter (typo case). End of paragraph = implicit boundary.
- **Severity model** (ONE system): static per rule — `error` (band-capping: no position, missing conclusion,
  under-length, uncovered question part, one-block essay), `warning` (recurring cost: register, linkers,
  repetition, overlong sentences), `info` (advisory/low-precision heuristics: topic sentences, hedging,
  passive balance). Personal-profile amplification is presentation-only: issues whose category is in
  `profile.focusCategories` get a "recurring for you" badge and sort first within their severity tier.
- **Stance markers vs clichés**: "this essay will argue/agree/disagree" counts as a POSITION signal.
  Only the full verbatim template "this essay will discuss both views and give my own opinion" is a cliché.
- **First person**: 'I' in intro/conclusion stance statements is REQUIRED for opinion essays — never flag.
  `first-person-overuse` fires only on body paragraphs with > 1 'I/my/me' sentence (info).

## Rule inventory (module → rules; category ids from types.ts)

### `analysis/rules/structure.ts` — exports `buildStructure(doc, prompt)` → { paragraphs, checks, issues }
Checks array (drives the Structure Rail; adapt labels by prompt.type using QUESTION_TYPE_META):
`intro-present`, `position-stated` (opinion/adv-disadv/discussion types; stance regex over intro OR
conclusion), `body-count` (2–3 bodies), `body-N-topic` (one per body), `body-N-support` (example marker
'for example|for instance|such as|to illustrate' OR digit/percent in the paragraph), `conclusion-present`
(final paragraph opens with 'in conclusion|to conclude|to sum up|in summary|overall|on balance').
Issues: `paragraphing` (1 block = error "caps CC near Band 5" once ≥ 100 words; 6+ = warning once ≥ 100 words;
2–3 = warning once ≥ 200 words — see the Paragraphing gates constant), `paragraph-balance`,
`no-conclusion` (error once essay ≥ 200 words and ≥ 3 paragraphs but final has no signal & > 100 words),
`topic-sentence` (info: body first-sentence starts with example marker / dangling 'This/It/They' /
is a question / > 35 words), `no-position` (error for opinion-family prompts when no stance marker in
intro or conclusion; if modal-of-obligation + evaluative adverb found instead → info "implicit position").
Stance regexes: /\bI (strongly |firmly |partly |largely )?(agree|disagree|believe|think|argue|contend|maintain)\b/i,
/\bin my (opinion|view)\b/i, /\bmy view is\b/i, /\bI am (convinced|of the opinion)\b/i,
/\bthis essay (will )?(argues?|agrees?|disagrees?)\b/i, /\b(advantages|benefits|drawbacks|disadvantages) (clearly |far )?outweigh\b/i,
/\bit seems to me\b/i.

### `analysis/rules/taskResponse.ts`
- `word-count` per the canonical thresholds (effective count; explain the deduction when copies exist).
- `prompt-echo` (error): highlight each maximal run of **≥ 8** consecutive words shared verbatim with the
  prompt (normalised lowercase, punctuation stripped; require ≥ 2 content words in the run). The run must
  be a lifted CLAUSE, not a shared collocation: at ≥ 4 words the rule fired on wording no answer can
  avoid — "when choosing a career", "that job satisfaction is more important" — because every essay has
  to name its own question's subject. Eight verbatim words is where the writer is reproducing the
  question instead of answering it. The same runs drive the word-count deduction. Message:
  "Copied from the question — examiners exclude this from your word count. Paraphrase."
- `question-coverage` (error, essay-level, only when essay ≥ 150 words): by prompt.type —
  discussion: need other-side markers ('on the other hand|others (argue|believe)|some people|proponents|
  opponents|those who|advocates|critics') in ≥ 1 body; problem-solution: need problem lexis
  (problem|issue|cause|consequence|lead to|result in) AND solution lexis (solution|solve|tackle|address|
  measure|should|introduce|implement|invest|ban) in bodies; double-question: each prompt part's keywords
  must hit ≥ 2 times in some body; adv-disadv with 'outweigh': need a verdict phrase (outweigh|greater than|
  more significant). Name the missing half in the message.
- `off-topic` (warning, ≥ 150 words): stemmed content-word overlap between all body text and prompt.keywords
  < 2 distinct hits → "Your body paragraphs barely reference the question topic — check you are answering
  THIS question."
- `overgeneralisation` (warning, inline): sentence contains an absolute (all people|everyone|everybody|
  no one|nobody|always|never|every single|without exception|undoubtedly|obviously|certainly|definitely|
  it is a fact) in its first 6 tokens AND no hedge in the same sentence (may|might|could|often|sometimes|
  usually|generally|tends? to|arguably|in many cases|to some extent|likely|largely|most|many). Suggest a softener.
- `personal-anecdote` (warning): /\bmy (friend|cousin|uncle|aunt|brother|sister|mother|father|neighbour|
  colleague|classmate)\b|\bin my experience\b|\bfor (example|instance), I\b|\bwhen I was\b|\bI once\b/i —
  1 hit = info, 2+ = warning.

### `analysis/rules/cohesion.ts` — also exports `countLinkingDevices(doc): number`
Lexicon ~90 phrases tagged by function: addition, contrast, cause, example, sequence, concession,
conclusion. Longest-first single alternation regex, word boundaries, sentence-initial position recorded.
- `linking-overuse` (warning): > 50% of sentences (min 8 sentences) open with a linker → "mechanical";
  3 consecutive linker-opened sentences → inline warning.
- `linking-underuse` (warning, ≥ 200 words): < 3 distinct devices, or zero contrast devices in a
  discussion essay, or zero example devices anywhere.
- `linking-repetition` (warning, inline on 3rd+ hit): same device ≥ 3 times; message names the device
  and 2 same-function alternatives.

### `analysis/rules/lexical.ts`
- `contraction` (error, inline): explicit list (~40 forms: don't, can't, it's, they're, would've, isn't…).
  List-match only — possessives never flagged.
- `informal-register` (warning, inline): lexicon with swaps — kids→children, stuff/things (2+)→factors/aspects,
  a lot of/lots of→many/a great deal of, huge→substantial, big→significant, get + adj→become/obtain,
  gonna/wanna, guys, ok/okay, kind of/sort of, etc./and so on→specify, really/totally/basically→(delete/considerably).
  Also '!' anywhere and '?' outside the intro (rhetorical) → warning. 'you/your' → "avoid addressing the reader".
- `vague-quantifier` (warning, inline): a lot of, lots of, plenty of, a couple of; 'very + adj' 3+ times
  → suggest stronger adjective (very important→crucial, very common→widespread).
- `weak-vocabulary` (info, inline): good/bad/nice/thing(s) beyond 2 uses → suggest beneficial/detrimental/
  significant/factors.
- `repetition` (warning, ONE issue per over-used lemma, anchored on the 3rd occurrence — the message is
  essay-level, so one row per occurrence just repeated itself): content lemma (naive suffix strip
  -s/-es/-ed/-ing/-ly, keep words ≥ 4 chars, skip prompt keywords and a ~170-word stopword list) used
  **≥ max(5, ceil(wordCount / 50)) times** — a DENSITY of 2%, floored at the old flat 5 so a 250-word
  essay keeps its calibration. Six uses of a topic noun across 340 words is ordinary topic vocabulary.
  'people' takes threshold + 1 and gets its own message (individuals, citizens, members of the public).
- `memorised-phrase` (warning, inline): ~30-entry bank — every coin has two sides, a double-edged sword,
  in a nutshell, last but not least, as we all know, as is known to all, it goes without saying,
  with the development of (society|technology|science and technology), in this day and age,
  since the dawn of time, in the modern era, a hotly debated topic, plays? an? (indispensable|vital) role in
  our (daily )?(life|lives), this essay will discuss both views and give my own opinion, there are a variety
  of reasons, nowadays (2nd+ use). 3+ hits → add essay-level error "template writing risks an LR penalty".

### `analysis/rules/grammarRange.ts`
- `long-sentence` (warning, inline): sentence > 45 words → "likely run-on — split it"; escalate wording
  when it holds ≥ 4 commas.
- `short-sentence-run` (info, inline): ≥ 3 consecutive sentences < 8 words → "combine with although/which/because".
- `sentence-variety` (warning, essay-level, ≥ 10 sentences): complexity markers = subordinators
  (although|though|even though|whereas|while|because|since|unless|if|when|despite|in spite of|so that|
  provided that) + relative clauses (which|who|whose) + participial openers (/^[A-Z][a-z]+(ing|ed),/).
  < 3 total → warning "few complex structures — GRA capped near Band 6"; also fires when sentence-length
  SD < 4 with mean 8–16 ("uniform simple sentences"). If 'because' > 60% of markers → info "one-trick subordination".
- `comma-splice` (warning, inline): /,\s*(it|this|they|he|she|we|I|there)\s+(is|are|was|were|has|have|had|can|will|would|should|do|does|did)\b/i
  unless preceded by and/but/or/so/yet or sentence opens with a subordinator; also
  /,\s*(however|therefore|moreover|nevertheless|consequently|furthermore|thus)\b/ mid-sentence →
  "use a semicolon or full stop before 'however'". Phrase as "check: are these two complete sentences?"
- `first-person-overuse` (info): body paragraphs only, > 1 sentence containing I/my/me per body.
- `missing-hedging` (info, essay-level): 0 hedges AND ≥ 3 absolutes → "overgeneralised tone".

### `analysis/bandEstimate.ts`
Start each criterion at 7.0; apply deductions, then rewards; caps win over both; clamp 4.0–9.0; round to 0.5.

**Rewards (three × +0.5 per criterion, ceiling 8.5).** Deductions alone made Bands 8–9 unreachable by
construction: the only upward moves were a TR +0.5 and a GRA +0.5, so the best possible essay scored
(7.5 + 7 + 7 + 7.5) / 4 = 7.25 → **7.0**, the same as a merely adequate one. Every reward needs POSITIVE
evidence, never mere absence of a detection, so an unambitious essay the rule set happens not to catch
cannot drift upward on silence. Step 1 of each is a **clean sweep** — no `error` or `warning` in that
criterion (`info` is advisory per the severity model and never blocks a reward).
- TR: under-length → cap 5.0; `no-position` error → cap 5.5; `question-coverage` error → cap 5.5;
  `prompt-echo` −0.5; `off-topic` −1.0; overgeneralisation ≥ 3 → −0.5; anecdotes −0.5.
  Rewards: clean sweep · ≥ 260 words with no `word-count` issue (331–340 is not over-length, so it earns
  this too) · all structure checks satisfied. Essay < 150 words → all criteria = 4.0.
- CC: one-block → cap 5.0; `no-conclusion` → cap 6.0; linker under/overuse −0.5 each; topic-sentence
  issues ≥ 2 → −0.5; paragraph-balance −0.5.
  Rewards: clean sweep · 4–5 paragraphs with `conclusion-present` satisfied · ≥ 8 linking devices and no
  linking issue.
- LR: TTR < 0.45 → −1.0 (< 0.55 → −0.5); each of memorised-phrase ≥ 1 / repetition ≥ 2 /
  informal+contraction ≥ 3 → −0.5.
  Rewards: clean sweep · TTR ≥ 0.65 · TTR ≥ 0.75 (cumulative; TTR is 0 under 50 content words, so no
  short essay can earn either).
- GRA: sentence-variety warning → cap 6.0; comma-splices ≥ 2 → −0.5; long sentences ≥ 2 → −0.5.
  Rewards: clean sweep · SD ≥ 6 AND markers ≥ 7 · markers ≥ 10 with no sentence-variety warning.
- Overall = mean of four, rounded to nearest 0.5 (x.25/x.75 round down — conservative).
- Calibration anchors (`tests/band-rewards.test.ts`): the op-05 high-band answer ≥ 8.0 on every
  criterion; a weak-but-not-broken answer to the same prompt ≤ 6.5, at least a full band below it.
- rationale: 2–4 short learner-facing bullets per criterion naming the exact drivers.
- UI presents overall as a RANGE (±0.5) and always labels it "rule-based estimate — not an examiner".

### `profile/` (store.ts + profile.ts)
localStorage key `ielts-coach.v1` → `{ schemaVersion: 1, sessions: SessionRecord[] }`. Cap 200 sessions
(drop oldest). `computeProfile`: per category, per-100-words rate per session; EWMA α = 0.35; trend from
least-squares slope over last 6 sessions (improving < −0.05, worsening > 0.05); focusCategories = top 3 by
EWMA × severity weight (error 3, warning 2, info 1), only when ≥ 2 sessions. `computeTrends`: per-session
counts + per100Words for every category that ever fired. Export = JSON download of the whole store;
import validates schemaVersion and replaces (confirm() before overwrite).

### `prompts/bank.ts`
40 prompts (8 per question type), realistic Task 2 wording, topics spread across education, technology,
environment, health, society, work, government, culture. Each with honest `parts` (checklist phrasing)
and `keywords` (lowercase content words, 6–12 per prompt). Standard instruction text ends every prompt:
"Give reasons for your answer and include any relevant examples from your own knowledge or experience.
Write at least 250 words." Export `PROMPTS: PromptSpec[]` and `randomPrompt(): PromptSpec`.

## Exam mode specifics
Paste/drop blocked in the editor when `blockPaste` (count attempts via `onPasteBlocked`; report shows
"paste attempts: N"). `spellCheck={false}` in exam, true in coach. Word-count sampling every 30 s into
`SessionRecord.pacing` for the report's pacing chart (target curve: 0 words until 05:00, linear to 270
at 38:00).

## Report & dashboard
Report: band range hero + four criterion tiles with rationale; "vs your last essay" strip (recurring-error
count, structure slots filled, TTR, band) when a previous session exists; full annotated essay (highlights,
click-to-reveal messages); structure checklist; exam pacing chart when pacing data exists; profile
confrontation card ("<category>: seen in N of your last M essays"). Dashboard: session table
(date, mode, type, words, band, top issue); band trend chart (exam sessions emphasised); per-category
trend sparklines for focusCategories; export/import buttons.

## Cut from v1 (deliberate)
Handwriting-pace mode · UK/US consistency · cohesion X-ray overlay · warm-up drills · dictionary
spell-check (browser spellcheck covers Coach) · per-finding dismissal · plan-phase timer · Task 1.

## Patch v2 (calibrated against a real Band-6 essay, 2026-08-04)

A human-marked essay scored ~6.0 while the engine said 6.0–7.0. These rules close the gap.
New IssueCategory ids exist in types.ts; CATEGORY_META has entries for all of them.

### New module `analysis/rules/accuracy.ts` — exports `accuracyRules: RuleFn` (all inline spans)
- A2 `connector-comma` (warning): fronted connector missing its comma, anchored at sentence AND
  paragraph starts: /(^|[.!?]["')\]]?\s+|\n\s*)(However|Therefore|Moreover|Furthermore|In addition|For example|For instance|In my opinion|In my view|In this sense|On the other hand|As a result|Consequently|In conclusion|Ultimately|On balance|Admittedly|Nevertheless)(?!,)/g
  Also flag space-before-comma /\s+,/ under the same category ("the comma sticks to the word before it").
- A3 `capitalisation` (error): document's first char lowercase; any sentence starting lowercase
  (check EVERY paragraph including the first); standalone lowercase /\bi\b/ pronoun.
- A4 `fragment` (warning): dependent opener (optionally after a discourse marker) with no comma
  before the full stop: /^(?:(?:For example|For instance|In addition|Moreover),\s+)?(If|When|Whenever|While|Because|Although|Even though|Unless|Whereas|Since|Unlike|Which)\b[^,.]*\.$/im — run per sentence.
  Message phrased as "check: is this a complete sentence?"
- A5 `article` (warning): token walk, not regex. COUNTABLE set (~40 nouns: period, term, system,
  situation, response, reaction, chance, result, sentence, crime, citizen, shop, group, trip, future,
  world, environment, government, company, city, country, school, reason, problem, student, child,
  traveller, traveler, uniform, job, home, time, way, person, man, woman, solution, decision, choice).
  For each singular COUNTABLE token: walk LEFT over adjectives/unknown words; determiner found
  (a, an, the, this, that, these, those, my, his, her, its, their, our, your, every, each, one, no,
  any, some, another) → OK; hit a preposition/verb/comma/sentence start first → FLAG. NEVER flag
  uncountables (society, education, freedom, advice, money, research, information, nature).
  Skip 'time'/'home'/'way' inside fixed phrases (at home, in time, on time, by the way, all the time).
  **Compound guard**: a COUNTABLE token separated by whitespace only from a following noun HEAD is a
  MODIFIER and takes no determiner — 'job satisfaction', 'time management', 'job market'. A head is any
  COUNTABLE (or its plural), a listed plain-noun head, or a word ≥ 6 chars ending in a nominal suffix
  (-tion/-sion/-ment/-ness/-ity/-ance/-ence/-ship/-ism/-hood/-acy/-ure/-ology). Verb forms never match
  those endings ('needs', 'requires'), so bare-noun-plus-verb errors are still caught.
  **Walk cap**: the walk crosses at most 3 words. The stop-sets cannot list every English verb, so an
  uncapped walk ran across whole clauses and reported noun phrases that were never there ("an and serious
  financial pressure can itself destroy job"). Exceeding the cap = stay SILENT, never flag. When the
  crossed words cannot belong to the noun phrase, the span and the suggestion shrink to the bare noun.
- A6 `agreement` (warning): -ing subject + plural verb anywhere in the sentence:
  /\b(having|working|travell?ing|wearing|playing|making|learning|studying|shopping|punishing|educating|giving|teaching|reading|watching|buying|renting)\s+[^.,;]{0,60}?\s(add|make|unite|help|give|allow|cause|lead|reduce|improve|require|need|create|bring|save|cost|take)\b/gi
- B1 `agreement` (warning): singular determiner + plural noun:
  /\b(a|an|one|each|every|another)\s+(?:\w+\s+){0,2}(women|men|children|people|persons|criminals|killers|prisoners|students|employees|citizens|teachers|workers|parents|years|skills)\b/gi
- B3 `agreement` (warning): plural subject + singular complement:
  /\b(are|were)\s+(a\s+)?(human being|citizen|student|employee|travell?er|criminal|teacher|worker|parent|adult)\b(?!s)/gi
- B2 `who-for-people` (warning): /\b(person|people|citizen|man|woman|child|children|student|employee|travell?er|killer|prisoner|teacher|worker|friend|parent|shopper)s?\s+that\b/gi
- B4 `connector-misuse` (warning): meanwhile-for-contrast (comma + meanwhile + clause), in other side,
  from other side, in the other hand, on the contrary of — each with its correction.
- B5 `collocation` (warning): hand-checked wrong→right pairs ONLY: key for→key to, bad to
  (someone/people/employees/students)→bad for, in home→at home, responsible of→responsible for,
  depend of→depend on, focus in→focus on, interfere in→interfere with, reason of→reason for,
  afraid from→afraid of. Do NOT flag correct forms (consist of, suffer from).

### Existing-module patches
- grammarRange A1: add always-splice pattern /,\s+(then|after that|instead|otherwise|meanwhile|next)\s+(he|she|it|they|we|I|the|a|an|this|that|there)\b/i ("'then' is not a joining word — full stop, or 'and then'"), and conjunctive-adverb splice without parenthetical: /,\s+(however|therefore|thus|moreover|consequently|furthermore|nevertheless)\s+(?![^,]{0,20},)\w+\s+\w+/i.
- structure C1: body-support example markers = for example, for instance, to take one example,
  a clear example of this is, one illustration of this is, consider the case of, this can be seen in,
  take the case of, such as, a case in point is — plus digit/percent (unchanged).
- structure C2 `intro-shape`: intro > 3 sentences → warning; example marker inside intro → warning
  "Examples belong in the body, not the introduction." Intro check detail reflects sentence count.
- structure C3 `conclusion-shape`: conclusion (>=3 paragraphs, final signalled) must be exactly
  2 sentences — flag 1 ("add one sentence saying why it matters") and 3+ ("cut to two sentences");
  example marker in conclusion → warning "No new examples in the conclusion."
- structure C5: new StructureCheck id 'complex-count', label "Complex sentences", target 4 (one per
  paragraph): count subordinator/relative markers per paragraph (although|though|even though|whereas|
  while|unless|if|because|since|when|after|before|which|who|whose), excluding 'that'; satisfied when
  total >= 4 AND every paragraph has >= 1; detail names paragraphs with zero ("3 of 4 — none in Body 2").
- taskResponse C4 `position-consistency` (warning, essay-level unless spans available): find the
  stance sentence in the intro and in the conclusion (existing stance regexes); if intro stance
  matches ABSOLUTE /\b(must|only|always|never|the only|no exception|entirely|execute|abolish|ban)\b/i
  and conclusion stance matches HEDGED /\b(both|balance|some cases|specific cases|to some extent|a mix|depends|in certain)\b/i
  (or vice versa) → warning "Your introduction and conclusion take different positions — pick one."
- bandEstimate C6: `position-consistency` warning → TR cap 6.0 with rationale. GRA: capitalisation
  errors >= 2 → −0.5; (article + agreement) count >= 3 → −0.5 (these are accuracy errors, the real
  GRA driver); fragment >= 1 → −0.5. LR: collocation >= 2 → −0.5. CC: connector-misuse >= 1 → −0.25
  folded into linking deductions (round to existing 0.5 granularity by combining with other CC
  deductions — implement as: connector-misuse >= 2 → −0.5).
- UI copy (C6): band captions become "form-only estimate — your real band is likely this or lower";
  Report adds the confidence note "This engine checks form, not meaning — it cannot judge whether
  your argument makes sense." and a POSITION CHECK card showing the intro and conclusion stance
  sentences side by side for a manual 3-second read.

### Cheatsheet
`components/CheatSheet.tsx` renders the learner's one-page Task 2 guide (adapted from the user's
ielts-cheatsheet.html) as a right-panel tab in Coach Mode only; Exam Mode never renders it.
