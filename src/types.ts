/**
 * Shared contract for the whole app. Every module — analysis rules, storage,
 * and UI components — codes against these types. Do not change shapes without
 * updating all consumers.
 */

/* ---------------------------------- prompts --------------------------------- */

export type QuestionType =
  | 'opinion'                    // "To what extent do you agree or disagree?"
  | 'discussion'                 // "Discuss both views and give your own opinion."
  | 'problem-solution'           // "What problems does this cause? What solutions...?"
  | 'advantages-disadvantages'   // "Do the advantages outweigh the disadvantages?"
  | 'double-question';           // Two direct questions.

export interface PromptSpec {
  id: string;
  type: QuestionType;
  /** Full task text shown to the learner, ending with the standard instruction. */
  text: string;
  /** Short topic tag, e.g. "education", "environment". */
  topic: string;
  /** The parts a complete answer must address, phrased as a checklist. */
  parts: string[];
  /** Content words from the prompt, lowercase — used for prompt-echo and relevance checks. */
  keywords: string[];
}

/* ------------------------------ band criteria ------------------------------- */

export type Criterion = 'TR' | 'CC' | 'LR' | 'GRA';

/* ------------------------------ issue taxonomy ------------------------------ */

/**
 * Stable error-category IDs. The personal error profile aggregates on these
 * across sessions, so IDs must never be renamed once data exists.
 */
export type IssueCategory =
  // Task Response
  | 'word-count'
  | 'question-coverage'
  | 'prompt-echo'
  | 'no-position'
  | 'position-consistency'
  | 'off-topic'
  | 'overgeneralisation'
  | 'personal-anecdote'
  // Coherence & Cohesion
  | 'paragraphing'
  | 'no-conclusion'
  | 'topic-sentence'
  | 'intro-shape'
  | 'conclusion-shape'
  | 'linking-overuse'
  | 'linking-underuse'
  | 'linking-repetition'
  | 'connector-misuse'
  | 'paragraph-balance'
  // Lexical Resource
  | 'informal-register'
  | 'contraction'
  | 'repetition'
  | 'weak-vocabulary'
  | 'memorised-phrase'
  | 'vague-quantifier'
  | 'collocation'
  // Grammatical Range & Accuracy
  | 'sentence-variety'
  | 'long-sentence'
  | 'short-sentence-run'
  | 'comma-splice'
  | 'capitalisation'
  | 'fragment'
  | 'article'
  | 'agreement'
  | 'who-for-people'
  | 'connector-comma'
  | 'first-person-overuse'
  | 'missing-hedging';

export type Severity = 'error' | 'warning' | 'info';

export interface Issue {
  /** Unique within one Analysis. The engine assigns these; rules may leave a placeholder. */
  id: string;
  category: IssueCategory;
  criterion: Criterion;
  severity: Severity;
  /** Learner-facing message: what is wrong AND how to fix it. Plain language. */
  message: string;
  /** Char offsets into the essay text. null start = essay-level issue (no inline highlight). */
  start: number | null;
  end: number | null;
  /** Short quote of the offending text, when span-level. */
  excerpt?: string;
}

/* ------------------------------- tokenization ------------------------------- */

export interface Token {
  text: string;
  lower: string;
  start: number;
  end: number;
}

export interface SentenceSpan {
  text: string;
  start: number;
  end: number;
  wordCount: number;
  paragraphIndex: number;
}

export interface ParagraphSpan {
  index: number;
  text: string;
  start: number;
  end: number;
  wordCount: number;
  sentences: SentenceSpan[];
}

export interface TokenizedDoc {
  text: string;
  /** Word tokens only (no punctuation), in order. */
  words: Token[];
  sentences: SentenceSpan[];
  paragraphs: ParagraphSpan[];
  wordCount: number;
}

/* ----------------------------- structure model ------------------------------ */

export type ParagraphRole = 'introduction' | 'body' | 'conclusion';

export interface ParagraphInfo {
  index: number;
  start: number;
  end: number;
  role: ParagraphRole;
  wordCount: number;
  sentenceCount: number;
  /** Body paragraphs only: whether a plausible topic sentence was found. */
  hasTopicSentence?: boolean;
}

export interface StructureCheck {
  /** Stable id, e.g. 'intro-present', 'position-stated', 'body-count', 'body-1-topic', 'conclusion-present'. */
  id: string;
  label: string;
  satisfied: boolean;
  /** One-line explanation of the current state, learner-facing. */
  detail?: string;
}

