import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { PrismaModule } from './prisma/prisma.module'
import { TransactionsModule } from './modules/transactions/transactions.module'
import { CategoriesModule } from './modules/categories/categories.module'
import { ImportModule } from './modules/import/import.module'
import { DashboardModule } from './modules/dashboard/dashboard.module'
import { SettingsModule } from './modules/settings/settings.module'
import { InsightsModule } from './modules/insights/insights.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    PrismaModule,
    TransactionsModule,
    CategoriesModule,
    ImportModule,
    DashboardModule,
    SettingsModule,
    InsightsModule,
  ],
})
export class AppModule {}
