'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MonthComparisonChart } from './month-comparison-chart'
import { DailySpendingChart } from './daily-spending-chart'
import { CurrencyAmount } from './currency-amount'
import { cn } from '@/lib/cn'

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
        <h2 className="text-sm font-semibold text-text">
          {views[view]}
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setView(v => (v - 1 + views.length) % views.length)}
            className="w-6 h-6 rounded-full flex items-center justify-center bg-surface-2"
          >
            <ChevronLeft size={12} className="text-text-2" />
          </button>
          {views.map((_, i) => (
            <div
              key={i}
              className={cn('w-1.5 h-1.5 rounded-full', i === view ? 'bg-accent' : 'bg-text-3')}
            />
          ))}
          <button
            onClick={() => setView(v => (v + 1) % views.length)}
            className="w-6 h-6 rounded-full flex items-center justify-center bg-surface-2"
          >
            <ChevronRight size={12} className="text-text-2" />
          </button>
        </div>
      </div>

      {view === 0 && (
        <>
          {prevMonthTotal > 0 && delta !== 0 && (
            <p className="text-xs mb-3 text-text-2">
              <span className={cn('font-semibold', delta > 0 ? 'text-red' : 'text-green')}>
                {delta > 0 ? '▲' : '▼'} <CurrencyAmount amount={Math.abs(delta)} fractionDigits={0} />
              </span>
              {' '}vs last month
              {biggestCategoryName && (
                <> · <span className="text-text">{biggestCategoryName}</span></>
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
