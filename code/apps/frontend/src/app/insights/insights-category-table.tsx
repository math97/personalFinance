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
  categories: InsightRow[]
  currentMonthLabel: string
  onRowClick: (row: InsightRow) => void
}

function SparklineBar({ months, color }: { months: InsightMonth[]; color: string }) {
  const max = Math.max(...months.map(m => m.total), 1)
  const opacities = [0.35, 0.65, 1]
  return (
    <div className="flex items-end gap-0.5" style={{ height: 20, width: 36 }}>
      {months.map((m, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${Math.max((m.total / max) * 100, 4)}%`,
            background: color,
            opacity: opacities[i],
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  )
}

function BudgetCell({ total, budget, color }: { total: number; budget: number | null; color: string }) {
  if (budget === null) {
    return <span style={{ color: 'var(--text-3)' }}>—</span>
  }
  const pct     = Math.min((total / budget) * 100, 100)
  const isOver  = total > budget
  const isNear  = !isOver && pct >= 90
  const barColor = isOver ? 'var(--red)' : isNear ? '#f59e0b' : color
  const left     = budget - total

  return (
    <div style={{ minWidth: 140 }}>
      <div
        className="h-1 rounded-full overflow-hidden mb-1"
        style={{ background: isOver ? '#f8717120' : 'var(--surface-2)' }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      <span
        className="text-xs"
        style={{ color: isOver ? 'var(--red)' : isNear ? '#f59e0b' : 'var(--text-2)' }}
      >
        {isOver
          ? <><CurrencyAmount amount={Math.abs(left)} /> over budget</>
          : <><CurrencyAmount amount={left} /> left{isNear ? ` — ${Math.round(pct)}%` : ''}</>
        }
      </span>
    </div>
  )
}

export function InsightsCategoryTable({ categories, currentMonthLabel, onRowClick }: Props) {
  if (categories.length === 0) {
    return (
      <div
        className="rounded-xl px-6 py-12 text-center"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>
          No transactions yet — import or add some to see insights.
        </p>
      </div>
    )
  }

  const [prevPrev, prev, curr] = categories[0]?.months ?? []
  const colLabels = [prevPrev?.label ?? '', prev?.label ?? '', curr?.label ?? currentMonthLabel]

  return (
    <div className="overflow-x-auto">
      <div
        className="min-w-[920px] overflow-hidden rounded-xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
      {/* Header row */}
      <div
        className="grid items-center px-5 py-2.5 text-xs font-semibold uppercase tracking-wider"
        style={{
          gridTemplateColumns: '200px 120px 120px 120px 160px 1fr 80px',
          color: 'var(--text-3)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span>Category</span>
        <span>{colLabels[0]}</span>
        <span>{colLabels[1]}</span>
        <span style={{ color: 'var(--text)' }}>{colLabels[2]}</span>
        <span>Budget</span>
        <span />
        <span className="text-right">Trend</span>
      </div>

      {/* Data rows */}
      {categories.map(row => {
        const allZero = row.months.every(m => m.total === 0)
        return (
          <div
            key={row.categoryId}
            className="grid items-center px-5 py-3.5 cursor-pointer transition-colors"
            style={{
              gridTemplateColumns: '200px 120px 120px 120px 160px 1fr 80px',
              borderBottom: '1px solid var(--border)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => onRowClick(row)}
          >
            {/* Category name */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: row.color }} />
              <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                {row.name}
              </span>
            </div>

            {/* Month totals */}
            {row.months.map((m, i) => (
              <span
                key={i}
                className="text-sm tabular-nums"
                style={{ color: i === 2 ? 'var(--text)' : 'var(--text-2)', fontWeight: i === 2 ? 600 : 400 }}
              >
                {m.total > 0 ? <CurrencyAmount amount={m.total} /> : <span style={{ color: 'var(--text-3)' }}>—</span>}
              </span>
            ))}

            {/* Budget */}
            <BudgetCell total={row.months[2]?.total ?? 0} budget={row.monthlyBudget} color={row.color} />

            {/* Spacer */}
            <span />

            {/* Trend */}
            <div className="flex items-center justify-end gap-2">
              {allZero ? (
                <span style={{ color: 'var(--text-3)' }}>—</span>
              ) : (
                <>
                  <SparklineBar months={row.months} color={row.color} />
                  {row.delta !== null ? (
                    <span
                      className="text-xs font-semibold tabular-nums"
                      style={{ color: row.delta > 0 ? 'var(--red)' : '#22c55e', minWidth: 40, textAlign: 'right' }}
                    >
                      {row.delta > 0 ? '+' : ''}{row.delta}%
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--text-3)', minWidth: 40, textAlign: 'right' }}>—</span>
                  )}
                </>
              )}
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}
