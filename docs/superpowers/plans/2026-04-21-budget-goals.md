# Budget Goals per Category — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users set a monthly spending limit per category (as a fixed £ amount or % of salary), then surface progress bars on the Dashboard and in the Categories page with over-budget warnings.

**Architecture:** `monthlyBudget` is a nullable Decimal field on the `Category` Prisma model. The backend persists it via the existing `PATCH /api/categories/:id` endpoint (UpdateCategoryDto extended). The dashboard `/api/dashboard/summary` response includes `monthlyBudget` on every `byCategory` row at zero cost — no new endpoint. The "% of salary" option is frontend-only: it multiplies the salary (from `localStorage`) by the entered percentage and sends the resulting £ amount to the API. A new `BudgetBar` component is shared between the dashboard panel and the categories page.

**Tech Stack:** NestJS, Prisma v5, PostgreSQL, Next.js 14 (App Router), TypeScript, Vitest, Lucide React, class-validator.

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Modify | `code/apps/backend/prisma/schema.prisma` | Add `monthlyBudget Decimal? @db.Decimal(10,2)` to Category |
| Modify | `code/apps/backend/src/domain/entities/category.entity.ts` | Add `monthlyBudget: number \| null` field (default null) |
| Modify | `code/apps/backend/src/infrastructure/repositories/prisma/category.mapper.ts` | Map `monthlyBudget` Decimal → number \| null |
| Modify | `code/apps/backend/src/domain/repositories/category.repository.ts` | Add `monthlyBudget` to `update()` partial type |
| Modify | `code/apps/backend/src/infrastructure/repositories/prisma/prisma-category.repository.ts` | Pass `monthlyBudget` through Prisma `update()` |
| Modify | `code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-category.repository.ts` | Persist `monthlyBudget` in `update()` |
| Modify | `code/apps/backend/src/modules/categories/dto/update-category.dto.ts` | Add optional `monthlyBudget?: number \| null` |
| Modify | `code/apps/backend/src/modules/dashboard/dashboard.service.ts` | Include `monthlyBudget` on each `getSpendingByCategory` row |
| Modify | `code/apps/backend/src/tests/categories.service.spec.ts` | Tests: set / clear / validate budget via `update()` |
| Modify | `code/apps/backend/src/tests/dashboard.service.spec.ts` | Tests: `monthlyBudget` appears on spending rows |
| Modify | `code/apps/frontend/src/lib/api.ts` | Add `categories.setBudget()` |
| Create | `code/apps/frontend/src/components/budget-bar.tsx` | Reusable progress bar (tracks over-budget state) |
| Create | `code/apps/frontend/src/components/budget-progress-panel.tsx` | Dashboard card: budget rows with bars + alerts |
| Modify | `code/apps/frontend/src/app/dashboard/page.tsx` | Render `BudgetProgressPanel` below chart grid |
| Modify | `code/apps/frontend/src/app/categories/page.tsx` | Budget pill on collapsed row + budget editor in expanded section |

---

## Task 1: Schema, migration, entity

**Files:**
- Modify: `code/apps/backend/prisma/schema.prisma`
- Modify: `code/apps/backend/src/domain/entities/category.entity.ts`
- Modify: `code/apps/backend/src/infrastructure/repositories/prisma/category.mapper.ts`

- [ ] **Step 1: Add `monthlyBudget` to the Prisma Category model**

In `code/apps/backend/prisma/schema.prisma`, replace the Category model block:

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

Expected: new migration file created, DB schema updated, no data loss.

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

- [ ] **Step 5: Verify existing unit tests still pass**

```bash
cd code/apps/backend
npm test -- --testPathPattern="src/tests"
```

Expected: all existing tests pass (mapper change is additive — null default covers all existing test usages).

- [ ] **Step 6: Commit**

```bash
git add code/apps/backend/prisma \
        code/apps/backend/src/domain/entities/category.entity.ts \
        code/apps/backend/src/infrastructure/repositories/prisma/category.mapper.ts
git commit -m "feat: add monthlyBudget to Category entity, schema, and mapper"
```

---

## Task 2: Repository + DTO + service wiring

**Files:**
- Modify: `code/apps/backend/src/domain/repositories/category.repository.ts`
- Modify: `code/apps/backend/src/infrastructure/repositories/prisma/prisma-category.repository.ts`
- Modify: `code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-category.repository.ts`
- Modify: `code/apps/backend/src/modules/categories/dto/update-category.dto.ts`
- Modify: `code/apps/backend/src/modules/dashboard/dashboard.service.ts`

