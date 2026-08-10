/**
 * The Listening answer sheet. Implements plan 011 steps 5 and 6.
 *
 * Reading's sibling, and built as one: the same navy toolbar, the same section
 * tabs with live answered counts, the same wall-clock countdown, the same
 * "answers live in component state and are persisted ONLY on submit". What
 * differs is the left pane. Reading puts the passage there and lets the learner
 * read it as often as they like; Listening puts the PLAYER there, and the whole
 * design problem is that the material is gone once it has been through.
 *
 * Three rules this component exists to hold:
 *
 * 1. **The recording plays once, in order.** Enforced by `ListeningPlayer`, not
 *    here — it is headless so it survives a UI rewrite — and this component
 *    only renders the refusal. Practice mode lifts it, visibly, and the saved
 *    attempt records that it was lifted.
 * 2. **The voice is synthetic and the UI says so.** `noticeFor(driver.kind)`
 *    picks between `SYNTHETIC_VOICE_NOTICE` and `TRANSCRIPT_FALLBACK_NOTICE`;
 *    one of the two is on screen the entire time the paper is open.
 * 3. **The transcript is never shown while a voice is speaking.** Under the
 *    fallback driver the revealed text IS the exercise; under a real voice it
 *    would be subtitles, and a subtitled listening test is a reading test.
 *
 * The clock derives from a wall-clock deadline rather than by counting ticks,
 * for the reason `App.tsx` gives for the writing exam: browsers throttle
 * intervals in hidden tabs, so tick counting hands a learner free exam time
 * whenever they switch away.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ListeningRunnerProps } from '../types'
import type {
  ListeningAnswers,
  ListeningCompletionQuestion,
  ListeningQuestion,
  ListeningQuestionGroup,
  ListeningSection,
} from '../listening/types'
import { LISTENING_MINUTES, LISTENING_TRANSFER_MINUTES } from '../listening/types'
import type { PlaybackRefusal } from '../listening/player'
import { ListeningPlayer } from '../listening/player'
import type { SpeechCue } from '../listening/speech'
import { noticeFor } from '../listening/speech'
import { LISTENING_FORMAT_META, wordLimitLabel } from '../meta'
import { countWords, normaliseAnswer } from '../marking/markAnswerKey'
import Timer from './Timer'
import './ListeningRunner.css'

/* --------------------------------- helpers --------------------------------- */

const TEST_SECONDS = LISTENING_MINUTES * 60
const TRANSFER_SECONDS = LISTENING_TRANSFER_MINUTES * 60

/** Bank entries are printed A, B, C … — the letter is display only. */
const OPTION_LETTERS = 'ABCDEFGHIJ'

/**
 * Which clock is running.
 *
 * `test` is the 30 minutes of recording and answering. `transfer` is the 10
 * minutes the paper-based exam gives afterwards. See `TRANSFER_COPY` for why
 * this app keeps a period it has no answer sheet to transfer onto.
 */
type Phase = 'test' | 'transfer'

/** Has this question been answered? Blank and whitespace both mean "no". */
function isAnswered(answers: ListeningAnswers, id: string): boolean {
  return normaliseAnswer(answers[id]) !== ''
}

/** "Questions 15–20", or "Question 9" when a group holds one. */
function groupRangeLabel(group: ListeningQuestionGroup): string {
  return group.from === group.to
    ? `Question ${group.from}`
    : `Questions ${group.from}–${group.to}`
}

/** Why the player said no, in words a learner can act on. */
function refusalMessage(refusal: PlaybackRefusal, nextSection: number | null): string {
  switch (refusal) {
    case 'already-played':
      return (
        'This section has already played. The real exam plays the recording once and does not ' +
        'repeat it, so this practice does not either. Start a paper in practice mode if you want ' +
        'to replay sections.'
      )
    case 'out-of-order':
      return nextSection === null
        ? 'Every section has played.'
        : `Sections play in order. Section ${nextSection + 1} is next.`
    case 'no-such-section':
      return 'That section is not part of this paper.'
    default:
      return ''
  }
}

