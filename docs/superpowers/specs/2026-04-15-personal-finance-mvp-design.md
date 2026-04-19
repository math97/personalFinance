# Personal Finance App — MVP Design

**Date:** 2026-04-15  
**Scope:** Phase 0–1 MVP for personal use (Europe, no Open Finance sync)  
**Stack:** Next.js 14 (App Router + Server Actions), PostgreSQL, Prisma, Claude API, Docker Compose

---

## Context

The original roadmap assumed Brazilian Open Finance sync as the data entry point. In Europe this is not available, so the foundation shifts to manual entry and AI-assisted document import (bank statement PDFs and receipt photos). Once transactions are flowing reliably, the same category and dashboard layers apply.

---

## Architecture

### Stack

| Layer | Choice |
|---|---|
| Frontend + API | Next.js 14 — App Router, Server Actions |
| Database | PostgreSQL (local via Docker Compose) |
| ORM | Prisma |
| AI | Claude API — transaction extraction from documents + auto-categorization |
| File storage | Local filesystem (`/uploads`) |

### Data Model

```
transaction
  id, amount, date, description, merchant
  category_id (FK → category)
  account (text, e.g. "Barclays current")
  source: manual | pdf | photo
  import_batch_id (FK → import_batch, nullable)
  -- all transaction rows are confirmed; inbox state lives in imported_transaction

category
  id, name, parent_id (nullable), color

import_batch
  id, filename, uploaded_at
  status: processing | reviewing | confirmed | discarded

imported_transaction
  id, batch_id (FK → import_batch)
  raw_date, raw_description, raw_amount
  ai_category_id (FK → category, nullable)
  ai_categorized: boolean  -- false = shown as uncategorized in inbox
  transaction_id (FK → transaction, nullable — set on confirm)

category_rule
  id, category_id (FK → category)
  keyword (text — case-insensitive match against transaction description)
```

### Key Rules

- **Manual entry** → creates a `transaction` row directly. No inbox step.
- **PDF / photo upload** → creates an `import_batch` (status `processing`) + one `imported_transaction` per extracted row. Batch transitions to `reviewing` when Claude finishes.
- **Dashboard** only counts `transaction` rows (all are confirmed by definition).
- **Discarding a batch** (only allowed while status is `reviewing`) deletes the batch and all its `imported_transaction` rows.

---

## Feature 1: Transaction Input

### Manual entry
- Form: amount, description, date, account (optional), category (optional)
- Submits directly to `transaction` table as `confirmed`
- Accessible from a persistent "+ Add" button in the nav

### Document upload (PDF / photos)
- Drag-and-drop or file picker — accepts multiple files at once
- Accepted formats: PDF, JPG, PNG, HEIC
- Each file → one `import_batch`
- Server Action sends file to Claude API with a prompt to extract a structured list of transactions (date, description, amount)
- Claude also suggests a category for each extracted transaction (used as `ai_category_id`)
- Results land in the inbox as `processing` while Claude extracts; batch transitions to `reviewing` when done

### Inbox / review screen
- One view per batch (e.g. "barclays-april-2026.pdf — 23 transactions")
- Table: date | description | category | amount | edit button
- Uncategorized rows (`ai_categorized = false`) highlighted in amber — cannot be missed
- Inline edit: click any row to change description, date, amount, or category
- "Confirm all" → promotes all `imported_transaction` rows to `transaction` with `status = confirmed`
- "Discard batch" → deletes the batch and all its rows

---

## Feature 2: Categories

### Structure
- Flat list (no subcategories in MVP)
- Each category: name + color
- Default starter set: Groceries, Restaurants, Transport, Subscriptions, Rent, Health, Shopping, Other

### Categorization priority
1. **Custom rules** — keyword match on `description` (case-insensitive). First match wins. Applied before AI.
2. **AI suggestion** — Claude suggests a category during extraction. Used when no rule matches.
3. **Uncategorized** — shown in amber in the inbox for manual assignment.

### Rule management
- Category settings page: expand a category to see its rules
- "+ add rule" inline — type a keyword, saved to `category_rule`
- When you fix a category in the inbox, a prompt appears: "Always categorize [keyword] as [category]?" — one click saves a new rule

---

## Feature 3: Dashboard

### Summary cards (top of page)
- Total spent this month
- Biggest category (name + amount + % of total)
- Transaction count (with "N in inbox" reminder if any pending)

### Spending by category
- Horizontal bar chart — one bar per category, proportional to total spend
- Color-coded to match category colors
- Shows amount and percentage

### Month comparison (last 4 months)
- Vertical bar chart — one bar per month, current month highlighted
- Delta callout: "£X more/less than last month · [Category] up/down £Y"
- The callout identifies the single biggest driver of the change

### Transaction list
- Most recent confirmed transactions
- Shows date, description, category pill, amount
- "View all" links to a full filterable/searchable list

### Navigation
- Month picker (← / →) to navigate between months
- All charts and cards update for the selected month

---

## What's Out of Scope (MVP)

| Feature | Reason |
|---|---|
| Budgets / goals | Phase 2 — need 2+ months of clean data first |
| Recurring transaction detection | Phase 2 |
| AI balance projections | Needs historical data foundation |
| CSV / OFX import | Phase 3 — PDF covers the main case |
| Mobile app | Phase 4 — web works on phone via browser |
| Multi-account tracking | Later — single account label field is enough for now |
| Subcategories | Later — flat list is sufficient for MVP |

---

## Build Order

```
1. Docker Compose + PostgreSQL + Prisma schema
2. Manual transaction entry (confirmed directly)
3. Category CRUD + default starter categories
4. Dashboard (basic — category breakdown + month comparison)
5. Document upload + Claude extraction → inbox
6. Inbox review + confirm flow
7. Category rules + AI categorization pipeline
8. Polish: empty states, loading states, error handling
```

The dashboard comes before document upload intentionally — manual entry gives you data to look at immediately, and it validates the schema and UI before adding the complexity of AI extraction.
