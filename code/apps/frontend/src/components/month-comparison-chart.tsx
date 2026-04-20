'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer,
} from 'recharts'
import { tokens } from '@/lib/design-tokens'
import { useCurrency } from '@/hooks/useCurrency'

type MonthData = { label: string; year: number; month: number; total: number }

type Props = {
  data: MonthData[]
  currentYear: number
  currentMonth: number
  prevMonthTotal?: number
  biggestCategoryName?: string
}

export function MonthComparisonChart({
  data,
  currentYear,
  currentMonth,
  prevMonthTotal = 0,
  biggestCategoryName,
}: Props) {
  const [currency] = useCurrency()
  const currentTotal = data.find(m => m.year === currentYear && m.month === currentMonth)?.total ?? 0
  const delta = currentTotal - prevMonthTotal
  const hasDelta = prevMonthTotal > 0 && delta !== 0

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-44">
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>No spending history yet</p>
      </div>
    )
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: tokens.text2, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={v => `${currency}${v}`}
            tick={{ fill: tokens.text2, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            formatter={(v) => [`${currency}${Number(v).toFixed(2)}`, 'Spent']}
            cursor={{ fill: '#ffffff08' }}
            contentStyle={{
              background: tokens.surface2,
              border: `1px solid ${tokens.border2}`,
              borderRadius: 8,
              color: tokens.text,
              fontSize: 12,
            }}
          />
          <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={
                  entry.year === currentYear && entry.month === currentMonth
                    ? tokens.accent
                    : '#2e2e3a'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {hasDelta && (
        <p className="text-xs mt-2" style={{ color: tokens.text2 }}>
          <span style={{ color: delta > 0 ? tokens.red : tokens.green, fontWeight: 600 }}>
            {delta > 0 ? '▲' : '▼'} {currency}{Math.abs(delta).toFixed(0)}
          </span>
          {' '}vs last month
          {biggestCategoryName && (
            <span style={{ color: tokens.text2 }}> · {biggestCategoryName} is the biggest driver</span>
          )}
        </p>
      )}
    </div>
  )
}
