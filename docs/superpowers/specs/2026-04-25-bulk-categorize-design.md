# Bulk Categorize — Design Spec

**Date:** 2026-04-25
**Status:** Approved

## Goal

Allow users to select multiple transactions on the Transactions page and assign (or remove) a category for all of them at once.

---

## Backend

### New endpoint: `PATCH /api/transactions/bulk-categorize`

**Body:** `{ ids: string[], categoryId: string | null }`

- `ids`: array of transaction IDs to update
- `categoryId`: category to assign, or `null` to remove the category

**Behaviour:**
- Uses Prisma `updateMany` to update all matching IDs in a single query
- Empty `ids` array → no-op, returns `{ updated: 0 }`
- Returns `{ updated: number }` — count of affected rows

**Files:**
- Create: `code/apps/backend/src/modules/transactions/dto/bulk-categorize.dto.ts`
- Modify: `code/apps/backend/src/modules/transactions/transactions.service.ts` — add `bulkCategorize()` method
- Modify: `code/apps/backend/src/modules/transactions/transactions.controller.ts` — add `PATCH /bulk-categorize` handler

### DTO

```typescript
export class BulkCategorizeDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[]

  @IsOptional()
  @IsString()
  categoryId: string | null
}
```

### Service method

```typescript
async bulkCategorize(ids: string[], categoryId: string | null): Promise<{ updated: number }>
```

Uses `TransactionRepository.bulkUpdateCategory(ids, categoryId)` — new abstract method added to the repo.

### Repository

New abstract method on `TransactionRepository`:

```typescript
abstract bulkUpdateCategory(ids: string[], categoryId: string | null): Promise<number>
```

Implemented in `PrismaTransactionRepository` using `prisma.transaction.updateMany`.
Implemented in `InMemoryTransactionRepository` using a loop over the store.

---

## Frontend

**Modified: `code/apps/frontend/src/app/transactions/page.tsx`**

### Selection state

```typescript
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
```

- Cleared when `year`, `month`, or `allTime` changes
- Predicted rows cannot be selected

### Checkbox column

- Added as the first column in the table (leftmost)
- Always visible (not hover-only)
- Table header gets a "select all on current page" checkbox
  - Checked when all `pageItems` (non-predicted) are selected
  - Indeterminate when some but not all are selected
  - Clicking selects/deselects all non-predicted rows on the current page
- Each real transaction row gets a checkbox in the first cell
- Predicted rows have no checkbox (empty first cell)

### Floating action bar

Rendered at fixed bottom-center when `selectedIds.size > 0`. Slides up via CSS transition.

Contents:
- `{N} selected` label
- Category `<select>` — options from existing `categories` state + a "No category" option (value `""` maps to `null`)
- `Apply` button — disabled until a category option is chosen; calls `PATCH /api/transactions/bulk-categorize`, then refreshes and clears `selectedIds` and the category picker
- `Deselect all` button — clears `selectedIds`
- Error message inline if the API call fails (selection preserved for retry)

### API client

Add to `code/apps/frontend/src/lib/api.ts`:

```typescript
bulkCategorize: (ids: string[], categoryId: string | null) =>
  patch<{ updated: number }>('/transactions/bulk-categorize', { ids, categoryId }),
```

---

## Error Handling

| Situation | Behaviour |
|---|---|
| Empty ids | Backend returns `{ updated: 0 }`, no error |
| API call fails | Error shown inline on the action bar; selection preserved |
| categoryId not found in DB | Prisma ignores silently (FK violation skips rows) — acceptable |

---

## Testing

**New tests in `code/apps/backend/src/tests/transactions.service.spec.ts`:**

- `bulkCategorize` assigns categoryId to all specified transactions
- `bulkCategorize` with `categoryId: null` removes category from all specified transactions
- `bulkCategorize` with empty ids array returns `{ updated: 0 }` and makes no changes

---

## File Map

| Action | Path |
|---|---|
| Create | `code/apps/backend/src/modules/transactions/dto/bulk-categorize.dto.ts` |
| Modify | `code/apps/backend/src/domain/repositories/transaction.repository.ts` |
| Modify | `code/apps/backend/src/infrastructure/repositories/prisma/prisma-transaction.repository.ts` |
| Modify | `code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-transaction.repository.ts` |
| Modify | `code/apps/backend/src/modules/transactions/transactions.service.ts` |
| Modify | `code/apps/backend/src/modules/transactions/transactions.controller.ts` |
| Modify | `code/apps/frontend/src/lib/api.ts` |
| Modify | `code/apps/frontend/src/app/transactions/page.tsx` |
