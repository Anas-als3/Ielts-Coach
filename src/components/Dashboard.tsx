import { useMemo, useRef } from 'react'
import type { ChangeEvent } from 'react'
import type {
  DashboardProps,
  IssueCategory,
  Module,
  Prefs,
  SessionRecord,
  SessionSection,
  Severity,
  WritingSessionRecord,
} from '../types'
import { isListeningSession, isReadingSession, isWritingSession } from '../types'
import { CATEGORY_META, MODULE_META, QUESTION_TYPE_META } from '../meta'
import { TASK1_PROMPTS } from '../prompts/task1Bank'
import { sortByDateAscending } from '../profile/chronology'
import { daysUntil } from '../profile/prefs'
import './Dashboard.css'

/* --------------------------------- helpers --------------------------------- */

function fmtDate(iso: string, withYear = false): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(
    undefined,
    withYear
      ? { day: 'numeric', month: 'short', year: 'numeric' }
      : { day: 'numeric', month: 'short' },
  )
}

/**
 * Human, singular/plural-correct summary of what a session list holds, split
 * by section — "1 essay", "1 Reading paper and 2 Listening papers", and so
 * on. Zero-count sections are omitted entirely, so it reads correctly whether
 * called with the writing-only list, the whole store, or anything in between.
 *
 * Shared by the empty-state's export line and the import confirm so the two
 * cannot drift into naming a different count for the same store — which is
 * exactly how this page's original bug happened.
 */
function describeSections(list: SessionRecord[]): string {
  const essays = list.filter(isWritingSession).length
  const readingPapers = list.filter(isReadingSession).length
  const listeningPapers = list.filter(isListeningSession).length
  const parts: string[] = []
  if (essays > 0) parts.push(`${essays} essay${essays === 1 ? '' : 's'}`)
  if (readingPapers > 0) {
    parts.push(`${readingPapers} Reading paper${readingPapers === 1 ? '' : 's'}`)
  }
  if (listeningPapers > 0) {
    parts.push(`${listeningPapers} Listening paper${listeningPapers === 1 ? '' : 's'}`)
  }
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

const SEV_RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 }

const SEV_CLASS: Record<Severity, string> = {
  error: 'sev-error',
  warning: 'sev-warning',
  info: 'sev-info',
}

/** Most frequent category at the session's highest severity, or null. */
function topIssue(session: WritingSessionRecord): { label: string; severity: Severity } | null {
  const issues = session.analysis?.issues ?? []
  if (issues.length === 0) return null
  let bestSev: Severity = issues[0].severity
  for (const issue of issues) {
    if (SEV_RANK[issue.severity] < SEV_RANK[bestSev]) bestSev = issue.severity
  }
  const counts = new Map<IssueCategory, number>()
  for (const issue of issues) {
    if (issue.severity !== bestSev) continue
    counts.set(issue.category, (counts.get(issue.category) ?? 0) + 1)
  }
  let top: IssueCategory | null = null
  let topCount = 0
  for (const [category, count] of counts) {
    if (count > topCount) {
      top = category
      topCount = count
    }
  }
  return top ? { label: CATEGORY_META[top]?.label ?? top, severity: bestSev } : null
}

/** The chart kind a Task 1 session answered, resolved from the bank by prompt id. */
function task1KindOf(s: WritingSessionRecord): string {
  return TASK1_PROMPTS.find((p) => p.id === s.promptId)?.chart.kind ?? 'chart'
}

/* ------------------------------- exam goal card ------------------------------ */

/** The 11 half-bands IELTS actually awards, 4.0 through 9.0. */
const HALF_BANDS = Array.from({ length: 11 }, (_, i) => 4 + i * 0.5)

const SECTION_LABEL: Record<SessionSection, string> = {
  writing: 'Writing',
  reading: 'Reading',
  listening: 'Listening',
}

