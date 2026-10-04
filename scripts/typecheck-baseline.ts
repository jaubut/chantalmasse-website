/**
 * Runs `nuxt typecheck` (vue-tsc, strict) and compares the errors against a
 * committed baseline (tests/typecheck-baseline.json).
 *
 * Why a baseline: main already carries pre-existing type errors (mostly
 * noUncheckedIndexedAccess, which Nuxt 4 turns on). Fixing them means touching
 * production code, which is out of scope for the CI change. The gate fails on
 * any NEW error (e.g. a dependency major that changes its types) and reports
 * errors that disappeared so the baseline can be tightened.
 *
 * Errors are keyed by "file: TScode: message" (no line/column) so that
 * unrelated edits that shift lines don't break the gate.
 *
 *   bun scripts/typecheck-baseline.ts            check (exit 1 on new errors)
 *   bun scripts/typecheck-baseline.ts --update   rewrite the baseline
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const BASELINE = join(ROOT, 'tests/typecheck-baseline.json')
const ERROR_LINE = /^(.+?)\(\d+,\d+\): error (TS\d+): (.*)$/

type Counts = Record<string, number>

function runTypecheck(): { status: number | null; output: string } {
  const bin = join(ROOT, 'node_modules/.bin/nuxt')
  const p = spawnSync(bin, ['typecheck'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    maxBuffer: 64 * 1024 * 1024,
  })
  return { status: p.status, output: `${p.stdout ?? ''}${p.stderr ?? ''}` }
}

function parseErrors(output: string): Counts {
  const counts: Counts = {}
  for (const raw of output.split('\n')) {
    // eslint-disable-next-line no-control-regex
    const line = raw.replace(/\x1b\[[0-9;]*m/g, '').trim()
    const m = line.match(ERROR_LINE)
    if (!m) continue
    const key = `${m[1]!.replace(/\\/g, '/')}: ${m[2]}: ${m[3]}`
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

function sorted(c: Counts): Counts {
  return Object.fromEntries(Object.entries(c).sort(([a], [b]) => a.localeCompare(b)))
}

function main() {
  const update = process.argv.includes('--update')
  const { status, output } = runTypecheck()
  const current = parseErrors(output)
  const total = Object.values(current).reduce((a, b) => a + b, 0)

  // vue-tsc failed without reporting a single parseable error → tool crash.
  if (status !== 0 && total === 0) {
    console.error(output)
    console.error('typecheck: vue-tsc exited non-zero without TS errors (crash?)')
    process.exit(1)
  }

  if (update) {
    writeFileSync(BASELINE, `${JSON.stringify(sorted(current), null, 2)}\n`)
    console.log(`typecheck: baseline written (${total} known errors)`)
    return
  }

  const baseline: Counts = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {}
  const added: string[] = []
  const fixed: string[] = []
  for (const [key, n] of Object.entries(current)) {
    const extra = n - (baseline[key] ?? 0)
    if (extra > 0) added.push(`  +${extra}  ${key}`)
  }
  for (const [key, n] of Object.entries(baseline)) {
    const gone = n - (current[key] ?? 0)
    if (gone > 0) fixed.push(`  -${gone}  ${key}`)
  }

  if (fixed.length) {
    console.log(`typecheck: ${fixed.length} baseline error(s) no longer reported (run typecheck:update-baseline):`)
    console.log(fixed.join('\n'))
  }
  if (added.length) {
    console.error(output.split('\n').filter(l => / error TS/.test(l)).join('\n'))
    console.error(`\ntypecheck: ${added.length} NEW type error(s) not in the baseline:`)
    console.error(added.join('\n'))
    process.exit(1)
  }
  console.log(`typecheck: OK (${total} known baseline errors, 0 new)`)
}

main()
