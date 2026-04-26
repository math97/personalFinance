# PersonalFinance Repository Guide

This is the top-level instruction file for the repository. Use it to orient to the workspace before switching into the app-specific instruction files.

## Folder Map

```text
personalFinance/
  code/                Monorepo workspace and runnable apps
    apps/backend/      NestJS REST API
    apps/frontend/     Next.js App Router frontend
    docker-compose.yml Local Postgres + supporting services
  design/              Pencil design files
  docs/                Specs, plans, research, and review notes
  progress.txt         High-level project status
  README.md            Repo overview for humans
```

## Where To Read Next

- Backend work: [`code/apps/backend/AGENTS.md`](code/apps/backend/AGENTS.md)
- Frontend work: [`code/apps/frontend/AGENTS.md`](code/apps/frontend/AGENTS.md)
- Full app guidance: the matching `CLAUDE.md` in each app directory

## Common Rules

- Treat `code/` as the active application workspace.
- Keep backend and frontend guidance scoped to their own folders.
- For any database migration or destructive database operation, take a backup first.
- Do not assume framework defaults are current; read the local docs in the app folder before changing behavior.

