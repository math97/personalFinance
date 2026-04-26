# Recurring Transactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-detect recurring transactions from import history, surface predicted upcoming expenses on the Dashboard and Transactions page, and let users confirm or dismiss predictions.

**Architecture:** A new `RecurringPattern` Prisma model stores detected patterns. `RecurringService` runs a silent scan after every import batch is confirmed. The Dashboard summary endpoint is extended to include `upcoming` items and `dailyTotals` for the new two-view chart. The Transactions page fetches upcoming items separately and merges predicted rows into the real list.

**Tech Stack:** NestJS, Prisma v5, PostgreSQL, Next.js 14 (App Router), TypeScript, Recharts, date-fns, class-validator. Test runner: Vitest (`npm test` from `code/apps/backend`).

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Modify | `code/apps/backend/prisma/schema.prisma` | Add `RecurringPattern` model |
| Create | `code/apps/backend/src/domain/entities/recurring-pattern.entity.ts` | Domain entity |
| Create | `code/apps/backend/src/domain/repositories/recurring-pattern.repository.ts` | Abstract repo |
| Create | `code/apps/backend/src/infrastructure/repositories/prisma/prisma-recurring-pattern.repository.ts` | Prisma impl |
| Create | `code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-recurring-pattern.repository.ts` | In-memory impl for tests |
| Modify | `code/apps/backend/src/domain/repositories/transaction.repository.ts` | Add `dailyTotals()` + `findAllExpensesByDateRange()` |
| Modify | `code/apps/backend/src/infrastructure/repositories/prisma/prisma-transaction.repository.ts` | Implement new methods |
| Modify | `code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-transaction.repository.ts` | Implement new methods |
| Create | `code/apps/backend/src/modules/recurring/recurring.service.ts` | `detect()`, `getUpcoming()`, `dismissPattern()`, `getDailyTotals()` |
| Create | `code/apps/backend/src/modules/recurring/recurring.controller.ts` | GET /recurring/upcoming, DELETE /recurring/patterns/:id |
| Create | `code/apps/backend/src/modules/recurring/recurring.module.ts` | NestJS wiring, exports RecurringService |
| Create | `code/apps/backend/src/modules/recurring/dto/recurring-query.dto.ts` | Query DTO |
| Create | `code/apps/backend/src/tests/recurring.service.spec.ts` | Unit tests |
| Modify | `code/apps/backend/src/modules/import/import.service.ts` | Call `detect()` after `confirmBatch()` |
| Modify | `code/apps/backend/src/modules/import/import.module.ts` | Import `RecurringModule` |
| Modify | `code/apps/backend/src/modules/dashboard/dashboard.service.ts` | Add `upcoming` + `dailyTotals` to `getSummary()` |
| Modify | `code/apps/backend/src/modules/dashboard/dashboard.module.ts` | Import `RecurringModule` |
| Modify | `code/apps/backend/src/app.module.ts` | Add `RecurringModule` |
| Modify | `code/apps/frontend/src/lib/api.ts` | Add `recurring.*` methods, extend dashboard type |
| Modify | `code/apps/frontend/src/app/dashboard/page.tsx` | 2 new cards + UpcomingPanel + ChartsToggleCard |
| Create | `code/apps/frontend/src/components/upcoming-panel.tsx` | Upcoming this month panel |
| Create | `code/apps/frontend/src/components/charts-toggle-card.tsx` | View 1 / View 2 toggle wrapper |
| Create | `code/apps/frontend/src/components/daily-spending-chart.tsx` | Day-by-day Recharts line chart with hover |
| Modify | `code/apps/frontend/src/app/transactions/page.tsx` | Predicted rows, toggle, confirm popover, dismiss |

---

## Task 1: Schema + entity + Prisma repository

**Files:**
- Modify: `code/apps/backend/prisma/schema.prisma`
- Create: `code/apps/backend/src/domain/entities/recurring-pattern.entity.ts`
- Create: `code/apps/backend/src/domain/repositories/recurring-pattern.repository.ts`
- Create: `code/apps/backend/src/infrastructure/repositories/prisma/prisma-recurring-pattern.repository.ts`

- [ ] **Step 1: Add `RecurringPattern` model to schema**

In `code/apps/backend/prisma/schema.prisma`, add this model before the enums:

```prisma
model RecurringPattern {
  id            String    @id @default(cuid())
  description   String    @unique
  typicalDay    Int
  typicalAmount Decimal   @db.Decimal(10, 2)
  categoryId    String?
  category      Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  active        Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

Also add to the `Category` model:

```prisma
  recurringPatterns RecurringPattern[]