/* --------------------------------- analysis --------------------------------- */

export interface EssayStats {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  avgSentenceLength: number;
  /** Std deviation of sentence word counts — proxy for grammatical range. */
  sentenceLengthStdDev: number;
  /** Unique/total among words of length >= 4, lowercase. 0 when too short to measure. */
  typeTokenRatio: number;
  linkingDeviceCount: number;
}

export interface BandEstimate {
  /** 4.0–9.0 in 0.5 steps. Heuristic — the UI must label it as an estimate. */
  overall: number;
  byCriterion: Record<Criterion, number>;
  /** Bullet reasons per criterion, learner-facing. */
  rationale: Record<Criterion, string[]>;
}

export interface Analysis {
  issues: Issue[];
  paragraphs: ParagraphInfo[];
  structure: StructureCheck[];
  stats: EssayStats;
  band: BandEstimate;
}

/** Signature every rule module implements. */
export type RuleFn = (doc: TokenizedDoc, prompt: PromptSpec | null) => Issue[];

/* ----------------------------- sessions & profile --------------------------- */

export type WritingMode = 'coach' | 'exam';

export interface SessionRecord {
  id: string;
  dateISO: string;
  mode: WritingMode;
  promptId: string | null;
  promptText: string;
  questionType: QuestionType | null;
  essayText: string;
  /** Seconds spent, exam mode only. */
  durationSec: number | null;
  /** Word-count samples every 30s, exam mode only — drives the pacing chart. */
  pacing: Array<{ t: number; words: number }> | null;
  /** Blocked paste attempts, exam mode only. */
  pasteAttempts: number | null;
  /** Analysis snapshot taken at submit time. */
  analysis: Analysis;
}

export interface CategoryStat {
  total: number;
  /** Issues per 100 words over the last 5 sessions (0 if unseen). */
  recentRate: number;
  trend: 'improving' | 'flat' | 'worsening';
  lastSeenISO: string | null;
}

export interface ErrorProfile {
  totalSessions: number;
  categories: Partial<Record<IssueCategory, CategoryStat>>;
  /** Top 3 current weaknesses, recency-weighted. Empty until 2+ sessions exist. */
  focusCategories: IssueCategory[];
}

export interface CategoryTrend {
  category: IssueCategory;
  perSession: Array<{
    sessionId: string;
    dateISO: string;
    count: number;
    per100Words: number;
  }>;
}

/* ------------------------------ component props ----------------------------- */

export interface EditorProps {
  text: string;
  onChange: (text: string) => void;
  /** Span-level issues to highlight inline. Pass [] to hide all highlights. */
  issues: Issue[];
  showHighlights: boolean;
  placeholder?: string;
  /** Issue id to flash/scroll to, set when the user clicks an issue in the panel. */
  focusIssueId?: string | null;
  /** Exam discipline: block paste/drop and report each attempt. */
  blockPaste?: boolean;
  onPasteBlocked?: () => void;
  /** Native browser spellcheck — true in coach, false in exam. */
  spellCheckEnabled?: boolean;
}

export interface StructureRailProps {
  checks: StructureCheck[];
  paragraphs: ParagraphInfo[];
  /** Question type of the active prompt, to label expected parts. */
  questionType: QuestionType | null;
}

export interface FeedbackPanelProps {
  analysis: Analysis | null;
  profile: ErrorProfile | null;
  onSelectIssue: (issue: Issue) => void;
}

export interface TimerProps {
  secondsLeft: number;
  totalSeconds: number;
  running: boolean;
}

export interface ReportProps {
  session: SessionRecord;
  previousSession: SessionRecord | null;
  profile: ErrorProfile;
  onRedraft: () => void;
  onNewEssay: () => void;
  onViewDashboard: () => void;
}

export interface DashboardProps {
  sessions: SessionRecord[];
  profile: ErrorProfile;
  trends: CategoryTrend[];
  onOpenSession: (id: string) => void;
  /** Start a new essay; if focus is set, the app pre-selects amplified coaching for it. */
  onStartPractice: (focus: IssueCategory | null) => void;
  onDeleteSession: (id: string) => void;
  onExport: () => void;
  onImport: (json: string) => void;
}

export interface PromptPickerProps {
  prompts: PromptSpec[];
  current: PromptSpec | null;
  onPick: (p: PromptSpec) => void;
}
