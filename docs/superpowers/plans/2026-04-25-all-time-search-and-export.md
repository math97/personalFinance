# All-Time Search & CSV Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add all-time search mode to the Transactions page and a CSV export button that downloads the current view or the full month.

**Architecture:** Backend — make `year`/`month` optional in `findAll()` (both repos) and add an `exportCsv()` service method behind a new `GET /api/transactions/export` endpoint. Frontend — add an `allTime` toggle that hides the month navigator and passes no date params, plus an Export dropdown with two options (current view / entire month).

**Tech Stack:** NestJS, TypeScript, Prisma v5, Next.js 14 (App Router), date-fns. Test runner: Vitest (`npm test` from `code/apps/backend`).

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Modify | `code/apps/backend/src/infrastructure/repositories/prisma/prisma-transaction.repository.ts` | Make date filter optional when year/month absent |
| Modify | `code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-transaction.repository.ts` | Same, for unit tests |
| Modify | `code/apps/backend/src/modules/transactions/transactions.service.ts` | Add `exportCsv()` method |
| Modify | `code/apps/backend/src/modules/transactions/transactions.controller.ts` | Add `GET /export` endpoint |
| Modify | `code/apps/backend/src/modules/transactions/dto/transaction-query.dto.ts` | Add `scope` field |
| Modify | `code/apps/backend/src/tests/transactions.service.spec.ts` | New tests for all-time findAll + exportCsv |
| Modify | `code/apps/frontend/src/app/transactions/page.tsx` | All-time toggle + export dropdown |

---

## Task 1: All-time findAll + exportCsv (backend with TDD)

**Files:**
- Modify: `code/apps/backend/src/infrastructure/repositories/prisma/prisma-transaction.repository.ts`
- Modify: `code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-transaction.repository.ts`
- Modify: `code/apps/backend/src/modules/transactions/transactions.service.ts`
- Modify: `code/apps/backend/src/modules/transactions/transactions.controller.ts`
- Modify: `code/apps/backend/src/modules/transactions/dto/transaction-query.dto.ts`
- Modify: `code/apps/backend/src/tests/transactions.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add the following `describe` blocks to the BOTTOM of `code/apps/backend/src/tests/transactions.service.spec.ts` (inside the outer `describe('TransactionsService', ...)` block, after the existing `findAll` describe):

```typescript
  // ── findAll all-time ─────────────────────────────────────────────
  describe('findAll — all-time mode', () => {
    beforeEach(async () => {
      await tx({ date: '2026-04-01', description: 'April tx', amount: -10 })
      await tx({ date: '2026-03-01', description: 'March tx', amount: -20 })
      await tx({ date: '2025-12-15', description: 'Dec tx',   amount: -30 })
    })

    it('returns all transactions when year and month are omitted', async () => {
      const result = await service.findAll({} as any)
      expect(result.total).toBe(3)
    })

    it('still filters by month when year+month are provided', async () => {
      const result = await service.findAll({ year: '2026', month: '4' } as any)
      expect(result.total).toBe(1)
      expect(result.items[0].description).toBe('April tx')
    })

    it('applies search filter across all months', async () => {
      const result = await service.findAll({ search: 'march' } as any)
      expect(result.total).toBe(1)
      expect(result.items[0].description).toBe('March tx')
    })
  })

  // ── exportCsv ────────────────────────────────────────────────────
  describe('exportCsv', () => {
    beforeEach(async () => {
      await tx({ date: '2026-04-01', description: 'Netflix',  amount: -17.99, categoryId: undefined })
      await tx({ date: '2026-04-03', description: 'Salary',   amount: 2500 })
      await tx({ date: '2026-03-15', description: 'Gym',      amount: -49 })
    })

    it('returns CSV string with header row', async () => {
      const csv = await service.exportCsv({ year: '2026', month: '4' } as any, 'filtered')
      expect(csv).toMatch(/^date,description,category,amount/)
    })

    it('includes one row per transaction sorted by date ascending', async () => {
      const csv = await service.exportCsv({ year: '2026', month: '4' } as any, 'filtered')
      const lines = csv.trim().split('\n')
      expect(lines).toHaveLength(3) // header + 2 rows
      expect(lines[1]).toContain('Netflix')
      expect(lines[2]).toContain('Salary')
    })

    it('amount is raw number (negative for expenses)', async () => {
      const csv = await service.exportCsv({ year: '2026', month: '4' } as any, 'filtered')
      expect(csv).toContain('-17.99')
      expect(csv).toContain('2500')
    })

    it('scope=month ignores search filter and returns all month transactions', async () => {
      const csv = await service.exportCsv(
        { year: '2026', month: '4', search: 'Netflix' } as any,
        'month',
      )
      const lines = csv.trim().split('\n')
      expect(lines).toHaveLength(3) // header + 2 rows (Netflix + Salary)
    })

    it('returns header-only CSV when no transactions match', async () => {
      const csv = await service.exportCsv({ year: '2020', month: '1' } as any, 'filtered')
      const lines = csv.trim().split('\n')
      expect(lines).toHaveLength(1)
      expect(lines[0]).toBe('date,description,category,amount')
    })

    it('all-time export returns all transactions', async () => {
      const csv = await service.exportCsv({} as any, 'filtered')
      const lines = csv.trim().split('\n')
      expect(lines).toHaveLength(4) // header + 3 rows
    })
  })
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd code/apps/backend && npm test -- --testPathPattern="transactions.service" 2>&1 | tail -8
```

Expected: FAIL — `service.exportCsv is not a function`

- [ ] **Step 3: Make `findAll` year/month optional in `InMemoryTransactionRepository`**

In `code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-transaction.repository.ts`, replace the `findAll` method:

```typescript
  async findAll(filters: TransactionFilters): Promise<PaginatedResult<TransactionEntity>> {
    const page    = filters.page    ?? 1
    const perPage = filters.perPage ?? 10

    let items = [...this.store.values()].filter(tx => {
      if (filters.year !== undefined && filters.month !== undefined) {
        const start = startOfMonth(new Date(filters.year, filters.month - 1))
        const end   = endOfMonth(new Date(filters.year, filters.month - 1))
        if (tx.date < start || tx.date > end) return false
      }
      if (filters.search && !tx.description.toLowerCase().includes(filters.search.toLowerCase())) return false
      if (filters.categoryId && tx.categoryId !== filters.categoryId) return false
      return true
    })

    items.sort((a, b) => b.date.getTime() - a.date.getTime())

    const total     = items.length
    const paginated = items.slice((page - 1) * perPage, page * perPage)
    return { items: paginated, total, page, perPage, totalPages: Math.ceil(total / perPage) }
  }
