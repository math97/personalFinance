import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException, ConflictException } from '@nestjs/common'
import { ImportService } from '../modules/import/import.service'
import { ImportBatchRepository } from '../domain/repositories/import-batch.repository'
import { CategoryRepository } from '../domain/repositories/category.repository'
import { TransactionRepository } from '../domain/repositories/transaction.repository'
import { SettingsService } from '../modules/settings/settings.service'
import { InMemoryImportBatchRepository } from '../infrastructure/repositories/in-memory/in-memory-import-batch.repository'
import { InMemoryCategoryRepository } from '../infrastructure/repositories/in-memory/in-memory-category.repository'
import { InMemoryTransactionRepository } from '../infrastructure/repositories/in-memory/in-memory-transaction.repository'
import { RecurringService } from '../modules/recurring/recurring.service'

function makeFile(mimetype: string, buffer = Buffer.from('fake')): Express.Multer.File {
  return { originalname: mimetype === 'application/pdf' ? 'statement.pdf' : 'photo.jpg', mimetype, buffer } as Express.Multer.File
}

describe('ImportService', () => {
  let service: ImportService
  let batchRepo: InMemoryImportBatchRepository
  let txRepo: InMemoryTransactionRepository
  let categoryRepo: InMemoryCategoryRepository
  let aiMock: { extractTransactions: ReturnType<typeof vi.fn>; suggestCategory: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    batchRepo = new InMemoryImportBatchRepository()
    categoryRepo = new InMemoryCategoryRepository()
    txRepo = new InMemoryTransactionRepository()
    aiMock = { extractTransactions: vi.fn(), suggestCategory: vi.fn().mockResolvedValue(null) }

    const settingsMock = { createAIPort: vi.fn().mockResolvedValue(aiMock) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportService,
        { provide: ImportBatchRepository, useValue: batchRepo },
        { provide: CategoryRepository,    useValue: categoryRepo },
        { provide: TransactionRepository, useValue: txRepo },
        { provide: SettingsService, useValue: settingsMock },
        { provide: RecurringService, useValue: { detect: vi.fn().mockResolvedValue(undefined) } },
      ],
    }).compile()

    service = module.get<ImportService>(ImportService)
  })

  // ── helpers ──────────────────────────────────────────────────────
  async function uploadPdf(rows = [{ date: '2026-04-15', description: 'TESCO METRO', amount: -12.5 }]) {
    aiMock.extractTransactions.mockResolvedValue(rows)
    return service.uploadAndExtract(makeFile('application/pdf'))
  }

  // ── uploadAndExtract ─────────────────────────────────────────────
  describe('uploadAndExtract', () => {
    it('creates a batch and returns the count of extracted transactions', async () => {
      const result = await uploadPdf([
        { date: '2026-04-15', description: 'TESCO', amount: -12.5 },
        { date: '2026-04-16', description: 'UBER',  amount: -8.0  },
      ])
      expect(result.extracted).toBe(2)
      expect(batchRepo.batchStore.size).toBe(1)
      expect(batchRepo.importedStore.size).toBe(2)
    })

    it('sets batch status to reviewing after extraction', async () => {
      const { batchId } = await uploadPdf()
      expect(batchRepo.batchStore.get(batchId)!.status).toBe('reviewing')
    })

    it('rejects unsupported MIME types', async () => {
      await expect(service.uploadAndExtract(makeFile('text/plain'))).rejects.toThrow(BadRequestException)
    })

    it('accepts image MIME types', async () => {
      aiMock.extractTransactions.mockResolvedValue([])
      const result = await service.uploadAndExtract(makeFile('image/jpeg'))
      expect(result.extracted).toBe(0)
    })

    it('discards the batch when AI extraction fails', async () => {
      // Call directly (not via uploadPdf helper which sets its own mock)
      aiMock.extractTransactions.mockRejectedValue(new Error('API error'))
      await expect(
        service.uploadAndExtract(makeFile('application/pdf'))
      ).rejects.toThrow('API error')
      const batch = [...batchRepo.batchStore.values()][0]
      expect(batch.status).toBe('discarded')
    })

    it('preserves positive amounts (income transactions)', async () => {
      const { batchId } = await uploadPdf([{ date: '2026-04-01', description: 'Salary', amount: 3702.85 }])
      const imported = [...batchRepo.importedStore.values()]
      expect(imported[0].rawAmount).toBe(3702.85)
    })
  })

  // ── confirmBatch ─────────────────────────────────────────────────
  describe('confirmBatch', () => {
    it('promotes all imported transactions to real transactions', async () => {
      const { batchId } = await uploadPdf([
        { date: '2026-04-15', description: 'TESCO',   amount: -20 },
        { date: '2026-04-16', description: 'NETFLIX', amount: -15 },
      ])
      await service.confirmBatch(batchId)
      expect(txRepo.store.size).toBe(2)
    })

    it('sets batch status to confirmed via atomic claim', async () => {
      const { batchId } = await uploadPdf()
      await service.confirmBatch(batchId)
      expect(batchRepo.batchStore.get(batchId)!.status).toBe('confirmed')
    })

    it('tags transactions with source "pdf" for PDF batches', async () => {
      aiMock.extractTransactions.mockResolvedValue([{ date: '2026-04-01', description: 'Test', amount: -10 }])
      const { batchId } = await service.uploadAndExtract(makeFile('application/pdf'))
      await service.confirmBatch(batchId)
      const [tx] = [...txRepo.store.values()]
      expect(tx.source).toBe('pdf')
    })

    it('tags transactions with source "photo" for image batches', async () => {
      aiMock.extractTransactions.mockResolvedValue([{ date: '2026-04-01', description: 'Test', amount: -10 }])
      const { batchId } = await service.uploadAndExtract(makeFile('image/jpeg'))
      await service.confirmBatch(batchId)
      const [tx] = [...txRepo.store.values()]
      expect(tx.source).toBe('photo')
    })

    it('skips already-promoted imported transactions', async () => {
      const { batchId } = await uploadPdf([
        { date: '2026-04-15', description: 'TESCO', amount: -20 },
      ])
      await service.confirmBatch(batchId)
      // manually reset status to reviewing to simulate re-confirm
      await batchRepo.updateStatus(batchId, 'reviewing')
      // tryClaimConfirm will fail since it's now reviewing again — it succeeds
      // but promoted items are skipped
      await service.confirmBatch(batchId)
      expect(txRepo.store.size).toBe(1) // not doubled
    })

    it('throws BadRequestException when batch is already confirmed', async () => {
      const { batchId } = await uploadPdf()
      await service.confirmBatch(batchId)
      // status is now 'confirmed' → isReviewing() is false → BadRequestException
      await expect(service.confirmBatch(batchId)).rejects.toThrow(BadRequestException)
    })

    it('throws ConflictException when tryClaimConfirm loses the race (still reviewing but claim fails)', async () => {
      const { batchId } = await uploadPdf()
      // Simulate the race: status stays 'reviewing' but tryClaimConfirm returns false
      vi.spyOn(batchRepo, 'tryClaimConfirm').mockResolvedValueOnce(false)
      await expect(service.confirmBatch(batchId)).rejects.toThrow(ConflictException)
    })

    it('throws when batch does not exist', async () => {
      await expect(service.confirmBatch('nonexistent')).rejects.toThrow()
    })

    it('preserves positive amounts when promoting income transactions', async () => {
      const { batchId } = await uploadPdf([{ date: '2026-04-01', description: 'Salary', amount: 3702.85 }])
      await service.confirmBatch(batchId)
      const [tx] = [...txRepo.store.values()]
      expect(tx.amount).toBe(3702.85)
    })
  })

  // ── discardBatch ─────────────────────────────────────────────────
  describe('discardBatch', () => {
    it('removes the batch and all its imported transactions', async () => {
      const { batchId } = await uploadPdf([
        { date: '2026-04-15', description: 'TESCO', amount: -20 },
      ])
      await service.discardBatch(batchId)
      expect(batchRepo.batchStore.has(batchId)).toBe(false)
      expect(batchRepo.importedStore.size).toBe(0)
    })
  })

  // ── findAllBatches ───────────────────────────────────────────────
  describe('findAllBatches', () => {
    it('returns only reviewing batches', async () => {
      const { batchId } = await uploadPdf()
      const before = await service.findAllBatches()
      expect(before).toHaveLength(1)
      await service.confirmBatch(batchId)
      const after = await service.findAllBatches()
      expect(after).toHaveLength(0)
    })
  })

  // ── updateImportedTransaction ────────────────────────────────────
  describe('updateImportedTransaction', () => {
    it('updates description of an imported transaction', async () => {
      await uploadPdf([{ date: '2026-04-15', description: 'TESCO', amount: -12.5 }])
      const [item] = [...batchRepo.importedStore.values()]
      const updated = await service.updateImportedTransaction(item.id, { rawDescription: 'TESCO METRO' })
      expect(updated.rawDescription).toBe('TESCO METRO')
    })

    it('updates the amount (e.g. toggling to income)', async () => {
      await uploadPdf([{ date: '2026-04-01', description: 'VENCIMENTO', amount: -3702 }])
      const [item] = [...batchRepo.importedStore.values()]
      const updated = await service.updateImportedTransaction(item.id, { rawAmount: 3702 })
      expect(updated.rawAmount).toBe(3702)
    })
  })

  // ── deleteImportedTransaction ────────────────────────────────────
  describe('deleteImportedTransaction', () => {
    it('removes the imported transaction from the batch', async () => {
      await uploadPdf([
        { date: '2026-04-15', description: 'TESCO', amount: -20 },
        { date: '2026-04-16', description: 'UBER',  amount: -8  },
      ])
      const [first] = [...batchRepo.importedStore.values()]
      await service.deleteImportedTransaction(first.id)
      expect(batchRepo.importedStore.size).toBe(1)
    })
  })

  // ── saveRule ─────────────────────────────────────────────────────
  describe('saveRule', () => {
    it('saves a keyword rule when the imported transaction exists', async () => {
      const cat = await categoryRepo.save({ id: '', name: 'Groceries', color: '#34d399', rules: [], transactionCount: 0 } as any)
      await uploadPdf([{ date: '2026-04-15', description: 'TESCO METRO', amount: -12.5 }])
      const [item] = [...batchRepo.importedStore.values()]

      await service.saveRule(item.id, { keyword: 'tesco', categoryId: cat.id })

      const rules = await categoryRepo.findAllRules()
      expect(rules).toHaveLength(1)
      expect(rules[0].keyword).toBe('tesco')
    })

    it('throws when the imported transaction does not exist', async () => {
      await expect(service.saveRule('nonexistent-id', { keyword: 'tesco', categoryId: 'cat-1' })).rejects.toThrow()
    })
  })
})
