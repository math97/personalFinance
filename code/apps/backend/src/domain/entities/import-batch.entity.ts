import { ImportedTransactionEntity } from './imported-transaction.entity'

const BATCH_STATUSES = ['processing', 'reviewing', 'confirmed', 'discarded'] as const
export type BatchStatus = (typeof BATCH_STATUSES)[number]

export function assertBatchStatus(value: string): BatchStatus {
  if (!(BATCH_STATUSES as readonly string[]).includes(value)) {
    throw new Error(`Invalid BatchStatus in DB: "${value}"`)
  }
  return value as BatchStatus
}

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
