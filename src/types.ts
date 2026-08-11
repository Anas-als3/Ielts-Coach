/**
 * Shared contract for the whole app. Every module — analysis rules, storage,
 * and UI components — codes against these types. Do not change shapes without
 * updating all consumers.
 *
 * The Reading contracts stay in `src/reading/types.ts` and are imported here
 * rather than restated. The import is type-only and so is `reading/types.ts`'s
 * import of `Module` from this file: both are erased at compile time, so the
 * two files reference each other's types without any runtime cycle, and
 * `src/reading/` keeps the independence plan 010 gave it.
 *
 * `src/listening/` is imported on exactly the same terms, and for the same
 * reason: the Listening engine shipped ahead of this wiring and must stay
 * testable in Node without the app shell. `SpeechDriver` is included because
 * the runner takes one as a prop — that is what lets a test drive playback with
 * `FakeSpeechDriver` instead of a browser's `speechSynthesis`, which does not
 * exist in jsdom and is flaky where it does.
 */
import type { ReadingAnswers, ReadingResult, ReadingTest } from './reading/types';
import type {
  ListeningAnswers,
  ListeningResult,
  ListeningTest,
} from './listening/types';
import type { SpeechDriver, SpeechDriverKind } from './listening/speech';

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
 * Learner preferences, persisted under `profile/prefs.ts`'s `PREFS_KEY` — a
 * SEPARATE localStorage key from the sessions store, with no schema ladder:
 * every field is optional and independently validated, so a bad value is
 * dropped alone rather than versioned around.
 */
export interface Prefs {
  /** Owned by plan 026 (intro dismissal); carried here so it round-trips
   *  through load/save/export whichever plan lands first. */
  introDismissedAtISO?: string;
  /** Exam day as 'YYYY-MM-DD' (a calendar date, not an instant). */
  examDateISO?: string;
  /** Target overall band: 4.0–9.0 in half steps. */
  targetOverall?: number;
  /** Per-SECTION targets (IELTS requirements are per section, never per
   *  Writing criterion). */
  targetBySection?: Partial<Record<SessionSection, number>>;
  /** The exam the learner is preparing for; restored on next visit. */
  module?: Module;
  /**
   * Owned by plan 032: a `SpeechSynthesisVoice.voiceURI` the learner picked
   * from the Listening picker's voice select, overriding the automatic
   * quality-ranked choice (`src/listening/speech.ts`'s `pickVoice`/
   * `rankVoices`). Undefined means "Automatic (recommended)". A URI that no
   * longer names an installed voice (voices come and go with OS updates)
   * falls back to Automatic silently — never an error — the same rule every
   * other field here follows for a value this build can no longer use.
   */
  preferredVoiceURI?: string;
}

/**
 * Which IELTS task a session belongs to. `task2` is the only value produced by
 * the current app; sessions saved before schemaVersion 2 are migrated to it.
 */
export type TaskKind = 'task1' | 'task2';

export type WritingMode = 'coach' | 'exam';

/**
 * Which section of the exam a saved session belongs to — the discriminator of
 * `SessionRecord`.
 *
 * A Writing session is an essay plus an `Analysis`; a Reading session is an
 * answer sheet plus a `ReadingResult`; a Listening session is an answer sheet
 * plus a `ListeningResult`. They share almost no fields, so the alternative —
 * one record with every writing field made optional — would have forced
 * `analysis?` and `essayText?` on the report, the dashboard and the error
 * profile, which between them read those fields on nearly every line. A
 * discriminated union pushes that decision to ONE `switch` at each boundary and
 * lets the compiler find every site that forgot it.
 *
 * Stamped onto pre-v4 records by the schemaVersion 4 migration; `'listening'`
 * was added by schemaVersion 5, which needed no data migration because no
 * stored record could already be one. See `profile/store.ts`.
 */
export type SessionSection = 'writing' | 'reading' | 'listening';

