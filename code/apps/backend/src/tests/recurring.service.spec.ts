import { Test } from '@nestjs/testing'
import { subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { RecurringService } from '../modules/recurring/recurring.service'
import { TransactionRepository } from '../domain/repositories/transaction.repository'
import { CategoryRepository } from '../domain/repositories/category.repository'
import { RecurringPatternRepository } from '../domain/repositories/recurring-pattern.repository'
import { InMemoryTransactionRepository } from '../infrastructure/repositories/in-memory/in-memory-transaction.repository'
import { InMemoryCategoryRepository } from '../infrastructure/repositories/in-memory/in-memory-category.repository'
import { InMemoryRecurringPatternRepository } from '../infrastructure/repositories/in-memory/in-memory-recurring-pattern.repository'
import { TransactionEntity } from '../domain/entities/transaction.entity'
import { CategoryEntity } from '../domain/entities/category.entity'

describe('RecurringService', () => {
  let service: RecurringService
  let txRepo: InMemoryTransactionRepository
  let catRepo: InMemoryCategoryRepository
  let patternRepo: InMemoryRecurringPatternRepository

  beforeEach(async () => {
    txRepo = new InMemoryTransactionRepository()
    catRepo = new InMemoryCategoryRepository()
    patternRepo = new InMemoryRecurringPatternRepository()

    const module = await Test.createTestingModule({
      providers: [
        RecurringService,
        { provide: TransactionRepository,       useValue: txRepo       },
        { provide: CategoryRepository,          useValue: catRepo       },
        { provide: RecurringPatternRepository,  useValue: patternRepo  },
      ],
    }).compile()

    service = module.get(RecurringService)
  })

  async function saveTx(description: string, date: string, amount = -50, categoryId: string | null = null) {
    return txRepo.save(new TransactionEntity(
      '', amount, new Date(date), description, 'pdf', categoryId, null, null, null, new Date(), null,
    ))
  }

  // ── detect ───────────────────────────────────────────────────────
  describe('detect', () => {
    it('creates a pattern when same description appears in 2 of the last 3 months', async () => {
      const now = new Date()
      const m1 = subMonths(now, 1)
      const m2 = subMonths(now, 2)
      const fmt = (d: Date, day: number) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

      await saveTx('Netflix', fmt(m1, 15), -17.99)
      await saveTx('Netflix', fmt(m2, 15), -17.99)

      await service.detect()

      const patterns = await patternRepo.findAllActive()
      expect(patterns).toHaveLength(1)
      expect(patterns[0].description).toBe('Netflix')
      expect(patterns[0].typicalDay).toBe(15)
      expect(patterns[0].typicalAmount).toBeCloseTo(-17.99)
    })

    it('does not create a pattern when description only appears in 1 month', async () => {
      const m1 = subMonths(new Date(), 1)
      await saveTx('Netflix', `${m1.getFullYear()}-${String(m1.getMonth() + 1).padStart(2, '0')}-15`, -17.99)

      await service.detect()

      expect((await patternRepo.findAllActive())).toHaveLength(0)
    })

    it('does not create pattern when amounts differ by more than 20%', async () => {
      const now = new Date()
      const m1 = subMonths(now, 1)
      const m2 = subMonths(now, 2)
      const fmt = (d: Date, day: number) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

      await saveTx('Gym', fmt(m1, 10), -50)
      await saveTx('Gym', fmt(m2, 10), -200)

      await service.detect()

      expect((await patternRepo.findAllActive())).toHaveLength(0)
    })

    it('does not create pattern when day of month differs by more than 5 days', async () => {
      const now = new Date()
      const m1 = subMonths(now, 1)
      const m2 = subMonths(now, 2)
      const fmt = (d: Date, day: number) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

      await saveTx('Gym', fmt(m1, 5), -50)
      await saveTx('Gym', fmt(m2, 28), -50)

      await service.detect()

      expect((await patternRepo.findAllActive())).toHaveLength(0)
    })

    it('never overwrites a dismissed pattern', async () => {
      const now = new Date()
      const m1 = subMonths(now, 1)
      const m2 = subMonths(now, 2)
      const fmt = (d: Date, day: number) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

      await saveTx('Netflix', fmt(m1, 15), -17.99)
      await saveTx('Netflix', fmt(m2, 15), -17.99)

      await service.detect()
      const patterns = await patternRepo.findAll()
      await patternRepo.setActive(patterns[0].id, false)

      await service.detect()

      const active = await patternRepo.findAllActive()
      expect(active).toHaveLength(0)
    })

    it('income transactions (positive amounts) are ignored', async () => {
      const now = new Date()
      const m1 = subMonths(now, 1)
      const m2 = subMonths(now, 2)
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`

      await saveTx('Salary', fmt(m1), 3500)
      await saveTx('Salary', fmt(m2), 3500)

      await service.detect()

      expect((await patternRepo.findAllActive())).toHaveLength(0)
    })
  })

  // ── getUpcoming ──────────────────────────────────────────────────
  describe('getUpcoming', () => {
    it('returns a pattern as upcoming when no matching transaction exists this month', async () => {
      await patternRepo.upsert({ description: 'Netflix', typicalDay: 15, typicalAmount: -17.99, categoryId: null })

      const items = await service.getUpcoming(2026, 4)

      expect(items).toHaveLength(1)
      expect(items[0].description).toBe('Netflix')
      expect(items[0].expectedDay).toBe(15)
      expect(items[0].typicalAmount).toBeCloseTo(-17.99)
    })

    it('does not return upcoming when a matching transaction already exists this month', async () => {
      await patternRepo.upsert({ description: 'Netflix', typicalDay: 15, typicalAmount: -17.99, categoryId: null })
      await saveTx('Netflix', '2026-04-10', -17.99)

      const items = await service.getUpcoming(2026, 4)

      expect(items).toHaveLength(0)
    })

    it('does not return dismissed patterns', async () => {
      const p = await patternRepo.upsert({ description: 'Netflix', typicalDay: 15, typicalAmount: -17.99, categoryId: null })
      await patternRepo.setActive(p.id, false)

      const items = await service.getUpcoming(2026, 4)

      expect(items).toHaveLength(0)
    })

    it('includes category name and color when category exists', async () => {
      const cat = await catRepo.save(new CategoryEntity('', 'Subscriptions', '#c084fc', [], 0))
      await patternRepo.upsert({ description: 'Netflix', typicalDay: 15, typicalAmount: -17.99, categoryId: cat.id })

      const items = await service.getUpcoming(2026, 4)

      expect(items[0].categoryName).toBe('Subscriptions')
      expect(items[0].categoryColor).toBe('#c084fc')
    })

    it('sorts results by expectedDay ascending', async () => {
      await patternRepo.upsert({ description: 'Gym', typicalDay: 28, typicalAmount: -49, categoryId: null })
      await patternRepo.upsert({ description: 'Netflix', typicalDay: 15, typicalAmount: -17.99, categoryId: null })
      await patternRepo.upsert({ description: 'Tax', typicalDay: 20, typicalAmount: -320, categoryId: null })

      const items = await service.getUpcoming(2026, 4)

      expect(items.map(i => i.expectedDay)).toEqual([15, 20, 28])
    })
  })

  // ── getDailyTotals ───────────────────────────────────────────────
  describe('getDailyTotals', () => {
    it('returns cumulative daily spend for 3 months', async () => {
      await saveTx('A', '2026-04-01', -100)
      await saveTx('B', '2026-04-05', -200)

      const result = await service.getDailyTotals(2026, 4)

      expect(result).toHaveLength(3)
      const apr = result.find(s => s.month === 4 && s.year === 2026)!
      expect(apr.label).toBe('Apr')
      const day1 = apr.days.find(d => d.day === 1)!
      const day5 = apr.days.find(d => d.day === 5)!
      expect(day1.cumulative).toBe(100)
      expect(day5.cumulative).toBe(300)
    })

    it('returns 0 cumulative for months with no transactions', async () => {
      const result = await service.getDailyTotals(2026, 4)
      expect(result).toHaveLength(3)
      result.forEach(s => s.days.forEach(d => expect(d.cumulative).toBe(0)))
    })

    it('wraps correctly across year boundary (January)', async () => {
      const result = await service.getDailyTotals(2026, 1)
      expect(result[0]).toMatchObject({ year: 2025, month: 11, label: 'Nov' })
      expect(result[2]).toMatchObject({ year: 2026, month: 1, label: 'Jan' })
    })
  })

  // ── dismissPattern ───────────────────────────────────────────────
  describe('dismissPattern', () => {
    it('sets the pattern active=false', async () => {
      const p = await patternRepo.upsert({ description: 'Netflix', typicalDay: 15, typicalAmount: -17.99, categoryId: null })

      await service.dismissPattern(p.id)

      const active = await patternRepo.findAllActive()
      expect(active).toHaveLength(0)
    })
  })
})
