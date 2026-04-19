# Frontend Review — 2026-04-19

## Executive Summary

The frontend is clean, well-structured, and makes good architectural choices for a personal finance app (Server Components for data-heavy pages, a typed fetch client, repository-style API abstraction). However, there are **three hardcoded `http://localhost:3001` URLs** that will break in any deployment, a **silent data-loss bug** in `BatchStep` where upload failures are undetected and the user gets no feedback, a **stale-closure event listener bug** in the transactions page, and **pervasive `any` typing** across every page. The `localStorage` pattern for salary/leftover is safe functionally but carries a hydration risk and has a key inconsistency between `SettingsPage` and `SpendingSection`. None of these are exploitable security holes in a single-user local app, but several are correctness bugs that will surface in normal use.

---

## 🔴 Critical

### 1. Hardcoded `http://localhost:3001` — three locations

**Files and lines:**
- `src/app/import/page.tsx:18` — `fetch('http://localhost:3001/api/import/batches')`
- `src/app/import/page.tsx:34` — `fetch('http://localhost:3001/api/import/upload', …)`
- `src/components/transaction-modal.tsx:279` — `fetch('http://localhost:3001/api/import/upload', …)`

**What:** Three raw `fetch` calls bypass `src/lib/api.ts` entirely and hardcode the development URL.

**Why it matters:** The app will silently fail on any non-localhost deployment (staging, VPS, Docker host, any future machine). The import page will show an empty batch list and uploads will 404 with no error message (the `catch(() => {})` on the batches fetch swallows all errors silently).

**Fix:** Use the same pattern already in `src/lib/api.ts` and `src/components/sidebar.tsx`:
```ts
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'
```
Then move the upload calls into `api.import.upload(file)` in `api.ts` using a `FormData` POST helper, so all API calls go through one place. Example helper:
```ts
async function postForm<T>(path: string, body: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', body })
  if (!res.ok) throw new Error(`API POST ${path} → ${res.status}`)
  return res.json()
}
```

---

### 2. `BatchStep.handleUpload` swallows all errors — silent data loss

**File:** `src/components/transaction-modal.tsx:274–282`

```ts
async function handleUpload() {
  setUploading(true)
  for (const { file } of files) {
    const fd = new FormData()
    fd.append('file', file)
    await fetch('http://localhost:3001/api/import/upload', { method: 'POST', body: fd })
    // ← no error check on `res.ok`, no try/catch
  }
  setUploading(false)
  onClose()
}
```

**Why it matters:** If a file fails to process (network error, server error, Claude API error), the modal closes silently as if the upload succeeded. The user's bank statement is lost with no warning.

**Fix:**
```ts
async function handleUpload() {
  setUploading(true)
  setError(null)
  try {
    for (const { file } of files) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${BASE}/import/upload`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error(`Failed to process ${file.name}`)
    }
    onClose()
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : 'Upload failed')
  } finally {
    setUploading(false)
  }
}
```
Also add `const [error, setError] = useState<string | null>(null)` and render `{error && <p …>{error}</p>}`.

---

### 3. Stale closure in `transaction-saved` event listener

**File:** `src/app/transactions/page.tsx:72–75`

```ts
useEffect(() => {
  window.addEventListener('transaction-saved', refresh)
  return () => window.removeEventListener('transaction-saved', refresh)
}, [year, month])  // ← refresh is recreated on every render
```

`refresh` is defined as a plain `function` inside the component body (line 103), so it is a new function reference on every render. The `removeEventListener` in the cleanup receives the *new* reference, not the one registered in `addEventListener`, so the old listener is **never removed**. After navigating months, multiple stale `refresh` closures accumulate on `window`, each capturing a different `year`/`month` and triggering redundant API calls.

**Fix:** Wrap `refresh` in `useCallback` with `[year, month]` as dependencies, and list it in the `useEffect` dep array:

```ts
const refresh = useCallback(() => {
  api.transactions.list({ year, month, perPage: 1000 })
    .then(r => setAllItems(r.items))
    .catch(() => {})
}, [year, month])

