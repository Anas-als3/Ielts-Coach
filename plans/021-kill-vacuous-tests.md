# Plan 021: Kill the tests that cannot fail, and cover the five band numbers a learner actually reads

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> ```bash
> git diff --stat ae92bac..HEAD -- \
>   src/profile/store.ts src/components/Report.tsx src/components/Dashboard.tsx \
>   src/analysis/tokenize.ts src/analysis/rules/cohesion.ts \
>   src/analysis/rules/letterAchievement.ts src/analysis/engine.ts src/meta.ts \
>   tests/store.test.ts tests/letters.test.ts tests/false-positive-corpus.test.ts tests/ui/
> ```
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: **P1**
- **Effort**: M (one to two days; six independent items, each landable alone)
- **Risk**: **LOW** — this plan modifies **no source file**. Every change is under `tests/`.
- **Depends on**: none. Item 021-e **coordinates** with
  `plans/015-letter-false-accusations-round-two.md` rather than depending on it —
  neither blocks the other, and whichever lands second rebases onto the first
  (`plans/README.md` says the same). See step 7.
- **Category**: tests
- **Planned at**: commit `ae92bac`, 2026-08-10

## Why this matters

An audit applied one mutation at a time to `src/`, re-ran the whole suite after
each, and recorded which mutations the suite failed to notice. **Every mutation
listed in this plan survived at 848 green.** A surviving mutation is a precise
statement about coverage: that line can be changed to something wrong and no
test in this repo will say so.

Two of those are ordinary gaps. One is worse, and it is the reason this plan is
P1 rather than P3:

**`tests/store.test.ts:829` is a test that cannot fail.** It calls
`loadSessions()` three times and asserts exactly one backup key exists. Delete
the guard it is named after — `if (hasIdenticalBackup(raw)) return` at
`src/profile/store.ts:354` — and the test still passes, because the three reads
land inside the same millisecond, all three backup keys are built from
`new Date().toISOString()`, and the second and third writes overwrite the first.
The test measures the resolution of the system clock. It has never measured the
guard.

**This is the third vacuous test found in this repo.** The first was a walk-cap
constant that could be mutated 3→99 with the suite still green; the second was
a bullet-coverage fixture too weak to fail when the rule it pinned was gutted.
Three independent instances is not bad luck — it is a class of defect this
codebase produces, and it produces it precisely because the tests are written
carefully enough to *look* like guards. A test named "does not mint a second
backup" that is green whether or not the app mints a second backup is more
dangerous than no test, because it is the reason nobody looks again.

The rest of the plan is the coverage those mutations exposed:

- **Five surviving mutants in the two components that print a learner's band.**
  `Report.tsx` can be made to show every band a full point high; `Dashboard.tsx`
  can be made to do the same in two places and to plot the progress chart
  backwards. Nothing in 24 test files notices. The band is the number the whole
  product exists to produce.
- **The tokenizer's offset invariant is documented and undefended.** No test
  file imports `tokenize` at all.
- **Two cohesion rules that feed the Coherence band are asserted by nothing.**
  One of them can be switched off entirely (`wordCount >= 200` → `>= 20000`)
  with no test failing.
- **The golden corpus guards one pipeline of three** — and letters, the
  pipeline it does not guard, are where this repo has now produced false
  accusations twice.

When this lands, every mutation named below fails at least one test, and the
repo has a written standing rule for what "this guard prevents X" tests must
prove.

**Two different counts appear in this plan; do not confuse them.** *Eleven
mutants survived* the audit — one in `store.ts`, five in the two band-printing
components, one in `tokenize.ts`, three in `cohesion.ts`, and
`SIGNOFF_TAIL_LINES_MAX 4 → 3`. Those are the findings. The **Verify tables of
steps 2–7 name eighteen mutations in total**, because several steps also mutate
in the *opposite* direction to pin a boundary from both sides
(`>= 8 → >= 7`, `>= 200 → >= 199`, `4 → 5`, `4 → 99`, `4 → 2`), and one step
also mutates the paragraph-span *start* (`tokenize.ts:282 → start: r.start - 1`)
to prove containment is really checked rather than only the end. Step 8 adds one
further exploratory mutation with no fixed target, and is excluded from the
reporting obligation for that reason. Reporting obligations are stated against
the tables, never against a number.

## Current state

### The files this plan reads

- `src/profile/store.ts` — session storage, migration ladder, backup-before-clobber. The dedupe guard is at `:354`.
- `src/components/Report.tsx` (719 lines) — the writing report. Band hero at `:457-503`, criterion tiles at `:504-527`. **No test renders it.**
- `src/components/Dashboard.tsx` (474 lines) — the Progress page. Trend chart `:64-145`, chronological sort `:226-230`, history table `:376-471`. Rendered by three UI tests, but no test asserts any band it prints.
- `src/analysis/tokenize.ts` — words/sentences/paragraphs with absolute offsets. **Its only importer anywhere in the repo is `src/analysis/engine.ts:10`.**
- `src/analysis/rules/cohesion.ts` — the three CC linker rules.
- `src/analysis/rules/letterAchievement.ts` — the letter engine; sign-off window constants at `:94-101`, the walk at `:593-603`.
- `src/meta.ts` — `TASK1_ONLY_CATEGORIES` (`:116`), `TASK2_ONLY_CATEGORIES` (`:128`), `LETTER_ONLY_CATEGORIES` (`:156`), `categoryAppliesTo` (`:176`).
- `tests/ui/renderApp.tsx` — the mandatory deterministic render helper for tests that render `<App/>`.

### 021-a — the vacuous backup test

`tests/store.test.ts:829-842`, verbatim:

```ts
  it('does not mint a second backup of a payload it has already copied', () => {
    // Reads are pure, so the damaged payload is seen again on every render.
    // One backup per read would fill the quota holding the surviving essays.
    seed(5, [
      makeSession('good', '2026-01-01T10:00:00.000Z', { task: 'task2', section: 'writing' }),
      makeSession('damaged', '2026-01-02T10:00:00.000Z', { section: 'writing', analysis: undefined }),
    ])

    loadSessions()
    loadSessions()
    loadSessions()

    expect(backupKeys()).toHaveLength(1)
  })
```

The guard it exists for, `src/profile/store.ts:352-364`:

```ts
function backupRaw(raw: string, reason: string): void {
  try {
    if (hasIdenticalBackup(raw)) return
    const key = `${BACKUP_KEY_PREFIX}${new Date().toISOString()}`
    window.localStorage.setItem(key, raw)
```

The key is `ielts-coach.backup.` + an ISO timestamp with millisecond
resolution. Three `loadSessions()` calls in a row complete well inside one
millisecond, so all three produce the *same* key string and `setItem`
overwrites. `backupKeys()` returns 1 either way.

Test-file helpers already present and reusable (`tests/store.test.ts:14-110`):
`installLocalStorage()` (a `Map`-backed stub installed on `globalThis.window`
in `beforeEach`), `makeSession`, `seed(schemaVersion, sessions)`,
`backupKeys()`, and `const BACKUP_PREFIX = 'ielts-coach.backup.'`. `vi` is
already imported at `:14`.

### 021-b — five surviving mutants in the two band-printing components

`tests/ui/` holds eight test files: `a11y`, `letters`, `listening`,
`model-answer`, `module-switch`, `reading-word-limits`, `reading`,
`task-switching` (plus `renderApp.tsx` and `setup.ts`, ten entries in all). `grep -rn "components/Report\|components/Dashboard" tests/`
returns **nothing** — neither component is imported by any test. `Report` *is*
reached incidentally (`tests/ui/a11y.test.tsx:330` waits for its "New essay"
button, which exists only in `Report.tsx:448-450`), and `Dashboard` is reached
by three tests that click the Progress link — but the only band assertions
anywhere in `tests/ui/` are `reading.test.tsx:283` and `listening.test.tsx:474`,
both on the *Reading/Listening* report. **No test asserts a writing band.**

The five mutations, each verified to survive alone at 848 green:

**M1 — `src/components/Report.tsx:425`**

```ts
  const overall = clampBand(analysis.band.overall)
  const lo = Math.max(4, overall - 0.5)
  const hi = Math.min(9, overall + 0.5)
```

Mutate to `clampBand(analysis.band.overall + 1)`. The hero range at `:460-462`
and the `role="img"` aria-label at `:470-478` both go a full point high.

**M2 — `src/components/Report.tsx:510`**

```ts
                <p className="rp-tile-band mono">{formatBand(analysis.band.byCriterion[c])}</p>
```

Mutate to `{formatBand(analysis.band.overall)}`. All four criterion tiles print
the same wrong number while their labels stay correct.

