# Bulk Categorize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users select multiple transactions and assign (or remove) a category for all of them at once via a floating action bar.

**Architecture:** A new `bulkUpdateCategory()` abstract method on `TransactionRepository` is implemented in both Prisma and in-memory repos. `TransactionsService.bulkCategorize()` delegates to it. A new `PATCH /api/transactions/bulk-categorize` endpoint handles the request. The frontend adds `selectedIds` state, per-row checkboxes, a header "select all" checkbox, and a fixed floating bar that appears when any rows are selected.

**Tech Stack:** NestJS, Prisma v5, TypeScript, Next.js 14 (App Router), Tailwind CSS, class-validator. Test runner: Vitest (`npm test` from `code/apps/backend`).

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Create | `code/apps/backend/src/modules/transactions/dto/bulk-categorize.dto.ts` | Validates `{ ids, categoryId }` body |
| Modify | `code/apps/backend/src/domain/repositories/transaction.repository.ts` | Add `bulkUpdateCategory()` abstract method |
| Modify | `code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-transaction.repository.ts` | Implement `bulkUpdateCategory()` |
| Modify | `code/apps/backend/src/infrastructure/repositories/prisma/prisma-transaction.repository.ts` | Implement `bulkUpdateCategory()` with `updateMany` |
| Modify | `code/apps/backend/src/modules/transactions/transactions.service.ts` | Add `bulkCategorize()` method |
| Modify | `code/apps/backend/src/modules/transactions/transactions.controller.ts` | Add `PATCH /bulk-categorize` handler |
| Modify | `code/apps/backend/src/tests/transactions.service.spec.ts` | 3 new tests |
| Modify | `code/apps/frontend/src/lib/api.ts` | Add `bulkCategorize()` to transactions API |
| Modify | `code/apps/frontend/src/app/transactions/page.tsx` | Selection state, checkboxes, floating bar |

---

## Task 1: Backend — bulkUpdateCategory + bulkCategorize endpoint (TDD)

**Files:**
- Create: `code/apps/backend/src/modules/transactions/dto/bulk-categorize.dto.ts`
- Modify: `code/apps/backend/src/domain/repositories/transaction.repository.ts`
- Modify: `code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-transaction.repository.ts`
- Modify: `code/apps/backend/src/infrastructure/repositories/prisma/prisma-transaction.repository.ts`
- Modify: `code/apps/backend/src/modules/transactions/transactions.service.ts`
- Modify: `code/apps/backend/src/modules/transactions/transactions.controller.ts`
- Modify: `code/apps/backend/src/tests/transactions.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add this `describe` block at the bottom of `code/apps/backend/src/tests/transactions.service.spec.ts`, inside the outer `describe('TransactionsService', ...)`, before the final `})`:

```typescript
  // ── bulkCategorize ───────────────────────────────────────────────
  describe('bulkCategorize', () => {
    it('assigns categoryId to all specified transactions', async () => {
      const t1 = await tx({ date: '2026-04-01', description: 'Netflix', amount: -17.99 })
      const t2 = await tx({ date: '2026-04-02', description: 'Gym',     amount: -49 })
      await tx({ date: '2026-04-03', description: 'Other', amount: -10 })

      const result = await service.bulkCategorize([t1.id, t2.id], 'cat-subs')

      expect(result).toEqual({ updated: 2 })
      expect((await service.findOne(t1.id)).categoryId).toBe('cat-subs')
      expect((await service.findOne(t2.id)).categoryId).toBe('cat-subs')
    })

    it('removes category when categoryId is null', async () => {
      const t1 = await tx({ date: '2026-04-01', description: 'Netflix', amount: -17.99, categoryId: 'cat-subs' })

      await service.bulkCategorize([t1.id], null)

      expect((await service.findOne(t1.id)).categoryId).toBeNull()
    })

    it('returns { updated: 0 } and makes no changes when ids is empty', async () => {
      await tx({ date: '2026-04-01', description: 'Netflix', amount: -17.99 })

      const result = await service.bulkCategorize([], 'cat-subs')

      expect(result).toEqual({ updated: 0 })
      expect(repo.store.size).toBe(1)
    })
  })
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd code/apps/backend && npm test -- --testPathPattern="transactions.service" 2>&1 | tail -8
```

Expected: FAIL — `service.bulkCategorize is not a function`

- [ ] **Step 3: Create `BulkCategorizeDto`**

Create `code/apps/backend/src/modules/transactions/dto/bulk-categorize.dto.ts`:

```typescript
import { IsArray, IsString, IsOptional } from 'class-validator'

