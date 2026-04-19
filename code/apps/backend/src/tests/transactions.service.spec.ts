import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { TransactionsService } from '../modules/transactions/transactions.service'
import { TransactionRepository } from '../domain/repositories/transaction.repository'
import { InMemoryTransactionRepository } from '../infrastructure/repositories/in-memory/in-memory-transaction.repository'
import { CreateTransactionDto } from '../modules/transactions/dto/create-transaction.dto'

describe('TransactionsService', () => {
  let service: TransactionsService
  let repo: InMemoryTransactionRepository

  beforeEach(async () => {
    repo = new InMemoryTransactionRepository()
    const module = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: TransactionRepository, useValue: repo },
      ],
    }).compile()
    service = module.get(TransactionsService)
  })

  // ── helpers ──────────────────────────────────────────────────────
  function tx(overrides: Partial<CreateTransactionDto> = {}) {
    return service.create({ amount: -34.20, date: '2026-04-15', description: 'Tesco Metro', source: 'manual', ...overrides })
  }

  // ── create ───────────────────────────────────────────────────────
  describe('create', () => {
    it('saves and returns the new transaction', async () => {
      const result = await tx()
      expect(result.description).toBe('Tesco Metro')
      expect(result.amount).toBe(-34.20)
      expect(result.source).toBe('manual')
      expect(result.id).toBeTruthy()
      expect(repo.store.size).toBe(1)
    })

    it('defaults source to "manual" when not provided', async () => {
      const result = await service.create({ amount: -10, date: '2026-04-01', description: 'Test' } as any)
      expect(result.source).toBe('manual')
    })

    it('saves a positive (income) transaction', async () => {
      const result = await tx({ amount: 3702.85, description: 'Salary' })
      expect(result.amount).toBe(3702.85)
    })

    it('stores the categoryId when provided', async () => {
      const result = await tx({ categoryId: 'cat-123' })
      expect(result.categoryId).toBe('cat-123')
    })

    it('stores null categoryId when not provided', async () => {
      const result = await tx()
      expect(result.categoryId).toBeNull()
    })
  })

  // ── findOne ──────────────────────────────────────────────────────
  describe('findOne', () => {
    it('returns the transaction by id', async () => {
      const created = await tx()
      const found = await service.findOne(created.id)
      expect(found.id).toBe(created.id)
    })

    it('throws NotFoundException when not found', async () => {
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException)
    })
  })

  // ── update ───────────────────────────────────────────────────────
  describe('update', () => {
    it('updates description and returns updated entity', async () => {
      const created = await tx()
      const updated = await service.update(created.id, { description: 'WAITROSE' })
      expect(updated.description).toBe('WAITROSE')
    })

    it('updates amount including sign change to income', async () => {
      const created = await tx({ amount: -50 })
      const updated = await service.update(created.id, { amount: 950 })
      expect(updated.amount).toBe(950)
    })

    it('throws NotFoundException when updating nonexistent transaction', async () => {
      await expect(service.update('nonexistent', { description: 'x' })).rejects.toThrow(NotFoundException)
    })
  })

  // ── remove ───────────────────────────────────────────────────────
  describe('remove', () => {
    it('deletes the transaction', async () => {
      const created = await tx()
      await service.remove(created.id)
      expect(repo.store.size).toBe(0)
    })

    it('throws NotFoundException when deleting nonexistent transaction', async () => {
      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException)
    })
  })

  // ── findAll ──────────────────────────────────────────────────────
  describe('findAll', () => {
    beforeEach(async () => {
      await tx({ date: '2026-04-01', description: 'April A', amount: -10 })
      await tx({ date: '2026-04-15', description: 'April B', amount: -20 })
      await tx({ date: '2026-03-01', description: 'March tx', amount: -30 })
    })

    it('filters by month', async () => {
      const result = await service.findAll({ year: '2026', month: '4' } as any)
      expect(result.total).toBe(2)
      expect(result.items.every(i => i.description.startsWith('April'))).toBe(true)
    })

    it('returns empty when no transactions match month', async () => {
      const result = await service.findAll({ year: '2026', month: '2' } as any)
      expect(result.total).toBe(0)
    })

    it('filters by search (case-insensitive)', async () => {
      const result = await service.findAll({ year: '2026', month: '4', search: 'april b' } as any)
      expect(result.total).toBe(1)
      expect(result.items[0].description).toBe('April B')
    })

    it('filters by categoryId', async () => {
      await tx({ date: '2026-04-10', description: 'Rent', amount: -1500, categoryId: 'cat-rent' })
      const result = await service.findAll({ year: '2026', month: '4', categoryId: 'cat-rent' } as any)
      expect(result.total).toBe(1)
      expect(result.items[0].description).toBe('Rent')
    })

    it('paginates results', async () => {
      const page1 = await service.findAll({ year: '2026', month: '4', page: '1', perPage: '1' } as any)
      expect(page1.items).toHaveLength(1)
      expect(page1.totalPages).toBe(2)

      const page2 = await service.findAll({ year: '2026', month: '4', page: '2', perPage: '1' } as any)
      expect(page2.items).toHaveLength(1)
      expect(page2.items[0].id).not.toBe(page1.items[0].id)
    })

    it('returns results sorted by date descending', async () => {
      const result = await service.findAll({ year: '2026', month: '4' } as any)
      const dates = result.items.map(i => new Date(i.date).getTime())
      expect(dates[0]).toBeGreaterThanOrEqual(dates[1])
    })
  })
})
