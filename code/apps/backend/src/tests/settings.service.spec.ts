import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from '../modules/settings/settings.service';
import {
  SettingsRepository,
  AppSettingsRow,
} from '../domain/repositories/settings.repository';
import { EnvService } from '../modules/env/env.service';

class InMemorySettingsRepository extends SettingsRepository {
  private row: AppSettingsRow | null = null;

  async findSettings() {
    return this.row;
  }
  async upsertSettings(data: AppSettingsRow) {
    this.row = { ...data };
  }
}

const mockEnvService = {
  get: (key: string) => {
    const values: Record<string, string> = {
      AI_PROVIDER: 'openrouter',
      AI_MODEL: 'google/gemini-2.5-flash-preview',
      AI_API_KEY: 'sk-test',
    };
    return values[key];
  },
};

describe('SettingsService', () => {
  let service: SettingsService;
  let repo: InMemorySettingsRepository;

  beforeEach(async () => {
    repo = new InMemorySettingsRepository();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: SettingsRepository, useValue: repo },
        { provide: EnvService, useValue: mockEnvService },
      ],
    }).compile();
    service = module.get(SettingsService);
  });

  it('returns defaults when no row exists', async () => {
    const result = await service.getSettings();
    expect(result.aiApiKeyConfigured).toBe(false);
  });

  it('returns aiApiKeyConfigured true when key is set', async () => {
    await repo.upsertSettings({
      aiProvider: 'anthropic',
      aiApiKey: 'sk-abc',
      aiModel: null,
    });
    const result = await service.getSettings();
    expect(result.aiApiKeyConfigured).toBe(true);
  });

  it('reuses the same AIPort instance across calls', async () => {
    await repo.upsertSettings({
      aiProvider: 'openrouter',
      aiApiKey: 'sk-abc',
      aiModel: null,
    });
    const p1 = await service.createAIPort();
    const p2 = await service.createAIPort();
    expect(p1).toBe(p2);
  });

  it('invalidates cached AIPort after updateSettings', async () => {
    await repo.upsertSettings({
      aiProvider: 'openrouter',
      aiApiKey: 'sk-abc',
      aiModel: null,
    });
    const p1 = await service.createAIPort();
    await service.updateSettings({
      aiProvider: 'openrouter',
      aiApiKey: 'sk-new',
      aiModel: '',
    });
    const p2 = await service.createAIPort();
    expect(p1).not.toBe(p2);
  });
});
