# Transaction Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional free-text `notes` field to each transaction, shown in the inline edit row and displayed as a muted subtitle when non-empty.

**Architecture:** Schema migration adds `notes TEXT?` to the Transaction table. The entity, mapper, abstract repo, both repo implementations, and DTOs gain the field. `exportCsv()` gains a notes column. The frontend inline edit row gains a notes input, and the row display shows a subtitle when notes are set.

**Tech Stack:** NestJS, Prisma v5, PostgreSQL, Next.js 14 (App Router), TypeScript, Vitest. Worktree: `.worktrees/p9-transaction-notes`. All commands run from within the worktree.

---

## File Map

| Action | Path |
|---|---|
| Modify | `code/apps/backend/prisma/schema.prisma` |
| Modify | `code/apps/backend/src/domain/entities/transaction.entity.ts` |
| Modify | `code/apps/backend/src/domain/repositories/transaction.repository.ts` |
| Modify | `code/apps/backend/src/infrastructure/repositories/prisma/transaction.mapper.ts` |
| Modify | `code/apps/backend/src/infrastructure/repositories/prisma/prisma-transaction.repository.ts` |
| Modify | `code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-transaction.repository.ts` |
| Modify | `code/apps/backend/src/modules/transactions/dto/create-transaction.dto.ts` |
| Modify | `code/apps/backend/src/modules/transactions/dto/update-transaction.dto.ts` |
| Modify | `code/apps/backend/src/modules/transactions/transactions.service.ts` |
| Modify | `code/apps/backend/src/tests/transactions.service.spec.ts` |
| Modify | `code/apps/frontend/src/lib/api.ts` |
| Modify | `code/apps/frontend/src/app/transactions/page.tsx` |

---

## Task 1: Schema + entity + mapper + repos (backend with TDD)

**Files:**
- Modify: `code/apps/backend/prisma/schema.prisma`
- Modify: `code/apps/backend/src/domain/entities/transaction.entity.ts`
- Modify: `code/apps/backend/src/domain/repositories/transaction.repository.ts`
- Modify: `code/apps/backend/src/infrastructure/repositories/prisma/transaction.mapper.ts`
- Modify: `code/apps/backend/src/infrastructure/repositories/prisma/prisma-transaction.repository.ts`
- Modify: `code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-transaction.repository.ts`
- Modify: `code/apps/backend/src/modules/transactions/dto/create-transaction.dto.ts`
- Modify: `code/apps/backend/src/modules/transactions/dto/update-transaction.dto.ts`
- Modify: `code/apps/backend/src/tests/transactions.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add this `describe` block at the bottom of `code/apps/backend/src/tests/transactions.service.spec.ts`, inside the outer `describe('TransactionsService', ...)`, before the final `})`:

```typescript
  // ── notes ────────────────────────────────────────────────────────
  describe('notes', () => {
    it('saves a note when creating a transaction', async () => {
      const result = await service.create({
        amount: -10, date: '2026-04-01', description: 'Test', notes: 'reimbursed by work',
      } as any)
      expect(result.notes).toBe('reimbursed by work')
    })

    it('saves null notes when not provided', async () => {
      const result = await tx()
      expect(result.notes).toBeNull()
    })

    it('update sets notes', async () => {
      const created = await tx()
      const updated = await service.update(created.id, { notes: 'split with João' })
      expect(updated.notes).toBe('split with João')
    })

    it('update clears notes when set to null', async () => {
      const created = await service.create({ amount: -10, date: '2026-04-01', description: 'Test', notes: 'memo' } as any)
      const updated = await service.update(created.id, { notes: null })
      expect(updated.notes).toBeNull()
    })

    it('update without notes field leaves existing note unchanged', async () => {
      const created = await service.create({ amount: -10, date: '2026-04-01', description: 'Test', notes: 'keep me' } as any)
      const updated = await service.update(created.id, { description: 'Changed' })
      expect(updated.notes).toBe('keep me')
    })
  })
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd .worktrees/p9-transaction-notes/code/apps/backend && npm test -- --testPathPattern="transactions.service" 2>&1 | tail -8
```

Expected: FAIL — `result.notes` is undefined.

- [ ] **Step 3: Add `notes` to schema**

In `code/apps/backend/prisma/schema.prisma`, find the `Transaction` model and add `notes` after `account`:

```prisma
  account      String?
  notes        String?   @db.Text
```

- [ ] **Step 4: Take DB backup and run migration**

```bash
docker exec code-db-1 pg_dump -U finance finance > ~/finance-backup-$(date +%Y%m%d-%H%M%S).sql
cd .worktrees/p9-transaction-notes/code/apps/backend && npx prisma migrate dev --name add-transaction-notes && npx prisma generate
```

Expected: migration created, `notes` column added, client regenerated.

- [ ] **Step 5: Add `notes` to `TransactionEntity`**

Replace the full file `code/apps/backend/src/domain/entities/transaction.entity.ts`:

```typescript
export type TransactionSource = 'manual' | 'pdf' | 'photo' | 'csv'