useEffect(() => {
  window.addEventListener('transaction-saved', refresh)
  return () => window.removeEventListener('transaction-saved', refresh)
}, [refresh])
```

---

## 🟡 Medium

### 4. `localStorage` salary key inconsistency — Settings and SpendingSection are out of sync

**Files:**
- `src/app/settings/page.tsx:12` — reads/writes `'finance_salary'` (global key)
- `src/components/spending-section.tsx:38` — reads `SALARY_KEY` (`finance_salary_${year}_${month}`) then falls back to `'finance_salary'`, but **writes only to** `SALARY_KEY`

**What:** When the user edits salary in the dashboard spending chart, it is stored under the per-month key. When they edit it in Settings, it is stored under the global key. The fallback read chain means changes in one place may not appear in the other. A user saving £4000 on the Settings page will not see it reflected in a month that already has a per-month key set.

**Fix:** Decide on one canonical key. If per-month overrides are a feature, document it clearly and make the Settings page respect/display this relationship. If it is not intentional, use only `'finance_salary'` everywhere and remove the per-month key.

---

### 5. `localStorage` hydration risk in `SpendingSection`

**File:** `src/components/spending-section.tsx:37–42`

`SpendingSection` is a `'use client'` component rendered *inside* a Server Component (`DashboardPage`). The component initialises `salary` state to `0` (before the `useEffect` fires) and the UI renders `£0/mo` on the server, then jumps to the stored value on the client. This will produce a React hydration warning if Next.js attempts to reconcile the initial server render with the client output.

**Why it matters:** Hydration mismatches in Next.js 14 are logged as warnings in dev and can cause visible flicker or lost interactivity in production. Since `localStorage` is client-only, the correct pattern is to suppress hydration or handle the mismatch explicitly.

**Fix:** Use `suppressHydrationWarning` on the wrapping element, or initialise salary state with a function that returns `0` (which it already does) but ensure no server render depends on `localStorage` — the component is already `'use client'` so this is fine as long as the initial `0` render is acceptable. Alternatively, add a mounted guard:
```ts
const [mounted, setMounted] = useState(false)
useEffect(() => setMounted(true), [])
if (!mounted) return null // or a skeleton
```

---

### 6. Missing `await` on `toggleIncome` API call — optimistic update with no error recovery

**File:** `src/components/batch-review-client.tsx:56–65`

```ts
function toggleIncome(id: string) {
  // ...
  api.import.updateTransaction(id, { … })  // ← not awaited, not in try/catch
  setItems(prev => prev.map(…))            // ← optimistic update runs regardless
}
```

`toggleIncome` is not `async` and does not await or handle the API call. If the PATCH fails (network error, server error), the UI shows the toggled state but the database has the old value. On next page load, the item reverts unexpectedly. This is a silent data inconsistency bug.

**Fix:**
```ts
async function toggleIncome(id: string) {
  // ... compute newAmount
  try {
    await api.import.updateTransaction(id, { … })
    setItems(prev => prev.map(…))
  } catch {
    // optionally show an error toast
  }
}
```

---

### 7. Delete transaction has no confirmation prompt

**File:** `src/app/transactions/page.tsx:393–400`

```tsx
<button onClick={async () => {
  await api.transactions.remove(tx.id)
  setAllItems(prev => prev.filter(t => t.id !== tx.id))
}}>
```

A single click permanently deletes a real financial transaction with no "Are you sure?" guard. The delete on `batch-review-client.tsx:50–52` has the same issue. For financial data, irreversible actions should require a confirmation.

**Fix:** Add a `window.confirm('Delete this transaction?')` guard, or better, use a small inline confirmation state (show a red "Confirm delete" button that replaces the trash icon for 3 seconds).

---

### 8. Transactions page fetches up to 1,000 rows client-side

**File:** `src/app/transactions/page.tsx:80`

```ts
api.transactions.list({ year, month, perPage: 1000 })
```

All filtering, searching, and pagination happen in-browser after downloading up to 1,000 transaction objects. The backend already supports `search`, `categoryId`, `page`, and `perPage` parameters, making client-side filtering redundant for most use cases.

**Why it matters:** For a personal finance app this is acceptable at current scale, but it is wasteful of bandwidth and memory, and will break down noticeably if a month has hundreds of transactions (bank statement imports accumulate quickly). The bigger problem is that any change to filters doesn't fire a new API request — it just re-slices the already-fetched list, so the `search`, `catFilter`, `amountMin`, `amountMax` filters only work within the already-fetched 1,000 rows.

**Fix (medium-term):** Move filtering back to the server. Pass `search`, `categoryId`, and amount params to the API, and restore proper server-side pagination. The filters should update the URL query params (via `router.replace`) so the page is bookmarkable and refresh-safe.

---

### 9. `ManualStep` uses `useState` as an initialiser callback incorrectly

**File:** `src/components/transaction-modal.tsx:107`

```ts
useState(() => { api.categories.list().then(setCategories) })
```

`useState` does not accept a promise-returning function as a side effect. The initialiser is called synchronously during render to get the initial state value — but here it is being misused to trigger a side effect. While this will *happen* to work (React calls the initialiser once and ignores the return value), it is semantically wrong, will fire during SSR in some configurations, and could cause issues if React ever enforces this in strict mode. It also fires the effect during render rather than after mount, which can cause double-fetching in React's StrictMode double-invoke.

**Fix:** Replace with `useEffect`:
```ts
useEffect(() => {
  api.categories.list().then(setCategories).catch(() => {})
}, [])
```

---

### 10. `saveEdit` in `batch-review-client.tsx` always saves amount as negative

**File:** `src/components/batch-review-client.tsx:72`

```ts
rawAmount: -Math.abs(Number(d.rawAmount)),
```

When editing an item in the batch review table, the amount is always saved as negative (expense), regardless of the `isIncome` toggle visible during edit. If a user starts editing an income item and hits save, the server stores it as an expense. The `isIncome` field is captured in `startEdit` (line 45) but is never used when constructing the PATCH body.

**Fix:**
```ts
rawAmount: d.isIncome
  ? Math.abs(Number(d.rawAmount))
  : -Math.abs(Number(d.rawAmount)),
