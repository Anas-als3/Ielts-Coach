import { useMemo, useState } from 'react'
import type {
  CategoryStat,
  Criterion,
  Issue,
  IssueCategory,
  ReportProps,
  SessionRecord,
} from '../types'
import { CATEGORY_META, CRITERION_META } from '../meta'
import './Report.css'

/* --------------------------------- helpers -------------------------------- */

const CRITERIA: Criterion[] = ['TR', 'CC', 'LR', 'GRA']

type InlineIssue = Issue & { start: number; end: number }

interface ParaSlice {
  start: number
  end: number
  text: string
}

interface Segment {
  key: string
  text: string
  issue: InlineIssue | null
}

/** Split on newline runs, keeping char offsets so issue spans still line up. */
function splitParagraphs(text: string): ParaSlice[] {
  const out: ParaSlice[] = []
  const re = /[^\n]+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m[0].trim().length === 0) continue
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0] })
  }
  return out
}

const SEVERITY_RANK: Record<Issue['severity'], number> = { error: 0, warning: 1, info: 2 }

/* ------------------------------ position check ------------------------------ */

/** Stance markers, mirroring the engine's regexes. Display-only, best effort. */
const STANCE_RE =
  /\b(?:I believe|I agree|I disagree|in my opinion|in my view|my view is|I would argue|I am convinced|this essay (?:will )?argue)/i

/**
 * First sentence of a paragraph that contains a stance marker. Sentence split
 * is a simple [.!?] pass — this feeds a manual side-by-side read, not a rule.
 */
function findStanceSentence(paragraph: string): string | null {
  const sentences = paragraph.match(/[^.!?]+[.!?]*/g) ?? []
  for (const s of sentences) {
    const trimmed = s.trim()
    if (trimmed.length > 0 && STANCE_RE.test(trimmed)) return trimmed
  }
  return null
}

/**
 * Turn one paragraph into plain-text / marked segments. Every clipped span
 * boundary starts a new elementary interval, and each interval is claimed by
 * the most severe covering issue (innermost span on ties), so a container
 * span can overlap inner marks without swallowing them — it simply renders as
 * multiple segments around them.
 */
function buildSegments(text: string, para: ParaSlice, marks: InlineIssue[]): Segment[] {
  const cutSet = new Set<number>([para.start, para.end])
  for (const issue of marks) {
    const s = Math.max(para.start, issue.start)
    const e = Math.min(para.end, issue.end)
    if (e <= s) continue
    cutSet.add(s)
    cutSet.add(e)
  }
  const cuts = [...cutSet].sort((a, b) => a - b)

  const segs: Segment[] = []
  for (let i = 0; i < cuts.length - 1; i++) {
    const s = cuts[i]
    const e = cuts[i + 1]
    let issue: InlineIssue | null = null
    for (const cand of marks) {
      if (cand.start > s || cand.end < e) continue
      if (
        issue === null ||
        SEVERITY_RANK[cand.severity] < SEVERITY_RANK[issue.severity] ||
        (SEVERITY_RANK[cand.severity] === SEVERITY_RANK[issue.severity] &&
          cand.start > issue.start)
      ) {
        issue = cand
      }
    }
    const prev = segs[segs.length - 1]
    if (prev && prev.issue === issue) {
      prev.text += text.slice(s, e)
    } else {
      segs.push({
        key: issue ? `${issue.id}@${s}` : `t${s}`,
        text: text.slice(s, e),
        issue,
      })
    }
  }
  return segs
}

function clampBand(n: number): number {
  return Math.min(9, Math.max(4, Number.isFinite(n) ? n : 4))
}

function formatBand(n: number): string {
  return clampBand(n).toFixed(1)
}

/** Position of a band value on the 4-to-9 scale, as a 0–100 percentage. */
function bandPct(n: number): number {
  return ((clampBand(n) - 4) / 5) * 100
}

