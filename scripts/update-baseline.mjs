import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectMetrics } from './collect-metrics.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const BASELINE_PATH = resolve(__dirname, 'baseline.json')

const metrics = collectMetrics()
writeFileSync(BASELINE_PATH, JSON.stringify(metrics, null, 2))
console.log('✅ baseline.json updated')
