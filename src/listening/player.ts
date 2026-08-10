/**
 * Section playback and the play-once rule. Implements plan 011 step 5.
 *
 * This is the headless half of the runner: it owns the two rules that make a
 * Listening practice honest, and owns them here rather than in a component so
 * they can be tested without a DOM and cannot be lost the next time the UI is
 * rewritten.
 *
 *  1. **The recording plays once.** The real exam does not replay a section,
 *     and a practice that quietly allows a second listen reports a band the
 *     learner will not reproduce. In exam mode a completed section is closed.
 *  2. **Sections play in order.** Section 1 then 2 then 3 then 4, because the
 *     paper's difficulty curve is the point of the paper. There is no skipping
 *     ahead to the lecture.
 *
 * `practice: true` lifts both, deliberately and visibly: `ListeningAttempt`
 * carries the same flag so a practice run is never filed as an exam run.
 *
 * A refusal is a returned value, not a thrown error. Pressing play on a section
 * that has already been heard is an ordinary thing for a learner to try, and
 * the UI's job is to explain the rule, not to catch an exception.
 */
import type { SpeechDriver, SpeechEvents, SpeechOutcome } from './speech'
import { sectionCues } from './speech'
import type { ListeningTest } from './types'

/**
 * How a `play()` request ended.
 *
 * `refused` is the play-once/in-order rule saying no. Nothing was spoken and
 * nothing changed.
 */
export type PlaybackOutcome = SpeechOutcome | 'refused'

/** Why a section cannot be played right now. `null` means it can. */
export type PlaybackRefusal = 'already-played' | 'out-of-order' | 'no-such-section' | null

export interface ListeningPlayerOptions {
  /**
   * Allow replaying a section and playing sections out of order. Off by
   * default: exam conditions are the default, and relaxing them is a choice the
   * learner makes explicitly.
   */
  practice?: boolean
}

/**
 * Plays a test's sections through a `SpeechDriver`, enforcing the exam's rules.
 *
 * Holds no timers and no DOM. The 30-minute clock and the
 * `LISTENING_TRANSFER_MINUTES` review window belong to the runner component;
 * what belongs here is the part that is wrong to get wrong.
 */
export class ListeningPlayer {
  private readonly playedSections = new Set<number>()
  private playing = false

  constructor(
    private readonly test: ListeningTest,
    private readonly driver: SpeechDriver,
    private readonly options: ListeningPlayerOptions = {},
  ) {}

  /** True when replays and out-of-order playback are allowed. */
  get practice(): boolean {
    return this.options.practice === true
  }

  /** Section indexes already played to completion, in the order they finished. */
  played(): number[] {
    return [...this.playedSections]
  }

  /** True when the section has been heard through to the end. */
  hasPlayed(index: number): boolean {
    return this.playedSections.has(index)
  }

  /** Every section has been played. In practice mode this can still change. */
  get complete(): boolean {
    return this.playedSections.size === this.test.sections.length
  }

  /**
   * The section the exam expects next, or null once all four are done.
   *
   * In practice mode this is still the first unplayed section — it is a
   * suggestion there rather than a constraint.
   */
  get nextSectionIndex(): number | null {
    for (let index = 0; index < this.test.sections.length; index += 1) {
      if (!this.playedSections.has(index)) return index
    }
    return null
  }

  /** Why a section cannot be played, or null if it can. */
  refusalFor(index: number): PlaybackRefusal {
    if (!Number.isInteger(index) || index < 0 || index >= this.test.sections.length) {
      return 'no-such-section'
    }
    if (this.practice) return null
    if (this.playedSections.has(index)) return 'already-played'
    if (index !== this.nextSectionIndex) return 'out-of-order'
    return null
  }

  /** Convenience for a disabled button. */
  canPlay(index: number): boolean {
    return this.refusalFor(index) === null
  }

  /**
   * Play one section.
   *
   * @returns `'completed'` when the section was heard to the end, `'cancelled'`
   *   when the learner stopped it, `'unavailable'` when the driver could not
   *   speak, and `'refused'` when a rule said no and nothing was spoken.
   *
   * A section counts as heard only on `'completed'`. A cancelled or impossible
   * playback leaves it open, because the learner has not had their one listen —
   * punishing them for a browser that would not speak would be the wrong rule
   * enforced correctly.
   */
  async play(index: number, events?: SpeechEvents): Promise<PlaybackOutcome> {
    if (this.refusalFor(index) !== null) return 'refused'
    // One section at a time: two overlapping voices is not a listening test.
    if (this.playing) return 'refused'

    this.playing = true
    try {
      const outcome = await this.driver.play(sectionCues(this.test.sections[index]), events)
      if (outcome === 'completed') this.playedSections.add(index)
      return outcome
    } finally {
      this.playing = false
    }
  }

  /** Stop whatever is playing. A stopped section is not marked as heard. */
  cancel(): void {
    this.driver.cancel()
  }
}
