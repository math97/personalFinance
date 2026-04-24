import { CategoryRepository } from '../../../domain/repositories/category.repository'
import { CategoryEntity } from '../../../domain/entities/category.entity'
import { CategoryRuleEntity } from '../../../domain/entities/category-rule.entity'

export class InMemoryCategoryRepository extends CategoryRepository {
  public readonly store = new Map<string, CategoryEntity>()
  private ruleCounter = 0

  async findAll(): Promise<CategoryEntity[]> {
    return [...this.store.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  async findById(id: string): Promise<CategoryEntity | null> {
    return this.store.get(id) ?? null
  }

  async findAllRules(): Promise<CategoryRuleEntity[]> {
    return [...this.store.values()].flatMap(c => c.rules)
  }

  async save(entity: CategoryEntity): Promise<CategoryEntity> {
    const id = entity.id || crypto.randomUUID()
    const persisted = new CategoryEntity(id, entity.name, entity.color, entity.rules, entity.transactionCount, entity.monthlyBudget)
    this.store.set(id, persisted)
    return persisted
  }

  async update(
    id: string,
    data: Partial<{ name: string; color: string; monthlyBudget: number | null }>,
  ): Promise<CategoryEntity> {
    const existing = this.store.get(id)
    if (!existing) throw new Error(`Category ${id} not found`)
    const updated = new CategoryEntity(
      existing.id,
      data.name  ?? existing.name,
      data.color ?? existing.color,
      existing.rules,
      existing.transactionCount,
      data.monthlyBudget !== undefined ? data.monthlyBudget : existing.monthlyBudget,
    )
    this.store.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id)
  }

  async addRule(categoryId: string, keyword: string): Promise<CategoryRuleEntity> {
    const rule = new CategoryRuleEntity(`rule-${++this.ruleCounter}`, categoryId, keyword)
    const cat = this.store.get(categoryId)
    if (cat) this.store.set(categoryId, cat.withRule(rule))
    return rule
  }

  async deleteRule(ruleId: string): Promise<void> {
    for (const [id, cat] of this.store) {
      if (cat.rules.some(r => r.id === ruleId)) {
        this.store.set(id, cat.withoutRule(ruleId))
        return
      }
    }
  }
}
