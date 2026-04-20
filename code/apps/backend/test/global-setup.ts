import { execSync } from 'child_process'
import { Client } from 'pg'

const BASE_URL = 'postgresql://finance:finance@localhost:5432'
const DB_NAME = `finance_test_${Date.now()}`

export default async function setup() {
  const admin = new Client({ connectionString: `${BASE_URL}/finance` })
  await admin.connect()
  await admin.query(`CREATE DATABASE "${DB_NAME}"`)
  await admin.end()

  process.env.DATABASE_URL = `${BASE_URL}/${DB_NAME}`

  execSync('npx prisma migrate deploy', {
    env: { ...process.env },
    stdio: 'inherit',
  })

  return async function teardown() {
    const cleanup = new Client({ connectionString: `${BASE_URL}/finance` })
    await cleanup.connect()
    await cleanup.query(`DROP DATABASE "${DB_NAME}" WITH (FORCE)`)
    await cleanup.end()
  }
}
