/**
 * `src/analysis/bandDescriptors.ts`, engine-side.
 *
 * The content itself is the deliverable this plan pastes into the app, so
 * these cases pin: every slot is filled (completeness), every string is
 * distinct (no accidental copy-paste), no official-descriptor wording leaked
 * in (the automated half of the copyright rule), a specific distinctive
 * phrase renders (the mutation-check anchor the UI test also relies on), and
 * the band/task mapping functions behave at their edges.
 */
import { describe, expect, it } from 'vitest'
import {
  BAND_DESCRIPTORS,
  descriptorFor,
  nextDescriptorBand,
  type DescriptorBand,
} from '../src/analysis/bandDescriptors'
import type { Criterion } from '../src/types'

const CRITERIA: Criterion[] = ['TR', 'CC', 'LR', 'GRA']
const BANDS: DescriptorBand[] = [5, 6, 7, 8]

function allStrings(): string[] {
  const out: string[] = []
  for (const c of CRITERIA) {
    for (const b of BANDS) {
      const entry = BAND_DESCRIPTORS[c][b]
      out.push(entry.task2, entry.task1)
    }
  }
  return out
}

describe('BAND_DESCRIPTORS', () => {
  it('has a non-empty task2 and task1 string, at least 60 characters, for every criterion x band', () => {
    for (const c of CRITERIA) {
      for (const b of BANDS) {
        const entry = BAND_DESCRIPTORS[c][b]
        expect(entry.task2.length).toBeGreaterThanOrEqual(60)
        expect(entry.task1.length).toBeGreaterThanOrEqual(60)
      }
    }
    expect(allStrings()).toHaveLength(32)
  })

  it('has 32 distinct strings — no accidental duplication across criteria or bands', () => {
    const strings = allStrings()
    expect(new Set(strings).size).toBe(32)
  })

  it('never reproduces a signature phrase from the official band descriptors', () => {
    const strings = allStrings().map((s) => s.toLowerCase())
    const officialPhrases = [
      'satisfies all the requirements',
      'skilfully manages',
      'natural and sophisticated control',
    ]
    for (const phrase of officialPhrases) {
      for (const s of strings) {
        expect(s).not.toContain(phrase)
      }
    }
  })

  it('pins the CC band-7 task2 paraphrase, the distinctive phrase the UI test and mutation check key on', () => {
    expect(BAND_DESCRIPTORS.CC[7].task2).toContain('cohesion is mostly invisible')
  })
})

describe('nextDescriptorBand', () => {
  it('clamps the floor+1 mapping into [5, 8], treating non-finite input as 4', () => {
    expect(nextDescriptorBand(4)).toBe(5)
    expect(nextDescriptorBand(4.5)).toBe(5)
    expect(nextDescriptorBand(5.5)).toBe(6)
    expect(nextDescriptorBand(6.0)).toBe(7)
    expect(nextDescriptorBand(7.5)).toBe(8)
    expect(nextDescriptorBand(8.0)).toBe(8)
    expect(nextDescriptorBand(9)).toBe(8)
    expect(nextDescriptorBand(NaN)).toBe(5)
  })
})

describe('descriptorFor', () => {
  it('selects the task1 string and the right target band for task1', () => {
    const result = descriptorFor('TR', 6.5, 'task1')
    expect(result.targetBand).toBe(7)
    expect(result.text).toBe(BAND_DESCRIPTORS.TR[7].task1)
  })

  it('selects the task2 string for task2', () => {
    const result = descriptorFor('TR', 6.5, 'task2')
    expect(result.targetBand).toBe(7)
    expect(result.text).toBe(BAND_DESCRIPTORS.TR[7].task2)
  })
})
