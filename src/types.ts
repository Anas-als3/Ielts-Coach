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
  /**
   * Which exams this prompt is appropriate for. Task 2 marking is identical in
   * both, so most prompts suit both; abstract topics (space exploration,
   * globalisation) are Academic-only in practice, and everyday ones suit both.
   * Absent means both, so existing bank entries need no edit to keep working.
   */
  modules?: Module[];
}

/* --------------------------------- task 1 ----------------------------------- */

/** What an IELTS Academic Task 1 visual actually is. */
export type Task1VisualKind = 'line' | 'bar' | 'pie' | 'table' | 'process';

/**
 * One named data series. `values` is index-aligned with `Task1Chart.categories`;
 * a `null` entry means "no data for this category" and is rendered as a gap,
 * never as zero.
 */
export interface Task1Series {
  name: string;
  values: Array<number | null>;
}

/**
 * The chart as DATA, not as an image — this is what makes deterministic Task 1
 * analysis possible. Because the app owns the numbers, the rules can check
 * whether a learner cited a figure that exists, named the real maximum, and
 * covered the actual trend.
 *
 * `process` charts carry no numbers: they use `steps` and leave `series` empty.
 */
export interface Task1Chart {
  kind: Task1VisualKind;
  /** Chart title as it would be printed above the visual in the exam. */
  title: string;
  /** Unit of the values, e.g. "%", "million tonnes", "students". Used in feedback copy. */
  unit: string;
  /** x-axis / row labels, e.g. ["1990", "2000", "2010"] or ["Cycling", "Bus"]. */
  categories: string[];
  /** Empty for `process` charts. */
  series: Task1Series[];
  /** Ordered step labels — `process` charts only; empty otherwise. */
  steps: string[];
  /**
   * The chart's topic as a plain noun phrase, in DIFFERENT words from `title`.
   * The model-answer generator opens with it, which is exactly the paraphrase
   * Task 1 asks the learner for — reusing `title` would make the app's own
   * example fail its own `t1-prompt-echo` rule.
   */
  subject: string;
  /** e.g. "between 2005 and 2020". Omitted for charts with no time axis. */
  periodLabel?: string;
  /** Optional axis captions. */
  xLabel?: string;
  yLabel?: string;
}

/**
 * A Task 1 prompt. Deliberately a SIBLING of PromptSpec rather than an
 * extension: Task 1 has no QuestionType, and every Task 2 rule that takes a
 * `PromptSpec` would otherwise have to defend against a shape it cannot use.
 */
export interface Task1PromptSpec {
  id: string;
  /** Always the literal 'task1' — lets a union of the two prompt kinds discriminate. */
  task: 'task1';
  /** Full task text shown to the learner, ending with the standard Task 1 instruction. */
  text: string;
  /** Short topic tag, e.g. "energy", "transport". */
  topic: string;
  chart: Task1Chart;
  /** The parts a complete answer must address, phrased as a checklist. */
  parts: string[];
  /** Content words from the prompt and chart labels, lowercase — for prompt-echo and relevance. */
  keywords: string[];
}

/* ------------------------ general training task 1 --------------------------- */

/**
 * How formal a letter must be. The prompt fixes this — "write to your manager"
 * is semi-formal, "write to the council" is formal, "write to a friend" is
 * informal — and the whole letter must hold that register consistently.
 *
 * Tone is the ONE piece of a letter prompt that changes what counts as correct
 * English in the answer, which is why it reaches as far as `lexicalRules`: a
 * contraction is an error in a letter to a bank and correct in a letter to a
 * friend.
 */
export type LetterTone = 'formal' | 'semi-formal' | 'informal';

/**
 * A General Training Writing Task 1 prompt.
 *
 * A SIBLING of PromptSpec and Task1PromptSpec, for the same reason those two are
 * siblings: a letter has no QuestionType and no chart, and forcing one shape to
 * cover all three would make every rule defend against fields it cannot use.
 */
export interface LetterPromptSpec {
  id: string;
  /** Always the literal 'letter' — lets a union of the three prompt kinds discriminate. */
  task: 'letter';
  /** Full task text, ending with the standard General Training instruction. */
  text: string;
  tone: LetterTone;
  /** Who the letter goes to, as the prompt names them: "your manager", "the council". */
  recipient: string;
  /**
   * The three bullet points the prompt supplies. All three must be covered —
   * this drives the `gt-bullet-uncovered` check.
   */
  bullets: string[];
  /**
   * Content words per bullet, lowercase — how coverage is detected. Index-aligned
   * with `bullets`. Each list must be WIDE (the synonyms a good answer would
   * reach for), because under-detecting coverage tells a correct learner they
   * failed the task, which is the worst thing this app can say.
   */
  bulletKeywords: string[][];
  topic: string;
  keywords: string[];
}

/**
 * Facts derived from a Task1Chart, computed once and reused by the analysis
 * rules. See `analysis/chartFacts.ts`.
 */
