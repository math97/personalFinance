# Backend — Claude Code Instructions

NestJS REST API running on port 3001.

## Commands

```bash
# From code/apps/backend/

npm run start:dev          # dev server with watch
npm test                   # unit tests (no DB — in-memory repos)
npm run test:e2e           # e2e tests (requires Docker DB)

npx prisma migrate dev --name <name>   # create + apply migration
npx prisma generate                    # regenerate client after schema changes
npx prisma studio                      # GUI for the DB
npx ts-node prisma/seed.ts             # seed 9 default categories
```

> **After any schema change:** always run `npx prisma generate` or the TypeScript compiler will fail with type mismatches.

## Architecture — Repository Pattern + Light DDD

```
src/
  domain/
    entities/       ← plain TS classes, no Prisma types
    repositories/   ← abstract classes used as NestJS DI tokens
    services/       ← domain logic (categorization pipeline)
    ports/          ← AI abstraction (AIPort)

  infrastructure/
    repositories/
      prisma/       ← Prisma implementations + mappers
      in-memory/    ← for unit tests (no DB needed)
    ai/             ← AnthropicAdapter, OpenRouterAdapter

  modules/          ← NestJS modules (controller + service + DI wiring)
    transactions/
    categories/
    import/
    dashboard/
    recurring/
    settings/
    insights/

  lib/
    csv-parser.ts   ← CsvParser injectable
    rules.ts        ← applyRules() pure function

  tests/            ← unit tests using in-memory repos
  prisma/           ← PrismaService singleton
```

## DI Pattern

```typescript
// Module wires abstract class → concrete Prisma implementation
{ provide: TransactionRepository, useClass: PrismaTransactionRepository }

// Tests swap to in-memory — no service code changes needed
{ provide: TransactionRepository, useValue: new InMemoryTransactionRepository() }
```

**Rule:** Services inject repositories. No direct Prisma calls in services.

## Service → Repository map

| Service | Repositories |
|---|---|
| `TransactionsService` | `TransactionRepository` |
| `CategoriesService` | `CategoryRepository` |
| `ImportService` | `ImportBatchRepository` + `CategoryRepository` + `TransactionRepository` + `RecurringService` + `CsvParser` |
| `DashboardService` | `TransactionRepository` + `CategoryRepository` + `ImportBatchRepository` + `RecurringService` |
| `RecurringService` | `TransactionRepository` + `CategoryRepository` + `RecurringPatternRepository` |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/transactions` | List — `?year&month&search&categoryId&page&perPage` |
| GET | `/api/transactions/export` | CSV download — `?year&month&search&categoryId&scope=filtered\|month` |
| POST | `/api/transactions` | Create |
| PATCH | `/api/transactions/bulk-categorize` | Bulk assign category — `{ ids, categoryId }` |
| PATCH | `/api/transactions/:id` | Update |
| DELETE | `/api/transactions/:id` | Delete |
| GET | `/api/categories` | List all with rules + tx count |
| POST | `/api/categories` | Create |
| DELETE | `/api/categories/:id` | Delete |
| POST | `/api/categories/:id/rules` | Add keyword rule |
| DELETE | `/api/categories/rules/:ruleId` | Delete rule |
| GET | `/api/import/batches` | Reviewing batches |
| GET | `/api/import/batches/:id` | Single batch with imported transactions |
| POST | `/api/import/upload` | Upload file (PDF / image / CSV) → extract transactions |
| POST | `/api/import/batches/:id/confirm` | Promote to transactions |
| DELETE | `/api/import/batches/:id` | Discard batch |
| PATCH | `/api/import/transactions/:id` | Edit imported transaction |
| POST | `/api/import/transactions/:id/save-rule` | Save categorization as rule |
| GET | `/api/dashboard/summary` | `?year&month` → summary + charts + upcoming + dailyTotals |
| GET | `/api/recurring/upcoming` | `?year&month` → predicted upcoming transactions |
| DELETE | `/api/recurring/patterns/:id` | Dismiss a recurring pattern |
| GET | `/api/settings` | App settings (AI provider config) |
| PATCH | `/api/settings` | Update settings |
| POST | `/api/settings/test` | Test AI connection |

> **Route ordering:** static routes MUST be declared before parameterised ones in the same controller. e.g. `GET /export` before `GET /:id`, `PATCH /bulk-categorize` before `PATCH /:id`.

## Environment Variables

`code/apps/backend/.env`:
```
DATABASE_URL="postgresql://finance:finance@localhost:5432/finance"
AI_PROVIDER=openrouter          # or: anthropic
AI_API_KEY=sk-or-...
AI_MODEL=google/gemini-2.5-flash-preview
PORT=3001
```

## Database Safety Rules

**This DB contains real personal financial data.**

### BEFORE any DB operation: take a backup

```bash
docker exec code-db-1 pg_dump -U finance finance > ~/finance-backup-$(date +%Y%m%d-%H%M%S).sql
```

### NEVER run without explicit confirmation + backup

- `prisma db push --force-reset` — drops all tables
- `prisma migrate reset` — drops all tables
- `docker compose down -v` — destroys DB volume
- Raw `DROP TABLE`, `TRUNCATE`, `DELETE FROM` without WHERE

### When migrations seem broken

1. Stop. Do not reset.
2. Take a backup.
3. Check `SELECT * FROM _prisma_migrations;` in Prisma Studio or psql.
4. Ask the user what to do.

### Worktrees + DB

Worktrees share the same Docker DB. Always copy `.env` from `code/apps/backend/.env` into the worktree before starting the backend there.