/** One practised essay, letter or chart description, as persisted. */
export interface WritingSessionRecord {
  /** Discriminator. Migrated to 'writing' for pre-v4 data. */
  section: 'writing';
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

/**
 * One sat Reading paper, as persisted.
 *
 * Carries no `Analysis` and produces no `IssueCategory`, which is exactly why
 * `computeProfile` and `computeTrends` must skip it: counting a Reading session
 * as a writing session with zero issues would read as a clean essay and dilute
 * every error rate the learner is trying to improve.
 *
 * The `result` is stored rather than recomputed on read so a learner's history
 * still displays after the authored content changes — but `answers` is stored
 * too, so a re-mark against a corrected key is always possible.
 */
export interface ReadingSessionRecord {
  section: 'reading';
  id: string;
  dateISO: string;
  /** Which exam's conversion table the band came from. */
  module: Module;
  /** `ReadingTest.id`. May name a test no longer shipped. */
  testId: string;
  /** Test title captured at submit time, so history reads correctly regardless. */
  testTitle: string;
  /** Exactly what was submitted, keyed by question id. */
  answers: ReadingAnswers;
  /** Marking snapshot: raw score, band, per-question results, per-type accuracy. */
  result: ReadingResult;
  /** Seconds spent. Reading is always timed, but null is tolerated on read. */
  durationSec: number | null;
}

/**
 * One sat Listening paper, as persisted.
 *
 * Deliberately a SIBLING of `ReadingSessionRecord` rather than a reuse of it,
 * and the difference is the point: **there is no `module` field.** Academic and
 * General Training candidates sit the identical Listening paper and convert
 * through the identical table, so there is nothing to record and nothing to
 * filter on. A `module` here would invite the history list, the picker and the
 * report to branch on a distinction that does not exist — plan 011: "Listening
 * needs no Academic/General branching. Resist any abstraction that implies
 * otherwise."
 *
 * Like Reading, it carries no `Analysis` and produces no `IssueCategory`, so
 * `computeProfile` and `computeTrends` must skip it for exactly the reason they
 * skip Reading: a paper counted as a writing session with zero issues reads as
 * a clean essay and dilutes every error rate the learner is working on.
 */
export interface ListeningSessionRecord {
  section: 'listening';
  id: string;
  dateISO: string;
  /** `ListeningTest.id`. May name a test no longer shipped. */
  testId: string;
  /** Test title captured at submit time, so history reads correctly regardless. */
  testTitle: string;
  /** Exactly what was submitted, keyed by question id. */
  answers: ListeningAnswers;
  /** Marking snapshot: raw score, band, per-question results, per-format accuracy. */
  result: ListeningResult;
  /** Seconds spent. Listening is always timed, but null is tolerated on read. */
  durationSec: number | null;
  /**
   * True when the paper was sat in practice mode, where a section may be
   * replayed and played out of order. Such a band is NOT comparable to an
   * exam-condition run, and the report says so rather than quietly filing it
   * beside scores that were earned once through.
   */
  practice: boolean;
}

/**
 * A saved session, discriminated on `section`.
 *
 * Narrow with `s.section === 'reading'` rather than by probing for a field.
 * Pre-v4 records reach the app already stamped `'writing'` by the migration,
 * so no consumer needs to defend against the field being absent.
 */
export type SessionRecord =
  | WritingSessionRecord
  | ReadingSessionRecord
  | ListeningSessionRecord;

/**
 * Narrow a session to the Reading variant.
 *
 * The only runtime code in this file, and it lives here because it IS the
 * contract: every consumer that must not treat a Reading paper as an essay
 * asks this one question, and asking it in one place is what stops a second,
 * subtly different test appearing in the dashboard or the profile.
 *
 * Written as `=== 'reading'` rather than `!== 'writing'` deliberately, so the
 * three guards agree on the same defensive default: a record whose `section` is
 * somehow absent — hand-edited storage, an import from a build between
 * versions — counts as WRITING, exactly as every record did before Reading
 * existed. The same reasoning `categoryAppliesTo` applies to `module`.
 */
export function isReadingSession(s: SessionRecord): s is ReadingSessionRecord {
  return s.section === 'reading';
}

/** Narrow a session to the Listening variant. See `isReadingSession`. */
export function isListeningSession(s: SessionRecord): s is ListeningSessionRecord {
  return s.section === 'listening';
}

/**
 * The `section` of a stored record, as the union it can actually hold.
 *
 * Two jobs, and the second one is the load-bearing one:
 *
 *  1. `section` is non-optional in every variant of `SessionRecord`, but pre-v4
 *     stored data genuinely has no such field, so `undefined` has to be a value
 *     the caller can handle. Comparing `s.section` to `undefined` directly is a
 *     compile error — the types do not overlap.
 *  2. The RETURN TYPE ANNOTATION is a barrier against control-flow analysis.
 *     Writing `const section: SessionSection | undefined = s.section` inline
 *     looks equivalent and is not: TypeScript narrows that const straight back
 *     to the initialiser's three literals, so the `default` below would narrow
 *     to `never` no matter how many members `SessionSection` grew, and the
 *     exhaustiveness check would silently stop checking anything. A call's type
 *     is its declared return type and nothing narrower, so the check survives.
 *     This was verified by adding a fourth member and watching the build fail.
 */
function storedSection(s: SessionRecord): SessionSection | undefined {
  return s.section;
}

/**
 * Narrow a session to the Writing variant.
 *
 * Every section is named here explicitly, in a `switch` whose `default` assigns
 * to `never`, and that shape is the point rather than a stylistic preference.
 *
 * This was written as `s.section !== 'reading' && s.section !== 'listening'`.
 * TypeScript does not check that a type predicate's BODY proves its predicate,
 * so the day a fourth section shipped, that line would have compiled clean at
 * exit 0 while quietly answering "yes, that Speaking test is an essay" — and
 * the consequence is not abstract: the paper counts towards `totalSessions`,
 * contributes zero issues over zero words to every category, and a weakness the
 * learner still has flips from `flat` to `improving`. The Dashboard then
 * congratulates them on fixing it. A silent wrong answer in a coaching signal
 * is the worst failure mode in this app, and the only defence that survives a
 * hurried patch is one the compiler enforces.
 *
 * With the `switch`, forgetting the line is a BUILD failure, whichever half of
 * the change is forgotten: add a `SessionRecord` variant without extending
 * `SessionSection` and the assignment below rejects the new literal; extend
 * `SessionSection` without handling it here and `default` narrows to that
 * literal, which will not assign to `never`.
 *
 * `undefined` keeps the documented default — a record with no `section` at all
 * predates the field, so it can only be an essay, exactly as
 * `isReadingSession`/`isListeningSession` assume. An unrecognised NON-empty
 * value is the opposite case and returns false: a value this build has never
 * heard of comes from a newer build, where new sections are overwhelmingly
 * answer keys rather than essays, and guessing "essay" is the dilution above.
 * `tests/profile-scoping.test.ts` pins both.
 */
export function isWritingSession(s: SessionRecord): s is WritingSessionRecord {
  const section = storedSection(s);
  switch (section) {
    case 'reading':
    case 'listening':
      return false;
    case 'writing':
    case undefined:
      return true;
    default: {
      // Unreachable while every member is handled above — and unreachable is
      // the assertion, not a comment about it: adding a member to
      // `SessionSection` makes `section` narrow to that member here, and a
      // string literal does not assign to `never`.
      const unhandledSection: never = section;
      void unhandledSection;
      return false;
    }
  }
}

/**
 * What a write to localStorage did. `saveSession` returns this so a caller can
 * tell the learner — `writeStore` used to return `void` and swallow every
 * failure into `console.warn`, so a full quota looked identical to a
 * successful save from every caller's point of view, and the caller went on
 * to navigate to a report for a session that was never persisted.
 */
export type SaveResult =
  | { ok: true }
  | { ok: false; reason: 'quota' | 'unavailable'; message: string };

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

/**
 * `Report` and `Dashboard` are WRITING views: every line of both reads
 * `analysis`, `essayText` or `task`. They therefore take the writing variant
 * rather than the union — a Reading session has none of those fields, and the
 * app filters before it renders. Reading has its own report.
 */
export interface ReportProps {
  session: WritingSessionRecord;
  previousSession: WritingSessionRecord | null;
  profile: ErrorProfile;
  onRedraft: () => void;
  onNewEssay: () => void;
  onViewDashboard: () => void;
  /** The learner's target overall band, when set — the report shows the gap
   *  beside the estimate. Optional: no target, no chip. */
  targetOverall?: number;
}

/** How an import should reconcile the file against what is already stored. */
export type ImportMode = 'merge' | 'replace';

/** What an import did — the Dashboard shows this to the learner. */
export interface ImportSummary {
  mode: ImportMode;
  /** Live sessions in the store after the write. */
  sessionCount: number;
  /** Sessions dropped by the per-section cap DURING this import (0 almost always). */
  evictedCount: number;
}

export interface DashboardProps {
  sessions: WritingSessionRecord[];
  /**
   * EVERY saved session, not only the essays in `sessions`.
   *
   * The page is a writing view and `sessions` stays writing-only — but two of
   * its controls act on the WHOLE store: `onExport` writes every section to the
   * file, and `onImport` acts on every section. Counting those from the
   * filtered list told a learner with a complete Reading history that importing
   * would replace "0 essays", immediately before it destroyed all of it.
   */
  allSessions: SessionRecord[];
  profile: ErrorProfile;
  trends: CategoryTrend[];
  onOpenSession: (id: string) => void;
  /**
   * Start a new essay. `null` behaves exactly like the header's plain "Start
   * practice": a fresh essay on whatever desk is already open. A category
   * retargets the desk to a task/prompt suited to drilling it where the bank
   * supports that (a chart, a General Training letter, or Task 2, per
   * `meta.ts`'s task-scoped category sets) and shows a dismissible "Drilling:
   * <category>" banner naming it and its hint; a category with no such
   * distinction (most GRA/LR faults, which fire on either task) leaves the
   * desk untouched and shows the same banner.
   */
  onStartPractice: (focus: IssueCategory | null) => void;
  onDeleteSession: (id: string) => void;
  onExport: () => void;
  onImport: (json: string, mode: ImportMode) => ImportSummary;
  /** Learner prefs, passed down rather than read from storage in the
   *  component: App owns the single copy of state (same rule as sessions),
   *  and a test can assert the card re-renders when they change. */
  prefs: Prefs;
  /** The latest band per SECTION, from every saved session (not just
   *  writing) — lets the "Your exam" card show a gap without depending on a
   *  Dashboard-props rework. */
  latestBandBySection: Partial<Record<SessionSection, number>>;
  onUpdatePrefs: (patch: Partial<Prefs>) => void;
  module: Module;
  onSwitchModule: (m: Module) => void;
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
  /**
   * The speech driver the Listening runner speaks through. Production passes
   * nothing and gets `createSpeechDriver()` — the browser's synthesiser, or the
   * paced transcript where there is no voice.
   *
   * Tests pass a `FakeSpeechDriver`. That is not a convenience: jsdom has no
   * `speechSynthesis` at all, so an uninjected runner would fall back to the
   * paced driver and drive the suite off real `setTimeout`s at 130 words per
   * minute. No test may depend on a real speech engine.
   */
  listeningDriver?: SpeechDriver;
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

/** What the learner picked in the library, carried to the writing desk. */
export type LibrarySelection =
  | { kind: 'task2'; prompt: PromptSpec }
  | { kind: 'chart'; prompt: Task1PromptSpec }
  | { kind: 'letter'; prompt: LetterPromptSpec };

export interface ModelLibraryProps {
  /** Put this question on the writing desk and switch to the write view. */
  onPractise: (selection: LibrarySelection) => void;
}

/* ------------------------------ writing templates ---------------------------- */

/**
 * One paragraph's job inside a `WritingTemplate`: what it must accomplish, in
 * order, plus a couple of openers the learner rewords rather than copies.
 */
export interface TemplateSection {
  title: string;
  /** 2-3 sentences: what this paragraph must do. */
  guidance: string;
  /** 0-2 openers, to be REWORDED, never pasted verbatim into the essay. */
  starters: readonly string[];
}

/** A named paragraph-by-paragraph skeleton for one task, question type or tone. */
export interface WritingTemplate {
  /** Kebab, stable — append-only (plan 033's frozen-id discipline). */
  id: string;
  label: string;
  kind: 'task2' | 'chart' | 'letter';
  /** Task 2 templates only. */
  questionTypes?: readonly QuestionType[];
  /** Letter templates only. */
  tones?: readonly LetterTone[];
  paragraphs: readonly TemplateSection[];
  /** When to prefer this template over its sibling for the same type/tone. */
  note?: string;
}

export interface TemplatePanelProps {
  task: TaskKind;
  isLetter: boolean;
  /** The active Task 2 prompt's question type. Null outside Task 2. */
  questionType: QuestionType | null;
  /** The active letter prompt's tone. Null outside a General Training letter. */
  tone: LetterTone | null;
  /** `analysis.paragraphs.length`, i.e. how many paragraphs are typed so far. */
  paragraphCount: number;
}

/* ------------------------------ reading component props --------------------- */

/** Where the learner is inside the Reading section: choosing, sitting, reviewing.
 *  Owned by `App` (survives `ReadingSection`'s unmount on navigation) — see
 *  `ReadingSectionProps.stage`. */
export type ReadingStage = 'picker' | 'running' | 'report';

export interface ReadingRunnerProps {
  /** The paper being sat. Its `module` decides which band table marks it. */
  test: ReadingTest;
  /**
   * Called once, with everything typed or selected and the seconds spent. The
   * runner holds answers in component state and persists NOTHING before this —
   * a half-finished paper is not a session.
   */
  onSubmit: (answers: ReadingAnswers, durationSec: number) => void;
  /** Abandon the attempt. The runner confirms first; nothing is saved. */
  onExit: () => void;
}

export interface ReadingPickerProps {
  /** The active exam. Decides which papers are listed and which table marks them. */
  module: Module;
  /** Papers for `module` ONLY — never the other exam's, which is marked differently. */
  tests: ReadingTest[];
  /** This module's past attempts, most recent first. */
  history: ReadingSessionRecord[];
  onStart: (testId: string) => void;
  onOpen: (session: ReadingSessionRecord) => void;
}

export interface ReadingReportProps {
  session: ReadingSessionRecord;
  /**
   * The test as authored, for the question prompts and passage headings the
   * result does not carry. Null when the stored `testId` names content this
   * build no longer ships — the report still renders the score, the band and
   * every answer, just without the prompts.
   */
  test: ReadingTest | null;
  /** Sit the same paper again. */
  onRetake: () => void;
  /** Back to the list of papers. */
  onPickAnother: () => void;
}

/**
 * `ReadingSection`'s own props — plan 023. The container owns rendering and
 * registry lookups (`readingTestsForModule`, `readingTestById`) only; every
 * atom of STATE stays in `App` (`readingStage`/`readingTestId`/
 * `readingSessionId` at `App.tsx:129-131`), because `App` writes the stage
 * from `openReading` while the container is unmounted, and the container is
 * torn down on every navigation away — see plan 023's "Decided, not left to
 * the executor" note for the two reasons neither can move.
 */
export interface ReadingSectionProps {
  module: Module;
  /** Where the learner is in the section. Owned by App so it survives the
   *  container's unmount on navigation, and so `openReading` can still reset
   *  it while the container does not exist. */
  stage: ReadingStage;
  /** Move to another stage without the mock-abandon side effect below —
   *  `ReadingReport`'s "back to the list" uses this. */
  onStageChange: (stage: ReadingStage) => void;
  /**
   * Leave a running paper: resets the stage to 'picker' AND abandons a mock
   * sitting in progress (`App`'s `abandonMockIfActive`) — the runner already
   * asked its own "leave this test?" question before ever calling this, so no
   * second confirm belongs here. A distinct prop from `onStageChange` because
   * only the runner's exit carries that second effect.
   */
  onExit: () => void;
  /** The paper being sat or reviewed; null on the picker. App owns it. */
  testId: string | null;
  /** Start a paper — App's `startReadingTest`, unchanged. */
  onStart: (testId: string) => void;
  /** Reading sessions for the ACTIVE module, newest first, for the picker's
   *  history list. Derived in App, which filters by `module`. */
  history: ReadingSessionRecord[];
  /** The stored sitting being reviewed, or null. Derived in App from the
   *  UNFILTERED session list — the container must not re-derive it from
   *  `history`, which IS filtered (see `App.tsx`'s `readingSession` memo). */
  session: ReadingSessionRecord | null;
  /** Open a stored result — App's `openReadingSession`, which takes the
   *  record, not an id. */
  onOpenSession: (session: ReadingSessionRecord) => void;
  /** A completed paper, marked. The container marks (`markAnswerKey`) and
   *  builds the record; App persists it and handles the mock hand-off. */
  onSubmit: (record: ReadingSessionRecord) => void;
}

/* ----------------------------- listening component props -------------------- */

/**
 * NONE of these three take a `Module`, and that absence is deliberate and
 * load-bearing. Listening is the identical paper in Academic and General
 * Training, so a module prop would be a parameter no implementation could
 * legitimately read — and the first time somebody read it anyway, a learner
 * would be shown a distinction the exam does not make.
 */

/** The same three places as `ReadingStage`, for Listening. */
export type ListeningStage = 'picker' | 'running' | 'report';

export interface ListeningRunnerProps {
  /** The paper being sat. */
  test: ListeningTest;
  /**
   * Allow replaying a section and playing sections out of order. Chosen on the
   * picker BEFORE the clock starts, never mid-paper: a learner who could switch
   * it on after missing an answer would have no exam-condition score left.
   */
  practice: boolean;
  /** Where the sections are spoken. Injected so tests need no speech engine. */
  driver: SpeechDriver;
  /**
   * Called once, with everything typed or selected, the seconds spent, and
   * whether replays were allowed. The runner holds answers in component state
   * and persists NOTHING before this — a half-finished paper is not a session.
   */
  onSubmit: (answers: ListeningAnswers, durationSec: number, practice: boolean) => void;
  /** Abandon the attempt. The runner confirms first; nothing is saved. */
  onExit: () => void;
}

export interface ListeningPickerProps {
  /** Every authored paper. There is no per-module list, because there is no per-module paper. */
  tests: ListeningTest[];
  /** Past attempts, most recent first. */
  history: ListeningSessionRecord[];
  /**
   * Which driver the platform actually gave us. Decides whether the screen
   * shows `SYNTHETIC_VOICE_NOTICE` or `TRANSCRIPT_FALLBACK_NOTICE` — the
   * learner is told what they are about to get before they commit 40 minutes.
   */
  driverKind: SpeechDriverKind;
  /** Start a paper. `practice` allows replays and out-of-order sections. */
  onStart: (testId: string, practice: boolean) => void;
  onOpen: (session: ListeningSessionRecord) => void;
}

export interface ListeningReportProps {
  session: ListeningSessionRecord;
  /**
   * The test as authored, for the question prompts and formats the result does
   * not carry. Null when the stored `testId` names content this build no longer
   * ships — the report still renders the score, the band and every answer.
   */
  test: ListeningTest | null;
  /** Sit the same paper again, under the same conditions. */
  onRetake: () => void;
  /** Back to the list of papers. */
  onPickAnother: () => void;
}

/**
 * `ListeningSection`'s own props — plan 023. `ReadingSectionProps`'s mirror:
 * the container owns rendering, the registry lookup (`listeningTestById`,
 * `LISTENING_TESTS`) and the speech driver's fallback construction; every
 * atom of state stays in `App`, for the same two reasons `ReadingSectionProps`
 * documents.
 */
export interface ListeningSectionProps {
  stage: ListeningStage;
  /** Move to another stage without the mock-abandon side effect — see
   *  `ReadingSectionProps.onStageChange`. */
  onStageChange: (stage: ListeningStage) => void;
  /** Leave a running paper — see `ReadingSectionProps.onExit`. */
  onExit: () => void;
  /** The paper being sat or reviewed; null on the picker. App owns it. */
  testId: string | null;
  /** Start a paper — App's `startListeningTest`, unchanged. */
  onStart: (testId: string, practice: boolean) => void;
  /** Chosen on the picker before the clock starts; held in App for the length
   *  of the attempt so "sit this paper again" repeats the SAME conditions. */
  practice: boolean;
  /** Past attempts, most recent first. Never filtered by module — see
   *  `App.tsx`'s `listeningHistory` memo for why Listening has no such filter. */
  history: ListeningSessionRecord[];
  /** The stored sitting being reviewed, or null. */
  session: ListeningSessionRecord | null;
  /** Open a stored result — App's `openListeningSession`. */
  onOpenSession: (session: ListeningSessionRecord) => void;
  /** A completed paper, marked. The container marks (`markListening`) and
   *  builds the record; App persists it and handles the mock hand-off. */
  onSubmit: (record: ListeningSessionRecord) => void;
  /**
   * The OPTIONAL injected driver — `AppProps.listeningDriver` forwarded
   * verbatim. When absent the container calls `createSpeechDriver()` itself,
   * exactly as `App` used to. That keeps test injection working (every test
   * that needs one injects it through `AppProps`) while taking
   * `src/listening/speech.ts` OUT of the entry chunk: a required prop would
   * force `App.tsx` to keep importing `createSpeechDriver`, pinning that
   * module in the entry graph.
   */
  driver?: SpeechDriver;
}

/* --------------------------------- mock test --------------------------------- */

/** Which section a mock's own screens are about to hand off to (the
 *  interstitial's "up next"), or already have (a completed leg). */
export type MockSection = 'listening' | 'reading' | 'writing';

/**
 * Which screen `MockTest` itself draws. Deliberately has NO member for "a
 * section is running": while Listening, Reading or Writing is actually being
 * sat, the ordinary `view` / `readingStage` / `listeningStage` / exam state in
 * `App` already say so, and `MockTest` steps out of the way so the real runner
 * (or the real writing desk) owns the screen. That absence is the whole point
 * of reusing them rather than forking a duplicate — see `MockAttempt`.
 */
export type MockStage = 'setup' | 'interstitial' | 'summary';

/**
 * One mock sitting's scratch state, held in `App` and handed to `MockTest` as
 * a prop.
 *
 * Deliberately NOT a fourth `SessionRecord` variant and NEVER persisted on its
 * own: each leg still saves through the ordinary `saveSession` path as an
 * ordinary record — a `ListeningSessionRecord`, then a `ReadingSessionRecord`,
 * then a `WritingSessionRecord` — exactly as a solo sitting of that section
 * would produce. This is only the note that remembers which three ids belong
 * to one attempt, so the summary can find and combine them; the combination
 * itself is computed on the fly into a `MockBands`
 * (`src/analysis/mockBand.ts`) rather than stored.
 *
 * A page reload mid-sitting loses this note. That is a deliberate, named gap
 * for this pass, not an oversight: persisting a "this sitting spans these
 * three ids" grouping is out of scope here (see `plans/013-mock-test-mode.md`)
 * and a future plan may add it. It is NOT a gap in the underlying data —
 * every leg that finished before the reload is already on disk under its
 * ordinary section, exactly as if it had been sat on its own, so nothing a
 * learner completed is lost, only the combined summary for THIS sitting.
 */
export interface MockAttempt {
  module: Module;
  listeningTestId: string;
  readingTestId: string;
  listeningRecord: ListeningSessionRecord | null;
  readingRecord: ReadingSessionRecord | null;
  writingRecord: WritingSessionRecord | null;
}

export interface MockTestProps {
  /** Which of MockTest's own three screens to draw. */
  stage: MockStage;
  /** The exam currently active app-wide — a mock sits whichever exam the
   *  learner already has open, the same as Reading and Listening do. */
  module: Module;
  /** This module's Reading papers, already filtered — MockTest never filters
   *  a second time, the same rule `ReadingPicker` follows. */
  readingTests: ReadingTest[];
  /** Every authored Listening paper — there is no per-module list. */
  listeningTests: ListeningTest[];
  /** The sitting in progress, or null before Start / after a fresh reset. */
  attempt: MockAttempt | null;
  /** Which section the interstitial names as "up next". Read only while
   *  `stage === 'interstitial'`. */
  nextSection: MockSection;
  /** Begin a sitting with these two paper choices, in the module above. */
  onStart: (readingTestId: string, listeningTestId: string) => void;
  /** Leave the interstitial and open the next leg's real runner (or the real
   *  Writing desk, for the last one). */
  onContinue: () => void;
  /** Abandon the sitting from the interstitial, with its own confirm — the
   *  "mock-level" exit guard, distinct from each running section's OWN leave
   *  control (see `MockAttempt`'s doc comment for why nothing already
   *  completed is lost). */
  onExit: () => void;
  /** From the summary: start a fresh sitting. */
  onRestart: () => void;
  onViewDashboard: () => void;
}

/**
 * `MockSection`'s own props — plan 023 (extended beyond the plan as written,
 * since plan 013 landed after it: MockTest did not exist when 023 was
 * authored). `MockTestProps` minus `readingTests`/`listeningTests`: the
 * container derives those itself from `module` (`readingTestsForModule`) and
 * from `LISTENING_TESTS`, exactly as `ReadingSection`/`ListeningSection` do
 * for their own pickers, so the two registries leave the entry chunk here
 * too. The mock's paper PICKS (the two ids inside `attempt`) and its stage
 * state stay in `App`, same as every other section — only the lookup that
 * turns `module` into a paper LIST is the container's job.
 */
export interface MockSectionProps {
  stage: MockStage;
  module: Module;
  attempt: MockAttempt | null;
  nextSection: MockSection;
  onStart: (readingTestId: string, listeningTestId: string) => void;
  onContinue: () => void;
  onExit: () => void;
  onRestart: () => void;
  onViewDashboard: () => void;
}
