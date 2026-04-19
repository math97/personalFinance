import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { ImportService } from '../modules/import/import.service'
import { ImportBatchRepository } from '../domain/repositories/import-batch.repository'
import { CategoryRepository } from '../domain/repositories/category.repository'
import { TransactionRepository } from '../domain/repositories/transaction.repository'
import { CategorizationDomainService, AICategorizationPort } from '../domain/services/categorization.domain-service'
import { ClaudeService } from '../lib/claude.service'
import { InMemoryImportBatchRepository } from '../infrastructure/repositories/in-memory/in-memory-import-batch.repository'
import { InMemoryCategoryRepository } from '../infrastructure/repositories/in-memory/in-memory-category.repository'
import { InMemoryTransactionRepository } from '../infrastructure/repositories/in-memory/in-memory-transaction.repository'

function makeFile(mimetype: string): Express.Multer.File {
  return { originalname: 'statement.pdf', mimetype, buffer: Buffer.from('') } as Express.Multer.File
}

describe('ImportService', () => {
  let service: ImportService
  let batchRepo: InMemoryImportBatchRepository
  let txRepo: InMemoryTransactionRepository
  let claudeMock: { extractTransactions: jest.Mock }

  beforeEach(async () => {
    batchRepo = new InMemoryImportBatchRepository()
    const categoryRepo = new InMemoryCategoryRepository()
    txRepo = new InMemoryTransactionRepository()
    claudeMock = { extractTransactions: jest.fn() }

    const aiPort: AICategorizationPort = { suggestCategory: jest.fn().mockResolvedValue(null) }
    const categorization = new CategorizationDomainService(aiPort)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportService,
        { provide: ImportBatchRepository, useValue: batchRepo },
        { provide: CategoryRepository, useValue: categoryRepo },
        { provide: TransactionRepository, useValue: txRepo },
        { provide: CategorizationDomainService, useValue: categorization },
        { provide: ClaudeService, useValue: claudeMock },
      ],
    }).compile()

    service = module.get<ImportService>(ImportService)
  })

  describe('uploadAndExtract', () => {
    it('creates batch and returns correct extracted count', async () => {
      claudeMock.extractTransactions.mockResolvedValue([
        { date: '2024-01-15', description: 'TESCO METRO', amount: -12.5 },
        { date: '2024-01-16', description: 'UBER TRIP', amount: -8.0 },
      ])

      const result = await service.uploadAndExtract(makeFile('application/pdf'))

      expect(result.extracted).toBe(2)
      expect(batchRepo.batchStore.size).toBe(1)
      expect(batchRepo.importedStore.size).toBe(2)
    })

    it('sets batch status to reviewing after successful extraction', async () => {
      claudeMock.extractTransactions.mockResolvedValue([
        { date: '2024-01-15', description: 'AMAZON', amount: -20 },
      ])

      const { batchId } = await service.uploadAndExtract(makeFile('application/pdf'))
      const batch = batchRepo.batchStore.get(batchId)!

      expect(batch.status).toBe('reviewing')
    })

    it('rejects unsupported file types', async () => {
      await expect(service.uploadAndExtract(makeFile('text/plain'))).rejects.toThrow(BadRequestException)
    })

    it('discards batch when Claude extraction fails', async () => {
      claudeMock.extractTransactions.mockRejectedValue(new Error('API error'))

      await expect(service.uploadAndExtract(makeFile('application/pdf'))).rejects.toThrow('API error')

      const batch = [...batchRepo.batchStore.values()][0]
      expect(batch.status).toBe('discarded')
    })

    it('accepts image mimetypes', async () => {
      claudeMock.extractTransactions.mockResolvedValue([])

      const result = await service.uploadAndExtract(makeFile('image/jpeg'))
      expect(result.extracted).toBe(0)
    })
  })

  describe('confirmBatch', () => {
    async function uploadBatch() {
      claudeMock.extractTransactions.mockResolvedValue([
        { date: '2024-01-15', description: 'TESCO', amount: -20 },
        { date: '2024-01-16', description: 'NETFLIX', amount: -15 },
      ])
      return service.uploadAndExtract(makeFile('application/pdf'))
    }

    it('promotes imported transactions to real transactions', async () => {
      const { batchId } = await uploadBatch()
      await service.confirmBatch(batchId)

      expect(txRepo.store.size).toBe(2)
    })

    it('sets batch status to confirmed', async () => {
      const { batchId } = await uploadBatch()
      await service.confirmBatch(batchId)

      const batch = batchRepo.batchStore.get(batchId)!
      expect(batch.status).toBe('confirmed')
    })

    it('throws when batch does not exist', async () => {
      await expect(service.confirmBatch('non-existent-id')).rejects.toThrow()
    })
  })

  describe('discardBatch', () => {
    it('removes the batch and its imported transactions', async () => {
      claudeMock.extractTransactions.mockResolvedValue([
        { date: '2024-01-15', description: 'TESCO', amount: -20 },
      ])
      const { batchId } = await service.uploadAndExtract(makeFile('application/pdf'))

      await service.discardBatch(batchId)

      expect(batchRepo.batchStore.has(batchId)).toBe(false)
      expect(batchRepo.importedStore.size).toBe(0)
    })
  })

  describe('findAllBatches', () => {
    it('returns only reviewing batches', async () => {
      claudeMock.extractTransactions.mockResolvedValue([
        { date: '2024-01-15', description: 'TESCO', amount: -20 },
      ])
      const { batchId } = await service.uploadAndExtract(makeFile('application/pdf'))

      const batches = await service.findAllBatches()
      expect(batches).toHaveLength(1)
      expect(batches[0].id).toBe(batchId)

      await service.confirmBatch(batchId)
      const afterConfirm = await service.findAllBatches()
      expect(afterConfirm).toHaveLength(0)
    })
  })
})