```

- [ ] **Step 4: Make `findAll` year/month optional in `PrismaTransactionRepository`**

In `code/apps/backend/src/infrastructure/repositories/prisma/prisma-transaction.repository.ts`, replace the `findAll` method:

```typescript
  async findAll(filters: TransactionFilters): Promise<PaginatedResult<TransactionEntity>> {
    const page    = filters.page    ?? 1
    const perPage = filters.perPage ?? 10

    const where: any = {}

    if (filters.year !== undefined && filters.month !== undefined) {
      where.date = {
        gte: startOfMonth(new Date(filters.year, filters.month - 1)),
        lte: endOfMonth(new Date(filters.year, filters.month - 1)),
      }
    }

    if (filters.search) {
      where.description = { contains: filters.search, mode: 'insensitive' }
    }
    if (filters.categoryId) {
      where.categoryId = filters.categoryId
    }

    const [rows, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip:  (page - 1) * perPage,
        take:  perPage,
        include: { category: true },
      }),
      this.prisma.transaction.count({ where }),
    ])

    return {
      items: rows.map(TransactionMapper.toDomain),
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    }
  }
```

- [ ] **Step 5: Add `scope` to `TransactionQueryDto`**

In `code/apps/backend/src/modules/transactions/dto/transaction-query.dto.ts`, add at the bottom:

```typescript
  @IsOptional()
  @IsString()
  scope?: string
```

- [ ] **Step 6: Add `exportCsv()` to `TransactionsService`**

In `code/apps/backend/src/modules/transactions/transactions.service.ts`, add this method after `findAll()`:

```typescript
  async exportCsv(query: TransactionQueryDto, scope: 'filtered' | 'month'): Promise<string> {
    const filters: any = {
      perPage: 999999,
      page:    1,
    }

    if (scope === 'month' || scope === 'filtered') {
      if (query.year)  filters.year  = Number(query.year)
      if (query.month) filters.month = Number(query.month)
    }

    if (scope === 'filtered') {
      if (query.search)     filters.search     = query.search
      if (query.categoryId) filters.categoryId = query.categoryId
    }

    const { items } = await this.repo.findAll(filters)

    const sorted = [...items].sort((a, b) => a.date.getTime() - b.date.getTime())

    const header = 'date,description,category,amount'
    const rows = sorted.map(tx => {
      const date        = tx.date.toISOString().slice(0, 10)
      const description = `"${tx.description.replace(/"/g, '""')}"`
      const category    = tx.category?.name ? `"${tx.category.name.replace(/"/g, '""')}"` : ''
      const amount      = tx.amount
      return `${date},${description},${category},${amount}`
    })

    return [header, ...rows].join('\n')
  }
