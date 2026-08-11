/**
 * The quiet moment while a lazily-loaded view's chunk arrives.
 *
 * Deliberately plain. DESIGN.md budgets ONE orchestrated transition in this app
 * ("clearing the desk", ~400ms) and a spinner here would be a second, competing
 * one — on a wait that is usually a single frame from cache. It reserves the
 * page's own padding so nothing below it jumps, it is `role="status"` with
 * `aria-live="polite"` so a screen-reader user is told the view is arriving
 * rather than finding an empty main, and it never takes focus.
 *
 * Shared by every lazily-loaded view (Reading, Listening, Mock test, the model
 * library) — one small shared component rather than a fallback per view.
 */
export default function SectionFallback({ label }: { label: string }) {
  return (
    <main className="page">
      <p className="eyebrow" role="status" aria-live="polite">
        Loading {label}…
      </p>
    </main>
  )
}
