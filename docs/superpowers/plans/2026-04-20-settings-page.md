# Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Settings page with a currency symbol selector (€/$/ R$) stored in localStorage and an AI provider configuration UI (provider, API key, model) stored in the database.

**Architecture:** Backend gains an `AppSettings` singleton Prisma model and a `SettingsModule` (service + controller) that exposes three endpoints. The AI adapters gain optional constructor params so `SettingsService.createAIPort()` can build the right adapter from DB config at request time. The frontend gains a `useCurrency` hook consumed by all components that display amounts, plus a rewritten Settings page.

**Tech Stack:** NestJS, Prisma 5, Next.js 14 App Router, Vitest, React Testing Library, Supertest.

---

## File Map

### Backend — create
| File | Purpose |
|---|---|
| `src/modules/settings/settings.service.ts` | `getSettings()`, `updateSettings()`, `testConnection()`, `createAIPort()` |
| `src/modules/settings/settings.controller.ts` | `GET /settings`, `PATCH /settings`, `POST /settings/test` |
| `src/modules/settings/settings.module.ts` | NestJS module wiring |
| `src/modules/settings/dto/settings.dto.ts` | `UpdateSettingsDto`, `TestConnectionDto` |

### Backend — modify
| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `AppSettings` model |
| `src/infrastructure/ai/anthropic.adapter.ts` | Accept `(apiKey?: string, model?: string)` constructor params |
| `src/infrastructure/ai/openrouter.adapter.ts` | Accept `(apiKey?: string, model?: string)` constructor params |
| `src/modules/import/import.module.ts` | Replace `AIModule` import with `SettingsModule`; remove `CategorizationDomainService` provider |
| `src/modules/import/import.service.ts` | Replace `AIPort` + `CategorizationDomainService` injections with `SettingsService`; create both per-call |
| `src/app.module.ts` | Add `SettingsModule` |

### Backend — test
| File | Purpose |
|---|---|
| `test/settings.e2e-spec.ts` | E2e tests for all three settings endpoints |

### Frontend — create
| File | Purpose |
|---|---|
| `src/lib/currency.ts` | `CURRENCIES` constant + `getCurrencySymbol()` (localStorage read, SSR-safe) |
| `src/hooks/useCurrency.ts` | React hook wrapping `getCurrencySymbol()` with hydration safety |

### Frontend — modify
| File | Change |
|---|---|
| `src/lib/api.ts` | Add `api.settings.*` methods |
| `src/app/settings/page.tsx` | Full rewrite — add currency section + AI provider section |
| `src/components/batch-review-client.tsx` | Replace hardcoded `£` with `useCurrency()` |
| `src/components/transaction-modal.tsx` | Replace hardcoded `£` |
| `src/components/spending-bar-chart.tsx` | Replace hardcoded `£` |
| `src/components/month-comparison-chart.tsx` | Replace hardcoded `£` |
| `src/app/transactions/page.tsx` | Replace hardcoded `£` |
| `src/app/dashboard/page.tsx` | Replace hardcoded `£` |

---

## Task 1: Prisma schema — AppSettings model

**Files:**
- Modify: `code/apps/backend/prisma/schema.prisma`

- [ ] **Add `AppSettings` model to schema**

```prisma
model AppSettings {
  id          String @id @default("singleton")
  aiProvider  String @default("openrouter")
  aiApiKey    String @default("")
  aiModel     String @default("")
}
```

- [ ] **Run migration**

```bash
cd code/apps/backend
npx prisma migrate dev --name add_app_settings
```

Expected: migration file created in `prisma/migrations/`, Prisma client regenerated.

- [ ] **Verify existing unit tests still pass**

```bash
npm test
```

Expected: 94 tests pass.

- [ ] **Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add AppSettings singleton model"
```

---

## Task 2: Update AI adapters to accept constructor params

**Files:**
- Modify: `code/apps/backend/src/infrastructure/ai/anthropic.adapter.ts`
- Modify: `code/apps/backend/src/infrastructure/ai/openrouter.adapter.ts`

- [ ] **Rewrite `AnthropicAdapter` constructor to accept optional args**

Replace the constructor and add a `model` field (currently read inline from `process.env` per call):

```ts
import { Injectable } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import { AIPort, ExtractedTransaction } from '../../domain/ports/ai.port'

