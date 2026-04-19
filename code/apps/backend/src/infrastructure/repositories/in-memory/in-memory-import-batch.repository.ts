import { ImportBatchRepository, CreateImportedTxData, UpdateImportedTxData } from '../../../domain/repositories/import-batch.repository'
import { ImportBatchEntity, BatchStatus } from '../../../domain/entities/import-batch.entity'
import { ImportedTransactionEntity } from '../../../domain/entities/imported-transaction.entity'

export class InMemoryImportBatchRepository extends ImportBatchRepository {
  public readonly batchStore = new Map<string, ImportBatchEntity>()
  public readonly importedStore = new Map<string, ImportedTransactionEntity>()
  private counter = 0

  async findAllReviewing(): Promise<ImportBatchEntity[]> {
    return [...this.batchStore.values()].filter(b => b.status === 'reviewing')
  }

  async findById(id: string): Promise<ImportBatchEntity | null> {
    const batch = this.batchStore.get(id)
    if (!batch) return null
    const imported = [...this.importedStore.values()].filter(i => i.batchId === id)
    return new ImportBatchEntity(batch.id, batch.filename, batch.uploadedAt, batch.status, imported, imported.length)
  }

  async createBatch(filename: string): Promise<ImportBatchEntity> {
    const batch = new ImportBatchEntity(`batch-${++this.counter}`, filename, new Date(), 'processing', [], 0)
    this.batchStore.set(batch.id, batch)
    return batch
  }

  async updateStatus(id: string, status: BatchStatus): Promise<void> {
    const batch = this.batchStore.get(id)
    if (!batch) return
    this.batchStore.set(id, new ImportBatchEntity(batch.id, batch.filename, batch.uploadedAt, status, batch.imported, batch.importedCount))
  }

  async createImportedTransactions(items: CreateImportedTxData[]): Promise<void> {
    for (const item of items) {
      const entity = new ImportedTransactionEntity(
        `itx-${++this.counter}`, item.batchId, item.rawDate, item.rawDescription,
        item.rawAmount, item.aiCategoryId, item.aiCategorized, null, null,
      )
      this.importedStore.set(entity.id, entity)
    }
  }

  async updateImportedTransaction(id: string, data: UpdateImportedTxData): Promise<ImportedTransactionEntity> {
    const existing = this.importedStore.get(id)
    if (!existing) throw new Error(`ImportedTransaction ${id} not found`)
    const updated = new ImportedTransactionEntity(
      existing.id, existing.batchId,
      data.rawDate ?? existing.rawDate,
      data.rawDescription ?? existing.rawDescription,
      data.rawAmount ?? existing.rawAmount,
      data.aiCategoryId !== undefined ? data.aiCategoryId : existing.aiCategoryId,
      data.aiCategoryId !== undefined ? data.aiCategoryId !== null : existing.aiCategorized,
      existing.aiCategory, existing.transactionId,
    )
    this.importedStore.set(id, updated)
    return updated
  }

  async promoteToTransaction(importedId: string, transactionId: string): Promise<void> {
    const existing = this.importedStore.get(importedId)
    if (!existing) return
    this.importedStore.set(importedId, new ImportedTransactionEntity(
      existing.id, existing.batchId, existing.rawDate, existing.rawDescription,
      existing.rawAmount, existing.aiCategoryId, existing.aiCategorized,
      existing.aiCategory, transactionId,
    ))
  }

  async countReviewing(): Promise<number> {
    return [...this.importedStore.values()].filter(i => {
      const batch = this.batchStore.get(i.batchId)
      return batch?.status === 'reviewing'
    }).length
  }

  async tryClaimConfirm(batchId: string): Promise<boolean> {
    const batch = this.batchStore.get(batchId)
    if (!batch || batch.status !== 'reviewing') return false
    await this.updateStatus(batchId, 'confirmed')
    return true
  }

  async deleteImportedTransaction(id: string): Promise<void> {
    this.importedStore.delete(id)
  }

  async delete(id: string): Promise<void> {
    this.batchStore.delete(id)
    for (const [key, imp] of this.importedStore) {
      if (imp.batchId === id) this.importedStore.delete(key)
    }
  }
}
