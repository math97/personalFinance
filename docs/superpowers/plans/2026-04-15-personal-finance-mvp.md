# Personal Finance App — MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first personal finance web app with manual transaction entry, AI-assisted PDF/photo import, category management with keyword rules, and a dashboard showing spending by category and month-over-month comparison.

**Architecture:** Next.js 14 App Router with Server Actions for the full stack. All uploaded files are processed server-side through Claude API, which extracts transactions into an inbox (ImportBatch model). Dashboard only counts confirmed transactions. Month navigation via URL search params (`?year=2026&month=4`).

**Tech Stack:** Next.js 14, TypeScript, PostgreSQL (Docker Compose), Prisma ORM, Anthropic SDK (Claude), Recharts, react-dropzone, date-fns, Vitest

**Spec:** `docs/superpowers/specs/2026-04-15-personal-finance-mvp-design.md`

---

## File Map

```
docker-compose.yml                         — PostgreSQL service
.env                                       — DATABASE_URL, ANTHROPIC_API_KEY
prisma/
  schema.prisma                            — all models + enums
  seed.ts                                  — default categories
src/
  app/
    layout.tsx                             — root layout with <Nav />
    page.tsx                               — redirect to /dashboard
    dashboard/page.tsx                     — dashboard (summary + charts + list)
    transactions/page.tsx                  — full filterable transaction list
    import/page.tsx                        — upload dropzone + batch list
    import/[batchId]/page.tsx             — inbox review for one batch
    categories/page.tsx                   — category list + rules
    api/upload/route.ts                   — POST: receive file → Claude → create batch
  components/
    nav.tsx                               — top nav with links + "+ Add" modal trigger
    transaction-form.tsx                  — modal form for manual entry
    transaction-table.tsx                 — reusable confirmed tx table
    upload-dropzone.tsx                   — drag-and-drop file upload (client)
    inbox-table.tsx                       — inbox review table with inline edit
    category-list.tsx                     — category list with rule management
    spending-bar-chart.tsx               — horizontal bar chart by category
    month-comparison-chart.tsx           — vertical bar chart, 4 months
  lib/
    db.ts                                 — Prisma client singleton
    claude.ts                             — extractTransactions(buffer, mediaType)
    rules.ts                              — applyRules(description, rules) → categoryId | null
  actions/
    transactions.ts                       — createTransaction, getTransactions
    categories.ts                         — getCategories, createCategory, deleteCategory, addRule, deleteRule
    batches.ts                            — getBatch, confirmBatch, discardBatch, updateImportedTransaction, saveRuleFromInbox
    dashboard.ts                          — getSpendingByCategory, getMonthlyTotals, getSummaryCards
tests/
  lib/
    rules.test.ts
    claude.test.ts
  actions/
    dashboard.test.ts
```

---

## Task 1: Project scaffold + Docker + Prisma schema

**Files:**
- Create: `docker-compose.yml`
- Create: `.env`
- Create: `.env.example`
- Create: `prisma/schema.prisma`
- Create: `prisma/seed.ts`
- Create: `src/lib/db.ts`
- Create: `vitest.config.ts`

- [ ] **Step 1: Bootstrap Next.js app**

```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint
```

Expected: Next.js project created in current directory.

- [ ] **Step 2: Install dependencies**

```bash
npm install @prisma/client prisma @anthropic-ai/sdk react-dropzone recharts date-fns
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Create `docker-compose.yml`**

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: finance
      POSTGRES_PASSWORD: finance
      POSTGRES_DB: finance
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

- [ ] **Step 4: Create `.env` and `.env.example`**

`.env`:
```
DATABASE_URL="postgresql://finance:finance@localhost:5432/finance"
ANTHROPIC_API_KEY="your-api-key-here"
```

`.env.example` (same content — safe to commit):
```
DATABASE_URL="postgresql://finance:finance@localhost:5432/finance"
ANTHROPIC_API_KEY="your-api-key-here"
```

Add `.env` to `.gitignore`.

- [ ] **Step 5: Create `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Transaction {
  id           String            @id @default(cuid())
  amount       Decimal           @db.Decimal(10, 2)
  date         DateTime
  description  String
  merchant     String?
  account      String?
  source       TransactionSource
  categoryId   String?
  category     Category?         @relation(fields: [categoryId], references: [id])
  importedFrom ImportedTransaction?
  createdAt    DateTime          @default(now())
}

model Category {
  id            String               @id @default(cuid())
  name          String               @unique
  color         String
  transactions  Transaction[]
  rules         CategoryRule[]
  aiSuggestions ImportedTransaction[] @relation("AiCategory")
}

model ImportBatch {
  id         String                @id @default(cuid())
  filename   String
  uploadedAt DateTime              @default(now())
  status     BatchStatus
  imported   ImportedTransaction[]
}

model ImportedTransaction {
  id             String       @id @default(cuid())
  batchId        String
  batch          ImportBatch  @relation(fields: [batchId], references: [id], onDelete: Cascade)
  rawDate        String
  rawDescription String
  rawAmount      Decimal      @db.Decimal(10, 2)
  aiCategoryId   String?
  aiCategory     Category?    @relation("AiCategory", fields: [aiCategoryId], references: [id])
  aiCategorized  Boolean      @default(false)
  transactionId  String?      @unique
  transaction    Transaction? @relation(fields: [transactionId], references: [id])
}

model CategoryRule {
  id         String   @id @default(cuid())
  categoryId String
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  keyword    String
}

enum TransactionSource {
  manual
  pdf
  photo
}

enum BatchStatus {
  processing
  reviewing
  confirmed
  discarded
}
```

- [ ] **Step 6: Create `prisma/seed.ts`**

```typescript
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const DEFAULT_CATEGORIES = [
  { name: 'Groceries',     color: '#16a34a' },
  { name: 'Restaurants',   color: '#dc2626' },
  { name: 'Transport',     color: '#0ea5e9' },
  { name: 'Subscriptions', color: '#7c3aed' },
  { name: 'Rent',          color: '#0369a1' },
  { name: 'Health',        color: '#059669' },
  { name: 'Shopping',      color: '#d97706' },
  { name: 'Other',         color: '#6b7280' },
]

async function main() {
  for (const cat of DEFAULT_CATEGORIES) {
    await db.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    })
  }
  console.log('Seeded default categories')
}

main().finally(() => db.$disconnect())
```

Add to `package.json`:
```json
"prisma": {
  "seed": "ts-node --compiler-options '{\"module\":\"CommonJS\"}' prisma/seed.ts"
}
```

- [ ] **Step 7: Create `src/lib/db.ts`**

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ log: ['error'] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

- [ ] **Step 8: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 9: Start Docker and run migrations**

```bash
docker compose up -d
npx prisma migrate dev --name init
npx prisma db seed
```

Expected: Migration applied, 8 categories seeded.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: project scaffold, Prisma schema, Docker Compose"
```

