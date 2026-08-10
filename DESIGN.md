# IELTS Coach — Design Direction

**Subject**: a focused writing desk for one learner practising IELTS Academic Writing Task 2.
**Audience**: a serious self-studying adult targeting Band 7+. No teacher exists; the app is the examiner's eye.
**The page's single job**: a distraction-free answer sheet that teaches essay structure and confronts the learner's recurring errors.

## Aesthetic: institutional exam stationery, examiner's marking semantics

Cool paper white, blue-black ink. **Examiner red is reserved exclusively for errors** — it is semantic,
never decorative. Amber for warnings, a dry green for satisfied checks. The essay column is the hero:
a clean answer-sheet surface with a faint ruled baseline, set in a bookish serif (you are writing an
academic essay; it should read like set text). UI chrome is quiet system sans. Timer, word count and
band digits are tabular monospace — instrument readouts, not decoration.

**Signature element — the Structure Rail**: a vertical essay-anatomy spine beside the editor that
draws itself in as the essay takes shape (Introduction → position stated · Body 1 → topic sentence ·
… → Conclusion). Nodes fill from hollow to solid as checks are satisfied.

**Signature moment — clearing the desk**: switching to Exam Mode slides every panel away and drops
the chrome to near-monochrome navy; only the sheet and the countdown remain. One orchestrated
transition (~400ms), disabled under `prefers-reduced-motion`.

## Tokens (in `src/index.css`)

Palette:
- `--paper: #F4F6F3` — app background, cool off-white
- `--sheet: #FDFDFB` — editor/answer-sheet surface
- `--ink: #1C2536` — blue-black ink, primary text
- `--ink-soft: #5A6478` — secondary text
- `--rule-line: #E2E6DF` — hairlines, ruled baselines
- `--marking-red: #B5372A` — errors ONLY (examiner's pen)
- `--marking-amber: #96690D` — warnings
- `--ok-green: #2F6B45` — satisfied checks
- `--exam-navy: #24344D` — exam mode chrome, primary buttons
- Washes for inline highlights: `--wash-red: rgba(181,55,42,.14)`, `--wash-amber: rgba(150,105,13,.16)`, `--wash-blue: rgba(36,52,77,.10)`

Type:
- Essay & display: `--font-serif: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif`
- UI: `--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- Readouts: `--font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace` (use `font-variant-numeric: tabular-nums`)

Layout (Coach Mode): three zones — Structure Rail (left, 220px) · essay sheet (center, max 68ch) ·
feedback panel (right, 320px). Exam Mode: centered sheet only. Radius 6px, shadows barely-there
(`0 1px 3px rgba(28,37,54,.08)`). Quality floor: keyboard focus always visible, responsive to
~900px (panels stack) and no sideways scrolling at any width, reduced motion respected.

## State is never carried by colour alone

The navy fill marks the live tab, the chosen exam, the current section. None of it reaches a
learner using a screen reader, so every one of those states is also stated in the accessibility
tree — WCAG 2.1 4.1.2, Level A. Three rules, and a new control picks one of them:

- **Segmented toggles** (`.mode-btn` inside a `role="group"`) carry `aria-pressed`. They act the
  instant they are pressed rather than holding a value for a form, and each stays its own tab stop;
  that is a toggle button, not a radio group.
- **Tab strips** are the whole ARIA pattern or none of it: each `role="tab"` has an `id` and an
  `aria-controls` naming a `role="tabpanel"` that carries `aria-labelledby` back. Only the chosen
  tab's content is mounted, so there is ONE panel element whose label follows the selection. The
  strip is one tab stop with a roving `tabindex`; ←/→/Home/End move within it and focus follows.
- **Navigation** takes `aria-current="page"`. It moves the learner; it is not a pressed state.

Copy voice: plain verbs, sentence case, specific ("Your position is missing from the introduction —
state your opinion in one sentence"), never scolding, never vague. Errors explain the fix.
