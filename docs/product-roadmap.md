# Product Roadmap — Personal Finance App

**PM Lens:** Local-first, single user (you) → validate → scale if it clicks.
**Date:** April 2026

---

## Strategic Framing

### What the market is missing

| Competitor | Core Gap |
|---|---|
| Visor | Zero budgeting or goals. Automation without action. |
| Mobills | Sync breaks. Data loss. No trust. |
| Actual Budget | No mobile. Manual bank sync. Technical setup. |
| Emma | Free tier gutted. Aggressive upsell destroys trust. |
| Cleo | FTC settlement. Cash advance gimmick over substance. |
| Piere | US only. Moves money but doesn't help you understand it. |

**The gap:** Nobody combines reliable Open Finance sync + real budgeting + AI that explains your money — without dark patterns, broken sync, or requiring a PhD to set up.

### Your positioning (local-first → product)
> "The app that knows your money better than you do — and actually helps you act on it."

---

## Guiding Principles

1. **Reliability before features.** Mobills has 10M downloads and 3.5★ because sync breaks. If your data is wrong, nothing else matters.
2. **Local-first means fast.** No waiting for servers. Instant load. This is a feature, not a compromise.
3. **Every screen must answer one question.** Don't build dashboards. Build answers.
4. **AI earns trust through accuracy.** Don't show projections unless you're confident. A wrong forecast is worse than no forecast.

---

## Phase 0 — Foundation (Personal Use, Weeks 1–3)
**Goal:** Get your own financial data flowing reliably. Nothing else matters until this works.

> **Context (Europe):** Open Finance sync is not available in Europe. Data entry is via manual input and AI-assisted PDF/photo import. The pipeline below replaces bank sync as the foundation.

| # | Feature | Why now | Notes |
|---|---|---|---|
| 0.1 | **Infrastructure** | Everything else depends on this | Next.js 14, PostgreSQL via Docker Compose, Prisma schema |
| 0.2 | **Manual transaction entry** | Fastest path to having real data | Form: amount, description, date, account — goes straight to confirmed ledger |
| 0.3 | **Category management** | Needed before any import or dashboard | Flat list, color-coded. Default set: Groceries, Restaurants, Transport, Subscriptions, Rent, Health, Shopping, Other |
| 0.4 | **Dashboard (basic)** | Validates schema + UI before adding AI complexity | Spending by category (bar chart) + month comparison (last 4 months) + summary cards |
| 0.5 | **PDF / photo import → inbox** | Main data entry path for bank statements and receipts | Upload multiple files → Claude extracts transactions → inbox review → confirm to ledger |
| 0.6 | **Category rules + AI categorization** | Reduces review friction over time | Rule-based first (keyword match), Claude fallback. Every inbox correction can save a new rule. |

**Exit criteria:** You check it daily. The data is accurate. Import hasn't broken in 2 weeks.

**Spec:** `docs/superpowers/specs/2026-04-15-personal-finance-mvp-design.md`

---

## Phase 1 — Make It Yours (Personal Use, Weeks 4–6)
**Goal:** Stop observing, start understanding. Turn raw data into insight you act on.

| # | Feature | Why now | Competitive insight |
|---|---|---|---|
| 1.1 | **Custom categories + subcategories** | Everyone misclassifies. You know your life better than the algorithm. | Emma launched subcategories in 2025 — users loved it |
| 1.2 | **Custom rules + tags** | e.g., "Rappi = Food Delivery", always | Actual Budget does this well — steal the pattern |
| 1.3 | **Calendar heatmap** | Reveals behavioral patterns visually. High-spend days jump out. | No Brazilian competitor has this |
| 1.4 | **Monthly comparison view** | "Am I better than last month?" is the most asked question | Simple bar chart: this month vs last 3 |
| 1.5 | **AI Balance Projections (3/6/12 months)** | Only valuable after you have 2+ months of clean data | Visor has this — it's their #1 feature. Do it better with budget context |

**Exit criteria:** You've corrected your categories. You've noticed a pattern you didn't know about. The projections feel right.

---

## Phase 2 — Control (Personal Use → Shareable, Weeks 7–10)
**Goal:** Move from passive tracking to active control. This is where most apps fail.

