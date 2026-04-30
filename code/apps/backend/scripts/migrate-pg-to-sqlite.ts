import { Client } from 'pg'
import { PrismaClient } from '@prisma/client'

const pg = new Client({
  connectionString: 'postgresql://finance:finance@localhost:5432/finance',
})
const prisma = new PrismaClient()

async function main() {
  await pg.connect()
  console.log('Connected to PostgreSQL')

  // Categories
  const { rows: cats } = await pg.query('SELECT * FROM "Category"')
  for (const c of cats) {
    await prisma.category.upsert({
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
  console.log(`Migrated ${cats.length} categories`)

  // Transactions
  const { rows: txs } = await pg.query('SELECT * FROM "Transaction" ORDER BY "createdAt"')
  for (const t of txs) {
    await prisma.transaction.upsert({
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
  console.log(`Migrated ${txs.length} transactions`)

  // CategoryRules
  const { rows: rules } = await pg.query('SELECT * FROM "CategoryRule"')
  for (const r of rules) {
    await prisma.categoryRule.upsert({
      where: { id: r.id },
      update: {},
      create: { id: r.id, categoryId: r.categoryId, keyword: r.keyword },
    })
  }
  console.log(`Migrated ${rules.length} category rules`)

  // RecurringPatterns
  const { rows: patterns } = await pg.query('SELECT * FROM "RecurringPattern"')
  for (const p of patterns) {
    await prisma.recurringPattern.upsert({
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
  console.log(`Migrated ${patterns.length} recurring patterns`)

  // ImportBatches
  const { rows: batches } = await pg.query('SELECT * FROM "ImportBatch"')
  for (const b of batches) {
    await prisma.importBatch.upsert({
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
  console.log(`Migrated ${batches.length} import batches`)

  // ImportedTransactions
  const { rows: imported } = await pg.query('SELECT * FROM "ImportedTransaction"')
  for (const i of imported) {
    await prisma.importedTransaction.upsert({
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
  console.log(`Migrated ${imported.length} imported transactions`)

  // AppSettings
  const { rows: settings } = await pg.query('SELECT * FROM "AppSettings"')
  for (const s of settings) {
    await prisma.appSettings.upsert({
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
  console.log(`Migrated settings`)

  await pg.end()
  await prisma.$disconnect()
  console.log('Migration complete ✓')
}

main().catch((e) => { console.error(e); process.exit(1) })