/* --------------------------------- the player ------------------------------- */

interface PlayerPaneProps {
  section: ListeningSection
  sectionIndex: number
  /** Section indexes heard through to the end. */
  played: readonly number[]
  /** Index currently speaking, or null. */
  nowPlaying: number | null
  /** The cue being spoken. Its text is shown ONLY under the fallback driver. */
  currentCue: SpeechCue | null
  /** Everything revealed so far this playback — fallback driver only. */
  revealed: readonly SpeechCue[]
  /** True when the driver reveals text instead of speaking. */
  transcriptMode: boolean
  practice: boolean
  refusal: PlaybackRefusal
  nextSection: number | null
  notice: string
  onPlay: () => void
  onStop: () => void
}

function PlayerPane({
  section,
  sectionIndex,
  played,
  nowPlaying,
  currentCue,
  revealed,
  transcriptMode,
  practice,
  refusal,
  nextSection,
  notice,
  onPlay,
  onStop,
}: PlayerPaneProps) {
  const speaking = nowPlaying === sectionIndex
  const heard = played.includes(sectionIndex)
  const busyElsewhere = nowPlaying !== null && !speaking
  const blocked = refusalMessage(refusal, nextSection)

  return (
    <article className="lr-player" aria-label={`${section.heading} recording`}>
      <p className="eyebrow lr-section-eyebrow">{section.heading}</p>
      <p className="lr-rubric">{section.rubric}</p>

      <div className="lr-transport">
        <button
          className="btn btn-primary lr-play"
          onClick={onPlay}
          disabled={speaking || busyElsewhere || refusal !== null}
        >
          {heard && practice ? 'Play again' : 'Play this section'}
        </button>
        {speaking && (
          <button className="btn lr-stop" onClick={onStop}>
            Stop
          </button>
        )}
        <span className="lr-transport-state" aria-live="polite">
          {speaking
            ? 'Playing…'
            : heard
              ? practice
                ? 'Played. Practice mode allows a replay.'
                : 'Played. It does not play again.'
              : busyElsewhere
                ? 'Another section is playing.'
                : 'Not played yet.'}
        </span>
      </div>

      {/* The play-once / in-order rule, stated where it is being applied. */}
      {blocked !== '' && !speaking && <p className="lr-blocked">{blocked}</p>}

      {/* Who the learner is about to hear. Named because the real paper's
          rubric names them, and because a synthetic voice gives far weaker
          speaker cues than a recorded actor does. */}
      <ul className="lr-speakers">
        {section.transcript.speakers.map((speaker) => (
          <li key={speaker.id}>
            <span className="lr-speaker-label mono">{speaker.label}</span>
            {speaker.description !== undefined && (
              <span className="lr-speaker-desc"> {speaker.description}</span>
            )}
            <span className="lr-speaker-accent mono"> {speaker.voice.accent}</span>
          </li>
        ))}
      </ul>

      {/* The stage. Under a real voice this shows WHO is speaking and nothing
          else: printing the words would turn a listening test into a reading
          one. Under the fallback there is no voice, so the words are the whole
          exercise and are revealed line by line. */}
      <div className="lr-stage" aria-live={transcriptMode ? 'polite' : 'off'}>
        {transcriptMode ? (
          revealed.length === 0 ? (
            <p className="lr-stage-idle">
              The transcript appears here, one line at a time, at speaking pace.
            </p>
          ) : (
            <ol className="lr-cues">
              {revealed.map((cue, i) => (
                <li
                  key={`${cue.id}-${i}`}
                  className={
                    currentCue !== null && cue.id === currentCue.id ? 'lr-cue lr-cue-now' : 'lr-cue'
                  }
                >
                  <span className="lr-cue-speaker mono">{cue.speaker}</span>
                  <span className="lr-cue-text">{cue.text}</span>
                </li>
              ))}
            </ol>
          )
        ) : speaking && currentCue !== null ? (
          <p className="lr-stage-speaking">
            <span className="lr-cue-speaker mono">{currentCue.speaker}</span>
            <span className="lr-stage-hint"> is speaking</span>
          </p>
        ) : (
          <p className="lr-stage-idle">
            {heard
              ? 'This section is over. Your notes are all you have now — exactly as in the exam.'
              : 'Press play, then take notes as you listen. The words are never printed while a ' +
                'voice is speaking: reading along would be a different exam.'}
          </p>
        )}
      </div>

      <p className="lr-notice">{notice}</p>

      <p className="lr-source">
        {section.source.description} Licence: {section.source.licence}.
        {section.source.attribution !== undefined && ` ${section.source.attribution}`}
      </p>
    </article>
  )
}

