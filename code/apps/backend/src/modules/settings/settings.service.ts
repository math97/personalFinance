import { Injectable } from '@nestjs/common';
import { SettingsRepository } from '../../domain/repositories/settings.repository';
import { AIPort } from '../../domain/ports/ai.port';
import { AnthropicAdapter } from '../../infrastructure/ai/anthropic.adapter';
import { OpenRouterAdapter } from '../../infrastructure/ai/openrouter.adapter';
import { UpdateSettingsDto, TestConnectionDto } from './dto/settings.dto';
import { EnvService } from '../env/env.service';

@Injectable()
export class SettingsService {
  private cachedAIPort: AIPort | null = null;

  constructor(
    private readonly settingsRepo: SettingsRepository,
    private readonly env: EnvService,
  ) {}

  async getSettings() {
    const row = await this.settingsRepo.findSettings();
    return {
      aiProvider: row?.aiProvider ?? this.env.get('AI_PROVIDER'),
      aiModel: row?.aiModel ?? this.env.get('AI_MODEL'),
      aiApiKeyConfigured: !!row?.aiApiKey,
    };
  }

  async updateSettings(dto: UpdateSettingsDto) {
    const current = await this.settingsRepo.findSettings();
    await this.settingsRepo.upsertSettings({
      aiProvider: dto.aiProvider,
      aiModel: dto.aiModel ?? null,
      aiApiKey: dto.aiApiKey ?? current?.aiApiKey ?? null,
    });
    this.cachedAIPort = null;
    return this.getSettings();
  }

  async testConnection(
    dto: TestConnectionDto,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const ai = this.buildAIPort(dto.aiProvider, dto.aiApiKey, dto.aiModel);
      await ai.suggestCategory('test payment', ['Other']);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  async createAIPort(): Promise<AIPort> {
    if (this.cachedAIPort) return this.cachedAIPort;
    const row = await this.settingsRepo.findSettings();
    const provider = row?.aiProvider ?? this.env.get('AI_PROVIDER');
    const apiKey = row?.aiApiKey || this.env.get('AI_API_KEY');
    const model = row?.aiModel || this.env.get('AI_MODEL');
    this.cachedAIPort = this.buildAIPort(provider, apiKey, model);
    return this.cachedAIPort;
  }

  private buildAIPort(provider: string, apiKey: string, model: string): AIPort {
    if (provider === 'anthropic') return new AnthropicAdapter(apiKey, model);
    return new OpenRouterAdapter(apiKey, model);
  }
}