**M3 — `src/components/Dashboard.tsx:134-136`** (the trend chart's latest-value label)

```tsx
      <text className="db-last-label" x={x(pts.length - 1) + 10} y={y(last.band) + 4}>
        {last.band.toFixed(1)}
      </text>
```

Mutate to `{(last.band + 1).toFixed(1)}`.

The latest band is **computed once** — `const last = pts[pts.length - 1]` at
`:87`, over points already clamped to 4–9 at `:71` — and then **rendered at two
independent sites**: the chart's `aria-label` at `:96`
(`… Latest estimate: ${last.band.toFixed(1)}.`) and this visible
`<text className="db-last-label">` at `:134-136`. Because the two sites are
separate expressions over the same value, a mutation applied to one leaves the
other correct. A test that asserts only the aria-label therefore does **not**
kill this mutation; the visible `<text>` must be asserted too.

**M4 — `src/components/Dashboard.tsx:431-433`** (the history table's band cell)

```tsx
                    <td className="mono db-td-num">
                      {Number.isFinite(band) ? Math.min(9, Math.max(4, band)).toFixed(1) : '—'}
                    </td>
```

Mutate to `Math.min(9, Math.max(4, band + 1)).toFixed(1)`.

**M5 — `src/components/Dashboard.tsx:226-230`** (the chronological sort)

```ts
  const chrono = useMemo(
    () => [...sessions].sort((a, b) => a.dateISO.localeCompare(b.dateISO)),
    [sessions],
  )
  const newestFirst = useMemo(() => [...chrono].reverse(), [chrono])
```

Mutate to `b.dateISO.localeCompare(a.dateISO)`. The chart then plots
newest-to-oldest — a learner who improved is shown a declining line — **and**,
because `newestFirst` is derived by reversing `chrono`, the history table flips
to oldest-first at the same time. Either surface can kill it.

Props the new tests must supply (`src/types.ts:711-730`):

```ts
export interface ReportProps {
  session: WritingSessionRecord;
  previousSession: WritingSessionRecord | null;
  profile: ErrorProfile;
  onRedraft: () => void;
  onNewEssay: () => void;
  onViewDashboard: () => void;
}

export interface DashboardProps {
  sessions: WritingSessionRecord[];
  profile: ErrorProfile;
  trends: CategoryTrend[];
  onOpenSession: (id: string) => void;
  onStartPractice: (focus: IssueCategory | null) => void;
  onDeleteSession: (id: string) => void;
  onExport: () => void;
  onImport: (json: string) => void;
}
```

`ErrorProfile` is `{ totalSessions: number; categories: Partial<Record<IssueCategory, CategoryStat>>; focusCategories: IssueCategory[] }`
(`src/types.ts:640-645`). `WritingSessionRecord` requires
`section: 'writing'`, `id`, `dateISO`, `mode`, `task`, `module`, `promptId`,
`promptText`, `questionType`, `essayText`, `durationSec`, `pacing`,
`pasteAttempts`, `analysis` (`src/types.ts:429-451`). `BandEstimate` is
`{ overall, byCriterion: Record<Criterion, number>, rationale: Record<Criterion, string[]> }`
(`:353-359`).

Display names come from `src/meta.ts:20-39`: `TR → { label: 'Task Response', short: 'Task' }`,
`CC → { label: 'Coherence & Cohesion', short: 'Coherence' }`,
`LR → { label: 'Lexical Resource', short: 'Vocabulary' }`,
`GRA → { label: 'Grammatical Range & Accuracy', short: 'Grammar' }`.

The Dashboard's history table header (`src/components/Dashboard.tsx:380-393`) is
Date · Exam · Task · Mode · Question · Words · **Band (est.)** · Top issue ·
(actions). **The Words cell and the Band cell carry identical class names**
(`className="mono db-td-num"`), so a selector-by-class picks up both; resolve
the band column by finding the `Band (est.)` header's index instead.

`BandTrendChart` returns `null` when fewer than two sessions have a finite band
(`src/components/Dashboard.tsx:73`), so the Dashboard fixture needs **at least
two** sessions.

### 021-c — the tokenizer's offset invariant

`src/analysis/tokenize.ts:204-206`, the promise:

```
 * - **Offsets** — every span's `[start, end)` indexes into the ORIGINAL text
 *   exactly (`text.slice(start, end) === span.text`); inline highlights in
 *   the editor depend on this invariant.
```

The code that keeps it, `src/analysis/tokenize.ts:125-141`:

```ts
  const pushSpan = (rawStart: number, rawEnd: number): void => {
    // Trim whitespace off both ends while keeping offsets absolute.
    let s = rawStart
    let e = rawEnd
    while (s < e && WHITESPACE_RE.test(text.charAt(s))) s++
    while (e > s && WHITESPACE_RE.test(text.charAt(e - 1))) e--
    if (s >= e) return
    const spanText = text.slice(s, e)
    if (!HAS_CONTENT_RE.test(spanText)) return // punctuation-only fragment, not a sentence
    sentences.push({
      text: spanText,
      start: s,
      end: e,
      wordCount: countWordsWithin(words, s, e),
      paragraphIndex,
    })
  }
```

Mutating `start: s` to `start: rawStart` leaves 848 green while
`text.slice(start, end) === text` breaks for **every sentence after the first in
its paragraph** (the untrimmed start includes the space after the previous full
stop). `Report.tsx` slices the essay by those offsets to draw inline highlights
(`buildSegments`, `src/components/Report.tsx:71-80`), so a broken invariant
misplaces every mark by one character onward.

Nothing defends it: `grep -rn "from '.*tokenize'" src/ tests/` returns exactly
one line, `src/analysis/engine.ts:10`. `tests/paragraphing-gate.test.ts` is the
closest thing to tokenizer coverage and it drives `analyzeEssay`, asserting
paragraph and sentence **counts** (`tests/paragraphing-gate.test.ts:12-40`), never
offsets.

The invariant is **true today** — an adversarial sweep of 50,000 generated
strings found zero violations — so this step is pure protection, not a bug fix.
Say so in the test's header comment; the next reader must not mistake it for a
regression suite.

Shapes to assert against (`src/types.ts:289-313`):

```ts
export interface SentenceSpan  { text: string; start: number; end: number; wordCount: number; paragraphIndex: number }
export interface ParagraphSpan { index: number; text: string; start: number; end: number; wordCount: number; sentences: SentenceSpan[] }
export interface TokenizedDoc  { text: string; words: Token[]; sentences: SentenceSpan[]; paragraphs: ParagraphSpan[]; wordCount: number }
```

### 021-d — two cohesion rules never asserted

`src/analysis/rules/cohesion.ts:269-280`:

```ts
  const sentenceCount = doc.sentences.length
  if (sentenceCount >= 8 && initialBySentence.size / sentenceCount > 0.5) {
    issues.push(
      issue(
        'linking-overuse',
        'More than half of your sentences open with a linking word, which reads as mechanical. Keep linkers for real turns in the argument and let some sentences start with the idea itself.',
        null,
        null,
        doc,
      ),
    )
  }
```

and `src/analysis/rules/cohesion.ts:306`:

```ts
  if (doc.wordCount >= 200) {
```

Three surviving mutations: `> 0.5` → `> 0.99`; `>= 8` → `>= 800`; `>= 200` →
`>= 20000` (which disables `linking-underuse` for every essay a human will ever
write).

`grep -rn "linking-overuse\|linking-underuse" tests/` returns **one** hit — a
comment at `tests/false-positive-corpus.test.ts:23-24` explaining that padding
corpus entries past 250 words would draw `paragraphing` and `linking-underuse`,
which is why entries are bare sentences. That is the opposite of coverage: it
documents the two categories being kept *out* of the only file that mentions
them.

Both feed the CC band and the learner-facing feedback panel
(`CATEGORY_META['linking-overuse']` and `['linking-underuse']`,
`src/meta.ts:56-57`).

Two details the fixtures must respect:

1. `linking-overuse` has a **second, independent** trigger at
   `cohesion.ts:282-302` — three consecutive linker-opened sentences, which
   emits a *different* message (`This is the third sentence in a row…`) with a
   span. A fixture must therefore assert on the **message**, not merely on the
   category, and should avoid three consecutive linker openers so the two
   triggers stay separable.
2. `sentenceInitial` means the device starts at the first non-space character of
   its sentence (`cohesion.ts:195-199`). The lexicon is ~90 devices
   (`cohesion.ts:22-120`): `However`, `Moreover`, `Therefore`, `Firstly`,
   `For example`, `In addition`, `Finally`, `Consequently` are all in it.

`analyzeEssay` runs `cohesionRules` unconditionally
(`src/analysis/engine.ts:61`) — there is no word floor to work around.

### 021-e — the sign-off window constant, pinned at one point only

`src/analysis/rules/letterAchievement.ts:94-101`:

```ts
const SIGNOFF_TAIL_LINES_MIN = 2
const SIGNOFF_TAIL_LINES_MAX = 4

/**
 * A trailing line this short is a signature, a reference number or an enclosure
 * note, never a paragraph. It is the test the window extension is gated on.
 */
const SIGNOFF_TAIL_WORDS_MAX = 4
```

The walk, `src/analysis/rules/letterAchievement.ts:593-603`:

```ts
function signoffCandidates(lines: Line[]): Line[] {
  let first = Math.max(0, lines.length - SIGNOFF_TAIL_LINES_MIN)
  while (
    first > 0 &&
    lines.length - first < SIGNOFF_TAIL_LINES_MAX &&
    wordsIn(lines[first - 1].text) <= SIGNOFF_TAIL_WORDS_MAX
  ) {
    first -= 1
  }
  return lines.slice(first)
}
```

`lines` are **non-empty** lines (`textLines`, `:487-`), and `wordsIn` counts
letter runs only (`:501-504`), so `Order reference 44718` is two words.

Two tests touch the window. `tests/letters.test.ts:239-259` pins the low edge (a
one-line reference tail must still be found). `tests/letters.test.ts:755-762`
is the whole of the high edge:

```ts
  it('keeps the sign-off tail window tight — SIGNOFF_TAIL_LINES_MAX = 4', () => {
    // MUTATION PIN: SIGNOFF_TAIL_LINES_MAX 4→2 loses the reference-line case
    // above; this asserts the other edge, that the window stops. Four tail
    // lines is closing + signature + two notes, and a fifth is not reached.
    const text = `${letter('Dear Sir or Madam,')}\n\nOrder reference 44718\n\nEnclosed: receipt\n\nPlease quote this`
    const a = analyzeLetter(text, FORMAL)
    expect(categories(a)).toContain('gt-signoff-missing')
  })
```

`letter()` (`tests/letters.test.ts:107-116`) builds
`Dear Sir or Madam,\n\n…body…\n\nYours faithfully,\n\nDaniel Whitfield`.

**`4 → 3` survives the suite today** — predicted from reading the walk, then
confirmed by running the mutation against the full 848-test suite at `ae92bac`:
`4 → 3` stays green and `4 → 2` goes red, so the pin this step adds is genuinely
needed rather than decorative. Trace it: with three note lines below the signature the window under
`MAX = 4` covers `[Whitfield, ref, enclosed, quote]` and stops one line short of
the closing (test `:755` passes); under `MAX = 3` it covers
`[ref, enclosed, quote]` and also stops short (test `:755` still passes). With
one note line, `MAX = 4` reaches `[faithfully, Whitfield, ref]` and `MAX = 3`
reaches exactly the same three lines (test `:239` still passes). Neither test
distinguishes 4 from 3. **The case that does is exactly TWO note lines** —
closing + signature + two notes is four lines, the widest layout the constant is
meant to admit, and under `MAX = 3` a correctly formatted business letter is
told by an ERROR (−0.5 Task Achievement) that it has no sign-off.

That is the shape of the finding: the constant is pinned by a test that names
its literal value in its own title and exercises one contrived point, rather
than by the two real layouts that sit either side of the boundary.

### 021-f — the golden corpus guards one pipeline of three

`tests/false-positive-corpus.test.ts:34-41`:

```ts
import { describe, expect, it } from 'vitest'
import { analyzeEssay } from '../src/analysis/engine'
import type { Issue, IssueCategory } from '../src/types'

/** Everything the learner would actually see: `info` is advisory, not an accusation. */
function accusations(text: string): Issue[] {
  return analyzeEssay(text, null).issues.filter((i) => i.severity !== 'info')
}
```

`CORPUS` (`:50-198`) is 60+ sentences of correct English, each chosen because a
rule once accused it — comma-splice openers, bare mass nouns, zero-article fixed
phrases. `it.each(CORPUS)` at `:205-207` runs every one through `analyzeEssay`
and requires zero issues above `info`. **`analyzeLetter` and `analyzeTask1` are
never called in this file.**

**Read this before writing anything**: `tests/model-answers.test.ts` already
runs all three pipelines and already asserts zero non-`info` issues on every
model answer, including `:221-235`, which walks all fifteen `LETTER_PROMPTS`
through `letterModelFor` and grades each against the prompt it was written for.
**Do not re-create that.** What it proves is that three polished, hand-written
letters and twelve generated Task 1 answers come out clean — content that was
written *to* come out clean. What is missing is different: the sixty
**adversarial** sentences, each one a shape that has actually broken a rule,
have never been run through the two pipelines that add their own rule modules
and change the shared ones' behaviour.

That gap is not theoretical. The shared modules behave differently per pipeline:
`analyzeTask1` calls `cohesionRules(doc, context, 'task1')` and
`lexicalRules(doc, context)` (`src/analysis/engine.ts:169-170`) where `context`
is synthesised by `topicContext` (`src/analysis/engine.ts:99-108`), and
`analyzeLetter` drives `lexicalRules` with a target tone. And letters are the
pipeline where this repo has now shipped false accusations **twice** — the
`gt-signoff-pairing` case in plan 009's follow-up, and the `Dear Sir and Madam`
ordering bug now pinned at `tests/letters.test.ts:211-221`.

The category sets that make a per-pipeline allowlist trivial already exist,
`src/meta.ts:116-165`:

```ts
export const TASK1_ONLY_CATEGORIES: ReadonlySet<IssueCategory>  = new Set([...])  // :116
export const TASK2_ONLY_CATEGORIES: ReadonlySet<IssueCategory>  = new Set([...])  // :128
export const LETTER_ONLY_CATEGORIES: ReadonlySet<IssueCategory> = new Set([...])  // :156
```

They are already pinned against what the pipelines actually emit by
`tests/profile-scoping.test.ts` (`src/meta.ts:113-115`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck `src/` only | `npx tsc -b --noEmit` | exit 0, no output |
| Typecheck the files this plan creates | the `TYPECHECK_NEW` command below | exit 0, no output |
| Whole suite | `npx vitest run` | `Test Files 24 passed`, `Tests 848 passed` at the baseline |
| Engine only | `npx vitest run --project engine` | all pass |
| UI only | `npx vitest run --project ui` | all pass |
| One file | `npx vitest run tests/store.test.ts` | all pass |
| UI determinism | `for i in $(seq 1 10); do npx vitest run --project ui 2>&1 \| grep -E "^ *Tests "; done` | 10 identical passing lines |
| Build | `npm run build` | exit 0 |
| Confirm src untouched | `git status --porcelain src/` | **empty output** |

### `npx tsc -b --noEmit` cannot fail on anything this plan writes — read this

`tsconfig.json` ends with `"include": ["src"]`. **`tests/` is never
typechecked**, by `tsc -b --noEmit` or by `npm run build`. Every file this plan
touches is under `tests/`, so that gate is green no matter what type errors the
new tests contain. Keep running it — it is the check that catches an accidental
edit under `src/`, which is precisely what this plan forbids — but **do not
treat it as coverage of your own work**. A done criterion that cannot fail on
the thing it is named after is the exact defect class this plan exists to
eliminate.

The real gate over the new files, run it directly (`TYPECHECK_NEW`):

```bash
npx tsc --noEmit --strict --target es2022 --module esnext \
  --moduleResolution bundler --jsx react-jsx --skipLibCheck \
  --lib es2022,dom,dom.iterable \
  tests/ui/setup.ts \
  tests/ui/report.test.tsx tests/ui/dashboard.test.tsx \
  tests/tokenize-offsets.test.ts tests/cohesion-rules.test.ts
```

Three notes on that command line:

- `tests/ui/setup.ts` is in the file list on purpose, not by accident. It carries
  `import '@testing-library/jest-dom/vitest'`, and without it every
  `toBeInTheDocument()` in a `.tsx` file reports
  `Property 'toBeInTheDocument' does not exist on type 'Assertion<HTMLElement>'`.
  Verified at `ae92bac`: the same command over `tests/ui/reading.test.tsx`
  prints 17 such errors without `setup.ts` and none with it.
- It lists **only the four files this plan creates**. `tests/store.test.ts`,
  `tests/letters.test.ts` and `tests/false-positive-corpus.test.ts` are modified
  rather than created, and `store.test.ts` is one of the six files that already
  fail this command.
- **Pre-existing type errors in other test files are out of scope.**
  `tests/` holds 29 errors across six files at `ae92bac`; fixing them and
  widening `tsconfig.json` is `plans/024-typecheck-the-tests.md`. Do not fix them
  here and do not widen `tsconfig.json` here.

## Scope

**In scope** (the only files you may modify):

- `tests/store.test.ts` (modify — 021-a)
- `tests/ui/report.test.tsx` (**create** — 021-b)
- `tests/ui/dashboard.test.tsx` (**create** — 021-b)
- `tests/tokenize-offsets.test.ts` (**create** — 021-c)
- `tests/cohesion-rules.test.ts` (**create** — 021-d)
- `tests/letters.test.ts` (modify — 021-e)
- `tests/false-positive-corpus.test.ts` (modify — 021-f)
- `plans/README.md` (status row only)

**Out of scope** (do NOT touch, even though they look related):

- **Everything under `src/`.** This plan adds coverage to code that is correct
  today. Every mutation below is applied *temporarily*, to prove a test kills
  it, and reverted in the same step. `git status --porcelain src/` must be
  empty at every step boundary and at the end.
- `package.json` — no runtime dependency may be added, and no dev dependency is
  needed. The seeded PRNG in 021-c is eight lines of inline arithmetic; a
  property-testing library is explicitly not wanted here.
- `tests/ui/renderApp.tsx` — the new component tests do not render `<App/>` and
  must not change the App render helper.
- `tests/model-answers.test.ts` — already covers all three pipelines over model
  answers; 021-f is deliberately a different corpus (see step 8).
- Rewriting or "improving" any test not named in this plan.

## Git workflow

- Branch: `advisor/021-kill-vacuous-tests`
- One commit per item (021-a … 021-f), so a single item can be reverted without
  losing the rest. Message style matches `git log`: imperative, sentence case,
  no prefix tag — e.g. `Make the backup-dedupe test able to fail`.
- Do NOT push or open a PR unless the operator instructed it.

## The mutation protocol — read once, use in every step

Each step below proves a new test kills a specific mutation. The procedure is
always the same, and it is what turns "I wrote a test" into "I wrote a test that
can fail":

1. Confirm the tree is clean under `src/`: `git status --porcelain src/` → empty.
2. Apply the single edit named in the step to the named `file:line`.
3. Run the named test file. **It must FAIL, and the failure must name the
   assertion the step predicted.** If it passes, the test does not do its job —
   fix the test, not the mutation.
4. Revert: `git checkout -- <the mutated src file>`.
5. Confirm `git status --porcelain src/` is empty again, and re-run the test
   file green.

Record, for each mutation, the assertion message that failed. Those messages go
in your final report — they are the evidence that this plan did what it claims.

## Steps

### Step 1: Establish the baseline

```bash
npx tsc -b --noEmit
npx vitest run 2>&1 | tail -5
git status --porcelain src/
```

**Verify**: typecheck exits 0; the suite reports `Test Files 24 passed` and
`Tests 848 passed`; `git status --porcelain src/` is **empty**. If the counts
differ, record the actual numbers and use them as your baseline — but if any
test *fails*, STOP.

> **The scope check is always scoped to `src/`.** A bare
> `git status --porcelain` is **not** empty at `ae92bac`: the tree carries a
> modified `plans/README.md` and ten untracked `plans/0NN-*.md` files, this plan
> among them. That is the expected baseline, not drift. Never use a bare
> `git status --porcelain` as this plan's cleanliness gate.

### Step 2 (021-a): Make the backup-dedupe test able to fail

Edit `tests/store.test.ts:829-842`. Keep the test's name and intent; give it a
clock that moves. `vi` is already imported at `:14`.

Target shape:

```ts
  it('does not mint a second backup of a payload it has already copied', () => {
    // Reads are pure, so the damaged payload is seen again on every render.
    // One backup per read would fill the quota holding the surviving essays.
    //
    // The fake clock is load-bearing, not tidiness. `backupRaw` keys each copy
    // by `new Date().toISOString()`, and three real `loadSessions()` calls
    // complete inside one millisecond — so all three keys collided and the
    // later writes overwrote the first. This test passed with the dedupe guard
    // deleted: it was measuring the resolution of the system clock, not the
    // guard. Advancing the clock between reads is what makes a second backup
    // observable, and therefore what makes this assertion mean anything.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-01T09:00:00.000Z'))
    try {
      seed(5, [
        makeSession('good', '2026-01-01T10:00:00.000Z', { task: 'task2', section: 'writing' }),
        makeSession('damaged', '2026-01-02T10:00:00.000Z', { section: 'writing', analysis: undefined }),
      ])

      loadSessions()
      vi.advanceTimersByTime(5)
      loadSessions()
      vi.advanceTimersByTime(5)
      loadSessions()

      expect(backupKeys()).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })
```

`try/finally` rather than an `afterEach`: this is the only test in the file that
fakes the clock, and leaking a frozen clock into the migration tests below it
would be a new flake of exactly the kind plan 007 removed.

**Verify (mutation)**: apply the protocol with

- mutation: `src/profile/store.ts:354` → `if (false && hasIdenticalBackup(raw)) return`
- command: `npx vitest run tests/store.test.ts`
- expected: **FAILS** with `expected [ …3 items… ] to have a length of 1 but got 3`.

Then revert and re-run: **passes**.

### Step 3 (021-b): Cover the Report's band hero and criterion tiles

Create `tests/ui/report.test.tsx`. Render `Report` **directly** — do not go
through `<App/>`. `tests/ui/renderApp.tsx:1-22` requires every test that renders
`<App/>` to use `renderApp()` because App draws a random prompt; a component
test hands `Report` a fixed session and involves no draw, so that rule does not
apply. **Say that in the file header**, or the next reader will assume the
helper was forgotten.

The fixture must give the four criteria four **different** bands, none of them
equal to the overall, so a tile printing the overall is visibly wrong:

```ts
const BAND = {
  overall: 7,
  byCriterion: { TR: 6, CC: 6.5, LR: 8, GRA: 5.5 },
  rationale: { TR: [], CC: [], LR: [], GRA: [] },
} satisfies BandEstimate
```

Build a `WritingSessionRecord` around it with `section: 'writing'`,
`task: 'task2'`, `module: 'academic'`, `mode: 'coach'`, an `essayText` of a
sentence or two, and an `analysis` whose `stats` is written out in full — use the
`session()` builder spelled out in step 4 rather than a `{…}` placeholder, because
`EssayStats` has seven required fields and an incomplete literal will not compile
once plan 024 lands: `analysis: { issues: [], paragraphs: [], structure: [], stats: STATS, band: BAND }`,
and `durationSec / pacing / pasteAttempts` all `null`. Pass
`previousSession: null` and `profile: { totalSessions: 1, categories: {}, focusCategories: [] }`
so the delta and confrontation blocks stay out of the way. Callbacks are `() => {}`.

Three tests:

1. **`prints the band range around the overall estimate, not around some other number`**
   — `document.querySelector('.rp-band-range')?.textContent` is `'6.5–7.5'`.
   (Note the en dash: it is a literal `–` in `Report.tsx:461`. Read the DOM
   rather than matching text, so the dash cannot be mistyped in the test.)
   Kills **M1**.
2. **`names the same range and the same four criterion bands in the band-scale aria-label`**
   — `screen.getByRole('img', { name: /Band scale/ })` has an accessible name of
   exactly
   `Band scale 4 to 9: estimated range 6.5 to 7.5. Task 6.0, Coherence 6.5, Vocabulary 8.0, Grammar 5.5.`
   Kills **M1** on the accessible surface, which is the one a screen-reader user
   gets.
3. **`gives each criterion tile its own band, not the overall`** —
   `Array.from(document.querySelectorAll('.rp-tile-band')).map(el => el.textContent)`
   equals `['6.0', '6.5', '8.0', '5.5']` (CRITERIA order is `TR, CC, LR, GRA`,
   `Report.tsx:15`). Kills **M2**.

**Verify (mutation)**, applying the protocol to each in turn:

| Mutation | Command | Expected |
|---|---|---|
| `Report.tsx:425` → `clampBand(analysis.band.overall + 1)` | `npx vitest run tests/ui/report.test.tsx` | FAILS tests 1 and 2 (`'7.5–8.5'`, and an aria-label reading `range 7.5 to 8.5`) |
| `Report.tsx:510` → `{formatBand(analysis.band.overall)}` | `npx vitest run tests/ui/report.test.tsx` | FAILS test 3 (`['7.0','7.0','7.0','7.0']`) |

Revert after each; `git status --porcelain src/` empty.

### Step 4 (021-b): Cover the Dashboard's two band readouts and its chart order

Create `tests/ui/dashboard.test.tsx`, same direct-render approach and the same
header note about `renderApp`.

Fixture: **three** writing sessions (the chart needs at least two,
`Dashboard.tsx:73`), given out of order in the props array so the sort is doing
real work, with distinct dates and distinct bands.

`WritingSessionRecord` has fourteen required fields (`src/types.ts:429-451`) and
`EssayStats` has seven (`src/types.ts:341-351`), none of them optional, so write
the builder out in full rather than leaning on `{…}`:

```ts
import type { WritingSessionRecord } from '../../src/types'

/**
 * One persisted writing session with a chosen band. Every field of
 * `WritingSessionRecord` is required; the ones this test does not assert on are
 * still spelled out because omitting them does not typecheck.
 */
function session(id: string, dateISO: string, overall: number): WritingSessionRecord {
  return {
    section: 'writing',
    id,
    dateISO,
    mode: 'coach',
    task: 'task2',
    // Load-bearing, not filler: the history table reads MODULE_META[s.module]
    // at Dashboard.tsx:406, and an undefined module falls through to the
    // `academic` fallback rather than throwing — which would hide a real bug.
    module: 'academic',
    promptId: null,
    promptText: 'Some people think that schools should teach practical skills.',
    questionType: 'opinion',
    essayText: 'A short body. It exists only so the record is well formed.',
    // Exam-mode-only fields; `coach` sessions persist them as null.
    durationSec: null,
    pacing: null,
    pasteAttempts: null,
    analysis: {
      issues: [],
      paragraphs: [],
      structure: [],
      // All seven EssayStats fields are required. `wordCount` is the only one
      // the Dashboard prints (the Words column, Dashboard.tsx:430); the rest
      // exist so the record typechecks.
      stats: {
        wordCount: 250,
        sentenceCount: 12,
        paragraphCount: 4,
        avgSentenceLength: 20.8,
        sentenceLengthStdDev: 4.2,
        typeTokenRatio: 0.62,
        linkingDeviceCount: 5,
      },
      band: {
        overall,
        byCriterion: { TR: overall, CC: overall, LR: overall, GRA: overall },
        rationale: { TR: [], CC: [], LR: [], GRA: [] },
      },
    },
  }
}

// Deliberately NOT in date order: `Dashboard` is responsible for sorting, and a
// fixture already sorted would pass whichever direction it sorted in.
const SESSIONS = [
  session('mid',    '2026-02-15T10:00:00.000Z', 6.5),
  session('oldest', '2026-01-05T10:00:00.000Z', 5.5),
  session('newest', '2026-03-20T10:00:00.000Z', 7.5),
]
```

`overall` is copied into all four criteria on purpose: this file is about the
*chart* and the *history table*, both of which read `band.overall` only. The
per-criterion spread that matters is asserted in `tests/ui/report.test.tsx`
(step 3).

Pass `profile: { totalSessions: 3, categories: {}, focusCategories: [] }`,
`trends: []`, and no-op callbacks.

Four tests:

1. **`labels the trend line with the newest session's band`** —
   `document.querySelector('.db-last-label')?.textContent` is `'7.5'`. Kills
   **M3**.
2. **`prints each session's own band in the history table`** — resolve the band
   column by header, then read every row:

   ```ts
   const table = screen.getByRole('table')
   const headers = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent)
   // The Words and Band cells share the class `mono db-td-num`, so a
   // class selector picks up both. Resolve the column by its heading instead.
   const bandCol = headers.indexOf('Band (est.)')
   expect(bandCol).toBeGreaterThan(-1)
   const bands = Array.from(table.querySelectorAll('tbody tr')).map(
     (row) => (row as HTMLTableRowElement).cells[bandCol].textContent,
   )
   expect(bands).toEqual(['7.5', '6.5', '5.5'])
   ```

   Kills **M4**, and kills **M5** through the row order.
3. **`orders the history newest first`** — the first row's date cell is the
   March date. (Redundant with test 2's ordering, and worth keeping separate:
   when M5 lands, one test says "the bands are wrong" and this one says "the
   order is wrong", which is the difference between a five-minute diagnosis and
   an hour's.)
4. **`plots the chart oldest to newest`** —
   `screen.getByRole('img', { name: /Overall band estimate per session/ })` has an
   accessible name that names the January date **before** the March date, and
   ends `Latest estimate: 7.5.`; and the two `.db-axis-date` labels read
   oldest-then-newest in document order. Kills **M5**.

   Dates are rendered with `toLocaleDateString(undefined, …)`
   (`Dashboard.tsx:10-19`), so the exact string depends on the runner's locale.
   **Do not hard-code a formatted date.** Compute the expected strings by calling
   the same `Intl` formatting in the test, or assert on relative order by
   locating each date's index within the aria-label string.

**Verify (mutation)**:

| Mutation | Expected |
|---|---|
| `Dashboard.tsx:135` → `{(last.band + 1).toFixed(1)}` | test 1 FAILS (`'8.5'`) |
| `Dashboard.tsx:432` → `Math.min(9, Math.max(4, band + 1)).toFixed(1)` | test 2 FAILS (`['8.5','7.5','6.5']`) |
| `Dashboard.tsx:227` → `b.dateISO.localeCompare(a.dateISO)` | tests 2, 3 and 4 FAIL |

Confirm mutation 1 does **not** also fail test 4 — that is the point of asserting
the visible `<text>` separately from the aria-label, and if it does fail, the
chart aria-label has been refactored to share the expression and this plan's
`Current state` is stale (STOP).

### Step 5 (021-c): A property test for the tokenizer's offset invariant

Create `tests/tokenize-offsets.test.ts` — engine project (Node), so the filename
must end `.test.ts` and live directly in `tests/` (`vite.config.ts:22-29`, the
`include` glob is at `:27`; `:30-38` is the *ui* project and is not what you want).

Header comment must state plainly: **the invariant holds today; this file exists
so that it keeps holding.** An adversarial sweep of 50,000 generated strings
found zero violations at `ae92bac`. This is protection, not a regression suite.

A seeded generator, inline, no dependency:

```ts
/**
 * mulberry32 — 32 bits of state, four lines, deterministic.
 *
 * A fixed seed rather than `Math.random()` on purpose: a property test that
 * draws fresh inputs every run is a flaky test that fails on somebody else's
 * machine with a string nobody can reproduce. Change SEED by hand to sweep
 * different ground, and paste the failing input into a fixed case when one is
 * ever found.
 */
const SEED = 0x5eed1e5
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
```

Build each case by concatenating 5–40 fragments drawn from a pool that targets
every branch in `tokenize`:

- ordinary words, including accented ones (`WORD_RE` covers `À-ɏ`) and
  apostrophes/hyphens (`don't`, `well-being`);
- the protected abbreviations named at `tokenize.ts:198-199` — `e.g.`, `i.e.`,
  `etc.`, `Dr.`, `Mr.`, `Mrs.`, `Ms.`, `Prof.`, `U.S.`, `U.K.`, `approx.`,
  `No.`, `vs.`;
- decimals (`3.5`, `1.25`) and bare digit runs;
- ellipses (`...`, `. . .`) and punctuation runs (`?!`, `!!!`, `.`);
- the glued-uppercase typo case (`late.He`);
- whitespace of every kind: single spaces, runs, tabs, `\n`, `\n\n`, `\n \n`,
  and trailing/leading whitespace on the whole string;
- empty and whitespace-only strings, and strings that are pure punctuation.

Run **2000** cases (budget ~80 ms; if it exceeds 500 ms, halve it and say so in
a comment). For every case assert:

| Invariant | Assertion |
|---|---|
| text returned untouched | `doc.text === input` |
| word offsets | `input.slice(w.start, w.end) === w.text` for every word |
| **sentence offsets** | `input.slice(s.start, s.end) === s.text` for every sentence |
| paragraph offsets | `input.slice(p.start, p.end) === p.text` for every paragraph |
| sentences ordered, non-overlapping | `s[i].end <= s[i+1].start` within each paragraph |
| paragraph containment | `p.start <= s.start && s.end <= p.end` for each `s` of `p.sentences` |
| paragraphs ordered, non-overlapping | `p[i].end <= p[i+1].start` |
| flat list matches the nested one | `doc.sentences` equals the concatenation of `p.sentences` in order |
| word count | `doc.wordCount === doc.words.length` |
| never throws | the whole loop runs to completion |

Every assertion must carry the offending input in its message —
`expect(actual, JSON.stringify(input)).toBe(expected)` — so a future failure is
reproducible from the test output alone without re-deriving the seed.

**Verify (mutation)**:

- mutation: `src/analysis/tokenize.ts:136` → `start: rawStart,`
- command: `npx vitest run tests/tokenize-offsets.test.ts`
- expected: **FAILS** on the sentence-offset assertion, with the generated input
  printed.

Second mutation, to prove containment is really checked:

- mutation: `src/analysis/tokenize.ts:282` → `start: r.start - 1,`
- expected: **FAILS** on the paragraph-offset assertion.

Revert both.

### Step 6 (021-d): Assert the two cohesion rules

Create `tests/cohesion-rules.test.ts`, driving the real `analyzeEssay`
(`import { analyzeEssay } from '../src/analysis/engine'`) — never
`cohesionRules` in isolation. `tests/paragraphing-gate.test.ts:9-11` states the
house reason: driving the real pipeline pins the rule *and* its interaction with
the tokenizer.

Helpers to mirror from `tests/letters.test.ts:118-124`:

```ts
function messagesFor(a: Analysis, category: IssueCategory): string[] {
  return a.issues.filter((i) => i.category === category).map((i) => i.message)
}
```

Five cases:

1. **`flags mechanical signposting when more than half the sentences open with a linker`**
   — an essay of exactly 8 sentences, 5 of them opening with a distinct linker,
   **never three in a row** (openers at sentence 1, 3, 5, 7, 8 works). Assert
   `messagesFor(a, 'linking-overuse')` contains one entry matching
   `/More than half of your sentences open with a linking word/`, and that no
   message matches `/third sentence in a row/` — so the two triggers are not
   confused. 5/8 = 0.625. Kills `> 0.5 → > 0.99`.
2. **`stays silent when under half of them do`** — 9 sentences, 4 linker-opened
   (0.444), still no three in a row. `messagesFor(a, 'linking-overuse')` is
   `[]`. This is the true-negative half: without it, case 1 passes for a rule
   that fires unconditionally.
3. **`does not judge signposting density on a draft too short to have a pattern`**
   — 7 sentences, 5 of them linker-opened (0.714, well over the ratio), no three
   in a row. `messagesFor(a, 'linking-overuse')` is `[]`. Kills `>= 8 → >= 7`
   and, with case 1, pins the floor from both sides.
4. **`asks for more signposting once the essay is long enough to need it`** — an
   essay of **exactly 200 words**, using exactly **one** distinct linking
   device. Assert `messagesFor(a, 'linking-underuse')` has length 1 and the
   message matches `/only 1 distinct linking device/`. Kills `>= 200 → >= 20000`.
   Assert `a.stats.wordCount` **is exactly `200`** (`toBe(200)`, not
   `toBeGreaterThanOrEqual`) in the test itself, so the fixture cannot silently
   drift off the gate — case 5 below is this same essay minus one word, and the
   pair is only a boundary pin if case 4 sits *on* the boundary.
5. **`stays silent one word below the gate`** — the same essay, one word shorter.
   Assert `a.stats.wordCount` is `199` and `messagesFor(a, 'linking-underuse')`
   is `[]`. Kills `>= 200 → >= 201`, and documents the boundary as behaviour
   rather than as a literal.

Building 199/200-word fixtures by hand is fiddly; generate them the way
`tests/paragraphing-gate.test.ts:31-34` does. **Read that helper before copying
it** — its behaviour is not what its own doc comment says:

```ts
function para(words: number, seed: string): string {
  const out: string[] = []
  for (let i = 0; i < words; i++) out.push(`${seed}${i}`)
  return `${out.join(' ')}.`
}
```

It emits `alpha0 alpha1 alpha2 … .` — a seed with an **index digit glued on**.
The engine's word matcher is `WORD_RE = /[A-Za-zÀ-ɏ'’-]+/g`
(`src/analysis/tokenize.ts:12`), which contains **no digit class**, so:

- **The count is exact.** `alpha0` yields exactly one match, `alpha`. Digits are
  not words and do not split a token in two, so `para(200, 'alpha')` is exactly
  200 words by `stats.wordCount` and `para(199, 'alpha')` is exactly 199. That is
  what cases 4 and 5 rest on.
- **The tokens are NOT distinct as words.** Every one of them tokenizes to the
  same string, `alpha`. The doc comment's "distinct from every other generated
  paragraph" is true of the *raw text* (which is all `paragraphing-gate` needs —
  it stops the tokenizer merging neighbours) and false of the *word stream*.

So do not repeat the claim that this helper keeps `repetition` quiet — it does
the opposite, and it drives `typeTokenRatio` to near zero as well. Two
consequences for these fixtures:

- Use **distinct seeds per paragraph** (`para(n, 'alpha')`, `para(n, 'beta')`, …)
  as `paragraphing-gate` does, and expect `repetition` and lexical issues in the
  output regardless. That is fine: `messagesFor(a, 'linking-underuse')` and
  `messagesFor(a, 'linking-overuse')` filter by category, so unrelated noise
  cannot make these assertions pass or fail. Do **not** assert on the total issue
  count.
- If you want readable failure output, make the suffix **letters instead of
  digits**, so each token is a genuinely distinct word: render `i` in base 26 as
  `a, b, … z, aa, ab, …` and push `${seed}${suffix}`. Still exactly one `WORD_RE`
  match per token, so the counts above are unchanged. Optional, not required.

Then prepend the linker sentences and re-assert the exact word count, since each
linker sentence adds words of its own.

**Verify (mutation)**:

| Mutation | Expected |
|---|---|
| `cohesion.ts:270` `> 0.5` → `> 0.99` | case 1 FAILS |
| `cohesion.ts:270` `>= 8` → `>= 800` | case 1 FAILS |
| `cohesion.ts:270` `>= 8` → `>= 7` | case 3 FAILS |
| `cohesion.ts:306` `>= 200` → `>= 20000` | case 4 FAILS |
| `cohesion.ts:306` `>= 200` → `>= 199` | case 5 FAILS |

### Step 7 (021-e): Pin the sign-off window by the two layouts either side of it

**This step does not wait for plan 015, and does not edit `src/`.**

`plans/015-letter-false-accusations-round-two.md` exists, is TODO, and rewrites
this same function: its step 2 (`plans/015-…:540-552`) replaces the walk with an
`isClosingLine`-gated version. `plans/README.md` states the relationship —
"**021 coordinates with 015 and 016** rather than depending on them … item 021-e
overlaps 015's letter fixtures — whichever lands second rebases onto the other."
That is the rule here. **021-e proceeds on the current tree**, whatever state 015
is in. Do **not** land 015 first: this plan forbids editing anything under
`src/`, absolutely, and "land 015 first" would order exactly that.

Orient yourself before writing, then proceed either way:

```bash
grep -n "signoffCandidates" src/analysis/rules/letterAchievement.ts
```

- **If `signoffCandidates` still matches the `Current state` excerpt
  (`letterAchievement.ts:593-603`)** — the `ae92bac` shape — write the two tests
  below unchanged.
- **If 015 has already landed and `signoffCandidates` has been rewritten** —
  this is **not** a STOP condition, and the mismatch does not invalidate the
  step. Re-derive the two-note fixture against the new walk and keep going. The
  expected outcome is unchanged, and it has been re-traced against 015's gated
  version: on the two-note letter the extra `!lines.slice(first).some(isClosingLine)`
  guard never fires before the width cap does, so `MAX = 4` still reaches
  `[Yours faithfully, / Daniel Whitfield / Order reference 44718 / Enclosed: receipt]`
  and `MAX = 3` still stops one line short at
  `[Daniel Whitfield / Order reference 44718 / Enclosed: receipt]`. **`4 → 3`
  still loses the closing under 015's version**, so the new test stays valid and
  the mutation pin stays honest either way. Re-run the trace yourself against
  whatever is on disk and record what you found.

Then, in `tests/letters.test.ts`, make **two separate edits**. The old test and
the new tests do not live in the same `describe` block, so this is a deletion in
one block and an insertion in another — not an in-place replacement:

**(1) DELETE `tests/letters.test.ts:755-762`.** That test sits inside
`describe('the letter constants are pinned to their documented values', …)`,
which opens at `:674` and closes at `:763`. Removing it leaves that block with
five tests and the `})` at `:763` intact. Nothing else in the block moves.

**(2) INSERT the two new tests inside
`describe('the sign-off survives a standard business tail', …)`**, which opens
at `:238` and closes at `:296`. Put them immediately after the test that ends at
`:295` (`'never mistakes a prose line that opens with a closing word'`) and
before that block's closing `})` at `:296`.

Do edit (1) first if you are counting lines by hand. The deletion is *below* the
insertion point, so removing `:755-762` leaves `:238-296` exactly where it is;
doing the insertion first would push `:755-762` down by the length of what you
inserted. Better still, locate both by their test titles rather than by number.

The two tests:

```ts
  it('finds the closing under a signature, a reference and an enclosure note', () => {
    // The WIDEST layout the window is meant to admit: closing, signature and
    // two notes is four lines, and standard business layout puts exactly this
    // under a complaint. Falling one line short of it tells a correctly
    // formatted letter, by an ERROR worth −0.5 Task Achievement, that it has no
    // sign-off — and silences the pairing check, which needs both halves.
    //
    // MUTATION PIN: SIGNOFF_TAIL_LINES_MAX 4→3. Neither existing case in this
    // block distinguishes 4 from 3; this one does.
    const text = `${letter('Dear Sir or Madam,')}\n\nOrder reference 44718\n\nEnclosed: receipt`
    const a = analyzeLetter(text, FORMAL)
    expect(categories(a)).not.toContain('gt-signoff-missing')
    expect(categories(a)).not.toContain('gt-signoff-pairing')
    expect(checkSatisfied(a, 'gt-signoff')).toBe(true)
  })

  it('stops before a fifth tail line, so a mid-letter closing is never the closing', () => {
    // The other edge, and the reason the window is capped at all: every line the
    // walk is allowed to cross is a line where a stray "Regards" or "Love" could
    // be read as the sign-off after an unnamed greeting — a gt-signoff-pairing
    // ERROR against a letter that signed off correctly. The price of the cap is
    // that a five-line tail loses its closing, and this letter pays it.
    //
    // MUTATION PIN: SIGNOFF_TAIL_LINES_MAX 4→5 and 4→99 both make this fail.
    const text = `${letter('Dear Sir or Madam,')}\n\nOrder reference 44718\n\nEnclosed: receipt\n\nPlease quote this`
    const a = analyzeLetter(text, FORMAL)
    expect(categories(a)).toContain('gt-signoff-missing')
  })
