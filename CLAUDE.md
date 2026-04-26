# CLAUDE.md

## Project Structure

```
personalFinance/
  code/                     ← monorepo root (npm workspaces)
    apps/
      frontend/             ← Next.js 14 App Router  :3000
      backend/              ← NestJS REST API         :3001
    docker-compose.yml
  design/                   ← Pencil design files (.pen)
  docs/superpowers/
    specs/                  ← approved design specs
    plans/                  ← implementation plans
  progress.txt              ← roadmap / what's done
```

## Starting the project

```bash
# 1. Start DB (from code/)
docker compose up -d

# 2. Backend
cd code/apps/backend && npm run start:dev

# 3. Frontend
cd code/apps/frontend && npm run dev
```

## App-specific instructions

Each app has its own CLAUDE.md with architecture, commands, patterns, and rules:

- **Backend** → `code/apps/backend/CLAUDE.md`
  Architecture, API endpoints, DI pattern, DB safety rules, environment variables.

- **Frontend** → `code/apps/frontend/CLAUDE.md`
  Tailwind v4 patterns, component conventions, `cn`, `tv`, `components/ui/`.

## Database Safety

Real personal financial data. **Always take a backup before any migration or destructive DB operation:**

```bash
docker exec code-db-1 pg_dump -U finance finance > ~/finance-backup-$(date +%Y%m%d-%H%M%S).sql
```

See `code/apps/backend/CLAUDE.md` for full DB safety rules.
