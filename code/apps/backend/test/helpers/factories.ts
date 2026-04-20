import { PrismaService } from '../../src/prisma/prisma.service'

type Overrides = Record<string, unknown>

export async function createCategory(prisma: PrismaService, overrides: Overrides = {}) {
  return prisma.category.create({
    data: { name: `Category ${Date.now()}`, color: '#6366f1', ...overrides },
  })
}

export async function createTransaction(prisma: PrismaService, overrides: Overrides = {}) {
  return prisma.transaction.create({
    data: {
      description: 'Test transaction',
      amount: -50,
      date: new Date('2026-04-15'),
      source: 'manual',
      ...overrides,
    },
  })
}

export async function createImportBatch(prisma: PrismaService, overrides: Overrides = {}) {
  return prisma.importBatch.create({
    data: { filename: 'test.pdf', status: 'reviewing', ...overrides },
  })
}

export async function createImportedTransaction(
  prisma: PrismaService,
  batchId: string,
  overrides: Overrides = {},
) {
  return prisma.importedTransaction.create({
    data: {
      batchId,
      rawDate: '2026-04-15',
      rawDescription: 'Imported expense',
      rawAmount: -30,
      ...overrides,
    },
  })
}