```

The titles now describe letters rather than a constant. The constant name stays
in the `MUTATION PIN` comments, where it belongs: it tells a future editor what
breaks, without the assertion itself being a restatement of a literal.

**Verify (mutation)**:

| Mutation | Expected |
|---|---|
| `letterAchievement.ts:95` `= 4` → `= 3` | the first new test FAILS (`gt-signoff-missing` present) — **this is the mutant that survives today** |
| `letterAchievement.ts:95` `= 4` → `= 5` | the second FAILS |
| `letterAchievement.ts:95` `= 4` → `= 99` | the second FAILS |
| `letterAchievement.ts:95` `= 4` → `= 2` | the existing test at `:239` FAILS (unchanged behaviour) |

If `4 → 3` does **not** fail the first new test, the trace in `Current state`
is wrong about how `signoffCandidates` counts. STOP and report the actual
window it produced — do not adjust the fixture until it goes red.

### Step 8 (021-f): Run the golden corpus through all three pipelines

Modify `tests/false-positive-corpus.test.ts`. Keep `CORPUS`, `TRUE_POSITIVES`
and the existing `analyzeEssay` blocks exactly as they are — they are the
regression record for five reproduced failures and must not move.

Add a new block below them that runs the same `CORPUS` through `analyzeLetter`
and `analyzeTask1`, filtering each pipeline's own whole-answer categories:

```ts
import { analyzeEssay, analyzeLetter, analyzeTask1 } from '../src/analysis/engine'
import { LETTER_ONLY_CATEGORIES, TASK1_ONLY_CATEGORIES, TASK2_ONLY_CATEGORIES } from '../src/meta'
import { LETTER_PROMPTS } from '../src/prompts/letterBank'
import { TASK1_PROMPTS } from '../src/prompts/task1Bank'