@Injectable()
export class AnthropicAdapter extends AIPort {
  private readonly client: Anthropic
  private readonly model: string

  constructor(apiKey?: string, model?: string) {
    super()
    const key = apiKey || process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY
    if (!key) throw new Error('Missing API key: set AI_API_KEY (or ANTHROPIC_API_KEY) for the anthropic provider')
    this.client = new Anthropic({ apiKey: key })
    this.model = model || process.env.AI_MODEL || 'claude-haiku-4-5-20251001'
  }

  async extractTransactions(buffer: Buffer, mediaType: string): Promise<ExtractedTransaction[]> {
    const base64 = buffer.toString('base64')
    const isPdf = mediaType === 'application/pdf'
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: this.extractionPrompt,
      messages: [
        {
          role: 'user',
          content: [
            isPdf
              ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
              : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: base64 } },
          ],
        },
      ],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    return this.parseResponse(text)
  }

  async suggestCategory(description: string, categoryNames: string[]): Promise<string | null> {
    if (categoryNames.length === 0) return null
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 64,
      system: this.categorizationSystem(categoryNames),
      messages: [{ role: 'user', content: description }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : 'none'
    return categoryNames.includes(text) ? text : null
  }
}
```

- [ ] **Rewrite `OpenRouterAdapter` constructor to accept optional args**

```ts
import { Injectable } from '@nestjs/common'
import OpenAI from 'openai'
import { AIPort, ExtractedTransaction } from '../../domain/ports/ai.port'

@Injectable()
export class OpenRouterAdapter extends AIPort {
  private readonly client: OpenAI
  private readonly model: string

  constructor(apiKey?: string, model?: string) {
    super()
    const key = apiKey || process.env.AI_API_KEY
    if (!key) throw new Error('Missing API key: set AI_API_KEY for the openrouter provider')
    this.model = model || process.env.AI_MODEL || 'anthropic/claude-haiku-4-5'
    this.client = new OpenAI({
      apiKey: key,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://personal-finance-app',
        'X-Title': 'Personal Finance',
      },
    })
  }

  async extractTransactions(buffer: Buffer, mediaType: string): Promise<ExtractedTransaction[]> {
    const base64 = buffer.toString('base64')
    const isPdf = mediaType === 'application/pdf'
    const dataUri = `data:${mediaType};base64,${base64}`
    const userContent: any[] = isPdf
      ? [
          { type: 'text', text: 'Extract all transactions from this bank statement.' },
          { type: 'file', file: { filename: 'statement.pdf', file_data: dataUri } },
        ]
      : [{ type: 'image_url', image_url: { url: dataUri } }]
    const response = await (this.client.chat.completions.create as any)({
      model: this.model,
      max_tokens: 8192,
      messages: [
        { role: 'system', content: this.extractionPrompt },
        { role: 'user', content: userContent },
      ],
      ...(isPdf && { plugins: [{ id: 'file-parser', pdf: { engine: 'mistral-ocr' } }] }),
    })
    return this.parseResponse(response.choices[0]?.message?.content ?? '')
  }

  async suggestCategory(description: string, categoryNames: string[]): Promise<string | null> {
    if (categoryNames.length === 0) return null
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 64,
      messages: [
        { role: 'system', content: this.categorizationSystem(categoryNames) },
        { role: 'user', content: description },
      ],
    })
    const text = (response.choices[0]?.message?.content ?? '').trim()
    return categoryNames.includes(text) ? text : null
  }
}
```

- [ ] **Verify unit tests still pass**

```bash
cd code/apps/backend && npm test
```

Expected: 94 tests pass (adapters are not exercised in unit tests, no regressions expected).

- [ ] **Commit**

```bash
git add src/infrastructure/ai/
git commit -m "refactor: AI adapters accept optional apiKey/model constructor params"
```

---

## Task 3: SettingsService

**Files:**
- Create: `code/apps/backend/src/modules/settings/dto/settings.dto.ts`
- Create: `code/apps/backend/src/modules/settings/settings.service.ts`

- [ ] **Create DTOs**

`src/modules/settings/dto/settings.dto.ts`:

```ts
import { IsString, IsIn, IsOptional } from 'class-validator'

