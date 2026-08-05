import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import type { Issue, IssueCategory, PromptSpec, SessionRecord, WritingMode } from './types'
import { EXAM_DURATION_SEC, MIN_WORDS } from './meta'
import { analyzeEssay } from './analysis/engine'
import { deleteSession, exportData, importData, loadSessions, saveSession } from './profile/store'
import { computeProfile, computeTrends } from './profile/profile'
import { PROMPTS, randomPrompt } from './prompts/bank'
import Editor from './components/Editor'
import StructureRail from './components/StructureRail'
import FeedbackPanel from './components/FeedbackPanel'
import Timer from './components/Timer'
import Report from './components/Report'
import Dashboard from './components/Dashboard'
import PromptPicker from './components/PromptPicker'
import CheatSheet from './components/CheatSheet'

type View = 'write' | 'report' | 'dashboard'
type ExamState = 'idle' | 'running'

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

export default function App() {
  const [view, setView] = useState<View>('write')
  const [mode, setMode] = useState<WritingMode>('coach')
  const [prompt, setPrompt] = useState<PromptSpec | null>(() => randomPrompt())
  const [essayText, setEssayText] = useState('')
  const [sessions, setSessions] = useState<SessionRecord[]>(() => loadSessions())
  const [reportSessionId, setReportSessionId] = useState<string | null>(null)
  const [focusIssueId, setFocusIssueId] = useState<string | null>(null)
  const [examState, setExamState] = useState<ExamState>('idle')
  const [examSecondsLeft, setExamSecondsLeft] = useState(EXAM_DURATION_SEC)
  const [panelTab, setPanelTab] = useState<'feedback' | 'cheatsheet'>('feedback')
  const submittingRef = useRef(false)
  const pacingRef = useRef<Array<{ t: number; words: number }>>([])
  const pasteAttemptsRef = useRef(0)
  const examDeadlineRef = useRef<number | null>(null)
  const essayTextRef = useRef(essayText)
  essayTextRef.current = essayText
  const handleSubmitRef = useRef<() => void>(() => {})

  const debouncedText = useDebounced(essayText, 400)
  const analysis = useMemo(
    () => (mode === 'coach' ? analyzeEssay(debouncedText, prompt) : null),
    [debouncedText, prompt, mode],
  )
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
      const elapsed = EXAM_DURATION_SEC - left
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
  }, [examState])

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
            EXAM_DURATION_SEC,
            Math.max(
              0,
              EXAM_DURATION_SEC - Math.round((examDeadlineRef.current - Date.now()) / 1000),
            ),
          )
        : EXAM_DURATION_SEC - examSecondsLeft
    const finalAnalysis = analyzeEssay(essayText, prompt)
    const record: SessionRecord = {
      id: makeId(),
      dateISO: new Date().toISOString(),
      mode,
      task: 'task2',
      promptId: prompt?.id ?? null,
      promptText: prompt?.text ?? '',
      questionType: prompt?.type ?? null,
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
    setExamSecondsLeft(EXAM_DURATION_SEC)
    examDeadlineRef.current = null
    setView('report')
    // submittingRef stays true until a new writing session starts, so a
    // double-fired timer expiry can never save the same essay twice.
  }

  function startNewEssay(nextPrompt?: PromptSpec | null) {
    submittingRef.current = false
    examDeadlineRef.current = null
    setPrompt(nextPrompt ?? randomPrompt())
    setEssayText('')
    setFocusIssueId(null)
    setExamState('idle')
    setExamSecondsLeft(EXAM_DURATION_SEC)
    setMode('coach')
    setView('write')
  }

  function handleRedraft(session: SessionRecord) {
    submittingRef.current = false
    examDeadlineRef.current = null
    const p = PROMPTS.find((x) => x.id === session.promptId) ?? null
    setPrompt(p)
    setEssayText(session.essayText)
    setMode('coach')
    setExamState('idle')
    setView('write')
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
    setExamSecondsLeft(EXAM_DURATION_SEC)
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
              className={`wordcount mono${mode === 'coach' && liveWordCount < MIN_WORDS ? ' under' : ''}`}
              title={mode === 'coach' ? `Minimum ${MIN_WORDS} words` : undefined}
            >
              {liveWordCount} words
            </span>
            {inExam && (
              <Timer
                secondsLeft={examSecondsLeft}
                totalSeconds={EXAM_DURATION_SEC}
                running={examState === 'running'}
              />
            )}
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
                questionType={prompt?.type ?? null}
              />
            </aside>
          )}

          <section className="sheet-zone">
            {!inExam && (
              <PromptPicker prompts={PROMPTS} current={prompt} onPick={(p) => setPrompt(p)} />
            )}
            {inExam && prompt && (
              <div className="exam-prompt card">
                <p className="eyebrow">Task 2 · write at least 250 words</p>
                <p className="exam-prompt-text">{prompt.text}</p>
              </div>
            )}

            {inExam && examState === 'idle' ? (
              <div className="exam-start card">
                <h2>Exam conditions</h2>
                <p>
                  40 minutes, no feedback, no highlights. The full report appears when you submit —
                  exactly like the real thing.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    pacingRef.current = []
                    pasteAttemptsRef.current = 0
                    submittingRef.current = false
                    examDeadlineRef.current = Date.now() + EXAM_DURATION_SEC * 1000
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
                    ? 'Plan first: position, two main ideas, examples. Then write.'
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
              <div className="panel-tabs" role="tablist" aria-label="Coach panel">
                <button
                  role="tab"
                  aria-selected={panelTab === 'feedback'}
                  className={panelTab === 'feedback' ? 'panel-tab active' : 'panel-tab'}
                  onClick={() => setPanelTab('feedback')}
                >
                  Feedback
                </button>
                <button
                  role="tab"
                  aria-selected={panelTab === 'cheatsheet'}
                  className={panelTab === 'cheatsheet' ? 'panel-tab active' : 'panel-tab'}
                  onClick={() => setPanelTab('cheatsheet')}
                >
                  Cheat sheet
                </button>
              </div>
              {panelTab === 'feedback' ? (
                <FeedbackPanel
                  analysis={analysis}
                  profile={profile}
                  onSelectIssue={handleSelectIssue}
                />
              ) : (
                <CheatSheet />
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
