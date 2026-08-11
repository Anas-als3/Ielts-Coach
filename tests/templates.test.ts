/**
 * Writing templates (plan 033): the bank's own shape, and `templatesFor`'s
 * filtering.
 *
 * The bank must keep pace with the prompt bank — every `QuestionType` gets
 * exactly 2 templates, every `LetterTone` exactly 1, and Academic Task 1 gets
 * exactly 2 chart-kind-agnostic ones. A new question type or tone with no
 * matching template fails these counts, on purpose (see `bank.ts`'s
 * maintenance note).
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

  // Every section is a fill-in-the-blank paragraph, plan 034: 1-4 sentence
  // frames, slots written `[like this]`. The old 033 field (0-2 openers to
  // reword) is gone — every paragraph is now scripted sentence by sentence,
  // so the coverage check tightens from "somewhere in the template" to
  // "every section", naming the template and section on failure via
  // `it.each`.
  const ALL_SECTIONS = WRITING_TEMPLATES.flatMap((t) =>
    t.paragraphs.map((p) => ({ templateId: t.id, title: p.title, frames: p.frames })),
  )

  it.each(ALL_SECTIONS)('$templateId → "$title" has between 1 and 4 frames', ({ frames }) => {
    expect(frames.length).toBeGreaterThanOrEqual(1)
    expect(frames.length).toBeLessThanOrEqual(4)
  })

  const ALL_FRAMES = WRITING_TEMPLATES.flatMap((t) =>
    t.paragraphs.flatMap((p) => p.frames.map((frame) => ({ templateId: t.id, title: p.title, frame }))),
  )

  it.each(ALL_FRAMES)('the frame in $templateId → "$title" is a non-empty, trimmed string', ({ frame }) => {
    expect(frame.trim()).toBe(frame)
    expect(frame.length).toBeGreaterThan(0)
  })

  // Brackets balance: stripping every well-formed `[slot]` (one or more
  // non-bracket characters) must leave no bracket behind. That catches
  // nesting (`[outer [inner]]`), an unmatched bracket, and an empty slot
  // (`[]`, which the strip regex cannot match) all in the same assertion.
  it.each(ALL_FRAMES)('the slots in $templateId → "$title" are balanced, unnested and non-empty', ({ frame }) => {
    const stripped = frame.replace(/\[[^[\]]+\]/g, '')
    expect(stripped).not.toContain('[')
    expect(stripped).not.toContain(']')
  })

  // Structural agreement with the engine (SPEC.md): every Task 2 BODY
  // paragraph — every section but the introduction and the conclusion —
  // must prompt an example, matching `rules/structure.ts`'s EXAMPLE_MARKERS
  // check. Decidable per section because every body frame set carries one
  // example-type slot by construction.
  it('every task2 body section carries at least one frame with an example-type slot', () => {
    for (const t of WRITING_TEMPLATES.filter((t) => t.kind === 'task2')) {
      const bodySections = t.paragraphs.slice(1, -1)
      expect(bodySections.length).toBeGreaterThan(0)
      for (const p of bodySections) {
        const hasExampleSlot = p.frames.some((frame) => {
          const slots = frame.match(/\[[^[\]]+\]/g) ?? []
          return slots.some((slot) => /example/i.test(slot))
        })
        expect(hasExampleSlot, `${t.id} → "${p.title}" has no example-type slot`).toBe(true)
      }
    }
  })

  it('a task2 template never carries tones, a letter never carries questionTypes', () => {
    for (const t of WRITING_TEMPLATES) {
      if (t.kind === 'task2') expect(t.tones).toBeUndefined()
      if (t.kind === 'letter') expect(t.questionTypes).toBeUndefined()
    }
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