/**
 * The corpus above guards ONE of the three pipelines.
 *
 * `analyzeLetter` and `analyzeTask1` run the same accuracy, grammar-range,
 * lexical and cohesion modules — but not identically: Task 1 passes
 * `task: 'task1'` into `cohesionRules` and a synthesised prompt into
 * `lexicalRules`, and letters drive `lexicalRules` with a target tone. A shared
 * rule can therefore accuse correct English in one pipeline and stay quiet in
 * another, which is exactly the failure this corpus exists to prevent — and
 * letters are the pipeline that has produced false accusations twice.
 *
 * `tests/model-answers.test.ts` already runs every model answer through all
 * three pipelines. That proves polished prose written to pass does pass. This
 * proves the SIXTY SENTENCES THAT HAVE ACTUALLY BROKEN A RULE do not break one
 * here either — different evidence, deliberately.
 *
 * Each pipeline's own whole-answer categories are filtered out, because a bare
 * sentence legitimately has no greeting, no sign-off, no overview and no
 * bullets. Everything else must be silent. If a category outside the filter
 * fires, do NOT widen the filter — that is a false positive, and it belongs in
 * a fix, not in an allowlist.
 */
const PIPELINES = [
  {
    name: 'analyzeLetter (General Training Task 1)',
    analyse: (text: string) => analyzeLetter(text, LETTER_PROMPTS.find((p) => p.id === 'gt-01')!),
    structural: LETTER_ONLY_CATEGORIES,
  },
  {
    name: 'analyzeTask1 (Academic Task 1)',
    analyse: (text: string) => analyzeTask1(text, TASK1_PROMPTS.find((p) => p.id === 't1-01')!),
    structural: TASK1_ONLY_CATEGORIES,
  },
] as const
```

For each pipeline, `it.each(CORPUS)` asserting that
`analyse(sentence).issues` filtered to `severity !== 'info'` and to categories
**not** in `structural` is empty, with a readable `category: message` failure
message (reuse the shape of `describeIssues` at `:44-46`).

`TASK2_ONLY_CATEGORIES` is imported so the essay block can be expressed the same
way if you choose to unify the three; unifying is optional and **not required** —
if it costs more than twenty lines of churn in the existing block, leave the
essay block alone.

**This new block may legitimately go red on its first run.** That is a result,
not a failure of the plan. If it does:

1. Record every failing `(pipeline, sentence, category, message)` row.
2. **STOP and report.** Do not widen the filter, do not delete the sentence, do
   not touch `src/`. A shared rule accusing correct English in the letter or
   Task 1 pipeline is a real defect of the same class as plan 006's five, and
   fixing it needs its own plan with its own guards and true-positive pins.
3. Then, without waiting to be asked: **commit steps 2–7 (021-a … 021-e) as
   they stand, and do not commit the new cross-pipeline block.** There is no
   operator to consult mid-run, so the rule is fixed rather than discretionary.
   Concretely — keep the block on disk, mark only the failing entries with
   `it.skip` **and a comment naming the failing category, the sentence, and this
   plan**, so the skip is a record rather than a hiding place; commit that as
   021-f with a message that says the block is quarantined; and put the full
   `(pipeline, sentence, category, message)` table in your final report as the
   headline finding. A skipped case with the defect written beside it is
   evidence. A silently widened filter is not.

**Verify (green path)**: `npx vitest run tests/false-positive-corpus.test.ts` →
all pass, with roughly `2 × CORPUS.length` new cases.

**Verify (mutation)**: the block must be able to fail, and the mutation has to
be a **span-level** rule. Corpus entries are bare sentences, so every
whole-answer rule is dormant by construction — `linking-underuse`, for one, only
evaluates above 200 words (`cohesion.ts:306`), so breaking its Task 1 carve-out
at `cohesion.ts:326` would prove nothing.

**The prescribed edit** — one word, in the article rule's crossable-verb set.
`accuracy.ts` is 40 kB and its line numbers move, so locate it by pattern, not by
number:

```bash
grep -n "const WALK_CROSSABLE_VERBS = new Set(\[" src/analysis/rules/accuracy.ts
grep -n "'reduce', 'reduces', 'reducing'" src/analysis/rules/accuracy.ts
```

At `ae92bac` those return `:413` and `:414`. Delete the single token `'reduce',`
from the first line of that set (leave `'reduces'` and `'reducing'`), then run
the file. Revert with `git checkout -- src/analysis/rules/accuracy.ts`.

Why that one word, traced over corpus entry
`tests/false-positive-corpus.test.ts:93`,
`Governments must act to reduce crime in the largest cities of the world.`:

- `crime` is in `COUNTABLE` (`:315-321`), so it is an article candidate.
- The leftward walk (`articles`, `:508-`) crosses `reduce`, then stops flagged at
  the preposition `to` (`WALK_PREPOSITIONS`, `:333-338`).
- The flag is then suppressed by the **mass-sense escape**:
  `if (MASS_SENSE.has(noun.lower) && (stoppedAtVerb || crossedVerb)) continue`.
  `crime` is in `MASS_SENSE` (`:401`) and `crossedVerb` is true **only because
  `isVerbToken` (`:446-450`) finds `reduce` in `WALK_CROSSABLE_VERBS`**.
  `stoppedAtVerb` is false here — the walk stopped at a preposition — and `to` is
  deliberately excluded from `VERB_ONLY_AFTER` (`:437-440`), so
  `WALK_CROSSABLE_VERBS` is the *sole* thing holding this sentence quiet.
- Remove `'reduce'` and `crossedVerb` goes false, the escape is skipped, and the
  rule raises a `warning`-severity `article` issue reading
  `'crime' is a singular countable noun and needs a determiner — write 'a reduce crime' or 'the reduce crime'.`
  `article` is not `info` and is in none of the `*_ONLY_CATEGORIES` sets, so it
  passes both filters and the new block goes red.

Two things to expect and not be alarmed by: the **existing** `analyzeEssay`
corpus block goes red on the same sentence (that is the point — the same
sentence, three pipelines), and corpus entry `:95`
(`Strict laws help reduce crime…`) stays green, because there the walk hits its
`MAX_MODIFIER_WALK` cap before flagging anything.

Confirm the new block goes red on the letter **and** the Task 1 case, revert, and
record both failure messages in your report. If the prescribed edit does not go
red — the rule has been refactored since `ae92bac` — say so, try one of the other
four guards named in `TRUE_POSITIVES`
(`tests/false-positive-corpus.test.ts:222-255`), and if none works in fifteen
minutes, report that and move on. The block's value does not depend on this, but
its **ability to fail** does, and an unproven guard is what this whole plan is
about.

**This mutation is exempt from the mutation-reporting done criterion.** It is
exploratory — the target is chosen by reading, not fixed by the plan — and
unlike the mutations in steps 2–7 it is allowed to come back empty. Report it
narratively instead: the edit you used, whether it went red, and on which cases.

### Step 9: Full verification

```bash
npx tsc -b --noEmit
npx tsc --noEmit --strict --target es2022 --module esnext \
  --moduleResolution bundler --jsx react-jsx --skipLibCheck \
  --lib es2022,dom,dom.iterable \
  tests/ui/setup.ts \
  tests/ui/report.test.tsx tests/ui/dashboard.test.tsx \
  tests/tokenize-offsets.test.ts tests/cohesion-rules.test.ts
