/**
 * Mints a session record id. A standalone leaf module rather than living in
 * `App.tsx` — plan 023's own text says to hoist it into `App.tsx` and import
 * it into both section containers, but doing that literally makes `App.tsx`
 * and `ReadingSection.tsx`/`ListeningSection.tsx` import from each other
 * (`App` statically `import`s nothing from the sections — it only reaches
 * them through `lazy(() => import(...))` — but the sections importing a
 * named value back out of `App` closes the cycle the other way). Vite's SSR
 * module runner, which Vitest uses, resolves that specific cycle by handing
 * out a live binding that is not yet initialised until BOTH sides finish
 * evaluating; running the full suite (many files, real concurrency) hit an
 * ordering where a section rendered before that binding settled and threw
 * `ReferenceError: Cannot access '...' before initialization` — intermittent,
 * because it depended on which module happened to import which first. A
 * bundler-only production build never hit it, which is exactly why it did
 * not show up until the full-suite, many-runs verification pass.
 *
 * This file has no imports of its own, so nothing can be circular through it.
 */
export function makeId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')
}
