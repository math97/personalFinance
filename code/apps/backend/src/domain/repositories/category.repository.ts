import { CategoryEntity } from '../entities/category.entity'
import { CategoryRuleEntity } from '../entities/category-rule.entity'

export abstract class CategoryRepository {
  abstract findAll(): Promise<CategoryEntity[]>
  abstract findById(id: string): Promise<CategoryEntity | null>
  abstract findAllRules(): Promise<CategoryRuleEntity[]>
  abstract save(entity: CategoryEntity): Promise<CategoryEntity>
  abstract update(
    id: string,
    data: Partial<{ name: string; color: string; monthlyBudget: number | null }>,
  ): Promise<CategoryEntity>
  abstract delete(id: string): Promise<void>
  abstract addRule(categoryId: string, keyword: string): Promise<CategoryRuleEntity>
  abstract deleteRule(ruleId: string): Promise<void>
}
