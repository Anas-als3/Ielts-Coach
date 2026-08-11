# Plan 033: Writing templates — pick a skeleton, follow it while you write

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. STOP
> conditions are binding. Update nothing in `plans/README.md` (the reviewer
> maintains the index).
>
> **Drift check (run first)**:
> `git diff --stat 1e4559b..HEAD -- src/App.tsx src/types.ts src/meta.ts src/components/CheatSheet.tsx src/components/FeedbackPanel.tsx tests/ui/`
> This plan was written against the LIVE tree at `1e4559b` (all 32 prior plans
> merged) — its excerpts are current, not archaeological. Any drift is another
> session's work landing mid-flight: verify excerpts by content and report.

## Status

- **Priority**: P1 (user-requested feature)
- **Effort**: M (content is ~half the work and is written in this plan verbatim)
- **Risk**: LOW — additive tab + pure content module; no engine, store, or
  schema changes
- **Depends on**: nothing open. Plans 030 (task-aware sheet tab) and 023
  (App.tsx already restructured) are DONE and set the conventions used here.
- **Category**: product
- **Planned at**: commit `1e4559b`, 2026-08-11

## Why this matters

A learner staring at a blank sheet knows WHAT the question asks but not what
shape the answer should take. The app already checks structure after the fact
(the Structure Rail) and teaches it in the abstract (the cheat sheets), but
nothing offers a concrete skeleton to follow WHILE writing: "paragraph 2 is
your first reason, give it an example." Every serious IELTS course teaches by
template; this app has the machinery to do it better — it knows the question
type of the prompt on the desk, so it can offer the RIGHT skeletons and track
which paragraph the learner is on, deterministically.

## Current state (verified at `1e4559b`)

- The coach panel is a real ARIA tab pattern. `PanelTab` union at
  `src/App.tsx:108`: `'feedback' | 'cheatsheet' | 'model'`;
  `PANEL_TAB_LABELS` at `:111`; roving-tabindex key handling
  `handlePanelTabKeys` (`:1188-1200`); `panelTabsShown` at `:1171` is now the
  full constant list (030 made the cheatsheet tab task-aware INSIDE the panel
  body rather than hiding the tab: `:1704-1712` renders CheatSheet /
  LetterSheet / ChartSheet by task+module). A fourth tab needs: the union
  member, a label, and a branch in the panel body — the tab strip machinery is
  generic.
- The panel body (`role="tabpanel"`, `COACH_PANEL_ID`) renders ONLY in coach
  mode: the whole `<aside className="panel-zone">` is gated on
  `{mode === 'coach' && (...)}` (`App.tsx:1633`) — not on `deskCleared`
  directly. A new tab inherits that gating with zero work.
- The desk knows, at all times: `task` (`'task1' | 'task2'`), `module`,
  `prompt` (Task 2 — carries `type: QuestionType`), `task1Prompt` (chart),
  `letterPrompt` (carries `tone`). `isLetter = module === 'general' && task === 'task1'`.
- `QuestionType` (`src/types.ts:29`): `opinion | discussion | problem-solution
  | advantages-disadvantages | double-question` — 8 prompts each in the bank.
  `LetterTone`: `formal | semi-formal | informal` — 5 each.
- The debounced `analysis` is computed in App and its `paragraphs` array is the
  deterministic paragraph segmentation — `analysis.paragraphs.length` is the
  live typed-paragraph count the progress highlight needs. FeedbackPanel
  already receives `analysis`; the template panel receives the count the same
  way (via props from App).
- Content-module conventions: `src/prompts/bank.ts` (typed const array + tiny
  pure helpers + doc-comment header), `src/answers/*` (content + provenance
  header). The memorisation warning voice: `ModelAnswer.tsx:129-132`
  ("Examiners recognise memorised phrasing and discount it…") and the sheets
  thread the same needle.
- 44 UI test files use `renderApp()`; the tab strip is exercised by
  `tests/ui/a11y.test.tsx` (ARIA pattern pins) and `tests/ui/task-switching.test.tsx`
  (cheatsheet tab behaviour on switch). Read both before touching the strip.

## Scope

**In scope**:
- `src/templates/bank.ts` (new) — the template content + pure helpers
- `src/components/TemplatePanel.tsx` + `.css` (new)
- `src/App.tsx` — `PanelTab` union member `'template'`, label, panel-body
  branch, props pass-through. Nothing else.
- `src/types.ts` — `WritingTemplate`, `TemplateSection`, `TemplatePanelProps`
  beside the existing component props
