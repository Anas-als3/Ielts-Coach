import type { CSSProperties } from 'react'
import type { Module, ParagraphRole, StructureCheck, StructureRailProps, TaskKind } from '../types'
import { QUESTION_TYPE_META } from '../meta'
import './StructureRail.css'

type GroupKey = 'intro' | 'body' | 'conclusion'

const GROUP_ORDER: GroupKey[] = ['intro', 'body', 'conclusion']

const GROUP_LABELS: Record<GroupKey, string> = {
  intro: 'Introduction',
  body: 'Body paragraphs',
  conclusion: 'Conclusion',
}

/**
 * Which set of norms and labels the rail is drawing.
 *
 * NOT `TaskKind`: Academic Task 1 (a chart description) and General Training
 * Task 1 (a letter) share the id `'task1'` and have almost nothing else in
 * common, so the rail needs a third shape rather than a second meaning for an
 * existing one.
 */
type RailShape = 'task2' | 'task1' | 'letter'

function railShape(task: TaskKind, module: Module): RailShape {
  return task === 'task1' && module === 'general' ? 'letter' : task
}

/* Same word-count norms the paragraph rules use (SPEC canonical constants).
   Task 1 is a different shape entirely: a short paraphrase, a one-sentence
   overview, then one or two detail paragraphs — and no conclusion.
   A letter is different again: the greeting is absorbed into the opening
   paragraph and the sign-off into the last, so both ends run a little longer
   than the bullet paragraphs between them. */
const NORMS: Record<RailShape, Record<ParagraphRole, readonly [number, number]>> = {
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
  letter: {
    introduction: [20, 50],
    body: [30, 80],
    conclusion: [20, 50], // never assigned in a letter; present to satisfy the record
  },
}

/* Entrance stagger: 30ms steps, capped so late elements join the same moment. */
const STAGGER_CAP = 12

function groupOf(check: StructureCheck): GroupKey {
  // Task 1 ids first — 't1-paraphrase' would otherwise fall through to 'body'.
  if (check.id === 't1-paraphrase' || check.id === 't1-overview') return 'intro'
  // Letter ids next, for the same reason. The greeting and the purpose
  // statement are the opening of a letter; the bullets and the sign-off fall
  // through to 'body'. There is deliberately NO letter check under
  // 'conclusion' — a letter has none, and the rail drops empty groups, so no
  // Conclusion heading is ever drawn.
  if (check.id === 'gt-salutation' || check.id === 'gt-purpose') return 'intro'
  if (check.id.startsWith('intro') || check.id === 'position-stated') return 'intro'
  if (check.id.startsWith('conclusion')) return 'conclusion'
  return 'body'
}

function shortLabel(role: ParagraphRole, bodyOrdinal: number, shape: RailShape): string {
  if (role === 'introduction') {
    if (shape === 'task1') return 'Para'
    if (shape === 'letter') return 'Open'
    return 'Intro'
  }
  if (role === 'conclusion') return 'Concl'
  // Task 1: the first body paragraph is the overview, the rest are details.
  if (shape === 'task1') return bodyOrdinal === 1 ? 'Over' : `D${bodyOrdinal - 1}`
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
  module = 'academic',
}: StructureRailProps) {
  const isEmpty = paragraphs.length === 0
  const shape = railShape(task, module)

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
    const [lo, hi] = NORMS[shape][p.role]
    return {
      key: p.index,
      label: shortLabel(p.role, bodyOrdinal, shape),
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
