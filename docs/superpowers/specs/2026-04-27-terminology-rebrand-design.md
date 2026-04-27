# Terminology Rebrand — Design Spec
_Date: 2026-04-27_

## Goal

Replace informal money-movement labels with friendly but financially accurate terms. Each key term gets a small inline "i" icon on dashboard metric cards that opens a popover showing the technical/financial equivalent and a plain-English description. This teaches users real financial vocabulary (outflow, inflow, net cash flow, etc.) in context — the same terms they'll encounter in investment and stock reports.

## Scope

**Option A (chosen):** core money-movement vocabulary only. Page names (Dashboard, Transactions, Categories, Settings) stay unchanged.

**"i" popovers appear only on the 5 dashboard metric cards** — where terms are most prominent and the educational value is highest. Term labels are updated everywhere they appear (chart titles, toggles, budget labels), but the popover icon only lives on the cards.

---

## 1. Terminology Constants — `src/lib/terminology.ts`

Single exported `TERMS` object. Each entry is the source of truth for label, technical term, and popover description. All UI components import from here — no scattered string literals.

```ts
export const TERMS = {
  moneyOut: {
    label: "Money Out",
    technical: "Outflow",
    description: "Total money leaving your account this period — what you spent.",
  },
  saved: {
    label: "Saved",
    technical: "Net Cash Flow",
    description: "What remains after all spending. Positive means you saved money.",
  },
  availableNow: {
    label: "Available Now",
    technical: "Liquidity",
    description: "Your balance minus known upcoming expenses this period.",
  },
  dueSoon: {
    label: "Due Soon",
    technical: "Committed Outflows",
    description: "Recurring expenses expected before the end of this period.",
  },
  spending: {
    label: "Spending",
    technical: "Expenditure",
    description: "Any money leaving your account, grouped for analysis.",
  },
  whereItGoes: {
    label: "Where it Goes",
    technical: "Expenditure Breakdown",
    description: "Your outflows grouped by category.",
  },
  overLimit: {
    label: "Over limit",
    technical: "Budget Variance",
    description: "Amount spent beyond your set limit for this category.",
  },
} as const

export type TermKey = keyof typeof TERMS
```

This file is the i18n migration surface — when i18n arrives, `TERMS` becomes the `en` messages object and each entry maps to a translation key. No component changes needed at that point.

---

## 2. New Components

### `InfoIcon` — `src/components/ui/info-icon.tsx`

- Props: `term: TermKey`
- 14×14 circle, border `text-3`, "i" text centered
- Active state: fills amber (`accent`)
- Manages open/close state internally
- On click: toggles popover; click-away closes it
- Renders `TermPopover` when open, positioned below the icon

```tsx
<InfoIcon term="moneyOut" />
```

### `TermPopover` — `src/components/ui/term-popover.tsx`

- Props: `term: TermKey; onClose: () => void`
- Absolutely positioned, `z-50`, appears below the trigger
- Width: 220px, `surface-2` background, `border-2` stroke, shadow
- Corner radius: 8px
- Layout (vertical, gap 8, padding 10×12):
  1. Row: friendly label (text, 13px semibold) + technical badge (amber bg, amber text, 10px semibold)
  2. Divider (1px, `border`)
  3. Description (12px, `text-2`, wraps to fixed width)
- Dismisses on outside click (listener on `document`, cleaned up on unmount)

Design reference: `design/financeDesign.pen` → frame "Terminology — i Icon & Popover"

---

## 3. Label Changes by Location

### Dashboard metric cards (desktop + mobile) — also get `InfoIcon`

| Current label | New label | Term key |
|---|---|---|
| Spent this month | Money Out | `moneyOut` |
| Leftover | Saved | `saved` |
| Net available today | Available Now | `availableNow` |
| Upcoming this month | Due Soon | `dueSoon` |

### Chart titles & toggles — label update only, no `InfoIcon`

| Location | Current | New |
|---|---|---|
| Chart header | Spending by Category | Where it Goes |
| Chart mode button | Spending / % Spend | Spending / % Spend _(keep)_ |
| Dashboard callout | spent | spent → money out |
| Insights subtitle | spending breakdown | spending breakdown _(keep)_ |

### Budget / category labels — label update only

| Location | Current | New |
|---|---|---|
| Budget overflow status | Over budget | Over limit |
| Budget card header | Spending vs Budget | Spending vs Budget _(keep)_ |

### Transaction type toggle

| Current | New |
|---|---|
| Expense | Spending |

---

## 4. Files to Change

| File | Change |
|---|---|
| `src/lib/terminology.ts` | **Create** — TERMS constants |
| `src/components/ui/info-icon.tsx` | **Create** — InfoIcon component |
| `src/components/ui/term-popover.tsx` | **Create** — TermPopover component |
| `src/app/dashboard/page.tsx` | Update card labels, import InfoIcon |
| `src/components/spending-bar-chart.tsx` | "Spending by Category" → "Where it Goes" |
| `src/components/spending-section.tsx` | Related label updates |
| `src/app/transactions/page.tsx` | "Expense" toggle → "Spending" |
| `src/app/import/inbox/page.tsx` | Any "expense" labels |
| `src/components/batch-review-client.tsx` | "Mark as expense" → "Mark as spending" |
| `src/app/categories/page.tsx` | "Over budget" → "Over limit" |
| `src/app/insights/insights-category-table.tsx` | Budget overflow label |

---

## 5. Non-Goals

- No changes to page names, nav items, or route paths
- No changes to backend field names or API responses
- No i18n framework added in this phase — `TERMS` is the foundation for it
- No changes to `source` pill labels (manual, pdf, csv, photo)
- No changes to error messages or loading states
