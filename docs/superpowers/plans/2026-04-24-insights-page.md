# Insights Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/insights` page with a 3-month spending table per category, per-category drill-down, and an AI chat box for natural-language finance questions.

**Architecture:** Complete the missing budget backend (schema + entity + repos) as a prerequisite, then add `chat()` to `AIPort` and both adapters, create `InsightsService` backed by `SettingsService.createAIPort()` (same pattern as `ImportService`), wire into `InsightsModule` + `AppModule`, and build three focused frontend sub-components colocated in `src/app/insights/`.

**Tech Stack:** NestJS, Prisma v5, PostgreSQL, Next.js 14 (App Router), TypeScript, Recharts, date-fns, class-validator.

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Modify | `code/apps/backend/prisma/schema.prisma` | Add `monthlyBudget Decimal?` to Category model |
| Modify | `code/apps/backend/src/domain/entities/category.entity.ts` | Add `monthlyBudget: number \| null` constructor arg |
| Modify | `code/apps/backend/src/infrastructure/repositories/prisma/category.mapper.ts` | Map `monthlyBudget` Decimal → number \| null |
| Modify | `code/apps/backend/src/domain/repositories/category.repository.ts` | Add `monthlyBudget` to `update()` partial type |
| Modify | `code/apps/backend/src/infrastructure/repositories/prisma/prisma-category.repository.ts` | Pass `monthlyBudget` in Prisma `update()` |
| Modify | `code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-category.repository.ts` | Persist `monthlyBudget` in `update()` |
| Modify | `code/apps/backend/src/modules/categories/dto/update-category.dto.ts` | Add optional `monthlyBudget` field |
| Modify | `code/apps/backend/src/domain/ports/ai.port.ts` | Add `abstract chat(systemPrompt, userMessage): Promise<string>` |
| Modify | `code/apps/backend/src/infrastructure/ai/anthropic.adapter.ts` | Implement `chat()` |
| Modify | `code/apps/backend/src/infrastructure/ai/openrouter.adapter.ts` | Implement `chat()` |
| Create | `code/apps/backend/src/modules/insights/insights.service.ts` | `getCategoryTrends()` + `chat()` |
| Create | `code/apps/backend/src/modules/insights/insights.controller.ts` | GET /insights/categories, POST /insights/chat |
| Create | `code/apps/backend/src/modules/insights/insights.module.ts` | NestJS module wiring |
| Create | `code/apps/backend/src/modules/insights/dto/insights-query.dto.ts` | Query DTO (year, month) |
| Create | `code/apps/backend/src/modules/insights/dto/insights-chat.dto.ts` | Chat request DTO |
| Create | `code/apps/backend/src/tests/insights.service.spec.ts` | Unit tests (in-memory repos + AI mock) |
| Modify | `code/apps/backend/src/app.module.ts` | Import `InsightsModule` |
| Modify | `code/apps/frontend/src/lib/api.ts` | Add `insights.categories()` and `insights.chat()` |
| Modify | `code/apps/frontend/src/components/sidebar.tsx` | Add "Insights" nav item between Dashboard and Transactions |
| Create | `code/apps/frontend/src/app/insights/page.tsx` | `InsightsPage` Client Component (root, holds state) |
| Create | `code/apps/frontend/src/app/insights/loading.tsx` | Skeleton loading state |
| Create | `code/apps/frontend/src/app/insights/insights-category-table.tsx` | Overview table sub-component |
| Create | `code/apps/frontend/src/app/insights/insights-drill-down.tsx` | Per-category detail (stats cards + bar chart) |
| Create | `code/apps/frontend/src/app/insights/insights-ai-chat.tsx` | AI chat box sub-component |

---

## Task 1: Complete budget backend (prerequisite)

The Insights spec requires a Budget column. `monthlyBudget` is not yet on the schema, entity, or repositories — this task adds it.

**Files:**
- Modify: `code/apps/backend/prisma/schema.prisma`
- Modify: `code/apps/backend/src/domain/entities/category.entity.ts`
- Modify: `code/apps/backend/src/infrastructure/repositories/prisma/category.mapper.ts`
- Modify: `code/apps/backend/src/domain/repositories/category.repository.ts`
- Modify: `code/apps/backend/src/infrastructure/repositories/prisma/prisma-category.repository.ts`
- Modify: `code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-category.repository.ts`
- Modify: `code/apps/backend/src/modules/categories/dto/update-category.dto.ts`

- [ ] **Step 1: Add `monthlyBudget` to Prisma Category model**

In `code/apps/backend/prisma/schema.prisma`, replace the Category model:

```prisma
model Category {
  id            String                @id @default(cuid())
  name          String                @unique
  color         String
  monthlyBudget Decimal?              @db.Decimal(10, 2)
  transactions  Transaction[]
  rules         CategoryRule[]
  aiSuggestions ImportedTransaction[] @relation("AiCategory")
}
```

- [ ] **Step 2: Run the migration**

```bash
cd code/apps/backend
npx prisma migrate dev --name add-category-monthly-budget
```

Expected: new migration file created, no data loss.

- [ ] **Step 3: Update `CategoryEntity` to carry `monthlyBudget`**

Replace the full contents of `code/apps/backend/src/domain/entities/category.entity.ts`:

```typescript
import { CategoryRuleEntity } from './category-rule.entity'

export class CategoryEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly color: string,
    public readonly rules: CategoryRuleEntity[],
    public readonly transactionCount: number,
    public readonly monthlyBudget: number | null = null,
  ) {}

  static create(data: { id: string; name: string; color: string }): CategoryEntity {
    return new CategoryEntity(data.id, data.name, data.color, [], 0)
  }

  withRule(rule: CategoryRuleEntity): CategoryEntity {
    return new CategoryEntity(
      this.id, this.name, this.color,
      [...this.rules, rule],
      this.transactionCount,
      this.monthlyBudget,
    )
  }

  withoutRule(ruleId: string): CategoryEntity {
    return new CategoryEntity(
      this.id, this.name, this.color,
      this.rules.filter(r => r.id !== ruleId),
      this.transactionCount,
      this.monthlyBudget,
    )
  }
}
```

- [ ] **Step 4: Update `CategoryMapper` to map `monthlyBudget`**

Replace the full contents of `code/apps/backend/src/infrastructure/repositories/prisma/category.mapper.ts`:

