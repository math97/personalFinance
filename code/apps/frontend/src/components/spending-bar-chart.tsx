'use client'

import { Banknote, Pencil, Check, X, ArrowDownToLine } from 'lucide-react'
import { useCurrency } from '@/hooks/useCurrency'
import { TERMS } from '@/lib/terminology'
import { InfoIcon } from '@/components/ui/info-icon'

type Row = { name: string; total: number; color: string }

type Props = {
  data: Row[]
  grandTotal: number
  mode: 'spending' | 'income'
  onModeChange: (m: 'spending' | 'income') => void
  showSalaryEditor?: boolean
  salary?: number
  budget?: number
  editingSalary?: boolean
  salaryInput?: string
  onSalaryInputChange?: (v: string) => void
  onEditSalary?: () => void
  onSaveSalary?: () => void
  onCancelSalary?: () => void
  leftover?: number
  editingLeftover?: boolean
  leftoverInput?: string
  onLeftoverInputChange?: (v: string) => void
  onEditLeftover?: () => void
  onSaveLeftover?: () => void
  onCancelLeftover?: () => void
}

export function SpendingBarChart({
  data, grandTotal, mode, onModeChange,
  showSalaryEditor = false,
  salary = 3500,
  budget,
  editingSalary = false,
  salaryInput = '3500',
  onSalaryInputChange,
  onEditSalary,
  onSaveSalary,
  onCancelSalary,
  leftover = 0,
  editingLeftover = false,
  leftoverInput = '0',
  onLeftoverInputChange,
  onEditLeftover,
  onSaveLeftover,
  onCancelLeftover,
}: Props) {
  const [currency] = useCurrency()
  const maxTotal = data[0]?.total ?? 1
  const effectiveBudget = budget ?? salary
  const pctSpent = effectiveBudget > 0 ? Math.round((grandTotal / effectiveBudget) * 100) : 0

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{TERMS.whereItGoes.label}</h2>
        <div className="flex gap-0.5 rounded-lg p-0.5" style={{ background: 'var(--surface-2)' }}>
          {(['spending', 'income'] as const).map(m => (
            <button key={m} onClick={() => onModeChange(m)}
              className="px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-all"
              style={{
                background: mode === m ? 'var(--bg)' : 'transparent',
                color: mode === m ? 'var(--text)' : 'var(--text-2)',
                border: mode === m ? '1px solid var(--border-2)' : '1px solid transparent',
              }}>
              % {m === 'spending' ? 'Spend' : 'Income'}
            </button>
          ))}
        </div>
      </div>

      {/* Rows */}
      {data.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: 'var(--text-3)' }}>
          No {mode} this month
        </p>
      ) : (
        <div className="space-y-2.5">
          {data.map(row => {
            const pct = grandTotal > 0 ? (row.total / grandTotal) * 100 : 0
            const barW = (row.total / maxTotal) * 100
            return (
              <div key={row.name} className="flex items-center gap-3">
                <div className="shrink-0 rounded-full" style={{ width: 8, height: 8, background: row.color }} />
                <span className="text-sm shrink-0" style={{ color: 'var(--text-2)', width: 96 }}>{row.name}</span>
                <div className="flex-1">
                  <div className="flex-1 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)', height: 6 }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${barW}%`, background: row.color }} />
                  </div>
                </div>
                <div className="text-right shrink-0" style={{ minWidth: 72 }}>
                  <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
                    {currency}{row.total.toFixed(0)}
                  </p>
                  <p className="text-xs font-medium tabular-nums" style={{ color: row.color }}>
                    {pct.toFixed(1)}%
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-col gap-2 mt-4 pt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
        {/* Salary row — only shown when no income transactions recorded */}
        {showSalaryEditor && <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Banknote size={12} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
            {editingSalary ? (
              <div className="flex items-center gap-1">
                <span className="text-xs" style={{ color: 'var(--text-2)' }}>{currency}</span>
                <input
                  type="number"
                  value={salaryInput}
                  onChange={e => onSalaryInputChange?.(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') onSaveSalary?.(); if (e.key === 'Escape') onCancelSalary?.() }}
                  autoFocus
                  className="text-xs rounded px-1.5 py-0.5 outline-none w-20"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--accent)', color: 'var(--text)' }}
                />
                <span className="text-xs" style={{ color: 'var(--text-2)' }}>/mo</span>
                <button onClick={onSaveSalary} className="w-5 h-5 flex items-center justify-center rounded"
                  style={{ background: 'var(--accent)', color: '#0c0c0e' }}>
                  <Check size={10} />
                </button>
                <button onClick={onCancelSalary} className="w-5 h-5 flex items-center justify-center rounded"
                  style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                  <X size={10} />
                </button>
              </div>
            ) : (
              <>
                <span className="text-xs" style={{ color: 'var(--text-2)' }}>
                  Salary: {currency}{salary.toLocaleString()}/mo
                </span>
                <button onClick={onEditSalary}
                  className="flex items-center gap-1 px-2 py-0.5 rounded"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
                  <Pencil size={9} />
                  <span style={{ fontSize: 9 }}>Edit</span>
                </button>
              </>
            )}
          </div>

          {mode === 'spending' && (
            <div className="px-2 py-0.5 rounded" style={{ background: 'var(--surface-2)' }}>
              <span className="font-semibold" style={{ color: 'var(--accent)', fontSize: 10 }}>
                {pctSpent}% of budget
              </span>
            </div>
          )}
        </div>}

        {/* % of budget badge when salary editor is hidden (income from transactions) */}
        {!showSalaryEditor && mode === 'spending' && (
          <div className="flex justify-end">
            <div className="px-2 py-0.5 rounded" style={{ background: 'var(--surface-2)' }}>
              <span className="font-semibold" style={{ color: 'var(--accent)', fontSize: 10 }}>
                {pctSpent}% of budget
              </span>
            </div>
          </div>
        )}

        {/* Leftover row */}
        <div className="flex items-center gap-1.5">
          <ArrowDownToLine size={12} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
          {editingLeftover ? (
            <div className="flex items-center gap-1">
              <span className="text-xs" style={{ color: 'var(--text-2)' }}>{currency}</span>
              <input
                type="number"
                value={leftoverInput}
                onChange={e => onLeftoverInputChange?.(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onSaveLeftover?.(); if (e.key === 'Escape') onCancelLeftover?.() }}
                autoFocus
                className="text-xs rounded px-1.5 py-0.5 outline-none w-20"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--accent)', color: 'var(--text)' }}
              />
              <span className="text-xs" style={{ color: 'var(--text-2)' }}>{TERMS.saved.label.toLowerCase()}</span>
              <button onClick={onSaveLeftover} className="w-5 h-5 flex items-center justify-center rounded"
                style={{ background: 'var(--accent)', color: '#0c0c0e' }}>
                <Check size={10} />
              </button>
              <button onClick={onCancelLeftover} className="w-5 h-5 flex items-center justify-center rounded"
                style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                <X size={10} />
              </button>
            </div>
          ) : (
            <>
              <span className="text-xs flex items-center" style={{ color: 'var(--text-2)' }}>
                {TERMS.saved.label}<InfoIcon term="saved" />: {currency}{leftover.toLocaleString()}
              </span>
              <button onClick={onEditLeftover}
                className="flex items-center gap-1 px-2 py-0.5 rounded"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
                <Pencil size={9} />
                <span style={{ fontSize: 9 }}>Edit</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
