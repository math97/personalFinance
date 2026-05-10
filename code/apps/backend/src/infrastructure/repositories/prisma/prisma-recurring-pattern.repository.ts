import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { RecurringPatternRepository, UpsertPatternData } from '../../../domain/repositories/recurring-pattern.repository'
import { RecurringPatternEntity } from '../../../domain/entities/recurring-pattern.entity'

function toEntity(p: any): RecurringPatternEntity {
  return new RecurringPatternEntity(
    p.id,
    p.description,
    p.typicalDay,
    Number(p.typicalAmount),
    p.categoryId ?? null,
    p.category?.name ?? null,
    p.category?.color ?? null,
    p.active,
    p.createdAt,
    p.updatedAt,
  )
}

@Injectable()
export class PrismaRecurringPatternRepository extends RecurringPatternRepository {
  constructor(private readonly prisma: PrismaService) { super() }

  async findAll(): Promise<RecurringPatternEntity[]> {
    const rows = await this.prisma.recurringPattern.findMany({
      include: { category: true },
      orderBy: { typicalDay: 'asc' },
    })
    return rows.map(toEntity)
  }

  async findAllActive(): Promise<RecurringPatternEntity[]> {
    const rows = await this.prisma.recurringPattern.findMany({
      where: { active: true },
      include: { category: true },
      orderBy: { typicalDay: 'asc' },
    })
    return rows.map(toEntity)
  }

  async findByDescription(description: string): Promise<RecurringPatternEntity | null> {
    const row = await this.prisma.recurringPattern.findFirst({
      where: { description: { equals: description, mode: 'insensitive' } },
      include: { category: true },
    })
    return row ? toEntity(row) : null
  }

  async upsert(data: UpsertPatternData): Promise<RecurringPatternEntity> {
    const existing = await this.prisma.recurringPattern.findFirst({
      where: { description: { equals: data.description, mode: 'insensitive' } },
      include: { category: true },
    })

    if (existing) {
      const row = await this.prisma.recurringPattern.update({
        where: { id: existing.id },
        data: {
          typicalDay:    data.typicalDay,
          typicalAmount: data.typicalAmount,
          categoryId:    data.categoryId,
        },
        include: { category: true },
      })
      return toEntity(row)
    }

    const row = await this.prisma.recurringPattern.create({
      data: {
        description:   data.description,
        typicalDay:    data.typicalDay,
        typicalAmount: data.typicalAmount,
        categoryId:    data.categoryId,
      },
      include: { category: true },
    })
    return toEntity(row)
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await this.prisma.recurringPattern.update({ where: { id }, data: { active } })
  }
}