const SCALE_TICKS = [4, 5, 6, 7, 8, 9]

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(totalSec) ? totalSec : 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

/* ------------------------- "versus last essay" strip ------------------------ */

interface DeltaCell {
  label: string
  from: string
  to: string
  dir: 'better' | 'worse' | 'same'
  badge: string
}

function buildDeltas(prev: SessionRecord, cur: SessionRecord): DeltaCell[] {
  const cells: DeltaCell[] = []

  const countSevere = (s: SessionRecord) =>
    s.analysis.issues.filter((i) => i.severity !== 'info').length
  const pe = countSevere(prev)
  const ce = countSevere(cur)
  cells.push({
    label: 'Errors & warnings',
    from: String(pe),
    to: String(ce),
    dir: ce < pe ? 'better' : ce > pe ? 'worse' : 'same',
    badge: ce === pe ? 'no change' : ce < pe ? `${pe - ce} fewer` : `${ce - pe} more`,
  })

  const pChecks = prev.analysis.structure
  const cChecks = cur.analysis.structure
  const pSat = pChecks.filter((c) => c.satisfied).length
  const cSat = cChecks.filter((c) => c.satisfied).length
  cells.push({
    label: 'Structure checks',
    from: `${pSat} of ${pChecks.length}`,
    to: `${cSat} of ${cChecks.length}`,
    dir: cSat > pSat ? 'better' : cSat < pSat ? 'worse' : 'same',
    badge: cSat === pSat ? 'no change' : cSat > pSat ? `${cSat - pSat} more` : `${pSat - cSat} fewer`,
  })

  const pct = (s: SessionRecord) => {
    const ttr = s.analysis.stats.typeTokenRatio
    return Math.round((Number.isFinite(ttr) ? ttr : 0) * 100)
  }
  const pv = pct(prev)
  const cv = pct(cur)
  cells.push({
    label: 'Lexical variety',
    from: `${pv}%`,
    to: `${cv}%`,
    dir: cv > pv ? 'better' : cv < pv ? 'worse' : 'same',
    badge: cv === pv ? 'no change' : cv > pv ? `+${cv - pv} pts` : `−${pv - cv} pts`,
  })

  const pb = prev.analysis.band.overall
  const cb = cur.analysis.band.overall
  cells.push({
    label: 'Band estimate',
    from: formatBand(pb),
    to: formatBand(cb),
    dir: cb > pb ? 'better' : cb < pb ? 'worse' : 'same',
    badge: cb === pb ? 'no change' : cb > pb ? `+${(cb - pb).toFixed(1)}` : `−${(pb - cb).toFixed(1)}`,
  })

  return cells
}

/* --------------------------------- icons ---------------------------------- */