```typescript
import { CategoryEntity } from '../../../domain/entities/category.entity'
import { CategoryRuleEntity } from '../../../domain/entities/category-rule.entity'

export class CategoryMapper {
  static toDomain(p: any): CategoryEntity {
    return new CategoryEntity(
      p.id,
      p.name,
      p.color,
      (p.rules ?? []).map((r: any) => new CategoryRuleEntity(r.id, r.categoryId, r.keyword)),
      p._count?.transactions ?? 0,
      p.monthlyBudget != null ? Number(p.monthlyBudget) : null,
    )
  }

  static ruleToEntity(r: any): CategoryRuleEntity {
    return new CategoryRuleEntity(r.id, r.categoryId, r.keyword)
  }
}
```

- [ ] **Step 5: Extend `CategoryRepository.update()` to accept `monthlyBudget`**

Replace the full contents of `code/apps/backend/src/domain/repositories/category.repository.ts`:

```typescript
import { CategoryEntity } from '../entities/category.entity'
import { CategoryRuleEntity } from '../entities/category-rule.entity'

export abstract class CategoryRepository {
  abstract findAll(): Promise<CategoryEntity[]>
  abstract findById(id: string): Promise<CategoryEntity | null>
  abstract findAllRules(): Promise<CategoryRuleEntity[]>
  abstract save(entity: CategoryEntity): Promise<CategoryEntity>
  abstract update(
    id: string,
    data: Partial<{ name: string; color: string; monthlyBudget: number | null }>,
  ): Promise<CategoryEntity>
  abstract delete(id: string): Promise<void>
  abstract addRule(categoryId: string, keyword: string): Promise<CategoryRuleEntity>
  abstract deleteRule(ruleId: string): Promise<void>
}
```

- [ ] **Step 6: Update `PrismaCategoryRepository.update()` to persist `monthlyBudget`**

Replace only the `update` method in `code/apps/backend/src/infrastructure/repositories/prisma/prisma-category.repository.ts`:

```typescript
  async update(
    id: string,
    data: Partial<{ name: string; color: string; monthlyBudget: number | null }>,
  ): Promise<CategoryEntity> {
    const p = await this.prisma.category.update({
      where: { id },
      data: {
        ...(data.name          !== undefined && { name:          data.name }),
        ...(data.color         !== undefined && { color:         data.color }),
        ...(data.monthlyBudget !== undefined && { monthlyBudget: data.monthlyBudget }),
      },
      include: { rules: true, _count: { select: { transactions: true } } },
    })
    return CategoryMapper.toDomain(p)
  }
```

- [ ] **Step 7: Update `InMemoryCategoryRepository.update()` to persist `monthlyBudget`**

Replace only the `update` method in `code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-category.repository.ts`:

```typescript
  async update(
    id: string,
    data: Partial<{ name: string; color: string; monthlyBudget: number | null }>,
  ): Promise<CategoryEntity> {
    const existing = this.store.get(id)
    if (!existing) throw new Error(`Category ${id} not found`)
    const updated = new CategoryEntity(
      existing.id,
      data.name  ?? existing.name,
      data.color ?? existing.color,
      existing.rules,
      existing.transactionCount,
      data.monthlyBudget !== undefined ? data.monthlyBudget : existing.monthlyBudget,
    )
    this.store.set(id, updated)
    return updated
  }
```

Also update the `save` method in the same file to preserve `monthlyBudget`:

```typescript
  async save(entity: CategoryEntity): Promise<CategoryEntity> {
    const id = entity.id || crypto.randomUUID()
    const persisted = new CategoryEntity(
      id, entity.name, entity.color, entity.rules, entity.transactionCount, entity.monthlyBudget,
    )
    this.store.set(id, persisted)
    return persisted
  }
```

- [ ] **Step 8: Add `monthlyBudget` to `UpdateCategoryDto`**

Replace the full contents of `code/apps/backend/src/modules/categories/dto/update-category.dto.ts`:

```typescript
import { IsString, IsHexColor, IsOptional, MaxLength, IsNumber, Min, ValidateIf } from 'class-validator'

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string

  @IsOptional()
  @IsHexColor()
  color?: string

  @IsOptional()
  @ValidateIf(o => o.monthlyBudget !== null)
  @IsNumber()
  @Min(0)
  monthlyBudget?: number | null
}
```

- [ ] **Step 9: Run tests to verify nothing broken**

```bash
cd code/apps/backend
npm test -- --testPathPattern="src/tests"
```

Expected: all existing tests pass (the `null` default in `CategoryEntity` means no test changes needed for this step).

- [ ] **Step 10: Commit**

```bash
git add code/apps/backend/prisma \
        code/apps/backend/src/domain/entities/category.entity.ts \
        code/apps/backend/src/infrastructure/repositories/prisma/category.mapper.ts \
        code/apps/backend/src/domain/repositories/category.repository.ts \
        code/apps/backend/src/infrastructure/repositories/prisma/prisma-category.repository.ts \
        code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-category.repository.ts \
        code/apps/backend/src/modules/categories/dto/update-category.dto.ts
git commit -m "feat: add monthlyBudget to Category — schema, entity, mapper, repos, DTO"
```

---

## Task 2: Add `chat()` to AIPort and both adapters

**Files:**
- Modify: `code/apps/backend/src/domain/ports/ai.port.ts`
- Modify: `code/apps/backend/src/infrastructure/ai/anthropic.adapter.ts`
- Modify: `code/apps/backend/src/infrastructure/ai/openrouter.adapter.ts`

- [ ] **Step 1: Add `chat` abstract method to `AIPort`**

Replace the full contents of `code/apps/backend/src/domain/ports/ai.port.ts`:

```typescript
export interface ExtractedTransaction {
  date: string
  description: string
  amount: number
}

export abstract class AIPort {
  abstract extractTransactions(buffer: Buffer, mediaType: string): Promise<ExtractedTransaction[]>
  abstract suggestCategory(description: string, categoryNames: string[]): Promise<string | null>
  abstract chat(systemPrompt: string, userMessage: string): Promise<string>

  protected parseResponse(text: string): ExtractedTransaction[] {
    if (!text.trim()) return []
    try {
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) return []
      return parsed.filter(
        (item): item is ExtractedTransaction =>
          typeof item.date === 'string' &&
          typeof item.description === 'string' &&
          typeof item.amount === 'number',
      )
    } catch {
      return []
    }
  }

  protected readonly extractionPrompt = `Extract all transactions from this bank statement or receipt.
