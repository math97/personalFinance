import { Module } from '@nestjs/common'
import { TransactionsController } from './transactions.controller'
import { TransactionsService } from './transactions.service'
import { TransactionRepository } from '../../domain/repositories/transaction.repository'
import { PrismaTransactionRepository } from '../../infrastructure/repositories/prisma/prisma-transaction.repository'

@Module({
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    { provide: TransactionRepository, useClass: PrismaTransactionRepository },
  ],
  exports: [TransactionsService, TransactionRepository],
})
export class TransactionsModule {}
