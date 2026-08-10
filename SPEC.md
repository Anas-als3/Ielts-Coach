# IELTS Coach — Build Spec (v1)

Canonical decisions for every module. Where research lenses disagreed, THIS file wins.
Contracts live in `src/types.ts` and `src/meta.ts` — code against them exactly.

## Product

Single-page React+TS app, one learner, IELTS Writing — Academic Task 1 and Task 2, plus General
Training Task 1 (letters) and Task 2 — and IELTS **Reading**, both modules. Pure client-side,
localStorage persistence, deterministic rule-based analysis (regex + word lists + arithmetic —
no LLM, no server). Two modes: **Coach** (live inline feedback + structure rail + feedback panel)
and **Exam** (40:00 countdown, zero feedback, paste blocked, full report at submit).
The moat: IELTS-specific structural rules + a personal error profile tracked across sessions.

Writing and Reading are scored on **different epistemic footings**, and the UI says so on every
screen. A Writing band is a form-only estimate from a rule engine that cannot read meaning. A
Reading band is an answer key plus a published conversion table — exactly right, with no hedging.
See "Reading" below.

## Modules (Academic / General Training)

IELTS is TWO exams sharing a name. `Module = 'academic' | 'general'` lives in `types.ts` beside
`TaskKind` and is chosen from a topbar switcher; `MODULE_META` in `meta.ts` holds the learner-facing
names. What actually differs:

| Section | Academic | General Training |
|---|---|---|
| Writing Task 1 | Describe a chart, graph, table or process | **Write a letter** (formal / semi-formal / informal) |
| Writing Task 2 | Essay. Same criteria, same 250 words, same 40 min | Essay. **Same marking**, everyday topics rather than abstract ones |
| Reading | 3 long academic passages | 3 sections: short workplace/social texts, work texts, one long general-interest text |
| Reading band conversion | 30/40 → band 7.0 | **34–35/40 → band 7.0** — GT needs ~4 more correct for the same band |
| Listening | Identical | Identical |
| Speaking | Identical | Identical |

Consequences pinned here so no module re-derives them:

- **Task 2 analysis is module-blind.** Same criteria, same estimator, same rules. The ONLY
  module-dependent thing is which questions are offered, which is a property of `prompts/bank.ts`
  (`PromptSpec.modules`, absent = both). 12 of the 40 are Academic-only — abstract policy, demography,
  regulation, biodiversity, globalisation — leaving 28 for General Training. `promptsForModule` filters
  the picker; `App.tsx` passes the filtered list, so `PromptPicker` knows nothing about modules.
- **`TASK_CONSTANTS` is NOT keyed by module.** General Training Task 1 allows the same 20 minutes and
  the same 150-word minimum as Academic Task 1; Task 2 is 40 minutes and 250 words in both. Only the
  task differs, never the clock.
- **Storage is schemaVersion 5.** The v2 → v3 rung stamps `module: 'academic'` on every pre-v3 record,
  because Academic was the only exam the app supported; the v3 → v4 rung stamps `section: 'writing'`,
  because Reading did not exist before it; the v4 → v5 rung changes **no data at all** — it only adds
  `'listening'` to the `section` union, and no v4 record could have been a Listening paper. See
  "Persistence" below.
- **The error profile is scoped by TASK and MODULE.** `categoryAppliesTo(category, task, module)` —
  `module` is optional and defaults to `'academic'`. It had to grow that dimension because Academic
  Task 1 (a chart description) and General Training Task 1 (a letter) share the id `'task1'` and share
  almost no rules, so `TaskKind` alone cannot say which of them a category belongs to.
- **General Training Task 1 is a letter, and it is built.** Selecting General + Task 1 opens the letter
  sheet and routes analysis to `analyzeLetter`. See "General Training Task 1 (letters)" below.
- **Reading is module-scoped absolutely.** `readingTestsForModule(module)` is the only way papers reach
  the picker, and the band comes from the paper's OWN module, not from the topbar toggle. The two
  exams' Reading papers are structured differently and converted by different tables; offering the
  wrong one reports a band that is simply not the learner's.
- **Listening is module-scoped NOWHERE, and that is enforced by absence.** There is no
  `listeningTestsForModule`, no `module` on `ListeningTest`, none on `ListeningResult`, none on
  `ListeningSessionRecord`, and no exam-type toggle on any Listening screen. Both exams sit the
  identical paper and convert through the identical table, so every one of those would be a field no
  caller could legitimately read — and the first caller to read one anyway would show a learner a
  distinction the exam does not make. The Listening picker states the fact in one sentence instead.

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
  Every marker alternation is hyphen-guarded (`\b(...)\b(?!-)`): a word boundary sits before a hyphen, so
  an unguarded `\bafter\b` credits the compound modifier in "after-school" as a subordinate clause.
- `comma-splice` (warning, inline): /,\s*(it|this|they|he|she|we|I|there)\s+(is|are|was|were|has|have|had|can|will|would|should|do|does|did)\b/i
  unless preceded by and/but/or/so/yet or sentence opens with a subordinator; also
  /,\s*(however|therefore|moreover|nevertheless|consequently|furthermore|thus)\b/ mid-sentence →
  "use a semicolon or full stop before 'however'". Phrase as "check: are these two complete sentences?"
  **Pattern A guards** (patterns B/C/D always had these; A did not, which is what let it misfire):
  the shared `guardedBeforeComma` — a coordinator OR an auxiliary/copula right before the comma —
  plus a **fronted-adverbial** guard. A sentence adjective adjunct (however, therefore, moreover,
  furthermore, nevertheless, consequently, thus, in addition, for example, for instance, in my
  opinion, in my view, on the other hand, as a result, overall, in conclusion, first(ly),
  second(ly), finally, indeed, admittedly) followed by a pronoun subject introduces ONE clause,
  not two: "However, it is clear that…" is among the commonest openings in IELTS writing and was
  being reported as a splice. Anchored `\s*$` against the text BEFORE the comma, so the adverbial
  must be the whole of it — "However, it is expensive, it is also slow" still reports its second comma.
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
localStorage key `ielts-coach.v1` (opaque; the version lives in the payload) →
`{ schemaVersion: 5, sessions: SessionRecord[] }`. Versions are MIGRATED FORWARD on read, never
discarded: v1 → v2 stamps `task: 'task2'` on every record, v2 → v3 stamps `module: 'academic'`,
v3 → v4 stamps `section: 'writing'`, v4 → v5 **changes no data**. The rungs are cumulative and apply
in sequence, so a v1 store gains all three fields in one read; never reorder or collapse them.

Each rung tests `version < N`, **never `version === N − 1`**. The stored version is validated as a
RANGE, so a fractional or otherwise unexpected value (`2.5`, from a half-written or hand-edited
payload) has to climb every rung above it. On `===` it matched none of them, ran zero steps, and was
then stamped 5 for good — leaving `task`, `module` and `section` undefined on every record it held.
The stamps are already conditional on the field being absent, so a rung a record does not need is a
no-op rather than an overwrite.

The v4 → v5 rung being a no-op is the correct call, not a gap, and it is written out rather than
folded away so the ladder still reads one line per version. A rung exists to repair records that
predate a field; no v4 record can be a Listening session, because Listening did not exist, so every
stored record is already valid v5 data as it stands and any rung would have to be a no-op or a lie.
What the bump buys is the VALIDATOR — `looksLikeSession` now admits section `'listening'`, and
`importData` now knows a v5 export is readable while still refusing a v6 one — and both of those key
off `SCHEMA_VERSION`, not off a rung.

**Nothing leaves without a copy.** Data is copied to `ielts-coach.backup.<ISO timestamp>` on all four
paths that lose sight of it, not just the loud ones: (1) the payload will not parse or names a
version this build cannot migrate — including v6, the version a newer build of this same app would
write; (2) SOME records fail validation and are filtered out on read, which is the LIKELIER
corruption by far (one record truncated by an interrupted write) and used to be dropped in silence,
with the next save persisting the loss; (3) `importData` replaces the store; (4) never twice — a
byte-identical copy already on disk is the backup, and one per read would fill the quota holding the
essays. A schemaVersion bump must never destroy a learner's history, and neither must a single bad
record.

**The backup key is `<ISO timestamp>` plus a COUNTER suffix, never a random salt.** `toISOString()`
has millisecond resolution and `setItem` overwrites, so two DIFFERENT payloads backed up inside the
same millisecond used to collapse into one key — the first was silently destroyed while the console
said a copy had been kept for it. `nextBackupKey` checks `getItem(key) === null` and appends `-1`,
`-2`, … until it finds a free key (bounded at 1,000 attempts, so a pathological store cannot spin
forever). The suffix is a counter rather than a salt SPECIFICALLY so the keys keep sorting by age as
plain text — `pruneBackups` relies on that ordering, and a random salt would make it silently start
deleting the wrong copies.

**`MAX_BACKUPS = 5`, newest kept.** A backup is a full serialisation of the store (see the record
sizes below), so unbounded backups fill the same quota that holds the essays they exist to protect —
the safety net becomes the thing that breaks the save. `pruneBackups(keep)` sorts every
`ielts-coach.backup.` key ascending (text order = age order, because the suffix is a counter) and
`removeItem`s the oldest until `keep` remain; it runs at the end of every successful `backupRaw`, in
its OWN try/catch so a pruning failure can never read back as "could not back up" or block the read
or write that triggered it. `removeItem` appears in exactly ONE place in `src/` — `pruneBackups` — and
any second caller is deleting a learner's data and needs the same scrutiny this one got.

