import { Injectable } from '@nestjs/common'
import { SettingsRepository } from '../../domain/repositories/settings.repository'
import { AIPort } from '../../domain/ports/ai.port'
import { AnthropicAdapter } from '../../infrastructure/ai/anthropic.adapter'
import { OpenRouterAdapter } from '../../infrastructure/ai/openrouter.adapter'
import { UpdateSettingsDto, TestConnectionDto } from './dto/settings.dto'

@Injectable()
export class SettingsService {
  private cachedAIPort: AIPort | null = null

  constructor(private readonly settingsRepo: SettingsRepository) {}

  async getSettings() {
    const row = await this.settingsRepo.findSettings()
    return {
      aiProvider:         row?.aiProvider ?? process.env.AI_PROVIDER ?? 'openrouter',
      aiModel:            row?.aiModel    ?? process.env.AI_MODEL    ?? '',
      aiApiKeyConfigured: !!(row?.aiApiKey),
    }
  }

  async updateSettings(dto: UpdateSettingsDto) {
    const current = await this.settingsRepo.findSettings()
    await this.settingsRepo.upsertSettings({
      aiProvider: dto.aiProvider,
      aiModel:    dto.aiModel ?? null,
      aiApiKey:   dto.aiApiKey ?? current?.aiApiKey ?? null,
    })
    this.cachedAIPort = null
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
    if (this.cachedAIPort) return this.cachedAIPort
    const row = await this.settingsRepo.findSettings()
    const provider = row?.aiProvider ?? process.env.AI_PROVIDER ?? 'openrouter'
    const apiKey   = row?.aiApiKey   || undefined
    const model    = row?.aiModel    || undefined
    this.cachedAIPort = this.buildAIPort(provider, apiKey, model)
    return this.cachedAIPort
  }

  private buildAIPort(provider: string, apiKey?: string, model?: string): AIPort {
    if (provider === 'anthropic') return new AnthropicAdapter(apiKey, model)
    return new OpenRouterAdapter(apiKey, model)
  }
}
