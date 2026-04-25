import { Module } from '@nestjs/common'
import { InsightsController } from './insights.controller'
import { InsightsService } from './insights.service'
import { TransactionRepository } from '../../domain/repositories/transaction.repository'
import { CategoryRepository } from '../../domain/repositories/category.repository'
import { PrismaTransactionRepository } from '../../infrastructure/repositories/prisma/prisma-transaction.repository'
import { PrismaCategoryRepository } from '../../infrastructure/repositories/prisma/prisma-category.repository'
import { SettingsModule } from '../settings/settings.module'

@Module({
  imports: [SettingsModule],
  controllers: [InsightsController],
  providers: [
    InsightsService,
    { provide: TransactionRepository, useClass: PrismaTransactionRepository },
    { provide: CategoryRepository,    useClass: PrismaCategoryRepository    },
  ],
})
export class InsightsModule {}
