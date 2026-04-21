# Personal Finance

A self-hosted personal finance tracker that uses AI to automatically categorise your bank transactions. Upload a PDF statement, review the AI-extracted entries, confirm them, and get a live dashboard of your spending.

## Features

- Upload bank statements (PDF) — AI extracts transactions automatically
- Rule-based + AI categorisation pipeline
- Monthly dashboard with charts
- Full transaction history with search and filters
- Configurable categories and keyword rules
- Works with any AI provider supported by OpenRouter (or Anthropic direct)

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Docker](https://www.docker.com/) (for the PostgreSQL database)
- An AI API key — see [Getting an API key](#getting-an-api-key)

## Getting an API key

The app supports two AI providers. **OpenRouter is the easiest starting point** because one key gives you access to many models (Claude, GPT-4o, Gemini, etc.) and has a free tier.

### Option A — OpenRouter (recommended)

1. Go to [openrouter.ai](https://openrouter.ai) and sign up.
2. Navigate to **Keys** → **Create key**.
3. Copy the key (starts with `sk-or-`).
4. In your `.env` file set:
   ```
   AI_PROVIDER=openrouter
   AI_API_KEY=sk-or-...
   AI_MODEL=anthropic/claude-haiku-4-5
   ```

Other models you can try on OpenRouter: `openai/gpt-4o-mini`, `google/gemini-flash-1.5`, `meta-llama/llama-3-8b-instruct`.

### Option B — Anthropic direct

1. Go to [console.anthropic.com](https://console.anthropic.com) and sign up.
2. Navigate to **API Keys** → **Create key**.
3. Copy the key (starts with `sk-ant-`).
4. In your `.env` file set:
   ```
   AI_PROVIDER=anthropic
   AI_API_KEY=sk-ant-...
   AI_MODEL=claude-haiku-4-5-20251001
   ```

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/math97/personalFinance.git
cd personalFinance
```

### 2. Install dependencies

```bash
cd code
npm install
```

### 3. Configure the backend environment

```bash
cp code/apps/backend/.env.example code/apps/backend/.env
```

Open `code/apps/backend/.env` and fill in your AI provider details (see above) or just go on settings when running and configured in the app itself. The database credentials are pre-filled for the Docker setup and don't need changing.

### 4. Start the database

```bash
cd code
docker compose up -d
```

### 5. Run database migrations and seed categories

```bash
cd code/apps/backend
npx prisma migrate deploy
npx ts-node prisma/seed.ts
```

### 6. Start the apps

In two separate terminals:

```bash
# Terminal 1 — backend (port 3001)
cd code/apps/backend
npm run start:dev
```

```bash
# Terminal 2 — frontend (port 3000)
cd code/apps/frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
personalFinance/
  code/
    apps/
      frontend/     Next.js 14 (App Router), port 3000
      backend/      NestJS REST API, port 3001
    docker-compose.yml
  docs/
  progress.txt
```

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Recharts |
| Backend | NestJS, TypeScript, Prisma ORM v5 |
| Database | PostgreSQL (Docker) |
| AI | Anthropic SDK — Anthropic direct or OpenRouter |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
