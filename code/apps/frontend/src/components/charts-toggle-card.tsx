'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MonthComparisonChart } from './month-comparison-chart'
import { DailySpendingChart } from './daily-spending-chart'
import { CurrencyAmount } from './currency-amount'

type DailySeries = {
  year: number; month: number; label: string
  days: { day: number; cumulative: number }[]
}

type Props = {
  monthlyTotals: any[]
  dailyTotals: DailySeries[]
  currentYear: number
  currentMonth: number
  prevMonthTotal: number
  biggestCategoryName?: string
  delta: number
}

export function ChartsToggleCard({
  monthlyTotals, dailyTotals, currentYear, currentMonth,
  prevMonthTotal, biggestCategoryName, delta,
}: Props) {
  const [view, setView] = useState(0)
  const views = ['Last 4 months', 'Daily spending']

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {views[view]}
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setView(v => (v - 1 + views.length) % views.length)}
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: 'var(--surface-2)' }}
          >
            <ChevronLeft size={12} style={{ color: 'var(--text-2)' }} />
          </button>
          {views.map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: i === view ? 'var(--accent)' : 'var(--text-3)' }}
            />
          ))}
          <button
            onClick={() => setView(v => (v + 1) % views.length)}
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: 'var(--surface-2)' }}
          >
            <ChevronRight size={12} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>
      </div>

      {view === 0 && (
        <>
          {prevMonthTotal > 0 && delta !== 0 && (
            <p className="text-xs mb-3" style={{ color: 'var(--text-2)' }}>
              <span style={{ color: delta > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                {delta > 0 ? '▲' : '▼'} <CurrencyAmount amount={Math.abs(delta)} fractionDigits={0} />
              </span>
              {' '}vs last month
              {biggestCategoryName && (
                <> · <span style={{ color: 'var(--text)' }}>{biggestCategoryName}</span></>
              )}
            </p>
          )}
          <MonthComparisonChart
            data={monthlyTotals}
            currentYear={currentYear}
            currentMonth={currentMonth}
            prevMonthTotal={prevMonthTotal}
            biggestCategoryName={biggestCategoryName}
          />
        </>
      )}

      {view === 1 && (
        <DailySpendingChart series={dailyTotals} />
      )}
    </div>
  )
}
