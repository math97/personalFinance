import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { ImportBatchRepository, CreateImportedTxData, UpdateImportedTxData } from '../../../domain/repositories/import-batch.repository'
import { ImportBatchEntity, BatchStatus } from '../../../domain/entities/import-batch.entity'
import { ImportedTransactionEntity } from '../../../domain/entities/imported-transaction.entity'
import { ImportBatchMapper } from './import-batch.mapper'

@Injectable()
export class PrismaImportBatchRepository extends ImportBatchRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async findAllReviewing(): Promise<ImportBatchEntity[]> {
    const rows = await this.prisma.importBatch.findMany({
      where: { status: 'reviewing' },
      orderBy: { uploadedAt: 'desc' },
      include: { _count: { select: { imported: true } } },
    })
    return rows.map(ImportBatchMapper.batchToDomain)
  }

  async findById(id: string): Promise<ImportBatchEntity | null> {
    const p = await this.prisma.importBatch.findUnique({
      where: { id },
      include: {
        imported: { orderBy: { rawDate: 'asc' }, include: { aiCategory: true } },
      },
    })
    return p ? ImportBatchMapper.batchToDomain(p) : null
  }

  async createBatch(filename: string): Promise<ImportBatchEntity> {
    const p = await this.prisma.importBatch.create({
      data: { filename, status: 'processing' },
      include: { _count: { select: { imported: true } } },
    })
    return ImportBatchMapper.batchToDomain(p)
  }

  async updateStatus(id: string, status: BatchStatus): Promise<void> {
    await this.prisma.importBatch.update({ where: { id }, data: { status } })
  }

  async createImportedTransactions(items: CreateImportedTxData[]): Promise<void> {
    await this.prisma.importedTransaction.createMany({ data: items })
  }

  async updateImportedTransaction(id: string, data: UpdateImportedTxData): Promise<ImportedTransactionEntity> {
    const p = await this.prisma.importedTransaction.update({
      where: { id },
      data: {
        ...(data.rawDate && { rawDate: data.rawDate }),
        ...(data.rawDescription && { rawDescription: data.rawDescription }),
        ...(data.rawAmount !== undefined && { rawAmount: data.rawAmount }),
        ...(data.aiCategoryId !== undefined && {
          aiCategoryId: data.aiCategoryId,
          aiCategorized: data.aiCategoryId !== null,
        }),
      },
      include: { aiCategory: true },
    })
    return ImportBatchMapper.importedToDomain(p)
  }

  async promoteToTransaction(importedId: string, transactionId: string): Promise<void> {
    await this.prisma.importedTransaction.update({
      where: { id: importedId },
      data: { transactionId },
    })
  }

  async countReviewing(): Promise<number> {
    return this.prisma.importedTransaction.count({
      where: { batch: { status: 'reviewing' } },
    })
  }

  async delete(id: string): Promise<void> {
    await this.prisma.importBatch.delete({ where: { id } })
  }

  async deleteImportedTransaction(id: string): Promise<void> {
    await this.prisma.importedTransaction.delete({ where: { id } })
  }
}