const PROVIDERS = ['anthropic', 'openrouter'] as const

export class UpdateSettingsDto {
  @IsIn(PROVIDERS)
  aiProvider: string

  @IsString()
  aiApiKey: string

  @IsString()
  aiModel: string
}

export class TestConnectionDto {
  @IsIn(PROVIDERS)
  aiProvider: string

  @IsString()
  aiApiKey: string

  @IsString()
  aiModel: string
}
```

- [ ] **Create SettingsService**

`src/modules/settings/settings.service.ts`:

```ts
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
```

- [ ] **Commit**

```bash
git add src/modules/settings/
git commit -m "feat: SettingsService — get/update/test/createAIPort"
```

---

## Task 4: SettingsController + SettingsModule

**Files:**
- Create: `code/apps/backend/src/modules/settings/settings.controller.ts`
- Create: `code/apps/backend/src/modules/settings/settings.module.ts`
- Modify: `code/apps/backend/src/app.module.ts`

- [ ] **Create SettingsController**

`src/modules/settings/settings.controller.ts`:

```ts
import { Controller, Get, Patch, Post, Body } from '@nestjs/common'
import { SettingsService } from './settings.service'
import { UpdateSettingsDto, TestConnectionDto } from './dto/settings.dto'

@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  get() {
    return this.service.getSettings()
  }

  @Patch()
  update(@Body() dto: UpdateSettingsDto) {
    return this.service.updateSettings(dto)
  }

  @Post('test')
  test(@Body() dto: TestConnectionDto) {
    return this.service.testConnection(dto)
  }
}
```

- [ ] **Create SettingsModule**

`src/modules/settings/settings.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { SettingsController } from './settings.controller'
import { SettingsService } from './settings.service'
import { PrismaModule } from '../../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
```

- [ ] **Register SettingsModule in AppModule**

`src/app.module.ts` — add `SettingsModule` to the `imports` array:

```ts
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { PrismaModule } from './prisma/prisma.module'
import { TransactionsModule } from './modules/transactions/transactions.module'
import { CategoriesModule } from './modules/categories/categories.module'
import { ImportModule } from './modules/import/import.module'
import { DashboardModule } from './modules/dashboard/dashboard.module'
import { SettingsModule } from './modules/settings/settings.module'

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
  ],
})
export class AppModule {}
```

- [ ] **Verify unit tests still pass**

```bash
cd code/apps/backend && npm test
```

Expected: 94 tests pass.

- [ ] **Commit**

```bash
git add src/modules/settings/ src/app.module.ts
git commit -m "feat: SettingsController + SettingsModule wired into AppModule"
```

---

## Task 5: Refactor ImportModule to use SettingsService

**Files:**
- Modify: `code/apps/backend/src/modules/import/import.module.ts`
- Modify: `code/apps/backend/src/modules/import/import.service.ts`

- [ ] **Update ImportModule — replace AIModule with SettingsModule**

`src/modules/import/import.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { MulterModule } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { ImportController } from './import.controller'
import { ImportService } from './import.service'
import { SettingsModule } from '../settings/settings.module'
import { ImportBatchRepository } from '../../domain/repositories/import-batch.repository'
import { CategoryRepository } from '../../domain/repositories/category.repository'
import { TransactionRepository } from '../../domain/repositories/transaction.repository'
import { PrismaImportBatchRepository } from '../../infrastructure/repositories/prisma/prisma-import-batch.repository'
import { PrismaCategoryRepository } from '../../infrastructure/repositories/prisma/prisma-category.repository'
import { PrismaTransactionRepository } from '../../infrastructure/repositories/prisma/prisma-transaction.repository'