export class BulkCategorizeDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[]

  @IsOptional()
  @IsString()
  categoryId: string | null
}
```

- [ ] **Step 4: Add `bulkUpdateCategory` abstract method to `TransactionRepository`**

In `code/apps/backend/src/domain/repositories/transaction.repository.ts`, add this line at the end of the abstract class (after `findAllExpensesByDateRange`):

```typescript
  abstract bulkUpdateCategory(ids: string[], categoryId: string | null): Promise<number>
```

- [ ] **Step 5: Implement in `InMemoryTransactionRepository`**

In `code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-transaction.repository.ts`, add this method at the end of the class (after `findAllExpensesByDateRange`):

```typescript
  async bulkUpdateCategory(ids: string[], categoryId: string | null): Promise<number> {
    if (ids.length === 0) return 0
    let count = 0
    for (const id of ids) {
      const existing = this.store.get(id)
      if (!existing) continue
      this.store.set(id, new TransactionEntity(
        existing.id, existing.amount, existing.date, existing.description,
        existing.source, categoryId, existing.category,
        existing.merchant, existing.account, existing.createdAt,
      ))
      count++
    }
    return count
  }
```

- [ ] **Step 6: Implement in `PrismaTransactionRepository`**

In `code/apps/backend/src/infrastructure/repositories/prisma/prisma-transaction.repository.ts`, add this method at the end of the class (after `findAllExpensesByDateRange`):

```typescript
  async bulkUpdateCategory(ids: string[], categoryId: string | null): Promise<number> {
    if (ids.length === 0) return 0
    const result = await this.prisma.transaction.updateMany({
      where: { id: { in: ids } },
      data:  { categoryId },
    })
    return result.count
  }
```

- [ ] **Step 7: Add `bulkCategorize()` to `TransactionsService`**

In `code/apps/backend/src/modules/transactions/transactions.service.ts`, add this method after `remove()`:

```typescript
  async bulkCategorize(ids: string[], categoryId: string | null): Promise<{ updated: number }> {
    const updated = await this.repo.bulkUpdateCategory(ids, categoryId)
    return { updated }
  }
```

- [ ] **Step 8: Add `PATCH /bulk-categorize` to `TransactionsController`**

In `code/apps/backend/src/modules/transactions/transactions.controller.ts`:

1. Add `BulkCategorizeDto` to the imports:
```typescript
import { BulkCategorizeDto } from './dto/bulk-categorize.dto'
```

2. Add the route handler **before** `@Patch(':id')` (NestJS matches routes in order — `bulk-categorize` must come before `:id` or it will be swallowed by the param route):

```typescript
  @Patch('bulk-categorize')
  bulkCategorize(@Body() dto: BulkCategorizeDto) {
    return this.service.bulkCategorize(dto.ids, dto.categoryId ?? null)
  }
```

- [ ] **Step 9: Run all tests**

```bash
cd code/apps/backend && npm test 2>&1 | tail -10
```

Expected: all tests pass including the 3 new ones (total 149).

- [ ] **Step 10: Commit**

```bash
git add \
  code/apps/backend/src/modules/transactions/dto/bulk-categorize.dto.ts \
  code/apps/backend/src/domain/repositories/transaction.repository.ts \
  code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-transaction.repository.ts \
  code/apps/backend/src/infrastructure/repositories/prisma/prisma-transaction.repository.ts \
  code/apps/backend/src/modules/transactions/transactions.service.ts \
  code/apps/backend/src/modules/transactions/transactions.controller.ts \
  code/apps/backend/src/tests/transactions.service.spec.ts
