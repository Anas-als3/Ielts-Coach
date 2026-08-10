/**
 * The ONE chronological comparator for session records.
 *
 * "ISO-8601 sorts correctly as text" is true only while every string is in the
 * same zone. This app writes `toISOString()`, which is always UTC — but an
 * IMPORTED file need not be, and `2026-01-01T23:00:00+05:00` (18:00Z) sorts
 * AFTER `2026-01-01T20:00:00Z` as text while falling three hours before it in
 * time. `SPEC.md` states the rule; this module is the only implementation of it.
 *
 * Four things depend on this order, and every one of them is learner-facing:
 *
 *  1. `capSessions` (profile/store.ts) — list order is what "oldest" means, so
 *     text order decides which record gets DELETED.
 *  2. `computeProfile` (profile/profile.ts) — the least-squares slope over the
 *     last six sessions decides improving / flat / worsening, and with two
 *     sessions the slope is just `r1 - r0`. Reversed, a weakness the learner
 *     still has reports as fixed and the Dashboard congratulates them on it.
 *     `types.ts` calls that the worst failure mode in this app.
 *  3. `computeTrends` (profile/profile.ts) and the Dashboard band chart — the
 *     x-axis of every line the learner reads as progress.
 *  4. The report's "previous session" deltas — comparing an essay against one
 *     written afterwards.
 *
 * Unparseable dates sort LAST and are compared to each other as text. They
 * cannot be placed on the timeline at all, and the end of the list is where the
 * cap cannot reach them — when in doubt, keep the learner's record.
 *
 * Equal instants return 0, so `Array.prototype.sort`, which is stable, leaves
 * them in the order they arrived.
 */

/**
 * Structural, not `SessionRecord`: the Dashboard sorts `WritingSessionRecord[]`
 * and the store sorts `SessionRecord[]`, and a component should not have to
 * import the storage module to get a comparator.
 */
export interface HasDateISO {
  readonly dateISO: string
}

/** Ascending by parsed instant (oldest first). */
export function byDateAscending(a: HasDateISO, b: HasDateISO): number {
  const ta = Date.parse(a.dateISO)
  const tb = Date.parse(b.dateISO)
  const aValid = Number.isFinite(ta)
  const bValid = Number.isFinite(tb)
  if (aValid && bValid) return ta - tb
  if (aValid) return -1
  if (bValid) return 1
  return a.dateISO.localeCompare(b.dateISO)
}

/** A new array, oldest first. Never mutates its argument. */
export function sortByDateAscending<T extends HasDateISO>(items: readonly T[]): T[] {
  return items.slice().sort(byDateAscending)
}

/**
 * Does `a` fall strictly before `b` in time?
 *
 * Exists so a caller that wants a predicate cannot reach for `<` on the raw
 * strings, which is the defect this module was created to remove. Equal
 * instants are NOT "before", matching the `<` it replaces.
 */
export function isBefore(a: HasDateISO, b: HasDateISO): boolean {
  return byDateAscending(a, b) < 0
}
