# All-Time Search & CSV Export — Design Spec

**Date:** 2026-04-25
**Status:** Approved

## Goal

P6: Extend the Transactions page to search across all months, not just the selected month.
P8: Add a CSV export button that downloads the current view or the full current month.

---

## P6 — Search Across All Months

### Backend

**Modified: `code/apps/backend/src/infrastructure/repositories/prisma/prisma-transaction.repository.ts`**

`findAll()` currently always applies a month/year date range. Make `year` and `month` optional in the date filter:

```typescript
// Current (always applies date range):
const year  = filters.year  ?? now.getFullYear()
const month = filters.month ?? (now.getMonth() + 1)
where.date  = { gte: startOfMonth(...), lte: endOfMonth(...) }

// New: only apply date filter when year + month are provided
if (filters.year !== undefined && filters.month !== undefined) {
  where.date = { gte: startOfMonth(new Date(filters.year, filters.month - 1)),
                 lte: endOfMonth(new Date(filters.year, filters.month - 1)) }
}
```

No changes to `TransactionFilters` type (year/month are already optional), no changes to controller or service.

**Modified: `code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-transaction.repository.ts`**

Same change: only apply date filter when `year` and `month` are both defined.

### Frontend

**Modified: `code/apps/frontend/src/app/transactions/page.tsx`**

Add `allTime` boolean state (default `false`).

When `allTime === true`:
- Pass no `year`/`month` to `api.transactions.list()`
- Hide the month navigator (`← April 2026 →`)
- Hide predicted rows (they're month-scoped)
- Show `All time` label instead of month label

Toggle button in the filter bar (next to search input):
- Two-state pill: `This month` | `All time`
- Amber highlight on active state
- Switching to "All time" keeps search and category filter, clears predicted rows

---

## P8 — Export to CSV

### Backend

**New endpoint:** `GET /api/transactions/export`

Query params: same as `GET /api/transactions` (`year?`, `month?`, `search?`, `categoryId?`) plus `scope: 'filtered' | 'month'`.

Behaviour:
- `scope=filtered`: applies all query params as provided (year, month, search, categoryId)
- `scope=month`: applies only year + month, ignores search and categoryId

Returns:
- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename=transactions-<label>.csv`
  - label: `YYYY-MM` when month-scoped, `all` when no year/month
- CSV body — header row + one row per transaction, sorted by date ascending:

```
date,description,category,amount
2024-04-01,Netflix,Subscriptions,-17.99
2024-04-03,Salary,,-2500.00
```

- `category` is the category name or empty string if uncategorized
- `amount` is the raw number (negative = expense, positive = income)

**Files:**
- Modify: `code/apps/backend/src/modules/transactions/transactions.controller.ts` — add `@Get('export')` handler
- Modify: `code/apps/backend/src/modules/transactions/transactions.service.ts` — add `exportCsv()` method
- Modify: `code/apps/backend/src/modules/transactions/dto/transaction-query.dto.ts` — add `scope` field

The `exportCsv()` method calls `this.txRepo.findAll()` with `perPage: 999999` and no pagination, then formats the result as a CSV string.

### Frontend

**Modified: `code/apps/frontend/src/app/transactions/page.tsx`**

Add an `Export` button with a dropdown in the page header (top-right area, next to the "Add transaction" button).

Two dropdown options:
- **Export current view** — builds URL from current filters (year/month or all-time, search, categoryId) with `scope=filtered`
- **Export entire month** — builds URL with only year/month, `scope=month`; disabled (grayed out) when in all-time mode

Download via a hidden `<a href="..." download>` element triggered programmatically — no new page/route needed.

The export URL points directly to `GET /api/transactions/export` on the backend (port 3001).

---

## Error Handling

| Situation | Behaviour |
|---|---|
| Export with no transactions matching filters | Returns CSV with header row only (valid empty CSV) |
| All-time mode + Export entire month | Button disabled, not clickable |

---

## Testing

**Backend unit test additions in `code/apps/backend/src/tests/transactions.service.spec.ts` (or equivalent):**

- `findAll()` with no year/month returns all transactions (no date filter)
- `findAll()` with year+month still applies date filter (regression)
- `exportCsv()` returns correct CSV string with header + rows
- `exportCsv()` with `scope=month` ignores search/categoryId params
- `exportCsv()` with no matching transactions returns header-only CSV

**Repository test additions in `in-memory-transaction.repository.ts` tests:**

- `findAll()` with `year: undefined, month: undefined` returns all stored transactions

---

## File Map

| Action | Path |
|---|---|
| Modify | `code/apps/backend/src/infrastructure/repositories/prisma/prisma-transaction.repository.ts` |
| Modify | `code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-transaction.repository.ts` |
| Modify | `code/apps/backend/src/modules/transactions/transactions.service.ts` |
| Modify | `code/apps/backend/src/modules/transactions/transactions.controller.ts` |
| Modify | `code/apps/backend/src/modules/transactions/dto/transaction-query.dto.ts` |
| Modify | `code/apps/frontend/src/app/transactions/page.tsx` |