```

- [ ] **Step 7: Add `GET /export` to `TransactionsController`**

In `code/apps/backend/src/modules/transactions/transactions.controller.ts`, add the `Res` import and the export handler. Replace the full file:

```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Res } from '@nestjs/common'
import { Response } from 'express'
import { TransactionsService } from './transactions.service'
import { CreateTransactionDto } from './dto/create-transaction.dto'
import { UpdateTransactionDto } from './dto/update-transaction.dto'
import { TransactionQueryDto } from './dto/transaction-query.dto'

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Post()
  create(@Body() dto: CreateTransactionDto) {
    return this.service.create(dto)
  }

  @Get('export')
  async export(@Query() query: TransactionQueryDto, @Res() res: Response) {
    const scope = (query.scope === 'month' ? 'month' : 'filtered') as 'filtered' | 'month'
    const csv   = await this.service.exportCsv(query, scope)

    const label = query.year && query.month
      ? `${query.year}-${String(query.month).padStart(2, '0')}`
      : 'all'

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename=transactions-${label}.csv`)
    res.send(csv)
  }

  @Get()
  findAll(@Query() query: TransactionQueryDto) {
    return this.service.findAll(query)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTransactionDto) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }
}
```

Note: `GET /export` MUST be declared before `GET /:id` — NestJS routes are matched in order and `:id` would greedily match `export` otherwise.

- [ ] **Step 8: Run all tests to verify they pass**

```bash
cd code/apps/backend && npm test 2>&1 | tail -10
```

Expected: all tests pass including the new 9 tests.

- [ ] **Step 9: Commit**

```bash
git add \
  code/apps/backend/src/infrastructure/repositories/prisma/prisma-transaction.repository.ts \
  code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-transaction.repository.ts \
  code/apps/backend/src/modules/transactions/transactions.service.ts \
  code/apps/backend/src/modules/transactions/transactions.controller.ts \
  code/apps/backend/src/modules/transactions/dto/transaction-query.dto.ts \
  code/apps/backend/src/tests/transactions.service.spec.ts
git commit -m "feat: all-time findAll, GET /api/transactions/export with scope=filtered|month"
```

---

## Task 2: Frontend — all-time toggle + export dropdown

**Files:**
- Modify: `code/apps/frontend/src/app/transactions/page.tsx`

- [ ] **Step 1: Add `allTime` state and update the data-fetch effect**

In `code/apps/frontend/src/app/transactions/page.tsx`, inside `TransactionsContent`, add the new state after the existing state declarations:

```typescript
  const [allTime, setAllTime] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
```

Replace the two existing `useEffect` calls that fetch transactions (both currently pass `{ year, month, perPage: 1000 }`) with:

```typescript
  useEffect(() => {
    api.transactions.list(allTime ? { perPage: 1000 } : { year, month, perPage: 1000 })
      .then(r => setTxs(r.items))
      .catch(() => {})
  }, [year, month, allTime])

  useEffect(() => {
    api.transactions.list(allTime ? { perPage: 1000 } : { year, month, perPage: 1000 })
      .then(r => setTxs(r.items))
      .catch(() => {})
  }, [year, month, allTime])
```

Wait — there are two `useEffect` calls that both set `txs` because one is triggered by a `refresh()` callback. Read the file carefully and only update the effects that call `api.transactions.list`. Both should use `allTime ? { perPage: 1000 } : { year, month, perPage: 1000 }`.

Also suppress predicted rows in all-time mode — in the `predictedRows` block, add this guard:

```typescript
  const predictedRows = showPredicted && !allTime
    ? predicted.filter(...).map(...)
    : []
```

- [ ] **Step 2: Hide the month navigator and show "All time" label when `allTime` is true**

Find the month navigator JSX — it looks like:

```tsx
<button onClick={() => { setYear(prevYear); setMonth(prevMonth) }}>←</button>
<span>{monthLabel}</span>
<button onClick={() => { setYear(nextYear); setMonth(nextMonth) }}>→</button>
```

Wrap it so it only renders when `allTime === false`, and add an "All time" label when true:

```tsx
{allTime ? (
  <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>All time</span>
) : (
  <>
    <button onClick={() => { setYear(prevYear); setMonth(prevMonth) }} ...>←</button>
    <span>{monthLabel}</span>
    <button onClick={() => { setYear(nextYear); setMonth(nextMonth) }} ...>→</button>
  </>
)}
```

Keep the exact existing styling on the buttons — just wrap them conditionally.

- [ ] **Step 3: Add the "This month / All time" toggle to the filter bar**

Find the filter bar JSX (where the search input and category filter dropdown live). Add this toggle at the end of the filter bar (after the existing "Show predicted" button):

```tsx
            <button
              onClick={() => setAllTime(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: allTime ? '#f59e0b18' : 'var(--surface)',
                border:     `1px solid ${allTime ? '#f59e0b44' : 'var(--border)'}`,
                color:      allTime ? 'var(--accent)' : 'var(--text-2)',
              }}
            >
              {allTime ? 'All time' : 'This month'}
            </button>
```

- [ ] **Step 4: Add the Export dropdown button**

Find the page header area where the "Add transaction" button (or month label) lives — typically a `<div className="flex items-center ...">` row at the top of the returned JSX.

Add this export button with dropdown immediately before or after the existing "Add transaction" button. Add the `BASE_URL` constant at the top of the component function (where other constants like `currency` are defined):

```typescript
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'
```

Then add the export dropdown JSX:

```tsx
            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text-2)' }}
              >
                Export
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                </svg>
              </button>

              {showExportMenu && (
                <div
                  className="absolute right-0 top-full mt-1 w-48 rounded-lg overflow-hidden z-20"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', boxShadow: '0 4px 12px #0006' }}
                >
                  {/* Export current view */}
                  <a
                    href={(() => {
                      const p = new URLSearchParams()
                      if (!allTime) { p.set('year', String(year)); p.set('month', String(month)) }
                      if (search)     p.set('search', search)
                      if (catFilter && catFilter !== 'uncategorized') p.set('categoryId', catFilter)
                      p.set('scope', 'filtered')
                      return `${BASE_URL}/transactions/export?${p.toString()}`
                    })()}
                    download
                    onClick={() => setShowExportMenu(false)}
                    className="flex items-center px-3 py-2.5 text-xs hover:bg-white/5 transition-colors"
                    style={{ color: 'var(--text)' }}
                  >
                    Export current view
                  </a>

                  {/* Export entire month — disabled in all-time mode */}
                  {allTime ? (
                    <span
                      className="flex items-center px-3 py-2.5 text-xs cursor-not-allowed"
                      style={{ color: 'var(--text-3)' }}
                    >
                      Export entire month
                    </span>
                  ) : (
                    <a
                      href={`${BASE_URL}/transactions/export?year=${year}&month=${month}&scope=month`}
                      download
                      onClick={() => setShowExportMenu(false)}
                      className="flex items-center px-3 py-2.5 text-xs hover:bg-white/5 transition-colors"
                      style={{ color: 'var(--text)' }}
                    >
                      Export entire month
                    </a>
                  )}
                </div>
              )}
            </div>
```

- [ ] **Step 5: Close the export menu when clicking outside**

Add a `useEffect` for the click-outside handler after the other `useEffect` hooks:

```typescript
  useEffect(() => {
    if (!showExportMenu) return
    const close = () => setShowExportMenu(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [showExportMenu])
```

And add `onClick={e => e.stopPropagation()}` to the export dropdown wrapper `<div className="relative">` so clicks inside the menu don't immediately close it.

- [ ] **Step 6: Verify TypeScript**

```bash
cd code/apps/frontend && npx tsc --noEmit 2>&1 | tail -10
```

Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add code/apps/frontend/src/app/transactions/page.tsx
git commit -m "feat: all-time search toggle and CSV export dropdown on transactions page"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| `findAll()` with no year/month returns all (Prisma) | Task 1 Step 4 |
| `findAll()` with no year/month returns all (in-memory) | Task 1 Step 3 |
| `exportCsv()` service method | Task 1 Step 6 |
| `scope=filtered` applies all filters | Task 1 Step 6 |
| `scope=month` ignores search/categoryId | Task 1 Step 6 |
| `GET /api/transactions/export` endpoint | Task 1 Step 7 |
| CSV format: `date,description,category,amount` | Task 1 Step 6 |
| CSV sorted by date ascending | Task 1 Step 6 |
| Empty result → header-only CSV | Task 1 Step 6 |
| `/export` route declared before `/:id` | Task 1 Step 7 |
| `allTime` toggle hides month navigator | Task 2 Step 2 |
| "All time" label shown when toggled | Task 2 Step 2 |
| Toggle in filter bar | Task 2 Step 3 |
| Predicted rows hidden in all-time mode | Task 2 Step 1 |
| Export dropdown with two options | Task 2 Step 4 |
| "Export entire month" disabled in all-time mode | Task 2 Step 4 |
| Click-outside closes export menu | Task 2 Step 5 |

**Placeholder scan:** None found.

**Type consistency:** `exportCsv(query: TransactionQueryDto, scope: 'filtered' | 'month')` defined in Step 6 and called with same signature from the controller in Step 7. `BASE_URL` defined locally in the frontend component and used in the dropdown href.
