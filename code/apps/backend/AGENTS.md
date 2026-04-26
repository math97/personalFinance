# Backend Agent Instructions

This file applies to `code/apps/backend/` and its descendants.

## Scope

- NestJS REST API on port `3001`
- Domain entities, repository abstractions, service layer, and Prisma-backed infrastructure
- Unit tests in `src/tests/` and e2e tests in `test/`

## Core Rules

| Rule | Do | Don't |
|---|---|---|
| Repository access | Inject abstract repositories into services | Call `prisma.*` directly from services |
| Test strategy | Use in-memory repositories for unit tests | Hit the real DB in unit tests |
| Schema changes | Run `npx prisma generate` after every schema change | Leave the generated client stale |
| Static routes | Declare static routes before `/:id` routes | Let parameter routes swallow static ones |
| Database safety | Back up before migration or destructive DB work | Skip the backup step |

## Architecture

- Keep business logic in services and domain code, not controllers.
- Add new repository methods to the abstract repository first, then implement them in both Prisma and in-memory adapters.
- Keep Prisma mappers in the infrastructure layer.
- Preserve the existing DI pattern where modules bind abstract repositories to concrete implementations.

## Adding A Feature

1. Add or extend the relevant domain entity or repository contract.
2. Implement the Prisma repository in `src/infrastructure/repositories/prisma/`.
3. Implement the in-memory repository in `src/infrastructure/repositories/in-memory/`.
4. Add or update the service.
5. Add or update controller routes.
6. Add unit tests in `src/tests/`.
7. If the schema changed, run migration plus `npx prisma generate`.

## Commands

```bash
cd code/apps/backend
npm run start:dev
npm test
npm run test:e2e
npx prisma migrate dev --name <name>
npx prisma generate
npx prisma studio
```

## Database Safety

- Always create a backup before migrations, resets, truncations, or mass deletes.
- Treat the database as production data, even in local development.
- If a migration looks broken, stop and inspect the migration history before trying destructive recovery.
- Worktrees share the same Docker database, so copy the local `.env` into the worktree before starting the backend there.

