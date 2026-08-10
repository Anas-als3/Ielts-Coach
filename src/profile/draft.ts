/**
 * Scratch-draft persistence for the essay in progress.
 *
 * Key `ielts-coach.draft.v1`. Deliberately NOT part of the session store
 * (`store.ts`): a draft is scratch state with exactly one owner, one key, no
 * versioned migration ladder and no backup on loss — its whole content is at
 * most one debounce window ahead of what the learner can retype, whereas the
 * store's migration ladder and backup-before-clobber exist to protect
 * irreplaceable history. The key shares the `ielts-coach.` namespace but
 * matches neither `store.ts`'s `STORAGE_KEY` nor its `BACKUP_KEY_PREFIX`, so
 * it can never collide with a session and can never be swept by backup
 * pruning.
 *
 * Reads treat stored bytes as hostile wire, exactly as `store.ts` does: every
 * field is validated, and any field failing validation invalidates the whole
 * draft rather than producing a half-applied restore. Writes are best-effort
 * and never throw — a blocked or full localStorage should not break typing.
 */

import type { Module, TaskKind, WritingMode } from '../types'

export const DRAFT_KEY = 'ielts-coach.draft.v1'

export interface WritingDraft {
  task: TaskKind
  module: Module
  promptId: string | null
  essayText: string
  mode: WritingMode
  /** Absolute wall-clock deadline of a RUNNING exam. null in coach mode and in exam-idle. */
  examDeadlineEpochMs: number | null
  savedAtISO: string
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Same tiny word test `App.tsx` uses, duplicated rather than imported — a
 * storage module importing the component tree would be an upside-down
 * dependency. */
function countWords(text: string): number {
  const m = text.match(/[A-Za-zÀ-ɏ'’-]+/g)
  return m ? m.length : 0
}

/**
 * Shape check for a stored draft. A zero-word `essayText` is never WRITTEN
 * (the persistence effect clears the key instead), so one found on disk is
 * hand-edited or corrupt either way: reject it rather than restore an empty
 * sheet as if it were a real draft.
 */
function looksLikeDraft(value: unknown): value is WritingDraft {
  if (!isRecordObject(value)) return false
  if (value.task !== 'task1' && value.task !== 'task2') return false
  if (value.module !== 'academic' && value.module !== 'general') return false
  if (value.mode !== 'coach' && value.mode !== 'exam') return false
  if (typeof value.promptId !== 'string' && value.promptId !== null) return false
  if (typeof value.essayText !== 'string' || countWords(value.essayText) === 0) return false
  if (value.examDeadlineEpochMs !== null && !Number.isFinite(value.examDeadlineEpochMs)) return false
  if (typeof value.savedAtISO !== 'string') return false
  return true
}

/** The stored draft, or null when absent, unreadable, or invalid in ANY field. Never throws. */
export function loadDraft(): WritingDraft | null {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(DRAFT_KEY)
  } catch (err) {
    console.warn('IELTS Coach: could not read the saved draft (storage unavailable).', err)
    return null
  }
  if (raw === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  return looksLikeDraft(parsed) ? parsed : null
}

/** Best-effort write. Quota or blocked storage is warned to the console, never thrown. */
export function saveDraft(draft: WritingDraft): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch (err) {
    console.warn('IELTS Coach: could not save your draft (storage is full or unavailable).', err)
  }
}

/** Best-effort delete. Removing an absent key is a no-op. */
export function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY)
  } catch (err) {
    console.warn('IELTS Coach: could not clear the saved draft.', err)
  }
}

/** True iff the draft was a RUNNING exam whose deadline is at or before nowEpochMs. */
export function isExamDraftExpired(draft: WritingDraft, nowEpochMs: number): boolean {
  return (
    draft.mode === 'exam' &&
    draft.examDeadlineEpochMs !== null &&
    draft.examDeadlineEpochMs <= nowEpochMs
  )
}
