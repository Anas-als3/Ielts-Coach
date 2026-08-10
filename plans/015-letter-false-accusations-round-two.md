# Plan 015: Stop the letter rules accusing correct English — round two

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. Do NOT edit `plans/README.md`; the reviewer who
> dispatched you maintains the index.
>
> **Drift check (run first)**:
> `git diff --stat ae92bac..HEAD -- src/analysis/rules/letterAchievement.ts src/analysis/rules/lexical.ts src/analysis/letterBandEstimate.ts tests/letters.test.ts SPEC.md`
> If any file quoted in "Current state" changed since this plan was written,
> compare the excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition. Every line number below was read off `ae92bac`.

## Status

- **Priority**: **P0** — the engine tells learners their correct letters are wrong
- **Effort**: M (1 day)
- **Risk**: MED — touches the pairing matrix and the tone system, both calibrated; one fix deliberately reverses a documented SPEC decision (015-c) and one deliberately trades a true positive away (015-e)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `ae92bac`, 2026-08-10

## Why this matters

**`src/analysis/rules/accuracy.ts:11` says a false positive costs more than a
miss, and SPEC.md repeats it. The letter rules are breaking that rule in five
places, and four of the five were introduced by the commit that fixed the
previous round (`6011dee`).**

Every row below was reproduced through the real `analyzeLetter` pipeline on
2026-08-10 at `ae92bac`. The input is correct, natural English at the register
the task asked for. The output is what the app says about it:

| Learner writes (correct) | App says | Measured cost |
|---|---|---|
| `…offer me.` / `Best wishes to you.` / `Yours faithfully,` / `Daniel Whitfield` | **error** `gt-signoff-pairing`: "'Best wishes' does not go with 'Dear Sir or Madam'" | TR **8.0 → 7.0** |
| `Dear Mr Hughes and Mrs Hughes,` | **error** `gt-salutation-missing`: "Start with a greeting on its own line." | TA −0.5, and the greeting then counts as bullet coverage |
| `Dear Mr Hughes and Anna,` | same **error** | same |
| `Dear Anna, Tom and Sam,` | read as `Dear Anna,` — **warning** `gt-salutation-tone` **and error** `gt-signoff-pairing` | TA −1.0 |
| `can't` in a formal letter | **error** `contraction` **and** **warning** `gt-tone-mismatch`, same span `[545,550]` | one mistake shown as two, charged twice |
| `guys` in a formal letter | **warning** `gt-tone-mismatch` **and** **warning** `informal-register`, same span `[700,704]` | same |
| `No problem, however, has arisen with the delivery.` | **warning** `gt-tone-mismatch`: "'No problem' is too informal" | LR register count +1 |
| `No problem; the refund was issued in full.` | same **warning** | same |

And one **false negative** — a true positive the same commit silenced:

| Learner writes (a formal letter with no purpose statement) | App says |
|---|---|
| `When I bought a washing machine from your Bridge Street branch last month I wanted to have a reliable appliance in the kitchen. …` | nothing. `gt-purpose-missing` is silent and the rail's `gt-purpose` check ticks **green** |

The duplicate messages in rows 5 and 6 are also **wrong-genre**: inside a General
Training letter the app says "Contractions are not used in **academic writing**"
and "'guys' is informal — use 'people' or 'individuals'", advice written for a
Task 2 essay the learner was not asked to produce.

This is one plan and not five because the five fixes share one calibration: the
three worked letters in `src/answers/letterModels.ts` are graded by the app's own
engine in `tests/model-answers.test.ts`, and every fix moves the numbers those
tests pin. Fixing them one at a time means recalibrating five times.

## Current state

Read each cited line before changing it. Line numbers are from `ae92bac`.

### 015-a — the sign-off window walks backwards into the body (CONFIRMED)

`src/analysis/rules/letterAchievement.ts:593-603`:

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

`src/analysis/rules/letterAchievement.ts:612-618`:

```ts
function matchSignoff(lines: Line[], salutation: FoundSalutation | null): FoundSignoff | null {
  const candidates = signoffCandidates(lines)
  for (const line of candidates) {
    // The greeting is never also the sign-off. In a two-line draft ("Dear Anna,"
    // / "…") the greeting would otherwise fall inside the search window.
    if (salutation && line.start <= salutation.start && line.end >= salutation.end) continue
```

The window is the last 2 non-empty lines, extended backwards across any line of
≤ 4 words (`SIGNOFF_TAIL_WORDS_MAX`, `:101`), and `matchSignoff` returns the
**first** match walking **forward**. A short BODY line qualifies for the
extension, and once it is in the window it outranks the real closing below it.

`SPEC.md:643-644` states the opposite guarantee, in as many words:

> The extension is gated on line LENGTH rather than on line count alone: the walk
> stops dead at the first paragraph, so however many lines the cap allows, the
> window can never reach into the body.

That guarantee does not hold. It is true only of lines of ≥ 5 words.

**Reproduced.** A formal letter ending:

```
…which of these two options you are able to offer me.

Best wishes to you.

Yours faithfully,

Daniel Whitfield
```

emits `error gt-signoff-pairing` with `excerpt: "Best wishes"`, `[848,859]`.
Removing the `Best wishes to you.` line makes the letter clean. Measured
TR **8.0 → 7.0** (−0.5 for the pairing error, −0.5 lost from the
all-structure-checks-satisfied reward).

Second consequence, also reproduced: `readLetterParts` (`:653`) sets

```ts
  const bodyEnd = signoff ? Math.max(bodyStart, signoff.start) : doc.text.length
```

so `bodyEnd` is cut at the FALSE closing and everything below it leaves the body.
Measured on a letter ending `Best wishes to you.` / `Refund or replacement
please.` / `Yours faithfully,` / `Daniel Whitfield`: the dropped tail was
`"Best wishes to you.\n\nRefund or replacement please.\n\nYours faithfully,\n\nDaniel Whitfield"` —
so the learner's `Refund or replacement please.` stops counting toward bullet
coverage, and `gt-bullet-uncovered` is an ERROR that caps Task Achievement at 5.5.

