import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { TransactionRepository } from '../../domain/repositories/transaction.repository'
import { TransactionEntity } from '../../domain/entities/transaction.entity'
import { CreateTransactionDto } from './dto/create-transaction.dto'
import { TransactionQueryDto } from './dto/transaction-query.dto'

@Injectable()
export class TransactionsService {
  constructor(private readonly repo: TransactionRepository) {}

  async create(dto: CreateTransactionDto) {
    // id is empty string — Prisma ignores it (uses @default(cuid())); in-memory generates one
    const entity = new TransactionEntity(
      '',
      dto.amount,
      new Date(dto.date),
      dto.description,
      dto.source ?? 'manual',
      dto.categoryId ?? null,
      null,
      dto.merchant ?? null,
      dto.account ?? null,
      new Date(),
    )
    return this.repo.save(entity)
  }

  async findAll(query: TransactionQueryDto) {
    return this.repo.findAll({
      year:       query.year       ? Number(query.year)    : undefined,
      month:      query.month      ? Number(query.month)   : undefined,
      page:       query.page       ? Number(query.page)    : undefined,
      perPage:    query.perPage    ? Number(query.perPage) : undefined,
      search:     query.search,
      categoryId: query.categoryId,
    })
  }

  async exportCsv(query: TransactionQueryDto, scope: 'filtered' | 'month'): Promise<string> {
    const filters: any = { perPage: 999999, page: 1 }

    if (scope === 'month' && (!query.year || !query.month)) {
      throw new BadRequestException('year and month are required for scope=month')
    }

    if (query.year)  filters.year  = Number(query.year)
    if (query.month) filters.month = Number(query.month)

    if (scope === 'filtered') {
      if (query.search)     filters.search     = query.search
      if (query.categoryId) filters.categoryId = query.categoryId
    }

    const { items } = await this.repo.findAll(filters)
    const sorted = [...items].sort((a, b) => a.date.getTime() - b.date.getTime())

    const header = 'date,description,category,amount'
    const rows = sorted.map(tx => {
      const date        = tx.date.toISOString().slice(0, 10)
      const description = `"${tx.description.replace(/"/g, '""')}"`
      const category    = tx.category?.name ? `"${tx.category.name.replace(/"/g, '""')}"` : ''
      return `${date},${description},${category},${tx.amount}`
    })

    return [header, ...rows].join('\n')
  }

  async findOne(id: string) {
    const tx = await this.repo.findById(id)
    if (!tx) throw new NotFoundException(`Transaction ${id} not found`)
    return tx
  }

  async update(id: string, dto: Partial<CreateTransactionDto>) {
    await this.findOne(id)
    return this.repo.update(id, {
      ...(dto.amount      !== undefined && { amount:      dto.amount             }),
      ...(dto.date                      && { date:        new Date(dto.date)     }),
      ...(dto.description               && { description: dto.description        }),
      ...(dto.categoryId  !== undefined && { categoryId:  dto.categoryId ?? null }),
    })
  }

  async remove(id: string) {
    await this.findOne(id)
    return this.repo.delete(id)
  }
}
