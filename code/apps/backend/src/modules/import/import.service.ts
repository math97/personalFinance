import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { ImportBatchRepository } from '../../domain/repositories/import-batch.repository'
import { CategoryRepository } from '../../domain/repositories/category.repository'
import { TransactionRepository } from '../../domain/repositories/transaction.repository'
import { CategorizationDomainService } from '../../domain/services/categorization.domain-service'
import { TransactionEntity } from '../../domain/entities/transaction.entity'
import { AIPort } from '../../domain/ports/ai.port'
import { UpdateImportedTransactionDto, SaveRuleDto } from './dto/import.dto'

@Injectable()
export class ImportService {
  constructor(
    private readonly batchRepo: ImportBatchRepository,
    private readonly categoryRepo: CategoryRepository,
    private readonly txRepo: TransactionRepository,
    private readonly categorization: CategorizationDomainService,
    private readonly ai: AIPort,
  ) {}

  findAllBatches() {
    return this.batchRepo.findAllReviewing()
  }

  async findBatch(batchId: string) {
    const batch = await this.batchRepo.findById(batchId)
    if (!batch) throw new NotFoundException(`Batch ${batchId} not found`)
    return batch
  }

  async uploadAndExtract(file: Express.Multer.File) {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp']
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Unsupported file type')
    }

    const batch = await this.batchRepo.createBatch(file.originalname)

    try {
      const extracted = await this.ai.extractTransactions(file.buffer, file.mimetype)
      const [rules, categories] = await Promise.all([
        this.categoryRepo.findAllRules(),
        this.categoryRepo.findAll(),
      ])
      const catList = categories.map(c => ({ id: c.id, name: c.name }))

      const importedData = await Promise.all(
        extracted.map(async t => {
          const result = await this.categorization.categorize(t.description, rules, catList)
          return {
            batchId: batch.id,
            rawDate: t.date,
            rawDescription: t.description,
            rawAmount: t.amount,
            aiCategoryId: result.categoryId,
            aiCategorized: result.aiCategorized,
          }
        }),
      )

      await this.batchRepo.createImportedTransactions(importedData)
      await this.batchRepo.updateStatus(batch.id, 'reviewing')

      return { batchId: batch.id, extracted: importedData.length }
    } catch (err) {
      await this.batchRepo.updateStatus(batch.id, 'discarded')
      throw err
    }
  }

  async updateImportedTransaction(id: string, dto: UpdateImportedTransactionDto) {
    return this.batchRepo.updateImportedTransaction(id, {
      rawDate:        dto.rawDate,
      rawDescription: dto.rawDescription,
      rawAmount:      dto.rawAmount,
      aiCategoryId:   dto.aiCategoryId,
    })
  }

  async confirmBatch(batchId: string) {
    const batch = await this.findBatch(batchId)
    if (!batch.isReviewing()) {
      throw new BadRequestException('Batch is not in reviewing state')
    }

    const source = batch.isPdf() ? 'pdf' : 'photo'

    for (const imp of batch.imported.filter(i => !i.transactionId)) {
      const tx = await this.txRepo.save(
        new TransactionEntity(
          '', Number(imp.rawAmount), new Date(imp.rawDate), imp.rawDescription,
          source, imp.aiCategoryId, null, null, null, new Date(),
        ),
      )
      await this.batchRepo.promoteToTransaction(imp.id, tx.id)
    }

    await this.batchRepo.updateStatus(batchId, 'confirmed')
    return { confirmed: true }
  }

  async discardBatch(batchId: string) {
    await this.findBatch(batchId)
    await this.batchRepo.delete(batchId)
    return { discarded: true }
  }

  async deleteImportedTransaction(id: string) {
    await this.batchRepo.deleteImportedTransaction(id)
    return { deleted: true }
  }

  async saveRule(importedTxId: string, dto: SaveRuleDto) {
    await this.categoryRepo.addRule(dto.categoryId, dto.keyword)
    return this.batchRepo.updateImportedTransaction(importedTxId, {
      aiCategoryId: dto.categoryId,
    })
  }
}
