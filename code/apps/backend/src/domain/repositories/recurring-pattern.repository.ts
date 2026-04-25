import { RecurringPatternEntity } from '../entities/recurring-pattern.entity'

export interface UpsertPatternData {
  description: string
  typicalDay: number
  typicalAmount: number
  categoryId: string | null
}

export abstract class RecurringPatternRepository {
  abstract findAll(): Promise<RecurringPatternEntity[]>
  abstract findAllActive(): Promise<RecurringPatternEntity[]>
  abstract findByDescription(description: string): Promise<RecurringPatternEntity | null>
  abstract upsert(data: UpsertPatternData): Promise<RecurringPatternEntity>
  abstract setActive(id: string, active: boolean): Promise<void>
}