```

- [ ] **Step 2: Take DB backup and run migration**

```bash
docker exec code-db-1 pg_dump -U finance finance > ~/finance-backup-$(date +%Y%m%d-%H%M%S).sql
cd code/apps/backend
npx prisma migrate dev --name add-recurring-pattern
```

Expected: migration file created, no data loss.

- [ ] **Step 3: Create `RecurringPatternEntity`**

Create `code/apps/backend/src/domain/entities/recurring-pattern.entity.ts`:

```typescript
export class RecurringPatternEntity {
  constructor(
    public readonly id: string,
    public readonly description: string,
    public readonly typicalDay: number,
    public readonly typicalAmount: number,   // negative (expense)
    public readonly categoryId: string | null,
    public readonly categoryName: string | null,
    public readonly categoryColor: string | null,
    public readonly active: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
```

- [ ] **Step 4: Create abstract `RecurringPatternRepository`**

Create `code/apps/backend/src/domain/repositories/recurring-pattern.repository.ts`:

```typescript
import { RecurringPatternEntity } from '../entities/recurring-pattern.entity'

export interface UpsertPatternData {
  description: string
  typicalDay: number
  typicalAmount: number
  categoryId: string | null
}

export abstract class RecurringPatternRepository {
  abstract findAll(): Promise<RecurringPatternEntity[]>
  abstract findAllActive(): Promise<RecurringPatternEntity[]>
  abstract findByDescription(description: string): Promise<RecurringPatternEntity | null>
  abstract upsert(data: UpsertPatternData): Promise<RecurringPatternEntity>
  abstract setActive(id: string, active: boolean): Promise<void>
}
```

- [ ] **Step 5: Create `PrismaRecurringPatternRepository`**

Create `code/apps/backend/src/infrastructure/repositories/prisma/prisma-recurring-pattern.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { RecurringPatternRepository, UpsertPatternData } from '../../../domain/repositories/recurring-pattern.repository'
import { RecurringPatternEntity } from '../../../domain/entities/recurring-pattern.entity'

function toEntity(p: any): RecurringPatternEntity {
  return new RecurringPatternEntity(
    p.id,
    p.description,
    p.typicalDay,
    Number(p.typicalAmount),
    p.categoryId ?? null,
    p.category?.name ?? null,
    p.category?.color ?? null,
    p.active,
    p.createdAt,
    p.updatedAt,
  )
}

@Injectable()
export class PrismaRecurringPatternRepository extends RecurringPatternRepository {
  constructor(private readonly prisma: PrismaService) { super() }

  async findAll(): Promise<RecurringPatternEntity[]> {
    const rows = await this.prisma.recurringPattern.findMany({
      include: { category: true },
      orderBy: { typicalDay: 'asc' },
    })
    return rows.map(toEntity)
  }

  async findAllActive(): Promise<RecurringPatternEntity[]> {
    const rows = await this.prisma.recurringPattern.findMany({
      where: { active: true },
      include: { category: true },
      orderBy: { typicalDay: 'asc' },
    })
    return rows.map(toEntity)
  }

  async findByDescription(description: string): Promise<RecurringPatternEntity | null> {
    const row = await this.prisma.recurringPattern.findUnique({
      where: { description },
      include: { category: true },
    })
    return row ? toEntity(row) : null
  }

  async upsert(data: UpsertPatternData): Promise<RecurringPatternEntity> {
    const row = await this.prisma.recurringPattern.upsert({
      where: { description: data.description },
      create: {
        description: data.description,
        typicalDay: data.typicalDay,
        typicalAmount: data.typicalAmount,
        categoryId: data.categoryId,
      },
      update: {
        typicalDay: data.typicalDay,
        typicalAmount: data.typicalAmount,
        categoryId: data.categoryId,
      },
      include: { category: true },
    })
    return toEntity(row)
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await this.prisma.recurringPattern.update({ where: { id }, data: { active } })
  }
}
```

- [ ] **Step 6: Run existing tests**

```bash
cd code/apps/backend && npm test
```

Expected: all existing tests pass (schema change is additive).

- [ ] **Step 7: Commit**

```bash
git add code/apps/backend/prisma \
        code/apps/backend/src/domain/entities/recurring-pattern.entity.ts \
        code/apps/backend/src/domain/repositories/recurring-pattern.repository.ts \
        code/apps/backend/src/infrastructure/repositories/prisma/prisma-recurring-pattern.repository.ts
git commit -m "feat: RecurringPattern schema, entity, and Prisma repository"
```

---

## Task 2: In-memory repository + new TransactionRepository methods

**Files:**
- Create: `code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-recurring-pattern.repository.ts`
- Modify: `code/apps/backend/src/domain/repositories/transaction.repository.ts`
- Modify: `code/apps/backend/src/infrastructure/repositories/prisma/prisma-transaction.repository.ts`
- Modify: `code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-transaction.repository.ts`

- [ ] **Step 1: Create `InMemoryRecurringPatternRepository`**

Create `code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-recurring-pattern.repository.ts`:

```typescript
import { RecurringPatternRepository, UpsertPatternData } from '../../../domain/repositories/recurring-pattern.repository'
import { RecurringPatternEntity } from '../../../domain/entities/recurring-pattern.entity'

export class InMemoryRecurringPatternRepository extends RecurringPatternRepository {
  public readonly store = new Map<string, RecurringPatternEntity>()

  async findAll(): Promise<RecurringPatternEntity[]> {
    return [...this.store.values()].sort((a, b) => a.typicalDay - b.typicalDay)
  }

  async findAllActive(): Promise<RecurringPatternEntity[]> {
    return [...this.store.values()].filter(p => p.active).sort((a, b) => a.typicalDay - b.typicalDay)
  }

  async findByDescription(description: string): Promise<RecurringPatternEntity | null> {
    return [...this.store.values()].find(p => p.description === description) ?? null
  }

  async upsert(data: UpsertPatternData): Promise<RecurringPatternEntity> {
    const existing = [...this.store.values()].find(p => p.description === data.description)
    const now = new Date()
    if (existing) {
      const updated = new RecurringPatternEntity(
        existing.id, data.description, data.typicalDay, data.typicalAmount,
        data.categoryId, existing.categoryName, existing.categoryColor,
        existing.active, existing.createdAt, now,
      )
      this.store.set(existing.id, updated)
      return updated
    }
    const id = crypto.randomUUID()
    const created = new RecurringPatternEntity(
      id, data.description, data.typicalDay, data.typicalAmount,
      data.categoryId, null, null, true, now, now,
    )
    this.store.set(id, created)
    return created
  }

  async setActive(id: string, active: boolean): Promise<void> {
    const existing = this.store.get(id)
    if (!existing) throw new Error(`RecurringPattern ${id} not found`)
    this.store.set(id, new RecurringPatternEntity(
      existing.id, existing.description, existing.typicalDay, existing.typicalAmount,
      existing.categoryId, existing.categoryName, existing.categoryColor,
      active, existing.createdAt, new Date(),
    ))
  }
}
```

- [ ] **Step 2: Add two new methods to `TransactionRepository`**

In `code/apps/backend/src/domain/repositories/transaction.repository.ts`, add two abstract methods at the end:

```typescript
  abstract dailyTotals(year: number, month: number): Promise<{ day: number; total: number }[]>
  abstract findAllExpensesByDateRange(start: Date, end: Date): Promise<TransactionEntity[]>
```

- [ ] **Step 3: Implement in `PrismaTransactionRepository`**

Add both methods to `code/apps/backend/src/infrastructure/repositories/prisma/prisma-transaction.repository.ts`:

```typescript
  async dailyTotals(year: number, month: number): Promise<{ day: number; total: number }[]> {
    const start = startOfMonth(new Date(year, month - 1))
    const end = endOfMonth(new Date(year, month - 1))
    const rows = await this.prisma.transaction.findMany({
      where: { date: { gte: start, lte: end }, amount: { lt: 0 } },
      select: { date: true, amount: true },
    })
    const map = new Map<number, number>()
    for (const row of rows) {
      const day = new Date(row.date).getDate()
      map.set(day, (map.get(day) ?? 0) + Math.abs(Number(row.amount)))
    }
    return [...map.entries()].map(([day, total]) => ({ day, total })).sort((a, b) => a.day - b.day)
  }

  async findAllExpensesByDateRange(start: Date, end: Date): Promise<TransactionEntity[]> {
    const rows = await this.prisma.transaction.findMany({
      where: { date: { gte: start, lte: end }, amount: { lt: 0 } },
      include: { category: true },
      orderBy: { date: 'asc' },
    })
    return rows.map(TransactionMapper.toDomain)
  }
```

- [ ] **Step 4: Implement in `InMemoryTransactionRepository`**

Add both methods to `code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-transaction.repository.ts`:

```typescript
  async dailyTotals(year: number, month: number): Promise<{ day: number; total: number }[]> {
    const start = startOfMonth(new Date(year, month - 1))
    const end = endOfMonth(new Date(year, month - 1))
    const map = new Map<number, number>()
    for (const tx of this.store.values()) {
      if (tx.date < start || tx.date > end || tx.amount >= 0) continue
      const day = tx.date.getDate()
      map.set(day, (map.get(day) ?? 0) + Math.abs(tx.amount))
    }
    return [...map.entries()].map(([day, total]) => ({ day, total })).sort((a, b) => a.day - b.day)
  }

  async findAllExpensesByDateRange(start: Date, end: Date): Promise<TransactionEntity[]> {
    return [...this.store.values()]
      .filter(tx => tx.date >= start && tx.date <= end && tx.amount < 0)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
  }
```

- [ ] **Step 5: Run tests**

```bash
cd code/apps/backend && npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add code/apps/backend/src/domain/repositories/transaction.repository.ts \
        code/apps/backend/src/infrastructure/repositories/prisma/prisma-transaction.repository.ts \
        code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-transaction.repository.ts \
        code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-recurring-pattern.repository.ts
git commit -m "feat: InMemoryRecurringPatternRepository and new TransactionRepository methods"
```

---

## Task 3: RecurringService with TDD

**Files:**
- Create: `code/apps/backend/src/tests/recurring.service.spec.ts`
- Create: `code/apps/backend/src/modules/recurring/recurring.service.ts`

- [ ] **Step 1: Write the failing tests**

Create `code/apps/backend/src/tests/recurring.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing'
import { subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { RecurringService } from '../modules/recurring/recurring.service'
import { TransactionRepository } from '../domain/repositories/transaction.repository'
import { CategoryRepository } from '../domain/repositories/category.repository'
import { RecurringPatternRepository } from '../domain/repositories/recurring-pattern.repository'
import { InMemoryTransactionRepository } from '../infrastructure/repositories/in-memory/in-memory-transaction.repository'
import { InMemoryCategoryRepository } from '../infrastructure/repositories/in-memory/in-memory-category.repository'
import { InMemoryRecurringPatternRepository } from '../infrastructure/repositories/in-memory/in-memory-recurring-pattern.repository'
import { TransactionEntity } from '../domain/entities/transaction.entity'
import { CategoryEntity } from '../domain/entities/category.entity'

describe('RecurringService', () => {
  let service: RecurringService
  let txRepo: InMemoryTransactionRepository
  let catRepo: InMemoryCategoryRepository
  let patternRepo: InMemoryRecurringPatternRepository

  beforeEach(async () => {
    txRepo = new InMemoryTransactionRepository()
    catRepo = new InMemoryCategoryRepository()
    patternRepo = new InMemoryRecurringPatternRepository()

    const module = await Test.createTestingModule({
      providers: [
        RecurringService,
        { provide: TransactionRepository,       useValue: txRepo       },
        { provide: CategoryRepository,          useValue: catRepo       },
        { provide: RecurringPatternRepository,  useValue: patternRepo  },
      ],
    }).compile()

    service = module.get(RecurringService)
  })

  async function saveTx(description: string, date: string, amount = -50, categoryId: string | null = null) {
    return txRepo.save(new TransactionEntity(
      '', amount, new Date(date), description, 'pdf', categoryId, null, null, null, new Date(),
    ))
  }

  // ── detect ───────────────────────────────────────────────────────
  describe('detect', () => {
    it('creates a pattern when same description appears in 2 of the last 3 months', async () => {
      const now = new Date()
      const m1 = subMonths(now, 1)
      const m2 = subMonths(now, 2)
      const fmt = (d: Date, day: number) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

      await saveTx('Netflix', fmt(m1, 15), -17.99)
      await saveTx('Netflix', fmt(m2, 15), -17.99)

      await service.detect()

      const patterns = await patternRepo.findAllActive()
      expect(patterns).toHaveLength(1)
      expect(patterns[0].description).toBe('Netflix')
      expect(patterns[0].typicalDay).toBe(15)
      expect(patterns[0].typicalAmount).toBeCloseTo(-17.99)
    })

    it('does not create a pattern when description only appears in 1 month', async () => {
      const m1 = subMonths(new Date(), 1)
      await saveTx('Netflix', `${m1.getFullYear()}-${String(m1.getMonth() + 1).padStart(2, '0')}-15`, -17.99)

      await service.detect()

      expect((await patternRepo.findAllActive())).toHaveLength(0)
    })

    it('does not create pattern when amounts differ by more than 20%', async () => {
      const now = new Date()
      const m1 = subMonths(now, 1)
      const m2 = subMonths(now, 2)
      const fmt = (d: Date, day: number) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

      await saveTx('Gym', fmt(m1, 10), -50)
      await saveTx('Gym', fmt(m2, 10), -200)  // >20% difference

      await service.detect()

      expect((await patternRepo.findAllActive())).toHaveLength(0)
    })

    it('does not create pattern when day of month differs by more than 5 days', async () => {
      const now = new Date()
      const m1 = subMonths(now, 1)
      const m2 = subMonths(now, 2)
      const fmt = (d: Date, day: number) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

      await saveTx('Gym', fmt(m1, 5), -50)
      await saveTx('Gym', fmt(m2, 28), -50)  // >5 days apart

      await service.detect()

      expect((await patternRepo.findAllActive())).toHaveLength(0)
    })

    it('never overwrites a dismissed pattern', async () => {
      const now = new Date()
      const m1 = subMonths(now, 1)
      const m2 = subMonths(now, 2)
      const fmt = (d: Date, day: number) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

      await saveTx('Netflix', fmt(m1, 15), -17.99)
      await saveTx('Netflix', fmt(m2, 15), -17.99)

      // Detect once to create pattern, then dismiss it
      await service.detect()
      const patterns = await patternRepo.findAll()
      await patternRepo.setActive(patterns[0].id, false)

      // Detect again — should NOT re-activate
      await service.detect()

      const active = await patternRepo.findAllActive()
      expect(active).toHaveLength(0)
    })

    it('income transactions (positive amounts) are ignored', async () => {
      const now = new Date()
      const m1 = subMonths(now, 1)
      const m2 = subMonths(now, 2)
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`

      await saveTx('Salary', fmt(m1), 3500)  // positive = income
      await saveTx('Salary', fmt(m2), 3500)

      await service.detect()

      expect((await patternRepo.findAllActive())).toHaveLength(0)
    })
  })

  // ── getUpcoming ──────────────────────────────────────────────────
  describe('getUpcoming', () => {
    it('returns a pattern as upcoming when no matching transaction exists this month', async () => {
      await patternRepo.upsert({ description: 'Netflix', typicalDay: 15, typicalAmount: -17.99, categoryId: null })

      const items = await service.getUpcoming(2026, 4)

      expect(items).toHaveLength(1)
      expect(items[0].description).toBe('Netflix')
      expect(items[0].expectedDay).toBe(15)
      expect(items[0].typicalAmount).toBeCloseTo(-17.99)
    })

    it('does not return upcoming when a matching transaction already exists this month', async () => {
      await patternRepo.upsert({ description: 'Netflix', typicalDay: 15, typicalAmount: -17.99, categoryId: null })
      await saveTx('Netflix', '2026-04-10', -17.99)  // already happened

      const items = await service.getUpcoming(2026, 4)

      expect(items).toHaveLength(0)
    })

    it('does not return dismissed patterns', async () => {
      const p = await patternRepo.upsert({ description: 'Netflix', typicalDay: 15, typicalAmount: -17.99, categoryId: null })
      await patternRepo.setActive(p.id, false)

      const items = await service.getUpcoming(2026, 4)

      expect(items).toHaveLength(0)
    })

    it('includes category name and color when category exists', async () => {
      const cat = await catRepo.save(new CategoryEntity('', 'Subscriptions', '#c084fc', [], 0))
      await patternRepo.upsert({ description: 'Netflix', typicalDay: 15, typicalAmount: -17.99, categoryId: cat.id })

      const items = await service.getUpcoming(2026, 4)

      expect(items[0].categoryName).toBe('Subscriptions')
      expect(items[0].categoryColor).toBe('#c084fc')
    })

    it('sorts results by expectedDay ascending', async () => {
      await patternRepo.upsert({ description: 'Gym', typicalDay: 28, typicalAmount: -49, categoryId: null })
      await patternRepo.upsert({ description: 'Netflix', typicalDay: 15, typicalAmount: -17.99, categoryId: null })
      await patternRepo.upsert({ description: 'Tax', typicalDay: 20, typicalAmount: -320, categoryId: null })

      const items = await service.getUpcoming(2026, 4)

      expect(items.map(i => i.expectedDay)).toEqual([15, 20, 28])
    })
  })

  // ── getDailyTotals ───────────────────────────────────────────────
  describe('getDailyTotals', () => {
    it('returns cumulative daily spend for 3 months', async () => {
      await saveTx('A', '2026-04-01', -100)
      await saveTx('B', '2026-04-05', -200)

      const result = await service.getDailyTotals(2026, 4)

      expect(result).toHaveLength(3)
      const apr = result.find(s => s.month === 4 && s.year === 2026)!
      expect(apr.label).toBe('Apr')
      const day1 = apr.days.find(d => d.day === 1)!
      const day5 = apr.days.find(d => d.day === 5)!
      expect(day1.cumulative).toBe(100)
      expect(day5.cumulative).toBe(300)  // 100 + 200 cumulative
    })

    it('returns 0 cumulative for months with no transactions', async () => {
      const result = await service.getDailyTotals(2026, 4)
      expect(result).toHaveLength(3)
      result.forEach(s => s.days.forEach(d => expect(d.cumulative).toBe(0)))
    })

    it('wraps correctly across year boundary (January)', async () => {
      const result = await service.getDailyTotals(2026, 1)
      expect(result[0]).toMatchObject({ year: 2025, month: 11, label: 'Nov' })
      expect(result[2]).toMatchObject({ year: 2026, month: 1, label: 'Jan' })
    })
  })

  // ── dismissPattern ───────────────────────────────────────────────
  describe('dismissPattern', () => {
    it('sets the pattern active=false', async () => {
      const p = await patternRepo.upsert({ description: 'Netflix', typicalDay: 15, typicalAmount: -17.99, categoryId: null })

      await service.dismissPattern(p.id)

      const active = await patternRepo.findAllActive()
      expect(active).toHaveLength(0)
    })
  })
})
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd code/apps/backend && npm test -- --reporter=verbose 2>&1 | grep "recurring.service" | head -5
```

Expected: FAIL (RecurringService not found).

- [ ] **Step 3: Implement `RecurringService`**

Create `code/apps/backend/src/modules/recurring/recurring.service.ts`:

```typescript
import { Injectable } from '@nestjs/common'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { TransactionRepository } from '../../domain/repositories/transaction.repository'
import { CategoryRepository } from '../../domain/repositories/category.repository'
import { RecurringPatternRepository } from '../../domain/repositories/recurring-pattern.repository'
import { RecurringPatternEntity } from '../../domain/entities/recurring-pattern.entity'

export interface UpcomingItem {
  patternId: string
  description: string
  typicalAmount: number
  expectedDay: number
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
}

export interface DailySeriesDay {
  day: number
  cumulative: number
}

export interface DailySeries {
  year: number
  month: number
  label: string
  days: DailySeriesDay[]
}

@Injectable()
export class RecurringService {
  constructor(
    private readonly txRepo: TransactionRepository,
    private readonly catRepo: CategoryRepository,
    private readonly patternRepo: RecurringPatternRepository,
  ) {}

  async detect(): Promise<void> {
    const now = new Date()
    const reference = new Date(now.getFullYear(), now.getMonth())
    const start = startOfMonth(subMonths(reference, 2))
    const end = endOfMonth(reference)

    const txs = await this.txRepo.findAllExpensesByDateRange(start, end)

    // Group by description (preserve original case — bank statements are consistent)
    const byDesc = new Map<string, typeof txs>()
    for (const tx of txs) {
      const key = tx.description.toLowerCase()
      byDesc.set(key, [...(byDesc.get(key) ?? []), tx])
    }

    // Find dismissed descriptions — never overwrite
    const dismissed = new Set<string>()
    for (const p of await this.patternRepo.findAll()) {
      if (!p.active) dismissed.add(p.description.toLowerCase())
    }

    for (const [key, group] of byDesc) {
      if (dismissed.has(key)) continue
      if (group.length < 2) continue

      // Must appear in at least 2 distinct months
      const months = new Set(group.map(tx => `${tx.date.getFullYear()}-${tx.date.getMonth()}`))
      if (months.size < 2) continue

      const amounts = group.map(tx => Math.abs(tx.amount)).sort((a, b) => a - b)
      const medianAmount = amounts[Math.floor(amounts.length / 2)]

      const days = group.map(tx => tx.date.getDate()).sort((a, b) => a - b)
      const medianDay = days[Math.floor(days.length / 2)]

      // All within ±20% amount
      if (!amounts.every(a => medianAmount === 0 || Math.abs(a - medianAmount) / medianAmount <= 0.2)) continue
      // All within ±5 days
      if (!days.every(d => Math.abs(d - medianDay) <= 5)) continue

      // Use most recent transaction's category
      const sorted = [...group].sort((a, b) => b.date.getTime() - a.date.getTime())
      await this.patternRepo.upsert({
        description: sorted[0].description,
        typicalDay: medianDay,
        typicalAmount: -medianAmount,
        categoryId: sorted[0].categoryId,
      })
    }
  }

  async getUpcoming(year: number, month: number): Promise<UpcomingItem[]> {
    const patterns = await this.patternRepo.findAllActive()
    if (patterns.length === 0) return []

    const start = startOfMonth(new Date(year, month - 1))
    const end = endOfMonth(new Date(year, month - 1))
    const txs = await this.txRepo.findAllExpensesByDateRange(start, end)
    const confirmedThisMonth = new Set(txs.map(tx => tx.description.toLowerCase()))

    const categories = await this.catRepo.findAll()
    const catMap = Object.fromEntries(categories.map(c => [c.id, c]))

    return patterns
      .filter(p => !confirmedThisMonth.has(p.description.toLowerCase()))
      .map(p => ({
        patternId: p.id,
        description: p.description,
        typicalAmount: p.typicalAmount,
        expectedDay: p.typicalDay,
        categoryId: p.categoryId,
        categoryName: p.categoryId ? (catMap[p.categoryId]?.name ?? null) : null,
        categoryColor: p.categoryId ? (catMap[p.categoryId]?.color ?? null) : null,
      }))
      .sort((a, b) => a.expectedDay - b.expectedDay)
  }

  async getDailyTotals(year: number, month: number, count = 3): Promise<DailySeries[]> {
    const reference = new Date(year, month - 1)
    const monthDates = Array.from({ length: count }, (_, i) =>
      subMonths(reference, count - 1 - i)
    )

    return Promise.all(monthDates.map(async d => {
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const dailies = await this.txRepo.dailyTotals(y, m)
      const daysInMonth = new Date(y, m, 0).getDate()

      let running = 0
      const days: DailySeriesDay[] = Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1
        running += dailies.find(dd => dd.day === day)?.total ?? 0
        return { day, cumulative: running }
      })

      return { year: y, month: m, label: format(d, 'MMM'), days }
    }))
  }

  async dismissPattern(id: string): Promise<void> {
    await this.patternRepo.setActive(id, false)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd code/apps/backend && npm test
```

Expected: all tests pass including the new recurring service tests.

- [ ] **Step 5: Commit**

```bash
git add code/apps/backend/src/modules/recurring/recurring.service.ts \
        code/apps/backend/src/tests/recurring.service.spec.ts
git commit -m "feat: RecurringService — detect, getUpcoming, getDailyTotals, dismissPattern with tests"
```

---

## Task 4: RecurringModule + RecurringController + AppModule

**Files:**
- Create: `code/apps/backend/src/modules/recurring/dto/recurring-query.dto.ts`
- Create: `code/apps/backend/src/modules/recurring/recurring.controller.ts`
- Create: `code/apps/backend/src/modules/recurring/recurring.module.ts`
- Modify: `code/apps/backend/src/app.module.ts`

- [ ] **Step 1: Create DTO**

Create `code/apps/backend/src/modules/recurring/dto/recurring-query.dto.ts`:

```typescript
import { IsOptional, IsNumberString } from 'class-validator'

export class RecurringQueryDto {
  @IsOptional()
  @IsNumberString()
  year?: string

  @IsOptional()
  @IsNumberString()
  month?: string
}
```

- [ ] **Step 2: Create `RecurringController`**

Create `code/apps/backend/src/modules/recurring/recurring.controller.ts`:

```typescript
import { Controller, Get, Delete, Query, Param } from '@nestjs/common'
import { RecurringService } from './recurring.service'
import { RecurringQueryDto } from './dto/recurring-query.dto'

@Controller('recurring')
export class RecurringController {
  constructor(private readonly service: RecurringService) {}

  @Get('upcoming')
  getUpcoming(@Query() query: RecurringQueryDto) {
    const now = new Date()
    return this.service.getUpcoming(
      query.year  ? Number(query.year)  : now.getFullYear(),
      query.month ? Number(query.month) : now.getMonth() + 1,
    )
  }

  @Delete('patterns/:id')
  dismissPattern(@Param('id') id: string) {
    return this.service.dismissPattern(id)
  }
}
```

- [ ] **Step 3: Create `RecurringModule`**

Create `code/apps/backend/src/modules/recurring/recurring.module.ts`:

```typescript
import { Module } from '@nestjs/common'
import { RecurringController } from './recurring.controller'
import { RecurringService } from './recurring.service'
import { RecurringPatternRepository } from '../../domain/repositories/recurring-pattern.repository'
import { TransactionRepository } from '../../domain/repositories/transaction.repository'
import { CategoryRepository } from '../../domain/repositories/category.repository'
import { PrismaRecurringPatternRepository } from '../../infrastructure/repositories/prisma/prisma-recurring-pattern.repository'
import { PrismaTransactionRepository } from '../../infrastructure/repositories/prisma/prisma-transaction.repository'
import { PrismaCategoryRepository } from '../../infrastructure/repositories/prisma/prisma-category.repository'

@Module({
  controllers: [RecurringController],
  providers: [
    RecurringService,
    { provide: RecurringPatternRepository, useClass: PrismaRecurringPatternRepository },
    { provide: TransactionRepository,       useClass: PrismaTransactionRepository      },
    { provide: CategoryRepository,          useClass: PrismaCategoryRepository         },
  ],
  exports: [RecurringService],
})
export class RecurringModule {}
```

- [ ] **Step 4: Add `RecurringModule` to `AppModule`**

Replace the full contents of `code/apps/backend/src/app.module.ts`:

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
import { RecurringModule } from './modules/recurring/recurring.module'

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
    RecurringModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 5: Run tests**

```bash
cd code/apps/backend && npm test
```

Expected: all tests pass.

- [ ] **Step 6: Smoke test the endpoint**

Start the backend and verify the route:

```bash
cd code/apps/backend && npm run start:dev
# in another terminal:
curl "http://localhost:3001/api/recurring/upcoming?year=2026&month=4"
```

Expected: `[]` (empty array — no patterns yet).

- [ ] **Step 7: Commit**

```bash
git add code/apps/backend/src/modules/recurring \
        code/apps/backend/src/app.module.ts
git commit -m "feat: RecurringModule, RecurringController — GET /api/recurring/upcoming and DELETE /api/recurring/patterns/:id"
```

---

## Task 5: Hook detect() into ImportService + extend DashboardService

**Files:**
- Modify: `code/apps/backend/src/modules/import/import.service.ts`
- Modify: `code/apps/backend/src/modules/import/import.module.ts`
- Modify: `code/apps/backend/src/modules/dashboard/dashboard.service.ts`
- Modify: `code/apps/backend/src/modules/dashboard/dashboard.module.ts`

- [ ] **Step 1: Import `RecurringModule` in `ImportModule`**

In `code/apps/backend/src/modules/import/import.module.ts`, add the import:

```typescript
import { Module } from '@nestjs/common'
import { MulterModule } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { ImportController } from './import.controller'
import { ImportService } from './import.service'
import { SettingsModule } from '../settings/settings.module'
import { RecurringModule } from '../recurring/recurring.module'
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
    RecurringModule,
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

- [ ] **Step 2: Inject `RecurringService` into `ImportService` and call `detect()`**

In `code/apps/backend/src/modules/import/import.service.ts`, add the import and inject at the top:

```typescript
import { RecurringService } from '../recurring/recurring.service'
```

Update the constructor:

```typescript
  constructor(
    private readonly batchRepo: ImportBatchRepository,
    private readonly categoryRepo: CategoryRepository,
    private readonly txRepo: TransactionRepository,
    private readonly settings: SettingsService,
    private readonly recurring: RecurringService,
  ) {}
```

At the end of `confirmBatch()`, just before `return { confirmed: true }`, add:

```typescript
    // Silent background scan — errors must not fail the confirm
    this.recurring.detect().catch(() => {})

    return { confirmed: true }
```

- [ ] **Step 3: Import `RecurringModule` in `DashboardModule`**

Replace the full contents of `code/apps/backend/src/modules/dashboard/dashboard.module.ts`:

```typescript
import { Module } from '@nestjs/common'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'
import { TransactionRepository } from '../../domain/repositories/transaction.repository'
import { CategoryRepository } from '../../domain/repositories/category.repository'
import { ImportBatchRepository } from '../../domain/repositories/import-batch.repository'
import { PrismaTransactionRepository } from '../../infrastructure/repositories/prisma/prisma-transaction.repository'
import { PrismaCategoryRepository } from '../../infrastructure/repositories/prisma/prisma-category.repository'
import { PrismaImportBatchRepository } from '../../infrastructure/repositories/prisma/prisma-import-batch.repository'
import { RecurringModule } from '../recurring/recurring.module'

@Module({
  imports: [RecurringModule],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    { provide: TransactionRepository, useClass: PrismaTransactionRepository },
    { provide: CategoryRepository,    useClass: PrismaCategoryRepository    },
    { provide: ImportBatchRepository, useClass: PrismaImportBatchRepository },
  ],
})
export class DashboardModule {}
```

- [ ] **Step 4: Extend `DashboardService.getSummary()`**

In `code/apps/backend/src/modules/dashboard/dashboard.service.ts`, add the `RecurringService` import and injection:

```typescript
import { RecurringService } from '../recurring/recurring.service'
```

Update the constructor:

```typescript
  constructor(
    private readonly txRepo: TransactionRepository,
    private readonly catRepo: CategoryRepository,
    private readonly batchRepo: ImportBatchRepository,
    private readonly recurring: RecurringService,
  ) {}
```

Replace the `getSummary` method:

```typescript
  async getSummary(year: number, month: number) {
    const [summary, byCategory, monthlyTotals, upcomingItems, dailyTotals] = await Promise.all([
      this.getSummaryCards(year, month),
      this.getSpendingByCategory(year, month),
      this.getMonthlyTotals(year, month, 4),
      this.recurring.getUpcoming(year, month),
      this.recurring.getDailyTotals(year, month, 3),
    ])

    const upcomingTotal = upcomingItems.reduce((sum, i) => sum + Math.abs(i.typicalAmount), 0)

    return {
      summary,
      byCategory,
      monthlyTotals,
      upcoming: { total: upcomingTotal, items: upcomingItems },
      dailyTotals,
    }
  }
```

- [ ] **Step 5: Run all tests**

```bash
cd code/apps/backend && npm test
```

Expected: all tests pass. Note: The existing `dashboard.service.spec.ts` test for `getSummary` may need updating since the return shape changed — add a mock `RecurringService` there if the test fails:

If `dashboard.service.spec.ts` fails, add this to its `providers` array in `beforeEach`:

```typescript
{
  provide: RecurringService,
  useValue: {
    getUpcoming: vi.fn().mockResolvedValue([]),
    getDailyTotals: vi.fn().mockResolvedValue([]),
  },
},
```

And add to imports at the top of that test file:

```typescript
import { RecurringService } from '../modules/recurring/recurring.service'
```

- [ ] **Step 6: Commit**

```bash
git add code/apps/backend/src/modules/import/import.service.ts \
        code/apps/backend/src/modules/import/import.module.ts \
        code/apps/backend/src/modules/dashboard/dashboard.service.ts \
        code/apps/backend/src/modules/dashboard/dashboard.module.ts \
        code/apps/backend/src/tests/dashboard.service.spec.ts
git commit -m "feat: trigger detect() on import confirm; extend dashboard summary with upcoming and dailyTotals"
```

---

## Task 6: Frontend — API client + Dashboard (cards + upcoming panel)

**Files:**
- Modify: `code/apps/frontend/src/lib/api.ts`
- Create: `code/apps/frontend/src/components/upcoming-panel.tsx`
- Modify: `code/apps/frontend/src/app/dashboard/page.tsx`

- [ ] **Step 1: Add `recurring` section to API client + extend dashboard type**

In `code/apps/frontend/src/lib/api.ts`, add after the `insights` block and update the dashboard type:

Replace the `dashboard` API method:

```typescript
  dashboard: {
    summary: (year: number, month: number) =>
      get<{
        summary: any
        byCategory: any[]
        monthlyTotals: any[]
        upcoming: {
          total: number
          items: Array<{
            patternId: string
            description: string
            typicalAmount: number
            expectedDay: number
            categoryId: string | null
            categoryName: string | null
            categoryColor: string | null
          }>
        }
        dailyTotals: Array<{
          year: number
          month: number
          label: string
          days: Array<{ day: number; cumulative: number }>
        }>
      }>('/dashboard/summary', { year, month }),
  },
```

Add the `recurring` block after `insights`:

```typescript
  recurring: {
    upcoming: (year: number, month: number) =>
      get<Array<{
        patternId: string
        description: string
        typicalAmount: number
        expectedDay: number
        categoryId: string | null
        categoryName: string | null
        categoryColor: string | null
      }>>('/recurring/upcoming', { year, month }),

    dismissPattern: (id: string) => del<void>(`/recurring/patterns/${id}`),
  },
```

- [ ] **Step 2: Create `UpcomingPanel` component**

Create `code/apps/frontend/src/components/upcoming-panel.tsx`:

```tsx
import { Calendar } from 'lucide-react'
import { CurrencyAmount } from './currency-amount'

type UpcomingItem = {
  patternId: string
  description: string
  typicalAmount: number
  expectedDay: number
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
}

type Props = {
  items: UpcomingItem[]
  currentMonthLabel: string  // e.g. "Apr"
}

export function UpcomingPanel({ items, currentMonthLabel }: Props) {
  if (items.length === 0) return null

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <Calendar size={14} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Upcoming this month
          </span>
        </div>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-md"
          style={{ background: 'var(--accent)' + '18', color: 'var(--accent)' }}
        >
          {items.length} expected
        </span>
      </div>

      {/* Rows */}
      {items.map((item, i) => (
        <div
          key={item.patternId}
          className="flex items-center gap-3 px-5 py-3.5"
          style={{ borderBottom: i < items.length - 1 ? '1px solid var(--border)' : undefined }}
        >
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: item.categoryColor ?? 'var(--text-3)' }}
          />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium truncate block" style={{ color: 'var(--text)' }}>
              {item.description}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-2)' }}>
              Expected ~{currentMonthLabel} {item.expectedDay}
              {item.categoryName && ` · ${item.categoryName}`}
            </span>
          </div>
          <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: 'var(--accent)' }}>
            −<CurrencyAmount amount={Math.abs(item.typicalAmount)} />
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Add 2 new cards + UpcomingPanel to dashboard page**

In `code/apps/frontend/src/app/dashboard/page.tsx`:

Add the import:

```typescript
import { UpcomingPanel } from '@/components/upcoming-panel'
```

Update the data fetch (line 71) to destructure `upcoming` and `dailyTotals` from the summary:

```typescript
  const [{ summary, byCategory, monthlyTotals, upcoming, dailyTotals }, { items: recentTxs }, prevSummary] = await Promise.all([
    api.dashboard.summary(year, month),
    api.transactions.list({ year, month, page: 1, perPage: 5 }),
    api.dashboard.summary(prevYear, prevMonth),
  ])
```

Replace the `{/* Summary cards */}` section (change grid to `grid-cols-5`):

```tsx
          {/* Summary cards */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            <Card>
              <p className="text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>Spent this month</p>
              <p className="text-3xl font-bold" style={{ color: 'var(--text)' }}>
                <CurrencyAmount amount={Number(summary.totalSpent)} />
              </p>
              {prevTotal > 0 && (
                <p className="text-xs mt-1" style={{ color: delta > 0 ? 'var(--red)' : 'var(--green)' }}>
                  {delta > 0 ? '▲' : '▼'} <CurrencyAmount amount={Math.abs(delta)} fractionDigits={0} /> vs last month
                </p>
              )}
            </Card>
            <Card>
              <p className="text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>Biggest category</p>
              {biggestCat ? (
                <>
                  <p className="text-xl font-bold mb-0.5" style={{ color: 'var(--text)' }}>{biggestCat.name}</p>
                  <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                    <CurrencyAmount amount={Number(biggestCat.total)} /> · {summary.totalSpent > 0
                      ? Math.round((biggestCat.total / summary.totalSpent) * 100) : 0}% of total
                  </p>
                </>
              ) : (
                <p style={{ color: 'var(--text-3)' }} className="text-sm">No data</p>
              )}
            </Card>
            <Card>
              <p className="text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>Transactions</p>
              <p className="text-3xl font-bold mb-1" style={{ color: 'var(--text)' }}>{summary.transactionCount}</p>
              {summary.inboxCount > 0 && (
                <Link href="/import/inbox" className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
                  {summary.inboxCount} in inbox →
                </Link>
              )}
            </Card>
            <Card>
              <p className="text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>Upcoming this month</p>
              <p className="text-3xl font-bold" style={{ color: 'var(--accent)' }}>
                {upcoming.items.length > 0
                  ? <CurrencyAmount amount={upcoming.total} />
                  : <span style={{ color: 'var(--text-3)', fontSize: 14 }}>None detected</span>}
              </p>
              {upcoming.items.length > 0 && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>
                  {upcoming.items.length} recurring expected
                </p>
              )}
            </Card>
            <Card>
              <p className="text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>Net available today</p>
              <p className="text-3xl font-bold" style={{ color: 'var(--green)' }}>
                <CurrencyAmount amount={Math.max(0, Number(summary.totalIncome) - Number(summary.totalSpent) - upcoming.total)} />
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>income − spent − upcoming</p>
            </Card>
          </div>
```

Add `UpcomingPanel` between the delta callout and Charts section (after the charts `<div>` closing tag):

```tsx
          {/* Upcoming panel */}
          {upcoming.items.length > 0 && (
            <div className="mb-4">
              <UpcomingPanel
                items={upcoming.items}
                currentMonthLabel={format(new Date(year, month - 1), 'MMM')}
              />
            </div>
          )}
```

- [ ] **Step 4: Run tests**

```bash
cd code/apps/backend && npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add code/apps/frontend/src/lib/api.ts \
        code/apps/frontend/src/components/upcoming-panel.tsx \
        code/apps/frontend/src/app/dashboard/page.tsx
git commit -m "feat: dashboard — 2 new cards (Upcoming, Net Available) and UpcomingPanel"
```

---

## Task 7: Dashboard — ChartsToggleCard (View 1 bar + View 2 daily line)

**Files:**
- Create: `code/apps/frontend/src/components/daily-spending-chart.tsx`
- Create: `code/apps/frontend/src/components/charts-toggle-card.tsx`
- Modify: `code/apps/frontend/src/app/dashboard/page.tsx`

- [ ] **Step 1: Create `DailySpendingChart`**

Create `code/apps/frontend/src/components/daily-spending-chart.tsx`:

```tsx
'use client'

import { useState, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid,
} from 'recharts'
import { CurrencyAmount } from './currency-amount'

type DailySeriesDay = { day: number; cumulative: number }
type DailySeries = { year: number; month: number; label: string; days: DailySeriesDay[] }

type Props = { series: DailySeries[] }

const OPACITY = [0.15, 0.45, 1]

export function DailySpendingChart({ series }: Props) {
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)

  if (!series || series.length === 0) return (
    <div className="flex items-center justify-center h-40">
      <p className="text-sm" style={{ color: 'var(--text-3)' }}>No data</p>
    </div>
  )

  // Merge all series into one data array keyed by day
  const today = new Date().getDate()
  const currentMonth = series[series.length - 1]
  const maxDay = currentMonth
    ? Math.max(...currentMonth.days.map(d => d.day), 1)
    : 31

  const chartData = Array.from({ length: maxDay }, (_, i) => {
    const day = i + 1
    const point: any = { day }
    series.forEach(s => {
      const found = s.days.find(d => d.day === day)
      point[s.label] = found?.cumulative ?? null
    })
    // Current month: only show up to today
    const lastLabel = series[series.length - 1]?.label
    if (lastLabel && day > today) point[lastLabel] = null
    return point
  })

  const maxVal = Math.max(
    ...series.flatMap(s => s.days.map(d => d.cumulative)),
    1,
  )

  const colors = series.map((_, i) =>
    i === series.length - 1 ? 'var(--accent)' : '#ffffff'
  )

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div
        className="px-3 py-2.5 rounded-lg text-xs space-y-1"
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
        }}
      >
        <p className="font-semibold mb-1" style={{ color: 'var(--text-2)' }}>Day {label}</p>
        {series.map((s, i) => {
          const p = payload.find((pp: any) => pp.dataKey === s.label)
          if (!p?.value) return null
          return (
            <div key={s.label} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: colors[i], opacity: OPACITY[i] }}
              />
              <span style={{ color: i === series.length - 1 ? 'var(--accent)' : 'var(--text-2)' }}>
                {s.label} <CurrencyAmount amount={p.value} />
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          onMouseMove={(e: any) => setHoveredDay(e?.activeLabel ?? null)}
          onMouseLeave={() => setHoveredDay(null)}
        >
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--text-3)', fontSize: 10 }}
            ticks={[1, 7, 14, 21, 28]}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--text-3)', fontSize: 10 }}
            tickFormatter={(v) => `£${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--text-2)', strokeDasharray: '4 4', strokeWidth: 1 }} />

          {hoveredDay !== null && series.map((s, i) => {
            const found = s.days.find(d => d.day === hoveredDay)
            if (!found) return null
            return (
              <ReferenceLine
                key={s.label}
                y={found.cumulative}
                stroke={i === series.length - 1 ? 'var(--accent)' : '#ffffff'}
                strokeOpacity={OPACITY[i]}
                strokeDasharray="3 4"
                strokeWidth={1}
              />
            )
          })}

          {series.map((s, i) => (
            <Line
              key={s.label}
              type="monotone"
              dataKey={s.label}
              stroke={colors[i]}
              strokeOpacity={OPACITY[i]}
              strokeWidth={i === series.length - 1 ? 2 : 1.5}
              dot={false}
              activeDot={i === series.length - 1 ? { r: 4, fill: 'var(--accent)' } : false}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 px-1">
        {series.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div
              className="w-3 h-0.5 rounded"
              style={{ background: colors[i], opacity: OPACITY[i] }}
            />
            <span
              className="text-xs"
              style={{ color: i === series.length - 1 ? 'var(--accent)' : 'var(--text-3)' }}
            >
              {s.label}{i === series.length - 1 ? ' (now)' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `ChartsToggleCard`**

Create `code/apps/frontend/src/components/charts-toggle-card.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MonthComparisonChart } from './month-comparison-chart'
import { DailySpendingChart } from './daily-spending-chart'
import { CurrencyAmount } from './currency-amount'

type DailySeries = {
  year: number; month: number; label: string
  days: { day: number; cumulative: number }[]
}

type Props = {
  monthlyTotals: any[]
  dailyTotals: DailySeries[]
  currentYear: number
  currentMonth: number
  prevMonthTotal: number
  biggestCategoryName?: string
  delta: number
}

export function ChartsToggleCard({
  monthlyTotals, dailyTotals, currentYear, currentMonth,
  prevMonthTotal, biggestCategoryName, delta,
}: Props) {
  const [view, setView] = useState(0)
  const views = ['Last 4 months', 'Daily spending']

  return (
    <div className="h-full flex flex-col">
      {/* Toggle header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {views[view]}
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setView(v => (v - 1 + views.length) % views.length)}
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: 'var(--surface-2)' }}
          >
            <ChevronLeft size={12} style={{ color: 'var(--text-2)' }} />
          </button>
          {views.map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: i === view ? 'var(--accent)' : 'var(--text-3)' }}
            />
          ))}
          <button
            onClick={() => setView(v => (v + 1) % views.length)}
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: 'var(--surface-2)' }}
          >
            <ChevronRight size={12} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>
      </div>

      {view === 0 && (
        <>
          {prevMonthTotal > 0 && delta !== 0 && (
            <p className="text-xs mb-3" style={{ color: 'var(--text-2)' }}>
              <span style={{ color: delta > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                {delta > 0 ? '▲' : '▼'} <CurrencyAmount amount={Math.abs(delta)} fractionDigits={0} />
              </span>
              {' '}vs last month
              {biggestCategoryName && (
                <> · <span style={{ color: 'var(--text)' }}>{biggestCategoryName}</span></>
              )}
            </p>
          )}
          <MonthComparisonChart
            data={monthlyTotals}
            currentYear={currentYear}
            currentMonth={currentMonth}
            prevMonthTotal={prevMonthTotal}
            biggestCategoryName={biggestCategoryName}
          />
        </>
      )}

      {view === 1 && (
        <DailySpendingChart series={dailyTotals} />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Replace the right chart card in `dashboard/page.tsx`**

Add import at the top of `code/apps/frontend/src/app/dashboard/page.tsx`:

```typescript
import { ChartsToggleCard } from '@/components/charts-toggle-card'
```

Replace the right `<Card>` in the charts grid (the one with `<MonthComparisonChart>`):

```tsx
            <Card>
              <ChartsToggleCard
                monthlyTotals={monthlyTotals}
                dailyTotals={dailyTotals ?? []}
                currentYear={year}
                currentMonth={month}
                prevMonthTotal={prevTotal}
                biggestCategoryName={biggestDriver?.name}
                delta={delta}
              />
            </Card>
```

Also remove the old delta callout paragraph that was above `<MonthComparisonChart>` — it's now inside `ChartsToggleCard`.

- [ ] **Step 4: Commit**

```bash
git add code/apps/frontend/src/components/daily-spending-chart.tsx \
        code/apps/frontend/src/components/charts-toggle-card.tsx \
        code/apps/frontend/src/app/dashboard/page.tsx
git commit -m "feat: ChartsToggleCard — Last 4 months / Daily spending with hover interaction"
```

---

## Task 8: Transactions page — predicted rows + confirm popover + dismiss

**Files:**
- Modify: `code/apps/frontend/src/app/transactions/page.tsx`

- [ ] **Step 1: Add predicted rows state and fetch**

In `code/apps/frontend/src/app/transactions/page.tsx`, add to `TransactionsContent`:

After the existing imports, no new file imports needed (`api` already imported).

Add state and fetch inside `TransactionsContent`:

```typescript
  const [showPredicted, setShowPredicted] = useState(true)
  const [predicted, setPredicted] = useState<any[]>([])
  const [confirmItem, setConfirmItem] = useState<any | null>(null)
  const [confirmDate, setConfirmDate] = useState('')
  const [confirmAmount, setConfirmAmount] = useState('')
  const [confirmSaving, setConfirmSaving] = useState(false)
```

Add a second `useEffect` to fetch predicted items:

```typescript
  useEffect(() => {
    api.recurring.upcoming(year, month).then(setPredicted).catch(() => {})
  }, [year, month])
```

- [ ] **Step 2: Merge predicted rows into the display list**

Before `const total = filteredItems.length`, add:

```typescript
  // Build predicted rows as virtual items
  const predictedRows = showPredicted
    ? predicted
        .filter(p => {
          if (search && !p.description.toLowerCase().includes(search.toLowerCase())) return false
          if (catFilter && catFilter !== 'uncategorized' && p.categoryId !== catFilter) return false
          return true
        })
        .map(p => ({
          ...p,
          id: `predicted_${p.patternId}`,
          _predicted: true,
          date: new Date(year, month - 1, p.expectedDay).toISOString(),
          amount: p.typicalAmount,
          description: p.description,
          category: p.categoryId ? { id: p.categoryId, name: p.categoryName, color: p.categoryColor } : null,
          source: 'predicted' as const,
        }))
    : []

  // Merge real + predicted, sort by date ascending (predicted sort by expectedDay)
  const mergedItems = [...filteredItems, ...predictedRows].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )
```

Update `const total = filteredItems.length` to `const total = mergedItems.length` and use `mergedItems` instead of `filteredItems` for pagination.

- [ ] **Step 3: Add "Show predicted" toggle to the filter bar**

Locate the filter bar JSX (where `txSearch`, category filter, etc. are rendered). Add a toggle at the end of the filters:

```tsx
            <button
              onClick={() => setShowPredicted(p => !p)}
              className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: showPredicted ? '#818cf818' : 'var(--surface)',
                border: `1px solid ${showPredicted ? '#818cf844' : 'var(--border)'}`,
                color: showPredicted ? '#818cf8' : 'var(--text-2)',
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: showPredicted ? '#818cf8' : 'var(--text-3)' }}
              />
              Show predicted
            </button>
```

- [ ] **Step 4: Render predicted rows differently**

In the table rows map (where `pageItems.map(tx => ...)` is), wrap the row render with a conditional:

For real rows — render exactly as today.

For predicted rows (`tx._predicted === true`) render:

```tsx
                  <tr
                    key={tx.id}
                    style={{
                      background: '#818cf80a',
                      borderBottom: '1px solid #818cf820',
                    }}
                  >
                    <td className="py-3 pr-4 text-xs whitespace-nowrap" style={{ color: '#818cf8', opacity: 0.8, width: 110 }}>
                      ~{format(new Date(year, month - 1, tx._predicted ? tx.expectedDay : 1), 'd MMM')}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-sm" style={{ color: 'var(--text-2)' }}>{tx.description}</span>
                      <span
                        className="ml-2 text-xs px-1.5 py-0.5 rounded font-bold uppercase tracking-wide"
                        style={{ background: '#818cf818', color: '#818cf8', letterSpacing: '0.05em' }}
                      >
                        predicted
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {tx.category
                        ? <CategoryPill name={tx.category.name} color={tx.category.color} />
                        : <span style={{ color: 'var(--text-3)' }}>—</span>}
                    </td>
                    <td className="py-3 pr-4 text-xs" style={{ color: 'var(--text-3)' }}>—</td>
                    <td className="py-3 text-right font-medium tabular-nums" style={{ color: '#818cf8', opacity: 0.8 }}>
                      <CurrencyAmount amount={Math.abs(Number(tx.amount))} />
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => {
                          setConfirmItem(tx)
                          setConfirmDate(`${year}-${String(month).padStart(2,'0')}-${String(tx.expectedDay).padStart(2,'0')}`)
                          setConfirmAmount(Math.abs(tx.typicalAmount).toFixed(2))
                        }}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold"
                        style={{ background: '#22c55e20', color: '#22c55e' }}
                        title="Confirm transaction"
                      >
                        ✓
                      </button>
                    </td>
                  </tr>
```

- [ ] **Step 5: Add the Confirm popover**

After the table closing tag, add the popover (renders as an overlay when `confirmItem !== null`):

```tsx
          {/* Confirm predicted transaction popover */}
          {confirmItem && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ background: '#00000060' }}
              onClick={(e) => e.target === e.currentTarget && setConfirmItem(null)}
            >
              <div
                className="rounded-xl w-80 overflow-hidden"
                style={{ background: 'var(--surface)', border: '1px solid var(--border-2)' }}
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Confirm transaction</span>
                  <button onClick={() => setConfirmItem(null)} style={{ color: 'var(--text-2)' }}>✕</button>
                </div>

                {/* Predicted summary */}
                <div className="px-4 pt-3 pb-0">
                  <div
                    className="rounded-lg px-3 py-2.5 mb-3"
                    style={{ background: '#818cf810', border: '1px solid #818cf820' }}
                  >
                    <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>{confirmItem.description}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#818cf8' }}>
                      Predicted ~{format(new Date(year, month - 1, confirmItem.expectedDay), 'd MMM')} · −<CurrencyAmount amount={Math.abs(confirmItem.typicalAmount)} />
                    </p>
                  </div>
                </div>

                {/* Fields */}
                <div className="px-4 pb-3 space-y-3">
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-2)' }}>Actual date</label>
                    <input
                      type="date"
                      value={confirmDate}
                      onChange={e => setConfirmDate(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-2)' }}>Actual amount</label>
                    <div
                      className="flex items-center rounded-lg px-3"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--accent)', height: 36 }}
                    >
                      <span className="text-sm mr-1" style={{ color: 'var(--text-3)' }}>{currency}</span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={confirmAmount}
                        onChange={e => setConfirmAmount(e.target.value)}
                        className="flex-1 bg-transparent outline-none text-sm"
                        style={{ color: 'var(--text)' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div
                  className="flex items-center justify-end gap-2 px-4 py-3"
                  style={{ borderTop: '1px solid var(--border)' }}
                >
                  <button
                    onClick={() => setConfirmItem(null)}
                    className="px-3 py-1.5 rounded-lg text-sm"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}
                  >
                    Cancel
                  </button>
                  <button
                    disabled={confirmSaving || !confirmDate || !confirmAmount}
                    onClick={async () => {
                      if (!confirmDate || !confirmAmount) return
                      setConfirmSaving(true)
                      try {
                        await api.transactions.create({
                          description: confirmItem.description,
                          date: confirmDate,
                          amount: -Math.abs(Number(confirmAmount)),
                          categoryId: confirmItem.categoryId ?? undefined,
                          source: 'manual',
                        })
                        setPredicted(prev => prev.filter(p => p.patternId !== confirmItem.patternId))
                        setConfirmItem(null)
                        refresh()
                      } finally {
                        setConfirmSaving(false)
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-40"
                    style={{ background: 'var(--accent)', color: '#0c0c0e' }}
                  >
                    {confirmSaving ? 'Saving…' : 'Save as transaction'}
                  </button>
                </div>
              </div>
            </div>
          )}
```

- [ ] **Step 6: Add dismiss menu to predicted rows**

In the predicted row render, after the ✓ button, add a dismiss button:

```tsx
                      <button
                        onClick={async () => {
                          await api.recurring.dismissPattern(tx.patternId)
                          setPredicted(prev => prev.filter(p => p.patternId !== tx.patternId))
                        }}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-sm ml-1"
                        style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}
                        title="Remove recurring"
                      >
                        ✕
                      </button>
```

- [ ] **Step 7: Run backend tests one final time**

```bash
cd code/apps/backend && npm test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add code/apps/frontend/src/app/transactions/page.tsx
git commit -m "feat: transactions page — predicted rows, Show predicted toggle, confirm popover, dismiss"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| RecurringPattern table | Task 1 |
| Detection: same description, ±20% amount, ±5 day | Task 3 (detect()) |
| Detection triggered on import confirm | Task 5 |
| Dismissed patterns never overwritten | Task 3 (detect() + test) |
| GET /api/recurring/upcoming | Task 4 |
| DELETE /api/recurring/patterns/:id | Task 4 |
| Dashboard: Upcoming + Net Available cards | Task 6 |
| Dashboard: Upcoming panel (conditional, by day) | Task 6 |
| Dashboard: two-view chart toggle | Task 7 |
| View 1: Last 4 months bar chart | Task 7 (ChartsToggleCard) |
| View 2: Daily spending line chart | Task 7 (DailySpendingChart) |
| View 2: hover dashed lines + tooltip | Task 7 (DailySpendingChart) |
| Transactions: Show predicted toggle | Task 8 |
| Transactions: Predicted rows (indigo tint, PREDICTED badge) | Task 8 |
| Transactions: ✓ → Confirm popover with date + amount | Task 8 |
| Transactions: Confirm creates real transaction | Task 8 |
| Transactions: Dismiss removes pattern | Task 8 |
| Edge: no patterns → cards hidden / no panel | Task 6 (conditional rendering) |
| dailyTotals in dashboard response | Task 5 + Task 2 |

**Placeholder scan:** No TBD, "similar to", or vague steps found.

**Type consistency:**
- `UpcomingItem` defined in `RecurringService` and matched in `api.ts` dashboard type and `upcoming-panel.tsx` props.
- `DailySeries` type defined in `RecurringService` and matched in `DailySpendingChart` props and `ChartsToggleCard` props.
- `api.recurring.dismissPattern(id)` calls `DELETE /api/recurring/patterns/:id` — consistent with controller.
- `confirmItem.patternId` used in both confirm submit (to filter from `predicted`) and dismiss button — consistent with predicted row shape (`id: predicted_${patternId}`, `patternId: p.patternId`).
- `CurrencyAmount` imported from `@/components/currency-amount` in all new frontend files.