- [ ] **Step 1: Extend the abstract `CategoryRepository.update()` signature**

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

- [ ] **Step 2: Update `PrismaCategoryRepository.update()` to persist `monthlyBudget`**

Replace only the `update` method in `code/apps/backend/src/infrastructure/repositories/prisma/prisma-category.repository.ts`:

```typescript
async update(
  id: string,
  data: Partial<{ name: string; color: string; monthlyBudget: number | null }>,
): Promise<CategoryEntity> {
  const p = await this.prisma.category.update({
    where: { id },
    data: {
      ...(data.name       !== undefined && { name:          data.name }),
      ...(data.color      !== undefined && { color:         data.color }),
      ...(data.monthlyBudget !== undefined && { monthlyBudget: data.monthlyBudget }),
    },
    include: { rules: true, _count: { select: { transactions: true } } },
  })
  return CategoryMapper.toDomain(p)
}
```

- [ ] **Step 3: Update `InMemoryCategoryRepository.update()` to persist `monthlyBudget`**

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

- [ ] **Step 4: Add `monthlyBudget` to `UpdateCategoryDto`**

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

- [ ] **Step 5: Include `monthlyBudget` in `DashboardService.getSpendingByCategory`**

Replace only the `getSpendingByCategory` method in `code/apps/backend/src/modules/dashboard/dashboard.service.ts`:

```typescript
async getSpendingByCategory(year: number, month: number) {
  const [grouped, categories] = await Promise.all([
    this.txRepo.groupByCategory(year, month),
    this.catRepo.findAll(),
  ])

  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))

  return grouped
    .map(row => ({
      categoryId:   row.categoryId,
      name:         row.categoryId ? (catMap[row.categoryId]?.name         ?? 'Uncategorized') : 'Uncategorized',
      color:        row.categoryId ? (catMap[row.categoryId]?.color        ?? '#6b7280')       : '#6b7280',
      total:        row.total,
      monthlyBudget: row.categoryId ? (catMap[row.categoryId]?.monthlyBudget ?? null)          : null,
    }))
    .sort((a, b) => b.total - a.total)
}
```

- [ ] **Step 6: Run tests to verify nothing is broken**

```bash
cd code/apps/backend
npm test -- --testPathPattern="src/tests"
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add code/apps/backend/src/domain/repositories/category.repository.ts \
        code/apps/backend/src/infrastructure/repositories/prisma/prisma-category.repository.ts \
        code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-category.repository.ts \
        code/apps/backend/src/modules/categories/dto/update-category.dto.ts \
        code/apps/backend/src/modules/dashboard/dashboard.service.ts
git commit -m "feat: wire monthlyBudget through repo, DTO, and dashboard spending rows"
```

---

## Task 3: Backend unit tests

**Files:**
- Modify: `code/apps/backend/src/tests/categories.service.spec.ts`
- Modify: `code/apps/backend/src/tests/dashboard.service.spec.ts`

- [ ] **Step 1: Add budget tests to `categories.service.spec.ts`**

Append the following `describe` block at the bottom of the existing test file (before the final closing `}`):

```typescript
  // ── budget ───────────────────────────────────────────────────────
  describe('update — monthlyBudget', () => {
    it('sets a monthly budget on a category', async () => {
      const cat = await mkCat()
      const updated = await service.update(cat.id, { monthlyBudget: 300 })
      expect(updated.monthlyBudget).toBe(300)
    })

    it('clears the monthly budget when set to null', async () => {
      const cat = await mkCat()
      await service.update(cat.id, { monthlyBudget: 300 })
      const cleared = await service.update(cat.id, { monthlyBudget: null })
      expect(cleared.monthlyBudget).toBeNull()
    })

    it('does not affect other fields when only updating budget', async () => {
      const cat = await mkCat('Rent', '#818cf8')
      await service.update(cat.id, { monthlyBudget: 1000 })
      const found = await service.findOne(cat.id)
      expect(found.name).toBe('Rent')
      expect(found.color).toBe('#818cf8')
      expect(found.monthlyBudget).toBe(1000)
    })

    it('throws NotFoundException when setting budget on nonexistent category', async () => {
      await expect(service.update('nonexistent', { monthlyBudget: 100 })).rejects.toThrow(NotFoundException)
    })
  })
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd code/apps/backend
npm test -- --testPathPattern="categories.service"
```