npx vitest run
npm run build
git status --porcelain src/
for i in $(seq 1 10); do npx vitest run --project ui 2>&1 | grep -E "^ *Tests "; done
```

**Verify**: both typechecks exit 0 with no output — the first proving `src/` is
untouched, the second proving the four new files actually compile (see
"`npx tsc -b --noEmit` cannot fail on anything this plan writes" above); the
whole suite passes with a test count of at least **848 + 20**; the build exits 0;
`git status --porcelain src/` is **empty**; the ten UI runs print ten identical
lines.

## Test plan

New and changed tests, by file:

| File | Status | Cases | Kills |
|---|---|---|---|
| `tests/store.test.ts` | modify 1 test | — | `store.ts:354` dedupe guard |
| `tests/ui/report.test.tsx` | create | 3 | `Report.tsx:425`, `Report.tsx:510` |
| `tests/ui/dashboard.test.tsx` | create | 4 | `Dashboard.tsx:135`, `:432`, `:227` |
| `tests/tokenize-offsets.test.ts` | create | 1 property test, 2000 inputs | `tokenize.ts:136`, `:282` |
| `tests/cohesion-rules.test.ts` | create | 5 | `cohesion.ts:270` (×3 mutations), `:306` (×2) |
| `tests/letters.test.ts` | replace 1 with 2 | +1 net | `letterAchievement.ts:95` (4→3, 4→5, 4→99) |
| `tests/false-positive-corpus.test.ts` | add 1 block | ~2 × 60 | shared-rule false positives in two pipelines |

Structural patterns to follow:

- Engine tests: `tests/paragraphing-gate.test.ts` — real pipeline, helper to
  filter issues by category, a header comment naming the failure being prevented.
- Component tests: there is no existing exemplar; `tests/ui/reading.test.tsx`
  is the closest for Testing Library idiom (`screen`, `within`, `waitFor`,
  `document.querySelector` for class-scoped readouts).
- Every new test file gets a header comment explaining **what breaks if this
  file is deleted**, in the voice of `tests/false-positive-corpus.test.ts:1-33`.

Verification: `npx vitest run` → all pass, ≥ 868 tests.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc -b --noEmit` exits 0 — this only proves nothing under `src/` was
      edited; `tsconfig.json` is `"include": ["src"]`, so it cannot fail on any
      file this plan writes
