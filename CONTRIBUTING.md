# Contributing

Thanks for your interest in contributing! Here's everything you need to get started.

## Prerequisites

- Node.js 20+
- Docker
- An AI API key (see [README — Getting an API key](README.md#getting-an-api-key))

## Local setup

Follow the [setup steps in the README](README.md#setup) to get the app running locally before making any changes.

## Development workflow

1. Fork the repository and create a branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. Make your changes. Keep each PR focused on one thing.

3. Run the tests before pushing:
   ```bash
   # Unit tests (no database required)
   cd code/apps/backend
   npm test -- --testPathPattern="src/tests"
   ```

4. Push your branch and open a pull request against `main`.

## Project structure

```
code/apps/backend/src/
  domain/
    entities/       Plain TS classes — no Prisma types
    repositories/   Abstract classes used as NestJS DI tokens
    services/       Domain services (categorisation pipeline)
  infrastructure/
    repositories/
      prisma/       Real database implementations
      in-memory/    Used in unit tests (no DB needed)
  modules/          NestJS modules — controller + service + DI wiring
  lib/
    rules.ts        Pure function — applies keyword rules to transactions
  tests/            Unit tests
```

The backend follows a repository pattern with light DDD. Services never call Prisma directly — they always go through an injected repository. Unit tests swap in the in-memory repository so no database is needed.

## Adding a feature

- New backend logic → add a domain entity or service, then wire it through the module.
- New API endpoint → add it to the relevant module's controller and document it in the README.
- New frontend page → use a Server Component for initial data, Client Component for interactivity.

## Environment variables

Never commit `.env` files. The only env file in source control is `.env.example`.

## Code style

- TypeScript strict mode throughout.
- No `any` unless truly unavoidable.
- No comments that just restate what the code does — only comment non-obvious constraints or workarounds.

## Reporting bugs

Open an issue using the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md).

## Suggesting features

Open an issue using the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md).
