/**
 * The Reading answer sheet. Implements plan 010 "Runner UI".
 *
 * Split pane: the passage on the left, its questions on the right, a 60:00
 * countdown in the toolbar. That layout is not a style choice — an IELTS
 * Reading candidate reads and answers at the same time, and a runner that made
 * them scroll between the two would be testing memory rather than reading.
 *
 * Answers live in component state and are persisted ONLY on submit. A
 * half-finished paper is not a session: writing one to storage would put a
 * band in the learner's history for a test they never completed, and the error
 * profile and the Reading history would both then describe something that did
 * not happen.
 *
 * The clock derives from a wall-clock deadline rather than by counting ticks,
 * for the reason `App.tsx` gives for the writing exam: browsers throttle
 * intervals in hidden tabs, so tick counting hands a learner free exam time
 * whenever they switch away.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReadingRunnerProps } from '../types'
import type {
  CompletionQuestion,
  ReadingAnswers,
  ReadingPassage,
  ReadingQuestion,
  ReadingQuestionType,
} from '../reading/types'
import { READING_MINUTES } from '../reading/types'
import { READING_TYPE_META, wordLimitLabel } from '../meta'
import { countWords, normaliseAnswer } from '../marking/markAnswerKey'
import Timer from './Timer'
import './ReadingRunner.css'

/* --------------------------------- helpers --------------------------------- */

const TOTAL_SECONDS = READING_MINUTES * 60

/** The three fixed choices for the two agree/disagree types. */
const TFNG_CHOICES = ['TRUE', 'FALSE', 'NOT GIVEN']
const YNNG_CHOICES = ['YES', 'NO', 'NOT GIVEN']

/** Multiple-choice options are printed A, B, C, D — the letter is display only. */
const OPTION_LETTERS = 'ABCDEFGH'

/**
 * A printed block of questions: a run of CONSECUTIVE questions sharing a type.
 *
 * Real papers print one instruction above each such run ("Choose the correct
 * letter, A, B, C or D. Questions 23–26"), not one above every question, and
 * grouping is what lets a shared heading bank be printed once for the set that
 * uses it.
 */
interface QuestionGroup {
  key: string
  type: ReadingQuestionType
  questions: ReadingQuestion[]
}

function groupByType(questions: ReadingQuestion[]): QuestionGroup[] {
  const groups: QuestionGroup[] = []
  for (const question of questions) {
    const last = groups[groups.length - 1]
    if (last !== undefined && last.type === question.type) last.questions.push(question)
    else groups.push({ key: question.id, type: question.type, questions: [question] })
  }
  return groups
}

/** "Questions 23–26", or "Question 23" when a group holds one. */
function groupRangeLabel(group: QuestionGroup): string {
  const first = group.questions[0].number
  const last = group.questions[group.questions.length - 1].number
  return first === last ? `Question ${first}` : `Questions ${first}–${last}`
}

/** Has this question been answered? Blank and whitespace both mean "no". */
function isAnswered(answers: ReadingAnswers, id: string): boolean {
  return normaliseAnswer(answers[id]) !== ''
}

/* -------------------------------- passage pane ------------------------------ */

function PassagePane({ passage }: { passage: ReadingPassage }) {
  return (
    <article className="rr-passage" aria-label={passage.heading}>
      <p className="eyebrow rr-passage-eyebrow">{passage.heading}</p>
      {passage.texts.map((text, i) => (
        // General Training Section 1 prints two or three short texts where an
        // Academic passage prints one, so this is a LIST, never a single body.
        <section className="rr-text" key={`${passage.id}-t${i}`}>
          <h2 className="rr-text-title">{text.title}</h2>
          {text.subtitle !== undefined && <p className="rr-text-subtitle">{text.subtitle}</p>}
          {text.paragraphs.map((paragraph, j) => (
            <p className="rr-para" key={`${passage.id}-t${i}-p${j}`}>
              {/* The letter only prints when the paper labels the paragraph —
                  an unlabelled paragraph must not grow a phantom letter. */}
              {paragraph.label !== undefined && (
                <span className="rr-para-label mono" aria-hidden="true">
                  {paragraph.label}
                </span>
              )}
              {paragraph.label !== undefined && (
                <span className="rr-sr">Paragraph {paragraph.label}. </span>
              )}
              {paragraph.text}
            </p>
          ))}
        </section>
      ))}
      <p className="rr-source">
        {passage.source.description} Licence: {passage.source.licence}.
        {passage.source.attribution !== undefined && ` ${passage.source.attribution}`}
      </p>
    </article>
  )
}

