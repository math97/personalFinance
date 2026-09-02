import { Test } from '@nestjs/testing'
import { DashboardService } from '../modules/dashboard/dashboard.service'
import { TransactionRepository } from '../domain/repositories/transaction.repository'
import { CategoryRepository } from '../domain/repositories/category.repository'
import { ImportBatchRepository } from '../domain/repositories/import-batch.repository'
import { InMemoryTransactionRepository } from '../infrastructure/repositories/in-memory/in-memory-transaction.repository'
import { InMemoryCategoryRepository } from '../infrastructure/repositories/in-memory/in-memory-category.repository'
import { InMemoryImportBatchRepository } from '../infrastructure/repositories/in-memory/in-memory-import-batch.repository'
import { TransactionEntity } from '../domain/entities/transaction.entity'
import { CategoryEntity } from '../domain/entities/category.entity'
import { RecurringService } from '../modules/recurring/recurring.service'

describe('DashboardService', () => {
  let service: DashboardService
  let txRepo: InMemoryTransactionRepository
  let catRepo: InMemoryCategoryRepository
  let batchRepo: InMemoryImportBatchRepository

  beforeEach(async () => {
    txRepo = new InMemoryTransactionRepository()
    catRepo = new InMemoryCategoryRepository()
    batchRepo = new InMemoryImportBatchRepository()

    const module = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: TransactionRepository, useValue: txRepo },
        { provide: CategoryRepository,    useValue: catRepo },
        { provide: ImportBatchRepository, useValue: batchRepo },
        {
          provide: RecurringService,
          useValue: {
            getUpcoming: vi.fn().mockResolvedValue([]),
            getDailyTotals: vi.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile()

    service = module.get(DashboardService)
  })

  // ── helpers ──────────────────────────────────────────────────────
  async function saveCat(name: string, color = '#34d399') {
    return catRepo.save(new CategoryEntity('', name, color, [], 0))
  }

  async function saveTx(overrides: Partial<{
    amount: number; date: string; categoryId: string | null; description: string
  }> = {}) {
    const e = new TransactionEntity(
      '',
      overrides.amount      ?? -50,
      new Date(overrides.date ?? '2026-04-15'),
      overrides.description ?? 'Test',
      'manual',
      overrides.categoryId  ?? null,
      null, null, null,
      new Date(),
      null,
    )
    return txRepo.save(e)
  }

  // ── getSpendingByCategory ────────────────────────────────────────
  describe('getSpendingByCategory', () => {
    it('returns categories sorted by total descending', async () => {
      const groceries = await saveCat('Groceries')
      const transport = await saveCat('Transport')
      await saveTx({ categoryId: groceries.id, amount: -100 })
      await saveTx({ categoryId: groceries.id, amount: -50  })
      await saveTx({ categoryId: transport.id, amount: -30  })

      const result = await service.getSpendingByCategory(2026, 4)
      expect(result[0].name).toBe('Groceries')
      expect(result[0].total).toBe(150)
      expect(result[1].name).toBe('Transport')
      expect(result[1].total).toBe(30)
    })

    it('labels transactions with no category as "Uncategorized"', async () => {
      await saveTx({ categoryId: null, amount: -75 })
      const result = await service.getSpendingByCategory(2026, 4)
      expect(result[0].name).toBe('Uncategorized')
      expect(result[0].total).toBe(75)
    })

    it('only counts expenses (negative amounts)', async () => {
      const cat = await saveCat('Salary')
      await saveTx({ categoryId: cat.id, amount: 3000  }) // income — excluded
      await saveTx({ categoryId: cat.id, amount: -200  }) // expense — included

      const result = await service.getSpendingByCategory(2026, 4)
      expect(result[0].total).toBe(200)
    })

    it('returns empty array when no transactions exist', async () => {
      const result = await service.getSpendingByCategory(2026, 4)
      expect(result).toHaveLength(0)
    })

    it('only counts transactions in the specified month', async () => {
      const cat = await saveCat('Groceries')
      await saveTx({ categoryId: cat.id, amount: -100, date: '2026-04-15' })
      await saveTx({ categoryId: cat.id, amount: -200, date: '2026-03-15' })

      const april = await service.getSpendingByCategory(2026, 4)
      expect(april[0].total).toBe(100)

      const march = await service.getSpendingByCategory(2026, 3)
      expect(march[0].total).toBe(200)
    })
  })

  // ── getMonthlyTotals ─────────────────────────────────────────────
  describe('getMonthlyTotals', () => {
    it('returns 4 months ending at the given month', async () => {
      const result = await service.getMonthlyTotals(2026, 4, 4)
      expect(result).toHaveLength(4)
      const last = result[result.length - 1]
      expect(last.year).toBe(2026)
      expect(last.month).toBe(4)
    })

    it('returns months in chronological order', async () => {
      const result = await service.getMonthlyTotals(2026, 4, 4)
      for (let i = 1; i < result.length; i++) {
        const prev = result[i - 1]
        const curr = result[i]
        const prevMs = new Date(prev.year, prev.month - 1).getTime()
        const currMs = new Date(curr.year, curr.month - 1).getTime()
        expect(currMs).toBeGreaterThan(prevMs)
      }
    })

    it('includes actual spending totals for each month', async () => {
      await saveTx({ amount: -100, date: '2026-04-01' })
      await saveTx({ amount: -200, date: '2026-03-15' })

      const result = await service.getMonthlyTotals(2026, 4, 4)
      const april = result.find(m => m.year === 2026 && m.month === 4)!
      const march = result.find(m => m.year === 2026 && m.month === 3)!
      expect(april.total).toBe(100)
      expect(march.total).toBe(200)
    })

    it('returns 0 for months with no transactions', async () => {
      const result = await service.getMonthlyTotals(2026, 4, 4)
      result.forEach(m => expect(m.total).toBe(0))
    })

    it('wraps correctly across year boundary (January)', async () => {
      const result = await service.getMonthlyTotals(2026, 1, 4)
      expect(result[0]).toMatchObject({ year: 2025, month: 10 })
      expect(result[3]).toMatchObject({ year: 2026, month: 1  })
    })
  })

  // ── getSummaryCards ──────────────────────────────────────────────
  describe('getSummaryCards', () => {
    it('returns totalSpent as absolute sum of negative transactions', async () => {
      await saveTx({ amount: -100 })
      await saveTx({ amount: -50  })
      const summary = await service.getSummaryCards(2026, 4)
      expect(summary.totalSpent).toBe(150)
    })

    it('returns totalIncome as sum of positive transactions', async () => {
      await saveTx({ amount: 3000 })  // income
      await saveTx({ amount: -100 }) // expense
      const summary = await service.getSummaryCards(2026, 4)
      expect(summary.totalIncome).toBe(3000)
    })

    it('returns 0 for totalIncome when no income transactions', async () => {
      await saveTx({ amount: -100 })
      const summary = await service.getSummaryCards(2026, 4)
      expect(summary.totalIncome).toBe(0)
    })

    it('returns transactionCount including both income and expenses', async () => {
      await saveTx({ amount: -50  })
      await saveTx({ amount: 3000 })
      const summary = await service.getSummaryCards(2026, 4)
      expect(summary.transactionCount).toBe(2)
    })

    it('returns biggestCategory as the highest-spending category', async () => {
      const rent     = await saveCat('Rent',      '#818cf8')
      const grocery  = await saveCat('Groceries', '#34d399')
      await saveTx({ categoryId: rent.id,    amount: -1500 })
      await saveTx({ categoryId: grocery.id, amount: -200  })

      const summary = await service.getSummaryCards(2026, 4)
      expect(summary.biggestCategory?.name).toBe('Rent')
    })

    it('returns null biggestCategory when no transactions exist', async () => {
      const summary = await service.getSummaryCards(2026, 4)
      expect(summary.biggestCategory).toBeNull()
    })

    it('returns inboxCount > 0 when there are reviewing batches with imported transactions', async () => {
      // countReviewing in-memory counts imported transactions in reviewing batches
      const batch = await batchRepo.createBatch('statement.pdf')
      await batchRepo.updateStatus(batch.id, 'reviewing')
      await batchRepo.createImportedTransactions([{
        batchId: batch.id, rawDate: '2026-04-01', rawDescription: 'TESCO',
        rawAmount: -20, aiCategoryId: null, aiCategorized: false,
      }])

      const summary = await service.getSummaryCards(2026, 4)
      expect(summary.inboxCount).toBeGreaterThan(0)
    })
  })

  // ── getSummary ───────────────────────────────────────────────────
  describe('getSummary', () => {
    it('returns summary, byCategory, and monthlyTotals together', async () => {
      await saveTx({ amount: -100 })
      const result = await service.getSummary(2026, 4)
      expect(result).toHaveProperty('summary')
      expect(result).toHaveProperty('byCategory')
      expect(result).toHaveProperty('monthlyTotals')
      expect(result.monthlyTotals).toHaveLength(4)
    })
  })

  // ── getSpendingByCategory — budget ───────────────────────────────
  describe('getSpendingByCategory with budget', () => {
    it('includes monthlyBudget on rows where category has a budget set', async () => {
      const groceries = await catRepo.save(
        new CategoryEntity('', 'Groceries', '#34d399', [], 0, 300),
      )
      await saveTx({ amount: -120, date: '2026-04-10', categoryId: groceries.id })

      const rows = await service.getSpendingByCategory(2026, 4)

      const row = rows.find(r => r.name === 'Groceries')
      expect(row?.monthlyBudget).toBe(300)
    })

    it('returns null monthlyBudget for categories without a budget set', async () => {
      const transport = await catRepo.save(
        new CategoryEntity('', 'Transport', '#38bdf8', [], 0),
      )
      await saveTx({ amount: -40, date: '2026-04-05', categoryId: transport.id })

      const rows = await service.getSpendingByCategory(2026, 4)

      const row = rows.find(r => r.name === 'Transport')
      expect(row?.monthlyBudget).toBeNull()
    })
  })
})
