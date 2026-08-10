import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import type {
  AppProps,
  Issue,
  IssueCategory,
  PromptSpec,
  SessionRecord,
  Task1PromptSpec,
  TaskKind,
  WritingMode,
} from './types'
import { TASK_CONSTANTS } from './meta'
import { analyzeEssay, analyzeTask1 } from './analysis/engine'
import { deleteSession, exportData, importData, loadSessions, saveSession } from './profile/store'
import { computeProfile, computeTrends } from './profile/profile'
import { PROMPTS, randomPrompt } from './prompts/bank'
import { TASK1_PROMPTS, randomTask1Prompt } from './prompts/task1Bank'
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

type View = 'write' | 'report' | 'dashboard'
type ExamState = 'idle' | 'running'
type PanelTab = 'feedback' | 'cheatsheet' | 'model'

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

export default function App({ initialPrompt, initialTask1Prompt }: AppProps = {}) {
  const [view, setView] = useState<View>('write')
  const [mode, setMode] = useState<WritingMode>('coach')
  const [task, setTask] = useState<TaskKind>('task2')
  const [prompt, setPrompt] = useState<PromptSpec | null>(() => initialPrompt ?? randomPrompt())
  // Two prompt slots rather than one union: switching task and switching back
  // should return the learner to the question they were already looking at.
  const [task1Prompt, setTask1Prompt] = useState<Task1PromptSpec>(
    () => initialTask1Prompt ?? randomTask1Prompt(),
  )
  const [essayText, setEssayText] = useState('')
  const [sessions, setSessions] = useState<SessionRecord[]>(() => loadSessions())
  const [reportSessionId, setReportSessionId] = useState<string | null>(null)
  const [focusIssueId, setFocusIssueId] = useState<string | null>(null)
  const [examState, setExamState] = useState<ExamState>('idle')
  const [examSecondsLeft, setExamSecondsLeft] = useState(TASK_CONSTANTS.task2.examDurationSec)
  const [panelTab, setPanelTab] = useState<PanelTab>('feedback')
  const submittingRef = useRef(false)
  const pacingRef = useRef<Array<{ t: number; words: number }>>([])
  const pasteAttemptsRef = useRef(0)
  const examDeadlineRef = useRef<number | null>(null)
  const essayTextRef = useRef(essayText)
  essayTextRef.current = essayText
  const handleSubmitRef = useRef<() => void>(() => {})

  const taskConstants = TASK_CONSTANTS[task]
  const debouncedText = useDebounced(essayText, 400)
  const analysis = useMemo(() => {
    if (mode !== 'coach') return null
    return task === 'task1'
      ? analyzeTask1(debouncedText, task1Prompt)
      : analyzeEssay(debouncedText, prompt)
  }, [debouncedText, prompt, task1Prompt, mode, task])
  const profile = useMemo(() => computeProfile(sessions), [sessions])
  const trends = useMemo(() => computeTrends(sessions), [sessions])
  const liveWordCount = countWords(essayText)

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
    const finalAnalysis =
      task === 'task1' ? analyzeTask1(essayText, task1Prompt) : analyzeEssay(essayText, prompt)
    const activeSpec = task === 'task1' ? task1Prompt : prompt
    const record: SessionRecord = {
      id: makeId(),
      dateISO: new Date().toISOString(),
      mode,
      task,
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
    if (task === 'task1') setTask1Prompt(randomTask1Prompt())
    else setPrompt(nextPrompt ?? randomPrompt())
    setEssayText('')
    setFocusIssueId(null)
    setExamState('idle')
    setExamSecondsLeft(taskConstants.examDurationSec)
    setMode('coach')
    setView('write')
  }

  function handleRedraft(session: SessionRecord) {
    submittingRef.current = false
    examDeadlineRef.current = null
    setTask(session.task)
    if (session.task === 'task1') {
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
  const reportSession = sessions.find((s) => s.id === reportSessionId) ?? null
  const previousSession = reportSession
    ? sessions.filter((s) => s.dateISO < reportSession.dateISO).slice(-1)[0] ?? null
    : null

  const inExam = mode === 'exam' && view === 'write'
  const inlineIssues =
    mode === 'coach' && analysis ? analysis.issues.filter((i) => i.start != null) : []

  return (
    <div className={`app${inExam ? ' app-exam' : ''}`}>
      <header className="topbar">
        <div className="topbar-left">
          <span className="brand">
            IELTS <em>Coach</em>
          </span>
          {!inExam && (
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
                className={view === 'dashboard' ? 'nav-link active' : 'nav-link'}
                onClick={() => setView('dashboard')}
              >
                Progress
              </button>
            </nav>
          )}
        </div>

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
              />
            </aside>
          )}

          <section className="sheet-zone">
            {task === 'task1' ? (
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
                  <PromptPicker prompts={PROMPTS} current={prompt} onPick={(p) => setPrompt(p)} />
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
                    ? task === 'task1'
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
                  task1Prompt={task === 'task1' ? task1Prompt : null}
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

      {view === 'dashboard' && (
        <main className="page">
          <Dashboard
            sessions={sessions}
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
