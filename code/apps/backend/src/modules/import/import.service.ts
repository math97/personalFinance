import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common'
import { fromBuffer as fileTypeFromBuffer } from 'file-type'
import pLimit from 'p-limit'
import { ImportBatchRepository } from '../../domain/repositories/import-batch.repository'
import { CategoryRepository } from '../../domain/repositories/category.repository'
import { CategorizationDomainService } from '../../domain/services/categorization.domain-service'
import { TransactionEntity } from '../../domain/entities/transaction.entity'
import { SettingsService } from '../settings/settings.service'
import { RecurringService } from '../recurring/recurring.service'
import { CsvParser } from '../../lib/csv-parser'
import { UpdateImportedTransactionDto, SaveRuleDto } from './dto/import.dto'

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name)

  constructor(
    private readonly batchRepo: ImportBatchRepository,
    private readonly categoryRepo: CategoryRepository,
    private readonly settings: SettingsService,
    private readonly recurring: RecurringService,
    private readonly csvParser: CsvParser,
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
    const isCsv = file.originalname.toLowerCase().endsWith('.csv')

    if (!isCsv) {
      const ALLOWED_MIMES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'])
      const detected = await fileTypeFromBuffer(file.buffer)
      const effectiveMime = detected?.mime ?? file.mimetype
      if (!ALLOWED_MIMES.has(effectiveMime)) {
        throw new BadRequestException(`Unsupported file type: ${effectiveMime}`)
      }
    }

    const batch = await this.batchRepo.createBatch(file.originalname)

    try {
      const [rules, categories] = await Promise.all([
        this.categoryRepo.findAllRules(),
        this.categoryRepo.findAll(),
      ])
      const catList = categories.map(c => ({ id: c.id, name: c.name }))

      let extracted: { date: string; description: string; amount: number }[]
      let categorization: CategorizationDomainService | null = null

      if (isCsv) {
        extracted = this.csvParser.parse(file.buffer)
      } else {
        let ai: Awaited<ReturnType<typeof this.settings.createAIPort>>
        try {
          ai = await this.settings.createAIPort()
        } catch {
          throw new BadRequestException(
            'No AI API key configured. Go to Settings and enter your API key before uploading images or PDFs.'
          )
        }
        extracted = await ai.extractTransactions(file.buffer, file.mimetype)
        categorization = new CategorizationDomainService(ai)
      }

      const limit = pLimit(5)
      const importedData = await Promise.all(
        extracted.map(t => limit(async () => {
          let categoryId: string | null = null
          let aiCategorized = false

          if (isCsv) {
            const ruleMatch = rules.find(r =>
              t.description.toLowerCase().includes(r.keyword.toLowerCase())
            )
            categoryId = ruleMatch?.categoryId ?? null
          } else {
            const result = await categorization!.categorize(t.description, rules, catList)
            categoryId = result.categoryId
            aiCategorized = result.aiCategorized
          }

          return {
            batchId: batch.id,
            rawDate: t.date,
            rawDescription: t.description,
            rawAmount: t.amount,
            aiCategoryId: categoryId,
            aiCategorized,
          }
        })),
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

    const claimed = await this.batchRepo.tryClaimConfirm(batchId)
    if (!claimed) {
      throw new ConflictException('Batch was already confirmed')
    }

    const filename = batch.filename.toLowerCase()
    const source = filename.endsWith('.csv') ? 'csv'
                 : batch.isPdf()             ? 'pdf'
                 :                             'photo'

    const toConfirm = batch.imported
      .filter(i => !i.transactionId)
      .map(imp => ({
        importedId: imp.id,
        tx: new TransactionEntity(
          '', Number(imp.rawAmount), new Date(imp.rawDate), imp.rawDescription,
          source, imp.aiCategoryId, null, null, null, new Date(), null,
        ),
      }))

    await this.batchRepo.confirmAll(toConfirm)

    this.recurring.detect().catch(err =>
      this.logger.error('recurring.detect failed', err instanceof Error ? err.stack : String(err))
    )

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
    const updated = await this.batchRepo.updateImportedTransaction(importedTxId, {
      aiCategoryId: dto.categoryId,
    })
    await this.categoryRepo.addRule(dto.categoryId, dto.keyword)
    return updated
  }
}
