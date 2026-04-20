'use client'

import { useState, useEffect } from 'react'
import { Check, Eye, EyeOff, Zap, CircleCheck, CircleX } from 'lucide-react'
import { api } from '@/lib/api'
import { CURRENCIES, CurrencySymbol } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'

type Provider = 'anthropic' | 'openrouter'

export default function SettingsPage() {
  const [currency, setCurrency] = useCurrency()

  // Salary (existing)
  const [salary, setSalary] = useState(3500)
  const [salarySaved, setSalarySaved] = useState(false)

  // AI provider form
  const [provider, setProvider] = useState<Provider>('openrouter')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('finance_salary')
    if (stored) setSalary(Number(stored))

    api.settings.get().then(s => {
      setProvider(s.aiProvider as Provider)
      setModel(s.aiModel)
    }).catch(() => {})
  }, [])

  function saveSalary() {
    localStorage.setItem('finance_salary', String(salary))
    setSalarySaved(true)
    setTimeout(() => setSalarySaved(false), 2000)
  }

  async function saveAI() {
    setSaving(true)
    setSaved(false)
    setTestResult(null)
    try {
      await api.settings.update({ aiProvider: provider, aiApiKey: apiKey || undefined, aiModel: model })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  async function testConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await api.settings.test({ aiProvider: provider, aiApiKey: apiKey, aiModel: model })
      setTestResult(result)
    } catch {
      setTestResult({ ok: false, error: 'Request failed' })
    } finally {
      setTesting(false)
    }
  }

  const pillBase = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer'

  return (
    <div className="px-8 py-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>Manage your preferences and AI configuration</p>
      </div>

      {/* General */}
      <div className="rounded-xl overflow-hidden mb-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>General</p>
        </div>

        {/* Currency */}
        <div className="px-5 py-4 flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Currency</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>Symbol displayed across all amounts</p>
          </div>
          <div className="flex gap-2">
            {CURRENCIES.filter(c => c.symbol !== '£').map(c => (
              <button
                key={c.symbol}
                onClick={() => setCurrency(c.symbol as CurrencySymbol)}
                className={pillBase}
                style={{
                  background: currency === c.symbol ? 'var(--accent)' : 'var(--surface-2)',
                  color: currency === c.symbol ? '#0c0c0e' : 'var(--text-2)',
                  border: currency === c.symbol ? 'none' : '1px solid var(--border)',
                }}
              >
                {c.symbol} {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Salary */}
        <div className="px-5 py-4 flex items-center justify-between gap-6" style={{ borderTop: '1px solid var(--border)' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Monthly salary</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>Used to calculate % of income spent</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 rounded-lg px-3 py-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <span className="text-sm" style={{ color: 'var(--text-2)' }}>{currency}</span>
              <input
                type="number" min={0} step={100} value={salary}
                onChange={e => setSalary(Number(e.target.value))}
                onKeyDown={e => e.key === 'Enter' && saveSalary()}
                className="bg-transparent text-sm outline-none w-24 text-right"
                style={{ color: 'var(--text)' }}
              />
            </div>
            <button
              onClick={saveSalary}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
              style={{ background: salarySaved ? '#16a34a22' : 'var(--accent)', color: salarySaved ? '#16a34a' : '#0c0c0e' }}
            >
              {salarySaved ? <><Check size={14} /> Saved</> : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* AI Provider */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>AI Provider</p>
        </div>

        {/* Provider toggle */}
        <div className="px-5 py-4 flex items-center justify-between gap-6" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Provider</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>Select which AI service to use</p>
          </div>
          <div className="flex gap-2">
            {(['anthropic', 'openrouter'] as Provider[]).map(p => (
              <button
                key={p}
                onClick={() => { setProvider(p); setTestResult(null) }}
                className={pillBase}
                style={{
                  background: provider === p ? 'var(--accent)' : 'var(--surface-2)',
                  color: provider === p ? '#0c0c0e' : 'var(--text-2)',
                  border: provider === p ? 'none' : '1px solid var(--border)',
                }}
              >
                {p === 'anthropic' ? 'Anthropic' : 'OpenRouter'}
              </button>
            ))}
          </div>
        </div>

        {/* API Key */}
        <div className="px-5 py-4 flex items-center gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-40 shrink-0">
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>API Key</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>Stored securely in DB</p>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
            <button onClick={() => setShowKey(v => !v)} style={{ color: 'var(--text-2)' }}>
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Model */}
        <div className="px-5 py-4 flex items-start gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-40 shrink-0">
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Model</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>Exact model ID</p>
          </div>
          <div className="flex-1">
            <input
              type="text"
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder={provider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'google/gemini-2.5-flash-preview'}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-3)' }}>
              Enter the model ID exactly as the provider expects it
            </p>
          </div>
        </div>

        {/* Actions row */}
        <div className="px-5 py-4 flex items-center gap-3">
          <button
            onClick={testConnection}
            disabled={testing || !apiKey || !model}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
          >
            <Zap size={14} />
            {testing ? 'Testing…' : 'Test connection'}
          </button>

          {testResult && (
            <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: testResult.ok ? 'var(--green)' : 'var(--red)' }}>
              {testResult.ok
                ? <><CircleCheck size={14} /> Connection successful</>
                : <><CircleX size={14} /> {testResult.error ?? 'Invalid key or model'}</>}
            </span>
          )}

          <div className="flex-1" />

          <button
            onClick={saveAI}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#0c0c0e' }}
          >
            {saved ? <><Check size={14} className="inline mr-1" />Saved</> : saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
