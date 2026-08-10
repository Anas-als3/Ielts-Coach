import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import type {
  AppProps,
  Issue,
  IssueCategory,
  LetterPromptSpec,
  Module,
  PromptSpec,
  ReadingSessionRecord,
  SessionRecord,
  Task1PromptSpec,
  TaskKind,
  WritingMode,
  WritingSessionRecord,
} from './types'
import { isReadingSession, isWritingSession } from './types'
import type { ReadingAnswers } from './reading/types'
import { MODULE_META, TASK_CONSTANTS } from './meta'
import { analyzeEssay, analyzeLetter, analyzeTask1 } from './analysis/engine'
import { deleteSession, exportData, importData, loadSessions, saveSession } from './profile/store'
import { computeProfile, computeTrends } from './profile/profile'
import { PROMPTS, promptsForModule, randomPrompt, suitsModule } from './prompts/bank'
import { TASK1_PROMPTS, randomTask1Prompt } from './prompts/task1Bank'
import { LETTER_PROMPTS, randomLetterPrompt } from './prompts/letterBank'
import { readingTestById, readingTestsForModule } from './reading/tests'
import { markAnswerKey } from './marking/markAnswerKey'
import Chart from './components/Chart'
import Editor from './components/Editor'
import StructureRail from './components/StructureRail'
import FeedbackPanel from './components/FeedbackPanel'
import Timer from './components/Timer'
import Report from './components/Report'
import Dashboard from './components/Dashboard'
import PromptPicker from './components/PromptPicker'
import CheatSheet from './components/CheatSheet'
import ModelAnswer from './components/ModelAnswer'
import ReadingRunner from './components/ReadingRunner'
import ReadingReport from './components/ReadingReport'
import ReadingPicker from './components/ReadingPicker'

type View = 'write' | 'report' | 'dashboard' | 'reading'
type ExamState = 'idle' | 'running'
type PanelTab = 'feedback' | 'cheatsheet' | 'model'
/** Where the learner is inside the Reading section: choosing, sitting, reviewing. */
type ReadingStage = 'picker' | 'running' | 'report'

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}

