'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { api } from '@/lib/api'
import { ChevronLeft, ChevronRight, Search, Pencil, ChevronDown, Check, X, Trash2, Eye, EyeOff } from 'lucide-react'
import { useCurrency } from '@/hooks/useCurrency'
import { CurrencyAmount } from '@/components/currency-amount'
const PER_PAGE_OPTIONS = [10, 20, 50]

function SourcePill({ source }: { source: 'manual' | 'pdf' | 'photo' }) {
  const styles = {
    manual: { bg: '#ffffff10', color: '#71717a', label: 'manual' },
    pdf:    { bg: '#38bdf822', color: '#38bdf8', label: 'pdf'    },
    photo:  { bg: '#c084fc22', color: '#c084fc', label: 'photo'  },
  }
  const s = styles[source]
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  )
}

function CategoryPill({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: color + '22', color }}
    >
      {name}
    </span>
  )
}

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

  const prevMonth = month === 1  ? 12 : month - 1
  const prevYear  = month === 1  ? year - 1 : year
  const nextMonth = month === 12 ? 1  : month + 1
  const nextYear  = month === 12 ? year + 1 : year

  const monthLabel = format(new Date(year, month - 1), 'MMMM yyyy')

  useEffect(() => { api.categories.list().then(setCategories).catch(() => {}) }, [])

  const refresh = useCallback(() => {
    api.transactions.list({ year, month, perPage: 1000 })
      .then(r => setAllItems(r.items))
      .catch(() => {})
  }, [year, month])

  useEffect(() => {
    window.addEventListener('transaction-saved', refresh)
    return () => window.removeEventListener('transaction-saved', refresh)
  }, [refresh])

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    api.transactions.list({ year, month, perPage: 1000 })
      .then(r => setAllItems(r.items))
      .catch(() => setError('Failed to load transactions'))
      .finally(() => setIsLoading(false))
  }, [year, month])

  useEffect(() => {
    api.recurring.upcoming(year, month).then(setPredicted).catch(() => {})
  }, [year, month])

  const [showPredicted, setShowPredicted] = useState(true)
  const [predicted, setPredicted] = useState<any[]>([])
  const [confirmItem, setConfirmItem] = useState<any | null>(null)
  const [confirmDate, setConfirmDate] = useState('')
  const [confirmAmount, setConfirmAmount] = useState('')
  const [confirmSaving, setConfirmSaving] = useState(false)

  const [editing, setEditing] = useState<string | null>(null)
  const [editData, setEditData] = useState<Record<string, any>>({})

  const filteredItems = allItems.filter(tx => {
    if (search && !tx.description.toLowerCase().includes(search.toLowerCase())) return false
    if (catFilter === 'uncategorized' && tx.category !== null) return false
    if (catFilter && catFilter !== 'uncategorized' && tx.category?.id !== catFilter) return false
    const abs = Math.abs(Number(tx.amount))
    if (amountMin !== '' && abs < Number(amountMin)) return false
    if (amountMax !== '' && abs > Number(amountMax)) return false
    return true
  })

  const predictedRows = showPredicted
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
    <div className="px-8 py-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-semibold flex-1" style={{ color: 'var(--text)' }}>
          All Transactions
        </h1>
        <button onClick={() => nav(prevYear, prevMonth)}
          className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <ChevronLeft size={16} style={{ color: 'var(--text-2)' }} />
        </button>
        <span className="text-sm font-medium w-28 text-center" style={{ color: 'var(--text)' }}>
          {monthLabel}
        </span>
        <button onClick={() => nav(nextYear, nextMonth)}
          className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <ChevronRight size={16} style={{ color: 'var(--text-2)' }} />
        </button>
      </div>

      {/* Main card */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {/* Filters */}
        <div
          className="flex items-center gap-3 px-5 py-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div
            className="flex items-center gap-2 flex-1 rounded-lg px-3 py-2"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            <Search size={14} style={{ color: 'var(--text-2)' }} />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search transactions…"
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--text)' }}
            />
          </div>

          <select
            value={catFilter}
            onChange={e => { setCatFilter(e.target.value); setPage(1) }}
            className="rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: catFilter ? 'var(--text)' : 'var(--text-2)',
            }}
          >
            <option value="">All categories</option>
            <option value="uncategorized">No category</option>
            {categories.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Amount range */}
          <div
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            <span style={{ color: 'var(--text-2)' }}>{currency}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountMin}
              onChange={e => { setAmountMin(e.target.value); setPage(1) }}
              placeholder="min"
              className="w-14 bg-transparent outline-none text-sm"
              style={{ color: 'var(--text)' }}
            />
            <span style={{ color: 'var(--text-3)' }}>–</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountMax}
              onChange={e => { setAmountMax(e.target.value); setPage(1) }}
              placeholder="max"
              className="w-14 bg-transparent outline-none text-sm"
              style={{ color: 'var(--text)' }}
            />
          </div>

          {predicted.length > 0 && (
            <button
              onClick={() => setShowPredicted(p => !p)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: showPredicted ? '#818cf822' : 'transparent',
                border: `1px solid ${showPredicted ? '#818cf860' : 'var(--border)'}`,
                color: showPredicted ? '#818cf8' : 'var(--text-3)',
                boxShadow: showPredicted ? '0 0 0 1px #818cf820 inset' : 'none',
              }}
            >
              {showPredicted
                ? <Eye size={12} />
                : <EyeOff size={12} />}
              Predicted
              <span
                className="ml-0.5 px-1.5 py-0.5 rounded text-xs font-bold"
                style={{
                  background: showPredicted ? '#818cf830' : 'var(--surface-2)',
                  color: showPredicted ? '#818cf8' : 'var(--text-3)',
                }}
              >
                {predicted.length}
              </span>
            </button>
          )}

          <span
            className="text-sm font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--surface-2)', color: 'var(--accent)' }}
          >
            {total} transactions
          </span>
        </div>

        {/* Table header */}
        <div
          className="grid text-xs font-medium uppercase tracking-wider px-5 py-2.5"
          style={{
            gridTemplateColumns: '110px 1fr 180px 90px 130px 48px',
            borderBottom: '1px solid var(--border)',
            color: 'var(--text-2)',
          }}
        >
          <span>Date</span>
          <span>Description</span>
          <span>Category</span>
          <span>Source</span>
          <span className="text-right">Amount</span>
          <span />
        </div>

        {/* Rows */}
        {error ? (
          <p className="text-sm py-12 text-center" style={{ color: 'var(--text-3)' }}>{error}</p>
        ) : isLoading ? (
          <div className="animate-pulse">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-4 px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="h-3 w-20 rounded" style={{ background: 'var(--surface-2)' }} />
                <div className="h-3 flex-1 rounded" style={{ background: 'var(--surface-2)' }} />
                <div className="h-5 w-24 rounded-full" style={{ background: 'var(--surface-2)' }} />
                <div className="h-5 w-14 rounded-full" style={{ background: 'var(--surface-2)' }} />
                <div className="h-3 w-16 rounded ml-auto" style={{ background: 'var(--surface-2)' }} />
              </div>
            ))}
          </div>
        ) : pageItems.length === 0 ? (
          <p className="text-sm py-12 text-center" style={{ color: 'var(--text-3)' }}>
            No transactions found
          </p>
        ) : (
          pageItems.map(tx => {
            if (tx._predicted) {
              return (
                <div
                  key={tx.id}
                  className="grid items-center px-5 py-3"
                  style={{
                    gridTemplateColumns: '110px 1fr 180px 90px 130px 48px',
                    background: '#818cf80a',
                    borderBottom: '1px solid #818cf820',
                  }}
                >
                  <span className="text-xs" style={{ color: '#818cf8', opacity: 0.8 }}>
                    ~{format(new Date(year, month - 1, tx.expectedDay), 'd MMM')}
                  </span>
                  <div className="pr-4">
                    <span className="text-sm" style={{ color: 'var(--text-2)' }}>{tx.description}</span>
                    <span
                      className="ml-2 text-xs px-1.5 py-0.5 rounded font-bold uppercase tracking-wide"
                      style={{ background: '#818cf818', color: '#818cf8', letterSpacing: '0.05em' }}
                    >
                      predicted
                    </span>
                  </div>
                  <div className="pr-4">
                    {tx.category
                      ? <CategoryPill name={tx.category.name} color={tx.category.color} />
                      : <span style={{ color: 'var(--text-3)' }}>—</span>}
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-3)' }}>—</span>
                  <span className="text-sm font-medium tabular-nums text-right" style={{ color: '#818cf8', opacity: 0.8 }}>
                    <CurrencyAmount amount={Math.abs(Number(tx.amount))} />
                  </span>
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => {
                        setConfirmItem(tx)
                        setConfirmDate(`${year}-${String(month).padStart(2, '0')}-${String(tx.expectedDay).padStart(2, '0')}`)
                        setConfirmAmount(Math.abs(tx.typicalAmount).toFixed(2))
                      }}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold"
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
                      className="w-7 h-7 rounded-md flex items-center justify-center text-sm ml-1"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}
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
              className="grid items-center px-5 py-3"
              style={{
                gridTemplateColumns: '110px 1fr 180px 90px 130px 48px',
                borderBottom: '1px solid var(--border)',
                background: isEditing ? 'var(--surface-2)' : 'transparent',
              }}
            >
              {/* Date */}
              {isEditing ? (
                <input type="date" value={ed.date}
                  onChange={e => updateField(tx.id, { date: e.target.value })}
                  className="text-xs rounded-md px-2 py-1 outline-none w-28"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--text)', colorScheme: 'dark' }} />
              ) : (
                <span className="text-xs" style={{ color: 'var(--text-2)' }}>
                  {format(new Date(tx.date), 'd MMM yyyy')}
                </span>
              )}

              {/* Description */}
              {isEditing ? (
                <input value={ed.description}
                  onChange={e => updateField(tx.id, { description: e.target.value })}
                  className="text-sm rounded-md px-2 py-1 outline-none mr-4"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--text)' }} />
              ) : (
                <span className="text-sm truncate pr-4" style={{ color: 'var(--text)' }}>{tx.description}</span>
              )}

              {/* Category */}
              {isEditing ? (
                ed.isIncome
                  ? <span className="text-xs pr-4" style={{ color: '#4ade80' }}>Income</span>
                  : <select value={ed.categoryId}
                      onChange={e => updateField(tx.id, { categoryId: e.target.value })}
                      className="text-xs rounded-md px-2 py-1 outline-none pr-4"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--text)' }}>
                      <option value="">— none —</option>
                      {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
              ) : (
                <div className="pr-4">
                  {tx.category
                    ? <CategoryPill name={tx.category.name} color={tx.category.color} />
                    : <span style={{ color: 'var(--text-3)' }}>—</span>}
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
                  {ed.isIncome ? 'Income' : 'Expense'}
                </button>
              ) : (
                <div><SourcePill source={tx.source} /></div>
              )}

              {/* Amount */}
              {isEditing ? (
                <div className="flex items-center justify-end gap-0.5">
                  <span className="text-xs" style={{ color: 'var(--text-2)' }}>{currency}</span>
                  <input type="number" step="0.01" value={ed.amount}
                    onChange={e => updateField(tx.id, { amount: e.target.value })}
                    className="text-sm text-right rounded-md px-2 py-1 outline-none w-20"
                    style={{ background: 'var(--surface)', border: `1px solid ${ed.isIncome ? '#4ade8066' : 'var(--border-2)'}`, color: ed.isIncome ? '#4ade80' : 'var(--text)' }} />
                </div>
              ) : (
                <span className="text-sm font-medium tabular-nums text-right" style={{ color: Number(tx.amount) > 0 ? 'var(--green)' : 'var(--text)' }}>
                  {Number(tx.amount) > 0 ? '+' : ''}{currency}{Math.abs(Number(tx.amount)).toFixed(2)}
                </span>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-1">
                {isEditing ? (
                  <>
                    <button onClick={() => saveEdit(tx.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-md"
                      style={{ background: 'var(--accent)', color: '#0c0c0e' }}
                      title="Save">
                      <Check size={12} />
                    </button>
                    <button onClick={() => setEditing(null)}
                      className="w-7 h-7 flex items-center justify-center rounded-md"
                      style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}
                      title="Cancel">
                      <X size={12} />
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startEdit(tx)}
                      className="w-7 h-7 flex items-center justify-center rounded-md transition-colors"
                      style={{ color: 'var(--text-2)' }} title="Edit">
                      <Pencil size={13} />
                    </button>
                    <button onClick={async () => {
                      if (!window.confirm('Delete this transaction? This cannot be undone.')) return
                      await api.transactions.remove(tx.id)
                      setAllItems(prev => prev.filter(t => t.id !== tx.id))
                    }}
                      className="w-7 h-7 flex items-center justify-center rounded-md transition-colors"
                      style={{ color: 'var(--red)' }} title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )})
        )}

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          {/* Left: count + per page */}
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: 'var(--text-2)' }}>
              Showing {total === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
            </span>
            <div
              className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <span style={{ color: 'var(--text-2)' }}>Show</span>
              <select
                value={perPage}
                onChange={e => { setPerPage(Number(e.target.value)); setPage(1) }}
                className="bg-transparent text-xs outline-none ml-1 appearance-none"
                style={{ color: 'var(--text)' }}
              >
                {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <ChevronDown size={10} style={{ color: 'var(--text-2)' }} />
            </div>
          </div>

          {/* Right: pagination */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              {page > 1 && (
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-xs"
                  style={{ color: 'var(--text-2)' }}
                >
                  ‹
                </button>
              )}
              {pageNums().map((n, i) =>
                n === '...'
                  ? <span key={`ellipsis-${i}`} className="w-7 text-center text-xs" style={{ color: 'var(--text-3)' }}>···</span>
                  : (
                    <button
                      key={n}
                      onClick={() => setPage(n as number)}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-xs font-medium"
                      style={{
                        background: page === n ? 'var(--accent)' : 'transparent',
                        color: page === n ? '#0c0c0e' : 'var(--text-2)',
                      }}
                    >
                      {n}
                    </button>
                  )
              )}
              {page < totalPages && (
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-xs"
                  style={{ color: 'var(--text-2)' }}
                >
                  ›
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirm predicted transaction popover */}
      {confirmItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: '#00000060' }}
          onClick={(e) => e.target === e.currentTarget && setConfirmItem(null)}
        >
          <div
            className="rounded-xl w-80 overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-2)' }}
          >
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Confirm transaction</span>
              <button onClick={() => setConfirmItem(null)} style={{ color: 'var(--text-2)' }}>✕</button>
            </div>

            <div className="px-4 pt-3 pb-0">
              <div
                className="rounded-lg px-3 py-2.5 mb-3"
                style={{ background: '#818cf810', border: '1px solid #818cf820' }}
              >
                <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>{confirmItem.description}</p>
                <p className="text-xs mt-0.5" style={{ color: '#818cf8' }}>
                  Predicted ~{format(new Date(year, month - 1, confirmItem.expectedDay), 'd MMM')} · −<CurrencyAmount amount={Math.abs(confirmItem.typicalAmount)} />
                </p>
              </div>
            </div>

            <div className="px-4 pb-3 space-y-3">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-2)' }}>Actual date</label>
                <input
                  type="date"
                  value={confirmDate}
                  onChange={e => setConfirmDate(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)', colorScheme: 'dark' }}
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-2)' }}>Actual amount</label>
                <div
                  className="flex items-center rounded-lg px-3"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--accent)', height: 36 }}
                >
                  <span className="text-sm mr-1" style={{ color: 'var(--text-3)' }}>{currency}</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={confirmAmount}
                    onChange={e => setConfirmAmount(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-sm"
                    style={{ color: 'var(--text)' }}
                  />
                </div>
              </div>
            </div>

            <div
              className="flex items-center justify-end gap-2 px-4 py-3"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <button
                onClick={() => setConfirmItem(null)}
                className="px-3 py-1.5 rounded-lg text-sm"
                style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}
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
                className="px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#0c0c0e' }}
              >
                {confirmSaving ? 'Saving…' : 'Save as transaction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