- `tests/templates.test.ts` (new, engine project)
- `tests/ui/template-panel.test.tsx` (new)
- `SPEC.md` — a "Writing templates" subsection
- `tests/ui/a11y.test.tsx` — the ordered keyboard-navigation test
  (`:172-198`) pins that ArrowRight from 'Feedback' lands on 'Cheat sheet';
  with the Template tab inserted it lands on 'Template' — update that expected
  order (extend, never weaken; `assertTabPattern` itself only checks
  `tabs.length > 1` and needs nothing)

**Out of scope** (do not touch): the analysis engine and rules; the Structure
Rail; the store/prefs (template choice is desk state — persistence is a noted
future step, not built now); CheatSheet/ChartSheet/LetterSheet; exam mode
(inherits panel gating); auto-inserting template text into the essay sheet
(rejected — inserted scaffolding would be analysed as the learner's own words
and flagged, and the exam bans it anyway; the template is a reference pane,
not a text generator).

## Design

### Data (`src/templates/bank.ts`)

```ts
// signature only — you write the bodies
export interface TemplateSection {
  title: string        // 'Introduction'
  guidance: string     // 2-3 sentences: what this paragraph must do
  starters: readonly string[]  // 1-2 openers, to be REWORDED, never pasted
}
export interface WritingTemplate {
  id: string           // 'tpl-op-balanced' — unique, kebab, stable
  label: string        // 'Balanced opinion (partly agree)'
  kind: 'task2' | 'chart' | 'letter'
  questionTypes?: readonly QuestionType[]  // task2 only
  tones?: readonly LetterTone[]            // letter only
  paragraphs: readonly TemplateSection[]
  note?: string        // when to prefer this template over its sibling
}
export const WRITING_TEMPLATES: readonly WritingTemplate[]
export function templatesFor(
  task: TaskKind, isLetter: boolean,
  questionType?: QuestionType, tone?: LetterTone,
): WritingTemplate[]  // filtered, bank order
```

File header states the provenance rule (all-original prose, no prep-site or
publisher content) exactly as `src/listening/tests/test01.ts` does.

### The fifteen templates — CONTENT IS NORMATIVE, paste then verify

Write these into `bank.ts` verbatim (guidance/starters may be lightly edited
only to satisfy a lint or length constraint — meaning is fixed). Every
template's structure must agree with what the engine rewards: Task 2 intro
states a position, each body paragraph carries an example (`EXAMPLE_MARKERS`
territory), conclusions conclude; letters open with a greeting, state purpose
early, cover all three bullets, close with a paired sign-off.

**Task 2 — two per question type:**