- [ ] `TYPECHECK_NEW` (the standalone `tsc` over the four new files plus
      `tests/ui/setup.ts`, in "Commands you will need") exits 0 with no output —
      this is the gate that *can* fail on your work. Pre-existing errors in other
      `tests/` files are out of scope; they belong to `plans/024-*.md`
- [ ] `npx vitest run` exits 0 with `Test Files 28 passed` (24 + 4 new) and at least 868 tests
- [ ] `npm run build` exits 0
- [ ] `git status --porcelain src/` is **empty** — no source file was modified
- [ ] `git status --porcelain package.json package-lock.json` is empty — no dependency added
- [ ] All four new files exist: `test -f tests/ui/report.test.tsx -a -f tests/ui/dashboard.test.tsx -a -f tests/tokenize-offsets.test.ts -a -f tests/cohesion-rules.test.ts`
- [ ] `grep -c "SIGNOFF_TAIL_LINES_MAX = 4" tests/letters.test.ts` returns 0 — the test title no longer restates the literal
- [ ] `grep -c "analyzeLetter\|analyzeTask1" tests/false-positive-corpus.test.ts` returns ≥ 2
- [ ] Ten consecutive `npx vitest run --project ui` print ten identical `Tests` lines
- [ ] Your report lists, **for every mutation named in the Verify tables of
      steps 2–7**, the assertion message that failed. Do not count them — work
      down the tables. Step 8's mutation is **excluded**: it is exploratory, its
      target is chosen by reading rather than fixed by the plan, and it is
      allowed to come back empty (report it narratively instead)
