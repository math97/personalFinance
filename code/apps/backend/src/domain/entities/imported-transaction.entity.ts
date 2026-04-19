import { CategoryRef } from './transaction.entity'

export class ImportedTransactionEntity {
  constructor(
    public readonly id: string,
    public readonly batchId: string,
    public readonly rawDate: string,
    public readonly rawDescription: string,
    public readonly rawAmount: number,
    public readonly aiCategoryId: string | null,
    public readonly aiCategorized: boolean,
    public readonly aiCategory: CategoryRef | null,
    public readonly transactionId: string | null,
  ) {}
}