Return ONLY a valid JSON array. No other text, no markdown, no explanation.
Format: [{"date":"YYYY-MM-DD","description":"merchant name","amount":-12.50}]
Rules:
- amount is negative for expenses/debits, positive for credits/income
- Use full year in date (if year unclear use ${new Date().getFullYear()})
- Return [] if no transactions found`

  protected readonly categorizationSystem = (categoryNames: string[]) =>
    `You categorize financial transactions. Given a description, return the best matching category name from the list, or "none" if none fits. Return ONLY the category name or "none". No other text.
Categories: ${categoryNames.join(', ')}`
}
```

- [ ] **Step 2: Implement `chat()` in `AnthropicAdapter`**

Add the following method to `code/apps/backend/src/infrastructure/ai/anthropic.adapter.ts`, after the `suggestCategory` method and before the closing `}`:

```typescript
  async chat(systemPrompt: string, userMessage: string): Promise<string> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })
    return message.content[0].type === 'text' ? message.content[0].text : ''
  }
```

- [ ] **Step 3: Implement `chat()` in `OpenRouterAdapter`**

Add the following method to `code/apps/backend/src/infrastructure/ai/openrouter.adapter.ts`, after the `suggestCategory` method and before the closing `}`:

```typescript
  async chat(systemPrompt: string, userMessage: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
    })
    return (response.choices[0]?.message?.content ?? '').trim()
  }
```

- [ ] **Step 4: Run existing tests**

```bash
cd code/apps/backend
npm test -- --testPathPattern="src/tests"
```

Expected: all tests pass (no test uses `chat()` yet — abstract method addition is non-breaking because the concrete impls now satisfy the contract).

- [ ] **Step 5: Commit**

```bash
git add code/apps/backend/src/domain/ports/ai.port.ts \
        code/apps/backend/src/infrastructure/ai/anthropic.adapter.ts \
        code/apps/backend/src/infrastructure/ai/openrouter.adapter.ts
git commit -m "feat: add chat() method to AIPort, AnthropicAdapter, and OpenRouterAdapter"
```

---

## Task 3: InsightsService with unit tests

**Files:**
- Create: `code/apps/backend/src/modules/insights/insights.service.ts`
- Create: `code/apps/backend/src/tests/insights.service.spec.ts`

- [ ] **Step 1: Write the failing tests first**

Create `code/apps/backend/src/tests/insights.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing'
import { InsightsService } from '../modules/insights/insights.service'
import { TransactionRepository } from '../domain/repositories/transaction.repository'
import { CategoryRepository } from '../domain/repositories/category.repository'
import { InMemoryTransactionRepository } from '../infrastructure/repositories/in-memory/in-memory-transaction.repository'
import { InMemoryCategoryRepository } from '../infrastructure/repositories/in-memory/in-memory-category.repository'
import { TransactionEntity } from '../domain/entities/transaction.entity'
import { CategoryEntity } from '../domain/entities/category.entity'
import { SettingsService } from '../modules/settings/settings.service'
import { AIPort } from '../domain/ports/ai.port'

const mockAI: AIPort = {
  extractTransactions: jest.fn(),
  suggestCategory: jest.fn(),
  chat: jest.fn().mockResolvedValue('Groceries went up this month.'),
} as any

const mockSettings = {
  createAIPort: jest.fn().mockResolvedValue(mockAI),
} as any

describe('InsightsService', () => {
  let service: InsightsService
  let txRepo: InMemoryTransactionRepository
  let catRepo: InMemoryCategoryRepository

  beforeEach(async () => {
    txRepo = new InMemoryTransactionRepository()
    catRepo = new InMemoryCategoryRepository()

    const module = await Test.createTestingModule({
      providers: [
        InsightsService,
        { provide: TransactionRepository, useValue: txRepo },
        { provide: CategoryRepository,    useValue: catRepo },
        { provide: SettingsService,       useValue: mockSettings },
      ],
    }).compile()

    service = module.get(InsightsService)
  })

  async function saveCat(name: string, color = '#34d399', monthlyBudget: number | null = null) {
    return catRepo.save(new CategoryEntity('', name, color, [], 0, monthlyBudget))
  }

  async function saveTx(date: string, categoryId: string | null, amount = -100) {
    return txRepo.save(new TransactionEntity(
      '', amount, new Date(date), 'Test', 'manual', categoryId, null, null, null, new Date(),
    ))
  }

  // ── getCategoryTrends ────────────────────────────────────────────
  describe('getCategoryTrends', () => {
    it('returns 3 months of data per category', async () => {
      const cat = await saveCat('Groceries')
      await saveTx('2026-02-15', cat.id, -100)
      await saveTx('2026-03-15', cat.id, -200)
      await saveTx('2026-04-15', cat.id, -150)

      const result = await service.getCategoryTrends(2026, 4)

      const row = result.categories.find(c => c.name === 'Groceries')!
      expect(row.months).toHaveLength(3)
      expect(row.months[0]).toMatchObject({ label: 'Feb', total: 100 })
      expect(row.months[1]).toMatchObject({ label: 'Mar', total: 200 })
      expect(row.months[2]).toMatchObject({ label: 'Apr', total: 150 })
    })

    it('returns 0 for months with no transactions', async () => {
      await saveCat('Rent')

      const result = await service.getCategoryTrends(2026, 4)

      const row = result.categories.find(c => c.name === 'Rent')!
      row.months.forEach(m => expect(m.total).toBe(0))
    })

    it('calculates delta as % change from previous to current month', async () => {
      const cat = await saveCat('Transport')
      await saveTx('2026-03-10', cat.id, -100)
      await saveTx('2026-04-10', cat.id, -150)

      const result = await service.getCategoryTrends(2026, 4)

      const row = result.categories.find(c => c.name === 'Transport')!
      expect(row.delta).toBe(50) // (150-100)/100 * 100 = 50%
    })

    it('returns null delta when previous month is zero', async () => {
      const cat = await saveCat('Dining')
      await saveTx('2026-04-10', cat.id, -80)

      const result = await service.getCategoryTrends(2026, 4)

      const row = result.categories.find(c => c.name === 'Dining')!
      expect(row.delta).toBeNull()
    })

    it('includes monthlyBudget from category', async () => {
      await saveCat('Rent', '#818cf8', 1200)

      const result = await service.getCategoryTrends(2026, 4)

      const row = result.categories.find(c => c.name === 'Rent')!
      expect(row.monthlyBudget).toBe(1200)
    })

    it('wraps correctly across year boundary (January)', async () => {
      await saveCat('Groceries')

      const result = await service.getCategoryTrends(2026, 1)

      const row = result.categories[0]
      expect(row.months[0]).toMatchObject({ year: 2025, month: 11, label: 'Nov' })
      expect(row.months[1]).toMatchObject({ year: 2025, month: 12, label: 'Dec' })
      expect(row.months[2]).toMatchObject({ year: 2026, month: 1,  label: 'Jan' })
    })
  })

  // ── chat ─────────────────────────────────────────────────────────
  describe('chat', () => {
    it('returns a reply from the AI', async () => {
      const context = {
        year: 2026, month: 4,
        categories: [{ name: 'Groceries', months: [{ label: 'Apr', total: 100 }], monthlyBudget: null, delta: null }],
      }
      const result = await service.chat('Why did groceries go up?', context)
      expect(result.reply).toBe('Groceries went up this month.')
    })

    it('calls AI with a system prompt that contains the month name', async () => {
      ;(mockAI.chat as jest.Mock).mockClear()
      const context = {
        year: 2026, month: 4,
        categories: [{ name: 'Transport', months: [{ label: 'Apr', total: 50 }], monthlyBudget: 100, delta: -20 }],
      }
      await service.chat('How am I doing?', context)
      const [systemPrompt] = (mockAI.chat as jest.Mock).mock.calls[0]
      expect(systemPrompt).toContain('April 2026')
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd code/apps/backend
npm test -- --testPathPattern="insights.service"
```

