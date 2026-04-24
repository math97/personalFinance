import { TriangleAlert, CircleAlert } from 'lucide-react'
import { BudgetBar } from './budget-bar'
import { CurrencyAmount } from './currency-amount'

type BudgetRow = {
  categoryId: string | null
  name: string
  color: string
  total: number
  monthlyBudget: number | null
}

export function BudgetProgressPanel({ rows }: { rows: BudgetRow[] }) {
  const budgetRows = rows.filter(r => r.monthlyBudget !== null)
  if (budgetRows.length === 0) return null

  const alerts = budgetRows.filter(r => {
    const pct = (Number(r.total) / Number(r.monthlyBudget!)) * 100
    return pct >= 90
  })

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div
        className="flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Spending vs Budget
        </h2>
        {alerts.length > 0 && (
          <span className="text-xs font-medium" style={{ color: 'var(--red)' }}>
            {alerts.length} {alerts.length === 1 ? 'alert' : 'alerts'}
          </span>
        )}
      </div>

      <div>
        {budgetRows.map(row => {
          const spent  = Number(row.total)
          const budget = Number(row.monthlyBudget!)
          const pct    = Math.round((spent / budget) * 100)
          const isOver = spent > budget
          const isNear = !isOver && pct >= 90

          return (
            <div
              key={row.categoryId ?? row.name}
              className="flex items-center gap-3 px-5 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: row.color }}
              />
              <span
                className="text-sm font-medium w-36 truncate"
                style={{ color: 'var(--text)' }}
              >
                {row.name}
              </span>
              <div className="flex-1 min-w-0">
                <BudgetBar spent={spent} budget={budget} color={row.color} />
              </div>
              <span
                className="text-xs tabular-nums w-28 text-right"
                style={{ color: isOver ? 'var(--red)' : 'var(--text-2)' }}
              >
                <CurrencyAmount amount={spent} /> / <CurrencyAmount amount={budget} />
              </span>
              <span
                className="text-xs font-semibold w-14 text-right flex items-center justify-end gap-1"
                style={{ color: isOver ? 'var(--red)' : isNear ? 'var(--accent)' : 'var(--text-2)' }}
              >
                {isOver && <TriangleAlert size={11} />}
                {isNear && !isOver && <CircleAlert size={11} />}
                {pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
