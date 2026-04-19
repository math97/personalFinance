'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Pencil, TriangleAlert, Check, Sparkles, X, Trash2, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { api } from '@/lib/api'

function CategoryPill({ name, color }: { name: string; color: string }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: color + '22', color }}>
      {name}
    </span>
  )
}

interface SaveRulePrompt {
  itemId: string
  keyword: string
  categoryId: string
  categoryName: string
}

export function BatchReviewClient({ batch, categories }: { batch: any; categories: any[] }) {
  const router = useRouter()
  const [items, setItems] = useState<any[]>(batch.imported)
  const [editing, setEditing] = useState<string | null>(null)
  const [editData, setEditData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [saveRulePrompt, setSaveRulePrompt] = useState<SaveRulePrompt | null>(null)

  const uncategorized = items.filter(i => !i.aiCategorized).length

  function startEdit(id: string) {
    const item = items.find(i => i.id === id)!
    setEditData(prev => ({
      ...prev,
      [id]: {
        rawDate: item.rawDate,
        rawDescription: item.rawDescription,
        rawAmount: Math.abs(Number(item.rawAmount)),
        catId: item.aiCategory?.id ?? '',
        wasUncategorized: !item.aiCategorized,
        isIncome: Number(item.rawAmount) > 0,
      },
    }))
    setEditing(id)
  }

  async function deleteItem(id: string) {
    if (!window.confirm('Remove this transaction from the batch?')) return
    await api.import.deleteTransaction(id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function toggleIncome(id: string) {
    const item = items.find(i => i.id === id)!
    const newAmount = Number(item.rawAmount) > 0
      ? -Math.abs(Number(item.rawAmount))
      : Math.abs(Number(item.rawAmount))
    try {
      await api.import.updateTransaction(id, { rawAmount: newAmount, aiCategoryId: newAmount > 0 ? null : item.aiCategory?.id ?? null })
      setItems(prev => prev.map(i => i.id === id
        ? { ...i, rawAmount: newAmount, aiCategory: newAmount > 0 ? null : i.aiCategory, aiCategorized: newAmount > 0 ? true : i.aiCategorized }
        : i
      ))
    } catch {
      // revert on failure — no UI change made
    }
  }

  async function saveEdit(id: string) {
    const d = editData[id]
    if (!d) return
    const updated = await api.import.updateTransaction(id, {
      rawDate: d.rawDate,
      rawDescription: d.rawDescription,
      rawAmount: d.isIncome ? Math.abs(Number(d.rawAmount)) : -Math.abs(Number(d.rawAmount)),
      aiCategoryId: d.isIncome ? null : (d.catId || null),
    })
    const cat = categories.find(c => c.id === d.catId) ?? null
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updated, aiCategory: cat, aiCategorized: !!cat } : i))
    setEditing(null)

    // Show save-as-rule prompt when an uncategorized item gets a category assigned
    if (d.wasUncategorized && d.catId && cat) {
      const item = items.find(i => i.id === id)!
      const keyword = item.rawDescription.split(/\s+/)[0].toLowerCase()
      setSaveRulePrompt({ itemId: id, keyword, categoryId: d.catId, categoryName: cat.name })
    }
  }

  async function handleSaveRule() {
    if (!saveRulePrompt) return
    await api.import.saveRule(saveRulePrompt.itemId, saveRulePrompt.keyword, saveRulePrompt.categoryId)
    setSaveRulePrompt(null)
  }

  function update(id: string, patch: object) {
    setEditData(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  async function handleConfirm() {
    setLoading(true)
    try {
      await api.import.confirm(batch.id)
      router.push('/import/inbox')
    } catch {
      setLoading(false)
    }
  }

  async function handleDiscard() {
    setLoading(true)
    try {
      await api.import.discard(batch.id)
      router.push('/import/inbox')
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="px-8 py-6 max-w-5xl mx-auto">
      {/* TopBar */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/import/inbox" className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-2)' }}>
          <ChevronLeft size={14} /> Inbox
        </Link>
        <span style={{ color: 'var(--text-3)' }}>/</span>
        <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{batch.filename}</span>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
          Reviewing
        </span>
        <div className="flex-1" />
        <button onClick={handleDiscard} disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
          style={{ background: 'var(--surface)', color: 'var(--red)', border: '1px solid var(--border)' }}>
          Discard
        </button>
        <button onClick={handleConfirm} disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#0c0c0e' }}>
          Confirm all {items.length}
        </button>
      </div>

      {/* Save-as-rule prompt */}
      {saveRulePrompt && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 mb-4"
          style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)33' }}
        >
          <Sparkles size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <p className="text-sm flex-1" style={{ color: 'var(--accent)' }}>
            Always categorize <strong>"{saveRulePrompt.keyword}"</strong> as <strong>{saveRulePrompt.categoryName}</strong>?
          </p>
          <button
            onClick={handleSaveRule}
            className="px-3 py-1 rounded-lg text-xs font-semibold"
            style={{ background: 'var(--accent)', color: '#0c0c0e' }}
          >
            Save rule
          </button>
          <button onClick={() => setSaveRulePrompt(null)} style={{ color: 'var(--accent)' }}>
            <X size={14} />
          </button>
        </div>
      )}

      <p className="text-sm mb-4" style={{ color: 'var(--text-2)' }}>
        {items.length} transactions extracted ·{' '}
        {uncategorized > 0
          ? <span style={{ color: 'var(--accent)' }}>{uncategorized} need categorization</span>
          : <span style={{ color: 'var(--green)' }}>all categorized ✓</span>}
      </p>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="grid text-xs font-medium uppercase tracking-wider px-5 py-3"
          style={{ gridTemplateColumns: '110px 1fr 180px 48px 130px 72px', borderBottom: '1px solid var(--border)', color: 'var(--text-2)' }}>
          <span>Date</span><span>Description</span><span>Category</span>
          <span>Type</span><span className="text-right">Amount</span><span />
        </div>

        {items.map(item => {
          const isEditing = editing === item.id
          const ed = editData[item.id] ?? {}
          const isIncome = Number(item.rawAmount) > 0
          return (
            <div key={item.id} className="grid items-center px-5 py-3"
              style={{
                gridTemplateColumns: '110px 1fr 180px 48px 130px 72px',
                borderBottom: '1px solid var(--border)',
                background: isIncome ? '#4ade8010' : !item.aiCategorized ? 'var(--amber-bg)' : 'transparent',
              }}>
              {isEditing ? (
                <input type="date" value={ed.rawDate ?? item.rawDate}
                  onChange={e => update(item.id, { rawDate: e.target.value })}
                  className="text-xs rounded-md px-2 py-1 outline-none w-28"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)', colorScheme: 'dark' }} />
              ) : (
                <span className="text-xs" style={{ color: 'var(--text-2)' }}>{item.rawDate}</span>
              )}

              {isEditing ? (
                <input value={ed.rawDescription ?? item.rawDescription}
                  onChange={e => update(item.id, { rawDescription: e.target.value })}
                  className="text-sm rounded-md px-2 py-1 outline-none mr-4"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)' }} />
              ) : (
                <span className="text-sm pr-4" style={{ color: 'var(--text)' }}>{item.rawDescription}</span>
              )}

              {/* Category */}
              {isEditing ? (
                <select value={ed.catId ?? item.aiCategory?.id ?? ''}
                  onChange={e => update(item.id, { catId: e.target.value })}
                  className="text-xs rounded-md px-2 py-1 outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)' }}>
                  <option value="">— none —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ) : (
                <div>
                  {isIncome
                    ? <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#4ade80' }}>Income</span>
                    : item.aiCategory
                      ? <CategoryPill name={item.aiCategory.name} color={item.aiCategory.color} />
                      : <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--accent)' }}>
                          <TriangleAlert size={12} /> Uncategorized
                        </span>}
                </div>
              )}

              {/* Type toggle */}
              {!isEditing && (
                <button
                  onClick={() => toggleIncome(item.id)}
                  title={isIncome ? 'Mark as expense' : 'Mark as income'}
                  className="w-7 h-7 flex items-center justify-center rounded-md transition-colors"
                  style={{ background: isIncome ? '#4ade8022' : 'var(--surface-2)', color: isIncome ? '#4ade80' : 'var(--text-3)', border: '1px solid var(--border)' }}>
                  {isIncome ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                </button>
              )}
              {isEditing && <div />}

              {/* Amount */}
              {isEditing ? (
                <input type="number" step="0.01"
                  value={ed.rawAmount ?? Math.abs(Number(item.rawAmount))}
                  onChange={e => update(item.id, { rawAmount: e.target.value })}
                  className="text-sm text-right rounded-md px-2 py-1 outline-none w-24 ml-auto"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)' }} />
              ) : (
                <span className="text-sm font-medium tabular-nums text-right"
                  style={{ color: isIncome ? '#4ade80' : 'var(--text)' }}>
                  {isIncome ? '+' : ''}£{Math.abs(Number(item.rawAmount)).toFixed(2)}
                </span>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-1">
                {isEditing ? (
                  <button onClick={() => saveEdit(item.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-md"
                    style={{ background: 'var(--accent)', color: '#0c0c0e' }}>
                    <Check size={12} />
                  </button>
                ) : (
                  <>
                    <button onClick={() => startEdit(item.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-md"
                      style={{ color: 'var(--text-2)' }}>
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => deleteItem(item.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-md"
                      style={{ color: 'var(--red)' }}>
                      <Trash2 size={13} />
                    </button>
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
