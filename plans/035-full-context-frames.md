# Plan 035: Full-context frames — every section one flowing paragraph skeleton, with a worked example under it

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in "STOP conditions" occurs, stop and report — do not
> improvise. Do not touch `plans/README.md` — the reviewer maintains the index.
>
> **Drift check (run first)**:
> `git diff --stat 6b46e0a..HEAD -- src/templates/ src/components/TemplatePanel.tsx src/components/TemplatePanel.css src/types.ts tests/templates.test.ts tests/ui/template-panel.test.tsx SPEC.md`
> Written against the LIVE tree at `6b46e0a` (main, immediately after plan 034
> merged and was recorded DONE). Expect zero drift; if any appears, compare the
> "Current state" excerpts against the live code — on a mismatch, STOP.

## Status

- **Priority**: P1 (direct user feedback on the just-landed 034)
- **Effort**: L — content-dominant: 15 templates × 4 sections × (frame + example), all normative below
- **Risk**: LOW-MED — extends the 034 surface only; the risk is content volume, not architecture
- **Depends on**: plans/034-sentence-frames.md (DONE, merged at `6e6e162`)
- **Category**: direction
- **Planned at**: commit `6b46e0a`, 2026-08-11

## Why this matters

Plan 034 shipped every template section as 1-4 *separate* sentence frames. The
user's verdict: too short and too fragmented. What they asked for (verbatim
intent, both halves):

1. **"The whole context before and after"** — each section as ONE continuous
   flowing paragraph skeleton where fixed prose surrounds every slot, in the
   shape of: *"Some believe that [the first point], while others believe that
   [second point]. In my opinion, [which side you lean towards]."* Not a list
   of clipped sentences — a paragraph you can read straight through, blanks
   embedded mid-prose with fixed text before AND after each one.
2. **"Examples of what to use to fill it"** — a worked, filled-in version of
   the same paragraph, so the learner sees what a completed slot actually
   looks like, not just the slot's description.

This plan rebuilds all fifteen templates that way: one `frame` string per
section (the flowing skeleton) plus one `example` string (the SAME paragraph
with every slot filled), one running `exampleTopic` per template that every
section's example answers, a renderer that shows the example muted beneath the
frame with a panel-level "Hide worked examples" toggle, and a test that PROVES
each example really is the filled frame — not unrelated prose on the same
topic.

## Current state (verified at `6b46e0a`)

Baseline: **1,783 tests / 53 files, all green** (`npx vitest run`, verified at
this commit). `npm run typecheck` covers `tests/` (`tsconfig.json` line 19:
`"include": ["src", "tests"]`).

- `src/templates/bank.ts` (647 lines) — 15 templates
  (`grep -c "id: 'tpl-"` → 15), every section
  `{ title, guidance, frames: readonly string[] }` (1-4 frames each, 118
  frames total). Header docblock covers provenance (all original prose) and
  engine agreement. `templatesFor(task, isLetter, questionType?, tone?)` at
  the bottom — unchanged by this plan.
- `src/types.ts:888-925` — `TemplateSection { title; guidance; frames }`,
  `WritingTemplate { id; label; kind; questionTypes?; tones?; paragraphs;
  note? }`, `TemplatePanelProps` (unchanged by this plan).
- `src/components/TemplatePanel.tsx` (141 lines) — renders each section's
  frames as separate `<p className="tp-frame">` lines; `renderFrame` splits on
  `/\[([^\]]+)\]/g` and wraps slots in `<span className="tp-slot">`;
  `sectionClass` drives `tp-done`/`tp-current` off `paragraphCount`; the
  memorisation warning (lines 134-138) is the 034 text
  ("Frames are scaffolding. …").
- `src/components/TemplatePanel.css` (197 lines) — `.tp-frame` (serif,
  12.5px), `.tp-slot` (chip: `--wash-blue` background, `--rule-line` border),
  `.tp-warning`. Muted-text token available: `--ink-soft: #5a6478`
  (`src/index.css:6`).
- `tests/templates.test.ts` (160 lines) — bank shape (15/2-per-type/1-per-tone
  /2-chart), per-section 1-4-frames `it.each`, per-frame non-empty + trimmed
  `it.each`, per-frame bracket-balance `it.each` (strip
  `/\[[^[\]]+\]/g`, assert no `[` or `]` left), task2-body example-slot check,
  `templatesFor` suite.
- `tests/ui/template-panel.test.tsx` (205 lines) — desk-filter cases,
  section/frame swap on template change (anchors:
  `/the strongest reason is that/i`, `/where the claim convinces is/i`,
  selector `.tp-frame`), slot-span case (anchor text
  `'paraphrase the statement'`), progress-class case, warning case
  (`/examiners discount sentences they have read a thousand times/i`),
  exam-mode case. Drives the real `<App />` via `renderApp()` (seeds `op-01`
  opinion prompt and `gt-01` formal letter).
- `SPEC.md` lines 1849-1923 — "### Writing templates (plans 033, 034)"
  subsection.

### Engine constraints — BINDING, each verified against the live rules at `6b46e0a`

Every frame and example in the content below was machine-checked against these
exact lists before this plan was written. They are quoted here so the executor
can re-verify; if any live list no longer matches its quote, STOP (see STOP
conditions).