@Module({
  imports: [
    MulterModule.register({ storage: memoryStorage() }),
    SettingsModule,
  ],
  controllers: [ImportController],
  providers: [
    ImportService,
    { provide: ImportBatchRepository, useClass: PrismaImportBatchRepository },
    { provide: CategoryRepository,    useClass: PrismaCategoryRepository    },
    { provide: TransactionRepository, useClass: PrismaTransactionRepository },
  ],
})
export class ImportModule {}
```

- [ ] **Update ImportService — inject SettingsService, create AI per call**

Replace the constructor and `uploadAndExtract` in `src/modules/import/import.service.ts`:

```ts
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common'
import { fromBuffer as fileTypeFromBuffer } from 'file-type'
import { ImportBatchRepository } from '../../domain/repositories/import-batch.repository'
import { CategoryRepository } from '../../domain/repositories/category.repository'
import { TransactionRepository } from '../../domain/repositories/transaction.repository'
import { CategorizationDomainService } from '../../domain/services/categorization.domain-service'
import { TransactionEntity } from '../../domain/entities/transaction.entity'
import { SettingsService } from '../settings/settings.service'
import { UpdateImportedTransactionDto, SaveRuleDto } from './dto/import.dto'
```

Replace constructor injection (remove `ai: AIPort` and `categorization: CategorizationDomainService`, add `settings: SettingsService`):

```ts
  constructor(
    private readonly batchRepo: ImportBatchRepository,
    private readonly categoryRepo: CategoryRepository,
    private readonly txRepo: TransactionRepository,
    private readonly settings: SettingsService,
  ) {}
```

In `uploadAndExtract`, build `ai` and `categorization` from settings at call time. Replace the existing method opening lines:

```ts
  async uploadAndExtract(file: Express.Multer.File) {
    const ALLOWED_MIMES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'])
    const detected = await fileTypeFromBuffer(file.buffer)
    const effectiveMime = detected?.mime ?? file.mimetype
    if (!ALLOWED_MIMES.has(effectiveMime)) {
      throw new BadRequestException(`Unsupported file type: ${effectiveMime}`)
    }

    const ai = await this.settings.createAIPort()
    const categorization = new CategorizationDomainService(ai)
    const batch = await this.batchRepo.createBatch(file.originalname)
    // ... rest of the method is unchanged except uses local `ai` and `categorization`
```

The `try` block inside `uploadAndExtract` calls `this.ai.extractTransactions(...)` and `this.categorization.categorize(...)` — change these to use the local `ai` and `categorization` variables instead of `this.ai` and `this.categorization`.

- [ ] **Update `import.service.spec.ts` — swap AIPort/CategorizationDomainService for SettingsService mock**

In `src/tests/import.service.spec.ts`, replace the `beforeEach` setup:

Remove these imports:
```ts
import { CategorizationDomainService } from '../domain/services/categorization.domain-service'
import { AIPort } from '../domain/ports/ai.port'
```

Add:
```ts
import { SettingsService } from '../modules/settings/settings.service'
```

Replace the `beforeEach` body (keep repos the same, swap the AI wiring):
```ts
  beforeEach(async () => {
    batchRepo = new InMemoryImportBatchRepository()
    categoryRepo = new InMemoryCategoryRepository()
    txRepo = new InMemoryTransactionRepository()
    aiMock = { extractTransactions: vi.fn(), suggestCategory: vi.fn().mockResolvedValue(null) }

    const settingsMock = { createAIPort: vi.fn().mockResolvedValue(aiMock) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportService,
        { provide: ImportBatchRepository, useValue: batchRepo },
        { provide: CategoryRepository,    useValue: categoryRepo },
        { provide: TransactionRepository, useValue: txRepo },
        { provide: SettingsService,       useValue: settingsMock },
      ],
    }).compile()

    service = module.get(ImportService)
  })
```

- [ ] **Verify unit tests still pass**

```bash
cd code/apps/backend && npm test
```

Expected: 94 tests pass.

- [ ] **Commit**

```bash
git add src/modules/import/ src/tests/import.service.spec.ts
git commit -m "refactor: ImportService reads AI config from SettingsService per call"
```

---

## Task 6: E2e tests for Settings endpoints

**Files:**
- Create: `code/apps/backend/test/settings.e2e-spec.ts`

- [ ] **Write settings e2e tests**

`test/settings.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { PrismaService } from '../src/prisma/prisma.service'
import { createTestApp } from './helpers/app'
import { cleanDb } from './helpers/clean-db'