Expected: FAIL — `InsightsService` does not exist yet.

- [ ] **Step 3: Create `InsightsService`**

Create `code/apps/backend/src/modules/insights/insights.service.ts`:

```typescript
import { Injectable } from '@nestjs/common'
import { format, subMonths } from 'date-fns'
import { TransactionRepository } from '../../domain/repositories/transaction.repository'
import { CategoryRepository } from '../../domain/repositories/category.repository'
import { SettingsService } from '../settings/settings.service'

export interface InsightMonth {
  year: number
  month: number
  label: string
  total: number
}

export interface InsightsCategory {
  categoryId: string
  name: string
  color: string
  monthlyBudget: number | null
  months: InsightMonth[]
  delta: number | null
}

@Injectable()
export class InsightsService {
  constructor(
    private readonly txRepo: TransactionRepository,
    private readonly catRepo: CategoryRepository,
    private readonly settings: SettingsService,
  ) {}

  async getCategoryTrends(year: number, month: number): Promise<{ categories: InsightsCategory[] }> {
    const reference = new Date(year, month - 1)
    const monthDates = [
      subMonths(reference, 2),
      subMonths(reference, 1),
      reference,
    ]

    const [s0, s1, s2, categories] = await Promise.all([
      this.txRepo.groupByCategory(monthDates[0].getFullYear(), monthDates[0].getMonth() + 1),
      this.txRepo.groupByCategory(monthDates[1].getFullYear(), monthDates[1].getMonth() + 1),
      this.txRepo.groupByCategory(monthDates[2].getFullYear(), monthDates[2].getMonth() + 1),
      this.catRepo.findAll(),
    ])

    const spendMaps = [s0, s1, s2].map(rows =>
      Object.fromEntries(rows.map(r => [r.categoryId ?? '', r.total]))
    )

    return {
      categories: categories.map(cat => {
        const months: InsightMonth[] = monthDates.map((d, i) => ({
          year:  d.getFullYear(),
          month: d.getMonth() + 1,
          label: format(d, 'MMM'),
          total: spendMaps[i][cat.id] ?? 0,
        }))
        const prev  = months[1].total
        const curr  = months[2].total
        const delta = prev === 0 ? null : Math.round(((curr - prev) / prev) * 100)
        return {
          categoryId:   cat.id,
          name:         cat.name,
          color:        cat.color,
          monthlyBudget: cat.monthlyBudget,
          months,
          delta,
        }
      }),
    }
  }

  async chat(
    message: string,
    context: {
      year: number
      month: number
      categories: Array<{
        name: string
        months: { label: string; total: number }[]
        monthlyBudget: number | null
        delta: number | null
      }>
    },
  ): Promise<{ reply: string }> {
    const contextText = context.categories
      .map(c => {
        const monthStr = c.months.map(m => `${m.label}: £${m.total.toFixed(2)}`).join(', ')
        const budget   = c.monthlyBudget != null ? `Budget: £${c.monthlyBudget}` : 'No budget'
        const delta    = c.delta != null ? `Trend: ${c.delta > 0 ? '+' : ''}${c.delta}%` : ''
        return `${c.name}: ${monthStr}. ${budget}. ${delta}`.trim()
      })
      .join('\n')

    const monthLabel = format(new Date(context.year, context.month - 1), 'MMMM yyyy')
    const systemPrompt = `You are a helpful personal finance assistant. The user is viewing their spending data for ${monthLabel}. Here is their spending breakdown:\n\n${contextText}\n\nAnswer concisely (2-4 sentences). Reference specific numbers from the data when relevant.`

    const ai    = await this.settings.createAIPort()
    const reply = await ai.chat(systemPrompt, message)
    return { reply }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd code/apps/backend
npm test -- --testPathPattern="insights.service"
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add code/apps/backend/src/modules/insights/insights.service.ts \
        code/apps/backend/src/tests/insights.service.spec.ts
git commit -m "feat: InsightsService — getCategoryTrends and chat with tests"
```

---

## Task 4: InsightsController + Module + wire AppModule

**Files:**
- Create: `code/apps/backend/src/modules/insights/dto/insights-query.dto.ts`
- Create: `code/apps/backend/src/modules/insights/dto/insights-chat.dto.ts`
- Create: `code/apps/backend/src/modules/insights/insights.controller.ts`
- Create: `code/apps/backend/src/modules/insights/insights.module.ts`
- Modify: `code/apps/backend/src/app.module.ts`

- [ ] **Step 1: Create DTOs**