**Why the existing guard test missed it.** `tests/letters.test.ts:268-283`
(`'never mistakes a mid-letter closing word for the closing'`) builds its decoy
by inserting `Regards to your delivery team.` **between paragraphs 3 and 4**, so
a full paragraph separates the decoy from the closing and the walk stops on it.
Verified: on that fixture `readLetterParts(...).signoff.text === 'Yours faithfully'`.
The new test must put the decoy **ADJACENT** to the closing block.

### 015-b — `I wanted to` silences `gt-purpose-missing` at every tone (CONFIRMED)

`src/analysis/rules/letterAchievement.ts:293-314` — the last five entries were
added by `6011dee` to the SHARED list:

```ts
const PURPOSE_MARKERS: readonly string[] = [
  'i am writing to',
  …
  'i am contacting you',
  'i wanted to',          // :309
  'i just wanted to',     // :310
  'i thought i would',    // :311
  "i thought i'd",        // :312
  'i thought i’d',        // :313
]
```

`:350-351` and `:721-724`:

```ts
const PURPOSE_RE = purposeRe(PURPOSE_MARKERS)
const INFORMAL_PURPOSE_RE = purposeRe([...PURPOSE_MARKERS, ...INFORMAL_PURPOSE_MARKERS])
…
export function hasPurposeStatement(parts: LetterParts, tone?: LetterTone): boolean {
  const re = tone === 'informal' ? INFORMAL_PURPOSE_RE : PURPOSE_RE
  return re.test(openingText(parts))
}
```

`purposeRe` (`:346-348`) builds an **unanchored** alternation, and
`openingText` (`:706-712`) hands it the first `PURPOSE_SCAN_WORDS` = 60 words of
the body — so any of the five matches anywhere in the opening, in any position in
a sentence.

**Verified two ways.** Calling `hasPurposeStatement(parts, 'formal')` directly:

```
hasPurposeStatement(formal)=true   "When I bought a washing machine last month I wanted to have …"
hasPurposeStatement(formal)=true   "I am writing to complain about a washing machine."
hasPurposeStatement(formal)=false  "Last month a washing machine arrived at my flat and it broke …"
```

And through `analyzeLetter` on a 147-word formal letter (clear of the 100-word
gate at `:52`): the version opening
`When I bought a washing machine from your Bridge Street branch last month I wanted to have a reliable appliance in the kitchen.`
raises **no** `gt-purpose-missing` and the rail's `gt-purpose` check
(`src/analysis/rules/letterStructure.ts:127-134`) reports `satisfied = true`. The
control sentence with `my family hoped for` in place of `I wanted to` raises the
warning and the check is `false`.

**The fix must not undo the reason those markers were added.** `SPEC.md:663-667`
records it: `OVERFORMAL_MARKERS` (`letterAchievement.ts:439`) tells an informal
writer to replace `I am writing to express` with **"I wanted to tell you"** —

```ts
  { re: /\bi am writing to express\b/gi, fix: "write 'I wanted to tell you'" },
```

— and a learner who obeyed one rule was then warned by another for obeying it.
`OVERFORMAL_MARKERS` only ever runs for `tone === 'informal'` (`:868`), so both
the informal-list fix and the sentence-anchoring fix preserve that. Two rules
must never point in opposite directions.

### 015-c — one mistake, two issues, in a letter (CONFIRMED)

The "one mistake, one issue" policy was applied to `!` only.
`src/analysis/rules/lexical.ts:249-255` and `:291`:

```ts
function registerIssues(doc: TokenizedDoc, issues: Issue[], tone?: LetterTone): void {
  // `tone` is supplied ONLY by `analyzeLetter`, so its mere presence — at ANY
  // register — is the signal "this answer is a letter, not an essay". Three
  // clauses below stand down on it, …
  const isLetter = tone !== undefined
…
  if (!isLetter) {           // :291 — the exclamation clause
```

But `contractionIssues` stands down only for `informal` — `lexical.ts:128-134`:

```ts
function contractionIssues(doc: TokenizedDoc, issues: Issue[], tone?: LetterTone): void {
  // Contractions are CORRECT at informal register. An informal General Training
  // letter is the one place in IELTS Writing where "I can't wait to see you" is
  // right, and flagging it would mark a correct answer down. Every other caller
  // passes no tone and reaches the unchanged code below.
  if (tone === 'informal') return
```

and two `REGISTER_LEXICON` entries never stand down at all —
`lexical.ts:192-196` (`re: /\b(?:gonna|wanna)\b/gi`) and `:197-200`
(`re: /\bguys\b/gi`).

All three spans are ALSO covered by `FORMAL_VIOLATION_MARKERS` in
`letterAchievement.ts:392-396`:

```ts
const FORMAL_VIOLATION_MARKERS: readonly { re: RegExp; fix: string }[] = [
  { re: CONTRACTION_RE, fix: 'write the full form' },
  { re: /\b(?:hey|yo)\b/gi, fix: "start with 'Dear …'" },
  { re: /\b(?:guys|mate|mates|folks|buddy|pal)\b/gi, fix: "name the reader properly, or write 'colleagues'" },
  { re: /\b(?:wanna|gonna|gotta|kinda|sorta)\b/gi, fix: 'write it out in full' },
```

and `src/analysis/letterBandEstimate.ts:219` sums all three categories into ONE
register total:

```ts
  const registerCount = count(issues, 'informal-register') + count(issues, 'contraction') + toneCount
```

**Reproduced on one formal letter (gt-01)** — each mistake drew two issues on one
span, the second written about academic essays:

