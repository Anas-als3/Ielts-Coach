/**
 * Small durable UI preferences — a SEPARATE localStorage key from the session
 * store, so a preference write can never race or damage learners' work and
 * `ielts-coach.v1`'s schemaVersion + migration ladder stay about session data
 * only.
 *
 * Contract (plan 026 defines it, plan 027 extends it): one flat JSON object;
 * fields are ADDITIVE and optional; nothing is renamed or repurposed. Reads
 * validate field-by-field against hostile data — a malformed blob or a
 * wrong-typed field is discarded, never crashed on, because losing a
 * dismissed-intro flag costs one extra card while throwing on mount costs the
 * app. Writes MERGE over the raw stored object, so a field this build does
 * not know about (e.g. one written by a newer build) survives a round-trip.
 */

const PREFS_KEY = 'ielts-coach.prefs.v1'

export interface Prefs {
  /** When the first-run intro card was dismissed. Absent → show the card. */
  introDismissedAtISO?: string
}

/** The stored blob as an object, or {} when missing, malformed, or blocked. */
function readRaw(): Record<string, unknown> {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    return parsed as Record<string, unknown>
  } catch {
    // Malformed JSON or storage blocked — behave as "no preferences saved".
    return {}
  }
}

/** The preferences this build understands, validated field-by-field. */
export function loadPrefs(): Prefs {
  const raw = readRaw()
  const prefs: Prefs = {}
  if (typeof raw.introDismissedAtISO === 'string') {
    prefs.introDismissedAtISO = raw.introDismissedAtISO
  }
  return prefs
}

/** Merge a change over what is stored, preserving fields this build does not know. */
export function updatePrefs(patch: Partial<Prefs>): void {
  try {
    const merged = { ...readRaw(), ...patch }
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(merged))
  } catch {
    // Quota or storage blocked — the preference lives for this session only.
  }
}
