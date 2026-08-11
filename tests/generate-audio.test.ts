/**
 * Plan 032 Prong B step 4's done criterion, verified for real: running
 * `scripts/generate-audio.mjs` WITHOUT `TTS_API_KEY` exits non-zero with a
 * one-line explanation, and `--dry-run` prints the cue count and voice map
 * without calling any API. `--dry-run` needs no network and no key, so it is
 * genuinely executable here and in CI — this IS that automated test, not a
 * simulation of it: every case below actually spawns
 * `node --experimental-strip-types scripts/generate-audio.mjs`.
 *
 * `spawnSync`'s `env` REPLACES the child's environment rather than merging
 * with it — every case below builds a full env explicitly (starting from
 * `process.env`) so `PATH` still resolves `node`, and so `TTS_API_KEY`
 * genuinely is absent in the "no key" cases rather than merely unset in the
 * patch (a merge would leave a key set in THIS shell leaking through and
 * making the refusal case impossible to test honestly).
 */
import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'

/** `process.cwd()` is the repo root under `npx vitest run` — the engine
 *  project sets no working-directory override in vite.config.ts. */
const REPO_ROOT = process.cwd()

function envWithout(key: string): Record<string, string | undefined> {
  const env = { ...process.env }
  delete env[key]
  return env
}

function runScript(args: string[], env: Record<string, string | undefined>) {
  return spawnSync('node', ['--experimental-strip-types', 'scripts/generate-audio.mjs', ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env,
  })
}

describe('scripts/generate-audio.mjs', () => {
  it('--dry-run prints the cue count and voice map, calls no API, exits zero', () => {
    const result = runScript(['--test', 'listening-01', '--dry-run'], envWithout('TTS_API_KEY'))

    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/listening-01: \d+ cues across 4 sections\./)
    expect(result.stdout).toContain('Voice map:')
    expect(result.stdout).toContain('narrator ->')
    expect(result.stdout).toContain('Dry run: no API called, no files written.')
  })

  it('--dry-run works for every registered test, not just the first', () => {
    const result = runScript(['--test', 'listening-02', '--dry-run'], envWithout('TTS_API_KEY'))
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/listening-02: \d+ cues across 4 sections\./)
  })

  it('refuses to run without TTS_API_KEY, exits non-zero, one-line explanation, no dry-run flag needed to trigger it', () => {
    const result = runScript(['--test', 'listening-01'], envWithout('TTS_API_KEY'))

    expect(result.status).not.toBe(0)
    expect(result.status).not.toBeNull()
    const explanation = result.stderr.trim()
    expect(explanation.split('\n')).toHaveLength(1)
    expect(explanation).toMatch(/TTS_API_KEY/)
  })

  it('never echoes an API key anywhere in its own output, even when one is set', () => {
    const env = { ...process.env, TTS_API_KEY: 'sk-should-never-appear-in-output' }
    // Still --dry-run: this proves the key is not echoed by the ARGUMENT-
    // PARSING/setup path without actually spending anything on a real call.
    const result = runScript(['--test', 'listening-01', '--dry-run'], env)

    expect(result.status).toBe(0)
    expect(result.stdout).not.toContain('sk-should-never-appear-in-output')
    expect(result.stderr).not.toContain('sk-should-never-appear-in-output')
  })

  it('an unknown test id fails clearly, listing the ids that do exist', () => {
    const result = runScript(['--test', 'not-a-real-test', '--dry-run'], envWithout('TTS_API_KEY'))
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('not-a-real-test')
    expect(result.stderr).toContain('listening-01')
  })

  it('no arguments prints usage and exits non-zero', () => {
    const result = runScript([], envWithout('TTS_API_KEY'))
    expect(result.status).not.toBe(0)
    expect(result.stdout).toContain('Usage:')
  })
})
