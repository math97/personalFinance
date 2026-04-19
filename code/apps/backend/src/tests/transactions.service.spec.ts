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

  describe('create', () => {
    it('saves and returns the new transaction', async () => {
      const dto: CreateTransactionDto = {
        amount: -34.20,
        date: '2026-04-18',
        description: 'Tesco Metro',
        source: 'manual',
      }
      const result = await service.create(dto)

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
  })

  describe('findOne', () => {
    it('returns the transaction by id', async () => {
      const created = await service.create({ amount: -10, date: '2026-04-01', description: 'Test', source: 'manual' })
      const found = await service.findOne(created.id)
      expect(found.id).toBe(created.id)
    })

    it('throws NotFoundException when not found', async () => {
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException)
    })
  })

  describe('update', () => {
    it('updates description and returns updated entity', async () => {
      const created = await service.create({ amount: -10, date: '2026-04-01', description: 'Old', source: 'manual' })
      const updated = await service.update(created.id, { description: 'New' })
      expect(updated.description).toBe('New')
    })

    it('throws NotFoundException when updating nonexistent transaction', async () => {
      await expect(service.update('nonexistent', { description: 'x' })).rejects.toThrow(NotFoundException)
    })
  })

  describe('remove', () => {
    it('deletes the transaction', async () => {
      const created = await service.create({ amount: -10, date: '2026-04-01', description: 'Test', source: 'manual' })
      await service.remove(created.id)
      expect(repo.store.size).toBe(0)
    })
  })

  describe('findAll', () => {
    it('returns paginated results filtered by month', async () => {
      await service.create({ amount: -10, date: '2026-04-01', description: 'April tx', source: 'manual' })
      await service.create({ amount: -20, date: '2026-03-01', description: 'March tx', source: 'manual' })

      const result = await service.findAll({ year: '2026', month: '4' } as any)
      expect(result.total).toBe(1)
      expect(result.items[0].description).toBe('April tx')
    })

    it('returns empty when no transactions match month', async () => {
      await service.create({ amount: -10, date: '2026-04-01', description: 'April tx', source: 'manual' })
      const result = await service.findAll({ year: '2026', month: '3' } as any)
      expect(result.total).toBe(0)
    })
  })
})