Expected: 3 new tests PASS immediately (logic already wired in Task 2), 1 NotFoundException test also PASS.

- [ ] **Step 3: Add budget tests to `dashboard.service.spec.ts`**

Append the following `describe` block at the end of the `DashboardService` test suite:

```typescript
  // ── getSpendingByCategory — budget ───────────────────────────────
  describe('getSpendingByCategory with budget', () => {
    it('includes monthlyBudget on rows where category has a budget set', async () => {
      const groceries = await catRepo.save(
        new CategoryEntity('', 'Groceries', '#34d399', [], 0, 300),
      )
      await saveTx({ amount: -120, date: '2026-04-10', categoryId: groceries.id })

      const rows = await service.getSpendingByCategory(2026, 4)

      const row = rows.find(r => r.name === 'Groceries')
      expect(row?.monthlyBudget).toBe(300)
    })

    it('returns null monthlyBudget for categories without a budget', async () => {
      const transport = await catRepo.save(
        new CategoryEntity('', 'Transport', '#38bdf8', [], 0),
      )
      await saveTx({ amount: -40, date: '2026-04-05', categoryId: transport.id })

      const rows = await service.getSpendingByCategory(2026, 4)

      const row = rows.find(r => r.name === 'Transport')
      expect(row?.monthlyBudget).toBeNull()
    })
  })
```

- [ ] **Step 4: Run all tests**

```bash
cd code/apps/backend
npm test -- --testPathPattern="src/tests"
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add code/apps/backend/src/tests/categories.service.spec.ts \
        code/apps/backend/src/tests/dashboard.service.spec.ts
git commit -m "test: budget update and dashboard budget row unit tests"
```

---

## Task 4: Frontend API client + shared BudgetBar component

**Files:**
- Modify: `code/apps/frontend/src/lib/api.ts`
- Create: `code/apps/frontend/src/components/budget-bar.tsx`

- [ ] **Step 1: Add `categories.setBudget` to the API client**

In `code/apps/frontend/src/lib/api.ts`, add one line to the `categories` object (after `removeRule`):

```typescript
  categories: {
    list: () => get<any[]>('/categories'),
    create: (data: { name: string; color: string }) => post<any>('/categories', data),
    remove: (id: string) => del<any>(`/categories/${id}`),
    addRule: (categoryId: string, keyword: string) => post<any>(`/categories/${categoryId}/rules`, { keyword }),
    removeRule: (ruleId: string) => del<any>(`/categories/rules/${ruleId}`),
    setBudget: (id: string, monthlyBudget: number | null) =>
      patch<any>(`/categories/${id}`, { monthlyBudget }),
  },
```

- [ ] **Step 2: Create `budget-bar.tsx`**

Create `code/apps/frontend/src/components/budget-bar.tsx`:

```tsx
type BudgetBarProps = {
  spent: number
  budget: number
  color: string
}

export function BudgetBar({ spent, budget, color }: BudgetBarProps) {
  const pct = Math.min(Math.round((spent / budget) * 100), 100)
  const isOver = spent > budget
  const fillColor  = isOver ? 'var(--red)' : color
  const trackColor = isOver ? '#f8717120' : 'var(--surface-2)'

  return (
    <div
      className="w-full h-1.5 rounded-full overflow-hidden"
      style={{ background: trackColor }}
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, background: fillColor }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add code/apps/frontend/src/lib/api.ts \
        code/apps/frontend/src/components/budget-bar.tsx
git commit -m "feat: add setBudget API method and BudgetBar component"
```

---

## Task 5: Dashboard — BudgetProgressPanel

**Files:**
- Create: `code/apps/frontend/src/components/budget-progress-panel.tsx`
- Modify: `code/apps/frontend/src/app/dashboard/page.tsx`

- [ ] **Step 1: Create `budget-progress-panel.tsx`**

Create `code/apps/frontend/src/components/budget-progress-panel.tsx`:

```tsx
import { TriangleAlert, CircleAlert } from 'lucide-react'
import { BudgetBar } from './budget-bar'
import { CurrencyAmount } from './currency-amount'

type BudgetRow = {
  categoryId: string | null
  name: string
  color: string
  total: number
  monthlyBudget: number | null
}

export function BudgetProgressPanel({ rows }: { rows: BudgetRow[] }) {
  const budgetRows = rows.filter(r => r.monthlyBudget !== null)
  if (budgetRows.length === 0) return null

  const alerts = budgetRows.filter(r => {
    const pct = (Number(r.total) / Number(r.monthlyBudget!)) * 100
    return pct >= 90
  })

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Spending vs Budget
        </h2>
        {alerts.length > 0 && (
          <span className="text-xs font-medium" style={{ color: 'var(--red)' }}>
            {alerts.length} {alerts.length === 1 ? 'alert' : 'alerts'}
          </span>
        )}
      </div>

      {/* Budget rows */}
      <div>
        {budgetRows.map(row => {
          const spent  = Number(row.total)
          const budget = Number(row.monthlyBudget!)
          const pct    = Math.round((spent / budget) * 100)
          const isOver = spent > budget
          const isNear = !isOver && pct >= 90

          return (
            <div
              key={row.categoryId ?? row.name}
              className="flex items-center gap-3 px-5 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: row.color }}
              />
              <span
                className="text-sm font-medium w-36 truncate"
                style={{ color: 'var(--text)' }}
              >
                {row.name}
              </span>
              <div className="flex-1 min-w-0">
                <BudgetBar spent={spent} budget={budget} color={row.color} />
              </div>
              <span
                className="text-xs tabular-nums w-28 text-right"
                style={{ color: isOver ? 'var(--red)' : 'var(--text-2)' }}
              >
                <CurrencyAmount amount={spent} /> / <CurrencyAmount amount={budget} />
              </span>
              <span
                className="text-xs font-semibold w-14 text-right flex items-center justify-end gap-1"
                style={{ color: isOver ? 'var(--red)' : isNear ? 'var(--accent)' : 'var(--text-2)' }}
              >
                {isOver && <TriangleAlert size={11} />}
                {isNear && !isOver && <CircleAlert size={11} />}
                {pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add `BudgetProgressPanel` to the dashboard page**

In `code/apps/frontend/src/app/dashboard/page.tsx`, add the import at the top:

```typescript
import { BudgetProgressPanel } from '@/components/budget-progress-panel'
```

Then add the panel below the `{/* Charts */}` grid (after the closing `</div>` of the 2-column grid, before `{/* Recent transactions */}`):

```tsx
          {/* Budget progress */}
          {byCategory.some((r: any) => r.monthlyBudget != null) && (
            <div className="mb-4">
              <BudgetProgressPanel rows={byCategory} />
            </div>
          )}
```

- [ ] **Step 3: Start dev server and verify**

```bash
cd code/apps/frontend && npm run dev
```

Open `http://localhost:3000/dashboard`. If no budgets are set yet, the panel is invisible. Use the backend API directly to set a budget for testing:

```bash
curl -X PATCH http://localhost:3001/api/categories/<id> \
  -H "Content-Type: application/json" \
  -d '{"monthlyBudget": 150}'
```

Replace `<id>` with a real category ID from `GET http://localhost:3001/api/categories`. Refresh the dashboard — the "Spending vs Budget" panel should appear with a progress bar.

- [ ] **Step 4: Commit**

```bash
git add code/apps/frontend/src/components/budget-progress-panel.tsx \
        code/apps/frontend/src/app/dashboard/page.tsx
git commit -m "feat: BudgetProgressPanel on dashboard — spending vs budget rows"
```

---

## Task 6: Categories page — budget display and editor

**Files:**
- Modify: `code/apps/frontend/src/app/categories/page.tsx`

The categories page is a client component. The changes add:
1. A budget pill in the collapsed row header
2. A "Monthly Budget" section in the expanded row containing the £/% toggle editor and a progress bar showing current month usage

- [ ] **Step 1: Add state and handler for budget editing**

In `code/apps/frontend/src/app/categories/page.tsx`, add these imports at the top (alongside existing ones):

```typescript
import { BudgetBar } from '@/components/budget-bar'
import { CurrencyAmount } from '@/components/currency-amount'
import { useCurrency } from '@/hooks/useCurrency'
```

Add these state declarations inside the component (after the existing `useState` calls):

```typescript
  const [currency] = useCurrency()
  // budgetMode: which input type is active per category ('amount' | 'pct')
  const [budgetMode, setBudgetMode] = useState<Record<string, 'amount' | 'pct'>>({})
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>({})
  const [budgetSaving, setBudgetSaving] = useState<Record<string, boolean>>({})
```

Add this handler (after the existing `addCategory` function):