---

## Task 2: Category CRUD page

**Files:**
- Create: `src/actions/categories.ts`
- Create: `src/components/category-list.tsx`
- Create: `src/app/categories/page.tsx`

- [ ] **Step 1: Write `src/actions/categories.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'

export async function getCategories() {
  return db.category.findMany({
    orderBy: { name: 'asc' },
    include: { rules: true, _count: { select: { transactions: true } } },
  })
}

export async function createCategory(name: string, color: string) {
  await db.category.create({ data: { name, color } })
  revalidatePath('/categories')
}

export async function deleteCategory(id: string) {
  await db.category.delete({ where: { id } })
  revalidatePath('/categories')
}

export async function addRule(categoryId: string, keyword: string) {
  await db.categoryRule.create({ data: { categoryId, keyword } })
  revalidatePath('/categories')
}

export async function deleteRule(ruleId: string) {
  await db.categoryRule.delete({ where: { id: ruleId } })
  revalidatePath('/categories')
}
```

- [ ] **Step 2: Write `src/components/category-list.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { createCategory, deleteCategory, addRule, deleteRule } from '@/actions/categories'

type Rule = { id: string; keyword: string }
type Category = {
  id: string
  name: string
  color: string
  rules: Rule[]
  _count: { transactions: number }
}

export function CategoryList({ categories }: { categories: Category[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [newKeyword, setNewKeyword] = useState('')
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6b7280')

  return (
    <div className="space-y-4">
      {categories.map(cat => (
        <div key={cat.id} className="border rounded-lg overflow-hidden">
          <div
            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
            onClick={() => setExpanded(expanded === cat.id ? null : cat.id)}
          >
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ background: cat.color }}
            />
            <span className="flex-1 font-medium">{cat.name}</span>
            <span className="text-sm text-gray-500">{cat._count.transactions} transactions</span>
            <button
              onClick={e => { e.stopPropagation(); deleteCategory(cat.id) }}
              className="text-xs text-red-500 hover:text-red-700 px-2"
            >
              Delete
            </button>
          </div>

          {expanded === cat.id && (
            <div className="border-t bg-gray-50 p-3 pl-9">
              <p className="text-xs text-gray-500 mb-2">Rules — if description contains:</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {cat.rules.map(rule => (
                  <span
                    key={rule.id}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                    style={{ background: cat.color + '20', color: cat.color }}
                  >
                    {rule.keyword}
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="hover:opacity-70"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <form
                  action={async () => {
                    if (!newKeyword.trim()) return
                    await addRule(cat.id, newKeyword.trim())
                    setNewKeyword('')
                  }}
                  className="flex gap-1"
                >
                  <input
                    value={newKeyword}
                    onChange={e => setNewKeyword(e.target.value)}
                    placeholder="add keyword…"
                    className="text-xs border rounded px-2 py-1 w-28"
                  />
                  <button type="submit" className="text-xs border rounded px-2 py-1 hover:bg-white">
                    +
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="border rounded-lg p-4">
        <p className="text-sm font-medium mb-3">New category</p>
        <form
          action={async () => {
            if (!newName.trim()) return
            await createCategory(newName.trim(), newColor)
            setNewName('')
          }}
          className="flex gap-2 items-center"
        >
          <input
            type="color"
            value={newColor}
            onChange={e => setNewColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer"
          />
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Category name"
            className="border rounded px-3 py-1.5 text-sm flex-1"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
          >
            Add
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write `src/app/categories/page.tsx`**

```tsx
import { getCategories } from '@/actions/categories'
import { CategoryList } from '@/components/category-list'

export default async function CategoriesPage() {
  const categories = await getCategories()
  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Categories</h1>
      <CategoryList categories={categories} />
    </main>
  )
}
```

- [ ] **Step 4: Start dev server and verify**

```bash
docker compose up -d
npm run dev
```

Open `http://localhost:3000/categories`. Verify the 8 seeded categories appear. Add a rule keyword to one category, confirm it persists on refresh.

- [ ] **Step 5: Commit**

```bash
git add src/actions/categories.ts src/components/category-list.tsx src/app/categories/page.tsx
git commit -m "feat: category CRUD with keyword rule management"
```

---

## Task 3: Manual transaction entry + transaction list

**Files:**
- Create: `src/actions/transactions.ts`
- Create: `src/components/transaction-form.tsx`
- Create: `src/components/transaction-table.tsx`
- Create: `src/components/nav.tsx`
- Create: `src/app/layout.tsx` (replace generated)
- Create: `src/app/transactions/page.tsx`
- Create: `src/app/page.tsx`

- [ ] **Step 1: Write `src/actions/transactions.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'

export async function createTransaction(data: {
  amount: number
  date: string
  description: string
  account?: string
  categoryId?: string
}) {
  await db.transaction.create({
    data: {
      amount: data.amount,
      date: new Date(data.date),
      description: data.description,
      account: data.account || null,
      categoryId: data.categoryId || null,
      source: 'manual',
    },
  })
  revalidatePath('/dashboard')
  revalidatePath('/transactions')
}

export async function getTransactions(limit?: number) {
  return db.transaction.findMany({
    orderBy: { date: 'desc' },
    take: limit,
    include: { category: true },
  })
}

export async function deleteTransaction(id: string) {
  await db.transaction.delete({ where: { id } })
  revalidatePath('/dashboard')
  revalidatePath('/transactions')
}
```

- [ ] **Step 2: Write `src/components/transaction-form.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { createTransaction } from '@/actions/transactions'

type Category = { id: string; name: string; color: string }

export function TransactionForm({
  categories,
  onClose,
}: {
  categories: Category[]
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    await createTransaction({
      amount: -(Math.abs(Number(fd.get('amount')))),  // store expenses as negative
      date: fd.get('date') as string,
      description: fd.get('description') as string,
      account: (fd.get('account') as string) || undefined,
      categoryId: (fd.get('categoryId') as string) || undefined,
    })
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-lg font-bold mb-4">Add transaction</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-sm font-medium">Amount (£)</label>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
              className="mt-1 block w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <input
              name="description"
              required
              placeholder="e.g. Tesco Metro"
              className="mt-1 block w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Date</label>
            <input
              name="date"
              type="date"
              required
              defaultValue={new Date().toISOString().split('T')[0]}
              className="mt-1 block w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Category (optional)</label>
            <select
              name="categoryId"
              className="mt-1 block w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">— none —</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Account (optional)</label>
            <input
              name="account"
              placeholder="e.g. Barclays current"
              className="mt-1 block w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border rounded px-4 py-2 text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white rounded px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write `src/components/transaction-table.tsx`**

```tsx
import { deleteTransaction } from '@/actions/transactions'