export interface CategoryRef {
  id: string
  name: string
  color: string
}

export interface CreateTransactionData {
  amount: number
  date: Date
  description: string
  source?: TransactionSource
  categoryId?: string | null
  merchant?: string | null
  account?: string | null
  notes?: string | null
}

export class TransactionEntity {
  constructor(
    public readonly id: string,
    public readonly amount: number,
    public readonly date: Date,
    public readonly description: string,
    public readonly source: TransactionSource,
    public readonly categoryId: string | null,
    public readonly category: CategoryRef | null,
    public readonly merchant: string | null,
    public readonly account: string | null,
    public readonly createdAt: Date,
    public readonly notes: string | null,
  ) {}

  static fromData(data: CreateTransactionData): Omit<TransactionEntity, 'id' | 'createdAt'> {
    return {
      amount: data.amount,
      date: data.date,
      description: data.description,
      source: data.source ?? 'manual',
      categoryId: data.categoryId ?? null,
      category: null,
      merchant: data.merchant ?? null,
      account: data.account ?? null,
      notes: data.notes ?? null,
    }
  }
}
```

- [ ] **Step 6: Update `TransactionMapper`**

Replace the full file `code/apps/backend/src/infrastructure/repositories/prisma/transaction.mapper.ts`:

```typescript
import { TransactionEntity } from '../../../domain/entities/transaction.entity'

export class TransactionMapper {
  static toDomain(p: any): TransactionEntity {
    return new TransactionEntity(
      p.id,
      Number(p.amount),
      p.date,
      p.description,
      p.source,
      p.categoryId ?? null,
      p.category
        ? { id: p.category.id, name: p.category.name, color: p.category.color }
        : null,
      p.merchant ?? null,
      p.account ?? null,
      p.createdAt,
      p.notes ?? null,
    )
  }
}
```

- [ ] **Step 7: Update `abstract update()` signature in `TransactionRepository`**

In `code/apps/backend/src/domain/repositories/transaction.repository.ts`, update the `update` abstract method signature to include `notes`:

```typescript
  abstract update(
    id: string,
    data: Partial<Pick<TransactionEntity, 'amount' | 'date' | 'description' | 'categoryId' | 'notes'>>,
  ): Promise<TransactionEntity>
```

- [ ] **Step 8: Update `PrismaTransactionRepository`**

In `code/apps/backend/src/infrastructure/repositories/prisma/prisma-transaction.repository.ts`:

**`save()` — add `notes` to create data:**
```typescript
  async save(entity: TransactionEntity): Promise<TransactionEntity> {
    const p = await this.prisma.transaction.create({
      data: {
        amount: entity.amount,
        date: entity.date,
        description: entity.description,
        source: entity.source,
        categoryId: entity.categoryId,
        merchant: entity.merchant,
        account: entity.account,
        notes: entity.notes,
      },
      include: { category: true },
    })
    return TransactionMapper.toDomain(p)
  }
```

**`update()` — add `notes` to the partial update:**
```typescript
  async update(
    id: string,
    data: Partial<Pick<TransactionEntity, 'amount' | 'date' | 'description' | 'categoryId' | 'notes'>>,
  ): Promise<TransactionEntity> {
    const p = await this.prisma.transaction.update({
      where: { id },
      data: {
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.date && { date: data.date }),
        ...(data.description && { description: data.description }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...('notes' in data && { notes: data.notes }),
      },
      include: { category: true },
    })
    return TransactionMapper.toDomain(p)
  }
```

Note: `'notes' in data` (not `data.notes !== undefined`) so that `null` explicitly clears the field.

- [ ] **Step 9: Update `InMemoryTransactionRepository`**

In `code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-transaction.repository.ts`:

**`save()` — pass `notes` to `TransactionEntity` constructor (add as last arg):**
```typescript
  async save(entity: TransactionEntity): Promise<TransactionEntity> {
    const id = entity.id || crypto.randomUUID()
    const persisted = new TransactionEntity(
      id, entity.amount, entity.date, entity.description,
      entity.source, entity.categoryId, entity.category,
      entity.merchant, entity.account, entity.createdAt,
      entity.notes,
    )
    this.store.set(id, persisted)
    return persisted
  }
