import { useState } from 'react'
import type {
  Criterion,
  ErrorProfile,
  FeedbackPanelProps,
  Issue,
  Severity,
} from '../types'
import { CATEGORY_META, CRITERION_META } from '../meta'
import './FeedbackPanel.css'

const CRITERIA: Criterion[] = ['TR', 'CC', 'LR', 'GRA']

function fmtBand(b: number): string {
  return b.toFixed(1)
}

function isRecurring(issue: Issue, profile: ErrorProfile | null): boolean {
  return profile != null && profile.focusCategories.includes(issue.category)
}

/**
 * Rendering cap per severity group: pasted book-length texts can produce
 * thousands of issues, and re-rendering them every debounce tick would freeze
 * the panel. The full list still drives counts and the band estimate.
 */
const MAX_ROWS_PER_GROUP = 60

/** Issues of one severity, recurring-for-you categories first (stable otherwise). */
function groupFor(issues: Issue[], severity: Severity, profile: ErrorProfile | null): Issue[] {
  return issues
    .filter((i) => i.severity === severity)
    .sort(
      (a, b) => Number(isRecurring(b, profile)) - Number(isRecurring(a, profile)),
    )
    .slice(0, MAX_ROWS_PER_GROUP)
}

function IssueRow({
  issue,
  recurring,
  onSelect,
}: {
  issue: Issue
  recurring: boolean
  onSelect: (issue: Issue) => void
}) {
  const meta = CATEGORY_META[issue.category]
  const body = (
    <>
      <span className={`fb-dot sev-${issue.severity}`} aria-hidden="true" />
      <span className="fb-issue-body">
        <span className="fb-issue-label">
          {meta.label}
          {recurring && <span className="fb-recurring">recurring for you</span>}
        </span>
        <span className="fb-issue-msg">{issue.message}</span>
      </span>
    </>
  )

  const rowClass = `fb-issue${recurring ? ' fb-issue-recurring' : ''}`

  if (issue.start != null) {
    return (
      <button
        type="button"
        className={`${rowClass} fb-issue-clickable`}
        onClick={() => onSelect(issue)}
      >
        {body}
      </button>
    )
  }
  return <div className={rowClass}>{body}</div>
}

