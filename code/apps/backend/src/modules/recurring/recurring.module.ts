import { Module } from '@nestjs/common'
import { RecurringController } from './recurring.controller'
import { RecurringService } from './recurring.service'
import { RecurringPatternRepository } from '../../domain/repositories/recurring-pattern.repository'
import { TransactionRepository } from '../../domain/repositories/transaction.repository'
import { CategoryRepository } from '../../domain/repositories/category.repository'
import { PrismaRecurringPatternRepository } from '../../infrastructure/repositories/prisma/prisma-recurring-pattern.repository'
import { PrismaTransactionRepository } from '../../infrastructure/repositories/prisma/prisma-transaction.repository'
import { PrismaCategoryRepository } from '../../infrastructure/repositories/prisma/prisma-category.repository'

@Module({
  controllers: [RecurringController],
  providers: [
    RecurringService,
    { provide: RecurringPatternRepository, useClass: PrismaRecurringPatternRepository },
    { provide: TransactionRepository,       useClass: PrismaTransactionRepository      },
    { provide: CategoryRepository,          useClass: PrismaCategoryRepository         },
  ],
  exports: [RecurringService],
})
export class RecurringModule {}