```typescript
  async function saveBudget(catId: string) {
    const mode   = budgetMode[catId]  ?? 'amount'
    const raw    = budgetInputs[catId] ?? ''
    if (raw === '') return

    let amount: number
    if (mode === 'pct') {
      const salary = Number(localStorage.getItem('finance_salary') ?? 3500)
      amount = Math.round((Number(raw) / 100) * salary * 100) / 100
    } else {
      amount = Number(raw)
    }
    if (isNaN(amount) || amount < 0) return

    setBudgetSaving(prev => ({ ...prev, [catId]: true }))
    try {
      await api.categories.setBudget(catId, amount)
      setCategories(prev =>
        prev.map(c => c.id === catId ? { ...c, monthlyBudget: amount } : c),
      )
      setBudgetInputs(prev => ({ ...prev, [catId]: '' }))
    } finally {
      setBudgetSaving(prev => ({ ...prev, [catId]: false }))
    }
  }

  async function clearBudget(catId: string) {
    await api.categories.setBudget(catId, null)
    setCategories(prev =>
      prev.map(c => c.id === catId ? { ...c, monthlyBudget: null } : c),
    )
  }
```

- [ ] **Step 2: Add budget pill to the collapsed category row header**

Locate the section inside the categories page that renders the collapsed row header for each category. It currently contains the category dot, name, rule count badge, and expand chevron. Add the budget pill between the rule count and the chevron:

```tsx
                {/* Budget pill — shown on collapsed row */}
                {cat.monthlyBudget != null ? (
                  <span
                    className="text-xs px-2 py-0.5 rounded-md font-medium"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
                  >
                    <CurrencyAmount amount={cat.monthlyBudget} />/mo
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: 'var(--text-3)' }}>no budget</span>
                )}
```

- [ ] **Step 3: Add the budget editor section inside the expanded row**

In the expanded section of each category (where keyword rules are shown), add a new budget section below the keyword rules block. This goes inside the `expanded === cat.id` conditional rendering:

```tsx
                {/* Monthly Budget section */}
                <div
                  className="mt-4 pt-4"
                  style={{ borderTop: '1px solid var(--border)' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                      Monthly Budget
                    </p>
                    {cat.monthlyBudget != null && (
                      <button
                        onClick={() => clearBudget(cat.id)}
                        className="text-xs"
                        style={{ color: 'var(--text-3)' }}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* £ / % toggle */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs" style={{ color: 'var(--text-3)' }}>Set by</span>
                    {(['amount', 'pct'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setBudgetMode(prev => ({ ...prev, [cat.id]: m }))}
                        className="px-3 py-1 rounded-md text-xs font-medium"
                        style={{
                          background: (budgetMode[cat.id] ?? 'amount') === m ? 'var(--accent)' : 'var(--surface-2)',
                          color:      (budgetMode[cat.id] ?? 'amount') === m ? '#0c0c0e'       : 'var(--text-2)',
                          border:     (budgetMode[cat.id] ?? 'amount') === m ? 'none'           : '1px solid var(--border)',
                        }}
                      >
                        {m === 'amount' ? `${currency} Amount` : '% of salary'}
                      </button>
                    ))}
                  </div>

                  {/* Input row */}
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="flex items-center gap-1 px-3 h-9 rounded-lg text-sm"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', width: 160 }}
                    >
                      <span style={{ color: 'var(--text-3)' }}>
                        {(budgetMode[cat.id] ?? 'amount') === 'amount' ? currency : '%'}
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={(budgetMode[cat.id] ?? 'amount') === 'pct' ? 1 : 10}
                        value={budgetInputs[cat.id] ?? (cat.monthlyBudget != null
                          ? (budgetMode[cat.id] === 'pct'
                            ? String(Math.round((cat.monthlyBudget / Number(localStorage.getItem('finance_salary') ?? 3500)) * 100))
                            : String(cat.monthlyBudget))
                          : '')}
                        onChange={e => setBudgetInputs(prev => ({ ...prev, [cat.id]: e.target.value }))}
                        placeholder={(budgetMode[cat.id] ?? 'amount') === 'pct' ? '0' : '0.00'}
                        className="bg-transparent outline-none w-full text-sm"
                        style={{ color: 'var(--text)' }}
                      />
                    </div>
                    <button
                      onClick={() => saveBudget(cat.id)}
                      disabled={budgetSaving[cat.id] || !budgetInputs[cat.id]}
                      className="px-4 h-9 rounded-lg text-sm font-semibold disabled:opacity-40"
                      style={{ background: 'var(--accent)', color: '#0c0c0e' }}
                    >
                      {budgetSaving[cat.id] ? 'Saving…' : 'Save'}
                    </button>
                    {(budgetMode[cat.id] ?? 'amount') === 'pct' && budgetInputs[cat.id] && (
                      <span className="text-xs px-3 py-1 rounded-lg" style={{ background: '#f59e0b10', color: 'var(--accent)' }}>
                        = <CurrencyAmount
                          amount={Math.round((Number(budgetInputs[cat.id]) / 100) * Number(localStorage.getItem('finance_salary') ?? 3500) * 100) / 100}
                        />/mo
                      </span>
                    )}
                  </div>

                  {/* Progress bar — current month spend vs budget */}
                  {cat.monthlyBudget != null && cat.currentMonthSpent != null && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs" style={{ color: 'var(--text-2)' }}>
                        <span>
                          <CurrencyAmount amount={cat.currentMonthSpent} /> spent
                        </span>
                        <span style={{ color: cat.currentMonthSpent > cat.monthlyBudget ? 'var(--red)' : 'var(--text-2)' }}>
                          <CurrencyAmount amount={Math.abs(cat.monthlyBudget - cat.currentMonthSpent)} />
                          {cat.currentMonthSpent > cat.monthlyBudget ? ' over' : ' remaining'}
                        </span>
                      </div>
                      <BudgetBar
                        spent={cat.currentMonthSpent}
                        budget={cat.monthlyBudget}
                        color={cat.color}
                      />
                    </div>
                  )}
                </div>
```

