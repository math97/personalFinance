'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, X, Plus, Tag } from 'lucide-react'
import { api } from '@/lib/api'
import { BudgetBar } from '@/components/budget-bar'
import { CurrencyAmount } from '@/components/currency-amount'
import { useCurrency } from '@/hooks/useCurrency'

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [newKeywords, setNewKeywords] = useState<Record<string, string>>({})
  const [showAddCat, setShowAddCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#6b7280')

  const [currency] = useCurrency()
  const [budgetMode, setBudgetMode] = useState<Record<string, 'amount' | 'pct'>>({})
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>({})
  const [budgetSaving, setBudgetSaving] = useState<Record<string, boolean>>({})

  const now = new Date()

  useEffect(() => {
    Promise.all([
      api.categories.list(),
      api.dashboard.summary(now.getFullYear(), now.getMonth() + 1),
    ])
      .then(([cats, dash]) => {
        const spendMap: Record<string, number> = {}
        for (const row of dash.byCategory) {
          if (row.categoryId) spendMap[row.categoryId] = Number(row.total)
        }
        setCategories(cats.map((c: any) => ({
          ...c,
          currentMonthSpent: spendMap[c.id] ?? 0,
        })))
      })
      .catch(() => setError('Failed to load categories'))
      .finally(() => setIsLoading(false))
  }, [])

  async function addRule(catId: string) {
    const kw = newKeywords[catId]?.trim()
    if (!kw) return
    const rule = await api.categories.addRule(catId, kw)
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, rules: [...c.rules, rule] } : c))
    setNewKeywords(prev => ({ ...prev, [catId]: '' }))
  }

  async function deleteRule(catId: string, ruleId: string) {
    await api.categories.removeRule(ruleId)
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, rules: c.rules.filter((r: any) => r.id !== ruleId) } : c))
  }

  async function addCategory() {
    if (!newCatName.trim()) return
    const cat = await api.categories.create({ name: newCatName.trim(), color: newCatColor })
    setCategories(prev => [...prev, { ...cat, rules: [], _count: { transactions: 0 } }])
    setNewCatName('')
    setNewCatColor('#6b7280')
    setShowAddCat(false)
  }

  async function saveBudget(catId: string) {
    const mode = budgetMode[catId] ?? 'amount'
    const raw  = budgetInputs[catId] ?? ''
    if (raw === '') return

    let amount: number
    if (mode === 'pct') {
      const salary = Number(localStorage.getItem('finance_salary') ?? 3500)
      amount = Math.round((Number(raw) / 100) * salary * 100) / 100
    } else {
      amount = Number(raw)
    }
    if (isNaN(amount) || amount <= 0) return

    setBudgetSaving(prev => ({ ...prev, [catId]: true }))
    try {
      await api.categories.setBudget(catId, amount)
      setCategories(prev =>
        prev.map(c => c.id === catId ? { ...c, monthlyBudget: amount } : c),
      )
      setBudgetInputs(prev => ({ ...prev, [catId]: '' }))
    } finally {
      setBudgetSaving(prev => ({ ...prev, [catId]: false }))
    }
  }

  async function clearBudget(catId: string) {
    await api.categories.setBudget(catId, null)
    setCategories(prev =>
      prev.map(c => c.id === catId ? { ...c, monthlyBudget: null } : c),
    )
  }

  if (error) return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-6">
      <p className="text-sm py-12 text-center" style={{ color: 'var(--text-2)' }}>{error}</p>
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Categories</h1>
        <button onClick={() => setShowAddCat(s => !s)}
          className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium"
          style={{ background: showAddCat ? 'var(--accent)' : 'var(--surface)', color: showAddCat ? '#0c0c0e' : 'var(--text)', border: '1px solid var(--border)' }}>
          <Plus size={14} /> Add category
        </button>
      </div>

      {showAddCat && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl px-4 py-3 sm:flex-row sm:items-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)}
            className="w-8 h-8 rounded-lg cursor-pointer border-0" />
          <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCategory()}
            placeholder="Category name…" autoFocus
            className="flex-1 bg-transparent text-sm outline-none" style={{ color: 'var(--text)' }} />
          <button onClick={addCategory} className="rounded-lg px-3 py-1.5 text-sm font-semibold"
            style={{ background: 'var(--accent)', color: '#0c0c0e' }}>Add</button>
          <button onClick={() => setShowAddCat(false)} className="self-end sm:self-auto" style={{ color: 'var(--text-2)' }}><X size={16} /></button>
        </div>
      )}

      {!isLoading && categories.length === 0 && !showAddCat && (
        <div className="rounded-xl py-16 flex flex-col items-center gap-3" style={{ border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-center w-12 h-12 rounded-full" style={{ background: 'var(--surface-2)' }}>
            <Tag size={20} style={{ color: 'var(--text-2)' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>No categories yet</p>
          <p className="text-xs" style={{ color: 'var(--text-2)' }}>Add a category to start organizing your transactions</p>
        </div>
      )}

      {(isLoading || categories.length > 0) && (
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {categories.map((cat, i) => (
          <div key={cat.id}>
            <button onClick={() => setExpanded(e => e === cat.id ? null : cat.id)}
              className="flex w-full flex-wrap items-center gap-2 px-4 py-4 text-left sm:px-5"
              style={{ background: expanded === cat.id ? 'var(--surface-2)' : 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cat.color }} />
              <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text)' }}>{cat.name}</span>
              <span className="text-xs" style={{ color: 'var(--text-2)' }}>{cat.rules?.length ?? 0} rules</span>
              <span className="text-xs" style={{ color: 'var(--text-2)' }}>{cat._count?.transactions ?? 0} transactions</span>
              {cat.monthlyBudget != null ? (
                <span
                  className="text-xs px-2 py-0.5 rounded-md font-medium"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
                >
                  <CurrencyAmount amount={cat.monthlyBudget} />/mo
                </span>
              ) : (
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>no budget</span>
              )}
              {expanded === cat.id ? <ChevronUp size={14} style={{ color: 'var(--text-2)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-2)' }} />}
            </button>

            {expanded === cat.id && (
              <div className="px-4 py-4 sm:px-5" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-2)' }}>AUTO-MATCH RULES — if description contains:</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(cat.rules ?? []).map((rule: any) => (
                    <span key={rule.id} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
                      style={{ background: cat.color + '22', color: cat.color }}>
                      {rule.keyword}
                      <button onClick={() => deleteRule(cat.id, rule.id)} className="hover:opacity-70">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input value={newKeywords[cat.id] ?? ''}
                    onChange={e => setNewKeywords(prev => ({ ...prev, [cat.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addRule(cat.id)}
                    placeholder="add keyword…"
                    className="flex-1 rounded-lg px-3 py-1.5 text-xs outline-none sm:max-w-48"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--text)' }} />
                  <button onClick={() => addRule(cat.id)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium"
                    style={{ background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border-2)' }}>
                    + Add rule
                  </button>
                </div>

                {/* Monthly Budget section */}
                <div
                  className="mt-4 pt-4"
                  style={{ borderTop: '1px solid var(--border)' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                      Monthly Budget
                    </p>
                    {cat.monthlyBudget != null && (
                      <button
                        onClick={() => clearBudget(cat.id)}
                        className="text-xs"
                        style={{ color: 'var(--text-3)' }}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* £ / % toggle */}
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--text-3)' }}>Set by</span>
                    {(['amount', 'pct'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setBudgetMode(prev => ({ ...prev, [cat.id]: m }))}
                        className="px-3 py-1 rounded-md text-xs font-medium"
                        style={{
                          background: (budgetMode[cat.id] ?? 'amount') === m ? 'var(--accent)' : 'var(--surface-2)',
                          color:      (budgetMode[cat.id] ?? 'amount') === m ? '#0c0c0e'       : 'var(--text-2)',
                          border:     (budgetMode[cat.id] ?? 'amount') === m ? 'none'           : '1px solid var(--border)',
                        }}
                      >
                        {m === 'amount' ? `${currency} Amount` : '% of salary'}
                      </button>
                    ))}
                  </div>

                  {/* Input row */}
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div
                      className="flex items-center gap-1 px-3 h-9 rounded-lg text-sm"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', width: '100%', maxWidth: 160 }}
                    >
                      <span style={{ color: 'var(--text-3)' }}>
                        {(budgetMode[cat.id] ?? 'amount') === 'amount' ? currency : '%'}
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={(budgetMode[cat.id] ?? 'amount') === 'pct' ? 1 : 10}
                        value={budgetInputs[cat.id] ?? ''}
                        onChange={e => setBudgetInputs(prev => ({ ...prev, [cat.id]: e.target.value }))}
                        placeholder={(budgetMode[cat.id] ?? 'amount') === 'pct' ? '0' : '0.00'}
                        className="bg-transparent outline-none w-full text-sm"
                        style={{ color: 'var(--text)' }}
                      />
                    </div>
                    <button
                      onClick={() => saveBudget(cat.id)}
                      disabled={budgetSaving[cat.id] || !budgetInputs[cat.id]}
                      className="px-4 h-9 rounded-lg text-sm font-semibold disabled:opacity-40"
                      style={{ background: 'var(--accent)', color: '#0c0c0e' }}
                    >
                      {budgetSaving[cat.id] ? 'Saving…' : 'Save'}
                    </button>
                    {(budgetMode[cat.id] ?? 'amount') === 'pct' && budgetInputs[cat.id] && (
                      <span className="text-xs px-3 py-1 rounded-lg" style={{ background: '#f59e0b10', color: 'var(--accent)' }}>
                        = <CurrencyAmount
                          amount={Math.round((Number(budgetInputs[cat.id]) / 100) * Number(localStorage.getItem('finance_salary') ?? 3500) * 100) / 100}
                        />/mo
                      </span>
                    )}
                  </div>

                  {/* Progress bar — current month spend vs budget */}
                  {cat.monthlyBudget != null && cat.currentMonthSpent != null && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs" style={{ color: 'var(--text-2)' }}>
                        <span>
                          <CurrencyAmount amount={cat.currentMonthSpent} /> spent
                        </span>
                        <span style={{ color: cat.currentMonthSpent > cat.monthlyBudget ? 'var(--red)' : 'var(--text-2)' }}>
                          <CurrencyAmount amount={Math.abs(cat.monthlyBudget - cat.currentMonthSpent)} />
                          {cat.currentMonthSpent > cat.monthlyBudget ? ' over' : ' remaining'}
                        </span>
                      </div>
                      <BudgetBar
                        spent={cat.currentMonthSpent}
                        budget={cat.monthlyBudget}
                        color={cat.color}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      )}
    </div>
  )
}
