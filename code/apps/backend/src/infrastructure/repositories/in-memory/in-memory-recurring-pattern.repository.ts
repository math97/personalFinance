import { RecurringPatternRepository, UpsertPatternData } from '../../../domain/repositories/recurring-pattern.repository'
import { RecurringPatternEntity } from '../../../domain/entities/recurring-pattern.entity'

export class InMemoryRecurringPatternRepository extends RecurringPatternRepository {
  public readonly store = new Map<string, RecurringPatternEntity>()

  async findAll(): Promise<RecurringPatternEntity[]> {
    return [...this.store.values()].sort((a, b) => a.typicalDay - b.typicalDay)
  }

  async findAllActive(): Promise<RecurringPatternEntity[]> {
    return [...this.store.values()].filter(p => p.active).sort((a, b) => a.typicalDay - b.typicalDay)
  }

  async findByDescription(description: string): Promise<RecurringPatternEntity | null> {
    return [...this.store.values()].find(p => p.description === description) ?? null
  }

  async upsert(data: UpsertPatternData): Promise<RecurringPatternEntity> {
    const existing = [...this.store.values()].find(p => p.description === data.description)
    const now = new Date()
    if (existing) {
      const updated = new RecurringPatternEntity(
        existing.id, data.description, data.typicalDay, data.typicalAmount,
        data.categoryId, existing.categoryName, existing.categoryColor,
        existing.active, existing.createdAt, now,
      )
      this.store.set(existing.id, updated)
      return updated
    }
    const id = crypto.randomUUID()
    const created = new RecurringPatternEntity(
      id, data.description, data.typicalDay, data.typicalAmount,
      data.categoryId, null, null, true, now, now,
    )
    this.store.set(id, created)
    return created
  }

  async setActive(id: string, active: boolean): Promise<void> {
    const existing = this.store.get(id)
    if (!existing) throw new Error(`RecurringPattern ${id} not found`)
    this.store.set(id, new RecurringPatternEntity(
      existing.id, existing.description, existing.typicalDay, existing.typicalAmount,
      existing.categoryId, existing.categoryName, existing.categoryColor,
      active, existing.createdAt, new Date(),
    ))
  }
}
