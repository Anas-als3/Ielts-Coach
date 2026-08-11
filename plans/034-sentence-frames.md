# Plan 034: Sentence frames — every template becomes fill-in-the-blank

> **Executor instructions**: Follow step by step; run every verification
> command. STOP conditions binding. Do not touch `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat eaf5e92..HEAD -- src/templates/ src/components/TemplatePanel.tsx src/components/TemplatePanel.css src/types.ts tests/templates.test.ts tests/ui/template-panel.test.tsx`
> Written against the LIVE tree at `eaf5e92`, hours after plan 033 merged.
> Expect zero drift; verify by content if any appears.

## Status

- **Priority**: P1 (user-requested refinement of the just-landed 033)
- **Effort**: M — content-dominant; the UI change is one renderer
- **Risk**: LOW — extends the 033 surface only
- **Depends on**: 033 (DONE, merged at `d7e4bab`)
- **Planned at**: commit `eaf5e92`, 2026-08-11

## Why this matters

Plan 033 shipped templates as *section descriptions* ("Body 1: strongest
reason + a concrete example"). The user wants what most IELTS learners mean by
a template: **complete sentence frames with slots** —

> "While it is a commonly held belief that [paraphrased statement], others
> argue the opposite. In my opinion, [your position]."

— followed sentence by sentence while writing. This plan upgrades every
template to that form, and improves on the classic frame sets in three ways:

1. **Type-specific frames** (15 templates over 5 question types + charts +
   letters), not three generic ones stretched over everything.
2. **Fresher scaffolding.** The most famous frames are the most penalised:
   "There is no denying the fact that…" and "This essay will discuss…" appear
   in millions of essays and examiners discount them on sight (band
   descriptors: memorised language is not the candidate's own). Our frames do
   the same structural work with less-burned wording.
3. **Built-in variation.** Each question type's TWO templates use different
   connective sets and different frame phrasings, and the panel says plainly:
   fill the slots in your own words and vary the connectors — the frame is
   scaffolding, not the answer.

## Current state (verified at `eaf5e92`)

- `src/templates/bank.ts` — 15 templates (`grep -c "id: 'tpl-"` → 15);
  `TemplateSection { title, guidance, starters }` (`src/types.ts`, added by
  033); `templatesFor` filter + coverage tests in `tests/templates.test.ts`
  (26 cases).
- `src/components/TemplatePanel.tsx` renders sections as an ordered list with
  `tp-done`/`tp-current` progress classes keyed to
  `analysis.paragraphs.length`; starters render as quoted chips; the
  memorisation warning matches `ModelAnswer.tsx:129-132`'s voice.
- `tests/ui/template-panel.test.tsx` — 7 tests incl. the progress-class case
  and the desk-filter cases. All green at 1,486 / 53 files.

## Design

### Data change

`TemplateSection` gains one field and loses one:

```ts
export interface TemplateSection {
  title: string
  guidance: string            // stays — one line, what the paragraph must do
  frames: readonly string[]   // NEW — the paragraph as 1-4 sentence frames,
                              // slots written [like this]
}
// `starters` is REMOVED — frames supersede it. Delete the field, its
// renderer, and migrate its tests. 033's ids stay frozen; only section
// internals change.
```

Slot syntax: square brackets, lowercase descriptive text, e.g.
`[paraphrase the statement]`, `[your first reason]`, `[a concrete example —
a place, a study, a number]`. The renderer splits on `\[([^\]]+)\]` and wraps
slots in `<span class="tp-slot">`. A frame never nests brackets.

### The renderer

Each section shows its frames as consecutive sentence lines (the user's
format), slots visually distinct (bordered chip style, existing design
tokens). Guidance renders as a small line above the frames. Progress classes
unchanged. The memorisation warning is REPLACED with this sharper text
(verbatim):

> "Frames are scaffolding. Fill every slot in your own words, and swap the
> connectors for ones you'd naturally use — examiners discount sentences they
> have read a thousand times, and every candidate using a template unchanged
> writes the same essay."

### The frames — CONTENT IS NORMATIVE, paste then verify

For every template below: replace each section's `starters` with the given
`frames`, keep titles and guidance from 033 (tighten guidance to one line
where it now duplicates the frame). All original prose — no reproduction of
published template sets; structural similarity to the genre is inevitable and
fine, verbatim borrowing is not.

**1. `tpl-op-onesided` (Opinion — full agreement/disagreement)**
- Introduction: `It is increasingly common to hear that [paraphrase the statement].` · `Although some would push back, I fully [agree/disagree]: [your position in one clause].`
- Body 1: `The strongest reason is that [your first reason].` · `Put simply, [explain it in different words].` · `[A concrete example — a country, a study, a workplace] shows this clearly: [what happened].`
- Body 2: `Beyond that, [your second reason].` · `This matters because [the consequence].` · `Consider [a second example]: [what it demonstrates].`
- Conclusion: `For these reasons I remain convinced that [your position, reworded].` · `If anything, [a closing thought that extends, not repeats].`

**2. `tpl-op-balanced` (Opinion — partly agree)**
- Introduction: `[Paraphrase the statement] — a claim with real force, though not the whole story.` · `I largely agree, with one reservation: [name it].`
- Body 1: `Where the claim convinces is [the part you accept].` · `In practice, [explanation].` · `[An example] makes the point: [what it shows].`
- Body 2: `The reservation is [your caveat].` · `That is, [explain the limit].` · `[A counter-example] illustrates why: [what it shows].`
- Conclusion: `On balance, [restate: mostly agree, minus the caveat].` · `The claim holds — provided [the condition].`

**3. `tpl-di-both-then-view` (Discussion — both views, then yours)**
- Introduction: `Whether [the issue, paraphrased] divides opinion sharply.` · `Some hold that [first view]; others counter that [second view].` · `Both deserve a hearing before I give my own verdict.`
- First view: `Those who [favour the first view] point to [their main ground].` · `From their standpoint, [explanation].` · `[An example] supports them: [what it shows].`
- Second view: `The opposing camp answers that [second view's ground].` · `Their case rests on [explanation].` · `[A different example] backs this: [what it shows].`
- Conclusion: `Weighing the two, I side with [your view] because [the deciding reason].`

**4. `tpl-di-view-throughout` (Discussion — your view throughout)**
- Introduction: `[The issue, paraphrased] is often framed as a choice between [view A] and [view B].` · `From the outset, my position is that [your side], though the other view merits attention.`
- Your case: `The decisive consideration is [your main ground].` · `In other words, [explanation].` · `[An example]: [what it shows].`
- The other view, answered: `Admittedly, those who argue [the other view] have a point about [their strongest ground], as [their example] shows.` · `Yet this overlooks [the flaw], which is why the argument ultimately fails.`
- Conclusion: `Both positions were worth weighing, but [your side] carries the day: [one-clause reason].`

**5. `tpl-ps-paired` (Problem–solution pairs)**
- Introduction: `[The situation, paraphrased] brings problems that are serious but not unanswerable.` · `Two stand out, and each has a workable remedy.`
- First pair: `The most pressing difficulty is [problem one].` · `Its effects show up as [consequence].` · `The direct answer is to [solution one], as [an example — a city, a policy, a company] has already shown by [what they did].`
- Second pair: `A second, related problem is [problem two].` · `Left alone, it leads to [consequence].` · `Here the remedy is [solution two]; [an example or figure] suggests it works because [why].`
- Conclusion: `Neither remedy is costless, but [the one that matters most] deserves priority because [reason].`

**6. `tpl-ps-split` (Problems first, then solutions)**
- Introduction: `[The situation, paraphrased] raises connected problems that are best solved together.`
- The problems: `The first is [problem one], visible in [an example or figure].` · `Feeding into it is [problem two]: [one-sentence explanation].` · `Together they [the shared root or combined effect].`
- The solutions: `Because the problems share [the root], the answers must too.` · `[Solution one] tackles [problem one] directly; [an example — a city, a policy, a company] shows how.` · `[Solution two] then addresses [problem two] by [mechanism].`
- Conclusion: `Solved separately these problems return; addressed at [the root], they need not.`

**7. `tpl-ad-outweigh` (Advantages–disadvantages — one side outweighs)**
- Introduction: `[The development, paraphrased] has costs as well as benefits, but the balance is not close.` · `In my view the [advantages/disadvantages] clearly outweigh.`
- The winning side: `The first major [benefit/cost] is [point one]; [an example] bears this out: [what happened].` · `Just as weighty, [point two], because [explanation].`
- The other side, sized: `Against this stand [the other side's strongest point], and [a concrete example] shows it is real.` · `Real — but limited: [why it weighs less].`
- Conclusion: `Set side by side, the [winning side] dominates, and [one-clause final reason].`

**8. `tpl-ad-survey` (Advantages–disadvantages — even-handed survey)**
- Introduction: `[The development, paraphrased] rewards a careful look at both columns of the ledger.`
- Advantages: `On the positive side, [advantage one]; [an example]: [what it shows].` · `A further gain is [advantage two], since [explanation].`
- Disadvantages: `The drawbacks are just as concrete.` · `[Disadvantage one] — as [an example] demonstrates — [its effect].` · `There is also [disadvantage two], which [explanation].`
- Conclusion: `On balance I judge the [side you land on] weightier, chiefly because [the deciding reason].`

**9. `tpl-dq-two-para` (Double question — one per paragraph)**
- Introduction: `[The topic, paraphrased] raises two questions: [question one, compressed] and [question two, compressed].` · `I take each in turn.`
- First question: `On the first, [your answer].` · `The main reason is [ground], which [explanation].` · `[An example]: [what it shows].`
- Second question: `As to the second, [your answer].` · `This follows because [ground].` · `[An example or consequence] makes it concrete: [what it shows].`
- Conclusion: `In short: [answer one, one clause], and [answer two, one clause].`

**10. `tpl-dq-woven` (Double question — woven)**
- Introduction: `The two questions here — [question one] and [question two] — share one answer: [the linking thesis].`
- First strand: `[First aspect of the thesis] speaks to both: [how it answers question one], and equally [how it bears on question two].` · `[An example] shows both at once: [what it shows].`
- Second strand: `[Second aspect] completes the picture: [explanation touching both questions].` · `Here [a second example] is telling: [what it shows].`
- Conclusion: `One thesis, two questions answered: [restate the link in fresh words].`

**11. `tpl-t1-trends` (Chart — overview first, grouped by trend)**
- Introduce the chart: `The [chart/graph/table] shows [what], in [where/units], between [period].`
- Overview: `Overall, the most striking feature is [the biggest movement or contrast], while [the second feature].` *(no numbers here — the guidance already says so)*
- First group: `Looking first at [the risers / the larger categories], [category] [rose/led] from [figure] to [figure], and [second category] followed, [movement + figure].`
- Second group: `[The fallers / the outliers] tell the opposite story: [category] [fell/lagged] to [figure], while [category] [movement + figure].`

**12. `tpl-t1-compare` (Chart — comparison-led)**
- Introduce the chart: `The [chart/table] compares [categories] by [measure] in [context/period].`
- Overview: `Overall, [the dominant category] leads throughout, and the gap [narrows/widens/holds] [where].`
- The leader vs the rest: `[Dominant category] accounts for [figure], roughly [multiple/fraction] of [comparison], with [second category] at [figure].`
- Exceptions: `The pattern breaks at [the exception]: [category] [what it does + figure], the only case where [what makes it exceptional].`

*(Letter templates keep their EXISTING four sections — merge each "Sign-off"
frame group below into the fourth section rather than adding a fifth:
`paragraphs.length` drives the progress mapping, and a sign-off is not its own
blank-line paragraph.)*

**13. `tpl-lt-formal` (Letter — formal)**
- Opening: `Dear [Mr/Ms + surname, or Sir or Madam],` · `I am writing to [your purpose — complain about / request / inform you of] [the matter].`
- First bullet: `To explain the background: [bullet one, developed].` · `Specifically, [a concrete detail — date, place, reference].`
- Second bullet: `What concerns me most is [bullet two, developed].` · `As a result, [the consequence for you].`
- Third bullet + action: `I would therefore ask that [bullet three / the action you want].` · `I would appreciate a reply by [timeframe].`
- Sign-off: `Yours sincerely, (if you named them) / Yours faithfully, (if you wrote Sir or Madam)` · `[your full name]` *(the parenthesised notes are notes, not slots — only square brackets render as slots)*
- *(no contractions anywhere in this letter — the tone rules check)*

**14. `tpl-lt-semiformal` (Letter — semi-formal)**
- Opening: `Dear [Mr/Ms + surname],` · `I hope this letter finds you well.` · `I wanted to write about [your purpose].`
- First bullet: `You may remember that [bullet one, with the shared context].`
- Second bullet: `The difficulty now is [bullet two], which means [consequence].`
- Third bullet + action: `Would it be possible to [bullet three / the request]?` · `It would make a real difference because [reason].`
- Sign-off: `Yours sincerely, / Best regards,` · `[Your name]`

**15. `tpl-lt-informal` (Letter — informal)**
- Opening: `Dear [first name],` · `It's been too long! I am writing because [your purpose, casually].` *(keep "I am" uncontracted in exactly this sentence — it is the engine's recognised purpose marker; contractions everywhere else)*
- First bullet: `You won't believe [bullet one, told as you'd say it].`
- Second bullet: `The thing is, [bullet two] — [a real detail].`
- Third bullet + action: `So here's my idea: [bullet three / the plan]. What do you think?`
- Sign-off: `Best wishes, / Take care,` · `[Your name]`
- *(contractions are right at this register — the engine agrees)*

## Steps

1. **Types + bank**: change `TemplateSection` (`frames` in, `starters` out);
   rewrite all 15 templates' sections with the frames above; one-line the
   guidance where redundant. Migrate `tests/templates.test.ts`: the
   starter-coverage cases become frame-coverage (every section of every
   template has ≥1 frame; every frame's brackets balance — write a checker:
   `/\[[^\[\]]+\]/` matches strip cleanly, no nesting, no empty slots;
   every Task 2 BODY section (not intro/conclusion) contains at least one
   frame with an example-type slot — per SECTION, decidable now that every
   body frame set carries one
   slot). **Verify**: tsc clean; engine tests green.
2. **Renderer**: TemplatePanel renders frames with `tp-slot` spans; guidance
   above; new warning text verbatim; delete the starters renderer.
   **Verify**: tsc + build clean.
3. **UI tests**: migrate the warning assertion to the new text; add: slots
   render as styled spans (query a known slot text from `op-01`'s desk, e.g.
   `paraphrase the statement`); frames appear for the selected template and
   swap when the template changes. Progress-class test unchanged.
   **Verify**: template-panel suite green.
4. **Mutation checks** (apply → observe → hand-revert → green):
   - M1: renderer joins frames WITHOUT splitting slots (plain text, no
     `tp-slot`) → the slot-span test fails.
   - M2: bracket-balance checker made vacuous (`return true`) after
     introducing a deliberately broken frame in a scratch copy of one
     template → the balance test fails against the broken frame; restore
     both.
   - M3: `frames` dropped from one section in the bank → the coverage test
     names the template and section.
5. **SPEC.md**: update the Writing-templates subsection — frames replace
   starters, the slot syntax, the new warning text, and the variation
   rationale (two templates per type = two different frame sets, by design).
6. **Full gates**: tsc; `npx vitest run` (baseline **1486 / 53** — adds and
   migrations only; the 033 tests that asserted starter chips are MIGRATED,
   not deleted — same coverage intent, new field); build; 10× UI identical;
   scope check `git status --porcelain -- . ':!plans/'`.

## Done criteria

- [ ] `grep -rn "starters" src/ tests/ | wc -l` → 0 (field fully migrated; the pipe form because `grep -c -r` prints per-file counts, never a bare 0)
- [ ] `grep -c "frames:" src/templates/bank.ts` → ≥ 60 (15 templates × ≥4 sections)
- [ ] `grep -c "tp-slot" src/components/TemplatePanel.tsx` → ≥ 1
- [ ] All gates green; every mutation observed killing; 10× UI identical
- [ ] `git diff eaf5e92..HEAD -- src/analysis src/profile src/App.tsx` → empty
      (this plan does not touch App wiring)

## STOP conditions

- A frame contradicts an engine rule (e.g. a letter frame's sign-off pairing
  disagrees with `letterAchievement.ts`'s tables, or the formal letter frame
  needs a contraction) — report the pair.
- The `[slot]` render syntax collides with legitimate square brackets in any
  existing frame text — none exist by construction; if you introduce one,
  rewrite the frame, don't extend the syntax.
- Migrating a 033 test would weaken what it asserts — report instead.

## Maintenance notes

- Frames are content under the same coverage tests as 033 — a new question
  type without frames fails the build.
- If persistence of template choice lands later, ids are already stable.
- If a future pass wants per-slot fill-in tracking (detecting which slots the
  learner has addressed), that needs analysis-side work — noted, not built.
