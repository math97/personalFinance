'use client'

import type { ReactNode } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import { CurrencyAmount } from '@/components/currency-amount'

type InsightMonth = { year: number; month: number; label: string; total: number }

type InsightRow = {
  categoryId: string
  name: string
  color: string
  monthlyBudget: number | null
  months: InsightMonth[]
  delta: number | null
}

type Props = {
  row: InsightRow
  onBack: () => void
}

function StatCard({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div
      className="rounded-xl px-5 py-4 flex flex-col gap-1"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
        {label}
      </span>
      <span className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{value}</span>
      {sub && <span className="text-xs" style={{ color: 'var(--text-2)' }}>{sub}</span>}
    </div>
  )
}

export function InsightsDrillDown({ row, onBack }: Props) {
  const totals    = row.months.map(m => m.total)
  const sum       = totals.reduce((a, b) => a + b, 0)
  const avg       = row.months.length > 0 ? sum / row.months.length : 0
  const maxTotal  = Math.max(...totals)
  const bigMonth  = row.months.find(m => m.total === maxTotal)!
  const curr      = row.months[2]
  const isOver    = row.monthlyBudget != null && curr != null && curr.total > row.monthlyBudget
  const opacities = [0.3, 0.55, 1]

  return (
    <div className="space-y-5">
      {/* Back link + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-sm flex items-center gap-1"
          style={{ color: 'var(--text-2)' }}
        >
          ← Insights
        </button>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: row.color }} />
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{row.name}</h1>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="3-Month Total"
          value={<CurrencyAmount amount={sum} />}
        />
        <StatCard
          label="Monthly Average"
          value={<CurrencyAmount amount={avg} />}
        />
        <StatCard
          label="Biggest Month"
          value={<CurrencyAmount amount={maxTotal} />}
          sub={bigMonth?.label}
        />
        <StatCard
          label="Monthly Budget"
          value={
            row.monthlyBudget != null
              ? <CurrencyAmount amount={row.monthlyBudget} />
              : <span className="text-base" style={{ color: 'var(--text-2)' }}>No budget set</span>
          }
          sub={
            row.monthlyBudget != null
              ? <span style={{ color: isOver ? 'var(--red)' : '#22c55e' }}>
                  {isOver ? 'Over budget' : 'Under budget'}
                </span>
              : <a href="/categories" className="underline" style={{ color: 'var(--accent)' }}>
                  Set budget →
                </a>
          }
        />
      </div>

      {/* Bar chart */}
      <div
        className="rounded-xl px-5 pt-5 pb-4 relative"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {/* Delta tag */}
        {row.delta !== null && (
          <div
            className="absolute top-4 right-4 px-2 py-1 rounded-md text-xs font-semibold"
            style={{
              background: row.delta > 0 ? '#f8717120' : '#22c55e20',
              color: row.delta > 0 ? 'var(--red)' : '#22c55e',
            }}
          >
            {row.delta > 0 ? '+' : ''}{row.delta}% vs last month
          </div>
        )}

        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={row.months} barCategoryGap="30%">
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={({ x, y, payload, index }: any) => (
                <text
                  x={x} y={y + 14}
                  textAnchor="middle"
                  fontSize={12}
                  fill={index === 2 ? row.color : 'var(--text-3)'}
                  fontWeight={index === 2 ? 600 : 400}
                >
                  {payload.value}
                </text>
              )}
            />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)' }}
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null
                return (
                  <div
                    className="px-3 py-2 rounded-lg text-xs"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  >
                    <CurrencyAmount amount={payload[0].value as number} />
                  </div>
                )
              }}
            />
            <Bar dataKey="total" radius={[4, 4, 0, 0]}>
              <LabelList
                dataKey="total"
                position="top"
                formatter={(v: number) => `£${v.toFixed(0)}`}
                style={{ fontSize: 11, fill: 'var(--text-2)' }}
              />
              {row.months.map((_, i) => (
                <Cell key={i} fill={row.color} fillOpacity={opacities[i]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
