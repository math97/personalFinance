import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectMetrics } from './collect-metrics.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const BASELINE_PATH = resolve(__dirname, 'baseline.json')
const REPORT_PATH = resolve(__dirname, '../quality-gate-report.md')

// ── Ratchet comparison ──────────────────────────────────────────────────────

export function checkRatchet(current, baseline) {
  const failures = []

  function check(label, cur, base, mode) {
    if (cur == null || base == null || Number.isNaN(cur) || Number.isNaN(base)) return
    const pass = mode === 'lte' ? cur <= base : cur >= base
    if (!pass) failures.push({ label, baseline: base, current: cur })
  }

  for (const app of ['backend', 'frontend']) {
    const c = current[app]
    const b = baseline[app]

    check(`${app} audit critical`, c.audit.critical, b.audit.critical, 'lte')
    check(`${app} audit high`, c.audit.high, b.audit.high, 'lte')
    if (app === 'backend') {
      check('backend lint errors', c.lint.errors, b.lint.errors, 'lte')
    }
    check(`${app} coverage lines`, c.coverage.lines, b.coverage.lines, 'gte')
    check(`${app} coverage branches`, c.coverage.branches, b.coverage.branches, 'gte')
    check(`${app} coverage functions`, c.coverage.functions, b.coverage.functions, 'gte')
    check(`${app} coverage statements`, c.coverage.statements, b.coverage.statements, 'gte')
    check(`${app} duplication`, c.duplication.percentage, b.duplication.percentage, 'lte')
    check(`${app} file size violations`, c.fileSize.violations, b.fileSize.violations, 'lte')
  }

  return failures
}

// ── Report builder ──────────────────────────────────────────────────────────

function fmt(v) {
  if (typeof v !== 'number') return String(v)
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

export function buildReport(current, baseline, failures) {
  const passed = failures.length === 0
  const failedLabels = new Set(failures.map((f) => f.label))

  let md = `## Quality Gate — ${passed ? 'PASSED ✅' : 'FAILED ❌'}\n\n`
  md += `| Metric | Baseline | Current | Status |\n`
  md += `|--------|----------|---------|--------|\n`

  function row(label, cur, base, isPercent = false) {
    const s = isPercent ? '%' : ''
    const icon = failedLabels.has(label) ? '❌' : '✅'
    md += `| ${label} | ${fmt(base)}${s} | ${fmt(cur)}${s} | ${icon} |\n`
  }

  for (const app of ['backend', 'frontend']) {
    const c = current[app]
    const b = baseline[app]

    row(`${app} audit critical`, c.audit.critical, b.audit.critical)
    row(`${app} audit high`, c.audit.high, b.audit.high)
    if (app === 'backend') {
      row('backend lint errors', c.lint.errors, b.lint.errors)
      row('backend lint warnings (info)', c.lint.warnings, b.lint.warnings)
    }
    row(`${app} coverage lines`, c.coverage.lines, b.coverage.lines, true)
    row(`${app} coverage branches`, c.coverage.branches, b.coverage.branches, true)
    row(`${app} coverage functions`, c.coverage.functions, b.coverage.functions, true)
    row(`${app} coverage statements`, c.coverage.statements, b.coverage.statements, true)
    row(`${app} duplication`, c.duplication.percentage, b.duplication.percentage, true)
    row(
      `${app} file size violations (>${b.fileSize.maxLines} lines)`,
      c.fileSize.violations,
      b.fileSize.violations,
    )
  }

  if (failures.length > 0) {
    md += `\n### What to fix\n`
    for (const f of failures) {
      md += `- **${f.label}**: baseline \`${fmt(f.baseline)}\`, current \`${fmt(f.current)}\`\n`
    }
  }

  return md
}

// ── Main ────────────────────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const current = collectMetrics()

  if (!existsSync(BASELINE_PATH)) {
    writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2))
    console.log('✅ Baseline seeded — quality gate passed on first run.')
    process.exit(0)
  }

  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  const failures = checkRatchet(current, baseline)
  const report = buildReport(current, baseline, failures)

  writeFileSync(REPORT_PATH, report)
  console.log(report)

  if (failures.length > 0) {
    const prNumber = process.env.PR_NUMBER
    if (prNumber && /^\d+$/.test(prNumber)) {
      const result = spawnSync('gh', ['pr', 'comment', prNumber, '--body-file', REPORT_PATH], { stdio: 'inherit' })
      if (result.status !== 0) {
        console.error('Warning: could not post PR comment')
      }
    }
    process.exit(1)
  }
}