```

---

### 11. `CategoryPill` colour injection without sanitisation — minor XSS surface

**File:** `src/app/dashboard/page.tsx:10`, `src/app/transactions/page.tsx:30`, `src/components/batch-review-client.tsx:11`

```tsx
style={{ background: color + '22', color }}
```

The `color` value comes directly from the API response and is injected into inline CSS. If the backend ever returns a crafted value like `'); expression(alert(1))` (old IE) or simply a non-colour string, it would break the layout or — in very old browsers — execute code. Modern browsers are not vulnerable to CSS expression injection, but invalid data will produce broken styles silently.

**Why it matters:** Low risk in modern browsers, but the data is never validated on the client. A backend bug or future SQL injection that corrupts category colors could silently break the UI.

**Fix:** Validate that `color` is a valid hex colour before use:
```ts
function safeColor(color: string, fallback = '#6b7280') {
  return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : fallback
}
```

---

## 🟢 Low / Improvements

### 12. Pervasive `any` typing reduces type safety

**Affected files:** Nearly every file. Worst offenders:
- `src/lib/api.ts:45,50,53,55,59,60,62,64,71,72` — all return types are `any` or `any[]`
- `src/app/dashboard/page.tsx:73,81,83` — `(m: any)`, `prevByCat: any[]`, `(p: any)`
- `src/app/transactions/page.tsx:58,59,87,88` — `allItems: any[]`, `editData: Record<string, any>`
- `src/components/batch-review-client.tsx:24,26` — `batch: any`, `items: any[]`

**Fix:** Define interfaces for the core domain objects. A good starting point:
```ts
// src/lib/types.ts
export interface Transaction { id: string; date: string; description: string; amount: number; source: 'manual' | 'pdf' | 'photo'; category: Category | null }
export interface Category { id: string; name: string; color: string; rules: Rule[]; _count: { transactions: number } }
export interface ImportBatch { id: string; filename: string; uploadedAt: string; imported: ImportedTransaction[] }
```
Then update `api.ts` to use generics: `get<Transaction[]>('/transactions', …)`.

---

### 13. `isActive` routing logic has an unreachable case

**File:** `src/components/sidebar.tsx:59–63`

```ts
function isActive(href: string, label: string) {
  if (href === '/import/inbox') return pathname.startsWith('/import/inbox') || pathname.startsWith('/import/batch')
  if (href === '/import')      return pathname === '/import'
  return pathname.startsWith(href)
}
```

`label` is accepted as a parameter but never used — it is dead code. More importantly, the catch-all `pathname.startsWith(href)` will make `/dashboard` active when on `/dashboard/anything` (not a current route, but fragile). Also, `/import/inbox` active check includes `/import/batch` but the actual batch route is `/import/[batchId]`, so the active state for "Import Inbox" will never highlight on a batch review page.

**Fix:**
```ts
function isActive(href: string) {
  if (href === '/import/inbox') return pathname.startsWith('/import/inbox') || /^\/import\/[^/]+$/.test(pathname)
  if (href === '/import')      return pathname === '/import'
  if (href === '/dashboard')   return pathname === '/dashboard'
  return pathname.startsWith(href)
}
```
Remove the unused `label` parameter from the signature.