```

**`update()` — handle `notes` in partial update:**
```typescript
  async update(
    id: string,
    data: Partial<Pick<TransactionEntity, 'amount' | 'date' | 'description' | 'categoryId' | 'notes'>>,
  ): Promise<TransactionEntity> {
    const existing = this.store.get(id)
    if (!existing) throw new Error(`Transaction ${id} not found`)
    const updated = new TransactionEntity(
      existing.id,
      data.amount ?? existing.amount,
      data.date ?? existing.date,
      data.description ?? existing.description,
      existing.source,
      data.categoryId !== undefined ? data.categoryId : existing.categoryId,
      existing.category,
      existing.merchant,
      existing.account,
      existing.createdAt,
      'notes' in data ? data.notes ?? null : existing.notes,
    )
    this.store.set(id, updated)
    return updated
  }
```

Also update every other place that constructs a `TransactionEntity` in the in-memory repo (e.g. `bulkUpdateCategory`) to pass `existing.notes` as the last argument.

- [ ] **Step 10: Update DTOs**

In `code/apps/backend/src/modules/transactions/dto/create-transaction.dto.ts`, add:
```typescript
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null
```

In `code/apps/backend/src/modules/transactions/dto/update-transaction.dto.ts`, add:
```typescript
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null
```

- [ ] **Step 11: Update `TransactionsService.create()` and `update()`**

In `code/apps/backend/src/modules/transactions/transactions.service.ts`:

**`create()`:** Pass `notes` when constructing `TransactionEntity`:
```typescript
  async create(dto: CreateTransactionDto) {
    const entity = new TransactionEntity(
      '',
      dto.amount,
      new Date(dto.date),
      dto.description,
      dto.source ?? 'manual',
      dto.categoryId ?? null,
      null,
      dto.merchant ?? null,
      dto.account ?? null,
      new Date(),
      dto.notes ?? null,
    )
    return this.repo.save(entity)
  }
```

**`update()`:** Pass `notes` in the partial data:
```typescript
  async update(id: string, dto: Partial<CreateTransactionDto>) {
    await this.findOne(id)
    return this.repo.update(id, {
      ...(dto.amount      !== undefined && { amount:      dto.amount             }),
      ...(dto.date                      && { date:        new Date(dto.date)     }),
      ...(dto.description               && { description: dto.description        }),
      ...(dto.categoryId  !== undefined && { categoryId:  dto.categoryId ?? null }),
      ...('notes' in dto                && { notes:       dto.notes ?? null      }),
    })
  }
```

- [ ] **Step 12: Add `notes` to `exportCsv()`**

In `code/apps/backend/src/modules/transactions/transactions.service.ts`, update `exportCsv()`:

Change:
```typescript
    const header = 'date,description,category,amount'
    const rows = sorted.map(tx => {
      const date        = tx.date.toISOString().slice(0, 10)
      const description = `"${tx.description.replace(/"/g, '""')}"`
      const category    = tx.category?.name ? `"${tx.category.name.replace(/"/g, '""')}"` : ''
      return `${date},${description},${category},${tx.amount}`
    })
```

To:
```typescript
    const header = 'date,description,category,amount,notes'
    const rows = sorted.map(tx => {
      const date        = tx.date.toISOString().slice(0, 10)
      const description = `"${tx.description.replace(/"/g, '""')}"`
      const category    = tx.category?.name ? `"${tx.category.name.replace(/"/g, '""')}"` : ''
      const notes       = tx.notes ? `"${tx.notes.replace(/"/g, '""')}"` : ''
      return `${date},${description},${category},${tx.amount},${notes}`
    })
```

- [ ] **Step 13: Run all tests**

```bash
cd .worktrees/p9-transaction-notes/code/apps/backend && npm test 2>&1 | tail -10
```

Expected: all tests pass including the 5 new ones (total 154).

- [ ] **Step 14: Commit**

```bash
cd .worktrees/p9-transaction-notes
git add \
  code/apps/backend/prisma \
  code/apps/backend/src/domain/entities/transaction.entity.ts \
  code/apps/backend/src/domain/repositories/transaction.repository.ts \
  code/apps/backend/src/infrastructure/repositories/prisma/transaction.mapper.ts \
  code/apps/backend/src/infrastructure/repositories/prisma/prisma-transaction.repository.ts \
  code/apps/backend/src/infrastructure/repositories/in-memory/in-memory-transaction.repository.ts \
  code/apps/backend/src/modules/transactions/dto/create-transaction.dto.ts \
  code/apps/backend/src/modules/transactions/dto/update-transaction.dto.ts \
  code/apps/backend/src/modules/transactions/transactions.service.ts \
  code/apps/backend/src/tests/transactions.service.spec.ts
