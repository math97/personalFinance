# Terminology Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace informal money-movement labels with friendly financial terms and add an "i" popover on dashboard metric cards that shows the technical term + description.

**Architecture:** Create a central `TERMS` constants file as the single source of truth, build two new `components/ui` components (`InfoIcon`, `TermPopover`), then update labels across the app. No backend changes.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS v4, React state for popover open/close.

---

## File Map

| File | Action |
|---|---|
| `src/lib/terminology.ts` | Create — TERMS constants + TermKey type |
| `src/components/ui/info-icon.tsx` | Create — trigger circle with open/close state |
| `src/components/ui/term-popover.tsx` | Create — popover content with badge + description |
| `src/app/dashboard/page.tsx` | Update 4 card labels + add InfoIcon |
| `src/components/spending-bar-chart.tsx` | Update "Spending by Category" → "Where it Goes", "leftover" → "saved" |
| `src/app/transactions/page.tsx` | "Expense" toggle → "Spending" (2 occurrences) |
| `src/components/batch-review-client.tsx` | "Mark as expense" → "Mark as spending" |
| `src/app/insights/insights-category-table.tsx` | "over budget" → "over limit" |
| `src/app/insights/insights-drill-down.tsx` | "Over budget" / "Under budget" → "Over limit" / "Under limit" |

---

## Task 1: Create terminology constants

**Files:**
- Create: `code/apps/frontend/src/lib/terminology.ts`

- [ ] **Create the file**

```ts
export const TERMS = {
  moneyOut: {
    label: 'Money Out',
    technical: 'Outflow',
    description: 'Total money leaving your account this period — what you spent.',
  },
  saved: {
    label: 'Saved',
    technical: 'Net Cash Flow',
    description: 'What remains after all spending. Positive means you saved money.',
  },
  availableNow: {
    label: 'Available Now',
    technical: 'Liquidity',
    description: 'Your balance minus known upcoming expenses this period.',
  },
  dueSoon: {
    label: 'Due Soon',
    technical: 'Committed Outflows',
    description: 'Recurring expenses expected before the end of this period.',
  },
  spending: {
    label: 'Spending',
    technical: 'Expenditure',
    description: 'Any money leaving your account, grouped for analysis.',
  },
  whereItGoes: {
    label: 'Where it Goes',
    technical: 'Expenditure Breakdown',
    description: 'Your outflows grouped by category.',
  },
  overLimit: {
    label: 'Over limit',
    technical: 'Budget Variance',
    description: 'Amount spent beyond your set limit for this category.',
  },
} as const

export type TermKey = keyof typeof TERMS
```

- [ ] **Verify TypeScript is happy**

```bash
cd code/apps/frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors related to this file.

- [ ] **Commit**

```bash
git add code/apps/frontend/src/lib/terminology.ts
git commit -m "feat: add terminology constants (TERMS + TermKey)"
```

---

## Task 2: Create `TermPopover` component

**Files:**
- Create: `code/apps/frontend/src/components/ui/term-popover.tsx`

- [ ] **Create the file**

```tsx
import { TERMS, TermKey } from '@/lib/terminology'

interface TermPopoverProps {
  term: TermKey
  onClose: () => void
}

export function TermPopover({ term, onClose }: TermPopoverProps) {
  const t = TERMS[term]
  return (
    <div
      className="absolute left-0 top-full z-50 mt-1.5 w-[220px] rounded-lg border border-border-2 bg-surface-2 p-3"
      style={{ boxShadow: '0 4px 16px #00000066' }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-text">{t.label}</span>
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide"
          style={{ background: '#f59e0b18', color: '#f59e0b', border: '1px solid #f59e0b30' }}
        >
          {t.technical}
        </span>
      </div>
      <div className="mb-0 h-px bg-border" />
      <p className="mt-2 text-xs leading-relaxed text-text-2">{t.description}</p>
    </div>
  )
}
```

- [ ] **Verify TypeScript**

```bash
cd code/apps/frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Commit**

```bash
git add code/apps/frontend/src/components/ui/term-popover.tsx
git commit -m "feat: add TermPopover component"
```

---

## Task 3: Create `InfoIcon` component

**Files:**
- Create: `code/apps/frontend/src/components/ui/info-icon.tsx`

- [ ] **Create the file**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { TermPopover } from './term-popover'
import { TermKey } from '@/lib/terminology'

interface InfoIconProps {
  term: TermKey
}

export function InfoIcon({ term }: InfoIconProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="Learn more"
        className="ml-1.5 inline-flex h-[14px] w-[14px] items-center justify-center rounded-full transition-colors"
        style={{
          border: `1px solid ${open ? '#f59e0b' : 'var(--text-3)'}`,
          background: open ? '#f59e0b18' : 'transparent',
          color: open ? '#f59e0b' : 'var(--text-3)',
        }}
      >
        <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1, fontFamily: 'Inter, sans-serif' }}>i</span>
      </button>
      {open && <TermPopover term={term} onClose={() => setOpen(false)} />}
    </span>
  )
}
```

- [ ] **Verify TypeScript**

```bash
cd code/apps/frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Commit**

```bash
git add code/apps/frontend/src/components/ui/info-icon.tsx
git commit -m "feat: add InfoIcon component with popover"
```

---

## Task 4: Update dashboard metric card labels

