/**
 * Writing templates (plans 033, 034, 035): the bank's own shape, and
 * `templatesFor`'s filtering.
 *
 * The bank must keep pace with the prompt bank — every `QuestionType` gets
 * exactly 2 templates, every `LetterTone` exactly 1, and Academic Task 1 gets
 * exactly 2 chart-kind-agnostic ones. A new question type or tone with no
 * matching template fails these counts, on purpose (see `bank.ts`'s
 * maintenance note).
 *
 * Plan 035 rebuilt every section as ONE flowing paragraph skeleton (a
 * `frame`) plus a filled worked version (an `example`) of that same
 * paragraph. The filled-frame checker below (`normalise` + `fixedWindows`)
 * is what proves an `example` really is the `frame`, filled — not unrelated
 * prose on the same topic.
 */
import { describe, expect, it } from 'vitest'
import { templatesFor, WRITING_TEMPLATES } from '../src/templates/bank'
import type { LetterTone, QuestionType } from '../src/types'

const QUESTION_TYPES: QuestionType[] = [
  'opinion',
  'discussion',
  'problem-solution',
  'advantages-disadvantages',
  'double-question',
]

const LETTER_TONES: LetterTone[] = ['formal', 'semi-formal', 'informal']

describe('the bank', () => {
  it('has fifteen templates with unique ids', () => {
    expect(WRITING_TEMPLATES).toHaveLength(15)
    const ids = WRITING_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(QUESTION_TYPES)('has exactly 2 task2 templates for %s', (type) => {
    const matching = WRITING_TEMPLATES.filter((t) => t.kind === 'task2' && t.questionTypes?.includes(type))
    expect(matching).toHaveLength(2)
  })

  it.each(LETTER_TONES)('has exactly 1 letter template for %s', (tone) => {
    const matching = WRITING_TEMPLATES.filter((t) => t.kind === 'letter' && t.tones?.includes(tone))
    expect(matching).toHaveLength(1)
  })

  it('has exactly 2 chart templates', () => {
    expect(WRITING_TEMPLATES.filter((t) => t.kind === 'chart')).toHaveLength(2)
  })

  it('every template has at least 3 paragraphs, each with a non-empty title and guidance', () => {
    for (const t of WRITING_TEMPLATES) {
      expect(t.paragraphs.length).toBeGreaterThanOrEqual(3)
      for (const p of t.paragraphs) {
        expect(p.title.trim().length).toBeGreaterThan(0)
        expect(p.guidance.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('a task2 template never carries tones, a letter never carries questionTypes', () => {
    for (const t of WRITING_TEMPLATES) {
      if (t.kind === 'task2') expect(t.tones).toBeUndefined()
      if (t.kind === 'letter') expect(t.questionTypes).toBeUndefined()
    }
  })

  it('every template has a non-empty, trimmed exampleTopic', () => {
    for (const t of WRITING_TEMPLATES) {
      expect(t.exampleTopic.trim()).toBe(t.exampleTopic)
      expect(t.exampleTopic.length).toBeGreaterThan(0)
    }
  })

  it('every letter template keeps exactly 4 paragraphs (sign-off folds into the last)', () => {
    for (const t of WRITING_TEMPLATES.filter((t) => t.kind === 'letter')) {
      expect(t.paragraphs).toHaveLength(4)
    }
  })
})

// Every section is now ONE flowing paragraph skeleton (`frame`) plus a
// filled worked version of the same paragraph (`example`), naming the
// template and section on failure via `it.each`.
const ALL_SECTIONS = WRITING_TEMPLATES.flatMap((t) =>
  t.paragraphs.map((p) => ({ templateId: t.id, title: p.title, frame: p.frame, example: p.example })),
)

describe('every section', () => {
  it.each(ALL_SECTIONS)('$templateId → "$title": the frame is a non-empty, trimmed string with at least 1 slot', ({ frame }) => {
    expect(frame.trim()).toBe(frame)
    expect(frame.length).toBeGreaterThan(0)
    expect(frame).toMatch(/\[[^\][]+\]/)
  })

  it.each(ALL_SECTIONS)('$templateId → "$title": the example is a non-empty, trimmed string', ({ example }) => {
    expect(example.trim()).toBe(example)
    expect(example.length).toBeGreaterThan(0)
  })

  // Brackets balance: stripping every well-formed `[slot]` (one or more
  // non-bracket characters) must leave no bracket behind. That catches
  // nesting (`[outer [inner]]`), an unmatched bracket, and an empty slot
  // (`[]`, which the strip regex cannot match) all in the same assertion.
  it.each(ALL_SECTIONS)('$templateId → "$title": the slots in the frame are balanced, unnested and non-empty', ({ frame }) => {
    const stripped = frame.replace(/\[[^[\]]+\]/g, '')
    expect(stripped).not.toContain('[')
    expect(stripped).not.toContain(']')
  })

  it.each(ALL_SECTIONS)('$templateId → "$title": the example carries no brackets — every slot is filled', ({ example }) => {
    expect(example).not.toContain('[')
    expect(example).not.toContain(']')
  })
})

/* -------------------------------- the filled-frame checker -------------------------------- */

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

describe('the filled-frame checker', () => {
  it.each(ALL_SECTIONS)('$templateId → "$title": the example is the filled frame', ({ frame, example }) => {
    const haystack = normalise(example)
    for (const window of fixedWindows(frame)) {
      expect(haystack, `fixed prose "${window}" missing from the example`).toContain(window)
    }
  })
})

/* -------------------------------- engine agreement: task 2 -------------------------------- */

// keep in sync with EXAMPLE_MARKERS in src/analysis/rules/structure.ts
const EXAMPLE_MARKERS: readonly string[] = [
  'a clear example of this is',
  'one illustration of this is',
  'to take one example',
  'consider the case of',
  'this can be seen in',
  'take the case of',
  'a case in point is',
  'for example',
  'for instance',
  'such as',
]
const EXAMPLE_MARKER_RE = new RegExp('\\b(' + EXAMPLE_MARKERS.join('|') + ')\\b', 'i')

const CONCLUSION_SIGNAL_RE = /^(in conclusion|to conclude|to sum up|in summary|overall|on balance)\b/i

describe('engine agreement: task2 structure', () => {
  const task2Templates = WRITING_TEMPLATES.filter((t) => t.kind === 'task2')

  it.each(
    task2Templates.flatMap((t) =>
      t.paragraphs.slice(1, -1).map((p) => ({ templateId: t.id, title: p.title, frame: p.frame, example: p.example })),
    ),
  )('$templateId → "$title": body carries an engine-recognised example marker in both frame and example', ({ frame, example }) => {
    expect(frame, 'frame missing an EXAMPLE_MARKERS phrase').toMatch(EXAMPLE_MARKER_RE)
    expect(example, 'example missing an EXAMPLE_MARKERS phrase').toMatch(EXAMPLE_MARKER_RE)
  })

  it.each(
    task2Templates.map((t) => {
      const last = t.paragraphs[t.paragraphs.length - 1]
      return { templateId: t.id, title: last.title, frame: last.frame, example: last.example }
    }),
  )('$templateId → "$title": conclusion opens with an engine-recognised conclusion signal, in both frame and example', ({ frame, example }) => {
    expect(frame, 'frame does not open with a conclusion signal').toMatch(CONCLUSION_SIGNAL_RE)
    expect(example, 'example does not open with a conclusion signal').toMatch(CONCLUSION_SIGNAL_RE)
  })
})

/* -------------------------------- engine agreement: task 1 charts --------------------------- */

const FIGURE_RE = /\d|%|\bpercent\b/i

describe('engine agreement: chart overview and figures', () => {
  const chartTemplates = WRITING_TEMPLATES.filter((t) => t.kind === 'chart')

  it.each(
    chartTemplates.map((t) => {
      const overview = t.paragraphs.find((p) => p.title === 'Overview')!
      return { templateId: t.id, title: overview.title, frame: overview.frame, example: overview.example }
    }),
  )('$templateId → "$title": starts with "Overall," and carries no figure, in both frame and example', ({ frame, example }) => {
    expect(frame).toMatch(/^Overall,/)
    expect(example).toMatch(/^Overall,/)
    expect(frame).not.toMatch(FIGURE_RE)
    expect(example).not.toMatch(FIGURE_RE)
  })

  it.each(
    chartTemplates.map((t) => ({ templateId: t.id, paragraphs: t.paragraphs.slice(-2) })),
  )('$templateId → last two sections: the examples quote figures', ({ paragraphs }) => {
    for (const p of paragraphs) {
      expect(p.example, `${p.title} has no digit`).toMatch(/\d/)
    }
  })
})

/* -------------------------------- engine agreement: letters ---------------------------------- */

// keep in sync with FORMAL_CONTRACTIONS in src/analysis/rules/letterAchievement.ts
const FORMAL_CONTRACTIONS: readonly string[] = [
  "can't", "cannot've", "don't", "doesn't", "didn't", "won't", "wouldn't", "shouldn't",
  "couldn't", "isn't", "aren't", "wasn't", "weren't", "hasn't", "haven't", "hadn't",
  "i'm", "i've", "i'll", "i'd", "you're", "you've", "you'll", "you'd",
  "we're", "we've", "we'll", "it's", "that's", "there's", "let's",
]
const CONTRACTION_RE = new RegExp(
  `\\b(?:${[...FORMAL_CONTRACTIONS]
    .sort((a, b) => b.length - a.length)
    .map((form) => form.replace(/'/g, "['’]"))
    .join('|')})\\b`,
  'gi',
)

describe('engine agreement: letters', () => {
  const formal = WRITING_TEMPLATES.find((t) => t.id === 'tpl-lt-formal')!
  const semiformal = WRITING_TEMPLATES.find((t) => t.id === 'tpl-lt-semiformal')!
  const informal = WRITING_TEMPLATES.find((t) => t.id === 'tpl-lt-informal')!

  it.each([...formal.paragraphs, ...semiformal.paragraphs].map((p) => ({ title: p.title, example: p.example })))(
    'formal/semi-formal "$title": the example contains no contraction and no exclamation mark',
    ({ example }) => {
      CONTRACTION_RE.lastIndex = 0
      expect(CONTRACTION_RE.test(example), `contraction found in "${example}"`).toBe(false)
      expect(example).not.toContain('!')
    },
  )

  it('informal opening example keeps "I am writing because" uncontracted', () => {
    expect(informal.paragraphs[0].example).toContain('I am writing because')
  })

  it('informal template contracts freely elsewhere: at least 3 contraction-list matches across its examples', () => {
    const all = informal.paragraphs.map((p) => p.example).join(' ')
    const matches = all.match(new RegExp(CONTRACTION_RE.source, 'gi')) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(3)
  })

  it('formal greeting/sign-off pairing: "Dear Sir or Madam," with "Yours faithfully,"', () => {
    expect(formal.paragraphs[0].example).toMatch(/^Dear Sir or Madam,\n/)
    expect(formal.paragraphs[formal.paragraphs.length - 1].example).toContain('\nYours faithfully,\n')
  })

  it('semi-formal greeting/sign-off pairing: "Dear Mr Harris," with "Yours sincerely,"', () => {
    expect(semiformal.paragraphs[0].example).toMatch(/^Dear Mr Harris,\n/)
    expect(semiformal.paragraphs[semiformal.paragraphs.length - 1].example).toContain('\nYours sincerely,\n')
  })

  it('informal greeting/sign-off pairing: "Dear Sam," with "Take care,"', () => {
    expect(informal.paragraphs[0].example).toMatch(/^Dear Sam,\n/)
    expect(informal.paragraphs[informal.paragraphs.length - 1].example).toContain('\nTake care,\n')
  })
})

describe('templatesFor', () => {
  it.each(QUESTION_TYPES)('offers only the 2 templates for %s on a Task 2 desk', (type) => {
    const result = templatesFor('task2', false, type)
    expect(result).toHaveLength(2)
    for (const t of result) {
      expect(t.kind).toBe('task2')
      expect(t.questionTypes).toContain(type)
    }
  })

  it.each(LETTER_TONES)('offers only the 1 template for %s on a letter desk', (tone) => {
    const result = templatesFor('task1', true, undefined, tone)
    expect(result).toHaveLength(1)
    expect(result[0].kind).toBe('letter')
    expect(result[0].tones).toContain(tone)
  })

  it('offers only the 2 chart templates on an Academic Task 1 desk', () => {
    const result = templatesFor('task1', false)
    expect(result).toHaveLength(2)
    for (const t of result) expect(t.kind).toBe('chart')
  })

  it('never crosses kinds: a letter desk gets no task2 or chart templates and vice versa', () => {
    const letter = templatesFor('task1', true, undefined, 'formal')
    expect(letter.every((t) => t.kind === 'letter')).toBe(true)

    const task2 = templatesFor('task2', false, 'opinion')
    expect(task2.every((t) => t.kind === 'task2')).toBe(true)

    const chart = templatesFor('task1', false)
    expect(chart.every((t) => t.kind === 'chart')).toBe(true)
  })

  it('returns results in bank order', () => {
    const result = templatesFor('task2', false, 'opinion')
    expect(result.map((t) => t.id)).toEqual(['tpl-op-onesided', 'tpl-op-balanced'])
  })

  it('with no questionType or tone given, still restricts to the right kind', () => {
    expect(templatesFor('task2', false)).toHaveLength(10)
    expect(templatesFor('task1', true)).toHaveLength(3)
  })
})
