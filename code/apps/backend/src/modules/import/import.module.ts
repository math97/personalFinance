import { Module } from '@nestjs/common'
import { MulterModule } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { ImportController } from './import.controller'
import { ImportService } from './import.service'
import { AIModule } from '../ai/ai.module'
import { AIPort } from '../../domain/ports/ai.port'
import { CategorizationDomainService } from '../../domain/services/categorization.domain-service'
import { ImportBatchRepository } from '../../domain/repositories/import-batch.repository'
import { CategoryRepository } from '../../domain/repositories/category.repository'
import { TransactionRepository } from '../../domain/repositories/transaction.repository'
import { PrismaImportBatchRepository } from '../../infrastructure/repositories/prisma/prisma-import-batch.repository'
import { PrismaCategoryRepository } from '../../infrastructure/repositories/prisma/prisma-category.repository'
import { PrismaTransactionRepository } from '../../infrastructure/repositories/prisma/prisma-transaction.repository'

@Module({
  imports: [
    MulterModule.register({ storage: memoryStorage() }),
    AIModule,
  ],
  controllers: [ImportController],
  providers: [
    ImportService,
    {
      provide: CategorizationDomainService,
      useFactory: (ai: AIPort) => new CategorizationDomainService(ai),
      inject: [AIPort],
    },
    { provide: ImportBatchRepository, useClass: PrismaImportBatchRepository },
    { provide: CategoryRepository,    useClass: PrismaCategoryRepository    },
    { provide: TransactionRepository, useClass: PrismaTransactionRepository },
  ],
})
export class ImportModule {}