/* ------------------------------- question widgets --------------------------- */

interface RowProps {
  question: ListeningQuestion
  value: string
  onChange: (value: string) => void
}

/**
 * A gap to type into — form, note, table and short-answer items all use it.
 *
 * The live word count is measured with the MARKER's own `normaliseAnswer` and
 * `countWords`, not with a second implementation: a warning that disagreed with
 * the marking would be worse than no warning, because the learner would trust
 * it. Over the limit is amber — a warning while the paper is open, an error
 * only once it is marked.
 */
function CompletionRow({
  question,
  value,
  onChange,
}: Omit<RowProps, 'question'> & { question: ListeningCompletionQuestion }) {
  const maxWords = question.maxWords
  const words = countWords(normaliseAnswer(value))
  const over = maxWords > 0 && words > maxWords
  const inputId = `lr-input-${question.id}`

  return (
    <div className="lr-q lr-q-completion">
      <label className="lr-q-prompt" htmlFor={inputId}>
        <span className="lr-qnum mono">{question.number}</span>
        {question.prompt}
      </label>
      <div className="lr-completion-field">
        <input
          id={inputId}
          className={over ? 'lr-input lr-input-over' : 'lr-input'}
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={`${inputId}-limit`}
        />
        <span id={`${inputId}-limit`} className={over ? 'lr-limit lr-limit-over' : 'lr-limit'}>
          {over
            ? `${words} words — over the limit, this will be marked wrong`
            : wordLimitLabel(maxWords)}
        </span>
      </div>
    </div>
  )
}