---

### 14. Dashboard `any` casts on `monthlyTotals.find`

**File:** `src/app/dashboard/page.tsx:73–75`

```ts
const prevTotal = monthlyTotals.find((m: any) => {
  return m.year === prevYear && m.month === prevMonth
})?.total ?? 0
```

`monthlyTotals` comes from `api.dashboard.summary` which is typed as `{ summary: any; byCategory: any[]; monthlyTotals: any[] }`. The `any` type means TypeScript cannot catch if the API ever changes the shape of `monthlyTotals`. This is the most load-bearing computation on the dashboard (it drives the delta calculation shown to the user).

---

### 15. No `aria-label` on icon-only buttons

**Files:** `src/app/transactions/page.tsx:388–401`, `src/components/batch-review-client.tsx:258–269`

Edit, delete, save, cancel, and type-toggle buttons contain only icons with no accessible labels. The `title` attribute (present on some buttons) is not a substitute for `aria-label` — screen readers and keyboard-only users cannot identify these controls.

**Fix:** Add `aria-label` to every icon-only button:
```tsx
<button aria-label="Edit transaction" title="Edit" …>
  <Pencil size={13} />
</button>
```

---

### 16. `format(new Date(tx.date), …)` is timezone-sensitive

**Files:** `src/app/dashboard/page.tsx:204`, `src/app/transactions/page.tsx:305`

`new Date('2024-01-15')` (ISO date string without time) is parsed as UTC midnight. `format()` from `date-fns` formats using the local timezone. In timezones west of UTC (US, etc.), this renders the date as the day before. For a UK user this is not a current problem, but it would affect any exported data or if the app is ever used in another timezone.

**Fix:** Use `parseISO` from `date-fns` which correctly handles ISO date-only strings:
```ts
import { parseISO } from 'date-fns'
format(parseISO(tx.date), 'd MMM yyyy')
```

---

### 17. `Number(params.year ?? now.getFullYear())` passes on NaN for invalid inputs

**File:** `src/app/dashboard/page.tsx:59–60`

```ts
const year  = Number(params.year  ?? now.getFullYear())
const month = Number(params.month ?? now.getMonth() + 1)
```

If a user navigates to `/dashboard?year=abc&month=foo`, `Number('abc')` is `NaN`. `NaN` is then passed to `api.dashboard.summary(NaN, NaN)` and to `format(new Date(NaN, NaN - 1), …)` which throws an uncaught `RangeError` that will cause the page to crash with a Next.js 500 error.

**Fix:**
```ts
const rawYear  = Number(params.year)
const rawMonth = Number(params.month)
const year  = Number.isFinite(rawYear)  && rawYear  > 2000 && rawYear  < 2100 ? rawYear  : now.getFullYear()
const month = Number.isFinite(rawMonth) && rawMonth >= 1   && rawMonth <= 12  ? rawMonth : now.getMonth() + 1
```

---

### 18. `categories.list()` fetch error is silently ignored in `ManualStep`

**File:** `src/components/transaction-modal.tsx:107`

```ts
useState(() => { api.categories.list().then(setCategories) })
```

No `.catch()` — if the categories API call fails, the category dropdown silently remains empty. The user can still save the transaction but cannot categorise it.

---

### 19. `spending-section.tsx` — `SALARY_KEY` and `LEFTOVER_KEY` are computed inside the component but used as `useEffect` dependencies as strings

**File:** `src/components/spending-section.tsx:23–24`

```ts
const SALARY_KEY = `finance_salary_${year}_${month}`
const LEFTOVER_KEY = `finance_leftover_${year}_${month}`
```

These are computed on every render and used as `useEffect` deps (lines 37, 44). This works correctly because string equality is compared, but ESLint will flag them as non-stable references. Moving them to `useMemo` or using the template literal directly in the deps array is cleaner:
```ts
useEffect(() => {
  const stored = localStorage.getItem(`finance_salary_${year}_${month}`) ?? …
}, [year, month])
```

---

### 20. `handleConfirm` and `handleDiscard` have no error handling

**File:** `src/components/batch-review-client.tsx:98–108`

```ts
async function handleConfirm() {
  setLoading(true)
  await api.import.confirm(batch.id)
  router.push('/import/inbox')
}
```

If `confirm` or `discard` fails, `loading` stays `true` forever (the button stays disabled), and no error is shown. The user's only option is to refresh the page.