function countWords(text: string): number {
  const m = text.match(/[A-Za-zÀ-ɏ'’-]+/g)
  return m ? m.length : 0
}

export default function App({ initialPrompt, initialTask1Prompt, initialLetterPrompt }: AppProps = {}) {
  const [view, setView] = useState<View>('write')
  const [mode, setMode] = useState<WritingMode>('coach')
  const [task, setTask] = useState<TaskKind>('task2')
  // Academic is the default because it is the exam the app was built for.
  const [module, setModule] = useState<Module>('academic')
  const [prompt, setPrompt] = useState<PromptSpec | null>(() => initialPrompt ?? randomPrompt())
  // THREE prompt slots rather than one union: switching task or exam and
  // switching back should return the learner to the question they were already
  // looking at. Task 1 is a different task in the two exams — a chart in
  // Academic, a letter in General Training — so those two need separate slots
  // even though they share the TaskKind 'task1'.
  const [task1Prompt, setTask1Prompt] = useState<Task1PromptSpec>(
    () => initialTask1Prompt ?? randomTask1Prompt(),
  )
  const [letterPrompt, setLetterPrompt] = useState<LetterPromptSpec>(
    () => initialLetterPrompt ?? randomLetterPrompt(),
  )
  const [essayText, setEssayText] = useState('')
  const [sessions, setSessions] = useState<SessionRecord[]>(() => loadSessions())
  const [reportSessionId, setReportSessionId] = useState<string | null>(null)
  const [focusIssueId, setFocusIssueId] = useState<string | null>(null)
  const [examState, setExamState] = useState<ExamState>('idle')
  const [examSecondsLeft, setExamSecondsLeft] = useState(TASK_CONSTANTS.task2.examDurationSec)
  const [panelTab, setPanelTab] = useState<PanelTab>('feedback')
  const [readingStage, setReadingStage] = useState<ReadingStage>('picker')
  const [readingTestId, setReadingTestId] = useState<string | null>(null)
  const [readingSessionId, setReadingSessionId] = useState<string | null>(null)
  const submittingRef = useRef(false)
  const pacingRef = useRef<Array<{ t: number; words: number }>>([])
  const pasteAttemptsRef = useRef(0)
  const examDeadlineRef = useRef<number | null>(null)
  const essayTextRef = useRef(essayText)
  essayTextRef.current = essayText
  const handleSubmitRef = useRef<() => void>(() => {})

  const taskConstants = TASK_CONSTANTS[task]
  // Task 2 is marked identically in both exams, so the only module-dependent
  // thing here is WHICH questions are offered: abstract topics are not asked of
  // General Training candidates.
  const modulePrompts = useMemo(() => promptsForModule(module), [module])
  /**
   * General Training Task 1 is a LETTER, not a chart description. This one flag
   * routes the analysis, the sheet, the rail and the model answer, so the two
   * tasks that share the id 'task1' can never be marked by each other's rules.
   */
  const isLetter = module === 'general' && task === 'task1'
  const debouncedText = useDebounced(essayText, 400)
  const analysis = useMemo(() => {
    if (mode !== 'coach') return null
    if (isLetter) return analyzeLetter(debouncedText, letterPrompt)
    return task === 'task1'
      ? analyzeTask1(debouncedText, task1Prompt)
      : analyzeEssay(debouncedText, prompt)
  }, [debouncedText, prompt, task1Prompt, letterPrompt, mode, task, isLetter])
  const profile = useMemo(() => computeProfile(sessions), [sessions])
  const trends = useMemo(() => computeTrends(sessions), [sessions])
  const liveWordCount = countWords(essayText)

  /* --------------------------------- reading -------------------------------- */
  // Only the ACTIVE exam's papers, ever. The two modules' papers are structured
  // differently and — the part that would actually mislead a learner — are
  // converted by different tables, so offering the wrong one would report a
  // band that is simply not theirs.
  const readingTests = useMemo(() => readingTestsForModule(module), [module])
  const readingTest = useMemo(
    () => (readingTestId === null ? null : readingTestById(readingTestId)),
    [readingTestId],
  )
  // The Writing views read `analysis`, `essayText` and `task` on nearly every
  // line, so they are handed the writing sessions only; Reading has its own
  // report and its own history list below the paper picker.
  const writingSessions = useMemo<WritingSessionRecord[]>(
    () => sessions.filter(isWritingSession),
    [sessions],
  )
  const readingHistory = useMemo<ReadingSessionRecord[]>(
    () =>
      sessions
        .filter(isReadingSession)
        .filter((s) => s.module === module)
        .slice()
        .reverse(),
    [sessions, module],
  )
  const readingSession = useMemo<ReadingSessionRecord | null>(
    () => sessions.filter(isReadingSession).find((s) => s.id === readingSessionId) ?? null,
    [sessions, readingSessionId],
  )

  /* ------------------------------- exam timer ------------------------------- */
  // The countdown derives from a wall-clock deadline, not tick counting:
  // browsers throttle intervals in hidden tabs, and tick counting would hand a
  // learner free exam time whenever they switch tabs. Side effects (pacing
  // samples) live in the interval callback, never inside a setState updater —
  // React is free to invoke updaters twice.
  useEffect(() => {
    if (examState !== 'running') return
    const tick = () => {
      const deadline = examDeadlineRef.current
      if (deadline == null) return
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000))
      const elapsed = taskConstants.examDurationSec - left
      const lastSampleT = pacingRef.current.length
        ? pacingRef.current[pacingRef.current.length - 1].t
        : 0
      const boundary = Math.floor(elapsed / 30) * 30
      if (boundary > lastSampleT) {
        pacingRef.current.push({ t: boundary, words: countWords(essayTextRef.current) })
      }
      setExamSecondsLeft(left)
    }
    const t = setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [examState, taskConstants.examDurationSec])

  /* Switching task resets the clock to that task's duration. Guarded on
     examState so a running exam is never silently re-timed — switchTask
     refuses to switch while the clock runs without confirmation. */
  useEffect(() => {
    if (examState === 'idle') setExamSecondsLeft(taskConstants.examDurationSec)
  }, [taskConstants.examDurationSec, examState])

  useEffect(() => {
    if (examState === 'running' && examSecondsLeft === 0) handleSubmit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examSecondsLeft, examState])

  /* Cmd/Ctrl+Enter submits from the keyboard, matching the header button. */
  useEffect(() => {
    if (view !== 'write') return
    const canSubmit = mode === 'coach' || examState === 'running'
    const onKey = (e: KeyboardEvent) => {
      if (!canSubmit || !(e.metaKey || e.ctrlKey) || e.key !== 'Enter') return
      if (countWords(essayTextRef.current) === 0) return
      e.preventDefault()
      handleSubmitRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, mode, examState])

  /* --------------------------------- actions -------------------------------- */
  handleSubmitRef.current = () => handleSubmit()

  function handleSubmit() {
    if (submittingRef.current) return
    submittingRef.current = true
    try {
      submitInner()
    } catch (err) {
      // Reset only on failure — after success the ref must stay true so a
      // double-fired timer expiry can never save the same essay twice.
      submittingRef.current = false
      throw err
    }
  }

  function makeId(): string {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('')
  }

  function submitInner() {
    const secondsUsed =
      examDeadlineRef.current != null
        ? Math.min(
            taskConstants.examDurationSec,
            Math.max(
              0,
              taskConstants.examDurationSec - Math.round((examDeadlineRef.current - Date.now()) / 1000),
            ),
          )
        : taskConstants.examDurationSec - examSecondsLeft
    const finalAnalysis = isLetter
      ? analyzeLetter(essayText, letterPrompt)
      : task === 'task1'
        ? analyzeTask1(essayText, task1Prompt)
        : analyzeEssay(essayText, prompt)
    const activeSpec = isLetter ? letterPrompt : task === 'task1' ? task1Prompt : prompt
    const record: WritingSessionRecord = {
      // schemaVersion 4's discriminator, stated at the point of creation rather
      // than left to the migration: only records written by an older build are
      // the migration's business.
      section: 'writing',
      id: makeId(),
      dateISO: new Date().toISOString(),
      mode,
      task,
      module,
      promptId: activeSpec?.id ?? null,
      promptText: activeSpec?.text ?? '',
      questionType: task === 'task1' ? null : prompt?.type ?? null,
      essayText,
      durationSec: mode === 'exam' ? secondsUsed : null,
      pacing: mode === 'exam' && pacingRef.current.length ? [...pacingRef.current] : null,
      pasteAttempts: mode === 'exam' ? pasteAttemptsRef.current : null,
      analysis: finalAnalysis,
    }
    saveSession(record)
    // Re-read the store so in-memory state always matches persistence (cap, sort).
    setSessions(loadSessions())
    setReportSessionId(record.id)
    setExamState('idle')
    setExamSecondsLeft(taskConstants.examDurationSec)
    examDeadlineRef.current = null
    setView('report')
    // submittingRef stays true until a new writing session starts, so a
    // double-fired timer expiry can never save the same essay twice.
  }

  function startNewEssay(nextPrompt?: PromptSpec | null) {
    submittingRef.current = false
    examDeadlineRef.current = null
    if (isLetter) setLetterPrompt(randomLetterPrompt())
    else if (task === 'task1') setTask1Prompt(randomTask1Prompt())
    // Draw from the active exam's pool: a General Training learner asked to
    // write about globalisation theory has been handed the wrong exam.
    else setPrompt(nextPrompt ?? randomPrompt(module))
    setEssayText('')
    setFocusIssueId(null)
    setExamState('idle')
    setExamSecondsLeft(taskConstants.examDurationSec)
    setMode('coach')
    setView('write')
  }

  function handleRedraft(session: WritingSessionRecord) {
    submittingRef.current = false
    examDeadlineRef.current = null
    setTask(session.task)
    // Redrafting must reopen the exam the essay was written for, or the picker
    // would not list the very prompt being redrafted.
    setModule(session.module)
    if (session.task === 'task1' && session.module === 'general') {
      const letter = LETTER_PROMPTS.find((x) => x.id === session.promptId)
      if (letter) setLetterPrompt(letter)
    } else if (session.task === 'task1') {
      const t1 = TASK1_PROMPTS.find((x) => x.id === session.promptId)
      if (t1) setTask1Prompt(t1)
    } else {
      setPrompt(PROMPTS.find((x) => x.id === session.promptId) ?? null)
    }
    setEssayText(session.essayText)
    setMode('coach')
    setExamState('idle')
    setView('write')
  }

  function switchTask(next: TaskKind) {
    if (next === task) return
    if (mode === 'exam' && examState === 'running') {
      const leave = window.confirm(
        'The exam clock is running. Switch task and abandon this attempt?',
      )
      if (!leave) return
    }
    submittingRef.current = false
    examDeadlineRef.current = null
    setTask(next)
    // A Task 2 essay sitting in a Task 1 answer sheet would be scored against
    // the wrong rules and produce confidently wrong feedback.
    setEssayText('')
    setExamState('idle')
    setExamSecondsLeft(TASK_CONSTANTS[next].examDurationSec)
    setFocusIssueId(null)
    // The cheat sheet is Task 2 only, so that tab cannot survive the switch.
    if (next === 'task1' && panelTab === 'cheatsheet') setPanelTab('feedback')
  }

  function switchModule(next: Module) {
    if (next === module) return
    // A running WRITING exam is only abandoned with consent. A running READING
    // test cannot reach here at all: the runner clears the chrome for its
    // duration, so this control is off screen until the paper is submitted.
    if (view === 'write' && mode === 'exam' && examState === 'running') {
      const leave = window.confirm(
        'The exam clock is running. Switch exam type and abandon this attempt?',
      )
      if (!leave) return
    }
    setModule(next)
    // A prompt the new exam does not ask disappears from the picker, so leaving
    // it selected would strand the learner on a question they cannot see listed.
    // Prompts that suit both exams — the majority — survive the switch, which is
    // why the seeded test prompt stays put and the UI suite stays deterministic.
    setPrompt((current) => (current && suitsModule(current, next) ? current : randomPrompt(next)))
    // The answer sheet is cleared only when the learner is looking at it. Task 1
    // is a different task in the two exams, so an answer written for one cannot
    // be marked against the other — but switching exam from the READING section
    // must not silently destroy an essay in progress on the writing desk.
    if (view !== 'write') return
    submittingRef.current = false
    examDeadlineRef.current = null
    setEssayText('')
    setExamState('idle')
    setFocusIssueId(null)
  }

  /* --------------------------------- reading -------------------------------- */

  function openReading() {
    setView('reading')
    // A stale report from a previous sitting is not what "Reading" means; the
    // section always opens on the list of papers unless a paper is being sat.
    if (readingStage === 'report') setReadingStage('picker')
  }

  function startReadingTest(testId: string) {
    setReadingTestId(testId)
    setReadingSessionId(null)
    setReadingStage('running')
  }

  /**
   * Persist a sat paper. The ONLY place a Reading session is written — the
   * runner holds answers in memory until this is called, so an abandoned
   * attempt leaves no band in the learner's history.
   */
  function handleReadingSubmit(answers: ReadingAnswers, durationSec: number) {
    const test = readingTest
    if (test === null) {
      setReadingStage('picker')
      return
    }
    const record: ReadingSessionRecord = {
      section: 'reading',
      id: makeId(),
      dateISO: new Date().toISOString(),
      // Taken from the TEST, not from the app's current toggle: the paper was
      // marked against its own module's table, and a learner who flips the
      // toggle afterwards must not have their band relabelled.
      module: test.module,
      testId: test.id,
      testTitle: test.title,
      answers,
      result: markAnswerKey(test, answers),
      durationSec,
    }
    saveSession(record)
    // Re-read the store so in-memory state always matches persistence (cap, sort).
    setSessions(loadSessions())
    setReadingSessionId(record.id)
    setReadingStage('report')
  }

  function openReadingSession(session: ReadingSessionRecord) {
    setReadingTestId(session.testId)
    setReadingSessionId(session.id)
    setReadingStage('report')
  }

  function switchMode(next: WritingMode) {
    if (next === mode) return
    if (mode === 'exam' && examState === 'running') {
      const leave = window.confirm(
        'The exam clock is running. Leave exam mode and abandon this attempt?',
      )
      if (!leave) return
    }
    submittingRef.current = false
    examDeadlineRef.current = null
    setMode(next)
    setExamState('idle')
    setExamSecondsLeft(taskConstants.examDurationSec)
    setFocusIssueId(null)
  }

  function handleImport(json: string) {
    importData(json)
    setSessions(loadSessions())
  }

  function handleDelete(id: string) {
    deleteSession(id)
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }

  function handleStartPractice(_focus: IssueCategory | null) {
    startNewEssay()
  }

  function handleSelectIssue(issue: Issue) {
    if (issue.start != null) setFocusIssueId(issue.id)
  }

  /* --------------------------------- render --------------------------------- */
  const reportSession = writingSessions.find((s) => s.id === reportSessionId) ?? null
  const previousSession = reportSession
    ? writingSessions.filter((s) => s.dateISO < reportSession.dateISO).slice(-1)[0] ?? null
    : null

  const inExam = mode === 'exam' && view === 'write'
  // A Reading paper is exam conditions by definition — there is no coach mode
  // for an answer key — so sitting one clears the desk exactly as exam mode
  // does for writing: no navigation, no exam-type toggle, just the paper.
  const inReadingTest = view === 'reading' && readingStage === 'running'
  const deskCleared = inExam || inReadingTest
  const inlineIssues =
    mode === 'coach' && analysis ? analysis.issues.filter((i) => i.start != null) : []

  return (
    <div className={`app${deskCleared ? ' app-exam' : ''}`}>
      <header className="topbar">
        <div className="topbar-left">
          <span className="brand">
            IELTS <em>Coach</em>
          </span>
          {!deskCleared && (
            <nav className="nav">
              <button
                className={view === 'write' ? 'nav-link active' : 'nav-link'}
                onClick={() => {
                  submittingRef.current = false
                  setView('write')
                }}
              >
                Write
              </button>
              <button
                className={view === 'reading' ? 'nav-link active' : 'nav-link'}
                onClick={openReading}
              >
                Reading
              </button>
              <button
                className={view === 'dashboard' ? 'nav-link active' : 'nav-link'}
                onClick={() => setView('dashboard')}
              >
                Progress
              </button>
            </nav>
          )}
        </div>

        {view === 'reading' && !inReadingTest && (
          <div className="topbar-right">
            {/* The exam type decides which papers exist AND which conversion
                table marks them, so it belongs on screen wherever papers are
                offered — not only on the writing desk. */}
            <div className="mode-toggle module-toggle" role="group" aria-label="IELTS exam type">
              <button
                className={module === 'academic' ? 'mode-btn active' : 'mode-btn'}
                onClick={() => switchModule('academic')}
                title={MODULE_META.academic.blurb}
              >
                Academic
              </button>
              <button
                className={module === 'general' ? 'mode-btn active' : 'mode-btn'}
                onClick={() => switchModule('general')}
                title={MODULE_META.general.blurb}
              >
                General
              </button>
            </div>
          </div>
        )}

        {view === 'write' && (
          <div className="topbar-right">
            <span
              className={`wordcount mono${mode === 'coach' && liveWordCount < taskConstants.minWords ? ' under' : ''}`}
              title={mode === 'coach' ? `Minimum ${taskConstants.minWords} words` : undefined}
            >
              {liveWordCount} words
            </span>
            {inExam && (
              <Timer
                secondsLeft={examSecondsLeft}
                totalSeconds={taskConstants.examDurationSec}
                running={examState === 'running'}
              />
            )}
            <div className="mode-toggle module-toggle" role="group" aria-label="IELTS exam type">
              <button
                className={module === 'academic' ? 'mode-btn active' : 'mode-btn'}
                onClick={() => switchModule('academic')}
                title={MODULE_META.academic.blurb}
              >
                Academic
              </button>
              <button
                className={module === 'general' ? 'mode-btn active' : 'mode-btn'}
                onClick={() => switchModule('general')}
                title={MODULE_META.general.blurb}
              >
                General
              </button>
            </div>
            <div className="mode-toggle task-toggle" role="group" aria-label="IELTS task">
              <button
                className={task === 'task1' ? 'mode-btn active' : 'mode-btn'}
                onClick={() => switchTask('task1')}
              >
                Task 1
              </button>
              <button
                className={task === 'task2' ? 'mode-btn active' : 'mode-btn'}
                onClick={() => switchTask('task2')}
              >
                Task 2
              </button>
            </div>
            <div className="mode-toggle" role="group" aria-label="Writing mode">
              <button
                className={mode === 'coach' ? 'mode-btn active' : 'mode-btn'}
                onClick={() => switchMode('coach')}
              >
                Coach
              </button>
              <button
                className={mode === 'exam' ? 'mode-btn active' : 'mode-btn'}
                onClick={() => switchMode('exam')}
              >
                Exam
              </button>
            </div>
            {(mode === 'coach' || examState === 'running') && (
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={liveWordCount === 0}
                title="Cmd/Ctrl + Enter"
              >
                {mode === 'coach' ? 'Finish & review' : 'Submit'}
              </button>
            )}
          </div>
        )}
      </header>

      {view === 'write' && (
        <main className="workspace">
          {mode === 'coach' && (
            <aside className="rail-zone">
              <StructureRail
                checks={analysis?.structure ?? []}
                paragraphs={analysis?.paragraphs ?? []}
                questionType={task === 'task1' ? null : prompt?.type ?? null}
                task={task}
                module={module}
              />
            </aside>
          )}

          <section className="sheet-zone">
            {isLetter ? (
              <>
                {!inExam && (
                  <div className="t1-picker card">
                    <label className="eyebrow" htmlFor="gt-select">
                      Task 1 letter
                    </label>
                    <select
                      id="gt-select"
                      className="t1-select"
                      value={letterPrompt.id}
                      onChange={(e) => {
                        const next = LETTER_PROMPTS.find((p) => p.id === e.target.value)
                        if (next) setLetterPrompt(next)
                      }}
                    >
                      {LETTER_PROMPTS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.tone} · to {p.recipient}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {/* The bullets ARE the task, so exam mode must show them too:
                    all three have to be covered, and a candidate who cannot see
                    them cannot answer them. The tone is stated on the card
                    because it decides which greeting and sign-off are correct. */}
                <div className="exam-prompt card">
                  <p className="eyebrow">
                    Task 1 · {letterPrompt.tone} letter · write at least {taskConstants.minWords}{' '}
                    words
                  </p>
                  <p className="exam-prompt-text">{letterPrompt.text}</p>
                  <ul className="gt-bullets">
                    {letterPrompt.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              </>
            ) : task === 'task1' ? (
              <>
                  {!inExam && (
                    <div className="t1-picker card">
                      <label className="eyebrow" htmlFor="t1-select">
                        Task 1 question
                      </label>
                      <select
                        id="t1-select"
                        className="t1-select"
                        value={task1Prompt.id}
                        onChange={(e) => {
                          const next = TASK1_PROMPTS.find((p) => p.id === e.target.value)
                          if (next) setTask1Prompt(next)
                        }}
                      >
                        {TASK1_PROMPTS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.chart.kind} · {p.chart.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {/* The chart IS the question, so exam mode must show it too. */}
                  <div className="exam-prompt card">
                    <p className="eyebrow">Task 1 · write at least {taskConstants.minWords} words</p>
                    <p className="exam-prompt-text">{task1Prompt.text}</p>
                    <Chart chart={task1Prompt.chart} />
                  </div>
                </>
              ) : (
                <>
                  {!inExam && (
                    <PromptPicker
                      prompts={modulePrompts}
                      current={prompt}
                      onPick={(p) => setPrompt(p)}
                    />
                  )}
                  {inExam && prompt && (
                    <div className="exam-prompt card">
                      <p className="eyebrow">
                        Task 2 · write at least {taskConstants.minWords} words
                      </p>
                      <p className="exam-prompt-text">{prompt.text}</p>
                    </div>
                  )}
                </>
              )}

              {inExam && examState === 'idle' ? (
                <div className="exam-start card">
                  <h2>Exam conditions</h2>
                  <p>
                    {Math.round(taskConstants.examDurationSec / 60)} minutes, no feedback, no
                    highlights. The full report appears when you submit — exactly like the real thing.
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      pacingRef.current = []
                      pasteAttemptsRef.current = 0
                      submittingRef.current = false
                      examDeadlineRef.current = Date.now() + taskConstants.examDurationSec * 1000
                      setExamState('running')
                    }}
                  >
                    Start the clock
                  </button>
                </div>
              ) : (
                <Editor
                  text={essayText}
                  onChange={setEssayText}
                  issues={inlineIssues}
                  placeholder={
                    mode === 'coach'
                      ? isLetter
                        ? 'Start with the greeting, then say why you are writing. Give each bullet point its own paragraph.'
                        : task === 'task1'
                          ? 'Read the chart first: what is the overall pattern? Open by rewording the title.'
                          : 'Plan first: position, two main ideas, examples. Then write.'
                      : undefined
                  }
                  focusIssueId={focusIssueId}
                  blockPaste={inExam}
                  onPasteBlocked={() => {
                    pasteAttemptsRef.current += 1
                  }}
                  spellCheckEnabled={mode === 'coach'}
                  showHighlights={mode === 'coach' && debouncedText === essayText}
                />
              )}
          </section>

          {mode === 'coach' && (
            <aside className="panel-zone">
              {/* The cheat sheet is Task 2 content. Rather than show a tab that
                  teaches the wrong task, Task 1 gets the feedback panel alone
                  until a Task 1 sheet is written. */}
              <div className="panel-tabs" role="tablist" aria-label="Coach panel">
                <button
                  role="tab"
                  aria-selected={panelTab === 'feedback'}
                  className={panelTab === 'feedback' ? 'panel-tab active' : 'panel-tab'}
                  onClick={() => setPanelTab('feedback')}
                >
                  Feedback
                </button>
                {/* The cheat sheet teaches Task 2 specifically. */}
                {task === 'task2' && (
                  <button
                    role="tab"
                    aria-selected={panelTab === 'cheatsheet'}
                    className={panelTab === 'cheatsheet' ? 'panel-tab active' : 'panel-tab'}
                    onClick={() => setPanelTab('cheatsheet')}
                  >
                    Cheat sheet
                  </button>
                )}
                <button
                  role="tab"
                  aria-selected={panelTab === 'model'}
                  className={panelTab === 'model' ? 'panel-tab active' : 'panel-tab'}
                  onClick={() => setPanelTab('model')}
                >
                  Model answer
                </button>
              </div>
              {panelTab === 'cheatsheet' && task === 'task2' ? (
                <CheatSheet />
              ) : panelTab === 'model' ? (
                <ModelAnswer
                  task={task}
                  prompt={prompt}
                  task1Prompt={task === 'task1' && !isLetter ? task1Prompt : null}
                  letterPrompt={isLetter ? letterPrompt : null}
                />
              ) : (
                <FeedbackPanel
                  analysis={analysis}
                  profile={profile}
                  onSelectIssue={handleSelectIssue}
                  task={task}
                />
              )}
            </aside>
          )}
        </main>
      )}

      {view === 'report' && reportSession && (
        <main className="page">
          <Report
            session={reportSession}
            previousSession={previousSession}
            profile={profile}
            onRedraft={() => handleRedraft(reportSession)}
            onNewEssay={() => startNewEssay()}
            onViewDashboard={() => setView('dashboard')}
          />
        </main>
      )}

      {view === 'reading' && readingStage === 'running' && readingTest !== null && (
        <main className="reading-main">
          <ReadingRunner
            test={readingTest}
            onSubmit={handleReadingSubmit}
            onExit={() => setReadingStage('picker')}
          />
        </main>
      )}

      {view === 'reading' && readingStage === 'report' && readingSession !== null && (
        <main className="page">
          <ReadingReport
            session={readingSession}
            test={readingTestById(readingSession.testId)}
            onRetake={() => startReadingTest(readingSession.testId)}
            onPickAnother={() => setReadingStage('picker')}
          />
        </main>
      )}

      {view === 'reading' &&
        (readingStage === 'picker' ||
          (readingStage === 'running' && readingTest === null) ||
          (readingStage === 'report' && readingSession === null)) && (
          <main className="page">
            <ReadingPicker
              module={module}
              tests={readingTests}
              history={readingHistory}
              onStart={startReadingTest}
              onOpen={openReadingSession}
            />
          </main>
        )}

      {view === 'dashboard' && (
        <main className="page">
          <Dashboard
            sessions={writingSessions}
            profile={profile}
            trends={trends}
            onOpenSession={(id) => {
              setReportSessionId(id)
              setView('report')
            }}
            onStartPractice={handleStartPractice}
            onDeleteSession={handleDelete}
            onExport={exportData}
            onImport={handleImport}
          />
        </main>
      )}
    </div>
  )
}