1. **Example markers** — `src/analysis/rules/structure.ts:45-56`:

   ```
   'a clear example of this is', 'one illustration of this is',
   'to take one example', 'consider the case of', 'this can be seen in',
   'take the case of', 'a case in point is', 'for example', 'for instance',
   'such as'
   ```

   The `body-N-support` rail check tests EACH body paragraph for one of these
   (or a digit). → Every Task 2 body section's frame carries one of these
   phrases **in its fixed prose** (so the example inherits it verbatim), and
   every body example therefore contains it too.
   **Verification result that changed wording**: the requested exemplar phrase
   "A clear illustration comes from …" is NOT in this list ("a clear example
   of this is" and "one illustration of this is" are; the hybrid is not), so
   `tpl-op-onesided` Body 1 uses **"A case in point is …"** instead — same
   sentence shape, engine-recognised marker.
2. **Body topic sentences** — `structure.ts:143-153` (`topicProblem`): a body
   paragraph's FIRST sentence must not open with an example marker, must not
   open with "This"/"It"/"They", must not be a question, and must be ≤ 35
   words. → Every body example below opens with a clear ≤ 30-word topic
   sentence; markers sit mid-paragraph.
3. **Stance markers** — `structure.ts:27-35` (`STANCE_REGEXES`), required in
   intro or conclusion for opinion-family types (opinion, discussion,
   advantages-disadvantages):

   ```
   /\bI (strongly |firmly |partly |largely )?(agree|disagree|believe|think|argue|contend|maintain)\b/i
   /\bin my (opinion|view)\b/i   /\bmy view is\b/i
   /\bI am (convinced|of the opinion)\b/i
   /\b(advantages|benefits|drawbacks|disadvantages) (clearly |far )?outweigh\b/i
   /\bit seems to me\b/i         (+ the 'this essay argues' form)
   ```

   **Verification result that changed wording**: "I fully agree" (the user's
   requested Introduction frame for `tpl-op-onesided`, kept verbatim) does
   NOT match — "fully" is not among the recognised adverbs. The engine looks
   in intro OR conclusion, so that template's conclusion opens "In conclusion,
   I firmly believe that …", which matches. Every opinion-family template
   below carries a recognised stance phrase in the fixed prose of its intro or
   conclusion (both frame and example).
4. **Conclusion signal** — `structure.ts:37`:
   `/^\s*(in conclusion|to conclude|to sum up|in summary|overall|on balance)\b/i`,
   anchored at the START of the final paragraph. 034's conclusions did not
   start with one; every Task 2 conclusion frame AND example below now does.
   Conclusion shape (`structure.ts:552-587`): exactly 2 sentences, 25-60
   words, no example markers — all conclusion examples comply.
5. **Intro shape** — `structure.ts:523-547`: ≤ 3 sentences, no example
   markers in the introduction ("such as" counts!), 30-60-word norm
   (`intro-present`, line 260). All intro examples comply.
6. **Task 1 overview** — `task1Achievement.ts:35-53`: "overall" anywhere
   satisfies `hasOverview`; both chart templates' Overview frames and examples
   start with `Overall,` and contain NO figure (`FIGURE = /\d|%|\bpercent\b/i`
   — spelled-out numbers like "half" are safe). Detail sections DO carry
   figures in their examples (`t1-figures` wants ≥ 2 distinct;
   `task1Structure.ts:44`).
7. **Task 1 bans** — `task1Achievement.ts:84-99` (`CAUSAL_MARKERS`, incl.
   bare `because`, `due to`, `owing to`, `in the future`, `will continue to`)
   and `task1Achievement.ts:102-108` (stance in Task 1 is wrong). No chart
   example below contains any of these. Chart example totals: 161 and 157
   words (≥ the 150-word Task 1 minimum).
8. **Letter purpose markers** — `letterAchievement.ts:317-333`
   (`PURPOSE_MARKERS`): the informal frame keeps **"I am writing because"**
   UNCONTRACTED (the recognised entry; "I'm writing because" is NOT in the
   list). Formal uses "I am writing to", semi-formal "I am writing about" —
   both recognised, sentence-initial.
9. **Letter greetings and sign-offs** — `letterAchievement.ts:163-292`
   (`SALUTATION_FORMS` anchored `^…$` per LINE — greetings must sit on their
   own line, hence real `\n` in letter frames/examples; `SIGNOFF_FORMS`
   licensing matrix): formal example pairs "Dear Sir or Madam," (unnamed) with
   "Yours faithfully,"; semi-formal pairs "Dear Mr Harris," (named-formal)
   with "Yours sincerely,"; informal pairs "Dear Sam," (named-informal) with
   "Take care," — all licensed pairings.
10. **Letter contractions** — `letterAchievement.ts:409-422`
    (`FORMAL_CONTRACTIONS` + `CONTRACTION_RE`, straight or curly apostrophe):
    formal + semi-formal examples contain ZERO forms from the list and zero
    exclamation marks (`FORMAL_VIOLATION_MARKERS` flags `!` in those tones);
    the informal example uses contractions throughout EXCEPT the purpose
    sentence.
11. **Letters keep FOUR sections** — sign-off folded into the last
    (`paragraphs.length` drives the progress mapping; a sign-off is not its
    own blank-line paragraph). Unchanged from 034.
12. **Memorised-phrase bank** — `lexical.ts:570-601`: no frame or example
    below contains any entry (checked; e.g. no "there is no denying", no
    "in today's world", no "nowadays").
13. **Complexity nicety (not a gate)** — `complexity.ts:53-69`
    (`RAIL_MARKERS`: although/though/whereas/while/unless/if/because/since/
    when/after/before/which/whose/who): the examples were written so each
    paragraph carries at least one subordinate clause, matching the
    `complex-count` rail's "one per paragraph" target. Do not reword to
    optimise this further.

All examples are **original prose**; facts and figures are invented and the
panel labels them as examples; nothing is reproduced from any published
source.

## Commands you will need

| Purpose        | Command                                      | Expected on success            |
|----------------|----------------------------------------------|--------------------------------|
| Typecheck      | `npm run typecheck`                          | exit 0 (covers `tests/` too)   |
| All tests      | `npx vitest run`                             | exit 0, 53 files, 0 failures   |
| One file       | `npx vitest run tests/templates.test.ts`     | exit 0                         |
| UI project     | `npx vitest run --project ui`                | exit 0                         |
| Build          | `npm run build`                              | exit 0                         |
| Scope check    | `git status --porcelain -- . ':!plans/'`     | only in-scope files listed     |

## Scope

**In scope** (the only files you may modify):

- `src/templates/bank.ts` — full content rewrite (normative content below)
- `src/types.ts` — `TemplateSection` and `WritingTemplate` only
- `src/components/TemplatePanel.tsx` — renderer + toggle + warning
- `src/components/TemplatePanel.css` — new classes for example/topic/toggle
- `tests/templates.test.ts` — migrate + extend (spec below)
- `tests/ui/template-panel.test.tsx` — migrate + extend (spec below)
- `SPEC.md` — the Writing-templates subsection only

**Out of scope** (do NOT touch, even though they look related):

- `src/App.tsx` — no wiring change; `TemplatePanelProps` is unchanged
- `src/analysis/**` — the engine is read-only reference material here; the
  templates conform to it, never the other way round
- The store (`src/store*`), prompts, and every other component
- `plans/README.md` — reviewer-maintained

## Git workflow

- Branch: `advisor/035-full-context-frames` off current main (`6b46e0a`)
- Commit per step, message style matching `git log` (imperative summary line,
  e.g. `Plan 035: types + bank — one flowing frame + worked example per section`)
- Do NOT push or open a PR unless the operator instructed it.

## Design

### Data change (`src/types.ts`)

`TemplateSection` loses `frames: readonly string[]` and gains two fields;
`WritingTemplate` gains one:

```ts
export interface TemplateSection {
  title: string;
  /** One line: what this paragraph must do — the frame below says the rest. */
  guidance: string;
  /**
   * The paragraph as ONE continuous flowing skeleton: fixed prose surrounds
   * every `[slot]` (text before AND after it), so the learner reads the whole
   * context a sentence lives in, not fragments. Slots are square-bracketed
   * descriptive text; a frame never nests brackets. Letter frames carry real
   * newlines (the greeting and sign-off sit on their own lines, as the
   * engine's salutation matcher expects).
   */
  frame: string;
  /**
   * The SAME paragraph with every slot filled — a complete worked answer to
   * the template's `exampleTopic`. Contains no brackets, and the fixed prose
   * of `frame` appears verbatim inside it (tests/templates.test.ts proves
   * both). Original prose; facts and figures are invented and the panel
   * labels them as examples.
   */
  example: string;
}
```

In `WritingTemplate`, after `tones?` and before `paragraphs`:

```ts
  /**
   * The one running prompt every section's `example` answers, shown at the
   * top of the panel ("Worked example answers: …"). Invented and original,
   * like the examples themselves.
   */
  exampleTopic: string;
```

Slot syntax is unchanged (`\[([^\]]+)\]`, no nesting, no empty slots). One
extension of the 034 convention: slots are lowercase descriptive text EXCEPT
where the slot enumerates verbatim forms to choose from (e.g. the formal
letter's sign-off slot names "Yours faithfully" / "Yours sincerely"), and
choice slots may read `[agree / disagree]`.

### The filled-frame checker (the heart of the test migration)

An example must BE the filled frame — same fixed prose, slots replaced by real
content — not merely prose about the same topic. The checker extracts, for
every slot, up to 3 whitespace-separated tokens of fixed prose on each side
and requires each window verbatim (whitespace-normalised) in the example.
EXACT code for `tests/templates.test.ts`:

```ts
/** Collapse every whitespace run (newlines included) to one space. */
const normalise = (s: string): string => s.replace(/\s+/g, ' ').trim()

/**
 * The fixed-prose windows around every slot of `frame`: for each slot, the
 * last 3 tokens of the fixed text before it and the first 3 tokens of the
 * fixed text after it (fewer when the frame has fewer; nothing when two
 * slots are adjacent). Every window must appear verbatim in the example —
 * that is what makes the example a FILLING of the frame rather than
 * unrelated prose on the same topic.
 */
function fixedWindows(frame: string): string[] {
  const segments = frame.split(/\[[^\][]+\]/g).map(normalise)
  const windows: string[] = []
  segments.forEach((seg, i) => {
    if (seg === '') return
    const tokens = seg.split(' ')
    if (i > 0) windows.push(tokens.slice(0, 3).join(' '))
    if (i < segments.length - 1) windows.push(tokens.slice(-3).join(' '))
  })
  return windows
}
```

And the test that uses it (named per template + section via `it.each`, so a
failure says exactly where):

```ts
it.each(ALL_SECTIONS)('$templateId → "$title": the example is the filled frame', ({ frame, example }) => {
  const haystack = normalise(example)
  for (const window of fixedWindows(frame)) {
    expect(haystack, `fixed prose "${window}" missing from the example`).toContain(window)
  }
})
```

Punctuation counts as part of a token (windows like `". Although some"` and
`", because"` are deliberate — they pin the frame's joints). The example may
EXTEND beyond the frame's final full stop (windows are substring checks); it
may not drop or reword any fixed prose. Every frame/example pair in the
content below was run through exactly this checker before the plan was
written — all 60 sections pass. If a pasted pair fails, that is a STOP, not a
licence to reword.

### The renderer (`TemplatePanel.tsx` + `.css`)

Each section: guidance line, then the frame as ONE `.tp-frame` paragraph
(slots still `tp-slot` chips via the existing `renderFrame`; add
`white-space: pre-line` so letter newlines render as line breaks), then the
example beneath in muted style prefixed "Example: ". Panel level: a
"Hide worked examples" toggle (checkbox, default UNCHECKED = examples shown)
and, while examples are shown, the running-topic line. Shape:

```tsx
const [hideExamples, setHideExamples] = useState(false)
// … after the tp-legend paragraph:
{!hideExamples && (
  <p className="tp-example-topic">
    Worked example answers: <em>“{active.exampleTopic}”</em>
  </p>
)}
<label className="tp-example-toggle">
  <input
    type="checkbox"
    checked={hideExamples}
    onChange={(e) => setHideExamples(e.target.checked)}
  />
  Hide worked examples
</label>
// … inside each section <li>, replacing the frames block:
<p className="tp-frame">{renderFrame(sectionSpec.frame)}</p>
{!hideExamples && (
  <p className="tp-example">
    <span className="tp-example-label">Example: </span>
    {sectionSpec.example}
  </p>
)}
```

Delete the `.tp-frames` wrapper loop (one frame now). Keep `renderFrame`,
`sectionClass`, the select, note, legend, and progress classes untouched.

CSS additions (`TemplatePanel.css`), matching existing tokens:

```css
.tp-frame {
  white-space: pre-line;
  margin-top: 6px;
}

.tp-example {
  font-family: var(--font-serif);
  font-size: 12px;
  line-height: 1.55;
  color: var(--ink-soft);
  margin: 4px 0 0;
  padding-left: 8px;
  border-left: 2px solid var(--rule-line);
  white-space: pre-line;
}

.tp-example-label {
  font-family: var(--font-sans);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ink-soft);
}

.tp-example-topic {
  font-family: var(--font-sans);
  font-size: 11px;
  line-height: 1.5;
  color: var(--ink-soft);
  margin: 0 0 4px;
}

.tp-example-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--ink-soft);
  margin-bottom: 6px;
}
```

(`.tp-frames` rules become unused — remove them.)

### The memorisation warning — REPLACED, verbatim

```
Frames are scaffolding. Fill every slot in your own words, and swap the
connectors for ones you'd naturally use — examiners discount sentences they
have read a thousand times, and every candidate using a template unchanged
writes the same essay. The worked examples show how a slot gets filled, never
words to reuse — copying an example into your essay is the same trap as
copying the frame.
```

(The 034 text plus one new sentence; the UI test asserts both halves.)

## THE CONTENT — NORMATIVE. Paste, do not paraphrase.

Replace the 15 template objects in `WRITING_TEMPLATES` with EXACTLY the
following (ids, labels, kinds, questionTypes/tones and notes are unchanged
from 034 — repeated here so each object is complete and paste-ready). Also
update the bank's header docblock: where it describes "1-4 sentence frames"
per section, describe instead ONE flowing paragraph skeleton (`frame`) plus a
filled worked version (`example`) and a per-template `exampleTopic`, note plan
035, and keep the provenance paragraph (all original prose; invented figures
labelled as examples) — everything else in the docblock stands.

Templates 1 and 3 carry the user's requested exemplar content (verbatim,
except the one engine-forced substitution recorded in constraint 1 above).

### 1. `tpl-op-onesided`

```ts
{
  id: 'tpl-op-onesided',
  label: 'Full agreement (or disagreement)',
  kind: 'task2',
  questionTypes: ['opinion'],
  note:
    'Pick when your view is genuinely firm — a hedged essay written on a one-sided skeleton reads as contradiction.',
  exampleTopic: 'Some people think all children should learn a foreign language from primary school.',
  paragraphs: [
    {
      title: 'Introduction',
      guidance:
        'Paraphrase the statement, then state your position outright. This shape only works when you hold that position all the way through.',
      frame:
        "It is increasingly common to hear that [paraphrase the statement in your own words]. Although some would push back against the idea, I fully [agree / disagree], because [your position in one clause].",
      example:
        "It is increasingly common to hear that every child should begin a second language in their first years of school. Although some would push back against the idea, I fully agree, because early exposure produces fluency that later study rarely matches.",
    },
    {
      title: 'Strongest reason',
      guidance: 'Give your strongest reason for holding this position, then support it with a concrete example.',
      frame:
        "The strongest reason to [agree / disagree] is that [your first reason, stated as a full claim]. Put simply, when [restate the situation in plain terms], the result is [the consequence you are pointing to]. A case in point is [a country, a study, or a workplace], where [what happened there] — precisely because [tie the example back to your reason].",
      example:
        "The strongest reason to agree is that young children absorb languages far faster than teenagers. Put simply, when a child meets a second language before the age of ten, the result is near-native pronunciation and effortless recall. A case in point is Switzerland, where most pupils begin French or German at seven and routinely leave school fluent — precisely because the language arrived while their minds were still built for it.",
    },
    {
      title: 'Second reason',
      guidance: 'Add a second reason and its own example, or use this paragraph to rebut the opposite view.',
      frame:
        "Beyond that first point, there is a second argument: [your second reason, as a full claim]. This matters because [the consequence if it is ignored], and it reaches beyond [the immediate setting] into [the wider sphere it touches]. Consider the case of [a school, a company, or a policy], which [what it did or showed], and the point becomes hard to dismiss.",
      example:
        "Beyond that first point, there is a second argument: a language opens a culture, and children who receive one early grow up more curious about the world. This matters because tolerance is easier to plant than to repair, and it reaches beyond the classroom into how a whole generation treats its neighbours. Consider the case of bilingual schools in Canada, which report fewer playground divisions between language communities, and the point becomes hard to dismiss.",
    },
    {
      title: 'Conclusion',
      guidance: "Restate your position in fresh words — don't just repeat the introduction's sentence.",
      frame:
        "In conclusion, I firmly believe that [your position, in fresh words rather than the introduction's]. If anything, [a closing thought that extends the argument, not repeats it].",
      example:
        "In conclusion, I firmly believe that a second language belongs at the very start of schooling, not the end. If anything, the real question is why so many systems still wait until the habit-forming years are gone.",
    },
  ],
},
```

### 2. `tpl-op-balanced`

```ts
{
  id: 'tpl-op-balanced',
  label: 'Balanced (partly agree)',
  kind: 'task2',
  questionTypes: ['opinion'],
  exampleTopic: 'Some people think all children should learn a foreign language from primary school.',
  paragraphs: [
    {
      title: 'Introduction',
      guidance: 'Paraphrase the statement, then signal at once that the essay is balanced, not undecided.',
      frame:
        "That [paraphrase the statement in your own words] is a claim with real force, though it is not the whole story. I largely agree, yet with one reservation: [name the reservation in a short clause].",
      example:
        "That every schoolchild should meet a foreign language from the first year is a claim with real force, though it is not the whole story. I largely agree, yet with one reservation: an early start only pays off where schools can actually staff it.",
    },
    {
      title: 'The part you accept',
      guidance: 'Explain the part of the statement you accept, and support it with a concrete example.',
      frame:
        "Where the claim convinces me is [the part you accept, stated fully]. In practice, [how it plays out day to day], so that [the benefit that follows]. To take one example, [a country, a school, or a family] has [what it achieved] — and few would call that an accident.",
      example:
        "Where the claim convinces me is in what young ears can do that older ones cannot. In practice, a seven-year-old treats a new language as play rather than as homework, so that pronunciation and confidence arrive before self-consciousness does. To take one example, the Netherlands has built English into its primary classrooms through songs and games — and few would call that an accident.",
    },
    {
      title: 'Your reservation',
      guidance: 'Explain your reservation and give it its own example.',
      frame:
        "My reservation concerns [the limit you want to draw]. However enthusiastic the policy, [why the limit is real], and where that condition is missing, [what actually happens]. For instance, [a programme where the promise broke down] ended with [what learners were left with], largely because [the missing condition].",
      example:
        "My reservation concerns the classrooms that the argument quietly assumes. However enthusiastic the policy, a language lesson is only as good as the teacher giving it, and where that condition is missing, an early start delivers little more than mispronounced vocabulary lists. For instance, rural schools that adopted compulsory English without a single fluent speaker ended with pupils drilling the same greetings for years, largely because nobody could take them further.",
    },
    {
      title: 'Conclusion',
      guidance: 'Weigh the two paragraphs against each other and land clearly on your side.',
      frame:
        "On balance, then, the claim survives with an amendment: [restate your mostly-yes position together with its condition]. In my view, [the priority that follows from the amendment].",
      example:
        "On balance, then, the claim survives with an amendment: start languages early wherever a school can teach them well, and fix the staffing first everywhere else. In my view, sequencing the investment this way honours the idea rather than betraying it.",
    },
  ],
},
```

### 3. `tpl-di-both-then-view`

```ts
{
  id: 'tpl-di-both-then-view',
  label: 'Both views, then yours',
  kind: 'task2',
  questionTypes: ['discussion'],
  exampleTopic:
    'Some believe university education should be free for everyone; others think students should pay for it.',
  paragraphs: [
    {
      title: 'Introduction',
      guidance: 'Paraphrase both views named in the question, then promise that your own opinion is coming.',
      frame:
        "Few questions divide opinion as sharply as whether [the issue, paraphrased]. Some believe that [the first view in a full clause], while others insist that [the second view in a full clause]. Both cases deserve a fair hearing before I give my own verdict, which favours [the side you will take].",
      example:
        "Few questions divide opinion as sharply as whether a university degree should cost its student nothing. Some believe that free study is the mark of a fair society, while others insist that those who profit from a degree should carry its cost. Both cases deserve a fair hearing before I give my own verdict, which favours free education.",
    },
    {
      title: 'First view',
      guidance:
        'Present the first view fairly: explain why its holders believe it, grounded in a concrete example.',
      frame:
        "Those who favour [the first view, named briefly] rest their case on [its main ground]. From their standpoint, [unpack the argument in plain prose], which is why [the conclusion they draw]. A clear example of this is [a country or system that embodies the view], where [what it looks like in practice].",
      example:
        "Those who favour free university rest their case on fairness: talent is spread across every income bracket, but fees are not. From their standpoint, a bright student who declines a degree for fear of debt is a loss to the whole society, which is why education should be treated like schooling rather than shopping. A clear example of this is Germany, where public universities charge no tuition and lecture halls stay open to rich and poor alike.",
    },
    {
      title: 'Second view',
      guidance: 'Present the second view and its case, with an example of its own.',
      frame:
        "The opposing camp answers that [the second view's main ground]. On their reading, [unpack the argument], and it is graduates themselves who [what the second camp says graduates should do]. Take the case of [a country or policy that embodies this view], where [what it looks like and what it achieves].",
      example:
        "The opposing camp answers that a degree is a private investment which pays its owner back throughout a working life. On their reading, asking taxi drivers and shop assistants to fund future lawyers is fairness inverted, and it is graduates themselves who should repay the cost once their salaries allow. Take the case of England, where income-contingent loans collect nothing from graduates until their earnings pass a set threshold.",
    },
    {
      title: 'Conclusion',
      guidance: 'Give your verdict and the reason it wins.',
      frame:
        "On balance, having heard both sides, my verdict stays with [your side]. In my opinion, [the deciding reason, stated as the thing the other side cannot answer].",
      example:
        "On balance, having heard both sides, my verdict stays with free university education. In my opinion, a society that meets its future doctors, engineers and teachers at the lecture-hall door with an invoice is taxing the very people it most needs to encourage.",
    },
  ],
},
```

### 4. `tpl-di-view-throughout`

```ts
{
  id: 'tpl-di-view-throughout',
  label: 'Your view throughout',
  kind: 'task2',
  questionTypes: ['discussion'],
  note: 'Stronger position focus, harder to keep fair — the task still requires BOTH views discussed.',
  exampleTopic:
    'Some believe university education should be free for everyone; others think students should pay for it.',
  paragraphs: [
    {
      title: 'Introduction',
      guidance: 'Name both views, then declare your side at once.',
      frame:
        "Debates about [the issue, paraphrased] are usually framed as a choice between [view A, compressed] and [view B, compressed]. From the outset my view is that [your side, stated plainly], although the opposing case deserves a genuine answer rather than a caricature.",
      example:
        "Debates about who should pay for university are usually framed as a choice between free study for all and full fees for each student. From the outset my view is that graduates should shoulder a fair share of the cost, although the opposing case deserves a genuine answer rather than a caricature.",
    },
    {
      title: "Your side's case",
      guidance: "Make your side's case and support it with a concrete example.",
      frame:
        "The decisive consideration is [your main ground, as a full claim]. In other words, [restate the mechanism in plain terms], which means that [the consequence for policy or fairness]. This can be seen in [a system that works this way], where [what happens there] without [the harm opponents predict].",
      example:
        "The decisive consideration is that a degree delivers most of its rewards to the person holding it, in higher pay and wider choices. In other words, the graduate premium is private property, which means that asking the public to fund all of it transfers money from the less educated to the more fortunate. This can be seen in Australia, where graduates repay tuition gradually through the tax system without the collapse in enrolments opponents predict.",
    },
    {
      title: 'The other view, acknowledged',
      guidance: 'Acknowledge the other view with an example of its own, then answer it.',
      frame:
        "Admittedly, those who argue for [the other view] have a point about [their strongest ground], and it deserves to be taken seriously. For instance, [the scenario or evidence their point rests on] is real enough. Yet the answer is [the targeted fix], not [the other side's blanket remedy] — the objection identifies a problem without proving [what it would need to prove].",
      example:
        "Admittedly, those who argue for free university have a point about deterrence, and it deserves to be taken seriously. For instance, the fear that debt frightens poorer teenagers away from applying is real enough. Yet the answer is generous grants and repayment thresholds for low earners, not free degrees for future bankers — the objection identifies a problem without proving that universal subsidy is the only cure.",
    },
    {
      title: 'Conclusion',
      guidance: 'Restate your position.',
      frame:
        "In conclusion, both positions were worth weighing, but [your side] carries the day. It seems to me that [the one-clause reason that survives the other side's best objection].",
      example:
        "In conclusion, both positions were worth weighing, but shared payment carries the day. It seems to me that a system in which graduates repay what their degrees earn them, while grants protect the poorest, is fairer than one in which everyone pays for the few.",
    },
  ],
},
```

### 5. `tpl-ps-paired`

```ts
{
  id: 'tpl-ps-paired',
  label: 'Problem–solution pairs',
  kind: 'task2',
  questionTypes: ['problem-solution'],
  exampleTopic:
    'More and more large cities suffer from serious traffic congestion. What problems does this cause, and what measures could reduce them?',
  paragraphs: [
    {
      title: 'Introduction',
      guidance: 'Restate the situation, then promise that both problems and remedies are coming.',
      frame:
        "In many parts of the world, [the situation, paraphrased] has grown from an irritation into a threat to [what it now threatens]. Two problems stand out, and each of them has a workable remedy.",
      example:
        "In many parts of the world, city traffic has grown from an irritation into a threat to the health and productivity of everyone who lives there. Two problems stand out, and each of them has a workable remedy.",
    },
    {
      title: 'First problem and solution',
      guidance:
        'Give the first problem, then the solution that directly answers it, with a concrete example.',
      frame:
        "The most pressing difficulty is [problem one, stated as a full claim]. Day to day, this shows up as [the visible consequence], and over time as [the slower, deeper cost]. The direct answer is to [solution one] — for example, [a city or country that tried it] has [what it did], and [what followed].",
      example:
        "The most pressing difficulty is that road space is finite while car ownership is not, so demand simply outgrows the streets. Day to day, this shows up as hours idling in queues, and over time as asthma clinics filling along the busiest corridors. The direct answer is to make drivers pay for the space they occupy — for example, London has charged vehicles entering its centre since 2003, and traffic inside the zone fell within a year.",
    },
    {
      title: 'Second problem and solution',
      guidance: 'Give the second problem-and-solution pair the same way.',
      frame:
        "A second, related problem is [problem two, as a full claim]. Left alone, it feeds [the consequence], because [the mechanism that links them]. Here the remedy is [solution two], and cities such as [a city that invested this way] show the pattern: [what improved once they did].",
      example:
        "A second, related problem is that most alternatives to driving are too slow or too unpleasant to tempt anyone from a car. Left alone, it feeds the first problem, because every unreliable bus route recruits new drivers for the queues. Here the remedy is investment that makes the alternative genuinely faster, and cities such as Copenhagen show the pattern: once protected bike lanes and frequent trains outpaced rush-hour driving, commuters switched in their thousands.",
    },
    {
      title: 'Conclusion',
      guidance: 'Say which remedy matters most.',
      frame:
        "In conclusion, neither remedy is free, but together they [what the pair achieves]. If only one can come first, it should be [the remedy to prioritise], because [the reason it unlocks the other].",
      example:
        "In conclusion, neither remedy is free, but together they attack both the supply of road space and the demand for it. If only one can come first, it should be the charge, because it raises the very money the better buses and bike lanes require.",
    },
  ],
},
```

### 6. `tpl-ps-split`

```ts
{
  id: 'tpl-ps-split',
  label: 'Problems first, then solutions',
  kind: 'task2',
  questionTypes: ['problem-solution'],
  note: 'Pick when problems share one root; the mapping-back sentence is what keeps cohesion.',
  exampleTopic:
    'More and more large cities suffer from serious traffic congestion. What problems does this cause, and what measures could reduce them?',
  paragraphs: [
    {
      title: 'Introduction',
      guidance: 'Restate the situation, then promise that both problems and remedies are coming.',
      frame:
        "It is hard to name a large city that has escaped [the situation, paraphrased]. The problems it causes are connected, and because they are connected, they are best solved together.",
      example:
        "It is hard to name a large city that has escaped the daily gridlock of too many cars on too little road. The problems it causes are connected, and because they are connected, they are best solved together.",
    },
    {
      title: 'The problems',
      guidance:
        'Lay out the problems, connected to each other, each illustrated with an example or figure.',
      frame:
        "The first casualty is [problem one, felt in daily life], felt most sharply by [who bears it]. Behind it sits [problem two], which [how it compounds the first]. One illustration of this is [a scene that shows both problems at once]: [what it shows].",
      example:
        "The first casualty is time, since commutes that should take twenty minutes routinely swallow an hour, felt most sharply by workers who cannot choose their hours. Behind it sits pollution, which turns the wasted hour into a health bill as engines idle outside schools and hospitals. One illustration of this is the morning school run in any major city: thousands of cars, each carrying one child, creeping past the very playgrounds their exhaust settles on.",
    },
    {
      title: 'The solutions',
      guidance: 'Map each solution back to a named problem, with one worked instance.',
      frame:
        "Because both problems trace back to [the shared root], the solutions must attack that root rather than its symptoms. The first step is to [solution one], which relieves [problem one] directly; the second is to [solution two], which answers [problem two] by [its mechanism]. Cities that tried them together, such as [a city], found that [the combined result].",
      example:
        "Because both problems trace back to streets designed around the private car, the solutions must attack that root rather than its symptoms. The first step is to move rush-hour journeys onto high-frequency public transport, which relieves lost time directly; the second is to electrify what traffic remains, which answers pollution by removing the exhaust rather than the driver. Cities that tried them together, such as Oslo, found that emptier, quieter streets made the next reform easier to sell.",
    },
    {
      title: 'Conclusion',
      guidance: 'Close the essay.',
      frame:
        "To sum up, problems that are solved separately tend to return, because [why piecemeal fixes fail here]. Addressed at [the root, named again], they need not come back at all.",
      example:
        "To sum up, problems that are solved separately tend to return, because a city that only builds trains while its streets still favour cars invites the traffic straight back. Addressed at their common root, the design of the street itself, they need not come back at all.",
    },
  ],
},
```

### 7. `tpl-ad-outweigh`

```ts
{
  id: 'tpl-ad-outweigh',
  label: 'One side outweighs',
  kind: 'task2',
  questionTypes: ['advantages-disadvantages'],
  exampleTopic:
    'In many companies, employees can now work from home for most of the week. Do the advantages of this development outweigh its disadvantages?',
  paragraphs: [
    {
      title: 'Introduction',
      guidance: 'Name the development, then state which side wins.',
      frame:
        "Over the past few years, [the development, paraphrased] has moved from the margins to the mainstream, bringing costs as well as benefits. The balance, however, is not close: in my view the [advantages / disadvantages] clearly outweigh the [disadvantages / advantages].",
      example:
        "Over the past few years, working from home has moved from the margins to the mainstream, bringing costs as well as benefits. The balance, however, is not close: in my view the advantages clearly outweigh the disadvantages.",
    },
    {
      title: 'The winning side',
      guidance: 'Give the winning side two benefits or costs, plus a concrete example.',
      frame:
        "The first major benefit is [the strongest advantage, as a full claim]. For instance, [a person or group it changes]: [what it looks like in practice]. Just as weighty is [the second advantage], because [why it matters at scale].",
      example:
        "The first major benefit is time, the one resource no salary can buy back. For instance, an office worker who stops commuting ninety minutes a day recovers almost a full working day every week: hours that reappear as sleep, exercise and family dinners. Just as weighty is access, because jobs that once demanded a move to an expensive capital can now be done from a small town or from a wheelchair-friendly home.",
    },
    {
      title: 'The other side, conceded',
      guidance: 'Concede the other side with a concrete example, then show why it is smaller.',
      frame:
        "Against this stands [the other side's strongest point], and it would be dishonest to pretend otherwise. A clear example of this is [where the cost shows up], where [what happens]. Real, then — but limited: [why the cost weighs less, or who can fix it and how].",
      example:
        "Against this stands isolation, and it would be dishonest to pretend otherwise. A clear example of this is the first year of a career, where a new hire learns mostly by overhearing better people, and a bedroom desk offers nothing to overhear. Real, then — but limited: hybrid weeks and deliberate mentoring recover most of what the corridor once taught, while the recovered commuting hours have no substitute at all.",
    },
    {
      title: 'Conclusion',
      guidance: 'Restate the verdict.',
      frame:
        "On balance, the gains dominate: [restate the winning side's core, in fresh words]. The task for [who must act] is therefore to [manage the residue], not to [the overreaction to avoid].",
      example:
        "On balance, the gains dominate: work that fits around life serves more people, more fairly, than life bent around an office. The task for employers is therefore to design deliberately for connection, not to march everyone back to the desks the argument has already left.",
    },
  ],
},
```

### 8. `tpl-ad-survey`

```ts
{
  id: 'tpl-ad-survey',
  label: 'Even-handed survey',
  kind: 'task2',
  questionTypes: ['advantages-disadvantages'],
  exampleTopic:
    'In many companies, employees can now work from home for most of the week. Discuss the advantages and disadvantages of this development.',
  paragraphs: [
    {
      title: 'Introduction',
      guidance: 'Name the development, then promise that both sides are coming.',
      frame:
        "Few recent changes have spread as quickly as [the development, paraphrased], and few reward a more careful audit. Its ledger carries genuine entries on both sides, and each column deserves to be read before anyone totals it.",
      example:
        "Few recent changes have spread as quickly as the shift to working from home, and few reward a more careful audit. Its ledger carries genuine entries on both sides, and each column deserves to be read before anyone totals it.",
    },
    {
      title: 'Advantages',
      guidance: 'Cover the advantages, with a concrete example.',
      frame:
        "On the positive side, the clearest gain is [advantage one, stated fully]. A further entry is [advantage two], which [how it compounds the first]. Organisations such as [a company or sector that shows both] have found that [what the gains look like in practice].",
      example:
        "On the positive side, the clearest gain is autonomy: people schedule their sharpest hours for their hardest work instead of donating them to a commute. A further entry is reach, which widens hiring from one city to a whole country and lets parents and carers stay in careers they once had to leave. Organisations such as fully remote software firms have found that autonomy and reach together cut both turnover and office rent.",
    },
    {
      title: 'Disadvantages',
      guidance: 'Cover the disadvantages, with a concrete example.',
      frame:
        "The opposite column is just as real. Its heaviest entry is [disadvantage one, stated fully] — for example, [where or for whom it bites hardest]. Below it sits [disadvantage two], which [the quieter, longer-term damage it does].",
      example:
        "The opposite column is just as real. Its heaviest entry is the slow starvation of the informal contact that turns colleagues into teams — for example, the throwaway question after a meeting that solves a problem nobody had scheduled. Below it sits invisibility, which quietly steers promotions towards the people a manager still happens to see.",
    },
    {
      title: 'Conclusion',
      guidance: 'Say, on balance, which side wins and why — the task asks you to land somewhere.',
      frame:
        "On balance, I judge the [side you land on] the weightier column, chiefly because [the deciding reason]. In my opinion, the sensible course is [what follows: keep which gains, repair which costs].",
      example:
        "On balance, I judge the advantages the weightier column, chiefly because time and access improve whole lives while the costs mostly injure routines that firms can redesign. In my opinion, the sensible course is a hybrid week that keeps the freedom and schedules the serendipity.",
    },
  ],
},
```

### 9. `tpl-dq-two-para`

```ts
{
  id: 'tpl-dq-two-para',
  label: 'One question per paragraph',
  kind: 'task2',
  questionTypes: ['double-question'],
  note: "The safest double-question shape — the rail's question-coverage check wants BOTH answered visibly.",
  exampleTopic:
    'In many countries, more people are choosing to live alone than ever before. Why might this be? Is it a positive or negative development?',
  paragraphs: [
    {
      title: 'Introduction',
      guidance: 'Paraphrase the topic, then promise that both questions will be answered.',
      frame:
        "Across much of the world, [the trend, paraphrased], and the shift raises two questions at once: [question one, compressed] and [question two, compressed]. I will take each in turn.",
      example:
        "Across much of the world, more adults than ever are setting up homes entirely on their own, and the shift raises two questions at once: what is driving it, and whether it should be welcomed. I will take each in turn.",
    },
    {
      title: 'First question',
      guidance: 'Answer the first question fully, with a concrete example.',
      frame:
        "On the first question, the main driver is [your primary cause, as a full claim]. Behind it stands [a second cause], since [how it enables or amplifies the first]. This can be seen in [where the causes are most visible], where [what the pattern looks like].",
      example:
        "On the first question, the main driver is prosperity: living alone is expensive, and for the first time in history millions can afford the privacy their grandparents could not. Behind it stands changing family life, since later marriage and easier divorce leave long stretches of adulthood with no household to share. This can be seen in wealthy capitals, where studio apartments multiply fastest among well-paid professionals in their thirties.",
    },
    {
      title: 'Second question',
      guidance: 'Answer the second question, with its own example.',
      frame:
        "As to whether this is [the second question's framing], my answer is [your answer, stated plainly]. The decisive point is [the ground for it], because [the consequence that follows]. For instance, [a concrete situation that shows your answer in action]: [what it shows].",
      example:
        "As to whether this is a positive or a negative development, my answer is that it is broadly positive with one sharp edge. The decisive point is choice, because a household of one is now something people select rather than something widowhood imposes. For instance, a divorced teacher who keeps her own flat between chapters of life is exercising a freedom her mother never had: the same solitude that once signalled misfortune now often signals control.",
    },
    {
      title: 'Conclusion',
      guidance: 'Give both answers again, one sentence each.',
      frame:
        "In conclusion, the answers belong together: [answer one, in one clause], and [answer two, in one clause]. What matters now is [the forward-looking closing thought].",
      example:
        "In conclusion, the answers belong together: people live alone because they finally can, and a freedom people choose is hard to call a decline. What matters now is building cities where a household of one is never a synonym for loneliness.",
    },
  ],
},
```

### 10. `tpl-dq-woven`

```ts
{
  id: 'tpl-dq-woven',
  label: 'Woven answers',
  kind: 'task2',
  questionTypes: ['double-question'],
  note: 'Only when the two questions genuinely share one answer; otherwise use the two-paragraph shape.',
  exampleTopic:
    'In many countries, more people are choosing to live alone than ever before. Why might this be? Is it a positive or negative development?',
  paragraphs: [
    {
      title: 'Introduction',
      guidance: 'Name both questions, then give one thesis that links them.',
      frame:
        "The two questions posed here — [question one, compressed] and [question two, compressed] — turn out to share a single answer: [the linking thesis, stated in one clause].",
      example:
        "The two questions posed here — why so many people now live alone, and whether the trend is to be welcomed — turn out to share a single answer: solo living is what rising independence looks like when it comes home.",
    },
    {
      title: 'First strand',
      guidance: 'Develop the first strand of the thesis, touching both questions, with an example.',
      frame:
        "The first strand of that answer is [first aspect of the thesis]. It speaks to both questions at once: [how it explains the cause], and equally [how it colours the verdict]. Take the case of [an example that shows both faces], where [what it shows].",
      example:
        "The first strand of that answer is economic: independence must be affordable before it can be chosen. It speaks to both questions at once: incomes rose until private space came within ordinary reach, and equally a trend rooted in affluence reads more like a graduation than a decline. Take the case of Scandinavia, where the highest rates of solo living sit beside some of the highest levels of reported life satisfaction.",
    },
    {
      title: 'Second strand',
      guidance: 'Develop the second strand, with its own example.',
      frame:
        "The second strand is [second aspect of the thesis], which completes the picture. Where the first strand explains [what it explained], this one shows [what the second adds], because [the mechanism]. A case in point is [a second example], where [what it shows].",
      example:
        "The second strand is cultural: independence has become respectable, which completes the picture. Where the first strand explains who can live alone, this one shows why they want to, because a single household no longer invites pity or suspicion. A case in point is the ordinary dinner party, where 'I live by myself' now lands as information rather than as confession.",
    },
    {
      title: 'Conclusion',
      guidance: 'Close the essay.',
      frame:
        "In conclusion, one thesis has answered two questions: [restate the link in fresh words]. Read that way, [the closing judgement the thesis licenses].",
      example:
        "In conclusion, one thesis has answered two questions: people live alone because independence has become both affordable and admired. Read that way, the rise of the single household is less a social problem than a signature of societies rich and free enough to permit it.",
    },
  ],
},
```

### 11. `tpl-t1-trends`

```ts
{
  id: 'tpl-t1-trends',
  label: 'Overview first, grouped by trend',
  kind: 'chart',
  note: "The default shape; the overview paragraph is what the rail's overview check looks for.",
  exampleTopic:
    'The line graph shows average coffee consumption per person, in kilograms per year, in Finland, Italy and Japan between 2000 and 2020. (An invented chart — the figures in these examples are its own.)',
  paragraphs: [
    {
      title: 'Paraphrase',
      guidance: 'Rewrite the title sentence in your own words: what the chart shows, where, and when.',
      frame:
        "The [chart or graph] shows [what is measured, in your own words], in [the units], in [the places named], between [the period].",
      example:
        "The line graph shows how much coffee people drank per person each year, in kilograms, in Finland, Italy and Japan, between 2000 and 2020.",
    },
    {
      title: 'Overview',
      guidance:
        'Give the two biggest movements or contrasts — no numbers here. This is the single largest mark in Task 1.',
      frame:
        "Overall, the most striking feature is [the biggest movement or contrast — no figures here], while [the second feature, also figure-free].",
      example:
        "Overall, the most striking feature is Japan's dramatic climb from near the bottom of the range, while Finland remains the heaviest consumer throughout and Italy barely moves.",
    },
    {
      title: 'First group (the risers)',
      guidance: 'Cover the first group — for example the risers — with selected figures.',
      frame:
        "Looking first at the risers, [the fastest riser] [describe its movement] from [starting figure] to [closing figure]. [The second riser] followed a gentler path, [its movement, with figures], leaving it [where that leaves it relative to the rest].",
      example:
        "Looking first at the risers, Japan trebled its intake, climbing steadily from 1.5 kilograms per person in 2000 to 4.5 kilograms in 2020, the steepest climb on the chart. Finland followed a gentler path, edging up from 10 kilograms to 12 kilograms across the same two decades, leaving it comfortably clear of the other two throughout.",
    },
    {
      title: 'Second group (the fallers)',
      guidance: 'Cover the second group — the fallers or the outliers — with figures.',
      frame:
        "[The flat or falling series], by contrast, [describe how little it moves, or how it falls] from [figure] to [figure]. The gap between [the leader] and [the laggard] therefore [narrowed or widened] from roughly [figure] to [figure].",
      example:
        "Italy, by contrast, barely moved at all, drifting from 5.8 kilograms to 6.1 kilograms in twenty years. The gap between Finland and Japan therefore narrowed from roughly 8.5 kilograms to 7.5 kilograms, even though the order of the three countries never changed, with Finland first, Italy second and Japan third at every point measured.",
    },
  ],
},
```

(Internal consistency of the invented chart: Finland 10 → 12, Italy 5.8 →
6.1, Japan 1.5 → 4.5; the quoted gaps 8.5 and 7.5 are the pairwise
differences — the same derivations `task1Achievement.ts`'s invented-figure
guard licenses.)

### 12. `tpl-t1-compare`

```ts
{
  id: 'tpl-t1-compare',
  label: 'Comparison-led',
  kind: 'chart',
  note: "Pick for static comparisons (tables, pies, grouped bars) where 'trend' language has nothing to move.",
  exampleTopic:
    'The table shows the share of household energy drawn from four sources — gas, electricity, renewables and solid fuels — in France, Poland, Spain and Sweden. (An invented table — the figures in these examples are its own.)',
  paragraphs: [
    {
      title: 'Paraphrase',
      guidance: "Paraphrase the chart's title sentence.",
      frame:
        "The [chart or table] compares [what is measured, in your own words], broken down by [the categories], across [the places named].",
      example:
        "The table compares the share of household energy that homes draw from each major source, broken down by gas, electricity, renewables and solid fuels, across France, Poland, Spain and Sweden, expressed as a proportion of each country's total consumption.",
    },
    {
      title: 'Overview',
      guidance:
        'Give the overview of the comparison: which category dominates, and where the categories converge.',
      frame:
        "Overall, [the dominant pattern — no figures], while [the exception or second pattern, also figure-free].",
      example:
        "Overall, a single source supplies at least half of all household energy in three of the four countries, while Spain alone divides its consumption almost evenly between its two leading fuels.",
    },
    {
      title: 'The dominant category',
      guidance: 'Set the dominant category against the rest, with figures.',
      frame:
        "In [the countries where one source towers over the rest], the leading source is unmistakable: [source] supplies [figure] of household energy in [country], [source] [figure] in [country], and [source] [figure] in [country].",
      example:
        "In three of the four countries, the leading source is unmistakable: electricity supplies 65 per cent of household energy in France, renewables 60 per cent in Sweden, and solid fuels 55 per cent in Poland.",
    },
    {
      title: 'Exceptions and crossovers',
      guidance: 'Cover the exceptions and crossovers.',
      frame:
        "The exception is [the country that breaks the pattern], where no single source dominates: [source] at [figure] sits almost level with [source] at [figure], a spread of only [the small gap] compared with [the gap everywhere else].",
      example:
        "The exception is Spain, where no single source dominates: gas at 45 per cent sits almost level with electricity at 40 per cent, a spread of only five points compared with a gap of 25 points or more everywhere else, making the Spanish market the only genuinely mixed one in the table.",
    },
  ],
},
```

(Invented table, internally consistent: France electricity 65 / gas 25;
Sweden renewables 60 / electricity 35; Poland solid fuels 55 / gas 25; Spain
gas 45 / electricity 40 — leader-to-runner-up gaps 40, 25, 30 and 5, matching
"25 points or more everywhere else". "compared with" is a live
`COMPARISON_MARKERS` entry — `task1Achievement.ts:56-62`.)

### 13. `tpl-lt-formal`

```ts
{
  id: 'tpl-lt-formal',
  label: 'To a stranger with a title',
  kind: 'letter',
  tones: ['formal'],
  note: "The sign-off pairing is the engine's rule too — the template and the marker agree.",
  exampleTopic:
    "A washing machine you bought recently has broken down twice. Write a letter to the shop's manager: say what you bought and when, describe what has gone wrong, and say what you want the shop to do.",
  paragraphs: [
    {
      title: 'Greeting and purpose',
      guidance:
        'Open with the greeting that matches what you know about the reader, then state your purpose in the first sentence.',
      frame:
        "Dear [Sir or Madam — or Mr or Ms and their surname if you know it],\nI am writing to [complain about, request, or inform you of] [the matter, in one clause], and to ask that [the outcome you want, in brief].",
      example:
        "Dear Sir or Madam,\nI am writing to complain about a washing machine bought from your Mill Road branch, and to ask that the matter now be settled with a full refund.",
    },
    {
      title: 'Bullet 1',
      guidance: 'Develop the first bullet point fully, with a concrete detail. No contractions.',
      frame:
        "To explain the background: [what you bought, where and when, with the price]. Specifically, [the exact references — a model, a date, an order number].",
      example:
        "To explain the background: on 14 June I bought a KleenWash 700 washing machine from your Mill Road branch, paying 429 pounds. Specifically, the order number is KW-88231, and the machine was delivered and installed on 21 June.",
    },
    {
      title: 'Bullet 2',
      guidance: 'Develop the second bullet point fully, with a concrete detail. No contractions.',
      frame:
        "What concerns me most is [what has gone wrong, stated plainly]. I have already [what you have done about it], yet [why the problem still stands]. As a result, [the consequence you are living with].",
      example:
        "What concerns me most is that the machine has now failed three times in eight weeks, most recently flooding the kitchen floor. I have already returned it to the branch twice for repair, yet the same fault reappeared within days on both occasions. As a result, my family has spent much of the summer carrying laundry to a launderette.",
    },
    {
      title: 'Bullet 3',
      guidance:
        'Develop the third bullet point, then request the action you want. Close with the sign-off that pairs with your greeting.',
      frame:
        "I would therefore ask that [the action you want, stated precisely]. I would appreciate a written reply within [a timeframe], and I can be contacted at [how you can be reached].\n[the sign-off that pairs with your greeting — Yours faithfully after Sir or Madam, Yours sincerely after a name],\n[your full name]",
      example:
        "I would therefore ask that the machine be collected and the full purchase price refunded. I would appreciate a written reply within fourteen days, and I can be contacted at the address above or on 07700 900123.\nYours faithfully,\nAmira Hassan",
    },
  ],
},
```

### 14. `tpl-lt-semiformal`

```ts
{
  id: 'tpl-lt-semiformal',
  label: 'Known name, serious matter',
  kind: 'letter',
  tones: ['semi-formal'],
  exampleTopic:
    'The heating in your rented flat is not working properly. Write a letter to your landlord, Mr Harris: remind him how you reported the problem before, describe the situation now, and ask for it to be fixed before winter.',
  paragraphs: [
    {
      title: 'Greeting and purpose',
      guidance: "Open with the reader's name, then a friendly line before you state the purpose.",
      frame:
        "Dear [Mr or Ms and their surname],\nI hope you are well. I am writing about [the matter], which I think needs attention before [what makes it urgent].",
      example:
        "Dear Mr Harris,\nI hope you are well. I am writing about the heating in the flat, which I think needs attention before the cold weather truly arrives.",
    },
    {
      title: 'Bullet 1',
      guidance: 'Develop the first bullet point, polite but warm, with a specific detail.',
      frame:
        "You may remember that [the shared history — what was said or done before]. Since then, [what has changed or continued].",
      example:
        "You may remember that I mentioned the boiler when you visited in September, and that it was serviced soon afterwards. Since then, the radiators in both bedrooms have stopped warming up at all.",
    },
    {
      title: 'Bullet 2',
      guidance: 'Develop the second bullet point the same way.',
      frame:
        "The difficulty now is [the problem as it stands today], which means [the consequence for daily life]. I am also a little concerned that [the risk if it waits], which [why that risk touches the property itself].",
      example:
        "The difficulty now is that the boiler cuts out every few hours and the flat rarely rises above fifteen degrees in the evening, which means we are relying on costly electric heaters. I am also a little concerned that a hard frost could burst the older pipes, which would damage the property far more than an early repair would cost.",
    },
    {
      title: 'Bullet 3',
      guidance:
        'Develop the third bullet point, then close with appreciation and the sign-off that pairs with your greeting.',
      frame:
        "Would it be possible to [the action you are asking for] before [the date or season that matters]? It would make a real difference to [what it would help], and I would of course [what you offer to make it easy].\nYours sincerely,\n[your first name and surname]",
      example:
        "Would it be possible to send a heating engineer before the end of November? It would make a real difference to how liveable the flat is this winter, and I would of course stay in for whichever morning suits the engineer best.\nYours sincerely,\nDaniel Okafor",
    },
  ],
},
```

### 15. `tpl-lt-informal`

```ts
{
  id: 'tpl-lt-informal',
  label: 'A friend',
  kind: 'letter',
  tones: ['informal'],
  note: 'Informal is a register, not an excuse — the bullets still all get covered.',
  exampleTopic:
    'You have moved to a new flat. Write a letter to your friend Sam: tell them your news, explain why next month is a good time to visit, and suggest a plan for the visit.',
  paragraphs: [
    {
      title: 'Greeting and purpose',
      guidance: "Open with a warm greeting, then say why you're writing — casually. Contractions welcome.",
      frame:
        "Dear [their first name],\nIt's been far too long since we caught up! I am writing because [your purpose, said the way you would say it aloud].",
      example:
        "Dear Sam,\nIt's been far too long since we caught up! I am writing because I have finally got a place with a spare room, and I want you in it next month.",
    },
    {
      title: 'Bullet 1',
      guidance: "Cover the first bullet point as you'd say it aloud, with a real detail.",
      frame:
        "You won't believe [your news, told exactly as you would tell it face to face] — [the detail that makes it real]. Honestly, [your reaction, in one casual clause].",
      example:
        "You won't believe it — I've finally escaped that shoebox by the station, and the new flat has an actual spare room with a bed in it. Honestly, I keep opening the door just to admire it.",
    },
    {
      title: 'Bullet 2',
      guidance: 'Cover the second bullet point the same way.',
      frame:
        "The thing is, [why the timing is right] — [the detail that clinches it]. So it'd be perfect if [what you are hoping they will do].",
      example:
        "The thing is, next month couldn't be better — I'm off work for the middle two weeks, and the street-food festival we keep talking about runs right through them. So it'd be perfect if you came up while it's all on.",
    },
    {
      title: 'Bullet 3',
      guidance: 'Cover the third bullet point, then close warmly with the sign-off that fits.',
      frame:
        "So here's the plan: [when to come, how to get here, and what the two of you will do]. What do you think — can you make it?\nTake care,\n[your name]",
      example:
        "So here's the plan: hop on the Friday train on the 12th, I'll meet you at the station, and we'll spend the whole weekend eating our way through that festival. What do you think — can you make it?\nTake care,\nMaya",
    },
  ],
},
```

The informal purpose sentence keeps **"I am writing because"** uncontracted —
it is the engine's recognised purpose marker (`PURPOSE_MARKERS`; "I'm writing
because" is not in the list). Everything else in the informal letter
contracts freely, and the engine's tone guard agrees.

## Steps

### Step 1: Types

Apply the `TemplateSection` / `WritingTemplate` changes from "Design" to
`src/types.ts` (delete `frames`, add `frame`, `example`, `exampleTopic` with
the doc comments given). `TemplatePanelProps` is untouched.

**Verify**: `grep -n "frame:" src/types.ts` → 1 hit;
`grep -n "exampleTopic" src/types.ts` → 1 hit (plus its comment lines).
(Typecheck is deferred to Step 4 — bank, renderer and tests form one compile
unit.)

### Step 2: Bank content

Replace all 15 template objects in `src/templates/bank.ts` with the normative
content above, in the same order. Update the header docblock as described at
the top of the content section. `templatesFor` is untouched.

**Verify**:
- `grep -c "frame:" src/templates/bank.ts` → 60
- `grep -c "example:" src/templates/bank.ts` → 60
- `grep -c "exampleTopic:" src/templates/bank.ts` → 15
- `grep -c "frames:" src/templates/bank.ts` → 0 (grep exits 1 — that is the pass state)
- `grep -c "id: 'tpl-" src/templates/bank.ts` → 15

### Step 3: Renderer

Apply the renderer, toggle, topic line, warning replacement and CSS from
"Design" to `TemplatePanel.tsx` / `TemplatePanel.css`. Update the component
docblock (one frame + worked example per section, plan 035).

**Verify**: `grep -c "tp-example" src/components/TemplatePanel.tsx` → ≥ 3;
`grep -c "tp-slot" src/components/TemplatePanel.tsx` → ≥ 1;
`grep -n "Hide worked examples" src/components/TemplatePanel.tsx` → 1 hit.

### Step 4: Migrate `tests/templates.test.ts`

Keep unchanged: the bank-shape suite (15/unique ids, 2-per-type, 1-per-tone,
2-chart, ≥3 paragraphs with title+guidance, kinds-don't-cross) and the whole
`templatesFor` suite. Replace the 034 frame suites with (all `it.each` cases
named `$templateId → "$title"` so failures locate themselves):

1. `ALL_SECTIONS = WRITING_TEMPLATES.flatMap((t) => t.paragraphs.map((p) => ({ templateId: t.id, title: p.title, frame: p.frame, example: p.example })))`
2. Every template: `exampleTopic` non-empty and trimmed. Every letter
   template: exactly 4 paragraphs.
3. Per section: `frame` non-empty, trimmed, contains ≥ 1 slot
   (`/\[[^\][]+\]/`); `example` non-empty, trimmed.
4. Per section: brackets balance in `frame` (034's strip check:
   `frame.replace(/\[[^[\]]+\]/g, '')` contains no `[` or `]`); `example`
   contains NO `[` and NO `]`.
5. Per section: the filled-frame checker (`normalise` + `fixedWindows` +
   `toContain`, EXACT code from "Design").
6. Task 2 body sections (`t.paragraphs.slice(1, -1)` of every
   `kind === 'task2'` template): an example-marker phrase appears in BOTH
   `frame` and `example`. Duplicate the 10-marker list from
   `structure.ts:45-56` in the test file with the comment
   `// keep in sync with EXAMPLE_MARKERS in src/analysis/rules/structure.ts`
   (it is module-private there — do NOT export it; the engine is out of
   scope), build
   `new RegExp('\\b(' + MARKERS.join('|') + ')\\b', 'i')`, test both fields.
7. Task 2 conclusion sections (last paragraph): both `frame` and `example`
   match `/^(in conclusion|to conclude|to sum up|in summary|overall|on balance)\b/i`.
8. Chart templates: the `Overview` section's `frame` and `example` both start
   with `Overall,` and neither matches `/\d|%|\bpercent\b/i`; both chart
   templates' last two sections' examples match `/\d/`.
9. Letters: formal + semi-formal examples contain no form from the
   contraction list (duplicate `FORMAL_CONTRACTIONS` from
   `letterAchievement.ts:409-414` with a sync comment; compile with `['’]`
   for the apostrophe as the engine does) and no `!`. The informal template's
   examples contain `I am writing because` and ≥ 3 contraction-list matches
   overall. Pin the pairings: formal opening example starts
   `'Dear Sir or Madam,\n'` and its closing example contains
   `'\nYours faithfully,\n'`; semi-formal `'Dear Mr Harris,\n'` /
   `'\nYours sincerely,\n'`; informal `'Dear Sam,\n'` / `'\nTake care,\n'`.

**Verify**: `npm run typecheck` → exit 0 (the whole tree now compiles);
`npx vitest run tests/templates.test.ts` → exit 0, ≥ 230 tests, 0 failures.

### Step 5: Migrate `tests/ui/template-panel.test.tsx`

Keep unchanged: desk-filter suite, section-swap test, progress suite,
exam-mode suite. Update and add:

- **Slot anchor**: the slot test's text becomes
  `'paraphrase the statement in your own words'` (still asserting class
  `tp-slot`).
- **Frame-swap anchors**: `/the strongest reason to/i` (tpl-op-onesided) vs
  `/where the claim convinces me is/i` (tpl-op-balanced), selector
  `.tp-frame`, same structure as the 034 test.
- **Warning**: assert BOTH
  `/examiners discount sentences they have read a thousand times/i` and
  `/copying an example into your essay is the same trap as copying the frame/i`.
- **NEW — example rendered muted below the frame**: on the default desk
  (op-01 → tpl-op-onesided), assert
  `screen.getByText(/every child should begin a second language/i, { selector: '.tp-example' })`
  is in the document (the muted styling itself lives in CSS; the class is the
  contract), and that the panel shows the topic line
  (`screen.getByText(/worked example answers:/i)`).
- **NEW — toggle**: `screen.getByLabelText('Hide worked examples')` is a
  checkbox, initially NOT checked, and
  `document.querySelectorAll('.tp-example').length` ≥ 4. After
  `user.click(...)`: checkbox checked, `.tp-example` count 0, and
  `screen.queryByText(/worked example answers:/i)` null. After a second
  click: `.tp-example` count restored to the section count.

**Verify**: `npx vitest run --project ui` → exit 0;
`npx vitest run` → exit 0, 53 files, 0 failures. Record the new total test
count (it will differ from 1,783 because per-frame `it.each` cases became
per-section cases — that is expected; what may not change is the file count
or any failure).

### Step 6: Mutation checks (apply → observe → hand-revert → green)

Hand-revert every mutation by editing the code back (no `git checkout` /
`git reset` — real work is uncommitted alongside). After each revert, rerun
the named suite and confirm green before the next mutation.

- **M1 (renderer drops examples)**: in `TemplatePanel.tsx`, delete the
  `{!hideExamples && (<p className="tp-example">…)}` block → the
  example-rendered test AND the toggle test fail. Revert.
- **M2 (checker alive, then vacuity demonstrated)** — two observations:
  1. In `bank.ts`, replace `tpl-op-onesided` → Introduction's `example` with
     `"The weather has been pleasant lately, and many people enjoy walking in parks."`
     → `npx vitest run tests/templates.test.ts` fails, and the failure names
     `tpl-op-onesided → "Introduction"` with the missing fixed window.
  2. With that corruption still in place, make `fixedWindows` return `[]`
     → the suite (wrongly) passes. This is the observation that the checker
     is the ONLY guard proving examples fill their frames — which is why the
     checker's code is normative.
  Revert BOTH edits; suite green again.
- **M3 (toggle inverted)**: in `TemplatePanel.tsx`, change the example
  render condition from `!hideExamples` to `hideExamples` → the toggle test
  fails (examples missing while unchecked). Revert.

**Verify after all reverts**: `npx vitest run` → exit 0, 0 failures.

### Step 7: SPEC.md + full gates

In `SPEC.md`, retitle the subsection
`### Writing templates (plans 033, 034, 035)` and update it: sections carry
ONE flowing `frame` (fixed prose around every slot) plus a filled `example`;
templates carry an `exampleTopic` the panel shows as
"Worked example answers: …"; the filled-frame checker (windows of fixed
prose, verbatim in the example) is what keeps examples honest; the panel's
"Hide worked examples" toggle (default shown); the warning's new verbatim
text (quote it in full); and extend the "Structural agreement with the
engine" bullet: Task 2 conclusions open with a conclusion signal, body frames
carry an engine-recognised example marker in fixed prose, chart overviews
start "Overall," and stay figure-free while detail examples quote figures,
and letter examples obey the tone's contraction rules. Keep the
filter-rule, progress-mapping, no-auto-insert and persistence bullets (their
content still holds; fix "frames" plurals to "frame").

**Full gates, in order**:

1. `npm run typecheck` → exit 0
2. `npx vitest run` → exit 0, 53 files, 0 failures
3. `npm run build` → exit 0
4. UI determinism, 10×:
   `for i in $(seq 1 10); do npx vitest run --project ui >/dev/null 2>&1 || echo "RUN $i FAILED"; done`
   → prints nothing
5. Scope: `git status --porcelain -- . ':!plans/'` → only the seven in-scope
   files

## Test plan

Covered by Steps 4-6 above. Summary of NEW coverage this plan adds:

- Filled-frame checker over all 60 sections (the example IS the frame,
  filled) — with M2 proving it kills.
- Frame/example presence, bracket discipline (balanced in frame, zero in
  example), ≥ 1 slot per frame, per-template `exampleTopic`.
- Engine-agreement content tests: body example-markers (frame AND example),
  conclusion signals, chart overview "Overall,"/figure-free + detail figures,
  letter contraction/tone/purpose/sign-off pins.
- UI: example rendered under the frame (`.tp-example`), topic line, toggle
  behaviour both ways (M1/M3 proving the tests bite), extended warning.
- Structural pattern to follow: the existing `it.each` naming convention in
  `tests/templates.test.ts` and the `renderApp()` seeding discipline in
  `tests/ui/template-panel.test.tsx`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run typecheck` exits 0 (tsconfig covers `tests/`)
- [ ] `npx vitest run` exits 0: 53 files, 0 failures, 0 skips; new total
      recorded in the completion report (baseline was 1,783 — the delta is
      expected and explained by the per-frame → per-section migration)
- [ ] `npx vitest run tests/templates.test.ts` exits 0 with ≥ 230 tests
- [ ] `grep -rn "frames:" src/ tests/` → no output, exit 1 (exit 1 = no
      match = PASS)
- [ ] `grep -c "frame:" src/templates/bank.ts` → 60;
      `grep -c "example:" src/templates/bank.ts` → 60;
      `grep -c "exampleTopic:" src/templates/bank.ts` → 15
- [ ] `grep -c "tp-example" src/components/TemplatePanel.tsx` → ≥ 3
- [ ] All three mutations observed killing (M2 via its two-step protocol) and
      hand-reverted; suite green after each revert
- [ ] 10× UI loop prints nothing (step 7.4)
- [ ] `git diff 6b46e0a..HEAD -- src/App.tsx src/analysis src/prompts src/store.ts src/profile 2>/dev/null` → empty
      (no wiring/engine/store change; paths that do not exist simply
      contribute nothing)
- [ ] `git status --porcelain -- . ':!plans/'` lists only:
      `src/templates/bank.ts`, `src/types.ts`,
      `src/components/TemplatePanel.tsx`, `src/components/TemplatePanel.css`,
      `tests/templates.test.ts`, `tests/ui/template-panel.test.tsx`, `SPEC.md`

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows changes, or any "Current state" excerpt does not
  match the live code.
- Any engine list quoted in "Engine constraints" (EXAMPLE_MARKERS,
  CONCLUSION_SIGNAL, STANCE_REGEXES, OVERVIEW markers, CAUSAL_MARKERS,
  PURPOSE_MARKERS, SALUTATION_FORMS/SIGNOFF_FORMS licensing,
  FORMAL_CONTRACTIONS) differs from the live rule file — the content below
  was written against these exact lists, and a silent reword to fit a changed
  engine is how the previous cold read went wrong. Report the pair
  (template/section + rule).
- Any pasted normative frame/example pair fails the filled-frame checker or
  any Step-4 content test. Do NOT reword content to make it pass — every pair
  was machine-verified against this plan's exact checker before writing; a
  failure means a paste error or plan bug. Diff your paste against the plan
  first; if it genuinely matches, report the failing window verbatim.
- A step's verification fails twice after a reasonable fix attempt.
- The change appears to require touching `src/App.tsx`, anything under
  `src/analysis/`, or any other out-of-scope file.
- Migrating a 034 test would weaken what it asserts (e.g. dropping the
  bracket-balance check instead of porting it).

## Maintenance notes

- **Content is now triple-entry**: a new template (or section) costs a
  `frame`, an `example` that fills it, and (per template) an `exampleTopic`.
  The filled-frame checker fails the build on examples that drift from their
  frames — when editing a frame, re-fill the example, never patch just one.
- **Two engine lists are deliberately duplicated in
  `tests/templates.test.ts`** (EXAMPLE_MARKERS, FORMAL_CONTRACTIONS) with
  sync comments, because the engine keeps them module-private and the engine
  is out of scope here. If a future plan changes either list in
  `src/analysis/rules/`, these tests are the tripwire that forces the
  templates to keep up — that is a feature; do not "fix" it by exporting the
  lists without also deciding the templates' response.
- **Reviewer should scrutinise**: that the pasted content matches this plan
  byte-for-byte (the checker windows depend on punctuation), that the
  exemplar sections of templates 1 and 3 match the user's requested text
  (modulo the one recorded marker substitution), and that no example
  sentence was "improved" into tripping a rail rule (the constraints section
  lists exactly which rules bite where).
- **Deferred, on purpose**: per-slot fill-in tracking (detecting which slots
  the learner has addressed) still needs analysis-side work — noted since
  034, not built. Persistence of template choice: ids remain frozen for it.
- **If a future pass regenerates examples with different invented figures**,
  the Task 1 examples' derived values (gaps, multiples) must stay consistent
  with their invented cells — the plan's chart data notes under templates 11
  and 12 show the arithmetic to preserve.
