/**
 * The `technique` field on `READING_TYPE_META` and `LISTENING_FORMAT_META`,
 * engine-side.
 *
 * The content itself is the deliverable this plan pastes into the app, so
 * these cases pin: every entry carries a technique of reasonable length and
 * shape (completeness), all 13 strings are distinct, three specific pinned
 * phrases render (the mutation-check anchors the UI tests also rely on), and
 * the existing fields on both records survived the type widening.
 */
import { describe, expect, it } from 'vitest'
import { READING_TYPE_META, LISTENING_FORMAT_META } from '../src/meta'

/** At least two sentence-ending periods — i.e. at least two sentences. */
function countSentenceEnds(s: string): number {
  return (s.match(/\.(?:\s|$)/g) ?? []).length
}

describe('READING_TYPE_META techniques', () => {
  const entries = Object.values(READING_TYPE_META)

  it('has 6 entries, each with a technique of >= 150 chars and >= 2 sentences', () => {
    expect(entries).toHaveLength(6)
    for (const entry of entries) {
      expect(entry.technique.length).toBeGreaterThanOrEqual(150)
      expect(countSentenceEnds(entry.technique)).toBeGreaterThanOrEqual(2)
    }
  })

  it('keeps every existing field non-empty', () => {
    for (const entry of entries) {
      expect(entry.label.length).toBeGreaterThan(0)
      expect(entry.report.length).toBeGreaterThan(0)
      expect(entry.instruction.length).toBeGreaterThan(0)
    }
  })
})

describe('LISTENING_FORMAT_META techniques', () => {
  const entries = Object.values(LISTENING_FORMAT_META)

  it('has 7 entries, each with a technique of >= 150 chars and >= 2 sentences', () => {
    expect(entries).toHaveLength(7)
    for (const entry of entries) {
      expect(entry.technique.length).toBeGreaterThanOrEqual(150)
      expect(countSentenceEnds(entry.technique)).toBeGreaterThanOrEqual(2)
    }
  })

  it('keeps every existing field non-empty, including widget', () => {
    for (const entry of entries) {
      expect(entry.label.length).toBeGreaterThan(0)
      expect(entry.report.length).toBeGreaterThan(0)
      expect(['text', 'radio', 'bank']).toContain(entry.widget)
    }
  })
})

describe('all 13 technique strings', () => {
  it('are distinct', () => {
    const all = [
      ...Object.values(READING_TYPE_META).map((e) => e.technique),
      ...Object.values(LISTENING_FORMAT_META).map((e) => e.technique),
    ]
    expect(all).toHaveLength(13)
    expect(new Set(all).size).toBe(13)
  })
})

describe('content pins (mutation-check anchors)', () => {
  it("READING_TYPE_META['true-false-notgiven'] names NOT GIVEN as the passage taking no side", () => {
    expect(READING_TYPE_META['true-false-notgiven'].technique).toContain(
      'the passage takes no side',
    )
  })

  it("READING_TYPE_META['completion'] restates the over-limit marking rule", () => {
    expect(READING_TYPE_META['completion'].technique).toContain(
      'marked wrong even when the content is right',
    )
  })

  it("LISTENING_FORMAT_META['map-labelling'] tells the learner to walk the route", () => {
    expect(LISTENING_FORMAT_META['map-labelling'].technique).toContain(
      'walk the route in your head',
    )
  })
})