function CheckIcon() {
  return (
    <svg
      className="rp-check-icon rp-check-icon-done"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden="true"
    >
      <path
        d="M2.5 7.5 5.7 10.4 11.5 3.6"
        fill="none"
        stroke="var(--ok-green)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CircleIcon() {
  return (
    <svg className="rp-check-icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r="5" fill="none" stroke="var(--ink-soft)" strokeWidth="1.5" />
    </svg>
  )
}

/* ------------------------------ pacing chart ------------------------------- */

function PacingChart({ pacing }: { pacing: Array<{ t: number; words: number }> }) {
  const W = 640
  const H = 250
  const ML = 48
  const MR = 88
  const MT = 20
  const MB = 34
  const innerW = W - ML - MR
  const innerH = H - MT - MB

  const samples = pacing
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.words))
    .map((p) => ({ t: Math.min(Math.max(p.t, 0), 2400), words: Math.max(p.words, 0) }))
    .sort((a, b) => a.t - b.t)

  const peak = samples.reduce((max, p) => Math.max(max, p.words), 0)
  const yMax = Math.max(320, peak)

  const x = (min: number) => ML + (Math.min(Math.max(min, 0), 40) / 40) * innerW
  const y = (words: number) => MT + innerH - (Math.min(Math.max(words, 0), yMax) / yMax) * innerH

  // The actual curve always starts at (0 min, 0 words).
  const actual = [{ t: 0, words: 0 }, ...samples]
  const actualPath = actual
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t / 60).toFixed(1)},${y(p.words).toFixed(1)}`)
    .join(' ')
  // Target: nothing on paper until 05:00 (planning), then linear to 270 by 38:00.
  const targetPath = [
    `M${x(0).toFixed(1)},${y(0).toFixed(1)}`,
    `L${x(5).toFixed(1)},${y(0).toFixed(1)}`,
    `L${x(38).toFixed(1)},${y(270).toFixed(1)}`,
    `L${x(40).toFixed(1)},${y(270).toFixed(1)}`,
  ].join(' ')

  const last = actual[actual.length - 1]
  const youX = x(last.t / 60)
  const targetLabelY = y(270) + 4
  let youLabelY = y(last.words) + 4
  // Nudge the "you" label if it would sit on top of "target pace".
  if (x(40) - youX < 64 && Math.abs(youLabelY - targetLabelY) < 13) {
    youLabelY = youLabelY >= targetLabelY ? targetLabelY + 13 : targetLabelY - 13
  }

  return (
    <svg
      className="rp-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Pacing chart: your word count over the 40 minutes against a target pace reaching 270 words by minute 38. Final sample: ${last.words} words.`}
    >
      {[100, 200].map((v) => (
        <line key={v} className="rp-grid-line" x1={ML} x2={W - MR} y1={y(v)} y2={y(v)} />
      ))}
      <line className="rp-grid-line rp-grid-line-em" x1={ML} x2={W - MR} y1={y(250)} y2={y(250)} />

      <line className="rp-axis-line" x1={ML} x2={W - MR} y1={y(0)} y2={y(0)} />
      <line className="rp-axis-line" x1={ML} x2={ML} y1={y(yMax)} y2={y(0)} />

      {[0, 100, 200, 250, yMax].map((v) => (
        <text key={v} className="rp-tick" x={ML - 8} y={y(v) + 4} textAnchor="end">
          {v}
        </text>
      ))}
      {[0, 10, 20, 30, 40].map((v) => (
        <text key={v} className="rp-tick" x={x(v)} y={H - MB + 18} textAnchor="middle">
          {v}
        </text>
      ))}
      <text className="rp-axis-caption" x={x(40) + 12} y={H - MB + 18}>
        min
      </text>
      <text className="rp-axis-caption" x={ML + 8} y={MT + 12}>
        words
      </text>

      <path className="rp-line-target" d={targetPath} />
      <path className="rp-line-you" d={actualPath} />
      <text
        className="rp-series-label rp-series-label-target"
        x={x(40) + 6}
        y={targetLabelY}
      >
        target pace
      </text>
      <text className="rp-series-label" x={youX + 6} y={youLabelY}>
        you
      </text>

      {/* hover layer: one invisible hit target per sample, visible dot on hover */}
      {samples.map((p, i) => {
        const cx = x(p.t / 60)
        const cy = y(p.words)
        const minute = Number((p.t / 60).toFixed(1))
        return (
          <g key={`${p.t}-${i}`} className="rp-pt">
            <circle className="rp-pt-dot" cx={cx} cy={cy} r={3} />
            <circle className="rp-pt-hit" cx={cx} cy={cy} r={11}>
              <title>{`minute ${minute} — ${p.words} words`}</title>
            </circle>
          </g>
        )
      })}
    </svg>
  )
}

/* -------------------------------- component -------------------------------- */

interface Confrontation {
  category: IssueCategory
  stat: CategoryStat
}

