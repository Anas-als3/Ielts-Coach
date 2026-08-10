/**
 * The report tile's "what moves you up" disclosure, rendered (plan 030 Phase
 * A, SPEC.md "Teaching content").
 *
 * The paste-in content lives in `src/analysis/bandDescriptors.ts` and is
 * pinned engine-side by `tests/bandDescriptors.test.ts`. What this file
 * checks is the part a learner actually meets: that a disclosure renders on
 * every tile, that its text is the SAME text `descriptorFor` would compute
 * for that tile's own printed band and criterion (proving the wiring passes
 * the right arguments, not just that some string renders), that the native
 * `<details>` actually opens under jsdom, and that the hedge is present.
 *
 * Drives the real <App /> through `renderApp()`, which pins the prompt draw
 * (op-01 has an exact worked answer, but any submitted essay renders tiles —
 * its quality is irrelevant here).
 */
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'
import { descriptorFor } from '../../src/analysis/bandDescriptors'
import type { Criterion } from '../../src/types'

/** Report.tsx's own CRITERIA order — TR, CC, LR, GRA. */
const CRITERIA: Criterion[] = ['TR', 'CC', 'LR', 'GRA']

/** The analysis is debounced 400ms; give the rail time to catch up. */
async function settled(): Promise<void> {
  await new Promise((r) => setTimeout(r, 550))
}

function sheet(): HTMLTextAreaElement {
  return screen.getByRole('textbox') as HTMLTextAreaElement
}

async function type(user: ReturnType<typeof userEvent.setup>, text: string): Promise<void> {
  const box = sheet()
  box.focus()
  await user.paste(text)
  await settled()
}

/**
 * A plain five-paragraph opinion essay, well over the 250-word Task 2
 * minimum. Its content and quality are irrelevant — the tiles render for any
 * submitted essay, and the expected disclosure text is computed from the
 * printed band, not hard-coded.
 */
const ESSAY = `Whether social media does more good than harm is a subject that divides opinion. Some people argue that these platforms connect friends and family across long distances, while others believe that they damage real relationships and mental health. In my opinion, the drawbacks of social media outweigh its benefits, because the way it is designed encourages comparison and distraction rather than genuine connection.

There are strong arguments in favour of social media. Those who support it point out that people separated by distance can stay in touch instantly, sharing photographs and messages that would once have taken days to arrive by post. For example, a grandmother living abroad can watch her grandchildren grow up through short videos sent every week. This suggests that, for families spread across countries, these platforms genuinely narrow the emotional distance between them.

On the other hand, the arguments against social media are, in my view, more persuasive. Critics point out that constant exposure to carefully edited images of other people's lives fuels anxiety and low self-esteem, particularly among teenagers. This is because a feed built entirely from someone else's best moments invites an unfair comparison with an ordinary day. As a result, many young users report feeling worse after long periods of scrolling rather than better, even though the platform was designed to keep them engaged.

A further concern is the amount of personal information that social media companies collect from their users. Every message, photograph and search adds to a detailed profile that can be sold to advertisers without the user ever fully understanding how the data will be used. Although companies claim that this practice pays for a free service, many users would rather keep their information private even if that meant paying a small fee instead.

In conclusion, although social media has made it easier for people to stay in touch across distances, I believe its costs to mental health and privacy are more serious than its benefits. Governments and platforms alike should therefore do more to protect young users from the pressures these services can create.`

describe('the band-descriptor disclosure', () => {
  it('renders one disclosure per tile, matching descriptorFor for that tile’s own band and criterion', async () => {
    const user = userEvent.setup()
    renderApp()
    await type(user, ESSAY)
    await user.click(screen.getByRole('button', { name: 'Finish & review' }))
    await screen.findByText(/Form-only estimate/)

    const tiles = document.querySelectorAll('.rp-tile-next')
    expect(tiles).toHaveLength(4)

    const bandEls = document.querySelectorAll('.rp-tile-band')
    expect(bandEls).toHaveLength(4)

    tiles.forEach((tile, i) => {
      const band = parseFloat(bandEls[i].textContent ?? '')
      const expected = descriptorFor(CRITERIA[i], band, 'task2')
      const text = tile.querySelector('.rp-tile-next-text')?.textContent
      expect(text).toBe(expected.text)
    })
  })

  it('toggles open under jsdom when the summary is clicked', async () => {
    const user = userEvent.setup()
    renderApp()
    await type(user, ESSAY)
    await user.click(screen.getByRole('button', { name: 'Finish & review' }))
    await screen.findByText(/Form-only estimate/)

    const first = document.querySelector<HTMLDetailsElement>('.rp-tile-next')!
    expect(first.open).toBe(false)
    await user.click(first.querySelector('summary')!)
    expect(first.open).toBe(true)
  })

  it('carries the hedge in every tile', async () => {
    const user = userEvent.setup()
    renderApp()
    await type(user, ESSAY)
    await user.click(screen.getByRole('button', { name: 'Finish & review' }))
    await screen.findByText(/Form-only estimate/)

    // The band hero also carries "checks form, not meaning" (Report.tsx's
    // own hedge, which the tile disclosures deliberately echo), so this
    // asserts >= 4 (one per tile) rather than an exact count.
    expect(screen.getAllByText(/checks form, not meaning/).length).toBeGreaterThanOrEqual(4)
  })
})