git commit -m "feat: PATCH /api/transactions/bulk-categorize with bulkUpdateCategory repo method"
```

---

## Task 2: Frontend — API client + checkboxes + floating action bar

**Files:**
- Modify: `code/apps/frontend/src/lib/api.ts`
- Modify: `code/apps/frontend/src/app/transactions/page.tsx`

- [ ] **Step 1: Add `bulkCategorize` to the API client**

In `code/apps/frontend/src/lib/api.ts`, inside the `transactions` object (after `remove`), add:

```typescript
    bulkCategorize: (ids: string[], categoryId: string | null) =>
      patch<{ updated: number }>('/transactions/bulk-categorize', { ids, categoryId }),
```

- [ ] **Step 2: Add selection state to `TransactionsContent`**

In `code/apps/frontend/src/app/transactions/page.tsx`, add these state declarations after the `showExportMenu` state:

```typescript
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('')
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [bulkSaving, setBulkSaving] = useState(false)
```

- [ ] **Step 3: Clear selection when month/allTime changes**

Find the `useEffect` that fetches transactions (the one with `setIsLoading`). Add `setSelectedIds(new Set())` and `setPage(1)` at the start of it:

```typescript
  useEffect(() => {
    setIsLoading(true)
    setError(null)
    setSelectedIds(new Set())
    api.transactions.list(allTime ? { perPage: 1000 } : { year, month, perPage: 1000 })
      .then(r => setAllItems(r.items))
      .catch(() => setError('Failed to load transactions'))
      .finally(() => setIsLoading(false))
  }, [year, month, allTime])
```

- [ ] **Step 4: Add checkbox column to the table header**

Find the `<thead>` / table header row in the JSX. It currently has columns for date, description, category, source, amount, and actions. Add a checkbox `<th>` as the first column:

```tsx
                <th className="pb-2 pr-4 w-8">
                  <input
                    type="checkbox"
                    className="rounded"
                    style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                    checked={
                      pageItems.filter(i => !i._predicted).length > 0 &&
                      pageItems.filter(i => !i._predicted).every(i => selectedIds.has(i.id))
                    }
                    ref={el => {
                      if (el) el.indeterminate =
                        pageItems.filter(i => !i._predicted).some(i => selectedIds.has(i.id)) &&
                        !pageItems.filter(i => !i._predicted).every(i => selectedIds.has(i.id))
                    }}
                    onChange={e => {
                      const realIds = pageItems.filter(i => !i._predicted).map(i => i.id)
                      if (e.target.checked) {
                        setSelectedIds(prev => new Set([...prev, ...realIds]))
                      } else {
                        setSelectedIds(prev => {
                          const next = new Set(prev)
                          realIds.forEach(id => next.delete(id))
                          return next
                        })
                      }
                    }}
                  />
                </th>
```

- [ ] **Step 5: Add per-row checkbox to each real transaction row**

In the table body, for each real (non-predicted) `<tr>`, add a `<td>` as the first cell with a checkbox:

```tsx
                    <td className="py-3 pr-4 w-8">
                      <input
                        type="checkbox"
                        className="rounded"
                        style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                        checked={selectedIds.has(tx.id)}
                        onChange={e => {
                          setSelectedIds(prev => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(tx.id)
                            else next.delete(tx.id)
                            return next
                          })
                        }}
                      />
                    </td>
```

For the predicted rows, add an empty first cell so columns stay aligned:

```tsx
                    <td className="py-3 pr-4 w-8" />