**Fix:**
```ts
async function handleConfirm() {
  setLoading(true)
  try {
    await api.import.confirm(batch.id)
    router.push('/import/inbox')
  } catch {
    setLoading(false)
    // show error
  }
}
```

---

### 21. Personal email address hardcoded in sidebar

**File:** `src/components/sidebar.tsx:164`

```tsx
<p className="text-xs truncate" style={{ color: 'var(--text-2)' }}>math.albuquerque97@gmail.com</p>
```

The email is hardcoded in the component. Since this is a personal single-user app, this is not a security issue, but it means the sidebar must be edited if the email ever changes. It would be better read from an env var or a config file, and it is worth noting that this email appears in all built JavaScript bundles.

---

## ✅ What's done well

- **Server Components used correctly.** `DashboardPage`, `ImportInboxPage`, and `BatchReviewPage` are Server Components that await data before rendering. The client/server boundary is correctly placed at `BatchReviewClient`. This is the right pattern for Next.js 14.

- **`api.ts` has a consistent pattern.** The typed generic `get<T>`, `post<T>`, `patch<T>`, `del<T>` helpers with a single `BASE` env-var fallback are clean. Error handling (throw on `!res.ok`) propagates to callers correctly for the three functions that use it. `cache: 'no-store'` is correct for financial data.

- **Environment variable used in `api.ts` and `sidebar.tsx`.** `process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'` is the right pattern — the failures in `import/page.tsx` and `transaction-modal.tsx` are inconsistencies against an otherwise good baseline.

- **Loading and error states handled in the main pages.** `TransactionsPage` and `CategoriesPage` both have `isLoading` skeletons and `error` states rendered to the user.

- **`useDropzone` MIME-type constraints.** The dropzone in both `ImportPage` and `BatchStep` correctly restricts accepted types to PDF and image formats using proper MIME types with extension fallbacks.

- **`Promise.all` for parallel data fetching on the dashboard.** Three API calls are fired concurrently rather than in sequence, avoiding a request waterfall on the most data-heavy page.

- **`notFound()` for missing batches.** `BatchReviewPage` correctly calls Next.js `notFound()` when the API throws, giving a proper 404 rather than a crash.

- **Design token system is well-structured.** CSS custom properties (`var(--text)`, `var(--accent)`, etc.) are used consistently for theming. The `design-tokens.ts` file provides typed constants for chart colours where CSS variables cannot be used (Recharts).

- **`Suspense` wrapper on `TransactionsPage`.** Wrapping `useSearchParams()` in `Suspense` is required in Next.js 14 and correctly applied.

---

## Recommended Next Steps (prioritised)

| Priority | Fix | File(s) | Effort |
|---|---|---|---|
| 1 | Fix hardcoded `localhost:3001` URLs — move upload into `api.ts` | `import/page.tsx`, `transaction-modal.tsx` | 30 min |
| 2 | Add error handling to `BatchStep.handleUpload` | `transaction-modal.tsx` | 15 min |
| 3 | Fix stale-closure event listener with `useCallback` | `transactions/page.tsx` | 10 min |
| 4 | Fix `saveEdit` always saving negative amount | `batch-review-client.tsx:72` | 5 min |
| 5 | Await `toggleIncome` API call + add error recovery | `batch-review-client.tsx` | 15 min |
| 6 | Add error handling to `handleConfirm`/`handleDiscard` | `batch-review-client.tsx` | 10 min |
| 7 | Validate `year`/`month` query params before use | `dashboard/page.tsx` | 15 min |
| 8 | Add confirmation prompt before delete | `transactions/page.tsx`, `batch-review-client.tsx` | 20 min |
| 9 | Fix `ManualStep` — replace misused `useState` with `useEffect` | `transaction-modal.tsx:107` | 5 min |
| 10 | Resolve salary key inconsistency between Settings and SpendingSection | `settings/page.tsx`, `spending-section.tsx` | 20 min |
| 11 | Add `aria-label` to all icon-only buttons | `transactions/page.tsx`, `batch-review-client.tsx` | 20 min |
| 12 | Type the API responses — replace `any[]` with domain interfaces | `api.ts` + all pages | 2–3 hours |
| 13 | Replace `new Date(tx.date)` with `parseISO(tx.date)` | `dashboard/page.tsx`, `transactions/page.tsx` | 10 min |
| 14 | Move client-side filtering to server-side query params | `transactions/page.tsx` | 1–2 hours |
