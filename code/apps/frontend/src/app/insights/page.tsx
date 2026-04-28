'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'
import { InsightsCategoryTable } from './insights-category-table'
import { InsightsDrillDown }     from './insights-drill-down'
import { InsightsAIChat }        from './insights-ai-chat'

type InsightMonth = { year: number; month: number; label: string; total: number }
type InsightRow = {
  categoryId: string; name: string; color: string
  monthlyBudget: number | null; months: InsightMonth[]; delta: number | null
}

export default function InsightsPage() {
  const now = new Date()
  const [year, setYear]             = useState(now.getFullYear())
  const [month, setMonth]           = useState(now.getMonth() + 1)
  const [categories, setCategories] = useState<InsightRow[]>([])
  const [selected, setSelected]     = useState<InsightRow | null>(null)
  const [isLoading, setIsLoading]   = useState(true)
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    setSelected(null)
    api.insights.categories(year, month)
      .then(data => setCategories(data.categories))
      .catch(() => setError('Failed to load insights'))
      .finally(() => setIsLoading(false))
  }, [year, month])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const monthLabel        = new Date(year, month - 1).toLocaleString('default', { month: 'short', year: 'numeric' })
  const currentMonthLabel = new Date(year, month - 1).toLocaleString('default', { month: 'short' })

  const topMover = categories
    .filter(c => c.delta !== null)
    .sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!))
    [0] ?? null

  const chatContext = {
    year, month,
    categories: categories.map(c => ({
      name:          c.name,
      months:        c.months.map(m => ({ label: m.label, total: m.total })),
      monthlyBudget: c.monthlyBudget,
      delta:         c.delta,
    })),
  }

  if (error) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-sm" style={{ color: 'var(--text-2)' }}>{error}</p>
    </div>
  )

  const showLoading = isLoading && categories.length === 0

  return (
    <div className="space-y-6 px-4 py-5 sm:px-6 sm:py-6">
      {selected ? (
        <InsightsDrillDown row={selected} onBack={() => setSelected(null)} />
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Insights</h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>
                3-month spending breakdown by category
              </p>
            </div>

            {/* Month picker */}
            <div
              className="flex items-center gap-1 rounded-lg px-1 py-1"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-md transition-colors"
                style={{ color: 'var(--text-2)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <ChevronLeft size={14} />
              </button>
                <span className="px-2 text-sm font-medium" style={{ color: 'var(--text)', minWidth: 96, textAlign: 'center' }}>
                  {monthLabel}
                </span>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-md transition-colors"
                style={{ color: 'var(--text-2)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <InsightsCategoryTable
            categories={categories}
            currentMonthLabel={currentMonthLabel}
            onRowClick={setSelected}
          />

          {showLoading && (
            <div
              className="flex items-center justify-center py-12"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}
            >
              <div className="h-5 w-5 animate-spin rounded-full border-2" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            </div>
          )}
        </>
      )}

      {/* AI Chat — always visible */}
      <InsightsAIChat
        context={chatContext}
        topMoverName={topMover?.name ?? null}
      />
    </div>
  )
}