**Files:**
- Modify: `code/apps/frontend/src/app/dashboard/page.tsx`

Four cards need updated labels and `InfoIcon`. The file already imports from `@/components/` — add two imports.

- [ ] **Add imports** at the top of `dashboard/page.tsx` (after existing imports):

```tsx
import { InfoIcon } from '@/components/ui/info-icon'
import { TERMS } from '@/lib/terminology'
```

- [ ] **Update "Spent this month" card** (currently line ~104):

```tsx
<p className="text-xs font-medium mb-2 uppercase tracking-wider text-text-2">
  {TERMS.moneyOut.label}<InfoIcon term="moneyOut" />
</p>
```

- [ ] **Update "Upcoming this month" card** (currently line ~138):

```tsx
<p className="text-xs font-medium mb-2 uppercase tracking-wider text-text-2">
  {TERMS.dueSoon.label}<InfoIcon term="dueSoon" />
</p>
```

- [ ] **Update "Net available today" card** label and formula line (currently lines ~151–155):

```tsx
<p className="text-xs font-medium mb-2 uppercase tracking-wider text-text-2">
  {TERMS.availableNow.label}<InfoIcon term="availableNow" />
</p>
```

And the formula description below it:
```tsx
<p className="text-xs mt-1 text-text-2">money in − money out − due soon</p>
```

- [ ] **Verify TypeScript and dev server has no errors**

```bash
cd code/apps/frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Commit**

```bash
git add code/apps/frontend/src/app/dashboard/page.tsx
git commit -m "feat: update dashboard card labels and add InfoIcon popovers"
```

---

## Task 5: Update spending bar chart labels

**Files:**
- Modify: `code/apps/frontend/src/components/spending-bar-chart.tsx`

Three label changes: chart title, "leftover" row label, tooltip text.

- [ ] **Update chart title** (currently line ~59):

```tsx
import { TERMS } from '@/lib/terminology'
```
Add this import at the top. Then update the heading:

```tsx
<h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{TERMS.whereItGoes.label}</h2>
```

- [ ] **Update "leftover" inline label** (currently line ~187):

```tsx
<span className="text-xs" style={{ color: 'var(--text-2)' }}>{TERMS.saved.label.toLowerCase()}</span>
```

- [ ] **Update "Leftover:" tooltip text** (currently line ~200):

```tsx
{TERMS.saved.label}: {currency}{leftover.toLocaleString()}
```

- [ ] **Verify TypeScript**

```bash
cd code/apps/frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Commit**

```bash
git add code/apps/frontend/src/components/spending-bar-chart.tsx
git commit -m "feat: update chart labels — Where it Goes, Saved"
```

---

## Task 6: Update "Expense" toggle label in transactions page

**Files:**
- Modify: `code/apps/frontend/src/app/transactions/page.tsx`

Two occurrences of `'Expense'` in the income/expense toggle (lines ~459 and ~777).

- [ ] **Replace both occurrences** — find the pattern `ed.isIncome ? 'Income' : 'Expense'` and update:

```tsx
{ed.isIncome ? 'Income' : 'Spending'}
```

Both are in the inline row edit form — one in the mobile card view, one in the desktop table view. Use find-and-replace across the file (both instances have identical text).

- [ ] **Verify TypeScript**

```bash
cd code/apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Commit**

```bash
git add code/apps/frontend/src/app/transactions/page.tsx
git commit -m "feat: rename Expense toggle to Spending in transactions page"
```

---

## Task 7: Update "Mark as expense" in batch review

**Files:**
- Modify: `code/apps/frontend/src/components/batch-review-client.tsx`

One occurrence at line ~237.

- [ ] **Update the tooltip title** (line ~237):

```tsx
title={isIncome ? 'Mark as spending' : 'Mark as income'}
```

- [ ] **Verify TypeScript**

```bash
cd code/apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Commit**

```bash
git add code/apps/frontend/src/components/batch-review-client.tsx
git commit -m "feat: rename Mark as expense → Mark as spending in batch review"
```

---

## Task 8: Update "over budget" labels in insights

**Files:**
- Modify: `code/apps/frontend/src/app/insights/insights-category-table.tsx`
- Modify: `code/apps/frontend/src/app/insights/insights-drill-down.tsx`

- [ ] **Update `insights-category-table.tsx`** (line ~67):

```tsx
? <><CurrencyAmount amount={Math.abs(left)} /> over limit</>
```

- [ ] **Update `insights-drill-down.tsx`** (line ~90):

```tsx
{isOver ? 'Over limit' : 'Under limit'}
```

- [ ] **Verify TypeScript**

```bash
cd code/apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Commit**

```bash
git add code/apps/frontend/src/app/insights/insights-category-table.tsx code/apps/frontend/src/app/insights/insights-drill-down.tsx
git commit -m "feat: rename over budget → over limit in insights"
```

---

## Task 9: Run full test suite and verify

- [ ] **Run frontend tests**

```bash
cd code/apps/frontend && npm test
```
Expected: all tests passing (26 tests).

- [ ] **Run backend tests** (smoke check — no backend changes, but confirm nothing broke)

```bash
cd code/apps/backend && npm test 2>&1 | tail -5
```
Expected: 154 passing.

- [ ] **Run TypeScript check one final time**

```bash
cd code/apps/frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Commit if any test fixes were needed, then push**

```bash
git push origin main
```
