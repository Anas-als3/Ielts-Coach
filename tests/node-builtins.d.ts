/**
 * Minimal ambient declarations for the handful of Node built-ins plan 032's
 * tests need: spawning `scripts/generate-audio.mjs` as a real subprocess
 * (its own done-criterion says the `--dry-run` invocation must be an
 * automated, CI-executable test — that means a real child process, not a
 * simulation) and reading the committed audio fixtures off disk to prove the
 * checked-in manifest/file contract round-trips for real.
 *
 * This project ships no `@types/node` devDependency — nothing else needed
 * it (see `SPEC.md`'s "no runtime dependency beyond React"; this is the same
 * minimalism applied to devDependencies). These are the EXACT, small surface
 * plan 032's tests actually call, not a general stand-in for the package.
 */
declare module 'node:fs' {
  export function readFileSync(path: string): Uint8Array
  export function readFileSync(path: string, encoding: 'utf8'): string
}

declare module 'node:child_process' {
  export interface SpawnSyncOptions {
    cwd?: string
    encoding?: 'utf8'
    env?: Record<string, string | undefined>
  }
  export interface SpawnSyncResult {
    status: number | null
    stdout: string
    stderr: string
  }
  export function spawnSync(command: string, args: readonly string[], options: SpawnSyncOptions): SpawnSyncResult
}

declare const process: {
  cwd(): string
  env: Record<string, string | undefined>
}