/** A radio set. True multiple choice only — a bank is a select, see below. */
function ChoiceRow({ question, value, onChange, choices }: RowProps & { choices: string[] }) {
  return (
    <fieldset className="lr-q lr-q-choice">
      <legend className="lr-q-prompt">
        <span className="lr-qnum mono">{question.number}</span>
        {question.prompt}
      </legend>
      <div className="lr-choices">
        {choices.map((choice, i) => (
          <label className="lr-choice" key={choice}>
            <input
              type="radio"
              name={`q-${question.id}`}
              value={choice}
              checked={value === choice}
              onChange={() => onChange(choice)}
            />
            <span className="lr-choice-letter mono" aria-hidden="true">
              {OPTION_LETTERS[i]}
            </span>
            <span className="lr-choice-text">{choice}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * A select over a shared bank — matching and plan labelling.
 *
 * Both store the option TEXT, never its letter, exactly as multiple choice
 * does, so marking can never depend on the order the bank happens to be printed
 * in. The letter is rendered beside the text purely because the paper prints
 * one and a learner writing "F" in their notes needs to find it again.
 */
function BankRow({ question, value, onChange, options }: RowProps & { options: string[] }) {
  const selectId = `lr-select-${question.id}`
  return (
    <div className="lr-q lr-q-select">
      <label className="lr-q-prompt" htmlFor={selectId}>
        <span className="lr-qnum mono">{question.number}</span>
        {question.prompt}
      </label>
      <select
        id={selectId}
        className="lr-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Choose from the list</option>
        {options.map((option, i) => (
          <option key={option} value={option}>
            {OPTION_LETTERS[i]} — {option}
          </option>
        ))}
      </select>
    </div>
  )
}

/**
 * Render by FORMAT, not by marking type.
 *
 * `LISTENING_FORMAT_META[...].widget` decides, so the format-to-control mapping
 * lives in one table rather than in a switch a newly added format could fall
 * through. A `matching` item and a `multiple-choice` item are both marking type
 * `'multiple-choice'`; the exam presents them completely differently, and this
 * is the line where that difference is honoured.
 */
function QuestionRow({ question, value, onChange }: RowProps) {
  const widget = LISTENING_FORMAT_META[question.format].widget

  if (question.type === 'completion') {
    // Every completion-typed item is a text gap whatever its format, and the
    // compiler has narrowed it here, so the widget table cannot disagree.
    return <CompletionRow question={question} value={value} onChange={onChange} />
  }

  return widget === 'bank' ? (
    <BankRow question={question} value={value} onChange={onChange} options={question.options} />
  ) : (
    <ChoiceRow question={question} value={value} onChange={onChange} choices={question.options} />
  )
}

function GroupBlock({
  group,
  questions,
  answers,
  onAnswer,
}: {
  group: ListeningQuestionGroup
  questions: ListeningQuestion[]
  answers: ListeningAnswers
  onAnswer: (id: string, value: string) => void
}) {
  const first = questions[0]
  // A bank is shared by every question in its group and is printed ONCE above
  // the set, as the paper prints it — the selects below then only have to name
  // a letter the learner has already seen.
  const bank =
    first !== undefined &&
    first.type === 'multiple-choice' &&
    LISTENING_FORMAT_META[group.format].widget === 'bank'
      ? first.options
      : null

  return (
    <section className="lr-group" aria-label={groupRangeLabel(group)}>
      <header className="lr-group-head">
        <h2 className="lr-group-range">{groupRangeLabel(group)}</h2>
        <p className="lr-group-instruction">{group.instruction}</p>
      </header>

      {group.heading !== undefined && <p className="lr-group-heading">{group.heading}</p>}

      {bank !== null && (
        <div className="lr-bank card">
          <p className="eyebrow">List of options</p>
          <ul className="lr-bank-list">
            {bank.map((option, i) => (
              <li key={option}>
                <span className="lr-bank-id mono">{OPTION_LETTERS[i]}</span>
                {option}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ol className="lr-q-list">
        {questions.map((question) => (
          <li key={question.id}>
            <QuestionRow
              question={question}
              value={answers[question.id] ?? ''}
              onChange={(value) => onAnswer(question.id, value)}
            />
          </li>
        ))}
      </ol>
    </section>
  )
}

/* -------------------------------- the runner -------------------------------- */

export default function ListeningRunner({
  test,
  practice,
  driver,
  onSubmit,
  onExit,
}: ListeningRunnerProps) {
  const [answers, setAnswers] = useState<ListeningAnswers>({})
  const [activeSection, setActiveSection] = useState(0)
  const [played, setPlayed] = useState<number[]>([])
  const [nowPlaying, setNowPlaying] = useState<number | null>(null)
  const [currentCue, setCurrentCue] = useState<SpeechCue | null>(null)
  const [revealed, setRevealed] = useState<SpeechCue[]>([])
  const [phase, setPhase] = useState<Phase>('test')
  const [secondsLeft, setSecondsLeft] = useState(TEST_SECONDS)
  const [playbackFailed, setPlaybackFailed] = useState(false)

  // Constructed once, on mount. The player owns the play-once and in-order
  // rules; keeping it in a ref means a re-render can never hand the learner a
  // fresh one with an empty "already played" set.
  const playerRef = useRef<ListeningPlayer | null>(null)
  if (playerRef.current === null) {
    playerRef.current = new ListeningPlayer(test, driver, { practice })
  }
  const player = playerRef.current

  // Set once, on mount: the clock starts when the paper opens, and a re-render
  // must never move the deadline.
  const startedAtRef = useRef<number>(Date.now())
  const deadlineRef = useRef<number>(Date.now() + TEST_SECONDS * 1000)
  const phaseRef = useRef<Phase>('test')
  const submittedRef = useRef(false)
  const answersRef = useRef(answers)
  answersRef.current = answers

  const transcriptMode = driver.kind === 'transcript-pace'
  const notice = useMemo(() => noticeFor(driver.kind), [driver.kind])

  const questionsBySection = useMemo(
    () => test.sections.map((_, i) => test.questions.filter((q) => q.sectionIndex === i)),
    [test],
  )
  const groups = useMemo(
    () =>
      test.groups
        .filter((g) => g.sectionIndex === activeSection)
        .map((group) => ({
          group,
          questions: test.questions.filter(
            (q) => q.number >= group.from && q.number <= group.to,
          ),
        })),
    [test, activeSection],
  )
  const answeredCount = useMemo(
    () => test.questions.filter((q) => isAnswered(answers, q.id)).length,
    [test.questions, answers],
  )

  /**
   * Submit once and only once. The guard is a ref rather than state because the
   * timer expiry and a click can land in the same frame, and two saves would
   * put the same paper in the learner's history twice.
   */
  const submit = useCallback((): void => {
    if (submittedRef.current) return
    submittedRef.current = true
    driver.cancel()
    const used = Math.min(
      TEST_SECONDS + TRANSFER_SECONDS,
      Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000)),
    )
    onSubmit({ ...answersRef.current }, used, practice)
  }, [driver, onSubmit, practice])

  /**
   * Move from the recording to the checking window.
   *
   * Triggered by the 30 minutes expiring OR by the last section finishing,
   * whichever comes first — which is what the real exam does: the extra time
   * starts when the recording stops, not at a fixed hour on the clock.
   */
  const beginTransfer = useCallback((): void => {
    if (phaseRef.current !== 'test') return
    phaseRef.current = 'transfer'
    deadlineRef.current = Date.now() + TRANSFER_SECONDS * 1000
    setPhase('transfer')
    setSecondsLeft(TRANSFER_SECONDS)
  }, [])

  const submitRef = useRef(submit)
  submitRef.current = submit
  const beginTransferRef = useRef(beginTransfer)
  beginTransferRef.current = beginTransfer

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left > 0) return
      // Time is up. The recording ending opens the checking window; the
      // checking window ending collects the paper as it stands.
      if (phaseRef.current === 'test') beginTransferRef.current()
      else submitRef.current()
    }
    const id = setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

  // Stop speaking if the learner navigates away mid-section. A voice that
  // carried on talking over the next screen would be a bug the browser keeps
  // running after React has forgotten about it.
  useEffect(() => () => driver.cancel(), [driver])

  async function handlePlay(index: number): Promise<void> {
    if (player.refusalFor(index) !== null || nowPlaying !== null) return

    setPlaybackFailed(false)
    setNowPlaying(index)
    setRevealed([])
    setCurrentCue(null)

    const outcome = await player.play(index, {
      onCueStart: (cue) => {
        setCurrentCue(cue)
        // Kept whatever the driver is, so switching to the fallback mid-paper
        // could never show a half-empty transcript; only the RENDER is
        // conditional, never the record of what was said.
        setRevealed((prev) => [...prev, cue])
      },
    })

    setNowPlaying(null)
    setCurrentCue(null)
    setPlayed(player.played())
    if (outcome === 'unavailable') setPlaybackFailed(true)
    // The recording is over the moment the last section finishes, so the
    // checking window starts there rather than at a fixed point on the clock.
    if (player.complete) beginTransfer()
  }

  function handleAnswer(id: string, value: string): void {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  function handleSubmitClick(): void {
    const unanswered = test.questions.length - answeredCount
    if (unanswered > 0) {
      const go = window.confirm(
        `${unanswered} question${unanswered === 1 ? ' is' : 's are'} still blank. ` +
          'A blank answer scores nothing and a wrong one costs nothing, so a guess is always worth it. Submit anyway?',
      )
      if (!go) return
    }
    submit()
  }

  function handleExit(): void {
    const go = window.confirm(
      'Leave this Listening test? The clock is running and your answers will not be saved.',
    )
    if (go) onExit()
  }

  const section = test.sections[activeSection]
  const totalSeconds = phase === 'transfer' ? TRANSFER_SECONDS : TEST_SECONDS

  return (
    <div className="lr">
      <header className="lr-toolbar">
        <div className="lr-toolbar-left">
          <p className="eyebrow lr-test-title">
            {test.title}
            {practice && <span className="lr-practice-flag"> · practice mode</span>}
          </p>
          <div className="lr-tabs" role="tablist" aria-label="Listening sections">
            {test.sections.map((s, i) => {
              const done = questionsBySection[i].filter((q) => isAnswered(answers, q.id)).length
              return (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={i === activeSection}
                  className={i === activeSection ? 'lr-tab active' : 'lr-tab'}
                  onClick={() => setActiveSection(i)}
                >
                  {s.heading}
                  <span className="lr-tab-count mono">
                    {done}/{questionsBySection[i].length}
                  </span>
                  {played.includes(i) && (
                    <span className="lr-tab-played" aria-hidden="true" title="Already played">
                      ●
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
        <div className="lr-toolbar-right">
          <span className="lr-progress mono" aria-live="off">
            {answeredCount} of {test.questions.length} answered
          </span>
          <div className="lr-clock">
            <span className="lr-phase">
              {phase === 'transfer' ? 'Checking time' : 'Recording and answering'}
            </span>
            <Timer secondsLeft={secondsLeft} totalSeconds={totalSeconds} running />
          </div>
          <button className="btn" onClick={handleExit}>
            Leave test
          </button>
          <button className="btn btn-primary" onClick={handleSubmitClick}>
            Submit answers
          </button>
        </div>
      </header>

      {/*
        The 10 minutes the paper exam gives, kept rather than dropped — and the
        banner says exactly what it is and is not. There is no answer sheet on a
        screen, so nothing is being transferred; what the period is worth here
        is the ENDING. A learner who rehearses a 30-minute Listening and then
        sits the paper test has practised a different shape of finish.
      */}
      {phase === 'transfer' && (
        <p className="lr-transfer-banner" role="status">
          The recording is over. In the paper exam you now get{' '}
          {LISTENING_TRANSFER_MINUTES} minutes to copy your answers onto the answer sheet — on a
          screen there is nothing to copy, so use it to check spellings, plurals and word limits.
          The computer-delivered test gives 2 minutes here instead of 10.
        </p>
      )}

      <div className="lr-panes">
        <div className="lr-pane lr-pane-player">
          {section !== undefined && (
            <PlayerPane
              section={section}
              sectionIndex={activeSection}
              played={played}
              nowPlaying={nowPlaying}
              currentCue={currentCue}
              revealed={revealed}
              transcriptMode={transcriptMode}
              practice={practice}
              refusal={player.refusalFor(activeSection)}
              nextSection={player.nextSectionIndex}
              notice={playbackFailed ? `${notice} Nothing played — check your device's voice settings.` : notice}
              onPlay={() => void handlePlay(activeSection)}
              onStop={() => player.cancel()}
            />
          )}
        </div>
        <div className="lr-pane lr-pane-questions">
          {groups.length === 0 ? (
            <p className="lr-empty">This section has no questions.</p>
          ) : (
            groups.map(({ group, questions }) => (
              <GroupBlock
                key={group.id}
                group={group}
                questions={questions}
                answers={answers}
                onAnswer={handleAnswer}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
