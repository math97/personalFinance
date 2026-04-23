# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Structure

```
personalFinance/
  code/           ← monorepo root — ALL commands run from here unless noted
    apps/
      frontend/   ← Next.js 14 (App Router), port 3000
      backend/    ← NestJS REST API, port 3001
    packages/
    docker-compose.yml
    package.json
  design/         ← Pencil design files (financeDesign.pen, design.pen)
  research/       ← competitor research
  docs/
    superpowers/
      specs/      ← 2026-04-15-personal-finance-mvp-design.md
      plans/      ← 2026-04-15-personal-finance-mvp.md
  progress.txt    ← what's done / what's missing
  CLAUDE.md       ← this file
```

## Tech Stack

Next.js 16 (App Router), TypeScript, NestJS, PostgreSQL (Docker Compose), Prisma ORM v5, Anthropic SDK (Claude API), Recharts, react-dropzone, date-fns.

## Commands

```bash
# Start database (from code/)
docker compose up -d

# Dev — frontend (port 3000)
cd code/apps/frontend && npm run dev

# Dev — backend (port 3001)
cd code/apps/backend && npm run start:dev

# Unit tests (no DB needed — uses in-memory repos)
cd code/apps/backend && npm test -- --testPathPattern="src/tests"

# All backend tests
cd code/apps/backend && npm test

# Database migrations
cd code/apps/backend && npx prisma migrate dev --name <name>

# Seed categories (9 default)
cd code/apps/backend && npx ts-node prisma/seed.ts

# Prisma Studio
cd code/apps/backend && npx prisma studio
```

## Backend Architecture (Repository Pattern + Light DDD)

```
src/
  domain/
    entities/          ← plain TS classes, no Prisma types
      transaction.entity.ts
      category.entity.ts
      category-rule.entity.ts
      import-batch.entity.ts
      imported-transaction.entity.ts
    repositories/      ← abstract classes used as NestJS DI tokens
      transaction.repository.ts
      category.repository.ts
      import-batch.repository.ts
    services/
      categorization.domain-service.ts  ← rules → AI → uncategorized pipeline

  infrastructure/
    repositories/
      prisma/          ← real Prisma implementations + mappers
      in-memory/       ← for unit tests (no DB needed)

  modules/             ← NestJS modules (controller + service + DI wiring)
    transactions/
    categories/
    import/
    dashboard/

  prisma/              ← PrismaService (singleton)
  lib/
    claude.service.ts  ← implements AICategorizationPort
    rules.ts           ← applyRules() pure function
  tests/               ← unit tests using in-memory repos
```

### DI Pattern (how repositories are wired)
```typescript
// Module provides abstract class → concrete Prisma impl
{ provide: TransactionRepository, useClass: PrismaTransactionRepository }

// In tests — swap to in-memory without touching service code
{ provide: TransactionRepository, useValue: new InMemoryTransactionRepository() }
```

### Services inject repositories (no direct Prisma calls in services)
- `TransactionsService` → `TransactionRepository`
- `CategoriesService` → `CategoryRepository`
- `ImportService` → `ImportBatchRepository` + `CategoryRepository` + `TransactionRepository` + `CategorizationDomainService`
- `DashboardService` → `TransactionRepository` + `CategoryRepository` + `ImportBatchRepository`

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/transactions` | List with `?year&month&search&categoryId&page&perPage` |
| POST | `/api/transactions` | Create transaction |
| PATCH | `/api/transactions/:id` | Update transaction |
| DELETE | `/api/transactions/:id` | Delete transaction |
| GET | `/api/categories` | List all with rules + tx count |
| POST | `/api/categories` | Create category |
| DELETE | `/api/categories/:id` | Delete category |
| POST | `/api/categories/:id/rules` | Add keyword rule |
| DELETE | `/api/categories/rules/:ruleId` | Delete rule |
| GET | `/api/import/batches` | Reviewing batches |
| GET | `/api/import/batches/:id` | Single batch with imported transactions |
| POST | `/api/import/upload` | Upload file → Claude extraction |
| POST | `/api/import/batches/:id/confirm` | Promote to transactions |
| DELETE | `/api/import/batches/:id` | Discard batch |
| PATCH | `/api/import/transactions/:id` | Edit imported transaction |
| POST | `/api/import/transactions/:id/save-rule` | Save categorization as rule |
| GET | `/api/dashboard/summary` | `?year&month` → summary + charts data |

## Frontend Pages

| Route | Component type | Data source |
|---|---|---|
| `/dashboard` | Server Component | `api.dashboard.summary()` |
| `/transactions` | Client Component | `api.transactions.list()` via useEffect |
| `/import` | Client Component | `api.import.batches()` via useEffect |
| `/import/inbox` | Server Component | `api.import.batches()` |
| `/import/[batchId]` | Server → Client | `api.import.batch(id)` + `BatchReviewClient` |
| `/categories` | Client Component | `api.categories.list()` via useEffect |

Key files:
- `code/apps/frontend/src/lib/api.ts` — typed fetch client (skip undefined params)
- `code/apps/frontend/src/components/sidebar.tsx` — fetches inbox count on each navigation
- `code/apps/frontend/src/components/batch-review-client.tsx` — batch review interactive state

## Environment Variables

`code/apps/backend/.env`:
```
DATABASE_URL="postgresql://finance:finance@localhost:5432/finance"
ANTHROPIC_API_KEY="your-key-here"
PORT=3001
```

## Database Safety Rules

**This DB contains real personal financial data. These rules are non-negotiable.**

### BEFORE any DB operation: take a backup

```bash
# Backup (run from anywhere)
docker exec code-db-1 pg_dump -U finance finance > ~/finance-backup-$(date +%Y%m%d-%H%M%S).sql
```

### NEVER run these without explicit user confirmation + backup first

- `prisma db push --force-reset` — DROPS ALL TABLES AND DATA
- `prisma migrate reset` — DROPS ALL TABLES AND DATA
- `docker compose down -v` — DESTROYS DB VOLUME
- Any raw `DROP TABLE`, `TRUNCATE`, `DELETE FROM` without a WHERE clause
- Any `dropSchema` or `resetDatabase` call

### When migrations seem broken

If `prisma migrate deploy` says "no pending" but tables are missing:
1. **Stop. Do not reset.**
2. Take a backup first (command above).
3. Check `SELECT * FROM _prisma_migrations;` in Prisma Studio or psql.
4. Ask the user what to do before taking any destructive action.

### Worktrees + DB

Worktrees share the same Docker DB (localhost:5432). Always copy `.env` from `code/apps/backend/.env` into the worktree before starting the backend there. Never assume a fresh worktree has its own isolated DB.