```
error   contraction        [545,550] "can't"  Contractions are not used in academic writing — write the full form: can't → cannot.
warning gt-tone-mismatch   [545,550] "can't"  'can't' is too informal for a formal letter to the manager of the store — write the full form.
warning informal-register  [700,704] "guys"   'guys' is informal — use 'people' or 'individuals'.
warning gt-tone-mismatch   [700,704] "guys"   'guys' is too informal for a formal letter … name the reader properly, or write 'colleagues'.
warning informal-register  [605,610] "gonna"  'gonna' is spoken English — write 'going to'.
warning gt-tone-mismatch   [605,610] "gonna"  'gonna' is too informal for a formal letter … write it out in full.
```

**This fix changes a severity, and that is a deliberate decision the plan is
making.** Standing `contractionIssues` down for every letter tone means a
contraction in a FORMAL letter becomes `warning gt-tone-mismatch` only, where it
is currently `error contraction` as well. That is the same trade `!` already
took (`SPEC.md:768-779`), and `gt-tone-mismatch` is the rule that knows which
register THIS letter is being marked against. It reverses `SPEC.md:682-684`,
which currently calls the overlap deliberate — that SPEC text must be rewritten,
not left to contradict the code. Measured band effect on the reproduced letter:
LR stays **8.0** either way (`gt-tone-mismatch` is itself an LR warning, so
`isClean(issues,'LR')` is false in both worlds); no letter estimator reads
`hasError` on an LR category (`letterBandEstimate.ts` calls `hasError` only for
`gt-word-count` at `:72` and `paragraphing` at `:145`).

`tests/letters.test.ts:306-311` asserts the current behaviour and must be
rewritten as part of this step:

```ts
  it('flags a contraction in a formal letter', () => {
    const a = analyzeLetter(letter('Dear Sir or Madam,', WITH_CONTRACTION), FORMAL)
    expect(categories(a)).toContain('gt-tone-mismatch')
    // The shared contraction rule still applies at this register too.
    expect(categories(a)).toContain('contraction')
  })
```

### 015-d — the two-name greeting table covers 2 of 4 shapes (CONFIRMED)

`6011dee` added two rows — `letterAchievement.ts:182-192` (two titles sharing a
surname) and `:200-210` (two bare given names). Measured behaviour of all four
shapes, through `analyzeLetter` with gt-01 (formal, unnamed expected):

| First line | Greeting found | `bodyStart` | Issues raised |
|---|---|---|---|
| `Dear Mr and Mrs Hughes,` | `named-formal` | 23 | (correct) |
| `Dear Anna and Tom,` | `named-informal` | 18 | (correct) |
| `Dear Mr Hughes and Mrs Hughes,` | **NONE** | **0** | `gt-salutation-missing`, `paragraph-balance` |
| `Dear Mr Hughes and Anna,` | **NONE** | **0** | `gt-salutation-missing`, `paragraph-balance` |
| `Dear Mr Hughes and Mrs Patel,` | **NONE** | **0** | `gt-salutation-missing`, `paragraph-balance` |
| `Dear Dr Ali and Dr Chen,` | **NONE** | **0** | `gt-salutation-missing`, `paragraph-balance` |
| `Dear Anna, Tom and Sam,` | `Dear + first name` (wrong) | 10 | `gt-salutation-tone`, `gt-signoff-pairing` |

`bodyStart` comes from `readLetterParts:652`:

```ts
  const bodyStart = salutation ? salutation.end : 0
```

