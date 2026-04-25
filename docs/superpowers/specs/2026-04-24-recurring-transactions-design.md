# Recurring Transactions — Design Spec

**Date:** 2026-04-24  
**Status:** Approved for implementation

---

## Overview

Automatically detect recurring transactions from import history and surface them as **predicted upcoming expenses** — so the user always knows their real available money after accounting for charges that haven't hit yet this month.

Two surfaces are updated: **Dashboard** (new cards + upcoming panel + improved chart card) and **Transactions page** (predicted rows + confirm flow).

No changes to the import flow itself — detection is a silent side-effect of confirming a batch.

---

## Detection Algorithm

Triggered automatically after `ImportService.confirm()` completes.

**A transaction group is recurring if:**
1. Same description (case-insensitive exact match)
2. Amount within ±20% of the median across occurrences
3. Day of month within ±5 days across occurrences
4. Appears in **at least 2 of the last 3 months**

On each trigger, the backend upserts a `RecurringPattern` row for each qualifying group. Patterns the user has dismissed (`active = false`) are never overwritten.

---

## Data Model

### New Prisma model: `RecurringPattern`

```prisma
model RecurringPattern {
  id            String    @id @default(cuid())
  description   String    @unique
  typicalDay    Int
  typicalAmount Decimal   @db.Decimal(10, 2)
  categoryId    String?
  category      Category? @relation(fields: [categoryId], references: [id])
  active        Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

### Predicted transaction (computed, never stored)

For each active `RecurringPattern`, if no real transaction matching the description exists in the current month → it's **upcoming**:

```typescript
interface UpcomingItem {
  patternId: string
  description: string
  typicalAmount: number      // negative (expense)
  expectedDay: number        // typicalDay
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
}
```

---

## API Changes

### New module: `RecurringModule`

| Method | Path | Description |
|---|---|---|
| GET | `/api/recurring/upcoming?year=&month=` | List unmatched predictions for a given month |
| DELETE | `/api/recurring/patterns/:id` | Dismiss a pattern (`active = false`) |

### Extended: `GET /api/dashboard/summary`

Response gains a new top-level `upcoming` field:

```typescript
{
  summary: { ... },        // existing
  byCategory: [...],       // existing
  monthlyTotals: [...],    // existing
  upcoming: {
    total: number          // sum of all typicalAmounts (absolute value)
    items: UpcomingItem[]
  },
  dailyTotals: Array<{     // NEW — for day-by-day chart
    year: number
    month: number
    label: string          // "Feb", "Mar", "Apr"
    days: Array<{ day: number; cumulative: number }>
  }>
}
```

`dailyTotals` always returns 3 months (month-2, month-1, month) with daily cumulative spend. Used by the new daily spending chart.

---

## Dashboard Changes

### Summary cards row

Two new cards added after the existing 3:

| Card | Value | Color |
|---|---|---|
| UPCOMING THIS MONTH | Sum of all unmatched predicted amounts | Amber (`$accent`) |
| NET AVAILABLE TODAY | income − spent this month − upcoming | Green (`$green`) |

### "Upcoming this month" panel

Positioned between the existing callout and charts row. Only shown if there is at least 1 active unmatched prediction.

**Structure:**
- Header: calendar icon + "Upcoming this month" + amber badge with count ("3 expected")
- One row per prediction: category colour dot · description · "Expected ~Apr {day} · {category}" · amount in amber
- No actions from the dashboard — rows are informational only

### Chart card — two views (← ● ○ →)

The right chart panel becomes a two-view card navigated with arrow buttons and dot indicators.

**View 1 — Last 4 months** (default, dot 1 active):
- Bar chart: 4 monthly total bars with Y-axis labels (£0–£4k)
- Current month bar in amber, past months in muted grey
- Grid lines at £1k intervals

**View 2 — Daily spending** (dot 2 active):
- X axis: days 1–31; Y axis: cumulative spend
- 3 lines: month-2 (15% opacity white), month-1 (45% opacity white), current month (full amber)
- Current month line ends at today's date with a filled amber dot
- Legend at bottom: Feb · Mar · Apr (now)

**Hover interaction (View 2):**
- Vertical dashed line follows the cursor along the X axis
- At the cursor position: horizontal dashed lines branch left from each line's value to the Y axis (each in the line's colour/opacity)
- Tooltip appears near the cursor showing: day label + all 3 spend values at that day
- Tooltip structure: "Day 14" header · Feb £290 · Mar £455 · Apr £145

---

## Transactions Page Changes

### "Show predicted" toggle

Pill toggle in the filter bar (right side). Default: **on** (predicted rows visible). Clicking it hides/shows all predicted rows.

### Predicted rows

Visually distinct from real rows:

- **Background:** subtle indigo tint (`#818cf812`) with indigo bottom border
- **Date column:** `~Apr {day}` in indigo colour, 80% opacity
- **Description column:** description text + `PREDICTED` badge (indigo tinted pill, small caps)
- **Category column:** normal category pill (same as real rows)
- **Source column:** `—`
- **Amount column:** amount in indigo colour, 80% opacity
- **Action column:** ✓ button (green check icon) + ⋯ menu

Predicted rows are sorted into the list by their expected date, interleaved with real transactions.

### ✓ button → Confirm popover (Option B)

A popover appears anchored to the row with:

```
┌─────────────────────────────────┐
│ Confirm transaction           ✕ │
├─────────────────────────────────┤
│ [Predicted summary box]         │
│  Netflix                        │
│  Predicted ~Apr 15 · −£17.99    │
├─────────────────────────────────┤
│ Actual date                     │
│ [15 Apr 2026          ▾]        │
│                                 │
│ Actual amount                   │
│ [£ 17.99              ]         │
├─────────────────────────────────┤
│              Cancel  Save as tx │
└─────────────────────────────────┘
```

"Save as transaction" calls `POST /api/transactions` with the entered values + the pattern's category. On success: the predicted row disappears from the list and is replaced by the new real transaction.

### ⋯ menu on predicted row

Single action: **Remove recurring** → calls `DELETE /api/recurring/patterns/:id`. The pattern is dismissed (`active = false`) and the row disappears.

---

## Empty & Edge States

- **No patterns yet** (first-time user): "Upcoming" card hidden, no panel shown, dashboard looks as it does today.
- **All predictions fulfilled** (all recurring already confirmed this month): panel hidden, "Upcoming" card shows £0 with "All clear for this month".
- **Pattern dismissed then re-appearing**: dismissed patterns are never re-activated by the auto-scan. User must manually delete and re-import to clear.

---

## Out of Scope

- Manual "Add recurring" flow — auto-detection only
- Recurring detection on manually added transactions (import only for now)
- Weekly or annual recurrence — monthly only
- Push notifications / email alerts for upcoming transactions
- Streaming/AI categorisation of predicted amounts
