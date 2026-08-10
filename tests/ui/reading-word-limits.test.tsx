/**
 * The printed word limit can never contradict the input it sits above.
 *
 * The limit is not decoration: `markAnswerKey` marks an over-length answer WRONG
 * however right its content is, so a learner who writes three words under a
 * heading that says three, into a gap that allows two, loses a mark they had
 * earned. The runner used to derive that heading from ONE question in the block
 * (`first.maxWords`) while each input derived its own hint from its own
 * question, so the two could disagree the moment a block held two limits.
 *
 * It was one edit away. The General Training paper's questions 11–20 are a
 * single completion run of 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, saved today only by
 * the two halves landing in different passage panes — change one `passageIndex`
 * and the header would have said TWO over an input saying THREE.
 *
 * Two levels, deliberately:
 *
 * 1. **The invariant, over the real papers, through the real app.** Both
 *    modules, every pane. This is what would catch an item-writer moving a
 *    question tomorrow.
 * 2. **The mixed-limit case, on a fixture.** The papers as authored cannot
 *    currently produce one within a single pane, and `src/reading/tests/` is
 *    authored content rather than test scaffolding, so the case is built here.
 *    This is the ONE file that renders a component rather than the app: the
 *    rule that UI tests go through `renderApp()` exists because an unseeded
 *    `render(<App />)` draws a random prompt and reintroduces plan 007's flake.
 *    A runner handed an explicit test has no random draw to pin.
 */
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'
import ReadingRunner from '../../src/components/ReadingRunner'
import type { ReadingQuestion, ReadingTest } from '../../src/reading/types'

/* --------------------------------- helpers ---------------------------------- */

type User = ReturnType<typeof userEvent.setup>

/** The printed limit phrase inside a piece of copy, or null when it states none. */
function limitPhrase(text: string | null | undefined): string | null {
  const m = (text ?? '').match(/NO MORE THAN [A-Z]+ WORDS?/)
  return m === null ? null : m[0]
}

/**
 * The whole contract, asserted against whatever question blocks are on screen.
 *
 * Reads only what a learner can read: the instruction printed above a block and
 * the hint printed beside each gap in it. Returns how many blocks stated a
 * limit, so a caller can prove it was actually looking at something.
 */
function assertNoRubricContradiction(): number {
  const blocks = Array.from(document.querySelectorAll('.rr-group'))
  let stated = 0

  for (const block of blocks) {
    const header = limitPhrase(block.querySelector('.rr-group-instruction')?.textContent)
    const hints = Array.from(block.querySelectorAll('.rr-q-completion .rr-limit')).map((el) =>
      limitPhrase(el.textContent),
    )
    if (header === null) continue
    stated += 1
    expect(hints.length, 'a block printing a word limit has gaps to print it for').toBeGreaterThan(0)
    for (const hint of hints) {
      expect(hint, `block says "${header}" over a gap saying "${hint}"`).toBe(header)
    }
  }
  return stated
}

async function sitPaper(user: User, module: 'Academic' | 'General'): Promise<number> {
  await user.click(within(document.querySelector('.nav') as HTMLElement).getByText('Reading'))
  await user.click(
    within(screen.getByRole('group', { name: 'IELTS exam type' })).getByRole('button', {
      name: module,
    }),
  )
  await user.click(screen.getByRole('button', { name: 'Start this paper' }))
  const tabs = screen.getAllByRole('tab')

  let stated = 0
  for (const tab of tabs) {
    await user.click(tab)
    stated += assertNoRubricContradiction()
  }
  return stated
}

/* ---------------------------- the real papers ------------------------------- */

describe('the printed word limit agrees with every gap under it', () => {
  it('holds across every pane of the Academic paper', async () => {
    const user = userEvent.setup()
    renderApp()

    expect(await sitPaper(user, 'Academic')).toBeGreaterThan(0)
  })

  it('holds across every pane of the General Training paper, which mixes limits', async () => {
    const user = userEvent.setup()
    renderApp()

    // This paper is the reason the fix exists: two different limits inside one
    // run of completion questions, 11–14 at two words and 15–20 at three.
    const stated = await sitPaper(user, 'General')
    expect(stated).toBeGreaterThanOrEqual(2)
  })
})

/* ------------------------- the mixed-limit block ----------------------------- */

/** One completion question, numbered and limited. */
function gap(number: number, maxWords: number): ReadingQuestion {
  return {
    id: `mix-${number}`,
    number,
    passageIndex: 0,
    type: 'completion',
    maxWords,
    prompt: `Gap number ${number}.`,
    answers: ['answer'],
  }
}

/**
 * A paper whose questions 1–3 are ONE consecutive completion run holding two
 * different limits in the SAME pane — the shape the authored papers are one
 * `passageIndex` edit away from.
 */
const MIXED_LIMITS: ReadingTest = {
  id: 'mixed-limits',
  module: 'general',
  title: 'Mixed limits',
  passages: [
    {
      id: 'p1',
      number: 1,
      heading: 'Section 1',
      texts: [{ title: 'A notice', paragraphs: [{ text: 'Some text to read.' }] }],
      source: { description: 'Written for this test.', licence: 'Original work' },
    },
  ],
  questions: [gap(1, 2), gap(2, 2), gap(3, 3)],
}

describe('a completion run holding two limits', () => {
  it('prints one instruction per limit instead of one that lies about half of them', () => {
    render(<ReadingRunner test={MIXED_LIMITS} onSubmit={() => {}} onExit={() => {}} />)

    // Two blocks, as the paper itself would print them, not one.
    const blocks = Array.from(document.querySelectorAll('.rr-group'))
    expect(blocks).toHaveLength(2)
    expect(within(blocks[0] as HTMLElement).getByText(/^Questions 1–2$/)).toBeInTheDocument()
    expect(within(blocks[1] as HTMLElement).getByText(/^Question 3$/)).toBeInTheDocument()

    expect(limitPhrase(blocks[0].querySelector('.rr-group-instruction')?.textContent)).toBe(
      'NO MORE THAN TWO WORDS',
    )
    expect(limitPhrase(blocks[1].querySelector('.rr-group-instruction')?.textContent)).toBe(
      'NO MORE THAN THREE WORDS',
    )

    // And the general invariant holds over them, exactly as over a real paper.
    expect(assertNoRubricContradiction()).toBe(2)
  })

  it('still answers as one sheet, so splitting the block costs the learner nothing', async () => {
    const user = userEvent.setup()
    render(<ReadingRunner test={MIXED_LIMITS} onSubmit={() => {}} onExit={() => {}} />)

    const third = document.getElementById('rr-input-mix-3') as HTMLInputElement
    await user.type(third, 'three whole words')

    expect(third.value).toBe('three whole words')
    // Three words against a three-word limit: the split must not have carried
    // the first block's stricter limit onto the gap below it.
    expect(screen.queryByText(/over the limit/i)).not.toBeInTheDocument()
    // One sheet still, counted across both blocks: the split is a printing
    // decision, not a second answer sheet.
    expect(screen.getByText('1 of 3 answered')).toBeInTheDocument()
  })
})