so an unrecognised greeting leaves the greeting text INSIDE `bodyText` — exactly
what the module documents itself as guarding against (`:650-651`: "A name in the
greeting is not bullet coverage"). **Reproduced with a trap prompt** whose
bullet-3 keywords are `['hughes','mrs']`, both present only in the greeting:
with `Dear Mr Hughes and Mrs Hughes,` the letter draws **no**
`gt-bullet-uncovered`; with the recognised `Dear Mr and Mrs Hughes,` it correctly
draws one.

`Dear Anna, Tom and Sam,` fails for a second, independent reason —
`salutationCandidates:543-554` puts the **comma-clipped** candidate FIRST:

```ts
function salutationCandidates(line: Line): Line[] {
  const out: Line[] = [line]
  const comma = line.text.indexOf(',')
  if (comma > 0 && comma < SALUTATION_COMMA_WINDOW && comma < line.text.length - 1) {
    out.unshift({
      text: line.text.slice(0, comma + 1),
      start: line.start,
      end: line.start + comma + 1,
    })
  }
  return out
}
```

so `Dear Anna,` matches the bare-name row before the whole line is ever tried.

The ordering constraint that must survive — `letterAchievement.ts:164-174`:

```ts
  {
    // "Dear Sir and Madam" — the `and` variant of the row above. It sits here,
    // ABOVE the two-name rows, because "Sir" and "Madam" are not names: read as
    // `named-*` it would license "Yours sincerely" and reject the "Yours
    // faithfully" this greeting actually calls for, turning a correct letter
    // into a `gt-signoff-pairing` ERROR.
    re: /^dear\s+sirs?\s+and\s+madams?[,.:!]?$/i,
    kind: 'unnamed',
```

### 015-e — `no problem` still fires on the noun-phrase reading (CONFIRMED)

`src/analysis/rules/letterAchievement.ts:414`:

```ts
    re: /(?<=^|[.!?]["'”’)\]]?\s)no problem(?=\s*[,.!?;:—–-]|$)/gim,
```

The lookahead admits `,` and `;`, and both readings survive them. Measured
`gt-tone-mismatch` hits inside a gt-01 letter:

| Sentence appended to the body | Flagged? |
|---|---|
| `No problem, however, has arisen with the delivery.` | **yes** — false accusation |
| `No problem; the refund was issued in full.` | **yes** — false accusation |
| `No problem, I will arrange it.` | yes — true positive |
| `No problem. I will arrange it.` | yes — true positive |
| `That will be no problem for me.` | no |
| `No problem has arisen with the replacement.` | no |

The module's own stated bias, `letterAchievement.ts:669-673`:

> The bias is deliberate: a prefix match occasionally counts a word the learner
> did not quite mean, and the cost of that is silence. The opposite error … tells
> someone who answered the task correctly that they failed it, which is the
> single worst thing this app can output.

**This fix trades a true positive away, and there is no narrower guard
available.** Narrowing the lookahead to `[.!?]|$` was prototyped against all six
sentences above and produces exactly the right first two columns — but it also
silences `No problem, I will arrange it.`, which is genuine slang. Telling
`No problem, however, has arisen` apart from `No problem, I will arrange it`
needs to know whether what follows the comma opens a new clause, and the module's
own comment (`:406-408`) rejects word lists for this reading because "the set of
words that may legitimately surround the noun-phrase reading is open-ended and a
word list would never be complete". A false negative here costs nothing; a false
accusation costs trust.

`tests/letters.test.ts:377-388` currently pins the comma form as a true positive
and must be moved to a full stop as part of this step:

```ts
  it("still flags 'No problem' as an interjection, with the same message", () => {
    const body = FORMAL_BODY.replace(
      'I would be grateful if you could confirm',
      'No problem, I will collect the replacement myself. I would be grateful if you could confirm',
    )
```

### Repo conventions you must match

- **React 18 + TypeScript strict, Vite, pure client-side, `localStorage` only,
  deterministic rule analysis. No LLM, no server, no network.** Runtime
  dependencies are exactly `react` and `react-dom`; adding one is out of scope.
- **`IssueCategory` ids are FROZEN** — append only, never rename or reorder.
  Nothing in this plan needs a new one.
- **`Criterion` stays four members.**
- **Comments explain WHY** — the failure mode prevented, not what the line does.
  Every guard in `letterAchievement.ts` and `lexical.ts` names the false positive
  it exists for. Match that exactly; a guard with no such comment will be
  re-broken by the next person.
- **Fix a false positive by ADDING a row, never by weakening the rule** —
  `letterAchievement.ts:116-119` states this for the salutation/sign-off table.
- **Word lists and regexes are module-level constants** with a doc comment naming
  the SPEC rule they implement.
- **A false accusation is the worst output this app can produce**
  (`src/analysis/rules/accuracy.ts:11`, and SPEC.md).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npx tsc -b --noEmit` | exit 0, no output |
| Full suite | `npx vitest run` | **848 passed / 24 files** at `ae92bac`; more after this plan |
| Letters only | `npx vitest run tests/letters.test.ts` | all pass |
| Worked answers | `npx vitest run tests/model-answers.test.ts` | all pass |
| Engine project | `npx vitest run --project engine` | all pass |
| UI project | `npx vitest run --project ui` | all pass |
| Build | `npm run build` | exit 0 |

**UI determinism**: every UI test must render through `renderApp()` from
`tests/ui/renderApp.tsx` — never `render(<App />)`, which draws a random prompt.
If you touch any UI test, run `npx vitest run --project ui` **ten consecutive
times** and confirm identical results.

## Scope

**In scope** (the only files you may modify):

- `src/analysis/rules/letterAchievement.ts` — 015-a, 015-b, 015-d, 015-e
- `src/analysis/rules/lexical.ts` — 015-c only, and only the two stand-downs named in step 5
- `tests/letters.test.ts` — new cases, plus the two existing assertions named in steps 5 and 7
- `SPEC.md` — record every change; it is canonical and must not be left contradicting the code

**Out of scope** (do NOT touch, even though they look related):

- `src/analysis/letterBandEstimate.ts` — do **not** retune deductions to
  compensate for issues that stop firing. Fix the detection; the scores follow.
- `src/analysis/rules/accuracy.ts`, `grammarRange.ts`, `cohesion.ts` — shared with
  Task 2 and Academic Task 1; nothing here needs them.
- `src/analysis/engine.ts` — `analyzeEssay` and `analyzeTask1` must stay
  byte-identical, and `analyzeLetter` needs no change.
- `src/answers/letterModels.ts` — see step 8: if a fix moves a worked letter, fix
  the LETTER, never the rule. Only touch it if step 8 forces you to, and report it.
- `src/prompts/letterBank.ts` — bullet keywords are not the problem here.
- `src/types.ts`, `src/meta.ts` — `IssueCategory` is frozen and no member is needed.
- `plans/README.md` — the reviewer owns the index.

## Git workflow

- Branch: `advisor/015-letter-false-accusations-round-two`, off `main`.
- **One commit per lettered fix** (015-a … 015-e), so each can be reverted
  independently. Message style matches `git log`: a plain imperative sentence,
  e.g. `Stop the sign-off window walking past the real closing`.
- Do NOT push and do NOT open a PR.

## Steps

### Step 1: Write the failing tests FIRST

Add five `describe` blocks to `tests/letters.test.ts`, **before changing any
rule**. The file's existing fixtures (`FORMAL`, `FORMAL_BODY`, `letter()`,
`categories()`, `messagesFor()`, `checkSatisfied()`, all defined at the top) are
what you build on — read `tests/letters.test.ts:32-120` first. Every case drives
the real `analyzeLetter`, never a rule module in isolation, exactly as the rest
of the file does.

Each test needs a comment saying **which false accusation it prevents** — the
file is written that way throughout (see `:240-244`, `:286-289`, `:363-365`).

1. **015-a**: a formal gt-01 letter whose last body line is `Best wishes to you.`
   sitting **immediately above** `Yours faithfully,` / `Daniel Whitfield`.
   Assert `categories(a)` does **not** contain `gt-signoff-pairing`, and that
   `a.structure.find(c => c.id === 'gt-signoff')?.detail` contains
   `'Yours faithfully'`.
2. **015-b**: `hasPurposeStatement` reached through `analyzeLetter`. A ≥ 150-word
   formal gt-01 letter opening
   `When I bought a washing machine from your Bridge Street branch last month I wanted to have a reliable appliance in the kitchen.`
   must raise `gt-purpose-missing` and leave `gt-purpose` unsatisfied.
3. **015-c**: `can't`, `guys` and `gonna` each in a separate formal gt-01 letter.
   For each, assert exactly ONE non-`info` issue carries that excerpt, and that
   its category is `gt-tone-mismatch`. Model this on the existing
   `onTheBang` assertion at `tests/letters.test.ts:458-463`.
4. **015-d**: the four shapes `Dear Mr Hughes and Mrs Hughes,`,
   `Dear Mr Hughes and Anna,`, `Dear Dr Ali and Dr Chen,`, `Dear Anna, Tom and Sam,`.
   For the first three (formal gt-01, `Yours faithfully`): no
   `gt-salutation-missing`, no `gt-salutation-tone`, no `gt-signoff-pairing`. For
   `Dear Anna, Tom and Sam,` use an **informal** prompt (gt-11) with
   `Best wishes`: no `gt-salutation-tone`, no `gt-signoff-pairing`.
5. **015-e**: `No problem, however, has arisen with the delivery.` and
   `No problem; the refund was issued in full.` appended to `FORMAL_BODY` — both
   must produce `messagesFor(a, 'gt-tone-mismatch') === []`.

**Verify**: `npx vitest run tests/letters.test.ts` → **at least 5 new failures**,
one per block. If any of the five passes now, the fixture is not reproducing the
bug — fix the fixture before touching a rule.

### Step 2: 015-a — stop the window extending past a closing it has already reached

In `src/analysis/rules/letterAchievement.ts`, extract the two conditions
`matchSignoff` already applies (a `SIGNOFF_FORMS` match, and
`wordsIn(trailing) <= SIGNOFF_TRAILING_WORDS_MAX`) into one module-level
predicate, and use it in BOTH places so the window and the matcher cannot
disagree about what a closing line is:

```ts
/**
 * Is this line a closing line — a SIGNOFF_FORM at its start with, at most, a
 * name after it?
 *
 * Shared by the window and the matcher on purpose. When only `matchSignoff`
 * knew what a closing looked like, `signoffCandidates` happily extended the
 * window PAST one, and the first match walking forward was then a short body
 * line above the real sign-off: "Best wishes to you." two lines above "Yours
 * faithfully," raised gt-signoff-pairing — an ERROR, −0.5 TA — against a letter
 * that had closed perfectly correctly.
 */
function isClosingLine(line: Line): SignoffForm | null
```

Then gate the extension on it:

```ts
function signoffCandidates(lines: Line[]): Line[] {
  let first = Math.max(0, lines.length - SIGNOFF_TAIL_LINES_MIN)
  // Stop as soon as the window CONTAINS a closing. Extending past one is what
  // let a short body line outrank the real sign-off; the reference/enclosure
  // tail this extension exists for always sits BELOW the closing, never above.
  while (
    first > 0 &&
    !lines.slice(first).some((l) => isClosingLine(l) !== null) &&
    lines.length - first < SIGNOFF_TAIL_LINES_MAX &&
    wordsIn(lines[first - 1].text) <= SIGNOFF_TAIL_WORDS_MAX
  ) {
    first -= 1
  }
  return lines.slice(first)
}
```

`matchSignoff` keeps its forward walk and its greeting guard (`:615-617`)
unchanged — with the window fixed, forward-first is correct, and nothing that
resolves correctly today changes hands.

Do **not** reverse the walk in `matchSignoff` instead. Reversing introduces its
own failure mode: a letter ending `Yours faithfully,` / `Daniel Whitfield` /
`Best regards to the team` would then resolve to `Best regards`.

**Verify**: `npx vitest run tests/letters.test.ts` → the 015-a case passes AND
all four existing sign-off window tests (`tests/letters.test.ts:238-296`) still
pass, including `'finds the closing above a reference line'` and
`'still reports a genuinely missing sign-off'`.

**Verify the fix has teeth (mutation pin)**: temporarily raise
`SIGNOFF_TAIL_WORDS_MAX` (`:101`) from 4 to 400 and confirm your new 015-a test
**still passes** (the closing-line gate, not the word gate, is now what stops the
walk) while `'never mistakes a mid-letter closing word for the closing'` fails.
Restore the constant. Report both observations.

### Step 3: 015-b — anchor the five late-added purpose markers to a sentence start

Split the five markers added by `6011dee` out of `PURPOSE_MARKERS` into their own
list, matched **only at a sentence start**. Do not anchor the original fifteen —
`In this letter I am writing to complain` is a legitimate mid-sentence purpose
statement and anchoring all of them would create a new false negative.

```ts
/**
 * Purpose markers accepted only at a SENTENCE START.
 *
 * These say "why I am writing" when they open a sentence — "I wanted to enquire
 * about the charge on my statement" — and say nothing at all in the middle of
 * one: "When I bought a washing machine last month I wanted to have a reliable
 * appliance" is a narrative clause, and an unanchored substring match read it as
 * a stated purpose, silenced gt-purpose-missing and ticked the rail's gt-purpose
 * check GREEN on a formal letter that never says why it exists.
 *
 * They stay accepted (rather than moving to the informal list) because
 * OVERFORMAL_MARKERS tells an informal writer to replace "I am writing to
 * express" with exactly "I wanted to tell you" — two rules must never point in
 * opposite directions.
 */
const SENTENCE_INITIAL_PURPOSE_MARKERS: readonly string[] = [
  'i wanted to',
  'i just wanted to',
  'i thought i would',
  "i thought i'd",
  'i thought i’d',
]

const SENTENCE_INITIAL_PURPOSE_RE = new RegExp(
  `(?:^|[.!?]["'”’)\\]]?\\s|\\n\\s*)(?:${SENTENCE_INITIAL_PURPOSE_MARKERS.map(escapeRegExp).join('|')})`,
  'i',
)
```

`hasPurposeStatement` then tests the anchored list in addition to the tone's
unanchored list. Keep the existing `tone === 'informal'` widening exactly as it is.

This regex shape was prototyped against six sentences and gives the right answer
on all six (`I wanted to enquire…` ✓, `I just wanted to tell you my news.` after
a greeting ✓, `Hello. I thought I would write…` ✓, `…last month I wanted to
have…` ✗, `…so I thought I would collect it.` ✗).

**Verify**: `npx vitest run tests/letters.test.ts` → the 015-b case passes; every
existing purpose test still passes.

### Step 4: 015-e — narrow the `no problem` lookahead

Drop `,` and `;` (and the dashes and `:`, which have the same noun-phrase
problem) from the lookahead at `:414`, keeping the sentence-final readings:

```ts
    re: /(?<=^|[.!?]["'”’)\]]?\s)no problem(?=\s*[.!?]|$)/gim,
```

Extend the comment above it to record the trade explicitly: the interjection
followed by a COMMA (`No problem, I will arrange it.`) is now silent, because
nothing available here separates it from the noun phrase (`No problem, however,
has arisen`), and a false negative costs nothing where a false accusation costs
trust.

Then rewrite the existing true-positive test at `tests/letters.test.ts:377-388`
to use a full stop — `'No problem. I will collect the replacement myself.'` —
keeping the same expected message verbatim.

**Verify**: `npx vitest run tests/letters.test.ts` → the 015-e case passes; the
rewritten `'still flags No problem as an interjection'` passes with an unchanged
message; `'leaves that will be no problem alone in a formal letter'`
(`:362-375`) passes untouched.

### Step 5: 015-c — let `gt-tone-mismatch` own the spans it already covers

Two changes in `src/analysis/rules/lexical.ts`, both narrow.

**5a.** Widen the `contractionIssues` guard from `informal` to every letter tone:

```ts
  // STAND-DOWN — contractions, for EVERY letter tone. Two directions, both wrong
  // to report here:
  //  - INFORMAL: "I can't wait to see you" is correct English at that register.
  //  - FORMAL / SEMI-FORMAL: it really is wrong, and `gt-tone-mismatch` already
  //    says so — inline, on the SAME span, with the SAME fix ("write the full
  //    form"), and naming the register THIS letter must hold. Both firing showed
  //    one mistake as two in the panel and charged it twice to the LR register
  //    count, which sums `informal-register`, `contraction` and
  //    `gt-tone-mismatch` (letterBandEstimate.ts:219). This message is also
  //    about ACADEMIC writing, a genre the learner was not asked to produce.
  //    The severity drops from error to warning-only inside a letter; that is
  //    the same trade '!' already took, and it is recorded in SPEC.md.
  if (tone !== undefined) return
```

**5b.** Give `RegisterEntry` a second opt-out flag beside the existing
`addressesReader` (`lexical.ts:164-173`), and set it on the two entries whose
spans `FORMAL_VIOLATION_MARKERS` already covers:

```ts
  /**
   * Marks an entry whose span `gt-tone-mismatch` also covers in a letter
   * (`letterAchievement.ts` FORMAL_VIOLATION_MARKERS carries `guys` and
   * `gonna`/`wanna`). One mistake, one issue — see the tone guard in
   * `registerIssues`.
   */
  ownedByToneRule?: true
```

set on `/\b(?:gonna|wanna)\b/gi` (`:192-196`) and `/\bguys\b/gi` (`:197-200`),
and skipped in the `REGISTER_LEXICON` loop next to the existing
`if (entry.addressesReader && isLetter) continue` at `:265`.

Do **not** flag any other entry. `kids`, `stuff`, `ok`, `really`, `totally`,
`basically`, `huge`, `etc`, `and so on`, `kind of`, the `get + adjective` clause
and the `big + abstract noun` clause have no counterpart in
`FORMAL_VIOLATION_MARKERS` and must keep firing in letters — they are genuine
Lexical Resource faults at every register.

**Then rewrite `tests/letters.test.ts:306-311`**: `contraction` must now be
ABSENT from a formal letter, and `gt-tone-mismatch` present with its message
unchanged. Keep the two regression tests at `:783-796` exactly as they are —
they assert `analyzeEssay` and `analyzeTask1` still report contractions and
second-person address, and they are the only thing standing between this guard
and a leak into Task 2.

**Verify**: `npx vitest run tests/letters.test.ts` → the 015-c case passes;
`npx vitest run --project engine` → everything else passes.

### Step 6: 015-d — one generalised multi-name greeting, in two rows

Replace the two narrow rows at `letterAchievement.ts:182-192` and `:200-210` with
two generalised rows built from shared fragments. Two rows and not one, because
the `kind` decides the licensed closings and the acceptable tones, and a titled
reader is not an informally-named one:

```ts
/** Optional title plus one or two name tokens: "Mr Hughes", "Anna", "Anna Petrova". */
const NAME_TOKEN = "[a-zà-ÿ][a-zà-ÿ'’-]*"
const TITLE = '(?:mr|mrs|ms|miss|dr|prof|professor)\\.?'
const PLAIN_PART = `${NAME_TOKEN}(?:\\s+${NAME_TOKEN})?`
const TITLED_PART = `(?:${TITLE}\\s+)?${PLAIN_PART}`
```

- **Titled list** → `kind: 'named-formal'`, `tones: ['formal','semi-formal']`,
  `label: 'Dear Mr/Ms + surname'`. Requires at least one title anywhere in the
  list (a lookahead does this), so `Dear Mr Hughes and Anna,` reads as formal —
  the conservative direction, since a title present means at least semi-formal.
- **Plain list** → `kind: 'named-informal'`, `tones: ['semi-formal','informal']`,
  `label: 'Dear + first name'`.

Both use the shape
`^dear\s+<PART>(?:\s*,\s*<PART>)*\s+and\s+<PART>[,.:!]?$`, so two, three or more
readers all match.

**Ordering is load-bearing.** Both new rows go BELOW the five unnamed rows
(`:140-174`) and below the two single-reader rows — titled at `:175-181`, bare
name at `:193-199`. Verified with the
prototype: `Dear Sir and Madam,` and `Dear Sirs and Madams,` DO match the titled
generalised pattern, so if the `unnamed` row at `:164-174` were not above them
the greeting would read as a pair of names, license "Yours sincerely" and reject
the "Yours faithfully" it actually calls for — turning a correct letter into a
`gt-signoff-pairing` ERROR. Put that reason in the comment.

**Also fix the candidate order** in `salutationCandidates` (`:543-554`): return
the WHOLE line first and the comma-clipped candidate second (`push`, not
`unshift`). Every `SALUTATION_FORMS` pattern is `$`-anchored, so a run-on line
(`Dear Sir or Madam, I am writing to complain…`) still cannot match whole and
still falls through to the clipped candidate — the run-on guard at `:532-542` is
untouched. The only behaviour that changes is the case where BOTH match, which is
exactly `Dear Anna, Tom and Sam,`, where the whole line is the right answer.
Record the reason in the doc comment.

The prototype classified all seventeen probe strings correctly, including the
negatives `I am writing to complain and I would like a refund,` and
`Dear team and thank you for the quick reply,` (neither matches).

**Verify**: `npx vitest run tests/letters.test.ts` → the 015-d cases pass; every
existing greeting test passes, in particular the `Dear Sir and Madam` /
`Yours faithfully` pairing and the run-on-line greeting.

### Step 7: One mistake, one issue — pin it as an invariant

Add one test to `tests/letters.test.ts` that no two non-`info` issues in a letter
share a span. Build a formal gt-01 letter containing `can't`, `guys`, `gonna`,
`!` and `No problem.` all at once, then assert that grouping the issues by
`` `${i.start},${i.end}` `` yields no group of size > 1 for any span where
`start !== null`. This is the invariant steps 4 and 5 restore, and it is what
stops the next marker being added to both lists.

**Verify**: `npx vitest run tests/letters.test.ts` → passes. Then confirm it has
teeth: temporarily revert the 5b flag on `guys` and check this test **fails**.
Restore, and report the observation.

### Step 8: Prove nothing else moved

Three separate invariants, all machine-checkable.

**8a — the worked letters.** `tests/model-answers.test.ts:173-213` grades all
three hand-written letters with the app's own engine: zero errors or warnings,
every structure check satisfied, band ≥ 8.0, 160–220 words. Measured at
`ae92bac`: gt-01 **8.5**, gt-07 **8.5**, gt-11 **8.0** — note gt-11 sits exactly
on the boundary, so any regression there fails immediately. If a fix moves one of
them, **fix the LETTER, not the rule**, and say so in your report.

**8b — the other two pipelines.** `analyzeEssay` and `analyzeTask1` must be
provably unchanged. `git diff main -- src/analysis/engine.ts` must be empty, and
the only shared module you touched is `lexical.ts`, whose new branches are both
behind `tone !== undefined` — a value only `analyzeLetter` supplies.
`tests/letters.test.ts:783-796` pins this directly.

**8c — the band estimator.** `src/analysis/letterBandEstimate.ts` must be
untouched. Confirm with `git diff --stat main -- src/analysis/letterBandEstimate.ts`
returning nothing.

**Verify**:
- `npx vitest run tests/model-answers.test.ts` → all pass
- `git diff --stat main -- src/analysis/engine.ts src/analysis/letterBandEstimate.ts src/analysis/rules/accuracy.ts src/analysis/rules/grammarRange.ts` → empty
- `npx vitest run` → all pass

### Step 9: SPEC.md

SPEC.md is canonical and currently contradicts what you have just built in four
places. Update each:

1. **`SPEC.md:634-645`** — the sign-off window. The sentence "the walk stops dead
   at the first paragraph, so however many lines the cap allows, the window can
   never reach into the body" is FALSE as written; replace it with the real
   guarantee (the walk stops at the first line that is itself a closing) and name
   the false accusation it prevents.
2. **`SPEC.md:658-667`** — `gt-purpose-missing`. Record that `I wanted to` and its
   four neighbours are matched only at a sentence start, and why (the mid-sentence
   narrative reading silenced a true positive and ticked the rail green).
3. **`SPEC.md:676-698` and `SPEC.md:741-784`** — the `lexical.ts` tone guard.
   It says FOUR clauses stand down; it is now five, counting `guys`/`gonna` as one
   with `contraction`. Rewrite `SPEC.md:682-684` ("The overlap with `contraction`
   in a formal letter is DELIBERATE") — it no longer is, and the severity change
   (error → warning-only inside a letter) must be stated explicitly. Update the
   `no problem` paragraph at `:693-698` to record the comma reading as a
   deliberate false negative.
4. **`SPEC.md:608-622`** — the greeting kinds. Record the generalised multi-name
   rows, the titled/plain split and why, the ordering constraint against
   `Dear Sir and Madam`, and the whole-line-before-clipped candidate order.

**Verify**: `grep -n "walk stops dead" SPEC.md` → no matches.

### Step 10: Full green

**Verify**: `npx tsc -b --noEmit` → exit 0.
**Verify**: `npx vitest run` → all pass, 848 + your new tests.
**Verify**: `npm run build` → exit 0.
**Verify**: `npx vitest run --project ui` ten consecutive times → identical results.

## Test plan

All new tests go in `tests/letters.test.ts` and drive the real `analyzeLetter`.
Model them on the existing blocks: `:238-296` for window behaviour, `:433-476`
for one-mistake-one-issue, `:362-388` for the `no problem` pair.

| Block | Cases | Kind |
|---|---|---|
| 015-a sign-off window | short body line adjacent to the closing; the existing reference-tail case; the existing mid-letter decoy; a genuinely missing sign-off | 1 new false-positive + 3 existing regressions |
| 015-b purpose | mid-sentence `I wanted to` in a formal letter FIRES; sentence-initial `I wanted to` in a formal letter is silent; informal markers still accepted | 1 new true-positive + 2 guards |
| 015-c one issue per span | `can't`, `guys`, `gonna` each exactly one issue, category `gt-tone-mismatch`; `analyzeEssay` and `analyzeTask1` still report `contraction` | 3 new + 2 existing regressions |
| 015-d greetings | 4 previously-broken shapes clean; `Dear Sir and Madam` still `unnamed` and still pairs with `Yours faithfully`; run-on greeting still recognised | 4 new + 2 guards |
| 015-e `no problem` | comma and semicolon readings silent; full-stop reading still fires with the same message; the three noun-phrase cases still silent | 2 new + 4 existing |
| span uniqueness | no two non-`info` issues share a span in one letter | 1 new invariant |

**Every fix needs a test that FAILS at step 1 and passes after its step.** Every
true positive must still fire **with an unchanged message** — assert the message
string, not just the category, exactly as `:355-359` and `:461-463` do.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc -b --noEmit` exits 0
- [ ] `npx vitest run` exits 0; ≥ 848 tests pass; the new cases all pass
- [ ] `npm run build` exits 0
- [ ] `npx vitest run --project ui` produces identical results across 10 consecutive runs
- [ ] Each of the five reproduced failures is clean, verified individually
- [ ] Each corresponding true positive still fires with an unchanged message
- [ ] The step 2 and step 7 mutation checks were run and both observations reported
- [ ] `git diff --stat main -- src/analysis/engine.ts src/analysis/letterBandEstimate.ts src/analysis/rules/accuracy.ts src/analysis/rules/grammarRange.ts` is empty
- [ ] `git status --porcelain -- . ':!plans/'` shows no file modified outside the in-scope
      list (exclude `plans/` — the baseline tree already carries a modified `plans/README.md`
      and ten untracked `plans/0NN-*.md` files, so a bare `git status` is never clean)
- [ ] The three worked letters still score ≥ 8.0 with zero errors and warnings
- [ ] `grep -n "walk stops dead" SPEC.md` returns nothing
- [ ] `grep -c "gt-" src/types.ts` is unchanged from `ae92bac` (no new `IssueCategory`)

## STOP conditions

Stop and report back (do not improvise) if:

- Any excerpt in "Current state" does not match the live file.
- A guard cannot be written without gutting the rule it guards. Report which,
  with the conflicting cases — **downgrading a rule to `info`, or disabling it,
  is an acceptable outcome and better than leaving a wrong accusation live.**
- Any worked letter in `src/answers/letterModels.ts` drops below 8.0 or gains an
  error or warning. Report the exact before/after bands and the driving
  deductions. gt-11 is at exactly 8.0 and has the least headroom. **Fix the
  letter, never the rule** — loosening a threshold so the app's own example
  passes is teaching to the test.
- `analyzeEssay` or `analyzeTask1` output changes for any fixed input. That means
  the `lexical.ts` tone guard leaked; revert step 5 and report.
- Step 1's five blocks do not all fail before any fix. The fixtures are then
  wrong, not the rules.
- You conclude the fix needs a new `IssueCategory`, a fifth `Criterion`, a change
  to `letterBandEstimate.ts`, or a new runtime dependency. None of those is true;
  report what led you there.
- You find a sixth false-accusation class in the letter rules. Add it to
  `tests/letters.test.ts` as a failing test, report it, and **ask before
  expanding scope**.

## Maintenance notes

For whoever owns this code next:

- **Round two happened because round one had no invariant.** `6011dee` fixed
  eight false accusations and introduced four more, all in the same file, because
  each fix was pinned by a test written around that fix. The span-uniqueness test
  from step 7 is the first assertion in the letter suite that constrains the rules
  as a SET rather than one at a time; treat it as the deliverable and add to it.
- **Two rules must never cover the same span.** `FORMAL_VIOLATION_MARKERS` in
  `letterAchievement.ts` and `REGISTER_LEXICON` in `lexical.ts` overlap by
  construction — one is a letter register list, the other an essay register list,
  and they are drawn from the same vocabulary. Any marker added to one must be
  checked against the other, and `gt-tone-mismatch` wins inside a letter because
  it is the only rule that knows which register this letter is marked against.
- **The window fix depends on `isClosingLine` being shared.** If a future change
  gives `matchSignoff` a third acceptance condition, `signoffCandidates` must get
  it too or the two will disagree again — that disagreement IS bug 015-a.
- **015-e is a deliberate false negative.** `No problem, I will arrange it.` is
  now silent. If someone later wants it back, the only honest route is clause
  detection after the comma, not re-adding `,` to the lookahead.
- **`Dear Anna, Tom and Sam, I am writing…` as one run-on line is still wrong**
  — the clipped candidate `Dear Anna,` wins there because the whole line cannot
  match. It is a formatting habit stacked on a three-reader greeting, and fixing
  it means clipping at the LAST comma inside the window rather than the first,
  which risks the ordinary run-on case. Left deliberately.
- **What a reviewer should scrutinise**: that each guard is narrow (it suppresses
  the false positive and nothing else); that every true-positive test still
  asserts the exact message string; that step 5's stand-downs cannot reach
  `analyzeEssay`; and that the `Dear Sir and Madam` row is still ABOVE the
  generalised rows in `SALUTATION_FORMS`.