export default function FeedbackPanel({
  analysis,
  profile,
  onSelectIssue,
  task = 'task2',
}: FeedbackPanelProps) {
  /* The band estimator refuses to score below this, and the two tasks differ
     (task1BandEstimate.ts uses 100, bandEstimate.ts uses 150). */
  const minWordsForEstimate = task === 'task1' ? 100 : 150
  const [notesOpen, setNotesOpen] = useState(false)

  if (!analysis) {
    return (
      <div className="fb-panel card">
        <div className="fb-empty">
          <p className="eyebrow">Feedback</p>
          <p className="fb-empty-text">
            Nothing to show yet — start writing and live feedback appears here.
          </p>
        </div>
      </div>
    )
  }

  const { stats, band, issues } = analysis
  const tooShort = stats.wordCount < minWordsForEstimate
  const errors = groupFor(issues, 'error', profile)
  const warnings = groupFor(issues, 'warning', profile)
  const infos = groupFor(issues, 'info', profile)
  const count = (sev: Severity) => issues.filter((i) => i.severity === sev).length
  const errorCount = count('error')
  const warningCount = count('warning')
  const infoCount = count('info')
  const varietyPct =
    stats.typeTokenRatio > 0 ? `${Math.round(stats.typeTokenRatio * 100)}%` : '—'

  return (
    <div className="fb-panel card">
      {/* 1 · band estimate */}
      <section className="fb-band">
        <p className="eyebrow">Band estimate</p>
        {tooShort ? (
          <>
            <p className="fb-band-short">Too short to estimate</p>
            <p className="fb-band-hint">(estimates unlock at {minWordsForEstimate} words)</p>
          </>
        ) : (
          <>
            <p className="fb-band-value mono">
              {fmtBand(Math.max(4, band.overall - 0.5))}–{fmtBand(Math.min(9, band.overall + 0.5))}
            </p>
            <div className="fb-criteria">
              {CRITERIA.map((c) => {
                const value = band.byCriterion[c]
                const pct = Math.max(0, Math.min(100, ((value - 4) / 5) * 100))
                return (
                  <div key={c} className="fb-crit" title={CRITERION_META[c].label}>
                    <span className="fb-crit-label">{c}</span>
                    <span className="fb-crit-bar" aria-hidden="true">
                      <span className="fb-crit-fill" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="fb-crit-value mono">{fmtBand(value)}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
        <p className="fb-band-caption">
        form-only estimate — your real band is likely this or lower
      </p>
      </section>

      {/* 2 · stats grid */}
      <section className="fb-stats">
        {(
          [
            ['Words', stats.wordCount],
            ['Sentences', stats.sentenceCount],
            ['Paragraphs', stats.paragraphCount],
            ['Linkers', stats.linkingDeviceCount],
            ['Variety', varietyPct],
          ] as Array<[string, string | number]>
        ).map(([label, value]) => (
          <div key={label} className="fb-stat">
            <span className="fb-stat-value mono">{value}</span>
            <span className="fb-stat-label">{label}</span>
          </div>
        ))}
      </section>

      {/* 3 · issues, grouped by severity */}
      {issues.length === 0 ? (
        tooShort ? (
          <div className="fb-quiet">
            <p className="fb-empty-text">
              Keep writing — feedback appears as your essay develops.
            </p>
          </div>
        ) : (
          <div className="fb-clear">
            <span className="fb-clear-mark" aria-hidden="true">
              ✓
            </span>
            <p className="fb-clear-text">
              No structural problems detected. Keep developing your ideas.
            </p>
          </div>
        )
      ) : (
        <div className="fb-issues">
          {errors.length > 0 && (
            <section className="fb-group">
              <h3 className="eyebrow fb-group-head">
                <span>
                  Errors · <span className="mono">{errorCount}</span>
                </span>
              </h3>
              <ul className="fb-issue-list">
                {errors.map((issue) => (
                  <li key={issue.id}>
                    <IssueRow
                      issue={issue}
                      recurring={isRecurring(issue, profile)}
                      onSelect={onSelectIssue}
                    />
                  </li>
                ))}
                {errorCount > errors.length && (
                  <li className="fb-more">+{errorCount - errors.length} more not shown</li>
                )}
              </ul>
            </section>
          )}

          {warnings.length > 0 && (
            <section className="fb-group">
              <h3 className="eyebrow fb-group-head">
                <span>
                  Warnings · <span className="mono">{warningCount}</span>
                </span>
              </h3>
              <ul className="fb-issue-list">
                {warnings.map((issue) => (
                  <li key={issue.id}>
                    <IssueRow
                      issue={issue}
                      recurring={isRecurring(issue, profile)}
                      onSelect={onSelectIssue}
                    />
                  </li>
                ))}
                {warningCount > warnings.length && (
                  <li className="fb-more">+{warningCount - warnings.length} more not shown</li>
                )}
              </ul>
            </section>
          )}

          {infos.length > 0 && (
            <section className="fb-group">
              <button
                type="button"
                className="fb-notes-toggle"
                aria-expanded={notesOpen}
                onClick={() => setNotesOpen((o) => !o)}
              >
                <span className={`fb-caret${notesOpen ? ' fb-caret-open' : ''}`} aria-hidden="true">
                  ▸
                </span>
                <span className="eyebrow">
                  <span className="mono">{infoCount}</span> style note{infoCount === 1 ? '' : 's'}
                </span>
              </button>
              {notesOpen && (
                <ul className="fb-issue-list">
                  {infos.map((issue) => (
                    <li key={issue.id}>
                      <IssueRow
                        issue={issue}
                        recurring={isRecurring(issue, profile)}
                        onSelect={onSelectIssue}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
