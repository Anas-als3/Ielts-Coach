import { useEffect, useMemo, useRef, useState } from 'react'
// Aliased: the plain name is the DOM's `KeyboardEvent`, which the
// Cmd/Ctrl+Enter window listener below still uses.
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import './App.css'
import type {
  AppProps,
  Issue,
  IssueCategory,
  LetterPromptSpec,
  ListeningSessionRecord,
  Module,
  Prefs,
  PromptSpec,
  ReadingSessionRecord,
  SessionRecord,
  SessionSection,
  Task1PromptSpec,
  TaskKind,
  WritingMode,
  WritingSessionRecord,
} from './types'
import { isListeningSession, isReadingSession, isWritingSession } from './types'
import type { ReadingAnswers } from './reading/types'
import type { ListeningAnswers } from './listening/types'
import { MODULE_META, TASK_CONSTANTS, WRITING_MODE_META } from './meta'
import { analyzeEssay, analyzeLetter, analyzeTask1 } from './analysis/engine'
import { deleteSession, exportData, importData, loadSessions, saveSession } from './profile/store'
import { clearDraft, isExamDraftExpired, loadDraft, saveDraft } from './profile/draft'
import type { WritingDraft } from './profile/draft'
import { computeProfile, computeTrends } from './profile/profile'
import { isBefore } from './profile/chronology'
import { loadPrefs, savePrefs } from './profile/prefs'
import { PROMPTS, promptsForModule, randomPrompt, suitsModule } from './prompts/bank'
import { TASK1_PROMPTS, randomTask1Prompt } from './prompts/task1Bank'
import { LETTER_PROMPTS, randomLetterPrompt } from './prompts/letterBank'
import { readingTestById, readingTestsForModule } from './reading/tests'
import { LISTENING_TESTS, listeningTestById } from './listening/tests'
import { createSpeechDriver } from './listening/speech'
import { markListening } from './listening/mark'
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
import ListeningRunner from './components/ListeningRunner'
import ListeningReport from './components/ListeningReport'
import ListeningPicker from './components/ListeningPicker'

type View = 'write' | 'report' | 'dashboard' | 'reading' | 'listening'
type ExamState = 'idle' | 'running'
type PanelTab = 'feedback' | 'cheatsheet' | 'model'
/** Where the learner is inside the Reading section: choosing, sitting, reviewing. */
type ReadingStage = 'picker' | 'running' | 'report'
/** The same three places inside the Listening section. */
type ListeningStage = 'picker' | 'running' | 'report'

/** The coach panel's tabs and the labels they print, in printed order. */
const PANEL_TAB_LABELS: Record<PanelTab, string> = {
  feedback: 'Feedback',
  cheatsheet: 'Cheat sheet',
  model: 'Model answer',
}

/**
 * The coach panel is a real ARIA tab pattern, not three buttons that look like
 * tabs. `role="tab"` on its own announces "tab, selected" and names nothing
 * that changed; WCAG 4.1.2 asks for the relationship between the tab and the
 * content it swapped to be programmatically determinable, so each tab points at
 * the panel it controls and the panel names the tab that labels it.
 *
 * One panel element, whose label follows the selection, because only the chosen
 * tab's content is mounted — an `aria-controls` pointing at an element that is
 * not in the document names nothing at all.
 */
const COACH_PANEL_ID = 'coach-panel'

function panelTabId(tab: PanelTab): string {
  return `panel-tab-${tab}`
}

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

