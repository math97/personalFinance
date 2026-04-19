import { ImportedTransactionEntity } from './imported-transaction.entity'

export type BatchStatus = 'processing' | 'reviewing' | 'confirmed' | 'discarded'

export class ImportBatchEntity {
  constructor(
    public readonly id: string,
    public readonly filename: string,
    public readonly uploadedAt: Date,
    public readonly status: BatchStatus,
    public readonly imported: ImportedTransactionEntity[],
    public readonly importedCount: number,
  ) {}

  isReviewing(): boolean {
    return this.status === 'reviewing'
  }

  isPdf(): boolean {
    return this.filename.toLowerCase().endsWith('.pdf')
  }
}