describe('Settings (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    ;({ app, prisma } = await createTestApp())
  })

  beforeEach(async () => {
    await cleanDb(prisma)
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /api/settings', () => {
    it('returns defaults when no row exists', async () => {
      const res = await request(app.getHttpServer()).get('/api/settings').expect(200)
      expect(res.body).toHaveProperty('aiProvider')
      expect(res.body).toHaveProperty('aiModel')
      expect(res.body).toHaveProperty('aiApiKeyConfigured')
      expect(res.body.aiApiKeyConfigured).toBe(false)
    })
  })

  describe('PATCH /api/settings', () => {
    it('persists provider and model', async () => {
      await request(app.getHttpServer())
        .patch('/api/settings')
        .send({ aiProvider: 'anthropic', aiApiKey: 'sk-test', aiModel: 'claude-haiku-4-5-20251001' })
        .expect(200)

      const res = await request(app.getHttpServer()).get('/api/settings').expect(200)
      expect(res.body.aiProvider).toBe('anthropic')
      expect(res.body.aiModel).toBe('claude-haiku-4-5-20251001')
      expect(res.body.aiApiKeyConfigured).toBe(true)
    })

    it('does not return raw API key', async () => {
      await request(app.getHttpServer())
        .patch('/api/settings')
        .send({ aiProvider: 'openrouter', aiApiKey: 'sk-secret-key', aiModel: 'gpt-4o' })
        .expect(200)

      const res = await request(app.getHttpServer()).get('/api/settings').expect(200)
      expect(JSON.stringify(res.body)).not.toContain('sk-secret-key')
    })

    it('rejects invalid provider', async () => {
      await request(app.getHttpServer())
        .patch('/api/settings')
        .send({ aiProvider: 'invalid', aiApiKey: 'key', aiModel: 'model' })
        .expect(400)
    })
  })

  describe('POST /api/settings/test', () => {
    it('returns ok:false for invalid key', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/settings/test')
        .send({ aiProvider: 'openrouter', aiApiKey: 'invalid-key', aiModel: 'google/gemini-2.5-flash-preview' })
        .expect(201)

      expect(res.body.ok).toBe(false)
      expect(res.body.error).toBeDefined()
    })
  })
})
```

- [ ] **Update `clean-db.ts` to truncate `AppSettings`**

Add `"AppSettings"` to the TRUNCATE statement in `test/helpers/clean-db.ts`:

```ts
import { PrismaService } from '../../src/prisma/prisma.service'

export async function cleanDb(prisma: PrismaService) {
  await prisma.$executeRaw`
    TRUNCATE TABLE "CategoryRule", "ImportedTransaction", "Transaction", "ImportBatch", "Category", "AppSettings"
    RESTART IDENTITY CASCADE
  `
}
```

- [ ] **Run e2e tests**

```bash
cd code/apps/backend && npm run test:e2e
```

Expected: 24 tests pass (21 existing + 3 new settings tests).

- [ ] **Commit**

```bash
git add test/settings.e2e-spec.ts test/helpers/clean-db.ts
git commit -m "test: settings e2e — GET, PATCH, POST /test endpoints"
```

---

## Task 7: Frontend — currency utility + API client

**Files:**
- Create: `code/apps/frontend/src/lib/currency.ts`
- Create: `code/apps/frontend/src/hooks/useCurrency.ts`
- Modify: `code/apps/frontend/src/lib/api.ts`

- [ ] **Create currency utility**

`src/lib/currency.ts`:

```ts
export const CURRENCIES = [
  { symbol: '£', label: 'GBP' },
  { symbol: '€', label: 'Euro' },
  { symbol: '$', label: 'Dollar' },
  { symbol: 'R$', label: 'Real' },
] as const

export type CurrencySymbol = typeof CURRENCIES[number]['symbol']

const STORAGE_KEY = 'finance:currency'
const DEFAULT: CurrencySymbol = '£'

export function getCurrencySymbol(): CurrencySymbol {
  if (typeof window === 'undefined') return DEFAULT
  return (localStorage.getItem(STORAGE_KEY) as CurrencySymbol) ?? DEFAULT
}

