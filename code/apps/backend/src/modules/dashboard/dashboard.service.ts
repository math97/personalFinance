import { Injectable } from '@nestjs/common'
import { subMonths, format } from 'date-fns'
import { TransactionRepository } from '../../domain/repositories/transaction.repository'
import { CategoryRepository } from '../../domain/repositories/category.repository'
import { ImportBatchRepository } from '../../domain/repositories/import-batch.repository'

@Injectable()
export class DashboardService {
  constructor(
    private readonly txRepo: TransactionRepository,
    private readonly catRepo: CategoryRepository,
    private readonly batchRepo: ImportBatchRepository,
  ) {}

  async getSpendingByCategory(year: number, month: number) {
    const [grouped, categories] = await Promise.all([
      this.txRepo.groupByCategory(year, month),
      this.catRepo.findAll(),
    ])

    const catMap = Object.fromEntries(categories.map(c => [c.id, c]))

    return grouped
      .map(row => ({
        categoryId: row.categoryId,
        name:  row.categoryId ? (catMap[row.categoryId]?.name  ?? 'Uncategorized') : 'Uncategorized',
        color: row.categoryId ? (catMap[row.categoryId]?.color ?? '#6b7280')       : '#6b7280',
        total: row.total,
      }))
      .sort((a, b) => b.total - a.total)
  }

  async getMonthlyTotals(year: number, month: number, months = 4) {
    const reference = new Date(year, month - 1)
    const results = []

    for (let i = months - 1; i >= 0; i--) {
      const d = subMonths(reference, i)
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      results.push({
        label: format(d, 'MMM'),
        year: y,
        month: m,
        total: await this.txRepo.monthlyTotal(y, m),
      })
    }

    return results
  }

  async getSummaryCards(year: number, month: number) {
    const [totalSpent, totalIncome, transactionCount, inboxCount, byCategory] = await Promise.all([
      this.txRepo.monthlyTotal(year, month),
      this.txRepo.monthlyIncome(year, month),
      this.txRepo.countByMonth(year, month),
      this.batchRepo.countReviewing(),
      this.getSpendingByCategory(year, month),
    ])

    return {
      totalSpent,
      totalIncome,
      transactionCount,
      inboxCount,
      biggestCategory: byCategory[0] ?? null,
    }
  }

  async getSummary(year: number, month: number) {
    const [summary, byCategory, monthlyTotals] = await Promise.all([
      this.getSummaryCards(year, month),
      this.getSpendingByCategory(year, month),
      this.getMonthlyTotals(year, month, 4),
    ])
    return { summary, byCategory, monthlyTotals }
  }
}