- [ ] No files outside the Scope list are modified:
      `git status --porcelain -- src/ package.json package-lock.json tsconfig.json vite.config.ts`
      is empty. A modified `plans/README.md` and untracked `plans/0NN-*.md` files
      are the expected baseline, not drift
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at any `file:line` in "Current state" does not match the excerpt —
  the codebase has drifted since this plan was written. **One documented
  exception**: `signoffCandidates` (`letterAchievement.ts:593-603`) is expected
  to change if `plans/015-*.md` lands first. That is not drift and not a STOP;
  step 7 tells you what to do with it.
- The baseline in step 1 is not 848 passing tests **and** any test fails.
- **A mutation you apply does not make the intended new test fail.** That means
  the test does not cover what the step claims, and writing a different
  assertion is a judgement call this plan cannot make for you: report which
  mutation stayed green and what the new test asserted.
- **`4 → 3` on `SIGNOFF_TAIL_LINES_MAX` does not fail the new two-note test** —
  the trace in 021-e is then wrong and the fixture may be wrong too.
- **Any new case in step 8's cross-pipeline block fails.** That is a live false
  positive against correct English. Report it; do not fix it here, and do not
  widen the allowlist to make it green. Step 8's numbered fallback tells you
  exactly what to commit before you stop.
- A step appears to require editing anything under `src/`. Nothing in this plan
  does, permanently. If you believe a source fix is needed, that is a finding —
  report it as one. **This overrides every other instruction in this plan**: if
  any step ever reads as "land plan N first" or "fix the rule and continue", it
  is wrong and this line wins.

