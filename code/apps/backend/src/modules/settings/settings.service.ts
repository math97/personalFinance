import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { AIPort } from '../../domain/ports/ai.port'
import { AnthropicAdapter } from '../../infrastructure/ai/anthropic.adapter'
import { OpenRouterAdapter } from '../../infrastructure/ai/openrouter.adapter'
import { UpdateSettingsDto, TestConnectionDto } from './dto/settings.dto'

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    const row = await this.prisma.appSettings.findUnique({ where: { id: 'singleton' } })
    return {
      aiProvider: row?.aiProvider ?? process.env.AI_PROVIDER ?? 'openrouter',
      aiModel:    row?.aiModel    ?? process.env.AI_MODEL    ?? '',
      aiApiKeyConfigured: !!(row?.aiApiKey),
    }
  }

  async updateSettings(dto: UpdateSettingsDto) {
    await this.prisma.appSettings.upsert({
      where:  { id: 'singleton' },
      create: { id: 'singleton', aiProvider: dto.aiProvider, aiApiKey: dto.aiApiKey, aiModel: dto.aiModel },
      update: { aiProvider: dto.aiProvider, aiApiKey: dto.aiApiKey, aiModel: dto.aiModel },
    })
    return this.getSettings()
  }

  async testConnection(dto: TestConnectionDto): Promise<{ ok: boolean; error?: string }> {
    try {
      const ai = this.buildAIPort(dto.aiProvider, dto.aiApiKey, dto.aiModel)
      await ai.suggestCategory('test payment', ['Other'])
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }

  async createAIPort(): Promise<AIPort> {
    const row = await this.prisma.appSettings.findUnique({ where: { id: 'singleton' } })
    const provider = row?.aiProvider ?? process.env.AI_PROVIDER ?? 'openrouter'
    const apiKey   = row?.aiApiKey   || undefined
    const model    = row?.aiModel    || undefined
    return this.buildAIPort(provider, apiKey, model)
  }

  private buildAIPort(provider: string, apiKey?: string, model?: string): AIPort {
    if (provider === 'anthropic') return new AnthropicAdapter(apiKey, model)
    return new OpenRouterAdapter(apiKey, model)
  }
}
