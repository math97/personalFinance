import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CODE_DIR = resolve(__dirname, '../code')
const BACKEND_DIR = join(CODE_DIR, 'apps/backend')
const FRONTEND_DIR = join(CODE_DIR, 'apps/frontend')
const FILE_SIZE_LIMIT = 300

function run(cmd, cwd) {
  return spawnSync(cmd, { shell: true, cwd, encoding: 'utf8', stdio: 'pipe' })
}

function collectAudit() {
  const output = run('npm audit --json', CODE_DIR).stdout ?? ''
  try {
    const data = JSON.parse(output)
    const v = data.metadata?.vulnerabilities ?? {}
    return { critical: v.critical ?? 0, high: v.high ?? 0 }
  } catch {
    return { critical: 0, high: 0 }
  }
}

function collectLint() {
  const result = run('npx eslint "src/**/*.ts" --format json', BACKEND_DIR)
  try {
    const files = JSON.parse(result.stdout ?? '')
    const errors = files.reduce((sum, f) => sum + (f.errorCount ?? 0), 0)
    const warnings = files.reduce((sum, f) => sum + (f.warningCount ?? 0), 0)
    return { errors, warnings }
  } catch {
    if (result.stderr) process.stderr.write(`[lint] eslint error: ${result.stderr}\n`)
    return { errors: 0, warnings: 0 }
  }
}

function collectCoverage(appDir) {
  const result = run('npx vitest run --coverage --coverage.reporter=json-summary', appDir)
  if (result.status !== 0) {
    process.stderr.write(`[coverage] vitest failed (exit ${result.status})\n`)
    return { lines: 0, branches: 0, functions: 0, statements: 0 }
  }
  const summaryPath = join(appDir, 'coverage/coverage-summary.json')
  try {
    const summary = JSON.parse(readFileSync(summaryPath, 'utf8'))
    const t = summary.total
    const pct = (n) => Math.round(n * 10) / 10
    return {
      lines: pct(t.lines.pct),
      branches: pct(t.branches.pct),
      functions: pct(t.functions.pct),
      statements: pct(t.statements.pct),
    }
  } catch {
    return { lines: 0, branches: 0, functions: 0, statements: 0 }
  }
}

function collectDuplication(appDir) {
  run('npx jscpd src --reporters json --output jscpd-report', appDir)
  const reportPath = join(appDir, 'jscpd-report/jscpd-report.json')
  try {
    const report = JSON.parse(readFileSync(reportPath, 'utf8'))
    const raw = report.statistics?.total?.percentage ?? 0
    return { percentage: Math.round(parseFloat(raw) * 10) / 10 }
  } catch {
    return { percentage: 0 }
  }
}

function collectFileSize(appDir) {
  const srcDir = join(appDir, 'src')
  let violations = 0

  function scan(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        scan(full)
      } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
        const lines = readFileSync(full, 'utf8').split('\n').length
        if (lines > FILE_SIZE_LIMIT) violations++
      }
    }
  }

  if (existsSync(srcDir)) {
    try {
      scan(srcDir)
    } catch (err) {
      process.stderr.write(`[fileSize] scan error: ${err.message}\n`)
    }
  }
  return { maxLines: FILE_SIZE_LIMIT, violations }
}

export function collectMetrics() {
  process.stdout.write('📊 Collecting metrics...\n')

  const audit = collectAudit()
  process.stdout.write('  ✓ audit\n')

  const backendLint = collectLint()
  process.stdout.write('  ✓ lint\n')

  const backendCoverage = collectCoverage(BACKEND_DIR)
  process.stdout.write('  ✓ backend coverage\n')

  const frontendCoverage = collectCoverage(FRONTEND_DIR)
  process.stdout.write('  ✓ frontend coverage\n')

  const backendDuplication = collectDuplication(BACKEND_DIR)
  process.stdout.write('  ✓ backend duplication\n')

  const frontendDuplication = collectDuplication(FRONTEND_DIR)
  process.stdout.write('  ✓ frontend duplication\n')

  const backendFileSize = collectFileSize(BACKEND_DIR)
  const frontendFileSize = collectFileSize(FRONTEND_DIR)
  process.stdout.write('  ✓ file sizes\n')

  return {
    backend: {
      audit,
      lint: backendLint,
      coverage: backendCoverage,
      duplication: backendDuplication,
      fileSize: backendFileSize,
    },
    frontend: {
      audit: { ...audit },
      coverage: frontendCoverage,
      duplication: frontendDuplication,
      fileSize: frontendFileSize,
    },
  }
}
