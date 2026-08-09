import type { CSSProperties } from 'react'
import type { ParagraphRole, StructureCheck, StructureRailProps, TaskKind } from '../types'
import { QUESTION_TYPE_META } from '../meta'
import './StructureRail.css'

type GroupKey = 'intro' | 'body' | 'conclusion'

const GROUP_ORDER: GroupKey[] = ['intro', 'body', 'conclusion']

const GROUP_LABELS: Record<GroupKey, string> = {
  intro: 'Introduction',
  body: 'Body paragraphs',
  conclusion: 'Conclusion',
}

/* Same word-count norms the paragraph rules use (SPEC canonical constants).
   Task 1 is a different shape entirely: a short paraphrase, a one-sentence
   overview, then one or two detail paragraphs — and no conclusion. */
const NORMS: Record<TaskKind, Record<ParagraphRole, readonly [number, number]>> = {
  task2: {
    introduction: [30, 60],
    body: [60, 120],
    conclusion: [25, 60],
  },
  task1: {
    introduction: [20, 40],
    body: [20, 70],
    conclusion: [20, 40], // never assigned in Task 1; present to satisfy the record
  },
}

/* Entrance stagger: 30ms steps, capped so late elements join the same moment. */
const STAGGER_CAP = 12

function groupOf(check: StructureCheck): GroupKey {
  // Task 1 ids first — 't1-paraphrase' would otherwise fall through to 'body'.
  if (check.id === 't1-paraphrase' || check.id === 't1-overview') return 'intro'
  if (check.id.startsWith('intro') || check.id === 'position-stated') return 'intro'
  if (check.id.startsWith('conclusion')) return 'conclusion'
  return 'body'
}

function shortLabel(role: ParagraphRole, bodyOrdinal: number, task: TaskKind): string {
  if (role === 'introduction') return task === 'task1' ? 'Para' : 'Intro'
  if (role === 'conclusion') return 'Concl'
  // Task 1: the first body paragraph is the overview, the rest are details.
  if (task === 'task1') return bodyOrdinal === 1 ? 'Over' : `D${bodyOrdinal - 1}`
  return `B${bodyOrdinal}`
}

/* Bar width: word count against a 140-word ceiling (the body upper warning
   bound), floored so tiny paragraphs stay visible. Safe on zero. */
function barWidthPct(wordCount: number): number {
  if (!Number.isFinite(wordCount) || wordCount <= 0) return 3
  return Math.max(3, Math.min(100, (wordCount / 140) * 100))
}

function enterStyle(step: number): CSSProperties {
  return { '--rail-i': String(Math.min(step, STAGGER_CAP)) } as CSSProperties
}

/* Spine segments are drawn per-node (up = toward the previous check, down =
   toward the next), so the stretch between two satisfied neighbours can
   deepen toward green independently of the rest of the line. */
function nodeClass(
  check: StructureCheck,
  idx: number,
  flat: StructureCheck[],
  currentId: string | null,
): string {
  const classes = ['rail-node', 'rail-enter']
  if (check.satisfied) classes.push('rail-done')
  if (check.id === currentId) classes.push('rail-current')
  if (idx > 0) {
    classes.push('rail-seg-up')
    if (check.satisfied && flat[idx - 1]?.satisfied) classes.push('rail-seg-up-done')
  }
  if (idx < flat.length - 1) {
    classes.push('rail-seg-down')
    if (check.satisfied && flat[idx + 1]?.satisfied) classes.push('rail-seg-down-done')
  }
  return classes.join(' ')
}

/**
 * The essay-anatomy spine beside the editor. Nodes fill from hollow to solid
 * as structure checks are satisfied; a paragraph-balance strip below shows
 * each paragraph's weight against its norm range.
 */
export default function StructureRail({
  checks,
  paragraphs,
  questionType,
  task = 'task2',
}: StructureRailProps) {
  const isEmpty = paragraphs.length === 0

  const groups = GROUP_ORDER.map((key) => ({
    key,
    items: checks.filter((c) => groupOf(c) === key),
  })).filter((g) => g.items.length > 0)

  /* Flattened visual order, for spine adjacency and the "you are here" ring. */
  const flat = groups.flatMap((g) => g.items)
  const currentId = flat.find((c) => !c.satisfied)?.id ?? null

  let bodyOrdinal = 0
  const bars = paragraphs.map((p) => {
    if (p.role === 'body') bodyOrdinal += 1
    const [lo, hi] = NORMS[task][p.role]
    return {
      key: p.index,
      label: shortLabel(p.role, bodyOrdinal, task),
      words: p.wordCount,
      inRange: p.wordCount >= lo && p.wordCount <= hi,
      widthPct: barWidthPct(p.wordCount),
      lo,
      hi,
    }
  })

  /* Running counters across labels + nodes (render order = visual order). */
  let step = 0
  let flatIdx = 0

  return (
    <section className="rail-root" aria-label="Essay structure">
      {questionType && (
        <div className="rail-needs">
          <p className="eyebrow">This question needs</p>
          <ul className="rail-needs-list">
            {QUESTION_TYPE_META[questionType].mustAddress.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {groups.length > 0 && (
        <div className="rail-anatomy">
          {groups.map((group) => (
            <div className="rail-group" key={group.key}>
              <p className="eyebrow rail-group-label rail-enter" style={enterStyle(step++)}>
                <span className="rail-group-label-text">{GROUP_LABELS[group.key]}</span>
              </p>
              <ul className="rail-nodes">
                {group.items.map((check) => {
                  const idx = flatIdx++
                  return (
                    <li
                      key={check.id}
                      className={nodeClass(check, idx, flat, currentId)}
                      style={enterStyle(step++)}
                    >
                      <span className="rail-dot" aria-hidden="true">
                        {check.satisfied && (
                          <svg viewBox="0 0 10 10" width="8" height="8" focusable="false">
                            <path
                              d="M1.8 5.4 4 7.6 8.2 2.8"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                      <span className="rail-node-label">{check.label}</span>
                      {check.detail && <span className="rail-node-detail">{check.detail}</span>}
                      <span className="rail-sr">{check.satisfied ? ' — done' : ' — not yet'}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {isEmpty && <p className="rail-empty">The rail fills in as your essay takes shape.</p>}

      {bars.length > 0 && (
        <div className="rail-balance">
          <p className="eyebrow">Paragraph balance</p>
          <ul className="rail-balance-list">
            {bars.map((bar) => (
              <li
                key={bar.key}
                className="rail-balance-row"
                title={`${bar.label}: ${bar.words} words — aim for ${bar.lo}–${bar.hi}`}
              >
                <span className="rail-balance-label mono">
                  {bar.label} · {bar.words} {bar.words === 1 ? 'word' : 'words'}
                </span>
                <span className="rail-balance-track">
                  <span
                    className={
                      bar.inRange ? 'rail-balance-bar rail-in-range' : 'rail-balance-bar'
                    }
                    style={{ width: `${bar.widthPct}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