- [ ] **Step 4: Fetch current month spend per category**

The categories API (`GET /api/categories`) does not currently return current-month spend. To keep the backend change minimal, fetch spend data from the already-loaded dashboard summary that the user navigates from — or simpler: fetch `api.dashboard.summary(year, month)` in the categories page to get `byCategory` for the current month.

Add to the `useEffect` in `code/apps/frontend/src/app/categories/page.tsx`:

```typescript
  const now = new Date()
  
  useEffect(() => {
    Promise.all([
      api.categories.list(),
      api.dashboard.summary(now.getFullYear(), now.getMonth() + 1),
    ])
      .then(([cats, dash]) => {
        const spendMap: Record<string, number> = {}
        for (const row of dash.byCategory) {
          if (row.categoryId) spendMap[row.categoryId] = Number(row.total)
        }
        setCategories(cats.map((c: any) => ({
          ...c,
          currentMonthSpent: spendMap[c.id] ?? 0,
        })))
      })
      .catch(() => setError('Failed to load categories'))
      .finally(() => setIsLoading(false))
  }, [])
```

Remove the old `useEffect` that only called `api.categories.list()`.

- [ ] **Step 5: Verify in browser**

Start the dev server and open `http://localhost:3000/categories`. Expand a category. You should see the "Monthly Budget" section with the £/% toggle. Enter an amount and click Save. The collapsed row should now show the budget pill. Navigate to the dashboard — the "Spending vs Budget" panel should appear.

- [ ] **Step 6: Commit**

```bash
git add code/apps/frontend/src/app/categories/page.tsx
git commit -m "feat: budget editor in categories page — set by £ amount or % of salary"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| Set monthly spending limit per category | Tasks 1, 2, 6 |
| Show % used on dashboard | Tasks 4, 5 |
| Warn when exceeded (red bar, alert badge) | Task 5 (BudgetProgressPanel) |
| Set by £ amount | Task 6 (amount mode) |
| Set by % of salary | Task 6 (pct mode with localStorage salary) |
| Backend stores budget | Tasks 1, 2 |
| Unit tests | Task 3 |

**Placeholder scan:** None found. All steps have concrete code.

**Type consistency check:**
- `monthlyBudget: number | null` — used consistently in entity, mapper, repository, DTO, and frontend state.
- `BudgetBar` props (`spent`, `budget`, `color`) — used identically in `BudgetProgressPanel` and the categories page.
- `api.categories.setBudget(id, monthlyBudget)` — defined in Task 4, called in Task 6.
- `cat.currentMonthSpent` — set in Task 6 Step 4 `useEffect`, read in Task 6 Step 3 JSX.
- `CurrencyAmount` — already exists in the codebase, imported in both new components.
