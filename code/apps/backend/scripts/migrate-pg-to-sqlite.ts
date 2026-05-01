import { Client } from 'pg'
import { PrismaClient } from '@prisma/client'

const pg = new Client({
  connectionString: 'postgresql://finance:finance@localhost:5432/finance',
})
const prisma = new PrismaClient()

async function main() {
  await pg.connect()
  console.log('Connected to PostgreSQL')

  // Fetch all data from PostgreSQL before starting the SQLite transaction
  const [cats, txs, rules, patterns, batches, imported, settings] = await Promise.all([
    pg.query('SELECT * FROM "Category"').then((r) => r.rows),
    pg.query('SELECT * FROM "Transaction" ORDER BY "createdAt"').then((r) => r.rows),
    pg.query('SELECT * FROM "CategoryRule"').then((r) => r.rows),
    pg.query('SELECT * FROM "RecurringPattern"').then((r) => r.rows),
    pg.query('SELECT * FROM "ImportBatch"').then((r) => r.rows),
    pg.query('SELECT * FROM "ImportedTransaction"').then((r) => r.rows),
    pg.query('SELECT * FROM "AppSettings"').then((r) => r.rows),
  ])
  await pg.end()
  console.log(
    `Fetched: ${cats.length} categories, ${txs.length} transactions, ` +
    `${rules.length} rules, ${patterns.length} patterns, ` +
    `${batches.length} batches, ${imported.length} imported transactions`,
  )

  // Write everything in a single SQLite transaction — any failure rolls back all inserts
  await prisma.$transaction(
    async (tx) => {
      for (const c of cats) {
        await tx.category.upsert({
          where: { id: c.id },
          update: {},
          create: {
            id: c.id,
            name: c.name,
            color: c.color,
            monthlyBudget: c.monthlyBudget ? Number(c.monthlyBudget) : null,
          },
        })
      }
      console.log(`  ✓ ${cats.length} categories`)

      for (const t of txs) {
        await tx.transaction.upsert({
          where: { id: t.id },
          update: {},
          create: {
            id: t.id,
            amount: Number(t.amount),
            date: new Date(t.date),
            description: t.description,
            merchant: t.merchant,
            account: t.account,
            notes: t.notes,
            source: t.source,
            categoryId: t.categoryId,
            createdAt: new Date(t.createdAt),
          },
        })
      }
      console.log(`  ✓ ${txs.length} transactions`)

      for (const r of rules) {
        await tx.categoryRule.upsert({
          where: { id: r.id },
          update: {},
          create: { id: r.id, categoryId: r.categoryId, keyword: r.keyword },
        })
      }
      console.log(`  ✓ ${rules.length} category rules`)

      for (const p of patterns) {
        await tx.recurringPattern.upsert({
          where: { id: p.id },
          update: {},
          create: {
            id: p.id,
            description: p.description,
            typicalDay: p.typicalDay,
            typicalAmount: Number(p.typicalAmount),
            categoryId: p.categoryId,
            active: p.active,
            createdAt: new Date(p.createdAt),
            updatedAt: new Date(p.updatedAt),
          },
        })
      }
      console.log(`  ✓ ${patterns.length} recurring patterns`)

      for (const b of batches) {
        await tx.importBatch.upsert({
          where: { id: b.id },
          update: {},
          create: {
            id: b.id,
            filename: b.filename,
            uploadedAt: new Date(b.uploadedAt),
            status: b.status,
          },
        })
      }
      console.log(`  ✓ ${batches.length} import batches`)

      for (const i of imported) {
        await tx.importedTransaction.upsert({
          where: { id: i.id },
          update: {},
          create: {
            id: i.id,
            batchId: i.batchId,
            rawDate: i.rawDate,
            rawDescription: i.rawDescription,
            rawAmount: Number(i.rawAmount),
            aiCategoryId: i.aiCategoryId,
            aiCategorized: i.aiCategorized,
            transactionId: i.transactionId,
          },
        })
      }
      console.log(`  ✓ ${imported.length} imported transactions`)

      for (const s of settings) {
        await tx.appSettings.upsert({
          where: { id: s.id },
          update: {},
          create: {
            id: s.id,
            aiProvider: s.aiProvider,
            aiApiKey: s.aiApiKey,
            aiModel: s.aiModel,
          },
        })
      }
      console.log(`  ✓ settings`)
    },
    { timeout: 60000 },
  )

  await prisma.$disconnect()
  console.log('Migration complete ✓')
}

main().catch((e) => { console.error(e); process.exit(1) })
