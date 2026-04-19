import { ImportBatchEntity, BatchStatus } from '../../../domain/entities/import-batch.entity'
import { ImportedTransactionEntity } from '../../../domain/entities/imported-transaction.entity'

export class ImportBatchMapper {
  static importedToDomain(p: any): ImportedTransactionEntity {
    return new ImportedTransactionEntity(
      p.id,
      p.batchId,
      p.rawDate,
      p.rawDescription,
      Number(p.rawAmount),
      p.aiCategoryId ?? null,
      p.aiCategorized,
      p.aiCategory
        ? { id: p.aiCategory.id, name: p.aiCategory.name, color: p.aiCategory.color }
        : null,
      p.transactionId ?? null,
    )
  }

  static batchToDomain(p: any): ImportBatchEntity {
    return new ImportBatchEntity(
      p.id,
      p.filename,
      p.uploadedAt,
      p.status as BatchStatus,
      (p.imported ?? []).map(ImportBatchMapper.importedToDomain),
      p._count?.imported ?? p.imported?.length ?? 0,
    )
  }
}
