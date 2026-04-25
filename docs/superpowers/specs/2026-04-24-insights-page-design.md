# Insights Page — Design Spec

**Date:** 2026-04-24
**Status:** Approved for implementation

---

## Overview

A new `/insights` page giving the user a deep, month-by-month view of spending across all categories. The page has two states: an overview table and a per-category drill-down. An AI chat box at the bottom lets the user ask natural-language questions about their finances.

No changes to the existing Dashboard.

---

## Routes & Navigation

- **Route:** `/insights`
- **Sidebar:** Add "Insights" nav item between "Transactions" and "Upload Files"
- The drill-down is a client-side state change (no URL change needed — the overview and detail are in the same page component)

---

## Page States

### State 1 — Overview

**Header:**
- Title: "Insights" + subtitle "3-month spending breakdown by category"
- Right side: month picker (← Apr 2026 →) to navigate which month is "current"

**Category Table:**

Columns (left to right):

| Column | Width | Notes |
|---|---|---|
| Category | 200px | Color dot + name |
| Feb | 120px | Spend amount, muted color |
| Mar | 120px | Spend amount, muted color |
| Apr (current) | 120px | Spend amount, bold + white |
| Budget | 160px | Mini progress bar + status text |
| [spacer] | fill | Pushes Trend to the right |
| Trend | ~80px | 3-bar sparkline + delta % |

**Budget column logic:**
- Category has a budget AND is under → thin progress bar (category color) + "£X left" in green
- Category has a budget AND is over → full red bar + "£X over budget" in red
- Category has a budget AND ≥90% used → amber bar + "£X left — Y%" in amber
- Category has no budget → `—` in muted text

**Trend column logic:**
- Delta % = (current month spend − previous month spend) / previous month spend × 100
- Green = spending went down, Red = spending went up
- 3 bars: oldest at 35% opacity, middle at 65%, current at 100% (all in category color)
- If a category has zero spend in all 3 months, show `—`

**Row interaction:**
- Each row is clickable → transitions to drill-down state for that category
- Hover: subtle background highlight

**AI Chat Box** (below the table):
- Header: amber "AI" badge + "Ask about your spending" label
- Suggestion chips (3): "Why did [top mover] spike?", "Where can I cut back?", "Compare to last month"
  - The top mover chip uses the actual category name from the data
- Input: pill-shaped text input with placeholder "Ask anything about your finances…" + amber send button

---

### State 2 — Drill-down (per category)

Triggered by clicking a row in the overview table.

**Header:**
- Back link: `← Insights` (returns to overview)
- Category color dot + category name as page title

**Stats Cards Row (4 cards):**

| Card | Value |
|---|---|
| 3-Month Total | Sum of last 3 months spend |
| Monthly Average | Total ÷ 3 |
| Biggest Month | Highest month + month label |
| Monthly Budget | Budget amount (if set) + over/under badge |

If no budget is set on the category, show the Budget card with "No budget set" + a small "Set budget →" link pointing to `/categories`.

**Monthly Spending Bar Chart:**
- 3 vertical bars: Feb, Mar, Apr (current month)
- Past months at 30% and 55% opacity, current month at full opacity
- Amount label above each bar, month label below
- Current month label highlighted in category color
- Delta tag in top-right corner: "+32% vs last month" (red if up, green if down)

---

## Data Architecture

### Backend — new endpoint

```
GET /api/insights/categories?year=2026&month=4
```

Response:
```typescript
{
  categories: Array<{
    categoryId: string
    name: string
    color: string
    monthlyBudget: number | null
    months: Array<{       // always 3 items, oldest first
      year: number
      month: number
      label: string       // "Feb", "Mar", "Apr"
      total: number
    }>
    delta: number | null  // % change current vs previous, null if no prior data
  }>
}
```

**Implementation notes:**
- Reuses `TransactionRepository.groupByCategory(year, month)` called 3× in parallel
- `CategoryRepository.findAll()` provides name/color/budget
- The 3 months are always: (month−2), (month−1), month — relative to the query params
- Months with no transactions return `total: 0`

### Backend — AI chat endpoint

```
POST /api/insights/chat
Body: {
  message: string
  context: {
    year: number
    month: number
    categories: Array<{ name: string; months: { label: string; total: number }[]; monthlyBudget: number | null; delta: number | null }>
  }
}
Response: { reply: string }
```

**Implementation notes:**
- Uses the existing `AIPort` / adapter pattern (same as import categorization)
- System prompt instructs the AI to act as a personal finance assistant with access to the provided spending data
- Context is injected as structured text in the user message — no tool use needed
- The AI should reference specific numbers from the context in its reply
- One-shot response (no streaming for now)

### Frontend

- `GET /api/insights/categories` is called once on mount and on month change
- The AI chat maintains a local `messages[]` state (not persisted, resets on page reload)
- Suggestion chips are pre-filled prompts — clicking one submits the chip text as a message
- After sending, the input clears and a loading state shows (spinner in the send button area)
- AI reply appears below the input as a message bubble

---

## Component Breakdown

| Component | Type | Description |
|---|---|---|
| `InsightsPage` | Client Component | Root, holds overview/detail state + chat state |
| `InsightsCategoryTable` | sub-component | The overview table |
| `InsightsDrillDown` | sub-component | Per-category detail (stats + chart) |
| `InsightsAIChat` | sub-component | Chat box with input + message history |
| `SparklineBar` | shared | 3-bar sparkline (reused from categories if built) |

---

## Empty & Edge States

- **No data at all (new user):** Table shows categories with £0 across all months + "No transactions yet — import or add some to see insights"
- **Category with no budget:** Budget column shows `—`, drill-down Budget card shows "No budget set" + link
- **Only 1 or 2 months of data:** Months with no data show £0 and the sparkline has flat bars
- **AI error:** Show "Couldn't reach AI — check your API key in Settings" below the input

---

## Out of Scope (this iteration)

- Persisted chat history
- Streaming AI responses
- Date ranges beyond 3 months
- Exporting the insights data
- Insights for income transactions (expenses only)
