import { Injectable } from '@nestjs/common'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { TransactionRepository } from '../../domain/repositories/transaction.repository'
import { CategoryRepository } from '../../domain/repositories/category.repository'
import { RecurringPatternRepository } from '../../domain/repositories/recurring-pattern.repository'

export interface UpcomingItem {
  patternId: string
  description: string
  typicalAmount: number
  expectedDay: number
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
}

export interface DailySeriesDay {
  day: number
  cumulative: number
}

export interface DailySeries {
  year: number
  month: number
  label: string
  days: DailySeriesDay[]
}

@Injectable()
export class RecurringService {
  constructor(
    private readonly txRepo: TransactionRepository,
    private readonly catRepo: CategoryRepository,
    private readonly patternRepo: RecurringPatternRepository,
  ) {}

  async detect(): Promise<void> {
    const now = new Date()
    const reference = new Date(now.getFullYear(), now.getMonth())
    const start = startOfMonth(subMonths(reference, 2))
    const end = endOfMonth(reference)

    const txs = await this.txRepo.findAllExpensesByDateRange(start, end)

    const byDesc = new Map<string, typeof txs>()
    for (const tx of txs) {
      const key = tx.description.toLowerCase()
      byDesc.set(key, [...(byDesc.get(key) ?? []), tx])
    }

    const dismissed = new Set<string>()
    for (const p of await this.patternRepo.findAll()) {
      if (!p.active) dismissed.add(p.description.toLowerCase())
    }

    for (const [key, group] of byDesc) {
      if (dismissed.has(key)) continue
      if (group.length < 2) continue

      const months = new Set(group.map(tx => `${tx.date.getFullYear()}-${tx.date.getMonth()}`))
      if (months.size < 2) continue

      const amounts = group.map(tx => Math.abs(tx.amount)).sort((a, b) => a - b)
      const medianAmount = amounts[Math.floor(amounts.length / 2)]

      const days = group.map(tx => tx.date.getDate()).sort((a, b) => a - b)
      const medianDay = days[Math.floor(days.length / 2)]

      if (!amounts.every(a => medianAmount === 0 || Math.abs(a - medianAmount) / medianAmount <= 0.2)) continue
      if (!days.every(d => Math.abs(d - medianDay) <= 5)) continue

      const sorted = [...group].sort((a, b) => b.date.getTime() - a.date.getTime())
      await this.patternRepo.upsert({
        description: sorted[0].description,
        typicalDay: medianDay,
        typicalAmount: -medianAmount,
        categoryId: sorted[0].categoryId,
      })
    }
  }

  async getUpcoming(year: number, month: number): Promise<UpcomingItem[]> {
    const patterns = await this.patternRepo.findAllActive()
    if (patterns.length === 0) return []

    const start = startOfMonth(new Date(year, month - 1))
    const end = endOfMonth(new Date(year, month - 1))
    const txs = await this.txRepo.findAllExpensesByDateRange(start, end)
    const confirmedThisMonth = new Set(txs.map(tx => tx.description.toLowerCase()))

    const categories = await this.catRepo.findAll()
    const catMap = Object.fromEntries(categories.map(c => [c.id, c]))

    return patterns
      .filter(p => !confirmedThisMonth.has(p.description.toLowerCase()))
      .map(p => ({
        patternId: p.id,
        description: p.description,
        typicalAmount: p.typicalAmount,
        expectedDay: p.typicalDay,
        categoryId: p.categoryId,
        categoryName: p.categoryId ? (catMap[p.categoryId]?.name ?? null) : null,
        categoryColor: p.categoryId ? (catMap[p.categoryId]?.color ?? null) : null,
      }))
      .sort((a, b) => a.expectedDay - b.expectedDay)
  }

  async getDailyTotals(year: number, month: number, count = 3): Promise<DailySeries[]> {
    const reference = new Date(year, month - 1)
    const monthDates = Array.from({ length: count }, (_, i) =>
      subMonths(reference, count - 1 - i)
    )

    return Promise.all(monthDates.map(async d => {
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const dailies = await this.txRepo.dailyTotals(y, m)
      const daysInMonth = new Date(y, m, 0).getDate()

      let running = 0
      const days: DailySeriesDay[] = Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1
        running += dailies.find(dd => dd.day === day)?.total ?? 0
        return { day, cumulative: running }
      })

      return { year: y, month: m, label: format(d, 'MMM'), days }
    }))
  }

  async dismissPattern(id: string): Promise<void> {
    await this.patternRepo.setActive(id, false)
  }
}
