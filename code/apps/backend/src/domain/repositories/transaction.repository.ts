import { TransactionEntity } from '../entities/transaction.entity'

export interface TransactionFilters {
  year?: number
  month?: number
  search?: string
  categoryId?: string
  page?: number
  perPage?: number
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

export interface CategorySpending {
  categoryId: string | null
  total: number
}

export abstract class TransactionRepository {
  abstract findById(id: string): Promise<TransactionEntity | null>
  abstract findAll(filters: TransactionFilters): Promise<PaginatedResult<TransactionEntity>>
  abstract save(entity: TransactionEntity): Promise<TransactionEntity>
  abstract update(
    id: string,
    data: Partial<Pick<TransactionEntity, 'amount' | 'date' | 'description' | 'categoryId'>>,
  ): Promise<TransactionEntity>
  abstract delete(id: string): Promise<void>
  abstract groupByCategory(year: number, month: number): Promise<CategorySpending[]>
  abstract monthlyTotal(year: number, month: number): Promise<number>
  abstract monthlyIncome(year: number, month: number): Promise<number>
  abstract countByMonth(year: number, month: number): Promise<number>
}