| # | Feature | Why now | Notes |
|---|---|---|---|
| 2.1 | **Two-tap budget creation** | Friction kills budgeting. Auto-suggest from 3-month average. | Key differentiator vs Mobills (manual) and Actual Budget (envelope setup is complex) |
| 2.2 | **Budget vs actual tracking** | Budgets without feedback are useless | Show remaining budget per category in real time |
| 2.3 | **Budget carryover** | YNAB's #1 requested missing feature. Budget this month's income for next month. | Unique in the Brazilian market. Steal from Actual Budget community requests |
| 2.4 | **Financial goals module** | "Save R$5k for trip by December" — clear, motivating | Show savings rate needed + projection to hit/miss |
| 2.5 | **Goal-driven roadmap** | AI surfaces: "At your current rate, you hit this goal in X months. Here's what changes that." | This is Intelligent Planning from your feature doc — contextualized to goals |

**Exit criteria:** You have a budget. You've hit or missed it and understand why. You have at least one active goal.

---

## Phase 3 — Polish for Others (Pre-Launch, Weeks 11–14)
**Goal:** Would you recommend this to a friend? Fix everything that makes the answer "not yet."

| # | Feature | Why now | Notes |
|---|---|---|---|
| 3.1 | **Manual transaction entry** | Not every expense hits a connected account. Cash, informal payments. | Keep it fast: amount + category + date in 3 taps |
| 3.2 | **Receipt photo storage** | Useful for expense tracking and reimbursements | Attach to transaction. No OCR needed yet. |
| 3.3 | **CSV / OFX import** | For banks not yet on Open Finance + migration from Mobills | Big unlock for users switching from competitors |
| 3.4 | **Onboarding flow** | A new user can't start from scratch — they need a guided setup | Connect 1 bank → see dashboard → create first budget. Under 5 minutes. |
| 3.5 | **Data export** | Trust signal. Users must feel their data is theirs. | CSV export of all transactions. Also useful for your own analysis. |

**Exit criteria:** A non-technical friend can set it up alone and finds value in week 1.

---

## Phase 4 — Scale (Post-Validation, Month 4+)
**Only if Phase 0–3 feels right. Don't build this speculatively.**

| # | Feature | Strategic reason |
|---|---|---|
| 4.1 | Mobile app (iOS first) | Actual Budget's #1 weakness. PWA is a barrier to habit formation. |
| 4.2 | Receipt OCR / scanner | Removes last friction for cash users |
| 4.3 | Investment tracking | Emma and Cleo both lack this. Huge gap for Brazilian users with Tesouro Direto / CDB / stocks. |
| 4.4 | Net worth tracking (assets + liabilities) | Dashboard evolution. High stickiness feature. |
| 4.5 | Freemium pricing model | Free: 1 bank, 90-day history. Paid: unlimited banks, full history, AI features. |
| 4.6 | Collaborative / family budgets | Emma launched this in 2025. B2B angle possible (employers). |

---

## Feature Priority Matrix

```
                    HIGH PERSONAL VALUE
                           |
         0.1 Bank Sync     |    1.3 Heatmap
         0.3 Categories    |    2.3 Carryover
         0.5 Dashboard     |    2.4 Goals
                           |
LOW MARKET ________________|________________ HIGH MARKET
DIFF                       |                DIFF
                           |
         3.1 Manual Entry  |    2.1 Two-tap Budget
         3.2 Receipts      |    2.5 AI Roadmap
                           |    1.5 Projections
                    LOW PERSONAL VALUE
```

**Build top-left first** (high personal value, table stakes).
**Then top-right** (high personal value + market differentiation = your moat).
**Bottom-right last** (market facing, build when you have users to validate with).

---

## What to Skip (for now)

| Feature | Reason to skip |
|---|---|
| AI chat / conversational UI | Cleo has 7M users and $175M — don't fight on this battlefield yet |
| Cash advances / lending | Regulatory complexity, FTC risk (see Cleo) |
| Bill negotiation | Requires partnerships |
| Credit score tracking | API costs, regulatory complexity in Brazil |
| Social / gamification | Distraction. Build trust first. |

---

## Summary: The Build Order

```
Week 1–3   Phase 0: Data foundation (sync, import, categorize, dashboard)
Week 4–6   Phase 1: Understanding (custom rules, heatmap, comparisons, projections)
Week 7–10  Phase 2: Control (budgets, goals, carryover, AI roadmap)
Week 11–14 Phase 3: Polish for others (manual entry, CSV, onboarding, export)
Month 4+   Phase 4: Scale (mobile, investments, freemium, family)
```

**The north star metric at each phase:**
- Phase 0: Daily active use (you open it every day)
- Phase 1: An insight you wouldn't have had otherwise
- Phase 2: A financial decision changed because of it
- Phase 3: Someone else uses it and stays
- Phase 4: Revenue
