import { CategoryRuleEntity } from './category-rule.entity'

export class CategoryEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly color: string,
    public readonly rules: CategoryRuleEntity[],
    public readonly transactionCount: number,
  ) {}

  static create(data: { id: string; name: string; color: string }): CategoryEntity {
    return new CategoryEntity(data.id, data.name, data.color, [], 0)
  }

  withRule(rule: CategoryRuleEntity): CategoryEntity {
    return new CategoryEntity(
      this.id, this.name, this.color,
      [...this.rules, rule],
      this.transactionCount,
    )
  }

  withoutRule(ruleId: string): CategoryEntity {
    return new CategoryEntity(
      this.id, this.name, this.color,
      this.rules.filter(r => r.id !== ruleId),
      this.transactionCount,
    )
  }
}
