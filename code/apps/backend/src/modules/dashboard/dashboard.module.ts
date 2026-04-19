import { Module } from '@nestjs/common'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'
import { TransactionRepository } from '../../domain/repositories/transaction.repository'
import { CategoryRepository } from '../../domain/repositories/category.repository'
import { ImportBatchRepository } from '../../domain/repositories/import-batch.repository'
import { PrismaTransactionRepository } from '../../infrastructure/repositories/prisma/prisma-transaction.repository'
import { PrismaCategoryRepository } from '../../infrastructure/repositories/prisma/prisma-category.repository'
import { PrismaImportBatchRepository } from '../../infrastructure/repositories/prisma/prisma-import-batch.repository'

@Module({
  controllers: [DashboardController],
  providers: [
    DashboardService,
    { provide: TransactionRepository, useClass: PrismaTransactionRepository },
    { provide: CategoryRepository,    useClass: PrismaCategoryRepository    },
    { provide: ImportBatchRepository, useClass: PrismaImportBatchRepository },
  ],
})
export class DashboardModule {}