```

- [ ] **Step 6: Add the floating action bar**

Add this JSX block just before the closing `</div>` of the main page wrapper (after the confirm popover, near the bottom of the return statement):

```tsx
      {/* Bulk categorize floating bar */}
      {selectedIds.size > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-2)',
            boxShadow: '0 8px 32px #000a',
            minWidth: 420,
          }}
        >
          <span className="text-sm font-medium shrink-0" style={{ color: 'var(--text)' }}>
            {selectedIds.size} selected
          </span>

          <select
            value={bulkCategoryId}
            onChange={e => { setBulkCategoryId(e.target.value); setBulkError(null) }}
            className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--text)' }}
          >
            <option value="">Pick a category…</option>
            <option value="__none__">No category</option>
            {categories.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <button
            disabled={bulkSaving || bulkCategoryId === ''}
            onClick={async () => {
              setBulkSaving(true)
              setBulkError(null)
              try {
                const categoryId = bulkCategoryId === '__none__' ? null : bulkCategoryId
                await api.transactions.bulkCategorize([...selectedIds], categoryId)
                setSelectedIds(new Set())
                setBulkCategoryId('')
                refresh()
              } catch {
                setBulkError('Failed to apply — please retry')
              } finally {
                setBulkSaving(false)
              }
            }}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-40 shrink-0"
            style={{ background: 'var(--accent)', color: '#0c0c0e' }}
          >
            {bulkSaving ? 'Applying…' : 'Apply'}
          </button>

          <button
            onClick={() => { setSelectedIds(new Set()); setBulkCategoryId(''); setBulkError(null) }}
            className="text-xs shrink-0"
            style={{ color: 'var(--text-2)' }}
          >
            Deselect all
          </button>

          {bulkError && (
            <span className="text-xs" style={{ color: 'var(--red)' }}>{bulkError}</span>
          )}
        </div>
      )}
```

- [ ] **Step 7: Verify TypeScript**

```bash
cd code/apps/frontend && npx tsc --noEmit 2>&1 | tail -10
```

Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add code/apps/frontend/src/lib/api.ts \
        code/apps/frontend/src/app/transactions/page.tsx
git commit -m "feat: bulk categorize — checkboxes, select all, floating action bar"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| `BulkCategorizeDto` with `ids` + `categoryId` | Task 1 Step 3 |
| `bulkUpdateCategory` abstract method | Task 1 Step 4 |
| In-memory implementation | Task 1 Step 5 |
| Prisma `updateMany` implementation | Task 1 Step 6 |
| `bulkCategorize()` service method | Task 1 Step 7 |
| `PATCH /bulk-categorize` before `PATCH /:id` | Task 1 Step 8 |
| Returns `{ updated: number }` | Task 1 Step 7 |
| Empty ids → `{ updated: 0 }` no-op | Task 1 Step 5+6, tested in Step 1 |
| `null` categoryId removes category | Task 1 Steps 5+6, tested in Step 1 |
| `api.transactions.bulkCategorize` | Task 2 Step 1 |
| `selectedIds` state | Task 2 Step 2 |
| Selection cleared on month/allTime change | Task 2 Step 3 |
| Per-row checkboxes | Task 2 Step 5 |
| Header "select all" checkbox with indeterminate | Task 2 Step 4 |
| Predicted rows get empty first cell | Task 2 Step 5 |
| Floating bar appears when selectedIds.size > 0 | Task 2 Step 6 |
| Category picker with "No category" option | Task 2 Step 6 |
| Apply calls `bulkCategorize`, refreshes, clears | Task 2 Step 6 |
| Apply disabled until category chosen | Task 2 Step 6 |
| Error shown inline, selection preserved | Task 2 Step 6 |
| Deselect all clears selection | Task 2 Step 6 |

**Placeholder scan:** None found.

**Type consistency:** `bulkUpdateCategory(ids: string[], categoryId: string | null): Promise<number>` defined in Task 1 Steps 4/5/6. `bulkCategorize(ids: string[], categoryId: string | null)` in service (Step 7) matches. `api.transactions.bulkCategorize([...selectedIds], categoryId)` in frontend (Step 6) passes `string[]` and `string | null` — consistent throughout.