/* ------------------------------- question widgets --------------------------- */

interface RowProps {
  question: ReadingQuestion
  value: string
  onChange: (value: string) => void
}

/** One radio set — the shape both Not Given types and multiple choice take. */
function ChoiceRow({
  question,
  value,
  onChange,
  choices,
  letters,
}: RowProps & { choices: string[]; letters: boolean }) {
  return (
    <fieldset className="rr-q rr-q-choice">
      <legend className="rr-q-prompt">
        <span className="rr-qnum mono">{question.number}</span>
        {question.prompt}
      </legend>
      <div className={letters ? 'rr-choices rr-choices-stacked' : 'rr-choices'}>
        {choices.map((choice, i) => (
          <label className="rr-choice" key={choice}>
            <input
              type="radio"
              name={`q-${question.id}`}
              value={choice}
              checked={value === choice}
              onChange={() => onChange(choice)}
            />
            {letters && (
              <span className="rr-choice-letter mono" aria-hidden="true">
                {OPTION_LETTERS[i]}
              </span>
            )}
            <span className="rr-choice-text">{choice}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * A gap to type into.
 *
 * The live word count is measured with the MARKER's own `normaliseAnswer` and
 * `countWords`, not with a second implementation: a warning that disagreed with
 * the marking would be worse than no warning, because the learner would trust
 * it. Over the limit is shown in amber — it is a warning while the paper is
 * open and only becomes an error once it is marked.
 */
function CompletionRow({
  question,
  value,
  onChange,
}: Omit<RowProps, 'question'> & { question: CompletionQuestion }) {
  const maxWords = question.maxWords
  const words = countWords(normaliseAnswer(value))
  const over = maxWords > 0 && words > maxWords
  const inputId = `rr-input-${question.id}`

  return (
    <div className="rr-q rr-q-completion">
      <label className="rr-q-prompt" htmlFor={inputId}>
        <span className="rr-qnum mono">{question.number}</span>
        {question.prompt}
      </label>
      <div className="rr-completion-field">
        <input
          id={inputId}
          className={over ? 'rr-input rr-input-over' : 'rr-input'}
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={`${inputId}-limit`}
        />
        <span id={`${inputId}-limit`} className={over ? 'rr-limit rr-limit-over' : 'rr-limit'}>
          {over
            ? `${words} words — over the limit, this will be marked wrong`
            : wordLimitLabel(maxWords)}
        </span>
      </div>
    </div>
  )
}

/** A select — matching headings and matching information both answer this way. */
function SelectRow({
  question,
  value,
  onChange,
  options,
  placeholder,
}: RowProps & { options: Array<{ value: string; label: string }>; placeholder: string }) {
  const selectId = `rr-select-${question.id}`
  return (
    <div className="rr-q rr-q-select">
      <label className="rr-q-prompt" htmlFor={selectId}>
        <span className="rr-qnum mono">{question.number}</span>
        {question.prompt}
      </label>
      <select
        id={selectId}
        className="rr-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function QuestionRow({ question, value, onChange }: RowProps) {
  switch (question.type) {
    case 'true-false-notgiven':
      return (
        <ChoiceRow
          question={question}
          value={value}
          onChange={onChange}
          choices={TFNG_CHOICES}
          letters={false}
        />
      )
    case 'yes-no-notgiven':
      return (
        <ChoiceRow
          question={question}
          value={value}
          onChange={onChange}
          choices={YNNG_CHOICES}
          letters={false}
        />
      )
    case 'multiple-choice':
      // The stored answer is the OPTION TEXT, never its letter, so marking can
      // never depend on the order the options happen to be printed in.
      return (
        <ChoiceRow
          question={question}
          value={value}
          onChange={onChange}
          choices={question.options}
          letters
        />
      )
    case 'completion':
      return <CompletionRow question={question} value={value} onChange={onChange} />
    case 'matching-headings':
      return (
        <SelectRow
          question={question}
          value={value}
          onChange={onChange}
          placeholder="Choose a heading"
          options={question.headings.map((heading) => ({
            value: heading.id,
            label: `${heading.id} — ${heading.text}`,
          }))}
        />
      )
    case 'matching-information':
      return (
        <SelectRow
          question={question}
          value={value}
          onChange={onChange}
          placeholder="Choose a paragraph"
          options={question.paragraphLabels.map((label) => ({
            value: label,
            label: `Paragraph ${label}`,
          }))}
        />
      )
  }
}

function GroupBlock({
  group,
  answers,
  onAnswer,
}: {
  group: QuestionGroup
  answers: ReadingAnswers
  onAnswer: (id: string, value: string) => void
}) {
  const meta = READING_TYPE_META[group.type]
  const first = group.questions[0]
  // Every question in a matching-headings set shares one bank, so it is printed
  // once above the set exactly as the paper prints it.
  const headings = first.type === 'matching-headings' ? first.headings : null
  const limit = first.type === 'completion' ? first.maxWords : null

  return (
    <section className="rr-group" aria-label={groupRangeLabel(group)}>
      <header className="rr-group-head">
        <h2 className="rr-group-range">{groupRangeLabel(group)}</h2>
        <p className="rr-group-instruction">
          {meta.instruction}
          {limit !== null && ` Write ${wordLimitLabel(limit)} for each answer.`}
        </p>
      </header>

      {headings !== null && (
        <div className="rr-headings card">
          <p className="eyebrow">List of headings</p>
          <ul className="rr-headings-list">
            {headings.map((heading) => (
              <li key={heading.id}>
                <span className="rr-heading-id mono">{heading.id}</span>
                {heading.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ol className="rr-q-list">
        {group.questions.map((question) => (
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

export default function ReadingRunner({ test, onSubmit, onExit }: ReadingRunnerProps) {
  const [answers, setAnswers] = useState<ReadingAnswers>({})
  const [activePassage, setActivePassage] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS)

  // Set once, on mount: the clock starts when the paper opens, and a re-render
  // must never move the deadline.
  const deadlineRef = useRef<number>(Date.now() + TOTAL_SECONDS * 1000)
  const submittedRef = useRef(false)
  const answersRef = useRef(answers)
  answersRef.current = answers

  const questionsByPassage = useMemo(
    () => test.passages.map((_, i) => test.questions.filter((q) => q.passageIndex === i)),
    [test],
  )
  const groups = useMemo(
    () => groupByType(questionsByPassage[activePassage] ?? []),
    [questionsByPassage, activePassage],
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
  function submit(): void {
    if (submittedRef.current) return
    submittedRef.current = true
    const remaining = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000))
    const used = Math.min(TOTAL_SECONDS, Math.max(0, TOTAL_SECONDS - remaining))
    onSubmit({ ...answersRef.current }, used)
  }

  const submitRef = useRef(submit)
  submitRef.current = submit

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000))
      setSecondsLeft(left)
      // Time is up: the paper goes in as it stands, exactly as in the exam hall.
      if (left === 0) submitRef.current()
    }
    const id = setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

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
      'Leave this Reading test? The clock is running and your answers will not be saved.',
    )
    if (go) onExit()
  }

  const passage = test.passages[activePassage]

  return (
    <div className="rr">
      <header className="rr-toolbar">
        <div className="rr-toolbar-left">
          <p className="eyebrow rr-test-title">{test.title}</p>
          <div className="rr-tabs" role="tablist" aria-label="Reading passages">
            {test.passages.map((p, i) => {
              const done = questionsByPassage[i].filter((q) => isAnswered(answers, q.id)).length
              return (
                <button
                  key={p.id}
                  role="tab"
                  aria-selected={i === activePassage}
                  className={i === activePassage ? 'rr-tab active' : 'rr-tab'}
                  onClick={() => setActivePassage(i)}
                >
                  {p.heading}
                  <span className="rr-tab-count mono">
                    {done}/{questionsByPassage[i].length}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="rr-toolbar-right">
          <span className="rr-progress mono" aria-live="off">
            {answeredCount} of {test.questions.length} answered
          </span>
          <Timer secondsLeft={secondsLeft} totalSeconds={TOTAL_SECONDS} running />
          <button className="btn" onClick={handleExit}>
            Leave test
          </button>
          <button className="btn btn-primary" onClick={handleSubmitClick}>
            Submit answers
          </button>
        </div>
      </header>

      <div className="rr-panes">
        <div className="rr-pane rr-pane-passage">
          {passage !== undefined && <PassagePane passage={passage} />}
        </div>
        <div className="rr-pane rr-pane-questions">
          {groups.length === 0 ? (
            <p className="rr-empty">This section has no questions.</p>
          ) : (
            groups.map((group) => (
              <GroupBlock
                key={group.key}
                group={group}
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
