import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { SettingsRepository, AppSettingsRow } from '../../../domain/repositories/settings.repository'

@Injectable()
export class PrismaSettingsRepository extends SettingsRepository {
  constructor(private readonly prisma: PrismaService) { super() }

  async findSettings(): Promise<AppSettingsRow | null> {
    const row = await this.prisma.appSettings.findUnique({ where: { id: 'singleton' } })
    if (!row) return null
    return { aiProvider: row.aiProvider, aiModel: row.aiModel, aiApiKey: row.aiApiKey }
  }

  async upsertSettings(data: AppSettingsRow): Promise<void> {
    await this.prisma.appSettings.upsert({
      where:  { id: 'singleton' },
      create: { id: 'singleton', aiProvider: data.aiProvider, aiApiKey: data.aiApiKey ?? undefined, aiModel: data.aiModel ?? undefined },
      update: { aiProvider: data.aiProvider, aiModel: data.aiModel ?? undefined, ...(data.aiApiKey ? { aiApiKey: data.aiApiKey } : {}) },
    })
  }
}
