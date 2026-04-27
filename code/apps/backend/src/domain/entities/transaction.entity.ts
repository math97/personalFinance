export type TransactionSource = 'manual' | 'pdf' | 'photo' | 'csv'

export interface CategoryRef {
  id: string
  name: string
  color: string
}

export interface CreateTransactionData {
  amount: number
  date: Date
  description: string
  source?: TransactionSource
  categoryId?: string | null
  merchant?: string | null
  account?: string | null
  notes?: string | null
}

export class TransactionEntity {
  constructor(
    public readonly id: string,
    public readonly amount: number,
    public readonly date: Date,
    public readonly description: string,
    public readonly source: TransactionSource,
    public readonly categoryId: string | null,
    public readonly category: CategoryRef | null,
    public readonly merchant: string | null,
    public readonly account: string | null,
    public readonly createdAt: Date,
    public readonly notes: string | null,
  ) {}

  static fromData(data: CreateTransactionData): Omit<TransactionEntity, 'id' | 'createdAt'> {
    return {
      amount: data.amount,
      date: data.date,
      description: data.description,
      source: data.source ?? 'manual',
      categoryId: data.categoryId ?? null,
      category: null,
      merchant: data.merchant ?? null,
      account: data.account ?? null,
      notes: data.notes ?? null,
    }
  }
}