export default function Report({
  session,
  previousSession,
  profile,
  onRedraft,
  onNewEssay,
  onViewDashboard,
}: ReportProps) {
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({})
  const { analysis, essayText } = session

  const inlineIssues = useMemo(
    () =>
      analysis.issues.filter(
        (i): i is InlineIssue => i.start != null && i.end != null && i.end > i.start,
      ),
    [analysis.issues],
  )
  const essayLevelIssues = useMemo(
    () => analysis.issues.filter((i) => i.start == null || i.end == null || i.end <= i.start),
    [analysis.issues],
  )
  const essayLevelGroups = useMemo(
    () =>
      CRITERIA.map((criterion) => ({
        criterion,
        items: essayLevelIssues.filter((i) => i.criterion === criterion),
      })).filter((g) => g.items.length > 0),
    [essayLevelIssues],
  )

  const annotated = useMemo(() => {
    const paras = splitParagraphs(essayText)
    return paras.map((p) => {
      const marks = inlineIssues
        .filter((i) => i.start < p.end && i.end > p.start)
        .sort((a, b) => a.start - b.start)
      return { ...p, marks, segments: buildSegments(essayText, p, marks) }
    })
  }, [essayText, inlineIssues])

  const deltas = useMemo(
    () => (previousSession ? buildDeltas(previousSession, session) : []),
    [previousSession, session],
  )

  /**
   * Manual 3-second meaning check the rules cannot do: the intro and conclusion
   * stance sentences, side by side. Only rendered when both are found.
   */
  const positionCheck = useMemo(() => {
    const paras = splitParagraphs(essayText)
    if (paras.length < 3) return null // no conclusion to compare against
    const intro = findStanceSentence(paras[0].text)
    const conclusion = findStanceSentence(paras[paras.length - 1].text)
    if (intro == null || conclusion == null) return null
    return { intro, conclusion }
  }, [essayText])

  const positionIssue = useMemo(
    () => analysis.issues.find((i) => i.category === 'position-consistency') ?? null,
    [analysis.issues],
  )

  const confrontations = useMemo<Confrontation[]>(() => {
    if (profile.totalSessions < 2 || profile.focusCategories.length === 0) return []
    const seenHere = new Set(analysis.issues.map((i) => i.category))
    const out: Confrontation[] = []
    for (const category of profile.focusCategories) {
      const stat = profile.categories[category]
      if (seenHere.has(category) && stat) out.push({ category, stat })
    }
    return out
  }, [profile, analysis.issues])

  const overall = clampBand(analysis.band.overall)
  const lo = Math.max(4, overall - 0.5)
  const hi = Math.min(9, overall + 0.5)

  const cleanEssay = analysis.issues.length === 0 && essayText.trim().length > 0

  function toggleNote(id: string) {
    setOpenNotes((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="rp">
      {/* 1 — header row */}
      <header className="rp-header">
        <p className="eyebrow">
          Writing Task 2 · {session.mode === 'exam' ? 'Exam' : 'Coach'} ·{' '}
          {formatDate(session.dateISO)}
        </p>
        <div className="rp-actions">
          <button className="btn" onClick={onRedraft}>
            Redraft this essay
          </button>
          <button className="btn" onClick={onNewEssay}>
            New essay
          </button>
          <button className="btn" onClick={onViewDashboard}>
            View progress
          </button>
        </div>
      </header>

      {/* 2 — band hero */}
      <section className="rp-hero" aria-label="Band estimate">
        <div className="rp-hero-band">
          <p className="rp-band-range mono">
            {formatBand(lo)}–{formatBand(hi)}
          </p>
          <p className="rp-band-caption">
            Form-only estimate — your real band is likely this or lower.
          </p>
          <p className="rp-band-note">
            This engine checks form, not meaning — it cannot judge whether your argument makes
            sense.
          </p>
          <div
            className="rp-band-scale"
            role="img"
            aria-label={`Band scale 4 to 9: estimated range ${formatBand(lo)} to ${formatBand(
              hi,
            )}. ${CRITERIA.map(
              (c) => `${CRITERION_META[c].short} ${formatBand(analysis.band.byCriterion[c])}`,
            ).join(', ')}.`}
          >
            <div className="rp-scale-track">
              <div
                className="rp-scale-range"
                style={{ left: `${bandPct(lo)}%`, width: `${bandPct(hi) - bandPct(lo)}%` }}
              />
              {CRITERIA.map((c) => (
                <span
                  key={c}
                  className="rp-scale-marker"
                  style={{ left: `${bandPct(analysis.band.byCriterion[c])}%` }}
                  title={`${CRITERION_META[c].label}: ${formatBand(
                    analysis.band.byCriterion[c],
                  )}`}
                />
              ))}
            </div>
            <div className="rp-scale-ticks mono" aria-hidden="true">
              {SCALE_TICKS.map((v) => (
                <span key={v} style={{ left: `${bandPct(v)}%` }}>
                  {v}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="rp-tiles">
          {CRITERIA.map((c) => {
            const bullets = analysis.band.rationale[c] ?? []
            return (
              <div key={c} className="rp-tile card">
                <p className="rp-tile-label">{CRITERION_META[c].label}</p>
                <p className="rp-tile-band mono">{formatBand(analysis.band.byCriterion[c])}</p>
                <div className="rp-tile-scale" aria-hidden="true">
                  <div
                    className="rp-tile-scale-fill"
                    style={{ width: `${bandPct(analysis.band.byCriterion[c])}%` }}
                  />
                </div>
                {bullets.length > 0 && (
                  <ul className="rp-tile-rationale">
                    {bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {cleanEssay && (
        <section className="rp-clean card">
          <p className="rp-clean-head">No issues flagged — clean, controlled writing.</p>
          <p className="rp-clean-sub">
            Redraft it under exam conditions to confirm it holds at speed.
          </p>
        </section>
      )}

      {/* 3 — versus your last essay */}
      {previousSession && deltas.length > 0 && (
        <section className="rp-versus card" aria-label="Versus your last essay">
          <h2 className="eyebrow">Versus your last essay</h2>
          <div className="rp-versus-grid">
            {deltas.map((d) => (
              <div key={d.label} className="rp-delta">
                <p className="rp-delta-label">{d.label}</p>
                <p className="rp-delta-values mono">
                  <span className="rp-delta-from">{d.from}</span>
                  <span className="rp-delta-arrow">→</span>
                  <span className="rp-delta-to">{d.to}</span>
                </p>
                <p className={`rp-delta-badge rp-delta-${d.dir}`}>{d.badge}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4 — structure checklist */}
      <section className="rp-checklist card" aria-label="Structure checklist">
        <h2 className="eyebrow">Structure checklist</h2>
        {analysis.structure.length === 0 ? (
          <p className="rp-muted">No structure checks were recorded for this essay.</p>
        ) : (
          <ul className="rp-checklist-grid">
            {analysis.structure.map((check) => (
              <li key={check.id} className="rp-check">
                {check.satisfied ? <CheckIcon /> : <CircleIcon />}
                <span className="rp-sr">{check.satisfied ? 'Done:' : 'Not yet:'}</span>
                <div className="rp-check-body">
                  <span className="rp-check-label">{check.label}</span>
                  {!check.satisfied && check.detail && (
                    <p className="rp-check-detail">{check.detail}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 4b — position check: manual meaning read, both stance sentences found */}
      {positionCheck && (
        <section className="rp-position card" aria-label="Position check">
          <h2 className="eyebrow">Position check — do these say the same thing?</h2>
          <div className="rp-position-quotes">
            <div className="rp-position-row">
              <span className="rp-position-para">¶ Intro</span>
              <blockquote className="rp-position-quote">{positionCheck.intro}</blockquote>
            </div>
            <div className="rp-position-row">
              <span className="rp-position-para">¶ Conclusion</span>
              <blockquote className="rp-position-quote">{positionCheck.conclusion}</blockquote>
            </div>
          </div>
          {positionIssue && <p className="rp-position-flag">{positionIssue.message}</p>}
          {/* uncontrolled on purpose: a local tick for the learner, never persisted */}
          <label className="rp-position-confirm">
            <input type="checkbox" />
            <span>Yes — same position</span>
          </label>
        </section>
      )}

      {/* 5 — annotated essay */}
      <section className="rp-essay card" aria-label="Annotated essay">
        <h2 className="eyebrow">Annotated essay</h2>
        {annotated.length === 0 ? (
          <p className="rp-muted">
            This essay is empty — there is no text to review. Start a new essay when you are
            ready.
          </p>
        ) : (
          <>
            {inlineIssues.length > 0 && (
              <p className="rp-essay-hint">Click a highlighted phrase to read the note.</p>
            )}
            <div className="rp-essay-body">
              {annotated.map((p) => {
                const openInPara = p.marks.filter(
                  (i) => openNotes[i.id] && (i.start >= p.start || p.start === annotated[0].start),
                )
                return (
                  <div key={p.start} className="rp-para-block">
                    <p className="rp-para">
                      {p.segments.map((seg) => {
                        const issue = seg.issue
                        if (!issue) return <span key={seg.key}>{seg.text}</span>
                        return (
                          <mark
                            key={seg.key}
                            className={`rp-mark rp-mark-${issue.severity}`}
                            role="button"
                            tabIndex={0}
                            aria-expanded={!!openNotes[issue.id]}
                            title={CATEGORY_META[issue.category].label}
                            onClick={() => toggleNote(issue.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                toggleNote(issue.id)
                              }
                            }}
                          >
                            {seg.text}
                          </mark>
                        )
                      })}
                    </p>
                    {openInPara.map((issue) => (
                      <div key={issue.id} className={`rp-note rp-note-${issue.severity}`}>
                        <span className={`rp-note-label sev-${issue.severity}`}>
                          {CATEGORY_META[issue.category].label}
                        </span>
                        <span className="rp-note-msg">{issue.message}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>

      {/* whole-essay notes */}
      {essayLevelGroups.length > 0 && (
        <section className="rp-notes card" aria-label="Whole-essay notes">
          <h2 className="eyebrow">Whole-essay notes</h2>
          {essayLevelGroups.map((g) => (
            <div key={g.criterion} className="rp-notes-group">
              <p className="rp-notes-crit">{CRITERION_META[g.criterion].label}</p>
              <ul className="rp-notes-list">
                {g.items.map((issue) => (
                  <li key={issue.id}>
                    <span className={`rp-note-label sev-${issue.severity}`}>
                      {CATEGORY_META[issue.category].label}
                    </span>
                    <span className="rp-note-msg">{issue.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {/* 6 — exam extras */}
      {session.pacing != null && session.pacing.length > 0 && (
        <section className="rp-pacing card" aria-label="Exam pacing">
          <h2 className="eyebrow">Exam pacing</h2>
          <PacingChart pacing={session.pacing} />
          <div className="rp-pacing-meta">
            {(session.pasteAttempts ?? 0) > 0 && (
              <p className="mono">Paste attempts: {session.pasteAttempts}</p>
            )}
            {session.durationSec != null && (
              <p className="mono">Submitted at {formatDuration(session.durationSec)}</p>
            )}
          </div>
        </section>
      )}

      {/* 7 — profile confrontation */}
      {confrontations.length > 0 && (
        <section className="rp-confront card" aria-label="Recurring issues">
          <h2 className="eyebrow">Recurring for you</h2>
          {confrontations.map(({ category, stat }) => (
            <p key={category} className="rp-confront-line">
              <strong>{CATEGORY_META[category].label}</strong>: appeared again — seen in{' '}
              {stat.total} issue{stat.total === 1 ? '' : 's'} across your {profile.totalSessions}{' '}
              sessions, currently <span className={`rp-trend-${stat.trend}`}>{stat.trend}</span>.
            </p>
          ))}
        </section>
      )}
    </div>
  )
}