/** A target-band picker: '—' (no target) plus the 11 half-bands, `.toFixed(1)` labelled. */
function BandSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: number | undefined
  onChange: (value: number | undefined) => void
}) {
  return (
    <label className="db-goal-field" htmlFor={id}>
      <span className="db-goal-label">{label}</span>
      <select
        id={id}
        value={value !== undefined ? String(value) : ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      >
        <option value="">—</option>
        {HALF_BANDS.map((b) => (
          <option key={b} value={b}>
            {b.toFixed(1)}
          </option>
        ))}
      </select>
    </label>
  )
}

/**
 * "Your exam": exam date, target bands (overall and per section), exam type,
 * and — the point of collecting any of it — the gap between the latest band
 * per section and the target for it. Rendered in BOTH of `Dashboard`'s
 * returns (the empty state below and the populated view further down),
 * because setting an exam date is the natural FIRST action a learner takes,
 * before any essay exists, and the empty state is reachable with zero
 * seeding.
 *
 * Every gap line sits beside the same hedge the Report's band hero carries:
 * this card shows DISTANCE between a latest band and a target, never an
 * arrival date — no forecast, ever (see SPEC.md "Preferences").
 */
function ExamGoalCard({
  prefs,
  latestBandBySection,
  onUpdatePrefs,
  module,
  onSwitchModule,
}: {
  prefs: Prefs
  latestBandBySection: Partial<Record<SessionSection, number>>
  onUpdatePrefs: (patch: Partial<Prefs>) => void
  module: Module
  onSwitchModule: (m: Module) => void
}) {
  const days = prefs.examDateISO ? daysUntil(prefs.examDateISO, new Date()) : null

  const gapLines: Array<{ key: string; text: string }> = []
  for (const section of ['writing', 'reading', 'listening'] as const) {
    const target = prefs.targetBySection?.[section]
    const latest = latestBandBySection[section]
    if (target === undefined || latest === undefined) continue
    gapLines.push({
      key: section,
      text: `${SECTION_LABEL[section]}: latest ${latest.toFixed(1)} vs target ${target.toFixed(1)}`,
    })
  }
  // Not a gap comparison — there is no single "overall" band this app computes
  // (a real IELTS Overall Band averages four skills, including Speaking, which
  // this app does not have). This restates the number the learner set, gated
  // on a Writing band existing so it never appears before any is.
  if (prefs.targetOverall !== undefined && latestBandBySection.writing !== undefined) {
    gapLines.push({ key: 'overall', text: `Overall target ${prefs.targetOverall.toFixed(1)}` })
  }

  return (
    <section className="card db-goal" aria-label="Your exam">
      <p className="eyebrow">Your exam</p>

      <div className="db-goal-grid">
        <label className="db-goal-field" htmlFor="goal-exam-date">
          <span className="db-goal-label">Exam date</span>
          <input
            id="goal-exam-date"
            type="date"
            value={prefs.examDateISO ?? ''}
            onChange={(e) => onUpdatePrefs({ examDateISO: e.target.value || undefined })}
          />
        </label>

        <BandSelect
          id="goal-target-overall"
          label="Target overall band"
          value={prefs.targetOverall}
          onChange={(value) => onUpdatePrefs({ targetOverall: value })}
        />

        {(['writing', 'reading', 'listening'] as const).map((section) => (
          <BandSelect
            key={section}
            id={`goal-target-${section}`}
            label={`${SECTION_LABEL[section]} target`}
            value={prefs.targetBySection?.[section]}
            onChange={(value) =>
              onUpdatePrefs({ targetBySection: { ...prefs.targetBySection, [section]: value } })
            }
          />
        ))}

        <label className="db-goal-field" htmlFor="goal-module">
          <span className="db-goal-label">Exam type</span>
          <select
            id="goal-module"
            value={module}
            onChange={(e) => onSwitchModule(e.target.value as Module)}
          >
            <option value="academic">{MODULE_META.academic.label}</option>
            <option value="general">{MODULE_META.general.label}</option>
          </select>
        </label>
      </div>

      {days !== null && (
        <p className="db-goal-days">
          {days > 0
            ? `Exam in ${days} ${days === 1 ? 'day' : 'days'}`
            : days === 0
              ? 'Exam is today'
              : 'Exam date has passed — update it when you book your next sitting.'}
        </p>
      )}

      {gapLines.length > 0 && (
        <div className="db-goal-gaps">
          {gapLines.map((g) => (
            <p key={g.key} className="db-goal-gap">
              {g.text}
            </p>
          ))}
        </div>
      )}

      <p className="db-goal-hedge">
        Bands here are form-only estimates — your real band is likely at or below them, so treat
        any gap as a hint, not a measurement.
      </p>
    </section>
  )
}

/* ----------------------------- band trend chart ----------------------------- */

const CHART_W = 680
const CHART_H = 240
const PAD = { top: 16, right: 58, bottom: 32, left: 40 }

function BandTrendChart({ sessions }: { sessions: WritingSessionRecord[] }) {
  const innerW = CHART_W - PAD.left - PAD.right
  const innerH = CHART_H - PAD.top - PAD.bottom

  const pts = sessions
    .map((s) => ({ s, band: Number(s.analysis?.band?.overall) }))
    .filter((p) => Number.isFinite(p.band))
    .map((p) => ({ s: p.s, band: Math.min(9, Math.max(4, p.band)) }))

  if (pts.length < 2) return null

  const x = (i: number) => PAD.left + (i / (pts.length - 1)) * innerW
  const y = (v: number) => PAD.top + ((9 - v) / 5) * innerH

  const washUpper = pts.map((p, i) => `${x(i).toFixed(1)},${y(Math.min(9, p.band + 0.5)).toFixed(1)}`)
  const washLower = pts
    .map((p, i) => `${x(i).toFixed(1)},${y(Math.max(4, p.band - 0.5)).toFixed(1)}`)
    .reverse()
  const linePoints = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.band).toFixed(1)}`).join(' ')

  const gridLevels: number[] = []
  for (let i = 0; i <= 10; i++) gridLevels.push(4 + i * 0.5)

  const last = pts[pts.length - 1]
  const firstDate = fmtDate(pts[0].s.dateISO)
  const lastDate = fmtDate(last.s.dateISO)

  return (
    <svg
      className="db-chart"
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      role="img"
      aria-label={`Overall band estimate per session, from ${firstDate} to ${lastDate}. Latest estimate: ${last.band.toFixed(1)}.`}
    >
      {gridLevels.map((v) => (
        <line
          key={`g${v}`}
          className="db-grid-line"
          x1={PAD.left}
          x2={PAD.left + innerW}
          y1={y(v)}
          y2={y(v)}
        />
      ))}
      {gridLevels
        .filter((v) => Number.isInteger(v))
        .map((v) => (
          <text key={`t${v}`} className="db-tick" x={PAD.left - 8} y={y(v) + 4} textAnchor="end">
            {v}
          </text>
        ))}
      <polygon className="db-wash" points={[...washUpper, ...washLower].join(' ')} />
      <polyline className="db-band-line" points={linePoints} />
      {pts.map((p, i) => {
        const cx = x(i)
        const cy = y(p.band)
        return (
          <g key={`d${i}`} className="db-pt">
            <circle className="db-pt-ring" cx={cx} cy={cy} r={7} />
            {p.s.mode === 'exam' ? (
              <circle className="db-dot-exam" cx={cx} cy={cy} r={4} />
            ) : (
              <circle className="db-dot-coach" cx={cx} cy={cy} r={2} />
            )}
            <circle className="db-pt-hit" cx={cx} cy={cy} r={12}>
              <title>{`${fmtDate(p.s.dateISO)} · ${p.s.mode} · band ${p.band.toFixed(1)} (±0.5)`}</title>
            </circle>
          </g>
        )
      })}
      <text className="db-last-label" x={x(pts.length - 1) + 10} y={y(last.band) + 4}>
        {last.band.toFixed(1)}
      </text>
      <text className="db-axis-date" x={x(0)} y={CHART_H - 8} textAnchor="start">
        {firstDate}
      </text>
      <text className="db-axis-date" x={x(pts.length - 1)} y={CHART_H - 8} textAnchor="end">
        {lastDate}
      </text>
    </svg>
  )
}

/* -------------------------------- sparkline --------------------------------- */

const SPARK_W = 120
const SPARK_H = 40
const SPARK_PAD = 4
/** Side gutters reserved for the first/last value labels. */
const SPARK_GUTTER = 22

function Sparkline({ series }: { series: number[] }) {
  const vals = series.map((v) => (Number.isFinite(v) && v > 0 ? v : 0))
  if (vals.length === 0) return null
  const max = Math.max(...vals, 0.001)
  const x = (i: number) =>
    vals.length === 1
      ? SPARK_W / 2
      : SPARK_GUTTER + (i / (vals.length - 1)) * (SPARK_W - SPARK_GUTTER * 2)
  const y = (v: number) => SPARK_H - SPARK_PAD - (v / max) * (SPARK_H - SPARK_PAD * 2)
  /** Keep a 10px label's baseline inside the viewBox while tracking its dot. */
  const labelY = (v: number) => Math.min(SPARK_H - 3, Math.max(10, y(v) + 3))
  const points = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const first = vals[0]
  const last = vals[vals.length - 1]

  return (
    <svg
      className="db-spark"
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      aria-hidden="true"
    >
      {vals.length > 1 && <polyline className="db-spark-line" points={points} />}
      <circle className="db-spark-dot" cx={x(0)} cy={y(first)} r={2.5} />
      <circle className="db-spark-dot" cx={x(vals.length - 1)} cy={y(last)} r={2.5} />
      {vals.length > 1 && (
        <>
          <text
            className="db-spark-val"
            x={SPARK_GUTTER - 7}
            y={labelY(first)}
            textAnchor="end"
          >
            {first.toFixed(1)}
          </text>
          <text
            className="db-spark-val"
            x={SPARK_W - SPARK_GUTTER + 7}
            y={labelY(last)}
            textAnchor="start"
          >
            {last.toFixed(1)}
          </text>
        </>
      )}
    </svg>
  )
}

/** Error rates fall when the writer improves — spell the direction out. */
const TREND_LABEL: Record<'improving' | 'flat' | 'worsening', string> = {
  improving: 'fewer errors ↓',
  flat: 'flat',
  worsening: 'more errors ↑',
}

/* -------------------------------- component --------------------------------- */

export default function Dashboard({
  sessions,
  allSessions,
  profile,
  trends,
  onOpenSession,
  onStartPractice,
  onDeleteSession,
  onExport,
  onImport,
  prefs,
  latestBandBySection,
  onUpdatePrefs,
  module,
  onSwitchModule,
}: DashboardProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  // By parsed instant, not text — see profile/chronology. This is the band
  // chart's x-axis; an imported file with an offset would draw the learner's
  // progress in the wrong order.
  const chrono = useMemo(() => sortByDateAscending(sessions), [sessions])
  const newestFirst = useMemo(() => [...chrono].reverse(), [chrono])

  async function handleFilePicked(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target
    const file = input.files && input.files[0]
    input.value = ''
    if (!file) return
    try {
      const text = await file.text()
      // Read from `allSessions`, the WHOLE store, not the writing-only
      // `sessions` — `importData` replaces every section, and the count here
      // must match what it actually destroys, not just the essays this page
      // renders. On a genuinely empty store there is nothing to name, and a
      // first-run import is a legitimate restore, not something to scare.
      const summary = describeSections(allSessions)
      const ok = window.confirm(
        summary === ''
          ? 'Importing will restore your history from this file. Continue?'
          : `Importing replaces your current history (${summary}) with the file's contents. Continue?`,
      )
      if (!ok) return
      onImport(text)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'That file could not be imported.')
    }
  }

  function confirmDelete(session: WritingSessionRecord) {
    const when = fmtDate(session.dateISO, true)
    const ok = window.confirm(
      `Delete the essay from ${when}? It will be removed from your history and error profile.`,
    )
    if (ok) onDeleteSession(session.id)
  }

  /* ------------------------------- empty state ------------------------------- */
  if (sessions.length === 0) {
    return (
      <div className="db-root">
        <ExamGoalCard
          prefs={prefs}
          latestBandBySection={latestBandBySection}
          onUpdatePrefs={onUpdatePrefs}
          module={module}
          onSwitchModule={onSwitchModule}
        />
        <div className="card db-empty">
          <svg
            className="db-empty-mark"
            width="40"
            height="12"
            viewBox="0 0 40 12"
            aria-hidden="true"
          >
            <line className="db-empty-rail" x1="5" y1="6" x2="35" y2="6" />
            <circle className="db-empty-node" cx="5" cy="6" r="4" />
            <circle className="db-empty-node db-empty-node-done" cx="20" cy="6" r="4" />
            <circle className="db-empty-node" cx="35" cy="6" r="4" />
          </svg>
          <p className="eyebrow">Your progress</p>
          <h2>No essays yet</h2>
          <p className="db-empty-line">Write your first essay and your profile starts here.</p>
          <button className="btn btn-primary" onClick={() => onStartPractice(null)}>
            Start practice
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Restore from a backup file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={handleFilePicked}
          />
          {/* Export is a dead end on a genuinely first run — there is nothing
              to export yet. The bug this guards against is specifically that
              Reading or Listening data EXISTS here and could not be reached. */}
          {allSessions.length > 0 && (
            <>
              <p className="db-empty-line">
                You have {describeSections(allSessions)} saved. Exporting includes them.
              </p>
              <button className="btn" onClick={onExport}>
                Export data
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="db-root">
      <header className="db-header">
        <div>
          <p className="eyebrow">Your progress</p>
          <h2>Writing record</h2>
        </div>
        <div className="db-actions">
          <button className="btn" onClick={onExport}>
            Export data
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Import data
          </button>
          <input
            ref={fileRef}
            className="db-file-input"
            type="file"
            accept=".json"
            onChange={handleFilePicked}
            tabIndex={-1}
            aria-hidden="true"
          />
          <button className="btn btn-primary" onClick={() => onStartPractice(null)}>
            Start practice
          </button>
        </div>
      </header>

      <ExamGoalCard
        prefs={prefs}
        latestBandBySection={latestBandBySection}
        onUpdatePrefs={onUpdatePrefs}
        module={module}
        onSwitchModule={onSwitchModule}
      />

      {chrono.length >= 2 && (
        <section className="db-section" aria-label="Band trend">
          <p className="eyebrow">Band trend</p>
          <div className="card db-chart-card">
            <BandTrendChart sessions={chrono} />
            <p className="db-chart-caption">
              Form-only band estimate per session — your real band is likely at or below the line.
              The shaded area is the ±0.5 estimate range. Filled dots = exam conditions. Task 1 and
              Task 2 sessions share one line.
            </p>
          </div>
        </section>
      )}

      <section className="db-section" aria-label="Focus areas">
        <p className="eyebrow">Focus areas</p>
        {profile.totalSessions < 2 ? (
          <p className="db-quiet">Write 2+ essays to unlock your error profile.</p>
        ) : profile.focusCategories.length === 0 ? (
          <p className="db-quiet">No recurring problem areas yet — keep writing.</p>
        ) : (
          <div className="db-focus-grid">
            {profile.focusCategories.map((category) => {
              const meta = CATEGORY_META[category]
              const stat = profile.categories[category]
              const series =
                trends
                  .find((t) => t.category === category)
                  ?.perSession.map((p) => p.per100Words) ?? []
              const trendWord = stat?.trend ?? 'flat'
              return (
                <article key={category} className="card db-focus-card">
                  <div className="db-focus-head">
                    <h3 className="db-focus-label">{meta?.label ?? category}</h3>
                    <span className={`db-trend db-trend-${trendWord}`}>
                      {TREND_LABEL[trendWord]}
                    </span>
                  </div>
                  <p className="db-focus-hint">{meta?.hint ?? ''}</p>
                  <div className="db-focus-foot">
                    <span className="mono db-focus-rate">
                      {(stat?.recentRate ?? 0).toFixed(1)} per 100 words
                    </span>
                    <Sparkline series={series} />
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="db-section" aria-label="Sessions">
        <p className="eyebrow">Sessions</p>
        <div className="card db-table-card">
          <table className="db-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Exam</th>
                <th>Task</th>
                <th>Mode</th>
                <th>Question</th>
                <th className="db-th-num">Words</th>
                <th className="db-th-num">Band (est.)</th>
                <th>Top issue</th>
                <th>
                  <span className="db-visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {newestFirst.map((s) => {
                const band = Number(s.analysis?.band?.overall)
                const issue = topIssue(s)
                return (
                  <tr key={s.id}>
                    <td className="mono db-td-date">{fmtDate(s.dateISO, true)}</td>
                    <td>
                      {/* The migration stamps 'academic' on every pre-v3 record, so
                          the fallback only ever catches hand-edited storage. */}
                      <span className="db-chip-q">
                        {MODULE_META[s.module]?.short ?? MODULE_META.academic.short}
                      </span>
                    </td>
                    <td>
                      <span className="db-chip-q">{s.task === 'task1' ? 'Task 1' : 'Task 2'}</span>
                    </td>
                    <td>
                      {s.mode === 'exam' ? (
                        <span className="db-chip-exam">Exam</span>
                      ) : (
                        <span className="db-mode-coach">Coach</span>
                      )}
                    </td>
                    <td>
                      {s.questionType ? (
                        <span className="db-chip-q">
                          {QUESTION_TYPE_META[s.questionType]?.label ?? s.questionType}
                        </span>
                      ) : s.task === 'task1' ? (
                        <span className="db-chip-q">{task1KindOf(s)}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="mono db-td-num">{s.analysis?.stats?.wordCount ?? 0}</td>
                    <td className="mono db-td-num">
                      {Number.isFinite(band) ? Math.min(9, Math.max(4, band)).toFixed(1) : '—'}
                    </td>
                    <td className="db-td-issue">
                      {issue ? (
                        <span className="db-issue">
                          <span
                            className={`db-issue-dot ${SEV_CLASS[issue.severity]}`}
                            aria-hidden="true"
                          />
                          {issue.label}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <div className="db-row-actions">
                        <button
                          className="btn db-open-btn"
                          onClick={() => onOpenSession(s.id)}
                          aria-label={`Open the ${fmtDate(s.dateISO, true)} ${s.mode} essay report`}
                        >
                          Open
                        </button>
                        <button
                          className="db-delete"
                          onClick={() => confirmDelete(s)}
                          aria-label={`Delete the ${fmtDate(s.dateISO, true)} ${s.mode} essay`}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
