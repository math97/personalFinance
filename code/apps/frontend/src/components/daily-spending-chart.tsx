'use client'

import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid,
} from 'recharts'
import { CurrencyAmount } from './currency-amount'

type DailySeriesDay = { day: number; cumulative: number }
type DailySeries = { year: number; month: number; label: string; days: DailySeriesDay[] }

type Props = { series: DailySeries[] }

const OPACITY = [0.15, 0.45, 1]

export function DailySpendingChart({ series }: Props) {
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)

  if (!series || series.length === 0) return (
    <div className="flex items-center justify-center h-40">
      <p className="text-sm" style={{ color: 'var(--text-3)' }}>No data</p>
    </div>
  )

  const today = new Date().getDate()
  const currentMonth = series[series.length - 1]
  const maxDay = currentMonth
    ? Math.max(...currentMonth.days.map(d => d.day), 1)
    : 31

  const chartData = Array.from({ length: maxDay }, (_, i) => {
    const day = i + 1
    const point: any = { day }
    series.forEach(s => {
      const found = s.days.find(d => d.day === day)
      point[s.label] = found?.cumulative ?? null
    })
    const lastLabel = series[series.length - 1]?.label
    if (lastLabel && day > today) point[lastLabel] = null
    return point
  })

  const colors = series.map((_, i) =>
    i === series.length - 1 ? 'var(--accent)' : '#ffffff'
  )

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div
        className="px-3 py-2.5 rounded-lg text-xs space-y-1"
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
        }}
      >
        <p className="font-semibold mb-1" style={{ color: 'var(--text-2)' }}>Day {label}</p>
        {series.map((s, i) => {
          const p = payload.find((pp: any) => pp.dataKey === s.label)
          if (!p?.value) return null
          return (
            <div key={s.label} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: colors[i], opacity: OPACITY[i] }}
              />
              <span style={{ color: i === series.length - 1 ? 'var(--accent)' : 'var(--text-2)' }}>
                {s.label} <CurrencyAmount amount={p.value} />
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          onMouseMove={(e: any) => setHoveredDay(e?.activeLabel ?? null)}
          onMouseLeave={() => setHoveredDay(null)}
        >
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--text-3)', fontSize: 10 }}
            ticks={[1, 7, 14, 21, 28]}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--text-3)', fontSize: 10 }}
            tickFormatter={(v) => `£${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--text-2)', strokeDasharray: '4 4', strokeWidth: 1 }} />

          {hoveredDay !== null && series.map((s, i) => {
            const found = s.days.find(d => d.day === hoveredDay)
            if (!found) return null
            return (
              <ReferenceLine
                key={s.label}
                y={found.cumulative}
                stroke={i === series.length - 1 ? 'var(--accent)' : '#ffffff'}
                strokeOpacity={OPACITY[i]}
                strokeDasharray="3 4"
                strokeWidth={1}
              />
            )
          })}

          {series.map((s, i) => (
            <Line
              key={s.label}
              type="monotone"
              dataKey={s.label}
              stroke={colors[i]}
              strokeOpacity={OPACITY[i]}
              strokeWidth={i === series.length - 1 ? 2 : 1.5}
              dot={false}
              activeDot={i === series.length - 1 ? { r: 4, fill: 'var(--accent)' } : false}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-2 px-1">
        {series.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div
              className="w-3 h-0.5 rounded"
              style={{ background: colors[i], opacity: OPACITY[i] }}
            />
            <span
              className="text-xs"
              style={{ color: i === series.length - 1 ? 'var(--accent)' : 'var(--text-3)' }}
            >
              {s.label}{i === series.length - 1 ? ' (now)' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
