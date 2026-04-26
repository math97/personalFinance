import { startOfMonth, endOfMonth } from 'date-fns'
import { TransactionRepository, TransactionFilters, PaginatedResult, CategorySpending } from '../../../domain/repositories/transaction.repository'
import { TransactionEntity } from '../../../domain/entities/transaction.entity'

export class InMemoryTransactionRepository extends TransactionRepository {
  public readonly store = new Map<string, TransactionEntity>()

  async findById(id: string): Promise<TransactionEntity | null> {
    return this.store.get(id) ?? null
  }

  async findAll(filters: TransactionFilters): Promise<PaginatedResult<TransactionEntity>> {
    const page    = filters.page    ?? 1
    const perPage = filters.perPage ?? 10

    let items = [...this.store.values()].filter(tx => {
      if (filters.year !== undefined && filters.month !== undefined) {
        const start = startOfMonth(new Date(filters.year, filters.month - 1))
        const end   = endOfMonth(new Date(filters.year, filters.month - 1))
        if (tx.date < start || tx.date > end) return false
      }
      if (filters.search && !tx.description.toLowerCase().includes(filters.search.toLowerCase())) return false
      if (filters.categoryId && tx.categoryId !== filters.categoryId) return false
      return true
    })

    items.sort((a, b) => b.date.getTime() - a.date.getTime())

    const total     = items.length
    const paginated = items.slice((page - 1) * perPage, page * perPage)
    return { items: paginated, total, page, perPage, totalPages: Math.ceil(total / perPage) }
  }

  async save(entity: TransactionEntity): Promise<TransactionEntity> {
    const id = entity.id || crypto.randomUUID()
    const persisted = new TransactionEntity(
      id, entity.amount, entity.date, entity.description,
      entity.source, entity.categoryId, entity.category,
      entity.merchant, entity.account, entity.createdAt,
    )
    this.store.set(id, persisted)
    return persisted
  }

  async update(id: string, data: Partial<Pick<TransactionEntity, 'amount' | 'date' | 'description' | 'categoryId'>>): Promise<TransactionEntity> {
    const existing = this.store.get(id)
    if (!existing) throw new Error(`Transaction ${id} not found`)
    const updated = new TransactionEntity(
      existing.id,
      data.amount ?? existing.amount,
      data.date ?? existing.date,
      data.description ?? existing.description,
      existing.source,
      data.categoryId !== undefined ? data.categoryId : existing.categoryId,
      existing.category,
      existing.merchant,
      existing.account,
      existing.createdAt,
    )
    this.store.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id)
  }

  async groupByCategory(year: number, month: number): Promise<CategorySpending[]> {
    const start = startOfMonth(new Date(year, month - 1))
    const end = endOfMonth(new Date(year, month - 1))
    const map = new Map<string | null, number>()

    for (const tx of this.store.values()) {
      if (tx.date < start || tx.date > end || tx.amount >= 0) continue
      const key = tx.categoryId
      map.set(key, (map.get(key) ?? 0) + Math.abs(tx.amount))
    }

    return [...map.entries()].map(([categoryId, total]) => ({ categoryId, total }))
  }

  async monthlyTotal(year: number, month: number): Promise<number> {
    const start = startOfMonth(new Date(year, month - 1))
    const end = endOfMonth(new Date(year, month - 1))
    return [...this.store.values()]
      .filter(tx => tx.date >= start && tx.date <= end && tx.amount < 0)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
  }

  async monthlyIncome(year: number, month: number): Promise<number> {
    const start = startOfMonth(new Date(year, month - 1))
    const end = endOfMonth(new Date(year, month - 1))
    return [...this.store.values()]
      .filter(tx => tx.date >= start && tx.date <= end && tx.amount > 0)
      .reduce((sum, tx) => sum + tx.amount, 0)
  }

  async countByMonth(year: number, month: number): Promise<number> {
    const start = startOfMonth(new Date(year, month - 1))
    const end = endOfMonth(new Date(year, month - 1))
    return [...this.store.values()].filter(tx => tx.date >= start && tx.date <= end).length
  }

  async dailyTotals(year: number, month: number): Promise<{ day: number; total: number }[]> {
    const start = startOfMonth(new Date(year, month - 1))
    const end = endOfMonth(new Date(year, month - 1))
    const map = new Map<number, number>()
    for (const tx of this.store.values()) {
      if (tx.date < start || tx.date > end || tx.amount >= 0) continue
      const day = tx.date.getDate()
      map.set(day, (map.get(day) ?? 0) + Math.abs(tx.amount))
    }
    return [...map.entries()].map(([day, total]) => ({ day, total })).sort((a, b) => a.day - b.day)
  }

  async findAllExpensesByDateRange(start: Date, end: Date): Promise<TransactionEntity[]> {
    return [...this.store.values()]
      .filter(tx => tx.date >= start && tx.date <= end && tx.amount < 0)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
  }

  async bulkUpdateCategory(ids: string[], categoryId: string | null): Promise<number> {
    if (ids.length === 0) return 0
    let count = 0
    for (const id of ids) {
      const existing = this.store.get(id)
      if (!existing) continue
      this.store.set(id, new TransactionEntity(
        existing.id, existing.amount, existing.date, existing.description,
        existing.source, categoryId, null,
        existing.merchant, existing.account, existing.createdAt,
      ))
      count++
    }
    return count
  }
}
