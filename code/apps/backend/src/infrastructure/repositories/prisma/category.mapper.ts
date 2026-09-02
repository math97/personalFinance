import { CategoryEntity } from '../../../domain/entities/category.entity'
import { CategoryRuleEntity } from '../../../domain/entities/category-rule.entity'

export class CategoryMapper {
  static toDomain(p: any): CategoryEntity {
    return new CategoryEntity(
      p.id,
      p.name,
      p.color,
      (p.rules ?? []).map((r: any) => new CategoryRuleEntity(r.id, r.categoryId, r.keyword)),
      p._count?.transactions ?? 0,
      p.monthlyBudget != null ? Number(p.monthlyBudget) : null,
    )
  }

  static ruleToEntity(r: any): CategoryRuleEntity {
    return new CategoryRuleEntity(r.id, r.categoryId, r.keyword)
  }
}
