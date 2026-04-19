import { TransactionEntity } from '../../../domain/entities/transaction.entity'

export class TransactionMapper {
  static toDomain(p: any): TransactionEntity {
    return new TransactionEntity(
      p.id,
      Number(p.amount),
      p.date,
      p.description,
      p.source,
      p.categoryId ?? null,
      p.category
        ? { id: p.category.id, name: p.category.name, color: p.category.color }
        : null,
      p.merchant ?? null,
      p.account ?? null,
      p.createdAt,
    )
  }
}
