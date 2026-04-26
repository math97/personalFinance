'use client'

import { useState, useEffect } from 'react'
import { Check, Eye, EyeOff, Zap, CircleCheck, CircleX } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
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

  return (
    <div className="px-8 py-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text">Settings</h1>
        <p className="text-sm mt-1 text-text-2">Manage your preferences and AI configuration</p>
      </div>

      {/* General */}
      <div className="rounded-xl overflow-hidden mb-5 bg-surface border border-border">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-sm font-semibold text-text">General</p>
        </div>

        {/* Currency */}
        <div className="px-5 py-4 flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-text">Currency</p>
            <p className="text-xs mt-0.5 text-text-2">Symbol displayed across all amounts</p>
          </div>
          <div className="flex gap-2">
            {CURRENCIES.filter(c => c.symbol !== '£').map(c => (
              <button
                key={c.symbol}
                onClick={() => setCurrency(c.symbol as CurrencySymbol)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                  currency === c.symbol
                    ? 'bg-accent text-bg border-0'
                    : 'bg-surface-2 text-text-2 border border-border',
                )}
              >
                {c.symbol} {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Salary */}
        <div className="px-5 py-4 flex items-center justify-between gap-6 border-t border-border">
          <div>
            <p className="text-sm font-medium text-text">Monthly salary</p>
            <p className="text-xs mt-0.5 text-text-2">Used to calculate % of income spent</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 rounded-lg px-3 py-2 bg-surface-2 border border-border">
              <span className="text-sm text-text-2">{currency}</span>
              <input
                type="number" min={0} step={100} value={salary}
                onChange={e => setSalary(Number(e.target.value))}
                onKeyDown={e => e.key === 'Enter' && saveSalary()}
                className="bg-transparent text-sm outline-none w-24 text-right text-text"
              />
            </div>
            <button
              onClick={saveSalary}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium',
                salarySaved ? 'bg-green/10 text-green' : 'bg-accent text-bg',
              )}
            >
              {salarySaved ? <><Check size={14} /> Saved</> : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* AI Provider */}
      <div className="rounded-xl overflow-hidden bg-surface border border-border">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-sm font-semibold text-text">AI Provider</p>
        </div>

        {/* Provider toggle */}
        <div className="px-5 py-4 flex items-center justify-between gap-6 border-b border-border">
          <div>
            <p className="text-sm font-medium text-text">Provider</p>
            <p className="text-xs mt-0.5 text-text-2">Select which AI service to use</p>
          </div>
          <div className="flex gap-2">
            {(['anthropic', 'openrouter'] as Provider[]).map(p => (
              <button
                key={p}
                onClick={() => { setProvider(p); setTestResult(null) }}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                  provider === p
                    ? 'bg-accent text-bg border-0'
                    : 'bg-surface-2 text-text-2 border border-border',
                )}
              >
                {p === 'anthropic' ? 'Anthropic' : 'OpenRouter'}
              </button>
            ))}
          </div>
        </div>

        {/* API Key */}
        <div className="px-5 py-4 flex items-center gap-4 border-b border-border">
          <div className="w-40 shrink-0">
            <p className="text-sm font-medium text-text">API Key</p>
            <p className="text-xs mt-0.5 text-text-2">Stored securely in DB</p>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="flex-1 rounded-lg px-3 py-2 text-sm outline-none bg-surface-2 border border-border text-text"
            />
            <button onClick={() => setShowKey(v => !v)} className="text-text-2">
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Model */}
        <div className="px-5 py-4 flex items-start gap-4 border-b border-border">
          <div className="w-40 shrink-0">
            <p className="text-sm font-medium text-text">Model</p>
            <p className="text-xs mt-0.5 text-text-2">Exact model ID</p>
          </div>
          <div className="flex-1">
            <input
              type="text"
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder={provider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'google/gemini-2.5-flash-preview'}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none bg-surface-2 border border-border text-text"
            />
            <p className="text-xs mt-1.5 text-text-3">
              Enter the model ID exactly as the provider expects it
            </p>
          </div>
        </div>

        {/* Actions row */}
        <div className="px-5 py-4 flex items-center gap-3">
          <button
            onClick={testConnection}
            disabled={testing || !apiKey || !model}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 bg-surface-2 text-text-2 border border-border"
          >
            <Zap size={14} />
            {testing ? 'Testing…' : 'Test connection'}
          </button>

          {testResult && (
            <span className={cn('flex items-center gap-1.5 text-sm font-medium', testResult.ok ? 'text-green' : 'text-red')}>
              {testResult.ok
                ? <><CircleCheck size={14} /> Connection successful</>
                : <><CircleX size={14} /> {testResult.error ?? 'Invalid key or model'}</>}
            </span>
          )}

          <div className="flex-1" />

          <button
            onClick={saveAI}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 bg-accent text-bg"
          >
            {saved ? <><Check size={14} className="inline mr-1" />Saved</> : saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
