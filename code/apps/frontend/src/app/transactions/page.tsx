'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { ChevronLeft, ChevronRight, Search, Pencil, ChevronDown, Check, X, Trash2, Eye, EyeOff } from 'lucide-react'
import { useCurrency } from '@/hooks/useCurrency'
import { CurrencyAmount } from '@/components/currency-amount'
import { CategoryPill } from '@/components/ui/category-pill'
import { SourcePill } from '@/components/ui/source-pill'
const PER_PAGE_OPTIONS = [10, 20, 50]

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsContent />
    </Suspense>
  )
}

function TransactionsContent() {
  const [currency] = useCurrency()
  const searchParams = useSearchParams()
  const now = new Date()
  const [year, setYear] = useState(() => Number(searchParams.get('year') ?? now.getFullYear()))
  const [month, setMonth] = useState(() => Number(searchParams.get('month') ?? now.getMonth() + 1))
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [allItems, setAllItems] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [allTime, setAllTime] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('')
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [bulkSaving, setBulkSaving] = useState(false)

  const prevMonth = month === 1  ? 12 : month - 1
  const prevYear  = month === 1  ? year - 1 : year
  const nextMonth = month === 12 ? 1  : month + 1
  const nextYear  = month === 12 ? year + 1 : year

  const monthLabel = format(new Date(year, month - 1), 'MMMM yyyy')
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

  useEffect(() => { api.categories.list().then(setCategories).catch(() => {}) }, [])

  const refresh = useCallback(() => {
    api.transactions.list(allTime ? { perPage: 1000 } : { year, month, perPage: 1000 })
      .then(r => setAllItems(r.items))
      .catch(() => {})
  }, [year, month, allTime])

  useEffect(() => {
    window.addEventListener('transaction-saved', refresh)
    return () => window.removeEventListener('transaction-saved', refresh)
  }, [refresh])

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    setSelectedIds(new Set())
    setBulkCategoryId('')
    setBulkError(null)
    api.transactions.list(allTime ? { perPage: 1000 } : { year, month, perPage: 1000 })
      .then(r => setAllItems(r.items))
      .catch(() => setError('Failed to load transactions'))
      .finally(() => setIsLoading(false))
  }, [year, month, allTime])

  useEffect(() => {
    if (allTime) { setPredicted([]); return }
    api.recurring.upcoming(year, month).then(setPredicted).catch(() => {})
  }, [year, month, allTime])

  const [showPredicted, setShowPredicted] = useState(true)
  const [predicted, setPredicted] = useState<any[]>([])
  const [confirmItem, setConfirmItem] = useState<any | null>(null)
  const [confirmDate, setConfirmDate] = useState('')
  const [confirmAmount, setConfirmAmount] = useState('')
  const [confirmSaving, setConfirmSaving] = useState(false)

  const [editing, setEditing] = useState<string | null>(null)
  const [editData, setEditData] = useState<Record<string, any>>({})

  useEffect(() => {
    if (!showExportMenu) return
    const close = () => setShowExportMenu(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [showExportMenu])

  const filteredItems = allItems.filter(tx => {
    if (search && !tx.description.toLowerCase().includes(search.toLowerCase())) return false
    if (catFilter === 'uncategorized' && tx.category !== null) return false
    if (catFilter && catFilter !== 'uncategorized' && tx.category?.id !== catFilter) return false
    const abs = Math.abs(Number(tx.amount))
    if (amountMin !== '' && abs < Number(amountMin)) return false
    if (amountMax !== '' && abs > Number(amountMax)) return false
    return true
  })

  const predictedRows = showPredicted && !allTime
    ? predicted
        .filter(p => {
          if (search && !p.description.toLowerCase().includes(search.toLowerCase())) return false
          if (catFilter && catFilter !== 'uncategorized' && p.categoryId !== catFilter) return false
          return true
        })
        .map(p => ({
          ...p,
          id: `predicted_${p.patternId}`,
          _predicted: true,
          date: new Date(year, month - 1, p.expectedDay).toISOString(),
          amount: p.typicalAmount,
          category: p.categoryId ? { id: p.categoryId, name: p.categoryName, color: p.categoryColor } : null,
          source: 'predicted' as const,
        }))
    : []

  const mergedItems = [...filteredItems, ...predictedRows].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  const total = mergedItems.length
  const totalPages = Math.ceil(total / perPage) || 1
  const pageItems = mergedItems.slice((page - 1) * perPage, page * perPage)

  function startEdit(tx: any) {
    setEditData(prev => ({
      ...prev,
      [tx.id]: {
        description: tx.description,
        date: tx.date.split('T')[0],
        amount: Math.abs(Number(tx.amount)).toFixed(2),
        categoryId: tx.category?.id ?? '',
        isIncome: Number(tx.amount) > 0,
        notes: tx.notes ?? '',
      },
    }))
    setEditing(tx.id)
  }

  async function saveEdit(id: string) {
    const d = editData[id]
    await api.transactions.update(id, {
      description: d.description,
      date: d.date,
      amount: d.isIncome ? Math.abs(Number(d.amount)) : -Math.abs(Number(d.amount)),
      categoryId: d.isIncome ? undefined : (d.categoryId || undefined),
      notes: d.notes?.trim() === '' ? null : (d.notes?.trim() ?? null),
    })
    setEditing(null)
    refresh()
  }

  function updateField(id: string, patch: object) {
    setEditData(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  function nav(y: number, m: number) {
    setYear(y); setMonth(m); setPage(1)
  }

  function pageNums() {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    if (page <= 4) return [1, 2, 3, 4, 5, '...', totalPages]
    if (page >= totalPages - 3) return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    return [1, '...', page - 1, page, page + 1, '...', totalPages]
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <h1 className="hidden flex-1 text-xl font-semibold text-text md:block">
          All Transactions
        </h1>

        {/* Month navigator — hidden in all-time mode */}
        <div className="flex flex-wrap items-center gap-2 md:ml-auto">
          {allTime ? (
            <span className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text">
              All time
            </span>
          ) : (
            <>
              <button onClick={() => nav(prevYear, prevMonth)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface">
                <ChevronLeft size={16} className="text-text-2" />
              </button>
              <span className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text">
                {monthLabel}
              </span>
              <button onClick={() => nav(nextYear, nextMonth)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface">
                <ChevronRight size={16} className="text-text-2" />
              </button>
            </>
          )}

          {/* Export dropdown */}
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowExportMenu(v => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-border-2 bg-surface-2 px-3 py-2 text-xs font-medium text-text-2"
            >
              Export
              <ChevronDown size={10} />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-lg border border-border-2 bg-surface-2 shadow-xl">
                <a
                  href={(() => {
                    const p = new URLSearchParams()
                    if (!allTime) { p.set('year', String(year)); p.set('month', String(month)) }
                    if (search) p.set('search', search)
                    if (catFilter && catFilter !== 'uncategorized') p.set('categoryId', catFilter)
                    p.set('scope', 'filtered')
                    return `${BASE_URL}/transactions/export?${p.toString()}`
                  })()}
                  download
                  onClick={() => setShowExportMenu(false)}
                  className="flex items-center px-3 py-2.5 text-xs text-text transition-colors hover:bg-white/5"
                >
                  Export current view
                </a>

                {allTime ? (
                  <span className="flex cursor-not-allowed items-center px-3 py-2.5 text-xs text-text-3">
                    Export entire month
                  </span>
                ) : (
                  <a
                    href={`${BASE_URL}/transactions/export?year=${year}&month=${month}&scope=month`}
                    download
                    onClick={() => setShowExportMenu(false)}
                    className="flex items-center px-3 py-2.5 text-xs text-text transition-colors hover:bg-white/5"
                  >
                    Export entire month
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main card */}
      <div className="rounded-xl overflow-hidden bg-surface border border-border">
        {/* Filters */}
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2 flex-1 rounded-lg px-3 py-2 bg-surface-2 border border-border">
            <Search size={14} className="text-text-2" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search transactions…"
              className="flex-1 bg-transparent text-sm outline-none text-text"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={catFilter}
              onChange={e => { setCatFilter(e.target.value); setPage(1) }}
              className={cn('rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none', catFilter ? 'text-text' : 'text-text-2')}
            >
              <option value="">All categories</option>
              <option value="uncategorized">No category</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Amount range */}
            <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm">
              <span className="text-text-2">{currency}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amountMin}
                onChange={e => { setAmountMin(e.target.value); setPage(1) }}
                placeholder="min"
                className="w-14 min-w-0 bg-transparent text-sm text-text outline-none"
              />
              <span className="text-text-3">–</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amountMax}
                onChange={e => { setAmountMax(e.target.value); setPage(1) }}
                placeholder="max"
                className="w-14 min-w-0 bg-transparent text-sm text-text outline-none"
              />
            </div>

            {predicted.length > 0 && (
              <button
                onClick={() => setShowPredicted(p => !p)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                style={{
                  background: showPredicted ? '#818cf822' : 'transparent',
                  border: `1px solid ${showPredicted ? '#818cf860' : 'var(--border)'}`,
                  color: showPredicted ? '#818cf8' : 'var(--text-3)',
                  boxShadow: showPredicted ? '0 0 0 1px #818cf820 inset' : 'none',
                }}
              >
                {showPredicted ? <Eye size={12} /> : <EyeOff size={12} />}
                Predicted
                <span
                  className="ml-0.5 rounded px-1.5 py-0.5 text-xs font-bold"
                  style={{
                    background: showPredicted ? '#818cf830' : 'var(--surface-2)',
                    color: showPredicted ? '#818cf8' : 'var(--text-3)',
                  }}
                >
                  {predicted.length}
                </span>
              </button>
            )}

            <button
              onClick={() => { setAllTime(v => !v); setPage(1) }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: allTime ? '#f59e0b18' : 'var(--surface)',
                border:     `1px solid ${allTime ? '#f59e0b44' : 'var(--border)'}`,
                color:      allTime ? 'var(--accent)' : 'var(--text-2)',
              }}
            >
              {allTime ? 'All time' : 'This month'}
            </button>

            <span className="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-accent">
              {total} transactions
            </span>
          </div>
        </div>

        <div className="md:hidden">
          {error ? (
            <p className="py-12 text-center text-sm text-text-3">{error}</p>
          ) : isLoading ? (
            <div className="space-y-3 px-4 py-4">
              {[0, 1, 2].map(i => (
                <div key={i} className="animate-pulse rounded-xl border border-border bg-surface-2 px-4 py-4">
                  <div className="mb-3 h-4 w-2/3 rounded bg-surface" />
                  <div className="mb-2 h-3 w-1/3 rounded bg-surface" />
                  <div className="h-6 w-24 rounded-full bg-surface" />
                </div>
              ))}
            </div>
          ) : pageItems.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-3">No transactions found</p>
          ) : (
            <div className="space-y-3 px-4 py-4">
              {pageItems.map(tx => {
                if (tx._predicted) {
                  return (
                    <div
                      key={tx.id}
                      className="rounded-xl border px-4 py-3"
                      style={{ background: '#818cf80a', borderColor: '#818cf840' }}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-text">{tx.description}</p>
                          <p className="mt-1 text-xs" style={{ color: '#818cf8' }}>
                            ~{format(new Date(year, month - 1, tx.expectedDay), 'd MMM')} · predicted recurring
                          </p>
                        </div>
                        <p className="text-sm font-semibold tabular-nums" style={{ color: '#818cf8' }}>
                          <CurrencyAmount amount={Math.abs(Number(tx.amount))} />
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide" style={{ background: '#818cf818', color: '#818cf8' }}>
                          predicted
                        </span>
                        {tx.category
                          ? <CategoryPill name={tx.category.name} color={tx.category.color} />
                          : <span className="text-xs text-text-3">No category</span>}
                      </div>

                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => {
                            setConfirmItem(tx)
                            setConfirmDate(`${year}-${String(month).padStart(2, '0')}-${String(tx.expectedDay).padStart(2, '0')}`)
                            setConfirmAmount(Math.abs(tx.typicalAmount).toFixed(2))
                          }}
                          className="flex-1 rounded-lg px-3 py-2 text-sm font-semibold"
                          style={{ background: '#22c55e20', color: '#22c55e' }}
                        >
                          Confirm
                        </button>
                        <button
                          onClick={async () => {
                            await api.recurring.dismissPattern(tx.patternId)
                            setPredicted(prev => prev.filter(p => p.patternId !== tx.patternId))
                          }}
                          className="flex-1 rounded-lg border border-border px-3 py-2 text-sm text-text-2"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )
                }

                const isEditing = editing === tx.id
                const ed = editData[tx.id] ?? {}

                return (
                  <div key={tx.id} className={cn('rounded-xl border border-border bg-surface-2 px-4 py-3', isEditing && 'bg-surface')}>
                    {isEditing ? (
                      <div className="space-y-3">
                        <input type="date" value={ed.date}
                          onChange={e => updateField(tx.id, { date: e.target.value })}
                          className="w-full rounded-md border border-border-2 bg-surface px-3 py-2 text-sm text-text outline-none"
                          style={{ colorScheme: 'dark' }} />
                        <input value={ed.description}
                          onChange={e => updateField(tx.id, { description: e.target.value })}
                          className="w-full rounded-md border border-border-2 bg-surface px-3 py-2 text-sm text-text outline-none" />
                        {ed.isIncome ? (
                          <span className="text-sm text-green">Income</span>
                        ) : (
                          <select value={ed.categoryId}
                            onChange={e => updateField(tx.id, { categoryId: e.target.value })}
                            className="w-full rounded-md border border-border-2 bg-surface px-3 py-2 text-sm text-text outline-none">
                            <option value="">— none —</option>
                            {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        )}
                        <button
                          onClick={() => updateField(tx.id, { isIncome: !ed.isIncome })}
                          className="rounded-md px-3 py-2 text-sm font-medium"
                          style={{
                            background: ed.isIncome ? '#4ade8022' : 'var(--surface)',
                            color: ed.isIncome ? '#4ade80' : 'var(--text-2)',
                            border: `1px solid ${ed.isIncome ? '#4ade8066' : 'var(--border-2)'}`,
                          }}
                        >
                          {ed.isIncome ? 'Income' : 'Spending'}
                        </button>
                        <div className="flex items-center gap-2 rounded-md border border-border-2 bg-surface px-3 py-2">
                          <span className="text-sm text-text-2">{currency}</span>
                          <input type="number" step="0.01" value={ed.amount}
                            onChange={e => updateField(tx.id, { amount: e.target.value })}
                            className={cn('w-full bg-transparent text-sm outline-none', ed.isIncome ? 'text-green' : 'text-text')} />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit(tx.id)} className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-bg">
                            Save
                          </button>
                          <button onClick={() => setEditing(null)} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm text-text-2">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <input
                              type="checkbox"
                              style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                              checked={selectedIds.has(tx.id)}
                              onChange={e => {
                                setSelectedIds(prev => {
                                  const next = new Set(prev)
                                  if (e.target.checked) next.add(tx.id)
                                  else next.delete(tx.id)
                                  return next
                                })
                              }}
                              className="mt-1"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-text">{tx.description}</p>
                              <p className="text-xs text-text-2">{format(new Date(tx.date), 'd MMM yyyy')}</p>
                            </div>
                          </div>
                          <span className={cn('text-right text-sm font-medium tabular-nums', Number(tx.amount) > 0 ? 'text-green' : 'text-text')}>
                            {Number(tx.amount) > 0 ? '+' : ''}{currency}{Math.abs(Number(tx.amount)).toFixed(2)}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {tx.category
                            ? <CategoryPill name={tx.category.name} color={tx.category.color} />
                            : <span className="text-xs text-text-3">No category</span>}
                          <SourcePill source={tx.source} />
                        </div>

                        <div className="mt-3 flex justify-end gap-2">
                          <button onClick={() => startEdit(tx)} className="rounded-lg border border-border px-3 py-2 text-sm text-text-2">
                            Edit
                          </button>
                          <button onClick={async () => {
                            if (!window.confirm('Delete this transaction? This cannot be undone.')) return
                            await api.transactions.remove(tx.id)
                            setAllItems(prev => prev.filter(t => t.id !== tx.id))
                          }} className="rounded-lg border border-red/40 px-3 py-2 text-sm text-red">
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {!error && !isLoading && total > 0 && (
            <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
              <span className="text-xs text-text-2">
                Showing {total === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
              </span>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2.5 py-1 text-xs">
                  <span className="text-text-2">Show</span>
                  <select
                    value={perPage}
                    onChange={e => { setPerPage(Number(e.target.value)); setPage(1) }}
                    className="ml-1 appearance-none bg-transparent text-xs text-text outline-none"
                  >
                    {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <ChevronDown size={10} className="text-text-2" />
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    {page > 1 && (
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} className="flex h-7 w-7 items-center justify-center rounded-md text-xs text-text-2">
                        ‹
                      </button>
                    )}
                    <span className="text-xs text-text-2">{page}/{totalPages}</span>
                    {page < totalPages && (
                      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="flex h-7 w-7 items-center justify-center rounded-md text-xs text-text-2">
                        ›
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="hidden md:block">
          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
        {/* Table header */}
        <div
          className="grid border-b border-border px-5 py-2.5 text-xs font-medium uppercase tracking-wider text-text-2"
          style={{ gridTemplateColumns: '32px 110px 1fr 180px 90px 130px 48px' }}
        >
          <div className="flex items-center">
            <input
              type="checkbox"
              style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
              checked={
                pageItems.filter(i => !i._predicted).length > 0 &&
                pageItems.filter(i => !i._predicted).every(i => selectedIds.has(i.id))
              }
              ref={el => {
                if (el) el.indeterminate =
                  pageItems.filter(i => !i._predicted).some(i => selectedIds.has(i.id)) &&
                  !pageItems.filter(i => !i._predicted).every(i => selectedIds.has(i.id))
              }}
              onChange={e => {
                const realIds = pageItems.filter(i => !i._predicted).map(i => i.id)
                if (e.target.checked) {
                  setSelectedIds(prev => new Set([...prev, ...realIds]))
                } else {
                  setSelectedIds(prev => {
                    const next = new Set(prev)
                    realIds.forEach(id => next.delete(id))
                    return next
                  })
                }
              }}
            />
          </div>
          <span>Date</span>
          <span>Description</span>
          <span>Category</span>
          <span>Source</span>
          <span className="text-right">Amount</span>
          <span />
        </div>

        {/* Rows */}
        {error ? (
          <p className="py-12 text-center text-sm text-text-3">{error}</p>
        ) : isLoading ? (
          <div className="animate-pulse">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-4 border-b border-border px-5 py-3">
                <div className="h-3 w-20 rounded bg-surface-2" />
                <div className="h-3 flex-1 rounded bg-surface-2" />
                <div className="h-5 w-24 rounded-full bg-surface-2" />
                <div className="h-5 w-14 rounded-full bg-surface-2" />
                <div className="ml-auto h-3 w-16 rounded bg-surface-2" />
              </div>
            ))}
          </div>
        ) : pageItems.length === 0 ? (
          <p className="py-12 text-center text-sm text-text-3">No transactions found</p>
        ) : (
          pageItems.map(tx => {
            if (tx._predicted) {
              return (
                <div
                  key={tx.id}
                  className="grid items-center px-5 py-3"
                  style={{
                    gridTemplateColumns: '32px 110px 1fr 180px 90px 130px 48px',
                    background: '#818cf80a',
                    borderBottom: '1px solid #818cf820',
                  }}
                >
                  <div />
                  <span className="text-xs" style={{ color: '#818cf8', opacity: 0.8 }}>
                    ~{format(new Date(year, month - 1, tx.expectedDay), 'd MMM')}
                  </span>
                  <span className="truncate pr-4 text-sm text-text-2">{tx.description}</span>
                  <div className="pr-4">
                    {tx.category
                      ? <CategoryPill name={tx.category.name} color={tx.category.color} />
                      : <span className="text-text-3">—</span>}
                  </div>
                  <span
                    className="rounded px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide"
                    style={{ background: '#818cf818', color: '#818cf8', letterSpacing: '0.05em' }}
                  >
                    predicted
                  </span>
                  <span className="text-right text-sm font-medium tabular-nums" style={{ color: '#818cf8', opacity: 0.8 }}>
                    <CurrencyAmount amount={Math.abs(Number(tx.amount))} />
                  </span>
                  <div className="flex justify-end gap-2 px-2">
                    <button
                      onClick={() => {
                        setConfirmItem(tx)
                        setConfirmDate(`${year}-${String(month).padStart(2, '0')}-${String(tx.expectedDay).padStart(2, '0')}`)
                        setConfirmAmount(Math.abs(tx.typicalAmount).toFixed(2))
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold"
                      style={{ background: '#22c55e20', color: '#22c55e' }}
                      title="Confirm transaction"
                    >
                      ✓
                    </button>
                    <button
                      onClick={async () => {
                        await api.recurring.dismissPattern(tx.patternId)
                        setPredicted(prev => prev.filter(p => p.patternId !== tx.patternId))
                      }}
                      className="ml-1 flex h-7 w-7 items-center justify-center rounded-md bg-surface-2 text-sm text-text-2"
                      title="Remove recurring"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            }

            const isEditing = editing === tx.id
            const ed = editData[tx.id] ?? {}
            return (
            <div
              key={tx.id}
              className={cn('grid items-center px-5 py-3 border-b border-border', isEditing && 'bg-surface-2')}
              style={{ gridTemplateColumns: '32px 110px 1fr 180px 90px 130px 48px' }}
            >
              {/* Checkbox */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                  checked={selectedIds.has(tx.id)}
                  onChange={e => {
                    setSelectedIds(prev => {
                      const next = new Set(prev)
                      if (e.target.checked) next.add(tx.id)
                      else next.delete(tx.id)
                      return next
                    })
                  }}
                />
              </div>
              {/* Date */}
              {isEditing ? (
                <input type="date" value={ed.date}
                  onChange={e => updateField(tx.id, { date: e.target.value })}
                  className="text-xs rounded-md px-2 py-1 outline-none w-28 bg-surface border border-border-2 text-text"
                  style={{ colorScheme: 'dark' }} />
              ) : (
                <span className="text-xs text-text-2">
                  {format(new Date(tx.date), 'd MMM yyyy')}
                </span>
              )}

              {/* Description */}
              {isEditing ? (
                <div className="mr-4">
                  <input value={ed.description}
                    onChange={e => updateField(tx.id, { description: e.target.value })}
                    className="w-full text-sm rounded-md px-2 py-1 outline-none bg-surface border border-border-2 text-text" />
                  <input
                    type="text"
                    value={ed.notes ?? ''}
                    onChange={e => updateField(tx.id, { notes: e.target.value })}
                    maxLength={500}
                    placeholder="Add a note…"
                    className="mt-1 w-full rounded px-2 py-1 text-xs outline-none bg-surface border border-border text-text-2 placeholder:text-text-3"
                  />
                </div>
              ) : (
                <div className="pr-4">
                  <span className="text-sm text-text">{tx.description}</span>
                  {tx.notes && (
                    <p className="text-xs text-text-3 mt-0.5">{tx.notes}</p>
                  )}
                </div>
              )}

              {/* Category */}
              {isEditing ? (
                ed.isIncome
                  ? <span className="text-xs pr-4 text-green">Income</span>
                  : <select value={ed.categoryId}
                      onChange={e => updateField(tx.id, { categoryId: e.target.value })}
                      className="text-xs rounded-md px-2 py-1 outline-none pr-4 bg-surface border border-border-2 text-text">
                      <option value="">— none —</option>
                      {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
              ) : (
                <div className="pr-4">
                  {tx.category
                    ? <CategoryPill name={tx.category.name} color={tx.category.color} />
                    : <span className="text-text-3">—</span>}
                </div>
              )}

              {/* Source / type toggle when editing */}
              {isEditing ? (
                <button
                  onClick={() => updateField(tx.id, { isIncome: !ed.isIncome })}
                  className="text-xs px-2 py-1 rounded-md font-medium"
                  style={{
                    background: ed.isIncome ? '#4ade8022' : 'var(--surface)',
                    color: ed.isIncome ? '#4ade80' : 'var(--text-2)',
                    border: `1px solid ${ed.isIncome ? '#4ade8066' : 'var(--border-2)'}`,
                  }}>
                  {ed.isIncome ? 'Income' : 'Spending'}
                </button>
              ) : (
                <div><SourcePill source={tx.source} /></div>
              )}

              {/* Amount */}
              {isEditing ? (
                <div className="flex items-center justify-end gap-0.5">
                  <span className="text-xs text-text-2">{currency}</span>
                  <input type="number" step="0.01" value={ed.amount}
                    onChange={e => updateField(tx.id, { amount: e.target.value })}
                    className={cn('text-sm text-right rounded-md px-2 py-1 outline-none w-20 bg-surface border', ed.isIncome ? 'border-green/40 text-green' : 'border-border-2 text-text')} />
                </div>
              ) : (
                <span className={cn('text-sm font-medium tabular-nums text-right', Number(tx.amount) > 0 ? 'text-green' : 'text-text')}>
                  {Number(tx.amount) > 0 ? '+' : ''}{currency}{Math.abs(Number(tx.amount)).toFixed(2)}
                </span>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 px-2">
                {isEditing ? (
                  <>
                    <button onClick={() => saveEdit(tx.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-md bg-accent text-bg"
                      aria-label="Save" title="Save">
                      <Check size={12} />
                    </button>
                    <button onClick={() => setEditing(null)}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-text-2 border border-border"
                      aria-label="Cancel" title="Cancel">
                      <X size={12} />
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startEdit(tx)}
                      className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-text-2"
                      aria-label="Edit transaction" title="Edit">
                      <Pencil size={13} />
                    </button>
                    <button onClick={async () => {
                      if (!window.confirm('Delete this transaction? This cannot be undone.')) return
                      await api.transactions.remove(tx.id)
                      setAllItems(prev => prev.filter(t => t.id !== tx.id))
                    }}
                      className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-red"
                      aria-label="Delete transaction" title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )})
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
          {/* Left: count + per page */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-2">
              Showing {total === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
            </span>
            <div className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs bg-surface-2 border border-border">
              <span className="text-text-2">Show</span>
              <select
                value={perPage}
                onChange={e => { setPerPage(Number(e.target.value)); setPage(1) }}
                className="bg-transparent text-xs outline-none ml-1 appearance-none text-text"
              >
                {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <ChevronDown size={10} className="text-text-2" />
            </div>
          </div>

          {/* Right: pagination */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              {page > 1 && (
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-xs text-text-2"
                >
                  ‹
                </button>
              )}
              {pageNums().map((n, i) =>
                n === '...'
                  ? <span key={`ellipsis-${i}`} className="w-7 text-center text-xs text-text-3">···</span>
                  : (
                    <button
                      key={n}
                      onClick={() => setPage(n as number)}
                      className={cn('w-7 h-7 flex items-center justify-center rounded-md text-xs font-medium', page === n ? 'bg-accent text-bg' : 'text-text-2')}
                    >
                      {n}
                    </button>
                  )
              )}
              {page < totalPages && (
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-xs text-text-2"
                >
                  ›
                </button>
              )}
            </div>
          )}
        </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm predicted transaction popover */}
      {confirmItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: '#00000060' }}
          onClick={(e) => e.target === e.currentTarget && setConfirmItem(null)}
        >
          <div className="w-full max-w-sm overflow-hidden rounded-xl border border-border-2 bg-surface">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold text-text">Confirm transaction</span>
              <button onClick={() => setConfirmItem(null)} className="text-text-2">✕</button>
            </div>

            <div className="px-4 pt-3 pb-0">
              <div
                className="rounded-lg px-3 py-2.5 mb-3"
                style={{ background: '#818cf810', border: '1px solid #818cf820' }}
              >
                <p className="text-sm font-medium text-text-2">{confirmItem.description}</p>
                <p className="text-xs mt-0.5" style={{ color: '#818cf8' }}>
                  Predicted ~{format(new Date(year, month - 1, confirmItem.expectedDay), 'd MMM')} · −<CurrencyAmount amount={Math.abs(confirmItem.typicalAmount)} />
                </p>
              </div>
            </div>

            <div className="px-4 pb-3 space-y-3">
              <div>
                <label className="text-xs font-medium block mb-1 text-text-2">Actual date</label>
                <input
                  type="date"
                  value={confirmDate}
                  onChange={e => setConfirmDate(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none bg-surface-2 border border-border-2 text-text"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1 text-text-2">Actual amount</label>
                <div className="flex items-center rounded-lg px-3 h-9 bg-surface-2 border border-accent">
                  <span className="text-sm mr-1 text-text-3">{currency}</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={confirmAmount}
                    onChange={e => setConfirmAmount(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-sm text-text"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setConfirmItem(null)}
                className="px-3 py-1.5 rounded-lg text-sm bg-surface-2 text-text-2"
              >
                Cancel
              </button>
              <button
                disabled={confirmSaving || !confirmDate || !confirmAmount}
                onClick={async () => {
                  if (!confirmDate || !confirmAmount) return
                  setConfirmSaving(true)
                  try {
                    await api.transactions.create({
                      description: confirmItem.description,
                      date: confirmDate,
                      amount: -Math.abs(Number(confirmAmount)),
                      categoryId: confirmItem.categoryId ?? undefined,
                      source: 'manual',
                    })
                    setPredicted(prev => prev.filter(p => p.patternId !== confirmItem.patternId))
                    setConfirmItem(null)
                    refresh()
                  } finally {
                    setConfirmSaving(false)
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-40 bg-accent text-bg"
              >
                {confirmSaving ? 'Saving…' : 'Save as transaction'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk categorize floating bar */}
      {selectedIds.size > 0 && (
        <div
          className="fixed inset-x-4 bottom-24 z-50 flex flex-col gap-3 rounded-xl border border-border-2 bg-surface-2 px-4 py-3 sm:inset-x-auto sm:left-1/2 sm:bottom-6 sm:w-[min(520px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:flex-row sm:items-center"
          style={{ boxShadow: '0 8px 32px #000a' }}
        >
          <span className="text-sm font-medium shrink-0 text-text">
            {selectedIds.size} selected
          </span>

          <select
            value={bulkCategoryId}
            onChange={e => { setBulkCategoryId(e.target.value); setBulkError(null) }}
            className="w-full rounded-lg bg-surface px-3 py-1.5 text-sm text-text outline-none border border-border-2 sm:flex-1"
          >
            <option value="">Pick a category…</option>
            <option value="__none__">No category</option>
            {categories.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <button
            disabled={bulkSaving || bulkCategoryId === ''}
            onClick={async () => {
              setBulkSaving(true)
              setBulkError(null)
              try {
                const categoryId = bulkCategoryId === '__none__' ? null : bulkCategoryId
                await api.transactions.bulkCategorize([...selectedIds], categoryId)
                setSelectedIds(new Set())
                setBulkCategoryId('')
                refresh()
              } catch {
                setBulkError('Failed to apply — please retry')
              } finally {
                setBulkSaving(false)
              }
            }}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-bg disabled:opacity-40 sm:shrink-0"
          >
            {bulkSaving ? 'Applying…' : 'Apply'}
          </button>

          <button
            onClick={() => { setSelectedIds(new Set()); setBulkCategoryId(''); setBulkError(null) }}
            className="text-left text-xs text-text-2 sm:shrink-0"
          >
            Deselect all
          </button>

          {bulkError && (
            <span className="text-xs text-red sm:shrink-0">{bulkError}</span>
          )}
        </div>
      )}
    </div>
  )
}