Create `code/apps/backend/src/modules/insights/dto/insights-query.dto.ts`:

```typescript
import { IsOptional, IsNumberString } from 'class-validator'

export class InsightsQueryDto {
  @IsOptional()
  @IsNumberString()
  year?: string

  @IsOptional()
  @IsNumberString()
  month?: string
}
```

Create `code/apps/backend/src/modules/insights/dto/insights-chat.dto.ts`:

```typescript
import { IsString, IsNotEmpty, IsObject } from 'class-validator'

export class InsightsChatDto {
  @IsString()
  @IsNotEmpty()
  message: string

  @IsObject()
  context: {
    year: number
    month: number
    categories: Array<{
      name: string
      months: { label: string; total: number }[]
      monthlyBudget: number | null
      delta: number | null
    }>
  }
}
```

- [ ] **Step 2: Create `InsightsController`**

Create `code/apps/backend/src/modules/insights/insights.controller.ts`:

```typescript
import { Controller, Get, Post, Query, Body } from '@nestjs/common'
import { InsightsService } from './insights.service'
import { InsightsQueryDto } from './dto/insights-query.dto'
import { InsightsChatDto } from './dto/insights-chat.dto'

@Controller('insights')
export class InsightsController {
  constructor(private readonly service: InsightsService) {}

  @Get('categories')
  getCategoryTrends(@Query() query: InsightsQueryDto) {
    const now = new Date()
    return this.service.getCategoryTrends(
      query.year  ? Number(query.year)  : now.getFullYear(),
      query.month ? Number(query.month) : now.getMonth() + 1,
    )
  }

  @Post('chat')
  chat(@Body() dto: InsightsChatDto) {
    return this.service.chat(dto.message, dto.context)
  }
}
```

- [ ] **Step 3: Create `InsightsModule`**

Create `code/apps/backend/src/modules/insights/insights.module.ts`:

```typescript
import { Module } from '@nestjs/common'
import { InsightsController } from './insights.controller'
import { InsightsService } from './insights.service'
import { TransactionRepository } from '../../domain/repositories/transaction.repository'
import { CategoryRepository } from '../../domain/repositories/category.repository'
import { PrismaTransactionRepository } from '../../infrastructure/repositories/prisma/prisma-transaction.repository'
import { PrismaCategoryRepository } from '../../infrastructure/repositories/prisma/prisma-category.repository'
import { SettingsModule } from '../settings/settings.module'

@Module({
  imports: [SettingsModule],
  controllers: [InsightsController],
  providers: [
    InsightsService,
    { provide: TransactionRepository, useClass: PrismaTransactionRepository },
    { provide: CategoryRepository,    useClass: PrismaCategoryRepository    },
  ],
})
export class InsightsModule {}
```

- [ ] **Step 4: Add `InsightsModule` to `AppModule`**

In `code/apps/backend/src/app.module.ts`, add the import at the top and in the `imports` array:

```typescript
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
```

- [ ] **Step 5: Run all tests**

```bash
cd code/apps/backend
npm test -- --testPathPattern="src/tests"
```

Expected: all tests pass.

- [ ] **Step 6: Smoke test the endpoint**

Start the backend and verify the route exists:

```bash
cd code/apps/backend && npm run start:dev
# in another terminal:
curl "http://localhost:3001/api/insights/categories?year=2026&month=4"
```

Expected: JSON with `{ categories: [...] }`.

- [ ] **Step 7: Commit**

```bash
git add code/apps/backend/src/modules/insights \
        code/apps/backend/src/app.module.ts
git commit -m "feat: InsightsModule, InsightsController, DTOs — /api/insights/categories and /api/insights/chat"
```

---

## Task 5: Frontend API client + sidebar nav

**Files:**
- Modify: `code/apps/frontend/src/lib/api.ts`
- Modify: `code/apps/frontend/src/components/sidebar.tsx`

- [ ] **Step 1: Add `insights` to the API client**

In `code/apps/frontend/src/lib/api.ts`, add the insights section inside the `api` object, after the `settings` block:

```typescript
  insights: {
    categories: (year: number, month: number) =>
      get<{
        categories: Array<{
          categoryId: string
          name: string
          color: string
          monthlyBudget: number | null
          months: Array<{ year: number; month: number; label: string; total: number }>
          delta: number | null
        }>
      }>('/insights/categories', { year, month }),

    chat: (message: string, context: {
      year: number
      month: number
      categories: Array<{
        name: string
        months: { label: string; total: number }[]
        monthlyBudget: number | null
        delta: number | null
      }>
    }) => post<{ reply: string }>('/insights/chat', { message, context }),
  },
```

- [ ] **Step 2: Add "Insights" nav item to sidebar**

In `code/apps/frontend/src/components/sidebar.tsx`, add `BarChart3` to the Lucide import line:

```typescript
import {
  LayoutDashboard,
  CreditCard,
  Upload,
  Inbox,
  Tag,
  Settings,
  BarChart3,
} from 'lucide-react'
```

In the `sections` array, add Insights between Dashboard and Transactions:

```typescript
      items: [
        { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
        { href: '/insights',     label: 'Insights',     icon: BarChart3       },
        { href: '/transactions', label: 'Transactions', icon: CreditCard      },
      ],
```

- [ ] **Step 3: Commit**

```bash
git add code/apps/frontend/src/lib/api.ts \
        code/apps/frontend/src/components/sidebar.tsx
git commit -m "feat: add insights API methods and Insights sidebar nav item"
```

---

## Task 6: InsightsCategoryTable component

**Files:**
- Create: `code/apps/frontend/src/app/insights/insights-category-table.tsx`

- [ ] **Step 1: Create `insights-category-table.tsx`**

Create `code/apps/frontend/src/app/insights/insights-category-table.tsx`:

```tsx
import { CurrencyAmount } from '@/components/currency-amount'

type InsightMonth = { year: number; month: number; label: string; total: number }

type InsightRow = {
  categoryId: string
  name: string
  color: string
  monthlyBudget: number | null
  months: InsightMonth[]
  delta: number | null
}

type Props = {
  categories: InsightRow[]
  currentMonthLabel: string
  onRowClick: (row: InsightRow) => void
}

function SparklineBar({ months, color }: { months: InsightMonth[]; color: string }) {
  const max = Math.max(...months.map(m => m.total), 1)
  const opacities = [0.35, 0.65, 1]
  return (
    <div className="flex items-end gap-0.5" style={{ height: 20, width: 36 }}>
      {months.map((m, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${Math.max((m.total / max) * 100, 4)}%`,
            background: color,
            opacity: opacities[i],
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  )
}