export function setCurrencySymbol(symbol: CurrencySymbol): void {
  localStorage.setItem(STORAGE_KEY, symbol)
}
```

- [ ] **Create `useCurrency` hook**

`src/hooks/useCurrency.ts`:

```ts
'use client'

import { useState, useEffect } from 'react'
import { getCurrencySymbol, setCurrencySymbol, CurrencySymbol } from '@/lib/currency'

export function useCurrency(): [CurrencySymbol, (s: CurrencySymbol) => void] {
  const [symbol, setSymbol] = useState<CurrencySymbol>('£')

  useEffect(() => {
    setSymbol(getCurrencySymbol())
  }, [])

  function change(s: CurrencySymbol) {
    setCurrencySymbol(s)
    setSymbol(s)
  }

  return [symbol, change]
}
```

- [ ] **Add `api.settings` to `src/lib/api.ts`**

Append to the `api` export object:

```ts
  settings: {
    get: () => get<{ aiProvider: string; aiModel: string; aiApiKeyConfigured: boolean }>('/settings'),
    update: (data: { aiProvider: string; aiApiKey: string; aiModel: string }) =>
      patch<{ aiProvider: string; aiModel: string; aiApiKeyConfigured: boolean }>('/settings', data),
    test: (data: { aiProvider: string; aiApiKey: string; aiModel: string }) =>
      post<{ ok: boolean; error?: string }>('/settings/test', data),
  },
```

- [ ] **Commit**

```bash
git add src/lib/currency.ts src/hooks/useCurrency.ts src/lib/api.ts
git commit -m "feat: currency utility, useCurrency hook, api.settings client"
```

---

## Task 8: Rewrite settings/page.tsx

**Files:**
- Modify: `code/apps/frontend/src/app/settings/page.tsx`

- [ ] **Rewrite the settings page**

`src/app/settings/page.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Check, Eye, EyeOff, Zap, CircleCheck, CircleX } from 'lucide-react'
import { api } from '@/lib/api'
import { CURRENCIES, CurrencySymbol } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'

type Provider = 'anthropic' | 'openrouter'

