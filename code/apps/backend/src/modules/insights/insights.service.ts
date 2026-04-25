import { Injectable } from '@nestjs/common'
import { format, subMonths } from 'date-fns'
import { TransactionRepository } from '../../domain/repositories/transaction.repository'
import { CategoryRepository } from '../../domain/repositories/category.repository'
import { SettingsService } from '../settings/settings.service'

export interface InsightMonth {
  year: number
  month: number
  label: string
  total: number
}

export interface InsightsCategory {
  categoryId: string
  name: string
  color: string
  monthlyBudget: number | null
  months: InsightMonth[]
  delta: number | null
}

@Injectable()
export class InsightsService {
  constructor(
    private readonly txRepo: TransactionRepository,
    private readonly catRepo: CategoryRepository,
    private readonly settings: SettingsService,
  ) {}

  async getCategoryTrends(year: number, month: number): Promise<{ categories: InsightsCategory[] }> {
    const reference = new Date(year, month - 1)
    const monthDates = [
      subMonths(reference, 2),
      subMonths(reference, 1),
      reference,
    ]

    const [s0, s1, s2, categories] = await Promise.all([
      this.txRepo.groupByCategory(monthDates[0].getFullYear(), monthDates[0].getMonth() + 1),
      this.txRepo.groupByCategory(monthDates[1].getFullYear(), monthDates[1].getMonth() + 1),
      this.txRepo.groupByCategory(monthDates[2].getFullYear(), monthDates[2].getMonth() + 1),
      this.catRepo.findAll(),
    ])

    const spendMaps = [s0, s1, s2].map(rows =>
      Object.fromEntries(rows.map(r => [r.categoryId ?? '', r.total]))
    )

    return {
      categories: categories.map(cat => {
        const months: InsightMonth[] = monthDates.map((d, i) => ({
          year:  d.getFullYear(),
          month: d.getMonth() + 1,
          label: format(d, 'MMM'),
          total: spendMaps[i][cat.id] ?? 0,
        }))
        const prev  = months[1].total
        const curr  = months[2].total
        const delta = prev === 0 ? null : Math.round(((curr - prev) / prev) * 100)
        return {
          categoryId:    cat.id,
          name:          cat.name,
          color:         cat.color,
          monthlyBudget: cat.monthlyBudget,
          months,
          delta,
        }
      }),
    }
  }

  async chat(
    message: string,
    context: {
      year: number
      month: number
      categories: Array<{
        name: string
        months: { label: string; total: number }[]
        monthlyBudget: number | null
        delta: number | null
      }>
    },
  ): Promise<{ reply: string }> {
    const contextText = context.categories
      .map(c => {
        const monthStr = c.months.map(m => `${m.label}: £${m.total.toFixed(2)}`).join(', ')
        const budget   = c.monthlyBudget != null ? `Budget: £${c.monthlyBudget}` : 'No budget'
        const delta    = c.delta != null ? `Trend: ${c.delta > 0 ? '+' : ''}${c.delta}%` : ''
        return `${c.name}: ${monthStr}. ${budget}. ${delta}`.trim()
      })
      .join('\n')

    const monthLabel = format(new Date(context.year, context.month - 1), 'MMMM yyyy')
    const systemPrompt = `You are a helpful personal finance assistant. The user is viewing their spending data for ${monthLabel}. Here is their spending breakdown:\n\n${contextText}\n\nAnswer concisely (2-4 sentences). Reference specific numbers from the data when relevant.`

    const ai    = await this.settings.createAIPort()
    const reply = await ai.chat(systemPrompt, message)
    return { reply }
  }
}