function BudgetCell({ total, budget, color }: { total: number; budget: number | null; color: string }) {
  if (budget === null) {
    return <span style={{ color: 'var(--text-3)' }}>—</span>
  }
  const pct     = Math.min((total / budget) * 100, 100)
  const isOver  = total > budget
  const isNear  = !isOver && pct >= 90
  const barColor = isOver ? 'var(--red)' : isNear ? '#f59e0b' : color
  const left     = budget - total

  return (
    <div style={{ minWidth: 140 }}>
      <div
        className="h-1 rounded-full overflow-hidden mb-1"
        style={{ background: isOver ? '#f8717120' : 'var(--surface-2)' }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      <span
        className="text-xs"
        style={{ color: isOver ? 'var(--red)' : isNear ? '#f59e0b' : 'var(--text-2)' }}
      >
        {isOver
          ? <><CurrencyAmount amount={Math.abs(left)} /> over budget</>
          : <><CurrencyAmount amount={left} /> left{isNear ? ` — ${Math.round(pct)}%` : ''}</>
        }
      </span>
    </div>
  )
}

export function InsightsCategoryTable({ categories, currentMonthLabel, onRowClick }: Props) {
  if (categories.length === 0) {
    return (
      <div
        className="rounded-xl px-6 py-12 text-center"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>
          No categories yet — import or add transactions to see insights.
        </p>
      </div>
    )
  }

  const [prevPrev, prev, curr] = categories[0]?.months ?? []
  const colLabels = [prevPrev?.label ?? '', prev?.label ?? '', curr?.label ?? currentMonthLabel]

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {/* Header row */}
      <div
        className="grid items-center px-5 py-2.5 text-xs font-semibold uppercase tracking-wider"
        style={{
          gridTemplateColumns: '200px 120px 120px 120px 160px 1fr 80px',
          color: 'var(--text-3)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span>Category</span>
        <span>{colLabels[0]}</span>
        <span>{colLabels[1]}</span>
        <span style={{ color: 'var(--text)' }}>{colLabels[2]}</span>
        <span>Budget</span>
        <span />
        <span className="text-right">Trend</span>
      </div>

      {/* Data rows */}
      {categories.map(row => {
        const allZero = row.months.every(m => m.total === 0)
        return (
          <div
            key={row.categoryId}
            className="grid items-center px-5 py-3.5 cursor-pointer transition-colors"
            style={{
              gridTemplateColumns: '200px 120px 120px 120px 160px 1fr 80px',
              borderBottom: '1px solid var(--border)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => onRowClick(row)}
          >
            {/* Category name */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: row.color }} />
              <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                {row.name}
              </span>
            </div>

            {/* Month totals */}
            {row.months.map((m, i) => (
              <span
                key={i}
                className="text-sm tabular-nums"
                style={{ color: i === 2 ? 'var(--text)' : 'var(--text-2)', fontWeight: i === 2 ? 600 : 400 }}
              >
                {m.total > 0 ? <CurrencyAmount amount={m.total} /> : <span style={{ color: 'var(--text-3)' }}>—</span>}
              </span>
            ))}

            {/* Budget */}
            <BudgetCell total={row.months[2].total} budget={row.monthlyBudget} color={row.color} />

            {/* Spacer */}
            <span />

            {/* Trend */}
            <div className="flex items-center justify-end gap-2">
              {allZero ? (
                <span style={{ color: 'var(--text-3)' }}>—</span>
              ) : (
                <>
                  <SparklineBar months={row.months} color={row.color} />
                  {row.delta !== null && (
                    <span
                      className="text-xs font-semibold tabular-nums"
                      style={{ color: row.delta > 0 ? 'var(--red)' : '#22c55e', minWidth: 40, textAlign: 'right' }}
                    >
                      {row.delta > 0 ? '+' : ''}{row.delta}%
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add code/apps/frontend/src/app/insights/insights-category-table.tsx
git commit -m "feat: InsightsCategoryTable — 3-month spending overview with budget and sparkline"
```

---

## Task 7: InsightsDrillDown component

**Files:**
- Create: `code/apps/frontend/src/app/insights/insights-drill-down.tsx`

- [ ] **Step 1: Create `insights-drill-down.tsx`**

Create `code/apps/frontend/src/app/insights/insights-drill-down.tsx`:

```tsx
'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { CurrencyAmount } from '@/components/currency-amount'

type InsightMonth = { year: number; month: number; label: string; total: number }

type InsightRow = {
  categoryId: string
  name: string
  color: string
  monthlyBudget: number | null
  months: InsightMonth[]
  delta: number | null
}

type Props = {
  row: InsightRow
  onBack: () => void
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div
      className="rounded-xl px-5 py-4 flex flex-col gap-1"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
        {label}
      </span>
      <span className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{value}</span>
      {sub && <span className="text-xs" style={{ color: 'var(--text-2)' }}>{sub}</span>}
    </div>
  )
}

export function InsightsDrillDown({ row, onBack }: Props) {
  const totals   = row.months.map(m => m.total)
  const sum      = totals.reduce((a, b) => a + b, 0)
  const avg      = sum / 3
  const maxTotal = Math.max(...totals)
  const bigMonth = row.months.find(m => m.total === maxTotal)!
  const curr     = row.months[2]
  const isOver   = row.monthlyBudget != null && curr.total > row.monthlyBudget
  const opacities = [0.3, 0.55, 1]

  return (
    <div className="space-y-5">
      {/* Back link + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-sm flex items-center gap-1"
          style={{ color: 'var(--text-2)' }}
        >
          ← Insights
        </button>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: row.color }} />
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{row.name}</h1>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="3-Month Total"
          value={<CurrencyAmount amount={sum} />}
        />
        <StatCard
          label="Monthly Average"
          value={<CurrencyAmount amount={avg} />}
        />
        <StatCard
          label="Biggest Month"
          value={<CurrencyAmount amount={maxTotal} />}
          sub={bigMonth.label}
        />
        <StatCard
          label="Monthly Budget"
          value={
            row.monthlyBudget != null
              ? <CurrencyAmount amount={row.monthlyBudget} />
              : <span className="text-base" style={{ color: 'var(--text-2)' }}>No budget set</span>
          }
          sub={
            row.monthlyBudget != null
              ? <span style={{ color: isOver ? 'var(--red)' : '#22c55e' }}>
                  {isOver ? 'Over budget' : 'Under budget'}
                </span>
              : <a href="/categories" className="underline" style={{ color: 'var(--accent)' }}>
                  Set budget →
                </a>
          }
        />
      </div>

      {/* Bar chart */}
      <div
        className="rounded-xl px-5 pt-5 pb-4 relative"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {/* Delta tag */}
        {row.delta !== null && (
          <div
            className="absolute top-4 right-4 px-2 py-1 rounded-md text-xs font-semibold"
            style={{
              background: row.delta > 0 ? '#f8717120' : '#22c55e20',
              color: row.delta > 0 ? 'var(--red)' : '#22c55e',
            }}
          >
            {row.delta > 0 ? '+' : ''}{row.delta}% vs last month
          </div>
        )}

        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={row.months} barCategoryGap="30%">
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={({ x, y, payload, index }) => (
                <text
                  x={x} y={y + 14}
                  textAnchor="middle"
                  fontSize={12}
                  fill={index === 2 ? row.color : 'var(--text-3)'}
                  fontWeight={index === 2 ? 600 : 400}
                >
                  {payload.value}
                </text>
              )}
            />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                return (
                  <div
                    className="px-3 py-2 rounded-lg text-xs"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  >
                    <CurrencyAmount amount={payload[0].value as number} />
                  </div>
                )
              }}
            />
            <Bar dataKey="total" radius={[4, 4, 0, 0]}>
              {row.months.map((_, i) => (
                <Cell key={i} fill={row.color} fillOpacity={opacities[i]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add code/apps/frontend/src/app/insights/insights-drill-down.tsx
git commit -m "feat: InsightsDrillDown — stats cards and bar chart for per-category detail"
```

---

## Task 8: InsightsAIChat component

**Files:**
- Create: `code/apps/frontend/src/app/insights/insights-ai-chat.tsx`

- [ ] **Step 1: Create `insights-ai-chat.tsx`**

Create `code/apps/frontend/src/app/insights/insights-ai-chat.tsx`:

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { api } from '@/lib/api'

type Message = { role: 'user' | 'assistant'; text: string }

type Context = {
  year: number
  month: number
  categories: Array<{
    name: string
    months: { label: string; total: number }[]
    monthlyBudget: number | null
    delta: number | null
  }>
}

type Props = {
  context: Context
  topMoverName: string | null
}

export function InsightsAIChat({ context, topMoverName }: Props) {
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const bottomRef                 = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const chips = [
    topMoverName ? `Why did ${topMoverName} spike?` : 'Which category changed the most?',
    'Where can I cut back?',
    'Compare to last month',
  ]

  async function send(text: string) {
    if (!text.trim() || loading) return
    setInput('')
    setError(null)
    setMessages(prev => [...prev, { role: 'user', text }])
    setLoading(true)
    try {
      const { reply } = await api.insights.chat(text, context)
      setMessages(prev => [...prev, { role: 'assistant', text: reply }])
    } catch {
      setError("Couldn't reach AI — check your API key in Settings")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-5 py-3.5"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span
          className="text-xs font-bold px-2 py-0.5 rounded"
          style={{ background: '#f59e0b20', color: 'var(--accent)' }}
        >
          AI
        </span>
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Ask about your spending
        </span>
      </div>

      {/* Suggestion chips */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 px-5 pt-4 pb-2">
          {chips.map(chip => (
            <button
              key={chip}
              onClick={() => send(chip)}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-full transition-colors disabled:opacity-40"
              style={{
                background: 'var(--surface-2)',
                border:     '1px solid var(--border)',
                color:      'var(--text-2)',
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Message history */}
      {messages.length > 0 && (
        <div className="px-5 py-4 space-y-3 max-h-64 overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm"
                style={
                  m.role === 'user'
                    ? { background: 'var(--accent)', color: '#0c0c0e', borderBottomRightRadius: 4 }
                    : { background: 'var(--surface-2)', color: 'var(--text)', borderBottomLeftRadius: 4 }
                }
              >
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div
                className="px-3.5 py-2.5 rounded-2xl text-sm"
                style={{ background: 'var(--surface-2)', color: 'var(--text-2)', borderBottomLeftRadius: 4 }}
              >
                …
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="px-5 pb-2 text-xs" style={{ color: 'var(--red)' }}>{error}</p>
      )}

      {/* Input row */}
      <div className="flex items-center gap-2 px-5 py-3.5">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send(input)}
          placeholder="Ask anything about your finances…"
          disabled={loading}
          className="flex-1 rounded-full px-4 py-2 text-sm outline-none disabled:opacity-50"
          style={{
            background: 'var(--surface-2)',
            border:     '1px solid var(--border)',
            color:      'var(--text)',
          }}
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || loading}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#0c0c0e', flexShrink: 0 }}
        >
          {loading ? (
            <span className="text-xs">…</span>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add code/apps/frontend/src/app/insights/insights-ai-chat.tsx
git commit -m "feat: InsightsAIChat — suggestion chips, message history, and send button"
```

---

## Task 9: InsightsPage root component + loading skeleton

**Files:**
- Create: `code/apps/frontend/src/app/insights/page.tsx`
- Create: `code/apps/frontend/src/app/insights/loading.tsx`

- [ ] **Step 1: Create `loading.tsx`**

Create `code/apps/frontend/src/app/insights/loading.tsx`:

```tsx
export default function InsightsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-36 rounded-lg mb-1" style={{ background: 'var(--surface-2)' }} />
          <div className="h-4 w-56 rounded-lg"         style={{ background: 'var(--surface-2)' }} />
        </div>
        <div className="h-8 w-40 rounded-lg"           style={{ background: 'var(--surface-2)' }} />
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="w-2 h-2 rounded-full"    style={{ background: 'var(--surface-2)', flexShrink: 0 }} />
            <div className="h-4 w-28 rounded"        style={{ background: 'var(--surface-2)' }} />
            <div className="h-4 w-16 rounded ml-auto" style={{ background: 'var(--surface-2)' }} />
            <div className="h-4 w-16 rounded"        style={{ background: 'var(--surface-2)' }} />
            <div className="h-4 w-16 rounded"        style={{ background: 'var(--surface-2)' }} />
          </div>
        ))}
      </div>

      {/* Chat skeleton */}
      <div className="h-32 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />
    </div>
  )
}
```

- [ ] **Step 2: Create `page.tsx`**

Create `code/apps/frontend/src/app/insights/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'
import { InsightsCategoryTable } from './insights-category-table'
import { InsightsDrillDown }     from './insights-drill-down'
import { InsightsAIChat }        from './insights-ai-chat'

type InsightMonth = { year: number; month: number; label: string; total: number }
type InsightRow = {
  categoryId: string; name: string; color: string
  monthlyBudget: number | null; months: InsightMonth[]; delta: number | null
}

export default function InsightsPage() {
  const now = new Date()
  const [year, setYear]           = useState(now.getFullYear())
  const [month, setMonth]         = useState(now.getMonth() + 1)
  const [categories, setCategories] = useState<InsightRow[]>([])
  const [selected, setSelected]   = useState<InsightRow | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    setSelected(null)
    api.insights.categories(year, month)
      .then(data => setCategories(data.categories))
      .catch(() => setError('Failed to load insights'))
      .finally(() => setIsLoading(false))
  }, [year, month])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const monthLabel = new Date(year, month - 1).toLocaleString('default', { month: 'short', year: 'numeric' })
  const currentMonthLabel = new Date(year, month - 1).toLocaleString('default', { month: 'short' })

  // Top mover = category with largest absolute delta
  const topMover = categories
    .filter(c => c.delta !== null)
    .sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!))
    [0] ?? null

  const chatContext = {
    year, month,
    categories: categories.map(c => ({
      name: c.name,
      months: c.months.map(m => ({ label: m.label, total: m.total })),
      monthlyBudget: c.monthlyBudget,
      delta: c.delta,
    })),
  }

  if (isLoading) return null // loading.tsx handles skeleton
  if (error) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-sm" style={{ color: 'var(--text-2)' }}>{error}</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {selected ? (
        <InsightsDrillDown row={selected} onBack={() => setSelected(null)} />
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Insights</h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>
                3-month spending breakdown by category
              </p>
            </div>

            {/* Month picker */}
            <div
              className="flex items-center gap-1 rounded-lg px-1 py-1"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-md transition-colors"
                style={{ color: 'var(--text-2)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-sm font-medium px-2" style={{ color: 'var(--text)', minWidth: 80, textAlign: 'center' }}>
                {monthLabel}
              </span>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-md transition-colors"
                style={{ color: 'var(--text-2)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <InsightsCategoryTable
            categories={categories}
            currentMonthLabel={currentMonthLabel}
            onRowClick={setSelected}
          />
        </>
      )}

      {/* AI Chat — always visible */}
      <InsightsAIChat
        context={chatContext}
        topMoverName={topMover?.name ?? null}
      />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add code/apps/frontend/src/app/insights/page.tsx \
        code/apps/frontend/src/app/insights/loading.tsx
git commit -m "feat: InsightsPage — overview/drill-down state, month picker, and AI chat wired up"
```

---

## Task 10: End-to-end smoke test in browser

- [ ] **Step 1: Start both servers**

```bash
# Terminal 1
cd code && docker compose up -d

# Terminal 2
cd code/apps/backend && npm run start:dev

# Terminal 3
cd code/apps/frontend && npm run dev
```

- [ ] **Step 2: Check navigation**

Open `http://localhost:3000`. Verify "Insights" appears in the sidebar between Dashboard and Transactions.

- [ ] **Step 3: Check overview table**

Navigate to `/insights`. Verify:
- Table shows all categories
- Feb, Mar, Apr (or current 3-month window) columns with amounts
- Budget column shows `—` for categories without a budget
- Trend column shows sparkline bars

- [ ] **Step 4: Set a budget via categories page, then re-check**

Go to `/categories`, expand any category, set a monthly budget (e.g. £200). Return to `/insights` and verify the Budget column now shows the progress bar with "£X left" or "£X over budget" text.

- [ ] **Step 5: Check drill-down**

Click any category row. Verify:
- `← Insights` back link
- 4 stats cards (3-Month Total, Monthly Average, Biggest Month, Monthly Budget)
- Bar chart with 3 bars at different opacities

- [ ] **Step 6: Check AI chat**

In the chat box, click a suggestion chip. Verify the message appears in the history and a response arrives. Try typing a custom question.

- [ ] **Step 7: Final commit if any browser fixes needed**

```bash
git add -p  # stage only changed files
git commit -m "fix: insights page browser fixes"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| `/insights` route with sidebar nav | Tasks 4, 5 |
| Month picker (← Apr 2026 →) | Task 9 |
| Category table — 3-month columns | Tasks 3, 6 |
| Budget column with progress bar + status text | Tasks 1, 6 |
| Trend column — 3-bar sparkline + delta % | Task 6 |
| Clicking row opens drill-down | Task 9 |
| Drill-down: back link + 4 stats cards | Task 7 |
| Drill-down: bar chart with delta tag | Task 7 |
| AI chat box with suggestion chips | Task 8 |
| Top mover chip uses actual category name | Task 8, 9 |
| AI chat sends spending context | Tasks 3, 9 |
| Error state for AI failure | Task 8 |
| Empty state (no data) | Task 6 |
| No budget → `—` + "No budget set" + link | Tasks 6, 7 |
| Loading skeleton | Task 9 |
| No dashboard changes | (no dashboard files touched) |

**Placeholder scan:** No TBD, TODO, or "similar to" references found. All steps contain complete code.

**Type consistency check:**
- `InsightMonth` and `InsightRow` defined in `page.tsx` and matched by `insights-category-table.tsx`, `insights-drill-down.tsx`. Both sub-components import what they need from their own local type declarations — consistent shapes.
- `api.insights.categories()` return type matches `InsightsCategory` from `InsightsService`.
- `api.insights.chat(message, context)` — context type in `api.ts` matches `InsightsChatDto.context` field shape.
- `monthlyBudget: number | null` used consistently from schema → entity → mapper → service → API response → frontend.
- `SettingsService.createAIPort()` used in `InsightsService` (same pattern as `ImportService` — confirmed by reading both).
