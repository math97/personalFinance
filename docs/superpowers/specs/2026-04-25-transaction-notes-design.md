# Transaction Notes — Design Spec

**Date:** 2026-04-25
**Status:** Approved

## Goal

Add an optional free-text `notes` field to each transaction so users can annotate specific entries with context that categories cannot express (e.g. "Reimbursed by work", "Split with João", "Birthday gift").

---

## Backend

### Schema

Add to `Transaction` model in `code/apps/backend/prisma/schema.prisma`:

```prisma
notes String? @db.Text
```

Migration name: `add-transaction-notes`

### Entity

Add `notes?: string | null` to `TransactionEntity` constructor and all usages.

### Repository

- `update()` in both `PrismaTransactionRepository` and `InMemoryTransactionRepository` must handle `notes` (include in the update data when provided)
- `save()` must persist `notes` from the entity
- Mapper must map `notes` in both directions

### DTO

`UpdateTransactionDto` gains:
```typescript
@IsOptional()
@IsString()
@MaxLength(500)
notes?: string | null
```

`CreateTransactionDto` gains the same field (optional).

### CSV Export

`exportCsv()` in `TransactionsService` includes `notes` as the last column:

```
date,description,category,amount,notes
2024-04-01,Netflix,Subscriptions,-17.99,
2024-04-03,Dinner,Restaurants,-42.00,Split with João
```

Empty notes → empty cell (no quotes).

---

## Frontend

### Inline edit row (`transactions/page.tsx`)

The existing inline edit mode (pencil icon per row) gains a notes input below the description field:

```tsx
<input
  type="text"
  placeholder="Add a note…"
  maxLength={500}
  value={editData[tx.id]?.notes ?? ''}
  onChange={e => updateField(tx.id, { notes: e.target.value })}
/>
```

Saved alongside the other fields when the user clicks ✓. Sending an empty string clears the note (maps to `null` in the backend).

### Row display

When a transaction has a non-empty `notes` value, show it as a small muted line below the description in the normal (non-edit) row:

```tsx
<div>
  <span>{tx.description}</span>
  {tx.notes && (
    <p className="text-xs text-text-3 mt-0.5">{tx.notes}</p>
  )}
</div>
```

---

## Error Handling

| Situation | Behaviour |
|---|---|
| notes > 500 chars | Rejected by DTO validation (400) |
| notes = "" on save | Sent as `null` to backend → clears existing note |
| notes absent in update body | Field unchanged (partial update) |

---

## Testing

New unit tests in `transactions.service.spec.ts`:
- `update()` with notes saves and returns the note
- `update()` with notes `null` clears it
- `update()` without notes field leaves existing note unchanged

---

## File Map

| Action | Path |
|---|---|
| Modify | `code/apps/backend/prisma/schema.prisma` |
| Modify | `code/apps/backend/src/domain/entities/transaction.entity.ts` |
| Modify | `code/apps/backend/src/domain/repositories/transaction.repository.ts` |
| Modify | `code/apps/backend/src/infrastructure/repositories/prisma/prisma-transaction.repository.ts` |
| Modify | `code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-transaction.repository.ts` |
| Modify | `code/apps/backend/src/modules/transactions/dto/create-transaction.dto.ts` |
| Modify | `code/apps/backend/src/modules/transactions/dto/update-transaction.dto.ts` |
| Modify | `code/apps/backend/src/modules/transactions/transactions.service.ts` |
| Modify | `code/apps/backend/src/tests/transactions.service.spec.ts` |
| Modify | `code/apps/frontend/src/lib/api.ts` |
| Modify | `code/apps/frontend/src/app/transactions/page.tsx` |