git commit -m "feat: add notes field to Transaction — schema, entity, repos, DTOs, service, CSV export"
```

---

## Task 2: Frontend — API client + inline edit + row display

**Files:**
- Modify: `code/apps/frontend/src/lib/api.ts`
- Modify: `code/apps/frontend/src/app/transactions/page.tsx`

- [ ] **Step 1: Add `notes` to `api.ts` update type**

In `code/apps/frontend/src/lib/api.ts`, update the `update` method signature:

```typescript
    update: (id: string, data: Partial<{ amount: number; date: string; description: string; categoryId: string; notes: string | null }>) =>
      patch<any>(`/transactions/${id}`, data),
```

- [ ] **Step 2: Add `notes` to `editData` initialisation**

In `code/apps/frontend/src/app/transactions/page.tsx`, find the `startEdit` function and add `notes` to the editData entry:

```typescript
  function startEdit(tx: any) {
    setEditData(prev => ({
      ...prev,
      [tx.id]: {
        description: tx.description,
        date: tx.date.split('T')[0],
        amount: Math.abs(Number(tx.amount)).toFixed(2),
        categoryId: tx.category?.id ?? '',
        isIncome: Number(tx.amount) > 0,
        notes: tx.notes ?? '',
      },
    }))
    setEditing(tx.id)
  }
```

- [ ] **Step 3: Add `notes` to `saveEdit`**

Find the `saveEdit` function and pass `notes` in the update call:

```typescript
  async function saveEdit(id: string) {
    const d = editData[id]
    await api.transactions.update(id, {
      description: d.description,
      date: d.date,
      amount: d.isIncome ? Math.abs(Number(d.amount)) : -Math.abs(Number(d.amount)),
      categoryId: d.isIncome ? undefined : (d.categoryId || undefined),
      notes: d.notes.trim() === '' ? null : d.notes.trim(),
    })
    setEditing(null)
    refresh()
  }
```

- [ ] **Step 4: Add notes input to the inline edit row**

In the table body, find the inline edit form for the description cell (where the description `<input>` lives). Add a notes input below it:

```tsx
                        {/* Notes input — shown in edit mode below description */}
                        <input
                          type="text"
                          value={ed.notes ?? ''}
                          onChange={e => updateField(tx.id, { notes: e.target.value })}
                          maxLength={500}
                          placeholder="Add a note…"
                          className="mt-1 w-full rounded px-2 py-1 text-xs outline-none bg-surface border border-border text-text-2 placeholder:text-text-3"
                        />
```

This input sits inside the same `<td>` as the description input, directly below it.

- [ ] **Step 5: Show notes as subtitle in normal (non-edit) rows**

In the table body, find where `tx.description` is rendered in non-edit mode. Wrap it in a `<div>` and add the notes subtitle below:

```tsx
                        <div>
                          <span className="text-sm text-text">{tx.description}</span>
                          {tx.notes && (
                            <p className="text-xs text-text-3 mt-0.5">{tx.notes}</p>
                          )}
                        </div>
```

- [ ] **Step 6: TypeScript check**

```bash
cd .worktrees/p9-transaction-notes/code/apps/frontend && npx tsc --noEmit 2>&1 | grep -v "node_modules\|\.d\.ts\|e2e/\|playwright" | head -10
```

Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
cd .worktrees/p9-transaction-notes
git add code/apps/frontend/src/lib/api.ts \
        code/apps/frontend/src/app/transactions/page.tsx
git commit -m "feat: transaction notes — inline edit input and row subtitle display"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| `notes TEXT?` in schema | Task 1 Step 3 |
| Migration + prisma generate | Task 1 Step 4 |
| `notes` in `TransactionEntity` | Task 1 Step 5 |
| Mapper maps `notes` | Task 1 Step 6 |
| Abstract `update()` includes `notes` | Task 1 Step 7 |
| Prisma `save()` persists `notes` | Task 1 Step 8 |
| Prisma `update()` handles `notes` + null | Task 1 Step 8 |
| In-memory `save()` + `update()` | Task 1 Step 9 |
| DTOs validate `notes` (optional, max 500) | Task 1 Step 10 |
| Service `create()` passes `notes` | Task 1 Step 11 |
| Service `update()` passes `notes` | Task 1 Step 11 |
| CSV export includes `notes` column | Task 1 Step 12 |
| 5 new unit tests | Task 1 Step 1 |
| `api.ts` update includes `notes` | Task 2 Step 1 |
| `startEdit` initialises `notes` | Task 2 Step 2 |
| `saveEdit` sends `notes` (empty → null) | Task 2 Step 3 |
| Notes input in edit row | Task 2 Step 4 |
| Notes subtitle in display row | Task 2 Step 5 |

**Placeholder scan:** None.

**Type consistency:** `notes: string | null` used throughout entity, mapper, repos, DTOs, service. `notes: string | null` in api.ts update type. `notes: tx.notes ?? ''` in editData initialisation (empty string for the input, converted back to null on save when empty).
