import { useEffect, useRef, useState } from 'react'
import type { ClipboardEvent, DragEvent, ReactNode } from 'react'
import type { EditorProps, Issue, Severity } from '../types'
import './Editor.css'

interface MarkSpan {
  issue: Issue
  start: number
  end: number
}

const SEVERITY_RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 }

const WORD_RE = /[A-Za-zÀ-ɏ'’-]+/g
const LETTER_RE = /[A-Za-zÀ-ɏ]/
const TARGET_WORDS = 250

/** Word count for the progress rule: word-ish runs that contain a letter. */
function countWords(text: string): number {
  let count = 0
  for (const match of text.match(WORD_RE) ?? []) {
    if (LETTER_RE.test(match)) count += 1
  }
  return count
}

/**
 * Span-level issues prepared for the mirror: clamped to the text, overlaps
 * resolved severity-first (error beats warning beats info, shorter spans win
 * ties) so a long low-value span never swallows a short high-value mark, then
 * re-sorted by start for rendering.
 * Defensive: never assumes offsets are valid or in range.
 */
function buildMarkSpans(issues: Issue[], textLength: number): MarkSpan[] {
  const candidates: MarkSpan[] = []
  for (const issue of issues) {
    if (issue.start == null || issue.end == null) continue
    const start = Math.max(0, Math.min(issue.start, textLength))
    const end = Math.max(0, Math.min(issue.end, textLength))
    if (start >= end) continue
    candidates.push({ issue, start, end })
  }
  candidates.sort(
    (a, b) =>
      SEVERITY_RANK[a.issue.severity] - SEVERITY_RANK[b.issue.severity] ||
      (a.end - a.start) - (b.end - b.start) ||
      a.start - b.start,
  )

  const placed: MarkSpan[] = []
  for (const span of candidates) {
    if (placed.some((p) => span.start < p.end && p.start < span.end)) continue
    placed.push(span)
  }
  placed.sort((a, b) => a.start - b.start)
  return placed
}

/**
 * The answer sheet. A transparent textarea stacked over an aria-hidden mirror
 * div that paints the inline highlights. Both layers share the .ed-layer
 * metrics class — identical font, line-height, padding and wrapping is the
 * critical invariant that keeps highlights under the text.
 */
export default function Editor({
  text,
  onChange,
  issues,
  showHighlights,
  placeholder,
  focusIssueId,
  blockPaste,
  onPasteBlocked,
  spellCheckEnabled,
}: EditorProps) {
  const mirrorRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [flashId, setFlashId] = useState<string | null>(null)

  const spans = showHighlights ? buildMarkSpans(issues, text.length) : []
  const wordCount = showHighlights ? countWords(text) : 0

  function syncScroll() {
    const mirror = mirrorRef.current
    const input = inputRef.current
    if (!mirror || !input) return
    mirror.scrollTop = input.scrollTop
    mirror.scrollLeft = input.scrollLeft
  }

  // Re-sync after every render: content changes can shift wrap and scrollHeight.
  useEffect(() => {
    syncScroll()
  })

  // When the learner clicks an issue in the panel: scroll the mark to roughly
  // one third from the top of the sheet, then flash it twice. If the issue's
  // own mark was suppressed by overlap resolution, fall back to the rendered
  // mark that overlaps the issue's range so the click still navigates somewhere.
  useEffect(() => {
    if (!focusIssueId) return
    const mirror = mirrorRef.current
    const input = inputRef.current
    if (!mirror || !input) return
    let targetId = focusIssueId
    let mark = mirror.querySelector<HTMLElement>(
      `mark[data-issue-id="${CSS.escape(targetId)}"]`,
    )
    if (!mark) {
      const target = issues.find((issue) => issue.id === focusIssueId)
      if (!target || target.start == null || target.end == null) return
      const targetStart = target.start
      const targetEnd = target.end
      const host = spans.find(
        (span) => span.start < targetEnd && targetStart < span.end,
      )
      if (!host) return
      targetId = host.issue.id
      mark = mirror.querySelector<HTMLElement>(
        `mark[data-issue-id="${CSS.escape(targetId)}"]`,
      )
      if (!mark) return
    }
    const top = Math.max(0, mark.offsetTop - input.clientHeight / 3)
    input.scrollTop = top
    input.scrollLeft = 0
    mirror.scrollTop = top
    mirror.scrollLeft = 0
    setFlashId(targetId)
    const timer = window.setTimeout(() => setFlashId(null), 1000)
    return () => window.clearTimeout(timer)
  }, [focusIssueId])

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    if (!blockPaste) return
    e.preventDefault()
    onPasteBlocked?.()
  }

  function handleDrop(e: DragEvent<HTMLTextAreaElement>) {
    if (!blockPaste) return
    e.preventDefault()
    onPasteBlocked?.()
  }

  // Split the text into plain segments and <mark> spans for the mirror.
  const mirrorChildren: ReactNode[] = []
  let cursor = 0
  for (const span of spans) {
    if (span.start > cursor) mirrorChildren.push(text.slice(cursor, span.start))
    mirrorChildren.push(
      <mark
        key={span.issue.id}
        data-issue-id={span.issue.id}
        className={
          `ed-mark ed-mark-${span.issue.severity}` +
          (flashId === span.issue.id ? ' ed-flash' : '')
        }
      >
        {text.slice(span.start, span.end)}
      </mark>,
    )
    cursor = span.end
  }
  mirrorChildren.push(text.slice(cursor))
  // Trailing zero-width space so trailing newlines keep their line height.
  mirrorChildren.push('\u200b')

  return (
    <div className="ed-sheet">
      <div ref={mirrorRef} className="ed-layer ed-mirror" aria-hidden="true">
        {mirrorChildren}
      </div>
      <textarea
        ref={inputRef}
        className="ed-layer ed-input"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        onPaste={handlePaste}
        onDrop={handleDrop}
        placeholder={placeholder}
        spellCheck={spellCheckEnabled ?? true}
        aria-label="Your essay"
      />
      {showHighlights && (
        <div
          className={
            'ed-progress' + (wordCount >= TARGET_WORDS ? ' ed-progress-met' : '')
          }
          style={{ width: `${Math.min(100, (wordCount / TARGET_WORDS) * 100)}%` }}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