export default function App({
  initialPrompt,
  initialTask1Prompt,
  initialLetterPrompt,
  listeningDriver,
}: AppProps = {}) {
  const [view, setView] = useState<View>('write')
  const [mode, setMode] = useState<WritingMode>('coach')
  const [task, setTask] = useState<TaskKind>('task2')
  // Academic is the default because it is the exam the app was built for; a
  // learner who has chosen General should not have to re-choose every visit.
  const [module, setModule] = useState<Module>(() => loadPrefs().module ?? 'academic')
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
  /**
   * Set when `saveSession` reports a failed write, from any of the three
   * submit handlers (Writing, Reading, Listening) — one banner for all three,
   * per `SaveResult`'s doc comment: a fourth section should wire into this
   * same state rather than invent a second banner. Stays on screen until the
   * learner dismisses it; a save failure loses work, so it is not a toast that
   * can quietly time out while they are reading their report.
   */
  const [saveFailureMessage, setSaveFailureMessage] = useState<string | null>(null)
  /**
   * A non-urgent notice about the exam clock: set when a restored draft's exam
   * expired while the tab was closed, or when the running clock hits zero on a
   * blank sheet. `role="status"`, not `role="alert"` like `saveFailureMessage`
   * above — nothing was lost here, so this is not a warning.
   */
  const [clockNotice, setClockNotice] = useState<string | null>(null)
  const [focusIssueId, setFocusIssueId] = useState<string | null>(null)
  const [examState, setExamState] = useState<ExamState>('idle')
  const [examSecondsLeft, setExamSecondsLeft] = useState(TASK_CONSTANTS.task2.examDurationSec)
  const [panelTab, setPanelTab] = useState<PanelTab>('feedback')
  const [readingStage, setReadingStage] = useState<ReadingStage>('picker')
  const [readingTestId, setReadingTestId] = useState<string | null>(null)
  const [readingSessionId, setReadingSessionId] = useState<string | null>(null)
  const [listeningStage, setListeningStage] = useState<ListeningStage>('picker')
  const [listeningTestId, setListeningTestId] = useState<string | null>(null)
  const [listeningSessionId, setListeningSessionId] = useState<string | null>(null)
  /**
   * Practice mode is chosen on the picker and held here for the length of the
   * attempt, so "sit this paper again" from the report repeats the SAME
   * conditions rather than quietly swapping them.
   */
  const [listeningPractice, setListeningPractice] = useState(false)
  const submittingRef = useRef(false)
  // The coach tab buttons, so arrow keys can move focus with the selection.
  const panelTabRefs = useRef<Partial<Record<PanelTab, HTMLButtonElement | null>>>({})
  const pacingRef = useRef<Array<{ t: number; words: number }>>([])
  const pasteAttemptsRef = useRef(0)
  const examDeadlineRef = useRef<number | null>(null)
  const essayTextRef = useRef(essayText)
  essayTextRef.current = essayText
  const handleSubmitRef = useRef<() => void>(() => {})
  // The draft found at mount, held until the learner decides. NEVER applied
  // silently: a draft is an offer, because auto-restoring would overwrite the
  // empty sheet a learner deliberately reloaded to get.
  const [pendingDraft, setPendingDraft] = useState<WritingDraft | null>(() => loadDraft())
  // The exact text last written to the draft key — what beforeunload compares
  // against to know whether closing the tab would lose anything.
  const draftTextRef = useRef('')
  // One read on mount, like `sessions` above: prefs are only ever written
  // through dismissIntro, so no effect or subscription is needed.
  const [introDismissed, setIntroDismissed] = useState<boolean>(
    () => loadPrefs().introDismissedAtISO != null,
  )
  // The learner's goals & readiness prefs (exam date, targets, exam type),
  // read once on mount like `sessions` and `introDismissed` above and kept in
  // sync through `updatePrefs`, so the Dashboard's "Your exam" card and the
  // Report's target chip re-render from ONE copy of state rather than each
  // reading storage on their own.
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs())

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
  /**
   * The latest band per SECTION, from `sessions` — every section, not just
   * writing — so the "Your exam" card can show a gap without depending on a
   * Dashboard-props rework. `sessions` is sorted ascending by date (see
   * `loadSessions`), so the last hit per section in this loop is the newest.
   */
  const latestBandBySection = useMemo<Partial<Record<SessionSection, number>>>(() => {
    const out: Partial<Record<SessionSection, number>> = {}
    for (const s of sessions) {
      if (isWritingSession(s)) out.writing = s.analysis.band.overall
      else if (isReadingSession(s)) out.reading = s.result.band
      else out.listening = s.result.band
    }
    return out
  }, [sessions])
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

  /* -------------------------------- listening ------------------------------- */
  // `LISTENING_TESTS` is used whole and is NEVER filtered by `module` — there is
  // deliberately no `listeningTestsForModule` to call. Academic and General
  // Training candidates sit the identical Listening paper and convert through
  // the identical table, so a filter here would have nothing to filter on and
  // would only teach the next reader that the distinction exists. Compare the
  // Reading block above, where the filter is load-bearing because the two
  // exams' papers really are different objects marked by different tables.
  const listeningTest = useMemo(
    () => (listeningTestId === null ? null : listeningTestById(listeningTestId)),
    [listeningTestId],
  )
  // Constructed once per mount: the browser's synthesiser where there is one,
  // the paced transcript where there is not. Tests inject a `FakeSpeechDriver`
  // through props, because jsdom has no `speechSynthesis` and no test may
  // depend on a real one.
  const speechDriver = useMemo(() => listeningDriver ?? createSpeechDriver(), [listeningDriver])
  // Not filtered by module either, for the same reason, and the absence of a
  // `.filter(s => s.module === module)` line here — which the Reading history
  // above does have — is the whole difference between the two sections.
  const listeningHistory = useMemo<ListeningSessionRecord[]>(
    () => sessions.filter(isListeningSession).slice().reverse(),
    [sessions],
  )
  const listeningSession = useMemo<ListeningSessionRecord | null>(
    () => sessions.filter(isListeningSession).find((s) => s.id === listeningSessionId) ?? null,
    [sessions, listeningSessionId],
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
    if (examState !== 'running' || examSecondsLeft !== 0) return
    if (countWords(essayTextRef.current) === 0) {
      // An examiner does not mark a blank script. Submitting here would put a
      // Band-4-floor session into the history and the error profile for an
      // essay that was never written — the manual paths already refuse this
      // (the keyboard guard above, the disabled submit button), and expiry
      // was the one path that did not.
      examDeadlineRef.current = null
      setExamState('idle')
      setExamSecondsLeft(taskConstants.examDurationSec)
      setClockNotice(
        'Time is up. A blank answer sheet is never submitted — nothing was added to your history.',
      )
      return
    }
    handleSubmit()
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

  /* ---------------------------- draft persistence ---------------------------- */
  // Debounced off the EXISTING `debouncedText` (400ms) — no new debounce
  // machinery. This is the whole answer to 025-a: the essay used to live only
  // in `useState`, so a reload, crash or tab close lost it outright.
  useEffect(() => {
    if (view !== 'write') return
    // While a restore offer is undecided, the effect must not run at all:
    // essayText is '' at mount, and the zero-word branch below would delete
    // the very draft the card is offering to restore.
    if (pendingDraft !== null) return
    if (countWords(debouncedText) === 0) {
      clearDraft()
      draftTextRef.current = ''
      return
    }
    const activeSpec = isLetter ? letterPrompt : task === 'task1' ? task1Prompt : prompt
    saveDraft({
      task,
      module,
      promptId: activeSpec?.id ?? null,
      essayText: debouncedText,
      mode,
      examDeadlineEpochMs: examState === 'running' ? examDeadlineRef.current : null,
      savedAtISO: new Date().toISOString(),
    })
    draftTextRef.current = debouncedText
  }, [debouncedText, view, task, module, mode, examState, isLetter, letterPrompt, task1Prompt, prompt, pendingDraft])

  /**
   * Warn exactly when closing the tab would destroy something no key holds:
   * a Reading/Listening paper mid-run (memory-only by the runners' own
   * doctrine — 025-b), or write-view text newer than the draft on disk (the
   * ≤400ms debounce window the draft cannot cover). Once the draft is on
   * disk, closing the tab is SAFE, and a warning then would be a lie that
   * teaches learners to click through warnings.
   */
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const runnerLive =
        (view === 'reading' && readingStage === 'running') ||
        (view === 'listening' && listeningStage === 'running')
      const draftStale =
        view === 'write' &&
        countWords(essayTextRef.current) > 0 &&
        essayTextRef.current !== draftTextRef.current
      if (!runnerLive && !draftStale) return
      e.preventDefault()
      e.returnValue = '' // legacy Chrome requires an assigned returnValue
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [view, readingStage, listeningStage])

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
    const result = saveSession(record)
    if (!result.ok) setSaveFailureMessage(result.message)
    // Re-read the store so in-memory state always matches persistence (cap, sort).
    setSessions(loadSessions())
    setReportSessionId(record.id)
    setExamState('idle')
    setExamSecondsLeft(taskConstants.examDurationSec)
    examDeadlineRef.current = null
    // Cleared HERE rather than left to the persistence effect: the view is
    // about to become 'report', so that effect never runs again to do it, and
    // a stale draft would offer back an essay that is already in the history.
    clearDraft()
    draftTextRef.current = ''
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

  /**
   * Applies an offered draft — called only from the restore card, never on
   * mount. `pendingDraft` holds the offer until this or `discardDraft` runs,
   * so the learner always decides.
   */
  function restoreDraft(draft: WritingDraft): void {
    submittingRef.current = false
    setTask(draft.task)
    setModule(draft.module)
    // Same three-branch lookup as `handleRedraft`: a `promptId` no bank
    // contains leaves the current slot untouched — the text still restores.
    if (draft.task === 'task1' && draft.module === 'general') {
      const letter = LETTER_PROMPTS.find((x) => x.id === draft.promptId)
      if (letter) setLetterPrompt(letter)
    } else if (draft.task === 'task1') {
      const t1 = TASK1_PROMPTS.find((x) => x.id === draft.promptId)
      if (t1) setTask1Prompt(t1)
    } else {
      setPrompt(PROMPTS.find((x) => x.id === draft.promptId) ?? null)
    }
    setEssayText(draft.essayText)
    setFocusIssueId(null)
    if (
      draft.mode === 'exam' &&
      draft.examDeadlineEpochMs !== null &&
      !isExamDraftExpired(draft, Date.now())
    ) {
      // The clock lost no time while the tab was closed — that is the point of
      // persisting the absolute deadline rather than the seconds left.
      pacingRef.current = []
      pasteAttemptsRef.current = 0
      examDeadlineRef.current = draft.examDeadlineEpochMs
      setMode('exam')
      setExamState('running')
      setExamSecondsLeft(Math.max(0, Math.round((draft.examDeadlineEpochMs - Date.now()) / 1000)))
    } else {
      // Coach, exam-idle, or an expired exam. Never auto-submit on mount:
      // submitting is an act the learner performs, and an app that marks an
      // essay nobody handed in is hostile. Restoring into COACH — which IS
      // exam-idle, `examState` is 'idle' — is forced by the UI itself: in exam
      // mode + idle the editor is not rendered (the "Start the clock" card
      // shows instead), so the restored text would be invisible, and starting
      // the clock over a pre-filled sheet is a head start the real exam does
      // not allow.
      examDeadlineRef.current = null
      setMode('coach')
      setExamState('idle')
      setExamSecondsLeft(TASK_CONSTANTS[draft.task].examDurationSec)
      if (isExamDraftExpired(draft, Date.now())) {
        setClockNotice(
          'The exam clock ran out while you were away. Your essay was kept — review it here and submit when you are ready.',
        )
      }
    }
    setPendingDraft(null)
    setView('write')
    // No `clearDraft()` here: the debounced persistence effect re-saves within
    // 400ms anyway, and clearing first would open a window where a crash loses
    // the essay twice.
  }

  function discardDraft(): void {
    clearDraft()
    draftTextRef.current = ''
    setPendingDraft(null)
  }

  function switchTask(next: TaskKind) {
    if (next === task) return
    if (mode === 'exam' && examState === 'running') {
      const leave = window.confirm(
        'The exam clock is running. Switch task and abandon this attempt?',
      )
      if (!leave) return
    } else if (countWords(essayText) > 0) {
      const leave = window.confirm(
        'Switching task clears the answer sheet and discards the essay in progress. Switch anyway?',
      )
      if (!leave) return
    }
    submittingRef.current = false
    examDeadlineRef.current = null
    setTask(next)
    // A Task 2 essay sitting in a Task 1 answer sheet would be scored against
    // the wrong rules and produce confidently wrong feedback.
    setEssayText('')
    // Consent to clear IS the "explicit discard" the draft contract names;
    // keeping a draft the learner just agreed to abandon would re-offer it at
    // next launch as if the consent never happened.
    clearDraft()
    draftTextRef.current = ''
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
    } else if (view === 'write' && countWords(essayText) > 0) {
      const leave = window.confirm(
        'Switching exam type clears the answer sheet and discards the essay in progress. Switch anyway?',
      )
      if (!leave) return
    }
    setModule(next)
    // Persisted so a returning General candidate does not have to re-choose
    // every visit — see the lazy initializer above. Sits AFTER the confirm
    // guards, so declining the "abandon this attempt?" dialog persists nothing.
    savePrefs({ module: next })
    // Re-read rather than merging in memory (same rule `updatePrefs` follows):
    // storage is the source of truth, so the "Your exam" card's exam-type
    // select and this topbar toggle can never disagree.
    setPrefs(loadPrefs())
    // A prompt the new exam does not ask disappears from the picker, so leaving
    // it selected would strand the learner on a question they cannot see listed.
    //
    // Keeping every prompt that merely "still suits" was the old rule, and it
    // made the toggle look broken. 28 of the 40 Task 2 prompts are tagged for
    // BOTH exams and none is General-only, so every General prompt is also an
    // Academic one: General -> Academic could never change the question, and
    // Academic -> General left it alone 28 times in 40. Toggling back and forth
    // showed one subject forever.
    //
    // On the writing desk the answer sheet is cleared below regardless, so
    // there is no work to protect — draw a fresh question from the new exam's
    // pool and never re-deal the one on screen. Away from the desk the essay
    // SURVIVES (see the early return below), so the question must stay put
    // unless the new exam does not ask it; swapping it there would change the
    // task under an essay in progress.
    setPrompt((current) => {
      if (view === 'write') return randomPrompt(next, current)
      return current && suitsModule(current, next) ? current : randomPrompt(next)
    })
    // The answer sheet is cleared only when the learner is looking at it. Task 1
    // is a different task in the two exams, so an answer written for one cannot
    // be marked against the other — but switching exam from the READING section
    // must not silently destroy an essay in progress on the writing desk.
    if (view !== 'write') return
    submittingRef.current = false
    examDeadlineRef.current = null
    setEssayText('')
    // Consent to clear IS the "explicit discard" the draft contract names;
    // keeping a draft the learner just agreed to abandon would re-offer it at
    // next launch as if the consent never happened.
    clearDraft()
    draftTextRef.current = ''
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
    const result = saveSession(record)
    if (!result.ok) setSaveFailureMessage(result.message)
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

  /* -------------------------------- listening ------------------------------- */

  function openListening() {
    setView('listening')
    // A stale report from a previous sitting is not what "Listening" means; the
    // section always opens on the list of papers unless a paper is being sat.
    if (listeningStage === 'report') setListeningStage('picker')
  }

  function startListeningTest(testId: string, practice: boolean) {
    setListeningTestId(testId)
    setListeningSessionId(null)
    setListeningPractice(practice)
    setListeningStage('running')
  }

  /**
   * Persist a sat paper. The ONLY place a Listening session is written — the
   * runner holds answers in memory until this is called, so an abandoned
   * attempt leaves no band in the learner's history.
   *
   * No `module` is recorded, and there is nothing missing: both exams sit this
   * paper and convert through the one table, so there is no fact to store.
   */
  function handleListeningSubmit(
    answers: ListeningAnswers,
    durationSec: number,
    practice: boolean,
  ) {
    const test = listeningTest
    if (test === null) {
      setListeningStage('picker')
      return
    }
    const record: ListeningSessionRecord = {
      section: 'listening',
      id: makeId(),
      dateISO: new Date().toISOString(),
      testId: test.id,
      testTitle: test.title,
      answers,
      result: markListening(test, answers),
      durationSec,
      // Taken from the RUNNER rather than from `listeningPractice`, so the flag
      // records the conditions the paper was actually sat under even if the
      // app's own state has since moved on.
      practice,
    }
    const result = saveSession(record)
    if (!result.ok) setSaveFailureMessage(result.message)
    // Re-read the store so in-memory state always matches persistence (cap, sort).
    setSessions(loadSessions())
    setListeningSessionId(record.id)
    setListeningStage('report')
  }

  function openListeningSession(session: ListeningSessionRecord) {
    setListeningTestId(session.testId)
    setListeningSessionId(session.id)
    setListeningPractice(session.practice)
    setListeningStage('report')
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

  /**
   * The single write path for the "Your exam" card (and anything else that
   * sets a prefs field directly, `dismissIntro` and `switchModule` aside,
   * which already have their own `savePrefs` + re-read). Re-reads rather than
   * merging in memory, the same rule every session mutation below follows:
   * storage is the source of truth.
   */
  function updatePrefs(patch: Partial<Prefs>) {
    savePrefs(patch)
    setPrefs(loadPrefs())
  }

  function dismissIntro() {
    setIntroDismissed(true)
    savePrefs({ introDismissedAtISO: new Date().toISOString() })
  }

  function handleImport(json: string) {
    importData(json)
    setSessions(loadSessions())
    const restored = loadPrefs()
    setPrefs(restored)
    // Through switchModule, not setModule: away from the desk it keeps a
    // prompt that suits the new exam and redraws one that does not
    // (see switchModule above); a bare setModule would strand a
    // General-only prompt on an Academic desk.
    if (restored.module && restored.module !== module) switchModule(restored.module)
  }

  function handleDelete(id: string) {
    deleteSession(id)
    // Re-read the store so in-memory state always matches persistence (cap,
    // sort) — the same rule the other three mutations follow. Filtering the
    // previous array instead reproduced the store's behaviour by hand, which
    // is the one way the two can drift: `deleteSession` refuses a delete whose
    // id it cannot find, and this used to remove the row anyway.
    setSessions(loadSessions())
  }

  function handleStartPractice(_focus: IssueCategory | null) {
    startNewEssay()
  }

  function handleSelectIssue(issue: Issue) {
    if (issue.start != null) setFocusIssueId(issue.id)
  }

  /* --------------------------------- render --------------------------------- */
  // The cheat sheet teaches Task 2 specifically, so Task 1 is never offered it.
  const panelTabsShown: PanelTab[] =
    task === 'task2' ? ['feedback', 'cheatsheet', 'model'] : ['feedback', 'model']
  /**
   * The tab actually on screen. `panelTab` can name one that is not — Task 1
   * hides the cheat sheet — and a panel labelled by a button that does not
   * exist names nothing, so the fallback is resolved once here rather than
   * re-derived at each place that reads it.
   */
  const activePanelTab: PanelTab = panelTabsShown.includes(panelTab) ? panelTab : 'feedback'

  /**
   * Arrow keys move between coach tabs, and focus moves with the selection.
   *
   * A tab strip is ONE tab stop, not one per tab: the roving `tabIndex` takes
   * the unselected tabs out of the Tab order, so without these keys a keyboard
   * user could not reach the model answer at all. Home and End jump to the
   * ends, per the ARIA authoring practices.
   */
  function handlePanelTabKeys(event: ReactKeyboardEvent<HTMLDivElement>): void {
    const count = panelTabsShown.length
    const here = panelTabsShown.indexOf(activePanelTab)
    let next: number | null = null
    if (event.key === 'ArrowRight') next = (here + 1) % count
    else if (event.key === 'ArrowLeft') next = (here - 1 + count) % count
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = count - 1
    if (next === null) return
    event.preventDefault()
    const tab = panelTabsShown[next]
    setPanelTab(tab)
    panelTabRefs.current[tab]?.focus()
  }

  const reportSession = writingSessions.find((s) => s.id === reportSessionId) ?? null
  const previousSession = reportSession
    // `isBefore` compares instants; `<` on the raw strings compares text, which
    // an imported file's offset can invert. `.slice(-1)[0]` is still the most
    // recent earlier session, because `sessions` is always `loadSessions()` and
    // that is instant-ordered.
    ? writingSessions.filter((s) => isBefore(s, reportSession)).slice(-1)[0] ?? null
    : null

  const inExam = mode === 'exam' && view === 'write'
  // A Reading paper is exam conditions by definition — there is no coach mode
  // for an answer key — so sitting one clears the desk exactly as exam mode
  // does for writing: no navigation, no exam-type toggle, just the paper.
  const inReadingTest = view === 'reading' && readingStage === 'running'
  // The same for Listening, and more sharply: the recording plays once, so a
  // learner who navigated away mid-section would lose it for good.
  const inListeningTest = view === 'listening' && listeningStage === 'running'
  const deskCleared = inExam || inReadingTest || inListeningTest
  const inlineIssues =
    mode === 'coach' && analysis ? analysis.issues.filter((i) => i.start != null) : []

  return (
    <div className={`app${deskCleared ? ' app-exam' : ''}`}>
      <header className="topbar">
        <div className="topbar-left">
          <span className="brand">
            IELTS <em>Coach</em>
          </span>
          {/* `aria-current="page"` rather than `aria-pressed`: these are not
              toggles but navigation, and the class that greys the other three
              is otherwise the only statement of where the learner is. */}
          {!deskCleared && (
            <nav className="nav">
              <button
                className={view === 'write' ? 'nav-link active' : 'nav-link'}
                aria-current={view === 'write' ? 'page' : undefined}
                onClick={() => {
                  submittingRef.current = false
                  setView('write')
                }}
              >
                Write
              </button>
              <button
                className={view === 'reading' ? 'nav-link active' : 'nav-link'}
                aria-current={view === 'reading' ? 'page' : undefined}
                onClick={openReading}
              >
                Reading
              </button>
              <button
                className={view === 'listening' ? 'nav-link active' : 'nav-link'}
                aria-current={view === 'listening' ? 'page' : undefined}
                onClick={openListening}
              >
                Listening
              </button>
              <button
                className={view === 'dashboard' ? 'nav-link active' : 'nav-link'}
                aria-current={view === 'dashboard' ? 'page' : undefined}
                onClick={() => setView('dashboard')}
              >
                Progress
              </button>
            </nav>
          )}
        </div>

        {/* Deliberately `view === 'reading'` and not `view !== 'write'`: the
            Listening section shows NO exam-type toggle, because Listening is
            the identical paper with the identical conversion table in both
            exams. A control that changed nothing would be worse than no
            control — it would teach a learner that the choice matters. */}
        {view === 'reading' && !inReadingTest && (
          <div className="topbar-right">
            {/* The exam type decides which papers exist AND which conversion
                table marks them, so it belongs on screen wherever papers are
                offered — not only on the writing desk.

                `aria-pressed` rather than a radiogroup, and the choice is the
                same for every toggle in this app. A radio group is a VALUE
                being chosen — it commits when the form does, it is one tab stop
                with arrow keys inside, and it wants a submit. These buttons act
                the instant they are pressed: pressing "General" swaps the
                papers on screen and can throw up a confirm. Toggle buttons are
                what that behaviour is, and each stays individually reachable by
                Tab, which is how a segmented control of two is expected to
                work. Without the attribute the navy fill was the ONLY statement
                of which exam is live, and a non-sighted learner could not tell
                which paper they were about to sit. */}
            <div className="mode-toggle module-toggle" role="group" aria-label="IELTS exam type">
              <button
                className={module === 'academic' ? 'mode-btn active' : 'mode-btn'}
                aria-pressed={module === 'academic'}
                onClick={() => switchModule('academic')}
                title={MODULE_META.academic.blurb}
              >
                Academic
              </button>
              <button
                className={module === 'general' ? 'mode-btn active' : 'mode-btn'}
                aria-pressed={module === 'general'}
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
            {/* Toggle buttons, for the reason given at the Reading section's
                copy of this control. */}
            <div className="mode-toggle module-toggle" role="group" aria-label="IELTS exam type">
              <button
                className={module === 'academic' ? 'mode-btn active' : 'mode-btn'}
                aria-pressed={module === 'academic'}
                onClick={() => switchModule('academic')}
                title={MODULE_META.academic.blurb}
              >
                Academic
              </button>
              <button
                className={module === 'general' ? 'mode-btn active' : 'mode-btn'}
                aria-pressed={module === 'general'}
                onClick={() => switchModule('general')}
                title={MODULE_META.general.blurb}
              >
                General
              </button>
            </div>
            <div className="mode-toggle task-toggle" role="group" aria-label="IELTS task">
              <button
                className={task === 'task1' ? 'mode-btn active' : 'mode-btn'}
                aria-pressed={task === 'task1'}
                onClick={() => switchTask('task1')}
              >
                Task 1
              </button>
              <button
                className={task === 'task2' ? 'mode-btn active' : 'mode-btn'}
                aria-pressed={task === 'task2'}
                onClick={() => switchTask('task2')}
              >
                Task 2
              </button>
            </div>
            <div className="mode-toggle" role="group" aria-label="Writing mode">
              <button
                className={mode === 'coach' ? 'mode-btn active' : 'mode-btn'}
                aria-pressed={mode === 'coach'}
                onClick={() => switchMode('coach')}
                title={WRITING_MODE_META.coach.blurb}
              >
                Coach
              </button>
              <button
                className={mode === 'exam' ? 'mode-btn active' : 'mode-btn'}
                aria-pressed={mode === 'exam'}
                onClick={() => switchMode('exam')}
                title={WRITING_MODE_META.exam.blurb}
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

      {/* Urgent rather than a status: a save failure loses a learner's work,
          not merely reports progress — `role="status"` is what the Listening
          transfer notice uses for a non-urgent one. Persists until dismissed:
          a toast that vanishes while the report is on screen is not a
          warning. */}
      {saveFailureMessage && (
        <div className="save-failure-banner" role="alert">
          <p>{saveFailureMessage}</p>
          <button className="btn" onClick={() => setSaveFailureMessage(null)}>
            Dismiss
          </button>
        </div>
      )}

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
            {clockNotice !== null && (
              <div className="card" role="status">
                <p>{clockNotice}</p>
                <button className="btn" onClick={() => setClockNotice(null)}>
                  Dismiss
                </button>
              </div>
            )}
            {pendingDraft !== null && (
              <div className="card" role="status">
                <p>
                  You have an unfinished draft from earlier ({countWords(pendingDraft.essayText)}{' '}
                  words).
                </p>
                <button className="btn btn-primary" onClick={() => restoreDraft(pendingDraft)}>
                  Restore draft
                </button>
                <button className="btn" onClick={discardDraft}>
                  Discard draft
                </button>
              </div>
            )}
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
                      // A notice from an earlier draft (e.g. "the clock ran
                      // out while you were away") must not survive into a
                      // freshly started exam.
                      setClockNotice(null)
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
              {/* First-run intro. It lives in the panel column ON PURPOSE:
                  the column is its own grid track, so dismissing the card
                  reflows only this column — the editor never moves under the
                  learner's cursor. Rendering inside the coach aside also makes
                  "never in exam mode, never off the write view" structural
                  rather than a condition someone can break. */}
              {!introDismissed && (
                <section className="intro-card card" aria-label="How IELTS Coach works">
                  <p className="eyebrow">First time here</p>
                  <ul className="intro-points">
                    <li>
                      <strong>Academic or General</strong> — the toggle in the top bar
                      picks the exam you are practising. It decides your Task 1 (a chart
                      in Academic, a letter in General Training) and which Reading papers
                      you see.
                    </li>
                    <li>
                      <strong>Coach or Exam</strong> — Coach gives live feedback while
                      you write. Exam is the real thing: a countdown, no feedback, and
                      the full report when you submit.
                    </li>
                    <li>
                      <strong>Honest numbers</strong> — band estimates come from fixed
                      rules about form, not an examiner. Your real band is likely the
                      estimate or lower. Everything stays in your browser.
                    </li>
                  </ul>
                  <button className="btn" onClick={dismissIntro}>
                    Got it
                  </button>
                </section>
              )}
              {/* The cheat sheet is Task 2 content. Rather than show a tab that
                  teaches the wrong task, Task 1 gets the feedback panel alone
                  until a Task 1 sheet is written. */}
              <div
                className="panel-tabs"
                role="tablist"
                aria-label="Coach panel"
                onKeyDown={handlePanelTabKeys}
              >
                {panelTabsShown.map((tab) => (
                  <button
                    key={tab}
                    ref={(el) => {
                      panelTabRefs.current[tab] = el
                    }}
                    id={panelTabId(tab)}
                    role="tab"
                    aria-selected={activePanelTab === tab}
                    aria-controls={COACH_PANEL_ID}
                    // Roving tabindex: the strip is one tab stop, the arrows choose.
                    tabIndex={activePanelTab === tab ? 0 : -1}
                    className={activePanelTab === tab ? 'panel-tab active' : 'panel-tab'}
                    onClick={() => setPanelTab(tab)}
                  >
                    {PANEL_TAB_LABELS[tab]}
                  </button>
                ))}
              </div>
              {/* The panel the tabs name. Wrapping rather than labelling the
                  three components' own roots keeps the relationship stated in
                  ONE place: a fourth tab cannot ship without a panel. */}
              <div
                className="panel-body"
                role="tabpanel"
                id={COACH_PANEL_ID}
                aria-labelledby={panelTabId(activePanelTab)}
              >
                {activePanelTab === 'cheatsheet' ? (
                  <CheatSheet />
                ) : activePanelTab === 'model' ? (
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
              </div>
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
            targetOverall={prefs.targetOverall}
          />
        </main>
      )}

      {/* A failed save (see the banner above) still navigates here, and so
          does opening a session id the store no longer has — this branch and
          the one above are mutually exclusive on `reportSession`, so exactly
          one <main> renders rather than a header over a blank page. */}
      {view === 'report' && reportSession === null && (
        <main className="page">
          {/* Same shell as the "Exam conditions" start card — a centred
              message plus action buttons — reused rather than duplicated: the
              layout this fallback needs already exists. `.rp-actions` is
              Report.css's button row, loaded unconditionally because Report
              is always imported above. */}
          <div className="exam-start card">
            <h2>This essay could not be loaded</h2>
            <p>
              This can happen when a save does not go through, or when the essay was removed
              elsewhere. If you just finished writing, check the banner above — your work may
              not be saved, so export your history from Progress before writing anything new.
            </p>
            <div className="rp-actions">
              <button className="btn btn-primary" onClick={() => startNewEssay()}>
                Back to the editor
              </button>
              <button className="btn" onClick={() => setView('dashboard')}>
                View progress
              </button>
            </div>
          </div>
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

      {view === 'listening' && listeningStage === 'running' && listeningTest !== null && (
        <main className="listening-main">
          <ListeningRunner
            test={listeningTest}
            practice={listeningPractice}
            driver={speechDriver}
            onSubmit={handleListeningSubmit}
            onExit={() => setListeningStage('picker')}
          />
        </main>
      )}

      {view === 'listening' && listeningStage === 'report' && listeningSession !== null && (
        <main className="page">
          <ListeningReport
            session={listeningSession}
            test={listeningTestById(listeningSession.testId)}
            onRetake={() =>
              // The same conditions as last time. Turning a practice run into an
              // exam run behind the learner's back would relabel a band they
              // did not earn that way.
              startListeningTest(listeningSession.testId, listeningSession.practice)
            }
            onPickAnother={() => setListeningStage('picker')}
          />
        </main>
      )}

      {view === 'listening' &&
        (listeningStage === 'picker' ||
          (listeningStage === 'running' && listeningTest === null) ||
          (listeningStage === 'report' && listeningSession === null)) && (
          <main className="page">
            <ListeningPicker
              tests={[...LISTENING_TESTS]}
              history={listeningHistory}
              driverKind={speechDriver.kind}
              onStart={startListeningTest}
              onOpen={openListeningSession}
            />
          </main>
        )}

      {view === 'dashboard' && (
        <main className="page">
          <Dashboard
            sessions={writingSessions}
            allSessions={sessions}
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
            prefs={prefs}
            latestBandBySection={latestBandBySection}
            onUpdatePrefs={updatePrefs}
            module={module}
            onSwitchModule={switchModule}
          />
        </main>
      )}
    </div>
  )
}
