'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, X, Plus, Tag } from 'lucide-react'
import { api } from '@/lib/api'

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [newKeywords, setNewKeywords] = useState<Record<string, string>>({})
  const [showAddCat, setShowAddCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#6b7280')

  useEffect(() => {
    api.categories.list()
      .then(setCategories)
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

  if (error) return (
    <div className="px-8 py-6 max-w-3xl mx-auto">
      <p className="text-sm py-12 text-center" style={{ color: 'var(--text-2)' }}>{error}</p>
    </div>
  )

  return (
    <div className="px-8 py-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Categories</h1>
        <button onClick={() => setShowAddCat(s => !s)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
          style={{ background: showAddCat ? 'var(--accent)' : 'var(--surface)', color: showAddCat ? '#0c0c0e' : 'var(--text)', border: '1px solid var(--border)' }}>
          <Plus size={14} /> Add category
        </button>
      </div>

      {showAddCat && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 mb-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)}
            className="w-8 h-8 rounded-lg cursor-pointer border-0" />
          <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCategory()}
            placeholder="Category name…" autoFocus
            className="flex-1 bg-transparent text-sm outline-none" style={{ color: 'var(--text)' }} />
          <button onClick={addCategory} className="px-3 py-1.5 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--accent)', color: '#0c0c0e' }}>Add</button>
          <button onClick={() => setShowAddCat(false)} style={{ color: 'var(--text-2)' }}><X size={16} /></button>
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
              className="w-full flex items-center gap-3 px-5 py-4 text-left"
              style={{ background: expanded === cat.id ? 'var(--surface-2)' : 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cat.color }} />
              <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text)' }}>{cat.name}</span>
              <span className="text-xs mr-4" style={{ color: 'var(--text-2)' }}>{cat.rules?.length ?? 0} rules</span>
              <span className="text-xs mr-3" style={{ color: 'var(--text-2)' }}>{cat._count?.transactions ?? 0} transactions</span>
              {expanded === cat.id ? <ChevronUp size={14} style={{ color: 'var(--text-2)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-2)' }} />}
            </button>

            {expanded === cat.id && (
              <div className="px-5 py-4" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
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
                <div className="flex items-center gap-2">
                  <input value={newKeywords[cat.id] ?? ''}
                    onChange={e => setNewKeywords(prev => ({ ...prev, [cat.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addRule(cat.id)}
                    placeholder="add keyword…"
                    className="rounded-lg px-3 py-1.5 text-xs outline-none flex-1 max-w-48"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--text)' }} />
                  <button onClick={() => addRule(cat.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border-2)' }}>
                    + Add rule
                  </button>
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
