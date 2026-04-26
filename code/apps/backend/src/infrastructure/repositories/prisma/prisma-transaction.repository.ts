import { Injectable, NotFoundException } from '@nestjs/common'
import { startOfMonth, endOfMonth } from 'date-fns'
import { PrismaService } from '../../../prisma/prisma.service'
import {
  TransactionRepository,
  TransactionFilters,
  PaginatedResult,
  CategorySpending,
} from '../../../domain/repositories/transaction.repository'
import { TransactionEntity } from '../../../domain/entities/transaction.entity'
import { TransactionMapper } from './transaction.mapper'

@Injectable()
export class PrismaTransactionRepository extends TransactionRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async findById(id: string): Promise<TransactionEntity | null> {
    const p = await this.prisma.transaction.findUnique({
      where: { id },
      include: { category: true },
    })
    return p ? TransactionMapper.toDomain(p) : null
  }

  async findAll(filters: TransactionFilters): Promise<PaginatedResult<TransactionEntity>> {
    const page    = filters.page    ?? 1
    const perPage = filters.perPage ?? 10

    const where: any = {}

    if (filters.year !== undefined && filters.month !== undefined) {
      where.date = {
        gte: startOfMonth(new Date(filters.year, filters.month - 1)),
        lte: endOfMonth(new Date(filters.year, filters.month - 1)),
      }
    }

    if (filters.search) {
      where.description = { contains: filters.search, mode: 'insensitive' }
    }
    if (filters.categoryId) {
      where.categoryId = filters.categoryId
    }

    const [rows, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip:  (page - 1) * perPage,
        take:  perPage,
        include: { category: true },
      }),
      this.prisma.transaction.count({ where }),
    ])

    return {
      items: rows.map(TransactionMapper.toDomain),
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    }
  }

  async save(entity: TransactionEntity): Promise<TransactionEntity> {
    const p = await this.prisma.transaction.create({
      data: {
        // id omitted — Prisma generates via @default(cuid())
        amount: entity.amount,
        date: entity.date,
        description: entity.description,
        source: entity.source,
        categoryId: entity.categoryId,
        merchant: entity.merchant,
        account: entity.account,
      },
      include: { category: true },
    })
    return TransactionMapper.toDomain(p)
  }

  async update(
    id: string,
    data: Partial<Pick<TransactionEntity, 'amount' | 'date' | 'description' | 'categoryId'>>,
  ): Promise<TransactionEntity> {
    const p = await this.prisma.transaction.update({
      where: { id },
      data: {
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.date && { date: data.date }),
        ...(data.description && { description: data.description }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
      },
      include: { category: true },
    })
    return TransactionMapper.toDomain(p)
  }

  async delete(id: string): Promise<void> {
    await this.prisma.transaction.delete({ where: { id } })
  }

  async groupByCategory(year: number, month: number): Promise<CategorySpending[]> {
    const start = startOfMonth(new Date(year, month - 1))
    const end = endOfMonth(new Date(year, month - 1))

    const grouped = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { date: { gte: start, lte: end }, amount: { lt: 0 } },
      _sum: { amount: true },
    })

    return grouped.map(row => ({
      categoryId: row.categoryId ?? null,
      total: Math.abs(Number(row._sum.amount ?? 0)),
    }))
  }

  async monthlyTotal(year: number, month: number): Promise<number> {
    const start = startOfMonth(new Date(year, month - 1))
    const end = endOfMonth(new Date(year, month - 1))
    const agg = await this.prisma.transaction.aggregate({
      where: { date: { gte: start, lte: end }, amount: { lt: 0 } },
      _sum: { amount: true },
    })
    return Math.abs(Number(agg._sum.amount ?? 0))
  }

  async monthlyIncome(year: number, month: number): Promise<number> {
    const start = startOfMonth(new Date(year, month - 1))
    const end = endOfMonth(new Date(year, month - 1))
    const agg = await this.prisma.transaction.aggregate({
      where: { date: { gte: start, lte: end }, amount: { gt: 0 } },
      _sum: { amount: true },
    })
    return Number(agg._sum.amount ?? 0)
  }

  async countByMonth(year: number, month: number): Promise<number> {
    const start = startOfMonth(new Date(year, month - 1))
    const end = endOfMonth(new Date(year, month - 1))
    return this.prisma.transaction.count({
      where: { date: { gte: start, lte: end } },
    })
  }

  async dailyTotals(year: number, month: number): Promise<{ day: number; total: number }[]> {
    const start = startOfMonth(new Date(year, month - 1))
    const end = endOfMonth(new Date(year, month - 1))
    const rows = await this.prisma.transaction.findMany({
      where: { date: { gte: start, lte: end }, amount: { lt: 0 } },
      select: { date: true, amount: true },
    })
    const map = new Map<number, number>()
    for (const row of rows) {
      const day = new Date(row.date).getDate()
      map.set(day, (map.get(day) ?? 0) + Math.abs(Number(row.amount)))
    }
    return [...map.entries()].map(([day, total]) => ({ day, total })).sort((a, b) => a.day - b.day)
  }

  async findAllExpensesByDateRange(start: Date, end: Date): Promise<TransactionEntity[]> {
    const rows = await this.prisma.transaction.findMany({
      where: { date: { gte: start, lte: end }, amount: { lt: 0 } },
      include: { category: true },
      orderBy: { date: 'asc' },
    })
    return rows.map(TransactionMapper.toDomain)
  }

  async bulkUpdateCategory(ids: string[], categoryId: string | null): Promise<number> {
    if (ids.length === 0) return 0
    const result = await this.prisma.transaction.updateMany({
      where: { id: { in: ids } },
      data:  { categoryId },
    })
    return result.count
  }
}