**Not** a STOP condition, despite looking like one:

- `plans/015-letter-false-accusations-round-two.md` existing, being TODO, and
  rewriting `signoffCandidates`. All three are true at `ae92bac` and the plan is
  written to work either way — 021 and 015 coordinate rather than depend, and
  whichever lands second rebases onto the other. See step 7.

## Maintenance notes

For the human or agent who owns this code next:

- **Mutation is the standing acceptance check for any test whose name contains a
  guarantee.** If a test is called "does not X", "never Y", "keeps Z tight", or
  cites a constant, it is claiming that removing a specific piece of code makes
  it fail. **Prove it once, at the time of writing**: break the line the test
  is named after, watch it go red, put the line back. Then record the edit in a
  `// MUTATION PIN:` comment beside the assertion — `tests/letters.test.ts`
  already uses that convention in five places and it is the right one. A test
  written this way costs about ninety seconds more and is the only kind that
  cannot join the three vacuous tests this repo has produced so far.
- **Timing-dependent assertions are the specific trap here.** The backup test
  was vacuous because two events that "obviously" differ shared a millisecond.
  Anything keyed by `Date.now()` or `toISOString()` — backup keys, session ids,
  `dateISO` ordering — needs fake timers before it can assert about ordering or
  cardinality.
- **What a reviewer should scrutinise in this PR**: that `git diff` touches no
  file under `src/`; that each new test file's header says what breaks without
  it; and that a recorded result is in the PR body for every mutation named in
  the Verify tables of steps 2–7 (step 8's exploratory mutation is reported
  narratively). A green suite is not the evidence — the recorded failures are.
- **`tests/ui/report.test.tsx` and `tests/ui/dashboard.test.tsx` render
  components directly, which is new for this repo.** Every other UI test drives
  `<App/>` through `renderApp()`. Keep the distinction sharp: a test that
  renders `<App/>` must still use `renderApp()`, because App's random prompt
  draw is what plan 007 spent a day removing. If either new file ever grows an
  `<App/>` render, it moves to `renderApp()` with it.
- **`plans/README.md` lists "Report.tsx (719 lines) and Dashboard.tsx (466) have
  no component tests" under Known limitations.** After this plan, that line is
  half true — the band readouts are covered and nothing else is. Update it to
  say exactly that rather than deleting it; the untested surface (confrontations,
  inline highlighting, the delta block, the sparklines, export/import) is still
  most of both files.
- **Deferred out of this plan, deliberately**: component coverage for
  `Report`'s inline-highlight segmentation (`buildSegments`, `:71-`) and the
  position-consistency side-by-side (`:400-412`); a mutation sweep of the
  remaining rule modules; and any fix for whatever step 8 turns up. Each is its
  own plan.