export default function SettingsPage() {
  const [currency, setCurrency] = useCurrency()

  // Salary (existing)
  const [salary, setSalary] = useState(3500)
  const [salarySaved, setSalarySaved] = useState(false)

  // AI provider form
  const [provider, setProvider] = useState<Provider>('openrouter')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('finance_salary')
    if (stored) setSalary(Number(stored))

    api.settings.get().then(s => {
      setProvider(s.aiProvider as Provider)
      setModel(s.aiModel)
    }).catch(() => {})
  }, [])

  function saveSalary() {
    localStorage.setItem('finance_salary', String(salary))
    setSalarySaved(true)
    setTimeout(() => setSalarySaved(false), 2000)
  }

  async function saveAI() {
    setSaving(true)
    setSaved(false)
    setTestResult(null)
    try {
      await api.settings.update({ aiProvider: provider, aiApiKey: apiKey, aiModel: model })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  async function testConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await api.settings.test({ aiProvider: provider, aiApiKey: apiKey, aiModel: model })
      setTestResult(result)
    } catch {
      setTestResult({ ok: false, error: 'Request failed' })
    } finally {
      setTesting(false)
    }
  }

  const pillBase = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer'
  const pillActive = 'font-semibold'

  return (
    <div className="px-8 py-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>Manage your preferences and AI configuration</p>
      </div>

      {/* General */}
      <div className="rounded-xl overflow-hidden mb-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>General</p>
        </div>

        {/* Currency */}
        <div className="px-5 py-4 flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Currency</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>Symbol displayed across all amounts</p>
          </div>
          <div className="flex gap-2">
            {CURRENCIES.filter(c => c.symbol !== '£').map(c => (
              <button
                key={c.symbol}
                onClick={() => setCurrency(c.symbol as CurrencySymbol)}
                className={pillBase}
                style={{
                  background: currency === c.symbol ? 'var(--accent)' : 'var(--surface-2)',
                  color: currency === c.symbol ? '#0c0c0e' : 'var(--text-2)',
                  border: currency === c.symbol ? 'none' : '1px solid var(--border)',
                }}
              >
                {c.symbol} {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Salary */}
        <div className="px-5 py-4 flex items-center justify-between gap-6" style={{ borderTop: '1px solid var(--border)' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Monthly salary</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>Used to calculate % of income spent</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 rounded-lg px-3 py-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <span className="text-sm" style={{ color: 'var(--text-2)' }}>{currency}</span>
              <input
                type="number" min={0} step={100} value={salary}
                onChange={e => setSalary(Number(e.target.value))}
                onKeyDown={e => e.key === 'Enter' && saveSalary()}
                className="bg-transparent text-sm outline-none w-24 text-right"
                style={{ color: 'var(--text)' }}
              />
            </div>
            <button
              onClick={saveSalary}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
              style={{ background: salarySaved ? '#16a34a22' : 'var(--accent)', color: salarySaved ? '#16a34a' : '#0c0c0e' }}
            >
              {salarySaved ? <><Check size={14} /> Saved</> : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* AI Provider */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>AI Provider</p>
        </div>

        {/* Provider toggle */}
        <div className="px-5 py-4 flex items-center justify-between gap-6" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Provider</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>Select which AI service to use</p>
          </div>
          <div className="flex gap-2">
            {(['anthropic', 'openrouter'] as Provider[]).map(p => (
              <button
                key={p}
                onClick={() => { setProvider(p); setTestResult(null) }}
                className={pillBase}
                style={{
                  background: provider === p ? 'var(--accent)' : 'var(--surface-2)',
                  color: provider === p ? '#0c0c0e' : 'var(--text-2)',
                  border: provider === p ? 'none' : '1px solid var(--border)',
                }}
              >
                {p === 'anthropic' ? 'Anthropic' : 'OpenRouter'}
              </button>
            ))}
          </div>
        </div>

        {/* API Key */}
        <div className="px-5 py-4 flex items-center gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-40 shrink-0">
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>API Key</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>Stored securely in DB</p>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
            <button onClick={() => setShowKey(v => !v)} style={{ color: 'var(--text-2)' }}>
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Model */}
        <div className="px-5 py-4 flex items-start gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-40 shrink-0">
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Model</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>Exact model ID</p>
          </div>
          <div className="flex-1">
            <input
              type="text"
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder={provider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'google/gemini-2.5-flash-preview'}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-3)' }}>
              Enter the model ID exactly as the provider expects it
            </p>
          </div>
        </div>

        {/* Actions row */}
        <div className="px-5 py-4 flex items-center gap-3">
          <button
            onClick={testConnection}
            disabled={testing || !apiKey || !model}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
          >
            <Zap size={14} />
            {testing ? 'Testing…' : 'Test connection'}
          </button>

          {testResult && (
            <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: testResult.ok ? 'var(--green)' : 'var(--red)' }}>
              {testResult.ok
                ? <><CircleCheck size={14} /> Connection successful</>
                : <><CircleX size={14} /> {testResult.error ?? 'Invalid key or model'}</>}
            </span>
          )}

          <div className="flex-1" />

          <button
            onClick={saveAI}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#0c0c0e' }}
          >
            {saved ? <><Check size={14} className="inline mr-1" />Saved</> : saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: settings page — currency selector + AI provider UI"
```

---

## Task 9: Replace hardcoded £ in all frontend components

**Files:**
- Modify: `code/apps/frontend/src/components/batch-review-client.tsx`
- Modify: `code/apps/frontend/src/components/transaction-modal.tsx`
- Modify: `code/apps/frontend/src/components/spending-bar-chart.tsx`
- Modify: `code/apps/frontend/src/components/month-comparison-chart.tsx`
- Modify: `code/apps/frontend/src/app/transactions/page.tsx`
- Modify: `code/apps/frontend/src/app/dashboard/page.tsx`

- [ ] **`batch-review-client.tsx` — add `useCurrency` hook**

Add import at top:
```ts
import { useCurrency } from '@/hooks/useCurrency'
```

Inside `BatchReviewClient` component, add after the existing state declarations:
```ts
const [currency] = useCurrency()
```

Replace every occurrence of `` `£${...}` `` or `'£'` with `currency`. The amount display on line ~258:
```tsx
{isIncome ? '+' : ''}{currency}{Math.abs(Number(item.rawAmount)).toFixed(2)}
```

- [ ] **`transaction-modal.tsx` — add `useCurrency` hook**

Add import:
```ts
import { useCurrency } from '@/hooks/useCurrency'
```

Inside the modal component function, add:
```ts
const [currency] = useCurrency()
```

Replace any `£` in the amount input prefix span with `{currency}`.

- [ ] **`spending-bar-chart.tsx` — add `useCurrency` hook**

Add import:
```ts
import { useCurrency } from '@/hooks/useCurrency'
```

Inside the chart component, add:
```ts
const [currency] = useCurrency()
```

Replace any `£` in Recharts tooltip formatters or label formatters with `currency`.

- [ ] **`month-comparison-chart.tsx` — add `useCurrency` hook**

Add import:
```ts
import { useCurrency } from '@/hooks/useCurrency'
```

Inside the component, add:
```ts
const [currency] = useCurrency()
```

Replace any `£` in delta callout text or formatter with `currency`.

- [ ] **`transactions/page.tsx` — add `useCurrency` hook**

Add import:
```ts
import { useCurrency } from '@/hooks/useCurrency'
```

Inside the page component (it's a client component with `useEffect`), add:
```ts
const [currency] = useCurrency()
```

Replace all `£` in amount display with `{currency}`.

- [ ] **`dashboard/page.tsx` — check and update if needed**

Run:
```bash
grep -n "£" code/apps/frontend/src/app/dashboard/page.tsx
```

If matches found, the amounts are rendered server-side. Convert the affected JSX snippet to use a client component that calls `useCurrency()`, or extract it to a `CurrencyAmount` client component:

`src/components/currency-amount.tsx`:
```tsx
'use client'
import { useCurrency } from '@/hooks/useCurrency'

export function CurrencyAmount({ amount, className }: { amount: number; className?: string }) {
  const [currency] = useCurrency()
  return (
    <span className={className}>
      {currency}{Math.abs(amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
    </span>
  )
}
```

Then replace hardcoded `£X,XXX.XX` spans in `dashboard/page.tsx` with `<CurrencyAmount amount={value} />`.

- [ ] **Run frontend tests**

```bash
cd code/apps/frontend && npm test
```

Expected: 26 tests pass. `batch-review-client.test.tsx` mocks `useCurrency` — add the mock if needed:

```ts
vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ['£', vi.fn()],
}))
```

- [ ] **Commit**

```bash
git add src/components/ src/app/
git commit -m "feat: replace hardcoded £ with useCurrency hook across all components"
```

---

## Task 10: Manual smoke test + final commit

- [ ] **Start the stack**

```bash
cd code && docker compose up -d
cd apps/backend && npm run start:dev   # port 3001
cd apps/frontend && npm run dev        # port 3000
```

- [ ] **Verify currency selector**

1. Open Settings → click `€ Euro`
2. Navigate to Transactions — amounts show `€`
3. Refresh page — `€` persists
4. Navigate to Dashboard — amounts show `€`

- [ ] **Verify AI provider save**

1. Open Settings → AI Provider section
2. Enter a real OpenRouter key + model → click `Test connection` → see `✓ Connection successful`
3. Click `Save changes` → see `Saved ✓`
4. Refresh page — provider and model pre-fill from API (key field is blank, by design)

- [ ] **Run all tests**

```bash
cd code/apps/backend && npm test && npm run test:e2e
cd code/apps/frontend && npm test
```

Expected: 94 unit + 24 e2e + 26 frontend tests pass.

- [ ] **Push and open PR**

```bash
git push
gh pr create --title "feat: settings page — currency selector + AI provider config" \
  --body "Adds currency symbol picker (€/$/ R$) stored in localStorage and AI provider settings (provider, API key, model) stored in DB. Backend gains AppSettings singleton table and /api/settings endpoints; AIModule reads config from DB at request time."
```