export interface Task1ChartFacts {
  /** Every distinct numeric value present in the chart, deduplicated and ascending. */
  values: number[];
  /** Highest value with the series and category it belongs to; null when the chart has no numbers. */
  peak: { series: string; category: string; value: number } | null;
  /** Lowest value, same shape. */
  trough: { series: string; category: string; value: number } | null;
  /** Largest single step-to-step increase across all series. `delta` is a positive magnitude. */
  biggestRise: { series: string; from: string; to: string; delta: number } | null;
  /** Largest single step-to-step decrease. `delta` is a POSITIVE magnitude — the field name carries the direction. */
  biggestFall: { series: string; from: string; to: string; delta: number } | null;
  /** True when at least two series exist — a comparison is then expected of the learner. */
  comparative: boolean;
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
  | 'missing-hedging'
  // Task 1 (Task Achievement — occupies the 'TR' criterion slot)
  | 't1-word-count'
  | 't1-overview-missing'
  | 't1-invented-figure'
  | 't1-no-data-cited'
  | 't1-no-comparison'
  | 't1-explains-causes'
  | 't1-opinion'
  | 't1-prompt-echo'
  // Task 1 (Coherence & Cohesion)
  | 't1-shape'
  // General Training Task 1 (letters). Task Achievement occupies the 'TR' slot.
  | 'gt-word-count'
  | 'gt-salutation-missing'
  | 'gt-salutation-tone'
  | 'gt-signoff-missing'
  | 'gt-signoff-pairing'
  | 'gt-bullet-uncovered'
  | 'gt-purpose-missing'
  | 'gt-tone-mismatch';

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

/**
 * Signature every rule module implements.
 *
 * A module may declare extra trailing parameters (see `cohesionRules`, which
 * takes an optional `TaskKind`, and `lexicalRules`, which additionally takes an
 * optional `LetterTone`) — TypeScript accepts a longer signature here, and
 * callers that do not pass them get the documented default.
 */
export type RuleFn = (
  doc: TokenizedDoc,
  prompt: PromptSpec | null,
  task?: TaskKind,
  tone?: LetterTone,
) => Issue[];

/* ----------------------------- sessions & profile --------------------------- */

/**
 * Which IELTS exam the learner is preparing for.
 *
 * These are two different exams sharing a name. The differences that reach this
 * codebase:
 *  - Writing Task 1 is a chart description in Academic and a LETTER in General
 *    Training — a different task with a different marking focus.
 *  - Writing Task 2 is marked identically; only the topics differ, which is a
 *    property of the prompt bank rather than of the engine.
 *  - Reading uses a stricter raw-score-to-band conversion for General Training
 *    (roughly four more correct answers for the same band).
 *  - Listening and Speaking are identical in both.
 */
export type Module = 'academic' | 'general';

/**
 * Which IELTS task a session belongs to. `task2` is the only value produced by
 * the current app; sessions saved before schemaVersion 2 are migrated to it.
 */
export type TaskKind = 'task1' | 'task2';

export type WritingMode = 'coach' | 'exam';

export interface SessionRecord {
  id: string;
  dateISO: string;
  mode: WritingMode;
  /** Which IELTS task this session answered. Migrated to 'task2' for pre-v2 data. */
  task: TaskKind;
  /** Which exam it was preparing for. Migrated to 'academic' for pre-v3 data. */
  module: Module;
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
  /** Question type of the active prompt, to label expected parts. Null for Task 1. */
  questionType: QuestionType | null;
  /** Which task the rail is describing. Defaults to 'task2' when omitted. */
  task?: TaskKind;
  /**
   * Which exam. Only read together with `task === 'task1'`, where it separates
   * the Academic chart answer from the General Training letter — two different
   * tasks with different paragraph norms sharing one `TaskKind`. Defaults to
   * 'academic' so every existing call site keeps its behaviour.
   */
  module?: Module;
}

export interface FeedbackPanelProps {
  analysis: Analysis | null;
  profile: ErrorProfile | null;
  onSelectIssue: (issue: Issue) => void;
  /** Which task is being written. Drives the word count at which estimates unlock. */
  task?: TaskKind;
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

export interface AppProps {
  /**
   * Initial Task 2 prompt. Production passes nothing and gets a random draw;
   * tests pass a fixed prompt so `render(<App />)` is deterministic. Without
   * this the UI suite drew a different question every run, and assertions that
   * happened to be true for some draws failed for others.
   */
  initialPrompt?: PromptSpec;
  /** Initial Task 1 prompt, for the same reason. */
  initialTask1Prompt?: Task1PromptSpec;
  /** Initial General Training letter prompt, for the same reason. */
  initialLetterPrompt?: LetterPromptSpec;
}

export interface ModelAnswerProps {
  task: TaskKind;
  /** The active Task 2 prompt, when task is 'task2'. */
  prompt: PromptSpec | null;
  /** The active Task 1 prompt, when task is 'task1' in the Academic module. */
  task1Prompt: Task1PromptSpec | null;
  /**
   * The active letter prompt, when task is 'task1' in General Training. Takes
   * precedence over `task1Prompt`, because the two can never be on screen at
   * once and the letter is the more specific case.
   */
  letterPrompt?: LetterPromptSpec | null;
}

export interface ChartProps {
  chart: Task1Chart;
  /** Accessible caption; falls back to `chart.title` when omitted. */
  caption?: string;
}
