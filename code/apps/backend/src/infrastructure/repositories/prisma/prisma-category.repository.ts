import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { CategoryRepository } from '../../../domain/repositories/category.repository'
import { CategoryEntity } from '../../../domain/entities/category.entity'
import { CategoryRuleEntity } from '../../../domain/entities/category-rule.entity'
import { CategoryMapper } from './category.mapper'

@Injectable()
export class PrismaCategoryRepository extends CategoryRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async findAll(): Promise<CategoryEntity[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { rules: true, _count: { select: { transactions: true } } },
    })
    return rows.map(CategoryMapper.toDomain)
  }

  async findById(id: string): Promise<CategoryEntity | null> {
    const p = await this.prisma.category.findUnique({
      where: { id },
      include: { rules: true, _count: { select: { transactions: true } } },
    })
    return p ? CategoryMapper.toDomain(p) : null
  }

  async findAllRules(): Promise<CategoryRuleEntity[]> {
    const rules = await this.prisma.categoryRule.findMany()
    return rules.map(CategoryMapper.ruleToEntity)
  }

  async save(entity: CategoryEntity): Promise<CategoryEntity> {
    const p = await this.prisma.category.create({
      data: { name: entity.name, color: entity.color, monthlyBudget: entity.monthlyBudget ?? null },
      include: { rules: true, _count: { select: { transactions: true } } },
    })
    return CategoryMapper.toDomain(p)
  }

  async update(
    id: string,
    data: Partial<{ name: string; color: string; monthlyBudget: number | null }>,
  ): Promise<CategoryEntity> {
    const p = await this.prisma.category.update({
      where: { id },
      data: {
        ...(data.name          !== undefined && { name:          data.name }),
        ...(data.color         !== undefined && { color:         data.color }),
        ...(data.monthlyBudget !== undefined && { monthlyBudget: data.monthlyBudget }),
      },
      include: { rules: true, _count: { select: { transactions: true } } },
    })
    return CategoryMapper.toDomain(p)
  }

  async delete(id: string): Promise<void> {
    await this.prisma.category.delete({ where: { id } })
  }

  async addRule(categoryId: string, keyword: string): Promise<CategoryRuleEntity> {
    const r = await this.prisma.categoryRule.create({
      data: { categoryId, keyword },
    })
    return CategoryMapper.ruleToEntity(r)
  }

  async deleteRule(ruleId: string): Promise<void> {
    await this.prisma.categoryRule.delete({ where: { id: ruleId } })
  }
}
