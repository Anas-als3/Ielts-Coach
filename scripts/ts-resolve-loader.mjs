/**
 * A tiny Node ESM loader hook that makes `generate-audio.mjs` able to import
 * `src/listening/tests/*.ts` directly, without a bundler and without adding a
 * dependency.
 *
 * `src/` is written like the rest of this project: relative imports with no
 * extension (`from './test01'`), resolved by Vite/tsc's bundler-style module
 * resolution at build time. `node --experimental-strip-types` STRIPS TYPES
 * from a `.ts` file, but it does not add that extension resolution — a bare
 * `import('.../index.ts')` fails resolving `index.ts`'s own `from './test01'`
 * with "Cannot find module '.../test01'" (confirmed empirically; there is no
 * flag that changes this). This loader's `resolve` hook is the fix: when the
 * default resolver fails on a relative specifier, retry it with `.ts`, `.tsx`
 * then `.js` appended, in that order, before giving up.
 *
 * This is Node's own supported extension point (`node:module`'s `register`),
 * not a new dependency — esbuild or ts-node would have worked too (the plan
 * offered either), but both are packages this dev-only script would have had
 * to add. A file with an explicit extension, or a bare package specifier
 * (`node:fs`, etc.), is untouched: only a relative import that the default
 * resolver could not find is ever retried here.
 */
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RETRY_EXTENSIONS = ['.ts', '.tsx', '.js']

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (err) {
    const isRelative = specifier.startsWith('./') || specifier.startsWith('../')
    if (!isRelative || context.parentURL === undefined) throw err

    const base = new URL(specifier, context.parentURL)
    for (const extension of RETRY_EXTENSIONS) {
      const candidateURL = base.pathname.endsWith(extension) ? base : new URL(base.pathname + extension, base)
      const candidatePath = fileURLToPath(candidateURL)
      if (existsSync(candidatePath)) {
        return nextResolve(pathToFileURL(candidatePath).href, context)
      }
    }
    throw err
  }
}