**Cap 200 sessions PER SECTION** (drop that section's oldest), never 200 across the store. A global
cap made the sections compete for one budget and Writing always lost: 20 essays plus 190 Reading
papers deleted 10 essays, which inverts the whole purpose of the union — the `isWritingSession`
guards exist so answer-key papers cannot DILUTE the writing profile, and a section-blind cap let them
DELETE it. Sitting an answer-key paper must never cost a learner an essay. Records are ordered by parsed INSTANT everywhere, not by the text of `dateISO`: an imported file may
carry an offset (`23:00+05:00` is three hours before `20:00Z` and sorts after it as text). List order
is what "oldest" means for the cap, what sets the sign of every trend slope in `computeProfile`, what
`lastSeenISO` is read off, what orders the Dashboard band chart's x-axis, and what picks the report's
"previous session". There is ONE comparator, `profile/chronology.ts`; nothing else may sort a
`dateISO`.

**Measured record sizes** (built through `analyzeEssay`/`markAnswerKey`, `JSON.stringify(...).length`,
at `ae92bac`): a clean worked essay is 4.8–4.9 kB; a flawed Band-6 essay (12 issues, 290 words) is
~8.0 kB; a completed answer key is ~12 kB (`reading-academic-01`: 12,241 B; `reading-general-01`:
12,137 B). Worst case at `MAX_SESSIONS_PER_SECTION = 200`: 200 × 8 kB + 400 × 12 kB (Reading +
Listening) ≈ **6.23 MB**, against a typical ~5 MB origin quota — backups sit on top of that. The cap
was NOT lowered to fix this: a smaller number chosen by guess would delete a learner's work to solve
a problem the backup cap and the write retry below already solve without deleting anything. Re-measure
before raising `MAX_SESSIONS_PER_SECTION` or adding a fourth section — a mock-test record (plan 013)
was not measured here and would likely be larger than either figure above.

**`SaveResult` is what `saveSession` returns instead of `void`.** `{ ok: true }` or
`{ ok: false, reason: 'quota' | 'unavailable', message }`, where `message` is learner-facing and says
what to do (export now, before writing more). Before this, `writeStore` swallowed every failure into
`console.warn` and a full quota looked identical to a successful save to every caller — `App.tsx`
would still navigate to the report view with a session that was never persisted, landing a learner who
had just finished a 40-minute essay on a header with nothing else (the Reading and Listening views
already had a fallback for a null session; the Writing report did not). `writeStore` now retries ONCE
after evicting the single oldest backup (`pruneBackups(backupCount() - 1)`) — spending a recovery copy
of a store that has since been read successfully to save 40 minutes of work that cannot be re-run — and
reports failure rather than retrying again if the second attempt also fails, so a full store cannot
turn into a loop that deletes a learner's backups one at a time to make room. `App.tsx` shows one
persistent `role="alert"` banner, shared by all three submit handlers (Writing, Reading, Listening),
that stays until dismissed; the Writing report view now has the same null-session fallback Reading and
Listening already had.

`computeProfile`: per category, per-100-words rate per session; EWMA α = 0.35; trend from
least-squares slope over last 6 sessions (improving < −0.05, worsening > 0.05); focusCategories = top 3 by
EWMA × severity weight (error 3, warning 2, info 1), only when ≥ 2 sessions. Those five constants are
canonical and `tests/profile-scoping.test.ts` pins each one by behaviour: every one of them survived
being mutated with the suite green, and the focus list is the app's main coaching signal.
`computeTrends`: per-session counts + per100Words for every category that ever fired. Export = JSON
download of the whole store; import validates schemaVersion, backs the existing store up, then
replaces (confirm() before overwrite). Import also deduplicates by `id` exactly as `saveSession`
does: two records sharing an id collide as React keys and `deleteSession(id)` removes BOTH, so
deleting an essay could silently take a Reading paper with it.

**`SessionRecord` is a discriminated union on `section`** (three members at schemaVersion 5):
`WritingSessionRecord` carries the essay and its `Analysis`; `ReadingSessionRecord` carries `testId`,
`testTitle`, the raw `answers`, a `ReadingResult` and its `module`; `ListeningSessionRecord` carries
the same minus `module` (there is none) plus `practice`. A union rather than one record with every
writing field made optional, because `analysis?` and `essayText?` would then propagate through the
report, the dashboard and the profile, which read those fields on nearly every line.

`isReadingSession` / `isListeningSession` / `isWritingSession` in `types.ts` are the only narrowing
anyone should use. The two answer-key guards test `=== 'reading'` / `=== 'listening'`. **The writing
guard is an exhaustive `switch` with a `never` default**, and that is a hard requirement rather than
a style: TypeScript never checks that a type predicate's BODY proves its predicate, so the old
fallthrough (`!== 'reading' && !== 'listening'`) would have compiled at exit 0 while calling the
fourth section an essay — inflating `totalSessions` and flipping a real weakness from `flat` to
`improving`, so the Dashboard congratulates a learner for fixing something they have not. With the
switch, forgetting the line is a BUILD failure whichever half is forgotten: a new `SessionRecord`
variant that is not in `SessionSection` fails to assign, and a new `SessionSection` member that is
not handled narrows the default away from `never`. A MISSING `section` still counts as writing (it
predates every section, so it can only be an essay); a present-but-UNRECOGNISED value counts as an
answer key, because a value from a newer build is far likelier to be one than an essay.

Validation on read is per record, and a Reading record's `module` is REQUIRED rather than
optional-but-not-wrong: it is the KEY of the `READING_BAND_TABLES` lookup in both `rawToBand` and the
report, so `module: 'speaking'` used to index to `undefined`, throw out of a render, and blank the
whole app behind the error boundary. Reading shipped at v4, after `module` arrived at v3, so no
legitimate Reading record can lack it. `rawToBand` is total in that argument too — an unknown module
falls back to the Academic table with a console warning, never a throw.

**A writing record's `band.byCriterion` must carry all four `Criterion` keys as finite numbers** — the
key list is derived from a totality-checked `Record<Criterion, true>` rather than a hard-coded array,
so a fifth criterion added later cannot silently narrow the check. `isRecordObject(band.byCriterion)`
alone used to accept `{}`: an imported or hand-edited record with an incomplete `byCriterion` loaded
cleanly, and `Report.tsx`'s `clampBand` floored the resulting `undefined` to 4, rendering a confident
"Task Response 4.0" with a filled bar and a matching aria-label for a band the record does not contain
— exactly the failure `src/reading/bandTable.ts`'s band-table fallback policy warns against: a band
that low is the number someone acts on. Two independent boundaries fix it. At the store, a record
failing the check is DROPPED on read (through the same per-record branch that backs the whole payload
up first, so nothing is destroyed) and rejected outright by `importData`. At the renderer,
`formatBand`/`bandPct` in `Report.tsx` now take `number | undefined` and print `'—'` / render an empty
bar rather than flooring to 4 — belt and suspenders, so a record that somehow reaches the report
without going through the store's own validator still cannot lie about a band it does not have. The
`aria-label` reads the same value through the same helper as the visible text, so a screen-reader user
never hears "4.0" where a sighted user sees "—".

**Both `computeProfile` and `computeTrends` drop Reading AND Listening sessions before any
arithmetic.** Neither produces any `IssueCategory`, so to rate maths each is indistinguishable from a
flawless essay: five answer-key papers would pull every writing error rate towards zero and drag a
real weakness out of the focus list. They are dropped from `totalSessions` too, which gates the focus
list — a learner is not two sessions into their writing practice because they sat two Reading papers.
`tests/profile-scoping.test.ts` pins it for both, and for Listening asserts the entire profile object
is byte-identical with and without the papers.

#### `profile/draft.ts` — the scratch draft

localStorage key `ielts-coach.draft.v1`, holding `{ task, module, promptId, essayText, mode,
examDeadlineEpochMs, savedAtISO }` — `examDeadlineEpochMs` is the absolute wall-clock deadline of a
RUNNING exam, `null` in coach mode and in exam-idle. This key is deliberately OUTSIDE the session
store's world: it is never exported, never imported, and carries no `schemaVersion` — a draft that
fails validation in ANY field is simply discarded (`loadDraft` returns `null`) rather than migrated.
It shares the `ielts-coach.` namespace but matches neither `STORAGE_KEY` nor `BACKUP_KEY_PREFIX`, so
it can never collide with a session and can never be swept by backup pruning. Reads treat the stored
bytes as hostile wire exactly like the store does: a zero-word `essayText` is never written, so one
found on disk is hand-edited or corrupt and is rejected outright.

**Written debounced (400ms) off the write view's existing `debouncedText`, no new debounce
machinery.** Cleared on a successful submit, on a task/module switch the learner has consented to
(the toggles below), and on an explicit "Discard draft". An UNCLAIMED draft — offered but neither
restored nor discarded — is never cleared at mount; the persistence effect skips entirely while
`pendingDraft` is set, so it cannot delete the very draft the restore card is offering.

**A draft found at mount is an OFFER, never applied silently** — auto-restoring would overwrite the
empty sheet a learner deliberately reloaded to get. The card names two actions, "Restore draft" and
"Discard draft". Restoring an expired exam draft (`examDeadlineEpochMs` at or before now) puts its
TEXT into COACH mode with a `role="status"` notice and never auto-submits — submitting is an act the
learner performs, and marking an essay nobody handed in is hostile; restoring into exam-idle would
also be invisible, since the editor is not rendered there. Restoring a still-running exam draft resumes
the clock from the ABSOLUTE deadline (not the seconds left), so the tab being closed costs no time.

**`beforeunload` warns exactly when closing the tab would destroy something no key holds**: a Reading
or Listening paper mid-run (both sections persist answers only on submit, by design — see their own
doctrine comments), or write-view text that is non-empty and differs from the text last written to the
draft key (the ≤400ms debounce window the draft cannot cover). Once the draft is on disk, closing the
tab is safe and the guard stays silent — warning then would be a lie that teaches learners to click
through warnings.

**Task/module switches confirm whenever they would clear a non-empty sheet, in any mode** — not only
while an exam clock runs. Consenting to the switch clears the draft too, so a learner who just agreed
to abandon an essay is never re-offered it as if the consent had not happened. Switching the module
from the READING view still clears nothing and asks nothing (the essay survives, as before this plan).

**Expiry at zero words returns to exam-idle with a notice and writes nothing.** Both manual submit
paths already refuse an empty sheet (the keyboard shortcut, the disabled submit button); the timer
hitting zero on a blank sheet used to be the one path that did not, and it wrote a Band-4-floor session
for an essay nobody wrote. The `role="status"` notice here is distinct from the save-failure banner
above: nothing was lost, so it is a notice, not an alert. An essay with at least one word still submits
exactly as before.

### `prompts/bank.ts`
40 prompts (8 per question type), realistic Task 2 wording, topics spread across education, technology,
environment, health, society, work, government, culture. Each with honest `parts` (checklist phrasing)
and `keywords` (lowercase content words, 6–12 per prompt). Standard instruction text ends every prompt:
"Give reasons for your answer and include any relevant examples from your own knowledge or experience.
Write at least 250 words." Each also carries `modules: Module[]` — the exams that would ask it. The
tagging rule is documented in the file header: both exams unless answering well needs a specialist or
theoretical frame (economic policy, demography, taxation theory, arts funding, platform regulation,
biodiversity science, political participation, globalisation), and BOTH when in doubt. Exports
`PROMPTS: PromptSpec[]`, `randomPrompt(module?): PromptSpec`, `promptsForModule(module)` and
`suitsModule(prompt, module)`.

## Preferences (`ielts-coach.prefs.v1`) & first-run intro

`src/profile/prefs.ts` holds device-local learner preferences under localStorage key
`ielts-coach.prefs.v1` — the `Prefs` interface (`src/types.ts`, near `Module`):
`{ introDismissedAtISO?: string; examDateISO?: string; targetOverall?: number;
targetBySection?: Partial<Record<SessionSection, number>>; module?: Module }`. This key is
deliberately OUTSIDE the session store's world: no `schemaVersion`, no migration rung — the record is a
handful of independent optional scalars, so "migration" is field-by-field validation on read rather than
a version ladder, and there is no ordering between fields for a ladder to preserve. A field this build
cannot validate is dropped ALONE, never taking a good field down with it (a hostile `targetOverall`
never costs the learner their `examDateISO`).

**Contract (plan 026 defines `introDismissedAtISO`, plan 027 extends it additively with the rest): one
flat JSON object; fields are ADDITIVE and optional; nothing is renamed or repurposed. Reads validate
field-by-field against hostile data — a malformed blob or a wrong-typed field is discarded, never
crashed on, because losing one preference costs one extra card or one re-typed date while throwing on
mount costs the app. Writes MERGE over the raw stored object, so a field this build does not know about
(e.g. one written by a newer build) survives a round-trip, and a key explicitly patched to `undefined`
clears just that field.** `loadPrefs()` reads (via `sanitizePrefs`), `savePrefs(patch)` writes; neither
ever throws.

**The fields, beyond `introDismissedAtISO`:**
- `examDateISO` — the exam day as a real calendar date (`'YYYY-MM-DD'`, not an instant); a rollover
  string like `'2026-13-40'` is rejected by round-tripping its components through `Date`, not by the
  regex shape alone.
- `targetOverall` / `targetBySection` — target bands, 4.0–9.0 in half steps (`isHalfBand`). Per SECTION
  (`writing` / `reading` / `listening`), never per Writing CRITERION: IELTS institutions set requirements
  per section, sometimes "no section below X", but never per criterion, so a "TR target" would be an
  invention with no real-world referent — the per-criterion tiles on the Report stay untouched.
- `module` — the exam the learner is preparing for, restored on the next visit (below).

**Module persistence.** `App.tsx`'s `module` state now initializes from `loadPrefs().module ??
'academic'` instead of a bare `'academic'` default, and `switchModule` calls `savePrefs({ module: next
})` right after `setModule`, sitting AFTER its confirm guards — declining an "abandon this attempt?"
dialog persists nothing. `readingHistory` is filtered by the live module, so persisting it changes which
Reading history a returning General candidate sees on load; that is the point.

**The export rider.** `buildExportJson` (the payload-construction half of `exportData`, split out so the
engine tests can pin it without a DOM) adds a `prefs` field carrying `loadPrefs()` when it is non-empty,
and omits the field entirely when it is — so a prefs-less export stays byte-identical to a build that
predates this. `importData` has never enumerated keys — it reads only `schemaVersion` and `sessions` —
so an older build importing a newer file with a `prefs` field keeps working, the field simply ignored.
When a file DOES carry `prefs`, `importData` restores it AFTER the sessions have fully validated and
been written (same sanitize-on-read discipline as `loadPrefs`), so a rejected file never half-applies
and a hostile prefs value inside an otherwise-valid file restores only its good fields rather than
poisoning the import.

**The honesty rule.** Every gap the app shows — the "Your exam" card's per-section lines, the Report's
target chip — states DISTANCE (a latest band against a target) and carries the same form-only hedge the
band hero does; none of it implies precision. A "you will reach band 7 by March" forecast was considered
and explicitly REJECTED: the band estimate is form-only and cannot honestly extrapolate a trajectory, and
a rule engine extrapolating its own error would manufacture precision this project has refused
everywhere else. Nothing in this app predicts an arrival date.

**The first-run intro card** renders as the first child inside the coach panel `<aside>`, which makes
two things structural rather than conventions someone could break: it can never appear in exam mode
(the aside only mounts when `mode === 'coach'`) and never off the write view (the aside only mounts
inside the write view's workspace). The panel column is its own grid track, so dismissing the card
reflows only that column and the editor never moves under the learner's cursor. It states the three
things a new learner has had no way to learn otherwise: the module toggle (Academic/General) picks the
exam and therefore the Task 1 type and the Reading papers offered; Coach gives live feedback while Exam
is a countdown with no feedback and paste blocked; band estimates are fixed-rule, form-only numbers,
likely at or above the learner's real band. Dismissing it ("Got it") sets `introDismissedAtISO` and the
card never returns on that device. The Coach/Exam toggle also carries a one-line `title` tooltip each
(`WRITING_MODE_META` in `meta.ts`), matching the pattern `MODULE_META.blurb` already used for the
Academic/General toggle.

The browser tab title is the static `"IELTS Coach"` (was `"IELTS Coach — Writing Task 2"`, stale since
Reading and Listening shipped). Per-view titles were evaluated and deliberately deferred: this is a
single-tab localStorage app with no router and no URL change between views, so the title is the only
tab identity and "IELTS Coach" stays accurate on every view; a `document.title` effect would add
view-coupled code to `App.tsx` for a marginal benefit.

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

**Progress is a writing view: the band trend, the error sparklines and the session table count essays
only, deliberately** — a Reading or Listening result carries no `IssueCategory` for them to plot.
**Export and Import act on the WHOLE store, not the writing-only list the page renders.** `exportData`
serialises every saved session regardless of section; `importData` replaces all of them. Export is
reachable from both the populated header and the empty state, so a learner with Reading or Listening
history but no essays can still take a copy before importing anything over it. The import confirm counts
every section from the whole store (`DashboardProps.allSessions`), not the writing-only `sessions` the
page renders from — the count must match what `importData` is about to replace, or it understates what
a wrong file destroys. The empty state's own line ("Write your first essay and your profile starts
here.") stays unchanged because it is still accurate — this page is the writing record — and any
Reading or Listening data is named separately, in its own line, rather than folded into that sentence.

**"Your exam" card** (`ExamGoalCard`, `Dashboard.tsx`): exam date with a days-remaining readout
(`daysUntil`); target overall band and per-section targets (Writing/Reading/Listening); the exam-type
select, wired through `switchModule` rather than a second module state, so it and the topbar toggle can
never disagree; and, for each section holding both a target and a latest band, a gap line ("Writing:
latest 6.5 vs target 7.0"). Rendered in BOTH of `Dashboard`'s returns — the empty state and the populated
view — because setting an exam date is the natural first action, before any essay exists. Every gap line
sits beside the form-only hedge (see "Preferences" above); the card never states an arrival date.
**The Report's target chip**: when `prefs.targetOverall` is set, one line under the band hero's existing
"Form-only estimate" caption states the target and repeats the hedge — the per-criterion tiles do not
gain a matching target, because per-criterion targets are not a real-world thing (see "Preferences").

## Cut from v1 (deliberate)
Handwriting-pace mode · UK/US consistency · cohesion X-ray overlay · warm-up drills · dictionary
spell-check (browser spellcheck covers Coach) · per-finding dismissal · plan-phase timer · Task 1 (see "Task 1 (v2)" below).

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
  **Main-clause guard**: the regex checks only for a comma, but a main clause can follow WITHOUT one —
  "If a country invests in education it will prosper." was told "a main clause never arrives", which the
  rule had never looked for. Before flagging, count finite verb GROUPS in the sentence; ≥ 2 means the
  main clause arrived, so stay silent. Groups not verbs: "does not act" and "will get" are each ONE
  finite verb, and counting them twice would silence a real fragment. A group is opened by an
  auxiliary/modal/copula, by a listed frequent lexical verb (base and -s forms plus irregular pasts),
  or by a word ≥ 5 chars ending -ed outside a small stop-list (need, indeed, succeed…); adverbs in -ly
  and not/never/also/still keep the current group open. `view` is deliberately NOT a listed verb — in
  IELTS it is overwhelmingly a noun, and reading it as a verb silenced "While others disagree with this
  view." Ambiguity resolves toward a HIGHER count and therefore toward silence, the safe direction here.
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
  The cap is pinned by mutation in `tests/false-positives.test.ts` — raising it to 99 must turn that
  block red. (It did not before 2026-08-10: the block's fixtures all stopped within two steps.)
  **Mass-sense escape**: eight COUNTABLE nouns — crime, time, future, world, environment, home, way,
  government — are MASS nouns in their commonest IELTS sense. They STAY in COUNTABLE ("a crime was
  committed" is equally valid), so the escape is contextual: skip the flag when such a noun is the bare
  direct object of a verb, i.e. the walk stopped at a stop-set verb or crossed one. "Governments must
  act to reduce crime" drew "write 'a reduce crime'"; "who commit crime" and "save time" drew the same
  class of nonsense. Cost, named because it is real: "protect environment" and "find way" are errors
  this now stays silent about — the module's policy is that a false positive costs more than a miss.
  **Verb-quote guard**: `usePhrase` rejected plurals and pronouns but not verbs, which is how a crossed
  verb reached the suggestion. A span containing a verb-like token now falls back to the bare noun, the
  same shape the walk cap already used. Verb-like = a listed crossable verb (the walk's stop-set holds
  only the verbs that END the walk, so a crossed verb is never in it), or any word directly after a
  modal / do / not / never. `to` is NOT a verb signal: it is an infinitive marker in "act to reduce
  crime" but a preposition in "due to new prison system", and that second case must keep suggesting
  'a new prison system'.
- A6 `agreement` (warning): -ing subject + plural verb anywhere in the sentence:
  /\b(having|working|travell?ing|wearing|playing|making|learning|studying|shopping|punishing|educating|giving|teaching|reading|watching|buying|renting)\s+[^.,;]{0,60}?\s(add|make|unite|help|give|allow|cause|lead|reduce|improve|require|need|create|bring|save|cost|take)\b/gi
  **Governing-verb guard**: the verb found must be the one the gerund subject governs. Skip when the
  span BETWEEN the -ing word and the verb ends in a modal, `do/does/did` (optionally + not/never), `to`,
  or a verb that itself takes a bare infinitive (help/let/make). A modal takes the bare infinitive, so
  "Working from home can reduce commuting costs" is correct — the rule was answering it with "can
  reduces". Testing only the in-between span leaves "Working from home reduce costs" caught.
- B1 `agreement` (warning): singular determiner + plural noun:
  /\b(a|an|one|each|every|another)\s+(?:\w+\s+){0,2}(women|men|children|people|persons|criminals|killers|prisoners|students|employees|citizens|teachers|workers|parents|years|skills)\b/gi
  Licensing middles (of, few, couple, dozen, several, many, number, lot, group, majority, pair, team,
  range, and the spelled-out numbers) make it correct as written — **plus any DIGIT**. Nothing matched
  a numeral, so "every 10 years" and "a further 20 years" were told to write "10 year". The numeral is
  what licenses the plural; only a bare "every years" is an error.
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
  The alternation is hyphen-guarded (`(?!-)`) so hyphenated compounds ("after-school", "before-tax") do
  not count. Both marker lists live in `analysis/complexity.ts`; the GRA list and the rail list are
  deliberately DIFFERENT and must not be merged without re-running the band calibration anchors.
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

## Task 1 (v2)

IELTS Academic Writing Task 1: describe a visual in ≥ 150 words in 20 minutes.

**The chart is DATA, not an image.** `Task1PromptSpec.chart` carries the numbers (`kind`, `title`,
`unit`, `categories`, `series[]`, `steps[]`). The app renders the visual itself from that data
(`components/Chart.tsx`), which is what makes deterministic factual checking possible: because the
engine owns the numbers it can verify that a cited figure exists, that the stated maximum is the real
maximum, and that an overview was given at all.

- `Task1PromptSpec` is a SIBLING of `PromptSpec`, not an extension — Task 1 has no `QuestionType`,
  and `RuleFn` keeps its `PromptSpec | null` signature.
- `analysis/chartFacts.ts` → `deriveChartFacts(chart): Task1ChartFacts` (`values` deduped ascending,
  `peak`, `trough`, `biggestRise`, `biggestFall`, `comparative`). Pure; TOTAL on degenerate input
  (empty series, all-null values, single point, values running past `categories`) — never throws,
  never divides by zero. Consecutive-step scans compare only NON-NULL neighbours, so a gap never
  invents a step. Ties in `peak`/`trough` resolve to the first occurrence in series-then-category
  order. `biggestFall.delta` is a POSITIVE magnitude; the field name carries the direction.
- `prompts/task1Bank.ts` → 12 prompts (`t1-01`…`t1-12`): 4 line, 3 bar, 2 pie, 2 table, 1 process.
  Standard instruction ends every prompt text: "Summarise the information by selecting and reporting
  the main features, and make comparisons where relevant. Write at least 150 words."
- **Bank integrity is a contract.** Pie series and percentage table rows sum to 100; every series is
  index-aligned with `categories`; authored numbers are the source of truth for the factual-accuracy
  rules, so a typo becomes a false accusation shown to a correct learner.
  `tests/task1-chart.test.ts` pins all of it.
- `components/Chart.tsx` — hand-written SVG, no charting library (the app has no runtime dependency
  beyond React). Line and bar and pie render as SVG; `table` renders a real `<table>` and `process`
  a real `<ol>`, because those carry the semantics screen readers need for free. `null` values are
  GAPS: a line breaks across them, a bar is absent — never drawn as zero. Series colours are four
  cool-end tokens declared in `Chart.css`; `--marking-red` and `--marking-amber` are semantically
  reserved and never used decoratively.
- Canonical Task 1 constants: word count minimum **150** (error below), target 170–200, exam duration
  **20:00**. Paragraph shape: paraphrase · overview · 1–2 detail paragraphs · NO conclusion (a
  conclusion is not required and merely repeats the overview).
- Maps are deliberately NOT supported: a map cannot be expressed as `categories × series` and would
  need a different renderer and different rules.

### `analysis/rules/task1Achievement.ts` — exports `task1AchievementRules(doc, prompt, facts)`
Takes `Task1ChartFacts`, so it is NOT a `RuleFn` — `RuleFn` keeps its `(doc, PromptSpec | null)` shape.
- `t1-word-count`: < 150 error · 150–159 warning "dangerously close" · > 220 warning "over-length".
- `t1-overview-missing` (error, ≥ 100 words): no overview marker anywhere. Detection is TWO-TIER —
  unambiguous phrases (overall|in general|in summary|it is clear that|the most striking feature|the
  most noticeable|the clearest trend|the general trend|the overall trend|taken as a whole) count
  anywhere; bare adverbs (generally|broadly) count ONLY sentence-initially, because "the lines moved
  broadly in parallel" is a detail sentence, not an overview. Accuracy matters in both directions: a
  missed overview costs a 5.5 cap the learner did not earn, and an invented one leaves the app silent
  about the biggest mark in Task 1.
- `t1-invented-figure` (error, inline): a number in the answer that is not in `facts.values`. GUARDS —
  skip values appearing in `chart.categories` (years are labels); accept |written − real| ≤ 0.5 or a
  round number within 5% (approximation is correct IELTS practice); accept pairwise sums and absolute
  differences of chart values ("a combined 90 per cent", "a gap of 36 points"); never fire when
  `facts.values` is empty. A false accusation is worse than a miss.
- `t1-no-data-cited` (warning, ≥ 120 words): zero numbers written while the chart has values.
- `t1-no-comparison` (warning, ≥ 120 words, only when `facts.comparative`): no comparison marker.
- `t1-explains-causes` (warning, inline): causal/predictive markers — Task 1 reports, never explains
  or forecasts. Worded as a check, not an accusation.
- `t1-opinion` (warning, inline): any Task 2 stance regex in a Task 1 answer.
- `t1-prompt-echo` (warning, inline): ≥ 8 verbatim words shared with the chart title or task text,
  ≥ 2 content words in the run — same threshold and reasoning as Task 2 `prompt-echo`.

### `analysis/rules/task1Structure.ts` — exports `buildTask1Structure(doc, prompt, facts, achievementIssues)`
Paragraph roles: paragraph 0 = `introduction` (the paraphrase), all others = `body`. **Never
`conclusion`** — Task 1 has none. Takes the achievement issues so `t1-paraphrase` can tell whether the
opening actually paraphrased or merely copied.
Checks (stable order, present from the first keystroke): `t1-paraphrase`, `t1-overview`,
`t1-detail-1`, `t1-detail-2`, `t1-figures`, `t1-comparison` (pushed ONLY when `facts.comparative`),
`complex-count` (reused from Task 2, target 4, one per paragraph).
Issues: `t1-shape` (warning, ≥ 150 words — paragraph count outside 3–4, or a conclusion signal in the
final paragraph), plus the reused `paragraph-balance`, which compares **detail paragraphs only**
(index 2 onward): paragraph 1 is the overview and is MEANT to be one short sentence, so measuring it
against a 60-word detail paragraph would flag the correct Task 1 shape as unbalanced.

### `analysis/task1BandEstimate.ts` — exports `estimateTask1Band(partial, doc)`
Imports the shared helpers from `bandEstimate.ts` rather than copying them, so the two estimators
cannot drift apart arithmetically. CC, LR and GRA are scored exactly as Task 2, except: the CC shape
reward targets **3–4** paragraphs with no conclusion requirement, the `no-conclusion` cap does not
exist, and the CC linking reward needs 6 devices rather than 8 (a 170-word answer has fewer
sentences). Under **100** words → all criteria 4.0 (Task 2's floor is 150).
TA (the 'TR' slot): `t1-word-count` error → cap 5.0 · `t1-overview-missing` → cap 5.5 ·
`t1-invented-figure` ≥ 3 → cap 6.0, ≥ 1 → −0.5 · `t1-no-data-cited` → −1.0 · `t1-no-comparison` → −0.5 ·
`t1-explains-causes` ≥ 2 → −0.5 · `t1-opinion` ≥ 1 → −0.5 · `t1-prompt-echo` ≥ 1 → −0.5.
Rewards: clean sweep · overview satisfied AND figures check satisfied · all structure checks satisfied.
Calibration anchor (`tests/task1-rules.test.ts`): a 170-word model answer to a two-series line graph
scores ≥ 7.0 on every criterion.

### Criterion naming
`Criterion` stays FOUR members. IELTS marks the same first slot as "Task Response" (Task 2) and "Task
Achievement" (Task 1) — one slot, two names. `meta.ts` exports `criterionLabel(criterion, task)`;
`CRITERION_META` remains the Task 2 default. A fifth member would force `Partial<Record<Criterion, …>>`
through the estimator and every view that renders it, to express a key always absent for one task.

## General Training Task 1 (letters)

IELTS General Training Writing Task 1: write a letter of ≥ 150 words in 20 minutes, answering three
bullet points the prompt supplies.

**Letter conventions are formulaic and externally fixed**, which is exactly the shape of problem a
deterministic rule engine solves perfectly. A candidate loses real marks for things a regex can see
with certainty — which greeting goes with which sign-off, whether the purpose was stated, whether all
three bullets were answered — and none of it needs to understand meaning.

- `LetterPromptSpec` is a SIBLING of `PromptSpec` and `Task1PromptSpec`, not an extension: a letter has
  no `QuestionType` and no chart, and one shape covering all three would make every rule defend against
  fields it cannot use. `task: 'letter'` discriminates.
- `prompts/letterBank.ts` → 15 prompts (`gt-01`…`gt-15`): 5 formal, 5 semi-formal, 5 informal.
  Standard instruction ends every prompt text: "Write at least 150 words. You do NOT need to write any
  addresses. Begin your letter as follows: Dear ...,"
- Canonical letter constants: word count minimum **150** (error below), target 170–200, exam duration
  **20:00** — identical to Academic Task 1, because `TASK_CONSTANTS` is keyed by task and not by module.
- Paragraph shape: greeting · purpose · one paragraph per bullet · close · sign-off. **No conclusion.**
  Paragraph 0 is the `introduction`, all others are `body`; `'conclusion'` is never assigned, so the
  rail draws no Conclusion group.
- **Reading is LINE-based, not paragraph-based.** The tokenizer merges any fragment under five words
  into its neighbour, and "Dear Anna," and "Yours faithfully," are exactly such fragments — by the time
  the paragraph list exists they have been absorbed into the body. `readLetterParts(doc)` therefore
  works over non-empty lines with absolute offsets, and is exported so the rail and the feedback panel
  can never disagree about whether a greeting exists.

### The tone system

`LetterTone = 'formal' | 'semi-formal' | 'informal'` is fixed by the prompt and drives three separate
checks: which greeting is acceptable, which sign-off pairs with it, and — uniquely in this codebase —
whether contractions are correct English in the answer at all.

| Tone | Reader | Greeting | Sign-off | Contractions |
|---|---|---|---|---|
| formal | unnamed, or a title + surname | Dear Sir or Madam · Dear Mr Hughes | Yours faithfully · Yours sincerely | error |
| semi-formal | named, known | Dear Mr Hughes · Dear Anna | Yours sincerely · Kind regards · Best wishes | error |
| informal | a friend | Dear Anna · Hi Anna | Best wishes · All the best · Love · Take care | **correct** |

### The pairing matrix (`analysis/rules/letterAchievement.ts`)

Encoded as DATA — two tables, `SALUTATION_FORMS` and `SIGNOFF_FORMS` — never as branching. A false
positive is then fixed by ADDING a greeting or closing form the table did not know about, never by
weakening the rule, which is the most valuable deterministic check in the whole letter module.

Greetings resolve to one of three kinds; each closing declares which kinds it licenses:

| Sign-off | Licensed after |
|---|---|
| Yours faithfully | `unnamed` ONLY |
| Yours sincerely · Yours truly · Sincerely yours | `named-formal` · `named-informal` (a name, either kind) |
| Kind/Warm/Best regards · Regards · Best wishes | `named-formal` · `named-informal` |
| All the best · See you soon · Take care · Love | `named-informal` ONLY |

Greeting kinds: `unnamed` (Dear Sir or Madam · Dear Sir/Madam · Dear Sir · Dear Sir and Madam · To
whom it may concern) · `named-formal` (Dear + Mr/Mrs/Ms/Miss/Dr/Prof + surname, and a **generalised
multi-name** row) · `named-informal` (Dear + first name · Hi/Hello/Hey + first name, the two-name
Hi/Hello variant, and a **generalised untitled multi-name** row). The list is ORDERED and the first
match wins, so "Dear Sir" reads as `unnamed` rather than as a letter to somebody called Sir.

**The two multi-name rows cover a greeting to TWO OR MORE readers, of any list length** — "A and B" or
"A, B and C" — built from one shared pattern (`nameListRe`, `letterAchievement.ts`) rather than one row
per reader count. The TITLED row (`named-formal`, `tones: ['formal','semi-formal']`) requires a title —
Mr/Mrs/Ms/Miss/Dr/Prof — ANYWHERE in the list, via a lookahead, not only on the first reader: "Dear Mr
Hughes and Anna," and "Dear Mr Hughes and Mrs Hughes," both read as `named-formal`, the conservative
direction, since a title present means at least semi-formal. The PLAIN row (`named-informal`) is the
untitled fallback and is ORDERED AFTER the titled row, so a list carrying any title reads as formal
rather than informal. Before this fix, the single-reader rows (which allow at most one title plus a
one- or two-token name) drew `gt-salutation-missing` — an ERROR telling a learner who had plainly
written a greeting to two or three readers that they had written no greeting at all. Writing to a
couple, or naming two readers, is ordinary General Training material (landlords, hosts, the neighbours
you kept awake). Both new rows carry the same `kind` and `tones` as the single-reader row they extend,
so nothing that used to be flagged escapes; this is the "fix a false positive by ADDING a row"
discipline above, applied. Both sit BELOW the single-reader rows and BELOW `Dear Sir and Madam`, which
stays `unnamed`: read as a pair of names either multi-name row would license "Yours sincerely" and
reject the "Yours faithfully" the greeting actually calls for, converting a correct letter into a
`gt-signoff-pairing` ERROR.

**The first line is tried WHOLE before it is tried comma-clipped** (`salutationCandidates`). Every
`SALUTATION_FORMS` pattern is `$`-anchored, so a genuine run-on line ("Dear Sir or Madam, I am writing
to complain…") still falls through to the clipped candidate, unaffected. What changes is the case where
BOTH match: "Dear Anna, Tom and Sam," used to clip to "Dear Anna," FIRST, matching the bare-name row and
discarding "Tom and Sam" — reading a three-reader greeting as a warmer one-reader greeting, and then
rejecting the sign-off the full greeting actually called for.

### `analysis/rules/letterAchievement.ts` — exports `letterAchievementRules(doc, prompt)`
Takes a `LetterPromptSpec`, so it is NOT a `RuleFn` — same reasoning as `task1AchievementRules`.

- `gt-word-count`: < 150 error · 150–159 warning "dangerously close" · > 220 warning "over-length".
- `gt-salutation-missing` (error, ≥ 40 words): the first line matches no greeting form. The gate is low
  because a greeting is the FIRST thing written. GUARD — the first line is tried whole AND clipped at
  its first comma when that comma is within 45 characters, so "Dear Sir or Madam, I am writing to…" as
  one run-on line is still a greeting; reporting an ERROR for a formatting habit is a false accusation.
- `gt-salutation-tone` (warning, inline): the greeting's `tones` do not include `prompt.tone`.
  "Hi Dave" in a formal letter; "Dear Sir or Madam" in a letter to a friend.
- `gt-signoff-missing` (error, ≥ 100 words): no closing in the sign-off window. The window is the last
  **2** non-empty lines — the standard shape, closing then signature — and keeping it tight is what
  stops a mid-letter "regards" or "love" being mistaken for the sign-off. It is EXTENDED backwards,
  to at most **4** lines, and only across trailing lines of **≤ 4 words**. That extension exists
  because standard business layout puts a reference or enclosure line under the signature
  ("Yours faithfully," / "Daniel Whitfield" / "Order reference 44718"); with a flat two-line window the
  closing fell outside it, and a correctly formatted letter drew an ERROR worth −0.5 TA while the
  pairing check — which needs both halves — went silent. gt-01's own bullet-1 keywords include
  `receipt` and `order`, so this is not a rare shape. **The walk also stops the instant the window
  already CONTAINS a closing line** (`isClosingLine`, shared between the window and the matcher so the
  two can never disagree about what a closing looks like) — line LENGTH alone is not enough, because a
  short BODY line can sit directly above the real closing and, by length alone, would extend the window
  PAST it: "Best wishes to you." (four words) two lines above "Yours faithfully," let the first match
  walking forward be the short body line instead of the real closing, and a perfectly closed letter drew
  `gt-signoff-pairing` — an ERROR — against a sign-off it never wrote. Second GUARD, unchanged: a line
  with more than four words left over after the match is prose, not a closing.
- `gt-signoff-pairing` (error, inline on the closing): the matrix above is violated. **GUARD — fires
  only when BOTH a greeting and a closing were found.** With half the evidence the correct pairing is
  unknowable, and guessing from half is how a rule starts telling learners their correct letter is
  wrong. The message names the correct closing explicitly rather than only reporting the clash.
- `gt-bullet-uncovered` (error, essay-level, ≥ 100 words): fewer than 2 DISTINCT keywords from
  `bulletKeywords[i]` appear in the body. The message quotes the bullet that was missed. GUARDS —
  the greeting line and everything from the sign-off onwards are cut out of the scan (a name in the
  greeting is not coverage); TWO keywords, never one, because a single common word is not evidence;
  keywords match by word-boundary PREFIX so "repair" covers repairs/repaired/repairing; and a bullet
  whose keyword list is too short to reach the threshold reads as COVERED, because an authoring bug
  must never be charged to the learner. **Under-detecting coverage tells someone who answered the task
  that they failed it, which is the worst thing this app can output.**
- `gt-purpose-missing` (warning, ≥ 100 words): no purpose marker (`I am writing to` · `I am writing
  regarding` · `I am writing in connection with` · `I would like to` · `I wish to` · `this letter is
  to` · …) in the first **60** words of the body. Sixty is deliberately generous: a greeting on its own
  line plus a short scene-setting sentence can legitimately reach word 40 before the purpose arrives.
  `I wanted to` and its four neighbours (`I just wanted to`, `I thought I would`, `I thought I'd`) are
  checked SEPARATELY, in `SENTENCE_INITIAL_PURPOSE_MARKERS`, and matched ONLY at a SENTENCE START —
  anchored on `^`, on a `.`/`!`/`?` boundary, or on a line break. Unanchored, they used to match anywhere
  in the opening, including mid-sentence: "When I bought a washing machine last month I wanted to have a
  reliable appliance" is a narrative clause, not a stated purpose, and the unanchored match silenced
  `gt-purpose-missing` AND ticked the rail's `gt-purpose` check GREEN on a formal letter that never said
  why it existed. They are checked in ADDITION to the tone's list, at EVERY tone — not folded into the
  informal list — because `gt-tone-mismatch` tells an informal writer to replace "I am writing to
  express" with exactly "I wanted to tell you", and a learner who obeyed one rule must not be warned by
  another for obeying it; anchored, "I wanted to enquire about the charge on my statement" still states a
  purpose in a letter to a bank.
  An INFORMAL letter additionally accepts a second, tone-scoped list: `you will never guess` ·
  `guess what` · `I have some news` · `I have to tell you` · `let me tell you` · … A letter to a friend
  states its purpose by ANNOUNCING it rather than by declaring an intention, and "You will never guess
  what has happened" is as clear about why the letter exists as "I am writing to inform you". The list
  is kept SEPARATE rather than merged, because none of it states a purpose in a formal letter — a
  complaint that opens "Guess what" has not said why it is writing, and the rule must still say so.
  `hasPurposeStatement(parts, tone?)` therefore takes the tone, and `letterStructure.ts` passes it too,
  so the rail and the feedback panel cannot disagree about whether the purpose was stated.
- `gt-tone-mismatch` (warning, inline, body only): register markers wrong for the tone, in BOTH
  directions. Formal/semi-formal → contractions, `hey`, `guys`, `mate`, `wanna`, `cheers`, `fed up`,
  `sort out`, exclamation marks. Informal → officialese: `henceforth`, `aforementioned`, `hereby`,
  `pursuant to`, `at your earliest convenience`, `profound dissatisfaction`, `I look forward to your
  prompt reply`, `to whom it may concern`. An informal letter that reads like a legal notice is exactly
  as wrong as a formal letter full of slang. Scanned over the BODY only, because the greeting and the
  closing have their own rules — flagging "Hi Dave" twice would report one mistake as two. **The overlap
  with `contraction` in a formal letter is NOT deliberate any more.** It was, once — see "The
  `lexical.ts` tone guard" below — but `contraction` now stands down for every letter tone, and
  `gt-tone-mismatch` alone reports a contraction inside a letter, as a WARNING, not an error: the
  severity drops, the same trade `!` already took.
  Four details the rule depends on:
  - **Both apostrophes.** The contraction alternation is BUILT from a list with `['’]` substituted for
    `'`, exactly as `lexical.ts` builds its own. A hard-coded straight apostrophe flagged `can't` and
    missed `can’t` — the macOS/iOS default — so the same learner making the same mistake got different
    coaching depending on the keyboard.
  - **`!` is owned HERE and nowhere else.** `informal-register` stands down for it in every letter (see
    the tone guard below), so one exclamation mark is one issue and is charged to the LR register count
    once. This is the same one-mistake-one-issue policy as the "Hi Dave" rule above.
  - **`guys` and `gonna`/`wanna` are owned HERE and nowhere else**, for the same reason as `!`:
    `informal-register`'s `REGISTER_LEXICON` carries both, and each is flagged `ownedByToneRule` so it
    stands down inside a letter rather than duplicate this rule's identical span and fix.
  - **`no problem` is the interjection only, and NOT on a comma or a semicolon.** It is matched with a
    lookbehind (it must OPEN a sentence) and a lookahead that admits ONLY `.`, `!`, `?` or the end of the
    text — so "that will be no problem", "the delay poses no problem" and "no problem has arisen" are
    left alone, as before, but so now is "No problem, I will arrange it": both the noun-phrase reading
    ("No problem, however, has arisen with the delivery") and the interjection survive a comma or a
    semicolon, and nothing available here can tell them apart without knowing whether what follows the
    comma opens a new clause. This is a DELIBERATE false negative — a false negative here costs nothing,
    where a false accusation costs trust — and the interjection reading still fires exactly as before on
    a full stop: "No problem. I will arrange it."

### `analysis/rules/letterStructure.ts` — exports `buildLetterStructure(doc, prompt)`
Paragraph roles: paragraph 0 = `introduction` (greeting plus purpose), all others = `body`. **Never
`conclusion`.** Unlike `buildTask1Structure` it does NOT take the achievement issues: it derives the
greeting and sign-off from `readLetterParts` directly, so the rail and the feedback panel cannot
diverge.
Checks (stable order, present from the first keystroke): `gt-salutation` (found AND matching the
prompt's tone), `gt-purpose`, `gt-bullet-1` … `gt-bullet-N` (one per bullet the task supplies),
`gt-signoff` (found AND correctly paired), `complex-count` (reused from Task 2, target 4).
`complex-count` here does NOT additionally demand one marker per paragraph as Academic Task 1 does — a
letter's closing paragraph is legitimately a single short request, and requiring a subordinate clause
there would leave the check permanently unsatisfiable for a correctly shaped letter.
Issues: only the reused `paragraph-balance` (warning, ≥ 150 words). There is deliberately no letter
shape category: three bullets can be answered in three paragraphs or folded into two, and both are
good letters. Balance compares paragraphs carrying NEITHER the greeting NOR the sign-off, because the
tokenizer merges those fragments into the first and last paragraphs, and measuring a 60-word middle
paragraph against a closing line plus a two-word signature would flag the correct shape as unbalanced.

**Every letter constant is pinned by a test that fails when the constant moves.** `CLOSE_WORDS` 160 ·
`OVER_WORDS` 220 · `SALUTATION_COMMA_WINDOW` 45 · `SIGNOFF_TRAILING_WORDS_MAX` 4 · the sign-off window
(2 lines, extended to at most 4 across lines of ≤ 4 words) · `COMPLEX_TARGET` 4 · `BALANCE_GATE_WORDS`
150 · the balance ratio 2×. They were all documented and none was exercised: each could be mutated to
an absurd value (220 → 2200, 45 → 1, 150 → 15000) with the whole suite still green, which means the
prose above was the only thing holding them. `tests/letters.test.ts` now names the mutation each test
fails under, and the greeting/signature exclusion in `bulletCoverage` carries TWO keywords on each
side of the body range, because with one the assertion passed whether or not the exclusion existed.

### `analysis/letterBandEstimate.ts` — exports `estimateLetterBand(partial, doc)`
Imports the shared helpers from `bandEstimate.ts` rather than copying them, so the three estimators
cannot drift apart arithmetically. CC, LR and GRA are scored as Academic Task 1, except the CC shape
reward targets **3–5** paragraphs, and the LR register count includes `gt-tone-mismatch` alongside
`informal-register` and `contraction`. Because that count SUMS the three, no single span may appear in
more than one of them: `gt-tone-mismatch` owns every span it shares with the other two inside a letter —
`contraction` (every letter tone), `guys`/`gonna`/`wanna` and `!` — via stand-downs in `lexical.ts`, so
nothing is charged twice. See "The `lexical.ts` tone guard" below.
Under **100** words → all criteria 4.0.
TA (the 'TR' slot): `gt-word-count` error → cap 5.0 · `gt-bullet-uncovered` ≥ 1 → **cap 5.5** (an
unanswered bullet is an unanswered part of the task, the weight `question-coverage` carries in Task 2)
· `gt-salutation-missing` → −0.5 · `gt-signoff-missing` → −0.5 · `gt-signoff-pairing` → −0.5 ·
`gt-purpose-missing` → −0.5 · `gt-tone-mismatch` ≥ 2 → −0.5 · `gt-salutation-tone` → −0.5.
Rewards: clean sweep · all bullets covered AND the register never slipping · all structure checks
satisfied.

### The `lexical.ts` tone guard — the one tone-dependent branch in the engine

`lexicalRules` takes an optional trailing `LetterTone`, exactly as `cohesionRules` takes an optional
`TaskKind`. It is supplied ONLY by `analyzeLetter`, so the mere PRESENCE of a tone — at any register —
is the signal "this answer is a letter, not an essay". FIVE clauses stand down: each is either a case
where the Task 2 rule gives actively WRONG advice about a letter, or a case where `gt-tone-mismatch` in
`letterAchievement.ts` already reports the identical span with the identical fix (`contraction` and `!`
are both, depending on which half of the tone system is in play):

1. **`contraction`, for EVERY letter tone — not only `informal` any more.** Two directions, both wrong
   to report here:
   - INFORMAL — "I can't wait to see you" is correct English at that register, the one place in IELTS
     Writing where it is right. Left in place, the rule marks a correct answer down.
   - FORMAL / SEMI-FORMAL — it really is wrong, and `gt-tone-mismatch` already says so, inline, on the
     SAME span, with the SAME fix ("write the full form"), naming the register THIS letter must hold.
     Both firing showed one mistake as two in the panel and charged it twice to the LR register count.
     The message is also about ACADEMIC writing, a genre the learner was not asked to produce.
     **The severity drops from ERROR to WARNING-ONLY inside a letter** — the same trade `!` (point 5)
     already took.
2. **`guys` and `gonna`/`wanna` in `informal-register`, for EVERY letter tone.**
   `letterAchievement.ts` FORMAL_VIOLATION_MARKERS carries both, on the SAME span with the SAME fix, for
   the same reason as point 1's formal/semi-formal case. Marked on the `RegisterEntry` with a dedicated
   `ownedByToneRule` flag, kept separate from `addressesReader`'s flag because the two guards protect
   different things: `addressesReader` stands down because the Task-2-only advice is wrong for a letter;
   `ownedByToneRule` stands down because `gt-tone-mismatch` already reports the same span. No other
   entry in `REGISTER_LEXICON` carries the flag — `kids`, `stuff`, `ok`, `really`, `totally`,
   `basically`, `huge`, `etc`, `and so on`, `kind of`, `get + adjective` and `big + abstract noun` have
   no counterpart in `FORMAL_VIOLATION_MARKERS` and keep firing in letters at every register.
3. **The second-person clause of `informal-register`, for EVERY letter tone.** That clause exists
   because a Task 2 essay must argue impersonally, and its fix — "write about 'people' or
   'individuals'" — is nonsense inside "I would be grateful if you could confirm". Measured against a
   correct 150-word formal complaint it fired four times. A letter ADDRESSES its reader; that is what a
   letter is for.
4. **The rhetorical-question clause of `informal-register`, for EVERY letter tone.** The worst of the
   five, because the engine was penalising exactly what the task ORDERED. General Training bullets say
   "ask what your friend has been doing" (gt-13), "ask for advice about where to stay" and "ask what
   you should see" (gt-15), "ask for the help you need" (gt-09) — and a formal letter asks too ("Could
   you confirm which of these two options you are able to offer?"). A learner who complied was told
   "Rhetorical questions weaken **academic tone** — turn this question into a statement"; a learner who
   then complied with THAT lost the bullet to `gt-bullet-uncovered`, an ERROR capping Task Achievement
   at 5.5, because the covering keywords live inside the question. No narrower guard is available:
   nothing in the engine can tell a rhetorical question from the one the task demanded, and in a letter
   the demanded one is the common case. The clause keeps its full force for Task 2 and Academic Task 1,
   where a question genuinely is rhetorical. **Nothing replaces it for letters** — a letter is entitled
   to ask, at every register.
5. **The exclamation clause of `informal-register`, for EVERY letter tone.** Two reasons, one per
   direction of the tone system, and both are false accusations. INFORMAL: `!` is correct in a letter
   to a friend ("come and stay whenever you like!"), and the message is about a genre — academic
   writing — the learner was not asked to produce. FORMAL/SEMI-FORMAL: `!` really is wrong, and
   `gt-tone-mismatch` already says so, inline, on the SAME span, with the SAME fix ("end the sentence
   with a full stop"), and naming the register this particular letter must hold. Both firing reported
   ONE mistake as TWO in the panel and charged it TWICE in the band estimate, where the LR register
   count sums `informal-register`, `contraction` and `gt-tone-mismatch`. `gt-tone-mismatch` owns `!`
   inside a letter because it is the rule that knows which register the letter is being marked
   against — the same one-mistake-one-issue policy `letterAchievement.ts` states for "Hi Dave".
   (This mirrors point 1's formal/semi-formal case exactly — same policy, same reason. Point 1 used to
   be the odd one out, kept as a deliberate overlap; it no longer is.)

Nothing else in the module changes, and no other caller can be affected: `analyzeEssay` and
`analyzeTask1` pass no tone and reach identical code. `tests/letters.test.ts` pins that directly for
`contraction`, second-person address, rhetorical questions and `!` by asserting all four still fire for
Task 2 and Academic Task 1 on a fixed input; `guys`/`gonna`/`wanna` share the exact same `isLetter` gate
as the second-person clause, so the same leak guard covers them too. The only way this guard can go
wrong is by leaking, so that is what is tested.

### Engine and error profile
`analyzeLetter(text, prompt)` in `analysis/engine.ts`, beside an UNCHANGED `analyzeEssay` and an
UNCHANGED `analyzeTask1`. Achievement runs before structure, mirroring `analyzeTask1`. The
sort-and-assign-ids block is duplicated a third time for the same reason it was duplicated a second.
The four shared modules are called with a `letterContext(prompt)` adapter carrying the prompt keywords
PLUS every bullet keyword, and NO measurement vocabulary — a letter quotes no figures.
`categoryAppliesTo(category, task, module)` gained an optional `module` parameter defaulting to
`'academic'`. `TaskKind` alone cannot express "General Training Task 1": the letter and the Academic
chart description are different tasks sharing the id `'task1'`. Letter categories apply only to
`task1 + general`; the `t1-*` set is now `task1 + module !== 'general'` (written that way, not
`=== 'academic'`, so a stored record from before the module field existed still counts as Academic).

### Worked letters and UI
`answers/letterModels.ts` holds THREE hand-written letters, one per tone. Letters cannot be generated
the way Academic Task 1 answers are — there is no data to compose from — so they are maintained by
hand. What a learner needs from a worked letter is the SHAPE and the REGISTER, and both are properties
of the tone rather than of the scenario, so `letterModelFor(prompt)` offers the model for the same tone
with `exact: false` when the prompt has no letter of its own. All three are graded by the app's own
engine in `tests/model-answers.test.ts`: no error or warning, every structure check satisfied,
band ≥ 8.0 (they score 8.5 / 8.5 / 8.0).
UI: General + Task 1 renders a letter picker, the task text with its three bullets as a real `<ul>`
(the bullets ARE the task, so exam mode shows them too) and the editor. `App` keeps THREE prompt slots,
because Academic and General Training Task 1 are different tasks sharing a `TaskKind`. `StructureRail`
takes an optional `module` and derives a `RailShape` of `'task2' | 'task1' | 'letter'`; `gt-salutation`
and `gt-purpose` group under Introduction and everything else falls through to Body, so no Conclusion
group is drawn. Letter paragraph norms: opening 20–50, body 30–80; short label `Open` then `B1`, `B2`.
`Report` needed no change — `criterionLabel(c, 'task1')` already reads "Task Achievement" and the
POSITION CHECK card is already Task 2 only.

## Worked answers (`answers/`)

A "Model answer" tab in the coach panel, for both tasks. **Never rendered in exam mode** — handing a
learner a finished answer mid-exam defeats the exercise.

- `answers/task1Model.ts` → `buildTask1ModelAnswer(prompt)` GENERATES the answer from the chart's own
  numbers. The same data ownership that makes factual checking possible lets the app write a correct
  answer to its own question, so an example can never cite a figure the chart lacks. Four constraints
  shape it, each a rule the app enforces on the learner: no invented figures (counts are spelled out
  as words, so "four points" cannot read as a quoted figure), a complex clause in every paragraph, a
  comparison marker whenever the chart is comparative, and no causal or predictive language.
  Single-series charts with no `periodLabel` are RANKINGS, not trends — narrating "a climb from
  Housing to Clothing" would describe a movement the data does not contain.
- `answers/task2Models.ts` → five HAND-WRITTEN answers, one per question type, plus
  `task2ModelFor(prompt)`. Task 2 cannot be generated: an argument is not derivable from a prompt, and
  a template would produce exactly the rehearsed prose `memorised-phrase` penalises. When the
  learner's prompt has no exact answer, the representative answer for the same question type is
  offered with `exact: false`, and the UI states plainly that the content will not fit.
- **The app grades its own examples.** `tests/model-answers.test.ts` runs all seventeen back through
  the real analyser: each must raise no error or warning, satisfy every structure check, and score
  ≥ 8.0. A model answer the engine would mark down is worse than none — the learner follows it and is
  then penalised for what it did. The panel shows that band and check count on screen, so the target
  is verifiable rather than asserted.
- The panel grades the example against the prompt it was WRITTEN for (`sourcePromptId`), never the
  one on screen. A fallback answer legitimately does not address the learner's question, and scoring
  it against that question made the app mark its own exemplar down on 14 of the 40 prompts.
  `tests/model-answers.test.ts` asserts 8.0+ for all 40 through that exact path.
- The panel also warns against reusing the wording, since examiners discount memorised phrasing.

### Library (`components/ModelLibrary.tsx`)

A `Models` library view, reached from the topbar nav, lists all three banks grouped — 40 Task 2
essays, 15 General Training letters, 12 Academic Task 1 charts — and badges the 5 exact Task 2
answers and the 3 exact letters, marking every Task 1 answer as generated from its own chart's
numbers.

- Each entry renders the SAME `ModelAnswer` component the coach panel uses — engine-graded
  scorecard, fallback honesty notice and memorisation warning included — so the library can never
  show something that disagrees with the panel; there is exactly one place that logic lives.
  Badges are computed from `task2ModelFor` / `letterModelFor`, the same functions `ModelAnswer`
  itself calls, never a re-implementation of the exact/fallback rule.
- Only the OPEN entry renders `ModelAnswer` and is graded — the engine never runs for all 67
  entries on view load, only for whichever one the learner expanded.
- "Practise this prompt" pins task, exam module and the chosen prompt on the writing desk in coach
  mode with a blank answer sheet (`App.tsx`'s `handlePractiseFromLibrary`) — not
  `startNewEssay(prompt)`, whose random draw only reaches the Task 2 slot, and not `handleRedraft`,
  which restores a session's essay text rather than starting blank. Letters are General Training
  only, so picking one also sets the module. Discarding a non-empty essay already on the desk asks
  the same consent `switchTask`/`switchModule` ask, and clears the draft explicitly for the same
  reason those two do.
- The library link lives in the nav, which the cleared desk (`deskCleared`) removes — the same gate
  that already hides Progress — so the exam-mode contract above ("never rendered in exam mode")
  holds unchanged: the library is never reachable while a writing exam, Reading paper or Listening
  section is running.

### UI
Task switcher in the topbar beside the mode toggle, same markup and styling. Switching task CLEARS the
answer sheet (a Task 2 essay scored by Task 1 rules produces confidently wrong feedback) and refuses to
switch silently while an exam clock runs — same `confirm()` as `switchMode`. Two prompt slots are kept,
one per task, so switching away and back returns the learner to the question they were looking at.
Per-task constants live in `meta.ts` as `TASK_CONSTANTS`: Task 1 = 20:00 and 150 words, Task 2 = 40:00
and 250 words (unchanged). `EXAM_DURATION_SEC` / `MIN_WORDS` / `TARGET_WORDS` remain exported as the
Task 2 values so existing call sites stay valid.
The chart renders in BOTH modes — it is the question, so exam mode must show it. Task 1 uses a plain
`<select>` of the twelve prompts rather than the Task 2 `PromptPicker`, which filters by question type.
The Task 2 cheat sheet is hidden in Task 1 (it teaches the wrong task); a Task 1 sheet is separate work.
Structure Rail: `t1-paraphrase` and `t1-overview` group under Introduction; details, figures, comparison
and complex-count under Body. There is NO Conclusion group in Task 1 — the rail already drops empty
groups. Paragraph norms and short labels are task-keyed (Task 1: paraphrase 20–40, overview/detail
20–70; labels Para · Over · D1 · D2).
Report: criterion labels come from `criterionLabel(criterion, session.task)`, so the first slot reads
"Task Achievement" in Task 1, and the header names the actual task. The POSITION CHECK card does not
render for Task 1 — Task 1 has no position.
FeedbackPanel takes `task` so the "estimates unlock at N words" hint matches the estimator's floor
(100 for Task 1, 150 for Task 2). The editor placeholder is task-specific.
The "estimates unlock at N words" copy and the panel's own too-short gate read the SAME
`minWordsForEstimate` variable — N is always the engine floor (100 for Task 1 and letters, 150 for
Task 2) — so the printed number and the gate that hides the estimate can never disagree.
Dashboard: a Task column, and the Question column shows the chart kind for Task 1 rows. The band trend
chart still mixes both tasks and says so in its caption.

### Engine
`analyzeTask1(text, prompt)` in `analysis/engine.ts`, beside an UNCHANGED `analyzeEssay`. Achievement
runs BEFORE structure, because the structure checks read its prompt-echo spans. The sort-and-assign-ids
block is deliberately duplicated rather than factored out, so `analyzeEssay` stays byte-identical and
the Task 2 regression tests mean what they say.
`cohesionRules`, `lexicalRules`, `grammarRangeRules` and `accuracyRules` are reused unchanged. They are
called with a `topicContext(prompt)` adapter, NOT with null: those modules read `keywords` (which
`lexical.ts` excludes from repetition counting) and `type` (which `cohesion.ts` checks only for
'discussion'). Passing null would strip the keyword exclusion, and a Task 1 answer MUST repeat the
chart's subject nouns. The adapter also injects TASK1_MEASUREMENT_VOCABULARY (cent, percent,
percentage, proportion, figure, chart, graph, table, period, year, total …) — a 180-word percentage
description says "per cent" five or six times because there is no synonym, and the engine must not
penalise a learner for describing a percentage chart in percentages.

## Reading (both modules)

Reading is the one section this app scores **exactly**. There is no natural-language analysis in it:
a Reading test is an answer key, and a raw score becomes a band by table lookup. No heuristic, no
false positive, no "form-only estimate" caveat. **The UI must state that the band is exact**, because
a learner who has been told "estimate" on every Writing screen will otherwise discount this number
too — and it is the only score in the app they can plan around.

60 minutes, 40 questions, 3 sections, both modules. No transfer time (unlike Listening), so the clock
is a single 60:00 countdown with no breaks. Every paper is worth 40 marks: no partial credit, and **no
penalty for a wrong answer**, so a guess always beats a blank.

### The conversion tables — CANONICAL DATA

Both tables live in `src/reading/bandTable.ts` and are restated here. If IELTS revises them, those two
places change together and nothing else does. `tests/reading-bands.test.ts` restates all 41 raw scores
per module INDEPENDENTLY rather than deriving them from the table, so a mistyped boundary fails.

| Band | Academic (raw/40) | General Training (raw/40) |
|---|---|---|
| 9.0 | 39–40 | 40 |
| 8.5 | 37–38 | 39 |
| 8.0 | 35–36 | 37–38 |
| 7.5 | 33–34 | 36 |
| 7.0 | 30–32 | 34–35 |
| 6.5 | 27–29 | 32–33 |
| 6.0 | 23–26 | 30–31 |
| 5.5 | 19–22 | 27–29 |
| 5.0 | 15–18 | 23–26 |
| 4.5 | 13–14 | 19–22 |
| 4.0 | 10–12 | 15–18 |

General Training is markedly stricter — roughly **four more correct answers for the same band**. A
candidate on 30/40 is a 7.0 in Academic and a 6.0 in General Training. Getting this wrong in either
direction misleads a learner about their readiness, which is why the module is taken from the PAPER
(`test.module`) and never from the topbar toggle.

`rawToBand(raw, module)` is total: the raw score is clamped to 0–40 and rounded, a non-finite input is
treated as 0, and a score **below the lowest printed row returns that row's band — the FLOOR, not an
extrapolation**. Extrapolating would print a band 2.5 the published table never states, dressing a
guess in the same authority the rest of the table earns. At that level the report leads on the raw
score instead.

Sources: [IELTS scoring in detail](https://www.ielts.org/take-a-test/your-results/ielts-scoring-in-detail)
and the published raw-score conversion tables.

### Marking rules (`src/marking/markAnswerKey.ts`)

Deliberately in `src/marking/` rather than `src/reading/`: Listening (plan 011) is the same problem —
a fixed key, a raw score, a conversion table — and will mark against this function with its own table.
Nothing in it knows what a passage is.

Applied leniencies, each the kind a human marker applies without thinking, and each visible in the
result:

- **case is ignored**;
- leading/trailing space and internal whitespace runs are normalised;
- edge punctuation and typographic quotes/dashes are normalised away (inner punctuation is kept, so
  "don't" survives);
- a leading article is optional on **completion answers only**, and only AFTER the word limit has been
  checked, so it can never rescue an over-length answer.

**Optional means omitted or added — never SWAPPED.** The learner may leave out the article the key
prints ("greenhouse effect" against a key of "the greenhouse effect") or supply one the key does not
print ("the greenhouse effect" against a key of "greenhouse effect"). Substituting one article for
another is a different answer: **a key of "the sun" does not accept "a sun"**. Stripping the article
from both sides before comparing — which is what the code did until the article was made genuinely
optional — turns it into a free variable and marks a wrong answer right. An item-writer who wants both
determiners accepted lists the bare form as well, and the "added" direction then covers all three.

Unconditional, because this is how the real exam marks:

- **a blank is never correct**, whatever the key says;
- **over the word limit is wrong**, even when the content is right.

**The marker never guesses at equivalence.** British and American spellings, plurals and genuine
synonyms are accepted because the answer key LISTS them (`answers: ['car', 'automobile']`, canonical
first) — not because the marker transforms them. An automatic -ise/-ize rewrite would be a rule the
item-writer cannot see, and the first time it accepted something the real exam rejects, the band would
stop meaning what it claims to mean.

Word counting matches IELTS: whitespace separates words, so "well-being" and "1,500" are each ONE word.

### The other half of that rule: keys must be COMPLETE

Refusing to guess at equivalence puts the whole burden on the answer key, so an incomplete key is a
marking defect and not a cosmetic one. Every rendering of the SAME answer that a real examiner accepts
has to be written down, and a key that lists some of them is more dangerous than one that lists none,
because the omission is invisible: a test that walks `question.answers` passes however much of the key
has been deleted. The papers therefore list, for each completion gap and always subject to the
question's own word limit:

| Class | Written out as |
|---|---|
| numbers | figures and words, and the ordinal where the gap is a date — `['14', '14th', 'fourteenth']` |
| a unit or currency symbol **preprinted beside the gap** | with it repeated and without — `£ ____` takes `['680', '£680', '£ 680', '680 pounds']` |
| times | both separators and both clocks, `pm` spaced and closed up, pointed and bare — ten forms for one sailing |
| spelling and hyphenation | every variant the exam accepts, British and American — `['1,000 metres', '1,000 meters']`, `['cross-dating', 'cross dating', 'crossdating']` |

Two forms are deliberately NOT listed, and the boundary is worth stating because it is where the next
item-writer will be tempted. **A unit or symbol is the same value written differently** — "£680" and
"680" are one answer, so both belong in the key. **Preprinted words that are not units are additional
content**, not another rendering: "Petra Lindqvist" against a key of "Lindqvist" is a judgement that
surplus preprinted text is harmless, which is a policy this app has not adopted and would have no edge
to. And anything that breaks the printed word limit stays out however right it sounds, because the
marker checks the limit first and would fail it anyway.

`tests/reading-marking.test.ts` and `tests/listening-marking.test.ts` each carry a block that writes
the learner's forms out **by hand** for the keys most exposed to this — the money answers, the units,
the ferry time — precisely so that deleting an alternate fails a test instead of silently costing a
learner a mark.

Those by-hand blocks are excellent for the three papers that exist and worth nothing to a paper that
does not. `src/marking/keyLint.ts` generates the **numbers**, **units** and **times** classes from the
table above and asks the real marker, via `markAnswerKey`, whether the key already accepts each
candidate it proposes — never guessing at equivalence itself, and never called from
`markAnswerKey.ts`, for the reason the marker's own header gives: a transform the item-writer cannot
see is a rule nobody can audit. `tests/answer-key-lint.test.ts` runs it over every completion question
of every registered paper, so a new paper inherits this check instead of needing a new hand-written
block. **The spelling-and-hyphenation class is not generated** and remains the item-writer's
judgement — `metres/meters` is a lookup and `cross-dating / cross dating / crossdating` is a decision
about one compound, not a function of the answer string, and guessing there would make the app accept
what the real exam rejects. A clean run of the linter therefore does not mean a complete key; the
by-hand blocks and a human read stay the acceptance test for new content.

### Question types (v1 — the six that cover ~80% of a real paper)

`ReadingQuestion` is a discriminated union on `type`, modelled on how `Task1Chart` handles `kind`.

| Type | Answer shape | Widget |
|---|---|---|
| `true-false-notgiven` | TRUE / FALSE / NOT GIVEN | radio group |
| `yes-no-notgiven` | YES / NO / NOT GIVEN | radio group |
| `multiple-choice` | one of four | radio group, printed A–D |
| `completion` | short text, `maxWords` enforced | text input + printed limit |
| `matching-headings` | heading id per paragraph | select over the shared bank |
| `matching-information` | paragraph letter per statement | select over the labels |

Multiple choice stores the **option TEXT, never its letter**, so marking can never depend on the order
options happen to be printed in and the answer key stays readable.

`READING_TYPE_META` in `meta.ts` holds the learner-facing name and the printed instruction per type.
The instruction belongs to the TYPE, not to the passage: an item-writer restating it per question
would eventually restate it differently, and a learner practising against drifting instructions is
practising the wrong thing. `wordLimitLabel(n)` prints the limit as the paper prints it — "NO MORE
THAN THREE WORDS", not "max 3".

### Content and licensing

`src/reading/tests/` — one complete Academic paper and one complete General Training paper, 40
questions each, every passage carrying a `ReadingPassageSource` with its description and licence.
**No text is reproduced from any IELTS publisher.** Real passages and question sets are University of
Cambridge (UCLES) copyright and cannot ship in an outward-facing app; the FORMAT is not copyrightable,
so the papers follow the real structure with prose and questions written from scratch.
`tests/reading-marking.test.ts` fails the build if any source is missing or blank, and asserts every
key is non-empty, every multiple-choice key is one of its own options, and every completion key fits
its own word limit — a key the learner cannot possibly satisfy is the content equivalent of a false
accusation.

The General Training paper is structured differently on purpose: `ReadingPassage.texts` is a LIST
because GT Section 1 prints two or three short texts (adverts, notices, a timetable) where an Academic
passage prints one.

### UI

- **`ReadingPicker`** — papers for the ACTIVE module only, each with its section/question/type
  breakdown, plus that module's past results. States the exactness claim up front.
- **`ReadingRunner`** — split pane, passage left and questions right, each scrolling independently;
  passage tabs with a live answered count; 60:00 countdown reusing `Timer`. Questions are printed in
  runs of consecutive same-type questions, one instruction per run, with a matching-headings bank
  printed once above its set. Answers live in component state and are persisted **on submit only** —
  a half-finished paper is not a session. The clock derives from a wall-clock deadline, not from tick
  counting, for the same reason as the writing exam: browsers throttle intervals in hidden tabs. Time
  up submits the paper as it stands. Sitting a paper clears the desk exactly as exam mode does.
- **`ReadingReport`** — band + raw score, the sentence "This band is exact, not an estimate", the
  published table row that produced it, how many more correct answers the next band needed, per-type
  accuracy **weakest first**, and every question against the key with its explanation. Over-limit
  answers say so explicitly, because it is otherwise the most baffling way to lose a mark.

Per-type accuracy is the differentiator: "you lose Not Given, you are fine on matching headings" is
actionable in a way an overall band is not. Types with fewer than 3 questions rank last however badly
they went — one wrong out of two is noise, and leading the coaching with noise sends the learner to
drill the wrong thing.

`--marking-red` appears in the Reading UI only in the report, where a wrong answer against a published
key genuinely is an examiner's-pen error. In the runner an over-length answer is **amber**: it is a
warning while the paper is open and becomes an error only once it is marked.

## Listening (one paper, both exams)

Reading's sibling: an answer key, a raw score out of 40, and a published conversion table. Marked by
the SAME function Reading marks with — `src/marking/markAnswerKey.ts`, with Listening's table injected
— so there is no second definition anywhere of what "over the word limit" means. **The band is exact,
not an estimate**, and the report says so for the same reason Reading's does.

**Identical in Academic and General Training.** Same sections, same timing, same paper, one conversion
table. See "Modules" above for the list of fields that deliberately do not exist because of it.

30 minutes of recording and answering, then **10 minutes** more. Four sections of ten questions,
rising in difficulty: (1) a two-speaker everyday transaction, (2) an everyday monologue, (3) an
educational conversation of up to four speakers, (4) an academic lecture.

### The audio decision — CANONICAL

Plan 011 offered three options and refused to let code be written before one was chosen. The choice
is **option B: browser speech synthesis (`window.speechSynthesis`), with option C — a fixed-pace
transcript reveal — as the fallback wherever no usable voice exists.** Recorded here as canonical;
`src/listening/speech.ts` and `src/listening/index.ts` carry the same reasoning next to the code.

- `speechSynthesis` is a **built-in browser API, not a runtime dependency**. It adds no bundled bytes
  and the app's stated "nothing beyond React" property survives intact, which no other option manages.
- It **works offline**, like the rest of the app.
- **Option A (bundled recordings) was rejected on size**: roughly 25–30 MB per test against a 371 kB
  app. That is not a trade-off, it is a different product. It would also need voice actors or licensed
  recordings, and the exam's four accents mean four of them.
- **Option C alone was rejected as too weak** — it is a reading exercise with a clock on it — but is
  exactly right as a fallback, because the alternative on a browser with no voice is silence.

**The cost, stated plainly because the UI must state it too.** A synthetic voice is *not* the real
exam. The real test uses actors recorded in a studio with British, Australian, North American and New
Zealand accents, and accents are part of what it examines. This practice trains the question types and
note-taking; it does not train accents.

Two exported constants carry that honesty so it cannot quietly go missing:

| Constant | Shown when | Says |
|---|---|---|
| `SYNTHETIC_VOICE_NOTICE` | a voice exists (`SpeechSynthesisDriver`) | the voice is the browser's, not a recording, and names the four real accents |
| `TRANSCRIPT_FALLBACK_NOTICE` | no voice exists (`TranscriptPaceDriver`) | the transcript is being revealed at speaking pace and this is a reading exercise |

`noticeFor(driver.kind)` picks between them. One of the two is on screen the whole time a Listening
paper is open, and again on the picker before the learner commits 40 minutes. The runner shows the
transcript text **only** under the fallback driver: printing the script while a voice speaks would be
subtitling, and a subtitled listening test is a reading test. The rule ends when the paper does — the
report prints the full tapescript after submission, which is what the practice books do.

`SpeechDriver` is an interface so the runner can be tested without a speech engine. `FakeSpeechDriver`
uses no timers, no globals and no randomness. **No test may depend on a real `speechSynthesis`** —
jsdom has none, and where one exists it is famously inconsistent across platforms.

### The conversion table — CANONICAL DATA

**One table, not two.** In `src/listening/bandTable.ts`, restated here; if IELTS revises it those two
places change together and nothing else does. `tests/listening-bands.test.ts` walks all 41 raw scores.

| Band | Raw score /40 |
|---|---|
| 9.0 | 39–40 |
| 8.5 | 37–38 |
| 8.0 | 35–36 |
| 7.5 | 32–34 |
| 7.0 | 30–31 |
| 6.5 | 26–29 |
| 6.0 | 23–25 |
| 5.5 | 18–22 |
| 5.0 | 16–17 |
| 4.5 | 13–15 |
| 4.0 | 11–12 |

The shape is genuinely different from Reading's, not a copy with the numbers nudged: Listening's 7.0
needs 30 (as Academic Reading does) but its 6.0 needs only 23 and its 5.5 band is five marks wide.
Deriving one table from the other would be wrong at nearly every boundary.

`listeningRawToBand(raw)` takes **no module argument**. It is total: the raw score is clamped to 0–40
and rounded, a non-finite input is treated as 0, and a score below the lowest printed row returns that
row's band — the FLOOR, not an extrapolation, exactly as Reading's does and for the same reason.

Verified against three independent published reproductions before it was committed: IDP IELTS India (a
co-owner of the test), ieltstutors.org and edubenchmark.com. The only disagreement is the bottom row,
which the latter two give as 10–12 → 4.0. It is **not observable through this function**: 10 correct
falls below the lowest row either way and the floor returns 4.0 under both readings. The co-owner's
figure is what is stored.

### Marking rules

Every leniency and every refusal is `markAnswerKey`'s, unchanged — see "Marking rules" under Reading
for the full list. Listening supplies only the conversion table. `src/listening/mark.ts` contains no
marking logic at all, which is the point: duplicating the marker would have meant two definitions of
the word limit and the two would eventually have disagreed.

**That prohibition binds the tests too.** The authored-content check in `tests/listening-marking.test.ts`
counts each key with the marker's own `countWords(normaliseAnswer(...))`, not a local
`split(/\s+/)`. A second definition living in a test is still a second definition, and a test-only one
fails in the worst direction: it passes a key that the runtime then marks the learner down for.

Two pieces of impedance matching happen in that adapter and nowhere else:

- `MarkableTest` structurally requires a `module`. A placeholder goes in and is **stripped back off**
  the result, so the meaningless field never reaches a caller who might branch on it.
- `byFormat` is computed in the adapter rather than in the shared marker, because `ListeningFormat` is
  a Listening concept and the marker must stay ignorant of both sections' vocabularies.

No partial credit and no penalty for a wrong answer, so a guess always beats a blank.

### Question formats — the `format` / `type` split

**`type` says how a string is compared; `format` says how the item is presented and reported.** They
are deliberately different axes, and getting them confused is the one modelling mistake this section
can make.

| `format` | Marking `type` | Widget | Reported as |
|---|---|---|---|
| `form-completion` | `completion` | text input + printed limit | Form completion |
| `note-completion` | `completion` | text input + printed limit | Note completion |
| `table-completion` | `completion` | text input + printed limit | Table completion |
| `short-answer` | `completion` | text input + printed limit | Short answer |
| `multiple-choice` | `multiple-choice` | radio group, printed A–D | Multiple choice |
| `matching` | `multiple-choice` | select over a shared bank | Matching |
| `map-labelling` | `multiple-choice` | select over a shared bank | Plan / map labelling |

Matching and plan/map labelling **mark as multiple choice** because that is exactly what they are once
the paper is off the desk: pick one entry from a shared bank. Splitting them at the marking layer would
mean a second copy of the marker for no behavioural difference.

But they must not be *reported* as multiple choice. A type-keyed breakdown on the authored paper prints
one row reading "multiple choice 6/23" and buries the fact that the learner loses plan labelling and
nothing else. **The report therefore breaks down by `byFormat`, never by `byType`** — three rows, not
one — and the runner renders by `format` too, via `LISTENING_FORMAT_META[...].widget` so the mapping is
one table rather than a switch a new format could fall through.

Selections store the option **TEXT, never its letter**, as Reading's multiple choice does, so marking
can never depend on the order a bank happens to be printed in.

Plan/map labelling describes each position **in words** rather than pointing at an image, because the
app ships no images. The printed instruction says so.

`ListeningQuestionGroup` carries the printed instruction and heading, and the groups **tile 1–40** —
`tests/listening-marking.test.ts` fails if they do not. The instruction belongs to the GROUP here, not
to the format as Reading's does, because the same note-completion format takes different word limits in
different blocks of one paper.

### The play-once rule

**The recording plays once, in order, and never again.** It is owned by `ListeningPlayer`
(`src/listening/player.ts`) — headless, no timers, no DOM — so it survives any rewrite of the UI and is
tested without one. Sections play 1, 2, 3, 4; there is no skipping ahead to the lecture, because the
difficulty curve is the point of the paper. A refusal is a **returned value, not a thrown error**:
pressing play on a spent section is an ordinary thing for a learner to try, and the UI's job is to
explain the rule.

A section counts as heard only on `'completed'`. A cancelled or impossible playback leaves it open —
punishing a learner for a browser that would not speak would be the wrong rule enforced correctly.

**Practice mode** (`practice: true`) lifts both rules, explicitly and visibly. It is chosen on the
picker BEFORE the clock starts, never mid-paper: a learner who could switch it on the moment they
missed an answer would have no exam-condition score left. `ListeningSessionRecord.practice` carries the
flag, and the runner toolbar, the history list and the report all label it — a band earned with replays
is not comparable with one earned in a single pass, and the report says so above the number.

### Timing, and the transfer window — KEPT

30:00 for the recording and answering, then **10:00 more**. The second period is entered when the
recording ends — the last section finishing — or when the 30 minutes expire, whichever comes first,
which is what the real exam does: the extra time starts when the audio stops, not at a fixed point on
the clock. When it expires the paper is submitted as it stands.

The window is **kept rather than dropped, and the UI says exactly what it is and is not**: on a screen
there is no answer sheet to copy onto, so nothing is being transferred, and the banner says so and
notes that the computer-delivered test gives 2 minutes here instead of 10. What the period is worth in
a screen-based app is the ENDING — a learner who rehearses a 30-minute Listening and then sits the
paper test has practised the wrong shape of finish. The clock derives from a wall-clock deadline, not
from tick counting, for the same reason as the writing exam: browsers throttle intervals in hidden tabs.

### Content and licensing

`src/listening/tests/` — one complete paper, four sections, 40 questions, full transcripts with speaker
labels, accent hints and pause cues, each section carrying a source and licence. Plan 011 says to
validate the format before authoring more, and that is where it stands.

**No text is reproduced from any IELTS publisher.** Real recordings, transcripts and question sets are
University of Cambridge (UCLES) copyright and cannot ship in an outward-facing app; the FORMAT is not
copyrightable, so the paper follows the real structure with every word written from scratch. Places,
people, prices and telephone details are invented.

### UI

- **`ListeningPicker`** — every paper (there is no per-module list), the audio notice up front, the
  format breakdown per paper, the two ways to sit it told apart in as many words, and past results with
  practice runs labelled. Two start buttons rather than a toggle, so the choice is made once,
  deliberately, before the clock.
- **`ListeningRunner`** — split pane, **player left and questions right**, each scrolling
  independently; section tabs with a live answered count and a dot for a section already heard;
  30:00 → 10:00 countdown reusing `Timer` on the navy toolbar. The player names the speakers and their
  intended accents, states the rule when it refuses a replay, and shows who is speaking without showing
  what they say. Answers live in component state and are persisted **on submit only** — a half-finished
  paper is not a session. Sitting a paper clears the desk exactly as Reading does, and more sharply:
  the recording plays once, so a learner who navigated away mid-section would lose it for good.
- **`ListeningReport`** — band + raw score, "This band is exact, not an estimate", the published row
  that produced it, how many more correct answers the next band needed, per-**format** accuracy weakest
  first, and every question against the key with **where the answer went past in the recording** — the
  single most useful line on the screen for Listening, because a learner who cannot replay the audio
  has no other way to find out what they missed. Below the review, the full tapescript of every
  section, collapsed by default and speakers labelled — the practice-book back-matter, shown only
  after submission.

Formats with fewer than 3 questions rank last however badly they went, as Reading's types do.

`--marking-red` appears in the Listening UI only in the report. In the runner an over-length answer is
**amber**, and so is the notice refusing a replay: the app enforcing the exam's own rule is not the
learner making a mistake.

### Persistence

`ListeningSessionRecord` is a third member of the `SessionRecord` union, discriminated on `section`.
It carries `answers`, the marking `result`, `durationSec` and `practice` — and **no `module`**.

**A Listening paper produces no `IssueCategory`, so `computeProfile` and `computeTrends` drop it**
before any arithmetic runs, exactly as they drop a Reading paper. Counting one as a writing session
with zero issues would read as a flawless essay and pull every error rate the learner is working on
towards zero. The single guard is `isWritingSession` in `types.ts`, which names every answer-key
section explicitly rather than inferring — forgetting that one line is precisely how the dilution would
return. `tests/profile-scoping.test.ts` asserts the WHOLE profile object is byte-identical with and
without five Listening papers.

Listening results are not on the Progress page for the same reason Reading's are not: the dashboard is
a writing view. They live in their own history list in the Listening section.

## False positives (2026-08-10)

**The engine had been telling learners to write ungrammatical English.** Five detector defects,
reproduced through the real `analyzeEssay` pipeline; four of the five handed back a suggested fix that
was itself wrong, which for a coaching product is worse than a miss and worse than silence.

| Learner writes (correct) | App said | Guard |
|---|---|---|
| Working from home can **reduce** commuting costs | "'reduce' → 'reduces'" | A6 governing-verb guard |
| Governments must act to **reduce crime** | "write 'a reduce crime'" | A5 mass-sense escape + verb-quote guard |
| **However, it is clear that** the government should invest | comma splice | comma-splice pattern A fronted-adverbial guard |
| **If a country invests in education it will prosper.** | "a main clause never arrives" | A4 main-clause guard |
| Governments inspect factories every **10 years** | "years → year" | B1 numeral in the licensing middle |

Each guard is specified in its rule's entry above. Every one only ever makes its rule QUIETER: none
widens a pattern, and each true positive the rules were calibrated on still fires with an unchanged
message (`tests/false-positive-corpus.test.ts`, "true positives still fire").

### `tests/false-positive-corpus.test.ts` — the golden corpus
Roughly 70 known-correct IELTS sentences, each carrying a one-line comment naming the rule it guards,
all asserted to raise ZERO non-`info` issues. **This is the deliverable that stops the class
recurring**: the five guards are small, the corpus is what makes the sixth defect fail a test before it
ships. Every future false-positive report belongs here FIRST, as a failing entry, before the rule that
caused it is touched.

Entries are BARE single sentences, not padded essays: the assertion is "zero non-`info` issues", and
padding manufactures its own (a letters-only pad is one long lowercase sentence → `capitalisation`,
`long-sentence`, `word-count`; padding past 250 words → `paragraphing`, `linking-underuse`). A bare
sentence sits under the 50-word floor that silences `word-count` and the 150-word floor that silences
the essay-level rules, while every rule the corpus guards is span-level and live from the first word.
The file's `true positives still fire` block runs genuine errors through the identical harness, so a
corpus that went green because the harness stopped reaching the rules would fail there first.

### Known remaining, same class, NOT fixed here
`article` still flags a bare mass-sense noun that no verb governs — "**Government spending** on health
has risen" and "Support from **central government**" both draw a determiner suggestion. The mass-sense
escape is deliberately conditioned on the noun being a verb's direct object, and widening it to bare
nouns after a preposition would suppress genuine errors ("he walked to shop"). Out of scope for plan
006; belongs in the corpus the day it is fixed.
