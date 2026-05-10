import { Module } from '@nestjs/common'
import { SettingsController } from './settings.controller'
import { SettingsService } from './settings.service'
import { SettingsRepository } from '../../domain/repositories/settings.repository'
import { PrismaSettingsRepository } from '../../infrastructure/repositories/prisma/prisma-settings.repository'
import { PrismaModule } from '../../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [SettingsController],
  providers: [
    SettingsService,
    { provide: SettingsRepository, useClass: PrismaSettingsRepository },
  ],
  exports: [SettingsService],
})
export class SettingsModule {}
