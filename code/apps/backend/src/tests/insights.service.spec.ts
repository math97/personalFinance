import { Test } from '@nestjs/testing'
import { InsightsService } from '../modules/insights/insights.service'
import { TransactionRepository } from '../domain/repositories/transaction.repository'
import { CategoryRepository } from '../domain/repositories/category.repository'
import { InMemoryTransactionRepository } from '../infrastructure/repositories/in-memory/in-memory-transaction.repository'
import { InMemoryCategoryRepository } from '../infrastructure/repositories/in-memory/in-memory-category.repository'
import { TransactionEntity } from '../domain/entities/transaction.entity'
import { CategoryEntity } from '../domain/entities/category.entity'
import { SettingsService } from '../modules/settings/settings.service'
import { AIPort } from '../domain/ports/ai.port'

describe('InsightsService', () => {
  let service: InsightsService
  let txRepo: InMemoryTransactionRepository
  let catRepo: InMemoryCategoryRepository
  let mockAI: AIPort
  let mockSettings: any

  beforeEach(async () => {
    txRepo = new InMemoryTransactionRepository()
    catRepo = new InMemoryCategoryRepository()

    mockAI = {
      extractTransactions: vi.fn(),
      suggestCategory: vi.fn(),
      chat: vi.fn().mockResolvedValue('Groceries went up this month.'),
    } as any

    mockSettings = {
      createAIPort: vi.fn().mockResolvedValue(mockAI),
    }

    const module = await Test.createTestingModule({
      providers: [
        InsightsService,
        { provide: TransactionRepository, useValue: txRepo },
        { provide: CategoryRepository,    useValue: catRepo },
        { provide: SettingsService,       useValue: mockSettings },
      ],
    }).compile()

    service = module.get(InsightsService)
  })

  async function saveCat(name: string, color = '#34d399', monthlyBudget: number | null = null) {
    return catRepo.save(new CategoryEntity('', name, color, [], 0, monthlyBudget))
  }

  async function saveTx(date: string, categoryId: string | null, amount = -100) {
    return txRepo.save(new TransactionEntity(
      '', amount, new Date(date), 'Test', 'manual', categoryId, null, null, null, new Date(), null,
    ))
  }

  // ── getCategoryTrends ────────────────────────────────────────────
  describe('getCategoryTrends', () => {
    it('returns 3 months of data per category', async () => {
      const cat = await saveCat('Groceries')
      await saveTx('2026-02-15', cat.id, -100)
      await saveTx('2026-03-15', cat.id, -200)
      await saveTx('2026-04-15', cat.id, -150)

      const result = await service.getCategoryTrends(2026, 4)

      const row = result.categories.find(c => c.name === 'Groceries')!
      expect(row.months).toHaveLength(3)
      expect(row.months[0]).toMatchObject({ year: 2026, month: 2, label: 'Feb', total: 100 })
      expect(row.months[1]).toMatchObject({ year: 2026, month: 3, label: 'Mar', total: 200 })
      expect(row.months[2]).toMatchObject({ year: 2026, month: 4, label: 'Apr', total: 150 })
    })

    it('returns 0 for months with no transactions', async () => {
      await saveCat('Rent')

      const result = await service.getCategoryTrends(2026, 4)

      const row = result.categories.find(c => c.name === 'Rent')!
      row.months.forEach(m => expect(m.total).toBe(0))
    })

    it('calculates delta as % change from previous to current month', async () => {
      const cat = await saveCat('Transport')
      await saveTx('2026-03-10', cat.id, -100)
      await saveTx('2026-04-10', cat.id, -150)

      const result = await service.getCategoryTrends(2026, 4)

      const row = result.categories.find(c => c.name === 'Transport')!
      expect(row.delta).toBe(50) // (150-100)/100 * 100 = 50%
    })

    it('returns null delta when previous month is zero', async () => {
      const cat = await saveCat('Dining')
      await saveTx('2026-04-10', cat.id, -80)

      const result = await service.getCategoryTrends(2026, 4)

      const row = result.categories.find(c => c.name === 'Dining')!
      expect(row.delta).toBeNull()
    })

    it('includes monthlyBudget from category', async () => {
      await saveCat('Rent', '#818cf8', 1200)

      const result = await service.getCategoryTrends(2026, 4)

      const row = result.categories.find(c => c.name === 'Rent')!
      expect(row.monthlyBudget).toBe(1200)
    })

    it('wraps correctly across year boundary (January)', async () => {
      await saveCat('Groceries')

      const result = await service.getCategoryTrends(2026, 1)

      const row = result.categories[0]
      expect(row.months[0]).toMatchObject({ year: 2025, month: 11, label: 'Nov' })
      expect(row.months[1]).toMatchObject({ year: 2025, month: 12, label: 'Dec' })
      expect(row.months[2]).toMatchObject({ year: 2026, month: 1,  label: 'Jan' })
    })
  })

  // ── chat ─────────────────────────────────────────────────────────
  describe('chat', () => {
    it('returns a reply from the AI', async () => {
      const context = {
        year: 2026, month: 4,
        categories: [{ name: 'Groceries', months: [{ label: 'Apr', total: 100 }], monthlyBudget: null, delta: null }],
      }
      const result = await service.chat('Why did groceries go up?', context)
      expect(result.reply).toBe('Groceries went up this month.')
    })

    it('calls AI with a system prompt that contains the month name', async () => {
      const context = {
        year: 2026, month: 4,
        categories: [{ name: 'Transport', months: [{ label: 'Apr', total: 50 }], monthlyBudget: 100, delta: -20 }],
      }
      await service.chat('How am I doing?', context)
      const [systemPrompt] = (mockAI.chat as any).mock.calls[0]
      expect(systemPrompt).toContain('April 2026')
    })
  })
})