1. `tpl-op-onesided` · Opinion · "Full agreement (or disagreement)" — Intro:
   paraphrase the statement, state your position outright ("I fully agree
   that…"). Body 1: strongest reason + a concrete example. Body 2: second
   reason + example, or rebut the opposite view. Conclusion: restate the
   position in fresh words. Note: pick when your view is genuinely firm — a
   hedged essay written on a one-sided skeleton reads as contradiction.
   Starters: "It is often argued that…", "The clearest reason is that…"
2. `tpl-op-balanced` · Opinion · "Balanced (partly agree)" — Intro: paraphrase
   + "I largely agree, with one reservation." Body 1: the part you accept +
   example. Body 2: the reservation + example. Conclusion: weigh them, land on
   your side. Starters: "There is much truth in the claim that…", "That said,
   …"
3. `tpl-di-both-then-view` · Discussion · "Both views, then yours" — Intro:
   paraphrase both views, promise your own. Body 1: first view fairly + why
   its holders believe it, grounded in a concrete example. Body 2: second view
   + its case + an example of its own. Conclusion: your
   verdict and the reason it wins. Starters: "Those who favour… point out
   that…", "Supporters of the second view respond that…"
4. `tpl-di-view-throughout` · Discussion · "Your view throughout" — Intro:
   both views named, your side declared at once. Body 1: your side's case +
   example. Body 2: the other view acknowledged with an example of its own,
   then answered. Conclusion:
   restate. Note: stronger position focus, harder to keep fair — the task
   still requires BOTH views discussed. Starters: "While some maintain that…,
   the stronger case is that…"
5. `tpl-ps-paired` · Problem-solution · "Problem–solution pairs" — Intro:
   restate the situation, promise problems and remedies. Body 1: first
   problem + the solution that answers IT + example. Body 2: second pair.
   Conclusion: which remedy matters most. Starters: "The most pressing
   difficulty is…", "The most direct answer is to…"
6. `tpl-ps-split` · Problem-solution · "Problems first, then solutions" —
   Intro as above. Body 1: the problems, connected, each
   illustrated with an example or figure. Body 2: the solutions, each mapped
   back to a named problem, with one worked instance. Conclusion. Note: pick when problems
   share one root; the mapping-back sentence is what keeps cohesion.
   Starters: "Two related problems stand out…", "Each of these can be met…"
7. `tpl-ad-outweigh` · Advantages-disadvantages · "One side outweighs" —
   Intro: name the development, state which side wins. Body 1: the winning
   side, two benefits/costs + example. Body 2: the other side conceded with a
   concrete example, then shown smaller. Conclusion: the verdict restated. Starters: "The
   benefits are considerable…", "Admittedly…, yet…"
8. `tpl-ad-survey` · Advantages-disadvantages · "Even-handed survey" — Intro:
   name the development, promise both sides. Body 1: advantages + example.
   Body 2: disadvantages + example. Conclusion: on balance, which and why
   (the task asks you to land somewhere). Starters: "On the positive side…",
   "Against this…"
9. `tpl-dq-two-para` · Double question · "One question per paragraph" —
   Intro: paraphrase the topic, promise both answers. Body 1: question 1
   answered fully + example. Body 2: question 2 + example. Conclusion: both
   answers in one sentence each. Note: the safest double-question shape —
   the rail's question-coverage check wants BOTH answered visibly.
   Starters: "The main cause is…", "As for what should be done…"
10. `tpl-dq-woven` · Double question · "Woven answers" — Intro: both
    questions, one thesis linking them. Body 1: first strand of the thesis
    touching both questions, with an example. Body 2: second strand, with its
    own example. Conclusion. Note: only
    when the two questions genuinely share one answer; otherwise use the
    two-paragraph shape. Starters: "These two questions share one answer…"

**Academic Task 1 — two, chart-kind-agnostic:**

11. `tpl-t1-trends` · "Overview first, grouped by trend" — Para 1: rewrite
    the title sentence in your own words (what, where, when). Para 2: the
    OVERVIEW — the two biggest movements or contrasts, NO numbers. Para 3:
    first group (e.g. the risers) with selected figures. Para 4: second group
    (the fallers / the outliers) with figures. Note: the default shape; the
    overview paragraph is what the rail's overview check looks for.
    Starters: "Overall, the most striking feature is…", "Turning to the
    detail…"
12. `tpl-t1-compare` · "Comparison-led" — Para 1: paraphrase. Para 2:
    overview of the comparison (which category dominates, where they
    converge). Para 3: the dominant category against the rest, with figures.
    Para 4: the exceptions and crossovers. Note: pick for static comparisons
    (tables, pies, grouped bars) where "trend" language has nothing to move.
    Starters: "By far the largest share belongs to…", "The gap narrows
    when…"

**GT letters — one per tone:**

13. `tpl-lt-formal` · Formal · "To a stranger with a title" — Open: "Dear
    Mr/Ms ‹name›," or "Dear Sir or Madam,". Para 1: purpose in the first
    sentence ("I am writing to…"). Paras 2-4: one bullet point each, fully
    developed with a concrete detail, no contractions. Close: request the action you want, then
    "Yours sincerely," (named) / "Yours faithfully," (unnamed). Note: the
    sign-off pairing is the engine's rule too — the template and the marker
    agree.
14. `tpl-lt-semiformal` · Semi-formal · "Known name, serious matter" —
    Open: "Dear Mr/Ms ‹surname›,". Para 1: friendly line, then the purpose.
    Paras 2-4: one bullet each, polite but warm, each with a specific detail. Close: appreciation + "Yours
    sincerely," / "Best regards,". Starters: "I hope this finds you well.",
    "I wanted to raise…"
15. `tpl-lt-informal` · Informal · "A friend" — Open: "Dear ‹first name›,".
    Para 1: warm opening, then why you're writing, contractions welcome.
    Paras 2-4: one bullet each, as you'd say them aloud, each with a real detail. Close: warm sign-off —
    "Best wishes," / "Take care,". Note: informal is a register, not an
    excuse — the bullets still all get covered.

### The panel (`TemplatePanel.tsx`)

Props: `{ task, isLetter, questionType, tone, paragraphCount }` (types in
`types.ts`). Behaviour:

- `templatesFor(...)` fills a `<select aria-label="Choose a template">`;
  default = first match. Component holds its own selection state; App mounts
  it with `key={`${task}-${isLetter}-${questionType ?? tone ?? 'chart'}`}` so
  a task/type change resets the choice naturally.
- Sections render as an ordered list. Section `i` gets class
  `tp-done` when `i < paragraphCount`, `tp-current` when
  `i === paragraphCount` (clamped to the last section), plain otherwise —
  the learner sees where they are. A one-line legend explains it.
- Starters render as quoted chips with the memorisation line (match
  `ModelAnswer.tsx:129-132`'s voice): reword them; examiners discount
  memorised phrasing.
- `note` renders as a small aside when present.

### App wiring

`PanelTab` gains `'template'`; label `Template`; `panelTabsShown` becomes
`['feedback', 'template', 'cheatsheet', 'model']`; panel body gains the
branch passing the desk facts + `analysis === null ? 0 :
analysis.paragraphs.length`. Read the a11y test's tab pins first and extend
the expected tab list there.

## Steps

1. **Types + bank.** Write `bank.ts` with all fifteen templates. Engine tests
   (`tests/templates.test.ts`): unique ids; every `QuestionType` has exactly 2;
   every tone exactly 1; chart exactly 2; every template ≥3 paragraphs with
   non-empty title/guidance and ≥1 starter; `templatesFor` filters correctly
   for all 5 types × letter tones × chart (table-driven); a task2 template
   never carries `tones`, a letter never `questionTypes`.
   **Verify**: `npx tsc -b --noEmit` exit 0; new tests green.
2. **TemplatePanel + CSS.** Match the panel-zone card conventions (read
   `FeedbackPanel.css` and the sheets' CSS for tokens).
   **Verify**: tsc clean; `npm run build` clean.
3. **App wiring** (union, label, list, branch, key, props).
   **Verify**: full UI suite still green except any tab-count pin — extend it.
4. **UI tests** (`tests/ui/template-panel.test.tsx`, via `renderApp()`):
   (a) Template tab present in coach mode for all three sheets (task2 /
   chart / letter) and the offered list matches the desk (opinion prompt →
   both opinion templates and nothing else — the seeded prompt `op-01` is
   `opinion`); (b) switching template swaps the rendered sections; (c) typing
   two paragraphs marks section 1 done and section 2 current (paste two
   newline-separated paragraphs, wait out the 400 ms debounce like
   `module-switch.test.tsx`'s `settled()` does); (d) memorisation warning
   visible; (e) the tab is absent in exam mode (enter exam — the whole panel
   disappears; pin that the template content is not in the document).
5. **Mutation checks** (each: apply, observe the named failure, revert by
   hand, re-verify green — new files are untracked, `git checkout` will not
   restore them):
   - M1: make `templatesFor` return the unfiltered bank → test 4a fails
     (letter templates offered on a Task 2 desk).
   - M2: swap `tp-done`/`tp-current` assignment → test 4c fails.
   - M3: remove `'template'` from `panelTabsShown` → test 4a fails (tab
     missing).
6. **SPEC.md**: a "Writing templates" subsection under the coach-panel area:
   the fifteen ids, the filter rule, the paragraph-progress mapping, the
   no-auto-insert decision and why, the persistence-is-future note.
7. **Full gates**: `npx tsc -b --noEmit`; `npx vitest run` (baseline **1453 /
   51 files** — only ADD); `npm run build`; 10× `npx vitest run --project ui`
   identical; `git status --porcelain -- . ':!plans/'` shows only in-scope
   files.

## Done criteria

- [ ] `grep -c "id: 'tpl-" src/templates/bank.ts` → 15
- [ ] `grep -c "'template'" src/App.tsx` → ≥3 (union, list, branch)
- [ ] Engine + UI template tests green; every mutation check observed killing
- [ ] `npx vitest run` ≥ 1453 + new, all green; tsc, build, 10× UI identical
- [ ] `git diff 1e4559b..HEAD -- src/analysis src/profile` → empty
- [ ] SPEC.md subsection present (`grep -c "Writing templates" SPEC.md` ≥ 1)

## STOP conditions

- The a11y tab pattern test fails in a way extending its expected list does
  not fix — the strip machinery was less generic than stated; report.
- Any template's structure contradicts a Structure Rail check (e.g. the rail
  demands something a template omits) — report the pair; one of them is
  wrong and deciding which is a design call.
- The paragraph count from `analysis` proves unavailable where the panel
  renders (it should always be — FeedbackPanel gets `analysis` in the same
  column) — report rather than recomputing paragraphs locally.

## Maintenance notes

- Template ids follow the frozen-id discipline (append, never rename) in
  case persistence lands later and stores a choice.
- New question types or tones fail the coverage tests until templates are
  written — deliberate: the bank must keep pace with the prompt bank.
- The progress mapping assumes template section order ≈ paragraph order; a
  future template with optional sections needs a smarter mapping — note, not
  build.
