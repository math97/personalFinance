import { ImportBatchEntity } from '../entities/import-batch.entity'
import { ImportedTransactionEntity } from '../entities/imported-transaction.entity'
import { BatchStatus } from '../entities/import-batch.entity'

export interface CreateImportedTxData {
  batchId: string
  rawDate: string
  rawDescription: string
  rawAmount: number
  aiCategoryId: string | null
  aiCategorized: boolean
}

export interface UpdateImportedTxData {
  rawDate?: string
  rawDescription?: string
  rawAmount?: number
  aiCategoryId?: string | null
}

export abstract class ImportBatchRepository {
  abstract findAllReviewing(): Promise<ImportBatchEntity[]>
  abstract findById(id: string): Promise<ImportBatchEntity | null>
  abstract createBatch(filename: string): Promise<ImportBatchEntity>
  abstract updateStatus(id: string, status: BatchStatus): Promise<void>
  abstract createImportedTransactions(items: CreateImportedTxData[]): Promise<void>
  abstract updateImportedTransaction(id: string, data: UpdateImportedTxData): Promise<ImportedTransactionEntity>
  abstract promoteToTransaction(importedId: string, transactionId: string): Promise<void>
  abstract countReviewing(): Promise<number>
  abstract deleteImportedTransaction(id: string): Promise<void>
  abstract delete(id: string): Promise<void>
}