type Transaction = {
  id: string
  date: Date
  description: string
  amount: any
  category: { name: string; color: string } | null
}

export function TransactionTable({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        No transactions yet. Add one with the + button.
      </div>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-gray-500 text-xs">
          <th className="text-left pb-2">Date</th>
          <th className="text-left pb-2">Description</th>
          <th className="text-left pb-2">Category</th>
          <th className="text-right pb-2">Amount</th>
          <th className="pb-2" />
        </tr>
      </thead>
      <tbody>
        {transactions.map(tx => (
          <tr key={tx.id} className="border-b last:border-0 hover:bg-gray-50">
            <td className="py-2.5 text-gray-500 pr-4 whitespace-nowrap">
              {new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </td>
            <td className="py-2.5 pr-4">{tx.description}</td>
            <td className="py-2.5 pr-4">
              {tx.category ? (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: tx.category.color + '20', color: tx.category.color }}
                >
                  {tx.category.name}
                </span>
              ) : (
                <span className="text-xs text-gray-400">—</span>
              )}
            </td>
            <td className="py-2.5 text-right font-medium">
              £{Math.abs(Number(tx.amount)).toFixed(2)}
            </td>
            <td className="py-2.5 pl-2">
              <form action={deleteTransaction.bind(null, tx.id)}>
                <button type="submit" className="text-xs text-red-400 hover:text-red-600">
                  ×
                </button>
              </form>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 4: Write `src/components/nav.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { TransactionForm } from './transaction-form'

type Category = { id: string; name: string; color: string }

export function Nav({ categories }: { categories: Category[] }) {
  const path = usePathname()
  const [showForm, setShowForm] = useState(false)

  const links = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/transactions', label: 'Transactions' },
    { href: '/import', label: 'Import' },
    { href: '/categories', label: 'Categories' },
  ]

  return (
    <>
      <nav className="border-b bg-white sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-6">
          <span className="font-bold text-blue-600">Finance</span>
          <div className="flex gap-1 flex-1">
            {links.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded text-sm ${
                  path.startsWith(l.href)
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
          >
            + Add
          </button>
        </div>
      </nav>
      {showForm && (
        <TransactionForm categories={categories} onClose={() => setShowForm(false)} />
      )}
    </>
  )
}
```

- [ ] **Step 5: Write `src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/nav'
import { getCategories } from '@/actions/categories'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Personal Finance',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const categories = await getCategories()
  return (
    <html lang="en">
      <body className={inter.className}>
        <Nav categories={categories} />
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 6: Write `src/app/page.tsx`**

```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/dashboard')
}
```

- [ ] **Step 7: Write `src/app/transactions/page.tsx`**

```tsx
import { getTransactions } from '@/actions/transactions'
import { TransactionTable } from '@/components/transaction-table'

export default async function TransactionsPage() {
  const transactions = await getTransactions()
  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">All transactions</h1>
      <TransactionTable transactions={transactions} />
    </main>
  )
}
```

- [ ] **Step 8: Verify manually**

Start dev server. Click "+ Add" in the nav, add a transaction. Confirm it appears at `/transactions`. Verify delete works.

- [ ] **Step 9: Commit**

```bash
git add src/
git commit -m "feat: manual transaction entry, transaction list, nav"
```

---

## Task 4: Dashboard — spending by category + summary cards

**Files:**
- Create: `src/actions/dashboard.ts`
- Create: `src/components/spending-bar-chart.tsx`
- Create: `src/app/dashboard/page.tsx`
- Create: `tests/actions/dashboard.test.ts`

- [ ] **Step 1: Write failing test for `getSpendingByCategory`**

`tests/actions/dashboard.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'

// Mock the db module
vi.mock('@/lib/db', () => ({
  db: {
    transaction: {
      groupBy: vi.fn(),
      aggregate: vi.fn(),
      count: vi.fn(),
    },
    category: { findMany: vi.fn() },
    importedTransaction: { count: vi.fn() },
  },
}))

import { db } from '@/lib/db'
import { getSpendingByCategory, getSummaryCards } from '@/actions/dashboard'

describe('getSpendingByCategory', () => {
  it('returns categories sorted by total descending', async () => {
    vi.mocked(db.transaction.groupBy).mockResolvedValue([
      { categoryId: 'cat-1', _sum: { amount: -200 } },
      { categoryId: 'cat-2', _sum: { amount: -50 } },
    ] as any)
    vi.mocked(db.category.findMany).mockResolvedValue([
      { id: 'cat-1', name: 'Groceries', color: '#16a34a' },
      { id: 'cat-2', name: 'Transport', color: '#0ea5e9' },
    ] as any)

    const result = await getSpendingByCategory(2026, 4)

    expect(result[0]).toEqual({ categoryId: 'cat-1', name: 'Groceries', color: '#16a34a', total: 200 })
    expect(result[1]).toEqual({ categoryId: 'cat-2', name: 'Transport', color: '#0ea5e9', total: 50 })
  })

  it('labels null categoryId as Uncategorized', async () => {
    vi.mocked(db.transaction.groupBy).mockResolvedValue([
      { categoryId: null, _sum: { amount: -30 } },
    ] as any)
    vi.mocked(db.category.findMany).mockResolvedValue([] as any)

    const result = await getSpendingByCategory(2026, 4)

    expect(result[0].name).toBe('Uncategorized')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/actions/dashboard.test.ts
```

Expected: FAIL — `getSpendingByCategory` not defined.

- [ ] **Step 3: Write `src/actions/dashboard.ts`**

```typescript
'use server'

import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import { db } from '@/lib/db'

export async function getSpendingByCategory(year: number, month: number) {
  const start = startOfMonth(new Date(year, month - 1))
  const end = endOfMonth(new Date(year, month - 1))

  const [grouped, categories] = await Promise.all([
    db.transaction.groupBy({
      by: ['categoryId'],
      where: { date: { gte: start, lte: end }, amount: { lt: 0 } },
      _sum: { amount: true },
    }),
    db.category.findMany(),
  ])

  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))

  return grouped
    .map(row => ({
      categoryId: row.categoryId,
      name: row.categoryId ? (catMap[row.categoryId]?.name ?? 'Uncategorized') : 'Uncategorized',
      color: row.categoryId ? (catMap[row.categoryId]?.color ?? '#6b7280') : '#6b7280',
      total: Math.abs(Number(row._sum.amount ?? 0)),
    }))
    .sort((a, b) => b.total - a.total)
}

export async function getMonthlyTotals(referenceYear: number, referenceMonth: number, months: number) {
  const reference = new Date(referenceYear, referenceMonth - 1)
  const results = []

  for (let i = months - 1; i >= 0; i--) {
    const d = subMonths(reference, i)
    const start = startOfMonth(d)
    const end = endOfMonth(d)

    const agg = await db.transaction.aggregate({
      where: { date: { gte: start, lte: end }, amount: { lt: 0 } },
      _sum: { amount: true },
    })

    results.push({
      label: format(d, 'MMM'),
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      total: Math.abs(Number(agg._sum.amount ?? 0)),
    })
  }

  return results
}

export async function getSummaryCards(year: number, month: number) {
  const start = startOfMonth(new Date(year, month - 1))
  const end = endOfMonth(new Date(year, month - 1))

  const [totalResult, txCount, inboxCount, byCategory] = await Promise.all([
    db.transaction.aggregate({
      where: { date: { gte: start, lte: end }, amount: { lt: 0 } },
      _sum: { amount: true },
    }),
    db.transaction.count({ where: { date: { gte: start, lte: end } } }),
    db.importedTransaction.count({ where: { batch: { status: 'reviewing' } } }),
    getSpendingByCategory(year, month),
  ])

  return {
    totalSpent: Math.abs(Number(totalResult._sum.amount ?? 0)),
    transactionCount: txCount,
    inboxCount,
    biggestCategory: byCategory[0] ?? null,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/actions/dashboard.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write `src/components/spending-bar-chart.tsx`**

```tsx
'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts'

type Row = { name: string; total: number; color: string }

export function SpendingBarChart({ data }: { data: Row[] }) {
  if (data.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={Math.max(data.length * 40, 120)}>
      <BarChart layout="vertical" data={data} margin={{ left: 8, right: 24 }}>
        <XAxis
          type="number"
          tickFormatter={v => `£${v}`}
          tick={{ fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 13 }}
          axisLine={false}
          tickLine={false}
          width={90}
        />
        <Tooltip formatter={(v: number) => [`£${v.toFixed(2)}`, 'Spent']} />
        <Bar dataKey="total" radius={[0, 4, 4, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 6: Write `src/app/dashboard/page.tsx`** (spending by category + summary cards, month comparison comes in Task 5)

```tsx
import { getSpendingByCategory, getSummaryCards } from '@/actions/dashboard'
import { getTransactions } from '@/actions/transactions'
import { SpendingBarChart } from '@/components/spending-bar-chart'
import { TransactionTable } from '@/components/transaction-table'
import Link from 'next/link'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string }
}) {
  const now = new Date()
  const year = Number(searchParams.year ?? now.getFullYear())
  const month = Number(searchParams.month ?? now.getMonth() + 1)

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year

  const [byCategory, summary, recentTx] = await Promise.all([
    getSpendingByCategory(year, month),
    getSummaryCards(year, month),
    getTransactions(5),
  ])

  const monthLabel = new Date(year, month - 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      {/* Month nav */}
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold flex-1">{monthLabel}</h1>
        <Link href={`/dashboard?year=${prevYear}&month=${prevMonth}`} className="border rounded px-3 py-1.5 text-sm hover:bg-gray-50">
          ← Prev
        </Link>
        <Link href={`/dashboard?year=${nextYear}&month=${nextMonth}`} className="border rounded px-3 py-1.5 text-sm hover:bg-gray-50">
          Next →
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase mb-1">Spent this month</p>
          <p className="text-3xl font-bold">£{summary.totalSpent.toFixed(2)}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase mb-1">Biggest category</p>
          {summary.biggestCategory ? (
            <>
              <p className="text-xl font-bold">{summary.biggestCategory.name}</p>
              <p className="text-sm text-gray-500">£{summary.biggestCategory.total.toFixed(2)}</p>
            </>
          ) : (
            <p className="text-gray-400 text-sm">No data</p>
          )}
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase mb-1">Transactions</p>
          <p className="text-3xl font-bold">{summary.transactionCount}</p>
          {summary.inboxCount > 0 && (
            <Link href="/import" className="text-xs text-amber-600 hover:underline">
              {summary.inboxCount} in inbox
            </Link>
          )}
        </div>
      </div>

      {/* Charts + recent tx */}
      <div className="grid grid-cols-2 gap-6">
        <div className="border rounded-lg p-4">
          <h2 className="font-semibold mb-4">Spending by category</h2>
          {byCategory.length > 0 ? (
            <SpendingBarChart data={byCategory} />
          ) : (
            <p className="text-gray-400 text-sm py-8 text-center">No transactions this month</p>
          )}
        </div>

        <div className="border rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold">Recent transactions</h2>
            <Link href="/transactions" className="text-xs text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          <TransactionTable transactions={recentTx} />
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 7: Verify in browser**

Open `http://localhost:3000`. Add 2-3 manual transactions with categories. Confirm spending by category chart appears. Confirm month navigation changes the URL and re-fetches.

- [ ] **Step 8: Commit**

```bash
git add src/actions/dashboard.ts src/components/spending-bar-chart.tsx src/app/dashboard/ tests/
git commit -m "feat: dashboard with spending by category, summary cards"
```

---

## Task 5: Dashboard — month comparison chart

**Files:**
- Create: `src/components/month-comparison-chart.tsx`
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Write failing test for `getMonthlyTotals`**

Add to `tests/actions/dashboard.test.ts`:
```typescript
describe('getMonthlyTotals', () => {
  it('returns N months of totals in chronological order', async () => {
    vi.mocked(db.transaction.aggregate).mockResolvedValue({
      _sum: { amount: -500 },
    } as any)

    const result = await getMonthlyTotals(2026, 4, 3)

    expect(result).toHaveLength(3)
    expect(result[2].label).toBe('Apr')
    expect(result[2].total).toBe(500)
    expect(result[0].label).toBe('Feb')
  })

  it('treats null sum as 0', async () => {
    vi.mocked(db.transaction.aggregate).mockResolvedValue({
      _sum: { amount: null },
    } as any)

    const result = await getMonthlyTotals(2026, 4, 1)
    expect(result[0].total).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- tests/actions/dashboard.test.ts
```

Expected: FAIL — `getMonthlyTotals` not yet called correctly (or passes if already imported — verify the new test cases actually run).

- [ ] **Step 3: Run all tests to verify they pass** (function was already written in Task 4)

```bash
npm test -- tests/actions/dashboard.test.ts
```

Expected: All PASS.

- [ ] **Step 4: Write `src/components/month-comparison-chart.tsx`**

```tsx
'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts'

type MonthData = { label: string; year: number; month: number; total: number }

type Props = {
  data: MonthData[]
  currentYear: number
  currentMonth: number
  delta: { amount: number; driverCategory: string | null }
}

export function MonthComparisonChart({ data, currentYear, currentMonth, delta }: Props) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4 }}>
          <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={v => `£${v}`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v: number) => [`£${v.toFixed(2)}`, 'Spent']} />
          <Bar dataKey="total" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={
                  entry.year === currentYear && entry.month === currentMonth
                    ? '#2563eb'
                    : '#bfdbfe'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {delta.amount !== 0 && (
        <p className="text-sm text-gray-500 mt-2">
          <span className={delta.amount > 0 ? 'text-red-500 font-medium' : 'text-green-600 font-medium'}>
            {delta.amount > 0 ? '▲' : '▼'} £{Math.abs(delta.amount).toFixed(2)}
          </span>
          {' '}vs last month
          {delta.driverCategory && (
            <span className="text-gray-400"> · {delta.driverCategory} is the biggest driver</span>
          )}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Update `src/app/dashboard/page.tsx` to add month comparison**

Add `getMonthlyTotals` to the parallel fetch and add the chart to the grid. Replace the existing `grid-cols-2` section with:

```tsx
// At top of file, add import:
import { MonthComparisonChart } from '@/components/month-comparison-chart'

// Add getMonthlyTotals to the parallel Promise.all:
const [byCategory, summary, recentTx, monthlyTotals] = await Promise.all([
  getSpendingByCategory(year, month),
  getSummaryCards(year, month),
  getTransactions(5),
  getMonthlyTotals(year, month, 4),
])

// Compute delta after the await:
const currentTotal = monthlyTotals.find(m => m.year === year && m.month === month)?.total ?? 0
const prevTotal = monthlyTotals[monthlyTotals.length - 2]?.total ?? 0
const delta = {
  amount: currentTotal - prevTotal,
  driverCategory: summary.biggestCategory?.name ?? null,
}

// Replace the charts grid with:
<div className="grid grid-cols-2 gap-6 mt-6">
  <div className="border rounded-lg p-4">
    <h2 className="font-semibold mb-4">Spending by category</h2>
    {byCategory.length > 0 ? (
      <SpendingBarChart data={byCategory} />
    ) : (
      <p className="text-gray-400 text-sm py-8 text-center">No transactions this month</p>
    )}
  </div>

  <div className="border rounded-lg p-4">
    <h2 className="font-semibold mb-4">Last 4 months</h2>
    <MonthComparisonChart
      data={monthlyTotals}
      currentYear={year}
      currentMonth={month}
      delta={delta}
    />
  </div>
</div>

<div className="border rounded-lg p-4 mt-6">
  <div className="flex justify-between items-center mb-4">
    <h2 className="font-semibold">Recent transactions</h2>
    <Link href="/transactions" className="text-xs text-blue-600 hover:underline">View all</Link>
  </div>
  <TransactionTable transactions={recentTx} />
</div>
```

- [ ] **Step 6: Verify in browser**

Add transactions across 2+ months by navigating to different months and adding transactions. Confirm the month comparison chart reflects real data and the delta callout is correct.

- [ ] **Step 7: Commit**

```bash
git add src/components/month-comparison-chart.tsx src/app/dashboard/page.tsx tests/
git commit -m "feat: month comparison chart on dashboard"
```

---

## Task 6: File upload API + Claude transaction extraction

**Files:**
- Create: `src/lib/claude.ts`
- Create: `src/app/api/upload/route.ts`
- Create: `src/components/upload-dropzone.tsx`
- Create: `src/app/import/page.tsx`
- Create: `tests/lib/claude.test.ts`

- [ ] **Step 1: Write failing test for `parseClaudeResponse`**

`tests/lib/claude.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { parseClaudeResponse } from '@/lib/claude'

describe('parseClaudeResponse', () => {
  it('parses valid JSON array', () => {
    const text = '[{"date":"2026-04-01","description":"TESCO","amount":-34.20}]'
    const result = parseClaudeResponse(text)
    expect(result).toHaveLength(1)
    expect(result[0].description).toBe('TESCO')
    expect(result[0].amount).toBe(-34.20)
  })

  it('returns empty array on invalid JSON', () => {
    expect(parseClaudeResponse('not json')).toEqual([])
  })

  it('returns empty array on empty string', () => {
    expect(parseClaudeResponse('')).toEqual([])
  })

  it('filters out items missing required fields', () => {
    const text = '[{"date":"2026-04-01","amount":-10},{"date":"2026-04-02","description":"Valid","amount":-5}]'
    const result = parseClaudeResponse(text)
    expect(result).toHaveLength(1)
    expect(result[0].description).toBe('Valid')
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- tests/lib/claude.test.ts
```

Expected: FAIL — `parseClaudeResponse` not defined.

- [ ] **Step 3: Write `src/lib/claude.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export type ExtractedTransaction = {
  date: string
  description: string
  amount: number
}

export function parseClaudeResponse(text: string): ExtractedTransaction[] {
  if (!text.trim()) return []
  try {
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is ExtractedTransaction =>
        typeof item.date === 'string' &&
        typeof item.description === 'string' &&
        typeof item.amount === 'number',
    )
  } catch {
    return []
  }
}

const EXTRACTION_PROMPT = `Extract all transactions from this bank statement or receipt.
Return ONLY a valid JSON array. No other text, no markdown, no explanation.
Format: [{"date":"YYYY-MM-DD","description":"merchant name","amount":-12.50}]
Rules:
- amount is negative for expenses/debits, positive for credits/income
- Use full year in date (if year unclear use ${new Date().getFullYear()})
- Return [] if no transactions found`

export async function extractTransactions(
  fileBuffer: Buffer,
  mediaType: string,
): Promise<ExtractedTransaction[]> {
  const base64 = fileBuffer.toString('base64')
  const isPdf = mediaType === 'application/pdf'

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    system: EXTRACTION_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          isPdf
            ? {
                type: 'document' as const,
                source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 },
              }
            : {
                type: 'image' as const,
                source: {
                  type: 'base64' as const,
                  media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                  data: base64,
                },
              },
        ],
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  return parseClaudeResponse(text)
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- tests/lib/claude.test.ts
```

Expected: PASS.

- [ ] **Step 5: Create `src/lib/rules.ts`** (tests added in Task 8)

```typescript
export type Rule = { categoryId: string; keyword: string }

export function applyRules(description: string, rules: Rule[]): string | null {
  const lower = description.toLowerCase()
  for (const rule of rules) {
    if (lower.includes(rule.keyword.toLowerCase())) {
      return rule.categoryId
    }
  }
  return null
}
```

- [ ] **Step 6: Write `src/app/api/upload/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { extractTransactions } from '@/lib/claude'
import { applyRules } from '@/lib/rules'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
  }

  const batch = await db.importBatch.create({
    data: { filename: file.name, status: 'processing' },
  })

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const extracted = await extractTransactions(buffer, file.type)

    const rules = await db.categoryRule.findMany()

    await db.importedTransaction.createMany({
      data: extracted.map(t => {
        const matchedCategoryId = applyRules(t.description, rules)
        return {
          batchId: batch.id,
          rawDate: t.date,
          rawDescription: t.description,
          rawAmount: t.amount,
          aiCategoryId: matchedCategoryId,
          aiCategorized: matchedCategoryId !== null,
        }
      }),
    })

    await db.importBatch.update({
      where: { id: batch.id },
      data: { status: 'reviewing' },
    })

    return NextResponse.json({ batchId: batch.id })
  } catch (error) {
    await db.importBatch.update({
      where: { id: batch.id },
      data: { status: 'discarded' },
    })
    console.error('Extraction error:', error)
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 })
  }
}
```

- [ ] **Step 6: Write `src/components/upload-dropzone.tsx`**

```tsx
'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useRouter } from 'next/navigation'

export function UploadDropzone() {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback(async (accepted: File[]) => {
    setError(null)
    setUploading(true)
    try {
      for (const file of accepted) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        if (!res.ok) {
          const body = await res.json()
          throw new Error(body.error ?? 'Upload failed')
        }
        const { batchId } = await res.json()
        router.push(`/import/${batchId}`)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }, [router])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/heic': ['.heic'],
    },
    multiple: false,
  })

  return (
    <div>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <div className="text-4xl mb-3">📄</div>
        <p className="font-medium mb-1">
          {uploading ? 'Extracting transactions…' : 'Drop a PDF or photo here'}
        </p>
        <p className="text-sm text-gray-500">Bank statements, receipts — PDF, JPG, PNG, HEIC</p>
        {!uploading && (
          <button className="mt-4 border rounded px-4 py-1.5 text-sm hover:bg-gray-50">
            Browse files
          </button>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 7: Write `src/app/import/page.tsx`**

```tsx
import { db } from '@/lib/db'
import { UploadDropzone } from '@/components/upload-dropzone'
import Link from 'next/link'

export default async function ImportPage() {
  const batches = await db.importBatch.findMany({
    where: { status: 'reviewing' },
    orderBy: { uploadedAt: 'desc' },
    include: { _count: { select: { imported: true } } },
  })

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Import transactions</h1>
      <UploadDropzone />

      {batches.length > 0 && (
        <div className="mt-8">
          <h2 className="font-semibold mb-3">Pending review</h2>
          <div className="space-y-2">
            {batches.map(b => (
              <Link
                key={b.id}
                href={`/import/${b.id}`}
                className="flex items-center justify-between border rounded-lg px-4 py-3 hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium text-sm">{b.filename}</p>
                  <p className="text-xs text-gray-500">
                    {b._count.imported} transactions · {new Date(b.uploadedAt).toLocaleDateString('en-GB')}
                  </p>
                </div>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  Review
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 8: Verify upload flow**

Make sure `ANTHROPIC_API_KEY` is set in `.env`. Upload a simple receipt image. Confirm the browser redirects to `/import/[batchId]` (which shows a 404 for now — that's Task 7). Check the database:

```bash
npx prisma studio
```

Verify an `ImportBatch` with status `reviewing` and its `ImportedTransaction` rows exist.

- [ ] **Step 9: Commit**

```bash
git add src/lib/claude.ts src/app/api/ src/components/upload-dropzone.tsx src/app/import/page.tsx tests/lib/claude.test.ts
git commit -m "feat: file upload, Claude extraction, import page"
```

---

## Task 7: Inbox review + confirm/discard

**Files:**
- Create: `src/actions/batches.ts`
- Create: `src/components/inbox-table.tsx`
- Create: `src/app/import/[batchId]/page.tsx`

- [ ] **Step 1: Write `src/actions/batches.ts`**

```typescript
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'

export async function getBatch(batchId: string) {
  return db.importBatch.findUnique({
    where: { id: batchId },
    include: {
      imported: {
        orderBy: { rawDate: 'asc' },
        include: { aiCategory: true },
      },
    },
  })
}

export async function updateImportedTransaction(
  id: string,
  data: { rawDescription?: string; rawDate?: string; rawAmount?: number; aiCategoryId?: string | null },
) {
  await db.importedTransaction.update({
    where: { id },
    data: {
      ...data,
      aiCategorized: data.aiCategoryId !== undefined ? data.aiCategoryId !== null : undefined,
    },
  })
  // batchId needed for revalidation — fetch it
  const tx = await db.importedTransaction.findUnique({ where: { id }, select: { batchId: true } })
  if (tx) revalidatePath(`/import/${tx.batchId}`)
}

export async function confirmBatch(batchId: string) {
  const imported = await db.importedTransaction.findMany({
    where: { batchId, transactionId: null },
  })

  for (const imp of imported) {
    const isPdf = (
      await db.importBatch.findUnique({ where: { id: batchId }, select: { filename: true } })
    )?.filename.endsWith('.pdf')

    const tx = await db.transaction.create({
      data: {
        amount: imp.rawAmount,
        date: new Date(imp.rawDate),
        description: imp.rawDescription,
        source: isPdf ? 'pdf' : 'photo',
        categoryId: imp.aiCategoryId,
      },
    })
    await db.importedTransaction.update({
      where: { id: imp.id },
      data: { transactionId: tx.id },
    })
  }

  await db.importBatch.update({ where: { id: batchId }, data: { status: 'confirmed' } })
  revalidatePath('/dashboard')
  redirect('/import')
}

export async function discardBatch(batchId: string) {
  await db.importBatch.delete({ where: { id: batchId } })
  redirect('/import')
}
```

- [ ] **Step 2: Write `src/components/inbox-table.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { updateImportedTransaction, confirmBatch, discardBatch } from '@/actions/batches'

type Category = { id: string; name: string; color: string }
type ImportedTx = {
  id: string
  rawDate: string
  rawDescription: string
  rawAmount: any
  aiCategorized: boolean
  aiCategory: Category | null
}

export function InboxTable({
  batchId,
  items,
  categories,
}: {
  batchId: string
  items: ImportedTx[]
  categories: Category[]
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Record<string, any>>>({})
  const [loading, setLoading] = useState(false)

  const uncategorized = items.filter(i => !i.aiCategorized).length

  async function saveEdit(id: string) {
    const d = editData[id]
    if (!d) return
    await updateImportedTransaction(id, {
      rawDescription: d.rawDescription,
      rawDate: d.rawDate,
      rawAmount: d.rawAmount ? Number(d.rawAmount) : undefined,
      aiCategoryId: d.aiCategoryId === '' ? null : d.aiCategoryId,
    })
    setEditing(null)
  }

  return (
    <div>
      <table className="w-full text-sm mb-4">
        <thead>
          <tr className="border-b text-xs text-gray-500">
            <th className="text-left pb-2">Date</th>
            <th className="text-left pb-2">Description</th>
            <th className="text-left pb-2">Category</th>
            <th className="text-right pb-2">Amount</th>
            <th className="pb-2" />
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const isEditing = editing === item.id
            const ed = editData[item.id] ?? {}
            return (
              <tr
                key={item.id}
                className={`border-b last:border-0 ${!item.aiCategorized ? 'bg-amber-50' : ''}`}
              >
                <td className="py-2 pr-3 text-gray-500 whitespace-nowrap w-24">
                  {isEditing ? (
                    <input
                      type="date"
                      defaultValue={item.rawDate}
                      onChange={e => setEditData(prev => ({ ...prev, [item.id]: { ...ed, rawDate: e.target.value } }))}
                      className="border rounded px-1 py-0.5 text-xs w-full"
                    />
                  ) : (
                    item.rawDate
                  )}
                </td>
                <td className="py-2 pr-3">
                  {isEditing ? (
                    <input
                      defaultValue={item.rawDescription}
                      onChange={e => setEditData(prev => ({ ...prev, [item.id]: { ...ed, rawDescription: e.target.value } }))}
                      className="border rounded px-2 py-0.5 text-sm w-full"
                    />
                  ) : (
                    item.rawDescription
                  )}
                </td>
                <td className="py-2 pr-3">
                  {isEditing ? (
                    <select
                      defaultValue={item.aiCategory?.id ?? ''}
                      onChange={e => setEditData(prev => ({ ...prev, [item.id]: { ...ed, aiCategoryId: e.target.value } }))}
                      className="border rounded px-1 py-0.5 text-xs"
                    >
                      <option value="">— none —</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  ) : item.aiCategory ? (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: item.aiCategory.color + '20', color: item.aiCategory.color }}
                    >
                      {item.aiCategory.name}
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600 font-medium">⚠ Uncategorized</span>
                  )}
                </td>
                <td className="py-2 text-right font-medium">
                  {isEditing ? (
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={Math.abs(Number(item.rawAmount))}
                      onChange={e => setEditData(prev => ({ ...prev, [item.id]: { ...ed, rawAmount: -Math.abs(Number(e.target.value)) } }))}
                      className="border rounded px-1 py-0.5 text-xs w-20 text-right"
                    />
                  ) : (
                    `£${Math.abs(Number(item.rawAmount)).toFixed(2)}`
                  )}
                </td>
                <td className="py-2 pl-2">
                  {isEditing ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => saveEdit(item.id)}
                        className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="text-xs border px-2 py-0.5 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditing(item.id)}
                      className="text-xs border px-2 py-0.5 rounded hover:bg-gray-50"
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="flex items-center justify-between pt-2 border-t">
        <p className="text-sm text-gray-500">
          {uncategorized > 0 ? (
            <span className="text-amber-600">{uncategorized} uncategorized</span>
          ) : (
            <span className="text-green-600">All categorized ✓</span>
          )}
          {' · '}{items.length} total
        </p>
        <div className="flex gap-2">
          <form action={discardBatch.bind(null, batchId)}>
            <button
              type="submit"
              className="border rounded px-3 py-1.5 text-sm hover:bg-gray-50 text-red-600 border-red-200"
            >
              Discard
            </button>
          </form>
          <form action={confirmBatch.bind(null, batchId)}>
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700"
            >
              Confirm all ({items.length})
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write `src/app/import/[batchId]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { getBatch } from '@/actions/batches'
import { getCategories } from '@/actions/categories'
import { InboxTable } from '@/components/inbox-table'

export default async function BatchReviewPage({ params }: { params: { batchId: string } }) {
  const [batch, categories] = await Promise.all([
    getBatch(params.batchId),
    getCategories(),
  ])

  if (!batch || batch.status !== 'reviewing') notFound()

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">{batch.filename}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {batch.imported.length} transactions extracted · Review and confirm
      </p>
      <InboxTable
        batchId={batch.id}
        items={batch.imported}
        categories={categories}
      />
    </main>
  )
}
```

- [ ] **Step 4: Test the full import flow**

Upload a bank statement PDF. Verify extraction. Edit an uncategorized row, assign a category. Click "Confirm all". Verify redirect to `/import` and that transactions now appear on the dashboard.

- [ ] **Step 5: Commit**

```bash
git add src/actions/batches.ts src/components/inbox-table.tsx src/app/import/
git commit -m "feat: inbox review screen, confirm and discard batch"
```

---

## Task 8: Category rules + AI categorization in extraction

**Files:**
- Create: `src/lib/rules.ts`
- Create: `tests/lib/rules.test.ts`
- Modify: `src/app/api/upload/route.ts` (already uses `applyRules` — just needs the real file)

- [ ] **Step 1: Write failing test for `applyRules`**

`tests/lib/rules.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { applyRules } from '@/lib/rules'

const rules = [
  { categoryId: 'cat-groceries', keyword: 'tesco' },
  { categoryId: 'cat-groceries', keyword: 'sainsbury' },
  { categoryId: 'cat-transport', keyword: 'uber' },
]

describe('applyRules', () => {
  it('matches case-insensitively', () => {
    expect(applyRules('TESCO METRO LONDON', rules)).toBe('cat-groceries')
    expect(applyRules('tesco express', rules)).toBe('cat-groceries')
  })

  it('returns the first matching rule', () => {
    expect(applyRules('UBER * TRIP', rules)).toBe('cat-transport')
  })

  it('returns null when no rule matches', () => {
    expect(applyRules('SOME RANDOM MERCHANT', rules)).toBeNull()
  })

  it('returns null for empty description', () => {
    expect(applyRules('', rules)).toBeNull()
  })

  it('returns null when rules list is empty', () => {
    expect(applyRules('TESCO', [])).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- tests/lib/rules.test.ts
```

Expected: FAIL — `applyRules` not defined.

- [ ] **Step 3: Write `src/lib/rules.ts`**

```typescript
export type Rule = { categoryId: string; keyword: string }

export function applyRules(description: string, rules: Rule[]): string | null {
  const lower = description.toLowerCase()
  for (const rule of rules) {
    if (lower.includes(rule.keyword.toLowerCase())) {
      return rule.categoryId
    }
  }
  return null
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- tests/lib/rules.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: All PASS.

- [ ] **Step 6: Add Claude category suggestion as fallback in extraction**

The spec requires: rules first, then Claude suggestion, then uncategorized. Currently the upload route leaves Claude suggestion empty. Update `src/lib/claude.ts` to export a `suggestCategory` function, and update the upload route to call it for unmatched transactions.

Add to `src/lib/claude.ts`:
```typescript
export async function suggestCategory(
  description: string,
  categoryNames: string[],
): Promise<string | null> {
  if (categoryNames.length === 0) return null

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 64,
    system: `You categorize financial transactions. Given a description, return the best matching category name from the list, or "none" if none fits. Return ONLY the category name or "none". No other text.
Categories: ${categoryNames.join(', ')}`,
    messages: [{ role: 'user', content: description }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : 'none'
  return categoryNames.includes(text) ? text : null
}
```

Update `src/app/api/upload/route.ts` — inside the `extracted.map` loop, for rows where no rule matched, call `suggestCategory` using the category names, then look up the matching category ID:

```typescript
// Replace the createMany block with a loop that supports async Claude calls:
const categories = await db.category.findMany()
const catNameToId = Object.fromEntries(categories.map(c => [c.name, c.id]))
const categoryNames = categories.map(c => c.name)

const importedData = await Promise.all(
  extracted.map(async t => {
    const ruleMatch = applyRules(t.description, rules)
    if (ruleMatch) {
      return {
        batchId: batch.id,
        rawDate: t.date,
        rawDescription: t.description,
        rawAmount: t.amount,
        aiCategoryId: ruleMatch,
        aiCategorized: true,
      }
    }
    // No rule matched — ask Claude
    const suggestedName = await suggestCategory(t.description, categoryNames)
    const suggestedId = suggestedName ? catNameToId[suggestedName] ?? null : null
    return {
      batchId: batch.id,
      rawDate: t.date,
      rawDescription: t.description,
      rawAmount: t.amount,
      aiCategoryId: suggestedId,
      aiCategorized: suggestedId !== null,
    }
  })
)

await db.importedTransaction.createMany({ data: importedData })
```

Add `suggestCategory` to the import at the top of `route.ts`:
```typescript
import { extractTransactions, suggestCategory } from '@/lib/claude'
```

Also remove the `db.category.findMany()` call that was inside `createMany` (it's now before the loop). The `rules` variable stays.

- [ ] **Step 7: Verify categorization pipeline end-to-end**

Upload a file. Confirm:
- Transactions matching a keyword rule → green (categorized)
- Transactions Claude recognizes (e.g. "SPOTIFY") → categorized by Claude suggestion
- Truly unknown merchants → amber (uncategorized)

- [ ] **Step 8: Add "Save as rule" in inbox**

Add `saveRuleFromInbox` to `src/actions/batches.ts`:

```typescript
export async function saveRuleFromInbox(keyword: string, categoryId: string, importedTxId: string) {
  // Save the rule
  await db.categoryRule.create({ data: { categoryId, keyword } })
  // Update this transaction too
  await db.importedTransaction.update({
    where: { id: importedTxId },
    data: { aiCategoryId: categoryId, aiCategorized: true },
  })
  const tx = await db.importedTransaction.findUnique({ where: { id: importedTxId }, select: { batchId: true } })
  if (tx) revalidatePath(`/import/${tx.batchId}`)
}
```

In `src/components/inbox-table.tsx`, after the category `<select>` onChange, show a "Save as rule?" prompt when a category is chosen for an uncategorized item. Add after the save button:

```tsx
// Inside the isEditing branch, after the Save/Cancel buttons:
{!item.aiCategorized && editData[item.id]?.aiCategoryId && (
  <button
    onClick={async () => {
      const keyword = item.rawDescription.split(' ')[0]  // first word as keyword
      await saveRuleFromInbox(keyword, editData[item.id].aiCategoryId, item.id)
      setEditing(null)
    }}
    className="text-xs text-blue-600 hover:underline mt-1"
  >
    + Save "{item.rawDescription.split(' ')[0]}" as rule
  </button>
)}
```

Add the import at top of `inbox-table.tsx`:
```tsx
import { updateImportedTransaction, confirmBatch, discardBatch, saveRuleFromInbox } from '@/actions/batches'
```

- [ ] **Step 9: Test end-to-end**

1. Add a rule for "TESCO" → Groceries via the Categories page.
2. Upload a bank statement containing "TESCO METRO" transactions.
3. Confirm those rows are already categorized (green, not amber).
4. Find an uncategorized row, assign a category, click "Save as rule".
5. Upload another file — confirm that merchant is now auto-categorized.

- [ ] **Step 10: Commit**

```bash
git add src/lib/rules.ts src/lib/claude.ts tests/lib/rules.test.ts src/actions/batches.ts src/components/inbox-table.tsx src/app/api/upload/route.ts
git commit -m "feat: keyword rules, Claude category suggestion, save-as-rule from inbox"
```

---

## Task 9: Polish — empty states, loading, redirect

**Files:**
- Create: `src/app/dashboard/loading.tsx`
- Create: `src/app/import/loading.tsx`
- Modify: `src/app/dashboard/page.tsx` (empty state)
- Modify: `src/app/transactions/page.tsx` (empty state)

- [ ] **Step 1: Add loading skeletons**

`src/app/dashboard/loading.tsx`:
```tsx
export default function DashboardLoading() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-6" />
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[0, 1, 2].map(i => (
          <div key={i} className="border rounded-lg p-4 h-20 bg-gray-100 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="border rounded-lg p-4 h-64 bg-gray-100 animate-pulse" />
        <div className="border rounded-lg p-4 h-64 bg-gray-100 animate-pulse" />
      </div>
    </main>
  )
}
```

`src/app/import/loading.tsx`:
```tsx
export default function ImportLoading() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-6" />
      <div className="border-2 border-dashed rounded-xl p-16 bg-gray-50 animate-pulse" />
    </main>
  )
}
```

- [ ] **Step 2: Verify loading states**

Navigate between pages while dev server is running. Next.js will show the loading UI during server component fetch.

- [ ] **Step 3: Add `.gitignore` entries**

Ensure these are in `.gitignore`:
```
.env
.env.local
uploads/
.superpowers/
```

- [ ] **Step 4: Final end-to-end smoke test**

Run through the full golden path:
1. `docker compose up -d && npm run dev`
2. Navigate to `http://localhost:3000` → redirects to `/dashboard` (empty state)
3. Click "+ Add" → add 3 transactions with categories
4. Dashboard shows spending by category chart
5. Navigate months with ← / →
6. Go to Import → upload a bank statement PDF
7. Review inbox → edit one row → confirm all
8. Dashboard now shows extracted transactions
9. Go to Categories → add a keyword rule
10. Upload another file → rule auto-applies

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: All PASS.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: loading states, empty states, polish"
```

---

## Summary

| Task | What it builds |
|---|---|
| 1 | Docker + Prisma schema + seed |
| 2 | Category CRUD with rule management |
| 3 | Manual entry + nav + transaction list |
| 4 | Dashboard: spending by category + summary cards |
| 5 | Dashboard: month comparison chart |
| 6 | File upload + Claude extraction |
| 7 | Inbox review + confirm/discard |
| 8 | Keyword rules + save-as-rule from inbox |
| 9 | Loading states + final polish |
